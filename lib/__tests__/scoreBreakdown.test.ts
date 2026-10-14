import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import { buildScoreBreakdown, type DimensionKey } from '@/lib/scoreBreakdown'
import type { LeaderboardEntry } from '@/lib/schemas'

// The /score page IS the determinism proof: every number it prints must recompute, from the
// printed pieces alone, into exactly the published rankings.json entry. These tests replay that
// reader's arithmetic over real arena data — cell points → dimension fractions → the Overall-score blend —
// so any drift between lib/scoreBreakdown.ts's story selectors and lib/scoring.ts's
// buildRankings (or any silent rankings.json regeneration change) fails the suite.

const REAL = path.resolve(__dirname, '../../open-rankings')

const round1 = (n: number) => Math.round(n * 10) / 10

// What the published leaderboard entry says each dimension scored — the numbers the /score
// page's per-section totals must land on.
const published = (entry: LeaderboardEntry): Record<DimensionKey, number | null> => ({
  agentReady: entry.agentReady,
  apiQuality: entry.apiQuality,
  openness: entry.themeScores['openness'] ?? null,
  agenticApp: entry.agenticApp,
  automation: entry.themeScores['automation-depth'] ?? null,
})

function checkProduct(categoryId: string, productId: string) {
  const data = loadCategory(categoryId, REAL)
  const entry = data.rankings.leaderboard.find((e) => e.productId === productId)
  expect(entry, `${categoryId}:${productId} missing from leaderboard`).toBeDefined()
  const breakdown = buildScoreBreakdown(data, productId)

  for (const dim of breakdown.dimensions) {
    // Each dimension section's total equals the published component score…
    expect(dim.score, `${productId} ${dim.key} vs published`).toBe(published(entry!)[dim.key])
    // …and is reproducible from the printed cell arithmetic alone: Σ points ÷ Σ max × 100 over
    // the non-na cells (the exact fraction the page's footer line shows).
    if (dim.score !== null) {
      expect(round1((dim.numerator / dim.denominator) * 100)).toBe(dim.score)
      const applicable = dim.cells.filter((c) => c.verdict.verdict !== 'na')
      expect(dim.numerator).toBeCloseTo(applicable.reduce((s, c) => s + c.points, 0), 6)
      expect(dim.denominator).toBe(applicable.reduce((s, c) => s + c.max, 0))
      // Every scored cell's points line is the product of the three printed factors.
      for (const c of applicable) {
        expect(c.points).toBeCloseTo(c.story.weight * c.verdict.quality * c.factor, 6)
      }
    }
  }

  // The blend equation at the top of the page: Overall = Σ(score×weight) ÷ Σ(weight) over the
  // non-null terms — recomputed from the displayed components, it must equal rankings.json's
  // published aiEra (0.05 tolerance per the transparency spec; in practice it's exact).
  const live = breakdown.blend.terms.filter((t) => t.score !== null)
  if (entry!.aiEra === null) {
    expect(live).toHaveLength(0)
    expect(breakdown.blend.aiEra).toBeNull()
  } else {
    const weightedSum = live.reduce((s, t) => s + t.score! * t.weight, 0)
    const totalWeight = live.reduce((s, t) => s + t.weight, 0)
    expect(weightedSum).toBeCloseTo(breakdown.blend.weightedSum, 6)
    expect(totalWeight).toBeCloseTo(breakdown.blend.totalWeight, 6)
    expect(Math.abs(round1(weightedSum / totalWeight) - entry!.aiEra!)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(breakdown.blend.aiEra! - entry!.aiEra!)).toBeLessThanOrEqual(0.05)
  }
}

describe('buildScoreBreakdown reproduces rankings.json', () => {
  it('stripe (payments) — the worked example on the /score page', () => {
    checkProduct('payments', 'stripe')
  })

  it('every payments product — the whole arena stays reproducible', () => {
    const data = loadCategory('payments', REAL)
    for (const p of data.products) checkProduct('payments', p.id)
  })

  it('a second arena (ai-coding), first and last on the leaderboard', () => {
    const data = loadCategory('ai-coding', REAL)
    const board = data.rankings.leaderboard
    checkProduct('ai-coding', board[0].productId)
    checkProduct('ai-coding', board[board.length - 1].productId)
  })
})
