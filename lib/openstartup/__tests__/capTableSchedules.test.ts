import { describe, expect, it } from 'vitest'
import { noteAccruedInterest, vestedScheduleShares, type VestedScheduleInput } from '../capTableSchedules'
import { vestedMonthlyShares } from '../capTableDecimal'
import { addMonthsClamped } from '../calendar'

// Deterministic pseudo-random generator (mulberry32) so the property runs are replayable.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const isoPlusDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

const fourYear = (overrides: Partial<VestedScheduleInput> = {}): VestedScheduleInput => ({
  shares: '4800', start: '2026-01-15', months: 48, cliffMonths: 12, asOf: '2026-01-15', ...overrides,
})
const month = (k: number, start = '2026-01-15') => addMonthsClamped(start, k)

describe('vestedScheduleShares: periodic schedules', () => {
  it('matches vestedMonthlyShares for monthly schedules without pauses, tranches, milestones or acceleration', () => {
    const next = rng(20261125)
    for (let i = 0; i < 600; i++) {
      const start = isoPlusDays('2020-01-01', Math.floor(next() * 3650))
      const months = 1 + Math.floor(next() * (next() < 0.1 ? 1200 : 72))
      const cliffMonths = next() < 0.3 ? undefined : Math.floor(next() * (months + 1))
      const shares = next() < 0.1
        ? '123456789012345678901234567890'
        : String(Math.floor(next() * 10 ** (1 + Math.floor(next() * 12))))
      const asOf = isoPlusDays(start, Math.floor(next() * (months * 31 + 60)) - 30)
      const terminatedAt = next() < 0.3 ? isoPlusDays(start, Math.floor(next() * months * 31)) : undefined
      const input = { shares, start, months, cliffMonths, asOf, terminatedAt }
      expect(vestedScheduleShares({ ...input, frequencyMonths: 1 }).vested, JSON.stringify(input))
        .toBe(vestedMonthlyShares(input))
    }
  })

  it('vests nothing before the cliff, then the accrued months at once', () => {
    expect(vestedScheduleShares(fourYear({ asOf: '2027-01-14' }))).toEqual({
      vested: '0', unvested: '4800', nextVestDate: '2027-01-15',
    })
    expect(vestedScheduleShares(fourYear({ asOf: '2027-01-15' }))).toEqual({
      vested: '1200', unvested: '3600', nextVestDate: '2027-02-15',
    })
    expect(vestedScheduleShares(fourYear({ asOf: '2030-01-15' }))).toEqual({
      vested: '4800', unvested: '0', nextVestDate: null,
    })
  })

  it('vests quarterly and annually on multiples of the frequency', () => {
    const quarterly = fourYear({ frequencyMonths: 3 })
    expect(vestedScheduleShares({ ...quarterly, asOf: month(13) })).toEqual({
      vested: '1200', unvested: '3600', nextVestDate: month(15),
    })
    expect(vestedScheduleShares({ ...quarterly, asOf: month(14) }).vested).toBe('1200')
    expect(vestedScheduleShares({ ...quarterly, asOf: month(15) }).vested).toBe('1500')
    const annual = fourYear({ frequencyMonths: 12, cliffMonths: 0 })
    expect(vestedScheduleShares({ ...annual, asOf: month(23) })).toEqual({
      vested: '1200', unvested: '3600', nextVestDate: month(24),
    })
    expect(vestedScheduleShares({ ...annual, asOf: month(24) }).vested).toBe('2400')
  })

  it('applies a cliff that is not a multiple of the frequency to elapsed months, then counts whole periods', () => {
    const input = fourYear({ frequencyMonths: 3, cliffMonths: 4 })
    expect(vestedScheduleShares({ ...input, asOf: month(3) }).vested).toBe('0')
    expect(vestedScheduleShares({ ...input, asOf: month(4) }).vested).toBe('300')
  })

  it('stops accrual at termination and reports no next vest date', () => {
    expect(vestedScheduleShares(fourYear({ asOf: month(30), terminatedAt: month(18) }))).toEqual({
      vested: '1800', unvested: '3000', nextVestDate: null,
    })
    // A future termination caps the next vest date search.
    expect(vestedScheduleShares(fourYear({ asOf: month(18), terminatedAt: isoPlusDays(month(19), -1) })).nextVestDate)
      .toBeNull()
  })
})

