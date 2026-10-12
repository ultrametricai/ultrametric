import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadSharedProcesses } from '../shared-processes/load'
import { collectDecisions, validateCatalog, type SharedRecord, type Part } from '../shared-processes/schema'
import { processGraphs } from '../shared-processes/graph'

function part(id: string, overrides: Partial<Part> = {}): Part {
  return { id, kind: 'step', title: id, guidance: null, when: null, ref: null, options: [], references: [], notes: [], metadata: {}, ...overrides }
}
function record(id: string, overrides: Partial<SharedRecord> = {}): SharedRecord {
  return { schemaVersion: 1, id, kind: 'process', title: id, summary: '', outcomes: [], guidance: null, parts: [], links: [], references: [], notes: [], metadata: {}, ...overrides }
}
function fixture() {
  const choice = part('method', { kind: 'decision', options: ['self', 'contractor'].map(id => ({ id, title: id, summary: '', when: null, parts: [], references: [], notes: [], metadata: {} })) })
  return [record('build', { parts: [choice, part('self'), part('hire', { kind: 'reference', ref: 'contracting' }), part('review')], links: [
    { from: 'method', option: 'self', to: 'self' }, { from: 'method', option: 'contractor', to: 'hire' },
    { from: 'self', to: 'review' }, { from: 'hire', to: 'review' },
  ] }), record('contracting')]
}

describe('shared process definitions', () => {
  it('validates the staging example separately from the real catalog', () => {
    const records = validateCatalog(JSON.parse(readFileSync('content/processes/examples/staging.json', 'utf8')))
    expect(records).toHaveLength(2)
    expect(records.every(record => record.metadata.synthetic === true && record.guidance && record.outcomes.length)).toBe(true)
    expect(collectDecisions(records, 'shared-schema-staging-check')).toHaveLength(1)
    expect(loadSharedProcesses().some(record => record.id.startsWith('shared-schema-staging'))).toBe(false)
  })
  it('validates the authored catalog and accounts for the imported inventory', () => {
    const all = loadSharedProcesses()
    const imported = JSON.parse(readFileSync('content/processes/import-manifest.json', 'utf8'))
    expect(all.map(record => record.id)).toEqual(expect.arrayContaining(Object.keys(imported.records)))
  })
  it('supports option branches, shared joins, nesting, and new records without import history', () => {
    const records = validateCatalog(fixture())
    expect(collectDecisions(records, 'build').map(d => [d.recordId, d.part.id])).toEqual([['build', 'method']])
    expect(records[0].links[2].option).toBeUndefined()
  })
  it.each([
    ['blank identity', (r: SharedRecord[]) => { r[0].id = ' ' }],
    ['missing target', (r: SharedRecord[]) => { r[0].links[0].to = 'missing' }],
    ['wrong option', (r: SharedRecord[]) => { r[0].links[0].option = 'missing' }],
    ['option on an ordinary step', (r: SharedRecord[]) => { r[0].links[2].option = 'self' }],
    ['duplicate option', (r: SharedRecord[]) => { r[0].parts[0].options.push(r[0].parts[0].options[0]) }],
    ['duplicate part', (r: SharedRecord[]) => { r[0].parts.push(r[0].parts[1]) }],
    ['empty decision', (r: SharedRecord[]) => { r[0].parts[0].options = [] }],
    ['null reference', (r: SharedRecord[]) => { r[0].parts[2].ref = null }],
    ['graph cycle', (r: SharedRecord[]) => { r[0].links.push({ from: 'review', to: 'method' }) }],
    ['nesting cycle', (r: SharedRecord[]) => { r[1].parts = [part('back', { kind: 'reference', ref: 'build' })] }],
    ['invalid URL', (r: SharedRecord[]) => { r[0].references = [{ kind: 'url', url: 'javascript:alert(1)', title: 'Bad', description: null, role: 'source' }] }],
    ['legacy tool label in metadata', (r: SharedRecord[]) => { r[0].metadata.toolCall = 'invented-operation' }],
    ['legacy operations nested inside option metadata', (r: SharedRecord[]) => { r[0].parts[0].options[0].metadata.legacy = [{ functionCalls: [{ method: 'invented-operation' }] }] }],
  ])('rejects %s', (_, mutate) => {
    const records = fixture()
    mutate(records)
    expect(() => validateCatalog(records)).toThrow()
  })
  it('keeps notes open and source unknowns explicit', () => {
    const records = fixture()
    records[0].notes = [{ text: 'A contextual recommendation.', references: [{ kind: 'url', url: 'https://example.com/docs', title: null, description: null, role: 'source' }] }]
    records[0].guidance = 'Authored guidance.'
    records[0].outcomes = ['An authored outcome.']
    expect(validateCatalog(records)[0].notes[0].text).toBe('A contextual recommendation.')
  })

  it.each([
    ['growth_014', 'n6', 'n4'], // Required customer notices precede billing changes.
    ['growth_014', 'n4', 'n7'], // Reconcile the applied change before reporting effects.
    ['sit_012', 'n7', 'n5'], // Observe the parallel run before cutover.
    ['sit_012', 'n5', 'n6'], // Accept cutover before retiring the old service.
    ['site_001', 'n3', 'n2'], // Review the preview before publication.
    ['growth_012', 'n1', 'n3'], // Establish eligibility before activating outreach.
    ['growth_012', 'n3', 'n4'], // Test setup before monitoring actual sends.
  ])('%s places prerequisite %s before %s in the rendered graph', (id, before, after) => {
    const records = loadSharedProcesses()
    const selected = records.find(record => record.id === id)!
    const graph = processGraphs(selected, records)[0]
    const layer = (partId: string) => graph.layers.findIndex(nodes => nodes.some(node => node.id === partId))
    expect(graph.unresolved).toBe(0)
    expect(layer(before)).toBeGreaterThanOrEqual(0)
    expect(layer(after)).toBeGreaterThan(layer(before))
  })

  it('keeps cancellation independent of a retention call and outreach meetings conditional', () => {
    const records = loadSharedProcesses()
    const churn = records.find(record => record.id === 'growth_002')!
    expect(churn.links.find(link => link.from === 'n1' && link.to === 'n6')?.when).toContain('cancellation')
    expect(churn.links.find(link => link.from === 'n4' && link.to === 'n6')?.when).toContain('does not need a call')
    const outbound = processGraphs(records.find(record => record.id === 'growth_012')!, records)[0]
    for (const target of ['n5', 'n6']) {
      const incoming = outbound.edges.filter(edge => edge.to === target)
      expect(incoming).toHaveLength(1)
      expect(incoming[0].conditional).toBe(true)
      expect(outbound.nodes.find(node => node.id === target)?.when).toBeTruthy()
    }
  })
})
