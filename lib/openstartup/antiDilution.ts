// Anti-dilution (round protection) mechanics — the ninth module of the open-startup
// toolkit (founder direction 2026-10-01: "go super deep on business logic").
//
// Pure, client-safe (no node builtins), deterministic. Registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/antiDilution.test.ts,
// which replays the cited published worked examples number-for-number and property-tests
// the ordering invariants (full ratchet <= narrow-based <= broad-based conversion price;
// an adjustment never raises the conversion price).
//
// Sources (each formula's doc comment cites the specific one):
// - NVCA Model Certificate of Incorporation (https://nvca.org/model-legal-documents/,
//   verified 2026-10-01): the weighted-average adjustment in the model COD's anti-dilution
//   section — CP2 = CP1 × (A + B) ÷ (A + C), where A is the Common Stock Deemed
//   Outstanding immediately prior to the issue (broad-based option: all outstanding common
//   PLUS all common issuable on conversion of outstanding preferred and exercise of
//   outstanding options), B is the aggregate consideration received divided by CP1, and C
//   is the number of new shares issued. Conversion mechanics: preferred converts into
//   common at Original Issue Price ÷ Conversion Price (initially 1:1; adjustments lower
//   the conversion price and raise the ratio).
// - Cooley GO, "What You Need to Know About Down Round Financings"
//   (https://www.cooleygo.com/down-round-financings/, verified 2026-10-01): prints the
//   same CP2 = CP1 × (A + B) ÷ (A + C) formula with the variable definitions, and the
//   full-ratchet worked example replayed in our tests (1,000 shares bought at $10; a $5
//   down round converts the $10,000 into 2,000 shares).
// - Bryan Springmeyer, "Anti-Dilution Provisions in Venture Capital Transactions"
//   (https://www.calstartuplawfirm.com/business-lawyer-blog/anti-dilution-provisions.php,
//   verified 2026-10-01): the complete worked example our tests replay number-for-number —
//   Series A $8M at $2.00 (4M preferred; 8M founder/pool shares), a 5M-share $1.00 down
//   round; broad-based $2.00 × 14.5M/17M = $1.7059 (→ "roughly 4.69 million shares"),
//   narrow-based $2.00 × 6.5/9 = $1.4444 (→ "5.54 million shares"), full ratchet at $1.00
//   (→ 8 million shares). Also the broad/narrow base definitions ("all shares of
//   outstanding common stock, all shares of outstanding preferred stock on an as-converted
//   basis, and all outstanding options on an as-exercised basis" vs "only ... the amount
//   of common stock which is convertible from the subject series of preferred").
// - Fenwick & West, "What is a 'Pay-to-Play' Financing?"
//   (https://www.fenwick.com/insights/publications/what-is-a-pay-to-play-financing) and
//   the Holloway Guide to Raising Venture Capital, "Pay-to-Play Provisions"
//   (https://www.holloway.com/g/venture-capital/sections/pay-to-play-provisions), both
//   verified 2026-10-01: pay-to-play requires existing preferred holders to buy their pro
//   rata of a later round; a non-participating holder's preferred converts to common (the
//   "strongman" form, losing preference AND anti-dilution) or to a stripped "shadow"
//   series of preferred. Explained here as a flag — the conversion consequence is
//   contract text, never computed as a payout.
//
// Rounding conventions (explicit): adjusted conversion prices are rounded to
// PRICE_DECIMALS = 4 (the capTable convention; it reproduces the Springmeyer figures
// $1.7059 and $1.4444 exactly), and as-converted share counts floor to whole shares via
// floorShares. The replayed example derives share counts FROM the rounded price (the
// article: "convert their $8 million worth at $1.7059"), so this module does the same.
// Charters often carry prices to more decimals; the plan/charter text controls —
// needsReview on every adjustment.
//
// Scope: price-based adjustments only. Carve-outs ("Exempt Issuances": pool grants,
// conversions, etc. — NVCA model COD) are the charter's list and must be applied by the
// caller BEFORE calling this module; pay-to-play is explained, not computed. Educational
// model, not legal advice.
// ---------------------------------------------------------------------------

import { floorShares, roundPrice } from './capTable'
import type { PreferredSeries } from './waterfall'

