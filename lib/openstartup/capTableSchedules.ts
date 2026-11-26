// Vesting schedules and note interest accrual in decimal strings, the companion of
// capTableDecimal.ts. Whole shares floor using exact integer ratios; interest calculates
// at 60 significant digits and returns 18 decimal places. Plan documents and the note's
// own text control every convention below. No grants, transfers or legal actions are
// authorized.
//
// Sources (each function's doc comment cites the ones its formula uses; all verified
// reachable 2026-11-25):
// - Cooley GO, "Founder's Stock, Vesting and Founder Departures"
//   (https://www.cooleygo.com/founder-basics-founders-stock/): stock "vests in monthly or
//   quarterly increments over four years", often with a one year "cliff".
// - Cooley GO, "Pulling the Trigger(s): What are Single-Trigger and Double-Trigger
//   Acceleration and How Do They Work?"
//   (https://www.cooleygo.com/what-are-single-and-double-trigger-acceleration-and-how-do-they-work/):
//   single trigger is "the partial or full acceleration of vesting" on one event; double
//   trigger is "acceleration based on the occurrence of two distinct events".
// - NASPP blog, Baker McKenzie Global Equity Services, "Leave of Absence Policies for
//   Equity Awards", 2022-11-09
//   (https://www.naspp.com/blog/equity-awards-and-leave-of-absence-policies): one policy
//   lets the employee "resume vesting after they return from leave" and "have their
//   vesting period extended by the duration of the leave".
// - Cooley GO, "Primer on Convertible Debt" (https://www.cooleygo.com/convertible-debt/):
//   interest is "simple" or compounding, "meaning the interest is turned into principal on
//   a regular basis" and "accrues its own interest".
// - Bank of England, Working Group on Sterling Risk-Free Reference Rates, "Recommendations
//   for SONIA loan market conventions"
//   (https://www.bankofengland.co.uk/-/media/boe/files/markets/benchmarks/rfr/statement-on-behalf-of-rfrwg-recommendations-for-sonia-loan-market-conventions.pdf),
//   Day count row: "ACT/365 (fixed)".
// - Federal Reserve Bank of New York, "Additional Information about Reference Rates",
//   Calculation Methodology for the SOFR Averages and Index
//   (https://www.newyorkfed.org/markets/reference-rates/additional-information-about-reference-rates):
//   "interest is calculated using the actual number of calendar days, but assuming a
//   360-day year"; worked example "(1)(1 + 1.80% × 1/360) = 1.00005000".
// - FINRA Rule 11620, Computation of Interest
//   (https://www.finra.org/rules-guidance/rulebooks/finra-rules/11620): 360-day year,
//   every month 30 days, with the day-of-month examples replayed in tests.
import { Decimal } from "decimal.js";
import { z } from "zod";
import { entrySpec } from "./entryValidation";
import { addMonthsClamped, parseIso } from "./calendar";
const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
const dec = (value: Decimal.Value = 0) => new D(value);
const fail = (message: string): never => { throw new RangeError(message); };
const zero = BigInt(0);
const percentage = (value: number): [bigint, bigint] => {
  const [whole, fraction = ""] = dec(value).toFixed().split(".");
  return [BigInt(whole! + fraction), BigInt(100) * BigInt(10) ** BigInt(fraction.length)];
};
const totalShares = (values: bigint[]) => values.reduce((total, value) => total + value, zero);
// UTC day numbers for day arithmetic; calendar.ts validates every date first.
const DAY_MS = 86_400_000;
const dayNumber = (iso: string, what: string) => Math.round(parseIso(iso, what).getTime() / DAY_MS);
const isoOfDay = (day: number): string => {
  const date = new Date(day * DAY_MS);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999 || date.getUTCFullYear() < 0)
    fail("calendar result exceeds supported YYYY-MM-DD range");
  return date.toISOString().slice(0, 10);
};
const minIso = (a: string, b: string) => (a < b ? a : b);

const quantity = z.string().regex(/^(0|[1-9]\d{0,29})$/);
const amount = z.string().regex(/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/);
const id = z.string().min(1).max(256);
const isoDate = z.string();

export type VestedScheduleInput = {
  shares: string;
  start: string;
  months?: number;
  frequencyMonths?: number;
  cliffMonths?: number;
  tranches?: { date: string; shares: string }[];
  milestones?: { id: string; shares: string }[];
  achievedMilestones?: { id: string; date: string }[];
  pauses?: { start: string; end: string }[];
  accelerations?: { date: string; pct: number }[];
  asOf: string;
  terminatedAt?: string;
};
export type VestedScheduleResult = { vested: string; unvested: string; nextVestDate: string | null };

