import { describe, expect, it } from 'vitest'
import {
  CuratedHotSchema,
  dedupeByProduct,
  HOT_MIN_STAR_DELTA,
  hotGrowthThreshold,
  mergeHot,
  rankByInstalls,
  rankByStars,
  starGrowth,
  trackedHot,
  weeklyInstalls,
  youngRocket,
  type HotFlag,
  type PopularEntry,
  type StarGrowth,
} from '@/lib/popularRanking'

const growth = (over: Partial<StarGrowth>): StarGrowth => ({ delta: 500, days: 8, perDay: 62.5, relPerDay: 0.002, ...over })

const entry = (over: Partial<PopularEntry> & { productId: string }): PopularEntry => ({
  name: over.productId,
  arenaId: 'a',
  arenaName: 'Arena',
  oss: true,
  ...over,
})

describe('starGrowth', () => {
  it('computes delta, window, and relative daily growth over the full tracked window', () => {
    const g = starGrowth([
      { date: '2026-09-02T00:00:00Z', value: 10_000 },
      { date: '2026-09-06T00:00:00Z', value: 10_400 },
      { date: '2026-09-10T00:00:00Z', value: 11_000 },
    ])
    expect(g).toBeDefined()
    expect(g!.delta).toBe(1_000)
    expect(g!.days).toBe(8)
    expect(g!.perDay).toBe(125)
    expect(g!.relPerDay).toBeCloseTo(0.0125, 5)
  })

  it('returns undefined for fewer than two points (no window at all)', () => {
    expect(starGrowth([])).toBeUndefined()
    expect(starGrowth([{ date: '2026-09-02T00:00:00Z', value: 5 }])).toBeUndefined()
  })

  it('returns undefined for a window shorter than the minimum (sub-3-day rates are fetch noise)', () => {
    const g = starGrowth([
      { date: '2026-09-02T00:00:00Z', value: 1_000 },
      { date: '2026-09-02T06:00:00Z', value: 1_050 },
    ])
    expect(g).toBeUndefined()
  })

  it('guards the relative rate against a zero starting count', () => {
    const g = starGrowth([
      { date: '2026-09-02T00:00:00Z', value: 0 },
      { date: '2026-09-12T00:00:00Z', value: 100 },
    ])
    expect(g!.relPerDay).toBe(10) // divided by max(0, 1) = 1, never Infinity
  })
})

describe('hotGrowthThreshold', () => {
  it('returns null for a fleet too small to call a distribution', () => {
    expect(hotGrowthThreshold([growth({}), growth({}), growth({}), growth({})])).toBeNull()
  })

  it('returns null when nothing in the fleet grew (a 0 threshold would flag noise)', () => {
    const flat = Array.from({ length: 10 }, () => growth({ relPerDay: 0 }))
    expect(hotGrowthThreshold(flat)).toBeNull()
  })

  it('returns the top-decile relative growth rate', () => {
    // 10 rates 0.001..0.010 — the 90th percentile cut (ceil(0.9*10)-1 = index 8, sorted asc) is 0.009.
    const fleet = Array.from({ length: 10 }, (_, i) => growth({ relPerDay: (i + 1) / 1000 }))
    expect(hotGrowthThreshold(fleet)).toBeCloseTo(0.009, 10)
  })
})

describe('trackedHot', () => {
  it('flags top-decile growth above the absolute floor, with the measured reason string', () => {
    const flag = trackedHot(growth({ delta: 2_120, days: 7.9, relPerDay: 0.00222 }), 0.002)
    expect(flag).toEqual({ reason: '★ +2.1k in 8 days', source: 'tracked' })
  })

  it('never flags below the absolute star floor, however fast the relative growth', () => {
    expect(trackedHot(growth({ delta: HOT_MIN_STAR_DELTA - 1, relPerDay: 99 }), 0.001)).toBeUndefined()
  })

  it('never flags below the fleet threshold', () => {
    expect(trackedHot(growth({ delta: 5_000, relPerDay: 0.001 }), 0.002)).toBeUndefined()
  })
})

