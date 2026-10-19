// Textbook tests for the anti-dilution module. The Springmeyer worked example
// (calstartuplawfirm.com, verified 2026-10-01) is replayed number-for-number — the article
// prints every figure our assertions use — and the Cooley GO down-round explainer's
// full-ratchet example likewise. Ordering invariants are property-tested: for the same
// dilutive issuance, full ratchet <= narrow-based <= broad-based conversion price, and no
// adjustment ever raises a conversion price.

import { describe, expect, it } from 'vitest'
import {
  type AdjustableSeries,
  type DilutiveIssuance,
  applyAntiDilution,
  asConvertedShares,
  broadBase,
  conversionRatio,
  fullRatchetConversionPrice,
  payToPlayConsequence,
  toWaterfallSeries,
  weightedAverageConversionPrice,
} from '../antiDilution'
import { liquidityWaterfall } from '../waterfall'

// The Springmeyer setup: "NewCo receives $8 million at Series A with a pre-money value of
// $16 million. Combined, the founder shares and employee options pool total 8 million
// shares, so the investors receive 4 million shares of Preferred Stock ... The conversion
// price is $2 per share." The dilutive round: 5 million new shares sold for $5 million
// ($1.00 per share).
const SERIES_A: AdjustableSeries = {
  name: 'Series A',
  preferredShares: 4_000_000,
  originalIssuePrice: 2,
  conversionPriceBefore: 2,
}
const DOWN_ROUND: DilutiveIssuance = { newShares: 5_000_000, considerationDollars: 5_000_000 }
// "Prior Shares = ... all shares of outstanding common stock, all shares of outstanding
// preferred stock on an as-converted basis, and all outstanding options on an as-exercised
// basis" → 8M founders+options + 4M as-converted Series A = 12M.
const BROAD_BASE = broadBase({ commonOutstanding: 8_000_000, preferredAsConverted: 4_000_000, optionsAsExercised: 0 })

describe('conversion-price → conversion-ratio mechanics (NVCA model COD)', () => {
  it('ratio = OIP / CP: 1:1 at issuance, higher after an adjustment', () => {
    expect(conversionRatio(2, 2)).toBe(1)
    expect(conversionRatio(2, 1)).toBe(2)
    expect(asConvertedShares(4_000_000, 2, 2)).toBe(4_000_000)
  })

  it('rejects non-positive prices', () => {
    expect(() => conversionRatio(0, 1)).toThrow(RangeError)
    expect(() => conversionRatio(1, 0)).toThrow(RangeError)
  })
})

describe('broad-based weighted average — the Springmeyer example, number-for-number', () => {
  it('"$2.00 * (12,000,000 + (5,000,000/2.00))/(12,000,000 + 5,000,000) ... $2 *(14.5 million/17 million) or $1.7059"', () => {
    expect(BROAD_BASE).toBe(12_000_000)
    expect(weightedAverageConversionPrice(2, BROAD_BASE, DOWN_ROUND)).toBe(1.7059)
  })

  it('"convert their $8 million worth at $1.7059 to roughly 4.69 million shares"', () => {
    const r = applyAntiDilution(SERIES_A, DOWN_ROUND, 'broad-based', BROAD_BASE)
    expect(r.conversionPriceAfter).toBe(1.7059)
    expect(r.asConvertedAfter).toBe(4_689_606) // floor(4,000,000 × $2 / $1.7059)
    expect(Math.round(r.asConvertedAfter / 10_000) / 100).toBe(4.69) // the article's "roughly 4.69 million"
    expect(r.additionalCommonShares).toBe(689_606)
    expect(r.adjusted).toBe(true)
    expect(r.needsReview).toBe(true)
  })
})

describe('narrow-based weighted average — the Springmeyer example, number-for-number', () => {
  it('"$2.00 * (4,000,000 + (5,000,000/2.00))/(4,000,000 + 5,000,000) OR $2.00 * 6.5/9 OR $1.4444"', () => {
    // Narrow base = only the subject series' as-converted common (4,000,000) — the stated
    // denominator difference from broad-based.
    expect(weightedAverageConversionPrice(2, 4_000_000, DOWN_ROUND)).toBe(1.4444)
  })

  it('"Conversion would result in 5.54 million shares of Common Stock"', () => {
    const r = applyAntiDilution(SERIES_A, DOWN_ROUND, 'narrow-based')
    expect(r.conversionPriceAfter).toBe(1.4444)
    expect(r.asConvertedAfter).toBe(5_538_631) // floor($8,000,000 / $1.4444)
    expect(Math.round(r.asConvertedAfter / 10_000) / 100).toBe(5.54) // the article's printed precision
  })
})

