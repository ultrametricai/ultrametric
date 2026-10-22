// R&D tax mechanics, honest scope (founder directive 2026-10-01): § 174/§ 174A
// capitalization/amortization arithmetic as cited explanation + straight-line math from
// explicit inputs, and the § 41(h) payroll-tax-offset election MECHANICS. This module
// computes NOTHING about whether research qualifies and never computes the credit amount
// itself — those are § 41(d) facts and Form 6765 elections (the rule cards' caveats).
//
// Pure, client-safe, deterministic. Rule cards (open-law/US-FED/, primary sources verified
// live 2026-10-01):
// - us-fed.research-expenditure-amortization — current § 174 (foreign, 15-year, midpoint)
//   + § 174A (domestic, deductible after 2024, elective >= 60-month amortization) + the
//   PRIOR domestic 5-year midpoint regime for taxable years beginning 2022-2024 recorded
//   from the amendment notes. LAW IN FLUX: the card records what the cited text said on
//   its checked date — this module never editorializes currentness.
// - us-fed.rd-payroll-offset — § 41(h) QSB election ($250,000, +$250,000 for taxable
//   years beginning after 2022), § 3111(f), and the Form 8974 quarterly mechanics
//   (first-quarter-after-filing start; SS-first-then-Medicare; carryforward).
//
// The midpoint convention, made explicit: amortizing "ratably over the N-year period
// beginning with the midpoint of the taxable year" gives a HALF year of amortization in
// year one (1/2N of the amount), full years (1/N) in years 2..N, and the remaining half
// year in year N+1. For the 5-year domestic regime that is the published 10/20/20/20/20/10
// pattern ($100,000 -> $10,000 in year one), replayed in the tests.
//
// Honest-scope notes: eligibility is ALWAYS needs_review; amounts are asOf-dated; every
// result is educational decision support, never an authorization to deduct, elect, or
// file. State R&D credits are out of scope entirely.
// ---------------------------------------------------------------------------

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const RD_RULE_IDS = {
  amortization: { ruleId: 'us-fed.research-expenditure-amortization', jurisdiction: 'US-FED' },
  payrollOffset: { ruleId: 'us-fed.rd-payroll-offset', jurisdiction: 'US-FED' },
} as const

const DISCLAIMER =
  'Educational arithmetic over explicit inputs, not tax advice; whether expenditures are qualified research and every election are facts and counsel questions — nothing here authorizes a deduction, election, or filing.'

function round2(x: number): number {
  return Math.round(x * 100) / 100 + 0
}

function assertPositive(n: number, what: string): void {
  if (!(n > 0)) throw new RangeError(`${what} must be > 0`)
}

export interface AmortizationYear {
  /** 1-based taxable-year index from the year the amount was paid or incurred. */
  year: number
  deduction: number
}

