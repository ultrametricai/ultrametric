// "Alternatives comparison" rows for one product page (components/CompareRivals.tsx): the product
// itself plus its nearest same-arena rivals by leaderboard adjacency — 2 above and 2 below
// where they exist, filled from the other side at the edges (#1 and last place still get a
// full set). Pure and `node:fs`-free, same contract as lib/alternatives.ts: callers pass
// CategoryData (usually via loadCategory), tests pass fixtures.
//
// List semantics per lib/shutdown.ts: a shutdown rival KEEPS its row (this is a ranked list
// slice, not a pick/recommend surface) — the component tags it with the Closing badge.
import { battleSlug, type CategoryData } from './data-helpers'

export interface CompareRivalRow {
  productId: string
  name: string
  /** 1-based rank in the arena's Arena-Score leaderboard (including the product itself). */
  rank: number
  isSelf: boolean
  /** Verified shutdown note when the vendor announced a closure — see lib/shutdown.ts. */
  shutdown?: string
  shutdownSource?: string
  /** Overall score (leaderboard `aiEra`) — the headline blended score, /100. */
  aiEra: number | null
  agentReady: number | null
  agenticApp: number | null
  apiQuality: number | null
  /**
   * Slug for the arena battle-page head-to-head against the section's own product — null only on the
   * self row. Uses the stored battle's (a, b) order when the battle exists, else the same
   * data.products-index ordering lib/scoring.ts builds battles with (ArenaTable's idiom).
   */
  battleSlug: string | null
  /**
   * Judged head-to-head record oriented SELF-first (self wins – rival wins), so the Compare
   * head-to-head chips read uniformly as "how this page's product fares against the rival"
   * (the table's VS column retired, founder 2026-10-02). Null on the self row and when no
   * battle record exists for the pair.
   */
  record: { wins: number; losses: number; draws: number } | null
}

/**
 * Self + up to `rivalCount` leaderboard-adjacent rivals, self flagged and always first, rivals
 * in rank order. Returns [] for a product the leaderboard doesn't rank; a single self row for
 * a one-product arena (the component renders nothing below 2 rows).
 */
export function compareRivalsFor(data: CategoryData, productId: string, rivalCount = 4): CompareRivalRow[] {
  const lb = data.rankings.leaderboard
  const idx = lb.findIndex((e) => e.productId === productId)
  if (idx === -1) return []

  // Window of rivalCount+1 leaderboard slots centred on the product: clamping `start` into
  // [0, n - windowSize] is exactly "2 above / 2 below, fill from the other side at the edges".
  const windowSize = Math.min(lb.length, rivalCount + 1)
  const half = Math.floor(rivalCount / 2)
  const start = Math.min(Math.max(idx - half, 0), lb.length - windowSize)

  const productById = new Map(data.products.map((p) => [p.id, p]))
  // Battle slugs are ordered by each product's position in data.products (see lib/scoring.ts /
  // ArenaTable's orderByProduct) — only a fallback: every populated arena stores the full
  // round-robin, so the stored battle's own (a, b) normally wins.
  const productIdx = (id: string) => data.products.findIndex((p) => p.id === id)

  const self: CompareRivalRow[] = []
  const rivals: CompareRivalRow[] = []
  for (let i = start; i < start + windowSize; i++) {
    const entry = lb[i]
    const product = productById.get(entry.productId)
    if (!product) continue
    const isSelf = entry.productId === productId
    const battle = isSelf
      ? undefined
      : data.rankings.battles.find(
          (b) =>
            (b.a === productId && b.b === entry.productId) ||
            (b.a === entry.productId && b.b === productId),
        )
    const row: CompareRivalRow = {
      productId: entry.productId,
      name: product.name,
      rank: i + 1,
      isSelf,
      shutdown: product.shutdown,
      shutdownSource: product.shutdownSource,
      aiEra: entry.aiEra,
      agentReady: entry.agentReady,
      agenticApp: entry.agenticApp,
      apiQuality: entry.apiQuality,
      battleSlug: isSelf
        ? null
        : battle
          ? battleSlug(battle.a, battle.b)
          : productIdx(productId) <= productIdx(entry.productId)
            ? battleSlug(productId, entry.productId)
            : battleSlug(entry.productId, productId),
      record: battle
        ? battle.a === productId
          ? { wins: battle.record.aWins, losses: battle.record.bWins, draws: battle.record.draws }
          : { wins: battle.record.bWins, losses: battle.record.aWins, draws: battle.record.draws }
        : null,
    }
    ;(isSelf ? self : rivals).push(row)
  }
  return [...self, ...rivals]
}

// The battle-page slug for self-vs-rival, ordered by each product's position in data.products
// (the ordering rankings.battles uses) so the link resolves whether or not a stored battle
// exists. Callers link it as /arena/{data.category.id}/battle/{slug}.
export function vsSlugFor(data: CategoryData, selfId: string, rivalId: string): string {
  const idx = (pid: string) => data.products.findIndex((p) => p.id === pid)
  const [a, b] = idx(selfId) <= idx(rivalId) ? [selfId, rivalId] : [rivalId, selfId]
  return battleSlug(a, b)
}