describe('vestedScheduleShares: pauses', () => {
  // 4-year monthly, 1-year cliff, 61-day leave (2026-03-01 to 2026-05-01 exclusive).
  const paused = fourYear({ shares: '48000', pauses: [{ start: '2026-03-01', end: '2026-05-01' }] })

  it('moves the cliff date later by the pause length', () => {
    expect(isoPlusDays('2027-01-15', 61)).toBe('2027-03-17')
    expect(vestedScheduleShares({ ...paused, asOf: '2027-01-15' })).toEqual({
      vested: '0', unvested: '48000', nextVestDate: '2027-03-17',
    })
    expect(vestedScheduleShares({ ...paused, asOf: '2027-03-16' }).vested).toBe('0')
    expect(vestedScheduleShares({ ...paused, asOf: '2027-03-17' }).vested).toBe('12000')
    expect(vestedScheduleShares({ ...paused, asOf: '2030-01-15' }).vested).toBe('46000')
    expect(vestedScheduleShares({ ...paused, asOf: isoPlusDays('2030-01-15', 61) }).vested).toBe('48000')
  })

  it('shifts tranche dates and ignores pauses before vesting starts', () => {
    const tranches: VestedScheduleInput = {
      shares: '1000', start: '2026-01-01', asOf: '2026-06-01',
      tranches: [{ date: '2026-06-01', shares: '250' }, { date: '2027-06-01', shares: '250' }],
    }
    expect(vestedScheduleShares(tranches)).toEqual({ vested: '250', unvested: '750', nextVestDate: '2027-06-01' })
    const withLeave = { ...tranches, pauses: [{ start: '2025-01-01', end: '2025-12-01' }, { start: '2026-05-01', end: '2026-05-11' }] }
    expect(vestedScheduleShares(withLeave)).toEqual({ vested: '0', unvested: '1000', nextVestDate: '2026-06-11' })
    expect(vestedScheduleShares({ ...withLeave, asOf: '2026-06-11' }).vested).toBe('250')
  })
})

describe('vestedScheduleShares: tranches and milestones', () => {
  it('counts milestones achieved on or before termination only', () => {
    const input: VestedScheduleInput = {
      shares: '1000', start: '2026-01-01', asOf: '2026-12-01', terminatedAt: '2026-06-01',
      milestones: [{ id: 'launch', shares: '500' }, { id: 'revenue', shares: '500' }],
      achievedMilestones: [{ id: 'launch', date: '2026-03-01' }, { id: 'revenue', date: '2026-09-01' }],
    }
    expect(vestedScheduleShares(input)).toEqual({ vested: '500', unvested: '500', nextVestDate: null })
    expect(vestedScheduleShares({ ...input, terminatedAt: undefined }).vested).toBe('1000')
    expect(vestedScheduleShares({ ...input, terminatedAt: undefined, asOf: '2026-02-28' })).toEqual({
      vested: '0', unvested: '1000', nextVestDate: '2026-03-01',
    })
  })

  it('returns no next vest date when only unachieved milestones remain', () => {
    expect(vestedScheduleShares({
      shares: '100', start: '2026-01-01', asOf: '2026-02-01', milestones: [{ id: 'm', shares: '100' }],
    })).toEqual({ vested: '0', unvested: '100', nextVestDate: null })
  })

  it('runs the periodic schedule on the grant less milestone shares', () => {
    const input: VestedScheduleInput = {
      shares: '1000', start: '2026-01-01', months: 10, asOf: addMonthsClamped('2026-01-01', 5),
      milestones: [{ id: 'm', shares: '500' }],
    }
    expect(vestedScheduleShares(input).vested).toBe('250')
    expect(vestedScheduleShares({ ...input, achievedMilestones: [{ id: 'm', date: '2026-01-02' }] }).vested).toBe('750')
  })

  it('leaves unscheduled tranche remainder unvested', () => {
    expect(vestedScheduleShares({
      shares: '1000', start: '2026-01-01', asOf: '2030-01-01', tranches: [{ date: '2026-02-01', shares: '400' }],
    })).toEqual({ vested: '400', unvested: '600', nextVestDate: null })
  })
})

