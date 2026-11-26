// Prototype 409A-style equity allocation (OPM backsolve, OPM forward, PWERM, hybrid, DLOM).
//
// ===========================================================================
// PROTOTYPE ESTIMATE. THIS IS NOT A 409A VALUATION AND NOT A STRIKE PRICE.
// ===========================================================================
// Every result carries `prototype: true`, `notAValuation: true`, `notAStrikePrice: true`
// and `needsReview: true`. No output field is named or shaped as a fair market value or an
// exercise price, and nothing here may be used to set one.
//
// Why: under Treas. Reg. § 1.409A-1(b)(5)(iv)(B)(1) the fair market value of non-public stock
// is "a value determined by the reasonable application of a reasonable valuation method"
// that weighs the listed factors and all material information (law rule
// `us-fed.reasonable-method`). The presumption of reasonableness attaches only to the three
// methods of § 1.409A-1(b)(5)(iv)(B)(2): (i) an independent appraisal meeting § 401(a)(28)(C)
// dated no more than 12 months before the transaction (rule
// `us-fed.independent-appraisal-presumption`); (ii) a formula price used as a nonlapse
// restriction (rule `us-fed.binding-formula-presumption`); (iii) a good-faith written report
// on illiquid start-up stock by a qualified person (rule `us-fed.illiquid-startup-presumption`).
// A calculation run by software from user inputs is none of these. The presumption, rebuttable
// only on a showing of gross unreasonableness, requires the appraiser or qualified person,
// their judgment of inputs (volatility, term, scenarios, discounts), and the written report.
// Source text: 26 CFR 1.409A-1(b)(5)(iv)(B), read via the eCFR versioner API
// (https://www.ecfr.gov/api/versioner/v1/full/2026-11-20/title-26.xml?section=1.409A-1;
// the human eCFR page redirects automated clients to a bot check).
//
// What the module does: the allocation arithmetic an appraiser's report contains, given the
// inputs that only an appraiser can choose. Pure, client-safe, deterministic. Volatility,
// term, risk-free rate, scenarios, probabilities and discount rates are INPUTS; nothing is
// fetched or defaulted from market data.
//
// Methods and sources (each function's doc comment names the one it uses):
// - AICPA Accounting and Valuation Guide, "Valuation of Privately-Held-Company Equity
//   Securities Issued as Compensation" (2013): the option pricing method (OPM), the backsolve
//   (calibrating total equity value to a recent arm's-length preferred price), the
//   probability-weighted expected return method (PWERM), the hybrid method, and the discount
//   for lack of marketability (DLOM). The guide and its working drafts are behind an AICPA
//   login; no chapter text or worked example from it is reproduced here, and none is replayed.
//   The reachable published examples below are replayed instead.
// - Black, F. and Scholes, M. (1973), "The Pricing of Options and Corporate Liabilities",
//   Journal of Political Economy 81(3):637-654: the European call/put formula. Numeric check:
//   Hull, Options, Futures, and Other Derivatives (8th ed.), pp. 315-316, S0 = 42, K = 40,
//   r = 10%, σ = 20%, T = 0.5 → c = 4.76, p = 0.81, as printed by
//   https://tomasplihal.github.io/financial_derivatives/week_09.html §9.1 and cited to Hull in
//   https://www.rdocumentation.org/packages/RND/versions/1.2/topics/price.bsm.option.
// - Kiepura, F., "Valuing Securities Using the Option Pricing Method", The CPA Journal,
//   September 2020 (https://www.cpajournal.com/2020/09/09/valuing-securities-using-the-option-pricing-method/),
//   Exhibits 1-6: the forward OPM worked example replayed in the tests.
// - Finnerty, J. D. (2012), "An Average-Strike Put Option Model of the Marketability Discount",
//   Journal of Derivatives 19(4):53-69; Chaffe, D. B. H. (1993), "Option Pricing as a Proxy for
//   Discount for Lack of Marketability in Private Company Valuations", Business Valuation Review
//   12(4):182-188. Both papers are paywalled; their formulas and tables are taken from Elmore,
//   "Determining the Discount for Lack of Marketability with Put Option Pricing Models in View
//   of the Section 2704 Proposed Regulations", Willamette Management Associates Insights,
//   Winter 2017, pp. 32-46 (https://vanguardecon.com/resources/DLOM_Using_Put_Options_2017.pdf),
//   Exhibit 5 (Chaffe) and Exhibit 9 (Finnerty), replayed in the tests.
// - Normal CDF: Hart (1968) double-precision algorithm as given in West, G. (2005), "Better
//   approximations to cumulative normal functions", Wilmott Magazine, Figure 2.
//
// Educational model, not tax, legal or valuation advice.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { roundPrice } from './rounding'
import { entrySpec } from './entryValidation'
import {
  WaterfallAnalysisInputsSchema,
  waterfallAnalysis,
  waterfallBreakpoints,
  type BreakpointSchedule,
  type WaterfallAnalysisInputs,
} from './waterfall'

