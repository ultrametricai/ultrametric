import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import { GOVERNMENT_ARENA_ID, governmentStepEligibility, jurisdictionNodes } from '@/lib/processes'
import {
  loadVendorState, VENDOR_STATE_SERVICES, vendorStateFor, vendorStateLookup,
} from '@/lib/vendorState'

const ROOT = path.resolve(__dirname, '../..')
const DATA_DIR = path.join(ROOT, 'open-rankings')

// The per-state vendors foundation (2026-10-22): US-state availability EVIDENCE at
// jurisdictions/vendor-state.json (the state sibling of vendor-geo.json), the ProductSchema
// `state` tag on state-remit agencies, and the state dimension of governmentStepEligibility.
// These tests pin the integrity rules — real products, one row per (product, state, service),
// every state code registered in jurisdictions/registry.json, sources on every row — and that
// the state dimension changes nothing for steps without a state code.

const registryStates = () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'jurisdictions/registry.json'), 'utf8'),
  ) as { jurisdictions: Array<{ code: string; level: string }> }
  return new Set(registry.jurisdictions.filter((j) => j.level === 'state').map((j) => j.code))
}

describe('vendor-state corpus', () => {
  const entries = loadVendorState(DATA_DIR)
  const states = registryStates()

  it('every checkedAt is a real date no later than today', () => {
    const today = new Date().toISOString().slice(0, 10)
    for (const e of entries) {
      const parsed = new Date(e.checkedAt)
      expect(Number.isNaN(parsed.getTime()), `${e.productId}/${e.state}/${e.service}`).toBe(false)
      // Rejects impossible dates such as 2026-02-30, which Date silently rolls forward.
      expect(parsed.toISOString().slice(0, 10), `${e.productId}/${e.state}/${e.service} checkedAt`).toBe(e.checkedAt)
      expect(e.checkedAt <= today, `${e.productId}/${e.state}/${e.service} checkedAt`).toBe(true)
    }
  })

  it('loads and every row is fully sourced', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const e of entries) {
      expect(e.sourceUrl).toMatch(/^https:\/\//)
      expect(e.note.length, `${e.productId}/${e.state}/${e.service} note`).toBeGreaterThan(15)
    }
  })

  it('every state code resolves to a level:state entry in jurisdictions/registry.json', () => {
    for (const e of entries) {
      expect(states.has(e.state), `${e.state} must be registered before rows reference it`).toBe(true)
    }
  })

  it('every (arenaId, productId) resolves to a real judged product in that arena', () => {
    const seen = new Map<string, Set<string>>()
    for (const e of entries) {
      let ids = seen.get(e.arenaId)
      if (!ids) {
        ids = new Set(loadCategory(e.arenaId, DATA_DIR).products.map((p) => p.id))
        seen.set(e.arenaId, ids)
      }
      expect(ids.has(e.productId), `${e.productId} must exist in ${e.arenaId}`).toBe(true)
    }
  })

  it('one row per (product, state, service); a product never spans two arenas here', () => {
    const triples = new Set<string>()
    const arenaOf = new Map<string, string>()
    for (const e of entries) {
      const key = `${e.productId}/${e.state}/${e.service}`
      expect(triples.has(key), `duplicate ${key}`).toBe(false)
      triples.add(key)
      const prev = arenaOf.get(e.productId)
      if (prev) expect(prev, `${e.productId} arena consistency`).toBe(e.arenaId)
      arenaOf.set(e.productId, e.arenaId)
    }
  })

  it('pins the seeded findings, including the Stripe Atlas Delaware-only negative', () => {
    const status = (pid: string, state: string, service: string) =>
      entries.find((e) => e.productId === pid && e.state === state && e.service === service)?.status
    expect(status('stripe-atlas', 'US-DE', 'formation')).toBe('available')
    expect(status('stripe-atlas', 'US-CA', 'formation')).toBe('unavailable')
    expect(status('clerky', 'US-DE', 'formation')).toBe('available')
    expect(status('firstbase', 'US-WY', 'formation')).toBe('available')
    // Clerky files foreign qualification directly in CA and NY only; other states go to partners.
    expect(status('clerky', 'US-CA', 'foreign-qualification')).toBe('available')
    expect(status('clerky', 'US-TX', 'foreign-qualification')).toBe('partial')
    // Rippling registers state payroll-tax accounts through its PEO, not payroll alone.
    expect(status('rippling', 'US-CA', 'payroll-tax-registration')).toBe('partial')
  })
})

