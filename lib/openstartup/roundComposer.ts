// Priced-round composer — the end-to-end replay of a priced equity round (founder ask
// 2026-10-02: "what open modules can we improve logic-wise? can we go deep here and see how
// they connect to our processes?"). ONE narrative replay that COMPOSES the existing modules
// — the cap-table engine (SAFE conversion, pool shuffle, PPS solving), the round-mechanics
// module (dilution algebra, down-round modeling), the anti-dilution module (conversion
// terms), and the liquidity waterfall (what the post-close table pays at a sale) — over the
// actual step sequence of the "Close a priced equity round" process (corpus fund_002):
//   termSheetEconomics      → the term-sheet math (fund_002 n1: negotiate the term sheet)
//   replayPricedRound       → wires verified + shares issued (n7) and the post-close table
//                             the cap-table update must match (n9)
//   postCloseLiquidityCheck → the sanity read on what the table just signed pays at a sale
//   downRoundPreview        → the anti-dilution clause quantified on the post-close table
// The process wiring itself lives in open-processes/business-logic-map.json (this module carries
// no process ids); the "Convert SAFEs at the priced round" process (fund_006) reviews the
// same pro-forma through replayPricedRound.
//
// Pure, client-safe (no node builtins), deterministic. No parallel math: every formula here
// is a composition over functions ALREADY cited and worked-example-tested in capTable.ts,
// round.ts, antiDilution.ts, and waterfall.ts — the composer only sequences them and labels
// the stages. Tested in lib/openstartup/__tests__/roundComposer.test.ts, which replays the
// YC Post-Money Safe User Guide Appendix II Example 1 pro-forma end-to-end through the
// composer (the same numbers capTable.test.ts re-derives function by function).
//
// Sources (all inherited from the composed modules; each stage's doc comment points at the
// specific one):
// - YC Post-Money Safe User Guide (PDF linked from https://www.ycombinator.com/documents):
//   Quick Start §2 (ownership sold = investment / post-money), §3 ("Adding it all up" —
//   the round-dilution estimate), §B/§C (conversion), §E (pro rata), Appendix II Example 1
//   (the full pro-forma replayed in the tests).
// - NVCA model COD weighted-average formula via antiDilution.ts; Cooley GO definitions via
//   round.ts and waterfall.ts.
//
// Rounding: the composed modules' stated conventions (whole shares floored, prices to
// 4 decimals, dollars to cents) — nothing new here. Educational model, not legal advice:
// the composer PROPOSES the closing math; signatures, consents, filings, and the final cap
// table belong to counsel and the company's own records.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import {
  buildCapTable, type CapTableEvent, CapTableEventSchema, type CapTableReport, type CapTableRow, estimateRoundDilution,
  type PricedRoundBreakdown, type SafeConversion, safeOwnershipPct, type Snapshot,
} from './capTable'
import { entrySpec } from './entryValidation'
import { type AdjustmentBasis, conversionRatio, type DilutiveIssuance } from './antiDilution'
import { type DownRoundReport, downRoundModel, type ProtectedSeriesSpec } from './round'
import { conversionIndifferencePrice, liquidityWaterfall, type WaterfallReport } from './waterfall'

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

// ---------------------------------------------------------------------------
// Stage 1 — term-sheet economics (fund_002 n1)
// ---------------------------------------------------------------------------

export interface TermSheetInput {
  /** Pre-money valuation in dollars (the number on the term sheet). */
  preMoney: number
  /** New cash raised in dollars. */
  newMoney: number
  /** As-converted % already sold on post-money SAFEs (Σ amount/cap — capTable.safeOwnershipPct). */
  safesPct?: number
  /** The subset of safesPct holding pro rata side letters. */
  safesWithProRataPct?: number
  /** Planned in-round pool increase as % of post-close fully diluted (Quick Start §3). */
  poolIncreasePct?: number
}

export interface TermSheetEconomics {
  postMoney: number
  /** Ownership the new money buys: newMoney / postMoney × 100 — YC User Guide Quick Start
   * §2's transparency property, applied to the round itself. */
  newInvestorsPct: number
  /** The Quick Start §3 "Adding it all up" estimate (capTable.estimateRoundDilution) —
   * present when the SAFE percentages are supplied. */
  dilution?: { proRataPct: number; roundDilutionPct: number; safesFinalPct: number }
  needsReview: true
  note: string
}

