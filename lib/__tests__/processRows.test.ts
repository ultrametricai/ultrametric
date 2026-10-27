// The phase → area display map (founder 2026-09-28): friendly founder-lifecycle areas are the
// primary grouping on the "All processes" table, so the map must stay TOTAL over the live
// corpus — a newly added phase without a curated area must fail HERE, loudly, not render a
// stray or missing group in production.
import { describe, expect, it } from 'vitest'
import { chainTasks, computeCeiling, loadChains, loadProcesses, processSlug } from '@/lib/processes'
import {
  AREA_ORDER, areaOf, areaOfTask, areaRank, buildPlaybookRows, buildProcessRows,
  buildSituationRows, PHASE_AREA, SITUATIONS_AREA,
} from '@/lib/processRows'
import { URGENCY_TIERS } from '@/lib/processSim'

describe('phase → area display map (lib/processRows.ts)', () => {
  it('is total over the live corpus: every phase maps to exactly one curated area', () => {
    const phases = [...new Set(loadProcesses().map((t) => t.phase))]
    expect(phases.length).toBeGreaterThan(0)
    for (const phase of phases) {
      // areaOf throws on an unmapped phase — a new corpus phase fails this walk loudly.
      const area = areaOf(phase)
      expect(AREA_ORDER, `phase "${phase}" must map into AREA_ORDER`).toContain(area)
    }
  })

  it('throws loudly for a phase with no curated area', () => {
    expect(() => areaOf('interdimensional-tax')).toThrowError(/No display area mapped for phase "interdimensional-tax"/)
  })

  it('every mapped area sits in AREA_ORDER with a real lifecycle rank', () => {
    for (const area of Object.values(PHASE_AREA)) {
      expect(areaRank(area), `area "${area}" must have an AREA_ORDER rank`).toBeGreaterThanOrEqual(0)
    }
    // And an unknown area reads as unranked, not silently first.
    expect(areaRank('Not an area')).toBe(-1)
  })

  it('buildProcessRows is PROCESSES ONLY (founder 2026-10-02: situations moved to /situations) — every row keeps the phase→area map', () => {
    const { rows, totalProcesses } = buildProcessRows()
    const corpus = loadProcesses()
    const situations = corpus.filter((t) => t.kind === 'situation')
    expect(situations.length).toBeGreaterThan(0)
    // No situation row reaches the processes surfaces — the table's 'Situations' area group is
    // gone with them; /situations renders them via buildSituationRows instead.
    const situationSlugs = new Set(situations.map((t) => processSlug(t.title)))
    for (const r of rows) {
      expect(situationSlugs.has(r.slug), `${r.slug} must not appear in the processes rows`).toBe(false)
      expect(r.kind).toBe('process')
      expect(r.trigger).toBeNull()
      expect(r.urgency).toBeNull()
      expect(r.area).toBe(areaOf(r.phase))
      expect(r.area).not.toBe(SITUATIONS_AREA)
      expect(r.areaRank).toBe(areaRank(r.area))
    }
    expect(rows.length).toBe(corpus.length - situations.length)
    expect(totalProcesses).toBe(rows.length)
    // The kind-driven area decision stays pinned for the surfaces that still mix kinds (the
    // shared preview index) — and 'Situations' keeps its last-in-lifecycle rank there.
    expect(AREA_ORDER[AREA_ORDER.length - 1]).toBe(SITUATIONS_AREA)
    expect(areaOfTask({ kind: 'situation', phase: 'legal' })).toBe(SITUATIONS_AREA)
    expect(areaOfTask({ kind: 'process', phase: 'legal' })).toBe('Legal')
  })

  it('buildSituationRows: every reactive record, urgency (hours → days → weeks) then title, trigger/urgency/area intact', () => {
    const rows = buildSituationRows()
    const situations = loadProcesses().filter((t) => t.kind === 'situation')
    expect(rows).toHaveLength(situations.length)
    expect(rows).toHaveLength(27)
    for (const r of rows) {
      expect(r.kind).toBe('situation')
      expect(r.area).toBe(SITUATIONS_AREA)
      expect(r.timeOrder, `${r.slug}: situations carry no timeline slot`).toBeNull()
      expect(r.trigger, `${r.slug}: situation rows carry their trigger subtitle`).toBeTruthy()
      expect(r.urgency).not.toBeNull()
    }
    const tiers = rows.map((r) => URGENCY_TIERS.indexOf(r.urgency!))
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
    for (let i = 1; i < rows.length; i++) {
      if (tiers[i] === tiers[i - 1]) expect(rows[i - 1].title.localeCompare(rows[i].title)).toBeLessThan(0)
    }
  })

  // The country-view filter data (founder 2026-10-02): every row carries the per-country
  // kind+summary slice of its committed geo notes — us/us-state rows only (global rows never
  // filter, so they stay lean with {}).
  it('rows carry geoNotesByCountry — the committed note kinds/summaries on US-scoped rows, {} on global rows', () => {
    const bySlug = new Map(loadProcesses().map((t) => [processSlug(t.title), t]))
    const { rows } = buildProcessRows()
    for (const r of rows) {
      const t = bySlug.get(r.slug)!
      if (t.geoScope === 'global') {
        expect(r.geoNotesByCountry, `${r.slug}: global rows carry no filter notes`).toEqual({})
      } else {
        const expected = Object.fromEntries((t.geoNotes ?? []).map((n) => [n.country, { kind: n.kind, summary: n.summary }]))
        expect(r.geoNotesByCountry, r.slug).toEqual(expected)
      }
    }
    // The founder's example rides all the way to the row: the EIN row says IN is absorbed.
    const ein = rows.find((r) => r.slug === 'get-ein')!
    expect(ein.geoScope).toBe('us')
    expect(ein.geoNotesByCountry.IN?.kind).toBe('absorbed')
    expect(ein.geoNotesByCountry.DE?.kind).toBe('analog')
  })
})