describe('full ratchet', () => {
  it('Cooley GO example: 1,000 shares at $10; a $5 down round converts $10,000 into 2,000 shares', () => {
    const series: AdjustableSeries = { name: 'Investor', preferredShares: 1_000, originalIssuePrice: 10, conversionPriceBefore: 10 }
    const r = applyAntiDilution(series, { newShares: 100_000, considerationDollars: 500_000 }, 'full-ratchet')
    expect(r.conversionPriceAfter).toBe(5)
    expect(r.asConvertedAfter).toBe(2_000)
  })

  it('Springmeyer: "the Series A investor can now convert their $8 million to 8 million shares"', () => {
    const r = applyAntiDilution(SERIES_A, DOWN_ROUND, 'full-ratchet')
    expect(r.conversionPriceAfter).toBe(1)
    expect(r.asConvertedAfter).toBe(8_000_000)
  })
})

describe('no adjustment on an at-or-above-price issuance', () => {
  it("Springmeyer's up-round (5M shares at $4.00 = $20M) adjusts nothing", () => {
    const up: DilutiveIssuance = { newShares: 5_000_000, considerationDollars: 20_000_000 }
    expect(weightedAverageConversionPrice(2, BROAD_BASE, up)).toBe(2)
    expect(fullRatchetConversionPrice(2, up)).toBe(2)
    const r = applyAntiDilution(SERIES_A, up, 'broad-based', BROAD_BASE)
    expect(r.adjusted).toBe(false)
    expect(r.additionalCommonShares).toBe(0)
    expect(r.note).toContain('no adjustment')
  })

  it('an issuance exactly at the conversion price adjusts nothing', () => {
    const at: DilutiveIssuance = { newShares: 1_000_000, considerationDollars: 2_000_000 }
    expect(weightedAverageConversionPrice(2, BROAD_BASE, at)).toBe(2)
  })

  it('a barely-dilutive issuance can round back to CP1 at 4 decimals (adjusted stays false)', () => {
    // CP2 = $2.00 × (12,000,000 + 50)/(12,000,100) = $1.99999… → roundPrice → $2.0000.
    const tiny: DilutiveIssuance = { newShares: 100, considerationDollars: 100 } // $1.00/share, below CP1
    expect(weightedAverageConversionPrice(2, BROAD_BASE, tiny)).toBe(2)
    const r = applyAntiDilution(SERIES_A, tiny, 'broad-based', BROAD_BASE)
    expect(r.adjusted).toBe(false)
    expect(r.additionalCommonShares).toBe(0)
    expect(r.note).toContain('rounds away')
  })
})

describe('a positive adjusted price below the 4-decimal precision stays positive', () => {
  // Fictional deep-dilution issuance: 1,000,000,000 shares for $30,000 is $0.00003/share.
  // Rounding that to the module's 4 decimals would yield $0 and poison the conversion-ratio
  // math downstream ("prices must be > 0"); the sub-precision price is kept unrounded
  // instead (module header: charters often carry prices to more decimals).
  const micro: DilutiveIssuance = { newShares: 1_000_000_000, considerationDollars: 30_000 }

  it('full ratchet keeps the sub-precision price instead of rounding it to zero', () => {
    const cp2 = fullRatchetConversionPrice(2, micro)
    expect(cp2).toBeGreaterThan(0)
    expect(cp2).toBeCloseTo(0.00003, 10)
  })

  it('applyAntiDilution completes on a sub-precision price instead of throwing', () => {
    const r = applyAntiDilution(SERIES_A, micro, 'full-ratchet')
    expect(r.conversionPriceAfter).toBeGreaterThan(0)
    expect(r.conversionPriceAfter).toBeCloseTo(0.00003, 10)
    expect(r.adjusted).toBe(true)
    // floor(4,000,000 × $2.00 / $0.00003) = floor(266,666,666,666.67).
    expect(r.asConvertedAfter).toBe(266_666_666_666)
  })

  it('the weighted average keeps a sub-precision result positive too', () => {
    // CP1 $0.00004 (already sub-precision, legal: > 0), base 1,000,000, 9,000,000 new
    // shares for $90 ($0.00001/share): B = 90/0.00004 = 2,250,000, so
    // CP2 = 0.00004 × 3,250,000/10,000,000 = $0.000013 — positive, below 4 decimals.
    const cp2 = weightedAverageConversionPrice(0.00004, 1_000_000, { newShares: 9_000_000, considerationDollars: 90 })
    expect(cp2).toBeGreaterThan(0)
    expect(cp2).toBeCloseTo(0.000013, 10)
  })
})

