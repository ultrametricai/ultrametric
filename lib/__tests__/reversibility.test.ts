import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses, REVERSIBILITY_TIERS, type Reversibility } from '@/lib/processes'

// Reversibility curation (founder 2026-09-30: "map what is irreversible and what is reversible
// — consider 'irreversible with pain' as a 3rd option — for ALL processes and process steps").
// Definitions + curation rules: processes/README.md "Reversibility" and REVERSIBILITY_TIERS in
// lib/processSim.ts. These tests pin totality (every process and every step classified — no zod
// default exists to hide a gap) and the honest shape of the distribution: irreversible is rare
// and means real doors closing (filed dissolutions, filed 83(b)s, equity accepted, wires sent,
// terminations), not drudgery.

const DATA_DIR = path.resolve(__dirname, '../../data')
// The RAW corpus — includes the jurisdiction-conditional nodes loadProcesses strips from the
// default view; the classification must be total over those too.
const RAW = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, '..', 'processes', 'corpus.json'), 'utf8'),
) as Array<{
  id: string
  title: string
  reversibility: Reversibility
  dag: { nodes: Array<{ id: string; label: string; reversibility: Reversibility }> }
}>

const tiers = new Set<string>(REVERSIBILITY_TIERS)

describe('reversibility totality', () => {
  it('classifies every process explicitly with a valid tier', () => {
    expect(RAW.length).toBe(147)
    for (const t of RAW) {
      expect(tiers.has(t.reversibility), `${t.id} task tier`).toBe(true)
    }
  })

  it('classifies every DAG node explicitly, including jurisdiction-conditional ones', () => {
    let nodes = 0
    for (const t of RAW) {
      for (const n of t.dag.nodes) {
        nodes += 1
        expect(tiers.has(n.reversibility), `${t.id}/${n.id} node tier`).toBe(true)
      }
    }
    expect(nodes).toBeGreaterThanOrEqual(600)
  })

  it('parses through the schema (required field, no default)', () => {
    // loadProcesses throws on any unclassified record — this is the totality gate by
    // construction; the assertions above exist to name the offender precisely.
    expect(loadProcesses(DATA_DIR).length).toBe(147)
  })
})

describe('reversibility distribution — irreversible is rare and means it', () => {
  const taskTier = (id: string) => RAW.find((t) => t.id === id)?.reversibility
  const nodeTier = (taskId: string, nodeId: string) =>
    RAW.find((t) => t.id === taskId)?.dag.nodes.find((n) => n.id === nodeId)?.reversibility

  it('keeps irreversible processes rare (3–15 of 147) and reversible the majority', () => {
    const byTier = { reversible: 0, painful: 0, irreversible: 0 }
    for (const t of RAW) byTier[t.reversibility] += 1
    expect(byTier.irreversible).toBeGreaterThanOrEqual(3)
    expect(byTier.irreversible).toBeLessThanOrEqual(15)
    expect(byTier.reversible).toBeGreaterThan(RAW.length / 2)
  })

  it('keeps irreversible steps rare (at most ~5% of all nodes)', () => {
    const all = RAW.flatMap((t) => t.dag.nodes)
    const irreversible = all.filter((n) => n.reversibility === 'irreversible')
    expect(irreversible.length).toBeGreaterThanOrEqual(5)
    expect(irreversible.length).toBeLessThanOrEqual(Math.floor(all.length * 0.05))
  })

  it('pins the anchors: shutting down is irreversible, a wire is irreversible', () => {
    expect(taskTier('shutdown_001')).toBe('irreversible')
    expect(nodeTier('shutdown_001', 'n5'), 'certificate of dissolution filed').toBe('irreversible')
    expect(taskTier('opp_001')).toBe('irreversible')
    expect(nodeTier('opp_001', 'n3'), 'the wire release').toBe('irreversible')
  })

  it('pins the painful archetypes: incorporation and entity conversion are undoable at real cost', () => {
    // The founder examples: incorporation in the wrong state → re-domestication; entity
    // conversion — painful processes that each still contain truly irreversible steps
    // (stock accepted, 83(b) filed), the blessed painful-process/irreversible-step shape.
    expect(taskTier('form_001')).toBe('painful')
    expect(nodeTier('form_001', 'n8'), 'filed 83(b) — the window never reopens').toBe('irreversible')
    expect(taskTier('form_012')).toBe('painful')
    expect(nodeTier('form_012', 'n7b'), 'stock issued and accepted').toBe('irreversible')
    expect(taskTier('qs_063'), 'switching payroll providers mid-year').toBe('painful')
    expect(taskTier('qs_023'), 'migrating banks').toBe('painful')
    expect(taskTier('ops_014'), 'breaking a lease').toBe('painful')
  })

  it('classifies every 83(b) filing step irreversible, consistently', () => {
    const filings = RAW.flatMap((t) =>
      t.dag.nodes.filter((n) => /file.*83\(b\)/i.test(n.label)).map((n) => ({ at: `${t.id}/${n.id}`, n })),
    )
    expect(filings.length).toBeGreaterThanOrEqual(3)
    for (const { at, n } of filings) expect(n.reversibility, at).toBe('irreversible')
  })

  it('keeps drafts reversible — drafting never closes a door', () => {
    const drafts = RAW.flatMap((t) =>
      t.dag.nodes.filter((n) => /^draft /i.test(n.label)).map((n) => ({ at: `${t.id}/${n.id}`, n })),
    )
    expect(drafts.length).toBeGreaterThanOrEqual(20)
    for (const { at, n } of drafts) expect(n.reversibility, at).toBe('reversible')
  })

  it('never marks an irreversible process without naming its point of no return or money/termination act', () => {
    // Every irreversible PROCESS carries at least one non-reversible step — the commitment has
    // to live somewhere in the flow (irreversible or painful; e.g. the payment-rails processes
    // put the whole weight on one dispatch step).
    for (const t of RAW.filter((x) => x.reversibility === 'irreversible')) {
      const committed = t.dag.nodes.some((n) => n.reversibility !== 'reversible')
      expect(committed, `${t.id} (${t.title})`).toBe(true)
    }
  })
})
