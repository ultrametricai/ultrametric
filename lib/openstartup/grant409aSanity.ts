// 409A grant sanity checks — the seventh module of the open-startup toolkit (founder
// direction 2026-10-01: "go further on the business modules").
//
// THIS IS A SANITY MODEL, NOT A VALUATION. It takes a real 409A fair market value as
// INPUT and never invents one — the same posture as equityComp ("takes the FMV as input,
// never invents one"). A credible valuation model needs appraisal methods, comparables,
// and judgment this repo cannot honestly package in a pure function, so this module is
// deliberately the smaller honest version: grant-timing and strike-floor checks against
// dated rule cards, plus comparisons that are clearly labeled illustrations. Every finding
// carries `needsReview: true` and the rule card it leans on.
//
// Pure, client-safe, deterministic; UTC ISO-date arithmetic only. Registered in
// open-modules/README.md; the vitest gate (lib/openstartup/__tests__/grant409aSanity.test.ts)
// asserts every ruleId in RULE_IDS_409A resolves to a committed card in rules/US-FED/.
//
// Rule cards (all citing IRS final regulations under section 409A — source
// `irs-final-reg-409a-2007`, Treas. Reg. § 1.409A-1(b)(5)):
// - us-fed.409a-stock-right-exception: the stock-right exception requires, among other
//   conditions, "an exercise price at least equal to fair market value on the grant date".
// - us-fed.reasonable-method: FMV of non-public stock comes from reasonable application of
//   a reasonable valuation method; caveat: "A financing price for preferred stock does not
//   automatically equal common-stock fair market value."
// - us-fed.staleness: a previously calculated value can be unreasonable if it fails to
//   reflect later material information or "was calculated more than 12 months before the
//   use date"; caveat: twelve months is not guaranteed validity.
// - us-fed.independent-appraisal-presumption: a qualifying independent appraisal dated no
//   more than 12 months before the transaction is one rebuttable presumption of
//   reasonableness — with additional conditions this module does not verify.
// Extension (equity-mechanics pass 2026-10-01) — the three § 409A presumption METHODS as
// structured, cited data plus eligibility checks, the refresh-trigger checklist, and the
// penalty mechanics as a labeled arithmetic illustration:
// - us-fed.illiquid-startup-presumption (Treas. Reg. § 1.409A-1(b)(5)(iv)(B)(2)(iii), via
//   source irs-final-reg-409a-2007): the illiquid-startup route's actual regulatory
//   conditions — written good-faith report, qualified person (significant knowledge,
//   experience, education, or training), under 10 years of material trade or business, no
//   publicly traded class, no put/call/other purchase obligation (ROFR and lapse
//   restrictions excepted), and no reasonably anticipated change in control within 90 days
//   or public offering within 180 days.
// - us-fed.binding-formula-presumption (Treas. Reg. § 1.409A-1(b)(5)(iv)(B)(2)(ii)): the
//   formula/nonlapse-restriction route with its same-manner-for-all-transfers condition.
// - us-fed.409a-penalty-additions (IRC § 409A(a)(1)(B), source usc-26-409a): 20% additional
//   tax plus interest at the underpayment rate + 1 point — computed here ONLY from explicit
//   hypothetical inputs, labeled an illustration.
// Still NOT a valuation: anything resembling OPM/backsolve or any other appraisal method is
// deliberately OUT of this module — a valuation needs appraisal judgment a pure function
// cannot honestly package. producesValuation stays false everywhere.
// Convention source: YC Post-Money Safe User Guide §B.6 (Feb 2023, verified 2026-10-01):
// "when a company signs a term sheet for a priced round, most 409A valuation firms take
// the position that the then-current 409A price can no longer be used for option grants."
//
// Date conventions (explicit): "12 months" is computed as a UTC calendar-month addition
// (JavaScript month arithmetic; a Feb 29 anniversary rolls to Mar 1). The regulation's day
// counting is a legal question — the boundary cases are exactly why every finding is
// needs-review. Educational model, not legal or tax advice.
// ---------------------------------------------------------------------------

