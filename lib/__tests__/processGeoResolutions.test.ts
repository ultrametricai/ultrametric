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

  it('every rule card cited inside a resolution resolves to a committed law card', () => {
    const cardIds = new Set<string>()
    const lawDir = path.join(process.cwd(), 'open-law')
    for (const entry of fs.readdirSync(lawDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'citations') continue
      for (const file of fs.readdirSync(path.join(lawDir, entry.name))) {
        if (!file.endsWith('.json')) continue
        const card = JSON.parse(fs.readFileSync(path.join(lawDir, entry.name, file), 'utf8'))
        if (card.id) cardIds.add(card.id)
      }
    }
    for (const { task, nodeId, resolution } of allResolutions(loadProcesses(DATA_DIR))) {
      const prose = `${resolution.label} ${resolution.guidance ?? ''}`
      for (const match of prose.matchAll(/rule card ([a-z0-9.-]+)/g)) {
        expect(cardIds.has(match[1]), `${task.id}/${nodeId}/${resolution.country} cites unknown rule card ${match[1]}`).toBe(true)
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

    // Exhibit A: the departing-equity settlement resolves in six countries beside the US.
    expect(byId('sit_007').geoScope).toBe('global')
    expect(countries('sit_007', 'n4')).toEqual(['CA', 'DE', 'IN', 'PT', 'UK', 'US'])
    expect(countries('sit_007', 'n3')).toEqual(['FR', 'IN', 'UK', 'US'])
    // The notice-terms step resolves in every covered country.
    expect(byId('sit_019').geoScope).toBe('global')
    expect(countries('sit_019', 'n2')).toEqual(['CA', 'DE', 'FR', 'IN', 'PT', 'UK', 'US'])
    // First-hire formalities: the I-9/W-4 mechanics moved into the US entry. geoScope stays
    // 'us': the record produces the employment-agreement artifact, whose committed geo entries
    // require a US-centric producer (lib/__tests__/processArtifacts.test.ts).
    expect(byId('hr_001').geoScope).toBe('us')
    expect(countries('hr_001', 'n6')).toEqual(['FR', 'PT', 'UK', 'US'])
    // The register lookup: TSDR is the US resolution, with the committed IN/PT/CA checks beside it.
    expect(byId('sit_001').geoScope).toBe('global')
    expect(countries('sit_001', 'n3')).toEqual(['CA', 'IN', 'PT', 'US'])
    // A US-only resolution set on a global record is the design working: no other country's
    // mechanics are committed for the cap-table approval steps, so the abstraction stands.
    expect(countries('qs_052', 'n2b')).toEqual(['US'])
    expect(countries('qs_052', 'n3')).toEqual(['US'])
  })

  // The remaining class-(a) records from the PR #382 audit live in
  // docs/geo-resolution-worklist.json so the worklist is tracked in-tree, not in a PR body.
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