describe('vestedScheduleShares: acceleration', () => {
  it('single trigger: 100% of unvested shares vest on the sale date', () => {
    const input = fourYear({ asOf: month(20), accelerations: [{ date: month(20), pct: 100 }] })
    expect(vestedScheduleShares(input)).toEqual({ vested: '4800', unvested: '0', nextVestDate: null })
    expect(vestedScheduleShares({ ...input, asOf: isoPlusDays(month(20), -1) })).toEqual({
      vested: '1900', unvested: '2900', nextVestDate: month(20),
    })
  })

  it('double trigger: 50% of unvested shares vest at termination after a sale', () => {
    const input: VestedScheduleInput = {
      shares: '48000', start: '2026-01-01', months: 48, cliffMonths: 12,
      terminatedAt: '2027-07-01', asOf: '2028-07-01', accelerations: [{ date: '2027-07-01', pct: 50 }],
    }
    // 18 months vested = 18000; unvested 30000 × 50% = 15000 accelerated.
    expect(vestedScheduleShares(input)).toEqual({ vested: '33000', unvested: '15000', nextVestDate: null })
    // An acceleration dated after termination does not count.
    expect(vestedScheduleShares({ ...input, accelerations: [{ date: '2027-07-02', pct: 50 }] }).vested).toBe('18000')
  })

  it('takes accelerated shares from the end of the schedule and floors exact percentage ratios', () => {
    const input = fourYear({ cliffMonths: 0, accelerations: [{ date: month(12), pct: 25 }] })
    // Month 12: 1200 vested, 3600 unvested × 25% = 900.
    expect(vestedScheduleShares({ ...input, asOf: month(24) }).vested).toBe('3300')
    // Month 39: 3900 + 900 reaches the grant, nine months before the schedule ends.
    expect(vestedScheduleShares({ ...input, asOf: month(38) })).toEqual({
      vested: '4700', unvested: '100', nextVestDate: month(39),
    })
    expect(vestedScheduleShares({ ...input, asOf: month(39) })).toEqual({ vested: '4800', unvested: '0', nextVestDate: null })
    // 3600 × 33.3333% = 1199.99988 floors to 1199.
    expect(vestedScheduleShares({ ...input, accelerations: [{ date: month(12), pct: 33.3333 }], asOf: month(12) }).vested)
      .toBe('2399')
  })

  it('applies successive accelerations to the shares unvested at each date', () => {
    const input: VestedScheduleInput = {
      shares: '1000', start: '2026-01-01', asOf: '2026-12-01', milestones: [{ id: 'm', shares: '1000' }],
      accelerations: [{ date: '2026-06-01', pct: 50 }, { date: '2026-03-01', pct: 10 }],
    }
    // 2026-03-01: 1000 × 10% = 100; 2026-06-01: 900 × 50% = 450.
    expect(vestedScheduleShares(input).vested).toBe('550')
  })
})

describe('vestedScheduleShares: validation', () => {
  const bad: [string, Partial<VestedScheduleInput>][] = [
    ['months and tranches together', { tranches: [{ date: '2026-06-01', shares: '1' }] }],
    ['unsupported frequency', { frequencyMonths: 2 }],
    ['months not a multiple of the frequency', { months: 10, frequencyMonths: 3, cliffMonths: 0 }],
    ['cliff beyond duration', { cliffMonths: 49 }],
    ['invalid calendar date', { asOf: '2026-02-30' }],
    ['malformed share count', { shares: '1.5' }],
    ['pause ending before it starts', { pauses: [{ start: '2026-05-01', end: '2026-05-01' }] }],
    ['overlapping pauses', { pauses: [{ start: '2026-03-01', end: '2026-05-01' }, { start: '2026-04-01', end: '2026-06-01' }] }],
    ['zero acceleration', { accelerations: [{ date: '2026-06-01', pct: 0 }] }],
    ['acceleration above 100%', { accelerations: [{ date: '2026-06-01', pct: 100.5 }] }],
    ['acceleration with five decimals', { accelerations: [{ date: '2026-06-01', pct: 12.34567 }] }],
    ['milestones exceeding the grant', { milestones: [{ id: 'm', shares: '4801' }] }],
    ['unknown achieved milestone', { achievedMilestones: [{ id: 'nope', date: '2026-06-01' }] }],
    ['duplicate milestone ids', { milestones: [{ id: 'm', shares: '1' }, { id: 'm', shares: '1' }] }],
  ]
  it.each(bad)('rejects %s with a RangeError', (_label, overrides) => {
    expect(() => vestedScheduleShares(fourYear(overrides))).toThrow(RangeError)
  })

  it('rejects tranche totals above the grant and missing input', () => {
    expect(() => vestedScheduleShares({
      shares: '10', start: '2026-01-01', asOf: '2026-01-01', tranches: [{ date: '2026-02-01', shares: '11' }],
    })).toThrow(RangeError)
    expect(() => (vestedScheduleShares as (...a: unknown[]) => unknown)()).toThrow(/vestedScheduleShares: input/)
  })
})

