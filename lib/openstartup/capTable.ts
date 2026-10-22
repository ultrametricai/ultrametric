// Cap-table engine — the first module of the open-startup toolkit (founder direction
// 2026-09-28: "not just an evidence layer for vendor testing but the best 'open startup'
// repo for all founders — business logic for things like cap tables").
//
// Pure, client-safe (no node builtins), deterministic. Consumed by
// repo-only since 2026-09-28 (founder: the logic lives here, no site page) — exhaustively tested in
// lib/openstartup/__tests__/capTable.test.ts — the test file is written to read like a
// textbook and re-derives every published worked example.
//
// Sources for the formulas (each formula's doc comment cites the specific one):
// - YC Post-Money Safe User Guide (PDF linked from https://www.ycombinator.com/documents):
//   Quick Start Guide (ownership = purchase amount / post-money cap; pro rata allocation
//   formula), Q&A sections B ("Safe Conversion in Equity Financings") and D ("Calculating
//   and Managing Dilution"), Appendix I (cap-and-discount, discount-only, MFN variants),
//   Appendix II (worked pro-forma cap tables — Example 1 is replicated in our tests).
// - Cooley GO, "Founder's Stock, Vesting and Founder Departures"
//   (https://www.cooleygo.com/founder-basics-founders-stock/): the standard 4-year /
//   1-year-cliff monthly vesting convention.
//
// Rounding conventions (explicit; they reproduce the guide's Appendix II figures exactly):
// - Share counts are always rounded DOWN to whole shares (floorShares) — you cannot issue
//   a fractional share, and rounding down is the conservative convention YC's Appendix II
//   follows (588,235 from 588,235.25; 1,176,470 from 1,176,470.5; 4,486,719 from
//   4,486,719.31; pro rata 448,671 from 448,671.9).
// - Prices per share are rounded to 4 decimal places (PRICE_DECIMALS), matching the guide's
//   $1.1144 / $0.6577 style.
// Educational model, not legal advice.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { entrySpec } from './entryValidation'

export const PRICE_DECIMALS = 4

/** Floor to whole shares, with an epsilon nudge so float noise like 588235.249999999
 * (an exact .25 in decimal) does not floor one share low. */
export function floorShares(x: number): number {
  return Math.floor(x + 1e-7)
}

