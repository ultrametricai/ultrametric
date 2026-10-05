// Liquidity-event waterfall — the sixth module of the open-startup toolkit (founder
// direction 2026-10-01: "go further on the business modules").
//
// Pure, client-safe (no node builtins), deterministic. Registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/waterfall.test.ts, which
// replays the YC Post-Money Safe User Guide's liquidity-event worked examples
// number-for-number and property-tests the invariants (proceeds sum to the price, no
// negative payouts, non-participating holders take the greater side).
//
// Sources (each formula's doc comment cites the specific one; the guide PDF is linked from
// https://www.ycombinator.com/documents, Feb 2023 edition, verified 2026-10-01):
// - YC Post-Money Safe User Guide §A.3: in a Liquidity Event a safe receives "the greater
//   of (1) a return of its Purchase Amount or (2) the as-converted proceeds it is entitled
//   to... (i.e., the proceeds it would be entitled to had its Purchase Amount been
//   converted into common stock at the Post-Money Valuation Cap)"; the safe "is junior to
//   creditors and outstanding indebtedness (including outstanding convertible notes) and
//   has the same priority as standard non-participating Preferred Stock."
// - §C.1: the Liquidity Price = Post-Money Valuation Cap / Liquidity Capitalization, where
//   the Liquidity Capitalization includes all issued and outstanding Capital Stock and all
//   Converting Securities "other than any Safes... where the holders... are receiving
//   Cash-Out Amounts", and EXCLUDES the Unissued Option Pool ("the acquirer in a Liquidity
//   Event only buys the company's outstanding equity").
// - Appendix II Example 1 Q3/Q4 (replayed number-for-number in the tests): the $10m
//   acquisition where both safes convert (561,764 and 1,123,529 shares at a $0.8901
//   per-share consideration) and the $3m acquisition where both cash out and the remaining
//   $2m is "shared pro rata among all other stockholders".
// - Cooley GO glossary, "Preferred Stock" (https://www.cooleygo.com/glossary/preferred-stock/,
//   verified 2026-10-01): non-participating holders "have to choose between receiving
//   their liquidation preference or getting paid alongside the common stock based on their
//   ownership percentage, but do not receive both"; participating holders "first receive
//   their liquidation preference, and then also receive payment alongside the common
//   stock".
// - Brad Feld, "Term Sheet: Liquidation Preference" (2005-01-04,
//   https://feld.com/archives/2005/01/term-sheet-liquidation-preference/): the
//   preference/participation split and that holders take their preference route OR the
//   as-converted route, not both.
//
// Honest-scope notes (also surfaced on every report via `notes` + `needsReview: true`):
// - The price must be NET of debt: creditors and convertible notes are senior to safes and
//   preferred (§A.3) and are not modeled here.
// - Outstanding options participate as share counts (the guide's Appendix II tables count
//   them in the consideration); exercise-price netting is deal-specific and not computed.
// - The unissued option pool is excluded (§C.1) and only reported as excluded.
// - One preferred series, 1x-or-stated multiple, full (uncapped) participation only.
//   Capped participation, stacked seniority, accruing dividends, escrows and carve-outs
//   are deliberately not built — no published worked example to replay at this bar.
// - Uncapped (discount-only / pre-amendment MFN) safes are rejected: their liquidity
//   treatment needs a fair-market-value input this module refuses to invent (Appendix I).
// Educational model, not legal advice.
// ---------------------------------------------------------------------------

import { floorShares, roundPrice } from './capTable'

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EquityHolder {
  name: string
  /** Whole shares (> 0). Common stock, or outstanding options counted as shares (guide
   * convention — strike netting out of scope). */
  shares: number
  group?: 'common' | 'options'
}

export interface PreferredSeries {
  name: string
  /** As-converted shares (1:1 conversion ratio assumed — stated, not hidden). */
  shares: number
  /** Dollars invested — the preference basis. */
  invested: number
  /** Liquidation preference multiple (Feld: "1x" is the standard; multiples exist). Default 1. */
  preferenceMultiple?: number
  /** Participating preferred takes the preference AND the pro rata share of the residual
   * (Cooley GO glossary). Default false (non-participating: the greater of the two). */
  participating?: boolean
}

export interface WaterfallSafe {
  name: string
  /** Purchase Amount in dollars — the Cash-Out Amount (§A.3). */
  amount: number
  /** Post-money valuation cap. Required: uncapped safes need an FMV input this module
   * refuses to invent (Appendix I §2-3). */
  postMoneyCap: number
}

