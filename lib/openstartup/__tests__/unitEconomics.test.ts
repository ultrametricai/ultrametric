// Unit economics — every published worked example from the cited sources replayed
// number-for-number (Skok's lifetime figures, Sacks' 2x/5x burn multiples, Feld's three
// Rule-of-40 scenarios), the remaining arithmetic hand-derived in comments, and the house
// posture property-tested: benchmarks are inputs, never encoded.

import { describe, expect, it } from 'vitest'
import {
  annualizedNetChurnPct, burnMultiple, cac, cacPaybackMonths, compareToBenchmark,
  customerLifetimePeriods, ltv, ltvSimple, ltvToCacRatio, magicNumber, netMrrChurnRatePct,
  netNewMrr, ruleOf40,
} from '../unitEconomics'

describe('customer lifetime (Skok definitions)', () => {
  it('replays the source figures: 3% monthly → ~33 months, 20% annual → 5 years', () => {
    // "If monthly churn is 3%, lifetime = 33 months" — the source's display rounding of
    // 100/3 = 33.33; "if annual churn is 20%, lifetime = 5 years" — exact.
    expect(Math.round(customerLifetimePeriods(3))).toBe(33)
    expect(customerLifetimePeriods(3)).toBeCloseTo(33.3333, 4)
    expect(customerLifetimePeriods(20)).toBe(5)
  })

  it('guards the churn domain', () => {
    expect(() => customerLifetimePeriods(0)).toThrow(RangeError)
    expect(() => customerLifetimePeriods(-1)).toThrow(RangeError)
    expect(() => customerLifetimePeriods(101)).toThrow(RangeError)
    expect(customerLifetimePeriods(100)).toBe(1) // everyone churns within the period
  })
})

describe('LTV and CAC (Skok definitions)', () => {
  it('ltvSimple = ARPA ÷ churn: $500 ARPA at 2% monthly → $25,000 (hand-derived: 500 × 50)', () => {
    expect(ltvSimple(500, 2)).toBe(25_000)
  })

  it('ltv applies gross margin: $500 ARPA, 80% GM, 2% monthly → $20,000 (500 × 0.8 × 50)', () => {
    expect(ltv({ arpa: 500, grossMarginPct: 80, churnRatePct: 2 })).toBe(20_000)
    // 100% GM collapses to the simple formula
    expect(ltv({ arpa: 500, grossMarginPct: 100, churnRatePct: 2 })).toBe(ltvSimple(500, 2))
  })

  it('ltv guards the gross-margin domain', () => {
    expect(() => ltv({ arpa: 500, grossMarginPct: 101, churnRatePct: 2 })).toThrow(RangeError)
    expect(() => ltv({ arpa: 500, grossMarginPct: -1, churnRatePct: 2 })).toThrow(RangeError)
    expect(ltv({ arpa: 500, grossMarginPct: 0, churnRatePct: 2 })).toBe(0)
  })

  it('cac = S&M ÷ new customers: $120,000 for 30 customers → $4,000', () => {
    expect(cac(120_000, 30)).toBe(4_000)
    expect(() => cac(120_000, 0)).toThrow(RangeError)
  })

  it('ltvToCac: $20,000 LTV on $4,000 CAC → 5.0 — the >3 guideline stays an input', () => {
    const ratio = ltvToCacRatio(20_000, 4_000)
    expect(ratio).toBe(5)
    const cmp = compareToBenchmark(ratio, {
      source: 'Skok, SaaS Metrics 2.0 (LTV:CAC > 3)', threshold: 3, healthyWhen: 'at-or-above', label: 'LTV:CAC',
    })
    expect(cmp.meets).toBe(true)
    expect(cmp.needsReview).toBe(true)
  })

  it('cacPaybackMonths = CAC ÷ (monthly ARPA × GM): $4,000 ÷ ($500 × 0.8) = 10 months', () => {
    expect(cacPaybackMonths({ cac: 4_000, monthlyArpa: 500, grossMarginPct: 80 })).toBe(10)
  })
})

describe('MRR movement (Skok definitions)', () => {
  it('netNewMrr = new + expansion − churned: 10k + 2k − 3k = 9k; can go negative', () => {
    expect(netNewMrr({ newMrr: 10_000, expansionMrr: 2_000, churnedMrr: 3_000 })).toBe(9_000)
    expect(netNewMrr({ newMrr: 1_000, expansionMrr: 0, churnedMrr: 3_000 })).toBe(-2_000)
  })

  it('netMrrChurnRatePct = (churned − expansion) ÷ beginning: (3k − 2k)/100k = 1%; negative churn works', () => {
    expect(netMrrChurnRatePct({ churnedMrr: 3_000, expansionMrr: 2_000, beginningMrr: 100_000 })).toBe(1)
    expect(netMrrChurnRatePct({ churnedMrr: 1_000, expansionMrr: 4_000, beginningMrr: 100_000 })).toBe(-3)
  })

  it('replays Skok’s “2% per month ≈ 22% per year” (exactly 21.53%)', () => {
    expect(annualizedNetChurnPct(2)).toBeCloseTo(21.53, 2)
    // and the compounding identity holds for expansion (negative) rates
    expect(annualizedNetChurnPct(-1)).toBeCloseTo((1 - 1.01 ** 12) * 100, 10)
    expect(annualizedNetChurnPct(0)).toBe(0)
  })

  it('annualizedNetChurnPct rejects rates above 100% and is exact at total churn', () => {
    expect(() => annualizedNetChurnPct(101)).toThrow(RangeError)
    expect(annualizedNetChurnPct(100)).toBe(100) // losing everything in month 1 is the whole year
  })
})

