// Convertible promissory notes — the fifth module of the open-startup toolkit (founder
// direction 2026-10-01: "go further on the business modules").
//
// Pure, client-safe (no node builtins), deterministic. Registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/convertibleNote.test.ts,
// which replays the cited published worked examples number-for-number.
//
// Sources for the mechanics (each formula's doc comment cites the specific one; all
// verified live 2026-10-01):
// - Cooley GO, "Primer on Convertible Debt" (Peter Werner;
//   https://www.cooleygo.com/convertible-debt/, last reviewed 2025-09-02): interest may be
//   simple or compounding and historically ran 6-10% (more recently ~4%); accrued interest
//   is either repaid at conversion or converted "on the same terms as the principal"; the
//   cap and discount operate "in the alternative, with the effective conversion price being
//   determined by operation of one or the other based on which results in the lowest
//   conversion price"; at maturity parties typically repay, extend, or convert on
//   pre-agreed terms. Micro-example replayed in tests: a $1,000,000 note converting in a
//   financing valuing the issuer at $100 million leaves the noteholder with 1%.
// - Cooley GO, "Understanding the Valuation Cap"
//   (https://www.cooleygo.com/troublesome-convertible-note-cap/, last reviewed 2023-02-02):
//   a $3 million cap against a $10 million pre-financing valuation is a 70% discount —
//   replayed in capImpliedDiscountPct. The article never pins down the cap's share-count
//   denominator, which is why this module makes the caller supply it from the note's own
//   definition of "capitalization" instead of inventing one.
// - Cooley GO, "Calculating Share Price With Outstanding Convertible Notes or Safes"
//   (Derek Colla; https://www.cooleygo.com/calculating-share-price-outstanding-convertible-notes-or-safes/,
//   last reviewed 2022-01-24): the pre-money / percentage-ownership / dollars-invested
//   methods for pricing a Series A around converting notes. Its full worked example
//   ($8M pre, $2M new, $1M of notes at a 30% discount, 1M fully diluted shares) is
//   replayed number-for-number in seriesPricingWithNotes' tests.
// - YC Post-Money Safe User Guide (PDF linked from https://www.ycombinator.com/documents,
//   Feb 2023): the note-vs-SAFE structural differences in NOTE_VS_SAFE — §A.7 ("A safe has
//   no maturity date"), the "Why" section (no maturity extensions or interest-rate
//   revisions to negotiate), and §F.5 (notes are indebtedness with priority over safes;
//   mixing the two instruments is "generally not advisable").
// - The Convertible Note Financing Term Sheet itself is a Cooley GO generated document —
//   open-documents/registry.json id `cooley-convertible-note-term-sheet`.
//
// Honest-scope notes:
// - Simple interest only, on an actual-day count over an explicit basis (365 by default).
//   Compounding, 30/360 conventions, and default interest are governed by the note's own
//   text — out of scope, and every accrual result says so via `needsReview`.
// - The cap denominator ("capitalization") is contract-specific; the module refuses to
//   convert at a cap unless the caller supplies the share count the note's definition
//   produces. Educational model, not legal advice.
// ---------------------------------------------------------------------------

import { floorShares, roundPrice } from './capTable'

function round2(x: number): number {
  return Math.round(x * 100) / 100
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

/** Whole UTC days from `fromIso` to `toIso` (actual-day count; negative input rejected). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIso(fromIso, 'from')
  const to = parseIso(toIso, 'to')
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  if (days < 0) throw new RangeError(`toIso ${toIso} is before fromIso ${fromIso}`)
  return days
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConvertibleNoteFields {
  name: string
  /** Principal in dollars (> 0). */
  principal: number
  /** Annual simple interest rate in percent. Cooley GO's convertible-debt primer: rates
   * historically ran 6-10%, "more common to see relatively low interest rate in the 4%
   * range". 0 is allowed (some bridge notes waive interest). */
  annualRatePct: number
  /** Issue date, ISO YYYY-MM-DD — interest accrues from this date. */
  issuedOn: string
  /** Maturity date, ISO YYYY-MM-DD, if the note states one (notes, unlike safes, do). */
  maturityOn?: string
}