export interface WaterfallInputs {
  holders: EquityHolder[]
  preferred?: PreferredSeries
  safes?: WaterfallSafe[]
  /** Reported as excluded from the Liquidity Capitalization (§C.1); never shares in proceeds. */
  unissuedPoolShares?: number
}

export type HolderDecision = 'convert' | 'cash-out' | 'preference' | 'participate' | 'as-converted'

export interface ProceedsRow {
  name: string
  kind: 'common' | 'options' | 'preferred' | 'safe'
  /** Shares sharing in the residual distribution; null for a cashed-out safe or a
   * preference-taking preferred. */
  shares: number | null
  decision: HolderDecision
  /** Paid in the preference tier (cash-out amounts, liquidation preference). */
  preferencePayout: number
  /** Paid in the pro rata residual tier. */
  residualPayout: number
  total: number
}

export interface SafeConversionDiagnostic {
  name: string
  /** Conversion Amount shares: floor(ownership × OutstandingShares / (1 − Σ ownership)) —
   * the simultaneous §C.1 solve; fixed regardless of the cash-out decision (Appendix II
   * Q4: "The calculation of each safe holder's Conversion Amount is therefore the same"). */
  shares: number
  /** Post-Money Valuation Cap / Liquidity Capitalization, rounded to 4 decimals. */
  liquidityPrice: number
  /** The hypothetical everyone-converts per-share consideration, rounded to 4 decimals —
   * the decision figure the guide prints ($0.8901 at $10m, $0.2670 at $3m). */
  allConvertPerShare: number
  /** shares × allConvertPerShare — replays the guide's printed comparison figures
   * ($500,026 / $1,000,053 and $149,991 / $299,982). Decisions and payouts use exact
   * (unrounded) arithmetic; this diagnostic uses the guide's display rounding. */
  asConvertedValue: number
  cashOutAmount: number
  decision: 'convert' | 'cash-out'
}

export interface WaterfallReport {
  price: number
  /** Shares actually sharing the residual: outstanding equity + converting safes, minus
   * nothing for cash-outs (§C.1), excluding the unissued pool. */
  residualShares: number
  /** Residual-tier consideration per share, rounded to 4 decimals (display; payouts are
   * exact). Equals the guide's per-share figure when nothing takes a preference. */
  perShare: number
  rows: ProceedsRow[]
  safeConversions: SafeConversionDiagnostic[]
  unissuedPoolSharesExcluded: number
  needsReview: true
  notes: string[]
}

// ---------------------------------------------------------------------------
// Exact-cents allocation (largest remainder) — proceeds must sum to the price
// ---------------------------------------------------------------------------

/** Split `totalDollars` across `weights` proportionally, in whole cents, largest-remainder
 * method (stable: ties break by index). The results sum to the total exactly — the
 * display-rounded per-share arithmetic the guide prints over-distributes (561,764 ×
 * $0.8901 summed across all holders exceeds the $10m price by ~$534), so exact allocation
 * is what preserves the proceeds-sum-to-price invariant. */
export function allocateCents(totalDollars: number, weights: readonly number[]): number[] {
  const totalCents = Math.round(totalDollars * 100)
  const sumW = weights.reduce((a, b) => a + b, 0)
  if (totalCents === 0 || !(sumW > 0)) return weights.map(() => 0)
  const raw = weights.map((w) => (totalCents * w) / sumW)
  const base = raw.map((x) => Math.floor(x + 1e-9))
  let rem = totalCents - base.reduce((a, b) => a + b, 0)
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; rem > 0 && order.length > 0; k = (k + 1) % order.length) {
    base[order[k].i] += 1
    rem--
  }
  return base.map((c) => c / 100)
}

// ---------------------------------------------------------------------------
// Safe conversion shares — the §C.1 simultaneous solve
// ---------------------------------------------------------------------------

/**
 * Conversion Amount shares for each safe: ownershipᵢ = amountᵢ/capᵢ and sharesᵢ =
 * floor(ownershipᵢ × OS / (1 − Σ ownership)), because every safe's shares sit inside every
 * other safe's Liquidity Capitalization (§C.1). Replays Appendix II Example 1 Q3:
 * OS = 9,550,000, ownerships 5% and 10% → 561,764 and 1,123,529 shares
 * ($200,000 / ($4,000,000 / (9,550,000/85%)) and $800,000 / ($8,000,000 / ·)).
 */
