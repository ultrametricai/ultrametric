// Tests for the prototype 409A-style allocation module. Published examples replayed at the
// sources' own rounding:
// - Black-Scholes: Hull, Options, Futures, and Other Derivatives (8th ed.) pp. 315-316
//   (S0 = 42, K = 40, r = 10%, σ = 20%, T = 0.5 → c = 4.76, p = 0.81), as printed at
//   https://tomasplihal.github.io/financial_derivatives/week_09.html §9.1.
// - Forward OPM: Kiepura, "Valuing Securities Using the Option Pricing Method", The CPA
//   Journal, Sept 2020 (https://www.cpajournal.com/2020/09/09/valuing-securities-using-the-option-pricing-method/),
//   Exhibit 4 (eight Black-Scholes call values and tranche values, to the dollar) and
//   Exhibit 6 (class totals to the dollar, per-share to the cent).
// - Backsolve: no fully specified published backsolve was reachable (the AICPA guide and its
//   drafts are login-gated). The test runs the CPA Journal example in reverse: calibrating to
//   the published Series B allocation recovers the published $40,000,000 equity value.
// - DLOM: Elmore, Willamette Management Associates Insights, Winter 2017
//   (https://vanguardecon.com/resources/DLOM_Using_Put_Options_2017.pdf), Exhibit 9 (Finnerty
//   2012, every cell) and Exhibit 5 (Chaffe 1993 at r = 2%; the T ≤ 1 rows and the high-
//   volatility cells, because the source's T ≥ 2, 25-50% cells sit 0.1-0.2 points below a
//   Black-Scholes put, a source-side difference noted in the test).
// - PWERM: Axevil, "OPM backsolve vs PWERM" (https://axevil.com/learn/opm-backsolve-vs-pwerm),
//   an example its page labels as invented numbers: IPO 50% at $12, sale 35% at $6, wind-down
//   15% at $0, two years at 25% → $5.18, then a 20% DLOM → $4.15.
// Invariants: common per as-converted share never exceeds a preferred class's; class values
// sum to the equity value; DLOM in [0, 1); every result carries the prototype flags and no
// strike-shaped field.

import { describe, expect, it } from 'vitest'
import {
  PROTOTYPE_LABEL,
  RULE_IDS_VALUATION_409A,
  blackScholesCall,
  blackScholesPut,
  dlomChaffe,
  dlomFinnerty,
  estimate409aPrototype,
  normCdf,
  opmAllocate,
  pwermAllocate,
  resolveDlom,
  type Prototype409aRequest,
} from '../valuation409a'
import { waterfallBreakpoints, type WaterfallAnalysisInputs } from '../waterfall'
import fs from 'node:fs'
import path from 'node:path'

const M = 1_000_000

// CPA Journal Exhibit 1 ("Cotopaxi Tech", fictional).
const COTOPAXI: WaterfallAnalysisInputs = {
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
const CPA_OPTION = { volatility: 0.8, termYears: 3, riskFreeRate: 0.02 }

describe('normal CDF and Black-Scholes', () => {
  it('normCdf matches reference values to 1e-14', () => {
    expect(normCdf(0)).toBe(0.5)
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 14)
    expect(normCdf(1.96)).toBeCloseTo(0.9750021048517795, 14)
    expect(normCdf(-1)).toBeCloseTo(1 - 0.8413447460685429, 14)
  })

  it('Hull 8th ed. pp. 315-316: c = 4.76, p = 0.81', () => {
    const p = { volatility: 0.2, termYears: 0.5, riskFreeRate: 0.1 }
    expect(Math.round(blackScholesCall(42, 40, p) * 100) / 100).toBe(4.76)
    expect(Math.round(blackScholesPut(42, 40, p) * 100) / 100).toBe(0.81)
    // put-call parity: c − p = S − K e^{−rT}
    expect(blackScholesCall(42, 40, p) - blackScholesPut(42, 40, p)).toBeCloseTo(42 - 40 * Math.exp(-0.05), 10)
  })
})

