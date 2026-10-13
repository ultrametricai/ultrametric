import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  artifactChipRows, placementSlack, processDepEdges, timelineInversions, topologicalOrder,
} from '@/lib/processDeps'
import { loadProcesses, processSlug } from '@/lib/processes'
import {
  TIMELINE_INVERSIONS_FILE, timelineInversionsMarkdown,
} from '../../scripts/generate-timeline-inversions'

// The cross-process dependency graph (founder depth wave part 2, 2026-10-01). The graph's
// validators live HERE as tests, per the founder ask: acyclicity, every requires id has a
// producer, every producer process exists (both pinned structurally in
// lib/__tests__/processArtifacts.test.ts and exercised end-to-end here), and the derived
// topological ordering vs the curated timeOrder timeline — whose divergence is REPORTED as the
// committed docs/TIMELINE-INVERSIONS.md, drift-tested so it can't go stale silently.

const tasks = loadProcesses()

describe('the company-level dependency DAG', () => {
  it('every edge resolves: requires → a real canonical producer process (never itself)', () => {
    const ids = new Set(tasks.map((t) => t.id))
    const edges = processDepEdges()
    expect(edges.length).toBeGreaterThanOrEqual(100)
    for (const e of edges) {
      expect(ids.has(e.from), `producer ${e.from} (${e.artifactId})`).toBe(true)
      expect(ids.has(e.to), `consumer ${e.to} (${e.artifactId})`).toBe(true)
      expect(e.from, `${e.to} must not depend on itself via ${e.artifactId}`).not.toBe(e.to)
    }
  })

  it('is ACYCLIC: the topological ordering exists and covers every process exactly once', () => {
    const order = topologicalOrder()
    expect(order.length).toBe(tasks.length)
    expect(new Set(order).size).toBe(tasks.length)
    // And it IS a topological order: every producer precedes every consumer.
    const pos = new Map(order.map((id, i) => [id, i]))
    for (const e of processDepEdges()) {
      expect(pos.get(e.from)!, `${e.from} before ${e.to} (${e.artifactId})`).toBeLessThan(pos.get(e.to)!)
    }
  })

  it('the derived ordering diverges from the curated timeline exactly because of the reported inversions', () => {
    // Kahn's tie-break is curated timeOrder, so with zero inversions the derived order would BE
    // the curated timeline — any divergence is dependency-forced.
    const inversions = timelineInversions()
    expect(inversions.length).toBeGreaterThan(0)
    const timelineIds = new Set(tasks.filter((t) => t.timeOrder !== undefined).map((t) => t.id))
    const curated = [...tasks].filter((t) => t.timeOrder !== undefined).sort((a, b) => a.timeOrder! - b.timeOrder!).map((t) => t.id)
    // The graph (and so the derived order) legitimately includes situations — they consume
    // artifacts — but the timeline comparison is over timeline processes only.
    const derived = topologicalOrder().filter((id) => timelineIds.has(id))
    expect(derived).not.toEqual(curated)
    expect([...derived].sort()).toEqual([...curated].sort())
    // And in the derived order, every reported inversion is repaired: the producer now precedes.
    const pos = new Map(derived.map((id, i) => [id, i]))
    for (const inv of inversions) {
      expect(pos.get(inv.producerId)!, `${inv.producerId} precedes ${inv.consumerId} once derived`)
        .toBeLessThan(pos.get(inv.consumerId)!)
    }
  })
})

describe('derived vs curated timeline — the committed renumbering worklist', () => {
  it('docs/TIMELINE-INVERSIONS.md is byte-identical to what the live corpus generates (no silent staleness)', () => {
    expect(timelineInversionsMarkdown()).toBe(fs.readFileSync(TIMELINE_INVERSIONS_FILE, 'utf8'))
  })

  it('reports the corpus-grounded inversions the curation deliberately kept (consumer before producer)', () => {
    const got = timelineInversions().map((i) => `${i.consumerId}<${i.producerId}:${i.artifactId}`)
    // Spot-pin the load-bearing findings: the first hire presupposes payroll/benefits/409A the
    // curated timeline places later, and incorporation presupposes the name + registered agent.
    for (const expected of [
      'form_001<brand_001:company-name',
      'form_001<qs_043:registered-agent',
      'hr_001<qs_063:payroll-account',
      'hr_001<scale_002:benefits-plan',
      'hr_001<fund_003:409a-valuation',
      'fund_003<fin_002:financial-statements',
      'comp_002<comp_013:pentest-report',
    ]) {
      expect(got).toContain(expected)
    }
  })

  it('the placement-slack complement surfaces the fund_007 question (YC application curated last, feasible by #4)', () => {
    const slack = placementSlack()
    expect(slack[0]?.id).toBe('fund_007')
    expect(slack[0]?.earliestFeasible).toBe(4)
    expect(slack[0]?.slack).toBeGreaterThanOrEqual(100)
  })
})

describe('artifact chips (the Needs/Produces header rows)', () => {
  it('resolves every task to serializable chips whose hrefs hit the canonical producer page', () => {
    const slugOf = new Map(tasks.map((t) => [t.id, `/processes/${processSlug(t.title)}`]))
    for (const t of tasks) {
      const rows = artifactChipRows(t)
      expect(rows.needs.length).toBe(t.requires.length)
      expect(rows.produces.length).toBe(t.produces.length)
      for (const c of [...rows.needs, ...rows.produces]) {
        expect(c.producerHref).toBe(slugOf.get(c.producerId))
        expect(c.producedHere).toBe(c.producerId === t.id)
      }
    }
  })

  it('an exception producer links its produces chip back to the canonical producer (the LLC page EIN → Get EIN)', () => {
    const llc = tasks.find((t) => t.id === 'form_011')!
    const ein = artifactChipRows(llc).produces.find((c) => c.id === 'ein')!
    expect(ein.producedHere).toBe(false)
    expect(ein.producerId).toBe('form_002')
    expect(ein.producerHref).toBe('/processes/get-ein')
  })
})