/** Round a price per share to PRICE_DECIMALS decimals (YC guide style: $1.1144). */
export function roundPrice(x: number): number {
  const f = 10 ** PRICE_DECIMALS
  return Math.round(x * f) / f
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VestingSchedule {
  /** Total vesting period in months (standard: 48). */
  totalMonths: number
  /** Cliff in months — nothing vests before this (standard: 12). */
  cliffMonths: number
}

export interface FounderInput {
  name: string
  shares: number
  vesting?: VestingSchedule
}

/** One outstanding SAFE. Post-money mechanics per the current published YC forms:
 * cap-only ("Standard Safe"), discount-only, MFN, and the Appendix I cap-and-discount
 * variant (cap OR discount, whichever is more advantageous to the investor). */
export interface SafeFields {
  name: string
  /** Purchase amount in dollars. */
  amount: number
  /** Post-money valuation cap in dollars ("post" all safe money and the pre-round pool,
   * NOT the equity-financing money or its pool increase — User Guide, "What do we mean
   * by post-money safe"). */
  cap?: number
  /** Discount off the priced-round PPS, in percent (20 → Discount Rate 80% — Appendix I). */
  discountPct?: number
  /** MFN: no cap/discount of its own; may adopt the full term set of any later-issued
   * SAFE if that set is more favorable (no cherry-picking — Appendix I §3). */
  mfn?: boolean
  /** Holds the optional pro rata side letter (right to buy into the Equity Financing at
   * the round PPS, in proportion to as-converted ownership — User Guide §E). */
  proRata?: boolean
}

export type CapTableEvent =
  | { kind: 'found'; founders: FounderInput[]; poolShares?: number }
  /** Option-pool creation/top-up outside a priced round: either explicit `shares` or a
   * `targetPct` of post-increase fully diluted. Dilutes every existing holder. */
  | { kind: 'pool'; shares?: number; targetPct?: number }
  /** Grant options out of the unissued pool (no fully-diluted ownership change). */
  | { kind: 'grant'; name: string; shares: number }
  | ({ kind: 'safe' } & SafeFields)
  | {
      kind: 'priced'
      name: string
      /** Pre-money valuation in dollars. Convention (User Guide, Appendix II Example 1):
       * the pre-money INCLUDES the shares issued on safe conversion and the new option
       * pool increase — both dilute the existing holders, not the new investors. */
      preMoney: number
      /** New cash raised in dollars. */
      newMoney: number
      /** Target unissued+available pool as % of post-close fully diluted ("pool shuffle"). */
      poolTargetPct?: number
      /** Or an explicit pool increase in shares (takes precedence over poolTargetPct). */
      poolShares?: number
    }

/** Structural schema of VestingSchedule — the registry entry contract (field names and
 * types; value rules stay in vestedShares). */
export const VestingScheduleSchema = z.object({
  totalMonths: z.number(),
  cliffMonths: z.number(),
})

/** Structural schema of CapTableEvent — the registry entry contract for buildCapTable and
 * capTableCodec.encodeCapTableState (open-modules/registry.json). Field names and types
 * only: semantic rules (positive amounts, pool arithmetic, SAFE guards) stay in the fold,
 * so a semantically invalid but well-shaped event still reports via CapTableReport.error. */
export const CapTableEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('found'),
    founders: z.array(z.object({ name: z.string(), shares: z.number(), vesting: VestingScheduleSchema.optional() })),
    poolShares: z.number().optional(),
  }),
  z.object({ kind: z.literal('pool'), shares: z.number().optional(), targetPct: z.number().optional() }),
  z.object({ kind: z.literal('grant'), name: z.string(), shares: z.number() }),
  z.object({
    kind: z.literal('safe'),
    name: z.string(),
    amount: z.number(),
    cap: z.number().optional(),
    discountPct: z.number().optional(),
    mfn: z.boolean().optional(),
    proRata: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('priced'),
    name: z.string(),
    preMoney: z.number(),
    newMoney: z.number(),
    poolTargetPct: z.number().optional(),
    poolShares: z.number().optional(),
  }),
])

/** Registered entrypoint arguments (open-modules/registry.json). */
export const buildCapTableEntry = entrySpec('buildCapTable', [
  { name: 'events', schema: z.array(CapTableEventSchema) },
])

export type RowGroup = 'founder' | 'options' | 'pool' | 'investor'

export interface CapTableRow {
  id: string
  name: string
  group: RowGroup
  /** Whole shares; null for a SAFE shown as-converted-estimate before any priced round. */
  shares: number | null
  /** Percent of fully diluted (0–100); null when not yet determinable (uncapped SAFE). */
  pct: number | null
}

/** Structural schema of CapTableRow — consumed by round.downRoundModel's registry entry. */
export const CapTableRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(['founder', 'options', 'pool', 'investor']),
  shares: z.number().nullable(),
  pct: z.number().nullable(),
})

export interface SafeConversion {
  safeName: string
  amount: number
  shares: number
  /** Which price won for the investor (the SAFE always converts at the most advantageous —
   * User Guide §B Q2/Q3). */
  method: 'cap' | 'discount' | 'pps'
  /** Terms actually applied (differs from the SAFE's own terms when MFN was exercised). */
  appliedCap?: number
  appliedDiscountPct?: number
  mfnAdoptedFrom?: string
  /** Effective price per share paid: amount / shares. */
  effectivePrice: number
  /** As-converted ownership immediately after conversion, before the new money (0–100). */
  postConversionPct: number
  /** Pro rata purchase in the new round, if the side letter is held. */
  proRataShares?: number
  proRataCost?: number
}

export interface PricedRoundBreakdown {
  roundName: string
  /** PPS = pre-money / (fully diluted post safe conversion + pool increase) — Appendix II. */
  pps: number
  preMoney: number
  newMoney: number
  postMoney: number
  poolIncreaseShares: number
  /** floor(newMoney / pps) — total new preferred issued for cash. */
  roundShares: number
  conversions: SafeConversion[]
}