describe('CPA Journal forward OPM (Exhibits 4 and 6): $40,000,000, 3.0 years, 80% volatility, 2.0% risk-free', () => {
  const schedule = waterfallBreakpoints(COTOPAXI)
  const opm = opmAllocate(schedule, 40 * M, CPA_OPTION)

  it('Exhibit 4 call values at each breakpoint, to the dollar', () => {
    expect(opm.tranches.map((t) => Math.round(t.callAtFrom))).toEqual([40_000_000, 33_935_184, 30_393_433, 22_895_835, 21_481_600, 20_422_584, 17_279_014, 13_029_043])
  })

  it('Exhibit 4 incremental values, to the dollar', () => {
    expect(opm.tranches.map((t) => Math.round(t.value))).toEqual([6_064_816, 3_541_751, 7_497_598, 1_414_236, 1_059_016, 3_143_570, 4_249_970, 13_029_043])
  })

  it('Exhibit 6 class totals to the dollar and per-share values to the cent', () => {
    const want: [string, number, number | null][] = [
      ['Series B', 10_873_779, 2.17],
      ['Series A dividends', 3_541_751, null],
      ['Series A', 16_908_325, 1.13],
      ['Common', 1_923_585, 0.96],
      ['Options', 759_759, 0.76],
      ['Warrants I', 4_907_048, 0.49],
      ['Warrants II', 1_085_754, 0.36],
    ]
    for (const [cls, total, perShare] of want) {
      const c = opm.classes.find((x) => x.class === cls)
      expect(Math.round(c?.value ?? NaN), cls).toBe(total)
      expect(c?.valuePerShare === null ? null : Math.round((c?.valuePerShare ?? NaN) * 100) / 100, cls).toBe(perShare)
    }
    expect(opm.classes.reduce((a, c) => a + c.value, 0)).toBeCloseTo(40 * M, 4)
  })
})

describe('OPM backsolve (the CPA Journal example in reverse)', () => {
  it('calibrating to the published Series B value ($10,873,779 ÷ 5,000,000) recovers the $40,000,000 equity value', () => {
    const r = estimate409aPrototype({
      structure: COTOPAXI,
      method: { method: 'opm-backsolve', calibration: { class: 'Series B', pricePerShare: 10_873_779 / 5_000_000 }, option: CPA_OPTION },
      dlom: { method: 'none' },
    })
    // The calibration figure is rounded to the dollar, so the solve lands within a few dollars.
    expect(Math.abs((r.opmEquityValue as number) - 40 * M)).toBeLessThan(10)
    expect(Math.abs(r.backsolveCalibrationError as number)).toBeLessThan(1e-6)
    expect(r.common.allocatedValuePerShareMarketable).toBe(0.9618)
  })
})

