import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPopulated } from '@/lib/data'
import {
  buildSimSteps, computeCeiling, loadProcesses, taskCeiling, VENDOR_ARENA,
  type ProcessTask, type StepMethod,
} from '@/lib/processes'
import { buildStepMethodViews } from '@/lib/stepMethodData'
import {
  DEFAULT_METHOD_ID, methodSelection, resetMethodSelections, setMethodSelection,
  stepMethodNodeKey, subscribeMethodSelections,
} from '@/lib/stepMethods'
import { loadVendorGeo } from '@/lib/vendorGeo'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

// Method variants (founder 2026-09-30: "certain processes have steps that are just ONE way to
// do it when there are multiple methods depending on context — get multiple options selectable
// by context … sub-DAGs for all DAG choices that have multiple paths"). These tests pin the
// corpus-wide integrity rules (real vendors/arenas only, geo methods evidence-backed, honest
// time), the founder's worked example (validate-the-idea's smoke test gains the four
// context-selectable methods), the view builder, and the guarantee that no committed number
// moved: methods are display-level, the node's own fields stay the DEFAULT method.

type MethodAt = { task: ProcessTask; nodeId: string; method: StepMethod }

function allMethods(): MethodAt[] {
  const out: MethodAt[] = []
  for (const task of loadProcesses(DATA_DIR)) {
    for (const n of task.dag.nodes) {
      for (const method of n.methods ?? []) out.push({ task, nodeId: n.id, method })
    }
  }
  return out
}

// Untracked-but-deliberate chips a method may reference — the same honesty bar as the corpus
// vendorOption allowlist in lib/__tests__/processes.test.ts (real suppliers with no arena yet).
const METHOD_UNTRACKED = new Set([
  'microsoft_365', 'fondo', 'kandji', 'jamf', 'remote', 'angellist',
  'hackernews', 'betalist',
])