export interface AccruedInterest {
  days: number
  basisDays: number
  /** Simple interest in dollars, rounded to cents. */
  interest: number
  /** principal + interest, rounded to cents. */
  total: number
  /** Always true: the note's own text controls compounding, day-count basis, and default
   * interest — this is the plain simple-interest convention, nothing more. */
  needsReview: true
  note: string
}

// ---------------------------------------------------------------------------
// Interest accrual
// ---------------------------------------------------------------------------

/**
 * Simple (non-compounding) interest: principal × rate × days/basis, actual-day count.
 * Cooley GO's convertible-debt primer distinguishes simple from "compounding (meaning the
 * interest is turned into principal on a regular basis)"; this module implements only the
 * simple convention and makes the basis explicit (365 by default, 360 for notes that use
 * a 360-day year). Rounded to cents.
 */
export function accruedSimpleInterest(
  principal: number,
  annualRatePct: number,
  fromIso: string,
  toIso: string,
  options?: { basisDays?: 360 | 365 },
): AccruedInterest {
  if (!(principal > 0)) throw new RangeError('principal must be > 0')
  if (!(annualRatePct >= 0)) throw new RangeError('annualRatePct must be >= 0')
  const basisDays = options?.basisDays ?? 365
  const days = daysBetween(fromIso, toIso)
  const interest = round2(principal * (annualRatePct / 100) * (days / basisDays))
  return {
    days,
    basisDays,
    interest,
    total: round2(principal + interest),
    needsReview: true,
    note: `Simple interest, actual/${basisDays}. The note's own text controls compounding, day-count basis, and any default rate — verify against the instrument.`,
  }
}

/** The note's balance (principal + accrued simple interest) as of a date. */
export function noteBalance(note: ConvertibleNoteFields, asOfIso: string): AccruedInterest & { principal: number } {
  const accrued = accruedSimpleInterest(note.principal, note.annualRatePct, note.issuedOn, asOfIso)
  return { principal: note.principal, ...accrued }
}

// ---------------------------------------------------------------------------
// Conversion price — cap and discount "in the alternative"
// ---------------------------------------------------------------------------

export interface NoteConversionTerms {
  /** Price per share paid by the new-money investors in the equity financing. */
  roundPps: number
  /** Discount off the round price, in percent (Cooley GO primer: typically 15-25%). */
  discountPct?: number
  /** Valuation cap in dollars. Requires capCapitalizationShares. */
  cap?: number
  /** The share count the NOTE'S OWN definition of "capitalization" produces for the cap
   * denominator. Cooley GO's "Understanding the Valuation Cap" never pins this definition
   * down because it is contract-specific (pre-money fully diluted, with or without the
   * pool, etc.) — so this module takes it as input rather than inventing one. */
  capCapitalizationShares?: number
}

export interface NoteConversionPrice {
  /** The effective conversion price: the LOWEST of round price, discount price, cap price
   * — Cooley GO primer: the cap and discount operate "in the alternative, with the
   * effective conversion price being determined by operation of one or the other based on
   * which results in the lowest conversion price". Rounded to 4 decimals. */
  price: number
  method: 'pps' | 'discount' | 'cap'
  discountPrice?: number
  capPrice?: number
}

/**
 * Effective conversion price per the primer's lowest-price rule. Discount price =
 * roundPps × (1 − discount) and cap price = cap / capitalization shares, both rounded to
 * 4 decimals (the cap-table module's price convention) before comparison.
 */
