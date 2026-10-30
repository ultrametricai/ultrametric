import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { GEO_COUNTRIES } from '../lib/geoPreference'
import { loadProcessCatalog } from '../lib/shared-processes/catalog'

// coverage/index.json is the cross-area rollup: one entry per top-level content area, each
// pointing at the file where that area tracks its own gaps in detail. These gates stop the
// index drifting from the tree: the area list must match the directories the README layout
// tree names (each pinned to a real tracked directory here and in readme.test.ts), every
// detail pointer must resolve to a committed file, and the index must validate against the
// committed schema. Everything reads the committed tree; no network.

interface DetailPointer {
  path: string
  tracks: string
}
interface Area {
  id: string
  name: string
  maturity: string
  summary: string
  known_gaps: string[]
  detail: DetailPointer[]
}
interface CoverageIndex {
  updated_on: string
  maturity_grades: Record<string, string>
  areas: Area[]
}

const ROOT = path.resolve(__dirname, '..')
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'coverage/index.json'), 'utf8')) as CoverageIndex
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/coverage-index.schema.json'), 'utf8'))

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1024 * 1024 * 512 })
  .toString('utf8').split('\0').filter(Boolean)
const topLevelDirs = new Set(tracked.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))

// The area list the index must carry: the directories the README layout tree names.
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
const tree = readme.slice(readme.indexOf('<pre>'), readme.indexOf('</pre>'))
const treeDirs = [...tree.matchAll(/^[├└]── (?:<a href="#[a-z-]+">)?([a-z][a-z-]*)(?:<\/a>)?\//gm)]
  .map((match) => match[1])

describe('coverage/index.json', () => {
  it('validates against the committed schema, byte-stable', () => {
    expect(z.fromJSONSchema(schema).parse(index)).toEqual(index)
  })

  it('lists exactly the README layout-tree areas (an area is listed if and only if the tree names it)', () => {
    const ids = index.areas.map((area) => area.id)
    expect(treeDirs.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...treeDirs].sort())
  })

  it('covers every tracked open-* catalog and jurisdictions, so a new content dir needs an entry', () => {
    const ids = new Set(index.areas.map((area) => area.id))
    for (const dir of topLevelDirs) {
      if (dir.startsWith('open-') || dir === 'jurisdictions') {
        expect(ids.has(dir), `top-level content dir ${dir} has no index entry`).toBe(true)
      }
    }
  })

  it('every area and every detail pointer resolves to a committed path', () => {
    const trackedSet = new Set(tracked)
    for (const area of index.areas) {
      expect(topLevelDirs.has(area.id), `${area.id} is not a tracked top-level directory`).toBe(true)
      expect(fs.statSync(path.join(ROOT, area.id)).isDirectory(), `${area.id} is not a directory`).toBe(true)
      for (const pointer of area.detail) {
        expect(trackedSet.has(pointer.path), `${area.id}: detail source ${pointer.path} is not a tracked file`).toBe(true)
      }
    }
  })

  it('prose names only jurisdictions that exist in-tree', () => {
    // The staleness class caught in the 2026-10-19 audit: the open-law entry still said
    // "one EU data-protection card" while the tree carried UK and EU directories. Entry
    // prose stays functional (no counts, no enumerations), and any jurisdiction a summary
    // or gap line does name must be backed by committed data: an open-law/<CODE> directory,
    // a jurisdictions/registry.json code, a corpus geoNotes country, or the geo switcher set.
    const backed = new Set<string>()
    for (const entry of fs.readdirSync(path.join(ROOT, 'open-law'), { withFileTypes: true })) {
      if (entry.isDirectory()) backed.add(entry.name.toUpperCase())
    }
    const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'jurisdictions/registry.json'), 'utf8')) as {
      jurisdictions: Array<{ code: string }>
    }
    for (const { code } of registry.jurisdictions) {
      backed.add(code.toUpperCase())
      backed.add(code.toUpperCase().split('-')[0])
    }
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-processes/catalog.json'), 'utf8')) as {
      processes: string[]
    }
    for (const slug of catalog.processes) {
      const definition = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'open-processes', `${slug}.json`), 'utf8'),
      ) as { metadata?: { geoNotes?: Array<{ country: string }> } }
      for (const note of definition.metadata?.geoNotes ?? []) backed.add(note.country.toUpperCase())
    }
    for (const country of GEO_COUNTRIES) backed.add(country.toUpperCase())
    // Two-letter uppercase tokens that are not jurisdictions.
    const notJurisdictions = new Set(['AI', 'CI', 'ID', 'PR', 'UI', 'VC', 'HR', 'OS'])
    for (const area of index.areas) {
      for (const prose of [area.summary, ...area.known_gaps]) {
        for (const match of prose.matchAll(/\b(US-[A-Z]{2,3}|[A-Z]{2})\b/g)) {
          const token = match[1]
          if (notJurisdictions.has(token)) continue
          expect(backed.has(token), `${area.id} prose names ${token}, which no committed jurisdiction backs`).toBe(true)
        }
      }
    }
  })

  it('every maturity grade an area uses is defined in maturity_grades', () => {
    for (const area of index.areas) {
      expect(Object.keys(index.maturity_grades), `${area.id} uses an undefined grade`).toContain(area.maturity)
    }
  })
})

