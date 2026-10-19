import { describe, expect, it } from 'vitest'
import { buildHistoryLines, snapshotEntries } from '../scripts/build-score-history'

// Real shape of a pre-Arena-Score-era rankings.json (see e.g. commit 98854cd's
// open-rankings/desktop-os/rankings.json): leaderboard entries have score/agenticness but no
// aiEra/agentReady fields at all.
const OLD_ERA_SNAPSHOT = {
  generatedAt: '2026-08-27T23:12:56.681Z',
  leaderboard: [
    { productId: 'omarchy', score: 26.3, agenticness: 3.8, applicable: 55, total: 57, themeScores: {} },
    { productId: 'ubuntu', score: 15.3, agenticness: 0, applicable: 56, total: 57, themeScores: {} },
  ],
}

const NEW_ERA_SNAPSHOT = {
  generatedAt: '2026-09-01T12:00:00.000Z',
  leaderboard: [
    { productId: 'omarchy', score: 26.3, aiEra: 41.27, agentReady: 38, applicable: 55, total: 57, themeScores: {} },
    { productId: 'ubuntu', score: 15.3, aiEra: null, agentReady: null, applicable: 56, total: 57, themeScores: {} },
  ],
}

describe('snapshotEntries', () => {
  it('skips pre-Arena-Score-era snapshots entirely (missing field ≠ null)', () => {
    expect(snapshotEntries(OLD_ERA_SNAPSHOT)).toEqual([])
  })

  it('extracts productId/aiEra/agentReady, rounding to 1 decimal and keeping explicit nulls', () => {
    expect(snapshotEntries(NEW_ERA_SNAPSHOT)).toEqual([
      { productId: 'omarchy', aiEra: 41.3, agentReady: 38 },
      { productId: 'ubuntu', aiEra: null, agentReady: null },
    ])
  })

  it('returns [] for unrecognizable input instead of throwing', () => {
    expect(snapshotEntries(null)).toEqual([])
    expect(snapshotEntries('nope')).toEqual([])
    expect(snapshotEntries({ leaderboard: 'nope' })).toEqual([])
    expect(snapshotEntries({ leaderboard: [{ aiEra: 5 }] })).toEqual([]) // no productId
  })
})

describe('buildHistoryLines', () => {
  it('emits first appearance, dedupes consecutive identical values, records changes', () => {
    const lines = buildHistoryLines([
      { date: '2026-09-01T00:00:00Z', entries: [{ productId: 'a', aiEra: 41.3, agentReady: 38 }] },
      // identical → deduped
      { date: '2026-09-02T00:00:00Z', entries: [{ productId: 'a', aiEra: 41.3, agentReady: 38 }] },
      // agentReady moved → new line; product b first appears → new line
      {
        date: '2026-09-03T00:00:00Z',
        entries: [
          { productId: 'a', aiEra: 41.3, agentReady: 40 },
          { productId: 'b', aiEra: null, agentReady: null },
        ],
      },
    ])
    expect(lines).toEqual([
      { productId: 'a', date: '2026-09-01T00:00:00Z', aiEra: 41.3, agentReady: 38 },
      { productId: 'a', date: '2026-09-03T00:00:00Z', aiEra: 41.3, agentReady: 40 },
      { productId: 'b', date: '2026-09-03T00:00:00Z', aiEra: null, agentReady: null },
    ])
  })

  it('dedupes across a product missing from an intermediate snapshot (last value carries forward)', () => {
    const lines = buildHistoryLines([
      { date: '2026-09-01T00:00:00Z', entries: [{ productId: 'a', aiEra: 41.3, agentReady: 38 }] },
      { date: '2026-09-02T00:00:00Z', entries: [] },
      { date: '2026-09-03T00:00:00Z', entries: [{ productId: 'a', aiEra: 41.3, agentReady: 38 }] },
    ])
    expect(lines).toHaveLength(1)
  })
})
