// Offer / equity-comp scenarios — the third module of the open-startup toolkit (founder
// direction 2026-09-29). Pure, client-safe, deterministic; registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/equityComp.test.ts with
// every worked example's arithmetic re-derived in comments.
//
// Sources for the conventions (cited per function):
// - The Holloway Guide to Equity Compensation (https://www.holloway.com/g/equity-compensation
//   — resources/registry.json id `holloway-equity-guide`): option value at exit = shares ×
//   (per-share price − strike), the % of fully diluted ownership framing, and the tax
//   caveats this module deliberately does NOT compute.
// - Index Ventures, Rewarding Talent (https://www.indexventures.com/rewarding-talent/ —
//   id `index-rewarding-talent`): grant sizing as % of fully diluted, and the convention of
//   discounting for expected future-round dilution when quoting exit outcomes.
// - Strike-price floor: options must be granted with an exercise price at or above the
//   grant-date fair market value of the underlying stock to stay outside deferred-comp
//   treatment — rule card rules/US-FED/us-fed-409a-stock-right-exception.json (Treas. Reg.
//   § 1.409A-1(b)(5)); the module takes the 409A FMV/strike as INPUT and never invents one.
//
// Honest-scope notes (also in the README contract):
// - `commonSharePriceAtExit` divides exit value by fully diluted shares — a common-stock
//   proxy that ignores liquidation preferences, participation, and carve-outs. Below the
//   preference stack the real common price is lower; results carry needsReview for that.
// - Everything is pre-tax. ISO/NSO treatment, AMT, QSBS and 83(b) interactions are exactly
//   the questions the Holloway guide exists for; a calculator that pretended to answer them
//   in four lines would be wrong. Educational model, not tax or legal advice.
// ---------------------------------------------------------------------------

import { floorShares, roundPrice, vestedShares, type VestingSchedule } from './capTable'

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export interface OfferGrant {
  /** Options offered (whole shares). */
  optionShares: number
  /** Exercise price per share — by convention the grant-date 409A FMV (see module header). */
  strikePerShare: number
  /** Company fully diluted shares at grant (issued + options + pool + as-converted). */
  fullyDilutedShares: number
  /** Optional vesting schedule (standard 48/12 per the cap-table module's Cooley GO cite). */
  vesting?: VestingSchedule
}

function assertGrant(grant: OfferGrant): void {
  if (!(grant.optionShares > 0)) throw new RangeError('optionShares must be > 0')
  if (!(grant.strikePerShare >= 0)) throw new RangeError('strikePerShare must be >= 0')
  if (!(grant.fullyDilutedShares >= grant.optionShares)) {
    throw new RangeError('fullyDilutedShares must be >= optionShares')
  }
}

/**
 * Grant size as % of fully diluted — the sizing convention both cited handbooks use
 * (Rewarding Talent benchmarks grants in exactly these terms). 0–100.
 */
export function grantOwnershipPct(optionShares: number, fullyDilutedShares: number): number {
  if (!(optionShares >= 0) || !(fullyDilutedShares > 0)) throw new RangeError('shares must be >= 0 and FD > 0')
  return (optionShares / fullyDilutedShares) * 100
}

/**
 * Common-share price proxy at exit: exitValuation / fullyDilutedAtExit, rounded to 4
 * decimals (the cap-table module's price convention). Ignores the preference stack — see
 * the module header; treat as an upper bound below big preference overhangs.
 */
export function commonSharePriceAtExit(exitValuation: number, fullyDilutedAtExit: number): number {
  if (!(exitValuation >= 0) || !(fullyDilutedAtExit > 0)) throw new RangeError('valuation >= 0 and FD > 0 required')
  return roundPrice(exitValuation / fullyDilutedAtExit)
}

/**
 * Intrinsic (spread) value of options at a per-share price: shares × max(0, price − strike)
 * — the Holloway guide's basic option-value arithmetic. Under water ⇒ 0, never negative.
 */
