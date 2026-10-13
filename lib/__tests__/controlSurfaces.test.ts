import { describe, expect, it } from 'vitest'
import {
  bestSurfaceVerdict,
  computeControlSurfaces,
  CONTROL_SURFACE_ICONS,
  isSurfaceRankId,
  LIFT_MIN_ARENAS,
  sortSurfaces,
  SURFACE_DEFS,
  SURFACE_RANKS,
  type SurfaceRow,
} from '@/lib/controlSurfaces'
import { parseProcessIconToken } from '@/lib/processIcons'
import { loadAll } from '@/lib/data'
import type { CategoryData } from '@/lib/data-helpers'
import type { Story, Verdict } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Fixtures — the lib/__tests__/globalStories.test.ts minimal-CategoryData pattern.
// ---------------------------------------------------------------------------

function story(id: string): Story {
  return { id, persona: 'an AI-native user', title: `As an AI-native user, I can ${id}`, theme: 'agenticness', group: 'agent-access', weight: 2, scope: 'global' }
}

function verdict(productId: string, storyId: string, tier: Verdict['verdict'], quality = 0): Verdict {
  return { productId, storyId, verdict: tier, quality, confidence: 'high', rationale: 'r', evidenceIds: [] }
}

function arena(
  id: string,
  stories: Story[],
  products: string[],
  verdicts: Verdict[],
  agentReady: Record<string, number | null> = {},
): CategoryData {
  return {
    category: { id, name: id.toUpperCase(), description: '', personas: ['an AI-native user'] },
    products: products.map((p) => ({
      id: p,
      name: p.toUpperCase(),
      vendor: 'v',
      type: 'oss' as const,
      urls: { site: `https://example.com/${p}` },
    })),
    stories,
    evidence: {},
    verdicts,
    rankings: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      leaderboard: products.map((p) => ({
        productId: p,
        score: 50,
        agentReady: agentReady[p] ?? null,
        agenticApp: null,
        apiQuality: null,
        aiEra: null,
        applicable: 1,
        total: 1,
        themeScores: {},
      })),
      battles: [],
    },
    stacks: [],
    popularity: {},
    claims: {},
    uncertainty: [],
    vendorResponses: [],
    certifications: [],
  }
}

const mcpStories = [story('agentic-mcp-server'), story('agentic-mcp-client')]

describe('bestSurfaceVerdict', () => {
  const data = arena('alpha', mcpStories, ['p1', 'p2'], [
    verdict('p1', 'agentic-mcp-server', 'none'),
    verdict('p1', 'agentic-mcp-client', 'partial', 5),
    verdict('p2', 'agentic-mcp-server', 'full', 8),
    verdict('p2', 'agentic-mcp-client', 'none'),
  ])

  it('takes the strongest verdict across the surface stories (the ACCESS_COLUMNS best-of)', () => {
    expect(bestSurfaceVerdict(data, 'p1', ['agentic-mcp-server', 'agentic-mcp-client'])?.verdict).toBe('partial')
    expect(bestSurfaceVerdict(data, 'p2', ['agentic-mcp-server', 'agentic-mcp-client'])?.verdict).toBe('full')
  })

  it('returns null when the arena carries none of the stories (product not judged)', () => {
    expect(bestSurfaceVerdict(data, 'p1', ['mobile-apps'])).toBeNull()
  })
})

