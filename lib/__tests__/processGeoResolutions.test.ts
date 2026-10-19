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
