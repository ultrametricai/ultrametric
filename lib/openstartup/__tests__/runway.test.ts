// Textbook tests for the runway & burn module. The model is Paul Graham's default-alive test
// ("Default Alive or Default Dead?", Oct 2015, https://paulgraham.com/aord.html): hold
// expenses constant, compound revenue at its current growth rate, and ask whether the company
// reaches profitability on the cash it has. Every worked example's arithmetic is re-derived
// in comments so a reader can follow the numbers.

import { describe, expect, it } from 'vitest'
import {
  defaultAliveReport,
  growthAdjustedRunwayMonths,
  hiringImpact,
  simpleRunwayMonths,
  type HirePlan,
  type RunwayInputs,
} from '../runway'

// The running example: $10k MRR growing 10%/month against $30k/month of constant expenses.
// Revenue crosses expenses when 1.1^m >= 3: 1.1^11 = 2.853, 1.1^12 = 3.138 → month 12.
// Cumulative net burn through month 11 = 11×30,000 − 10,000×Σ(1.1^m, m=1..11)
//   Σ(1.1^m, m=1..11) = (1.1^12 − 1.1)/0.1 = (3.1384284 − 1.1)/0.1 = 20.3842838
//   = 330,000 − 203,842.84 = 126,157.16.
const BASE: RunwayInputs = { cash: 200_000, monthlyRevenue: 10_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: 10 }

describe('simpleRunwayMonths (the naive baseline)', () => {
  it('is cash / net burn', () => {
    // $100k at $20k/month net burn = 5 months.
    expect(simpleRunwayMonths(100_000, 20_000)).toBe(5)
  })

  it('is Infinity at zero or negative net burn (already profitable)', () => {
    expect(simpleRunwayMonths(100_000, 0)).toBe(Infinity)
    expect(simpleRunwayMonths(100_000, -5_000)).toBe(Infinity)
  })

  it('rejects negative cash', () => {
    expect(() => simpleRunwayMonths(-1, 1000)).toThrow(RangeError)
  })
})