/** The label every result carries. */
export const PROTOTYPE_LABEL =
  'Prototype allocation estimate computed from user inputs. Not a 409A valuation, not an independent appraisal, and not a strike price. ' +
  'The Treas. Reg. § 1.409A-1(b)(5)(iv)(B)(2) presumption of reasonableness requires a qualifying independent appraisal or qualified-person report.'

/** Law rules this module leans on (open-law/US-FED). */
export const RULE_IDS_VALUATION_409A = {
  reasonableMethod: { ruleId: 'us-fed.reasonable-method', jurisdiction: 'US-FED' },
  appraisalPresumption: { ruleId: 'us-fed.independent-appraisal-presumption', jurisdiction: 'US-FED' },
  illiquidStartup: { ruleId: 'us-fed.illiquid-startup-presumption', jurisdiction: 'US-FED' },
  bindingFormula: { ruleId: 'us-fed.binding-formula-presumption', jurisdiction: 'US-FED' },
  staleness: { ruleId: 'us-fed.staleness', jurisdiction: 'US-FED' },
} as const

export interface PrototypeFlags {
  prototype: true
  notAValuation: true
  notAStrikePrice: true
  needsReview: true
  label: string
  ruleIds: string[]
}

function flags(): PrototypeFlags {
  return {
    prototype: true,
    notAValuation: true,
    notAStrikePrice: true,
    needsReview: true,
    label: PROTOTYPE_LABEL,
    ruleIds: Object.values(RULE_IDS_VALUATION_409A).map((r) => r.ruleId),
  }
}

// ---------------------------------------------------------------------------
// Normal CDF and Black-Scholes
// ---------------------------------------------------------------------------

