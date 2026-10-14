// Textbook tests for the liquidity-event waterfall. The YC Post-Money Safe User Guide's
// Appendix II Example 1 Q3/Q4 (PDF linked from https://www.ycombinator.com/documents,
// Feb 2023 edition) is replayed number-for-number: the $10m acquisition where both safes
// convert and the $3m acquisition where both cash out. Preferred-stock mechanics follow
// the verified definitions in the Cooley GO glossary ("Preferred Stock") and Brad Feld's
// "Term Sheet: Liquidation Preference" (2005-01-04), with the arithmetic hand-derived in
// comments. Properties demanded by the module contract: proceeds sum to the price exactly,
// no negative payouts, non-participating holders take the greater of preference and
// as-converted value.
//
// Note on the guide's printed dollar figures: Appendix II multiplies share counts by the
// DISPLAY-rounded per-share price ($0.8901, $0.2670), which over-distributes in aggregate
// (summing every holder at $0.8901 exceeds the $10m price by ~$534). The module replays
// those printed figures in `safeConversions[].asConvertedValue` (same rounded-price
// arithmetic) and allocates the actual price exactly in `rows` — both are asserted below.

import { describe, expect, it } from 'vitest'
import {
  allocateCents,
  conversionIndifferencePrice,
  liquidityWaterfall,
  safeLiquidityShares,
  type WaterfallInputs,
} from '../waterfall'

// Appendix II Example 1, immediately prior to the acquisition (promised options removed by
// the guide itself "to simplify the example"): Founders 9,250,000 common, 300,000 options
// outstanding, 450,000 options available (unissued — excluded), 9,550,000 outstanding.
const GUIDE_TABLE: WaterfallInputs = {
  holders: [
    { name: 'Founders', shares: 9_250_000, group: 'common' },
    { name: 'Options outstanding', shares: 300_000, group: 'options' },
  ],
  safes: [
    { name: 'Investor A', amount: 200_000, postMoneyCap: 4_000_000 },
    { name: 'Investor B', amount: 800_000, postMoneyCap: 8_000_000 },
  ],
  unissuedPoolShares: 450_000,
}

