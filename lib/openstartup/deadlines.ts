// Deadline calendar — the recurring founder compliance clock (founder direction 2026-09-29).
//
// Pure, client-safe, deterministic: all date math is UTC on ISO `YYYY-MM-DD` strings.
// EVERY deadline here references a dated rule card in rules/ by id — no hardcoded day count
// is asserted without a card whose sources were verified against the live primary source
// (see open-modules/README.md; the cross-check that each ruleId resolves to a committed
// card lives in lib/openstartup/__tests__/deadlines.test.ts, which reads rules/ from disk).
//
// Honest-maturity contract (matches the rule cards' own caveats): this module computes the
// nominal calendar date stated by the rule and flags `needsReview: true` whenever the true
// legal date can differ — weekend landings (next-business-day rules exist but legal holidays
// are not computable here), fiscal-year exceptions, and event-date questions (what counts as
// the 83(b) "transfer" date). It never extends, waives, or legally determines a deadline.
// ---------------------------------------------------------------------------

/** The rule cards this calendar is allowed to cite. Kept as a single registry so the vitest
 * gate can assert every id resolves to a committed card with the matching jurisdiction. */
export const DEADLINE_RULE_IDS = {
  deFranchiseTax: { ruleId: 'us-de.franchise-tax-annual-report', jurisdiction: 'US-DE' },
  form1120: { ruleId: 'us-fed.1120-filing-deadline', jurisdiction: 'US-FED' },
  form941: { ruleId: 'us-fed.941-quarterly-deadline', jurisdiction: 'US-FED' },
  election83b: { ruleId: 'us-fed.83b-filing-period', jurisdiction: 'US-FED' },
} as const

export interface DeadlineComputation {
  /** Nominal due date, ISO YYYY-MM-DD, straight from the cited rule's day count. */
  due: string
  /** The rules/ card asserting the legal proposition behind `due`. */
  ruleId: string
  jurisdiction: 'US-FED' | 'US-DE'
  /** True when the real date may differ from `due` (weekend landing, statutory exception,
   * unverified event date). A needsReview deadline must not drive automated action —
   * same doctrine as the founder-ops planner's may_execute: false. */
  needsReview: boolean
  note: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseIso(date: string, what: string): Date {
  if (!ISO_DATE_RE.test(date)) throw new RangeError(`${what}: expected YYYY-MM-DD, got ${JSON.stringify(date)}`)
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || iso(d) !== date) throw new RangeError(`${what}: invalid calendar date ${date}`)
  return d
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isWeekend(dateIso: string): boolean {
  const day = new Date(`${dateIso}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

const HOLIDAY_CAVEAT = 'Legal holidays are not computed here; weekend landings are flagged, holiday landings are not.'

function weekendFlag(dueIso: string, base: string): { needsReview: boolean; note: string } {
  if (isWeekend(dueIso)) {
    return { needsReview: true, note: `${base} Nominal date falls on a weekend; the rule's next-business-day treatment applies — confirm the actual date. ${HOLIDAY_CAVEAT}` }
  }
  return { needsReview: false, note: `${base} ${HOLIDAY_CAVEAT}` }
}

/**
 * Delaware annual report + franchise tax: due on or before March 1 following the close of
 * the calendar year — rule `us-de.franchise-tax-annual-report` (8 Del. C. §§ 502(a), 504(a)).
 * Always needsReview=true for amounts: the tax itself must be computed/recomputed (authorized
 * shares vs assumed par value), and $5,000+ prior-year liability adds quarterly installments.
 */
export function deFranchiseTaxDue(taxYear: number): DeadlineComputation {
  if (!Number.isInteger(taxYear) || taxYear < 1900 || taxYear > 9999) throw new RangeError('taxYear must be a 4-digit year')
  const due = `${taxYear + 1}-03-01`
  const flag = weekendFlag(due, `Delaware annual report and franchise tax for calendar year ${taxYear}.`)
  return {
    due,
    ...DEADLINE_RULE_IDS.deFranchiseTax,
    needsReview: true,
    note: `${flag.note} Amount requires computation (authorized-shares vs assumed-par-value method); $5,000+ prior-year liability adds quarterly installments — see the rule card's caveat.`,
  }
}

/**
 * Federal corporate income tax return (Form 1120): due the 15th day of the 4th month after
 * the end of the tax year; June 30 fiscal-year corporations use the 3rd month — rule
 * `us-fed.1120-filing-deadline` (IRS Instructions for Form 1120, "When To File").
 */
export function form1120Due(taxYearEnd: string): DeadlineComputation {
  const end = parseIso(taxYearEnd, 'taxYearEnd')
  const june30 = end.getUTCMonth() === 5 && end.getUTCDate() === 30
  const monthsAfter = june30 ? 3 : 4
  const due = iso(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + monthsAfter, 15)))
  const base = june30
    ? `Form 1120 for the fiscal year ended ${taxYearEnd} — June 30 filers use the 15th day of the 3rd month (statutory exception; verify against the live instructions).`
    : `Form 1120 for the tax year ended ${taxYearEnd} (15th day of the 4th month).`
  const flag = weekendFlag(due, base)
  return {
    due,
    ...DEADLINE_RULE_IDS.form1120,
    needsReview: flag.needsReview || june30,
    note: `${flag.note} Short-period and dissolution returns differ; a Form 7004 extension extends filing, not payment.`,
  }
}

