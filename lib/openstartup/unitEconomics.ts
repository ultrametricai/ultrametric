// Unit economics — LTV/CAC, burn multiple, Rule of 40, magic number (founder ask
// 2026-10-02: "what open modules can we improve logic-wise?"). Pure arithmetic over
// EXPLICIT inputs: every number (ARPA, churn, margin, spend, burn, net new ARR) is the
// caller's, every formula cites its canonical published formulation, and benchmark
// comparisons take the benchmark AS AN INPUT — this module encodes no benchmark tables
// (the published bands live at the cited URLs; the caller supplies the one they are
// comparing against, and every comparison is needsReview).
//
// Pure, client-safe (no node builtins), deterministic. Registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/unitEconomics.test.ts.
// The adjacent runway module owns cash trajectories (Paul Graham's default-alive model);
// this module owns the efficiency RATIOS computed over the same explicit inputs.
//
// Sources (each formula's doc comment cites the specific one; all verified 2026-10-02):
// - David Skok, "SaaS Metrics 2.0 – Detailed Definitions"
//   (https://www.forentrepreneurs.com/saas-metrics-2-definitions/): customer lifetime =
//   1 / churn rate (3% monthly → ~33 months; 20% annual → 5 years), LTV = ARPA × Gross
//   Margin % ÷ churn rate, CAC = S&M spend ÷ new customers, months to recover CAC =
//   CAC ÷ (ARPA × Gross Margin %), Net MRR churn = (churned MRR − expansion MRR) ÷
//   beginning MRR, Net New MRR = new + expansion − churned. The LTV:CAC > 3 and
//   CAC-payback guidelines are the source's published bands — inputs here, never encoded.
// - David Sacks, "The Burn Multiple" (Craft Ventures, April 23, 2020,
//   https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200): Burn Multiple =
//   Net Burn ÷ Net New ARR, with the post's own worked examples ($2M burned for $1M net
//   new ARR = 2x; $5M for $1M = 5x) replayed in the tests, and its stated caveat that the
//   metric is not meaningful when net new ARR is zero or negative.
// - Brad Feld, "The Rule of 40% For a Healthy SaaS Company" (February 3, 2015,
//   https://feld.com/archives/2015/02/rule-40-healthy-saas-company/): "your growth rate +
//   your profit should add up to 40%" — growth as YoY MRR (or ARR) growth, profit as
//   EBITDA by preference; the post's 20+20 / 40+0 / 50−10 examples replayed. Feld scopes
//   the rule to companies at scale — scope relayed on the result, never decided here.
// - Rory O'Driscoll, "Magic Number Math" (Scale Venture Partners, April 20, 2010,
//   https://www.scalevp.com/blog/magic-number-math): magic number = (change in quarterly
//   subscription revenue × 4) ÷ the EARLIER quarter's sales & marketing spend. The post's
//   >1.0 / 0.5–1.0 / <0.5 reading is its published interpretation — an input here.
//
// Conventions: rates in PERCENT (0–100) like the rest of the toolkit; ratios and dollar
// results unrounded (display rounding is the caller's); divide-by-zero and sign guards are
// explicit RangeErrors or stated not-computable results, never NaN. Educational model, not
// financial advice: these are decision-support ratios, not a valuation, a forecast, or a
// substitute for the company's own books.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lifetime and LTV (Skok, SaaS Metrics 2.0 definitions)
// ---------------------------------------------------------------------------

/**
 * Average customer lifetime in periods: 1 / churn rate — Skok's definition ("If monthly
 * churn is 3%, lifetime = 33 months; if annual churn is 20%, lifetime = 5 years"; the 3%
 * figure is the source's display rounding of 33.33). The unit is whatever period the churn
 * rate is quoted in — pass monthly churn, get months.
 */
export function customerLifetimePeriods(churnRatePct: number): number {
  if (!(churnRatePct > 0 && churnRatePct <= 100)) throw new RangeError('churnRatePct must be in (0, 100]')
  return 100 / churnRatePct
}