describe('DLOM (Elmore 2017)', () => {
  const vols = [0.2, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
  const pct = (x: number) => Math.round(x * 1000) / 10

  it('Finnerty (2012), Exhibit 9 (S = X, q = 0), every cell to 0.1%', () => {
    const exhibit9: [number, number[]][] = [
      [0.25, [2.3, 5.7, 8.5, 11.2, 13.9, 16.3, 20.9, 24.6, 27.5]],
      [0.5, [3.3, 8.0, 11.9, 15.5, 18.8, 21.8, 26.6, 29.7, 31.4]],
      [1, [4.6, 11.2, 16.3, 20.9, 24.6, 27.5, 30.9, 32.1, 32.3]],
      [2, [6.5, 15.5, 21.8, 26.6, 29.7, 31.4, 32.2, 32.3, 32.3]],
    ]
    for (const [t, row] of exhibit9) expect(vols.map((v) => pct(dlomFinnerty(v, t))), `T=${t}`).toEqual(row)
    // Text: "at 75% volatility and one year" → 16.3%; bounded near 32.3%.
    expect(pct(dlomFinnerty(0.75, 1))).toBe(16.3)
    expect(dlomFinnerty(10, 10)).toBeLessThan(0.3234)
  })

  it('Chaffe (1993), Exhibit 5 (S = X, r = 2%, q = 0)', () => {
    const v5 = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
    const exhibit5: [number, number[]][] = [
      [0.25, [4.7, 9.7, 14.6, 19.4, 24.2, 28.9, 37.9, 46.4, 54.3]],
      [0.5, [6.5, 13.5, 20.3, 27.0, 33.5, 39.7, 51.3, 61.5, 70.3]],
      [1, [8.9, 18.6, 28.0, 36.9, 45.4, 53.1, 66.6, 77.1, 84.8]],
    ]
    for (const [t, row] of exhibit5) expect(v5.map((v) => pct(dlomChaffe(v, t, 0.02))), `T=${t}`).toEqual(row)
    // T = 2, 75%-300% cells match; the 25% cell prints 11.8 against the put's 11.9.
    expect(v5.slice(2).map((v) => pct(dlomChaffe(v, 2, 0.02)))).toEqual([37.7, 49.1, 59.2, 67.8, 80.7, 88.5, 92.8])
    // Text: one year at 75% volatility gives 28%.
    expect(Math.round(dlomChaffe(0.75, 1, 0.02) * 100)).toBe(28)
  })

  it('DLOM stays in [0, 1) over a grid; stated DLOMs need a source', () => {
    for (const v of [0.05, 0.3, 0.9, 2, 5]) {
      for (const t of [0.1, 1, 3, 10]) {
        for (const d of [dlomFinnerty(v, t), dlomChaffe(v, t, 0.03)]) {
          expect(d).toBeGreaterThanOrEqual(0)
          expect(d).toBeLessThan(1)
        }
      }
    }
    expect(() => resolveDlom({ method: 'stated', fraction: 0.2, source: '' })).toThrow(/source/)
    expect(() => resolveDlom({ method: 'stated', fraction: 1, source: 'x' })).toThrow(RangeError)
  })
})

describe('PWERM (Axevil illustrative example, invented numbers per its page)', () => {
  // 1,000,000 common shares and no preferred, so per-share scenario values equal exit ÷ 1M.
  const structure: WaterfallAnalysisInputs = { common: [{ name: 'Common', shares: 1_000_000 }] }
  const scenarios = [
    { name: 'IPO', kind: 'ipo' as const, probability: 0.5, exitValue: 12 * M, yearsToExit: 2, discountRatePct: 25 },
    { name: 'Sale', kind: 'm&a' as const, probability: 0.35, exitValue: 6 * M, yearsToExit: 2, discountRatePct: 25 },
    { name: 'Wind-down', kind: 'dissolution' as const, probability: 0.15, exitValue: 0, yearsToExit: 2, discountRatePct: 25 },
  ]
  it('weighted $8.10, discounted two years at 25% → $5.18, 20% DLOM → $4.15', () => {
    const r = estimate409aPrototype({ structure, method: { method: 'pwerm', scenarios }, dlom: { method: 'stated', fraction: 0.2, source: 'Axevil illustrative 20%' } })
    expect(Math.round(r.common.allocatedValuePerShareMarketable * 100) / 100).toBe(5.18)
    expect(Math.round(r.common.allocatedValuePerShareAfterDlom * 100) / 100).toBe(4.15)
    const undiscounted = scenarios.reduce((a, s) => a + s.probability * (s.exitValue / M), 0)
    expect(undiscounted).toBeCloseTo(8.1, 12)
  })
  it('probabilities must sum to 1', () => {
    expect(() => pwermAllocate(structure, scenarios.slice(0, 2))).toThrow(/sum to 1/)
  })
  it('each scenario allocates through the waterfall: preferred takes 60M at 100M and converts at 200M', () => {
    // KNAV, "PWERM and hybrid methods for Allocation of Value" pp. 2-3
    // (https://uk.knavcpa.com/wp-content/uploads/2023/03/PWERM-AND-HYBRID-METHODS.pdf):
    // 50M common, 50M preference shares (1:1), preference 60M.
    const knav: WaterfallAnalysisInputs = {
      common: [{ name: 'Common', shares: 50 * M }],
      series: [{ name: 'Preference', shares: 50 * M, originalIssuePrice: 1.2 }],
    }
    const r = pwermAllocate(knav, [
      { name: 'Low', kind: 'm&a', probability: 0.5, exitValue: 100 * M, yearsToExit: 0, discountRatePct: 0 },
      { name: 'High', kind: 'ipo', probability: 0.5, exitValue: 200 * M, yearsToExit: 0, discountRatePct: 0 },
    ])
    expect(r.scenarios[0].byClass.find((c) => c.class === 'Preference')?.exitProceeds).toBe(60 * M)
    expect(r.scenarios[1].byClass.find((c) => c.class === 'Preference')?.exitProceeds).toBe(100 * M)
  })
})

describe('hybrid', () => {
  it('weights the PWERM scenarios and the OPM scenario by probability', () => {
    const scen = [{ name: 'IPO', kind: 'ipo' as const, probability: 0.3, exitValue: 120 * M, yearsToExit: 1, discountRatePct: 20 }]
    const r = estimate409aPrototype({
      structure: COTOPAXI,
      method: { method: 'hybrid', scenarios: scen, opm: { probability: 0.7, option: CPA_OPTION, equityValue: 40 * M } },
      dlom: { method: 'finnerty', volatility: 0.8, termYears: 3 },
    })
    const opmCommon = 1_923_585.0 / 2_000_000
    // The IPO scenario's common proceeds come from the waterfall, discounted one year at 20%.
    const ipoCommon = (r.pwerm?.scenarios[0].byClass.find((c) => c.class === 'Common')?.exitProceeds ?? NaN) / 2_000_000
    expect(r.common.allocatedValuePerShareMarketable).toBeCloseTo(0.3 * (ipoCommon / 1.2) + 0.7 * opmCommon, 3)
    expect(r.common.allocatedValuePerShareAfterDlom).toBeCloseTo(r.common.allocatedValuePerShareMarketable * (1 - dlomFinnerty(0.8, 3)), 3)
  })
})

describe('prototype labelling and invariants', () => {
  const request: Prototype409aRequest = {
    structure: COTOPAXI,
    method: { method: 'opm-forward', equityValue: 40 * M, option: CPA_OPTION },
    dlom: { method: 'chaffe', volatility: 0.8, termYears: 3, riskFreeRate: 0.02 },
  }

  it('every result carries the prototype flags, the label and the 409A law rules', () => {
    const r = estimate409aPrototype(request)
    expect(r).toMatchObject({ prototype: true, notAValuation: true, notAStrikePrice: true, needsReview: true, label: PROTOTYPE_LABEL })
    expect(r.ruleIds).toContain('us-fed.independent-appraisal-presumption')
  })

  it('no output key is shaped as a fair market value or a strike price', () => {
    const keys = JSON.stringify(estimate409aPrototype(request)).match(/"[A-Za-z]+":/g) ?? []
    for (const k of keys.filter((x) => x !== '"notAStrikePrice":')) expect(k.toLowerCase()).not.toMatch(/strike|fmv|fairmarket|exerciseprice/)
  })

  it('every cited law rule resolves to a committed card', () => {
    for (const { ruleId, jurisdiction } of Object.values(RULE_IDS_VALUATION_409A)) {
      const file = path.join(__dirname, '..', '..', '..', 'open-law', jurisdiction, `${ruleId.replace(/\./g, '-')}.json`)
      expect(fs.existsSync(file), ruleId).toBe(true)
    }
  })

  it('the OPM refuses exit deductions (it allocates total equity value)', () => {
    expect(() => estimate409aPrototype({ ...request, structure: { ...COTOPAXI, deductions: { debtPayoff: 1 } } })).toThrow(/deductions/)
  })

  it('class values sum to the equity value and common ≤ each preferred class per as-converted share', () => {
    for (const ev of [5 * M, 20 * M, 40 * M, 90 * M, 300 * M]) {
      for (const vol of [0.3, 0.6, 1.0]) {
        const opm = opmAllocate(waterfallBreakpoints(COTOPAXI), ev, { volatility: vol, termYears: 2, riskFreeRate: 0.03 })
        expect(opm.classes.reduce((a, c) => a + c.value, 0)).toBeCloseTo(ev, 2)
        const per = (c: string) => {
          const x = opm.classes.find((y) => y.class === c)
          return (x?.value ?? 0) / (x?.shares ?? 1)
        }
        expect(per('Common')).toBeLessThanOrEqual(per('Series B') + 1e-9)
        expect(per('Common')).toBeLessThanOrEqual(per('Series A') + 1e-9)
        for (const c of opm.classes) expect(c.value).toBeGreaterThanOrEqual(-1e-6)
      }
    }
  })
})
