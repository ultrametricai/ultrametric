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
// - liquidityWaterfall: one preferred series, 1x-or-stated multiple, full (uncapped)
//   participation only. Capped participation, stacked seniority, accruing dividends,
//   options with exercise prices, notes, escrows and carve-outs are in waterfallAnalysis
//   (the second half of this file), replayed against the Equidam, Hustle Fund, CPA Journal
//   and CRV worked examples in __tests__/waterfallAnalysis.test.ts.
// - Uncapped (discount-only / pre-amendment MFN) safes are rejected: their liquidity
//   treatment needs a fair-market-value input this module refuses to invent (Appendix I).
// Educational model, not legal advice.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { floorShares, roundPrice } from './rounding'
import { accruedSimpleInterest, daysBetween } from './convertibleNote'
import { entrySpec } from './entryValidation'

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

/** Structural schema of WaterfallInputs — the registry entry contract (field names and
 * types; value rules stay in the function). */
export const WaterfallInputsSchema = z.object({
  holders: z.array(
    z.object({ name: z.string(), shares: z.number(), group: z.enum(['common', 'options']).optional() }),
  ),
  preferred: z
    .object({
      name: z.string(),
      shares: z.number(),
      invested: z.number(),
      preferenceMultiple: z.number().optional(),
      participating: z.boolean().optional(),
    })
    .optional(),
  safes: z.array(z.object({ name: z.string(), amount: z.number(), postMoneyCap: z.number() })).optional(),
  unissuedPoolShares: z.number().optional(),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const liquidityWaterfallEntry = entrySpec('liquidityWaterfall', [
  { name: 'inputs', schema: WaterfallInputsSchema },
  { name: 'price', schema: z.number() },
])

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
    base[order[k]!.i]! += 1
    rem--
  }
  return base.map((c) => c / 100)
}

/** allocateCents with a per-row ceiling: rows over their cap give the excess back to rows
 * with room, repeated until every row fits (the caps must sum to at least the total). */