/**
 * Simple LTV: ARPA ÷ churn rate (equivalently ARPA × customer lifetime) — Skok's basic
 * formulation, BEFORE gross margin. Prefer ltv() for anything decision-shaped: revenue is
 * not contribution.
 */
export function ltvSimple(arpa: number, churnRatePct: number): number {
  if (!(arpa >= 0)) throw new RangeError('arpa must be >= 0')
  return arpa * customerLifetimePeriods(churnRatePct)
}

/**
 * Margin-adjusted LTV: (ARPA × Gross Margin %) ÷ churn rate — Skok's "LTV with Gross
 * Margin". ARPA and the churn rate must be quoted over the SAME period (both monthly or
 * both annual); the result is lifetime gross-margin dollars per average account. Constant
 * ARPA and constant churn are the model's stated simplifications (expansion revenue makes
 * real LTV path-dependent — Skok's later DCF treatment is out of scope here).
 */
export function ltv(input: { arpa: number; grossMarginPct: number; churnRatePct: number }): number {
  if (!(input.arpa >= 0)) throw new RangeError('arpa must be >= 0')
  if (!(input.grossMarginPct >= 0 && input.grossMarginPct <= 100)) throw new RangeError('grossMarginPct must be in [0, 100]')
  return (input.arpa * (input.grossMarginPct / 100)) * customerLifetimePeriods(input.churnRatePct)
}

/** CAC: sales & marketing spend ÷ new customers acquired in the same period (Skok). */
export function cac(salesMarketingSpend: number, newCustomers: number): number {
  if (!(salesMarketingSpend >= 0)) throw new RangeError('salesMarketingSpend must be >= 0')
  if (!(newCustomers > 0)) throw new RangeError('newCustomers must be > 0')
  return salesMarketingSpend / newCustomers
}

/** LTV ÷ CAC. Skok's published guideline (ratio above 3) is the SOURCE's band — compare
 * via compareToBenchmark with the band as input, never a verdict from this function. */
export function ltvToCacRatio(ltvDollars: number, cacDollars: number): number {
  if (!(ltvDollars >= 0)) throw new RangeError('ltv must be >= 0')
  if (!(cacDollars > 0)) throw new RangeError('cac must be > 0')
  return ltvDollars / cacDollars
}

/** Months to recover CAC: CAC ÷ (ARPA × Gross Margin %) with MONTHLY ARPA — Skok. */
export function cacPaybackMonths(input: { cac: number; monthlyArpa: number; grossMarginPct: number }): number {
  if (!(input.cac >= 0)) throw new RangeError('cac must be >= 0')
  if (!(input.monthlyArpa > 0)) throw new RangeError('monthlyArpa must be > 0')
  if (!(input.grossMarginPct > 0 && input.grossMarginPct <= 100)) throw new RangeError('grossMarginPct must be in (0, 100]')
  return input.cac / (input.monthlyArpa * (input.grossMarginPct / 100))
}

// ---------------------------------------------------------------------------
// MRR movement (Skok)
// ---------------------------------------------------------------------------

/** Net New MRR = new MRR + expansion MRR − churned MRR (Skok). */
export function netNewMrr(input: { newMrr: number; expansionMrr: number; churnedMrr: number }): number {
  for (const [k, v] of Object.entries(input)) if (!(v >= 0)) throw new RangeError(`${k} must be >= 0`)
  return input.newMrr + input.expansionMrr - input.churnedMrr
}

/**
 * Net MRR churn rate: (churned MRR − expansion MRR) ÷ beginning MRR, in percent — Skok.
 * Negative is the goal (expansion outruns churn — "negative churn").
 */
export function netMrrChurnRatePct(input: { churnedMrr: number; expansionMrr: number; beginningMrr: number }): number {
  if (!(input.churnedMrr >= 0) || !(input.expansionMrr >= 0)) throw new RangeError('MRR components must be >= 0')
  if (!(input.beginningMrr > 0)) throw new RangeError('beginningMrr must be > 0')
  return ((input.churnedMrr - input.expansionMrr) / input.beginningMrr) * 100
}

