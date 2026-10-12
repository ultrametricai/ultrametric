import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CategoryData } from '@/lib/data'
import type { Category, Evidence, Product, Story, Verdict } from '@/lib/schemas'
import {
  arenaPipelineStats,
  isCellUntested,
  mostWantedUntested,
  nextUpArenas,
  sitePipelineTotals,
  untestedDemand,
} from '@/lib/testingPipeline'

const ev = (id: string, tier: Evidence['tier']): Evidence => ({
  id, tier, url: 'https://example.com', excerpt: 'x', fetchedAt: '2026-08-26T00:00:00.000Z',
})

const story = (id: string, weight: Story['weight'] = 1): Story => ({
  id, persona: 'dev', title: `As a dev, I can ${id}`, theme: 'core', group: 'core-basics', weight,
})

const v = (productId: string, storyId: string, verdict: Verdict['verdict'], evidenceIds: string[]): Verdict => ({
  productId, storyId, verdict, quality: verdict === 'full' ? 8 : 0,
  confidence: 'high', rationale: 'r', evidenceIds,
})

function makeData(id: string, products: Product[], stories: Story[], verdicts: Verdict[], popularity: CategoryData['popularity'] = {}): CategoryData {
  const category: Category = { id, name: id.toUpperCase(), description: 'd', personas: ['dev'] }
  return {
    category,
    products,
    stories,
    evidence: Object.fromEntries(products.map((p) => [p.id, [ev('probe-1', 'probe'), ev('docs-1', 'claimed-docs')]])),
    verdicts,
    rankings: { generatedAt: '2026-08-26T00:00:00.000Z', leaderboard: [], battles: [] },
    stacks: [],
    popularity,
    claims: {},
    uncertainty: [],
  vendorResponses: [],
  certifications: [],
  }
}

const product = (id: string): Product => ({
  id, name: id.toUpperCase(), vendor: 'v', type: 'oss', urls: { site: `https://${id}.example` },
})

describe('isCellUntested', () => {
  it('is true only for zero-evidence none/na', () => {
    expect(isCellUntested(v('p', 's', 'none', []))).toBe(true)
    expect(isCellUntested(v('p', 's', 'na', []))).toBe(true)
    expect(isCellUntested(v('p', 's', 'none', ['docs-1']))).toBe(false) // evidenced none = finding
    expect(isCellUntested(v('p', 's', 'full', ['docs-1']))).toBe(false)
  })
})

describe('arenaPipelineStats / sitePipelineTotals', () => {
  it('counts total, untested, and probed cells per arena', () => {
    const stories = [story('s1'), story('s2'), story('s3'), story('s4')]
    const data = makeData('cat', [product('p')], stories, [
      v('p', 's1', 'full', ['probe-1']), // probed
      v('p', 's2', 'full', ['docs-1']), // evidenced, not probed
      v('p', 's3', 'none', []), // untested
      v('p', 's4', 'na', []), // untested
    ])
    const stats = arenaPipelineStats(data)
    expect(stats.totalCells).toBe(4)
    expect(stats.untestedCells).toBe(2)
    expect(stats.untestedPct).toBe(50)
    expect(stats.probedCells).toBe(1)
    expect(stats.probedPct).toBe(25)

    const totals = sitePipelineTotals([stats, stats])
    expect(totals.arenas).toBe(2)
    expect(totals.totalCells).toBe(8)
    expect(totals.untestedCells).toBe(4)
    expect(totals.untestedPct).toBe(50)
  })
})

describe('mostWantedUntested', () => {
  it('ranks untested cells by weight × log-dampened stars and respects the limit', () => {
    const stories = [story('heavy', 3), story('light', 1)]
    const popular = makeData(
      'pop',
      [product('star')],
      stories,
      [v('star', 'heavy', 'none', []), v('star', 'light', 'none', [])],
      { star: { stars: 99990, fetchedAt: '2026-08-26T00:00:00.000Z' } },
    )
    const obscure = makeData(
      'obs',
      [product('dark')],
      stories,
      [v('dark', 'heavy', 'none', []), v('dark', 'light', 'full', ['docs-1'])],
    )
    const cells = mostWantedUntested([popular, obscure], 3)
    // star/heavy: 3*log10(100000)=15; dark/heavy: 3*log10(10)=3; star/light: 1*5=5.
    expect(cells.map((c) => `${c.productId}:${c.storyId}`)).toEqual([
      'star:heavy',
      'star:light',
      'dark:heavy',
    ])
    expect(cells[0].demand).toBeCloseTo(15, 3)
    // The evidenced cell (dark/light) never appears even with room in the limit.
    expect(cells.some((c) => c.productId === 'dark' && c.storyId === 'light')).toBe(false)
  })

  it('keeps no-signal products rankable by weight alone', () => {
    expect(untestedDemand(3, null)).toBeCloseTo(3)
    expect(untestedDemand(3, null)).toBeGreaterThan(untestedDemand(1, null))
  })

  it('caps entries per product so one popular product cannot fill the list', () => {
    const stories = [story('a', 3), story('b', 3), story('c', 3)]
    const data = makeData(
      'pop',
      [product('star'), product('dark')],
      stories,
      [
        v('star', 'a', 'none', []),
        v('star', 'b', 'none', []),
        v('star', 'c', 'none', []),
        v('dark', 'a', 'none', []),
        v('dark', 'b', 'full', ['docs-1']),
        v('dark', 'c', 'full', ['docs-1']),
      ],
      { star: { stars: 99990, fetchedAt: '2026-08-26T00:00:00.000Z' } },
    )
    const cells = mostWantedUntested([data], 10)
    expect(cells.filter((c) => c.productId === 'star')).toHaveLength(2)
    expect(cells.filter((c) => c.productId === 'dark')).toHaveLength(1)
  })
})

describe('nextUpArenas (committed rankings/arena-roadmap.json)', () => {
  const REAL = path.resolve(__dirname, '../../rankings')

  it('returns only tier-1 planned entries that are not already live', () => {
    const live = new Set(['agent-frameworks', 'agent-sandboxes', 'team-chat'])
    const next = nextUpArenas(live, REAL)
    expect(next.length).toBeGreaterThan(0)
    for (const entry of next) {
      expect(entry.tier).toBe(1)
      expect(entry.status).toBe('planned')
      expect(live.has(entry.id)).toBe(false)
    }
    // The roadmap file lags reality: these are live arenas still marked planned there.
    expect(next.some((e) => e.id === 'agent-frameworks')).toBe(false)
  })
})
