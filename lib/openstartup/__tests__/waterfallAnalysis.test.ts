// Tests for the waterfall analysis engine (waterfallAnalysis, waterfallBreakpoints,
// waterfallSweep, conversionEquilibrium). Published worked examples replayed number-for-number
// at the sources' own rounding:
// - Equidam, "Liquidation preference" (https://www.equidam.com/liquidation-preference/,
//   section "Exit waterfall examples at five exit values", data as of 18 October 2026):
//   four term structures at $8M / $15M / $30M / $60M / $150M, in $M to two decimals.
// - Hustle Fund, "Waterfall modeling for startup exits: A step-by-step guide"
//   (https://www.hustlefund.vc/post/exit-waterfall-modeling): senior capped participating
//   Series A over a junior non-participating Seed, five exits and five stated breakpoints.
// - Frank Kiepura, "Valuing Securities Using the Option Pricing Method", The CPA Journal,
//   September 2020 (https://www.cpajournal.com/2020/09/09/valuing-securities-using-the-option-pricing-method/),
//   Exhibits 1-3: the "Cotopaxi Tech" breakpoints and per-range participation percentages.
// - CRV, "Liquidation Preference: How It Works and How to Negotiate It"
//   (https://www.crv.com/content/liquidation-preference): the $5M-for-20% running example and
//   the "$20 million investment at six percent reaches roughly $23.6 million after three years".
// - YC Post-Money Safe User Guide Appendix II Example 1 Q3/Q4 (via the legacy engine).
// Carve-out, escrow, gross/net exercise and note interest have no reachable published worked
// example; their tests are hand-derived in comments and labeled so.
// Invariants (seeded random structures): rows sum to the equity value, no negative payouts,
// seniority respected, breakpoints monotonic, per-class payouts continuous and non-decreasing,
// and the breakpoint schedule agrees with the independent equilibrium solver.

import { describe, expect, it } from 'vitest'
import {
  accruedSeriesDividends,
  allocateAtEquityValue,
  conversionEquilibrium,
  liquidityWaterfall,
  waterfallAnalysis,
  waterfallBreakpoints,
  waterfallSweep,
  type AnalysisSeries,
  type WaterfallAnalysisInputs,
} from '../waterfall'

const M = 1_000_000
const classTotal = (r: ReturnType<typeof waterfallAnalysis>, c: string) => r.classes.find((x) => x.class === c)?.total ?? NaN
const inM = (x: number) => Math.round((x / M) * 100) / 100

// ---------------------------------------------------------------------------
// Equidam
// ---------------------------------------------------------------------------

// Common 5,500,000 (founders and pool); Seed 2,000,000 at $1.00 ($2M); Series A 2,500,000 at
// $4.00 ($10M). Conversion 1:1, pari passu shortfalls pro rata to preference amounts.
function equidam(seed: Partial<AnalysisSeries>, a: Partial<AnalysisSeries>): WaterfallAnalysisInputs {
  return {
    common: [{ name: 'Common', shares: 5_500_000 }],
    series: [
      { name: 'Seed', shares: 2_000_000, originalIssuePrice: 1, ...seed },
      { name: 'Series A', shares: 2_500_000, originalIssuePrice: 4, ...a },
    ],
  }
}
const EXITS = [8, 15, 30, 60, 150]
function replay(inputs: WaterfallAnalysisInputs, table: [number, number, number][]) {
  EXITS.forEach((exit, i) => {
    const r = waterfallAnalysis(inputs, exit * M)
    expect([inM(classTotal(r, 'Common')), inM(classTotal(r, 'Seed')), inM(classTotal(r, 'Series A'))], `exit $${exit}M`).toEqual(table[i])
  })
}

