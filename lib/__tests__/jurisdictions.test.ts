// Jurisdiction-conditional steps (founder 2026-09-25: "allow more options for the processes —
// ie multi-state situations or California included — so we can see how the processes change").
// Load-bearing assertions, in the feature's honesty order:
//   1. corpus integrity on the complete canonical projection: every `jurisdictions` value is from the allowed set,
//      conditional nodes are never referenced by edges (they drop cleanly from the DAG flow),
//      ids stay unique, and every conditional actionUrl is https with a label (the complete canonical projection is
//      checked directly because loadProcesses strips these nodes before the general corpus
//      tests can see them);
//   2. DEFAULT-VIEW INVARIANCE: loadProcesses() strips every conditional node, so ceilings,
//      rankings, the simulator, the manifest and the generators all see exactly the
//      Delaware-only flow — no judged number can move;
//   3. the client math (lib/jurisdictions.ts ceilingWithJurisdictions) agrees with the server
//      math (lib/processes.ts computeCeiling) over the combined node set;
//   4. the ?juris= codec is tolerant, canonical, and default-eliding.

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { operationalSources } from './helpers/operational-sources'
import {
  ceilingWithJurisdictions, JURISDICTION_INPUTS, JURISDICTIONS, parseJuris, serializeJuris,
  type Jurisdiction, type JurisdictionStepView,
} from '@/lib/jurisdictions'
import {
  computeCeiling, findProcessBySlug, jurisdictionNodes, jurisdictionStepViews, loadProcesses,
  processSlug, taskCeiling, type DagNode,
} from '@/lib/processes'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

interface RawTask {
  id: string
  title: string
  dag: {
    nodes: Array<{
      id: string
      route: string
      jurisdictions?: string[]
      actionUrl?: string
      actionLabel?: string
      processRef?: string
      vendorOptions?: string[]
      legalSignature?: boolean
    }>
    edges?: Array<{ from: string; to: string }>
  }
}

const rawTasks = operationalSources() as RawTask[]
const rawConditional = rawTasks.flatMap((t) =>
  t.dag.nodes.filter((n) => n.jurisdictions !== undefined).map((n) => ({ task: t, node: n })),
)