/** Standard normal CDF, Hart (1968) via West (2005) Figure 2 (double precision). */
export function normCdf(x: number): number {
  const a = Math.abs(x)
  let c: number
  if (a > 37) c = 0
  else {
    const e = Math.exp((-a * a) / 2)
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688
      b = b * a + 6.37396220353165
      b = b * a + 33.912866078383
      b = b * a + 112.079291497871
      b = b * a + 221.213596169931
      b = b * a + 220.206867912376
      c = e * b
      b = 8.83883476483184e-2 * a + 1.75566716318264
      b = b * a + 16.064177579207
      b = b * a + 86.7807322029461
      b = b * a + 296.564248779674
      b = b * a + 637.333633378831
      b = b * a + 793.826512519948
      b = b * a + 440.413735824752
      c = c / b
    } else {
      let b = a + 0.65
      b = a + 4 / b
      b = a + 3 / b
      b = a + 2 / b
      b = a + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return x > 0 ? 1 - c : c
}

export interface OptionParams {
  /** Annualized volatility as a decimal (0.8 = 80%). An input; never estimated here. */
  volatility: number
  /** Years to the expected liquidity event. */
  termYears: number
  /** Continuously compounded risk-free rate as a decimal (0.02 = 2%). An input. */
  riskFreeRate: number
  /** Continuous dividend yield (default 0). */
  dividendYield?: number
}

function checkParams(p: OptionParams): void {
  if (!(p.volatility > 0) || !Number.isFinite(p.volatility)) throw new RangeError('volatility must be > 0')
  if (!(p.termYears > 0) || !Number.isFinite(p.termYears)) throw new RangeError('termYears must be > 0')
  if (!Number.isFinite(p.riskFreeRate)) throw new RangeError('riskFreeRate must be finite')
  if (!((p.dividendYield ?? 0) >= 0)) throw new RangeError('dividendYield must be >= 0')
}

/** Black-Scholes (1973) European call: S e^{−qT} N(d1) − K e^{−rT} N(d2). K = 0 returns S e^{−qT}. */
export function blackScholesCall(spot: number, strike: number, p: OptionParams): number {
  checkParams(p)
  if (!(spot >= 0) || !(strike >= 0)) throw new RangeError('spot and strike must be >= 0')
  const q = p.dividendYield ?? 0
  const disc = Math.exp(-q * p.termYears)
  if (strike === 0) return spot * disc
  if (spot === 0) return 0
  const sd = p.volatility * Math.sqrt(p.termYears)
  const d1 = (Math.log(spot / strike) + (p.riskFreeRate - q + (p.volatility * p.volatility) / 2) * p.termYears) / sd
  return spot * disc * normCdf(d1) - strike * Math.exp(-p.riskFreeRate * p.termYears) * normCdf(d1 - sd)
}

/** Black-Scholes (1973) European put: K e^{−rT} N(−d2) − S e^{−qT} N(−d1). */
export function blackScholesPut(spot: number, strike: number, p: OptionParams): number {
  checkParams(p)
  if (!(spot > 0) || !(strike > 0)) throw new RangeError('spot and strike must be > 0')
  const q = p.dividendYield ?? 0
  const sd = p.volatility * Math.sqrt(p.termYears)
  const d1 = (Math.log(spot / strike) + (p.riskFreeRate - q + (p.volatility * p.volatility) / 2) * p.termYears) / sd
  return strike * Math.exp(-p.riskFreeRate * p.termYears) * normCdf(sd - d1) - spot * Math.exp(-q * p.termYears) * normCdf(-d1)
}

// ---------------------------------------------------------------------------
// DLOM
// ---------------------------------------------------------------------------

/**
 * Finnerty (2012) average-strike put DLOM as a fraction of the marketable value:
 * D = e^{−qT}[N(v√T/2) − N(−v√T/2)], v√T = √(σ²T + ln[2(e^{σ²T} − σ²T − 1)] − 2 ln(e^{σ²T} − 1)).
 * Formula as printed in Elmore (2017) p. 44 citing Journal of Derivatives 19 (2012); the risk-
 * free rate does not enter. Bounded above by about 32.3% (Elmore: "produces no discount in
 * excess of 32.3 percent").
 */
export function dlomFinnerty(volatility: number, termYears: number, dividendYield = 0): number {
  if (!(volatility > 0) || !(termYears > 0) || !(dividendYield >= 0)) throw new RangeError('volatility and termYears must be > 0; dividendYield >= 0')
  const s2t = volatility * volatility * termYears
  // Log-space terms: expm1 keeps e^{x} − 1 − x accurate at small σ²T, and the large-σ²T form
  // ln(e^{x} − 1) = x + ln(1 − e^{−x}) avoids overflow.
  const logEm1 = s2t > 30 ? s2t + Math.log1p(-Math.exp(-s2t)) : Math.log(Math.expm1(s2t))
  const logTwoEm1MinusX = s2t > 30 ? Math.LN2 + s2t + Math.log1p(-(s2t + 1) * Math.exp(-s2t)) : Math.log(2 * (Math.expm1(s2t) - s2t))
  const vRootT = Math.sqrt(s2t + logTwoEm1MinusX - 2 * logEm1)
  return Math.exp(-dividendYield * termYears) * (normCdf(vRootT / 2) - normCdf(-vRootT / 2))
}

/**
 * Chaffe (1993) protective put DLOM: the price of an at-the-money European put (Black-Scholes)
 * divided by the share value. Elmore (2017) Exhibit 5 tabulates it at r = 2%, q = 0.
 */
export function dlomChaffe(volatility: number, termYears: number, riskFreeRate: number, dividendYield = 0): number {
  return blackScholesPut(1, 1, { volatility, termYears, riskFreeRate, dividendYield })
}

export type DlomSpec =
  | { method: 'none' }
  | { method: 'finnerty'; volatility: number; termYears: number; dividendYield?: number }
  | { method: 'chaffe'; volatility: number; termYears: number; riskFreeRate: number; dividendYield?: number }
  | { method: 'stated'; fraction: number; source: string }

export interface DlomResult {
  method: DlomSpec['method']
  /** Discount as a fraction in [0, 1). */
  fraction: number
  note: string
}

/** Resolve a DLOM choice. The method is an explicit input; 'stated' takes a caller-sourced figure. */
export function resolveDlom(spec: DlomSpec): DlomResult {
  let fraction: number
  let note: string
  switch (spec.method) {
    case 'none':
      return { method: 'none', fraction: 0, note: 'No DLOM applied.' }
    case 'finnerty':
      fraction = dlomFinnerty(spec.volatility, spec.termYears, spec.dividendYield ?? 0)
      note = 'Finnerty (2012) average-strike put; formula per Elmore (2017) p. 44.'
      break
    case 'chaffe':
      fraction = dlomChaffe(spec.volatility, spec.termYears, spec.riskFreeRate, spec.dividendYield ?? 0)
      note = 'Chaffe (1993) at-the-money European protective put ÷ share value.'
      break
    case 'stated':
      if (!spec.source) throw new RangeError('a stated DLOM needs its source')
      fraction = spec.fraction
      note = `Stated DLOM from: ${spec.source}`
      break
  }
  if (!(fraction >= 0 && fraction < 1)) throw new RangeError('DLOM must be in [0, 1)')
  return { method: spec.method, fraction, note }
}

// ---------------------------------------------------------------------------
// OPM allocation over the waterfall breakpoints
// ---------------------------------------------------------------------------

export interface OpmTranche {
  fromEquityValue: number
  toEquityValue: number | null
  /** Black-Scholes call on total equity at the tranche's lower breakpoint. */
  callAtFrom: number
  /** The tranche's value: C(lower) − C(upper). */
  value: number
  classFractions: { class: string; fraction: number }[]
}

export interface ClassAllocation {
  class: string
  shares: number
  /** Allocated value in dollars (unrounded). */
  value: number
  /** value ÷ shares, rounded to 4 decimals; null for share-less classes (separate dividend claims). */
  valuePerShare: number | null
}

export interface OpmAllocation {
  equityValue: number
  params: OptionParams
  tranches: OpmTranche[]
  classes: ClassAllocation[]
}

function assertNoDeductions(inputs: WaterfallAnalysisInputs): void {
  if (inputs.deductions) throw new RangeError('the OPM allocates total equity value: pass inputs without exit deductions')
}

function classShares(schedule: BreakpointSchedule): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of schedule.securities) m.set(s.class, (m.get(s.class) ?? 0) + s.shares)
  return m
}