describe('defaultAliveReport (the essay’s question, answered)', () => {
  it('default alive: $200k covers the $126,157.16 cumulative burn to month-12 profitability', () => {
    const r = defaultAliveReport(BASE)
    expect(r.status).toBe('default-alive')
    expect(r.monthsToProfitability).toBe(12)
    expect(r.monthsToZeroCash).toBeNull()
    // Cash trough at the last unprofitable month (11): 200,000 − 126,157.16 = 73,842.84.
    expect(r.minCash).toBe(73_842.84)
    // The projection stops once the question is decided: 12 months, no more.
    expect(r.trajectory).toHaveLength(12)
    // Month 12 itself is cash-positive: revenue 10,000×1.1^12 = 31,384.28 > 30,000.
    const m12 = r.trajectory[11]
    expect(m12.revenue).toBe(31_384.28)
    expect(m12.netBurn).toBe(-1_384.28)
  })

  it('default dead: the same company on $100k runs out at month 7, before month-12 profitability', () => {
    // Cumulative burn: m6 = 95,128.29 (< 100k), m7 = 105,641.12 (> 100k).
    const r = defaultAliveReport({ ...BASE, cash: 100_000 })
    expect(r.status).toBe('default-dead')
    expect(r.monthsToZeroCash).toBe(7)
    // Profitability month is still reported — it tells the founder the size of the gap.
    expect(r.monthsToProfitability).toBe(12)
    expect(r.trajectory[6].endingCash).toBe(-5_641.12) // 100,000 − 105,641.12
  })

  it('zero growth and positive burn is default dead with the naive runway arithmetic', () => {
    // $100k at flat $20k/month: cash hits exactly 0 at month 5, goes below at month 6.
    const r = defaultAliveReport({ cash: 100_000, monthlyRevenue: 10_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: 0 })
    expect(r.status).toBe('default-dead')
    expect(r.monthsToProfitability).toBeNull()
    expect(r.monthsToZeroCash).toBe(6)
    expect(r.trajectory[4].endingCash).toBe(0)
  })

  it('growing expenses delay profitability: 10% revenue growth vs 2% expense growth', () => {
    // Profitability when 10,000×1.1^m >= 30,000×1.02^m ⇔ (1.1/1.02)^m >= 3
    // (1.0784)^m >= 3 → m >= ln3/ln1.0784 = 14.55 → month 15.
    const r = defaultAliveReport({ ...BASE, cash: 500_000, expenseGrowthPctMoM: 2 })
    expect(r.monthsToProfitability).toBe(15)
    expect(r.status).toBe('default-alive')
  })

  it('is indeterminate only when the horizon decides nothing', () => {
    // No revenue, tiny flat burn, deep cash: 24×10 = 240 < 1,000, and profitability never
    // arrives — neither event fires inside the horizon.
    const r = defaultAliveReport({ cash: 1_000, monthlyRevenue: 0, monthlyExpenses: 10, revenueGrowthPctMoM: 0 }, { horizonMonths: 24 })
    expect(r.status).toBe('indeterminate')
    expect(r.monthsToProfitability).toBeNull()
    expect(r.monthsToZeroCash).toBeNull()
  })

  it('handles declining revenue (negative growth above the −100 floor)', () => {
    // $10k revenue shrinking 10%/month against $20k flat expenses: revenue m1..m4 =
    // 9,000 + 8,100 + 7,290 + 6,561 = 30,951, so cumulative burn at m4 = 80,000 − 30,951
    // = 49,049 (< 50,000); m5 adds 20,000 − 5,904.90 = 14,095.10 → 63,144.10 > 50,000.
    const r = defaultAliveReport({ cash: 50_000, monthlyRevenue: 10_000, monthlyExpenses: 20_000, revenueGrowthPctMoM: -10 })
    expect(r.status).toBe('default-dead')
    expect(r.monthsToZeroCash).toBe(5)
    expect(r.monthsToProfitability).toBeNull()
  })

  it('profitability that does not last: shrinking revenue turns profitable then runs out at month 6', () => {
    // $10k cash, $40k revenue shrinking 10%/month (40,000×0.9^m), $30k flat expenses.
    //   m1: 36,000.00 − 30,000 = +6,000.00 → 16,000.00 (profitable)
    //   m2: 32,400.00 − 30,000 = +2,400.00 → 18,400.00 (profitable)
    //   m3: 29,160.00 − 30,000 = −840.00   → 17,560.00 (unprofitable from here)
    //   m4: 26,244.00 − 30,000 = −3,756.00 → 13,804.00
    //   m5: 23,619.60 − 30,000 = −6,380.40 →  7,423.60
    //   m6: 21,257.64 − 30,000 = −8,742.36 → −1,318.76 (cash below zero)
    const input: RunwayInputs = { cash: 10_000, monthlyRevenue: 40_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: -10 }
    const r = defaultAliveReport(input)
    expect(r.monthsToProfitability).toBe(1)
    expect(r.monthsToZeroCash).toBe(6)
    expect(r.status).toBe('default-dead')
    expect(r.trajectory[5].endingCash).toBe(-1_318.76)
    expect(growthAdjustedRunwayMonths(input)).toBe(6)
  })

  it('profitability that does not last: expenses growing 10%/month outrun flat revenue by month 6', () => {
    // $10k cash, $40k flat revenue, $30k expenses growing 10%/month (30,000×1.1^m).
    //   m1: 40,000 − 33,000.00 = +7,000.00  → 17,000.00 (profitable)
    //   m2: 40,000 − 36,300.00 = +3,700.00  → 20,700.00
    //   m3: 40,000 − 39,930.00 = +70.00     → 20,770.00
    //   m4: 40,000 − 43,923.00 = −3,923.00  → 16,847.00 (unprofitable from here)
    //   m5: 40,000 − 48,315.30 = −8,315.30  →  8,531.70
    //   m6: 40,000 − 53,146.83 = −13,146.83 → −4,615.13 (cash below zero)
    const r = defaultAliveReport({ cash: 10_000, monthlyRevenue: 40_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: 0, expenseGrowthPctMoM: 10 })
    expect(r.monthsToProfitability).toBe(1)
    expect(r.monthsToZeroCash).toBe(6)
    expect(r.status).toBe('default-dead')
    expect(r.trajectory[5].endingCash).toBe(-4_615.13)
  })

  it('profitable, then unprofitable, with cash still positive at the horizon is default alive', () => {
    // The shrinking-revenue company above, projected 5 months: profitable in m1–m2,
    // unprofitable from m3, cash 16,000 → 18,400 → 17,560 → 13,804 → 7,423.60. Cash never
    // goes below zero inside the horizon, so the report is default alive; the trough is the
    // m5 balance of 7,423.60.
    const r = defaultAliveReport({ cash: 10_000, monthlyRevenue: 40_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: -10 }, { horizonMonths: 5 })
    expect(r.status).toBe('default-alive')
    expect(r.monthsToProfitability).toBe(1)
    expect(r.monthsToZeroCash).toBeNull()
    expect(r.minCash).toBe(7_423.6)
    expect(r.trajectory).toHaveLength(5)
  })

  it('rejects invalid inputs and horizons', () => {
    expect(() => defaultAliveReport({ ...BASE, cash: -1 })).toThrow(RangeError)
    expect(() => defaultAliveReport({ ...BASE, revenueGrowthPctMoM: -100 })).toThrow(RangeError)
    expect(() => defaultAliveReport(BASE, { horizonMonths: 0 })).toThrow(RangeError)
  })

  it('is deterministic: identical inputs produce identical reports', () => {
    expect(defaultAliveReport(BASE)).toEqual(defaultAliveReport(BASE))
  })

  it('property: ending cash always equals starting cash minus cumulative net burn', () => {
    for (const growth of [0, 5, 10, 25]) {
      for (const cash of [50_000, 200_000, 1_000_000]) {
        const r = defaultAliveReport({ cash, monthlyRevenue: 8_000, monthlyExpenses: 40_000, revenueGrowthPctMoM: growth }, { horizonMonths: 36 })
        let cumulative = 0
        for (const row of r.trajectory) {
          cumulative += row.netBurn
          expect(row.endingCash).toBeCloseTo(cash - cumulative, 0)
        }
        // Status is consistent with the recorded events.
        if (r.status === 'default-alive') {
          expect(r.monthsToProfitability).not.toBeNull()
          expect(r.minCash).toBeGreaterThanOrEqual(0)
        }
        if (r.status === 'default-dead') expect(r.monthsToZeroCash).not.toBeNull()
      }
    }
  })
})

