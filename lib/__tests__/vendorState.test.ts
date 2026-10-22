import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import { GOVERNMENT_ARENA_ID, governmentStepEligibility } from '@/lib/processes'
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

// The ProductSchema `state` tag on the government-services roster: US company registries carry
// their ISO 3166-2 code; federal and non-US agencies carry none.
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
    expect(eligible).toEqual(new Set(['california-sos']))
  })

  it('each tagged state admits exactly its own registry', () => {
    for (const [state, id] of [
      ['US-DE', 'delaware-doc'],
      ['US-NY', 'new-york-dos'],
      ['US-TX', 'texas-sos'],
    ] as const) {
      expect(
        governmentStepEligibility({ jurisdictions: [state] }, GOVERNMENT_ARENA_ID, DATA_DIR),
      ).toEqual(new Set([id]))
    }
  })

  it('a state code on an area with no state-tagged agencies keeps the country+area set (no guess)', () => {
    const base = governmentStepEligibility({ vendor: 'irs' }, GOVERNMENT_ARENA_ID, DATA_DIR)
    const withState = governmentStepEligibility(
      { vendor: 'irs', jurisdictions: ['US-CA'] },
      GOVERNMENT_ARENA_ID,
      DATA_DIR,
    )
    expect(base).not.toBeNull()
    expect(withState).toEqual(base)
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