/**
 * Annualized compounding of a monthly net churn rate: (1 − (1 − m)¹²) × 100 — the
 * arithmetic behind Skok's "above 2% per month … you are losing about 22% of your revenue
 * every year" (exactly 21.53% — the source says "about"). Works for negative (expansion)
 * rates too.
 */
export function annualizedNetChurnPct(monthlyNetChurnPct: number): number {
  if (!(monthlyNetChurnPct <= 100)) throw new RangeError('monthlyNetChurnPct must be <= 100')
  return (1 - (1 - monthlyNetChurnPct / 100) ** 12) * 100
}

// ---------------------------------------------------------------------------
// Burn multiple (Sacks)
// ---------------------------------------------------------------------------

export interface BurnMultipleReport {
  /** Net Burn ÷ Net New ARR — null when not computable (net new ARR ≤ 0, or no burn case
   * below). Both inputs over the SAME period (Sacks works in quarters). */
  multiple: number | null
  computable: boolean
  netBurn: number
  netNewArr: number
  needsReview: true
  note: string
}

/**
 * Burn Multiple = Net Burn ÷ Net New ARR — David Sacks, "The Burn Multiple" (Craft
 * Ventures, 2020-04-23). The post's own examples replay in the tests: $2M burned for $1M
 * net new ARR = 2x ("reasonable for an early-stage startup" — the post's words, not a
 * verdict of this function); $5M for $1M = 5x. Per the post's caveat, the metric is not
 * meaningful when net new ARR is zero or negative (pre-revenue "Wilderness Period",
 * shrinking ARR) — computable: false, no number invented. A company generating cash
 * (netBurn ≤ 0) while adding ARR reports 0 or negative — stated, since "burn" has ended.
 * The post's efficiency bands are ITS table — compare via compareToBenchmark.
 */
export function burnMultiple(input: { netBurn: number; netNewArr: number }): BurnMultipleReport {
  if (!Number.isFinite(input.netBurn) || !Number.isFinite(input.netNewArr)) throw new RangeError('inputs must be finite')
  const base = { netBurn: input.netBurn, netNewArr: input.netNewArr, needsReview: true as const }
  if (input.netNewArr <= 0) {
    return {
      ...base,
      multiple: null,
      computable: false,
      note:
        'Net new ARR is zero or negative — the burn multiple is not meaningful here (Sacks: pre-revenue or shrinking-ARR ' +
        'periods call for controlling burn, not computing the ratio).',
    }
  }
  return {
    ...base,
    multiple: input.netBurn / input.netNewArr,
    computable: true,
    note:
      'Burn Multiple = net burn ÷ net new ARR over the same period (Sacks, The Burn Multiple, 2020-04-23). ' +
      'Interpretation bands are the post’s published table — supply one via compareToBenchmark; never encoded here.',
  }
}

// ---------------------------------------------------------------------------
// Rule of 40 (Feld)
// ---------------------------------------------------------------------------

export interface RuleOf40Report {
  /** growth % + profit % — the published sum. */
  score: number
  /** score >= 40 — the 40 is the rule's OWN constant (its name), not a caller benchmark. */
  meetsRule: boolean
  needsReview: true
  note: string
}

/**
 * Rule of 40: "your growth rate + your profit should add up to 40%" — Brad Feld
 * (2015-02-03), crediting the rule to board conversations; growth as YoY MRR (or ARR)
 * growth, profit as EBITDA by preference (operating income / net income / FCF are the
 * post's stated backtests — the caller picks ONE and says which). The post's examples
 * replay in the tests: 20% + 20%, 40% + 0%, 50% − 10% all meet it. Feld scopes the rule
 * to SaaS companies at scale — relayed in the note, never decided here.
 */