/**
 * OPM allocation (AICPA guide's OPM; Kiepura 2020 Exhibits 4-6): each breakpoint is the
 * strike of a European call on total equity value; a tranche between breakpoints Kᵢ and Kᵢ₊₁ is
 * worth C(Kᵢ) − C(Kᵢ₊₁) (the last tranche is C(Kₙ)), shared by the classes in the
 * breakpoint schedule's fractions (waterfall.waterfallBreakpoints).
 */
export function opmAllocate(schedule: BreakpointSchedule, equityValue: number, params: OptionParams): OpmAllocation {
  checkParams(params)
  // With a dividend yield the calls sum to E·e^{−qT}, leaving value unallocated.
  if ((params.dividendYield ?? 0) !== 0) throw new RangeError('the OPM allocation takes dividendYield 0; dividend payments are not allocated')
  if (!(equityValue > 0) || !Number.isFinite(equityValue)) throw new RangeError('equityValue must be > 0')
  const calls = schedule.tranches.map((t) => blackScholesCall(equityValue, t.fromEquityValue, params))
  const tranches: OpmTranche[] = schedule.tranches.map((t, i) => ({
    fromEquityValue: t.fromEquityValue,
    toEquityValue: t.toEquityValue,
    callAtFrom: calls[i]!,
    value: calls[i]! - (calls[i + 1] ?? 0),
    classFractions: t.classFractions,
  }))
  const byClass = new Map<string, number>(schedule.classes.map((c) => [c, 0]))
  for (const t of tranches) for (const f of t.classFractions) byClass.set(f.class, (byClass.get(f.class) ?? 0) + t.value * f.fraction)
  const shares = classShares(schedule)
  return {
    equityValue,
    params,
    tranches,
    classes: schedule.classes.map((c) => {
      const n = shares.get(c) ?? 0
      const value = byClass.get(c) ?? 0
      return { class: c, shares: n, value, valuePerShare: n > 0 ? roundPrice(value / n) : null }
    }),
  }
}