export interface Snapshot {
  eventIndex: number
  label: string
  rows: CapTableRow[]
  /** Whole issued/reserved shares (excludes SAFEs, which are not shares until conversion). */
  fullyDilutedShares: number
  /** Present on the snapshot produced by a priced round. */
  round?: PricedRoundBreakdown
  note?: string
}

export interface CapTableReport {
  snapshots: Snapshot[]
  /** Set when an event was invalid; snapshots up to the failing event are still returned. */
  error?: { eventIndex: number; message: string }
}

// ---------------------------------------------------------------------------
// Vesting
// ---------------------------------------------------------------------------

/**
 * Shares vested after `monthsElapsed` under a cliff + monthly schedule.
 * Standard founder convention: "the stock vests in monthly or quarterly increments over
 * four years, with a one year 'cliff'" — Cooley GO,
 * https://www.cooleygo.com/founder-basics-founders-stock/
 * Before the cliff: 0. At/after the cliff: floor(total × monthsElapsed / totalMonths),
 * so exactly 25% vests at a 12-month cliff on a 48-month schedule.
 */
export function vestedShares(totalShares: number, schedule: VestingSchedule, monthsElapsed: number): number {
  if (!Number.isFinite(totalShares) || totalShares < 0) throw new RangeError('totalShares must be >= 0')
  if (schedule.totalMonths <= 0 || schedule.cliffMonths < 0 || schedule.cliffMonths > schedule.totalMonths)
    throw new RangeError('invalid vesting schedule')
  if (monthsElapsed < schedule.cliffMonths) return 0
  if (monthsElapsed >= schedule.totalMonths) return floorShares(totalShares)
  return floorShares((totalShares * monthsElapsed) / schedule.totalMonths)
}

// ---------------------------------------------------------------------------
// SAFE arithmetic (single-formula helpers)
// ---------------------------------------------------------------------------

/**
 * Ownership sold by one post-money SAFE, in percent: purchaseAmount / postMoneyCap.
 * "The biggest advantage of the post-money safe is that the amount of ownership sold is
 * immediately transparent": $500k on $6.7M post ≈ 7.5%, $1M ≈ 15% — User Guide Quick
 * Start §1–2. SAFEs on different caps simply add: $500k/$5.5M ≈ 9% plus $500k/$8.3M ≈ 6%.
 */
export function safeOwnershipPct(amount: number, cap: number): number {
  if (!(amount >= 0) || !(cap > 0)) throw new RangeError('amount must be >= 0 and cap > 0')
  return (amount / cap) * 100
}

/**
 * Extra dilution a founder should expect from pro rata side letters — User Guide Quick
 * Start §3: Safe Pro Rata Allocation % = NewInvestors% / (100% − SafesWithProRata%) −
 * NewInvestors%. Worked example (replicated in tests): 25 / (100−15)% − 25 = 4.41%.
 * All arguments and the result are in percent (0–100).
 */
export function safeProRataAllocationPct(newInvestorsPct: number, safesWithProRataPct: number): number {
  if (safesWithProRataPct >= 100) throw new RangeError('safesWithProRataPct must be < 100')
  return newInvestorsPct / (1 - safesWithProRataPct / 100) - newInvestorsPct
}

/**
 * Backsolve: the maximum % of SAFEs that can carry pro rata rights while keeping the
 * round within budget — User Guide §E.3: Safes % with Pro Rata = 100% −
 * (NewInvestors% / TotalRound%). Worked example: 100 − 25/28 = 10.7%.
 */
export function maxSafesPctWithProRata(newInvestorsPct: number, totalRoundPct: number): number {
  if (!(totalRoundPct > 0)) throw new RangeError('totalRoundPct must be > 0')
  return 100 - (newInvestorsPct / totalRoundPct) * 100
}

