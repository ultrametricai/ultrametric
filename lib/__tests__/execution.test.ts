import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { executionSchema, validateExecution, type Execution } from '../execution'
import { buildManifestStep, MANIFEST_VERSION } from '../processManifest'
import { loadProcesses } from '../processes'
import { loadProcessCatalog, validateExecutionCoverage } from '../shared-processes/catalog'
import { graphExecutionType } from '../shared-processes/graph'
import { processSummary } from '../shared-processes/summary'
import type { Part } from '../shared-processes/schema'

const records = loadProcessCatalog().processes.map(process => process.record)
function scopes(parts: Part[]): Array<{ metadata: Record<string, unknown> }> {
  return parts.flatMap(part => [part, ...part.options.flatMap(option => [option, ...scopes(option.parts)])])
}
const execution = (category: Execution['category'], basis: Execution['basis']): Execution => ({
  category, basis, rationale: 'Fixture assessment', evidence: ['fixture'], reviewRequired: category === null,
})
const part = (id: string, step: string) => records.find(record => record.id === id)!.parts.find(part => part.id === step)!

describe('execution assessments', () => {
  it('requires complete authoring coverage but permits older additive-schema imports', () => {
    expect(() => validateExecutionCoverage(records)).not.toThrow()
    const copied = structuredClone(records)
    delete copied[0].parts[0].metadata.execution
    expect(() => validateExecutionCoverage(copied)).toThrow('missing execution assessment')
    expect(() => validateExecution({}, 'legacy import')).not.toThrow()
  })
  it('rejects properties as categories and unsupported evidence bases', () => {
    for (const category of ['signature', 'approval', 'action', 'choice', 'agent', 'form', 'person']) {
      expect(executionSchema.safeParse({ ...execution(null, 'unresolved'), category }).success).toBe(false)
    }
    expect(() => validateExecution({ execution: execution('agent-native', 'human-work') }, 'fixture')).toThrow('documented interface')
    expect(() => validateExecution({ execution: { ...execution(null, 'unresolved'), reviewRequired: false } }, 'fixture')).toThrow('review')
    expect(() => validateExecution({ execution: execution('agent-native', 'local-work'), legalSignature: true }, 'fixture')).toThrow('human signature')
  })
  it('keeps browser evidence, IRS access limits, physical acts and local tools distinct', () => {
    expect(part('form_001', 'n3').metadata.execution).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(part('form_002', 'n3').metadata.execution).toMatchObject({ category: null, basis: 'unresolved', reviewRequired: true })
    expect(part('form_002', 'n3').metadata.execution).toHaveProperty('evidence', expect.arrayContaining(['open-rankings/experiments/computer-use/irs-ein-online.json']))
    expect(part('hr_005', 'n8').metadata.execution).toMatchObject({ category: 'human-offline' })
    const logo = part('brand_002', 'n1')
    expect(logo.options.find(option => option.id === 'design-tool-logo')!.metadata.execution).toMatchObject({ category: 'agent-native', basis: 'local-work' })
    expect(part('qs_050', 'n3').metadata.execution).toHaveProperty('evidence', expect.arrayContaining(['lib/openstartup/runway.ts']))
  })
  it('classifies documented controls independently of human permission and personal test receipts', () => {
    for (const [process, step] of [['comp_001', 'n5'], ['qs_063', 'n4'], ['scale_004', 'n3'], ['sw_011', 'n1']]) {
      const assessment = part(process, step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence' })
      expect(assessment.evidence.some(source => source.startsWith('https://'))).toBe(true)
    }
    expect(part('form_002', 'n2').metadata.execution).toMatchObject({ category: 'agent-native', basis: 'local-work' })
    expect(part('growth_014', 'n4').metadata.execution).toMatchObject({ category: 'agent-native', basis: 'documented-interface' })
    // Personal authentication stays with the teammate; a browser restriction alone
    // is insufficient to turn an unresolved filing into Human Online.
    expect(part('team_001', 'n2').metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work' })
  })
  it('resolves every local evidence reference to retained content', () => {
    for (const record of records) for (const scope of scopes(record.parts)) {
      const assessment = scope.metadata.execution as Execution | undefined
      if (!assessment) continue
      for (const evidence of assessment.evidence.filter(ref => !ref.startsWith('https://'))) {
        const [file, pointer] = evidence.split('#')
        const text = readFileSync(file, 'utf8')
        if (!pointer) { expect(text.length).toBeGreaterThan(0); continue }
        let value: unknown = JSON.parse(text)
        for (const key of pointer.slice(1).split('/')) value = (value as Record<string, unknown>)[key.replaceAll('~1', '/').replaceAll('~0', '~')]
        expect(value, evidence).not.toBeNull()
        expect(value, evidence).not.toBeUndefined()
        expect(value, evidence).not.toBe('')
      }
    }
  })
  it('leaves v2 executor kinds and approval semantics unchanged across the corpus', () => {
    expect(MANIFEST_VERSION).toBe(2)
    for (const task of loadProcesses()) for (const node of task.dag.nodes) {
      const { execution: assessment, ...legacyNode } = node
      const { execution: projected, ...step } = buildManifestStep(node)
      expect(projected).toEqual(assessment)
      expect(step).toEqual(buildManifestStep(legacyNode))
    }
  })
  it('counts signature and approval as properties alongside execution categories', () => {
    const record = structuredClone(records.find(record => record.id === 'brand_002')!)
    record.parts = [{ ...record.parts[0], options: [], metadata: { route: 'person', execution: execution('human-online', 'human-work'), legalSignature: true, approvalRequired: true } }]
    const summary = processSummary(record)
    expect(summary.executionCounts['human-online']).toBe(1)
    expect(summary.executionSignatures).toBe(1)
    expect(summary.executionApprovals).toBe(1)
    expect(graphExecutionType({ id: 'one', title: 'Sign', metadata: record.parts[0].metadata, when: null, scope: 'fixture' }).label).toBe('Human Online')
  })
})