export function optionSpread(shares: number, strikePerShare: number, sharePrice: number): number {
  if (!(shares >= 0) || !(strikePerShare >= 0) || !(sharePrice >= 0)) throw new RangeError('inputs must be >= 0')
  return round2(shares * Math.max(0, sharePrice - strikePerShare))
}

export interface ExitScenario {
  label: string
  /** Exit (or secondary/tender reference) valuation in dollars. */
  exitValuation: number
  /** Expected further dilution between grant and exit, in percent of the EXIT-time fully
   * diluted (the Rewarding Talent convention for quoting outcomes): 20 means today's
   * holders keep 80% of their percentage. Default 0. */
  extraDilutionPct?: number
}

export interface ExitOutcome {
  label: string
  exitValuation: number
  /** Fully diluted shares implied at exit after extraDilutionPct. */
  fullyDilutedAtExit: number
  sharePriceAtExit: number
  /** The grant's % of fully diluted at exit (0–100). */
  ownershipAtExitPct: number
  grossValue: number
  exerciseCost: number
  /** grossValue − exerciseCost, floored at 0 (nobody exercises under water). Pre-tax. */
  netBeforeTax: number
  /** True — always: the common-price proxy ignores preferences and taxes (module header). */
  needsReview: true
}

/**
 * One exit scenario for one grant. Dilution mechanics: if today's FD is N and holders are
 * diluted by d% of the exit-time table, exit FD = N / (1 − d/100) — the same pool-shuffle
 * algebra as capTable.poolIncreaseForTarget, so a 20% dilution turns 0.50% into 0.40%.
 */
export function grantExitOutcome(grant: OfferGrant, scenario: ExitScenario): ExitOutcome {
  assertGrant(grant)
  const d = scenario.extraDilutionPct ?? 0
  if (!(d >= 0) || d >= 100) throw new RangeError('extraDilutionPct must be in [0, 100)')
  if (!(scenario.exitValuation >= 0)) throw new RangeError('exitValuation must be >= 0')
  const fullyDilutedAtExit = floorShares(grant.fullyDilutedShares / (1 - d / 100))
  const sharePriceAtExit = commonSharePriceAtExit(scenario.exitValuation, fullyDilutedAtExit)
  const grossValue = round2(grant.optionShares * sharePriceAtExit)
  const exerciseCost = round2(grant.optionShares * grant.strikePerShare)
  const inMoney = sharePriceAtExit > grant.strikePerShare
  return {
    label: scenario.label,
    exitValuation: scenario.exitValuation,
    fullyDilutedAtExit,
    sharePriceAtExit,
    ownershipAtExitPct: grantOwnershipPct(grant.optionShares, fullyDilutedAtExit),
    grossValue,
    exerciseCost,
    netBeforeTax: inMoney ? round2(grossValue - exerciseCost) : 0,
    needsReview: true,
  }
}

/** The offer conversation in one table: the same grant across candidate scenarios. */
export function offerScenarioTable(grant: OfferGrant, scenarios: readonly ExitScenario[]): ExitOutcome[] {
  return scenarios.map((s) => grantExitOutcome(grant, s))
}

/**
 * Vested slice of an exit outcome after `monthsElapsed` under the grant's schedule (defaults
 * to the standard 48/12 the cap-table module cites from Cooley GO). Unvested options are
 * typically forfeited or accelerated per the plan documents — that's a contract question,
 * flagged, not computed.
 */
export function vestedExitOutcome(
  grant: OfferGrant,
  scenario: ExitScenario,
  monthsElapsed: number,
): { vestedShares: number; vestedNetBeforeTax: number; outcome: ExitOutcome } {
  const schedule = grant.vesting ?? { totalMonths: 48, cliffMonths: 12 }
  const vested = vestedShares(grant.optionShares, schedule, monthsElapsed)
  const outcome = grantExitOutcome(grant, scenario)
  const inMoney = outcome.sharePriceAtExit > grant.strikePerShare
  const vestedNet = inMoney ? round2(vested * (outcome.sharePriceAtExit - grant.strikePerShare)) : 0
  return { vestedShares: vested, vestedNetBeforeTax: vestedNet, outcome }
}