/**
 * Founder-level dilution estimate for a priced round following a SAFE raise — the
 * "Adding it all up" arithmetic of User Guide Quick Start §3:
 *   proRataPct        = safeProRataAllocationPct(newInvestorsPct, safesWithProRataPct)
 *   roundInvestorsPct = newInvestorsPct + proRataPct
 *   roundDilutionPct  = roundInvestorsPct + poolIncreasePct
 *   safesFinalPct     = safesPct × (100 − roundDilutionPct) / 100
 * Guide's worked example (in tests): 15% safes with pro rata, 25% new money, 10% pool →
 * pro rata 4.41%, round dilution 39.41%, safes end at 9.09%.
 */
export function estimateRoundDilution(input: {
  safesPct: number
  safesWithProRataPct: number
  newInvestorsPct: number
  poolIncreasePct: number
}): { proRataPct: number; roundDilutionPct: number; safesFinalPct: number } {
  const proRataPct = safeProRataAllocationPct(input.newInvestorsPct, input.safesWithProRataPct)
  const roundDilutionPct = input.newInvestorsPct + proRataPct + input.poolIncreasePct
  const safesFinalPct = (input.safesPct * (100 - roundDilutionPct)) / 100
  return { proRataPct, roundDilutionPct, safesFinalPct }
}

/**
 * Option-pool top-up outside a priced round: smallest whole-share increase x so the
 * unissued pool is `targetPct` of post-increase fully diluted:
 *   (unissued + x) / (fullyDiluted + x) = t  ⇒  x = (t·FD − unissued) / (1 − t)
 * (Standard pool algebra; rounded UP so the target is met.) Returns 0 when the pool
 * already meets the target.
 */
export function poolIncreaseForTarget(fullyDiluted: number, unissued: number, targetPct: number): number {
  if (!(targetPct >= 0) || targetPct >= 100) throw new RangeError('targetPct must be in [0, 100)')
  const t = targetPct / 100
  const x = (t * fullyDiluted - unissued) / (1 - t)
  return x <= 0 ? 0 : Math.ceil(x - 1e-7)
}

/**
 * Pool increase inside a priced round targeting `targetPct` available post-close.
 * With PPS = pre / (FDconv + P) the post-close fully diluted is (FDconv + P) · post/pre,
 * so solving (unissued + P) = t · (FDconv + P) · post/pre for P:
 *   P = (t·(post/pre)·FDconv − unissued) / (1 − t·(post/pre))
 * This is the "option pool increase that creates a 10% unissued and available option pool
 * post-Series A" of User Guide Quick Start §3 / Appendix II Example 1 (which uses a
 * hand-rounded 1,695,000 for the same inputs; we compute the exact minimum).
 */
export function poolIncreaseForRoundTarget(
  fdPostConversion: number,
  unissued: number,
  targetPct: number,
  preMoney: number,
  postMoney: number,
): number {
  if (!(targetPct >= 0)) throw new RangeError('targetPct must be >= 0')
  const k = (targetPct / 100) * (postMoney / preMoney)
  if (k >= 1) throw new RangeError('pool target is unreachable at this valuation')
  const p = (k * fdPostConversion - unissued) / (1 - k)
  return p <= 0 ? 0 : Math.ceil(p - 1e-7)
}

// ---------------------------------------------------------------------------
// Priced-round conversion engine
// ---------------------------------------------------------------------------

interface EngineRow {
  id: string
  name: string
  group: RowGroup
  shares: number
}

interface EngineState {
  rows: EngineRow[]
  safes: (SafeFields & { seq: number })[]
}

function totalShares(rows: EngineRow[]): number {
  return rows.reduce((s, r) => s + r.shares, 0)
}

function poolRow(rows: EngineRow[]): EngineRow | undefined {
  return rows.find((r) => r.group === 'pool')
}

/** Candidate term sets an MFN SAFE may adopt: its own (uncapped, no discount) or the full
 * term set of any LATER-issued SAFE — Appendix I §3 ("the amended safe will be identical
 * to the later safe (other than the Purchase Amount)"; no cherry-picking). */
