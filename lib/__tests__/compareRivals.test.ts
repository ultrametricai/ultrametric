import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareRivalsFor } from '@/lib/compareRivals'
import { loadCategory } from '@/lib/data'
import type { CategoryData } from '@/lib/data-helpers'
import type { Rankings, Story } from '@/lib/schemas'

// ---- fixtures (same idiom as alternatives.test.ts) --------------------------------------------

function story(id: string, theme: string, weight = 2): Story {
  return { id, persona: 'a developer', title: `As a developer, I can ${id.replace(/-/g, ' ')}`, theme, group: theme, weight }
}

function entry(productId: string, aiEra: number | null, score = 50) {
  return { productId, score, agentReady: aiEra, agenticApp: null, apiQuality: null, aiEra, applicable: 1, total: 1, themeScores: {} }
}

function arena(
  id: string,
  products: Array<{ id: string; shutdown?: string; shutdownSource?: string }>,
  rankings: Partial<Rankings> = {},
): CategoryData {
  return {
    category: { id, name: id.toUpperCase(), description: '', personas: ['a developer'] },
    products: products.map((p) => ({
      id: p.id,
      name: p.id.toUpperCase(),
      vendor: 'v',
      type: 'oss' as const,
      urls: { site: `https://example.com/${p.id}` },
      ...(p.shutdown ? { shutdown: p.shutdown } : {}),
      ...(p.shutdownSource ? { shutdownSource: p.shutdownSource } : {}),
    })),
    stories: [story('checkout', 'checkout-flows')],
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

// ---- real data: startup-banking (leaderboard ramp, mercury, airwallex, brex, jeeves, wise,
// relay, gusto; battle mercury-vs-ramp stored as a=mercury, b=ramp, record 19–30, 23 drawn —
// re-pinned 2026-10-23 at the gusto debut, whose v5 freshness cascade re-judged the arena) ----

const banking = loadCategory('startup-banking', path.resolve(__dirname, '../../open-rankings'))

describe('compareRivalsFor', () => {
  it('returns self + 4 leaderboard-adjacent rivals, self flagged and first, rivals in rank order', () => {
    const rows = compareRivalsFor(banking, 'mercury') // rank #2
    expect(rows).toHaveLength(5)
    expect(rows[0].productId).toBe('mercury')
    expect(rows[0].isSelf).toBe(true)
    expect(rows[0].rank).toBe(2)
    expect(rows[0].battleSlug).toBeNull()
    expect(rows[0].record).toBeNull()
    // 1 above + 3 below (edge-fill: only one product ranks above #2), in rank order.
    expect(rows.slice(1).map((r) => r.productId)).toEqual(['ramp', 'airwallex', 'brex', 'jeeves'])
    expect(rows.slice(1).map((r) => r.rank)).toEqual([1, 3, 4, 5])
    expect(rows.slice(1).every((r) => !r.isSelf)).toBe(true)
  })

  it('rank #1 gets all 4 rivals from below; last place gets all 4 from above', () => {
    const first = compareRivalsFor(banking, 'ramp') // rank #1
    expect(first[0]).toMatchObject({ productId: 'ramp', isSelf: true, rank: 1 })
    expect(first.slice(1).map((r) => r.rank)).toEqual([2, 3, 4, 5])

    const last = compareRivalsFor(banking, 'gusto') // rank #8 of 8 (the scoped 2026-10-23 debut)
    expect(last[0]).toMatchObject({ productId: 'gusto', isSelf: true, rank: 8 })
    expect(last.slice(1).map((r) => r.rank)).toEqual([4, 5, 6, 7])
  })

  it('links each rival to the stored battle slug with the record oriented self-first', () => {
    // open-rankings/startup-banking/rankings.json stores the pair as a=mercury, b=ramp with
    // record { aWins: 18, bWins: 29, draws: 25 } — assert both orientations read from it.
    // Re-pinned 2026-10-27 (was 19/30/23): the mercury evidence-parity repair re-judge moved
    // 14 mercury cells (fdic-insurance-sweep none → full, api-machine-spec full → disputed)
    // and derive recomputed the stored record.
    const fromMercury = compareRivalsFor(banking, 'mercury').find((r) => r.productId === 'ramp')!
    expect(fromMercury.battleSlug).toBe('mercury-vs-ramp')
    expect(fromMercury.record).toEqual({ wins: 18, losses: 29, draws: 25 })

    const fromRamp = compareRivalsFor(banking, 'ramp').find((r) => r.productId === 'mercury')!
    expect(fromRamp.battleSlug).toBe('mercury-vs-ramp') // stored (a, b) order, either direction
    expect(fromRamp.record).toEqual({ wins: 29, losses: 18, draws: 25 })
  })

  it('a 3-product arena yields self + 2 rivals', () => {
    const data = arena('pay', [{ id: 'x' }, { id: 'r1' }, { id: 'r2' }], {
      leaderboard: [entry('r1', 90), entry('x', 80), entry('r2', 70)],
    })
    const rows = compareRivalsFor(data, 'x')
    expect(rows.map((r) => r.productId)).toEqual(['x', 'r1', 'r2'])
    expect(rows.map((r) => r.isSelf)).toEqual([true, false, false])
  })

  it('keeps a shutdown rival listed and carries the flag (list semantics, lib/shutdown.ts)', () => {
    const data = arena(
      'equity',
      [{ id: 'x' }, { id: 'gone', shutdown: 'Vendor announced shutdown (2026-06-30).', shutdownSource: 'https://example.com/sunset' }],
      { leaderboard: [entry('x', 80), entry('gone', 60)] },
    )
    const rows = compareRivalsFor(data, 'x')
    expect(rows).toHaveLength(2)
    const gone = rows.find((r) => r.productId === 'gone')!
    expect(gone.shutdown).toBe('Vendor announced shutdown (2026-06-30).')
    expect(gone.shutdownSource).toBe('https://example.com/sunset')
  })

  it('falls back to products-order slug when no battle is stored, with a null record', () => {
    // Products order is [b2, a1]; leaderboard order is [a1, b2] — the slug must follow the
    // products index (lib/scoring.ts's battle ordering), not the leaderboard or the caller.
    const data = arena('nb', [{ id: 'b2' }, { id: 'a1' }], {
      leaderboard: [entry('a1', 80), entry('b2', 60)],
    })
    const rows = compareRivalsFor(data, 'a1')
    const rival = rows.find((r) => r.productId === 'b2')!
    expect(rival.battleSlug).toBe('b2-vs-a1')
    expect(rival.record).toBeNull()
  })

  it('returns a single self row for a one-product arena and [] for an unranked product', () => {
    const solo = arena('solo', [{ id: 'only' }], { leaderboard: [entry('only', 70)] })
    expect(compareRivalsFor(solo, 'only')).toHaveLength(1)
    expect(compareRivalsFor(solo, 'ghost')).toEqual([])
  })
})