/**
 * OPM backsolve (AICPA guide): the total equity value at which the OPM allocates exactly the
 * observed arm's-length price to one share of the calibration class. The allocated per-share
 * value rises monotonically with total equity value, so bisection on [0, upper] converges;
 * the result is reported with the residual error.
 */
export function opmBacksolveEquityValue(
  schedule: BreakpointSchedule,
  calibration: { class: string; pricePerShare: number },
  params: OptionParams,
): { equityValue: number; calibrationError: number; iterations: number } {
  checkParams(params)
  if (!schedule.classes.includes(calibration.class)) throw new RangeError(`calibration class ${calibration.class} is not in the schedule`)
  if (!(calibration.pricePerShare > 0)) throw new RangeError('calibration pricePerShare must be > 0')
  const n = classShares(schedule).get(calibration.class) ?? 0
  if (!(n > 0)) throw new RangeError(`calibration class ${calibration.class} has no shares`)
  const perShare = (v: number) => (opmAllocate(schedule, v, params).classes.find((c) => c.class === calibration.class)?.value ?? 0) / n
  let lo = 0
  let hi = Math.max(1, calibration.pricePerShare * n)
  let guard = 0
  while (perShare(hi) < calibration.pricePerShare) {
    hi *= 2
    if (++guard > 80) throw new RangeError('backsolve did not bracket the calibration price')
  }
  let iterations = 0
  for (; iterations < 200 && hi - lo > 1e-7 * hi; iterations++) {
    const mid = (lo + hi) / 2
    if (perShare(mid) < calibration.pricePerShare) lo = mid
    else hi = mid
  }
  const equityValue = (lo + hi) / 2
  return { equityValue, calibrationError: perShare(equityValue) - calibration.pricePerShare, iterations }
}

// ---------------------------------------------------------------------------
// PWERM and hybrid
// ---------------------------------------------------------------------------

export interface PwermScenario {
  name: string
  kind: 'ipo' | 'm&a' | 'dissolution' | 'other'
  probability: number
  /** Headline exit value in the scenario (the waterfall applies its deductions). */
  exitValue: number
  yearsToExit: number
  /** ISO exit date for this scenario. Required when the structure accrues by date (notes, or
   * cumulative dividends without accruedAmount), so each scenario accrues its own claims. */
  exitDate?: string
  /** Annual discount rate, percent (PV = value ÷ (1 + r)^t). An input. */
  discountRatePct: number
}

export interface PwermResult {
  scenarios: { name: string; kind: PwermScenario['kind']; probability: number; presentValueFactor: number; byClass: { class: string; exitProceeds: number }[] }[]
  classes: ClassAllocation[]
}

/**
 * PWERM (AICPA guide): each scenario's exit proceeds are allocated by the waterfall
 * (waterfall.waterfallAnalysis), discounted at the scenario's rate over its term, and weighted
 * by its probability. Probabilities are inputs and must sum to 1.
 */
export function pwermAllocate(inputs: WaterfallAnalysisInputs, scenarios: readonly PwermScenario[], probabilityTotal = 1): PwermResult {
  if (scenarios.length === 0) throw new RangeError('at least one scenario is required')
  let p = 0
  for (const s of scenarios) {
    if (!(s.probability >= 0 && s.probability <= 1)) throw new RangeError(`scenario ${s.name}: probability must be in [0, 1]`)
    if (!(s.yearsToExit >= 0) || !(s.discountRatePct > -100) || !(s.exitValue >= 0)) throw new RangeError(`scenario ${s.name}: invalid term, rate or exit value`)
    p += s.probability
  }
  if (Math.abs(p - probabilityTotal) > 1e-9) throw new RangeError(`scenario probabilities must sum to ${probabilityTotal} (got ${p})`)
  const accruesByDate =
    (inputs.notes ?? []).length > 0 || (inputs.series ?? []).some((x) => x.dividends?.cumulative && x.dividends.accruedAmount === undefined)
  if (accruesByDate && scenarios.some((s) => s.exitDate === undefined)) {
    throw new RangeError('the structure accrues interest or dividends by date: give every scenario an exitDate')
  }
  const schedule = waterfallBreakpoints(inputs)
  const shares = classShares(schedule)
  const value = new Map<string, number>(schedule.classes.map((c) => [c, 0]))
  const out = scenarios.map((s) => {
    const r = waterfallAnalysis(s.exitDate === undefined ? inputs : { ...inputs, exitDate: s.exitDate }, s.exitValue)
    const pv = 1 / Math.pow(1 + s.discountRatePct / 100, s.yearsToExit)
    for (const c of r.classes) value.set(c.class, (value.get(c.class) ?? 0) + s.probability * pv * c.total)
    return { name: s.name, kind: s.kind, probability: s.probability, presentValueFactor: pv, byClass: r.classes.map((c) => ({ class: c.class, exitProceeds: c.total })) }
  })
  return {
    scenarios: out,
    classes: schedule.classes.map((c) => {
      const n = shares.get(c) ?? 0
      const v = value.get(c) ?? 0
      return { class: c, shares: n, value: v, valuePerShare: n > 0 ? roundPrice(v / n) : null }
    }),
  }
}