describe('startup task inventory and operational expansion', () => {
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
  const inventory = read('coverage/startup-task-inventory.json') as {
    sources: string
    measurement: string
    domains: Array<{ id: string; name: string }>
    needs: Array<{ id: string; domain: string; status: string; processIds: string[]; sourceIds: string[] }>
    specialistBoundaries: Array<{ id: string; scope: string; entryProcessIds: string[]; status: string }>
  }
  const sources = read(inventory.sources) as { sources: Array<{ id: string; url: string; checkedOn: string }> }
  const audit = read('coverage/startup-expansion-audit.json') as { newProcessIds: string[]; fixture: string }
  const fixtures = read(audit.fixture) as { fictional: boolean; cases: Array<{ company: string; expectedProcessId: string; expectedOutcome: string; externalActionsAuthorized: boolean; gateChecks: Array<{ id: string; stepId: string; facts: { triggerConfirmed: boolean; requiredLocationsKnown: boolean; expertReviewComplete: boolean; approval: { role: string; scope: string } | null }; expectedDecision: string }> }> }
  const catalog = loadProcessCatalog().processes
  const records = new Map(catalog.map((p) => [p.record.id, p.record]))

  it('validates the inventory, source register, audit and fictional cases against their published schemas', () => {
    for (const [data, name] of [[inventory, 'startup-task-inventory'], [sources, 'startup-process-sources'], [audit, 'startup-expansion-audit'], [fixtures, 'startup-lifecycle-fixtures']] as const) {
      expect(z.fromJSONSchema(read(`schemas/${name}.schema.json`)).parse(data)).toEqual(data)
    }
  })

  it('resolves needs and source identities, retains explicit gaps and separates specialist boundaries', () => {
    expect(new Set(inventory.needs.map((n) => n.id)).size).toBe(inventory.needs.length)
    expect(new Set(inventory.domains.map((d) => d.id)).size).toBe(inventory.domains.length)
    const domains = new Set(inventory.domains.map((d) => d.id))
    const sourceIds = new Set(sources.sources.map((s) => s.id))
    expect(sourceIds.size).toBe(sources.sources.length)
    for (const need of inventory.needs) {
      expect(domains.has(need.domain), need.id).toBe(true)
      expect(need.status === 'guide-present', need.id).toBe(need.processIds.length > 0)
      for (const id of need.processIds) expect(records.has(id), `${need.id}: ${id}`).toBe(true)
      for (const id of need.sourceIds) expect(sourceIds.has(id), `${need.id}: ${id}`).toBe(true)
    }
    const mapped = new Set(inventory.needs.flatMap((n) => n.processIds))
    for (const process of catalog.filter((p) => !p.taskIds)) expect(mapped.has(process.record.id), process.slug).toBe(true)
    for (const boundary of inventory.specialistBoundaries) {
      expect(boundary.status).not.toBe('covered')
      for (const id of boundary.entryProcessIds) expect(records.has(id), id).toBe(true)
    }
    expect(inventory.measurement).toContain('does not establish universal completeness')
  })

  it('new guides have distinct outcomes, scoped applicability, sourced instructions and human gates', () => {
    expect(new Set(audit.newProcessIds).size).toBe(audit.newProcessIds.length)
    for (const id of audit.newProcessIds) {
      const record = records.get(id)!
      expect(record, id).toBeDefined()
      expect(record.when, id).toBeTruthy()
      expect(record.outcomes.length, id).toBeGreaterThan(0)
      expect(record.parts.length, id).toBeGreaterThanOrEqual(5)
      expect(record.references.some((r) => r.kind === 'url'), id).toBe(true)
      expect(record.metadata.editorial).toMatchObject({ status: 'draft' })
      expect(record.notes.some((n) => n.text.includes('No case-specific legal review')), id).toBe(true)
      expect(record.metadata.provenRuns, id).toBeUndefined()
      for (const part of record.parts) {
        expect(part.guidance?.length, `${id}/${part.id}`).toBeGreaterThan(100)
        expect(part.metadata.execution).not.toMatchObject({ automationEvidence: { status: 'observed' } })
        if (part.metadata.route !== 'agent') expect(part.metadata.approvalRequired, `${id}/${part.id}`).toBe(true)
      }
      expect(record.parts.at(-1)?.metadata.verify, id).toMatchObject({ how: record.outcomes[0] })
    }
  })

  it('fictional examples cover the additions and exercise context, scope, review and approval stops', () => {
    expect(fixtures.fictional).toBe(true)
    expect(new Set(fixtures.cases.map((c) => c.expectedProcessId))).toEqual(new Set(audit.newProcessIds))
    for (const example of fixtures.cases) {
      expect(example.company).toContain('Fictional')
      expect(example.externalActionsAuthorized).toBe(false)
      const record = records.get(example.expectedProcessId)!
      expect(record.outcomes).toContain(example.expectedOutcome)
      // These are editorial gate fixtures, not prose matching or an external-action executor.
      expect(new Set(example.gateChecks.map((g) => g.expectedDecision))).toEqual(new Set([
        'out-of-scope', 'needs-context', 'needs-approval', 'needs-review', 'ready-for-human',
      ]))
      for (const gate of example.gateChecks) {
        const step = record.parts.find((p) => p.id === gate.stepId)!
        expect(step, `${example.expectedProcessId}/${gate.stepId}`).toBeDefined()
        expect(step.metadata.approvalRequired).toBe(true)
        expect(step.metadata.execution).toMatchObject({ reviewRequired: true })
        const { facts } = gate
        const approval = step.metadata.approval as { role: string; scope: string } | undefined
        const decision = !facts.triggerConfirmed ? 'out-of-scope'
          : !facts.requiredLocationsKnown ? 'needs-context'
          : !facts.approval || facts.approval.role !== approval?.role || facts.approval.scope !== approval?.scope ? 'needs-approval'
          : !facts.expertReviewComplete ? 'needs-review' : 'ready-for-human'
        expect(decision, `${example.expectedProcessId}/${gate.id}`).toBe(gate.expectedDecision)
        // Even a ready step is work for the accountable person, not delegated authority.
        expect(step.metadata.route).not.toBe('agent')
      }
    }
  })

  it('the readable coverage map is regenerated from the current inventory and canonical titles', () => {
    expect(() => execFileSync(process.execPath, ['scripts/generate-startup-coverage.mjs', '--check'], { cwd: ROOT })).not.toThrow()
  })
})
