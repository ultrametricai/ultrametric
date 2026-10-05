// Vesting schedules and mechanics — the eighth module of the open-startup toolkit (founder
// direction 2026-10-01: "go super deep on business logic — e.g. vesting schedules and
// mechanics").
//
// Where capTable.vestedShares answers "how many shares after N months" for the standard
// cliff + monthly convention, this module does the real date math: actual vesting DATES
// from a commencement date, cliff mechanics, termination cut-offs, unvested-repurchase
// summaries at departure, back-loaded and quarterly/annual variants, advisor grants per the
// published FAST grid, single- and double-trigger acceleration outcomes, and additive
// composition of refresh grants. Pure, client-safe (no node builtins), deterministic;
// registered in open-modules/README.md; tested in
// lib/openstartup/__tests__/vesting.test.ts (worked examples replayed from the cited
// sources, properties checked: cumulative vesting never decreases, totals are exact).
//
// Sources (each formula's doc comment cites the specific one):
// - Cooley GO, "Founder's Stock, Vesting and Founder Departures"
//   (https://www.cooleygo.com/founder-basics-founders-stock/, verified 2026-10-01): the
//   standard convention — "the stock vests in monthly or quarterly increments over four
//   years, with a one year 'cliff'"; before the cliff nothing is vested; at departure the
//   company may repurchase the UNVESTED shares (typically at cost).
// - Cooley GO, "Pulling the Trigger(s): What are Single-Trigger and Double-Trigger
//   Acceleration and How Do They Work?"
//   (https://www.cooleygo.com/what-are-single-and-double-trigger-acceleration-and-how-do-they-work/,
//   verified 2026-10-01): single-trigger = partial or full acceleration on ONE event
//   (typically the sale of the company); double-trigger = acceleration on TWO events —
//   the more common formulation being an involuntary termination without cause following
//   a sale of the company.
// - Founder Institute, FAST Agreement, "Version 3 - Updated July, 2026" (https://fi.co/fast,
//   verified live 2026-10-01): the advisor equity grid (Standard: Monthly Meetings —
//   Pre-seed 0.50%, Seed 0.25%, Series A 0.10%; Expert: Add Contacts Projects — Pre-seed
//   1.00%, Seed 0.75%, Series A 0.50%), vesting "over a two year time period" with "a
//   three-month 'cliff' on equity vesting".
// - Amazon's published back-loaded RSU schedule — 5% / 15% / 40% / 40% by year, the
//   year-3/4 portions vesting 20% every six months — documented in Bruce Brumberg,
//   "Amazon, Apple, Google: Restricted Stock Grants Evolve To Retain Top Talent", Forbes,
//   2022-02-08 (https://www.forbes.com/sites/brucebrumberg/2022/02/08/amazon-apple-google-restricted-stock-grants-evolve-to-retain-top-talent/)
//   and multiple independent compensation explainers. Used here as the citable published
//   example of a back-loaded tranche schedule.
// - Index Ventures, Rewarding Talent (https://www.indexventures.com/rewarding-talent/ —
//   resource id `index-rewarding-talent`): refresh/top-up grants as NEW grants layered on
//   existing ones — composition is additive, each grant keeps its own schedule.
//
// Date conventions (explicit):
// - UTC ISO dates (YYYY-MM-DD) only. Comparisons are lexicographic (valid for this format).
// - A vesting date is the monthly anniversary of the vesting commencement date. When the
//   commencement day-of-month does not exist in a target month (29/30/31), the date CLAMPS
//   to the last day of that month (Jan 31 + 1 month = Feb 28/29). This is the convention
//   cap-table platforms apply; the plan documents control, so date-sensitive outputs carry
//   needsReview. (Deliberately different from grant409aSanity.addUtcMonths, which keeps
//   JavaScript rollover for the regulatory 12-month window and documents that choice.)
// - "Vested at the cliff": the cliff date itself is a vesting date — shares vest ON it
//   (count inclusive), so a 48/12 grant is exactly 25% vested on the first anniversary
//   (Cooley GO: nothing before, 25% at one year).
//
// Rounding conventions (explicit): cumulative floor. At every vesting date the CUMULATIVE
// vested count is floorShares(totalShares × cumulative fraction) — whole shares, rounded
// down, same floorShares as capTable — and the per-date increment is the difference. The
// FINAL vesting date takes the remainder so the schedule always vests exactly
// floorShares(totalShares). Plan documents sometimes round differently (e.g. round per
// tranche); that is contract text, and the convention here is stated, not hidden.
// Educational model, not legal advice.
// ---------------------------------------------------------------------------