// ---------------------------------------------------------------------------
// Conversion-price → conversion-ratio mechanics
// ---------------------------------------------------------------------------

/**
 * Conversion ratio = Original Issue Price ÷ Conversion Price (NVCA model COD conversion
 * mechanics). At issuance CP = OIP, so the ratio is 1:1; anti-dilution adjustments lower
 * CP and raise the ratio — the holder's preferred converts into MORE common. Unrounded
 * (the ratio is an intermediate; share counts floor at the end).
 */
export function conversionRatio(originalIssuePrice: number, conversionPrice: number): number {
  if (!(originalIssuePrice > 0) || !(conversionPrice > 0)) throw new RangeError('prices must be > 0')
  return originalIssuePrice / conversionPrice
}

/**
 * As-converted common shares for a preferred holding: floor(preferredShares × OIP / CP)
 * (NVCA model COD conversion mechanics; floorShares per the module convention). The
 * Springmeyer example: 4,000,000 × $2.00 / $1.7059 = 4,689,606 — "roughly 4.69 million".
 */
export function asConvertedShares(preferredShares: number, originalIssuePrice: number, conversionPrice: number): number {
  if (!(preferredShares >= 0)) throw new RangeError('preferredShares must be >= 0')
  return floorShares(preferredShares * conversionRatio(originalIssuePrice, conversionPrice))
}

// ---------------------------------------------------------------------------
// The base ("A" in the formula)
// ---------------------------------------------------------------------------

export interface BroadBaseBreakdown {
  /** All outstanding common stock. */
  commonOutstanding: number
  /** All outstanding preferred on an as-converted basis (every series). */
  preferredAsConverted: number
  /** All outstanding options (and warrants) on an as-exercised basis. Broad-based charters
   * often also count the unissued pool — the charter's own definition controls; supply
   * whatever that text counts. */
  optionsAsExercised: number
}

/** The broad base: "all shares of outstanding common stock, all shares of outstanding
 * preferred stock on an as-converted basis, and all outstanding options on an as-exercised
 * basis" (Springmeyer; the NVCA model COD's broad-based Common Stock Deemed Outstanding).
 * The Springmeyer example: 8M common+options + 4M as-converted Series A = 12M. */
export function broadBase(b: BroadBaseBreakdown): number {
  if (!(b.commonOutstanding >= 0) || !(b.preferredAsConverted >= 0) || !(b.optionsAsExercised >= 0))
    throw new RangeError('base components must be >= 0')
  const base = b.commonOutstanding + b.preferredAsConverted + b.optionsAsExercised
  if (!(base > 0)) throw new RangeError('base must be > 0')
  return base
}

// ---------------------------------------------------------------------------
// The three adjustment formulas
// ---------------------------------------------------------------------------

export interface DilutiveIssuance {
  /** New shares issued in the dilutive round ("C"). */
  newShares: number
  /** Aggregate consideration received, in dollars. */
  considerationDollars: number
}

function validateIssuance(i: DilutiveIssuance): void {
  if (!(i.newShares > 0)) throw new RangeError('newShares must be > 0')
  if (!(i.considerationDollars > 0)) throw new RangeError('considerationDollars must be > 0')
}

/**
 * Weighted-average adjusted conversion price — the NVCA model COD formula (also printed by
 * Cooley GO's down-round explainer):
 *
 *   CP2 = CP1 × (A + B) ÷ (A + C)
 *     A = baseShares (broad or narrow — the caller picks the base; see broadBase and
 *         the narrow-based doc below)
 *     B = considerationDollars ÷ CP1 (the shares that "should have been issued" at CP1)
 *     C = newShares actually issued
 *
 * Only a DILUTIVE issuance adjusts: if the new price (consideration ÷ newShares) is at or
 * above CP1 the conversion price is unchanged (anti-dilution protects against issuances
 * below the conversion price — Cooley GO; Springmeyer's $4.00 up-round adjusts nothing).
 * Result rounded to 4 decimals (module convention; reproduces $1.7059 / $1.4444).
 *
 * Narrow-based variant: the SAME formula with A = only the subject series' as-converted
 * common ("the 'Prior shares' only includes the amount of common stock which is
 * convertible from the subject series of preferred" — Springmeyer). A smaller denominator
 * weight means the new low price moves the average more: narrow-based always yields a
 * conversion price at or below broad-based — more investor protection.
 */