describe('corpus integrity (complete canonical projection — loadProcesses strips these before other tests see them)', () => {
  it('has conditional steps at the intended scale, and every jurisdictions value is from the allowed set', () => {
    expect(rawConditional.length).toBeGreaterThanOrEqual(8)
    expect(rawConditional.length).toBeLessThanOrEqual(15)
    for (const { task, node } of rawConditional) {
      expect(node.jurisdictions!.length, `${task.id}:${node.id} empty jurisdictions`).toBeGreaterThan(0)
      for (const j of node.jurisdictions!) {
        // Raw committed values: the canonical codes plus the deprecated 'CA' alias.
        expect(JURISDICTION_INPUTS, `${task.id}:${node.id} jurisdiction "${j}"`).toContain(j)
      }
    }
  })

  it('conditional nodes are never referenced by edges — toggled-off steps drop cleanly from the DAG flow', () => {
    for (const t of rawTasks) {
      const condIds = new Set(t.dag.nodes.filter((n) => n.jurisdictions !== undefined).map((n) => n.id))
      if (condIds.size === 0) continue
      for (const e of t.dag.edges ?? []) {
        expect(condIds.has(e.from), `${t.id} edge from conditional node ${e.from}`).toBe(false)
        expect(condIds.has(e.to), `${t.id} edge to conditional node ${e.to}`).toBe(false)
      }
    }
  })

  it('node ids stay unique per task with the conditional nodes counted in', () => {
    for (const t of rawTasks) {
      const ids = t.dag.nodes.map((n) => n.id)
      expect(new Set(ids).size, `${t.id} duplicate node id`).toBe(ids.length)
    }
  })

  it('conditional steps stay lean and honest: https actionUrl with a label when present, no vendorOptions, no legalSignature, real routes', () => {
    for (const { task, node } of rawConditional) {
      const key = `${task.id}:${node.id}`
      if (node.actionUrl !== undefined) {
        expect(node.actionUrl, `${key} actionUrl must be https`).toMatch(/^https:\/\//)
        expect(node.actionLabel, `${key} actionUrl without actionLabel`).toBeTruthy()
      }
      // v1 is deliberately lean (no vendorOptions ⇒ no generated step data owed) and no
      // conditional step is a legally-required signature act.
      expect(node.vendorOptions, `${key} vendorOptions on a conditional step`).toBeUndefined()
      expect(node.legalSignature, `${key} legalSignature on a conditional step`).toBeUndefined()
      expect(['form', 'person', 'agent'], `${key} route`).toContain(node.route)
    }
  })

  it('every processRef resolves to a real process (link it, never duplicate it)', () => {
    for (const { task, node } of rawConditional) {
      if (!node.processRef) continue
      expect(findProcessBySlug(node.processRef, DATA_DIR), `${task.id}:${node.id} processRef "${node.processRef}"`).not.toBeNull()
    }
  })
})

describe('default-view invariance', () => {
  it('loadProcesses strips every conditional node — no default surface can see one', () => {
    for (const t of loadProcesses(DATA_DIR)) {
      for (const n of t.dag.nodes) {
        expect(n.jurisdictions, `${t.id}:${n.id} leaked into the default view`).toBeUndefined()
      }
    }
  })

  it('default ceilings count exactly the raw corpus minus the conditional nodes', () => {
    const byId = new Map(rawTasks.map((t) => [t.id, t]))
    for (const t of loadProcesses(DATA_DIR)) {
      const raw = byId.get(t.id)!
      const cond = raw.dag.nodes.filter((n) => n.jurisdictions !== undefined).length
      expect(taskCeiling(t).totalSteps, t.id).toBe(raw.dag.nodes.length - cond)
    }
  })

  it('exposes the stripped nodes via jurisdictionNodes, in corpus order and with jurisdictions intact', () => {
    const total = loadProcesses(DATA_DIR).flatMap((t) => jurisdictionNodes(t.id, DATA_DIR))
    expect(total.length).toBe(rawConditional.length)
    for (const n of total) expect(n.jurisdictions?.length).toBeGreaterThan(0)
    // Tasks without conditional steps honestly yield [].
    expect(jurisdictionNodes('legal_001', DATA_DIR)).toEqual([])
  })

  it('the deprecated CA spelling in committed records loads and normalizes to US-CA', () => {
    // The raw corpus still carries the original 'CA' spelling on the pre-per-state nodes…
    expect(
      rawConditional.some(({ node }) => node.jurisdictions!.includes('CA')),
      'the committed records keep the deprecated alias (this pin guards the load-time normalization path)',
    ).toBe(true)
    // …and every loaded node carries only canonical codes: 'CA' never survives the parse.
    const loaded = loadProcesses(DATA_DIR).flatMap((t) => jurisdictionNodes(t.id, DATA_DIR))
    for (const n of loaded) {
      for (const j of n.jurisdictions ?? []) {
        expect(JURISDICTIONS, `loaded jurisdiction "${j}"`).toContain(j)
      }
    }
    const ftbStep = jurisdictionNodes('tax_001', DATA_DIR).find((n) => n.label.includes('California'))!
    expect(ftbStep.jurisdictions).toEqual(['US-CA'])
  })

  it('covers the six branching processes: formation, registered agent, payroll setup, DE franchise tax, state taxes, annual report', () => {
    const counts = Object.fromEntries(
      ['form_001', 'qs_043', 'qs_063', 'tax_001', 'form_005', 'qs_047'].map((id) => [
        id,
        jurisdictionNodes(id, DATA_DIR).length,
      ]),
    )
    expect(counts).toEqual({ form_001: 2, qs_043: 1, qs_063: 2, tax_001: 1, form_005: 1, qs_047: 2 })
  })

  it('the sales-tax-nexus MULTI step links the existing process instead of duplicating it', () => {
    const views = jurisdictionStepViews('form_005', DATA_DIR)
    const nexus = views.find((v) => v.processHref !== null)
    expect(nexus).toBeDefined()
    expect(nexus!.jurisdictions).toEqual(['MULTI'])
    const target = findProcessBySlug('sales-tax-nexus-registration', DATA_DIR)!
    expect(nexus!.processHref).toBe(`/processes/${processSlug(target.title)}`)
    expect(nexus!.processTitle).toBe(target.title)
  })
})

describe('ceiling math with/without jurisdictions', () => {
  it('client-side ceilingWithJurisdictions agrees with server-side computeCeiling over the combined nodes', () => {
    for (const t of loadProcesses(DATA_DIR)) {
      const cond = jurisdictionNodes(t.id, DATA_DIR)
      if (cond.length === 0) continue
      const base = taskCeiling(t)
      const views = jurisdictionStepViews(t.id, DATA_DIR)
      for (const active of [['US-CA'], ['MULTI'], ['US-CA', 'MULTI'], ['US-TX', 'US-NY']] as Jurisdiction[][]) {
        const activeCond = cond.filter((n) => n.jurisdictions!.some((j) => active.includes(j)))
        const server = computeCeiling([...t.dag.nodes, ...activeCond] as DagNode[])
        const client = ceilingWithJurisdictions(base, views, active)
        expect(client.pct, `${t.id} ${active.join('+')}`).toBe(server.pct)
        expect(client.agentSteps).toBe(server.agentSteps)
        expect(client.totalSteps).toBe(server.totalSteps)
        expect(client.addedSteps).toBe(activeCond.length)
      }
    }
  })

  it('with nothing active the displayed ceiling IS the default', () => {
    const base = { agentSteps: 5, totalSteps: 10, pct: 50 }
    const c = ceilingWithJurisdictions(base, jurisdictionStepViews('form_001', DATA_DIR), [])
    expect(c).toEqual({ agentSteps: 5, totalSteps: 10, pct: 50, addedSteps: 0 })
  })

  it('non-agent conditional steps honestly LOWER the ceiling; agent ones raise the numerator', () => {
    const base = { agentSteps: 5, totalSteps: 10, pct: 50 }
    const step = (over: Partial<JurisdictionStepView>): JurisdictionStepView => ({
      label: 's', route: 'form', jurisdictions: ['US-CA'], actionUrl: null, actionLabel: null,
      estimatedMinutes: 5, async: false, processHref: null, processTitle: null, ...over,
    })
    expect(ceilingWithJurisdictions(base, [step({})], ['US-CA']).pct).toBe(45) // 5/11
    expect(ceilingWithJurisdictions(base, [step({ route: 'agent' })], ['US-CA']).agentSteps).toBe(6)
    // Steps of an inactive jurisdiction never count.
    expect(ceilingWithJurisdictions(base, [step({})], ['MULTI']).pct).toBe(50)
  })
})

describe('?juris= codec', () => {
  it('parses tolerantly: lowercase tokens, unknown tokens dropped, canonical order, never a crash', () => {
    expect(parseJuris('us-ca')).toEqual(['US-CA'])
    expect(parseJuris('multi,us-ca')).toEqual(['US-CA', 'MULTI'])
    expect(parseJuris(' US-CA , MULTI ')).toEqual(['US-CA', 'MULTI'])
    expect(parseJuris('us-tx,us-ny')).toEqual(['US-NY', 'US-TX'])
    expect(parseJuris('nonsense,us-ca')).toEqual(['US-CA'])
    expect(parseJuris('nonsense')).toEqual([])
    expect(parseJuris('')).toEqual([])
    expect(parseJuris(null)).toEqual([])
  })

  it('the deprecated CA alias (pre-per-state URLs and stored state) still parses, as US-CA', () => {
    expect(parseJuris('ca')).toEqual(['US-CA'])
    expect(parseJuris('multi,ca')).toEqual(['US-CA', 'MULTI'])
    expect(parseJuris(' CA , MULTI ')).toEqual(['US-CA', 'MULTI'])
  })

  it('serializes canonically and elides the default (null deletes the param)', () => {
    expect(serializeJuris([])).toBeNull()
    expect(serializeJuris(['US-CA'])).toBe('us-ca')
    expect(serializeJuris(['MULTI', 'US-CA'])).toBe('us-ca,multi')
    // Roundtrip, including through the alias.
    expect(parseJuris(serializeJuris(['MULTI']))).toEqual(['MULTI'])
    expect(parseJuris(serializeJuris(['US-CA']))).toEqual(['US-CA'])
    // The deprecated alias is accepted on input, never emitted.
    expect(JURISDICTIONS).not.toContain('CA')
  })
})
