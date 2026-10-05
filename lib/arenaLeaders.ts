import { isPopulated, loadCategory } from './data'
import { isShutdown } from './shutdown'

// Shared vendor derivation for the open-module and artifact page families (founder
// 2026-10-05): the vendors a page shows are the covering arenas' COMMITTED leaderboard
// leaders, read straight from each arena's rankings.json — never hand-picked. The pages only
// decide WHICH arenas cover them (the step-level function mappings / vendor options); the
// ordering and the Overall scores are the same numbers the arena pages publish, so a roster
// change flows through on the next build and no list here can drift from the judged one
// (pinned in the per-family render tests). A derived roster is an OFFER (lib/shutdown.ts
// founder rule): shutdown products drop out; the survivors keep their committed leaderboard
// positions as rank.
export interface ArenaLeader {
  productId: string
  name: string
  // The committed Overall score (rankings.json `aiEra`) — null where the arena publishes none.
  overall: number | null
  // 1-based position on the arena's committed leaderboard (identity, not a re-count).
  rank: number
  href: string
}

export interface ArenaVendors {
  arenaId: string
  arenaName: string
  href: string
  leaders: ArenaLeader[]
}

// Top leaders shown per covering arena — a cap on display depth, never a re-ranking.
export const ARENA_LEADERS_CAP = 3

// The committed leaderboard leaders of one arena, or null when the arena isn't populated —
// callers keep the honest empty state instead of fabricating a market.
export function arenaVendorLeaders(arenaId: string, dir?: string): ArenaVendors | null {
  if (!isPopulated(arenaId, dir)) return null
  const data = loadCategory(arenaId, dir)
  const leaders = data.rankings.leaderboard
    .map((e, i) => ({ entry: e, rank: i + 1 }))
    .filter(({ entry }) => {
      const product = data.products.find((p) => p.id === entry.productId)
      return product !== undefined && !isShutdown(product)
    })
    .slice(0, ARENA_LEADERS_CAP)
    .map(({ entry, rank }) => ({
      productId: entry.productId,
      name: data.products.find((p) => p.id === entry.productId)?.name ?? entry.productId,
      overall: entry.aiEra,
      rank,
      href: `/arena/${arenaId}/product/${entry.productId}`,
    }))
  if (leaders.length === 0) return null
  return { arenaId, arenaName: data.category.name, href: `/arena/${arenaId}`, leaders }
}

// Resolve a derivation's arena-id list (in first-seen order) to vendor blocks, dropping the
// unpopulated arenas — [] is the callers' honest empty state.
export function arenaVendorBlocks(arenaIds: string[], dir?: string): ArenaVendors[] {
  return arenaIds
    .map((id) => arenaVendorLeaders(id, dir))
    .filter((a): a is ArenaVendors => a !== null)
}
