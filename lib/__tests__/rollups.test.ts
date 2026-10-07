import { describe, expect, it } from 'vitest'
import { buildRollups, loadRollups, MATCHED_AREAS, RollupsSchema } from '../rollups'
import type { Product, Rankings } from '../schemas'

// Country/area rollups (government-services Phase 2): derived means over computed Overall
// scores, never authored. These tests pin the derivation rules the page and recompute-check
// rely on: tagged-only emission, per-cell means, the all-matched-areas-or-null overall, and
// deterministic ordering.

const urls = { site: 'https://example.gov' }

function product(id: string, country?: string, area?: Product['area']): Product {
  return { id, name: id, vendor: id, type: 'government', urls, ...(country ? { country } : {}), ...(area ? { area } : {}) } as Product
}

function rankings(scores: Record<string, number | null>): Rankings {
  return {
    generatedAt: '2026-10-07T00:00:00.000Z',
    leaderboard: Object.entries(scores).map(([productId, aiEra]) => ({
      productId, score: 0, agentReady: null, agenticApp: null, apiQuality: null,
      aiEra, applicable: 0, total: 0, themeScores: {},
    })),
    battles: [],
  }
}

describe('buildRollups', () => {
  it('returns null for arenas with no jurisdiction tags', () => {
    expect(buildRollups([product('a'), product('b')], rankings({ a: 10, b: 20 }))).toBeNull()
  })

  it('throws when country and area are not set together', () => {
    const p = { ...product('a', 'US', 'tax') }
    delete (p as { area?: string }).area
    expect(() => buildRollups([p], rankings({ a: 10 }))).toThrow(/country and area together/)
  })

  it('averages multi-agency cells and matched areas, and validates against the schema', () => {
    const products = [
      product('irs', 'US', 'tax'), product('eftps', 'US', 'tax'),
      product('uspto', 'US', 'ip-office'), product('uscis', 'US', 'immigration'),
      product('de-sos', 'US', 'company-registry'), product('ca-sos', 'US', 'company-registry'),
      product('sam', 'US', 'procurement'),
    ]
    const r = buildRollups(products, rankings({ irs: 3.4, eftps: 2.6, uspto: 6.4, uscis: 8.9, 'de-sos': 1.0, 'ca-sos': 2.4, sam: 18.7 }))!
    RollupsSchema.parse(r)
    const us = r.countries.find((c) => c.country === 'US')!
    expect(us.areas['tax'].score).toBe(3) // mean(3.4, 2.6)
    expect(us.areas['tax'].productIds).toEqual(['eftps', 'irs']) // sorted
    expect(us.areas['company-registry'].score).toBe(1.7) // mean(1.0, 2.4)
    // overall = mean over the four matched areas only — procurement never enters it
    expect(us.overall).toBe(5) // mean(3, 6.4, 8.9, 1.7)
    expect(r.matchedAreas).toEqual([...MATCHED_AREAS])
    expect(r.areaBoards['procurement']).toEqual([{ country: 'US', score: 18.7, productIds: ['sam'] }])
  })

  it('gives no overall to a country missing a matched area, and sorts it after scored ones', () => {
    const products = [
      product('uk-reg', 'UK', 'company-registry'), product('uk-tax', 'UK', 'tax'),
      product('uk-ip', 'UK', 'ip-office'), product('uk-imm', 'UK', 'immigration'),
      product('in-tax', 'IN', 'tax'),
    ]
    const r = buildRollups(products, rankings({ 'uk-reg': 20, 'uk-tax': 10, 'uk-ip': 10, 'uk-imm': 10, 'in-tax': 50 }))!
    expect(r.countries.map((c) => c.country)).toEqual(['UK', 'IN'])
    expect(r.countries[0].overall).toBe(12.5)
    expect(r.countries[1].overall).toBeNull()
    // the per-area board still ranks IN's judged tax agency above UK's
    expect(r.areaBoards['tax'].map((row) => row.country)).toEqual(['IN', 'UK'])
  })

  it('keeps null aiEra out of means and yields a null cell when every agency is null', () => {
    const products = [product('a', 'US', 'tax'), product('b', 'US', 'tax')]
    expect(buildRollups(products, rankings({ a: null, b: 4 }))!.countries[0].areas['tax'].score).toBe(4)
    expect(buildRollups(products, rankings({ a: null, b: null }))!.countries[0].areas['tax'].score).toBeNull()
  })
})

describe('loadRollups', () => {
  it('is tolerant-optional: absent file means null, never a fabricated rollup', () => {
    expect(loadRollups('no-such-arena')).toBeNull()
  })
})