import { floorShares } from './capTable'

/** Rule cards this module references (the vitest gate asserts each resolves to a committed
 * card). Early exercise's 83(b) window is the deadlines module's territory and the tax
 * math is the tax module's — see earlyExerciseSnapshot. */
export const RULE_IDS_VESTING = {
  election83bWindow: { ruleId: 'us-fed.83b-filing-period', jurisdiction: 'US-FED' },
} as const

// ---------------------------------------------------------------------------
// Date math
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseIso(date: string, what: string): Date {
  if (!ISO_DATE_RE.test(date)) throw new RangeError(`${what}: expected YYYY-MM-DD, got ${JSON.stringify(date)}`)
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw new RangeError(`${what}: invalid calendar date ${date}`)
  }
  return d
}

/**
 * Add calendar months in UTC, CLAMPING to the last day of the target month when the
 * anniversary day does not exist there (module convention: Jan 31 + 1 month = Feb 28/29,
 * never Mar 2/3). This is the vesting-anniversary convention; the plan documents control.
 */
export function addMonthsClamped(iso: string, months: number): string {
  if (!Number.isInteger(months) || months < 0) throw new RangeError('months must be a non-negative integer')
  const d = parseIso(iso, 'date')
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + months
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const day = Math.min(d.getUTCDate(), lastDayOfTarget)
  return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export type ScheduleSpec =
  /** Cliff + periodic vesting: nothing before the cliff; the cliff date vests
   * cliffMonths/totalMonths of the grant (Cooley GO: exactly 25% at a 12-month cliff on a
   * 48-month schedule); afterwards each period anniversary vests to monthsElapsed/totalMonths.
   * periodMonths 1 = the standard monthly convention; 3 = quarterly; 12 = annual. */
  | { kind: 'periodic'; totalMonths: number; cliffMonths: number; periodMonths?: number }
  /** Back-loaded (or any explicit) tranche schedule: each tranche vests `fraction` of the
   * grant at `monthsFromStart` monthly anniversaries. Fractions must sum to 1. The cited
   * published example is Amazon's 5/15/40/40 (AMAZON_BACKLOADED_RSU below). */
  | { kind: 'tranches'; tranches: readonly { monthsFromStart: number; fraction: number }[] }

/** The standard founder/employee schedule — "monthly ... over four years, with a one year
 * 'cliff'" (Cooley GO, Founder's Stock). */
export const STANDARD_48_12: ScheduleSpec = { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 1 }

/** Amazon's published back-loaded RSU schedule: 5% at the end of year 1, 15% at the end of
 * year 2, then 20% every six months through years 3 and 4 — 5/15/40/40 by year (Forbes,
 * Brumberg 2022-02-08; see module header). */
export const AMAZON_BACKLOADED_RSU: ScheduleSpec = {
  kind: 'tranches',
  tranches: [
    { monthsFromStart: 12, fraction: 0.05 },
    { monthsFromStart: 24, fraction: 0.15 },
    { monthsFromStart: 30, fraction: 0.2 },
    { monthsFromStart: 36, fraction: 0.2 },
    { monthsFromStart: 42, fraction: 0.2 },
    { monthsFromStart: 48, fraction: 0.2 },
  ],
}

export interface VestingGrant {
  name?: string
  /** Whole shares granted (> 0). */
  shares: number
  /** Vesting commencement date, ISO YYYY-MM-DD (often the hire/grant date; the plan
   * documents control which). */
  commencement: string
  schedule: ScheduleSpec
  /** The grant permits exercise before vesting (early exercise) — see
   * earlyExerciseSnapshot for the 83(b)/tax-module interface. */
  earlyExercisable?: boolean
}

export interface VestingEvent {
  /** The vesting date (clamped monthly anniversary — module convention). */
  date: string
  monthsFromStart: number
  /** Whole shares vesting ON this date (cumulative-floor rounding; final date takes the
   * remainder — module convention). */
  sharesVested: number
  cumulativeVested: number
  /** Exact cumulative fraction of the grant scheduled through this date (pre-rounding). */
  cumulativeFraction: number
}

function validateGrant(grant: VestingGrant): void {
  if (!(grant.shares > 0)) throw new RangeError('shares must be > 0')
  parseIso(grant.commencement, 'commencement')
  const s = grant.schedule
  if (s.kind === 'periodic') {
    const period = s.periodMonths ?? 1
    if (!Number.isInteger(s.totalMonths) || s.totalMonths <= 0) throw new RangeError('totalMonths must be a positive integer')
    if (!Number.isInteger(s.cliffMonths) || s.cliffMonths < 0 || s.cliffMonths > s.totalMonths)
      throw new RangeError('cliffMonths must be an integer in [0, totalMonths]')
    if (!Number.isInteger(period) || period <= 0) throw new RangeError('periodMonths must be a positive integer')
  } else {
    if (s.tranches.length === 0) throw new RangeError('tranches must be non-empty')
    let sum = 0
    let prev = 0
    for (const t of s.tranches) {
      if (!Number.isInteger(t.monthsFromStart) || t.monthsFromStart <= prev)
        throw new RangeError('tranche monthsFromStart must be strictly increasing positive integers')
      if (!(t.fraction > 0)) throw new RangeError('tranche fraction must be > 0')
      sum += t.fraction
      prev = t.monthsFromStart
    }
    if (Math.abs(sum - 1) > 1e-9) throw new RangeError(`tranche fractions must sum to 1 (got ${sum})`)
  }
}

/**
 * The full list of vesting dates and amounts for one grant.
 *
 * Periodic mechanics (Cooley GO convention): no event before the cliff; the cliff date
 * vests cliffMonths/totalMonths of the grant in one piece ("what vests AT the cliff");
 * afterwards every periodMonths anniversary (counted from commencement) vests up to
 * monthsElapsed/totalMonths, and the final event lands exactly at totalMonths. A zero
 * cliff simply starts the periodic events at the first period anniversary.
 *
 * Tranche mechanics: each tranche vests on its own monthly anniversary; cumulative
 * fractions are the running sum (Amazon 5/15/40/40 replayed in the tests).
 */
export function vestingEvents(grant: VestingGrant): VestingEvent[] {
  validateGrant(grant)
  const total = floorShares(grant.shares)
  const points: { months: number; fraction: number }[] = []
  const s = grant.schedule
  if (s.kind === 'periodic') {
    const period = s.periodMonths ?? 1
    if (s.cliffMonths > 0) points.push({ months: s.cliffMonths, fraction: s.cliffMonths / s.totalMonths })
    for (let m = period; m <= s.totalMonths; m += period) {
      if (m <= s.cliffMonths) continue
      points.push({ months: m, fraction: m / s.totalMonths })
    }
    if (points.length === 0 || points[points.length - 1].months !== s.totalMonths) {
      points.push({ months: s.totalMonths, fraction: 1 })
    }
  } else {
    let cum = 0
    for (const t of s.tranches) {
      cum += t.fraction
      points.push({ months: t.monthsFromStart, fraction: cum })
    }
  }
  const events: VestingEvent[] = []
  let prevCum = 0
  for (let i = 0; i < points.length; i++) {
    const last = i === points.length - 1
    const cumulative = last ? total : floorShares(total * points[i].fraction)
    events.push({
      date: addMonthsClamped(grant.commencement, points[i].months),
      monthsFromStart: points[i].months,
      sharesVested: cumulative - prevCum,
      cumulativeVested: cumulative,
      cumulativeFraction: last ? 1 : points[i].fraction,
    })
    prevCum = cumulative
  }
  return events
}

export interface VestedPosition {
  vestedShares: number
  unvestedShares: number
  /** The date vesting was measured at: min(asOf, terminationOn) — service-based vesting
   * stops at termination (Cooley GO: the repurchase right covers shares unvested then). */
  measuredOn: string
  /** The next vesting date after measuredOn, if any. */
  nextVestingDate?: string
  needsReview: true
}

/**
 * Shares vested on a given date (inclusive — shares vest ON their vesting date, so the
 * cliff anniversary itself is 25% vested under the standard 48/12). A termination date
 * caps the measurement: no service, no further vesting (Cooley GO, Founder's Stock —
 * what remains unvested at departure is what the company may repurchase).
 */
export function vestedAsOf(grant: VestingGrant, asOf: string, terminationOn?: string): VestedPosition {
  parseIso(asOf, 'asOf')
  if (terminationOn !== undefined) parseIso(terminationOn, 'terminationOn')
  const measuredOn = terminationOn !== undefined && terminationOn < asOf ? terminationOn : asOf
  const events = vestingEvents(grant)
  let vested = 0
  let next: string | undefined
  for (const e of events) {
    if (e.date <= measuredOn) vested = e.cumulativeVested
    else if (next === undefined) next = e.date
  }
  return {
    vestedShares: vested,
    unvestedShares: floorShares(grant.shares) - vested,
    measuredOn,
    nextVestingDate: next,
    needsReview: true,
  }
}

/** What vests AT the cliff: the first vesting event's shares (exactly 25% on the standard
 * 48/12 — Cooley GO: nothing before one year, a quarter at it). Zero-cliff schedules have
 * no cliff event; the first periodic event is returned with cliff: false. */
export function cliffVesting(grant: VestingGrant): { date: string; shares: number; cliff: boolean } {
  const first = vestingEvents(grant)[0]
  const isCliff = grant.schedule.kind === 'periodic' && grant.schedule.cliffMonths > 0
  return { date: first.date, shares: first.sharesVested, cliff: isCliff }
}

// ---------------------------------------------------------------------------
// Departure: the unvested-repurchase summary
// ---------------------------------------------------------------------------

export interface DepartureSummary extends VestedPosition {
  /** Shares subject to the company's repurchase right at departure = the unvested shares
   * (Cooley GO: "the company has the right to repurchase the unvested shares", typically
   * at the price originally paid — i.e. at cost). */
  repurchasableShares: number
  note: string
}

/**
 * Vested/unvested split at a departure date plus the repurchase framing. The repurchase
 * PRICE and exercise window are contract terms (typically cost for founder stock —
 * Cooley GO; option plans usually just terminate unvested options instead), so the
 * summary names the mechanics and leaves the terms to the documents — needsReview.
 */
export function departureSummary(grant: VestingGrant, terminationOn: string): DepartureSummary {
  const pos = vestedAsOf(grant, terminationOn, terminationOn)
  return {
    ...pos,
    repurchasableShares: pos.unvestedShares,
    note:
      `At the ${terminationOn} departure, ${pos.vestedShares.toLocaleString('en-US')} shares are vested and ` +
      `${pos.unvestedShares.toLocaleString('en-US')} unvested. Restricted-stock plans typically give the company a ` +
      `right to repurchase the unvested shares at cost (Cooley GO, Founder's Stock); option plans typically terminate ` +
      `unvested options. Price, window, and post-termination exercise periods are the plan documents' terms.`,
  }
}

// ---------------------------------------------------------------------------
// Acceleration: single trigger, double trigger
// ---------------------------------------------------------------------------

export type AccelerationSpec =
  | { kind: 'full' }
  /** Accelerate a stated percentage of the then-unvested shares (floored to whole shares). */
  | { kind: 'percentOfUnvested'; pct: number }
  /** Credit extra months of service: vesting is measured as if the holder had served
   * `months` more months past the trigger date, capped at full vesting. */
  | { kind: 'monthsOfService'; months: number }

export interface TriggerPolicy {
  /** single: one event — typically the sale of the company. double: two events — the more
   * common form, an involuntary termination without cause following the sale (both per
   * Cooley GO, "Pulling the Trigger(s)"). */
  trigger: 'single' | 'double'
  acceleration: AccelerationSpec
}

export interface TriggerEvent {
  /** Closing date of the sale / change in control, if it happened. */
  saleOn?: string
  /** Date of the involuntary termination without cause, if it happened. */
  terminationWithoutCauseOn?: string
}

export interface AccelerationOutcome {
  triggered: boolean
  /** The date acceleration takes effect: the sale for single trigger; the SECOND trigger
   * (the termination following the sale) for double trigger. */
  effectiveOn?: string
  vestedBeforeAcceleration: number
  acceleratedShares: number
  vestedAfterAcceleration: number
  unvestedRemaining: number
  needsReview: true
  note: string
}

/**
 * Acceleration outcome for one grant, one policy, one event. Definitions per Cooley GO,
 * "Pulling the Trigger(s)": single trigger = partial or full acceleration of vesting on a
 * single event (typically the sale of the company); double trigger = acceleration when two
 * events occur, the common formulation being involuntary termination without cause
 * FOLLOWING the sale — so this function requires terminationWithoutCauseOn >= saleOn for a
 * double trigger. Whether a given termination is "without cause", "good reason" resigns,
 * and time windows around the sale are contract text — needsReview, never decided here.
 *
 * Acceleration arithmetic (all floored to whole shares):
 * - full: all then-unvested shares vest.
 * - percentOfUnvested: floor(unvested × pct / 100) — the "some or all" of the Cooley GO
 *   definition as a stated percentage.
 * - monthsOfService: vesting measured at effectiveOn + months (clamped anniversaries),
 *   minus already-vested; capped at the unvested balance.
 */
export function applyAcceleration(grant: VestingGrant, policy: TriggerPolicy, event: TriggerEvent): AccelerationOutcome {
  const total = floorShares(grant.shares)
  if (policy.acceleration.kind === 'percentOfUnvested') {
    const p = policy.acceleration.pct
    if (!(p > 0 && p <= 100)) throw new RangeError('percentOfUnvested pct must be in (0, 100]')
  }
  if (policy.acceleration.kind === 'monthsOfService' && !(Number.isInteger(policy.acceleration.months) && policy.acceleration.months > 0)) {
    throw new RangeError('monthsOfService months must be a positive integer')
  }
  if (event.saleOn !== undefined) parseIso(event.saleOn, 'saleOn')
  if (event.terminationWithoutCauseOn !== undefined) parseIso(event.terminationWithoutCauseOn, 'terminationWithoutCauseOn')

  let triggered = false
  let effectiveOn: string | undefined
  if (policy.trigger === 'single') {
    triggered = event.saleOn !== undefined
    effectiveOn = event.saleOn
  } else {
    triggered =
      event.saleOn !== undefined &&
      event.terminationWithoutCauseOn !== undefined &&
      event.terminationWithoutCauseOn >= event.saleOn
    effectiveOn = triggered ? event.terminationWithoutCauseOn : undefined
  }

  if (!triggered || effectiveOn === undefined) {
    const why =
      policy.trigger === 'single'
        ? 'single trigger requires the sale event'
        : 'double trigger requires BOTH the sale and an involuntary termination without cause on or after it (Cooley GO, "Pulling the Trigger(s)")'
    return {
      triggered: false,
      vestedBeforeAcceleration: 0,
      acceleratedShares: 0,
      vestedAfterAcceleration: 0,
      unvestedRemaining: total,
      needsReview: true,
      note: `Not triggered: ${why}. Vesting continues on schedule.`,
    }
  }

  const before = vestedAsOf(grant, effectiveOn).vestedShares
  const unvested = total - before
  let accelerated: number
  switch (policy.acceleration.kind) {
    case 'full':
      accelerated = unvested
      break
    case 'percentOfUnvested':
      accelerated = floorShares((unvested * policy.acceleration.pct) / 100)
      break
    case 'monthsOfService': {
      const projected = vestedAsOf(grant, addMonthsClamped(effectiveOn, policy.acceleration.months)).vestedShares
      accelerated = Math.min(projected - before, unvested)
      break
    }
  }
  return {
    triggered: true,
    effectiveOn,
    vestedBeforeAcceleration: before,
    acceleratedShares: accelerated,
    vestedAfterAcceleration: before + accelerated,
    unvestedRemaining: unvested - accelerated,
    needsReview: true,
    note:
      `${policy.trigger}-trigger acceleration effective ${effectiveOn}: ${accelerated.toLocaleString('en-US')} of ` +
      `${unvested.toLocaleString('en-US')} unvested shares accelerate. "Without cause", good-reason resignations, and ` +
      `time windows around the sale are the plan documents' terms — not decided here.`,
  }
}

// ---------------------------------------------------------------------------
// Refresh / evergreen composition
// ---------------------------------------------------------------------------

export interface PortfolioPosition {
  grants: { name: string; vested: number; unvested: number }[]
  vestedShares: number
  unvestedShares: number
  measuredOn: string
  needsReview: true
}

/**
 * Additive composition across grants: a refresh / top-up / evergreen grant is simply a NEW
 * grant with its own commencement and schedule layered onto the existing ones (Rewarding
 * Talent's refresh-grant practice — resource id `index-rewarding-talent`); vested totals
 * add, nothing about an old grant changes.
 */
export function portfolioVestedAsOf(grants: readonly VestingGrant[], asOf: string, terminationOn?: string): PortfolioPosition {
  if (grants.length === 0) throw new RangeError('at least one grant required')
  const rows = grants.map((g, i) => {
    const p = vestedAsOf(g, asOf, terminationOn)
    return { name: g.name ?? `grant-${i + 1}`, vested: p.vestedShares, unvested: p.unvestedShares }
  })
  const pos = vestedAsOf(grants[0], asOf, terminationOn)
  return {
    grants: rows,
    vestedShares: rows.reduce((s, r) => s + r.vested, 0),
    unvestedShares: rows.reduce((s, r) => s + r.unvested, 0),
    measuredOn: pos.measuredOn,
    needsReview: true,
  }
}

// ---------------------------------------------------------------------------
// Advisor grants: the FAST grid
// ---------------------------------------------------------------------------

export type FastStage = 'pre-seed' | 'seed' | 'series-a'
export type FastLevel = 'standard' | 'expert'

/** The published FAST advisor equity grid — Founder Institute FAST Agreement, "Version 3 -
 * Updated July, 2026" (https://fi.co/fast, verified live 2026-10-01). Percentages are of
 * the company ("an advisor will earn 1% of the company..."); this module applies them to a
 * supplied fully diluted share count — the plan documents define the denominator. */
export const FAST_GRID = {
  version: 'Version 3 - Updated July, 2026',
  source: 'https://fi.co/fast',
  pct: {
    standard: { 'pre-seed': 0.5, seed: 0.25, 'series-a': 0.1 },
    expert: { 'pre-seed': 1.0, seed: 0.75, 'series-a': 0.5 },
  } as Record<FastLevel, Record<FastStage, number>>,
  /** "vesting over a two year time period" with "a three-month 'cliff'" (fi.co/fast). */
  vesting: { totalMonths: 24, cliffMonths: 3 },
} as const

/**
 * An advisor grant per the FAST grid: floor(fullyDilutedShares × grid%) shares on the FAST
 * default schedule — monthly over 24 months with a 3-month cliff (fi.co/fast, Version 3).
 */
export function fastAdvisorGrant(
  stage: FastStage,
  level: FastLevel,
  fullyDilutedShares: number,
  commencement: string,
  name = `Advisor (${level}, ${stage})`,
): VestingGrant & { gridPct: number } {
  if (!(fullyDilutedShares > 0)) throw new RangeError('fullyDilutedShares must be > 0')
  const gridPct = FAST_GRID.pct[level]?.[stage]
  if (gridPct === undefined) throw new RangeError(`no FAST grid entry for level=${level} stage=${stage}`)
  return {
    name,
    shares: floorShares((fullyDilutedShares * gridPct) / 100),
    commencement,
    schedule: { kind: 'periodic', totalMonths: FAST_GRID.vesting.totalMonths, cliffMonths: FAST_GRID.vesting.cliffMonths, periodMonths: 1 },
    gridPct,
  }
}

// ---------------------------------------------------------------------------
// Early exercise — the 83(b) / tax-module interface (stated, not computed)
// ---------------------------------------------------------------------------

export interface EarlyExerciseSnapshot {
  exerciseOn: string
  vestedShares: number
  /** The shares still unvested at exercise — the shares subject to the repurchase right,
   * i.e. the "substantial risk of forfeiture" an 83(b) election addresses. This NUMBER is
   * this module's whole contribution; everything tax is the tax module's. */
  restrictedShares: number
  /** The 30-day election window is computed by deadlines.election83bWindow against rule
   * `us-fed.83b-filing-period`; this module only names the interface. */
  ruleId: string
  jurisdiction: 'US-FED'
  taxInterface: string
  needsReview: true
}

/**
 * The vesting-side facts an early exercise hands to the TAX module: how many of the
 * exercised shares are still unvested (restricted) on the exercise date. Interface
 * statement — the tax module (sibling lane) owns ISO/NSO treatment, AMT, QSBS, and the
 * 83(b) election's tax math; the deadline module (deadlines.election83bWindow, rule
 * `us-fed.83b-filing-period`) owns the 30-day window. This function computes shares only
 * and never says anything about taxes.
 */
export function earlyExerciseSnapshot(grant: VestingGrant, exerciseOn: string): EarlyExerciseSnapshot {
  if (!grant.earlyExercisable) {
    throw new RangeError('grant is not marked earlyExercisable — early exercise is a plan/grant term, not a default')
  }
  const pos = vestedAsOf(grant, exerciseOn)
  return {
    exerciseOn,
    vestedShares: pos.vestedShares,
    restrictedShares: pos.unvestedShares,
    ...RULE_IDS_VESTING.election83bWindow,
    taxInterface:
      'Hand restrictedShares and exerciseOn to the tax module (ISO/NSO, AMT, QSBS, 83(b) math — its territory) ' +
      'and to deadlines.election83bWindow for the 30-day filing window (rule us-fed.83b-filing-period). ' +
      'This module computes share counts only.',
    needsReview: true,
  }
}