export interface AmortizationSchedule {
  schedule: AmortizationYear[]
  periodYears: number
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * Straight-line amortization with the statutory midpoint convention — rule
 * `us-fed.research-expenditure-amortization`: half of one year's ratable amount in year
 * one, full amounts in years 2..N, the remaining half in year N+1. Cents-exact: each year
 * is rounded to cents and the final year absorbs the rounding remainder so the schedule
 * sums to the amount exactly.
 */
export function midpointAmortizationSchedule(amount: number, periodYears: number): AmortizationSchedule {
  assertPositive(amount, 'amount')
  if (!Number.isInteger(periodYears) || periodYears < 1) throw new RangeError('periodYears must be a positive integer')
  const full = amount / periodYears
  const schedule: AmortizationYear[] = []
  let allocated = 0
  for (let year = 1; year <= periodYears + 1; year++) {
    const ideal = year === 1 || year === periodYears + 1 ? full / 2 : full
    const deduction = year === periodYears + 1 ? round2(amount - allocated) : round2(ideal)
    allocated = round2(allocated + deduction)
    schedule.push({ year, deduction })
  }
  return {
    schedule,
    periodYears,
    ...RD_RULE_IDS.amortization,
    needsReview: true,
    note: `Ratable over ${periodYears} years beginning with the midpoint of year one (half-year convention). Short years, dispositions (no § 174 recovery on disposition under the capitalization regimes), and transition rules are not modeled. ${DISCLAIMER}`,
  }
}

/**
 * The PRIOR domestic regime (taxable years beginning 2022-2024, recorded from § 174's
 * amendment notes): 5-year midpoint amortization — the published 10/20/20/20/20/10
 * pattern. Still what governs amortization that started in those years (transition
 * guidance is the caveat's).
 */
export function domesticSre5YearSchedule(amount: number): AmortizationSchedule {
  return midpointAmortizationSchedule(amount, 5)
}

/** Current § 174: FOREIGN research or experimental expenditures, 15-year midpoint. */
export function foreignSre15YearSchedule(amount: number): AmortizationSchedule {
  return midpointAmortizationSchedule(amount, 15)
}

export interface DomesticSre2025Treatment {
  /** § 174A(a): currently deductible (no election). */
  currentDeduction: number | null
  /** § 174A(c) election: ratable monthly amount over >= 60 months, starting the month
   * benefits are first realized — a FACT, not a computable date. */
  election?: { months: number; monthlyAmount: number }
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * Domestic expenditures for taxable years beginning after December 31, 2024 — rule
 * `us-fed.research-expenditure-amortization` (§ 174A): deduct currently, or elect
 * amortization over a chosen period of NOT LESS than 60 months beginning with the month
 * benefits are first realized (note: a monthly convention, not the § 174 midpoint one).
 */
export function domesticSre2025Treatment(amount: number, election?: { months: number }): DomesticSre2025Treatment {
  assertPositive(amount, 'amount')
  if (election !== undefined) {
    if (!Number.isInteger(election.months) || election.months < 60) {
      throw new RangeError('§ 174A(c) election period must be an integer of not less than 60 months')
    }
    return {
      currentDeduction: null,
      election: { months: election.months, monthlyAmount: round2(amount / election.months) },
      ...RD_RULE_IDS.amortization,
      needsReview: true,
      note: `§ 174A(c) election: ratable over ${election.months} months beginning with the month benefits are first realized (a fact this module cannot determine). Law in flux — the law rule records the text as of its checked date. ${DISCLAIMER}`,
    }
  }
  return {
    currentDeduction: amount,
    ...RD_RULE_IDS.amortization,
    needsReview: true,
    note: `§ 174A(a): domestic research or experimental expenditures for taxable years beginning after 2024 are currently deductible. Law in flux — the law rule records the text as of its checked date; § 280C interactions with the § 41 credit are out of scope. ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// § 41(h) payroll-tax offset: eligibility conditions, the cap, quarterly mechanics
// ---------------------------------------------------------------------------

export type ConditionStatus = 'met' | 'not-met' | 'needs_review'

export interface OffsetCondition {
  condition: string
  status: ConditionStatus
  note: string
}

export interface QsbOffsetEligibility {
  conditions: OffsetCondition[]
  /** not-met if a computable condition failed; otherwise ALWAYS needs_review —
   * whether the research itself qualifies (§ 41(d)) is never computable here. */
  overall: 'not-met' | 'needs_review'
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/** § 41(h) QSB gross-receipts ceiling (statutory, not indexed — rule card). */
export const QSB_GROSS_RECEIPTS_CEILING = 5_000_000

/**
 * Qualified-small-business conditions for the § 41(h) election — rule
 * `us-fed.rd-payroll-offset`: gross receipts below $5,000,000 for the taxable year
 * (§ 448(c)(3) rules), no gross receipts before the 5-taxable-year period ending with the
 * taxable year, and no election in 5 or more preceding years. ELIGIBILITY IS ALWAYS
 * needs_review overall: qualified research (§ 41(d)) and the credit amount are not inputs.
 */
export function qsbPayrollOffsetEligibility(inputs: {
  grossReceiptsCurrentYear: number
  /** Any gross receipts in any taxable year before the 5-taxable-year period ending with
   * the credit year? 'unknown' is the honest default. */
  hadGrossReceiptsBeforeFiveYearPeriod?: boolean | 'unknown'
  priorElectionYears?: number
}): QsbOffsetEligibility {
  if (!(inputs.grossReceiptsCurrentYear >= 0)) throw new RangeError('grossReceiptsCurrentYear must be >= 0')
  const priorElections = inputs.priorElectionYears ?? 0
  if (!Number.isInteger(priorElections) || priorElections < 0) throw new RangeError('priorElectionYears must be a non-negative integer')
  const before = inputs.hadGrossReceiptsBeforeFiveYearPeriod ?? 'unknown'
  const conditions: OffsetCondition[] = [
    {
      condition: `Gross receipts below $${QSB_GROSS_RECEIPTS_CEILING.toLocaleString('en-US')} for the taxable year (§ 41(h)(3)(A)(i)(I))`,
      status: inputs.grossReceiptsCurrentYear < QSB_GROSS_RECEIPTS_CEILING ? 'met' : 'not-met',
      note: 'Determined under § 448(c)(3) rules (aggregation, short years) — the reported figure must already follow them.',
    },
    {
      condition: 'No gross receipts before the 5-taxable-year period ending with the taxable year (§ 41(h)(3)(A)(i)(II))',
      status: before === 'unknown' ? 'needs_review' : before ? 'not-met' : 'met',
      note:
        before === 'unknown'
          ? 'History not supplied — any receipts in an earlier year (even trivial ones) disqualify.'
          : before
            ? 'Gross receipts existed before the 5-year window as reported — not a qualified small business.'
            : 'No earlier receipts as reported; the first-receipts year is a facts determination.',
    },
    {
      condition: 'Fewer than 5 preceding election years (§ 41(h)(1)(B))',
      status: priorElections < 5 ? 'met' : 'not-met',
      note: `${priorElections} preceding election year(s) reported; aggregated-group members count together.`,
    },
  ]
  const failed = conditions.some((c) => c.status === 'not-met')
  return {
    conditions,
    overall: failed ? 'not-met' : 'needs_review',
    ...RD_RULE_IDS.payrollOffset,
    needsReview: true,
    note: `Whether the research itself is qualified research (§ 41(d)) and the credit amount (Form 6765) are NOT established here — eligibility is always a facts determination. ${DISCLAIMER}`,
  }
}

/**
 * The election cap — rule `us-fed.rd-payroll-offset` (§ 41(h)): $250,000, plus an
 * additional $250,000 for taxable years beginning after December 31, 2022.
 */
export function payrollOffsetElectionCap(taxYearBeginsAfter2022: boolean): number {
  return taxYearBeginsAfter2022 ? 500_000 : 250_000
}

export interface QuarterLiability {
  /** e.g. '2026-Q2'. Quarters must be in chronological order, each beginning after the
   * income tax return making the election was filed (Form 8974 instructions). */
  label: string
  employerSocialSecurityTax: number
  employerMedicareTax: number
}

export interface QuarterApplication {
  label: string
  appliedToSocialSecurity: number
  appliedToMedicare: number
  carryforwardAfter: number
}

export interface OffsetApplicationReport {
  electedAmount: number
  quarters: QuarterApplication[]
  totalApplied: number
  /** Still carried forward after the supplied quarters. */
  remaining: number
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * Quarterly application mechanics — rule `us-fed.rd-payroll-offset` (Form 8974
 * instructions, post-2022 elections): each quarter, the credit first reduces the employer
 * share of social security tax up to $250,000 per quarter; the first $250,000 of the
 * ELECTION can only ever offset that share; the remainder of the election reduces the
 * employer share of Medicare tax; anything left carries to the next quarter. For
 * elections from taxable years beginning in 2022 or earlier the whole (<= $250,000)
 * election is social-security-only. The offset starts in the first calendar quarter
 * beginning after the return was filed — supplying the right quarters is the caller's
 * fact, flagged in the note.
 */
export function quarterlyOffsetApplication(inputs: {
  electedAmount: number
  taxYearBeginsAfter2022: boolean
  quarters: readonly QuarterLiability[]
}): OffsetApplicationReport {
  assertPositive(inputs.electedAmount, 'electedAmount')
  const cap = payrollOffsetElectionCap(inputs.taxYearBeginsAfter2022)
  if (inputs.electedAmount > cap) {
    throw new RangeError(`electedAmount exceeds the § 41(h) cap of $${cap.toLocaleString('en-US')} for this election year`)
  }
  // The first $250,000 of the election offsets only the employer SS share; the rest
  // (post-2022 elections) offsets the employer Medicare share.
  let ssPool = round2(Math.min(inputs.electedAmount, 250_000))
  let medicarePool = round2(inputs.electedAmount - ssPool)
  const quarters: QuarterApplication[] = []
  for (const q of inputs.quarters) {
    if (!(q.employerSocialSecurityTax >= 0) || !(q.employerMedicareTax >= 0)) {
      throw new RangeError(`${q.label}: liabilities must be >= 0`)
    }
    const ssUse = round2(Math.min(ssPool, 250_000, q.employerSocialSecurityTax))
    ssPool = round2(ssPool - ssUse)
    const medUse = round2(Math.min(medicarePool, q.employerMedicareTax))
    medicarePool = round2(medicarePool - medUse)
    quarters.push({
      label: q.label,
      appliedToSocialSecurity: ssUse,
      appliedToMedicare: medUse,
      carryforwardAfter: round2(ssPool + medicarePool),
    })
  }
  const remaining = round2(ssPool + medicarePool)
  return {
    electedAmount: inputs.electedAmount,
    quarters,
    totalApplied: round2(inputs.electedAmount - remaining),
    remaining,
    ...RD_RULE_IDS.payrollOffset,
    needsReview: true,
    note: `Form 8974 structure: SS share first (up to $250,000/quarter; the election's first $250,000 is SS-only), then Medicare for post-2022 elections, carryforward after both. The offset starts the first calendar quarter beginning AFTER the electing return was filed — the supplied quarters must respect that. Line-level Form 941/8974 limits may differ. ${DISCLAIMER}`,
  }
}