// ---------------------------------------------------------------------------
// The orchestrating entrypoint
// ---------------------------------------------------------------------------

export type OpmValueSource = { equityValue: number } | { backsolve: { class: string; pricePerShare: number } }

export type Prototype409aMethod =
  | { method: 'opm-forward'; equityValue: number; option: OptionParams }
  | { method: 'opm-backsolve'; calibration: { class: string; pricePerShare: number }; option: OptionParams }
  | { method: 'pwerm'; scenarios: PwermScenario[] }
  | { method: 'hybrid'; scenarios: PwermScenario[]; opm: { probability: number; option: OptionParams } & OpmValueSource }

export interface Prototype409aRequest {
  /** The capital structure in waterfall-analysis form. OPM methods need no exit deductions. */
  structure: WaterfallAnalysisInputs
  method: Prototype409aMethod
  /** The common class whose per-share figure is reported before and after the DLOM. */
  commonClass?: string
  dlom: DlomSpec
}

export interface Prototype409aResult extends PrototypeFlags {
  method: Prototype409aMethod['method']
  /** Total equity value used by the OPM (forward input or backsolved); null for pure PWERM. */
  opmEquityValue: number | null
  backsolveCalibrationError: number | null
  /** Marketable (pre-DLOM) allocation by class. */
  classes: ClassAllocation[]
  opm: OpmAllocation | null
  pwerm: PwermResult | null
  dlom: DlomResult
  /** The common class figures. These are illustrative allocation outputs, not a fair market
   * value and not an exercise price. */
  common: {
    class: string
    allocatedValuePerShareMarketable: number
    allocatedValuePerShareAfterDlom: number
  }
  breakpoints: { equityValue: number; events: string[] }[]
  notes: string[]
}

const OptionParamsSchema = z.object({
  volatility: z.number(),
  termYears: z.number(),
  riskFreeRate: z.number(),
  dividendYield: z.number().optional(),
})
const ScenarioSchema = z.object({
  name: z.string(),
  kind: z.enum(['ipo', 'm&a', 'dissolution', 'other']),
  probability: z.number(),
  exitValue: z.number(),
  yearsToExit: z.number(),
  discountRatePct: z.number(),
  exitDate: z.string().optional(),
})
const CalibrationSchema = z.object({ class: z.string(), pricePerShare: z.number() })