export function allocateCentsCapped(totalDollars: number, weights: readonly number[], caps: readonly number[]): number[] {
  const out = weights.map(() => 0)
  let remaining = Math.round(totalDollars * 100)
  const capCents = caps.map((c) => Math.round(c * 100))
  let open = weights.map((w, i) => (w > 0 && capCents[i]! > 0 ? i : -1)).filter((i) => i >= 0)
  if (open.length === 0) open = capCents.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0)
  // Each redistribution either spends the remainder or fills at least one row's cap.
  while (remaining > 0 && open.length > 0) {
    const w = open.map((i) => (weights[i]! > 0 ? weights[i]! : capCents[i]!))
    const parts = allocateCents(remaining / 100, w).map((x) => Math.round(x * 100))
    remaining = 0
    open.forEach((i, k) => {
      const room = capCents[i]! - out[i]!
      const take = Math.min(room, parts[k]!)
      out[i]! += take
      remaining += parts[k]! - take
    })
    open = open.filter((i) => out[i]! < capCents[i]!)
    // Rounding may leave less capacity in positive-weight rows than the escrow budget.
    // Use remaining holder capacity only after those rows have been exhausted.
    if (remaining > 0 && open.length === 0) {
      open = capCents.map((c, i) => (out[i]! < c ? i : -1)).filter((i) => i >= 0)
    }
  }
  if (remaining > 0) throw new RangeError('allocateCentsCapped: caps are smaller than the total')
  return out.map((c) => c / 100)
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
  for (let i = 0; i < safes.length; i++) if (!state.safeConverts[i]) claims += safes[i]!.amount
  const residual = Math.max(0, price - claims)
  let residualShares = commonShares
  if (preferred && state.preferredRoute !== 'preference' && state.preferredRoute !== 'none') residualShares += preferred.shares
  for (let i = 0; i < safes.length; i++) if (state.safeConverts[i]) residualShares += safeShares[i]!
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
  liquidityWaterfallEntry.validate(inputs, price)
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
      const convertValue = asConvert.residualShares > 0 ? (safeShares[i]! / asConvert.residualShares) * asConvert.residual : 0
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
    if (state.safeConverts[i]) residualParticipants.push({ kind: 'safe', index: i, shares: safeShares[i]! })
  })
  const residualShares = residualParticipants.reduce((s, p) => s + p.shares, 0)
  const residualPayouts = allocateCents(residual, residualParticipants.map((p) => p.shares))

  // --- Assemble rows ---
  const prefPayoutOf = (kind: 'preferred' | 'safe', index: number): number => {
    const k = claimants.findIndex((c) => c.kind === kind && c.index === index)
    return k >= 0 ? preferencePayouts[k]! : 0
  }
  const residPayoutOf = (kind: 'holder' | 'preferred' | 'safe', index: number): number => {
    const k = residualParticipants.findIndex((p) => p.kind === kind && p.index === index)
    return k >= 0 ? residualPayouts[k]! : 0
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
      name: safes[i]!.name,
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
      cashOutAmount: safes[i]!.amount,
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

// ===========================================================================
// Waterfall analysis: stacked series, participation caps, dividends, options with
// exercise prices, notes, exit deductions, and the breakpoint schedule
// ===========================================================================
//
// Extension (cap-table analysis pass, 2026-11). liquidityWaterfall above keeps its scope and
// tests unchanged; waterfallAnalysis is the general engine. Sources for the added terms
// (each formula's doc comment names the one it uses):
// - NVCA Model Certificate of Incorporation (https://nvca.org/model-legal-documents/; a
//   document download), Article Fourth, Part B: §1 (Accruing Dividends that "accrue from
//   day to day" and are cumulative), §2.1 (the per-share preference is the greater of the
//   preference multiple of the Original Issue Price plus accrued and declared-but-unpaid
//   dividends, or the as-converted amount), §2.1 alternatives for senior/junior and pari
//   passu series (a shortfall is shared "ratably ... in proportion to the respective amounts
//   which would otherwise be payable"), §2.2 (participation pro rata "as if ... converted to
//   Common Stock", with the optional cap expressed as a multiple of the Original Issue
//   Price and the holder's greater-of comparison against conversion).
// - AICPA Accounting and Valuation Guide, "Valuation of Privately-Held-Company Equity
//   Securities Issued as Compensation" (2013), the option-pricing-method discussion of
//   breakpoints: the equity value at which each class begins (or stops) sharing, with the
//   share fractions between breakpoints. The guide is a paid AICPA publication; the method
//   is reproduced here from its published description and replayed against the reachable
//   worked examples cited in the tests.
// - YC Post-Money Safe User Guide §A.3, §C.1 (via safeLiquidityShares above) for safes.
// - Cooley GO, "Primer on Convertible Debt" (https://www.cooleygo.com/convertible-debt/) for
//   notes as indebtedness with accrued interest (via accruedSimpleInterest's convention).
//
// Scope notes (repeated on every report as `notes`, with needsReview: true):
// - Every per-security payout is a piecewise-linear function of the equity value, read off
//   the breakpoint schedule. Conversion decisions are the equilibrium of each holder taking
//   the greater of its preference route and its as-converted route given everyone else's
//   choice (conversionEquilibrium solves that directly and the tests assert both agree).
// - Options and warrants convert into common one-for-one and are paid only above their
//   exercise price. Gross and treasury-style net exercise produce the same net proceeds
//   (algebra in optionExerciseNote); the mode changes the reported columns.
// - Carve-out, escrow and note ordering conventions are stated on their inputs; the charter,
//   merger agreement and plan documents control. Educational model, not legal advice.

/** Participation terms of a preferred series (NVCA Model COD Art. Fourth B §2.2). */
export type ParticipationKind = 'non-participating' | 'participating' | 'capped'

export interface DividendTerms {
  /** Annual dividend rate, percent of the Original Issue Price. */
  annualRatePct: number
  /** Cumulative (accruing) dividends add to the preference whether or not declared (NVCA
   * Model COD §1 / §2.1); non-cumulative dividends add only `declaredUnpaid`. */
  cumulative: boolean
  /** Accrual start (ISO date), usually the series' original issue date. Required when
   * cumulative. */
  accruesFrom?: string
  /** 'simple' (default, the NVCA "accrue from day to day" form) or 'annual' compounding. */
  compounding?: 'simple' | 'annual'
  /** Day-count basis for the accrual fraction (default 365). */
  basisDays?: 360 | 365
  /** Dividends declared but unpaid, in dollars for the whole series (default 0). */
  declaredUnpaid?: number
  /** Cumulative dividends already accrued to the exit, in dollars for the whole series, as
   * stated by the caller; replaces the date-based accrual (accruesFrom is then not needed). */
  accruedAmount?: number
  /** Default false: dividends are part of the preference and forfeited on conversion (NVCA
   * Model COD §2.1 greater-of). true: the charter pays them as a separate claim ahead of the
   * series' preference and also on conversion (the CPA Journal OPM example's Series A
   * dividend, "payable prior to the liquidation preference or conversion"). */
  survivesConversion?: boolean
}

export interface AnalysisSeries {
  name: string
  /** Preferred shares outstanding. */
  shares: number
  /** Original Issue Price per preferred share. */
  originalIssuePrice: number
  /** Liquidation preference multiple of the Original Issue Price (default 1). */
  preferenceMultiple?: number
  /** Common shares per preferred share on conversion (default 1; after an anti-dilution
   * adjustment this is OIP ÷ adjusted conversion price, antiDilution.conversionRatio). */
  conversionRatio?: number
  /** Default 'non-participating'. */
  participation?: ParticipationKind
  /** Required for 'capped': total per-share return (preference plus participation) as a
   * multiple of the Original Issue Price (NVCA Model COD §2.2 cap alternative). */
  participationCapMultiple?: number
  /** Seniority rank: 1 is the most senior; equal ranks are pari passu. Default 1. */
  seniority?: number
  dividends?: DividendTerms
  /** Optional per-holder split of the series (shares must sum to `shares`). */
  holders?: { name: string; shares: number }[]
}

export interface AnalysisCommonHolder {
  name: string
  shares: number
  /** Class label for per-class output (default 'Common'). */
  class?: string
}

export interface AnalysisOption {
  name: string
  /** Default 'option'. Both exercise into common one-for-one. */
  kind?: 'option' | 'warrant'
  /** Outstanding shares under the grant (vested plus unvested). */
  shares: number
  exercisePrice: number
  /** Vested shares at the exit date (default: all). */
  vestedShares?: number
  /** Class label (default 'Options' or 'Warrants'). */
  class?: string
}

export interface AnalysisSafe extends WaterfallSafe {
  /** Seniority rank; default: pari passu with the most junior preferred series (the post-money
   * safe ranks "on par with payments for other Safes and/or Preferred Stock", User Guide §A.5;
   * with a stacked preferred the caller states which tier). */
  seniority?: number
}

export interface AnalysisNote {
  name: string
  principal: number
  /** Annual simple interest rate, percent. */
  annualRatePct: number
  issuedOn: string
  basisDays?: 360 | 365
  /** Change-of-control repayment multiple of principal plus interest (default 1). */
  repaymentMultiple?: number
  /** Common shares the note may take instead of repayment at the exit, computed by the caller
   * from the note's own change-of-control conversion terms. Omit for repayment only. */
  conversionShares?: number
}

export interface ExitDeductions {
  /** Debt repaid at closing, ahead of every equity security and the notes. */
  debtPayoff?: number
  /** Transaction expenses borne by the sellers. */
  transactionExpenses?: number
  /** Management carve-out pool, paid from net proceeds ahead of the security stack:
   * min(net, fixed + pctOfNet% × net). */
  carveOut?: { fixed?: number; pctOfNet?: number; recipients: { name: string; weight: number }[] }
  /** Escrow or holdback withheld at closing: `amount` dollars or `pctOfExit`% of the exit
   * value, capped at the equity value. 'waterfall' (default) runs the waterfall at the
   * closing amount and attributes the release incrementally; 'pro-rata' withholds the same
   * fraction from every holder. */
  escrow?: { amount?: number; pctOfExit?: number; allocation?: 'waterfall' | 'pro-rata' }
}

export interface WaterfallAnalysisInputs {
  /** ISO date of the exit; required for cumulative dividends and notes. */
  exitDate?: string
  common: AnalysisCommonHolder[]
  options?: AnalysisOption[]
  series?: AnalysisSeries[]
  safes?: AnalysisSafe[]
  notes?: AnalysisNote[]
  /** Required whenever any option has unvested shares: 'accelerate' counts them, 'cancel'
   * excludes them (reported as excluded). */
  unvestedAtExit?: 'accelerate' | 'cancel'
  /** Reporting mode for exercised options (default 'net'); net proceeds are identical. */
  exerciseMode?: 'gross' | 'net'
  deductions?: ExitDeductions
  /** Reported only: the unissued pool never shares in proceeds (User Guide §C.1). */
  unissuedPoolShares?: number
}

const DividendTermsSchema = z.object({
  annualRatePct: z.number(),
  cumulative: z.boolean(),
  accruesFrom: z.string().optional(),
  compounding: z.enum(['simple', 'annual']).optional(),
  basisDays: z.union([z.literal(360), z.literal(365)]).optional(),
  declaredUnpaid: z.number().optional(),
  accruedAmount: z.number().optional(),
  survivesConversion: z.boolean().optional(),
})

/** Structural schema of WaterfallAnalysisInputs (value rules stay in the functions). */
export const WaterfallAnalysisInputsSchema = z.object({
  exitDate: z.string().optional(),
  common: z.array(z.object({ name: z.string(), shares: z.number(), class: z.string().optional() })),
  options: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(['option', 'warrant']).optional(),
        shares: z.number(),
        exercisePrice: z.number(),
        vestedShares: z.number().optional(),
        class: z.string().optional(),
      }),
    )
    .optional(),
  series: z
    .array(
      z.object({
        name: z.string(),
        shares: z.number(),
        originalIssuePrice: z.number(),
        preferenceMultiple: z.number().optional(),
        conversionRatio: z.number().optional(),
        participation: z.enum(['non-participating', 'participating', 'capped']).optional(),
        participationCapMultiple: z.number().optional(),
        seniority: z.number().optional(),
        dividends: DividendTermsSchema.optional(),
        holders: z.array(z.object({ name: z.string(), shares: z.number() })).optional(),
      }),
    )
    .optional(),
  safes: z
    .array(z.object({ name: z.string(), amount: z.number(), postMoneyCap: z.number(), seniority: z.number().optional() }))
    .optional(),
  notes: z
    .array(
      z.object({
        name: z.string(),
        principal: z.number(),
        annualRatePct: z.number(),
        issuedOn: z.string(),
        basisDays: z.union([z.literal(360), z.literal(365)]).optional(),
        repaymentMultiple: z.number().optional(),
        conversionShares: z.number().optional(),
      }),
    )
    .optional(),
  unvestedAtExit: z.enum(['accelerate', 'cancel']).optional(),
  exerciseMode: z.enum(['gross', 'net']).optional(),
  deductions: z
    .object({
      debtPayoff: z.number().optional(),
      transactionExpenses: z.number().optional(),
      carveOut: z
        .object({
          fixed: z.number().optional(),
          pctOfNet: z.number().optional(),
          recipients: z.array(z.object({ name: z.string(), weight: z.number() })),
        })
        .optional(),
      escrow: z
        .object({
          amount: z.number().optional(),
          pctOfExit: z.number().optional(),
          allocation: z.enum(['waterfall', 'pro-rata']).optional(),
        })
        .optional(),
    })
    .optional(),
  unissuedPoolShares: z.number().optional(),
})