export function weightedAverageConversionPrice(cp1: number, baseShares: number, issuance: DilutiveIssuance): number {
  if (!(cp1 > 0)) throw new RangeError('cp1 must be > 0')
  if (!(baseShares > 0)) throw new RangeError('baseShares must be > 0')
  validateIssuance(issuance)
  const newPrice = issuance.considerationDollars / issuance.newShares
  if (newPrice >= cp1) return cp1
  const b = issuance.considerationDollars / cp1
  return roundPrice((cp1 * (baseShares + b)) / (baseShares + issuance.newShares))
}

/**
 * Full-ratchet adjusted conversion price: CP2 = the new round's price per share, no matter
 * how few shares were sold — "rights to convert ... equal to the amount invested by the
 * preferred stockholder divided by the price per share in the current round" (Cooley GO,
 * down-round explainer; its example: 1,000 shares bought at $10 convert to $10,000 ÷ $5 =
 * 2,000 shares). No adjustment on an at-or-above-CP1 issuance.
 */
export function fullRatchetConversionPrice(cp1: number, issuance: DilutiveIssuance): number {
  if (!(cp1 > 0)) throw new RangeError('cp1 must be > 0')
  validateIssuance(issuance)
  const newPrice = issuance.considerationDollars / issuance.newShares
  return newPrice >= cp1 ? cp1 : roundPrice(newPrice)
}

// ---------------------------------------------------------------------------
// Applying an adjustment to a series
// ---------------------------------------------------------------------------

export type AdjustmentBasis = 'broad-based' | 'narrow-based' | 'full-ratchet'

export interface AdjustableSeries {
  name: string
  /** Outstanding preferred shares of the series. */
  preferredShares: number
  /** Original Issue Price per share (the preference basis per share). */
  originalIssuePrice: number
  /** Conversion price in effect BEFORE the issuance (= OIP if never adjusted). */
  conversionPriceBefore: number
}

export interface AdjustmentResult {
  seriesName: string
  basis: AdjustmentBasis
  conversionPriceBefore: number
  conversionPriceAfter: number
  conversionRatioAfter: number
  asConvertedBefore: number
  asConvertedAfter: number
  /** The extra common the series now converts into — dilution that lands on everyone else. */
  additionalCommonShares: number
  adjusted: boolean
  needsReview: true
  note: string
}

/**
 * One series through one dilutive issuance. Basis selection:
 * - 'broad-based': supply broadBaseShares (use broadBase(); the NVCA model COD's
 *   broad-based Common Stock Deemed Outstanding).
 * - 'narrow-based': the base is the series' own as-converted common (Springmeyer's
 *   narrow definition) — computed here, no base argument needed.
 * - 'full-ratchet': no base at all.
 * Carve-outs/exempt issuances and pay-to-play conditions are charter text the caller
 * resolves first — needsReview on every result.
 */
export function applyAntiDilution(
  series: AdjustableSeries,
  issuance: DilutiveIssuance,
  basis: AdjustmentBasis,
  broadBaseShares?: number,
): AdjustmentResult {
  if (!(series.preferredShares > 0)) throw new RangeError(`${series.name}: preferredShares must be > 0`)
  if (!(series.originalIssuePrice > 0) || !(series.conversionPriceBefore > 0))
    throw new RangeError(`${series.name}: prices must be > 0`)
  const before = asConvertedShares(series.preferredShares, series.originalIssuePrice, series.conversionPriceBefore)
  let cp2: number
  if (basis === 'broad-based') {
    if (broadBaseShares === undefined) throw new RangeError('broad-based adjustment requires broadBaseShares (see broadBase())')
    cp2 = weightedAverageConversionPrice(series.conversionPriceBefore, broadBaseShares, issuance)
  } else if (basis === 'narrow-based') {
    cp2 = weightedAverageConversionPrice(series.conversionPriceBefore, before, issuance)
  } else {
    cp2 = fullRatchetConversionPrice(series.conversionPriceBefore, issuance)
  }
  const after = asConvertedShares(series.preferredShares, series.originalIssuePrice, cp2)
  const adjusted = cp2 < series.conversionPriceBefore
  return {
    seriesName: series.name,
    basis,
    conversionPriceBefore: series.conversionPriceBefore,
    conversionPriceAfter: cp2,
    conversionRatioAfter: conversionRatio(series.originalIssuePrice, cp2),
    asConvertedBefore: before,
    asConvertedAfter: after,
    additionalCommonShares: after - before,
    adjusted,
    needsReview: true,
    note: adjusted
      ? `${series.name}: ${basis} adjustment lowers the conversion price $${series.conversionPriceBefore} → $${cp2}; ` +
        `as-converted ${before.toLocaleString('en-US')} → ${after.toLocaleString('en-US')} shares. Exempt-issuance ` +
        `carve-outs and the charter's own price precision control — needs review.`
      : `${series.name}: issuance at or above the $${series.conversionPriceBefore} conversion price — no adjustment ` +
        `(anti-dilution protects against issuances below the conversion price).`,
  }
}

