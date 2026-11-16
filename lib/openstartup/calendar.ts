// Shared UTC calendar conventions for vesting. Plan documents control.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseIso(date: string, what: string): Date {
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
  // Date.UTC remaps years 0..99 to 1900..1999; mutate an already parsed date.
  const target = new Date(d);
  target.setUTCDate(1);
  target.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(target);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  target.setUTCDate(Math.min(d.getUTCDate(), last.getUTCDate()));
  if (!Number.isFinite(target.getTime()) || target.getUTCFullYear() > 9999)
    throw new RangeError('calendar result exceeds supported YYYY-MM-DD range');
  return target.toISOString().slice(0, 10);
}