describe('vendorStateFor', () => {
  it('returns rows ordered by state then canonical service order, [] for uncovered products', () => {
    const rows = vendorStateFor('stripe-atlas', DATA_DIR)
    expect(rows.length).toBeGreaterThan(0)
    const keys = rows.map((r) => `${r.state}/${r.service}`)
    const sorted = [...rows].sort(
      (a, b) =>
        a.state.localeCompare(b.state) ||
        VENDOR_STATE_SERVICES.indexOf(a.service) - VENDOR_STATE_SERVICES.indexOf(b.service),
    )
    expect(keys).toEqual(sorted.map((r) => `${r.state}/${r.service}`))
    expect(vendorStateFor('linear', DATA_DIR)).toEqual([])
    expect(vendorStateFor('does-not-exist', DATA_DIR)).toEqual([])
  })

  it('missing file degrades to no rows, never an error', () => {
    expect(loadVendorState(path.resolve(__dirname))).toEqual([])
  })
})

// The client-annotation lookup, mirroring vendorGeoLookup: evidence-only and page-scoped.
describe('vendorStateLookup', () => {
  it('keys by productId, restricted to the requested products and the one state', () => {
    const lookup = vendorStateLookup(['stripe-atlas', 'linear', 'does-not-exist'], 'US-DE', DATA_DIR)
    expect(Object.keys(lookup)).toEqual(['stripe-atlas'])
    const atlas = lookup['stripe-atlas']
    expect(atlas.formation?.status).toBe('available')
    expect(atlas.formation?.sourceUrl).toMatch(/^https:\/\//)
    expect(atlas.formation?.note).toMatch(/Delaware/)
    expect(atlas.formation?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Rows for other states never leak into the selection.
    const ca = vendorStateLookup(['stripe-atlas'], 'US-CA', DATA_DIR)['stripe-atlas']
    expect(ca.formation?.status).toBe('unavailable')
    expect(Object.keys(ca)).toEqual(['formation'])
  })

  it('uncovered products and states are simply absent — annotations never invent a row', () => {
    expect(vendorStateLookup(['linear'], 'US-DE', DATA_DIR)).toEqual({})
    expect(vendorStateLookup(['stripe-atlas'], 'US-AK', DATA_DIR)).toEqual({})
    expect(vendorStateLookup([], 'US-DE', DATA_DIR)).toEqual({})
  })
})

// The ProductSchema `state` tag on the government-services roster: US company registries and
// the state tax/employment agencies carry their ISO 3166-2 code; federal and non-US agencies
// carry none.
describe('government-services state tags', () => {
  const products = loadCategory(GOVERNMENT_ARENA_ID, DATA_DIR).products
  const states = registryStates()

  it('every state tag sits on a US agency and resolves in jurisdictions/registry.json', () => {
    for (const p of products.filter((p) => p.state)) {
      expect(p.country, `${p.id} state tag requires country US`).toBe('US')
      expect(states.has(p.state!), `${p.id} state ${p.state} must be registered`).toBe(true)
    }
  })

  it('pins the committed registry-to-state mapping', () => {
    const tag = (id: string) => products.find((p) => p.id === id)?.state
    // The state tax and employment agencies (state-agency bring-up, 2026-10-22).
    expect(tag('ca-ftb')).toBe('US-CA')
    expect(tag('ca-edd')).toBe('US-CA')
    expect(tag('ny-dtf')).toBe('US-NY')
    expect(tag('tx-comptroller')).toBe('US-TX')
    expect(tag('de-dor')).toBe('US-DE')
    // The six agencies of the 2026-10-27 bring-up (PR #500).
    expect(tag('tx-twc')).toBe('US-TX')
    expect(tag('wa-esd')).toBe('US-WA')
    expect(tag('wa-dor')).toBe('US-WA')
    expect(tag('fl-dor')).toBe('US-FL')
    expect(tag('nevada-sos')).toBe('US-NV')
    expect(tag('wyoming-sos')).toBe('US-WY')
    expect(tag('delaware-doc')).toBe('US-DE')
    expect(tag('california-sos')).toBe('US-CA')
    expect(tag('new-york-dos')).toBe('US-NY')
    expect(tag('texas-sos')).toBe('US-TX')
    expect(tag('colorado-sos')).toBe('US-CO')
    expect(tag('florida-dos')).toBe('US-FL')
    expect(tag('washington-sos')).toBe('US-WA')
    expect(tag('new-jersey-dor')).toBe('US-NJ')
    expect(tag('ohio-sos')).toBe('US-OH')
    expect(tag('minnesota-sos')).toBe('US-MN')
    expect(tag('virginia-scc')).toBe('US-VA')
    // Every US company-registry agency is tagged; federal agencies are not.
    for (const p of products.filter((p) => p.country === 'US' && p.area === 'company-registry')) {
      expect(p.state, `${p.id} carries its state tag`).toMatch(/^US-[A-Z]{2}$/)
    }
    for (const id of ['irs', 'eftps', 'uspto', 'uscis', 'sam-gov']) {
      expect(tag(id), `${id} is federal`).toBeUndefined()
    }
  })
})

// The state dimension of governmentStepEligibility: a committed state code on a step narrows
// the candidate pull to the agencies tagged with that state; everything else is byte-identical
// to the country+area rule.
describe('governmentStepEligibility with a state code', () => {
  it('a step tagged US-CA admits only state: US-CA agencies', () => {
    const eligible = governmentStepEligibility(
      { jurisdictions: ['US-CA'] },
      GOVERNMENT_ARENA_ID,
      DATA_DIR,
    )
    expect(eligible).toEqual(new Set(['california-sos', 'ca-ftb', 'ca-edd']))
  })

  it('each tagged state admits exactly its own agencies', () => {
    for (const [state, ids] of [
      ['US-DE', ['delaware-doc', 'de-dor']],
      ['US-NY', ['new-york-dos', 'ny-dtf']],
      ['US-TX', ['texas-sos', 'tx-comptroller', 'tx-twc']],
      // The 2026-10-27 bring-up states.
      ['US-WA', ['washington-sos', 'wa-esd', 'wa-dor']],
      ['US-FL', ['florida-dos', 'fl-dor']],
      ['US-NV', ['nevada-sos']],
      ['US-WY', ['wyoming-sos']],
    ] as const) {
      expect(
        governmentStepEligibility({ jurisdictions: [state] }, GOVERNMENT_ARENA_ID, DATA_DIR),
      ).toEqual(new Set(ids))
    }
  })

  it('a step wired to a state agency resolves to exactly the agencies sharing its country, area, and state', () => {
    // The committed wiring from the #422 state steps: the US-CA payroll registration (qs_063
    // jca1) is wired to the CA EDD, the CA franchise-tax and TX franchise-tax steps (tax_001)
    // to the FTB and the Comptroller, the NY steps (form_005/qs_063) to the DTF.
    for (const [vendor, state, id] of [
      ['ca_edd', 'US-CA', 'ca-edd'],
      ['ca_ftb', 'US-CA', 'ca-ftb'],
      ['ny_dtf', 'US-NY', 'ny-dtf'],
      ['tx_comptroller', 'US-TX', 'tx-comptroller'],
      // The 2026-10-27 bring-up wiring (PR #500).
      ['tx_twc', 'US-TX', 'tx-twc'],
      ['wa_esd', 'US-WA', 'wa-esd'],
      ['wa_dor', 'US-WA', 'wa-dor'],
      ['fl_dor', 'US-FL', 'fl-dor'],
      ['nevada_sos', 'US-NV', 'nevada-sos'],
      ['wyoming_sos', 'US-WY', 'wyoming-sos'],
    ] as const) {
      expect(
        governmentStepEligibility({ vendor, jurisdictions: [state] }, GOVERNMENT_ARENA_ID, DATA_DIR),
      ).toEqual(new Set([id]))
    }
  })

  it('a federal-wired step never retargets to a state agency: the country+area set stands (no guess)', () => {
    // US/tax now rosters state tax agencies, but the anchored set matches the wired agency's
    // state tag exactly (undefined = federal), so an IRS-wired step with a state code keeps
    // its federal candidates rather than retargeting to the state's tax agency.
    const base = governmentStepEligibility({ vendor: 'irs' }, GOVERNMENT_ARENA_ID, DATA_DIR)
    const withState = governmentStepEligibility(
      { vendor: 'irs', jurisdictions: ['US-CA'] },
      GOVERNMENT_ARENA_ID,
      DATA_DIR,
    )
    expect(base).toEqual(new Set(['irs', 'eftps']))
    expect(withState).toEqual(base)
  })

  it('the committed #422 state steps resolve to the new agencies where the area matches', () => {
    // Pulled from the corpus itself (jurisdictionNodes = the conditional steps loadProcesses
    // strips from the default view), never from a hand-built node: the wiring under test is
    // the committed stated-vendor reference on each canonical step.
    const byTask = (taskId: string) => jurisdictionNodes(taskId, DATA_DIR)
    const resolve = (taskId: string, vendor: string) => {
      const node = byTask(taskId).find((n) => n.vendor === vendor)
      expect(node, `${taskId} has a conditional step wired to ${vendor}`).toBeDefined()
      return governmentStepEligibility(node!, GOVERNMENT_ARENA_ID, DATA_DIR)
    }
    expect(resolve('qs_063', 'ca_edd')).toEqual(new Set(['ca-edd']))        // CA payroll registration
    expect(resolve('qs_063', 'ny_dtf')).toEqual(new Set(['ny-dtf']))        // NY employer registration
    expect(resolve('tax_001', 'ca_ftb')).toEqual(new Set(['ca-ftb']))       // CA minimum franchise tax
    expect(resolve('tax_001', 'tx_comptroller')).toEqual(new Set(['tx-comptroller'])) // TX franchise tax
    expect(resolve('qs_047', 'tx_comptroller')).toEqual(new Set(['tx-comptroller'])) // TX franchise report + PIR
    expect(resolve('form_005', 'ny_dtf')).toEqual(new Set(['ny-dtf']))      // NY Article 9-A / CT-3
    // The 2026-10-27 bring-up: each agency anchors its own state step (PR #500).
    expect(resolve('qs_063', 'tx_twc')).toEqual(new Set(['tx-twc']))        // TX unemployment-tax registration
    expect(resolve('qs_063', 'wa_esd')).toEqual(new Set(['wa-esd']))        // WA employer registration
    expect(resolve('qs_063', 'fl_dor')).toEqual(new Set(['fl-dor']))        // FL reemployment-tax registration
    expect(resolve('form_005', 'wa_dor')).toEqual(new Set(['wa-dor']))      // WA B&O registration
    expect(resolve('qs_047', 'nevada_sos')).toEqual(new Set(['nevada-sos'])) // NV annual list
    expect(resolve('qs_043', 'wyoming_sos')).toEqual(new Set(['wyoming-sos'])) // WY registered-agent change
  })

  it('steps without a state code behave exactly as before', () => {
    // The committed CA/MULTI view flags are not state codes and never narrow.
    for (const jurisdictions of [undefined, ['CA'], ['MULTI']] as const) {
      expect(
        governmentStepEligibility({ jurisdictions }, GOVERNMENT_ARENA_ID, DATA_DIR),
      ).toBeNull()
      expect(
        governmentStepEligibility({ vendor: 'irs', jurisdictions }, GOVERNMENT_ARENA_ID, DATA_DIR),
      ).toEqual(new Set(['irs', 'eftps']))
    }
    // Non-government arenas stay unfiltered.
    expect(governmentStepEligibility({ jurisdictions: ['US-CA'] }, 'payroll', DATA_DIR)).toBeNull()
  })
})