describe('ordering invariants (property tests)', () => {
  const cases: { cp1: number; base: number; narrow: number; issuance: DilutiveIssuance }[] = [
    { cp1: 2, base: 12_000_000, narrow: 4_000_000, issuance: DOWN_ROUND },
    { cp1: 1.5, base: 20_000_000, narrow: 2_000_000, issuance: { newShares: 1_000_000, considerationDollars: 400_000 } },
    { cp1: 0.8, base: 9_000_000, narrow: 3_000_000, issuance: { newShares: 10_000_000, considerationDollars: 1_000_000 } },
    { cp1: 10, base: 1_000_000, narrow: 500_000, issuance: { newShares: 50_000, considerationDollars: 250_000 } },
  ]

  it('full ratchet <= narrow-based <= broad-based conversion price, all <= CP1 and > 0', () => {
    for (const c of cases) {
      const ratchet = fullRatchetConversionPrice(c.cp1, c.issuance)
      const narrow = weightedAverageConversionPrice(c.cp1, c.narrow, c.issuance)
      const broad = weightedAverageConversionPrice(c.cp1, c.base, c.issuance)
      expect(ratchet).toBeGreaterThan(0)
      expect(ratchet).toBeLessThanOrEqual(narrow)
      expect(narrow).toBeLessThanOrEqual(broad)
      expect(broad).toBeLessThanOrEqual(c.cp1)
    }
  })

  it('a lower conversion price never means fewer as-converted shares', () => {
    for (const c of cases) {
      const narrow = weightedAverageConversionPrice(c.cp1, c.narrow, c.issuance)
      const broad = weightedAverageConversionPrice(c.cp1, c.base, c.issuance)
      expect(asConvertedShares(1_000_000, c.cp1, narrow)).toBeGreaterThanOrEqual(asConvertedShares(1_000_000, c.cp1, broad))
    }
  })
})

describe('pay-to-play (explanation only — Fenwick; Holloway VC guide)', () => {
  it('non-participation converts preferred to common in the strongman form — preference and protection lost', () => {
    const c = payToPlayConsequence(false, 'convert-to-common')
    expect(c.kind).toBe('explanation')
    expect(c.consequence).toContain('converts to common')
    expect(c.consequence).toContain('lost')
    expect(c.needsReview).toBe(true)
    expect(c.citations.length).toBe(2)
  })

  it('shadow-preferred keeps the preference, strips the rights; participation keeps everything', () => {
    expect(payToPlayConsequence(false, 'shadow-preferred').consequence).toContain('shadow')
    expect(payToPlayConsequence(true, 'convert-to-common').consequence).toContain('retained')
  })
})

describe('waterfall interface (composition without modifying the waterfall module)', () => {
  it('hands the POST-adjustment as-converted count as shares, satisfying the 1:1 assumption', () => {
    const adj = applyAntiDilution(SERIES_A, DOWN_ROUND, 'broad-based', BROAD_BASE)
    const series = toWaterfallSeries(SERIES_A, adj)
    expect(series).toEqual({
      name: 'Series A',
      shares: 4_689_606,
      invested: 8_000_000,
      preferenceMultiple: undefined,
      participating: undefined,
    })
    // And the waterfall runs with it: at a high price the protected series converts and
    // takes its as-converted share of the residual.
    const report = liquidityWaterfall({ holders: [{ name: 'Founders+pool', shares: 8_000_000 }], preferred: series }, 100_000_000)
    const row = report.rows.find((r) => r.name === 'Series A')
    expect(row?.decision).toBe('convert')
    expect(row?.shares).toBe(4_689_606)
  })

  it('rejects a mismatched adjustment', () => {
    const adj = applyAntiDilution(SERIES_A, DOWN_ROUND, 'narrow-based')
    expect(() => toWaterfallSeries({ ...SERIES_A, name: 'Series B' }, adj)).toThrow(RangeError)
  })
})

describe('input validation', () => {
  it('rejects malformed issuances and bases', () => {
    expect(() => weightedAverageConversionPrice(2, 0, DOWN_ROUND)).toThrow(RangeError)
    expect(() => weightedAverageConversionPrice(2, 1_000, { newShares: 0, considerationDollars: 1 })).toThrow(RangeError)
    expect(() => weightedAverageConversionPrice(2, 1_000, { newShares: 1, considerationDollars: 0 })).toThrow(RangeError)
    expect(() => broadBase({ commonOutstanding: 0, preferredAsConverted: 0, optionsAsExercised: 0 })).toThrow(RangeError)
    expect(() => applyAntiDilution(SERIES_A, DOWN_ROUND, 'broad-based')).toThrow(/broadBaseShares/)
  })

  it('is deterministic', () => {
    expect(applyAntiDilution(SERIES_A, DOWN_ROUND, 'broad-based', BROAD_BASE)).toEqual(
      applyAntiDilution(SERIES_A, DOWN_ROUND, 'broad-based', BROAD_BASE),
    )
  })
})