export const vestedScheduleSharesEntry = entrySpec("vestedScheduleShares", [{
  name: "input",
  schema: z.object({
    shares: quantity,
    start: isoDate,
    months: z.number().int().min(1).max(1200).optional(),
    frequencyMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional(),
    cliffMonths: z.number().int().min(0).max(1200).optional(),
    tranches: z.array(z.object({ date: isoDate, shares: quantity })).max(1200).optional(),
    milestones: z.array(z.object({ id, shares: quantity })).max(1000).optional(),
    achievedMilestones: z.array(z.object({ id, date: isoDate })).max(1000).optional(),
    pauses: z.array(z.object({ start: isoDate, end: isoDate })).max(100).optional(),
    accelerations: z.array(z.object({ date: isoDate, pct: z.number().gt(0).max(100) })).max(100).optional(),
    asOf: isoDate,
    terminatedAt: isoDate.optional(),
  }),
}]);

type Prepared = {
  shares: bigint;
  start: string;
  startDay: number;
  months: number;
  frequency: number;
  cliff: number;
  timeShares: bigint;
  tranches: { date: string; shares: bigint }[];
  milestones: Map<string, bigint>;
  achieved: { id: string; date: string }[];
  pauses: { startDay: number; endDay: number }[];
  accelerations: { date: string; ratio: [bigint, bigint] }[];
  terminatedAt?: string;
};

function prepare(input: VestedScheduleInput): Prepared {
  vestedScheduleSharesEntry.validate(input);
  parseIso(input.start, "start");
  parseIso(input.asOf, "asOf");
  if (input.terminatedAt !== undefined) parseIso(input.terminatedAt, "terminatedAt");
  const shares = BigInt(input.shares);
  if (input.months !== undefined && input.tranches !== undefined)
    fail("Give either months or tranches, not both.");
  const frequency = input.frequencyMonths ?? 1;
  const months = input.months ?? 0;
  if (input.months === undefined && (input.frequencyMonths !== undefined || input.cliffMonths !== undefined))
    fail("frequencyMonths and cliffMonths require months.");
  if (months % frequency !== 0) fail("months must be a multiple of frequencyMonths.");
  const cliff = input.cliffMonths ?? 0;
  if (cliff > months) fail("Cliff exceeds the vesting duration.");
  const milestones = new Map<string, bigint>();
  for (const milestone of input.milestones ?? []) {
    if (milestones.has(milestone.id)) fail(`Duplicate milestone id ${milestone.id}.`);
    milestones.set(milestone.id, BigInt(milestone.shares));
  }
  const milestoneTotal = totalShares([...milestones.values()]);
  const seen = new Set<string>();
  for (const achieved of input.achievedMilestones ?? []) {
    if (!milestones.has(achieved.id)) fail(`Achieved milestone ${achieved.id} is not a declared milestone.`);
    if (seen.has(achieved.id)) fail(`Milestone ${achieved.id} is achieved more than once.`);
    seen.add(achieved.id);
    parseIso(achieved.date, `achievedMilestones.${achieved.id}`);
  }
  const tranches = (input.tranches ?? []).map((tranche, i) => {
    parseIso(tranche.date, `tranches[${i}].date`);
    return { date: tranche.date, shares: BigInt(tranche.shares) };
  });
  const trancheTotal = totalShares(tranches.map(t => t.shares));
  if (trancheTotal + milestoneTotal > shares) fail("Tranche and milestone shares exceed the grant.");
  const startDay = dayNumber(input.start, "start");
  const pauses = (input.pauses ?? [])
    .map((pause, i) => ({
      startDay: dayNumber(pause.start, `pauses[${i}].start`),
      endDay: dayNumber(pause.end, `pauses[${i}].end`),
    }))
    .sort((a, b) => a.startDay - b.startDay);
  pauses.forEach((pause, i) => {
    if (pause.startDay >= pause.endDay) fail("Each pause must start before it ends.");
    if (i > 0 && pause.startDay < pauses[i - 1]!.endDay) fail("Pauses must not overlap.");
  });
  const accelerations = (input.accelerations ?? [])
    .map((acceleration, i) => {
      parseIso(acceleration.date, `accelerations[${i}].date`);
      if (dec(acceleration.pct).decimalPlaces() > 4) fail("Acceleration pct allows at most 4 decimal places.");
      return { date: acceleration.date, ratio: percentage(acceleration.pct) };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    shares, start: input.start, startDay, months, frequency, cliff,
    timeShares: input.months === undefined ? zero : shares - milestoneTotal,
    tranches, milestones, achieved: input.achievedMilestones ?? [], pauses, accelerations,
    terminatedAt: input.terminatedAt,
  };
}

// Schedule date that real date `at` reaches once paused days in [start, at) are removed.
function shiftBack(p: Prepared, at: string): string {
  const atDay = dayNumber(at, "date");
  let paused = 0;
  for (const pause of p.pauses)
    paused += Math.max(0, Math.min(pause.endDay, atDay) - Math.max(pause.startDay, p.startDay));
  return isoOfDay(atDay - paused);
}

// Earliest real date on which the paused clock reaches schedule date `scheduled`.
function shiftForward(p: Prepared, scheduled: string): string {
  let day = dayNumber(scheduled, "date");
  for (const pause of p.pauses) {
    const from = Math.max(pause.startDay, p.startDay);
    if (pause.endDay > from && from < day) day += pause.endDay - from;
  }
  return isoOfDay(day);
}

// Largest k in [0, months] with addMonthsClamped(start, k) <= scheduled (the anniversary
// rule of vestedMonthlyShares; anniversaries increase strictly in k).
function elapsedMonths(p: Prepared, scheduled: string): number {
  if (scheduled < p.start) return 0;
  let low = 0;
  let high = p.months;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (addMonthsClamped(p.start, mid) <= scheduled) low = mid;
    else high = mid - 1;
  }
  return low;
}

