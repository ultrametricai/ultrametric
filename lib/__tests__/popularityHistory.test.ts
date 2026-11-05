import { describe, expect, it } from 'vitest'
import { parsePopularityHistoryJsonl, popularitySeries, type PopularityHistoryLine } from '@/lib/popularityHistory'

function line(overrides: Partial<PopularityHistoryLine>): PopularityHistoryLine {
  return { productId: 'p', fetchedAt: '2026-09-02T00:00:00Z', runAt: '2026-09-02T00:00:00Z', ...overrides }
}

describe('parsePopularityHistoryJsonl', () => {
  it('parses one line per snapshot, tolerating blank lines and the trailing newline', () => {
    const text =
      '{"productId":"codex","stars":120968,"starsPerYear":87030.2,"fetchedAt":"2026-09-02T21:57:35.864Z","runAt":"2026-09-02T21:57:35.864Z"}\n' +
      '\n' +
      '{"productId":"codex","npmWeekly":1200,"fetchedAt":"2026-09-04T00:00:00Z","runAt":"2026-09-04T00:00:00Z"}\n'
    expect(parsePopularityHistoryJsonl(text)).toEqual([
      { productId: 'codex', stars: 120968, starsPerYear: 87030.2, fetchedAt: '2026-09-02T21:57:35.864Z', runAt: '2026-09-02T21:57:35.864Z' },
      { productId: 'codex', npmWeekly: 1200, fetchedAt: '2026-09-04T00:00:00Z', runAt: '2026-09-04T00:00:00Z' },
    ])
  })

  it('rejects malformed lines loudly (the file is machine-written only)', () => {
    expect(() => parsePopularityHistoryJsonl('{"productId":"a"}\n')).toThrow()
  })
})

describe('popularitySeries', () => {
  it('keeps cached stars at their measurement date while downloads advance', () => {
    const old = '2026-09-02T00:00:00Z'
    const fresh = '2026-09-09T00:00:00Z'
    const lines = [
      line({ stars: 100, npmWeekly: 800, fetchedAt: old }),
      line({ stars: 100, npmWeekly: 900, fetchedAt: fresh, githubFetchedAt: old, npmFetchedAt: fresh }),
    ]
    expect(popularitySeries(lines, 'stars')).toEqual([{ date: old, value: 100 }])
    expect(popularitySeries(lines, 'npmWeekly')).toEqual([{ date: old, value: 800 }, { date: fresh, value: 900 }])
    expect(popularitySeries([line({ pypiWeekly: 42, pypiFetchedAt: old, fetchedAt: fresh })], 'pypiWeekly'))
      .toEqual([{ date: old, value: 42 }])
  })

  it('collapses repeated appends of the same fetch (cache hits share fetchedAt) into one point', () => {
    const lines = [
      line({ stars: 100, fetchedAt: '2026-09-02T00:00:00Z', runAt: '2026-09-02T00:00:00Z' }),
      line({ stars: 100, fetchedAt: '2026-09-02T00:00:00Z', runAt: '2026-09-04T00:00:00Z' }),
      line({ stars: 130, fetchedAt: '2026-09-09T00:00:00Z', runAt: '2026-09-09T00:00:00Z' }),
    ]
    expect(popularitySeries(lines, 'stars')).toEqual([
      { date: '2026-09-02T00:00:00Z', value: 100 },
      { date: '2026-09-09T00:00:00Z', value: 130 },
    ])
  })

  it('drops lines without the requested metric and sorts by fetchedAt', () => {
    const lines = [
      line({ npmWeekly: 900, fetchedAt: '2026-09-09T00:00:00Z' }),
      line({ stars: 5, fetchedAt: '2026-09-01T00:00:00Z' }),
      line({ npmWeekly: 800, fetchedAt: '2026-09-02T00:00:00Z' }),
    ]
    expect(popularitySeries(lines, 'npmWeekly')).toEqual([
      { date: '2026-09-02T00:00:00Z', value: 800 },
      { date: '2026-09-09T00:00:00Z', value: 900 },
    ])
    expect(popularitySeries(lines, 'pypiWeekly')).toEqual([])
  })
})