/** Structural schema of Prototype409aRequest (value rules stay in the functions). */
export const Prototype409aRequestSchema = z.object({
  structure: WaterfallAnalysisInputsSchema,
  method: z.discriminatedUnion('method', [
    z.object({ method: z.literal('opm-forward'), equityValue: z.number(), option: OptionParamsSchema }),
    z.object({ method: z.literal('opm-backsolve'), calibration: CalibrationSchema, option: OptionParamsSchema }),
    z.object({ method: z.literal('pwerm'), scenarios: z.array(ScenarioSchema) }),
    z.object({
      method: z.literal('hybrid'),
      scenarios: z.array(ScenarioSchema),
      opm: z.union([
        z.object({ probability: z.number(), option: OptionParamsSchema, equityValue: z.number() }),
        z.object({ probability: z.number(), option: OptionParamsSchema, backsolve: CalibrationSchema }),
      ]),
    }),
  ]),
  commonClass: z.string().optional(),
  dlom: z.discriminatedUnion('method', [
    z.object({ method: z.literal('none') }),
    z.object({ method: z.literal('finnerty'), volatility: z.number(), termYears: z.number(), dividendYield: z.number().optional() }),
    z.object({ method: z.literal('chaffe'), volatility: z.number(), termYears: z.number(), riskFreeRate: z.number(), dividendYield: z.number().optional() }),
    z.object({ method: z.literal('stated'), fraction: z.number(), source: z.string() }),
  ]),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const estimate409aPrototypeEntry = entrySpec('estimate409aPrototype', [{ name: 'request', schema: Prototype409aRequestSchema }])

function opmFrom(structure: WaterfallAnalysisInputs, source: OpmValueSource, option: OptionParams) {
  assertNoDeductions(structure)
  const schedule = waterfallBreakpoints(structure)
  if ('equityValue' in source) return { schedule, allocation: opmAllocate(schedule, source.equityValue, option), error: null }
  const solved = opmBacksolveEquityValue(schedule, source.backsolve, option)
  return { schedule, allocation: opmAllocate(schedule, solved.equityValue, option), error: solved.calibrationError }
}

/**
 * Run one prototype method and apply the chosen DLOM to the common class. Hybrid (AICPA guide):
 * the PWERM scenarios carry their probabilities and the OPM scenario carries the remainder;
 * the class values are the probability-weighted sum. The DLOM is applied once to the weighted
 * common figure.
 */
export function estimate409aPrototype(request: Prototype409aRequest): Prototype409aResult {
  estimate409aPrototypeEntry.validate(request)
  const m = request.method
  let classes: ClassAllocation[]
  let opm: OpmAllocation | null = null
  let pwerm: PwermResult | null = null
  let backsolveError: number | null = null
  let schedule: BreakpointSchedule
  if (m.method === 'opm-forward' || m.method === 'opm-backsolve') {
    const src: OpmValueSource = m.method === 'opm-forward' ? { equityValue: m.equityValue } : { backsolve: m.calibration }
    const r = opmFrom(request.structure, src, m.option)
    schedule = r.schedule
    opm = r.allocation
    backsolveError = r.error
    classes = opm.classes
  } else if (m.method === 'pwerm') {
    pwerm = pwermAllocate(request.structure, m.scenarios)
    schedule = waterfallBreakpoints(request.structure)
    classes = pwerm.classes
  } else {
    const po = m.opm.probability
    if (!(po > 0 && po < 1)) throw new RangeError('hybrid: the OPM scenario probability must be in (0, 1)')
    pwerm = pwermAllocate(request.structure, m.scenarios, 1 - po)
    const r = opmFrom(request.structure, m.opm, m.opm.option)
    schedule = r.schedule
    opm = r.allocation
    backsolveError = r.error
    classes = pwerm.classes.map((c) => {
      const o = opm?.classes.find((x) => x.class === c.class)
      const value = c.value + po * (o?.value ?? 0)
      return { class: c.class, shares: c.shares, value, valuePerShare: c.shares > 0 ? roundPrice(value / c.shares) : null }
    })
  }
  const commonClass = request.commonClass ?? 'Common'
  const common = classes.find((c) => c.class === commonClass)
  if (!common || !(common.shares > 0)) throw new RangeError(`common class ${commonClass} not found in the structure`)
  const dlom = resolveDlom(request.dlom)
  const marketable = common.value / common.shares
  return {
    ...flags(),
    method: m.method,
    opmEquityValue: opm?.equityValue ?? null,
    backsolveCalibrationError: backsolveError,
    classes,
    opm,
    pwerm,
    dlom,
    common: {
      class: commonClass,
      allocatedValuePerShareMarketable: roundPrice(marketable),
      allocatedValuePerShareAfterDlom: roundPrice(marketable * (1 - dlom.fraction)),
    },
    breakpoints: schedule.breakpoints.map((b) => ({ equityValue: b.equityValue, events: b.events })),
    notes: [
      PROTOTYPE_LABEL,
      'Volatility, term, risk-free rate, scenarios, probabilities, discount rates and the DLOM method are inputs chosen by the user; an appraiser selects and supports them.',
      'Breakpoints come from waterfall.waterfallBreakpoints; the charter controls every term.',
      'A recent preferred price does not automatically equal common value (rule us-fed.reasonable-method).',
    ],
  }
}