function mfnCandidates(safe: SafeFields & { seq: number }, all: (SafeFields & { seq: number })[]) {
  const own = { cap: safe.cap, discountPct: safe.discountPct, from: undefined as string | undefined }
  if (!safe.mfn) return [own]
  const later = all.filter((s) => s.seq > safe.seq && (s.cap !== undefined || s.discountPct !== undefined))
  return [own, ...later.map((s) => ({ cap: s.cap, discountPct: s.discountPct, from: s.name }))]
}

/**
 * Convert all outstanding SAFEs in an Equity Financing and price the round.
 *
 * Core formulas (YC Post-Money Safe User Guide):
 * - Safe Price = Post-Money Valuation Cap / Company Capitalization, where the Company
 *   Capitalization includes all outstanding capital stock, all issued/outstanding and
 *   promised options, the pre-round unissued pool, and all Converting Securities — and
 *   EXCLUDES the new round's pool increase (§B.4 table, §C.1).
 * - Because each SAFE's shares appear in every SAFE's Company Capitalization, cap-based
 *   conversion is simultaneous. Pure-cap closed form (Appendix II Example 1):
 *   CC = pre-round FD / (1 − Σ amountᵢ/capᵢ); sharesᵢ = ownershipᵢ × CC.
 * - Each SAFE converts at the MOST advantageous of Safe Price, Discount Price
 *   (PPS × Discount Rate — Appendix I §1) and the round PPS (§B.2–B.3), so mixed-mode
 *   conversion (Appendix II Example 1 Q5) is circular: we solve it as a fixed point,
 *   sweeping every SAFE against the others' current share counts until stable — exactly
 *   the guide's "(10,000,000 + Investor B's shares) / (100% − 5%)" recomputation.
 * - Series PPS = pre-money / (fully diluted post safe conversion + pool increase)
 *   (Appendix II "New Money": $15,000,000 / (11,764,705 + 1,695,000) = $1.1144).
 * - Pro rata purchase = floor(round shares × as-converted ownership) at the round PPS,
 *   carved out of the new-money shares (Appendix II: 4,486,719 × 10% = 448,671).
 */
