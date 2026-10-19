// Deferred revenue — the Stripe Revenue Recognition subscription examples replayed
// number-for-number (docs.stripe.com/revenue-recognition/examples/subscriptions, verified
// 2026-10-02): the $31 monthly split (17/14), the $365 annual year (31/28/31, deferred
// 334 → 306 → 275), and the $90 → $120 upgrade / $90 → $30 downgrade prorations (−30/+40
// and −30/+10, April recognizing $100 / $70). Plus the conservation properties: every
// schedule sums to its line and total recognized equals total billed, to the cent.

import { describe, expect, it } from 'vitest'
import {
  prorationOnPlanChange, recognitionReport, recognitionSchedule, serviceDays,
} from '../deferredRevenue'

describe('serviceDays (inclusive whole days — the examples’ convention)', () => {
  it('Jan 15 → Feb 14 is 31 days; Apr 1 → Apr 30 is 30; a single day is 1', () => {
    expect(serviceDays('2026-01-15', '2026-02-14')).toBe(31)
    expect(serviceDays('2026-04-01', '2026-04-30')).toBe(30)
    expect(serviceDays('2026-07-04', '2026-07-04')).toBe(1)
    expect(serviceDays('2026-01-01', '2026-12-31')).toBe(365) // 2026 is not a leap year
  })

  it('rejects malformed and impossible dates, and inverted periods', () => {
    expect(() => serviceDays('2026-1-5', '2026-02-01')).toThrow(RangeError)
  })

  it('counts leap-year days: 2028 has 366 days and 29 in February', () => {
    expect(serviceDays('2028-01-01', '2028-12-31')).toBe(366)
    expect(serviceDays('2028-02-01', '2028-02-29')).toBe(29)
    const sched = recognitionSchedule({ amount: 366, serviceStart: '2028-01-01', serviceEnd: '2028-12-31' })
    expect(sched[1]).toEqual({ month: '2028-02', days: 29, recognized: 29 })
    expect(sched.reduce((s, m) => s + m.recognized, 0)).toBeCloseTo(366, 10)
    expect(() => serviceDays('2026-02-30', '2026-03-01')).toThrow(RangeError)
    expect(() => serviceDays('2026-02-02', '2026-02-01')).toThrow(RangeError)
  })
})

describe('recognitionSchedule — the monthly example ($31, Jan 15 → Feb 14)', () => {
  it('recognizes $17 across 17 January days and $14 across 14 February days', () => {
    const sched = recognitionSchedule({ amount: 31, serviceStart: '2026-01-15', serviceEnd: '2026-02-14' })
    expect(sched).toEqual([
      { month: '2026-01', days: 17, recognized: 17 },
      { month: '2026-02', days: 14, recognized: 14 },
    ])
  })
})