export const waterfallAnalysisEntry = entrySpec('waterfallAnalysis', [
  { name: 'inputs', schema: WaterfallAnalysisInputsSchema },
  { name: 'exitValue', schema: z.number() },
])

export const waterfallBreakpointsEntry = entrySpec('waterfallBreakpoints', [
  { name: 'inputs', schema: WaterfallAnalysisInputsSchema },
])

export type SecurityKind = 'common' | 'option' | 'warrant' | 'preferred' | 'safe' | 'note'

/** How a security takes value: common shares from the first residual dollar; options above
 * their exercise price; convertibles (non-participating preferred, safes, convertible
 * notes) take the greater of the claim and the as-converted route; participating preferred
 * takes both; capped participation takes both up to the cap, then the greater of the cap
 * and conversion; repay-only notes take the claim. */
export type SecurityMode = 'common' | 'option' | 'convertible' | 'participating' | 'capped' | 'claim-only'

export interface SecuritySummary {
  id: string
  name: string
  class: string
  kind: SecurityKind
  mode: SecurityMode
  /** Shares held: common shares, option shares counted at exit, preferred shares, safe
   * conversion shares, note conversion shares (0 for repay-only notes). */
  shares: number
  /** As-converted common shares that share in the residual when participating. */
  residualShares: number
  /** Preference-tier claim in dollars (0 for common, options, warrants). */
  claim: number
  /** Seniority rank of the claim (0 = notes, ahead of every preferred tier); null when none. */
  tier: number | null
  exercisePrice: number | null
  /** Capped participation: the total-return cap in dollars for the whole series. */
  capTotal: number | null
  /** Equity value at which the security starts sharing the residual (null = never). */
  joinsAtEquityValue: number | null
  /** Capped participation: equity value at which participation stops at the cap. */
  capReachedAtEquityValue: number | null
  holders: { name: string; shares: number }[]
  /** Claim detail: accrued dividends and note interest in dollars. */
  accruedDividends: number
  accruedInterest: number
}

export interface TrancheParticipant {
  security: string
  class: string
  fraction: number
}

export interface WaterfallTranche {
  index: number
  phase: 'preference' | 'residual'
  fromEquityValue: number
  /** null for the open-ended final tranche. */
  toEquityValue: number | null
  fromExitValue: number
  toExitValue: number | null
  /** Residual tranches: the as-converted shares sharing it (fractions are shares / total). */
  participatingShares: number | null
  /** Residual tranches: the per-common-share value at the tranche's lower bound (it can
   * exceed the previous tranche's top when no shares participate over an interval). */
  fromCommonValuePerShare: number | null
  /** Securities sharing the tranche and their fractions (sum to 1). */
  participants: TrancheParticipant[]
  /** The same fractions summed by class. */
  classFractions: { class: string; fraction: number }[]
}

export interface WaterfallBreakpoint {
  equityValue: number
  exitValue: number
  /** Per-common-share residual value at the breakpoint (null in the preference phase). */
  commonValuePerShare: number | null
  events: string[]
}

export interface BreakpointSchedule {
  securities: SecuritySummary[]
  classes: string[]
  tranches: WaterfallTranche[]
  breakpoints: WaterfallBreakpoint[]
  /** Exit-to-equity mapping inputs (debt, expenses, carve-out). */
  deductions: { debtPayoff: number; transactionExpenses: number; carveOutFixed: number; carveOutPct: number }
  excludedUnvestedOptionShares: number
  needsReview: true
  notes: string[]
}

const EPS = 1e-9

function nonNeg(x: number | undefined, what: string): number {
  const v = x ?? 0
  if (!(v >= 0) || !Number.isFinite(v)) throw new RangeError(`${what} must be a finite number >= 0`)
  return v
}

/**
 * Accrued dividends on a series to the exit date. Cumulative: NVCA Model COD Art. Fourth B §1
 * ("Accruing Dividends shall accrue from day to day ... and shall be cumulative"), simple by
 * default: OIP × rate × days/basis per share; 'annual' compounding: OIP × ((1 + rate)^(days/basis) − 1).
 * Non-cumulative: only dividends declared but unpaid (§2.1 adds "any other dividends declared
 * but unpaid thereon"). Returns dollars for the whole series.
 */
export function accruedSeriesDividends(series: Pick<AnalysisSeries, 'name' | 'shares' | 'originalIssuePrice' | 'dividends'>, exitDate?: string): number {
  const d = series.dividends
  if (!d) return 0
  const declared = nonNeg(d.declaredUnpaid, `series ${series.name}: dividends.declaredUnpaid`)
  if (!(d.annualRatePct >= 0)) throw new RangeError(`series ${series.name}: dividends.annualRatePct must be >= 0`)
  if (!d.cumulative) return declared
  if (d.accruedAmount !== undefined) return nonNeg(d.accruedAmount, `series ${series.name}: dividends.accruedAmount`) + declared
  if (!d.accruesFrom) throw new RangeError(`series ${series.name}: cumulative dividends need accruesFrom`)
  if (!exitDate) throw new RangeError(`series ${series.name}: cumulative dividends need inputs.exitDate`)
  const t = daysBetween(d.accruesFrom, exitDate) / (d.basisDays ?? 365)
  const r = d.annualRatePct / 100
  const perShare = d.compounding === 'annual' ? series.originalIssuePrice * (Math.pow(1 + r, t) - 1) : series.originalIssuePrice * r * t
  return perShare * series.shares + declared
}