describe('growthAdjustedRunwayMonths', () => {
  it('reports the real zero-cash month, not cash/burn', () => {
    // Naive: 100,000 / 20,000 = 5 months. Growth-adjusted: burn shrinks as revenue
    // compounds, so cash lasts through month 6 (cumulative burn 95,128.29 at m6).
    expect(simpleRunwayMonths(100_000, 20_000)).toBe(5)
    expect(growthAdjustedRunwayMonths({ ...BASE, cash: 100_000 })).toBe(7)
  })

  it('is null when the company never runs out (default alive)', () => {
    expect(growthAdjustedRunwayMonths(BASE)).toBeNull()
  })
})

describe('hiringImpact (the essay’s overhiring warning, made concrete)', () => {
  it('a $15k/month hire from month 1 flips the default-alive base case to default dead', () => {
    // With the hire, expenses are 45,000 flat. Profitability now needs 1.1^m >= 4.5:
    // 1.1^15 = 4.177, 1.1^16 = 4.595 → month 16. Cumulative burn through month 15 =
    // 15×45,000 − 10,000×(1.1^16 − 1.1)/0.1 = 675,000 − 349,497.30 = 325,502.70 > 200,000.
    // Cash crosses zero at month 7 (cumulative 210,641.12 > 200,000; m6 = 185,128.29).
    const impact = hiringImpact(BASE, [{ monthlyCost: 15_000, startMonth: 1 }])
    expect(impact.base.status).toBe('default-alive')
    expect(impact.withHires.status).toBe('default-dead')
    expect(impact.becomesDefaultDead).toBe(true)
    expect(impact.withHires.monthsToProfitability).toBe(16)
    expect(impact.withHires.monthsToZeroCash).toBe(7)
    // Both sides never-ran-out is required for a numeric delta; here base never runs out.
    expect(impact.runwayDeltaMonths).toBeNull()
  })

  it('later or cheaper hires can be absorbed', () => {
    // A $5k/month hire from month 6: expenses 35,000 from m6. Profitability needs
    // 1.1^m >= 3.5 → 1.1^13 = 3.452, 1.1^14 = 3.797 → month 14; the trough stays positive.
    const impact = hiringImpact(BASE, [{ monthlyCost: 5_000, startMonth: 6 }])
    expect(impact.withHires.status).toBe('default-alive')
    expect(impact.withHires.monthsToProfitability).toBe(14)
    expect(impact.becomesDefaultDead).toBe(false)
  })

  it('count multiplies the cost', () => {
    const two = hiringImpact(BASE, [{ monthlyCost: 7_500, startMonth: 1, count: 2 }])
    const one = hiringImpact(BASE, [{ monthlyCost: 15_000, startMonth: 1 }])
    expect(two.withHires).toEqual(one.withHires)
  })

  it('reports a numeric runway delta when both plans run out of cash', () => {
    // Base on $100k dies at month 7 (cumulative burn 105,641.12). A $10k/month hire from
    // month 1 makes expenses 40,000 flat: cumulative burn m3 = 120,000 − 36,410 = 83,590,
    // m4 = 160,000 − 51,051 = 108,949 → zero cash at month 4. Delta = 4 − 7 = −3.
    const impact = hiringImpact({ ...BASE, cash: 100_000 }, [{ monthlyCost: 10_000, startMonth: 1 }])
    expect(impact.base.monthsToZeroCash).toBe(7)
    expect(impact.withHires.monthsToZeroCash).toBe(4)
    expect(impact.runwayDeltaMonths).toBe(-3)
    expect(impact.becomesDefaultDead).toBe(false) // the base plan was already default dead
  })

  it('hires starting after the first profitable month still count', () => {
    // Base: $10k cash, $40k flat revenue, $30k flat expenses → +10,000/month, default alive.
    // Three $15k/month hires from month 2: m1 is unchanged (cash 10,000 + 10,000 = 20,000);
    // from m2 expenses are 30,000 + 3×15,000 = 75,000, net burn 35,000 →
    // 20,000 − 35,000 = −15,000 at month 2.
    const impact = hiringImpact({ cash: 10_000, monthlyRevenue: 40_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: 0 }, [
      { monthlyCost: 15_000, startMonth: 2, count: 3 },
    ])
    expect(impact.base.status).toBe('default-alive')
    expect(impact.withHires.monthsToZeroCash).toBe(2)
    expect(impact.withHires.trajectory[1].endingCash).toBe(-15_000)
    expect(impact.withHires.status).toBe('default-dead')
    expect(impact.becomesDefaultDead).toBe(true)
  })

  it('rejects malformed plans', () => {
    expect(() => hiringImpact(BASE, [{ monthlyCost: 0, startMonth: 1 }])).toThrow(RangeError)
    expect(() => hiringImpact(BASE, [{ monthlyCost: 1000, startMonth: 0 }])).toThrow(RangeError)
    expect(() => hiringImpact(BASE, [{ monthlyCost: 1000, startMonth: 1, count: 0 }])).toThrow(RangeError)
  })
})