function runPricedRound(
  state: EngineState,
  ev: Extract<CapTableEvent, { kind: 'priced' }>,
): { rows: EngineRow[]; breakdown: PricedRoundBreakdown } {
  const rows = state.rows.map((r) => ({ ...r }))
  const safes = state.safes
  const fdPre = totalShares(rows)
  const unissued = poolRow(rows)?.shares ?? 0
  const postMoney = ev.preMoney + ev.newMoney
  if (!(ev.preMoney > 0) || !(ev.newMoney > 0)) throw new RangeError('preMoney and newMoney must be > 0')

  // Guard: total capped-SAFE ownership must stay below 100% ("Raising more than the
  // Post-Money Valuation Cap would result in negative ownership for founders!" — §D.2).
  const cappedPct = safes.reduce((s, x) => s + (x.cap ? x.amount / x.cap : 0), 0)
  if (cappedPct >= 1) throw new RangeError('SAFEs sold ≥ 100% ownership — raise less or lift the caps')

  // Guard: every SAFE converts at the MOST advantageous of its candidate routes, and the
  // (possibly discounted) round-price route is always on that menu — capped or not. Those
  // price-route shares live inside the pre-money fully diluted — PPS = pre-money /
  // (post-conversion FD + pool increase) — so each SAFE claims at least
  // amount / (1 − discount) dollars of the pre-money, and price-route claims can never
  // reach it. When their gross-up Σ amount / (1 − discount) does, no conversion price
  // exists and the fixed-point sweep would settle on a 4-decimal rounding artifact; refuse
  // instead (the price-route mirror of the §D.2 capped guard above).
  const priceRouteClaim = safes.reduce((s, safe) => {
    const maxDiscount = Math.max(0, ...mfnCandidates(safe, safes).map((c) => c.discountPct ?? 0))
    return s + safe.amount / (1 - maxDiscount / 100)
  }, 0)
  if (priceRouteClaim >= ev.preMoney) {
    throw new RangeError(
      'SAFE purchase amounts (grossed up for discounts) reach the pre-money — no conversion price exists; raise the pre-money',
    )
  }

  let shares = safes.map(() => 0)
  let poolInc = ev.poolShares ?? 0
  let pps = 0
  let ppsRaw = 0
  const applied: { method: 'cap' | 'discount' | 'pps'; cap?: number; discountPct?: number; from?: string }[] =
    safes.map(() => ({ method: 'pps' as const }))

  for (let iter = 0; iter < 200; iter++) {
    const fdConv = fdPre + shares.reduce((a, b) => a + b, 0)
    if (ev.poolShares === undefined && ev.poolTargetPct !== undefined) {
      poolInc = poolIncreaseForRoundTarget(fdConv, unissued, ev.poolTargetPct, ev.preMoney, postMoney)
    }
    ppsRaw = ev.preMoney / (fdConv + poolInc)
    pps = roundPrice(ppsRaw)
    if (!(pps > 0)) throw new RangeError('price per share rounds to zero at 4 decimals — check pre-money vs share counts')

    const next = safes.map((safe, i) => {
      let best = 0
      let bestApplied: (typeof applied)[number] = { method: 'pps' }
      for (const cand of mfnCandidates(safe, safes)) {
        // Price-based: Purchase Amount / round PPS (§B.2 — floor of the guide's ±1).
        const atPps = floorShares(safe.amount / pps)
        if (atPps > best) {
          best = atPps
          bestApplied = { method: 'pps', from: cand.from }
        }
        // Discount Price = PPS × Discount Rate (Appendix I §1: 20% discount → 80%).
        if (cand.discountPct !== undefined && cand.discountPct > 0) {
          const discountPrice = roundPrice(pps * (1 - cand.discountPct / 100))
          const atDiscount = floorShares(safe.amount / discountPrice)
          if (atDiscount > best) {
            best = atDiscount
            bestApplied = { method: 'discount', discountPct: cand.discountPct, from: cand.from }
          }
        }
        // Cap-based: ownership × Company Capitalization, holding the OTHER SAFEs' current
        // conversion shares fixed (the fixed-point sweep — Appendix II Ex. 1 Q5 mechanics).
        if (cand.cap !== undefined && cand.cap > 0) {
          const own = safe.amount / cand.cap
          if (own < 1) {
            const others = shares.reduce((a, b, j) => (j === i ? a : a + b), 0)
            const cc = floorShares((fdPre + others) / (1 - own))
            const atCap = floorShares(own * cc)
            if (atCap > best) {
              best = atCap
              bestApplied = { method: 'cap', cap: cand.cap, from: cand.from }
            }
          }
        }
      }
      applied[i] = bestApplied
      return best
    })

    if (next.every((v, i) => v === shares[i])) {
      shares = next
      break
    }
    shares = next
  }

  const fdConv = fdPre + shares.reduce((a, b) => a + b, 0)
  const roundShares = floorShares(ev.newMoney / pps)

  const conversions: SafeConversion[] = safes.map((safe, i) => {
    const a = applied[i]
    const postConversionPct = fdConv > 0 ? (shares[i] / fdConv) * 100 : 0
    const conv: SafeConversion = {
      safeName: safe.name,
      amount: safe.amount,
      shares: shares[i],
      method: a.method,
      appliedCap: a.method === 'cap' ? a.cap : undefined,
      appliedDiscountPct: a.method === 'discount' ? a.discountPct : undefined,
      mfnAdoptedFrom: a.from,
      effectivePrice: shares[i] > 0 ? roundPrice(safe.amount / shares[i]) : pps,
      postConversionPct,
    }
    if (safe.proRata) {
      // Appendix II: "Investor B's pro rata = Total Series A Shares × pro rata ownership
      // percentage" — the as-converted % post conversion (10% in Q2, 10.3% in Q5).
      conv.proRataShares = floorShares(roundShares * (postConversionPct / 100))
      conv.proRataCost = Math.round(conv.proRataShares * pps * 100) / 100
    }
    return conv
  })

  // Assemble the post-round table.
  const pool = poolRow(rows)
  if (poolInc > 0) {
    if (pool) pool.shares += poolInc
    else rows.push({ id: 'pool', name: 'Option pool (unissued)', group: 'pool', shares: poolInc })
  }
  for (const conv of conversions) {
    rows.push({
      id: `safe-${conv.safeName}`,
      name: conv.safeName,
      group: 'investor',
      shares: conv.shares + (conv.proRataShares ?? 0),
    })
  }
  const proRataTotal = conversions.reduce((s, c) => s + (c.proRataShares ?? 0), 0)
  rows.push({
    id: `round-${ev.name}`,
    name: `${ev.name} — new investors`,
    group: 'investor',
    shares: roundShares - proRataTotal,
  })

  return {
    rows,
    breakdown: {
      roundName: ev.name,
      pps,
      preMoney: ev.preMoney,
      newMoney: ev.newMoney,
      postMoney,
      poolIncreaseShares: poolInc,
      roundShares,
      conversions,
    },
  }
}