/** Build the security list (claims, tiers, thresholds) from the analysis inputs. */
function resolveSecurities(inputs: WaterfallAnalysisInputs): { securities: SecuritySummary[]; excludedUnvested: number } {
  if (inputs.common.length === 0 && (inputs.options ?? []).length === 0 && (inputs.series ?? []).length === 0) {
    throw new RangeError('at least one common holder, option, or preferred series is required')
  }
  const ids = new Set<string>()
  const securities: SecuritySummary[] = []
  const base = (id: string): string => {
    if (ids.has(id)) throw new RangeError(`duplicate security name ${id}`)
    ids.add(id)
    return id
  }
  const blank = { capTotal: null, joinsAtEquityValue: null, capReachedAtEquityValue: null, accruedDividends: 0, accruedInterest: 0 }

  for (const h of inputs.common) {
    if (!(h.shares > 0)) throw new RangeError(`common ${h.name}: shares must be > 0`)
    securities.push({
      ...blank,
      id: base(h.name),
      name: h.name,
      class: h.class ?? 'Common',
      kind: 'common',
      mode: 'common',
      shares: h.shares,
      residualShares: h.shares,
      claim: 0,
      tier: null,
      exercisePrice: null,
      holders: [{ name: h.name, shares: h.shares }],
    })
  }

  let excludedUnvested = 0
  for (const o of inputs.options ?? []) {
    if (!(o.shares > 0)) throw new RangeError(`option ${o.name}: shares must be > 0`)
    if (!(o.exercisePrice >= 0)) throw new RangeError(`option ${o.name}: exercisePrice must be >= 0`)
    const vested = o.vestedShares ?? o.shares
    if (!(vested >= 0 && vested <= o.shares)) throw new RangeError(`option ${o.name}: vestedShares must be in [0, shares]`)
    let counted = o.shares
    if (vested < o.shares) {
      if (!inputs.unvestedAtExit) {
        throw new RangeError(`option ${o.name} has unvested shares: state unvestedAtExit ('accelerate' or 'cancel') explicitly`)
      }
      if (inputs.unvestedAtExit === 'cancel') {
        excludedUnvested += o.shares - vested
        counted = vested
      }
    }
    if (counted === 0) continue
    const kind = o.kind ?? 'option'
    securities.push({
      ...blank,
      id: base(o.name),
      name: o.name,
      class: o.class ?? (kind === 'warrant' ? 'Warrants' : 'Options'),
      kind,
      mode: 'option',
      shares: counted,
      residualShares: counted,
      claim: 0,
      tier: null,
      exercisePrice: o.exercisePrice,
      holders: [{ name: o.name, shares: counted }],
    })
  }

  const seriesList = inputs.series ?? []
  let juniorMost = 1
  for (const s of seriesList) {
    if (!(s.shares > 0)) throw new RangeError(`series ${s.name}: shares must be > 0`)
    if (!(s.originalIssuePrice > 0)) throw new RangeError(`series ${s.name}: originalIssuePrice must be > 0`)
    const multiple = s.preferenceMultiple ?? 1
    if (!(multiple >= 0)) throw new RangeError(`series ${s.name}: preferenceMultiple must be >= 0`)
    const ratio = s.conversionRatio ?? 1
    if (!(ratio > 0)) throw new RangeError(`series ${s.name}: conversionRatio must be > 0`)
    const seniority = s.seniority ?? 1
    if (!Number.isInteger(seniority) || seniority < 1) throw new RangeError(`series ${s.name}: seniority must be an integer >= 1`)
    juniorMost = Math.max(juniorMost, seniority)
    const participation = s.participation ?? 'non-participating'
    const dividends = accruedSeriesDividends(s, inputs.exitDate)
    const separateDividend = s.dividends?.survivesConversion === true && dividends > 0
    const claim = multiple * s.originalIssuePrice * s.shares + (separateDividend ? 0 : dividends)
    let capTotal: number | null = null
    if (participation === 'capped') {
      const capM = s.participationCapMultiple
      if (capM === undefined || !(capM > 0)) throw new RangeError(`series ${s.name}: capped participation needs participationCapMultiple > 0`)
      capTotal = capM * s.originalIssuePrice * s.shares
    } else if (s.participationCapMultiple !== undefined) {
      throw new RangeError(`series ${s.name}: participationCapMultiple applies only to participation 'capped'`)
    }
    const holders = s.holders && s.holders.length > 0 ? s.holders : [{ name: s.name, shares: s.shares }]
    const held = holders.reduce((a, h) => a + h.shares, 0)
    if (holders.some((h) => !(h.shares > 0)) || Math.abs(held - s.shares) > EPS) {
      throw new RangeError(`series ${s.name}: holder shares must be > 0 and sum to the series' shares`)
    }
    securities.push({
      ...blank,
      id: base(s.name),
      name: s.name,
      class: s.name,
      kind: 'preferred',
      mode: participation === 'participating' ? 'participating' : participation === 'capped' ? 'capped' : 'convertible',
      shares: s.shares,
      residualShares: s.shares * ratio,
      claim,
      tier: seniority,
      exercisePrice: null,
      capTotal,
      accruedDividends: separateDividend ? 0 : dividends,
      holders,
    })
    if (separateDividend) {
      // Paid as its own claim immediately ahead of the series' preference (rank − 0.5) and kept
      // whether or not the series converts.
      securities.push({
        ...blank,
        id: base(`${s.name} dividends`),
        name: `${s.name} dividends`,
        class: `${s.name} dividends`,
        kind: 'preferred',
        mode: 'claim-only',
        shares: 0,
        residualShares: 0,
        claim: dividends,
        tier: seniority - 0.5,
        exercisePrice: null,
        accruedDividends: dividends,
        holders: holders.map((h) => ({ ...h })),
      })
    }
  }

  const safes = inputs.safes ?? []
  if (safes.length > 0) {
    // Liquidity Capitalization (User Guide §C.1): issued and outstanding capital stock on an
    // as-converted basis plus issued and outstanding options, excluding the unissued pool.
    // Every outstanding option counts here, vested or not, in or out of the money. Notes with
    // change-of-control conversion shares count as Converting Securities (the guide's Appendix
    // II Q4 convention of one fixed solve, as for the safes themselves).
    const optionsOutstanding = (inputs.options ?? []).reduce((a, o) => a + o.shares, 0)
    const noteConversionShares = (inputs.notes ?? []).reduce((a, n) => a + (n.conversionShares ?? 0), 0)
    const outstanding =
      inputs.common.reduce((a, h) => a + h.shares, 0) +
      optionsOutstanding +
      noteConversionShares +
      securities.filter((s) => s.kind === 'preferred').reduce((a, s) => a + s.residualShares, 0)
    const conv = safeLiquidityShares(safes, outstanding)
    safes.forEach((safe, i) => {
      const seniority = safe.seniority ?? juniorMost
      if (!Number.isInteger(seniority) || seniority < 1) throw new RangeError(`safe ${safe.name}: seniority must be an integer >= 1`)
      securities.push({
        ...blank,
        id: base(safe.name),
        name: safe.name,
        class: 'Safes',
        kind: 'safe',
        mode: conv[i]!.shares > 0 ? 'convertible' : 'claim-only',
        shares: conv[i]!.shares,
        residualShares: conv[i]!.shares,
        claim: safe.amount,
        tier: seniority,
        exercisePrice: null,
        holders: [{ name: safe.name, shares: conv[i]!.shares }],
      })
    })
  }

  for (const n of inputs.notes ?? []) {
    if (!inputs.exitDate) throw new RangeError(`note ${n.name}: notes need inputs.exitDate for accrued interest`)
    const accrued = accruedSimpleInterest(n.principal, n.annualRatePct, n.issuedOn, inputs.exitDate, n.basisDays === undefined ? undefined : { basisDays: n.basisDays })
    const multiple = n.repaymentMultiple ?? 1
    if (!(multiple > 0)) throw new RangeError(`note ${n.name}: repaymentMultiple must be > 0`)
    const conversion = n.conversionShares ?? 0
    if (!(conversion >= 0)) throw new RangeError(`note ${n.name}: conversionShares must be >= 0`)
    securities.push({
      ...blank,
      id: base(n.name),
      name: n.name,
      class: 'Convertible notes',
      kind: 'note',
      mode: conversion > 0 ? 'convertible' : 'claim-only',
      shares: conversion,
      residualShares: conversion,
      claim: accrued.total * multiple,
      tier: 0,
      exercisePrice: null,
      accruedInterest: accrued.interest,
      holders: [{ name: n.name, shares: conversion }],
    })
  }
  return { securities, excludedUnvested }
}