describe('noteAccruedInterest', () => {
  it('replays the New York Fed actual/360 example: (1)(1 + 1.80% × 1/360) = 1.00005000', () => {
    expect(noteAccruedInterest({ principal: '1', ratePct: 1.8, start: '2018-04-02', asOf: '2018-04-03', dayCount: 'actual_360' }))
      .toEqual({ days: 1, interest: '0.000050000000000000', total: '1.000050000000000000' })
  })

  it('replays every FINRA Rule 11620(b) 30/360 day-count example', () => {
    const examples: [string, string, number][] = [
      ['2026-04-01', '2026-04-30', 29], // 1st to 30th of the same month
      ['2026-03-01', '2026-03-31', 30], // 1st to 31st of the same month
      ['2026-03-01', '2026-04-01', 30], // 1st to 1st of the following month
      ['2026-02-01', '2026-02-28', 27], // 1st to 28th of February
      ['2026-02-23', '2026-03-03', 10], // 23rd of February to 3rd of March
      ['2026-05-15', '2026-06-06', 21], // 15th of May to 6th of June
      ['2026-04-30', '2026-05-01', 1], // 30th to 1st of the following month
      ['2026-03-31', '2026-04-01', 1], // 31st to 1st of the following month
      ['2026-04-30', '2026-05-30', 30], // 30th to 30th of the following month
      ['2026-03-31', '2026-04-30', 30], // 31st to 30th of the following month
      ['2026-04-30', '2026-05-31', 30], // 30th to 31st of the following month
      ['2026-07-31', '2026-08-31', 30], // 31st to 31st of the following month
      ['2026-04-30', '2026-06-01', 31], // 30th to 1st of second following month: 1 month, 1 day
      ['2026-03-31', '2026-05-01', 31], // 31st to 1st of second following month
    ]
    for (const [start, asOf, days] of examples) {
      expect(noteAccruedInterest({ principal: '360000', ratePct: 10, start, asOf, dayCount: '30_360' }), `${start}..${asOf}`)
        .toEqual({ days, interest: (days * 100).toFixed(18), total: (360000 + days * 100).toFixed(18) })
    }
  })

  it('accrues simple actual/365 interest (hand-checked: 1,000,000 × 5% × 181/365)', () => {
    expect(noteAccruedInterest({ principal: '1000000', ratePct: 5, start: '2026-01-01', asOf: '2026-07-01' })).toEqual({
      days: 181, interest: '24794.520547945205479452', total: '1024794.520547945205479452',
    })
  })

  it('accrues simple actual/360 interest and stops at maturity when asked', () => {
    // 2026-01-01 to 2026-05-31 is 150 days; 250,000 × 6% × 150/360 = 6,250.
    const input = { principal: '250000', ratePct: 6, start: '2026-01-01', asOf: '2027-01-01', dayCount: 'actual_360' as const,
      maturityDate: '2026-05-31' }
    expect(noteAccruedInterest({ ...input, stopAtMaturity: true }))
      .toEqual({ days: 150, interest: '6250.000000000000000000', total: '256250.000000000000000000' })
    expect(noteAccruedInterest(input).days).toBe(365)
  })

  it('compounds annually on start anniversaries with a simple stub', () => {
    // 10,000 × 1.08² × (1 + 0.08 × 181/365) − 10,000 = 2,126.7252602739726...
    expect(noteAccruedInterest({ principal: '10000', ratePct: 8, start: '2024-01-15', asOf: '2026-07-15', compounding: 'annual' }))
      .toEqual({ days: 912, interest: '2126.725260273972602740', total: '12126.725260273972602740' })
    // 30/360 stub: 10,000 × 1.08² × (1 + 0.08 × 150/360) − 10,000 = 2,052.80.
    expect(noteAccruedInterest({ principal: '10000', ratePct: 8, start: '2024-01-15', asOf: '2026-06-15', compounding: 'annual', dayCount: '30_360' }))
      .toEqual({ days: 870, interest: '2052.800000000000000000', total: '12052.800000000000000000' })
    // Under one year, annual compounding equals simple interest.
    const simple = noteAccruedInterest({ principal: '10000', ratePct: 8, start: '2024-01-15', asOf: '2024-07-15' })
    expect(noteAccruedInterest({ principal: '10000', ratePct: 8, start: '2024-01-15', asOf: '2024-07-15', compounding: 'annual' }))
      .toEqual(simple)
  })

  it('returns zero before or on the start date and rejects invalid input', () => {
    expect(noteAccruedInterest({ principal: '0.5', ratePct: 5, start: '2026-01-01', asOf: '2025-12-31' }))
      .toEqual({ days: 0, interest: '0.000000000000000000', total: '0.500000000000000000' })
    const base = { principal: '100', ratePct: 5, start: '2026-01-01', asOf: '2026-06-01' }
    expect(() => noteAccruedInterest({ ...base, principal: '1e5' })).toThrow(RangeError)
    expect(() => noteAccruedInterest({ ...base, ratePct: 101 })).toThrow(RangeError)
    expect(() => noteAccruedInterest({ ...base, start: '2026-13-01' })).toThrow(RangeError)
    expect(() => noteAccruedInterest({ ...base, stopAtMaturity: true })).toThrow(RangeError)
    expect(() => noteAccruedInterest({ ...base, maturityDate: '2025-01-01' })).toThrow(RangeError)
    expect(() => noteAccruedInterest({ ...base, dayCount: 'actual_actual' as never })).toThrow(RangeError)
  })
})