import { roundPrice } from './capTable'

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const RULE_IDS_409A = {
  strikeFloor: { ruleId: 'us-fed.409a-stock-right-exception', jurisdiction: 'US-FED' },
  reasonableMethod: { ruleId: 'us-fed.reasonable-method', jurisdiction: 'US-FED' },
  staleness: { ruleId: 'us-fed.staleness', jurisdiction: 'US-FED' },
  appraisalPresumption: { ruleId: 'us-fed.independent-appraisal-presumption', jurisdiction: 'US-FED' },
  illiquidStartup: { ruleId: 'us-fed.illiquid-startup-presumption', jurisdiction: 'US-FED' },
  bindingFormula: { ruleId: 'us-fed.binding-formula-presumption', jurisdiction: 'US-FED' },
  penaltyAdditions: { ruleId: 'us-fed.409a-penalty-additions', jurisdiction: 'US-FED' },
} as const

export type SanityLevel = 'pass' | 'flag' | 'fail'

export interface SanityFinding {
  check: string
  /** pass: the rule's stated condition is met. flag: a judgment call a human must make.
   * fail: the stated condition is tripped as computed. NONE of the three is legal advice
   * or a valuation — hence needsReview on every level. */
  level: SanityLevel
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseIso(date: string, what: string): Date {
  if (!ISO_DATE_RE.test(date)) throw new RangeError(`${what}: expected YYYY-MM-DD, got ${JSON.stringify(date)}`)
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw new RangeError(`${what}: invalid calendar date ${date}`)
  }
  return d
}

