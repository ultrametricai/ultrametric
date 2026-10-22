// QSBS — § 1202 mechanics (founder directive 2026-10-01: "go super deep on business
// logic — tax mechanics, everything").
//
// Pure, client-safe, deterministic; UTC ISO-date arithmetic only. Every legal condition
// cites a dated rule card in open-law/US-FED/ backed by the verified statutory text
// (26 U.S.C. §§ 1202, 1045 — checked 2026-10-01, INCLUDING the P.L. 119-21 (2025)
// amendments: the July 4, 2025 "applicable date" splits the regimes, so the $50M/$75M
// gross-asset ceilings, $10M/$15M caps, and 5-year vs 3/4/5-year tiers are all routed by
// acquisition/issuance date, never claimed as one current rule). The vitest gate
// (lib/openstartup/__tests__/qsbs.test.ts) asserts every ruleId resolves to a committed
// card and replays the cap arithmetic (greater of $10M or 10x basis — the worked example
// every reputable QSBS explainer publishes, re-derived here directly from § 1202(b)(1)).
//
// Interfaces consumed from the equity lane / sibling modules:
// - acquisition dates, basis amounts, and the 83(b)/vesting facts arrive as PLAIN INPUTS
//   (the holding clock consumes `election83bFiled` and a vesting date exactly the way
//   election83b.ts and the equity lane report them — rule
//   us-fed.restricted-property-holding-period: with the election the period starts at
//   transfer, without it at vesting; option stock starts at exercise);
// - the module never invents an FMV, a basis, or a gross-asset figure.
//
// Honest-scope notes:
// - ELIGIBILITY IS WHERE FACTS DECIDE: the checklist returns needs_review for every
//   condition the inputs cannot establish (active business, excluded fields, redemption
//   history, aggregation) — a 'met' on the computable conditions is never a QSBS opinion.
// - The § 1045 rollover is explained and cited, NOT computed (rule card caveat).
// - Indexed amounts (the post-2026 inflation adjustments to the $15M cap and $75M asset
//   ceiling) are flagged, not guessed.
// - Educational decision support, not tax advice; nothing here authorizes a sale, an
//   election, or a return position.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { entrySpec } from './entryValidation'
import { addUtcMonths } from './grant409aSanity'

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const QSBS_RULE_IDS = {
  eligibility: { ruleId: 'us-fed.qsbs-eligibility', jurisdiction: 'US-FED' },
  exclusionPercentage: { ruleId: 'us-fed.qsbs-exclusion-percentage', jurisdiction: 'US-FED' },
  perIssuerCap: { ruleId: 'us-fed.qsbs-per-issuer-cap', jurisdiction: 'US-FED' },
  rollover1045: { ruleId: 'us-fed.qsbs-1045-rollover', jurisdiction: 'US-FED' },
  holdingPeriod: { ruleId: 'us-fed.restricted-property-holding-period', jurisdiction: 'US-FED' },
} as const

const DISCLAIMER =
  'Educational § 1202 mechanics, not tax advice; eligibility depends on facts a pure function cannot verify, and nothing here authorizes a sale, election, or return position.'

/** § 1202's "applicable date" (P.L. 119-21): stock acquired after this date uses the
 * tiered percentages, the $15M cap, and the $75M gross-asset ceiling. */
export const QSBS_APPLICABLE_DATE = '2025-07-04'

export const QSBS_PARAMS = {
  asOf: '2026-10-01',
  classic: { capBase: 10_000_000, grossAssetCeiling: 50_000_000 },
  /** Post-applicable-date amounts; both indexed after 2026 — flagged, never guessed. */
  postApplicableDate: { capBase: 15_000_000, grossAssetCeiling: 75_000_000 },
  capBasisMultiple: 10,
} as const

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertIsoDate(date: string, what: string): void {
  if (!ISO_DATE_RE.test(date)) throw new RangeError(`${what} must be YYYY-MM-DD`)
}

function round2(x: number): number {
  return Math.round(x * 100) / 100 + 0
}

// ---------------------------------------------------------------------------
// Eligibility checklist — structured cited conditions, needs_review where facts decide
// ---------------------------------------------------------------------------

export type ConditionStatus = 'met' | 'not-met' | 'needs_review'

export interface QsbsCondition {
  condition: string
  status: ConditionStatus
  ruleId: string
  jurisdiction: 'US-FED'
  note: string
}