export function noteConversionPrice(terms: NoteConversionTerms): NoteConversionPrice {
  if (!(terms.roundPps > 0)) throw new RangeError('roundPps must be > 0')
  if (terms.discountPct !== undefined && !(terms.discountPct > 0 && terms.discountPct < 100)) {
    throw new RangeError('discountPct must be between 0 and 100')
  }
  if (terms.cap !== undefined) {
    if (!(terms.cap > 0)) throw new RangeError('cap must be > 0')
    if (!(terms.capCapitalizationShares !== undefined && terms.capCapitalizationShares > 0)) {
      throw new RangeError(
        'a cap requires capCapitalizationShares: the denominator is the note\'s own "capitalization" definition (contract-specific), not a convention this module may invent',
      )
    }
  }
  let price = terms.roundPps
  let method: NoteConversionPrice['method'] = 'pps'
  let discountPrice: number | undefined
  let capPrice: number | undefined
  if (terms.discountPct !== undefined) {
    discountPrice = roundPrice(terms.roundPps * (1 - terms.discountPct / 100))
    if (discountPrice < price) {
      price = discountPrice
      method = 'discount'
    }
  }
  if (terms.cap !== undefined && terms.capCapitalizationShares !== undefined) {
    capPrice = roundPrice(terms.cap / terms.capCapitalizationShares)
    if (capPrice < price) {
      price = capPrice
      method = 'cap'
    }
  }
  if (!(price > 0)) throw new RangeError('conversion price rounds to zero at 4 decimals — check the cap against the share count')
  return { price, method, discountPrice, capPrice }
}

/**
 * The discount a cap implies once the round prices above it: 1 − cap/preMoney, in percent.
 * Replays Cooley GO's "Understanding the Valuation Cap" example: a $3M cap against a $10M
 * pre-financing valuation "just got a 70% discount". 0 when the round prices at or below
 * the cap (the discount term, if any, does the work there).
 */
export function capImpliedDiscountPct(cap: number, preMoney: number): number {
  if (!(cap > 0) || !(preMoney > 0)) throw new RangeError('cap and preMoney must be > 0')
  return preMoney <= cap ? 0 : (1 - cap / preMoney) * 100
}

export interface NoteConversion {
  noteName: string
  principal: number
  interest: number
  /** Dollars converting into shares (principal, plus interest when interestTreatment is
   * 'convert' — the primer: notes "may specify that accrued interest can either be repaid
   * in connection with a conversion event, or can be converted into additional shares on
   * the same terms as the principal"). */
  amountConverted: number
  /** Interest paid back in cash instead of converting (interestTreatment 'repay'). */
  interestRepaid: number
  conversionPrice: number
  method: NoteConversionPrice['method']
  /** floor(amountConverted / conversionPrice) — whole shares, rounded down. */
  shares: number
  needsReview: true
  note: string
}

/**
 * Convert a note in an equity financing as of a date: accrue simple interest to the event,
 * price the conversion at the lowest of round/discount/cap price, floor to whole shares.
 * `interestTreatment` defaults to 'convert' (interest buys shares on the same terms).
 */
export function convertNote(
  note: ConvertibleNoteFields,
  asOfIso: string,
  terms: NoteConversionTerms & { interestTreatment?: 'convert' | 'repay' },
): NoteConversion {
  const balance = noteBalance(note, asOfIso)
  const pricing = noteConversionPrice(terms)
  const treatment = terms.interestTreatment ?? 'convert'
  const amountConverted = treatment === 'convert' ? balance.total : note.principal
  const interestRepaid = treatment === 'convert' ? 0 : balance.interest
  return {
    noteName: note.name,
    principal: note.principal,
    interest: balance.interest,
    amountConverted,
    interestRepaid,
    conversionPrice: pricing.price,
    method: pricing.method,
    shares: floorShares(amountConverted / pricing.price),
    needsReview: true,
    note: `${balance.note} Qualified-financing thresholds, the security received, and the capitalization definition are set by the note — verify against the instrument.`,
  }
}

// ---------------------------------------------------------------------------
// Maturity — surfaced, never decided
// ---------------------------------------------------------------------------

export interface MaturityStatus {
  matured: boolean
  maturityOn: string
  /** Balance (principal + simple interest) at the maturity date or asOf date, whichever
   * is earlier — what the published repayment path would owe. */
  balance: number
  /** The three outcomes Cooley GO's primer describes at maturity. Which applies is a
   * negotiation between issuer and holders — this module never picks one. */
  publishedPaths: readonly [string, string, string]
  needsReview: true
  note: string
}