describe('allocateCents (largest remainder: the sum-to-price primitive)', () => {
  it('sums to the total exactly and splits proportionally', () => {
    const parts = allocateCents(100, [1, 1, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100)
    expect(parts).toEqual([33.34, 33.33, 33.33])
  })

  it('zero total or zero weights allocate nothing', () => {
    expect(allocateCents(0, [1, 2])).toEqual([0, 0])
    expect(allocateCents(10, [0, 0])).toEqual([0, 0])
  })
})

describe('safeLiquidityShares (User Guide §C.1, Appendix II Ex. 1 Q3)', () => {
  it('replays the guide: 5% and 10% of 9,550,000/(100% − 15%) → 561,764 and 1,123,529', () => {
    // Investor A: $200,000 / ($4,000,000 / (9,550,000/85%)) = 561,764
    // Investor B: $800,000 / ($8,000,000 / (9,550,000/85%)) = 1,123,529
    const conv = safeLiquidityShares(GUIDE_TABLE.safes!, 9_550_000)
    expect(conv[0].shares).toBe(561_764)
    expect(conv[1].shares).toBe(1_123_529)
    // Liquidity Price = cap / Liquidity Capitalization: 4,000,000 / 11,235,294.1 = $0.3560.
    expect(conv[0].liquidityPrice).toBe(0.356)
    expect(conv[1].liquidityPrice).toBe(0.712)
  })

  it('rejects uncapped safes, amount >= cap, and >= 100% combined ownership', () => {
    expect(() => safeLiquidityShares([{ name: 'x', amount: 1, postMoneyCap: 0 }], 100)).toThrow(/postMoneyCap/)
    expect(() => safeLiquidityShares([{ name: 'x', amount: 5, postMoneyCap: 5 }], 100)).toThrow(RangeError)
    expect(() =>
      safeLiquidityShares(
        [
          { name: 'x', amount: 60, postMoneyCap: 100 },
          { name: 'y', amount: 40, postMoneyCap: 100 },
        ],
        100,
      ),
    ).toThrow(/100%/)
  })
})

describe('Appendix II Example 1 Q3: acquired for $10m — both safes convert', () => {
  const report = liquidityWaterfall(GUIDE_TABLE, 10_000_000)

  it('both safes convert (pro rata share of the consideration exceeds the Purchase Amount)', () => {
    expect(report.safeConversions.map((c) => c.decision)).toEqual(['convert', 'convert'])
    expect(report.safeConversions.map((c) => c.shares)).toEqual([561_764, 1_123_529])
  })

  it("the per-share consideration is the guide's $0.8901 on 11,235,293 shares", () => {
    // 9,550,000 + 561,764 + 1,123,529 = 11,235,293 (the guide's Liquidity Capitalization).
    expect(report.residualShares).toBe(11_235_293)
    expect(report.perShare).toBe(0.8901) // $10,000,000 / 11,235,293, 4-decimal convention
  })

  it("replays the guide's printed payouts at the rounded price: $500,026 and $1,000,053", () => {
    // Guide arithmetic: 561,764 × $0.8901 and 1,123,529 × $0.8901.
    expect(report.safeConversions[0].allConvertPerShare).toBe(0.8901)
    expect(report.safeConversions[0].asConvertedValue).toBeCloseTo(500_026, 0)
    expect(report.safeConversions[1].asConvertedValue).toBeCloseTo(1_000_053, 0)
  })

  it('allocates the actual price exactly (the rounded-price arithmetic would overshoot)', () => {
    const byName = Object.fromEntries(report.rows.map((r) => [r.name, r]))
    // Exact pro rata: shares × $10m / 11,235,293 — within a cent of the allocation.
    expect(byName['Investor A'].total).toBeCloseTo((561_764 / 11_235_293) * 10_000_000, 1)
    expect(byName['Investor B'].total).toBeCloseTo((1_123_529 / 11_235_293) * 10_000_000, 1)
    expect(byName['Founders'].total).toBeCloseTo((9_250_000 / 11_235_293) * 10_000_000, 1)
    const sum = report.rows.reduce((s, r) => s + r.total, 0)
    expect(sum).toBeCloseTo(10_000_000, 8) // exact in cents
  })

  it('the unissued pool is excluded and reported as such (§C.1)', () => {
    expect(report.unissuedPoolSharesExcluded).toBe(450_000)
    expect(report.needsReview).toBe(true)
  })
})

describe('Appendix II Example 1 Q4: acquired for $3m — both safes cash out', () => {
  const report = liquidityWaterfall(GUIDE_TABLE, 3_000_000)

  it("replays the guide's decision figures at $0.2670: $149,991 and $299,982 — both below the Purchase Amounts", () => {
    expect(report.safeConversions[0].allConvertPerShare).toBe(0.267) // $3m / 11,235,293
    expect(report.safeConversions[0].asConvertedValue).toBeCloseTo(149_991, 0)
    expect(report.safeConversions[1].asConvertedValue).toBeCloseTo(299_982, 0)
    expect(report.safeConversions.map((c) => c.decision)).toEqual(['cash-out', 'cash-out'])
  })

  it('pays the Cash-Out Amounts and shares the remaining $2m pro rata among all other stockholders', () => {
    const byName = Object.fromEntries(report.rows.map((r) => [r.name, r]))
    expect(byName['Investor A'].total).toBe(200_000)
    expect(byName['Investor B'].total).toBe(800_000)
    expect(byName['Investor A'].shares).toBeNull()
    // Remaining $2,000,000 over the 9,550,000 outstanding shares:
    expect(byName['Founders'].total).toBeCloseTo((9_250_000 / 9_550_000) * 2_000_000, 1)
    expect(byName['Options outstanding'].total).toBeCloseTo((300_000 / 9_550_000) * 2_000_000, 1)
    expect(report.rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(3_000_000, 8)
  })
})

// ---------------------------------------------------------------------------
// One preferred series — Cooley GO glossary / Feld mechanics, hand-derived numbers
// ---------------------------------------------------------------------------

// Common 7,500,000; Series A 2,500,000 as-converted shares (25%) for $5,000,000, 1x.
const SERIES_A = { name: 'Series A', shares: 2_500_000, invested: 5_000_000 }
const SIMPLE: WaterfallInputs = {
  holders: [{ name: 'Common', shares: 7_500_000, group: 'common' }],
  preferred: SERIES_A,
}

describe('mixed SAFE decisions and the exact-preference price', () => {
  it('a mixed decision: the low-cap safe converts while the high-cap safe cashes out', () => {
    const r = liquidityWaterfall(
      {
        holders: [{ name: 'Common', shares: 9_000_000 }],
        safes: [
          { name: 'Low cap', amount: 500_000, postMoneyCap: 2_000_000 },
          { name: 'High cap', amount: 500_000, postMoneyCap: 50_000_000 },
        ],
      },
      5_000_000,
    )
    const byName = Object.fromEntries(r.safeConversions.map((c) => [c.name, c]))
    expect(byName['Low cap'].decision).toBe('convert')
    expect(byName['High cap'].decision).toBe('cash-out')
    expect(r.rows.reduce((s, x) => s + x.total, 0)).toBeCloseTo(5_000_000, 8)
  })

  it('a price exactly equal to the preference pays the claim in full and leaves common zero', () => {
    const r = liquidityWaterfall(SIMPLE, 5_000_000)
    expect(r.rows.find((x) => x.kind === 'preferred')!.total).toBe(5_000_000)
    expect(r.rows.find((x) => x.name === 'Common')!.total).toBe(0)
  })
})

describe('non-participating preferred: the greater of preference and as-converted (Cooley GO glossary)', () => {
  it('$30m exit: 25% as-converted ($7.5m) beats the $5m preference → converts', () => {
    const r = liquidityWaterfall(SIMPLE, 30_000_000)
    const pref = r.rows.find((x) => x.kind === 'preferred')!
    expect(pref.decision).toBe('convert')
    expect(pref.total).toBe(7_500_000)
    expect(r.rows.find((x) => x.name === 'Common')!.total).toBe(22_500_000)
  })

  it('$12m exit: the $5m preference beats $3m as-converted → takes the preference', () => {
    const r = liquidityWaterfall(SIMPLE, 12_000_000)
    const pref = r.rows.find((x) => x.kind === 'preferred')!
    expect(pref.decision).toBe('preference')
    expect(pref.shares).toBeNull()
    expect(pref.total).toBe(5_000_000)
    expect(r.rows.find((x) => x.name === 'Common')!.total).toBe(7_000_000)
  })

  it('$3m exit (below the preference): preferred takes everything, common gets zero', () => {
    const r = liquidityWaterfall(SIMPLE, 3_000_000)
    expect(r.rows.find((x) => x.kind === 'preferred')!.total).toBe(3_000_000)
    expect(r.rows.find((x) => x.name === 'Common')!.total).toBe(0)
  })

  it('conversionIndifferencePrice: $5m × 10,000,000 / 2,500,000 = $20m, where both routes pay $5m', () => {
    expect(conversionIndifferencePrice(SERIES_A, 7_500_000)).toBe(20_000_000)
    const at = liquidityWaterfall(SIMPLE, 20_000_000)
    expect(at.rows.find((x) => x.kind === 'preferred')!.total).toBe(5_000_000)
    const above = liquidityWaterfall(SIMPLE, 20_000_004)
    expect(above.rows.find((x) => x.kind === 'preferred')!.decision).toBe('convert')
    expect(above.rows.find((x) => x.kind === 'preferred')!.total).toBeGreaterThanOrEqual(5_000_000)
  })

  it('a preference multiple scales the preference (Feld: multiples exist; 1x is standard)', () => {
    const r = liquidityWaterfall(
      { ...SIMPLE, preferred: { ...SERIES_A, invested: 1_000_000, preferenceMultiple: 2 } },
      6_000_000,
    )
    // Preference 2 × $1m = $2m; as-converted 25% × $6m = $1.5m → preference wins.
    expect(r.rows.find((x) => x.kind === 'preferred')!.total).toBe(2_000_000)
  })
})

describe('participating preferred: preference AND the pro rata residual (Cooley GO glossary)', () => {
  it('$30m exit: $5m preference + 25% of the remaining $25m = $11.25m', () => {
    const r = liquidityWaterfall({ ...SIMPLE, preferred: { ...SERIES_A, participating: true } }, 30_000_000)
    const pref = r.rows.find((x) => x.kind === 'preferred')!
    expect(pref.decision).toBe('participate')
    expect(pref.preferencePayout).toBe(5_000_000)
    expect(pref.residualPayout).toBe(6_250_000)
    expect(pref.total).toBe(11_250_000)
    expect(r.rows.find((x) => x.name === 'Common')!.total).toBe(18_750_000)
  })

  it('participating never pays less than non-participating on the same facts', () => {
    for (const price of [1_000_000, 5_000_000, 12_000_000, 20_000_000, 30_000_000, 100_000_000]) {
      const np = liquidityWaterfall(SIMPLE, price).rows.find((x) => x.kind === 'preferred')!.total
      const p = liquidityWaterfall({ ...SIMPLE, preferred: { ...SERIES_A, participating: true } }, price).rows.find(
        (x) => x.kind === 'preferred',
      )!.total
      expect(p).toBeGreaterThanOrEqual(np)
    }
  })
})

describe('pari passu preference tier (§A.5-A.6: safes rank with preferred, senior to common)', () => {
  it('a shortfall pro-rates preference claims and leaves common nothing', () => {
    // Series A preference $5m + safe Cash-Out $1m = $6m of claims against a $3m price:
    // preferred 3 × 5/6 = $2.5m, safe 3 × 1/6 = $0.5m, common $0.
    const r = liquidityWaterfall(
      {
        holders: [{ name: 'Common', shares: 7_500_000 }],
        preferred: SERIES_A,
        safes: [{ name: 'Safe', amount: 1_000_000, postMoneyCap: 10_000_000 }],
      },
      3_000_000,
    )
    expect(r.rows.find((x) => x.kind === 'preferred')!.total).toBe(2_500_000)
    expect(r.rows.find((x) => x.kind === 'safe')!.total).toBe(500_000)
    expect(r.rows.find((x) => x.name === 'Common')!.total).toBe(0)
    expect(r.rows.reduce((s, x) => s + x.total, 0)).toBeCloseTo(3_000_000, 8)
  })
})

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('waterfall invariants', () => {
  const MIXED: WaterfallInputs = {
    holders: [
      { name: 'Founders', shares: 6_000_000 },
      { name: 'Options', shares: 1_000_000, group: 'options' },
    ],
    preferred: { name: 'Series A', shares: 3_000_000, invested: 4_000_000 },
    safes: [{ name: 'Safe 1', amount: 500_000, postMoneyCap: 8_000_000 }],
    unissuedPoolShares: 500_000,
  }
  const PRICES = [0, 1_000_000, 3_000_000, 4_500_000, 10_000_000, 25_000_000, 60_000_000]

  it('proceeds always sum to the price, exactly in cents', () => {
    for (const price of PRICES) {
      const r = liquidityWaterfall(MIXED, price)
      const cents = r.rows.reduce((s, x) => s + Math.round(x.total * 100), 0)
      expect(cents).toBe(Math.round(price * 100))
    }
  })

  it('no payout is ever negative', () => {
    for (const price of PRICES) {
      for (const row of liquidityWaterfall(MIXED, price).rows) {
        expect(row.preferencePayout).toBeGreaterThanOrEqual(0)
        expect(row.residualPayout).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('every payout is weakly increasing in the price', () => {
    let prev = new Map<string, number>()
    for (const price of PRICES) {
      const r = liquidityWaterfall(MIXED, price)
      for (const row of r.rows) {
        expect(row.total).toBeGreaterThanOrEqual((prev.get(row.name) ?? 0) - 0.02) // cent-allocation jitter
      }
      prev = new Map(r.rows.map((x) => [x.name, x.total]))
    }
  })

  it('non-participating preferred always receives max(preference capped at price, as-converted)', () => {
    for (const price of [0, 2_000_000, 5_000_000, 12_000_000, 20_000_000, 50_000_000]) {
      const r = liquidityWaterfall(SIMPLE, price)
      const pref = r.rows.find((x) => x.kind === 'preferred')!
      const asConverted = (2_500_000 / 10_000_000) * price
      const preferenceSide = Math.min(5_000_000, price)
      expect(pref.total).toBeCloseTo(Math.max(asConverted, preferenceSide), 1)
    }
  })

  it('is deterministic', () => {
    expect(liquidityWaterfall(MIXED, 10_000_000)).toEqual(liquidityWaterfall(MIXED, 10_000_000))
  })

  it('rejects empty tables, negative prices, and non-positive holdings', () => {
    expect(() => liquidityWaterfall({ holders: [] }, 1)).toThrow(RangeError)
    expect(() => liquidityWaterfall(SIMPLE, -1)).toThrow(RangeError)
    expect(() => liquidityWaterfall({ holders: [{ name: 'x', shares: 0 }] }, 1)).toThrow(RangeError)
    expect(() =>
      liquidityWaterfall({ holders: [{ name: 'x', shares: 1 }], preferred: { name: 'p', shares: 1, invested: 1, preferenceMultiple: 0 } }, 1),
    ).toThrow(RangeError)
  })
})
