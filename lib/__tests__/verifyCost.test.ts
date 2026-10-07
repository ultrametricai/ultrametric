import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COST_KINDS, DagNodeSchema, knownCostUsd, loadProcesses, ProcessTaskSchema,
  type DagNode, type ProcessTask, type StepCost, type StepVerify,
} from '@/lib/processes'

// Depth wave part 1 (founder 2026-10-01): per-step verification checks and sourced real costs.
// Honesty contract (processes/README.md "Verification checks" / "Cost honesty"): every verify
// URL is https and primary-source, every cost carries a source URL and an asOf date (the asOf
// date is the contract — fees change, currentness is never claimed), usd null is the honest
// spelling of "a real cost exists but no published number does", and the process-level headline
// is DERIVED (government fees only), never hand-stored.

const DATA_DIR = path.resolve(__dirname, '../../data')
// RAW corpus — includes the jurisdiction-conditional nodes loadProcesses strips, so the format
// invariants are total over everything committed.
const RAW = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, '..', 'processes', 'corpus.json'), 'utf8'),
) as Array<{
  id: string
  dag: { nodes: Array<{ id: string; route: string; verify?: StepVerify; cost?: StepCost }> }
}>

const allNodes = RAW.flatMap((t) => t.dag.nodes.map((n) => ({ task: t.id, ...n })))
const verified = allNodes.filter((n) => n.verify)
const costed = allNodes.filter((n) => n.cost)

function node(taskId: string, nodeId: string) {
  const hit = allNodes.find((n) => n.task === taskId && n.id === nodeId)
  if (!hit) throw new Error(`no node ${taskId}/${nodeId}`)
  return hit
}

describe('schema round-trip', () => {
  it('the corpus parses through ProcessTaskSchema with the new fields intact', () => {
    const parsed = ProcessTaskSchema.array().parse(RAW)
    const count = parsed.flatMap((t) => t.dag.nodes).filter((n) => n.verify).length
    expect(count).toBe(verified.length)
    expect(loadProcesses(DATA_DIR).length).toBe(147)
  })

  it('a node re-parses identically through DagNodeSchema (round-trip, nothing dropped)', () => {
    const n = node('form_001', 'n4')
    const { task: _task, ...bare } = n
    const parsed = DagNodeSchema.parse(bare)
    expect(parsed.verify).toEqual(n.verify)
    expect(parsed.cost).toEqual(n.cost)
    expect(DagNodeSchema.parse(parsed)).toEqual(parsed)
  })

  it('rejects an unsourced cost and a non-ISO asOf — the honesty fields are not optional', () => {
    const base = node('form_001', 'n4')
    const { task: _task, ...bare } = base
    expect(() => DagNodeSchema.parse({ ...bare, cost: { usd: 109, kind: 'government-fee', asOf: '2026-10-01' } })).toThrow()
    expect(() => DagNodeSchema.parse({ ...bare, cost: { ...bare.cost, asOf: 'October 1, 2026' } })).toThrow()
    expect(() => DagNodeSchema.parse({ ...bare, verify: { url: 'https://example.com' } })).toThrow()
  })
})