describe('Equidam "Exit waterfall examples at five exit values"', () => {
  it('1x non-participating, pari passu', () => {
    replay(equidam({}, {}), [
      [0, 1.33, 6.67],
      [3, 2, 10],
      [14.67, 5.33, 10],
      [33, 12, 15],
      [82.5, 30, 37.5],
    ])
  })

  it('stated break-evens: Seed converts above $17.5M, Series A above $40M', () => {
    const s = waterfallBreakpoints(equidam({}, {}))
    const join = (n: string) => s.securities.find((x) => x.name === n)?.joinsAtEquityValue
    expect(join('Seed')).toBeCloseTo(17.5 * M, 2)
    expect(join('Series A')).toBeCloseTo(40 * M, 2)
  })

  it('1x participating', () => {
    replay(equidam({ participation: 'participating' }, { participation: 'participating' }), [
      [0, 1.33, 6.67],
      [1.65, 2.6, 10.75],
      [9.9, 5.6, 14.5],
      [26.4, 11.6, 22],
      [75.9, 29.6, 44.5],
    ])
  })

  it('1x participating with a 3x total cap: "Seed hit its $6M cap at a $32M exit and converted above $40M"; "Series A hit its $30M cap at $90M and converted above $120M"', () => {
    const inputs = equidam(
      { participation: 'capped', participationCapMultiple: 3 },
      { participation: 'capped', participationCapMultiple: 3 },
    )
    replay(inputs, [
      [0, 1.33, 6.67],
      [1.65, 2.6, 10.75],
      [9.9, 5.6, 14.5],
      [27.5, 10, 22.5],
      [82.5, 30, 37.5],
    ])
    const s = waterfallBreakpoints(inputs)
    const sec = (n: string) => s.securities.find((x) => x.name === n)
    expect(sec('Seed')?.capReachedAtEquityValue).toBeCloseTo(32 * M, 2)
    expect(sec('Seed')?.joinsAtEquityValue).toBeCloseTo(40 * M, 2)
    expect(sec('Series A')?.capReachedAtEquityValue).toBeCloseTo(90 * M, 2)
    expect(sec('Series A')?.joinsAtEquityValue).toBeCloseTo(120 * M, 2)
  })

  it('Series A 2x non-participating senior, Seed 1x junior: common nothing until $22M, A converts above $80M', () => {
    const inputs = equidam({ seniority: 2 }, { seniority: 1, preferenceMultiple: 2 })
    replay(inputs, [
      [0, 0, 8],
      [0, 0, 15],
      [7.33, 2.67, 20],
      [29.33, 10.67, 20],
      [82.5, 30, 37.5],
    ])
    const s = waterfallBreakpoints(inputs)
    expect(s.tranches.find((t) => t.phase === 'residual')?.fromEquityValue).toBeCloseTo(22 * M, 2)
    expect(s.securities.find((x) => x.name === 'Series A')?.joinsAtEquityValue).toBeCloseTo(80 * M, 2)
  })

  it('1x senior variant: "at $8M, Series A takes all $8M ... and Seed gets nothing"', () => {
    const r = waterfallAnalysis(equidam({ seniority: 2 }, { seniority: 1 }), 8 * M)
    expect(classTotal(r, 'Series A')).toBe(8 * M)
    expect(classTotal(r, 'Seed')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Hustle Fund
// ---------------------------------------------------------------------------

// Founders 5.4M common, employees 0.6M common-equivalents; Seed 2M preferred for $2M (1x
// non-participating, junior); Series A 2M preferred for $6M, senior, 1x participating with a
// 2x cap on its total payout ($12M). All convert 1:1.
const HUSTLE: WaterfallAnalysisInputs = {
  common: [
    { name: 'Founders', shares: 5_400_000 },
    { name: 'Employees', shares: 600_000 },
  ],
  series: [
    { name: 'Seed', shares: 2_000_000, originalIssuePrice: 1, seniority: 2, holders: [{ name: 'Angel', shares: 100_000 }, { name: 'Seed fund', shares: 1_900_000 }] },
    { name: 'Series A', shares: 2_000_000, originalIssuePrice: 3, seniority: 1, participation: 'capped', participationCapMultiple: 2 },
  ],
}

describe('Hustle Fund "Waterfall modeling for startup exits"', () => {
  const table: [number, number, number, number, number][] = [
    // exit, Series A, Seed, founders, employees
    [5, 5, 0, 0, 0],
    [10, 6.5, 2, 1.35, 0.15],
    [20, 8.8, 2.8, 7.56, 0.84],
    [45, 12, 8.25, 22.275, 2.475],
    [100, 20, 20, 54, 6],
  ]
  it.each(table)('exit $%dM: A %d, Seed %d, founders %d, employees %d', (exit, a, seed, founders, employees) => {
    const r = waterfallAnalysis(HUSTLE, exit * M)
    const row = (h: string) => r.rows.find((x) => x.holder === h)?.total ?? NaN
    expect(classTotal(r, 'Series A') / M).toBeCloseTo(a, 6)
    expect(classTotal(r, 'Seed') / M).toBeCloseTo(seed, 6)
    expect(row('Founders') / M).toBeCloseTo(founders, 6)
    expect(row('Employees') / M).toBeCloseTo(employees, 6)
  })

  it('the angel holding 5% of Seed: $0 / $100,000 / $140,000 / $412,500 / $1,000,000', () => {
    const got = table.map(([exit]) => waterfallAnalysis(HUSTLE, exit * M).rows.find((x) => x.holder === 'Angel')?.total)
    expect(got).toEqual([0, 100_000, 140_000, 412_500, 1_000_000])
  })

  it('stated breakpoints: $6M, $8M, $16M, $36M, $60M', () => {
    const bps = waterfallBreakpoints(HUSTLE).breakpoints.map((b) => Math.round(b.equityValue))
    expect(bps).toEqual([6 * M, 8 * M, 16 * M, 36 * M, 60 * M])
  })

  it('decisions at $45M: Series A capped, Seed converted', () => {
    const r = waterfallAnalysis(HUSTLE, 45 * M)
    expect(r.rows.find((x) => x.security === 'Series A')?.decision).toBe('capped')
    expect(r.rows.find((x) => x.security === 'Seed')?.decision).toBe('convert')
    expect(waterfallAnalysis(HUSTLE, 100 * M).rows.find((x) => x.security === 'Series A')?.decision).toBe('convert')
  })
})

// ---------------------------------------------------------------------------
// CPA Journal OPM example (Cotopaxi Tech): breakpoints and participation by range
// ---------------------------------------------------------------------------

// Exhibit 1: Series B $7.5M preference ($1.50, 5,000,000 shares), participating after its
// preference ("converts to common upon the receipt of their initial investment"); Series A
// cumulative dividend $6,000,000 "payable prior to the liquidation preference or conversion";
// Series A $19.5M ($1.30, 15,000,000 shares), non-participating; common 2,000,000; options
// 1,000,000 at $0.75; Warrants I 10,000,000 at $2.00; Warrants II 3,000,000 at $3.00.
export const COTOPAXI: WaterfallAnalysisInputs = {
  common: [{ name: 'Common', shares: 2_000_000 }],
  options: [
    { name: 'Options', shares: 1_000_000, exercisePrice: 0.75 },
    { name: 'Warrants I', kind: 'warrant', shares: 10_000_000, exercisePrice: 2, class: 'Warrants I' },
    { name: 'Warrants II', kind: 'warrant', shares: 3_000_000, exercisePrice: 3, class: 'Warrants II' },
  ],
  series: [
    { name: 'Series B', shares: 5_000_000, originalIssuePrice: 1.5, seniority: 1, participation: 'participating' },
    {
      name: 'Series A',
      shares: 15_000_000,
      originalIssuePrice: 1.3,
      seniority: 2,
      dividends: { annualRatePct: 10, cumulative: true, accruedAmount: 6_000_000, survivesConversion: true },
    },
  ],
}

describe('CPA Journal "Valuing Securities Using the Option Pricing Method", Exhibits 2-3', () => {
  const s = waterfallBreakpoints(COTOPAXI)

  it('Exhibit 2 breakpoints: $7.5M, $13.5M, $33M, $38.25M, $42.65M, $58.75M, $91.75M', () => {
    expect(s.breakpoints.map((b) => Math.round(b.equityValue))).toEqual([7_500_000, 13_500_000, 33_000_000, 38_250_000, 42_650_000, 58_750_000, 91_750_000])
  })

  it('Exhibit 3 participation percentages by range (one decimal, as printed)', () => {
    const order = ['Series B', 'Series A dividends', 'Series A', 'Common', 'Options', 'Warrants I', 'Warrants II']
    const pct = (t: (typeof s.tranches)[number]) =>
      order.map((c) => Math.round((t.classFractions.find((f) => f.class === c)?.fraction ?? 0) * 1000) / 10)
    expect(s.tranches.map(pct)).toEqual([
      [100, 0, 0, 0, 0, 0, 0],
      [0, 100, 0, 0, 0, 0, 0],
      [0, 0, 100, 0, 0, 0, 0],
      [71.4, 0, 0, 28.6, 0, 0, 0],
      [62.5, 0, 0, 25, 12.5, 0, 0],
      [21.7, 0, 65.2, 8.7, 4.3, 0, 0],
      [15.2, 0, 45.5, 6.1, 3, 30.3, 0],
      // Exhibit 3 prints common at 5.5% here and Exhibit 5 at 5.6%; 2/36 = 5.56%.
      [13.9, 0, 41.7, 5.6, 2.8, 27.8, 8.3],
    ])
  })
})

// ---------------------------------------------------------------------------
// CRV
// ---------------------------------------------------------------------------

describe('CRV "Liquidation Preference": $5M for 20%, 1x', () => {
  // 20% as 2,000,000 preferred of 10,000,000 (any split giving 20% replays the same figures).
  const crv = (p: Partial<AnalysisSeries>): WaterfallAnalysisInputs => ({
    common: [{ name: 'Common', shares: 8_000_000 }],
    series: [{ name: 'Investor', shares: 2_000_000, originalIssuePrice: 2.5, ...p }],
  })
  const pair = (inputs: WaterfallAnalysisInputs, exit: number) => {
    const r = waterfallAnalysis(inputs, exit * M)
    return [classTotal(r, 'Investor') / M, classTotal(r, 'Common') / M]
  }
  it('non-participating: $20M → 5 / 15; $50M → 10 / 40; converts above $25M', () => {
    expect(pair(crv({}), 20)).toEqual([5, 15])
    expect(pair(crv({}), 50)).toEqual([10, 40])
    expect(waterfallBreakpoints(crv({})).securities.find((x) => x.name === 'Investor')?.joinsAtEquityValue).toBeCloseTo(25 * M, 2)
  })
  it('full participation: $20M → 8 / 12; $50M → 14 / 36', () => {
    expect(pair(crv({ participation: 'participating' }), 20)).toEqual([8, 12])
    expect(pair(crv({ participation: 'participating' }), 50)).toEqual([14, 36])
  })
  it('2x cap: $20M → 8; $50M → 10 / 40 ("the cap holds the payout to $10 million")', () => {
    const c = crv({ participation: 'capped', participationCapMultiple: 2 })
    expect(pair(c, 20)[0]).toBe(8)
    expect(pair(c, 50)).toEqual([10, 40])
  })
  it('"a $20 million investment at six percent reaches roughly $23.6 million after three years" (simple accrual)', () => {
    const series = { name: 'Fund', shares: 20 * M, originalIssuePrice: 1, dividends: { annualRatePct: 6, cumulative: true, accruesFrom: '2025-01-01' } }
    const dividends = accruedSeriesDividends(series, '2028-01-01') // 1,095 days / 365 = 3 years
    expect(Math.round((20 * M + dividends) / 100_000) / 10).toBe(23.6)
    expect(dividends).toBeCloseTo(3_600_000, 6)
  })
})

// ---------------------------------------------------------------------------
// YC Appendix II through the new engine (agreement with liquidityWaterfall)
// ---------------------------------------------------------------------------

describe('YC Post-Money Safe User Guide Appendix II Ex. 1 through waterfallAnalysis', () => {
  const inputs: WaterfallAnalysisInputs = {
    common: [{ name: 'Founders', shares: 9_250_000 }],
    options: [{ name: 'Options outstanding', shares: 300_000, exercisePrice: 0 }],
    safes: [
      { name: 'Investor A', amount: 200_000, postMoneyCap: 4_000_000 },
      { name: 'Investor B', amount: 800_000, postMoneyCap: 8_000_000 },
    ],
    unissuedPoolShares: 450_000,
  }
  const legacy = {
    holders: [
      { name: 'Founders', shares: 9_250_000, group: 'common' as const },
      { name: 'Options outstanding', shares: 300_000, group: 'options' as const },
    ],
    safes: inputs.safes,
    unissuedPoolShares: 450_000,
  }
  it.each([10 * M, 3 * M])('matches the legacy engine to the cent at %d', (price) => {
    const a = waterfallAnalysis(inputs, price)
    const b = liquidityWaterfall(legacy, price)
    for (const row of b.rows) expect(a.rows.find((r) => r.holder === row.name)?.total).toBeCloseTo(row.total, 2)
  })
  it('Q3 decisions convert at $10M; Q4 cash out at $3M', () => {
    expect(waterfallAnalysis(inputs, 10 * M).rows.filter((r) => r.kind === 'safe').map((r) => r.decision)).toEqual(['convert', 'convert'])
    expect(waterfallAnalysis(inputs, 3 * M).rows.filter((r) => r.kind === 'safe').map((r) => r.decision)).toEqual(['cash-out', 'cash-out'])
  })
})

// ---------------------------------------------------------------------------
// Hand-derived: options, unvested, notes, carve-out, escrow
// ---------------------------------------------------------------------------

describe('options, unvested handling, notes and deductions (hand-derived)', () => {
  const base: WaterfallAnalysisInputs = {
    exitDate: '2026-01-01',
    common: [{ name: 'Founder', shares: 900_000 }],
    options: [{ name: 'Grant 1', shares: 100_000, exercisePrice: 1, vestedShares: 50_000 }],
  }

  it('unvested shares require an explicit unvestedAtExit', () => {
    expect(() => waterfallAnalysis(base, 2 * M)).toThrow(/unvestedAtExit/)
  })

  it("acceleration counts all shares: v = (2,000,000 + 100,000 × 1) / 1,000,000 = $2.10, option net 100,000 × 1.10", () => {
    const r = waterfallAnalysis({ ...base, unvestedAtExit: 'accelerate', exerciseMode: 'gross' }, 2 * M)
    const opt = r.rows.find((x) => x.holder === 'Grant 1')
    expect(r.commonValuePerShare).toBe(2.1)
    expect(opt?.total).toBe(110_000)
    expect(opt?.exerciseCost).toBe(100_000)
    expect(opt?.grossProceeds).toBe(210_000) // 100,000 × $2.10
  })

  it("cancel excludes unvested: v = 2,050,000 / 950,000; net exercise withholds 50,000 × 1 / v shares", () => {
    const r = waterfallAnalysis({ ...base, unvestedAtExit: 'cancel' }, 2 * M)
    const v = 2_050_000 / 950_000
    const opt = r.rows.find((x) => x.holder === 'Grant 1')
    expect(opt?.total).toBeCloseTo(50_000 * (v - 1), 1)
    expect(opt?.sharesWithheld).toBeCloseTo(50_000 / v, 6)
    expect(r.schedule.excludedUnvestedOptionShares).toBe(50_000)
  })

  it('an out-of-the-money option receives nothing: at $0.5M v = $0.50 < $1', () => {
    const r = waterfallAnalysis({ ...base, unvestedAtExit: 'accelerate' }, 500_000)
    expect(r.rows.find((x) => x.holder === 'Grant 1')).toMatchObject({ total: 0, decision: 'out-of-the-money' })
  })

  it('a note repays principal + simple interest ahead of preferred: $1,000,000 at 8% for 365 days = $1,080,000', () => {
    const r = waterfallAnalysis(
      {
        exitDate: '2026-01-01',
        common: [{ name: 'Founder', shares: 1_000_000 }],
        series: [{ name: 'Series A', shares: 500_000, originalIssuePrice: 4 }],
        notes: [{ name: 'Bridge', principal: 1_000_000, annualRatePct: 8, issuedOn: '2025-01-01' }],
      },
      2_500_000,
    )
    expect(r.rows.find((x) => x.holder === 'Bridge')).toMatchObject({ total: 1_080_000, decision: 'repay' })
    expect(r.rows.find((x) => x.holder === 'Series A')?.total).toBe(1_420_000)
    expect(r.rows.find((x) => x.holder === 'Founder')?.total).toBe(0)
  })

  it('debt, expenses, carve-out and escrow reconcile: $10M − 1M − 0.5M = 8.5M net; carve 10% = 0.85M; equity 7.65M; escrow 10% of exit = 1M', () => {
    const r = waterfallAnalysis(
      {
        common: [{ name: 'Founder', shares: 600_000 }],
        series: [{ name: 'Series A', shares: 400_000, originalIssuePrice: 10 }],
        deductions: {
          debtPayoff: 1 * M,
          transactionExpenses: 0.5 * M,
          carveOut: { pctOfNet: 10, recipients: [{ name: 'CEO', weight: 3 }, { name: 'CTO', weight: 1 }] },
          escrow: { pctOfExit: 10 },
        },
      },
      10 * M,
    )
    expect(r.reconciliation).toMatchObject({ netProceeds: 8.5 * M, carveOut: 850_000, equityValue: 7.65 * M, escrowHeld: 1 * M })
    // Series A 1x non-participating $4M: as-converted 40% of 7.65M = 3.06M < 4M → preference.
    expect(r.rows.find((x) => x.holder === 'Series A')).toMatchObject({ total: 4 * M, decision: 'preference' })
    expect(r.rows.find((x) => x.holder === 'Founder')?.total).toBe(3.65 * M)
    expect(r.rows.find((x) => x.holder === 'CEO')?.total).toBe(637_500)
    // Waterfall escrow: closing runs at 6.65M → Series A 4M, founder 2.65M; release all founder.
    expect(r.rows.find((x) => x.holder === 'Series A')).toMatchObject({ atClosing: 4 * M, escrow: 0 })
    expect(r.rows.find((x) => x.holder === 'Founder')).toMatchObject({ atClosing: 2.65 * M, escrow: 1 * M })
    const stack = r.rows.filter((x) => x.kind !== 'carve-out').reduce((a, x) => a + x.total, 0)
    expect(stack).toBeCloseTo(7.65 * M, 6)
  })

  it('pro-rata escrow withholds the same fraction from every holder', () => {
    const r = waterfallAnalysis(
      { common: [{ name: 'Founder', shares: 600_000 }], series: [{ name: 'Series A', shares: 400_000, originalIssuePrice: 10 }], deductions: { escrow: { amount: 1 * M, allocation: 'pro-rata' } } },
      10 * M,
    )
    // Series A converts at $10M (40% = $4M, equal to the preference: ties stay with the preference).
    expect(r.rows.find((x) => x.holder === 'Series A')).toMatchObject({ total: 4 * M, atClosing: 3.6 * M, escrow: 400_000 })
  })
})

describe('review regressions (PR #777)', () => {
  it('keeps a safe with zero rounded conversion shares as a finite cash-out claim', () => {
    const inputs: WaterfallAnalysisInputs = {
      common: [{ name: 'Common', shares: 100 }],
      safes: [{ name: 'Small safe', amount: 1000, postMoneyCap: 1_000_000 }],
    }
    const schedule = waterfallBreakpoints(inputs)
    expect(schedule.securities.find((s) => s.kind === 'safe')).toMatchObject({ shares: 0, mode: 'claim-only', joinsAtEquityValue: null })
    for (const tranche of schedule.tranches) {
      expect(Number.isFinite(tranche.fromEquityValue)).toBe(true)
      expect(tranche.toEquityValue === null || Number.isFinite(tranche.toEquityValue)).toBe(true)
    }
    for (const exit of [500, 10_000]) {
      const report = waterfallAnalysis(inputs, exit)
      expect(report.rows.find((r) => r.kind === 'safe')).toMatchObject({ decision: 'cash-out', total: Math.min(exit, 1000) })
      expect(report.rows.reduce((sum, r) => sum + r.total, 0)).toBe(exit)
      expect(Object.values(conversionEquilibrium(inputs, exit).payouts).reduce((sum, value) => sum + value, 0)).toBeCloseTo(exit, 8)
    }
  })

  it('accrual tranches accrue each issue date separately: 1,000,000 shares at $1, 8% simple, 365 and 0 days', () => {
    const series = {
      name: 'A',
      shares: 2_000_000,
      originalIssuePrice: 1,
      dividends: { annualRatePct: 8, cumulative: true, accrualTranches: [{ shares: 1_000_000, accruesFrom: '2025-01-01' }, { shares: 1_000_000, accruesFrom: '2026-01-01' }] },
    }
    expect(accruedSeriesDividends(series, '2026-01-01')).toBeCloseTo(80_000, 6)
    expect(() => accruedSeriesDividends({ ...series, shares: 3_000_000 }, '2026-01-01')).toThrow(/sum/)
  })

  it('converting notes count in the safe Liquidity Capitalization: 1,000,000 common + 1,000,000 note shares, 10% safe → 222,222', () => {
    const s = waterfallBreakpoints({
      exitDate: '2026-01-01',
      common: [{ name: 'Common', shares: 1_000_000 }],
      notes: [{ name: 'Note', principal: 100_000, annualRatePct: 0, issuedOn: '2026-01-01', conversionShares: 1_000_000 }],
      safes: [{ name: 'Safe', amount: 100_000, postMoneyCap: 1_000_000 }],
    })
    expect(s.securities.find((x) => x.name === 'Safe')?.shares).toBe(222_222)
  })

  it('option-only tables keep the starting share value: 100 options at $1, $100 exit → v = $2, 50 shares withheld', () => {
    const r = waterfallAnalysis({ common: [], options: [{ name: 'O', shares: 100, exercisePrice: 1 }] }, 100)
    expect(r.commonValuePerShare).toBe(2)
    expect(r.rows[0].sharesWithheld).toBeCloseTo(50, 9)
  })

  it('escrow rows reconcile to escrowHeld in cents', () => {
    const r = waterfallAnalysis(
      { common: [1500, 1500, 900, 500, 500, 200].map((n, i) => ({ name: `H${i}`, shares: n })), deductions: { escrow: { amount: 0.01 } } },
      0.26,
    )
    expect(Math.round(r.rows.reduce((a, x) => a + x.escrow, 0) * 100)).toBe(1)
    for (const row of r.rows) expect(Math.round((row.atClosing + row.escrow) * 100)).toBe(Math.round(row.total * 100))
  })

  it('escrow takes amount or pctOfExit, not both', () => {
    expect(() => waterfallAnalysis({ common: [{ name: 'A', shares: 1 }], deductions: { escrow: { amount: 1, pctOfExit: 1 } } }, 10)).toThrow(/not both/)
  })

  it('redistributes escrow cents when positive-weight holders exhaust their rounded totals', () => {
    const input: WaterfallAnalysisInputs = {
      common: Array.from({ length: 5 }, (_, i) => ({ name: `C${i}`, shares: 1 })),
      series: [{
        name: 'Preferred', shares: 4, originalIssuePrice: 0.00625,
        holders: Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, shares: 1 })),
      }],
      deductions: { escrow: { amount: 0.02 } },
    }
    // Total proceeds round to four preferred cents and one common cent; the exact
    // escrow weights belong entirely to common, so the second cent needs other capacity.
    const report = waterfallAnalysis(input, 0.05)
    expect(Math.round(report.rows.reduce((sum, row) => sum + row.total, 0) * 100)).toBe(5)
    expect(Math.round(report.rows.reduce((sum, row) => sum + row.atClosing, 0) * 100)).toBe(3)
    expect(Math.round(report.rows.reduce((sum, row) => sum + row.escrow, 0) * 100)).toBe(2)
    for (const row of report.rows) {
      expect(row.atClosing).toBeGreaterThanOrEqual(0)
      expect(row.escrow).toBeGreaterThanOrEqual(0)
      expect(Math.round((row.atClosing + row.escrow) * 100)).toBe(Math.round(row.total * 100))
    }
  })

  it('the equilibrium solver converts for a $0.50 gain just above the breakpoint', () => {
    const inputs: WaterfallAnalysisInputs = { common: [{ name: 'C', shares: 1_000_000 }], series: [{ name: 'P', shares: 1_000_000, originalIssuePrice: 10 }] }
    expect(conversionEquilibrium(inputs, 20_000_001).routes.P).toBe('convert')
    expect(conversionEquilibrium(inputs, 19_999_999).routes.P).toBe('claim')
    expect(waterfallAnalysis(inputs, 20_000_001).rows.find((x) => x.holder === 'P')?.total).toBe(10_000_000.5)
  })
})

// ---------------------------------------------------------------------------
// Invariants over seeded random structures
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function randomStructure(seed: number): WaterfallAnalysisInputs {
  const r = rng(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const nSeries = 1 + Math.floor(r() * 4)
  const series: AnalysisSeries[] = Array.from({ length: nSeries }, (_, i) => {
    const participation = pick(['non-participating', 'participating', 'capped'] as const)
    return {
      name: `S${i}`,
      shares: Math.round(500_000 + r() * 3_000_000),
      originalIssuePrice: Math.round((0.5 + r() * 5) * 100) / 100,
      preferenceMultiple: pick([1, 1, 1.5, 2]),
      conversionRatio: pick([1, 1, 1.2]),
      participation,
      participationCapMultiple: participation === 'capped' ? pick([2, 3]) : undefined,
      seniority: 1 + Math.floor(r() * 3),
    }
  })
  return {
    common: [
      { name: 'F1', shares: Math.round(2_000_000 + r() * 5_000_000) },
      { name: 'F2', shares: Math.round(500_000 + r() * 2_000_000) },
    ],
    options: [
      { name: 'O1', shares: Math.round(100_000 + r() * 900_000), exercisePrice: Math.round(r() * 300) / 100 },
      { name: 'O2', shares: Math.round(100_000 + r() * 900_000), exercisePrice: Math.round(r() * 800) / 100 },
    ],
    series,
    safes: r() < 0.5 ? [{ name: 'Safe', amount: 500_000, postMoneyCap: 10_000_000 }] : undefined,
  }
}

describe('invariants (seeded random structures)', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919)

  it('rows sum to the equity value in cents and no payout is negative', () => {
    for (const seed of seeds) {
      const inputs = randomStructure(seed)
      for (const exit of [0, 1e5, 3e6, 1.7e7, 6e7, 2.5e8]) {
        const r = waterfallAnalysis(inputs, exit)
        const sum = r.rows.reduce((a, x) => a + x.total, 0)
        expect(Math.round(sum * 100)).toBe(Math.round(r.reconciliation.equityValue * 100))
        for (const row of r.rows) expect(row.total, `seed ${seed} ${row.holder}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('breakpoints are strictly increasing and tranches tile [0, ∞)', () => {
    for (const seed of seeds) {
      const s = waterfallBreakpoints(randomStructure(seed))
      for (let i = 1; i < s.breakpoints.length; i++) expect(s.breakpoints[i].equityValue).toBeGreaterThan(s.breakpoints[i - 1].equityValue)
      expect(s.tranches[0].fromEquityValue).toBe(0)
      for (let i = 1; i < s.tranches.length; i++) expect(s.tranches[i].fromEquityValue).toBeCloseTo(s.tranches[i - 1].toEquityValue as number, 6)
      expect(s.tranches[s.tranches.length - 1].toEquityValue).toBeNull()
      for (const t of s.tranches) expect(t.participants.reduce((a, p) => a + p.fraction, 0)).toBeCloseTo(1, 12)
    }
  })

  it('seniority: no junior claim is paid while a senior claim is short', () => {
    for (const seed of seeds) {
      const inputs = randomStructure(seed)
      const s = waterfallBreakpoints(inputs)
      for (const exit of [1e6, 4e6, 9e6]) {
        const pay = allocateAtEquityValue(s, exit)
        const claimants = s.securities.filter((x) => x.claim > 0)
        for (const junior of claimants) {
          if ((pay.get(junior.id) ?? 0) <= 0) continue
          for (const senior of claimants.filter((x) => (x.tier as number) < (junior.tier as number))) {
            expect(pay.get(senior.id) as number, `seed ${seed}`).toBeGreaterThanOrEqual(senior.claim - 1e-6)
          }
        }
      }
    }
  })

  it('per-class payouts are continuous and non-decreasing across a fine sweep', () => {
    for (const seed of seeds.slice(0, 15)) {
      const { points } = waterfallSweep(randomStructure(seed), { from: 0, to: 1.5e8, steps: 600 })
      const step = 1.5e8 / 600
      for (let i = 1; i < points.length; i++) {
        let jump = 0
        points[i].byClass.forEach((c, j) => {
          const d = c.total - points[i - 1].byClass[j].total
          expect(d, `seed ${seed} ${c.class}`).toBeGreaterThanOrEqual(-0.02)
          jump += Math.abs(d)
        })
        // Continuity: the per-class increments over one step add up to at most the step.
        expect(jump).toBeLessThanOrEqual(step + 0.05 * points[i].byClass.length)
      }
    }
  })

  it('the breakpoint schedule agrees with the direct conversion-equilibrium solver', () => {
    for (const seed of seeds) {
      const inputs = randomStructure(seed)
      const s = waterfallBreakpoints(inputs)
      for (const equity of [2e6, 8e6, 2.5e7, 7e7, 2e8]) {
        const eq = conversionEquilibrium(inputs, equity)
        const bp = allocateAtEquityValue(s, equity)
        for (const sec of s.securities) {
          expect(bp.get(sec.id) as number, `seed ${seed} ${sec.name} at ${equity}`).toBeCloseTo(eq.payouts[sec.id], -1)
        }
      }
    }
  })

  it('every report carries needsReview', () => {
    expect(waterfallAnalysis(HUSTLE, 1).needsReview).toBe(true)
    expect(waterfallSweep(HUSTLE, [1, 2]).needsReview).toBe(true)
  })
})