describe('properties over randomized scenarios', () => {
  // Deterministic LCG so failures are reproducible (same generator as capTable.test.ts).
  function lcg(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 2 ** 32
    }
  }
  const HORIZON = 60
  const STATUS_RANK = { 'default-dead': 0, indeterminate: 1, 'default-alive': 2 } as const

  // Reference projection over the full horizon with no early exit: the first month whose
  // ending cash is below zero, or null. Same arithmetic as the model conventions.
  function referenceZeroCashMonth(input: RunwayInputs, extra: (m: number) => number): number | null {
    let cash = input.cash
    for (let m = 1; m <= HORIZON; m++) {
      const revenue = input.monthlyRevenue * (1 + input.revenueGrowthPctMoM / 100) ** m
      const expenses = input.monthlyExpenses * (1 + (input.expenseGrowthPctMoM ?? 0) / 100) ** m + extra(m)
      cash -= expenses - revenue
      if (cash < 0) return m
    }
    return null
  }

  function scenario(seed: number): { input: RunwayInputs; hires: HirePlan[] } {
    const rng = lcg(seed * 2654435761)
    const input: RunwayInputs = {
      cash: Math.round(rng() * 500_000),
      monthlyRevenue: Math.round(rng() * 100_000),
      monthlyExpenses: Math.round(rng() * 100_000),
      revenueGrowthPctMoM: Math.round(rng() * 50 - 20), // −20..30
      expenseGrowthPctMoM: Math.round(rng() * 30 - 10), // −10..20
    }
    const hires: HirePlan[] = []
    const n = Math.floor(rng() * 4) // 0..3 hire lines
    for (let i = 0; i < n; i++) {
      hires.push({ monthlyCost: 1_000 + Math.round(rng() * 29_000), startMonth: 1 + Math.floor(rng() * 36), count: 1 + Math.floor(rng() * 3) })
    }
    return { input, hires }
  }

  const hireCost = (hires: HirePlan[]) => (m: number) =>
    hires.reduce((s, h) => s + (m >= h.startMonth ? h.monthlyCost * (h.count ?? 1) : 0), 0)

  it('the zero-cash month matches a full-horizon projection, and default alive never goes below zero (200 seeded cases)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { input, hires } = scenario(seed)
      for (const [report, extra] of [
        [defaultAliveReport(input, { horizonMonths: HORIZON }), () => 0],
        [hiringImpact(input, hires, { horizonMonths: HORIZON }).withHires, hireCost(hires)],
      ] as const) {
        expect(report.monthsToZeroCash, `seed ${seed}`).toBe(referenceZeroCashMonth(input, extra))
        if (report.status === 'default-alive') {
          expect(report.monthsToZeroCash, `seed ${seed}`).toBeNull()
          for (const row of report.trajectory) expect(row.endingCash, `seed ${seed} m${row.month}`).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('adding hires never delays the zero-cash month or improves the status (200 seeded cases)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { input, hires } = scenario(seed)
      const { base, withHires } = hiringImpact(input, hires, { horizonMonths: HORIZON })
      // null = cash never runs out inside the horizon, i.e. later than any month.
      const zero = (m: number | null) => m ?? Infinity
      expect(zero(withHires.monthsToZeroCash), `seed ${seed}`).toBeLessThanOrEqual(zero(base.monthsToZeroCash))
      expect(STATUS_RANK[withHires.status], `seed ${seed}`).toBeLessThanOrEqual(STATUS_RANK[base.status])
    }
  })
})