describe('totality of format', () => {
  it('curation landed: dozens of verify checks and sourced costs', () => {
    expect(verified.length).toBeGreaterThanOrEqual(60)
    expect(costed.length).toBeGreaterThanOrEqual(20)
  })

  it('every verify has a non-empty how, and every verify.url is https', () => {
    for (const n of verified) {
      expect(n.verify!.how.length, `${n.task}/${n.id}`).toBeGreaterThan(0)
      if (n.verify!.url) expect(n.verify!.url, `${n.task}/${n.id}`).toMatch(/^https:\/\//)
    }
  })

  it('every cost carries an https source, an ISO asOf date, and a valid kind; usd null allowed', () => {
    for (const n of costed) {
      const c = n.cost!
      expect(c.source, `${n.task}/${n.id}`).toMatch(/^https:\/\//)
      expect(c.asOf, `${n.task}/${n.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(COST_KINDS).toContain(c.kind)
      // usd is a non-negative number or the honest null — never NaN, never negative.
      if (c.usd !== null) expect(c.usd).toBeGreaterThanOrEqual(0)
    }
  })

  it("kind 'free' always means usd 0, and every usd-null cost explains itself in a note", () => {
    for (const n of costed) {
      const c = n.cost!
      if (c.kind === 'free') expect(c.usd, `${n.task}/${n.id}`).toBe(0)
      if (c.usd === null) expect(c.note, `${n.task}/${n.id} needs the variability note`).toBeTruthy()
    }
  })
})

describe('spot pins (read off the cited primary sources, 2026-10-01)', () => {
  it('form_001 Submit incorporation filing: $109 DE minimum, government fee, DE fee schedule', () => {
    const c = node('form_001', 'n4').cost!
    expect(c.usd).toBe(109)
    expect(c.kind).toBe('government-fee')
    expect(c.source).toContain('delaware.gov')
    // Minimum-fee caveat required — the schedule marks incorporation 'varies based on stock'.
    expect(c.note).toMatch(/minimum/i)
  })

  it('form_002 Get EIN: free, straight from the IRS page', () => {
    const c = node('form_002', 'n3').cost!
    expect(c.usd).toBe(0)
    expect(c.kind).toBe('free')
    expect(c.source).toContain('irs.gov')
  })

  it('legal_002 USPTO filing: $350 base application per class, fee schedule cited', () => {
    const c = node('legal_002', 'n5').cost!
    expect(c.usd).toBe(350)
    expect(c.kind).toBe('government-fee')
    expect(c.source).toContain('uspto.gov')
    expect(c.note).toMatch(/per class/i)
  })

  it('form_001 filing verifies against the DE entity search; the 83(b) check is the retained proof', () => {
    expect(node('form_001', 'n4').verify!.url).toContain('icis.corp.delaware.gov')
    expect(node('form_001', 'n8').verify!.how).toMatch(/certified-mail/i)
  })
})

describe('derived known-cost total', () => {
  const tasks: ProcessTask[] = loadProcesses(DATA_DIR)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  it('sums dated government fees only — free is $0 and vendor prices never leak in', () => {
    // form_001 (founder spike 2026-10-02 reference depth): $109 DE filing + $50 certified copy
    // (noted optional on the step) + $5.55 USPS certified mail for the 83(b). The $500 Stripe
    // Atlas / $427 Clerky vendor stickers are excluded, and the CA foreign-qualification fee
    // lives on a jurisdiction-conditional node that loadProcesses strips from this default view.
    expect(knownCostUsd(byId.get('form_001')!.dag.nodes)).toBeCloseTo(164.55, 2)
    // legal_002: the $350 USPTO fee counts; the usd-null attorney-fee entry contributes nothing.
    expect(knownCostUsd(byId.get('legal_002')!.dag.nodes)).toBe(350)
    // tax_001: the $225 DE minimum (tax + annual report fee).
    expect(knownCostUsd(byId.get('tax_001')!.dag.nodes)).toBe(225)
    // vc_001: $110 GP LLC + $200 LP certificate + $0 EIN.
    expect(knownCostUsd(byId.get('vc_001')!.dag.nodes)).toBe(310)
  })

  it('matches a manual walk over every process (null and non-government entries excluded)', () => {
    for (const t of tasks) {
      const manual = t.dag.nodes.reduce(
        (sum, n: DagNode) =>
          sum + (n.cost && n.cost.kind === 'government-fee' && n.cost.usd !== null ? n.cost.usd : 0),
        0,
      )
      expect(knownCostUsd(t.dag.nodes), t.id).toBe(manual)
    }
  })

  it('is 0 for a process with no government fees (no chip renders)', () => {
    expect(knownCostUsd(byId.get('ops_001')!.dag.nodes)).toBe(0)
  })
})