// ---------------------------------------------------------------------------
// Event reducer + waterfall report
// ---------------------------------------------------------------------------

function snapshotOf(eventIndex: number, label: string, state: EngineState, extra?: Partial<Snapshot>): Snapshot {
  const fd = totalShares(state.rows)
  // Before conversion, capped SAFEs display as their implied as-converted ownership
  // (amount/cap) with every share row scaled by the remainder — the User Guide §D.5
  // "just that 10% ownership applied across the cap table, diluting each row by 10%".
  const knownSafePct = state.safes.reduce((s, x) => s + (x.cap ? safeOwnershipPct(x.amount, x.cap) : 0), 0)
  const scale = (100 - knownSafePct) / 100
  const rows: CapTableRow[] = state.rows.map((r) => ({
    id: r.id,
    name: r.name,
    group: r.group,
    shares: r.shares,
    pct: fd > 0 ? (r.shares / fd) * 100 * scale : null,
  }))
  for (const s of state.safes) {
    rows.push({
      id: `safe-${s.name}`,
      name: `${s.name} (SAFE, as-converted est.)`,
      group: 'investor',
      shares: null,
      pct: s.cap ? safeOwnershipPct(s.amount, s.cap) : null,
    })
  }
  return { eventIndex, label, rows, fullyDilutedShares: fd, ...extra }
}

/**
 * Fold a list of events into a dilution waterfall: one snapshot of the full ownership
 * table after every event. Invalid events stop the fold and report `error`; snapshots up
 * to that point are preserved so the UI can render the last good state.
 */