function resolveDeductions(d: ExitDeductions | undefined): BreakpointSchedule['deductions'] {
  const debtPayoff = nonNeg(d?.debtPayoff, 'deductions.debtPayoff')
  const transactionExpenses = nonNeg(d?.transactionExpenses, 'deductions.transactionExpenses')
  const carveOutFixed = nonNeg(d?.carveOut?.fixed, 'deductions.carveOut.fixed')
  const carveOutPct = nonNeg(d?.carveOut?.pctOfNet, 'deductions.carveOut.pctOfNet')
  if (carveOutPct >= 100) throw new RangeError('deductions.carveOut.pctOfNet must be < 100')
  if (d?.carveOut) {
    const w = d.carveOut.recipients
    if (w.length === 0 || w.some((r) => !(r.weight > 0))) throw new RangeError('deductions.carveOut.recipients need weights > 0')
  }
  return { debtPayoff, transactionExpenses, carveOutFixed, carveOutPct }
}

/** Net proceeds, carve-out and equity value at a headline exit value. */
function exitToEquity(exitValue: number, d: BreakpointSchedule['deductions']): { net: number; carveOut: number; equity: number } {
  const net = Math.max(0, exitValue - d.debtPayoff - d.transactionExpenses)
  const carveOut = Math.min(net, d.carveOutFixed + (d.carveOutPct / 100) * net)
  return { net, carveOut, equity: Math.max(0, net - carveOut) }
}

/** The smallest headline exit value delivering `equity` to the security stack. */
function equityToExit(equity: number, d: BreakpointSchedule['deductions']): number {
  const net = (equity + d.carveOutFixed) / (1 - d.carveOutPct / 100)
  return net + d.debtPayoff + d.transactionExpenses
}

/**
 * The breakpoint schedule: the equity values at which each security starts or stops sharing
 * proceeds, and the share fractions in every tranche between them (the AICPA guide's OPM
 * breakpoint analysis; the same schedule prices the waterfall at any exit value).
 *
 * 1. Preference phase: seniority tiers in rank order (notes at rank 0, then preferred and safe
 *    tiers); within a tier claims are paid ratably by amount (NVCA Model COD §2.1 pari passu
 *    alternative).
 * 2. Residual phase, indexed by v, the value per as-converted common share: common shares
 *    share from v = 0; participating preferred shares as converted (NVCA §2.2); an option
 *    joins at v = its exercise price; a convertible joins at v = claim ÷ as-converted shares,
 *    the point where converting stops paying less than the claim (NVCA §2.1's greater-of; YC
 *    User Guide §A.3); a capped series stops at v = (cap − claim) ÷ shares and rejoins at
 *    v = cap ÷ shares, where conversion first beats the cap (NVCA §2.2 cap alternative).
 * Each residual tranche's size is (Δv) × the shares sharing it, so every payout is continuous
 * and non-decreasing in the equity value.
 */