/** UTC calendar-month addition (documented convention: Feb 29 + 12 months → Mar 1). */
export function addUtcMonths(iso: string, months: number): string {
  const d = parseIso(iso, 'date')
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Strike-price floor: the stock-right exception requires an exercise price at least equal
 * to the grant-date FMV — rule `us-fed.409a-stock-right-exception`. Both prices are
 * inputs; the FMV must come from a real 409A valuation. Even a pass is needs-review: the
 * exception has additional conditions (service-recipient stock, no deferral feature) this
 * module does not verify — the card's own caveat.
 */
export function strikeFloorCheck(strikePerShare: number, fmvPerShare: number): SanityFinding {
  if (!(strikePerShare >= 0)) throw new RangeError('strikePerShare must be >= 0')
  if (!(fmvPerShare > 0)) throw new RangeError('fmvPerShare must be > 0 (a real 409A FMV, supplied — never computed here)')
  const ok = strikePerShare >= fmvPerShare
  return {
    check: 'strike-floor',
    level: ok ? 'pass' : 'fail',
    ...RULE_IDS_409A.strikeFloor,
    needsReview: true,
    note: ok
      ? `Strike $${strikePerShare} >= grant-date FMV $${fmvPerShare}. The exception has additional conditions (service-recipient stock, no deferral feature) not verified here.`
      : `Strike $${strikePerShare} is BELOW the grant-date FMV $${fmvPerShare} — the stock-right exception's exercise-price condition is not met as computed. Counsel must review before any grant.`,
  }
}

export interface FmvAgeOptions {
  /** A priced-round term sheet signed after the FMV date: most 409A firms treat it as a
   * material event ending the old price's use for grants — YC User Guide §B.6. */
  termSheetSignedSinceFmv?: boolean
  /** Any other material change since the FMV date (new financing, major contract, ...).
   * 'unknown' is the honest default: whether information is material is a judgment. */
  materialChangeSinceFmv?: boolean | 'unknown'
}

/**
 * FMV staleness at the grant date — rule `us-fed.staleness`: a value "calculated more
 * than 12 months before the use date" can be unreasonable, and so can one that fails to
 * reflect later material information. Twelve months is a ceiling, never a guarantee (the
 * card's caveat), so even an in-window pass is needs-review.
 */
export function fmvAgeCheck(fmvAsOf: string, grantOn: string, options?: FmvAgeOptions): SanityFinding & { staleAfter: string } {
  const fmv = parseIso(fmvAsOf, 'fmvAsOf')
  const grant = parseIso(grantOn, 'grantOn')
  if (grant.getTime() < fmv.getTime()) throw new RangeError('grantOn must be on or after fmvAsOf')
  const staleAfter = addUtcMonths(fmvAsOf, 12)
  const stale = grantOn > staleAfter
  const materialChange = options?.materialChangeSinceFmv ?? 'unknown'
  const termSheet = options?.termSheetSignedSinceFmv ?? false

  let level: SanityLevel
  let note: string
  if (stale) {
    level = 'fail'
    note = `FMV of ${fmvAsOf} is more than 12 months old at the ${grantOn} grant (stale after ${staleAfter}) — the staleness condition is tripped as computed. A fresh determination is needed.`
  } else if (termSheet) {
    level = 'flag'
    note = `FMV is inside the 12-month window, but a priced-round term sheet was signed after ${fmvAsOf}: most 409A valuation firms treat that as a material event ending the old price's use for grants (YC Post-Money Safe User Guide §B.6). Get a fresh determination before granting.`
  } else if (materialChange === true) {
    level = 'flag'
    note = `FMV is inside the 12-month window, but a material change since ${fmvAsOf} was reported: a value that fails to reflect later material information can be unreasonable. Whether the change is reflected is a judgment for counsel and the valuation firm.`
  } else if (materialChange === 'unknown') {
    level = 'flag'
    note = `FMV is inside the 12-month window (stale after ${staleAfter}), but whether material information has arisen since ${fmvAsOf} is unknown — twelve months is not guaranteed validity (rule caveat). Confirm before granting.`
  } else {
    level = 'pass'
    note = `FMV of ${fmvAsOf} is inside the 12-month window at the ${grantOn} grant (stale after ${staleAfter}) and no material change was reported. Twelve months is a ceiling, not a guarantee — the valuation firm confirms continued reliance.`
  }
  return { check: 'fmv-age', level, ...RULE_IDS_409A.staleness, needsReview: true, note, staleAfter }
}

/**
 * Independent-appraisal presumption window — rule `us-fed.independent-appraisal-presumption`:
 * a qualifying appraisal dated no more than 12 months before the grant is ONE rebuttable
 * presumption of reasonableness. This check only tests the window; qualification (the
 * appraiser, the report, the illiquid-startup route's extra conditions) is not verified
 * here — the card's caveat.
 */
export function appraisalPresumptionCheck(appraisalOn: string, grantOn: string): SanityFinding & { windowEnds: string } {
  const appraisal = parseIso(appraisalOn, 'appraisalOn')
  const grant = parseIso(grantOn, 'grantOn')
  if (grant.getTime() < appraisal.getTime()) throw new RangeError('grantOn must be on or after appraisalOn')
  const windowEnds = addUtcMonths(appraisalOn, 12)
  const inWindow = grantOn <= windowEnds
  return {
    check: 'appraisal-presumption-window',
    level: inWindow ? 'pass' : 'fail',
    ...RULE_IDS_409A.appraisalPresumption,
    needsReview: true,
    windowEnds,
    note: inWindow
      ? `Appraisal of ${appraisalOn} is within 12 months of the ${grantOn} grant — the presumption MAY be available. It is rebuttable and has qualification conditions (appraiser, written report, illiquid-startup route limits) not verified here.`
      : `Appraisal of ${appraisalOn} is more than 12 months before the ${grantOn} grant (window ended ${windowEnds}) — the presumption is not available on timing as computed.`,
  }
}

export interface RatioIllustration {
  check: 'preferred-common-ratio'
  kind: 'illustration'
  /** preferred round price / common FMV, rounded to 4 decimals. */
  ratio: number
  level: SanityLevel
  ruleId: string
  jurisdiction: 'US-FED'
  /** This number is NEVER a valuation of anything. */
  producesValuation: false
  needsReview: true
  note: string
}

/**
 * ILLUSTRATION ONLY: how the preferred round price compares to the common 409A FMV.
 * Rule `us-fed.reasonable-method`'s caveat is the whole point: "A financing price for
 * preferred stock does not automatically equal common-stock fair market value" — common
 * pricing below preferred is normal (preferences, participation, control). The ratio is a
 * conversation number for the valuation firm, not a backsolve and not a valuation.
 * Flagged when common FMV is at or above the preferred price — unusual enough to confirm.
 */
export function preferredCommonRatioIllustration(preferredRoundPps: number, fmvPerShare: number): RatioIllustration {
  if (!(preferredRoundPps > 0) || !(fmvPerShare > 0)) throw new RangeError('preferredRoundPps and fmvPerShare must be > 0')
  const ratio = roundPrice(preferredRoundPps / fmvPerShare)
  const unusual = ratio <= 1
  return {
    check: 'preferred-common-ratio',
    kind: 'illustration',
    ratio,
    level: unusual ? 'flag' : 'pass',
    ...RULE_IDS_409A.reasonableMethod,
    producesValuation: false,
    needsReview: true,
    note: unusual
      ? `Common FMV $${fmvPerShare} is at or above the preferred round price $${preferredRoundPps} (ratio ${ratio}) — unusual; confirm the valuation reflects current material information. Illustration only, never a valuation.`
      : `Preferred round price $${preferredRoundPps} is ${ratio}× the common FMV $${fmvPerShare}. A preferred/common gap is normal (preferences, participation, control) — rule caveat: the financing price does not automatically equal common FMV. Illustration only, never a valuation.`,
  }
}

// ---------------------------------------------------------------------------
// The aggregate report
// ---------------------------------------------------------------------------

export interface GrantSanityInputs {
  strikePerShare: number
  /** The company's real 409A FMV per share — SUPPLIED, never computed here. */
  fmvPerShare: number
  /** The FMV's valuation ("as of") date, ISO YYYY-MM-DD. */
  fmvAsOf: string
  /** The intended grant date, ISO YYYY-MM-DD. */
  grantOn: string
  /** Date of the qualifying independent appraisal, if one exists (often = fmvAsOf). */
  independentAppraisalOn?: string
  termSheetSignedSinceFmv?: boolean
  materialChangeSinceFmv?: boolean | 'unknown'
  /** Latest preferred round price per share, for the labeled illustration only. */
  preferredRoundPps?: number
}

export interface GrantSanityReport {
  findings: (SanityFinding | RatioIllustration)[]
  /** The most severe level across findings (fail > flag > pass). */
  worstLevel: SanityLevel
  /** Constant, by construction: this module never values a company. */
  producesValuation: false
  needsReview: true
  disclaimer: string
}

const LEVEL_RANK: Record<SanityLevel, number> = { pass: 0, flag: 1, fail: 2 }

/**
 * Run every applicable check for one intended grant. Output is decision support for a
 * conversation with counsel and the valuation firm — it never authorizes a grant, never
 * computes an FMV, and keeps `needsReview: true` on every finding (the open-modules
 * README contract).
 */
export function grantSanityReport(inputs: GrantSanityInputs): GrantSanityReport {
  const findings: (SanityFinding | RatioIllustration)[] = [
    strikeFloorCheck(inputs.strikePerShare, inputs.fmvPerShare),
    fmvAgeCheck(inputs.fmvAsOf, inputs.grantOn, {
      termSheetSignedSinceFmv: inputs.termSheetSignedSinceFmv,
      materialChangeSinceFmv: inputs.materialChangeSinceFmv,
    }),
  ]
  if (inputs.independentAppraisalOn !== undefined) {
    findings.push(appraisalPresumptionCheck(inputs.independentAppraisalOn, inputs.grantOn))
  }
  if (inputs.preferredRoundPps !== undefined) {
    findings.push(preferredCommonRatioIllustration(inputs.preferredRoundPps, inputs.fmvPerShare))
  }
  const worstLevel = findings.reduce<SanityLevel>(
    (worst, f) => (LEVEL_RANK[f.level] > LEVEL_RANK[worst] ? f.level : worst),
    'pass',
  )
  return {
    findings,
    worstLevel,
    producesValuation: false,
    needsReview: true,
    disclaimer:
      'Sanity checks against dated rule cards — not a valuation, not legal or tax advice, and never an authorization to grant. The 409A FMV is an input this module cannot produce.',
  }
}

// ---------------------------------------------------------------------------
// The three § 409A presumption methods — structured, cited data
// ---------------------------------------------------------------------------

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export type PresumptionMethodId = 'independent-appraisal' | 'binding-formula' | 'illiquid-startup'

export interface PresumptionMethod {
  method: PresumptionMethodId
  ruleId: string
  jurisdiction: 'US-FED'
  summary: string
  /** The method's conditions as the rule card states them — data, not verification. */
  conditions: readonly string[]
  needsReview: true
}

/** The three rebuttable valuation presumptions of Treas. Reg. § 1.409A-1(b)(5)(iv)(B)(2),
 * each citing its dated rule card. All three are presumptions of REASONABLENESS — the
 * Commissioner may rebut on a showing that the method or its application was grossly
 * unreasonable ((iv)(B)(1), on the cards' caveats). None of them is a valuation method this
 * module performs. */
export const PRESUMPTION_METHODS: readonly PresumptionMethod[] = [
  {
    method: 'independent-appraisal',
    ...RULE_IDS_409A.appraisalPresumption,
    summary:
      'An independent appraisal meeting the section 401(a)(28)(C) requirements, dated no more than 12 months before the transaction.',
    conditions: [
      'Appraisal satisfies the independent-appraisal requirements (section 401(a)(28)(C) and regulations).',
      'Appraisal date is no more than 12 months before the relevant transaction (the grant).',
    ],
    needsReview: true,
  },
  {
    method: 'binding-formula',
    ...RULE_IDS_409A.bindingFormula,
    summary:
      'A formula that would be fair market value under § 1.83-5 if used as part of a nonlapse restriction, applied consistently.',
    conditions: [
      'The formula, used as part of a nonlapse restriction, would be fair market value under Treas. Reg. § 1.83-5.',
      'The stock is valued in the same manner for any transfer to the issuer or to a more-than-10% voting-power holder (arm’s-length sale of substantially all stock excepted).',
    ],
    needsReview: true,
  },
  {
    method: 'illiquid-startup',
    ...RULE_IDS_409A.illiquidStartup,
    summary:
      'A good-faith written-report valuation of illiquid start-up stock by a qualified person, with the route’s eligibility conditions met.',
    conditions: [
      'Valuation made reasonably and in good faith, evidenced by a written report that takes into account the regulation’s valuation factors.',
      'Performed by a person reasonably determined to be qualified based on significant knowledge, experience, education, or training.',
      'No material trade or business conducted (including by predecessors) for 10 years or more.',
      'No class of equity securities traded on an established securities market.',
      'Stock not subject to a put, call, or other right or obligation to purchase (a right of first refusal or a lapse restriction is excepted).',
      'No reasonably anticipated change in control event within 90 days or public offering within 180 days.',
    ],
    needsReview: true,
  },
] as const

// ---------------------------------------------------------------------------
// Method eligibility over explicit inputs
// ---------------------------------------------------------------------------

export interface MethodEligibilityInputs {
  /** The intended grant date, ISO YYYY-MM-DD. */
  grantOn: string
  /** Date of the independent appraisal, if that route is on the table. */
  independentAppraisalOn?: string
  /** Formula-route input, if that route is on the table. */
  bindingFormula?: {
    /** Is the stock valued the same way for every covered transfer? 'unknown' flags. */
    valuedSameMannerForAllTransfers: boolean | 'unknown'
  }
  /** Illiquid-startup-route inputs, if that route is on the table. Every field is an
   * explicit assertion by the caller — nothing is inferred. */
  illiquidStartup?: {
    /** Date the corporation (with predecessors) first conducted a material trade or
     * business — the 10-year clock's start. */
    businessConductedSince: string
    hasPubliclyTradedEquity: boolean
    /** A put, call, or other purchase right/obligation on the stock, OTHER than a right of
     * first refusal or a lapse restriction. */
    stockSubjectToPutCallOrObligation: boolean | 'unknown'
    valuationEvidencedByWrittenReport: boolean
    /** "Significant knowledge, experience, education, or training" — a judgment. */
    valuerQualified: boolean | 'unknown'
    anticipatesChangeInControlWithin90Days: boolean | 'unknown'
    anticipatesPublicOfferingWithin180Days: boolean | 'unknown'
  }
}

export interface MethodEligibility {
  method: PresumptionMethodId
  /** fail > flag > pass across the method's findings. */
  level: SanityLevel
  findings: SanityFinding[]
  needsReview: true
}

function finding(
  check: string,
  level: SanityLevel,
  ref: { ruleId: string; jurisdiction: 'US-FED' },
  note: string,
): SanityFinding {
  return { check, level, ...ref, needsReview: true, note }
}

function worstOf(findings: readonly { level: SanityLevel }[]): SanityLevel {
  return findings.reduce<SanityLevel>((w, f) => (LEVEL_RANK[f.level] > LEVEL_RANK[w] ? f.level : w), 'pass')
}

function triState(
  check: string,
  value: boolean | 'unknown',
  failWhen: boolean,
  ref: { ruleId: string; jurisdiction: 'US-FED' },
  notes: { fail: string; unknown: string; pass: string },
): SanityFinding {
  if (value === 'unknown') return finding(check, 'flag', ref, notes.unknown)
  return value === failWhen ? finding(check, 'fail', ref, notes.fail) : finding(check, 'pass', ref, notes.pass)
}

/**
 * Eligibility of each presumption method the caller supplied inputs for, checked ONLY as
 * far as explicit inputs reach: date windows are computed (the module's documented UTC
 * month convention), boolean conditions are relayed, and every judgment ('unknown', every
 * "qualified"/"material" call) flags. The output ranks conditions, never establishes a
 * presumption — the cards are all rebuttable, and qualification is counsel's question.
 * Methods without inputs are omitted (not silently passed).
 */
export function checkMethodEligibility(inputs: MethodEligibilityInputs): {
  methods: MethodEligibility[]
  needsReview: true
  producesValuation: false
} {
  parseIso(inputs.grantOn, 'grantOn')
  const methods: MethodEligibility[] = []

  if (inputs.independentAppraisalOn !== undefined) {
    const window = appraisalPresumptionCheck(inputs.independentAppraisalOn, inputs.grantOn)
    const findings = [window as SanityFinding]
    methods.push({ method: 'independent-appraisal', level: worstOf(findings), findings, needsReview: true })
  }

  if (inputs.bindingFormula !== undefined) {
    const ref = RULE_IDS_409A.bindingFormula
    const findings = [
      triState('formula-consistency', inputs.bindingFormula.valuedSameMannerForAllTransfers, false, ref, {
        fail: 'The stock is NOT valued the same way for every covered transfer — the consistency condition is not met as reported.',
        unknown: 'Whether the stock is valued the same way for every covered transfer is unknown — confirm with counsel.',
        pass: 'Consistent valuation across covered transfers reported. Whether the formula meets the § 1.83-5 nonlapse-restriction standard is a legal question not verified here.',
      }),
      finding('formula-83-5-standard', 'flag', ref,
        'Whether the formula would be fair market value under Treas. Reg. § 1.83-5 as part of a nonlapse restriction is a legal determination for counsel — always flagged.'),
    ]
    methods.push({ method: 'binding-formula', level: worstOf(findings), findings, needsReview: true })
  }

  const il = inputs.illiquidStartup
  if (il !== undefined) {
    const ref = RULE_IDS_409A.illiquidStartup
    const since = parseIso(il.businessConductedSince, 'businessConductedSince')
    const grant = parseIso(inputs.grantOn, 'grantOn')
    if (grant.getTime() < since.getTime()) throw new RangeError('grantOn must be on or after businessConductedSince')
    // "10 years or more" computed with the module's documented month-addition convention.
    const tenYearsEnd = addUtcMonths(il.businessConductedSince, 120)
    const tooOld = inputs.grantOn >= tenYearsEnd
    const findings: SanityFinding[] = [
      finding('illiquid-ten-year', tooOld ? 'fail' : 'pass', ref,
        tooOld
          ? `A material trade or business since ${il.businessConductedSince} reaches 10 years on ${tenYearsEnd} — the start-up condition is not met at the ${inputs.grantOn} grant as computed.`
          : `Material trade or business since ${il.businessConductedSince} is under 10 years at the ${inputs.grantOn} grant (reaches 10 on ${tenYearsEnd}). Predecessor history counts — confirm the clock's true start.`),
      il.hasPubliclyTradedEquity
        ? finding('illiquid-no-public-market', 'fail', ref, 'A class of equity trades on an established securities market — the route is unavailable as reported.')
        : finding('illiquid-no-public-market', 'pass', ref, 'No publicly traded class reported.'),
      triState('illiquid-no-put-call', il.stockSubjectToPutCallOrObligation, true, ref, {
        fail: 'The stock is subject to a put, call, or other purchase right/obligation beyond a ROFR or lapse restriction — the condition is not met as reported.',
        unknown: 'Whether the stock carries a put, call, or other purchase obligation (beyond ROFR/lapse restrictions) is unknown — confirm against the stock terms.',
        pass: 'No put/call/other purchase obligation reported (ROFR and lapse restrictions excepted by the regulation).',
      }),
      il.valuationEvidencedByWrittenReport
        ? finding('illiquid-written-report', 'pass', ref, 'A written report is asserted; whether it takes into account the regulation’s valuation factors is substance counsel and the valuer must stand behind.')
        : finding('illiquid-written-report', 'fail', ref, 'No written report — the route requires the valuation be evidenced by one.'),
      triState('illiquid-qualified-person', il.valuerQualified, false, ref, {
        fail: 'The valuer is reported NOT qualified — the route requires significant knowledge, experience, education, or training.',
        unknown: 'Whether the valuer has significant knowledge, experience, education, or training is a judgment the corporation must reasonably make — unknown here.',
        pass: 'Qualification asserted — note it remains the corporation’s reasonable determination to defend.',
      }),
      triState('illiquid-no-anticipated-cic', il.anticipatesChangeInControlWithin90Days, true, ref, {
        fail: 'A change in control event is reasonably anticipated within 90 days — the route is unavailable as reported.',
        unknown: 'Whether a change in control is reasonably anticipated within 90 days is unknown — a term sheet in hand usually answers this.',
        pass: 'No change in control reasonably anticipated within 90 days, as reported.',
      }),
      triState('illiquid-no-anticipated-ipo', il.anticipatesPublicOfferingWithin180Days, true, ref, {
        fail: 'A public offering is reasonably anticipated within 180 days — the route is unavailable as reported.',
        unknown: 'Whether a public offering is reasonably anticipated within 180 days is unknown — confirm.',
        pass: 'No public offering reasonably anticipated within 180 days, as reported.',
      }),
    ]
    methods.push({ method: 'illiquid-startup', level: worstOf(findings), findings, needsReview: true })
  }

  return { methods, needsReview: true, producesValuation: false }
}

// ---------------------------------------------------------------------------
// Refresh-trigger checklist
// ---------------------------------------------------------------------------

export interface RefreshTriggerEvents {
  /** A priced-round term sheet signed since the FMV date (YC User Guide §B.6 convention). */
  termSheetSigned?: boolean
  /** A financing actually closed since the FMV date — later material information the value
   * must reflect (rule us-fed.staleness). */
  financingClosed?: boolean | 'unknown'
  /** Any other material business change (major contract, milestone, acquisition offer...).
   * Materiality is a judgment — 'unknown' is the honest default. */
  materialBusinessChange?: boolean | 'unknown'
}

/**
 * When does a 409A valuation need refreshing before the next grant? The checklist runs the
 * two cited triggers: (1) the hard 12-month ceiling and the later-material-information
 * principle (rule `us-fed.staleness` — a value "calculated more than 12 months before the
 * use date" or failing to reflect later material information can be unreasonable), and
 * (2) the signed-term-sheet convention (YC Post-Money Safe User Guide §B.6: most 409A
 * firms treat a signed priced-round term sheet as ending the old price's use). Event
 * triggers FLAG (materiality and whether the report already reflects them are judgments);
 * only the computed 12-month trip FAILS. A checklist, never an authorization to grant.
 */
export function refreshTriggerChecklist(fmvAsOf: string, grantOn: string, events?: RefreshTriggerEvents): {
  findings: SanityFinding[]
  refreshRecommended: boolean
  worstLevel: SanityLevel
  needsReview: true
} {
  const age = fmvAgeCheck(fmvAsOf, grantOn, {
    termSheetSignedSinceFmv: events?.termSheetSigned,
    materialChangeSinceFmv: events?.materialBusinessChange ?? 'unknown',
  })
  const findings: SanityFinding[] = [age]
  const ref = RULE_IDS_409A.staleness
  const closed = events?.financingClosed ?? 'unknown'
  findings.push(
    triState('refresh-financing-closed', closed, true, ref, {
      fail: 'A financing closed since the FMV date — later material information the valuation must reflect; a refresh is the standard course.',
      unknown: 'Whether a financing closed since the FMV date is unknown — confirm before granting.',
      pass: 'No financing closed since the FMV date, as reported.',
    }),
  )
  const worstLevel = worstOf(findings)
  return {
    findings,
    refreshRecommended: worstLevel !== 'pass',
    worstLevel,
    needsReview: true,
  }
}

// ---------------------------------------------------------------------------
// Penalty mechanics — a labeled arithmetic illustration, never a tax computation
// ---------------------------------------------------------------------------

export interface PenaltyIllustrationInputs {
  /** HYPOTHETICAL compensation required to be included under § 409A(a)(1)(A), in dollars —
   * an explicit input; this module never determines that § 409A applies or how much is
   * includible. */
  includibleCompensation: number
  /** Optional HYPOTHETICAL prior-year underpayments for the premium-interest line: each a
   * stated underpayment, the stated federal underpayment rate for the period, and the
   * years outstanding. Simple interest — an illustration of the statute's "underpayment
   * rate plus 1 percentage point", not the Code's actual interest computation. */
  hypotheticalUnderpayments?: readonly { underpayment: number; underpaymentRatePct: number; yearsOutstanding: number }[]
}

export interface PenaltyIllustration {
  kind: 'illustration'
  /** 20% × includibleCompensation — IRC § 409A(a)(1)(B)(i)(II). */
  additionalTax20Pct: number
  /** Σ underpayment × (rate + 1)/100 × years — simple-interest illustration of
   * § 409A(a)(1)(B)(i)(I)/(ii)'s premium interest. Absent when no hypotheticals given. */
  premiumInterestIllustration?: number
  ruleId: string
  jurisdiction: 'US-FED'
  producesValuation: false
  needsReview: true
  note: string
}

/**
 * The § 409A penalty ADDITIONS, illustrated from explicit hypothetical inputs — rule
 * `us-fed.409a-penalty-additions` (IRC § 409A(a)(1)(B)): on top of ordinary income
 * inclusion, (II) "an amount equal to 20 percent of the compensation which is required to
 * be included in gross income", and (I) interest "at the underpayment rate plus 1
 * percentage point on the underpayments that would have occurred" had the amounts been
 * includible when first deferred / vested. The 20% line is exact arithmetic on the
 * hypothetical; the interest line is a SIMPLE-INTEREST ILLUSTRATION — the real number is a
 * year-by-year tax computation under the Code's interest rules (the card's caveat), and
 * state additions (e.g. California's) are separate. Never a tax computation or advice.
 */
export function penaltyIllustration409a(inputs: PenaltyIllustrationInputs): PenaltyIllustration {
  if (!(inputs.includibleCompensation > 0)) {
    throw new RangeError('includibleCompensation must be > 0 (an explicit hypothetical — this module never determines inclusion)')
  }
  let interest: number | undefined
  if (inputs.hypotheticalUnderpayments !== undefined) {
    interest = 0
    for (const u of inputs.hypotheticalUnderpayments) {
      if (!(u.underpayment >= 0) || !(u.underpaymentRatePct >= 0) || !(u.yearsOutstanding >= 0)) {
        throw new RangeError('hypothetical underpayment rows must be >= 0')
      }
      interest += (u.underpayment * (u.underpaymentRatePct + 1) * u.yearsOutstanding) / 100
    }
    interest = round2(interest)
  }
  return {
    kind: 'illustration',
    additionalTax20Pct: round2(0.2 * inputs.includibleCompensation),
    premiumInterestIllustration: interest,
    ...RULE_IDS_409A.penaltyAdditions,
    producesValuation: false,
    needsReview: true,
    note:
      'Illustration from explicit hypothetical inputs of IRC § 409A(a)(1)(B): 20% additional tax on the hypothetical ' +
      'includible amount, plus simple interest at (stated underpayment rate + 1 point) on the stated hypothetical ' +
      'underpayments. The real premium interest is a year-by-year tax computation; ordinary income tax on inclusion and ' +
      'state additions are separate. Not a tax computation, not advice — the tax module and a tax professional own the real question.',
  }
}