export function safeLiquidityShares(
  safes: readonly WaterfallSafe[],
  outstandingShares: number,
): { name: string; shares: number; liquidityPrice: number }[] {
  if (!(outstandingShares > 0)) throw new RangeError('outstandingShares must be > 0')
  let totalOwnership = 0
  for (const s of safes) {
    if (!(s.amount > 0)) throw new RangeError(`safe ${s.name}: amount must be > 0`)
    if (!(s.postMoneyCap > 0)) {
      throw new RangeError(
        `safe ${s.name}: postMoneyCap required — uncapped safes need an FMV input this module refuses to invent (User Guide Appendix I)`,
      )
    }
    if (s.amount >= s.postMoneyCap) throw new RangeError(`safe ${s.name}: amount >= cap sells 100%+ of the company`)
    totalOwnership += s.amount / s.postMoneyCap
  }
  if (totalOwnership >= 1) throw new RangeError('safes sold >= 100% ownership — the waterfall is undefined (§D.2)')
  const liquidityCapitalization = outstandingShares / (1 - totalOwnership)
  return safes.map((s) => ({
    name: s.name,
    shares: floorShares((s.amount / s.postMoneyCap) * liquidityCapitalization),
    liquidityPrice: roundPrice(s.postMoneyCap / liquidityCapitalization),
  }))
}

// ---------------------------------------------------------------------------
// The conversion-indifference point
// ---------------------------------------------------------------------------

/**
 * The price at which a non-participating series is indifferent between its preference and
 * converting: preference = shares/(shares + otherShares) × price*, so
 * price* = preference × (shares + otherShares) / shares. Below it the holder takes the
 * preference, above it conversion pays more (Cooley GO glossary: the holder chooses
 * whichever side is greater; Feld: never both). Holds for the one-series, no-safe table;
 * with safes outstanding the decision interacts and liquidityWaterfall must be consulted.
 */
export function conversionIndifferencePrice(
  preferred: Pick<PreferredSeries, 'shares' | 'invested' | 'preferenceMultiple'>,
  otherShares: number,
): number {
  if (!(preferred.shares > 0) || !(otherShares >= 0)) throw new RangeError('shares must be > 0 and otherShares >= 0')
  const multiple = preferred.preferenceMultiple ?? 1
  if (!(preferred.invested >= 0) || !(multiple > 0)) throw new RangeError('invested >= 0 and multiple > 0 required')
  const preference = preferred.invested * multiple
  return round2((preference * (preferred.shares + otherShares)) / preferred.shares)
}

// ---------------------------------------------------------------------------
// The waterfall engine
// ---------------------------------------------------------------------------

interface DecisionState {
  safeConverts: boolean[]
  /** 'convert' | 'preference' for non-participating; fixed 'participate' for participating. */
  preferredRoute: 'convert' | 'preference' | 'participate' | 'none'
}

function tierTotals(
  state: DecisionState,
  price: number,
  commonShares: number,
  preferred: PreferredSeries | undefined,
  preference: number,
  safeShares: readonly number[],
  safes: readonly WaterfallSafe[],
): { claims: number; residual: number; residualShares: number } {
  let claims = 0
  if (state.preferredRoute === 'preference' || state.preferredRoute === 'participate') claims += preference
  for (let i = 0; i < safes.length; i++) if (!state.safeConverts[i]) claims += safes[i].amount
  const residual = Math.max(0, price - claims)
  let residualShares = commonShares
  if (preferred && state.preferredRoute !== 'preference' && state.preferredRoute !== 'none') residualShares += preferred.shares
  for (let i = 0; i < safes.length; i++) if (state.safeConverts[i]) residualShares += safeShares[i]
  return { claims, residual, residualShares }
}

/**
 * Per-holder proceeds at a given sale price.
 *
 * Mechanics, in the guide's own order:
 * 1. Safe Conversion Amount shares via safeLiquidityShares (§C.1; fixed across scenarios).
 * 2. Decisions solved as a deterministic fixed point: each safe takes the GREATER of its
 *    Purchase Amount and its as-converted proceeds (§A.3); a non-participating series takes
 *    the greater of its preference and its as-converted proceeds (Cooley GO glossary); a
 *    participating series always takes preference + participation (its uncapped total is
 *    never less than converting). The first sweep evaluates everyone at the all-convert
 *    per-share — exactly the guide's Appendix II method — and re-sweeps until stable.
 * 3. Preference tier: cash-out amounts and the liquidation preference rank pari passu
 *    (§A.5-A.6: "on par with payments to other safe holders and preferred stockholders,
 *    and senior to payments to common stockholders"); a shortfall pro-rates by claim.
 * 4. Residual tier: pro rata over common + options + converting safes' shares (+ the
 *    series when converting or participating), allocated in exact cents so the rows sum to
 *    the price (Appendix II Q4: the remaining consideration "is shared pro rata among all
 *    other stockholders").
 */