/**
 * The term sheet's arithmetic before any document is drafted: post-money = pre + new;
 * the round sells newMoney/postMoney of the company (YC User Guide Quick Start §2 — the
 * same investment/post-money transparency the post-money SAFE was designed around); and,
 * when the outstanding-SAFE percentages are known, the founder-dilution estimate is the
 * guide's Quick Start §3 "Adding it all up" — composed from capTable.estimateRoundDilution
 * (cited and worked-example-tested there: 15% SAFEs with pro rata, 25% new money, 10% pool
 * → 4.41% pro rata, 39.41% round dilution, SAFEs end at 9.09%).
 */
export function termSheetEconomics(input: TermSheetInput): TermSheetEconomics {
  if (!(input.preMoney > 0) || !(input.newMoney > 0)) throw new RangeError('preMoney and newMoney must be > 0')
  const postMoney = input.preMoney + input.newMoney
  const newInvestorsPct = (input.newMoney / postMoney) * 100
  let dilution: TermSheetEconomics['dilution']
  if (input.safesPct !== undefined) {
    dilution = estimateRoundDilution({
      safesPct: input.safesPct,
      safesWithProRataPct: input.safesWithProRataPct ?? 0,
      newInvestorsPct,
      poolIncreasePct: input.poolIncreasePct ?? 0,
    })
  }
  return {
    postMoney,
    newInvestorsPct,
    dilution,
    needsReview: true,
    note:
      `$${input.newMoney.toLocaleString('en-US')} at $${input.preMoney.toLocaleString('en-US')} pre ` +
      `($${postMoney.toLocaleString('en-US')} post) sells ${newInvestorsPct.toFixed(2)}% to the new investors ` +
      `(YC User Guide Quick Start §2). Estimates only — the closing stage computes the exact share counts.`,
  }
}

// ---------------------------------------------------------------------------
// Stage 2 + 3 — the closing replay (fund_002 n7) and the post-close table (n9)
// ---------------------------------------------------------------------------

export interface ComposerRound {
  name: string
  preMoney: number
  newMoney: number
  /** Target unissued+available pool as % of post-close fully diluted (the pool shuffle). */
  poolTargetPct?: number
  /** Or an explicit pool increase in shares (takes precedence — Appendix II states one). */
  poolShares?: number
}

/** Structural schema of ComposerRound — the registry entry contract (field names and
 * types; value rules stay in the cap-table engine). */
