import { describe, expect, it } from 'vitest'
import { adjacentProducts, domainThemes, findUltrametric, rivalsFor } from '@/lib/alternatives'
import type { CategoryData } from '@/lib/data-helpers'
import type { Rankings, Story } from '@/lib/schemas'

function story(id: string, theme: string, weight = 2): Story {
  return { id, persona: 'a developer', title: `As a developer, I can ${id.replace(/-/g, ' ')}`, theme, group: theme, weight }
}

function entry(productId: string, aiEra: number | null, score = 50) {
  return { productId, score, agentReady: aiEra, agenticApp: null, apiQuality: null, aiEra, applicable: 1, total: 1, themeScores: {} }
}

function arena(
  id: string,
  productIds: string[],
  stories: Story[],
  rankings: Partial<Rankings> = {},
): CategoryData {
  return {
    category: { id, name: id.toUpperCase(), description: '', personas: ['a developer'] },
    products: productIds.map((p) => ({
      id: p,
      name: p.toUpperCase(),
      vendor: 'v',
      type: 'oss' as const,
      urls: { site: `https://example.com/${p}` },
    })),
    stories,
    evidence: {},
    verdicts: [],
    rankings: { generatedAt: '2026-01-01T00:00:00.000Z', leaderboard: [], battles: [], ...rankings },
    stacks: [],
    popularity: {},
    claims: {},
    uncertainty: [],
  vendorResponses: [],
  certifications: [],
  }
}

// pay arena: x (the base product), r1 (#1), r2 (#3). Battles carry rounds with margins so
// rivalsFor can pick each rival's clearest wins over x.
const pay = arena(
  'pay',
  ['x', 'r1', 'r2'],
  [story('checkout', 'checkout-flows'), story('payouts', 'payout-speed'), story('refunds', 'checkout-flows')],
  {
    leaderboard: [entry('r1', 90), entry('x', 80), entry('r2', 70)],
    battles: [
      {
        a: 'x',
        b: 'r1',
        winner: 'r1',
        record: { aWins: 1, bWins: 2, draws: 0 },
        rounds: [
          { storyId: 'checkout', winner: 'b', margin: 4 },
          { storyId: 'payouts', winner: 'b', margin: 12 },
          { storyId: 'refunds', winner: 'b', margin: 8 },
        ],
      },
      {
        a: 'x',
        b: 'r2',
        winner: 'x',
        record: { aWins: 3, bWins: 0, draws: 0 },
        rounds: [
          { storyId: 'checkout', winner: 'a', margin: 5 },
          { storyId: 'payouts', winner: 'a', margin: 2 },
          { storyId: 'refunds', winner: 'draw', margin: 0 },
        ],
      },
      { a: 'r1', b: 'r2', winner: 'r1', record: { aWins: 1, bWins: 0, draws: 0 }, rounds: [] },
    ],
  },
)

// pos shares two domain themes with pay (adjacent); infra shares only universal themes (not
// adjacent, despite sharing agenticness/openness with everything).
const pos = arena('pos', ['p1', 'p2'], [story('tap', 'checkout-flows'), story('settle', 'payout-speed')], {
  leaderboard: [entry('p1', 60), entry('p2', 40)],
})
const infra = arena(
  'infra',
  ['i1'],
  [story('plan', 'agenticness'), story('drift', 'openness'), story('state', 'state-management')],
  { leaderboard: [entry('i1', 95)] },
)

const categories = [pay, pos, infra]

describe('findUltrametric', () => {
  it('resolves a product to its first arena, deterministically', () => {
    expect(findUltrametric(categories, 'x')?.data.category.id).toBe('pay')
    // p1 exists only in pos; a duplicated id would resolve to the earlier category.
    const dupe = [pos, arena('pay2', ['p1'], [])]
    expect(findUltrametric(dupe, 'p1')?.data.category.id).toBe('pos')
    expect(findUltrametric(categories, 'ghost')).toBeNull()
  })
})

describe('rivalsFor', () => {
  it('returns rivals in leaderboard order, excluding the product itself, with ranks intact', () => {
    const rivals = rivalsFor(pay, 'x')
    expect(rivals.map((r) => r.product.id)).toEqual(['r1', 'r2'])
    expect(rivals.map((r) => r.rank)).toEqual([1, 3])
  })

  it('picks each rival top-2 wins over x by margin, regardless of battle side', () => {
    const [r1, r2] = rivalsFor(pay, 'x')
    // r1 is side b and wins all three rounds — top 2 by margin are payouts (12) and refunds (8).
    expect(r1.wins.map((w) => w.storyId)).toEqual(['payouts', 'refunds'])
    expect(r1.wins[0].margin).toBe(12)
    expect(r1.wins[0].title).toBe('Payouts')
    // r2 never wins a round against x.
    expect(r2.wins).toEqual([])
  })

  it('carries the battle slug in stored a/b order for battle-page links', () => {
    const [r1] = rivalsFor(pay, 'x')
    expect(r1.battleSlug).toBe('x-vs-r1')
  })
})

describe('adjacentProducts', () => {
  it('requires ≥2 shared non-universal themes and returns each arena top product', () => {
    const adj = adjacentProducts(categories, pay, 'x')
    expect(adj).toHaveLength(1)
    expect(adj[0].categoryId).toBe('pos')
    expect(adj[0].product.id).toBe('p1')
    expect(adj[0].sharedThemes).toEqual(['checkout-flows', 'payout-speed'])
  })

  it('never counts universal themes toward adjacency', () => {
    expect(domainThemes(infra)).toEqual(new Set(['state-management']))
    expect(adjacentProducts([pay, infra], pay, 'x')).toEqual([])
  })

  it('caps the result and skips the base product id in the adjacent arena', () => {
    const posWithX = arena('posx', ['x', 'p9'], [story('tap', 'checkout-flows'), story('settle', 'payout-speed')], {
      leaderboard: [entry('x', 99), entry('p9', 10)],
    })
    const adj = adjacentProducts([pay, posWithX], pay, 'x')
    expect(adj[0].product.id).toBe('p9')
    expect(adjacentProducts(categories, pay, 'x', 0)).toEqual([])
  })
})