export function liquidityWaterfall(inputs: WaterfallInputs, price: number): WaterfallReport {
  if (!(price >= 0)) throw new RangeError('price must be >= 0')
  if (inputs.holders.length === 0) throw new RangeError('at least one common/option holder is required')
  for (const h of inputs.holders) {
    if (!(h.shares > 0)) throw new RangeError(`holder ${h.name}: shares must be > 0`)
  }
  const preferred = inputs.preferred
  if (preferred) {
    if (!(preferred.shares > 0)) throw new RangeError(`preferred ${preferred.name}: shares must be > 0`)
    if (!(preferred.invested >= 0)) throw new RangeError(`preferred ${preferred.name}: invested must be >= 0`)
    const m = preferred.preferenceMultiple ?? 1
    if (!(m > 0)) throw new RangeError(`preferred ${preferred.name}: preferenceMultiple must be > 0`)
  }
  const safes = inputs.safes ?? []
  const unissuedPool = inputs.unissuedPoolShares ?? 0
  if (!(unissuedPool >= 0)) throw new RangeError('unissuedPoolShares must be >= 0')

  const commonShares = inputs.holders.reduce((s, h) => s + h.shares, 0)
  // Outstanding securities: issued equity including the series, EXCLUDING the unissued
  // pool (§C.1: the acquirer only buys outstanding equity).
  const outstandingShares = commonShares + (preferred?.shares ?? 0)
  const conversions = safes.length > 0 ? safeLiquidityShares(safes, outstandingShares) : []
  const safeShares = conversions.map((c) => c.shares)
  const preference = preferred ? preferred.invested * (preferred.preferenceMultiple ?? 1) : 0

  // --- Decision fixed point (sweep 2 of the doc comment) ---
  const state: DecisionState = {
    safeConverts: safes.map(() => true),
    preferredRoute: preferred ? (preferred.participating ? 'participate' : 'convert') : 'none',
  }
  for (let iter = 0; iter < 100; iter++) {
    const nextSafe = safes.map((safe, i) => {
      const asConvert = tierTotals({ ...state, safeConverts: state.safeConverts.map((v, j) => (j === i ? true : v)) }, price, commonShares, preferred, preference, safeShares, safes)
      const convertValue = asConvert.residualShares > 0 ? (safeShares[i] / asConvert.residualShares) * asConvert.residual : 0
      const asCash = tierTotals({ ...state, safeConverts: state.safeConverts.map((v, j) => (j === i ? false : v)) }, price, commonShares, preferred, preference, safeShares, safes)
      const cashValue = asCash.claims > 0 ? (safe.amount / asCash.claims) * Math.min(price, asCash.claims) : 0
      return convertValue > cashValue
    })
    let nextPreferred = state.preferredRoute
    if (preferred && !preferred.participating) {
      const asConvert = tierTotals({ safeConverts: nextSafe, preferredRoute: 'convert' }, price, commonShares, preferred, preference, safeShares, safes)
      const convertValue = asConvert.residualShares > 0 ? (preferred.shares / asConvert.residualShares) * asConvert.residual : 0
      const asPref = tierTotals({ safeConverts: nextSafe, preferredRoute: 'preference' }, price, commonShares, preferred, preference, safeShares, safes)
      const prefValue = asPref.claims > 0 ? (preference / asPref.claims) * Math.min(price, asPref.claims) : 0
      nextPreferred = convertValue > prefValue ? 'convert' : 'preference'
    }
    const stable = nextPreferred === state.preferredRoute && nextSafe.every((v, i) => v === state.safeConverts[i])
    state.safeConverts = nextSafe
    state.preferredRoute = nextPreferred
    if (stable) break
  }

  // --- Preference tier (pari passu; shortfall pro-rates by claim) ---
  const claimants: { kind: 'preferred' | 'safe'; index: number; claim: number }[] = []
  if (preferred && (state.preferredRoute === 'preference' || state.preferredRoute === 'participate')) {
    claimants.push({ kind: 'preferred', index: -1, claim: preference })
  }
  safes.forEach((s, i) => {
    if (!state.safeConverts[i]) claimants.push({ kind: 'safe', index: i, claim: s.amount })
  })
  const totalClaims = claimants.reduce((s, c) => s + c.claim, 0)
  const preferencePool = Math.min(price, totalClaims)
  const preferencePayouts = allocateCents(preferencePool, claimants.map((c) => c.claim))

  // --- Residual tier (exact-cents pro rata) ---
  const residual = round2(price - preferencePool)
  const residualParticipants: { kind: 'holder' | 'preferred' | 'safe'; index: number; shares: number }[] = []
  inputs.holders.forEach((h, i) => residualParticipants.push({ kind: 'holder', index: i, shares: h.shares }))
  if (preferred && (state.preferredRoute === 'convert' || state.preferredRoute === 'participate')) {
    residualParticipants.push({ kind: 'preferred', index: -1, shares: preferred.shares })
  }
  safes.forEach((_, i) => {
    if (state.safeConverts[i]) residualParticipants.push({ kind: 'safe', index: i, shares: safeShares[i] })
  })
  const residualShares = residualParticipants.reduce((s, p) => s + p.shares, 0)
  const residualPayouts = allocateCents(residual, residualParticipants.map((p) => p.shares))

  // --- Assemble rows ---
  const prefPayoutOf = (kind: 'preferred' | 'safe', index: number): number => {
    const k = claimants.findIndex((c) => c.kind === kind && c.index === index)
    return k >= 0 ? preferencePayouts[k] : 0
  }
  const residPayoutOf = (kind: 'holder' | 'preferred' | 'safe', index: number): number => {
    const k = residualParticipants.findIndex((p) => p.kind === kind && p.index === index)
    return k >= 0 ? residualPayouts[k] : 0
  }

  const rows: ProceedsRow[] = inputs.holders.map((h, i) => {
    const r = residPayoutOf('holder', i)
    return {
      name: h.name,
      kind: h.group ?? 'common',
      shares: h.shares,
      decision: 'as-converted' as const,
      preferencePayout: 0,
      residualPayout: r,
      total: r,
    }
  })
  if (preferred) {
    const p = prefPayoutOf('preferred', -1)
    const r = residPayoutOf('preferred', -1)
    rows.push({
      name: preferred.name,
      kind: 'preferred',
      shares: state.preferredRoute === 'preference' ? null : preferred.shares,
      decision: state.preferredRoute === 'participate' ? 'participate' : state.preferredRoute === 'convert' ? 'convert' : 'preference',
      preferencePayout: p,
      residualPayout: r,
      total: round2(p + r),
    })
  }
  const allConvertShares = outstandingShares + safeShares.reduce((a, b) => a + b, 0)
  const allConvertPerShare = allConvertShares > 0 ? roundPrice(price / allConvertShares) : 0
  const diagnostics: SafeConversionDiagnostic[] = conversions.map((c, i) => {
    const p = prefPayoutOf('safe', i)
    const r = residPayoutOf('safe', i)
    rows.push({
      name: safes[i].name,
      kind: 'safe',
      shares: state.safeConverts[i] ? c.shares : null,
      decision: state.safeConverts[i] ? 'convert' : 'cash-out',
      preferencePayout: p,
      residualPayout: r,
      total: round2(p + r),
    })
    return {
      name: c.name,
      shares: c.shares,
      liquidityPrice: c.liquidityPrice,
      allConvertPerShare,
      asConvertedValue: round2(c.shares * allConvertPerShare),
      cashOutAmount: safes[i].amount,
      decision: state.safeConverts[i] ? 'convert' : 'cash-out',
    }
  })

  return {
    price,
    residualShares,
    perShare: residualShares > 0 ? roundPrice(residual / residualShares) : 0,
    rows,
    safeConversions: diagnostics,
    unissuedPoolSharesExcluded: unissuedPool,
    needsReview: true,
    notes: [
      'Price must be net of debt: creditors and convertible notes rank senior to safes and preferred (User Guide §A.3) and are not modeled.',
      'Outstanding options participate as share counts; exercise-price netting is deal-specific and not computed.',
      `Unissued option pool (${unissuedPool.toLocaleString('en-US')} shares) excluded from the Liquidity Capitalization (§C.1).`,
      'Capped participation, stacked seniority, accruing dividends, escrows and carve-outs are out of scope. Educational model, not legal advice.',
    ],
  }
}
