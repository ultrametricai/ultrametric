import { describe, expect, it } from 'vitest'
import { belowCompactStarsFloor, COMPACT_STARS_FLOOR, daysSincePush, formatCompact, hasSignal, starsPerYear } from '@/lib/popularity'

describe('starsPerYear', () => {
  it('divides stars by years since creation', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    // Exactly 2 years old.
    const result = starsPerYear(20_000, '2024-01-01T00:00:00Z', now)
    expect(result).toBeGreaterThan(9_900)
    expect(result).toBeLessThan(10_100)
  })

  it('returns undefined for a repo created only days ago (avoids a divide-by-~0 spike)', () => {
    const now = new Date('2026-01-10T00:00:00Z')
    expect(starsPerYear(50, '2026-01-01T00:00:00Z', now)).toBeUndefined()
  })

  it('returns undefined for an invalid created_at', () => {
    expect(starsPerYear(100, 'not-a-date')).toBeUndefined()
  })
})

describe('daysSincePush', () => {
  it('computes whole days between pushed_at and now', () => {
    const now = new Date('2026-01-11T00:00:00Z')
    expect(daysSincePush('2026-01-01T00:00:00Z', now)).toBe(10)
  })

  it('never returns negative days (clock skew / pushed "in the future")', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(daysSincePush('2026-01-05T00:00:00Z', now)).toBe(0)
  })

  it('returns undefined for an invalid pushed_at', () => {
    expect(daysSincePush('garbage')).toBeUndefined()
  })
})

describe('formatCompact', () => {
  it('formats sub-1000 numbers as-is', () => {
    expect(formatCompact(842)).toBe('842')
  })

  it('formats thousands with one decimal, trimming a trailing .0', () => {
    expect(formatCompact(12_400)).toBe('12.4k')
    expect(formatCompact(2_000)).toBe('2k')
  })

  it('formats millions with one decimal', () => {
    expect(formatCompact(2_300_000)).toBe('2.3M')
  })

  it('preserves sign for negative input', () => {
    expect(formatCompact(-1_500)).toBe('-1.5k')
  })
})

describe('belowCompactStarsFloor (founder 2026-10-02, the ByteAsk case)', () => {
  it('flags a stars-only record under the floor', () => {
    expect(belowCompactStarsFloor({ stars: 24, starsPerYear: 89.099, fetchedAt: '2026-09-25T18:15:55.776Z' })).toBe(true)
  })

  it('keeps records at/above the floor, or with any npm signal', () => {
    expect(belowCompactStarsFloor({ stars: COMPACT_STARS_FLOOR, fetchedAt: '2026-09-25T00:00:00.000Z' })).toBe(false)
    expect(belowCompactStarsFloor({ stars: 24, npmWeekly: 5_000, fetchedAt: '2026-09-25T00:00:00.000Z' })).toBe(false)
  })
})

describe('hasSignal', () => {
  it('is false for undefined', () => {
    expect(hasSignal(undefined)).toBe(false)
  })

  it('is false for a fetch attempt with nothing found', () => {
    expect(hasSignal({ fetchedAt: '2026-08-26T00:00:00.000Z' })).toBe(false)
  })

  it('is true when any signal field is present', () => {
    expect(hasSignal({ stars: 10, fetchedAt: '2026-08-26T00:00:00.000Z' })).toBe(true)
    expect(hasSignal({ npmWeekly: 10, fetchedAt: '2026-08-26T00:00:00.000Z' })).toBe(true)
  })
})