export function waterfallBreakpoints(inputs: WaterfallAnalysisInputs): BreakpointSchedule {
  waterfallBreakpointsEntry.validate(inputs)
  const { securities, excludedUnvested } = resolveSecurities(inputs)
  const deductions = resolveDeductions(inputs.deductions)
  const classOf = new Map(securities.map((s) => [s.id, s.class]))
  const classes = [...new Set(securities.map((s) => s.class))]
  const tranches: WaterfallTranche[] = []
  const breakpoints: WaterfallBreakpoint[] = []
  const toExit = (e: number) => equityToExit(e, deductions)

  const pushTranche = (phase: WaterfallTranche['phase'], from: number, to: number | null, weights: Map<string, number>, participatingShares: number | null, fromV: number | null = null) => {
    const total = [...weights.values()].reduce((a, b) => a + b, 0)
    const participants = [...weights.entries()]
      .filter(([, w]) => w > 0)
      .map(([id, w]) => ({ security: id, class: classOf.get(id) as string, fraction: w / total }))
    const byClass = new Map<string, number>()
    for (const p of participants) byClass.set(p.class, (byClass.get(p.class) ?? 0) + p.fraction)
    tranches.push({
      index: tranches.length,
      phase,
      fromEquityValue: from,
      toEquityValue: to,
      fromExitValue: toExit(from),
      toExitValue: to === null ? null : toExit(to),
      participatingShares,
      fromCommonValuePerShare: fromV,
      participants,
      classFractions: classes.filter((c) => byClass.has(c)).map((c) => ({ class: c, fraction: byClass.get(c) as number })),
    })
  }
  const addBreakpoint = (equityValue: number, v: number | null, event: string) => {
    const last = breakpoints[breakpoints.length - 1]
    if (last && Math.abs(last.equityValue - equityValue) <= EPS * Math.max(1, equityValue)) {
      last.events.push(event)
      if (v !== null) last.commonValuePerShare = v
      return
    }
    breakpoints.push({ equityValue, exitValue: toExit(equityValue), commonValuePerShare: v, events: [event] })
  }

  // --- 1. Preference phase ---
  let cum = 0
  const tiers = [...new Set(securities.filter((s) => s.claim > 0 && s.tier !== null).map((s) => s.tier as number))].sort((a, b) => a - b)
  for (const tier of tiers) {
    const members = securities.filter((s) => s.tier === tier && s.claim > 0)
    const total = members.reduce((a, s) => a + s.claim, 0)
    pushTranche('preference', cum, cum + total, new Map(members.map((s) => [s.id, s.claim])), null, null)
    cum += total
    addBreakpoint(cum, null, `rank ${tier} claims paid in full (${members.map((s) => s.name).join(', ')})`)
  }

  // --- 2. Residual phase ---
  interface Pending { v: number; id: string; action: 'join' | 'leave'; label: string }
  const pending: Pending[] = []
  const active = new Map<string, number>()
  const byId = new Map(securities.map((s) => [s.id, s]))
  for (const s of securities) {
    if (s.mode === 'common' || s.mode === 'participating') active.set(s.id, s.residualShares)
    else if (s.mode === 'option') pending.push({ v: s.exercisePrice as number, id: s.id, action: 'join', label: `${s.name} exercises (exercise price $${s.exercisePrice})` })
    else if (s.mode === 'convertible') pending.push({ v: s.claim / s.residualShares, id: s.id, action: 'join', label: `${s.name} converts` })
    else if (s.mode === 'capped') {
      const cap = s.capTotal as number
      if (cap > s.claim) {
        active.set(s.id, s.residualShares)
        pending.push({ v: (cap - s.claim) / s.residualShares, id: s.id, action: 'leave', label: `${s.name} reaches its participation cap` })
      }
      pending.push({ v: Math.max(cap, s.claim) / s.residualShares, id: s.id, action: 'join', label: `${s.name} converts (as-converted value exceeds the cap)` })
    }
  }
  pending.sort((a, b) => a.v - b.v || (a.action === 'leave' ? -1 : 1))
  let v = 0
  let k = 0
  const apply = (p: Pending) => {
    const s = byId.get(p.id) as SecuritySummary
    if (p.action === 'join') {
      active.set(p.id, s.residualShares)
      if (s.joinsAtEquityValue === null || s.mode === 'capped') s.joinsAtEquityValue = cum
    } else {
      active.delete(p.id)
      s.capReachedAtEquityValue = cum
    }
    addBreakpoint(cum, v, p.label)
  }
  for (const s of securities) if (active.has(s.id)) s.joinsAtEquityValue = cum
  while (k < pending.length && pending[k]!.v <= v + EPS) apply(pending[k++]!)
  while (true) {
    const shares = [...active.values()].reduce((a, b) => a + b, 0)
    if (k >= pending.length) {
      if (!(shares > 0)) throw new RangeError('no security shares the residual: add a common holder or a convertible')
      pushTranche('residual', cum, null, new Map(active), shares, v)
      break
    }
    const next = pending[k]!.v
    if (shares > 0 && next > v) {
      const size = (next - v) * shares
      pushTranche('residual', cum, cum + size, new Map(active), shares, v)
      cum += size
    }
    v = next
    while (k < pending.length && pending[k]!.v <= v + EPS * Math.max(1, v)) apply(pending[k++]!)
  }

  return {
    securities,
    classes,
    tranches,
    breakpoints,
    deductions,
    excludedUnvestedOptionShares: excludedUnvested,
    needsReview: true,
    notes: [
      'Breakpoints are equity values (after debt payoff, transaction expenses and carve-out); exitValue maps each back to the headline price.',
      'Conversion thresholds assume each holder takes the greater of its claim and its as-converted value (NVCA Model COD Art. Fourth B §2.1); the charter text controls.',
    ],
  }
}

/** Exact (unrounded) dollars per security at an equity value, read off the schedule. */
export function allocateAtEquityValue(schedule: BreakpointSchedule, equityValue: number): Map<string, number> {
  if (!(equityValue >= 0)) throw new RangeError('equityValue must be >= 0')
  const out = new Map<string, number>(schedule.securities.map((s) => [s.id, 0]))
  for (const t of schedule.tranches) {
    if (equityValue <= t.fromEquityValue) break
    const top = t.toEquityValue === null ? equityValue : Math.min(equityValue, t.toEquityValue)
    const slice = top - t.fromEquityValue
    for (const p of t.participants) out.set(p.security, (out.get(p.security) ?? 0) + slice * p.fraction)
  }
  return out
}

/** Value per as-converted common share at an equity value (0 inside the preference phase). */
export function commonValuePerShareAt(schedule: BreakpointSchedule, equityValue: number): number {
  let v = 0
  for (const t of schedule.tranches) {
    if (equityValue <= t.fromEquityValue) break
    if (t.phase !== 'residual' || !t.participatingShares) continue
    const top = t.toEquityValue === null ? equityValue : Math.min(equityValue, t.toEquityValue)
    v = (t.fromCommonValuePerShare ?? 0) + (top - t.fromEquityValue) / t.participatingShares
  }
  return v
}

export type AnalysisDecision =
  | 'hold'
  | 'exercise'
  | 'out-of-the-money'
  | 'preference'
  | 'convert'
  | 'cash-out'
  | 'repay'
  | 'participate'
  | 'capped'

function decisionAt(s: SecuritySummary, equity: number): AnalysisDecision {
  const joined = s.joinsAtEquityValue !== null && equity > s.joinsAtEquityValue + EPS
  switch (s.mode) {
    case 'common':
      return 'hold'
    case 'option':
      return joined ? 'exercise' : 'out-of-the-money'
    case 'participating':
      return 'participate'
    case 'claim-only':
      return s.kind === 'safe' ? 'cash-out' : 'repay'
    case 'convertible':
      if (joined) return 'convert'
      return s.kind === 'safe' ? 'cash-out' : s.kind === 'note' ? 'repay' : 'preference'
    case 'capped':
      if (s.capReachedAtEquityValue === null || equity <= s.capReachedAtEquityValue + EPS) {
        return s.capReachedAtEquityValue === null && joined ? 'convert' : s.capReachedAtEquityValue === null ? 'preference' : 'participate'
      }
      return joined ? 'convert' : 'capped'
  }
}

export interface AnalysisRow {
  holder: string
  security: string
  class: string
  kind: SecurityKind | 'carve-out'
  shares: number
  decision: AnalysisDecision | 'carve-out'
  /** Net proceeds in dollars (cents; rows sum to the equity value plus the carve-out). */
  total: number
  /** Escrow split of `total` (atClosing + escrow = total). */
  atClosing: number
  escrow: number
  /** Options/warrants only: gross mode adds the exercise cost back (gross − cost = total);
   * net mode reports the shares withheld at the per-share value. */
  grossProceeds?: number
  exerciseCost?: number
  sharesWithheld?: number
}

export interface AnalysisClassRow {
  class: string
  shares: number
  total: number
  /** total ÷ shares, 4-decimal display rounding (totals are exact cents). */
  perShare: number
}

export interface WaterfallAnalysisReport {
  exitValue: number
  reconciliation: {
    debtPayoff: number
    transactionExpenses: number
    netProceeds: number
    carveOut: number
    /** Distributable to the security stack: the rows (excluding the carve-out) sum to it. */
    equityValue: number
    escrowHeld: number
  }
  commonValuePerShare: number
  rows: AnalysisRow[]
  classes: AnalysisClassRow[]
  schedule: BreakpointSchedule
  needsReview: true
  notes: string[]
}

