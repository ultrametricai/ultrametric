// ISO vs NSO exercise tax mechanics (founder directive 2026-10-01: "go super deep on
// business logic — tax mechanics, everything").
//
// Pure, client-safe, deterministic. Every formula cites a dated rule card in open-law/US-FED/
// backed by primary sources (IRC via verified statutory text, Treasury regulations, IRS
// publications — see the cards' source_ids); the vitest gate
// (lib/openstartup/__tests__/optionTax.test.ts) asserts every ruleId resolves to a
// committed, jurisdiction-matched card, and replays the published worked examples:
// - Treas. Reg. § 1.422-4(d) Examples 2 and 3 for the $100,000 ISO limit (order-granted
//   attribution, whole-option conversion, and bifurcation), number-for-number.
// - Rev. Proc. 2024-40 § 2.11 complete-phaseout amounts as the arithmetic check on the AMT
//   exemption phaseout (threshold + exemption / 0.25 reproduces every published figure).
//
// Interfaces consumed from the equity lane (vesting / 409A-method mechanics live there):
// - vesting outputs arrive as PLAIN INPUTS: the per-calendar-year first-exercisable share
//   counts for the $100k limit (IsoGrant.firstExercisable) are the equity lane's
//   vesting-schedule output, never derived here;
// - the grant-date FMV and strike are inputs (the equityComp/grant409aSanity posture: this
//   repo never invents an FMV);
// - the early-exercise flag arrives as `substantiallyVestedAtExercise: false` — what that
//   flag does to § 83 timing is computed here, the flag itself is the equity lane's.
//
// Honest-scope notes:
// - TAX OUTCOMES DEPEND ON FACTS. Every result is needsReview: true, educational, not tax
//   advice, and never an authorization to exercise, sell, withhold, or file.
// - Regular-tax and AMT rates/thresholds that change yearly are asOf-dated parameter
//   objects (AMT_PARAMS_2025 / AMT_PARAMS_2026, SUPPLEMENTAL_WITHHOLDING_2026) carrying their rule card —
//   never claimed current.
// - AMT exposure is a clearly-labeled ILLUSTRATION from explicit hypothetical inputs
//   (26%/28% two-bracket tentative tax on AMTI net of the phased-out exemption). A real
//   Form 6251 has capital-gain rate interactions, credits, and state items this cannot
//   honestly package — `producesFilingComputation: false` by construction.
// - Day counting at the exact § 422(a)(1) anniversary boundary is a legal determination;
//   the boundary case is flagged, not decided.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { entrySpec } from './entryValidation'
import { addUtcMonths } from './grant409aSanity'

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const OPTION_TAX_RULE_IDS = {
  nsoSpread: { ruleId: 'us-fed.nso-spread-ordinary-income', jurisdiction: 'US-FED' },
  supplementalWithholding: { ruleId: 'us-fed.supplemental-wage-withholding-2026', jurisdiction: 'US-FED' },
  isoNoRegularIncome: { ruleId: 'us-fed.iso-exercise-no-regular-income', jurisdiction: 'US-FED' },
  isoHoldingPeriods: { ruleId: 'us-fed.iso-holding-periods-disqualifying', jurisdiction: 'US-FED' },
  iso100kLimit: { ruleId: 'us-fed.iso-100k-limit', jurisdiction: 'US-FED' },
  isoAmtAdjustment: { ruleId: 'us-fed.iso-amt-adjustment', jurisdiction: 'US-FED' },
  amtExemption: { ruleId: 'us-fed.amt-exemption-2025', jurisdiction: 'US-FED' },
  amtExemption2026: { ruleId: 'us-fed.amt-exemption-2026', jurisdiction: 'US-FED' },
} as const

const DISCLAIMER =
  'Educational tax-mechanics model, not tax advice; outcomes depend on facts a pure function cannot verify, and nothing here authorizes an exercise, sale, withholding, or filing.'

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

function assertNonNegative(n: number, what: string): void {
  if (!(n >= 0)) throw new RangeError(`${what} must be >= 0`)
}

function assertPositiveInt(n: number, what: string): void {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`${what} must be a positive integer`)
}

// ---------------------------------------------------------------------------
// NSO: spread at exercise is ordinary wage income, with withholding mechanics
// ---------------------------------------------------------------------------