describe('computeControlSurfaces', () => {
  // Enough arenas carrying the MCP stories to clear LIFT_MIN_ARENAS: shippers have high
  // agentReady, non-shippers low, so the lift is a known number.
  const liftArenas = Array.from({ length: LIFT_MIN_ARENAS }, (_, i) =>
    arena(
      `arena-${i}`,
      mcpStories,
      ['ship', 'noship'],
      [
        verdict('ship', 'agentic-mcp-server', 'full', 8),
        verdict('ship', 'agentic-mcp-client', 'none'),
        verdict('noship', 'agentic-mcp-server', 'none'),
        verdict('noship', 'agentic-mcp-client', 'none'),
      ],
      { ship: 80, noship: 20 },
    ),
  )

  it('counts judged/shipped with best-of semantics and computes the readiness lift', () => {
    const { surfaces } = computeControlSurfaces(liftArenas)
    const mcp = surfaces.find((s) => s.id === 'mcp')!
    expect(mcp.judged).toBe(2 * LIFT_MIN_ARENAS)
    expect(mcp.shipped).toBe(LIFT_MIN_ARENAS)
    expect(mcp.fullCount).toBe(LIFT_MIN_ARENAS)
    expect(mcp.shipRate).toBe(50)
    expect(mcp.fullRate).toBe(50)
    expect(mcp.arenasJudged).toBe(LIFT_MIN_ARENAS)
    expect(mcp.arenasWithShipper).toBe(LIFT_MIN_ARENAS)
    expect(mcp.avgReadyWith).toBe(80)
    expect(mcp.avgReadyWithout).toBe(20)
    expect(mcp.readinessLift).toBe(60)
  })

  it('excludes products from the denominator in arenas that do not carry the surface', () => {
    const { surfaces } = computeControlSurfaces(liftArenas)
    const cli = surfaces.find((s) => s.id === 'cli')!
    expect(cli.judged).toBe(0)
    expect(cli.arenasJudged).toBe(0)
    expect(cli.shipRate).toBe(0)
    expect(cli.readinessLift).toBeNull()
  })

  it('suppresses the lift below LIFT_MIN_ARENAS judged arenas (small-sample honesty)', () => {
    const few = liftArenas.slice(0, LIFT_MIN_ARENAS - 1)
    const { surfaces } = computeControlSurfaces(few)
    const mcp = surfaces.find((s) => s.id === 'mcp')!
    expect(mcp.arenasJudged).toBe(LIFT_MIN_ARENAS - 1)
    expect(mcp.shipped).toBe(LIFT_MIN_ARENAS - 1) // adoption counts stay real…
    expect(mcp.avgReadyWith).toBeNull() // …the comparison stats do not.
    expect(mcp.avgReadyWithout).toBeNull()
    expect(mcp.readinessLift).toBeNull()
  })

  it('splits canonical and emerging tiers and never ranks emerging rows', () => {
    const { surfaces, emerging } = computeControlSurfaces(liftArenas)
    expect(surfaces.every((s) => s.tier === 'canonical')).toBe(true)
    expect(emerging.every((s) => s.tier === 'emerging')).toBe(true)
    expect(surfaces.map((s) => s.id)).not.toContain('mobile-app')
    expect(emerging.map((s) => s.id)).toContain('mobile-app')
  })

  it('picks top products by full-first, then quality, deterministically', () => {
    const data = arena(
      'top',
      mcpStories,
      ['a', 'b', 'c', 'd', 'e'],
      [
        verdict('a', 'agentic-mcp-server', 'partial', 9),
        verdict('a', 'agentic-mcp-client', 'none'),
        verdict('b', 'agentic-mcp-server', 'full', 6),
        verdict('b', 'agentic-mcp-client', 'none'),
        verdict('c', 'agentic-mcp-server', 'full', 8),
        verdict('c', 'agentic-mcp-client', 'none'),
        verdict('d', 'agentic-mcp-server', 'full', 8),
        verdict('d', 'agentic-mcp-client', 'none'),
        verdict('e', 'agentic-mcp-server', 'none'),
        verdict('e', 'agentic-mcp-client', 'none'),
      ],
      { c: 10, d: 90 },
    )
    const { surfaces } = computeControlSurfaces([data])
    const mcp = surfaces.find((s) => s.id === 'mcp')!
    // full beats partial regardless of quality; quality ties break on agentReady.
    expect(mcp.topProducts.map((p) => p.productId)).toEqual(['d', 'c', 'b'])
    expect(mcp.topProducts[0].categoryId).toBe('top')
  })
})