/**
 * Where the note stands against its maturity date. Cooley GO's convertible-debt primer:
 * traditionally principal and accrued interest fall due at maturity; in practice "the
 * issuer and the investors may agree to extend maturity, or to keep the notes outstanding
 * and 'due' but not otherwise take any action", or the note converts at a pre-agreed
 * price. All three are surfaced; none is chosen.
 */
export function maturityStatus(note: ConvertibleNoteFields, asOfIso: string): MaturityStatus {
  if (!note.maturityOn) throw new RangeError(`${note.name}: no maturityOn date on the note`)
  parseIso(asOfIso, 'asOfIso')
  const matured = asOfIso >= note.maturityOn
  const balanceAsOf = matured ? note.maturityOn : asOfIso
  const balance = noteBalance(note, balanceAsOf)
  return {
    matured,
    maturityOn: note.maturityOn,
    balance: balance.total,
    publishedPaths: [
      'repayment of principal and accrued interest',
      'extension of the maturity date (or leaving the note outstanding and due) by agreement',
      "conversion at a price the note's own terms pre-agree",
    ],
    needsReview: true,
    note: `Maturity outcomes are negotiated between issuer and holders — Cooley GO convertible-debt primer. ${balance.note}`,
  }
}

// ---------------------------------------------------------------------------
// Series pricing around converting notes — the three Cooley GO methods
// ---------------------------------------------------------------------------

export interface NotePricingInputs {
  /** Agreed pre-money valuation in dollars. */
  preMoney: number
  /** New cash raised in the round, in dollars. */
  newMoney: number
  /** Outstanding note/SAFE balance converting (principal + accrued interest), in dollars. */
  noteBalanceConverting: number
  /** Conversion discount off the method's round price, in percent. */
  discountPct: number
  /** Fully diluted shares before the round and before conversion. */
  preRoundFullyDiluted: number
}

export type PricingMethod = 'pre-money' | 'percentage-ownership' | 'dollars-invested'

export interface MethodOutcome {
  method: PricingMethod
  /** Series price per share, rounded to 4 decimals. */
  pps: number
  /** pps × (1 − discount), rounded to 4 decimals. */
  conversionPrice: number
  noteShares: number
  newMoneyShares: number
  totalFullyDiluted: number
  /** Percent of post-close fully diluted (0-100), from the floored share counts. */
  ownershipPct: { existing: number; notes: number; newMoney: number }
}

function methodOutcome(method: PricingMethod, ppsRaw: number, input: NotePricingInputs): MethodOutcome {
  const pps = roundPrice(ppsRaw)
  if (!(pps > 0)) throw new RangeError(`${method}: price per share rounds to zero — note balance too large for this pre-money`)
  const conversionPrice = roundPrice(pps * (1 - input.discountPct / 100))
  const noteShares = floorShares(input.noteBalanceConverting / conversionPrice)
  const newMoneyShares = floorShares(input.newMoney / pps)
  const totalFullyDiluted = input.preRoundFullyDiluted + noteShares + newMoneyShares
  return {
    method,
    pps,
    conversionPrice,
    noteShares,
    newMoneyShares,
    totalFullyDiluted,
    ownershipPct: {
      existing: (input.preRoundFullyDiluted / totalFullyDiluted) * 100,
      notes: (noteShares / totalFullyDiluted) * 100,
      newMoney: (newMoneyShares / totalFullyDiluted) * 100,
    },
  }
}

