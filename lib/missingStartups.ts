// The agent-startup gap map behind /missing: which arenas have weak agentic coverage — i.e.
// where the agent economy is missing startups. The inverse of the leaderboards: instead of "who
// wins here", this asks "where does nobody win yet". Sibling of docs/search-gaps.md (queries
// with no arena vs arenas with no strong players).
//
// HONESTY CAVEAT (repeat it wherever this renders): this measures OUR EVIDENCE — judged
// verdicts on the stories we ask — not market size, funding white-space, or demand. An arena
// can score high here because incumbents genuinely lack agent surfaces, or because their
// evidence packs are thin. Both are real information; neither is a business plan.
//
// OpportunityScore formula (0–100, higher = bigger gap for a new entrant), a weight-renormalized
// blend over whichever components are measurable (same null-renormalization contract as
// lib/scoring.ts's computeAiEra):
//
//   opportunity = 0.3·(100 − mean agent-ready)          — fleet can't be driven by agents
//               + 0.2·(100 − mean Built-in AI)            — fleet isn't agentic itself
//               + 0.2·(100 · agentic none-share)        — hard "none" verdicts on agent-access/
//                                                         agentic-features stories, fleet-wide
//               + 0.2·(100 − leader Agentic score)           — even the leader is weak
//               + 0.1·(100 · unserved-story share)      — stories NO product covers at all
//
// Weights are deliberately contestable, like AI_ERA_WEIGHTS. Pure and `node:fs`-free: callers
// pass CategoryData[] (usually loadAll()), tests pass fixtures.

import type { Category, LeaderboardEntry, Product, Story, Verdict } from './schemas'
import { parseStoryPersona } from './storyText'

export const MISSING_WEIGHTS = {
  agentReadyGap: 0.3,
  aiNativeGap: 0.2,
  noneShare: 0.2,
  leaderGap: 0.2,
  unservedShare: 0.1,
} as const

// Human-readable formula for the score tooltip on /missing — keep in sync with MISSING_WEIGHTS.
export const OPPORTUNITY_FORMULA =
  'OpportunityScore = 0.3·(100 − mean agent-ready) + 0.2·(100 − mean Built-in AI) + 0.2·(100·none-share on agent-access/agentic-features stories) + 0.2·(100 − leader Agentic score) + 0.1·(100·share of stories no product covers). Weights renormalize over measurable components. Measures our judged evidence, not market size.'

const round1 = (n: number) => Math.round(n * 10) / 10

// Structural subset of CategoryData — loadAll()'s elements satisfy it as-is; tests pass fixtures.
export interface MissingSource {
  category: Pick<Category, 'id' | 'name' | 'description'>
  products: Pick<Product, 'id' | 'name'>[]
  stories: Story[]
  verdicts: Verdict[]
  rankings: {
    leaderboard: Pick<LeaderboardEntry, 'productId' | 'aiEra' | 'agentReady' | 'agenticApp'>[]
  }
}

// A story NO product in the arena scores ≥ partial on — the "nobody does this" list.
export interface UnservedStory {
  storyId: string
  // Action form via lib/storyText.ts.
  title: string
  theme: string
  group: string
  weight: number
}

export interface OpportunityComponents {
  // Fleet means of the two agenticness indexes (null when no product has the index).
  meanAgentReady: number | null
  meanAiNative: number | null
  // Share (0–1) of non-na fleet cells on agent-access/agentic-features stories judged 'none'
  // (null when the arena has no applicable cells on those groups).
  noneShare: number | null
  // The arena leader's Overall score (leaderboard is already Overall-score-ordered; null when unranked).
  leaderOverallScore: number | null
  // Share (0–1) of applicable stories (≥1 non-na verdict) that no product covers at all.
  unservedShare: number | null
}

export interface ArenaOpportunity {
  arenaId: string
  arenaName: string
  score: number
  components: OpportunityComponents
  leader: { productId: string; name: string; overallScore: number | null } | null
  productCount: number
  unservedStories: UnservedStory[]
}

// The two groups whose 'none' verdicts signal "agents can't get in / nothing agentic here" —
// the same theme+group filters lib/scoring.ts uses for agentReady/agenticApp (api-quality is
// deliberately excluded: a weak API is a quality gap, not absent agent access).
const AGENTIC_GROUPS = new Set(['agent-access', 'agentic-features'])

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

// Weight-renormalized blend over non-null gap components (same contract as computeAiEra).
// Exported for the formula tooltip test; returns null only when every component is null.
export function computeOpportunityScore(c: OpportunityComponents): number | null {
  const gaps: Record<keyof typeof MISSING_WEIGHTS, number | null> = {
    agentReadyGap: c.meanAgentReady === null ? null : 100 - c.meanAgentReady,
    aiNativeGap: c.meanAiNative === null ? null : 100 - c.meanAiNative,
    noneShare: c.noneShare === null ? null : 100 * c.noneShare,
    leaderGap: c.leaderOverallScore === null ? null : 100 - c.leaderOverallScore,
    unservedShare: c.unservedShare === null ? null : 100 * c.unservedShare,
  }
  let totalWeight = 0
  let numerator = 0
  for (const key of Object.keys(MISSING_WEIGHTS) as Array<keyof typeof MISSING_WEIGHTS>) {
    const gap = gaps[key]
    if (gap === null) continue
    totalWeight += MISSING_WEIGHTS[key]
    numerator += gap * MISSING_WEIGHTS[key]
  }
  if (totalWeight === 0) return null
  return round1(numerator / totalWeight)
}