export interface QsbsEligibilityFacts {
  /** Issuance date of the stock (routes the gross-asset ceiling regime). */
  issuanceDate: string
  isCCorporation?: boolean | 'unknown'
  /** Acquired at original issuance for money, property other than stock, or services
   * (§ 1202(c)) — secondary purchases fail this. */
  acquiredAtOriginalIssuance?: boolean | 'unknown'
  /** Aggregate gross assets at all times before and immediately after issuance, if known. */
  aggregateGrossAssetsAtIssuance?: number
  /** Whether the business is in a § 1202(e)(3) excluded field (health, law, consulting,
   * financial services, hotels/restaurants, ... — the card lists them). */
  inExcludedField?: boolean | 'unknown'
}

const triStateSchema = z.union([z.boolean(), z.literal('unknown')])

/** Structural schema of QsbsEligibilityFacts — the registry entry contract (field names
 * and types; the checklist's tri-state logic stays in the function). */
export const QsbsEligibilityFactsSchema = z.object({
  issuanceDate: z.string(),
  isCCorporation: triStateSchema.optional(),
  acquiredAtOriginalIssuance: triStateSchema.optional(),
  aggregateGrossAssetsAtIssuance: z.number().optional(),
  inExcludedField: triStateSchema.optional(),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const qsbsEligibilityChecklistEntry = entrySpec('qsbsEligibilityChecklist', [
  { name: 'facts', schema: QsbsEligibilityFactsSchema },
])

export interface QsbsEligibilityReport {
  conditions: QsbsCondition[]
  /** 'not-met' if any condition failed as computed; otherwise ALWAYS needs_review — a
   * checklist of computable conditions is never a QSBS opinion. */
  overall: 'not-met' | 'needs_review'
  grossAssetCeilingApplied: number
  needsReview: true
  note: string
}

function triState(
  value: boolean | 'unknown' | undefined,
  condition: string,
  ruleId: string,
  metNote: string,
  notMetNote: string,
  unknownNote: string,
  invert = false,
): QsbsCondition {
  const v = value ?? 'unknown'
  const effective = v === 'unknown' ? 'unknown' : invert ? !v : v
  return {
    condition,
    status: effective === 'unknown' ? 'needs_review' : effective ? 'met' : 'not-met',
    ruleId,
    jurisdiction: 'US-FED',
    note: effective === 'unknown' ? unknownNote : effective ? metNote : notMetNote,
  }
}

/**
 * § 1202 eligibility as structured, cited conditions — rule `us-fed.qsbs-eligibility`.
 * Facts the inputs cannot establish return needs_review (the honest default): the active
 * business requirement ALWAYS does (80%-by-value over substantially all the holding
 * period is a facts-and-circumstances test), and so do redemptions and aggregation,
 * which are not even inputs here (the card's caveat).
 */
export function qsbsEligibilityChecklist(facts: QsbsEligibilityFacts): QsbsEligibilityReport {
  qsbsEligibilityChecklistEntry.validate(facts)
  assertIsoDate(facts.issuanceDate, 'issuanceDate')
  const post = facts.issuanceDate > QSBS_APPLICABLE_DATE
  const ceiling = post ? QSBS_PARAMS.postApplicableDate.grossAssetCeiling : QSBS_PARAMS.classic.grossAssetCeiling
  const r = QSBS_RULE_IDS.eligibility.ruleId
  const conditions: QsbsCondition[] = [
    triState(
      facts.isCCorporation,
      'C corporation (§ 1202(c)(1))',
      r,
      'Reported as a C corporation; status during substantially all the holding period also matters.',
      'Not a C corporation as reported — § 1202 requires C-corporation stock.',
      'Entity classification not supplied — a legal determination.',
    ),
    triState(
      facts.acquiredAtOriginalIssuance,
      'Original issuance for money, property (not stock), or services (§ 1202(c)(1)(B))',
      r,
      'Reported as acquired at original issue; redemption rules (§ 1202(c)(3)) can still disqualify.',
      'Acquired other than at original issuance as reported (e.g. a secondary purchase) — the stock fails § 1202(c).',
      'Acquisition path not supplied — original-issue facts decide.',
    ),
    facts.aggregateGrossAssetsAtIssuance === undefined
      ? {
          condition: `$${ceiling.toLocaleString('en-US')} aggregate gross assets test at issuance (§ 1202(d)(1))`,
          status: 'needs_review',
          ruleId: r,
          jurisdiction: 'US-FED',
          note: 'Aggregate gross assets (cash + aggregate adjusted bases, § 1202(d)(2)) not supplied — must hold at all times before and immediately after issuance.',
        }
      : {
          condition: `$${ceiling.toLocaleString('en-US')} aggregate gross assets test at issuance (§ 1202(d)(1))`,
          status: facts.aggregateGrossAssetsAtIssuance <= ceiling ? 'met' : 'not-met',
          ruleId: r,
          jurisdiction: 'US-FED',
          note:
            facts.aggregateGrossAssetsAtIssuance <= ceiling
              ? `Reported $${facts.aggregateGrossAssetsAtIssuance.toLocaleString('en-US')} is within the ${post ? 'post-applicable-date $75,000,000 (indexed after 2026 — verify the current amount)' : '$50,000,000'} ceiling; the test applies at ALL times before and immediately after issuance, not just a snapshot.`
              : `Reported $${facts.aggregateGrossAssetsAtIssuance.toLocaleString('en-US')} exceeds the ceiling — the issuance fails § 1202(d)(1) as computed.`,
        },
    {
      condition: 'Active business requirement: >= 80% by value in qualified trades (§ 1202(e))',
      status: 'needs_review',
      ruleId: r,
      jurisdiction: 'US-FED',
      note: 'Always a facts-and-circumstances determination over substantially all the holding period — never computable from these inputs.',
    },
    triState(
      facts.inExcludedField,
      'Not an excluded trade or business (§ 1202(e)(3))',
      r,
      'Reported as outside the excluded fields (health, law, consulting, financial services, hotels/restaurants, ...); the reputation-or-skill clause still needs counsel.',
      'Reported as an excluded field — the business is not a qualified trade or business.',
      'Field classification not supplied — the excluded-field list plus the reputation-or-skill clause are legal questions.',
      true,
    ),
  ]
  const failed = conditions.some((c) => c.status === 'not-met')
  return {
    conditions,
    overall: failed ? 'not-met' : 'needs_review',
    grossAssetCeilingApplied: ceiling,
    needsReview: true,
    note: `Checklist of the cited § 1202 conditions; redemptions, aggregation, and SSBIC rules are not inputs here, so 'met' answers never add up to eligibility. ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// The holding clock (with the 83(b)/vesting interplay)
// ---------------------------------------------------------------------------

export interface QsbsHoldingClock {
  /** When the § 1202 holding period starts under the cited holding-period rule. */
  clockStart: string | null
  /** Milestone dates from clockStart: the 5-year date for pre-applicable-date stock;
   * the 3/4/5-year tier dates for post-applicable-date stock. */
  milestones: { label: string; date: string }[]
  ruleIds: string[]
  needsReview: true
  note: string
}

/**
 * The 5-year (or 3/4/5-year) clock — rules `us-fed.qsbs-exclusion-percentage` (the
 * periods) and `us-fed.restricted-property-holding-period` (where it starts): option
 * stock starts at exercise; restricted stock starts at transfer WITH an 83(b) election
 * and at vesting without one (grant-date paper means nothing until § 83 timing runs).
 * Inputs are the equity lane's facts, consumed plain.
 */
export function qsbsHoldingClock(inputs: {
  /** The acquisition (issue/exercise/transfer) date. */
  acquisitionDate: string
  /** True when the stock was substantially nonvested at acquisition (restricted stock /
   * early exercise — the equity lane's flag). */
  substantiallyNonvestedAtAcquisition?: boolean
  election83bFiled?: boolean | 'unknown'
  /** Vesting date, required to place the clock when nonvested without an election. */
  vestingDate?: string
}): QsbsHoldingClock {
  assertIsoDate(inputs.acquisitionDate, 'acquisitionDate')
  if (inputs.vestingDate !== undefined) assertIsoDate(inputs.vestingDate, 'vestingDate')
  const ruleIds = [QSBS_RULE_IDS.exclusionPercentage.ruleId, QSBS_RULE_IDS.holdingPeriod.ruleId]
  let clockStart: string | null
  let startNote: string
  if (!(inputs.substantiallyNonvestedAtAcquisition ?? false)) {
    clockStart = inputs.acquisitionDate
    startNote = 'Vested at acquisition: the clock starts at the acquisition (for option stock, the exercise).'
  } else if (inputs.election83bFiled === true) {
    clockStart = inputs.acquisitionDate
    startNote = 'Substantially nonvested with an 83(b) election: the clock starts at transfer (the election is why).'
  } else if (inputs.election83bFiled === false && inputs.vestingDate !== undefined) {
    clockStart = inputs.vestingDate
    startNote = 'Substantially nonvested, no 83(b) election: the clock starts at vesting.'
  } else {
    clockStart = null
    startNote = 'Substantially nonvested and the 83(b)/vesting facts are incomplete — the clock cannot be placed.'
  }
  const post = clockStart !== null && inputs.acquisitionDate > QSBS_APPLICABLE_DATE
  const milestones =
    clockStart === null
      ? []
      : post
        ? [
            { label: '50% tier (3 years)', date: addUtcMonths(clockStart, 36) },
            { label: '75% tier (4 years)', date: addUtcMonths(clockStart, 48) },
            { label: '100% tier (5 years)', date: addUtcMonths(clockStart, 60) },
          ]
        : [{ label: 'more-than-5-years requirement', date: addUtcMonths(clockStart, 60) }]
  return {
    clockStart,
    milestones,
    ruleIds,
    needsReview: true,
    note: `${startNote} Acquisition date also routes the regime (acquired ${post ? 'after' : 'on or before'} the ${QSBS_APPLICABLE_DATE} applicable date); for nonvested stock without an 83(b) election, § 83 timing can place the acquisition at vesting and move it across the applicable date — a legal determination, routed here by the raw acquisition date. Exact day counting at a milestone boundary is a legal determination. ${DISCLAIMER}`,
  }
}

// ---------------------------------------------------------------------------
// Exclusion percentage and the per-issuer cap
// ---------------------------------------------------------------------------

export interface ExclusionPercentageResult {
  /** 0, 50, 75, or 100. */
  percentage: number
  regime: 'pre-2009-50' | '2009-75' | '2010-100' | 'post-applicable-tiered'
  /** True when the disposition lands exactly on a period boundary. */
  boundary: boolean
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * § 1202(a) exclusion percentage by acquisition date and holding — rule
 * `us-fed.qsbs-exclusion-percentage`. Pre-applicable-date regimes require holding MORE
 * than 5 years (50% general / 75% for 2009-02-18..2010-09-27 acquisitions / 100% for
 * 2010-09-28..2025-07-04); post-applicable-date stock earns 50% at >= 3 years, 75% at
 * >= 4, 100% at >= 5. Below the minimum: 0 (no exclusion).
 *
 * Holding is measured from `holdingStart` when supplied — qsbsHoldingClock.clockStart,
 * i.e. the § 83 timing (rule us-fed.restricted-property-holding-period: vesting for
 * substantially nonvested stock without an 83(b) election) — and defaults to the
 * acquisition date. The regime itself stays routed by the raw acquisition date, the
 * holding-clock module's stated convention.
 */
export function qsbsExclusionPercentage(
  acquisitionDate: string,
  dispositionDate: string,
  holdingStart?: string,
): ExclusionPercentageResult {
  assertIsoDate(acquisitionDate, 'acquisitionDate')
  assertIsoDate(dispositionDate, 'dispositionDate')
  if (holdingStart !== undefined) {
    assertIsoDate(holdingStart, 'holdingStart')
    if (holdingStart < acquisitionDate) throw new RangeError('holdingStart must be on or after acquisitionDate')
  }
  if (dispositionDate < acquisitionDate) throw new RangeError('dispositionDate must be on or after acquisitionDate')
  const start = holdingStart ?? acquisitionDate
  const y3 = addUtcMonths(start, 36)
  const y4 = addUtcMonths(start, 48)
  const y5 = addUtcMonths(start, 60)
  const base = { ruleId: QSBS_RULE_IDS.exclusionPercentage.ruleId, jurisdiction: 'US-FED' as const, needsReview: true as const }
  const startClause =
    start === acquisitionDate
      ? ''
      : ` Holding measured from ${start} (the holding-clock start — rule us-fed.restricted-property-holding-period), with the regime routed by the acquisition date.`

  if (acquisitionDate > QSBS_APPLICABLE_DATE) {
    const percentage = dispositionDate >= y5 ? 100 : dispositionDate >= y4 ? 75 : dispositionDate >= y3 ? 50 : 0
    return {
      percentage,
      regime: 'post-applicable-tiered',
      boundary: dispositionDate === y3 || dispositionDate === y4 || dispositionDate === y5,
      ...base,
      note: `Acquired after the ${QSBS_APPLICABLE_DATE} applicable date: tiered applicable percentage (50/75/100 at 3/4/5 years). ${percentage === 0 ? 'Held under 3 years — no exclusion.' : `${percentage}% as computed.`}${startClause} Boundary day counting is a legal determination. ${DISCLAIMER}`,
    }
  }
  const moreThan5 = dispositionDate > y5
  const regime = acquisitionDate >= '2010-09-28' ? '2010-100' : acquisitionDate >= '2009-02-18' ? '2009-75' : 'pre-2009-50'
  const pctByRegime = { '2010-100': 100, '2009-75': 75, 'pre-2009-50': 50 } as const
  return {
    percentage: moreThan5 ? pctByRegime[regime] : 0,
    regime,
    boundary: dispositionDate === y5,
    ...base,
    note: `Acquired on or before the applicable date: ${pctByRegime[regime]}% exclusion requires holding MORE than 5 years${moreThan5 ? ' — met as computed' : ' — not met as computed (consider § 1045 rollover, rule us-fed.qsbs-1045-rollover)'}.${startClause} 50%/75% stock carries the § 57(a)(7) AMT preference and 28%-rate-group treatment on the taxed portion (not computed). ${DISCLAIMER}`,
  }
}

export interface QsbsCapResult {
  /** The cap on eligible gain this taxable year for this issuer. */
  cap: number
  dollarLimb: number
  tenTimesBasisLimb: number
  governingLimb: 'dollar' | 'ten-times-basis'
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * The per-issuer cap — rule `us-fed.qsbs-per-issuer-cap` (§ 1202(b)(1)): the GREATER of
 * (A) $10,000,000 ($15,000,000 for post-applicable-date stock; halved for married filing
 * separately) minus prior-year eligible gain on the same issuer, and (B) 10 x the
 * aggregate adjusted bases of the issuer's QSBS disposed of this year.
 */
export function qsbsPerIssuerCap(inputs: {
  acquisitionDate: string
  /** Aggregate adjusted bases (§ 1202(i) rules) of this issuer's QSBS disposed of this
   * taxable year — supplied, never derived. */
  basisOfStockDisposed: number
  /** Eligible gain already taken in PRIOR years on this issuer (reduces the dollar limb). */
  priorYearEligibleGain?: number
  marriedFilingSeparately?: boolean
}): QsbsCapResult {
  assertIsoDate(inputs.acquisitionDate, 'acquisitionDate')
  if (!(inputs.basisOfStockDisposed >= 0)) throw new RangeError('basisOfStockDisposed must be >= 0')
  const prior = inputs.priorYearEligibleGain ?? 0
  if (!(prior >= 0)) throw new RangeError('priorYearEligibleGain must be >= 0')
  const post = inputs.acquisitionDate > QSBS_APPLICABLE_DATE
  let capBase = post ? QSBS_PARAMS.postApplicableDate.capBase : QSBS_PARAMS.classic.capBase
  if (inputs.marriedFilingSeparately ?? false) capBase = capBase / 2
  const dollarLimb = round2(Math.max(0, capBase - prior))
  const tenTimesBasisLimb = round2(QSBS_PARAMS.capBasisMultiple * inputs.basisOfStockDisposed)
  const cap = Math.max(dollarLimb, tenTimesBasisLimb)
  return {
    cap,
    dollarLimb,
    tenTimesBasisLimb,
    governingLimb: tenTimesBasisLimb > dollarLimb ? 'ten-times-basis' : 'dollar',
    ...QSBS_RULE_IDS.perIssuerCap,
    needsReview: true,
    note: `Greater of $${dollarLimb.toLocaleString('en-US')} (the ${post ? '$15,000,000 post-applicable-date base, indexed after 2026 — verify the current amount' : '$10,000,000 base'}${inputs.marriedFilingSeparately ? ', halved for MFS' : ''}, less prior-year eligible gain) and 10 x $${inputs.basisOfStockDisposed.toLocaleString('en-US')} basis = $${tenTimesBasisLimb.toLocaleString('en-US')}. Per issuer, per taxpayer, per year.${post ? ' § 1202(b)(4)(B) also reduces the $15,000,000 limb by SAME-year eligible gain on the issuer’s pre-applicable-date stock — not an input here, so a mixed-regime seller’s limb can be overstated (rule us-fed.qsbs-per-issuer-cap caveat).' : ''} ${DISCLAIMER}`,
  }
}

export interface QsbsExclusionIllustration {
  kind: 'illustration'
  eligibleGain: number
  exclusionPercentage: number
  excludedGain: number
  taxableGain: number
  cap: QsbsCapResult
  percentage: ExclusionPercentageResult
  ruleIds: string[]
  needsReview: true
  note: string
}

/**
 * The whole § 1202 arithmetic in one labeled illustration: cap the gain (§ 1202(b)),
 * apply the acquisition-date percentage (§ 1202(a)), with the holding measured from the
 * holding-clock start (qsbsHoldingClock — the 83(b)/vesting facts are consumed when the
 * stock was substantially nonvested at acquisition, and incomplete facts are refused, not
 * guessed). The gain, basis, and dates are explicit inputs; eligibility is NOT established
 * here (run qsbsEligibilityChecklist — and even that never establishes it).
 */
export function qsbsExclusionIllustration(inputs: {
  gain: number
  acquisitionDate: string
  dispositionDate: string
  basisOfStockDisposed: number
  priorYearEligibleGain?: number
  marriedFilingSeparately?: boolean
  /** Equity-lane holding facts (see qsbsHoldingClock): set when the stock was
   * substantially nonvested at acquisition — § 83 timing then places the clock start. */
  substantiallyNonvestedAtAcquisition?: boolean
  election83bFiled?: boolean | 'unknown'
  vestingDate?: string
}): QsbsExclusionIllustration {
  if (!(inputs.gain >= 0)) throw new RangeError('gain must be >= 0')
  const clock = qsbsHoldingClock({
    acquisitionDate: inputs.acquisitionDate,
    substantiallyNonvestedAtAcquisition: inputs.substantiallyNonvestedAtAcquisition,
    election83bFiled: inputs.election83bFiled,
    vestingDate: inputs.vestingDate,
  })
  if (clock.clockStart === null) {
    throw new RangeError(
      'the holding clock cannot be placed: substantially nonvested stock needs the 83(b)/vesting facts (qsbsHoldingClock)',
    )
  }
  const cap = qsbsPerIssuerCap(inputs)
  const percentage = qsbsExclusionPercentage(inputs.acquisitionDate, inputs.dispositionDate, clock.clockStart)
  const eligibleGain = round2(Math.min(inputs.gain, cap.cap))
  const excludedGain = round2((eligibleGain * percentage.percentage) / 100)
  return {
    kind: 'illustration',
    eligibleGain,
    exclusionPercentage: percentage.percentage,
    excludedGain,
    taxableGain: round2(inputs.gain - excludedGain),
    cap,
    percentage,
    ruleIds: [cap.ruleId, percentage.ruleId, QSBS_RULE_IDS.eligibility.ruleId, QSBS_RULE_IDS.holdingPeriod.ruleId],
    needsReview: true,
    note: `Assumes the stock IS qualified small business stock — eligibility is a separate, facts-driven question (qsbsEligibilityChecklist, rule us-fed.qsbs-eligibility). Taxed-portion character (28% rate group, § 57(a)(7) AMT preference for 50%/75% stock) is not computed. ${DISCLAIMER}`,
  }
}

/** § 1045 rollover — explained and cited, NEVER computed (rule card caveat). */
export const SECTION_1045_ROLLOVER = {
  ...QSBS_RULE_IDS.rollover1045,
  computed: false,
  summary:
    'A taxpayer other than a corporation holding QSBS for more than 6 months may elect to recognize gain only to the extent the amount realized exceeds the cost of replacement QSBS purchased within 60 days of the sale; unrecognized gain reduces the replacement stock\'s basis in the order acquired (26 U.S.C. § 1045(a), (b)(3)). Useful when a sale lands before the § 1202 holding period is met — election mechanics and replacement-stock qualification are counsel\'s questions.',
  needsReview: true,
} as const
