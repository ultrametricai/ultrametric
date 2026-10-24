import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GEO_RESOLUTION_COUNTRIES,
  loadProcesses,
  type ProcessTask,
  type StepGeoResolution,
} from '../processes'
import { GEO_NOTE_KINDS } from '../geoPreference'

const DATA_DIR = path.join(process.cwd(), 'open-processes')

function allResolutions(tasks: ProcessTask[]) {
  const rows: { task: ProcessTask; nodeId: string; resolution: StepGeoResolution }[] = []
  for (const t of tasks) {
    for (const n of t.dag.nodes) {
      for (const resolution of n.geoResolutions ?? []) rows.push({ task: t, nodeId: n.id, resolution })
    }
  }
  return rows
}

// Step-level geo resolutions (founder ask 2026-10-19): the step's own text is the global
// abstraction; geoResolutions carries each country's concrete mechanics, with the US as one
// explicit entry among the rest. The hard invariants (US entry present and 'analog', one entry
// per country, actionLabel only with actionUrl, none on jurisdiction-conditional nodes) are
// load-enforced in loadProcesses; these tests pin the curation on top of them.
describe('step geo resolutions', () => {
  it('every committed resolution uses the shared country and kind vocabulary', () => {
    const rows = allResolutions(loadProcesses(DATA_DIR))
    for (const { task, nodeId, resolution } of rows) {
      const at = `${task.id}/${nodeId}/${resolution.country}`
      expect(GEO_RESOLUTION_COUNTRIES, at).toContain(resolution.country)
      expect(GEO_NOTE_KINDS, at).toContain(resolution.kind)
      expect(resolution.label.length, at).toBeGreaterThan(5)
      if (resolution.actionUrl) expect(resolution.actionUrl, at).toMatch(/^https:\/\//)
    }
  })

  it('a step with resolutions keeps its abstraction as the default text: no US institution in the label', () => {
    const tasks = loadProcesses(DATA_DIR)
    // The restructuring contract: once the US mechanics moved down into the US resolution, the
    // step's own label stops speaking in US institutions. Spot institutions, not every noun.
    const usInstitutions = /\bIRS\b|\bUSPTO\b|\bUSCIS\b|\bUSPS\b|\bDelaware\b|\bDGCL\b|83\(b\)|\bI-9\b|\bW-4\b|\bat-will\b|\bISO 3-month\b/
    for (const t of tasks) {
      for (const n of t.dag.nodes) {
        if (!n.geoResolutions?.length) continue
        expect(n.label, `${t.id}/${n.id} label stays the global abstraction`).not.toMatch(usInstitutions)
      }
    }
  })

  it('every law rule cited inside a resolution resolves to a committed rule in open-law/', () => {
    const ruleIds = new Set<string>()
    const lawDir = path.join(process.cwd(), 'open-law')
    for (const entry of fs.readdirSync(lawDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'citations') continue
      for (const file of fs.readdirSync(path.join(lawDir, entry.name))) {
        if (!file.endsWith('.json')) continue
        const rule = JSON.parse(fs.readFileSync(path.join(lawDir, entry.name, file), 'utf8'))
        if (rule.id) ruleIds.add(rule.id)
      }
    }
    // "law rule <id>" is the inline citation form ("law rule", not bare "rule", so the grep
    // stays disjoint from the lore layer's "lore rule <id>" citations).
    for (const { task, nodeId, resolution } of allResolutions(loadProcesses(DATA_DIR))) {
      const prose = `${resolution.label} ${resolution.guidance ?? ''}`
      for (const match of prose.matchAll(/law rule ([a-z0-9.-]+)/g)) {
        expect(ruleIds.has(match[1]), `${task.id}/${nodeId}/${resolution.country} cites unknown law rule ${match[1]}`).toBe(true)
      }
    }
  })

  // The first wave (founder ask 2026-10-19): the exhibit-A record plus the clearest class-(a)
  // offenders from the audit, restructured so the step text is the global abstraction and the
  // US is one resolution among several.
  it('pins the first-wave restructuring: sit_007, hr_001, sit_019, sit_001, qs_052', () => {
    const tasks = loadProcesses(DATA_DIR)
    const byId = (id: string) => tasks.find((t) => t.id === id)!
    const countries = (id: string, nodeId: string) =>
      (byId(id).dag.nodes.find((n) => n.id === nodeId)?.geoResolutions ?? []).map((r) => r.country).sort()

    // Exhibit A: the departing-equity settlement resolves in six countries beside the US
    // (NZ and AU joined both steps in the 2026-10-23 country run).
    expect(byId('sit_007').geoScope).toBe('global')
    expect(countries('sit_007', 'n4')).toEqual(['AU', 'CA', 'DE', 'IN', 'NZ', 'PT', 'SG', 'UK', 'US'])
    expect(countries('sit_007', 'n3')).toEqual(['AU', 'FR', 'IN', 'NZ', 'SG', 'UK', 'US'])
    // The notice-terms step resolves in every covered country.
    expect(byId('sit_019').geoScope).toBe('global')
    expect(countries('sit_019', 'n2')).toEqual(['AU', 'CA', 'DE', 'EE', 'FR', 'IN', 'KR', 'PT', 'SG', 'UK', 'US'])
    // First-hire formalities: the I-9/W-4 mechanics moved into the US entry. geoScope flipped
    // to 'global' with the 2026-10-22 extension of the startup_002 precedent; the
    // employment-agreement artifact keeps its geo entries under the restructured-global rule
    // (lib/__tests__/processArtifacts.test.ts).
    expect(byId('hr_001').geoScope).toBe('global')
    expect(countries('hr_001', 'n6')).toEqual(['AU', 'EE', 'FR', 'KR', 'PT', 'SG', 'UK', 'US'])
    // The register lookup: TSDR is the US resolution, with the committed IN/PT/CA checks beside it.
    expect(byId('sit_001').geoScope).toBe('global')
    expect(countries('sit_001', 'n3')).toEqual(['AU', 'CA', 'IN', 'PT', 'US'])
    // A US-only resolution set on a global record is the design working: no other country's
    // mechanics are committed for the cap-table approval steps, so the abstraction stands.
    expect(countries('qs_052', 'n2b')).toEqual(['US'])
    expect(countries('qs_052', 'n3')).toEqual(['US'])
  })

  // Wave 3 empties the worklist: the twelve restructured records plus the form_011
  // reclassification to class (b) (title-scoped national regime, the form_002/opp_002/tax_003
  // precedent: the LLC is the US entity form, the CA geoNote is not-applicable, and the n3 geo
  // decision already carries the per-country entity options).
  it('pins the wave-3 restructuring and the form_011 class-(b) reclassification', () => {
    const tasks = loadProcesses(DATA_DIR)
    const byId = (id: string) => tasks.find((t) => t.id === id)!
    const countries = (id: string, nodeId: string) =>
      (byId(id).dag.nodes.find((n) => n.id === nodeId)?.geoResolutions ?? []).map((r) => r.country).sort()

    // The deadline steps resolve in every covered country.
    expect(byId('sit_008').geoScope).toBe('global')
    expect(countries('sit_008', 'n2')).toEqual(['AU', 'CA', 'DE', 'FR', 'IN', 'KR', 'PT', 'SG', 'UK', 'US'])
    expect(byId('sit_009').geoScope).toBe('global')
    expect(countries('sit_009', 'n2')).toEqual(['AU', 'CA', 'DE', 'FR', 'IN', 'PT', 'SG', 'UK', 'US'])
    // The claim rides the tax return everywhere a regime exists; India resolves not-applicable.
    expect(byId('tax_010').geoScope).toBe('global')
    expect(countries('tax_010', 'n5')).toEqual(['AU', 'CA', 'DE', 'EE', 'FR', 'IN', 'KR', 'PT', 'SG', 'UK', 'US'])
    // The strategy step carries every covered route; the LCA machinery is the US cut.
    expect(byId('hr_011').geoScope).toBe('global')
    expect(countries('hr_011', 'n1')).toEqual(['AU', 'CA', 'DE', 'FR', 'IN', 'PT', 'SG', 'UK', 'US'])
    expect(byId('vc_001').geoScope).toBe('global')
    expect(byId('opp_012').geoScope).toBe('global')
    // The startup_002 precedent extended (maintainer decision 2026-10-22): these read as
    // global abstractions with the US in step geoResolutions, so they carry scope 'global';
    // their artifacts keep geo entries under the restructured-global rule in processArtifacts.
    for (const id of ['qs_044', 'fund_001', 'fund_002', 'fund_004', 'legal_002']) {
      expect(byId(id).geoScope, `${id} is global (restructured abstraction)`).toBe('global')
    }
    // form_011 reclassified (b): no resolutions, the geo decision options stand.
    expect(byId('form_011').geoScope).toBe('us')
    expect(byId('form_011').dag.nodes.some((n) => (n.geoResolutions ?? []).length > 0)).toBe(false)
  })

  // The worklist (emptied by wave 3) lives in docs/geo-resolution-worklist.json so new
  // offenders are tracked in-tree, not in a PR body.
  // Self-verifying both ways: a listed record must still await restructuring (no resolutions
  // yet), and a restructured record must leave the list in the same PR.
  it('the geo-resolution worklist names committed records that still await restructuring', () => {
    const worklist = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'docs', 'geo-resolution-worklist.json'), 'utf8'),
    ) as { pending: string[] }
    expect(new Set(worklist.pending).size).toBe(worklist.pending.length)
    const tasks = loadProcesses(DATA_DIR)
    const byId = new Map(tasks.map((t) => [t.id, t]))
    for (const id of worklist.pending) {
      const task = byId.get(id)
      expect(task, `worklist id ${id} is not a committed corpus record`).toBeDefined()
      const resolved = task!.dag.nodes.some((n) => (n.geoResolutions ?? []).length > 0)
      expect(resolved, `${id} carries geoResolutions; remove it from the worklist`).toBe(false)
    }
  })

  it('non-US entries reuse committed geo knowledge: the entry country also has a process geoNote or the process is global', () => {
    const tasks = loadProcesses(DATA_DIR)
    for (const t of tasks) {
      const noteCountries = new Set((t.geoNotes ?? []).map((n) => n.country))
      for (const n of t.dag.nodes) {
        for (const r of n.geoResolutions ?? []) {
          if (r.country === 'US') continue
          // A non-US step resolution is a sharper cut of knowledge the record (or the corpus)
          // already committed to for that country — never a fresh country claim out of nowhere.
          expect(
            noteCountries.has(r.country) || t.geoScope === 'global',
            `${t.id}/${n.id}/${r.country}: resolution without committed geo grounding`,
          ).toBe(true)
        }
      }
    }
  })
})