export const ComposerRoundSchema = z.object({
  name: z.string(),
  preMoney: z.number(),
  newMoney: z.number(),
  poolTargetPct: z.number().optional(),
  poolShares: z.number().optional(),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const replayPricedRoundEntry = entrySpec('replayPricedRound', [
  { name: 'history', schema: z.array(CapTableEventSchema) },
  { name: 'round', schema: ComposerRoundSchema },
])

export interface WireRow {
  holder: string
  shares: number
  /** Dollars wired at the round PPS (cents). SAFE conversions wire NOTHING — that cash
   * arrived when the SAFE was signed. */
  dollars: number
}

export interface PricedRoundReplay {
  /** Stage "term sheet" (fund_002 n1): the economics implied by the history + round terms. */
  termSheet: TermSheetEconomics
  /** Stage "closing" (fund_002 n7 — verify the wires and issue the shares). Absent when the
   * cap-table engine rejected an event (see error). */
  closing?: {
    round: PricedRoundBreakdown
    conversions: SafeConversion[]
    /** The wires to verify: each cash purchase at the round PPS. Σ dollars lands a hair
     * under newMoney because share counts floor (stated, not hidden). */
    wires: WireRow[]
    wireTotal: number
  }
  /** Stage "post-close" (fund_002 n9 — the table the cap-table update must reproduce). */
  postClose?: {
    rows: CapTableRow[]
    fullyDilutedShares: number
    /** All preferred issued in the round: cash shares + every SAFE sub-series. */
    newPreferredShares: number
    /** The cash series converts 1:1 at close: conversion price = original issue price =
     * the round PPS, ratio 1.0 (antiDilution.conversionRatio) — the baseline every future
     * anti-dilution adjustment moves from. */
    conversionPriceAtClose: number
    conversionRatioAtClose: number
  }
  /** Every intermediate snapshot from the cap-table engine (the audit trail). */
  snapshots: Snapshot[]
  error?: CapTableReport['error']
  needsReview: true
  notes: string[]
}

/**
 * The full priced round in one replay: fold the company's history (founding, grants,
 * SAFEs) plus the round through the cap-table engine (capTable.buildCapTable — the YC
 * Appendix II mechanics, cited and replayed there), then read the result back as the
 * process's own stages: the term-sheet economics, the closing wires-and-issuance, and the
 * post-close table. Nothing is recomputed — the composer narrates what the engine proved.
 */
export function replayPricedRound(history: readonly CapTableEvent[], round: ComposerRound): PricedRoundReplay {
  replayPricedRoundEntry.validate(history, round)
  for (const ev of history) {
    if (ev.kind === 'priced') throw new RangeError('history must stop before the round being replayed')
  }

  const report = buildCapTable([
    ...history,
    {
      kind: 'priced',
      name: round.name,
      preMoney: round.preMoney,
      newMoney: round.newMoney,
      poolTargetPct: round.poolTargetPct,
      poolShares: round.poolShares,
    },
  ])
  const finalSnapshot = report.error ? undefined : report.snapshots[report.snapshots.length - 1]
  const roundBreakdown = finalSnapshot?.round

  // Term-sheet stage from the history's own SAFEs plus, where only the engine knows the
  // number, the engine's own results: a capped SAFE's as-converted % is amount/cap
  // (capTable.safeOwnershipPct — the Quick Start §2 transparency); a discount-only/MFN
  // SAFE has no cap-determined ownership, so its as-converted % is its actual §B
  // conversion share; and the pool term is the round's actual increase as % of post-close
  // fully diluted (poolTargetPct is a TARGET — the increase is what dilutes, and an
  // existing unissued pool makes it smaller). When the engine rejected an event, the
  // estimate falls back to the capped SAFEs alone with no pool term.
  let safesPct = 0
  let safesWithProRataPct = 0
  for (const ev of history) {
    if (ev.kind !== 'safe') continue
    const pct =
      ev.cap !== undefined
        ? safeOwnershipPct(ev.amount, ev.cap)
        : (roundBreakdown?.conversions.find((c) => c.safeName === ev.name)?.postConversionPct ?? 0)
    safesPct += pct
    if (ev.proRata) safesWithProRataPct += pct
  }
  const poolIncreasePct =
    roundBreakdown && finalSnapshot && finalSnapshot.fullyDilutedShares > 0
      ? (roundBreakdown.poolIncreaseShares / finalSnapshot.fullyDilutedShares) * 100
      : 0
  const termSheet = termSheetEconomics({
    preMoney: round.preMoney,
    newMoney: round.newMoney,
    safesPct,
    safesWithProRataPct,
    poolIncreasePct,
  })

  const notes = [
    'Composed replay: all share counts, prices, and conversions come from capTable.buildCapTable (YC Post-Money Safe User Guide mechanics, Appendix II replayed in its tests).',
    'SAFE conversions wire nothing at the closing — that cash arrived when each SAFE was signed; only the new cash purchases (and exercised pro rata) are wires to verify.',
    'Educational model, not legal advice: counsel’s closing mechanics, consents, and filings control.',
  ]
  if (report.error) {
    return { termSheet, snapshots: report.snapshots, error: report.error, needsReview: true, notes }
  }

  const final = finalSnapshot as Snapshot
  const breakdown = roundBreakdown as PricedRoundBreakdown
  const conversions = breakdown.conversions
  const proRataTotal = conversions.reduce((s, c) => s + (c.proRataShares ?? 0), 0)
  const newInvestorShares = breakdown.roundShares - proRataTotal
  const wires: WireRow[] = [
    {
      holder: `${round.name} — new investors`,
      shares: newInvestorShares,
      dollars: round2(newInvestorShares * breakdown.pps),
    },
    ...conversions
      .filter((c) => c.proRataShares !== undefined && c.proRataShares > 0)
      .map((c) => ({
        holder: `${c.safeName} (pro rata)`,
        shares: c.proRataShares as number,
        dollars: c.proRataCost ?? round2((c.proRataShares as number) * breakdown.pps),
      })),
  ]
  const wireTotal = round2(wires.reduce((s, w) => s + w.dollars, 0))
  const conversionShares = conversions.reduce((s, c) => s + c.shares, 0)

  return {
    termSheet,
    closing: { round: breakdown, conversions, wires, wireTotal },
    postClose: {
      rows: final.rows,
      fullyDilutedShares: final.fullyDilutedShares,
      newPreferredShares: breakdown.roundShares + conversionShares,
      conversionPriceAtClose: breakdown.pps,
      conversionRatioAtClose: conversionRatio(breakdown.pps, breakdown.pps),
    },
    snapshots: report.snapshots,
    needsReview: true,
    notes,
  }
}

// ---------------------------------------------------------------------------
// Post-close sanity: what the table just signed pays at a sale
// ---------------------------------------------------------------------------

export interface PostCloseLiquidityCheck {
  waterfall: WaterfallReport
  /** The round preferred modeled as ONE pari passu 1x non-participating series; its
   * aggregate preference basis = every dollar actually paid for preferred (new cash at the
   * PPS + each SAFE's purchase amount + exercised pro rata). */
  preferenceBasis: number
  /** Sale price where that series is indifferent between preference and converting
   * (waterfall.conversionIndifferencePrice — the Cooley GO "greater of" definition). */
  indifferencePrice: number
  needsReview: true
  notes: string[]
}

/**
 * Compose the liquidity waterfall over the replay's post-close table: founders and option
 * holders share as common; the unissued pool is excluded (never shares in proceeds —
 * waterfall module, §C.1 convention); ALL round preferred (cash series + SAFE sub-series)
 * is modeled as one pari passu 1x non-participating series whose preference basis is the
 * dollars actually paid — the §A.5–A.6 pari passu treatment the waterfall module cites,
 * collapsed to its one-series contract. Stated limitation: the sub-series cannot make
 * DIFFERENT preference-vs-convert choices in this model (above the round PPS conversion
 * dominates for all of them; near or below the preference basis, per-sub-series mechanics
 * are the charter's text) — needsReview, like every waterfall report.
 */
export function postCloseLiquidityCheck(
  replay: PricedRoundReplay,
  salePrice: number,
  options?: { preferenceMultiple?: number; participating?: boolean },
): PostCloseLiquidityCheck {
  if (!replay.closing || !replay.postClose) throw new RangeError('replay has no closing (see replay.error)')
  const safeDollars = replay.closing.conversions.reduce((s, c) => s + c.amount, 0)
  const preferenceBasis = round2(replay.closing.wireTotal + safeDollars)
  // roundShares already contains the pro rata purchases (they are carved out of the
  // new-investor row, not added on top), so the preferred total is exactly
  // roundShares + conversion shares — the sum of every investor row.
  const preferredShares = replay.postClose.newPreferredShares

  const holders = replay.postClose.rows
    .filter((r) => (r.group === 'founder' || r.group === 'options') && r.shares !== null)
    .map((r) => ({ name: r.name, shares: r.shares as number, group: r.group === 'options' ? ('options' as const) : ('common' as const) }))
  const poolShares = replay.postClose.rows
    .filter((r) => r.group === 'pool')
    .reduce((s, r) => s + (r.shares ?? 0), 0)

  const preferred = {
    name: `${replay.closing.round.roundName} preferred (incl. SAFE sub-series, pari passu)`,
    shares: preferredShares,
    invested: preferenceBasis,
    preferenceMultiple: options?.preferenceMultiple,
    participating: options?.participating,
  }
  const commonShares = holders.reduce((s, h) => s + h.shares, 0)
  return {
    waterfall: liquidityWaterfall({ holders, preferred, unissuedPoolShares: poolShares }, salePrice),
    preferenceBasis,
    indifferencePrice: conversionIndifferencePrice(preferred, commonShares),
    needsReview: true,
    notes: [
      'All round preferred collapsed to one pari passu 1x series (waterfall module contract); per-sub-series preference choices are charter text.',
      'The price must be net of debt; escrows, capped participation, and stacked seniority are out of the waterfall module’s stated scope.',
    ],
  }
}

// ---------------------------------------------------------------------------
// The anti-dilution clause, quantified on the post-close table
// ---------------------------------------------------------------------------

/**
 * Preview a FUTURE dilutive round against the table this round just closed: the new-money
 * series is protected at conversion price = original issue price = the round PPS (its
 * at-close baseline, conversionRatio 1.0), and round.downRoundModel composes the
 * anti-dilution module's NVCA weighted-average / full-ratchet adjustment over the full
 * table (the Springmeyer worked example replays end-to-end in round.test.ts). SAFE
 * sub-series are NOT protected by default — their conversion prices differ per sub-series
 * and belong to the charter's own schedule (stated; protect them by passing extraProtected
 * with their effective prices from the replay's conversions).
 */
export function downRoundPreview(
  replay: PricedRoundReplay,
  issuance: DilutiveIssuance & { investorName: string },
  basis: AdjustmentBasis = 'broad-based',
  extraProtected: readonly ProtectedSeriesSpec[] = [],
): DownRoundReport {
  if (!replay.closing || !replay.postClose) throw new RangeError('replay has no closing (see replay.error)')
  const seriesRowName = `${replay.closing.round.roundName} — new investors`
  const protectedSeries: ProtectedSeriesSpec[] = [
    {
      seriesName: seriesRowName,
      originalIssuePrice: replay.postClose.conversionPriceAtClose,
      conversionPriceBefore: replay.postClose.conversionPriceAtClose,
      basis,
    },
    ...extraProtected,
  ]
  return downRoundModel(replay.postClose.rows, protectedSeries, issuance)
}