function timeBased(p: Prepared, at: string): bigint {
  const scheduled = shiftBack(p, at);
  if (p.months > 0) {
    const elapsed = elapsedMonths(p, scheduled);
    if (elapsed < p.cliff) return zero;
    const counted = elapsed - (elapsed % p.frequency);
    return p.timeShares * BigInt(counted) / BigInt(p.months);
  }
  return totalShares(p.tranches.filter(t => t.date <= scheduled).map(t => t.shares));
}

function milestoneShares(p: Prepared, at: string): bigint {
  return totalShares(p.achieved.filter(a => a.date <= at).map(a => p.milestones.get(a.id)!));
}

function vestedAt(p: Prepared, asOf: string): bigint {
  const at = p.terminatedAt === undefined ? asOf : minIso(asOf, p.terminatedAt);
  let accelerated = zero;
  const capped = (value: bigint) => (value > p.shares ? p.shares : value);
  for (const acceleration of p.accelerations) {
    if (acceleration.date > at) break;
    const before = capped(timeBased(p, acceleration.date) + milestoneShares(p, acceleration.date) + accelerated);
    const [numerator, denominator] = acceleration.ratio;
    accelerated += (p.shares - before) * numerator / denominator;
  }
  return capped(timeBased(p, at) + milestoneShares(p, at) + accelerated);
}

/**
 * Vested and unvested whole shares of one grant under a periodic, tranche or milestone
 * schedule, with leaves of absence and acceleration.
 *
 * Periodic: the Cooley GO founders-stock convention (monthly or quarterly increments,
 * optional cliff; https://www.cooleygo.com/founder-basics-founders-stock/). Whole months
 * elapse on clamped calendar anniversaries exactly as in vestedMonthlyShares; elapsed
 * months round down to a multiple of frequencyMonths; nothing vests while elapsed months
 * are below cliffMonths, then the accrued amount vests at once. Vested time-based shares
 * floor(timeShares × counted / months), where timeShares is the grant less declared
 * milestone shares. Tranches vest their stated shares on each date.
 *
 * Pauses model the NASPP leave-of-absence policy in which vesting resumes on return and
 * "the vesting period [is] extended by the duration of the leave"
 * (https://www.naspp.com/blog/equity-awards-and-leave-of-absence-policies): the clock
 * stops from each pause start (inclusive) to its end (exclusive), so every vest date after
 * a pause start moves later by the pause length in calendar days.
 *
 * Milestones vest when achieved on or before the accrual date. Accrual stops at
 * min(asOf, terminatedAt).
 *
 * Acceleration follows the Cooley GO single- and double-trigger definitions
 * (https://www.cooleygo.com/what-are-single-and-double-trigger-acceleration-and-how-do-they-work/):
 * each entry is the date the trigger (or the second trigger) occurs and the percentage of
 * then-unvested shares that vests, floored with exact integer ratios. Entries apply in
 * date order when dated on or before the accrual date. Module convention: accelerated
 * shares come from the end of the schedule, so later time-based vesting continues and the
 * total is capped at the grant: vested = min(shares, timeBased + milestones + accelerated).
 *
 * nextVestDate is the first date after asOf on which vested increases, evaluated with the
 * supplied pauses, tranches, acceleration and achieved-milestone dates and termination.
 * It is null once fully vested, after termination, or when only unachieved milestones
 * remain. Throws RangeError for invalid inputs.
 */