/**
 * The three published ways to price a round when notes convert at a discount — Cooley GO,
 * "Calculating Share Price With Outstanding Convertible Notes or Safes" (Derek Colla).
 * With P = pre-money, N = new money, B = converting balance, d = discount, F = pre-round
 * fully diluted shares:
 * - pre-money method: pps = P / F. The notes' discounted shares dilute everyone including
 *   the new investors (the article: new money ends below N/(P+N) of the company).
 * - percentage-ownership method: pps solves for the new investors owning exactly N/(P+N)
 *   post-close, pushing all note dilution onto the existing holders:
 *   pps = (P − B/(1−d)) / F.
 * - dollars-invested method: the compromise the article lands on — the post-money is
 *   treated as P + N + B, so pps = (P − B·d/(1−d)) / F; "converting debt into equity
 *   without a discount does not change the Series A Investors' percentage ownership".
 * The article's worked example ($8M pre, $2M new, $1M notes, 30% discount, 1M shares) is
 * replayed number-for-number in the tests: $8.00/$5.60, $6.57/$4.60, $7.57/$5.30 and the
 * 70/12.5/17.5, 65.71/14.29/20, 68.83/12.99/18.18 ownership splits.
 */
export function seriesPricingWithNotes(input: NotePricingInputs): Record<PricingMethod, MethodOutcome> {
  if (!(input.preMoney > 0) || !(input.newMoney > 0)) throw new RangeError('preMoney and newMoney must be > 0')
  if (!(input.noteBalanceConverting >= 0)) throw new RangeError('noteBalanceConverting must be >= 0')
  if (!(input.discountPct >= 0 && input.discountPct < 100)) throw new RangeError('discountPct must be in [0, 100)')
  if (!(input.preRoundFullyDiluted > 0)) throw new RangeError('preRoundFullyDiluted must be > 0')
  const { preMoney: P, noteBalanceConverting: B, preRoundFullyDiluted: F } = input
  const grossUp = B / (1 - input.discountPct / 100)
  return {
    'pre-money': methodOutcome('pre-money', P / F, input),
    'percentage-ownership': methodOutcome('percentage-ownership', (P - grossUp) / F, input),
    'dollars-invested': methodOutcome('dollars-invested', (P + B - grossUp) / F, input),
  }
}

// ---------------------------------------------------------------------------
// Note vs SAFE — the structural differences, stated plainly and cited
// ---------------------------------------------------------------------------

export interface InstrumentDifference {
  topic: string
  note: string
  safe: string
  source: string
}

/**
 * The structural differences between a convertible promissory note and the YC post-money
 * SAFE, each line cited. "Generally not advisable to issue both convertible notes and
 * safes since they are treated differently in a Liquidation Event or Dissolution Event"
 * — User Guide §F.5.
 */
export const NOTE_VS_SAFE: readonly InstrumentDifference[] = [
  {
    topic: 'maturity',
    note: 'Has a maturity date; principal and accrued interest traditionally fall due, and extensions must be negotiated.',
    safe: 'No maturity date — it terminates only on an Equity Financing, Liquidity Event, or Dissolution Event.',
    source: 'YC Post-Money Safe User Guide §A.7; Cooley GO convertible-debt primer (maturity section)',
  },
  {
    topic: 'interest',
    note: 'Accrues interest (Cooley GO primer: historically 6-10%, more recently ~4%), repaid or converted at conversion.',
    safe: 'No interest; the guide counts "no time or money spent dealing with extending maturity dates, revising interest rates" among the reasons to use it.',
    source: 'Cooley GO convertible-debt primer; YC Post-Money Safe User Guide ("Why")',
  },
  {
    topic: 'priority',
    note: 'Is indebtedness: paid before any safe in a Liquidity or Dissolution Event.',
    safe: 'Junior to creditors and outstanding indebtedness (including convertible notes); ranks like standard non-participating preferred.',
    source: 'YC Post-Money Safe User Guide §A.3, §A.5-A.6, §F.5',
  },
  {
    topic: 'conversion trigger',
    note: 'Automatic conversion usually requires a qualified financing — a minimum new-cash raise, typically one to two times the principal outstanding.',
    safe: 'Converts in any priced preferred round: "There is no threshold amount of money... that the company must raise to trigger the conversion."',
    source: 'Cooley GO convertible-debt primer; YC Post-Money Safe User Guide §A.1',
  },
] as const