// Stories in one arena that NO product scores ≥ partial on (verdict full or partial = served).
// A story that's `na` for every product is excluded — universally inapplicable ≠ unserved.
// Ordered heaviest-first (weight desc, then storyId) so the biggest holes lead.
export function unservedStoriesFor(source: MissingSource): UnservedStory[] {
  const byStory = new Map<string, Verdict[]>()
  for (const v of source.verdicts) {
    const list = byStory.get(v.storyId) ?? []
    list.push(v)
    byStory.set(v.storyId, list)
  }
  return source.stories
    .filter((s) => {
      const cells = byStory.get(s.id) ?? []
      const applicable = cells.filter((v) => v.verdict !== 'na')
      if (applicable.length === 0) return false
      return !applicable.some((v) => v.verdict === 'full' || v.verdict === 'partial')
    })
    .map((s) => ({
      storyId: s.id,
      title: parseStoryPersona(s.title).action,
      theme: s.theme,
      group: s.group,
      weight: s.weight,
    }))
    .sort((a, b) => b.weight - a.weight || a.storyId.localeCompare(b.storyId))
}

export function arenaOpportunity(source: MissingSource): ArenaOpportunity {
  const lb = source.rankings.leaderboard
  const meanAgentReady = mean(lb.map((e) => e.agentReady).filter((v): v is number => v !== null))
  const meanAiNative = mean(lb.map((e) => e.agenticApp).filter((v): v is number => v !== null))

  const agenticStoryIds = new Set(
    source.stories.filter((s) => s.theme === 'agenticness' && AGENTIC_GROUPS.has(s.group)).map((s) => s.id),
  )
  const agenticCells = source.verdicts.filter((v) => agenticStoryIds.has(v.storyId) && v.verdict !== 'na')
  const noneShare =
    agenticCells.length === 0 ? null : agenticCells.filter((v) => v.verdict === 'none').length / agenticCells.length

  const leaderEntry = lb[0] ?? null
  const leader = leaderEntry
    ? {
        productId: leaderEntry.productId,
        name: source.products.find((p) => p.id === leaderEntry.productId)?.name ?? leaderEntry.productId,
        overallScore: leaderEntry.aiEra,
      }
    : null

  const unservedStories = unservedStoriesFor(source)
  const applicableStoryCount = source.stories.filter((s) =>
    source.verdicts.some((v) => v.storyId === s.id && v.verdict !== 'na'),
  ).length
  const unservedShare = applicableStoryCount === 0 ? null : unservedStories.length / applicableStoryCount

  const components: OpportunityComponents = {
    meanAgentReady: meanAgentReady === null ? null : round1(meanAgentReady),
    meanAiNative: meanAiNative === null ? null : round1(meanAiNative),
    noneShare: noneShare === null ? null : Math.round(noneShare * 1000) / 1000,
    leaderOverallScore: leader?.overallScore ?? null,
    unservedShare: unservedShare === null ? null : Math.round(unservedShare * 1000) / 1000,
  }

  return {
    arenaId: source.category.id,
    arenaName: source.category.name,
    score: computeOpportunityScore(components) ?? 0,
    components,
    leader,
    productCount: source.products.length,
    unservedStories,
  }
}

// Every arena ranked biggest-gap-first (score desc, arenaId tie-break for stability).
export function rankMissingStartups(sources: MissingSource[]): ArenaOpportunity[] {
  return sources
    .map(arenaOpportunity)
    .sort((a, b) => b.score - a.score || a.arenaId.localeCompare(b.arenaId))
}

// A global story (scope 'global') nobody covers ANYWHERE: across every arena carrying it, no
// product's verdict is full or partial, and at least one cell is applicable (not all-na).
// "Anywhere" uses the site's cross-arena definition of a global story (lib/globalStories.ts:
// present in ≥2 arenas — the same bar the /global/[story] pages require, so every entry here has
// a live cross-arena page to link to). A global-scoped story carried by only one arena isn't a
// fleet-wide claim; it still surfaces in that arena's own unservedStories list.
export interface GloballyUnservedStory {
  storyId: string
  title: string
  arenaCount: number
  arenaIds: string[]
}

export function globallyUnservedStories(sources: MissingSource[]): GloballyUnservedStory[] {
  const byId = new Map<string, { title: string; arenaIds: string[]; served: boolean; applicable: boolean }>()
  for (const source of sources) {
    for (const story of source.stories) {
      if (story.scope !== 'global') continue
      const entry =
        byId.get(story.id) ??
        { title: parseStoryPersona(story.title).action, arenaIds: [], served: false, applicable: false }
      entry.arenaIds.push(source.category.id)
      for (const v of source.verdicts) {
        if (v.storyId !== story.id) continue
        if (v.verdict === 'full' || v.verdict === 'partial') entry.served = true
        if (v.verdict !== 'na') entry.applicable = true
      }
      byId.set(story.id, entry)
    }
  }
  return [...byId.entries()]
    .filter(([, e]) => !e.served && e.applicable && e.arenaIds.length >= 2)
    .map(([storyId, e]) => ({ storyId, title: e.title, arenaCount: e.arenaIds.length, arenaIds: e.arenaIds }))
    .sort((a, b) => b.arenaCount - a.arenaCount || a.storyId.localeCompare(b.storyId))
}