export function vestedScheduleShares(input: VestedScheduleInput): VestedScheduleResult {
  const p = prepare(input);
  const vested = vestedAt(p, input.asOf);
  let nextVestDate: string | null = null;
  const terminated = p.terminatedAt !== undefined && p.terminatedAt <= input.asOf;
  if (vested < p.shares && !terminated) {
    const candidates = new Set<string>();
    for (let k = 1; k <= p.months; k++) candidates.add(shiftForward(p, addMonthsClamped(p.start, k)));
    for (const tranche of p.tranches) candidates.add(shiftForward(p, tranche.date));
    for (const acceleration of p.accelerations) candidates.add(acceleration.date);
    for (const achieved of p.achieved) candidates.add(achieved.date);
    for (const date of [...candidates].filter(d => d > input.asOf).sort()) {
      if (vestedAt(p, date) > vested) {
        nextVestDate = date;
        break;
      }
    }
  }
  return { vested: vested.toString(), unvested: (p.shares - vested).toString(), nextVestDate };
}

export type NoteInterestInput = {
  principal: string;
  ratePct: number;
  start: string;
  asOf: string;
  dayCount?: "actual_365" | "actual_360" | "30_360";
  compounding?: "simple" | "annual";
  maturityDate?: string;
  stopAtMaturity?: boolean;
};
export type NoteInterestResult = { days: number; interest: string; total: string };

export const noteAccruedInterestEntry = entrySpec("noteAccruedInterest", [{
  name: "input",
  schema: z.object({
    principal: amount,
    ratePct: z.number().min(0).max(100),
    start: isoDate,
    asOf: isoDate,
    dayCount: z.enum(["actual_365", "actual_360", "30_360"]).optional(),
    compounding: z.enum(["simple", "annual"]).optional(),
    maturityDate: isoDate.optional(),
    stopAtMaturity: z.boolean().optional(),
  }),
}]);

// FINRA Rule 11620(b): 360-day year, 30-day months. A 31st counts as the 30th; an end
// date on the 31st counts as the 30th when the start falls on the 30th or 31st.
function days30360(from: string, to: string): number {
  const [y1, m1, d1raw] = from.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2raw] = to.split("-").map(Number) as [number, number, number];
  const d1 = d1raw === 31 ? 30 : d1raw;
  const d2 = d2raw === 31 && d1 === 30 ? 30 : d2raw;
  return 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
}

/**
 * Accrued interest on a note from start to asOf (or to maturity when stopAtMaturity).
 *
 * Day counts: actual_365 divides actual days by 365, the ACT/365 (fixed) convention in the
 * Bank of England working group's SONIA loan recommendations; actual_360 divides actual
 * days by 360, the New York Fed SOFR convention ("actual number of calendar days, but
 * assuming a 360-day year"); 30_360 counts days under FINRA Rule 11620(b) over a 360-day
 * year. Source URLs are in the file header.
 *
 * Simple: interest = principal × rate × days / basis. Annual compounding applies the Cooley
 * GO primer's definition (interest "turned into principal on a regular basis",
 * https://www.cooleygo.com/convertible-debt/) with each clamped anniversary of start as the
 * regular basis: every annual period and the final stub accrue balance × rate ×
 * periodDays / basis under the chosen day count, and each completed period's interest is
 * added to the balance. A 366-day period therefore accrues rate × 366/365 on actual/365. Interest is calculated at 60 significant digits and returned to 18 places;
 * total = principal + interest. The note's own text controls these terms.
 * Throws RangeError for invalid inputs.
 */
export function noteAccruedInterest(input: NoteInterestInput): NoteInterestResult {
  noteAccruedInterestEntry.validate(input);
  parseIso(input.start, "start");
  parseIso(input.asOf, "asOf");
  if (input.maturityDate !== undefined) {
    parseIso(input.maturityDate, "maturityDate");
    if (input.maturityDate < input.start) fail("maturityDate is before start.");
  }
  if (input.stopAtMaturity && input.maturityDate === undefined) fail("stopAtMaturity requires maturityDate.");
  const dayCount = input.dayCount ?? "actual_365";
  const end = input.stopAtMaturity ? minIso(input.asOf, input.maturityDate!) : input.asOf;
  const principal = dec(input.principal);
  if (end <= input.start) return { days: 0, interest: dec().toFixed(18), total: principal.toFixed(18) };
  const count = (from: string, to: string) =>
    dayCount === "30_360" ? days30360(from, to) : dayNumber(to, "to") - dayNumber(from, "from");
  const basis = dayCount === "actual_365" ? 365 : 360;
  const rate = dec(input.ratePct).div(100);
  const days = count(input.start, end);
  let interest: Decimal;
  if ((input.compounding ?? "simple") === "simple") {
    interest = principal.times(rate).times(days).div(basis);
  } else {
    let balance = principal;
    let from = input.start;
    for (let year = 1; ; year++) {
      const anniversary = addMonthsClamped(input.start, 12 * year);
      const to = anniversary <= end ? anniversary : end;
      balance = balance.times(rate.times(count(from, to)).div(basis).plus(1));
      if (to === end) break;
      from = to;
    }
    interest = balance.minus(principal);
  }
  const rounded = interest.toFixed(18);
  return { days, interest: rounded, total: principal.plus(rounded).toFixed(18) };
}