describe('burn multiple (Sacks, The Burn Multiple, 2020-04-23)', () => {
  it('replays the post’s worked examples: $2M/$1M = 2x, $5M/$1M = 5x', () => {
    expect(burnMultiple({ netBurn: 2_000_000, netNewArr: 1_000_000 }).multiple).toBe(2)
    expect(burnMultiple({ netBurn: 5_000_000, netNewArr: 1_000_000 }).multiple).toBe(5)
  })

  it('refuses to invent a number when net new ARR ≤ 0 (the post’s stated caveat)', () => {
    for (const netNewArr of [0, -500_000]) {
      const r = burnMultiple({ netBurn: 1_000_000, netNewArr })
      expect(r.computable).toBe(false)
      expect(r.multiple).toBeNull()
    }
  })

  it('cash-generating companies report ≤ 0 — burn has ended, stated not hidden', () => {
    expect(burnMultiple({ netBurn: -100_000, netNewArr: 1_000_000 }).multiple).toBe(-0.1)
  })

  it('every report is needsReview and encodes no bands', () => {
    const r = burnMultiple({ netBurn: 2, netNewArr: 1 })
    expect(r.needsReview).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/amazing|great|good|suspect|bad/i)
  })
})

describe('Rule of 40 (Feld, 2015-02-03)', () => {
  it('replays the post’s three scenarios: 20+20, 40+0, 50−10 all meet the rule', () => {
    for (const [g, p] of [[20, 20], [40, 0], [50, -10]] as const) {
      const r = ruleOf40({ revenueGrowthPct: g, profitMarginPct: p })
      expect(r.score).toBe(40)
      expect(r.meetsRule).toBe(true)
      expect(r.needsReview).toBe(true)
    }
  })

  it('misses below 40 and the score is a plain sum (no reweighting invented)', () => {
    const r = ruleOf40({ revenueGrowthPct: 30, profitMarginPct: 5 })
    expect(r.score).toBe(35)
    expect(r.meetsRule).toBe(false)
  })

  it('burnMultiple and ruleOf40 refuse non-finite inputs', () => {
    expect(() => burnMultiple({ netBurn: NaN, netNewArr: 1 })).toThrow(RangeError)
    expect(() => ruleOf40({ revenueGrowthPct: Infinity, profitMarginPct: 0 })).toThrow(RangeError)
  })
})

describe('magic number (O’Driscoll, Magic Number Math, 2010-04-20)', () => {
  it('(ΔQ revenue × 4) ÷ prior-quarter S&M: ($700k − $600k) × 4 ÷ $400k = 1.0 (hand-derived)', () => {
    expect(
      magicNumber({ currentQuarterRevenue: 700_000, priorQuarterRevenue: 600_000, priorQuarterSalesMarketingSpend: 400_000 }),
    ).toBe(1)
  })

  it('shrinking revenue goes negative as-is; zero prior spend refuses', () => {
    expect(
      magicNumber({ currentQuarterRevenue: 500_000, priorQuarterRevenue: 600_000, priorQuarterSalesMarketingSpend: 400_000 }),
    ).toBe(-1)
    expect(() =>
      magicNumber({ currentQuarterRevenue: 1, priorQuarterRevenue: 1, priorQuarterSalesMarketingSpend: 0 }),
    ).toThrow(RangeError)
  })
})

describe('benchmarks are inputs, never encoded (house posture, founder 2026-10-02)', () => {
  it('compareToBenchmark honors both directions and always needsReview', () => {
    const above = compareToBenchmark(1.2, { source: 'O’Driscoll 2010 (>1.0x)', threshold: 1, healthyWhen: 'at-or-above' })
    expect(above.meets).toBe(true)
    const below = compareToBenchmark(2, { source: 'Sacks 2020 table', threshold: 1.5, healthyWhen: 'at-or-below', label: 'burn multiple' })
    expect(below.meets).toBe(false)
    expect(above.needsReview && below.needsReview).toBe(true)
  })

  it('an unsourced benchmark is refused', () => {
    expect(() => compareToBenchmark(1, { source: '  ', threshold: 1, healthyWhen: 'at-or-above' })).toThrow(RangeError)
  })
})