describe('method-variant corpus integrity', () => {
  const methods = allMethods()

  it('the sweep is deep and honest: 30+ method-bearing nodes across 25+ processes', () => {
    const nodes = new Set<string>()
    const tasks = new Set<string>()
    for (const { task, nodeId } of methods) {
      nodes.add(`${task.id}/${nodeId}`)
      tasks.add(task.id)
    }
    expect(nodes.size).toBeGreaterThanOrEqual(30)
    expect(tasks.size).toBeGreaterThanOrEqual(25)
    expect(methods.length).toBeGreaterThanOrEqual(60)
  })

  it('every method vendor ref is a tracked arena vendor or a deliberate untracked chip', () => {
    for (const { task, nodeId, method } of methods) {
      const vendors = [
        ...(method.vendor ? [method.vendor] : []),
        ...(method.vendorOptions ?? []),
        ...(method.subSteps ?? []).flatMap((s) => [
          ...(s.vendor ? [s.vendor] : []),
          ...(s.vendorOptions ?? []),
        ]),
      ]
      for (const v of vendors) {
        expect(
          v in VENDOR_ARENA || METHOD_UNTRACKED.has(v),
          `${task.id}/${nodeId} ${method.id}: vendor ${v} is neither tracked nor allow-listed`,
        ).toBe(true)
      }
    }
  })

  it('every method optionsArenaId (incl. sub-steps) is a real, populated arena', () => {
    for (const { task, nodeId, method } of methods) {
      const arenas = [
        ...(method.optionsArenaId ? [method.optionsArenaId] : []),
        ...(method.subSteps ?? []).flatMap((s) => (s.optionsArenaId ? [s.optionsArenaId] : [])),
      ]
      for (const a of arenas) {
        expect(isPopulated(a, DATA_DIR), `${task.id}/${nodeId} ${method.id}: arena ${a}`).toBe(true)
      }
    }
  })

  it('geo methods only where committed evidence backs them: a geoNote for the country, or vendor-geo availability for the method\'s vendors', () => {
    const vendorGeo = loadVendorGeo(DATA_DIR)
    const available = new Set(
      vendorGeo
        .filter((e) => e.status === 'available' || e.status === 'partial')
        .map((e) => `${e.productId}:${e.country}`),
    )
    for (const { task, nodeId, method } of methods) {
      if (method.context?.kind !== 'geo') {
        expect(method.context?.countries, `${task.id}/${nodeId} ${method.id}`).toBeUndefined()
        continue
      }
      const noteCountries = new Set((task.geoNotes ?? []).map((g) => g.country))
      const methodVendors = [...(method.vendor ? [method.vendor] : []), ...(method.vendorOptions ?? [])]
      for (const c of method.context?.countries ?? []) {
        const vendorBacked = methodVendors.some((v) => available.has(`${v.replace(/_/g, '-')}:${c}`))
        expect(
          noteCountries.has(c) || vendorBacked,
          `${task.id}/${nodeId} ${method.id}: geo country ${c} has no committed geoNote or vendor-geo backing`,
        ).toBe(true)
      }
    }
  })

  it('every method actionUrl is https and labeled; sub-DAGs are small (2–5) with honest times', () => {
    for (const { task, nodeId, method } of methods) {
      const at = `${task.id}/${nodeId} ${method.id}`
      if (method.actionUrl) {
        expect(method.actionUrl, at).toMatch(/^https:\/\//)
        expect(method.actionLabel, at).toBeTruthy()
      }
      if (method.subSteps) {
        expect(method.subSteps.length, at).toBeGreaterThanOrEqual(2)
        expect(method.subSteps.length, at).toBeLessThanOrEqual(5)
        for (const s of method.subSteps) {
          expect(s.estimatedMinutes, `${at}/${s.id}`).toBeGreaterThan(0)
          // Sub-steps never nest further — the schema has no methods field on them.
          expect((s as { methods?: unknown }).methods, `${at}/${s.id}`).toBeUndefined()
          if (s.actionUrl) expect(s.actionUrl, `${at}/${s.id}`).toMatch(/^https:\/\//)
        }
        if (method.estimatedMinutes !== undefined) {
          const sum = method.subSteps.reduce((acc, s) => acc + s.estimatedMinutes!, 0)
          expect(method.estimatedMinutes, at).toBe(sum)
        }
      }
      // Contexts read as predicates, not marketing: short and present.
      if (method.context) expect(method.context.when.length, at).toBeGreaterThan(10)
      expect(method.summary.length, at).toBeGreaterThan(30)
    }
  })

  it('method ids are unique per node and kebab-case', () => {
    for (const task of loadProcesses(DATA_DIR)) {
      for (const n of task.dag.nodes) {
        const ids = (n.methods ?? []).map((m) => m.id)
        expect(new Set(ids).size, `${task.id}/${n.id}`).toBe(ids.length)
        for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      }
    }
  })
})

describe('the founder\'s worked example — validate-the-idea', () => {
  const task = loadProcesses(DATA_DIR).find((t) => t.id === 'startup_001')!
  const smoke = task.dag.nodes.find((n) => n.id === 'n2')!

  it('the smoke-test step gains the four context methods; the landing page stays the default', () => {
    const byId = new Map((smoke.methods ?? []).map((m) => [m.id, m]))
    expect([...byId.keys()].sort()).toEqual([
      'concierge-mvp', 'customer-interview-sprint', 'preorder-deposit-test', 'waitlist-ad-test',
    ])
    // The right contexts, per the founder's brief.
    expect(byId.get('customer-interview-sprint')!.context?.when).toMatch(/B2B/)
    expect(byId.get('waitlist-ad-test')!.context?.when).toMatch(/[Cc]onsumer/)
    expect(byId.get('concierge-mvp')!.context?.when).toMatch(/[Ss]ervice/)
    expect(byId.get('preorder-deposit-test')!.context?.when).toMatch(/[Hh]ardware/)
    for (const m of smoke.methods ?? []) {
      expect(m.context?.kind).toBe('situational')
      expect(m.subSteps!.length).toBeGreaterThanOrEqual(2)
      expect(m.subSteps!.length).toBeLessThanOrEqual(5)
    }
    // The DEFAULT method is the node's own committed fields — unchanged.
    expect(smoke.label).toBe('Generate a landing-page smoke test')
    expect(smoke.vendor).toBe('lovable')
    expect(smoke.route).toBe('agent')
    expect(smoke.estimatedMinutes).toBe(20)
  })

  it('no committed number moved: the process ceiling and simulator steps are the pre-variant defaults', () => {
    const ceiling = taskCeiling(task)
    expect(ceiling.totalSteps).toBe(7)
    expect(ceiling.agentSteps).toBe(5)
    expect(ceiling.pct).toBe(71)
    // The simulator flattens the DEFAULT flow only — one step per node, no method leakage.
    const sim = buildSimSteps([task], DATA_DIR)
    expect(sim.length).toBe(7)
    expect(sim.every((s) => !('methods' in s))).toBe(true)
  })

  it('buildStepMethodViews: derived times and the relabeled "with this method" ceiling', () => {
    const views = buildStepMethodViews(smoke, 'startup_001', DATA_DIR)!
    expect(views.defaultView.ceiling).toEqual({ agentSteps: 5, totalSteps: 7, pct: 71 })
    const interviews = views.variants.find((v) => v.id === 'customer-interview-sprint')!
    // Time derived from the sub-DAG, never invented: 15 + 240 + 300 + 30.
    expect(interviews.estimatedMinutes).toBe(585)
    // Substituting the 4-sub-step method (2 agent, 2 person) for the 1 agent step:
    // agent 5-1+2=6 of 7-1+4=10 → 60%.
    expect(interviews.ceiling).toEqual({ agentSteps: 6, totalSteps: 10, pct: 60 })
    // Sub-step chips resolve against the live judged market.
    const synth = interviews.subSteps.find((s) => s.id === 'ci4')!
    expect(synth.chips.length).toBeGreaterThan(0)
    expect(synth.chips.some((c) => c.arenaId === 'ai-assistants' && c.productId !== null)).toBe(true)
  })
})

describe('buildStepMethodViews', () => {
  const tasks = loadProcesses(DATA_DIR)

  it('returns null for the many nodes without methods', () => {
    const ein = tasks.find((t) => t.id === 'form_002')!
    for (const n of ein.dag.nodes) {
      expect(buildStepMethodViews(n, ein.id, DATA_DIR)).toBeNull()
    }
  })

  it('resolves variant vendor refs to real judged products (the MoR route → Paddle in payments)', () => {
    const pay = tasks.find((t) => t.id === 'qs_021')!
    const choose = pay.dag.nodes.find((n) => n.id === 'n1')!
    const views = buildStepMethodViews(choose, pay.id, DATA_DIR)!
    const mor = views.variants.find((v) => v.id === 'merchant-of-record')!
    const paddle = mor.chips.find((c) => c.productId === 'paddle')
    expect(paddle).toBeDefined()
    expect(paddle!.arenaId).toBe('payments')
    expect(paddle!.rank).not.toBeNull()
  })

  it('a route-override variant recomputes the ceiling without changing the step count', () => {
    const bank = tasks.find((t) => t.id === 'qs_023')!
    const choose = bank.dag.nodes.find((n) => n.id === 'n2')!
    const views = buildStepMethodViews(choose, bank.id, DATA_DIR)!
    const ukEu = views.variants.find((v) => v.id === 'uk-eu-multicurrency')!
    // No route override, no sub-DAG → the relabeled ceiling equals the default.
    expect(ukEu.ceiling).toEqual(views.defaultView.ceiling)
    expect(ukEu.context!.kind).toBe('geo')
    expect(ukEu.context!.countries).toEqual(['UK', 'DE', 'FR'])
    // Never inherits the default's action target.
    expect(ukEu.actionUrl).toBeNull()
  })

  it('geo variants of the incorporation filing carry their own verified country portals', () => {
    const inc = tasks.find((t) => t.id === 'form_001')!
    const filing = inc.dag.nodes.find((n) => n.id === 'n4')!
    const views = buildStepMethodViews(filing, inc.id, DATA_DIR)!
    expect(views.variants.map((v) => v.context!.countries[0]).sort()).toEqual(['DE', 'FR', 'IN', 'UK'])
    for (const v of views.variants) {
      expect(v.actionUrl).toMatch(/^https:\/\//)
      expect(v.actionUrl).not.toBe(views.defaultView.actionUrl)
    }
    // The German notary route genuinely decomposes — and carries a legally-human sub-step.
    const de = views.variants.find((v) => v.id === 'germany-notary-gmbh')!
    expect(de.route).toBe('person')
    expect(de.subSteps.some((s) => s.legalSignature)).toBe(true)
  })
})

describe('the selection store (client half)', () => {
  it('defaults, sets, notifies, and resets', () => {
    resetMethodSelections()
    const key = stepMethodNodeKey('startup_001', 'n2')
    expect(key).toBe('startup_001:n2')
    expect(methodSelection(key)).toBe(DEFAULT_METHOD_ID)
    let notified = 0
    const unsub = subscribeMethodSelections(() => { notified += 1 })
    setMethodSelection(key, 'concierge-mvp')
    expect(methodSelection(key)).toBe('concierge-mvp')
    expect(notified).toBe(1)
    // Selecting the default clears the entry (and re-selecting it is a no-op).
    setMethodSelection(key, DEFAULT_METHOD_ID)
    expect(methodSelection(key)).toBe(DEFAULT_METHOD_ID)
    setMethodSelection(key, DEFAULT_METHOD_ID)
    expect(notified).toBe(2)
    unsub()
    resetMethodSelections()
  })
})

describe('default-view guarantee', () => {
  it('ceilings everywhere ignore methods by construction (base fields only)', () => {
    for (const task of loadProcesses(DATA_DIR)) {
      const stripped = task.dag.nodes.map((n) => {
        const rest = { ...n }
        delete rest.methods
        return rest
      })
      expect(computeCeiling(stripped)).toEqual(taskCeiling(task))
    }
  })
})
