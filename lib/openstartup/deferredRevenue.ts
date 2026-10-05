// Deferred revenue (subscriptions) — straight-line, day-count revenue recognition basics
// (founder ask 2026-10-02: "what open modules can we improve logic-wise?"). The honest
// scope: a subscription invoice line is earned over its service period, not when the cash
// lands — this module does exactly that arithmetic (whole-day straight line, cents-exact)
// and NOTHING judgment-shaped: performance obligations, standalone selling prices,
// usage-based pricing, refunds/credit notes, FX, collectibility, and the cash-vs-accrual
// question are the accountant's calls under the accounting standard (ASC 606 / IFRS 15)
// and are out of scope, flagged. Every report is needsReview — the books belong to the
// bookkeeping close and its accountant-review step, never to a pure function.
//
// Pure, client-safe (no node builtins); UTC ISO-date arithmetic only, like deadlines.ts
// and vesting.ts. Cents-exact allocation REUSES the waterfall module's allocateCents
// (largest remainder — cited there); no parallel rounding scheme. Registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/deferredRevenue.test.ts.
//
// Source (verified 2026-10-02): Stripe Docs, "Revenue Recognition examples" and
// "Subscription examples" (https://docs.stripe.com/revenue-recognition/examples,
// https://docs.stripe.com/revenue-recognition/examples/subscriptions) — revenue recognized
// "in whole-day increments" (the default amortization granularity), with published worked
// examples replayed number-for-number in the tests:
// - Monthly: $31 for Jan 15 → Feb 14 recognizes $17 across 17 January days and $14 across
//   14 February days (deferred +14 at January close).
// - Annual: $365 for Jan 1 → Dec 31, 2026 recognizes +31 / +28 / +31 in Jan/Feb/Mar with
//   deferred +334 / −28 / −31.
// - Upgrade: $90 monthly from Apr 1; upgrade to $120 on Apr 21 creates the two proration
//   items (−$30 unused time, +$40 remaining time, both Apr 21 → end of April) and April
//   recognizes $100; the downgrade variant (−$30, +$10) recognizes $70.
// The vendor's docs are the published worked-example source for the DAY-COUNT CONVENTION;
// the convention itself (ratable recognition over the service period) is standard
// subscription accrual accounting under ASC 606 — which standard applies, and whether it
// applies to you at all, is the accountant's question.
//
// Date convention (stated): serviceStart and serviceEnd are INCLUSIVE whole days (the
// Stripe examples' "January 15 to February 14" is 31 days). Dollars in, cents-exact out.
// Educational model, not accounting advice.
// ---------------------------------------------------------------------------

import { allocateCents } from './waterfall'

const DAY_MS = 86_400_000

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

function toUtcMs(iso: string, field: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError(`${field}: expected YYYY-MM-DD, got ${JSON.stringify(iso)}`)
  const [y, m, d] = iso.split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d)
  const roundTrip = new Date(ms)
  if (roundTrip.getUTCFullYear() !== y || roundTrip.getUTCMonth() !== m - 1 || roundTrip.getUTCDate() !== d)
    throw new RangeError(`${field}: ${iso} is not a real calendar date`)
  return ms
}

function monthKeyOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** First ms of the month containing ms. */
function monthStart(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

/** First ms of the month AFTER the month containing ms. */
function nextMonthStart(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
}

// ---------------------------------------------------------------------------
// Day counts and schedules
// ---------------------------------------------------------------------------

/** Inclusive whole-day count of a service period — the Stripe examples' convention
 * ("January 15 to February 14" = 17 + 14 = 31 days). */
export function serviceDays(serviceStart: string, serviceEnd: string): number {
  const s = toUtcMs(serviceStart, 'serviceStart')
  const e = toUtcMs(serviceEnd, 'serviceEnd')
  if (e < s) throw new RangeError('serviceEnd must be on or after serviceStart')
  return Math.round((e - s) / DAY_MS) + 1
}

export interface RevenueLine {
  description?: string
  /** Invoice-line dollars. Negative lines are the proration CREDITS of the Stripe upgrade/
   * downgrade examples ("-30 USD for the unused time of the previous plan"). */
  amount: number
  /** Inclusive ISO service period the line is earned over. */
  serviceStart: string
  serviceEnd: string
  /** When the line is invoiced (ISO date). Defaults to serviceStart — the Stripe examples
   * finalize the subscription invoice at the period start; proration items bill on the
   * NEXT invoice, after some of their service has already been delivered. */
  billedOn?: string
}

export interface MonthRecognition {
  /** YYYY-MM. */
  month: string
  days: number
  recognized: number
}

/**
 * Straight-line, whole-day recognition of one invoice line across calendar months:
 * amount × (days of the service period falling in the month ÷ total service days),
 * cents-exact via largest-remainder allocation (waterfall.allocateCents) so the months sum
 * to the line EXACTLY. Replays the Stripe monthly example ($31 over Jan 15 → Feb 14 =
 * $17 + $14) and annual example ($365 over 2026 = $31/$28/$31 in Q1) number-for-number.
 */
export function recognitionSchedule(line: RevenueLine): MonthRecognition[] {
  if (!Number.isFinite(line.amount)) throw new RangeError('amount must be finite')
  const s = toUtcMs(line.serviceStart, 'serviceStart')
  const e = toUtcMs(line.serviceEnd, 'serviceEnd')
  if (e < s) throw new RangeError('serviceEnd must be on or after serviceStart')

  const months: { month: string; days: number }[] = []
  for (let cursor = s; cursor <= e; cursor = nextMonthStart(cursor)) {
    const mEnd = nextMonthStart(cursor) - DAY_MS
    const overlapStart = Math.max(s, monthStart(cursor))
    const overlapEnd = Math.min(e, mEnd)
    months.push({ month: monthKeyOf(cursor), days: Math.round((overlapEnd - overlapStart) / DAY_MS) + 1 })
  }

  // allocateCents is defined for non-negative totals; credits allocate on the magnitude
  // and flip sign, so a credit's months also sum to the credit exactly.
  const sign = line.amount < 0 ? -1 : 1
  const alloc = allocateCents(Math.abs(line.amount), months.map((m) => m.days))
  return months.map((m, i) => ({ month: m.month, days: m.days, recognized: sign * alloc[i] }))
}

// ---------------------------------------------------------------------------
// The monthly summary — recognized vs deferred, the way the close reads it
// ---------------------------------------------------------------------------

export interface RecognitionMonthSummary {
  month: string
  /** Invoice dollars billed in the month (by billedOn). */
  billed: number
  /** Dollars earned in the month across all lines. */
  recognized: number
  /** Cumulative billed − cumulative recognized at month end. NEGATIVE means revenue was
   * earned before it was billed — the Stripe upgrade example's unbilled receivable
   * (+$10 in April), stated, not hidden. */
  deferredEnd: number
}

export interface RecognitionReport {
  months: RecognitionMonthSummary[]
  totalBilled: number
  totalRecognized: number
  needsReview: true
  notes: string[]
}

/**
 * Fold invoice lines into the month-by-month recognized / deferred view a bookkeeping
 * close reads: recognized per the straight-line schedules; deferred revenue = what has
 * been billed but not yet earned (the Stripe annual example's +334 / −28 / −31 movement is
 * replayed in the tests as deferredEnd 334 → 306 → 275). Conservation is tested: total
 * recognized equals total billed, to the cent. ASC 606 judgment calls (obligations, SSP,
 * variable consideration) and anything beyond time-based lines are the accountant's —
 * needsReview, always.
 */
export function recognitionReport(lines: readonly RevenueLine[]): RecognitionReport {
  if (lines.length === 0) throw new RangeError('at least one revenue line required')
  const recognizedByMonth = new Map<string, number>()
  const billedByMonth = new Map<string, number>()
  let firstMonth = Infinity
  let lastMonth = -Infinity

  for (const line of lines) {
    const billedMs = toUtcMs(line.billedOn ?? line.serviceStart, 'billedOn')
    const billedKeyMs = monthStart(billedMs)
    billedByMonth.set(monthKeyOf(billedMs), round2((billedByMonth.get(monthKeyOf(billedMs)) ?? 0) + line.amount))
    firstMonth = Math.min(firstMonth, billedKeyMs)
    lastMonth = Math.max(lastMonth, billedKeyMs)
    for (const m of recognitionSchedule(line)) {
      recognizedByMonth.set(m.month, round2((recognizedByMonth.get(m.month) ?? 0) + m.recognized))
      const ms = toUtcMs(`${m.month}-01`, 'month')
      firstMonth = Math.min(firstMonth, ms)
      lastMonth = Math.max(lastMonth, ms)
    }
  }

  const months: RecognitionMonthSummary[] = []
  let cumBilled = 0
  let cumRecognized = 0
  for (let cursor = firstMonth; cursor <= lastMonth; cursor = nextMonthStart(cursor)) {
    const key = monthKeyOf(cursor)
    const billed = billedByMonth.get(key) ?? 0
    const recognized = recognizedByMonth.get(key) ?? 0
    cumBilled = round2(cumBilled + billed)
    cumRecognized = round2(cumRecognized + recognized)
    months.push({ month: key, billed, recognized, deferredEnd: round2(cumBilled - cumRecognized) })
  }

  return {
    months,
    totalBilled: cumBilled,
    totalRecognized: cumRecognized,
    needsReview: true,
    notes: [
      'Straight-line whole-day recognition of time-based invoice lines only (Stripe Revenue Recognition examples convention).',
      'ASC 606 / IFRS 15 judgment — performance obligations, standalone selling prices, variable consideration, refunds — belongs to the accountant; this report never replaces the close’s accountant review.',
      'Negative deferredEnd = revenue earned before billing (an unbilled receivable), as in the cited upgrade example.',
    ],
  }
}

// ---------------------------------------------------------------------------
// Plan-change proration — the Stripe upgrade/downgrade arithmetic
// ---------------------------------------------------------------------------

export interface PlanChangeProration {
  periodDays: number
  /** Whole days from the change date through the period end (inclusive). */
  remainingDays: number
  /** Dollars credited for the old plan's unused time: old amount × remaining ÷ period
   * (the examples' "-30 USD for the unused time of the previous plan" = $90 × 10/30). */
  unusedTimeCredit: number
  /** Dollars charged for the new plan's remaining time: new amount × remaining ÷ period
   * ("$40 for the remaining time of the new plan" = $120 × 10/30; $10 on the downgrade). */
  remainingTimeCharge: number
  /** charge − credit: what lands on the next invoice for the change itself. */
  netDue: number
  /** The two proration items as revenue lines (service period = change date → period end),
   * ready for recognitionReport; both bill on the NEXT invoice per the cited examples. */
  creditLine: RevenueLine
  chargeLine: RevenueLine
  needsReview: true
  note: string
}

/**
 * Mid-period plan change, prorated by whole days — the Stripe subscription upgrade /
 * downgrade examples replayed number-for-number in the tests: a $90 April plan changed on
 * April 21 has 10 of 30 days remaining, so the credit is $30 and the charge is $120 ×
 * 10/30 = $40 (upgrade) or $30 × 10/30 = $10 (downgrade), and April still recognizes $100
 * / $70 once the three lines are folded through recognitionReport. Whether a change
 * prorates at all, and on what granularity, is the billing configuration's own setting —
 * needsReview.
 */
export function prorationOnPlanChange(input: {
  periodStart: string
  /** Inclusive period end (the April examples' period is Apr 1 → Apr 30: 30 days). */
  periodEnd: string
  /** The change takes effect at the start of this day. */
  changeDate: string
  oldAmount: number
  newAmount: number
  /** When the proration items bill — the examples put them on the next invoice. */
  billedOn?: string
}): PlanChangeProration {
  if (!(input.oldAmount >= 0) || !(input.newAmount >= 0)) throw new RangeError('plan amounts must be >= 0')
  const periodDays = serviceDays(input.periodStart, input.periodEnd)
  const change = toUtcMs(input.changeDate, 'changeDate')
  if (change < toUtcMs(input.periodStart, 'periodStart') || change > toUtcMs(input.periodEnd, 'periodEnd'))
    throw new RangeError('changeDate must fall inside the billing period')
  const remainingDays = serviceDays(input.changeDate, input.periodEnd)
  const unusedTimeCredit = round2((input.oldAmount * remainingDays) / periodDays)
  const remainingTimeCharge = round2((input.newAmount * remainingDays) / periodDays)
  const base = { serviceStart: input.changeDate, serviceEnd: input.periodEnd, billedOn: input.billedOn }
  return {
    periodDays,
    remainingDays,
    unusedTimeCredit,
    remainingTimeCharge,
    netDue: round2(remainingTimeCharge - unusedTimeCredit),
    creditLine: { ...base, description: 'Unused time on the previous plan', amount: -unusedTimeCredit },
    chargeLine: { ...base, description: 'Remaining time on the new plan', amount: remainingTimeCharge },
    needsReview: true,
    note:
      `${remainingDays} of ${periodDays} period days remain at the change: credit $${unusedTimeCredit} for the old ` +
      `plan's unused time, charge $${remainingTimeCharge} for the new plan's remaining time (Stripe subscription ` +
      `examples' whole-day proration). Whether and how a change prorates is the billing configuration's setting.`,
  }
}
