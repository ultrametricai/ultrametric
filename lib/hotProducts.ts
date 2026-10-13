// fs composer for the 🔥 "hot right now" flags — wires lib/popularRanking.ts's pure detection
// to the committed data files, the same loader/pure split as lib/scoreHistory.ts vs
// lib/scoreTrend.ts. Consumed by lib/megaTable.ts (homepage rows), the arena pages
// (ArenaTable's hotReasons prop), and app/rankings/popular/page.tsx.
//
// A product is hot when EITHER:
//   - tracked: its star growth over the tracked popularity-history window sits in the fleet's
//     top decile (with an absolute floor) — see popularRanking.trackedHot; or
//   - young rocket: its popularity.json snapshot alone proves a very young repo with a big
//     star count — see popularRanking.youngRocket; or
//   - curated: rankings/hot-products.json names it with a reason (only for what the data can't see
//     yet — mechanical flags always win).
// Every flag carries a concrete reason string. Display-only, like popularity itself: never fed
// into scoring.
import fs from 'node:fs'
import path from 'node:path'
import type { CategoryData } from './data-helpers'
import { loadPopularityHistory, popularitySeries } from './popularityHistory'
import {
  CuratedHotSchema,
  hotGrowthThreshold,
  mergeHot,
  starGrowth,
  trackedHot,
  youngRocket,
  type HotFlag,
  type StarGrowth,
} from './popularRanking'

export const HOT_PRODUCTS_FILE = 'hot-products.json'

const DEFAULT_DIR = () => path.join(process.cwd(), 'rankings')

export function loadCuratedHot(dir: string = DEFAULT_DIR()): ReturnType<typeof CuratedHotSchema.parse>['hot'] {
  const file = path.join(dir, HOT_PRODUCTS_FILE)
  if (!fs.existsSync(file)) return []
  return CuratedHotSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).hot
}

// Keyed by dir only: every caller passes the (cached) loadAll(dir) output for that dir, so the
// categories argument is stable per dir — same caching stance as lib/popularityHistory.ts.
const flagCache = new Map<string, Map<string, HotFlag>>()

// productId -> HotFlag across every arena. A product competing in several arenas is one repo
// with one set of counters, so flags are global per product; per-(arena,product) growths are
// still computed separately and the strongest signal wins.
export function computeHotFlags(categories: CategoryData[], dir: string = DEFAULT_DIR()): Map<string, HotFlag> {
  const hit = flagCache.get(dir)
  if (hit) return hit

  // Fleet pass: every qualifying star-growth window across every arena — the distribution the
  // top-decile threshold is drawn from.
  const growths: { productId: string; growth: StarGrowth }[] = []
  for (const data of categories) {
    const history = loadPopularityHistory(data.category.id, dir)
    for (const [productId, lines] of history) {
      const growth = starGrowth(popularitySeries(lines, 'stars'))
      if (growth) growths.push({ productId, growth })
    }
  }
  const threshold = hotGrowthThreshold(growths.map((g) => g.growth))

  const mechanical = new Map<string, HotFlag>()
  if (threshold !== null) {
    // Strongest window wins when the same product is tracked in several arenas.
    const bestGrowth = new Map<string, StarGrowth>()
    for (const { productId, growth } of growths) {
      const prev = bestGrowth.get(productId)
      if (!prev || growth.relPerDay > prev.relPerDay) bestGrowth.set(productId, growth)
    }
    for (const [productId, growth] of bestGrowth) {
      const flag = trackedHot(growth, threshold)
      if (flag) mechanical.set(productId, flag)
    }
  }

  // Young rockets from the popularity.json snapshots — only where no tracked flag already
  // carries a measured delta.
  for (const data of categories) {
    for (const [productId, p] of Object.entries(data.popularity)) {
      if (mechanical.has(productId)) continue
      const flag = youngRocket(p)
      if (flag) mechanical.set(productId, flag)
    }
  }

  const merged = mergeHot(mechanical, loadCuratedHot(dir))
  flagCache.set(dir, merged)
  return merged
}

// Serializable productId -> reason map for ONE arena's client table (ArenaTable's hotReasons
// prop) — computed server-side because the fleet threshold needs every arena's history.
export function hotReasonsForCategory(categories: CategoryData[], data: CategoryData, dir?: string): Record<string, string> {
  const flags = computeHotFlags(categories, dir)
  const reasons: Record<string, string> = {}
  for (const product of data.products) {
    const flag = flags.get(product.id)
    if (flag) reasons[product.id] = flag.reason
  }
  return reasons
}