/**
 * Employer's quarterly federal tax return (Form 941): due the last day of the month
 * following the quarter (Apr 30 / Jul 31 / Oct 31 / Jan 31) — rule
 * `us-fed.941-quarterly-deadline` (IRS Instructions for Form 941, "When Must You File?").
 */
export function form941Due(year: number, quarter: 1 | 2 | 3 | 4): DeadlineComputation {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) throw new RangeError('year must be a 4-digit year')
  if (![1, 2, 3, 4].includes(quarter)) throw new RangeError('quarter must be 1-4')
  // Quarter q ends in month 3q; the return is due the last day of month 3q+1. Day 0 of the
  // following month is that last day (handles the 30/31 difference and the Jan-31 rollover).
  const due = iso(new Date(Date.UTC(year, quarter * 3 + 1, 0)))
  const flag = weekendFlag(due, `Form 941 for ${year} Q${quarter}.`)
  return {
    due,
    ...DEADLINE_RULE_IDS.form941,
    needsReview: flag.needsReview,
    note: `${flag.note} Timely full deposits extend filing by 10 days; deposit schedules are a separate, earlier obligation.`,
  }
}

/**
 * The 83(b) election window: no later than 30 days after the property transfer — rule
 * `us-fed.83b-filing-period` (Form 15620 instructions). Day counting is inclusive-exclusive
 * the way the instructions state it: day 30 is transfer date + 30 calendar days.
 * ALWAYS needsReview=true: the transfer date itself is a legal determination, and the rule
 * card's caveat is explicit that this repo does not calculate or extend the deadline —
 * this function surfaces the nominal date so a human files early, not close.
 */
export function election83bWindow(transferDate: string): DeadlineComputation & { transferDate: string } {
  const start = parseIso(transferDate, 'transferDate')
  const due = iso(new Date(start.getTime() + 30 * 86_400_000))
  const weekend = isWeekend(due)
  return {
    transferDate,
    due,
    ...DEADLINE_RULE_IDS.election83b,
    needsReview: true,
    note: `Nominal day 30 after the ${transferDate} transfer.${weekend ? ' Falls on a weekend; the instructions describe a next-business-day postmark rule — confirm.' : ''} The transfer date is a legal determination and the window is jurisdictional: file well before day 30. ${HOLIDAY_CAVEAT}`,
  }
}

export interface CalendarEntry extends DeadlineComputation {
  /** Stable id: `<deadline>-<period>` (e.g. de-franchise-tax-2026, form-941-2027-q1). */
  id: string
  name: string
}

/**
 * The recurring compliance clock between two dates (inclusive), for a Delaware C corporation
 * with a calendar tax year and (optionally) payroll: DE franchise tax (March 1), Form 1120
 * (April 15 nominal), and Form 941 quarterlies. Event-driven deadlines (83(b)) are computed
 * from their event via election83bWindow, not listed here. Sorted by due date, then id.
 */
export function complianceCalendar(
  fromIso: string,
  toIso: string,
  options?: { hasPayroll?: boolean },
): CalendarEntry[] {
  const from = parseIso(fromIso, 'from')
  const to = parseIso(toIso, 'to')
  if (from > to) throw new RangeError('from must be <= to')
  const entries: CalendarEntry[] = []
  for (let year = from.getUTCFullYear() - 1; year <= to.getUTCFullYear(); year++) {
    const franchise = deFranchiseTaxDue(year)
    entries.push({ id: `de-franchise-tax-${year}`, name: `Delaware annual report + franchise tax (tax year ${year})`, ...franchise })
    const f1120 = form1120Due(`${year}-12-31`)
    entries.push({ id: `form-1120-${year}`, name: `Form 1120 (calendar tax year ${year})`, ...f1120 })
    if (options?.hasPayroll ?? false) {
      for (const q of [1, 2, 3, 4] as const) {
        const f941 = form941Due(year, q)
        entries.push({ id: `form-941-${year}-q${q}`, name: `Form 941 (${year} Q${q})`, ...f941 })
      }
    }
  }
  return entries
    .filter((e) => e.due >= fromIso && e.due <= toIso)
    .sort((a, b) => (a.due === b.due ? (a.id < b.id ? -1 : 1) : a.due < b.due ? -1 : 1))
}
