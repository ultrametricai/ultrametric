// "Alternatives to <X>" data (app/alternatives/[product]/page.tsx): X's arena rivals in
// leaderboard order, each with its top story-level wins over X taken from the already-derived
// battle rounds (never recomputed here), plus a small set of cross-arena "adjacent" products
// for buyers shopping a neighboring category. Pure and `node:fs`-free, same contract as
// lib/data-helpers.ts: callers pass CategoryData / CategoryData[] (usually via loadAll()),
// tests pass fixtures.
import { battleSlug, stripPersonaPrefix, type CategoryData } from './data-helpers'
import type { LeaderboardEntry, Product } from './schemas'
import { isShutdown } from './shutdown'

// The canonical lens themes injected into EVERY arena (see pipeline/agentic-stories.ts):
// shared by construction, so they carry zero adjacency signal and are excluded from the
// shared-theme count below. Domain themes (pricing-limits, dev-experience, onboarding, …)
// are what make two arenas genuinely adjacent.
const UNIVERSAL_THEMES: ReadonlySet<string> = new Set([
  'agenticness',
  'automation-depth',
  'openness',
  'privacy-posture',
])

export interface RivalWin {
  storyId: string
  /** Persona-stripped story title, ready for display. */
  title: string
  /** Weighted cell-score margin of the round (see pipeline derive) — bigger = clearer win. */
  margin: number
}

export interface Rival {
  product: Product
  entry: LeaderboardEntry
  /** 1-based leaderboard rank within the arena (including X itself). */
  rank: number
  /** Top story-level wins over X, widest margin first (at most `maxWins`). */
  wins: RivalWin[]
  /** Slug for the arena battle page (/arena/{category}/battle/{slug}) covering this pair. */
  battleSlug: string
}

export interface ArenaMembership {
  arenaId: string
  arenaName: string
  /** 1-based leaderboard rank within that arena. */
  rank: number
  fieldSize: number
}

// EVERY arena that ranks this product id, in categories order — the product header's arenas
// strip (sentry competes in observability AND error-tracking; brex/ramp in startup-banking AND
// expense-management). Complements findUltrametric below, which deliberately keeps the
// first-wins ownership rule for contexts that need exactly one home arena.
export function arenaMembershipsOf(categories: CategoryData[], productId: string): ArenaMembership[] {
  const memberships: ArenaMembership[] = []
  for (const data of categories) {
    const i = data.rankings.leaderboard.findIndex((e) => e.productId === productId)
    if (i === -1) continue
    memberships.push({
      arenaId: data.category.id,
      arenaName: data.category.name,
      rank: i + 1,
      fieldSize: data.rankings.leaderboard.length,
    })
  }
  return memberships
}

// A product id can (rarely) be ranked in two arenas — e.g. `square` in both payments and
// mobile-payments. Same deterministic rule as scripts/generate-badges.mjs: the first category
// (categories.json / loadAll order) owns the id.
export function findUltrametric(
  categories: CategoryData[],
  productId: string,
): { data: CategoryData; product: Product } | null {
  for (const data of categories) {
    const product = data.products.find((p) => p.id === productId)
    if (product) return { data, product }
  }
  return null
}

// X's arena rivals in leaderboard order (X itself excluded), each with its top `maxWins`
// story-level wins over X pulled from the pair's battle rounds. A rival with no winning
// rounds gets `wins: []` — honest, not an error: it simply never beats X on any story.
export function rivalsFor(data: CategoryData, productId: string, maxWins = 2): Rival[] {
  const titleOf = new Map(data.stories.map((s) => [s.id, stripPersonaPrefix(s.title)]))
  const productById = new Map(data.products.map((p) => [p.id, p]))

  return data.rankings.leaderboard
    .map((entry, i) => ({ entry, rank: i + 1 }))
    .filter(({ entry }) => entry.productId !== productId)
    .flatMap(({ entry, rank }) => {
      const product = productById.get(entry.productId)
      if (!product) return []
      const battle = data.rankings.battles.find(
        (b) =>
          (b.a === productId && b.b === entry.productId) ||
          (b.a === entry.productId && b.b === productId),
      )
      const rivalSide = battle ? (battle.a === entry.productId ? 'a' : 'b') : null
      const wins = battle
        ? battle.rounds
            .filter((r) => r.winner === rivalSide)
            .sort((x, y) => y.margin - x.margin)
            .slice(0, maxWins)
            .map((r) => ({ storyId: r.storyId, title: titleOf.get(r.storyId) ?? r.storyId, margin: r.margin }))
        : []
      return [{
        product,
        entry,
        rank,
        wins,
        battleSlug: battle ? battleSlug(battle.a, battle.b) : battleSlug(productId, entry.productId),
      }]
    })
}