/** Split each security's exact dollars over its holders (by shares). */
function holderAmounts(schedule: BreakpointSchedule, exact: Map<string, number>): { sec: SecuritySummary; holder: { name: string; shares: number }; amount: number }[] {
  const out: { sec: SecuritySummary; holder: { name: string; shares: number }; amount: number }[] = []
  for (const s of schedule.securities) {
    const amount = exact.get(s.id) ?? 0
    const held = s.holders.reduce((a, h) => a + h.shares, 0)
    for (const h of s.holders) out.push({ sec: s, holder: h, amount: held > 0 ? (amount * h.shares) / held : amount / s.holders.length })
  }
  return out
}

/**
 * Optional exercise reporting. Gross exercise: the holder pays n × K, the cash joins the
 * proceeds, and every common-equivalent share is worth v' = (E + nK) ÷ (S + n), so the net is
 * n(v' − K). Treasury-style net exercise: the holder receives n(1 − K/v) shares and no cash
 * moves, so v = E ÷ (S + n − nK/v), which rearranges to the same v = (E + nK) ÷ (S + n). The
 * two modes therefore pay identical net proceeds; this module reports gross proceeds and the
 * exercise cost (gross) or the shares withheld (net) alongside the common net figure.
 */
export function optionExerciseNote(): string {
  return 'Gross and treasury-style net exercise pay the same net proceeds: both solve v = (E + nK) / (S + n). The mode changes only the reported columns.'
}

/**
 * Per-holder and per-class proceeds at a headline exit value. Order: debt payoff and
 * transaction expenses, then the management carve-out (min(net, fixed + pct × net), paid
 * ahead of the security stack by the plan convention stated on the input), then the stack
 * via the breakpoint schedule (notes at rank 0, preferred and safe tiers by seniority,
 * then the residual). Rows are whole cents allocated by largest remainder so they sum to
 * the equity value exactly. Escrow: 'waterfall' runs the schedule at equity − escrow for the
 * closing payment and attributes the release incrementally; 'pro-rata' withholds the same
 * fraction from every holder.
 */
export function waterfallAnalysis(inputs: WaterfallAnalysisInputs, exitValue: number): WaterfallAnalysisReport {
  waterfallAnalysisEntry.validate(inputs, exitValue)
  if (!(exitValue >= 0) || !Number.isFinite(exitValue)) throw new RangeError('exitValue must be a finite number >= 0')
  const schedule = waterfallBreakpoints(inputs)
  const { net, carveOut, equity } = exitToEquity(exitValue, schedule.deductions)
  const equityCents = round2(equity)
  const carveCents = round2(round2(net) - equityCents)

  const exact = allocateAtEquityValue(schedule, equity)
  const parts = holderAmounts(schedule, exact)
  const totals = allocateCents(equityCents, parts.map((p) => p.amount))

  // Escrow
  const esc = inputs.deductions?.escrow
  if (esc && esc.amount !== undefined && esc.pctOfExit !== undefined) {
    throw new RangeError('deductions.escrow: give amount or pctOfExit, not both')
  }
  const escrowAmount = Math.min(
    equity,
    nonNeg(esc?.amount, 'deductions.escrow.amount') + (nonNeg(esc?.pctOfExit, 'deductions.escrow.pctOfExit') / 100) * exitValue,
  )
  const escrowCents = round2(escrowAmount)
  let closing: number[]
  if (escrowCents === 0) closing = totals
  else {
    // Each holder's escrow share: its total less its closing payment (exact), allocated in
    // whole cents capped at the holder's total so closing + escrow = total for every row and
    // the escrow cents sum to escrowHeld.
    let weights: number[]
    if ((esc?.allocation ?? 'waterfall') === 'pro-rata') weights = totals
    else {
      const atClose = holderAmounts(schedule, allocateAtEquityValue(schedule, Math.max(0, equity - escrowAmount)))
      weights = parts.map((p, i) => Math.max(0, p.amount - atClose[i]!.amount))
    }
    const escrowCentsByRow = allocateCentsCapped(escrowCents, weights, totals)
    closing = totals.map((t, i) => round2(t - escrowCentsByRow[i]!))
  }

  const v = commonValuePerShareAt(schedule, equity)
  const mode = inputs.exerciseMode ?? 'net'
  const rows: AnalysisRow[] = parts.map((p, i) => {
    const decision = decisionAt(p.sec, equity)
    const row: AnalysisRow = {
      holder: p.holder.name,
      security: p.sec.name,
      class: p.sec.class,
      kind: p.sec.kind,
      shares: p.holder.shares,
      decision,
      total: totals[i]!,
      atClosing: closing[i]!,
      escrow: round2(totals[i]! - closing[i]!),
    }
    if (p.sec.mode === 'option') {
      const k = p.sec.exercisePrice as number
      const exercised = decision === 'exercise'
      if (mode === 'gross') {
        row.exerciseCost = exercised ? round2(p.holder.shares * k) : 0
        row.grossProceeds = round2(totals[i]! + row.exerciseCost)
      } else {
        row.sharesWithheld = exercised && v > 0 ? (p.holder.shares * k) / v : 0
      }
    }
    return row
  })
  const recipients = inputs.deductions?.carveOut?.recipients ?? []
  if (carveCents > 0 && recipients.length > 0) {
    const carveParts = allocateCents(carveCents, recipients.map((r) => r.weight))
    recipients.forEach((r, i) =>
      rows.push({ holder: r.name, security: 'Management carve-out', class: 'Carve-out', kind: 'carve-out', shares: 0, decision: 'carve-out', total: carveParts[i]!, atClosing: carveParts[i]!, escrow: 0 }),
    )
  }

  const classRows: AnalysisClassRow[] = schedule.classes.map((c) => {
    const secs = schedule.securities.filter((s) => s.class === c)
    const shares = secs.reduce((a, s) => a + s.shares, 0)
    const total = round2(rows.filter((r) => r.class === c && r.kind !== 'carve-out').reduce((a, r) => a + r.total, 0))
    return { class: c, shares, total, perShare: shares > 0 ? roundPrice(total / shares) : 0 }
  })

  const notes = [...schedule.notes, optionExerciseNote()]
  if (schedule.excludedUnvestedOptionShares > 0) {
    notes.push(`${schedule.excludedUnvestedOptionShares.toLocaleString('en-US')} unvested option shares cancelled at exit (unvestedAtExit: 'cancel').`)
  }
  if ((inputs.safes ?? []).length > 0) {
    notes.push('Safe Conversion Amounts are fixed from the all-safes-included Liquidity Capitalization (User Guide Appendix II Q4 convention).')
  }
  if (inputs.deductions?.carveOut) notes.push('The carve-out is paid from net proceeds ahead of the notes and preferred; the plan document controls its base and priority.')
  if (escrowCents > 0) notes.push(`Escrow of $${escrowCents.toLocaleString('en-US')} withheld (${esc?.allocation ?? 'waterfall'} allocation); release assumed in full.`)
  notes.push(`Unissued option pool (${(inputs.unissuedPoolShares ?? 0).toLocaleString('en-US')} shares) excluded. Educational model, not legal advice.`)

  return {
    exitValue,
    reconciliation: {
      debtPayoff: schedule.deductions.debtPayoff,
      transactionExpenses: schedule.deductions.transactionExpenses,
      netProceeds: round2(net),
      carveOut: carveCents,
      equityValue: equityCents,
      escrowHeld: escrowCents,
    },
    commonValuePerShare: roundPrice(v),
    rows,
    classes: classRows,
    schedule,
    needsReview: true,
    notes: carveOut > 0 && recipients.length === 0 ? [...notes, 'Carve-out has no recipients listed.'] : notes,
  }
}