export function buildCapTable(events: readonly CapTableEvent[]): CapTableReport {
  buildCapTableEntry.validate(events)
  const state: EngineState = { rows: [], safes: [] }
  const snapshots: Snapshot[] = []
  let seq = 0

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    try {
      switch (ev.kind) {
        case 'found': {
          if (state.rows.length > 0) throw new RangeError('company already founded')
          if (ev.founders.length === 0) throw new RangeError('at least one founder required')
          for (const f of ev.founders) {
            if (!(f.shares > 0)) throw new RangeError(`founder ${f.name}: shares must be > 0`)
            state.rows.push({ id: `founder-${f.name}`, name: f.name, group: 'founder', shares: floorShares(f.shares) })
          }
          if (ev.poolShares && ev.poolShares > 0) {
            state.rows.push({ id: 'pool', name: 'Option pool (unissued)', group: 'pool', shares: floorShares(ev.poolShares) })
          }
          snapshots.push(snapshotOf(i, 'Founding', state))
          break
        }
        case 'pool': {
          if (state.rows.length === 0) throw new RangeError('found the company first')
          const fd = totalShares(state.rows)
          const pool = poolRow(state.rows)
          const inc =
            ev.shares !== undefined
              ? floorShares(ev.shares)
              : poolIncreaseForTarget(fd, pool?.shares ?? 0, ev.targetPct ?? 0)
          if (inc < 0) throw new RangeError('pool increase must be >= 0')
          if (pool) pool.shares += inc
          else state.rows.push({ id: 'pool', name: 'Option pool (unissued)', group: 'pool', shares: inc })
          snapshots.push(snapshotOf(i, `Option pool +${inc.toLocaleString('en-US')}`, state))
          break
        }
        case 'grant': {
          const pool = poolRow(state.rows)
          const n = floorShares(ev.shares)
          if (!pool || pool.shares < n) throw new RangeError('grant exceeds the unissued pool')
          if (!(n > 0)) throw new RangeError('grant shares must be > 0')
          pool.shares -= n
          state.rows.push({ id: `grant-${ev.name}`, name: ev.name, group: 'options', shares: n })
          snapshots.push(snapshotOf(i, `Options granted: ${ev.name}`, state))
          break
        }
        case 'safe': {
          if (state.rows.length === 0) throw new RangeError('found the company first')
          if (!(ev.amount > 0)) throw new RangeError('SAFE amount must be > 0')
          if (ev.cap !== undefined && !(ev.cap > 0)) throw new RangeError('cap must be > 0')
          if (ev.cap !== undefined && ev.amount >= ev.cap)
            throw new RangeError('amount >= post-money cap sells 100%+ of the company')
          if (ev.discountPct !== undefined && !(ev.discountPct > 0 && ev.discountPct < 100))
            throw new RangeError('discount must be between 0 and 100')
          const totalCapped = state.safes.reduce((s, x) => s + (x.cap ? x.amount / x.cap : 0), 0) +
            (ev.cap ? ev.amount / ev.cap : 0)
          if (totalCapped >= 1) throw new RangeError('SAFEs now sell ≥ 100% of the company')
          state.safes.push({
            name: ev.name, amount: ev.amount, cap: ev.cap, discountPct: ev.discountPct,
            mfn: ev.mfn, proRata: ev.proRata, seq: seq++,
          })
          snapshots.push(snapshotOf(i, `SAFE: ${ev.name}`, state))
          break
        }
        case 'priced': {
          if (state.rows.length === 0) throw new RangeError('found the company first')
          const { rows, breakdown } = runPricedRound(state, ev)
          state.rows = rows
          state.safes = []
          snapshots.push(snapshotOf(i, `Priced round: ${ev.name}`, state, { round: breakdown }))
          break
        }
      }
    } catch (err) {
      return { snapshots, error: { eventIndex: i, message: err instanceof Error ? err.message : String(err) } }
    }
  }

  return { snapshots }
}

// ---------------------------------------------------------------------------
// Exports for humans: CSV and markdown of the waterfall
// ---------------------------------------------------------------------------

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function fmtPct(pct: number | null): string {
  return pct === null ? '' : `${pct.toFixed(2)}%`
}

/** The final snapshot as CSV (holder, group, shares, pct), one header row. */
export function reportToCsv(report: CapTableReport): string {
  const last = report.snapshots[report.snapshots.length - 1]
  if (!last) return 'holder,group,shares,ownership_pct\n'
  const lines = ['holder,group,shares,ownership_pct']
  for (const r of last.rows) {
    lines.push([csvEscape(r.name), r.group, r.shares === null ? '' : String(r.shares), fmtPct(r.pct)].join(','))
  }
  return lines.join('\n') + '\n'
}

/** The whole waterfall as markdown: one table per event snapshot. */
export function reportToMarkdown(report: CapTableReport): string {
  const out: string[] = ['# Cap table', '']
  for (const snap of report.snapshots) {
    out.push(`## ${snap.label}`, '', '| Holder | Shares | Ownership |', '| --- | ---: | ---: |')
    for (const r of snap.rows) {
      out.push(`| ${r.name} | ${r.shares === null ? '—' : r.shares.toLocaleString('en-US')} | ${r.pct === null ? 'TBD' : fmtPct(r.pct)} |`)
    }
    if (snap.round) {
      out.push(
        '',
        `PPS $${snap.round.pps} · pool +${snap.round.poolIncreaseShares.toLocaleString('en-US')} · new shares ${snap.round.roundShares.toLocaleString('en-US')}`,
      )
    }
    out.push('')
  }
  out.push(
    '_Open-source cap-table math from the Ultrametric open-startup toolkit — educational, not legal advice._',
    '_SAFE mechanics per the YC Post-Money Safe User Guide (ycombinator.com/documents)._',
    '',
  )
  return out.join('\n')
}