describe('recognitionSchedule — the annual example ($365, calendar 2026)', () => {
  const sched = recognitionSchedule({ amount: 365, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' })

  it('recognizes +31 / +28 / +31 in Jan/Feb/Mar — one dollar per day', () => {
    expect(sched.slice(0, 3).map((m) => m.recognized)).toEqual([31, 28, 31])
    expect(sched).toHaveLength(12)
  })

  it('sums to the line exactly (cents conservation, largest remainder)', () => {
    expect(sched.reduce((s, m) => s + m.recognized, 0)).toBeCloseTo(365, 10)
  })
})

describe('recognitionReport — billed vs recognized vs deferred', () => {
  it('monthly example at January close: billed 31, recognized 17, deferred 14', () => {
    const r = recognitionReport([{ amount: 31, serviceStart: '2026-01-15', serviceEnd: '2026-02-14' }])
    expect(r.months[0]).toEqual({ month: '2026-01', billed: 31, recognized: 17, deferredEnd: 14 })
    expect(r.months[1]).toEqual({ month: '2026-02', billed: 0, recognized: 14, deferredEnd: 0 })
    expect(r.totalBilled).toBe(31)
    expect(r.totalRecognized).toBe(31)
    expect(r.needsReview).toBe(true)
  })

  it('annual example: deferred ends 334 / 306 / 275 (the +334 / −28 / −31 movement)', () => {
    const r = recognitionReport([{ amount: 365, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }])
    expect(r.months.slice(0, 3).map((m) => m.deferredEnd)).toEqual([334, 306, 275])
    expect(r.months.at(-1)!.deferredEnd).toBe(0)
  })

  it('cents stay exact on awkward splits ($100 over Jan 15 → Feb 14: 54.84 + 45.16)', () => {
    // 100 × 17/31 = 54.8387… → largest remainder gives 54.84 + 45.16 = 100.00 exactly.
    const r = recognitionReport([{ amount: 100, serviceStart: '2026-01-15', serviceEnd: '2026-02-14' }])
    expect(r.months.map((m) => m.recognized)).toEqual([54.84, 45.16])
    expect(r.totalRecognized).toBe(100)
  })
})

describe('prorationOnPlanChange — the upgrade and downgrade examples', () => {
  // April 2026: period Apr 1 → Apr 30 (30 days), change effective April 21 → 10 days left.
  const april = { periodStart: '2026-04-01', periodEnd: '2026-04-30', changeDate: '2026-04-21', billedOn: '2026-05-01' }

  it('upgrade $90 → $120: credit $30 for unused time, charge $40 for remaining time', () => {
    const p = prorationOnPlanChange({ ...april, oldAmount: 90, newAmount: 120 })
    expect(p.periodDays).toBe(30)
    expect(p.remainingDays).toBe(10)
    expect(p.unusedTimeCredit).toBe(30)
    expect(p.remainingTimeCharge).toBe(40)
    expect(p.netDue).toBe(10)
    expect(p.creditLine.amount).toBe(-30)
    expect(p.chargeLine.amount).toBe(40)
  })

  it('downgrade $90 → $30: credit $30, charge $10', () => {
    const p = prorationOnPlanChange({ ...april, oldAmount: 90, newAmount: 30 })
    expect(p.unusedTimeCredit).toBe(30)
    expect(p.remainingTimeCharge).toBe(10)
    expect(p.netDue).toBe(-20)
  })

  it('prorates at the period boundaries: a day-one change credits the full plan; a last-day change credits one day', () => {
    const dayOne = prorationOnPlanChange({ ...april, changeDate: '2026-04-01', oldAmount: 90, newAmount: 120 })
    expect(dayOne.remainingDays).toBe(30)
    expect(dayOne.unusedTimeCredit).toBe(90)
    expect(dayOne.remainingTimeCharge).toBe(120)
    const lastDay = prorationOnPlanChange({ ...april, changeDate: '2026-04-30', oldAmount: 90, newAmount: 120 })
    expect(lastDay.remainingDays).toBe(1)
    expect(lastDay.unusedTimeCredit).toBe(3) // 90 × 1/30
    expect(lastDay.remainingTimeCharge).toBe(4) // 120 × 1/30
  })

  it('rejects a change outside the period and negative plan amounts', () => {
    expect(() => prorationOnPlanChange({ ...april, changeDate: '2026-05-02', oldAmount: 90, newAmount: 120 })).toThrow(RangeError)
    expect(() => prorationOnPlanChange({ ...april, oldAmount: -1, newAmount: 120 })).toThrow(RangeError)
  })

  it('upgrade folded through recognitionReport: April recognizes $100, May $120 (the example’s table)', () => {
    const p = prorationOnPlanChange({ ...april, oldAmount: 90, newAmount: 120 })
    const r = recognitionReport([
      { amount: 90, serviceStart: '2026-04-01', serviceEnd: '2026-04-30' },
      p.creditLine,
      p.chargeLine,
      { amount: 120, serviceStart: '2026-05-01', serviceEnd: '2026-05-31', billedOn: '2026-05-01' },
    ])
    const [aprM, mayM] = r.months
    expect(aprM.recognized).toBe(100)
    expect(mayM.recognized).toBe(120)
    // April bills only the original $90 while recognizing $100 → deferredEnd −10, the
    // example's +$10 unbilled receivable, which May's invoice (−30 + 40 + 120) settles.
    expect(aprM.billed).toBe(90)
    expect(aprM.deferredEnd).toBe(-10)
    expect(mayM.billed).toBe(130)
    expect(mayM.deferredEnd).toBe(0)
    expect(r.totalBilled).toBe(r.totalRecognized)
  })

  it('downgrade folded through: April recognizes $70 (the example’s table)', () => {
    const p = prorationOnPlanChange({ ...april, oldAmount: 90, newAmount: 30 })
    const r = recognitionReport([
      { amount: 90, serviceStart: '2026-04-01', serviceEnd: '2026-04-30' },
      p.creditLine,
      p.chargeLine,
      { amount: 30, serviceStart: '2026-05-01', serviceEnd: '2026-05-31', billedOn: '2026-05-01' },
    ])
    expect(r.months[0].recognized).toBe(70)
    expect(r.months[1].recognized).toBe(30)
  })
})

describe('properties', () => {
  it('a credit’s schedule sums to the credit exactly (sign handled, cents conserved)', () => {
    const sched = recognitionSchedule({ amount: -100, serviceStart: '2026-01-15', serviceEnd: '2026-03-20' })
    expect(sched.reduce((s, m) => s + m.recognized, 0)).toBeCloseTo(-100, 10)
    expect(sched.every((m) => m.recognized <= 0)).toBe(true)
  })

  it('multi-year lines stay conserved and month-complete', () => {
    const sched = recognitionSchedule({ amount: 2_399.99, serviceStart: '2025-11-07', serviceEnd: '2027-02-03' })
    expect(sched).toHaveLength(16) // Nov 2025 … Feb 2027
    expect(Math.round(sched.reduce((s, m) => s + m.recognized, 0) * 100)).toBe(239_999)
    expect(sched.reduce((s, m) => s + m.days, 0)).toBe(serviceDays('2025-11-07', '2027-02-03'))
  })

  it('an empty report is refused; a zero-dollar line recognizes zero everywhere', () => {
    expect(() => recognitionReport([])).toThrow(RangeError)
    const r = recognitionReport([{ amount: 0, serviceStart: '2026-01-01', serviceEnd: '2026-03-31' }])
    expect(r.months.every((m) => m.recognized === 0 && m.deferredEnd === 0)).toBe(true)
  })
})