// The combined-table playbook rows (founder 2026-09-29): the curated chains serialized for the
// same table the process rows render in — aggregate ceiling, constituent processes, route strip.
describe('playbook rows (buildPlaybookRows)', () => {
  it('serializes every curated chain with its chain-page href and aggregate agent ceiling', () => {
    const chains = loadChains()
    const byId = new Map(buildPlaybookRows().map((p) => [p.id, p]))
    expect(byId.size).toBe(chains.length)
    expect(chains.length).toBeGreaterThan(0)
    for (const chain of chains) {
      const p = byId.get(chain.id)
      expect(p, `chain ${chain.id} must build a playbook row`).toBeDefined()
      const nodes = chainTasks(chain).flatMap((t) => t.dag.nodes)
      const ceiling = computeCeiling(nodes)
      expect(p!.href).toBe(`/processes/chains/${chain.id}`)
      expect(p!.title).toBe(chain.name)
      expect(p!.tagline).toBe(chain.tagline)
      expect(p!.pct).toBe(ceiling.pct)
      expect(p!.agentSteps).toBe(ceiling.agentSteps)
      expect(p!.totalSteps).toBe(nodes.length)
    }
  })

  it('carries the constituent processes in chain order, their distinct phases, and one route-strip dot per step', () => {
    const chains = new Map(loadChains().map((c) => [c.id, c]))
    for (const p of buildPlaybookRows()) {
      const chain = chains.get(p.id)!
      expect(p.processes.map((t) => t.id)).toEqual(chain.taskIds)
      const tasks = chainTasks(chain)
      // Dominant area (founder 2026-09-29: playbooks are still processes — the grouped table
      // folds a chain into the area of its FIRST constituent, at that constituent's timeOrder).
      expect(p.dominantArea).toBe(areaOf(tasks[0].phase))
      expect(p.areaRank).toBe(areaRank(p.dominantArea))
      expect(p.timeOrder).toBe(tasks[0].timeOrder)
      // phases = the distinct constituent phases (the table's phase-filter contract for playbooks).
      expect(new Set(p.phases)).toEqual(new Set(tasks.map((t) => t.phase)))
      const nodes = tasks.flatMap((t) => t.dag.nodes)
      expect(p.steps.length).toBe(nodes.length)
      expect(p.steps.map((s) => s.route)).toEqual(nodes.map((n) => n.route))
      expect(p.steps.map((s) => s.legalSignature)).toEqual(nodes.map((n) => n.legalSignature ?? false))
    }
  })
})