describe('youngRocket', () => {
  it('flags a very young repo with a big star count (buzz: 32.5k stars, ~6-month-old repo)', () => {
    // Real committed numbers from open-rankings/team-chat/popularity.json — the founder's canonical case,
    // and it must trigger MECHANICALLY (stars ÷ starsPerYear = repo age, no history needed).
    const flag = youngRocket({ stars: 32_528, starsPerYear: 63_222.567678913474 })
    expect(flag).toEqual({ reason: '★ 32.5k in ~6 months (repo age)', source: 'young' })
  })

  it('does not flag an old repo with huge velocity-by-accumulation', () => {
    // 100k stars over 5 years: starsPerYear 20k, but age = 5y — established, not exploding.
    expect(youngRocket({ stars: 100_000, starsPerYear: 20_000 })).toBeUndefined()
  })

  it('does not flag a young repo below the star floor', () => {
    // codex-plugins: 5.4k stars at ~6 months — young, but not a rocket yet.
    expect(youngRocket({ stars: 5_435, starsPerYear: 10_667 })).toBeUndefined()
  })

  it('returns undefined when either counter is missing (absent, never zero)', () => {
    expect(youngRocket({ stars: 50_000 })).toBeUndefined()
    expect(youngRocket({ starsPerYear: 50_000 })).toBeUndefined()
    expect(youngRocket({})).toBeUndefined()
  })
})

describe('mergeHot', () => {
  const tracked: HotFlag = { reason: '★ +2.1k in 8 days', source: 'tracked' }

  it('lets a mechanical flag win over a curated one for the same product', () => {
    const merged = mergeHot(new Map([['codex', tracked]]), [{ productId: 'codex', reason: 'buzz on X' }])
    expect(merged.get('codex')).toEqual(tracked)
  })

  it('fills gaps the data cannot see with the curated reason', () => {
    const merged = mergeHot(new Map([['codex', tracked]]), [{ productId: 'newthing', reason: 'launched last week, front page everywhere' }])
    expect(merged.get('newthing')).toEqual({ reason: 'launched last week, front page everywhere', source: 'curated' })
    expect(merged.size).toBe(2)
  })
})

describe('CuratedHotSchema', () => {
  it('requires a concrete reason on every curated entry', () => {
    expect(() => CuratedHotSchema.parse({ hot: [{ productId: 'x', reason: '' }] })).toThrow()
    expect(() => CuratedHotSchema.parse({ hot: [{ productId: 'x' }] })).toThrow()
    expect(CuratedHotSchema.parse({ hot: [] }).hot).toEqual([])
  })
})

describe('weeklyInstalls', () => {
  it('sums npm and PyPI (same unit, honest total)', () => {
    expect(weeklyInstalls({ npmWeekly: 100, pypiWeekly: 50 })).toBe(150)
    expect(weeklyInstalls({ npmWeekly: 100 })).toBe(100)
    expect(weeklyInstalls({ pypiWeekly: 50 })).toBe(50)
  })

  it('is undefined when neither registry was measured (never zero)', () => {
    expect(weeklyInstalls({})).toBeUndefined()
  })
})

describe('dedupeByProduct', () => {
  it('keeps one line per product, preferring the best-measured record', () => {
    const rows = dedupeByProduct([
      entry({ productId: 'x', arenaId: 'a', stars: 100 }),
      entry({ productId: 'x', arenaId: 'b', stars: 120 }),
      entry({ productId: 'y', arenaId: 'a', npmWeekly: 10 }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.productId === 'x')!.arenaId).toBe('b')
  })

  it('breaks a star tie by installs', () => {
    const rows = dedupeByProduct([
      entry({ productId: 'x', arenaId: 'a', stars: 100 }),
      entry({ productId: 'x', arenaId: 'b', stars: 100, npmWeekly: 5 }),
    ])
    expect(rows[0].arenaId).toBe('b')
  })
})

describe('rankByStars', () => {
  it('ranks only star-measured entries, by absolute stars, tie-broken by velocity', () => {
    const ranked = rankByStars([
      entry({ productId: 'no-repo' }), // unmeasured — absent from the segment, not zero
      entry({ productId: 'small', stars: 10 }),
      entry({ productId: 'big-slow', stars: 500, starsPerYear: 50 }),
      entry({ productId: 'big-fast', stars: 500, starsPerYear: 400 }),
    ])
    expect(ranked.map((r) => r.productId)).toEqual(['big-fast', 'big-slow', 'small'])
  })
})

describe('rankByInstalls', () => {
  it('ranks only install-measured entries, by combined weekly downloads', () => {
    const ranked = rankByInstalls([
      entry({ productId: 'stars-only', stars: 9_999 }), // stars never leak into the installs segment
      entry({ productId: 'npm', npmWeekly: 300 }),
      entry({ productId: 'both', npmWeekly: 200, pypiWeekly: 150 }),
      entry({ productId: 'pypi', pypiWeekly: 100 }),
    ])
    expect(ranked.map((r) => r.productId)).toEqual(['both', 'npm', 'pypi'])
  })
})