export interface SweepPoint {
  exitValue: number
  equityValue: number
  commonValuePerShare: number
  /** Per-class totals in cents, summing to the equity value. */
  byClass: { class: string; total: number }[]
}

/**
 * Per-class proceeds across a range of exit values (for charts): either an explicit list of
 * exit values or { from, to, steps } giving steps + 1 evenly spaced points. The breakpoint
 * schedule is built once and read at every point.
 */
export function waterfallSweep(
  inputs: WaterfallAnalysisInputs,
  range: readonly number[] | { from: number; to: number; steps: number },
): { points: SweepPoint[]; schedule: BreakpointSchedule; needsReview: true } {
  let exits: number[]
  if (Array.isArray(range)) exits = [...range]
  else {
    const r = range as { from: number; to: number; steps: number }
    if (!(r.from >= 0) || !(r.to >= r.from) || !Number.isInteger(r.steps) || r.steps < 1 || r.steps > 10_000) {
      throw new RangeError('range needs 0 <= from <= to and an integer steps in [1, 10000]')
    }
    exits = Array.from({ length: r.steps + 1 }, (_, i) => r.from + ((r.to - r.from) * i) / r.steps)
  }
  if (exits.some((x) => !(x >= 0) || !Number.isFinite(x))) throw new RangeError('exit values must be finite and >= 0')
  const schedule = waterfallBreakpoints(inputs)
  const points = exits.map((exitValue) => {
    const { equity } = exitToEquity(exitValue, schedule.deductions)
    const exact = allocateAtEquityValue(schedule, equity)
    const classTotals = schedule.classes.map((c) => schedule.securities.filter((s) => s.class === c).reduce((a, s) => a + (exact.get(s.id) ?? 0), 0))
    const cents = allocateCents(round2(equity), classTotals)
    return {
      exitValue,
      equityValue: round2(equity),
      commonValuePerShare: roundPrice(commonValuePerShareAt(schedule, equity)),
      byClass: schedule.classes.map((c, i) => ({ class: c, total: cents[i]! })),
    }
  })
  return { points, schedule, needsReview: true }
}

// ---------------------------------------------------------------------------
// Direct equilibrium solver (independent of the breakpoint schedule)
// ---------------------------------------------------------------------------

export interface EquilibriumResult {
  equityValue: number
  /** Each convertible's route: 'convert' or 'claim' (capped: 'convert' or 'participate'). */
  routes: Record<string, 'convert' | 'claim'>
  /** Exact dollars per security under the equilibrium routes. */
  payouts: Record<string, number>
  iterations: number
}

/**
 * Solve the conversion decisions directly: for given routes, pay claims tier by tier (ratable
 * shortfall within a tier), then water-fill the residual by the per-share level v at which
 * common, converted and participating shares (participation clipped at the cap) and in-the-
 * money options (n × max(0, v − K)) exactly absorb it. Each convertible then takes its best
 * response (convert only when strictly better, NVCA §2.1 / User Guide §A.3) and the sweep
 * repeats until no route changes. Used by the tests to cross-check waterfallBreakpoints.
 */
export function conversionEquilibrium(inputs: WaterfallAnalysisInputs, equityValue: number): EquilibriumResult {
  waterfallAnalysisEntry.validate(inputs, equityValue)
  if (!(equityValue >= 0)) throw new RangeError('equityValue must be >= 0')
  const { securities } = resolveSecurities(inputs)
  const choosers = securities.filter((s) => s.mode === 'convertible' || s.mode === 'capped')
  const routes: Record<string, 'convert' | 'claim'> = Object.fromEntries(choosers.map((s) => [s.id, 'claim' as const]))

  const evaluate = (r: Record<string, 'convert' | 'claim'>): Record<string, number> => {
    const pay: Record<string, number> = Object.fromEntries(securities.map((s) => [s.id, 0]))
    let remaining = equityValue
    const claimants = securities.filter((s) => s.claim > 0 && s.tier !== null && r[s.id] !== 'convert')
    const tiers = [...new Set(claimants.map((s) => s.tier as number))].sort((a, b) => a - b)
    for (const tier of tiers) {
      const m = claimants.filter((s) => s.tier === tier)
      const total = m.reduce((a, s) => a + s.claim, 0)
      const paid = Math.min(remaining, total)
      for (const s of m) pay[s.id] = (paid * s.claim) / total
      remaining -= paid
    }
    // residual water-filling: f(v) = Σ payout(v)
    const shareOf = (s: SecuritySummary, lvl: number): number => {
      if (s.mode === 'common' || s.mode === 'participating') return s.residualShares * lvl
      if (s.mode === 'option') return s.residualShares * Math.max(0, lvl - (s.exercisePrice as number))
      if (s.mode === 'convertible') return r[s.id] === 'convert' ? s.residualShares * lvl : 0
      if (s.mode === 'capped') {
        if (r[s.id] === 'convert') return s.residualShares * lvl
        return Math.min(s.residualShares * lvl, Math.max(0, (s.capTotal as number) - s.claim))
      }
      return 0
    }
    const f = (lvl: number) => securities.reduce((a, s) => a + shareOf(s, lvl), 0)
    if (remaining > 0) {
      let hi = 1
      while (f(hi) < remaining && hi < 1e15) hi *= 2
      if (f(hi) < remaining) return pay // nobody can absorb the residual (all capped)
      let lo = 0
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2
        if (f(mid) < remaining) lo = mid
        else hi = mid
      }
      for (const s of securities) pay[s.id] = (pay[s.id] ?? 0) + shareOf(s, hi)
    }
    return pay
  }

  let iterations = 0
  for (; iterations < 200; iterations++) {
    let changed = false
    for (const s of choosers) {
      const asClaim = evaluate({ ...routes, [s.id]: 'claim' })[s.id]
      const asConvert = evaluate({ ...routes, [s.id]: 'convert' })[s.id]
      // Strictly better by more than a micro-dollar (floating-point noise), per the greater-of rule.
      const best = asConvert! > asClaim! + 1e-6 ? 'convert' : 'claim'
      if (best !== routes[s.id]) {
        routes[s.id] = best
        changed = true
      }
    }
    if (!changed) break
  }
  return { equityValue, routes, payouts: evaluate(routes), iterations }
}