export function ruleOf40(input: { revenueGrowthPct: number; profitMarginPct: number }): RuleOf40Report {
  if (!Number.isFinite(input.revenueGrowthPct) || !Number.isFinite(input.profitMarginPct))
    throw new RangeError('inputs must be finite percentages')
  const score = input.revenueGrowthPct + input.profitMarginPct
  return {
    score,
    meetsRule: score >= 40,
    needsReview: true,
    note:
      `Growth ${input.revenueGrowthPct}% + profit ${input.profitMarginPct}% = ${score}% (Feld, 2015-02-03: YoY MRR/ARR ` +
      `growth + EBITDA-preferred profit). The source scopes the rule to SaaS companies at scale; which profit measure ` +
      `was supplied is the caller's statement.`,
  }
}

// ---------------------------------------------------------------------------
// Magic number (O'Driscoll)
// ---------------------------------------------------------------------------

/**
 * Magic number = (current-quarter subscription revenue − prior-quarter subscription
 * revenue) × 4 ÷ the PRIOR quarter's sales & marketing spend — Rory O'Driscoll, "Magic
 * Number Math" (Scale Venture Partners, 2010-04-20): annualize the quarterly revenue
 * change and divide by the earlier quarter's S&M. The post's >1.0 / 0.5–1.0 / <0.5
 * reading is its published interpretation — an input to compareToBenchmark, not a verdict
 * here. Negative results (shrinking revenue) are returned as-is and speak for themselves.
 */
export function magicNumber(input: {
  currentQuarterRevenue: number
  priorQuarterRevenue: number
  priorQuarterSalesMarketingSpend: number
}): number {
  if (!(input.currentQuarterRevenue >= 0) || !(input.priorQuarterRevenue >= 0))
    throw new RangeError('quarterly revenues must be >= 0')
  if (!(input.priorQuarterSalesMarketingSpend > 0)) throw new RangeError('priorQuarterSalesMarketingSpend must be > 0')
  return ((input.currentQuarterRevenue - input.priorQuarterRevenue) * 4) / input.priorQuarterSalesMarketingSpend
}

// ---------------------------------------------------------------------------
// Benchmark comparisons — the benchmark is ALWAYS an input
// ---------------------------------------------------------------------------

export interface BenchmarkInput {
  /** Where the band comes from — a published source the caller cites (e.g. Skok's LTV:CAC
   * > 3, Sacks' burn-multiple table, O'Driscoll's 1.0x line). Required: an unsourced
   * benchmark is an opinion. */
  source: string
  threshold: number
  /** Which side of the threshold the source calls healthy. */
  healthyWhen: 'at-or-above' | 'at-or-below'
  label?: string
}

export interface BenchmarkComparison {
  value: number
  benchmark: BenchmarkInput
  meets: boolean
  needsReview: true
  note: string
}

/**
 * Compare a computed metric to a CALLER-SUPPLIED benchmark. House posture (founder
 * 2026-10-02): benchmarks are inputs, never encoded — this module ships no benchmark
 * tables, and every comparison is needsReview because a band published for one stage,
 * motion, or year does not transfer automatically to another.
 */
export function compareToBenchmark(value: number, benchmark: BenchmarkInput): BenchmarkComparison {
  if (!Number.isFinite(value) || !Number.isFinite(benchmark.threshold)) throw new RangeError('value and threshold must be finite')
  if (benchmark.source.trim().length === 0) throw new RangeError('benchmark.source is required — cite where the band comes from')
  const meets = benchmark.healthyWhen === 'at-or-above' ? value >= benchmark.threshold : value <= benchmark.threshold
  return {
    value,
    benchmark,
    meets,
    needsReview: true,
    note:
      `${benchmark.label ?? 'metric'} ${value} vs ${benchmark.healthyWhen} ${benchmark.threshold} ` +
      `(benchmark supplied by caller, source: ${benchmark.source}). Benchmarks are stage-, motion-, and vintage-specific ` +
      `— needs review.`,
  }
}