// Non-universal theme names present in an arena's story taxonomy.
export function domainThemes(data: CategoryData): Set<string> {
  return new Set(data.stories.map((s) => s.theme).filter((t) => !UNIVERSAL_THEMES.has(t)))
}

export interface AdjacentProduct {
  categoryId: string
  categoryName: string
  product: Product
  entry: LeaderboardEntry
  /** The domain themes this arena shares with X's arena (≥2 by construction). */
  sharedThemes: string[]
}

// Cross-arena "adjacent" products: the top-ranked product of every OTHER arena whose story
// taxonomy shares ≥2 non-universal theme names with X's arena, strongest overlap first,
// capped. Deliberately simple — a buyer browsing payments alternatives may really be shopping
// mobile-payments, not a rigorous similarity model.
export function adjacentProducts(
  categories: CategoryData[],
  data: CategoryData,
  productId: string,
  cap = 3,
): AdjacentProduct[] {
  const baseThemes = domainThemes(data)
  const out: Array<AdjacentProduct & { overlap: number }> = []
  for (const other of categories) {
    if (other.category.id === data.category.id) continue
    const shared = [...domainThemes(other)].filter((t) => baseThemes.has(t)).sort()
    if (shared.length < 2) continue
    // Skip X itself when the same product id is ranked in the adjacent arena too — and any
    // shutdown product (lib/shutdown.ts: an adjacent suggestion is an offer): next one up.
    const productById = new Map(other.products.map((p) => [p.id, p]))
    const entry = other.rankings.leaderboard.find((e) => {
      if (e.productId === productId) return false
      const p = productById.get(e.productId)
      return p !== undefined && !isShutdown(p)
    })
    const product = entry && productById.get(entry.productId)
    if (!entry || !product) continue
    out.push({
      categoryId: other.category.id,
      categoryName: other.category.name,
      product,
      entry,
      sharedThemes: shared,
      overlap: shared.length,
    })
  }
  return out
    .sort((a, b) => b.overlap - a.overlap || a.categoryId.localeCompare(b.categoryId))
    .slice(0, cap)
    .map(({ categoryId, categoryName, product, entry, sharedThemes }) => ({ categoryId, categoryName, product, entry, sharedThemes }))
}

export interface AdjacentArena {
  categoryId: string
  categoryName: string
  productCount: number
  leaderName: string | null
  sharedThemes: string[]
}

// Arena-level adjacency for the "Adjacent arenas" strip: curated clusters first
// (data/adjacent-arenas.json — arenas that share a buyer, e.g. payments↔banking↔accounting),
// then ≥1-shared-domain-theme fill. Theme names rarely coincide across arenas, so curation
// carries most of the signal; the file is small and reviewed like any data change.
import adjacencyClusters from '../data/adjacent-arenas.json'

export function adjacentArenas(categories: CategoryData[], data: CategoryData, cap = 4): AdjacentArena[] {
  const byId = new Map(categories.map((c) => [c.category.id, c]))
  const own = domainThemes(data)
  const picked = new Map<string, string[]>() // id -> sharedThemes (may be empty for curated)

  for (const cluster of adjacencyClusters as string[][]) {
    if (!cluster.includes(data.category.id)) continue
    for (const id of cluster) {
      if (id !== data.category.id && byId.has(id) && !picked.has(id)) picked.set(id, [])
    }
  }
  for (const other of categories) {
    if (other.category.id === data.category.id || picked.has(other.category.id)) continue
    const shared = [...domainThemes(other)].filter((t) => own.has(t))
    if (shared.length >= 1) picked.set(other.category.id, shared)
  }

  const out: AdjacentArena[] = []
  for (const [id, sharedThemes] of picked) {
    const other = byId.get(id)!
    // The strip names the arena's leader as a nudge — never a shutdown product (lib/shutdown.ts).
    const top = other.rankings.leaderboard.find((e) => {
      const p = other.products.find((pr) => pr.id === e.productId)
      return p !== undefined && !isShutdown(p)
    })
    out.push({
      categoryId: id,
      categoryName: other.category.name,
      productCount: other.products.length,
      leaderName: top ? other.products.find((p) => p.id === top.productId)?.name ?? null : null,
      sharedThemes,
    })
  }
  return out.slice(0, cap)
}