export interface NsoExerciseResult {
  /** shares x (FMV − strike) − amountPaidForOption, floored at 0; Pub 525's rule. */
  ordinaryIncome: number
  exerciseCost: number
  /** Regular-tax basis afterward: exercise cost + income included. */
  basisAfterExercise: number
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * NSO exercise — rule `us-fed.nso-spread-ordinary-income` (Pub 525, nonstatutory option
 * without a readily determinable grant-date FMV): ordinary compensation income at exercise
 * = FMV of the stock received − (amount paid for the stock + amount paid for the option).
 * For employees it is wages: employment taxes and income tax withholding apply (see
 * supplementalWithholdingIllustration for the published withholding rates).
 */
export function nsoExerciseIncome(inputs: {
  shares: number
  strikePerShare: number
  fmvPerShare: number
  /** Amount paid for the option itself, usually 0 for compensatory options. */
  amountPaidForOption?: number
}): NsoExerciseResult {
  assertPositiveInt(inputs.shares, 'shares')
  assertNonNegative(inputs.strikePerShare, 'strikePerShare')
  if (!(inputs.fmvPerShare > 0)) throw new RangeError('fmvPerShare must be > 0 (a real exercise-date FMV, supplied — never computed here)')
  const optionCost = inputs.amountPaidForOption ?? 0
  assertNonNegative(optionCost, 'amountPaidForOption')
  const exerciseCost = round2(inputs.shares * inputs.strikePerShare)
  const ordinaryIncome = round2(Math.max(0, inputs.shares * inputs.fmvPerShare - exerciseCost - optionCost))
  return {
    ordinaryIncome,
    exerciseCost,
    basisAfterExercise: round2(exerciseCost + optionCost + ordinaryIncome),
    ...OPTION_TAX_RULE_IDS.nsoSpread,
    needsReview: true,
    note: `NSO spread at exercise is ordinary wage income (withholding applies for employees). If the stock received is substantially nonvested (early exercise), § 83 timing and the 83(b) election change this — see election83b.ts. ${DISCLAIMER}`,
  }
}

/** 2026 supplemental wage withholding parameters — rule
 * `us-fed.supplemental-wage-withholding-2026` (Pub 15 (2026), verified 2026-10-01).
 * asOf-dated; these change with the rate tables and are never claimed current. */
export const SUPPLEMENTAL_WITHHOLDING_2026 = {
  asOf: '2026-10-01',
  taxYear: 2026,
  optionalFlatRate: 0.22,
  mandatoryRateOverThreshold: 0.37,
  /** Cumulative supplemental wages in the calendar year above which 37% is mandatory. */
  mandatoryThreshold: 1_000_000,
  ...OPTION_TAX_RULE_IDS.supplementalWithholding,
} as const

export interface WithholdingIllustration {
  kind: 'illustration'
  withholding: number
  flatRatePortion: number
  mandatoryRatePortion: number
  taxYear: number
  asOf: string
  ruleId: string
  needsReview: true
  note: string
}

/**
 * ILLUSTRATION ONLY — withholding is not the tax. Applies the published supplemental-wage
 * rates to a payment (e.g. an NSO spread): the optional 22% flat rate up to the point
 * cumulative supplemental wages for the year cross $1,000,000, and the mandatory 37% on
 * the excess. The aggregate method may apply instead; the employee settles actual
 * liability on the return (rule caveat).
 */
export function supplementalWithholdingIllustration(
  payment: number,
  ytdSupplementalWagesBefore = 0,
  params = SUPPLEMENTAL_WITHHOLDING_2026,
): WithholdingIllustration {
  assertNonNegative(payment, 'payment')
  assertNonNegative(ytdSupplementalWagesBefore, 'ytdSupplementalWagesBefore')
  const total = ytdSupplementalWagesBefore + payment
  const overBefore = Math.max(0, ytdSupplementalWagesBefore - params.mandatoryThreshold)
  const overAfter = Math.max(0, total - params.mandatoryThreshold)
  const mandatoryPortion = overAfter - overBefore
  const flatPortion = payment - mandatoryPortion
  const flatRatePortion = round2(flatPortion * params.optionalFlatRate)
  const mandatoryRatePortion = round2(mandatoryPortion * params.mandatoryRateOverThreshold)
  return {
    kind: 'illustration',
    withholding: round2(flatRatePortion + mandatoryRatePortion),
    flatRatePortion,
    mandatoryRatePortion,
    taxYear: params.taxYear,
    asOf: params.asOf,
    ruleId: params.ruleId,
    needsReview: true,
    note: `Published ${params.taxYear} supplemental rates (${params.optionalFlatRate * 100}% optional flat; ${params.mandatoryRateOverThreshold * 100}% mandatory over $${params.mandatoryThreshold.toLocaleString('en-US')} cumulative). Withholding is not the tax owed. ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// ISO: no regular-tax income at exercise, but an AMT adjustment
// ---------------------------------------------------------------------------

export interface IsoExerciseResult {
  /** 0 by § 421(a)(1) when § 422(a) is met — the point of the ISO. */
  regularTaxIncome: 0
  /** shares x (FMV − strike): the § 56(b)(3) AMT inclusion, when the stock received is
   * substantially vested at exercise. Deferred (null) otherwise — § 83 timing. */
  amtIncomeAdjustment: number | null
  regularTaxBasis: number
  /** AMT basis reflects the inclusion (rule us-fed.iso-amt-adjustment); null when the
   * adjustment is deferred. */
  amtBasis: number | null
  ruleIds: string[]
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * ISO exercise — rules `us-fed.iso-exercise-no-regular-income` (§ 421(a): no regular-tax
 * income at exercise) and `us-fed.iso-amt-adjustment` (§ 56(b)(3): § 421 does not apply
 * for AMT, so the spread enters AMTI at exercise under § 83 timing). The
 * `substantiallyVestedAtExercise: false` input is the equity lane's early-exercise flag:
 * unvested stock defers the AMT inclusion to vesting unless an 83(b) election is filed
 * (election83b.ts owns that arithmetic).
 */
export function isoExerciseOutcome(inputs: {
  shares: number
  strikePerShare: number
  fmvPerShare: number
  substantiallyVestedAtExercise?: boolean
}): IsoExerciseResult {
  assertPositiveInt(inputs.shares, 'shares')
  assertNonNegative(inputs.strikePerShare, 'strikePerShare')
  if (!(inputs.fmvPerShare > 0)) throw new RangeError('fmvPerShare must be > 0 (supplied, never computed here)')
  const vested = inputs.substantiallyVestedAtExercise ?? true
  const cost = round2(inputs.shares * inputs.strikePerShare)
  const spread = round2(Math.max(0, inputs.shares * (inputs.fmvPerShare - inputs.strikePerShare)))
  return {
    regularTaxIncome: 0,
    amtIncomeAdjustment: vested ? spread : null,
    regularTaxBasis: cost,
    amtBasis: vested ? round2(cost + spread) : null,
    ruleIds: [OPTION_TAX_RULE_IDS.isoNoRegularIncome.ruleId, OPTION_TAX_RULE_IDS.isoAmtAdjustment.ruleId],
    jurisdiction: 'US-FED',
    needsReview: true,
    note: vested
      ? `No regular-tax income at exercise (§ 421(a)); the $${spread.toLocaleString('en-US')} spread is an AMT inclusion this year (§ 56(b)(3)) — a same-year disqualifying disposition can eliminate it. ISO qualification conditions are not verified here. ${DISCLAIMER}`
      : `No regular-tax income at exercise (§ 421(a)); the stock is substantially nonvested (early exercise), so the AMT inclusion is deferred to vesting under § 83 timing unless an 83(b) election is filed — see election83b.ts. ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// The $100,000 ISO limit (§ 422(d), Treas. Reg. § 1.422-4)
// ---------------------------------------------------------------------------

export interface IsoGrant {
  /** Stable label for the report. */
  id: string
  /** Grant date, ISO YYYY-MM-DD — the § 422(d)(2) ordering key. */
  grantDate: string
  /** FMV per share DETERMINED AT GRANT (§ 422(d)(3)) — supplied, never computed here. */
  grantDateFmvPerShare: number
  /** Shares first exercisable per calendar year — the equity lane's vesting output,
   * consumed as a plain input (acceleration must already be reflected here; Reg.
   * § 1.422-4(d) Example 3 shows acceleration pulling shares into the earlier year). */
  firstExercisable: readonly { year: number; shares: number }[]
}

/** Structural schema of IsoGrant — the registry entry contract (field names and types;
 * value and date rules stay in the function). */
export const IsoGrantSchema = z.object({
  id: z.string(),
  grantDate: z.string(),
  grantDateFmvPerShare: z.number(),
  firstExercisable: z.array(z.object({ year: z.number(), shares: z.number() })),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const iso100kAttributionEntry = entrySpec('iso100kAttribution', [
  { name: 'grants', schema: z.array(IsoGrantSchema) },
])

export interface IsoLimitSlice {
  grantId: string
  year: number
  isoShares: number
  nsoShares: number
  /** Grant-date FMV dollars counted against the year's $100,000 budget. */
  isoValue: number
  /** Grant-date FMV dollars treated as nonstatutory. */
  nsoValue: number
}

export interface IsoLimitReport {
  slices: IsoLimitSlice[]
  /** Remaining budget per calendar year after attribution (0 when the limit bound). */
  remainingByYear: Record<number, number>
  limit: number
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/** The statutory annual limit (§ 422(d), not inflation-indexed — rule card caveat). */
export const ISO_ANNUAL_LIMIT = 100_000

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * § 422(d) attribution — rule `us-fed.iso-100k-limit`: per calendar year, take grants in
 * the order granted (§ 422(d)(2)); count grant-date FMV (§ 422(d)(3)) of shares first
 * exercisable that year against the $100,000 budget; the excess is treated as
 * nonstatutory, and a single option bifurcates (Reg. § 1.422-4(b)).
 *
 * Share-granularity convention (explicit): the regulation allocates by FMV dollars; with
 * whole shares the ISO share count is floored, so a share that would straddle the
 * boundary is treated as NSO (the conservative direction). Tests replay Reg.
 * § 1.422-4(d) Examples 2 and 3 number-for-number.
 */
export function iso100kAttribution(grants: readonly IsoGrant[]): IsoLimitReport {
  iso100kAttributionEntry.validate(grants)
  const ordered = [...grants]
  for (const g of ordered) {
    if (!ISO_DATE_RE.test(g.grantDate)) throw new RangeError(`grant ${g.id}: grantDate must be YYYY-MM-DD`)
    if (!(g.grantDateFmvPerShare > 0)) throw new RangeError(`grant ${g.id}: grantDateFmvPerShare must be > 0`)
    for (const fe of g.firstExercisable) assertPositiveInt(fe.shares, `grant ${g.id} year ${fe.year} shares`)
  }
  ordered.sort((a, b) => (a.grantDate === b.grantDate ? 0 : a.grantDate < b.grantDate ? -1 : 1))
  const remainingByYear: Record<number, number> = {}
  const slices: IsoLimitSlice[] = []
  const years = [...new Set(ordered.flatMap((g) => g.firstExercisable.map((fe) => fe.year)))].sort((a, b) => a - b)
  for (const year of years) {
    let remaining = ISO_ANNUAL_LIMIT
    for (const grant of ordered) {
      for (const fe of grant.firstExercisable) {
        if (fe.year !== year) continue
        const isoShares = Math.min(fe.shares, Math.floor((remaining + 1e-9) / grant.grantDateFmvPerShare))
        const isoValue = round2(isoShares * grant.grantDateFmvPerShare)
        const nsoShares = fe.shares - isoShares
        slices.push({
          grantId: grant.id,
          year,
          isoShares,
          nsoShares,
          isoValue,
          nsoValue: round2(nsoShares * grant.grantDateFmvPerShare),
        })
        remaining = round2(remaining - isoValue)
      }
    }
    remainingByYear[year] = remaining
  }
  return {
    slices,
    remainingByYear,
    limit: ISO_ANNUAL_LIMIT,
    ...OPTION_TAX_RULE_IDS.iso100kLimit,
    needsReview: true,
    note: `Grant-date FMV, order-granted attribution, NSO spillover (§ 422(d); Reg. § 1.422-4). Acceleration, cancellations, employer aggregation, and plan self-limits are facts that must already be reflected in the inputs. ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// Dispositions: qualifying vs disqualifying (§ 422(a)(1), § 421(b), § 422(c)(2))
// ---------------------------------------------------------------------------

export interface IsoDispositionResult {
  kind: 'qualifying' | 'disqualifying'
  /** Ordinary compensation income in the year of disposition (0 when qualifying). */
  ordinaryIncome: number
  /** Regular-tax basis after any ordinary inclusion: exercise cost + ordinaryIncome. */
  regularTaxBasis: number
  /** amountRealized − regularTaxBasis (capital character; sign tells gain vs loss). */
  capitalGainOrLoss: number
  /** The two statutory clocks, as nominal UTC calendar dates. */
  holdingPeriodEnds: { twoYearsFromGrant: string; oneYearFromExercise: string }
  /** True when the disposition lands exactly on an anniversary — "within" is a legal
   * day-counting question this module flags, not decides. */
  anniversaryBoundary: boolean
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * ISO disposition math — rule `us-fed.iso-holding-periods-disqualifying`.
 * Qualifying (held MORE than 2 years from grant AND more than 1 year from exercise):
 * no ordinary income; the whole amountRealized − exercise cost is capital gain/loss
 * (long-term by the 1-year leg) for regular tax.
 * Disqualifying: § 421(b) puts the exercise spread into ordinary income in the year of
 * disposition; when the disposition is a loss-recognizing sale, § 422(c)(2) caps the
 * inclusion at amountRealized − exercise cost (never below 0). Basis then steps up by the
 * inclusion; the remainder is capital. AMT runs on its own basis (§ 56(b)(3)) — surfaced
 * in the note, not computed here.
 */
export function isoDisposition(inputs: {
  grantDate: string
  exerciseDate: string
  dispositionDate: string
  shares: number
  strikePerShare: number
  /** FMV per share on the exercise date — supplied, never computed here. */
  fmvAtExercisePerShare: number
  amountRealized: number
  /** § 422(c)(2) applies only to dispositions on which a loss would be recognized
   * (not wash/related-party sales). Default true for an ordinary market sale. */
  lossWouldBeRecognized?: boolean
}): IsoDispositionResult {
  for (const [k, v] of Object.entries({ grantDate: inputs.grantDate, exerciseDate: inputs.exerciseDate, dispositionDate: inputs.dispositionDate })) {
    if (!ISO_DATE_RE.test(v)) throw new RangeError(`${k} must be YYYY-MM-DD`)
  }
  if (inputs.exerciseDate < inputs.grantDate) throw new RangeError('exerciseDate must be on or after grantDate')
  if (inputs.dispositionDate < inputs.exerciseDate) throw new RangeError('dispositionDate must be on or after exerciseDate')
  assertPositiveInt(inputs.shares, 'shares')
  assertNonNegative(inputs.strikePerShare, 'strikePerShare')
  if (!(inputs.fmvAtExercisePerShare > 0)) throw new RangeError('fmvAtExercisePerShare must be > 0')
  assertNonNegative(inputs.amountRealized, 'amountRealized')

  const twoYearsFromGrant = addUtcMonths(inputs.grantDate, 24)
  const oneYearFromExercise = addUtcMonths(inputs.exerciseDate, 12)
  const anniversaryBoundary =
    inputs.dispositionDate === twoYearsFromGrant || inputs.dispositionDate === oneYearFromExercise
  const qualifying = inputs.dispositionDate > twoYearsFromGrant && inputs.dispositionDate > oneYearFromExercise
  const cost = round2(inputs.shares * inputs.strikePerShare)
  const spread = round2(Math.max(0, inputs.shares * (inputs.fmvAtExercisePerShare - inputs.strikePerShare)))
  const boundaryNote = anniversaryBoundary
    ? ' The disposition lands exactly on a statutory anniversary — whether that is "within" the period is a legal day-counting determination; treated as disqualifying here, confirm with counsel.'
    : ''

  if (qualifying) {
    return {
      kind: 'qualifying',
      ordinaryIncome: 0,
      regularTaxBasis: cost,
      capitalGainOrLoss: round2(inputs.amountRealized - cost),
      holdingPeriodEnds: { twoYearsFromGrant, oneYearFromExercise },
      anniversaryBoundary,
      ...OPTION_TAX_RULE_IDS.isoHoldingPeriods,
      needsReview: true,
      note: `Qualifying disposition: the entire gain over the $${cost.toLocaleString('en-US')} exercise cost is capital (long-term by the one-year leg) for regular tax. AMT basis differs if a § 56(b)(3) inclusion was taken at exercise. ${DISCLAIMER}`,
    }
  }

  const saleAtLoss = inputs.amountRealized < round2(inputs.shares * inputs.fmvAtExercisePerShare)
  const lossRule = inputs.lossWouldBeRecognized ?? true
  const ordinaryIncome =
    saleAtLoss && lossRule ? Math.min(spread, round2(Math.max(0, inputs.amountRealized - cost))) : spread
  const regularTaxBasis = round2(cost + ordinaryIncome)
  return {
    kind: 'disqualifying',
    ordinaryIncome,
    regularTaxBasis,
    capitalGainOrLoss: round2(inputs.amountRealized - regularTaxBasis),
    holdingPeriodEnds: { twoYearsFromGrant, oneYearFromExercise },
    anniversaryBoundary,
    ...OPTION_TAX_RULE_IDS.isoHoldingPeriods,
    needsReview: true,
    note: `Disqualifying disposition: $${ordinaryIncome.toLocaleString('en-US')} of the exercise spread becomes ordinary income in the disposition year (§ 421(b)${saleAtLoss && lossRule ? ', capped by § 422(c)(2) because the sale was below exercise-date FMV' : ''}); § 421(b) requires no employer withholding on it. A same-year disposition can eliminate the AMT adjustment (§ 56(b)(3)).${boundaryNote} ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// AMT exposure — ILLUSTRATION ONLY
// ---------------------------------------------------------------------------

export type AmtFilingStatus = 'joint' | 'single' | 'marriedFilingSeparately' | 'estateOrTrust'

export interface AmtParams {
  asOf: string
  taxYear: number
  ruleId: string
  /** Cents per dollar of AMTI over the threshold, as a fraction — 0.25 for 2025, 0.50 for
   * 2026 (P.L. 119-21 § 70107). Confirmed by the published complete-phaseout amounts
   * (threshold + exemption / rate reproduces each one; replayed in the tests). */
  phaseoutRate: number
  lowRate: number
  highRate: number
  byStatus: Record<AmtFilingStatus, { exemption: number; phaseoutThreshold: number; highRateBreakpoint: number }>
}

/** 2025 AMT parameters — rule `us-fed.amt-exemption-2025` (Rev. Proc. 2024-40 § 2.11,
 * verified against the published PDF 2026-10-01). asOf-dated illustration inputs; the
 * amounts adjust annually and are never claimed current. */
export const AMT_PARAMS_2025: AmtParams = {
  asOf: '2026-10-01',
  taxYear: 2025,
  ruleId: OPTION_TAX_RULE_IDS.amtExemption.ruleId,
  phaseoutRate: 0.25,
  lowRate: 0.26,
  highRate: 0.28,
  byStatus: {
    joint: { exemption: 137_000, phaseoutThreshold: 1_252_700, highRateBreakpoint: 239_100 },
    single: { exemption: 88_100, phaseoutThreshold: 626_350, highRateBreakpoint: 239_100 },
    marriedFilingSeparately: { exemption: 68_500, phaseoutThreshold: 626_350, highRateBreakpoint: 119_550 },
    estateOrTrust: { exemption: 30_700, phaseoutThreshold: 102_500, highRateBreakpoint: 239_100 },
  },
}

/** 2026 AMT parameters — rule `us-fed.amt-exemption-2026` (Rev. Proc. 2025-32 § 2.10,
 * verified against the published PDF 2026-10-14). P.L. 119-21 § 70107 reset the § 55(d)(2)
 * phaseout thresholds ($500,000 / $1,000,000 joint) and doubled the phaseout rate to 50
 * cents per dollar. asOf-dated illustration inputs; the amounts adjust annually and are
 * never claimed current. */
export const AMT_PARAMS_2026: AmtParams = {
  asOf: '2026-10-14',
  taxYear: 2026,
  ruleId: OPTION_TAX_RULE_IDS.amtExemption2026.ruleId,
  phaseoutRate: 0.5,
  lowRate: 0.26,
  highRate: 0.28,
  byStatus: {
    joint: { exemption: 140_200, phaseoutThreshold: 1_000_000, highRateBreakpoint: 244_500 },
    single: { exemption: 90_100, phaseoutThreshold: 500_000, highRateBreakpoint: 244_500 },
    marriedFilingSeparately: { exemption: 70_100, phaseoutThreshold: 500_000, highRateBreakpoint: 122_250 },
    estateOrTrust: { exemption: 31_400, phaseoutThreshold: 104_800, highRateBreakpoint: 244_500 },
  },
}

export interface AmtExposureIllustration {
  kind: 'illustration'
  /** Hypothetical AMTI = amtiExcludingIso + isoSpread. */
  amti: number
  exemptionAfterPhaseout: number
  taxableExcess: number
  tentativeMinimumTax: number
  /** max(0, TMT − regularTaxForComparison) when a comparison figure was supplied. */
  amtOverRegularTax: number | null
  taxYear: number
  asOf: string
  ruleIds: string[]
  producesFilingComputation: false
  needsReview: true
  note: string
}

/**
 * CLEARLY-LABELED ILLUSTRATION of AMT exposure from explicit hypothetical inputs — rules
 * `us-fed.iso-amt-adjustment` (why the spread is in AMTI) and the asOf-dated amounts card
 * the params object names (`us-fed.amt-exemption-2026` by default; pass AMT_PARAMS_2025
 * for a 2025 exercise). Mechanics per § 55(b)(1)/(d): exemption reduced at the year's
 * published rate per dollar of AMTI over the threshold (floored at 0), then 26% up to the
 * breakpoint and 28% above on the remainder. NOT a Form 6251 computation: capital-gains
 * rate interactions, credits, the § 53 minimum tax credit, and state tax are all outside
 * these inputs.
 */
export function amtExposureIllustration(inputs: {
  /** Hypothetical AMTI before the ISO adjustment — an explicit input, not derived. */
  amtiExcludingIso: number
  isoSpread: number
  filingStatus: AmtFilingStatus
  params?: AmtParams
  /** Optional regular-tax figure to show max(0, TMT − regular) — also hypothetical. */
  regularTaxForComparison?: number
}): AmtExposureIllustration {
  assertNonNegative(inputs.amtiExcludingIso, 'amtiExcludingIso')
  assertNonNegative(inputs.isoSpread, 'isoSpread')
  const params = inputs.params ?? AMT_PARAMS_2026
  const s = params.byStatus[inputs.filingStatus]
  if (!s) throw new RangeError(`unknown filing status ${String(inputs.filingStatus)}`)
  const amti = round2(inputs.amtiExcludingIso + inputs.isoSpread)
  const exemptionAfterPhaseout = round2(
    Math.max(0, s.exemption - params.phaseoutRate * Math.max(0, amti - s.phaseoutThreshold)),
  )
  const taxableExcess = round2(Math.max(0, amti - exemptionAfterPhaseout))
  const tentativeMinimumTax = round2(
    taxableExcess <= s.highRateBreakpoint
      ? params.lowRate * taxableExcess
      : params.lowRate * s.highRateBreakpoint + params.highRate * (taxableExcess - s.highRateBreakpoint),
  )
  const amtOverRegularTax =
    inputs.regularTaxForComparison === undefined
      ? null
      : round2(Math.max(0, tentativeMinimumTax - inputs.regularTaxForComparison))
  return {
    kind: 'illustration',
    amti,
    exemptionAfterPhaseout,
    taxableExcess,
    tentativeMinimumTax,
    amtOverRegularTax,
    taxYear: params.taxYear,
    asOf: params.asOf,
    ruleIds: [OPTION_TAX_RULE_IDS.isoAmtAdjustment.ruleId, params.ruleId],
    producesFilingComputation: false,
    needsReview: true,
    note: `ILLUSTRATION from hypothetical inputs with ${params.taxYear} amounts (asOf ${params.asOf}) — never a filing computation: Form 6251 has capital-gain rates, credits, and the § 53 credit this ignores. ${DISCLAIMER}`,
  }
}