// ---------------------------------------------------------------------------
// Pay-to-play — a flag and explanation, never a computation
// ---------------------------------------------------------------------------

export type PayToPlayMechanism = 'convert-to-common' | 'shadow-preferred'

export interface PayToPlayConsequence {
  kind: 'explanation'
  participated: boolean
  mechanism: PayToPlayMechanism
  /** What the non-participating holder keeps/loses — contract text summarized, not computed. */
  consequence: string
  needsReview: true
  citations: string[]
}

/**
 * Pay-to-play consequence as an EXPLANATION: the provision requires existing preferred
 * holders to buy their pro rata of a later (usually down) round; a holder that does not
 * participate has its preferred converted — to common in the harshest ("strongman") form,
 * losing the liquidation preference AND this module's anti-dilution protection, or to a
 * stripped "shadow" series keeping the preference but losing protective rights (Fenwick,
 * "What is a 'Pay-to-Play' Financing?"; Holloway Guide to Raising Venture Capital,
 * "Pay-to-Play Provisions"). The actual conversion terms are the charter/term sheet's —
 * this function names the consequence and refuses to compute payouts from it.
 */
export function payToPlayConsequence(participated: boolean, mechanism: PayToPlayMechanism): PayToPlayConsequence {
  const consequence = participated
    ? 'Participated at the required pro rata: preferred (and its anti-dilution protection) is retained; some structures re-convert ("pull up") previously converted shares.'
    : mechanism === 'convert-to-common'
      ? 'Did not participate: preferred converts to common — the liquidation preference and anti-dilution protection are lost (the "strongman" form).'
      : 'Did not participate: preferred converts to a "shadow" series — the preference survives but anti-dilution and other protective rights are stripped per the charter.'
  return {
    kind: 'explanation',
    participated,
    mechanism,
    consequence,
    needsReview: true,
    citations: [
      'Fenwick & West, "What is a \'Pay-to-Play\' Financing?" (fenwick.com)',
      'Holloway Guide to Raising Venture Capital, "Pay-to-Play Provisions" (holloway.com)',
    ],
  }
}

// ---------------------------------------------------------------------------
// Waterfall interface
// ---------------------------------------------------------------------------

/**
 * Hand an adjusted series to the waterfall module. waterfall.PreferredSeries.shares is
 * documented as "as-converted shares (1:1 conversion ratio assumed — stated, not hidden)";
 * after an anti-dilution adjustment the ratio is NOT 1:1, so the interface is: pass the
 * POST-adjustment as-converted share count (AdjustmentResult.asConvertedAfter) as `shares`
 * and the original dollars as `invested` — the waterfall's preference-vs-convert choice
 * then prices conversion on the protected share count. The waterfall module itself is
 * unchanged (its 1:1 assumption is satisfied by converting here).
 */
export function toWaterfallSeries(
  series: AdjustableSeries,
  adjustment: AdjustmentResult,
  options?: { preferenceMultiple?: number; participating?: boolean },
): PreferredSeries {
  if (adjustment.seriesName !== series.name) throw new RangeError('adjustment does not belong to this series')
  return {
    name: series.name,
    shares: adjustment.asConvertedAfter,
    invested: series.preferredShares * series.originalIssuePrice,
    preferenceMultiple: options?.preferenceMultiple,
    participating: options?.participating,
  }
}