describe('sortSurfaces / rank toggles', () => {
  const row = (id: string, patch: Partial<SurfaceRow>): SurfaceRow => ({
    id,
    name: id,
    icon: '🔌',
    blurb: '',
    tier: 'canonical',
    pros: [],
    cons: [],
    storyIds: [],
    judged: 10,
    fullCount: 0,
    partialCount: 0,
    shipped: 0,
    shipRate: 0,
    fullRate: 0,
    arenasJudged: 0,
    arenasWithShipper: 0,
    avgReadyWith: null,
    avgReadyWithout: null,
    readinessLift: null,
    topProducts: [],
    ...patch,
  })

  const rows = [
    row('a', { shipRate: 10, fullRate: 90, readinessLift: 5, arenasWithShipper: 3 }),
    row('b', { shipRate: 90, fullRate: 10, readinessLift: null, arenasWithShipper: 1 }),
    row('c', { shipRate: 50, fullRate: 50, readinessLift: 40, arenasWithShipper: 2 }),
  ]

  it('every declared rank id validates and sorts descending with nulls last', () => {
    for (const r of SURFACE_RANKS) expect(isSurfaceRankId(r.id)).toBe(true)
    expect(isSurfaceRankId('most-visual')).toBe(false)
    expect(isSurfaceRankId(null)).toBe(false)
    expect(sortSurfaces(rows, 'adoption').map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortSurfaces(rows, 'strict').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(sortSurfaces(rows, 'breadth').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    // b has no lift (null) → last, despite the highest adoption.
    expect(sortSurfaces(rows, 'lift').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate its input', () => {
    const before = rows.map((r) => r.id)
    sortSurfaces(rows, 'lift')
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

// ---------------------------------------------------------------------------
// Live corpus: every displayed number must be recomputable from committed data, and the same
// data must always yield byte-identical output (the determinism rule for this page).
// ---------------------------------------------------------------------------

describe('live corpus', () => {
  const categories = loadAll()

  it('is deterministic: recomputing over the same committed data yields identical output', () => {
    const a = computeControlSurfaces(categories)
    const b = computeControlSurfaces(loadAll())
    expect(a).toEqual(b)
    // Serialized form too — what the static page actually embeds.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('every canonical surface is judged fleet-wide (the fairness precondition for ranking)', () => {
    const { surfaces, totalArenas, totalProducts } = computeControlSurfaces(categories)
    expect(surfaces.length).toBeGreaterThanOrEqual(9)
    for (const s of surfaces) {
      expect(s.arenasJudged).toBe(totalArenas)
      expect(s.judged).toBe(totalProducts)
      expect(s.shipped).toBe(s.fullCount + s.partialCount)
      expect(s.shipped).toBeLessThanOrEqual(s.judged)
      expect(s.arenasWithShipper).toBeLessThanOrEqual(s.arenasJudged)
      expect(s.readinessLift).not.toBeNull() // fleet-wide coverage ⇒ the lift is computable
      expect(s.topProducts.length).toBeGreaterThan(0)
    }
  })

  it('every curated story id (canonical and emerging) exists in the judged corpus', () => {
    const allStoryIds = new Set(categories.flatMap((c) => c.stories.map((s) => s.id)))
    for (const def of SURFACE_DEFS) {
      for (const id of def.storyIds) {
        expect(allStoryIds.has(id), `surface ${def.id} cites story ${id} absent from the corpus`).toBe(true)
      }
    }
  })

  it('emerging surfaces stay honestly below the line: thin coverage, suppressed lift', () => {
    const { emerging } = computeControlSurfaces(categories)
    expect(emerging.length).toBeGreaterThan(0)
    for (const s of emerging) {
      expect(s.arenasJudged).toBeGreaterThan(0)
      expect(s.arenasJudged).toBeLessThan(LIFT_MIN_ARENAS)
      expect(s.readinessLift).toBeNull()
    }
  })

  it('every top product links to a real product in a real arena', () => {
    const byArena = new Map(categories.map((c) => [c.category.id, new Set(c.products.map((p) => p.id))]))
    const { surfaces, emerging } = computeControlSurfaces(categories)
    for (const s of [...surfaces, ...emerging]) {
      for (const p of s.topProducts) {
        expect(byArena.get(p.categoryId)?.has(p.productId), `${s.id}: ${p.categoryId}/${p.productId}`).toBe(true)
        expect(['full', 'partial']).toContain(p.verdict)
      }
    }
  })
})

describe('CONTROL_SURFACE_ICONS (totality over SURFACE_DEFS)', () => {
  it('every surface has a parseable house token, and no key is stale', () => {
    const ids = new Set(SURFACE_DEFS.map((d) => d.id))
    for (const def of SURFACE_DEFS) {
      const token = CONTROL_SURFACE_ICONS[def.id] ?? ''
      expect(parseProcessIconToken(token), `control surface ${def.id} needs a curated house icon token (got '${token}')`).not.toBeNull()
    }
    for (const id of Object.keys(CONTROL_SURFACE_ICONS)) {
      expect(ids.has(id), `CONTROL_SURFACE_ICONS has stale surface id ${id}`).toBe(true)
    }
  })
})
