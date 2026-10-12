// Pure segmentation + hot-detection logic for the /rankings/popular page and the 🔥 chip.
// Split from lib/hotProducts.ts (the fs composer) the same way lib/popularity.ts is split from
// pipeline/stages/popularity.ts: no node builtins, so client components and tests import it
// without dragging fs into the bundle.
//
// FAIRNESS is the design constraint. You cannot rank GitHub stars against a closed SaaS
// product's adoption — they are different instruments measuring different populations — so
// popularity is presented as SEGMENTS that are never blended into one number:
//   (a) star-tracked products ranked by absolute stars (velocity shown alongside),
//   (b) package-installed products ranked by weekly npm+PyPI installs (same unit, so the sum
//       across the two registries is honest),
//   (c) curated "clearly popular" products with NO public counter (rankings/popular-products.json)
//       rendered as an UNRANKED strip — an editorial fact, never a fake number.
// Missing data is absent, never zero, and none of this ever touches the Overall score (see
// METHODOLOGY.md "Popularity — a signal, not a score").
import { z } from 'zod'
import { formatCompact } from './popularity'
import type { SeriesPoint } from './scoreTrend'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ---------- Hot detection ----------

// A growth-rate delta over a sub-3-day window is mostly fetch-time noise (and a divide-by-~0
// hazard); such windows are excluded from BOTH flagging and the fleet distribution.
export const HOT_MIN_WINDOW_DAYS = 3

// Minimum absolute star gain over the tracked window — a 40-star repo doubling is top-decile
// relative growth but not "exploding in interest".
export const HOT_MIN_STAR_DELTA = 300

// A product is tracked-hot when its relative daily growth sits in the fleet's top decile.
export const HOT_FLEET_PERCENTILE = 0.9

// Below this many qualifying growth windows the "fleet distribution" is a handful of points,
// not a distribution — no tracked-hot flags rather than flags derived from noise.
export const HOT_MIN_FLEET = 5

// Young-rocket rule: history too short to show a delta, but stars ÷ starsPerYear is exactly the
// repo's age (starsPerYear = stars/age by construction, lib/popularity.ts) — a repo this young
// with this many stars IS the explosion, measured, no history needed.
export const YOUNG_ROCKET_MAX_AGE_YEARS = 0.75
export const YOUNG_ROCKET_MIN_STARS = 10_000

export interface HotFlag {
  /** Human-readable evidence, e.g. "★ +2.1k in 8 days" — every flag carries its receipt. */
  reason: string
  /** tracked = history delta; young = star-velocity of a very young repo; curated = editorial override. */
  source: 'tracked' | 'young' | 'curated'
}

export interface StarGrowth {
  delta: number
  days: number
  /** Stars gained per day over the window. */
  perDay: number
  /** perDay relative to the window's starting star count — the fair cross-size comparator. */
  relPerDay: number
}

// Growth over the full tracked window of a star series (lib/popularityHistory.ts's
// popularitySeries output). Undefined when the window can't support a rate claim: <2 points,
// or a window shorter than HOT_MIN_WINDOW_DAYS.
export function starGrowth(points: SeriesPoint[], minDays: number = HOT_MIN_WINDOW_DAYS): StarGrowth | undefined {
  if (points.length < 2) return undefined
  const first = points[0]
  const last = points[points.length - 1]
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / MS_PER_DAY
  if (!Number.isFinite(days) || days < minDays) return undefined
  const delta = last.value - first.value
  const perDay = delta / days
  return { delta, days, perDay, relPerDay: perDay / Math.max(first.value, 1) }
}

// The tracked-hot cut line: the HOT_FLEET_PERCENTILE-th percentile of relative daily growth
// across every qualifying window in the fleet. Null when the fleet is too small to call a
// distribution, or when nothing grew at all (a threshold of 0 would flag noise).
export function hotGrowthThreshold(growths: StarGrowth[]): number | null {
  if (growths.length < HOT_MIN_FLEET) return null
  const rates = growths.map((g) => g.relPerDay).sort((a, b) => a - b)
  const threshold = rates[Math.ceil(HOT_FLEET_PERCENTILE * rates.length) - 1]
  return threshold > 0 ? threshold : null
}

export function trackedHot(growth: StarGrowth, threshold: number): HotFlag | undefined {
  if (growth.delta < HOT_MIN_STAR_DELTA) return undefined
  if (growth.relPerDay < threshold || growth.relPerDay <= 0) return undefined
  return {
    reason: `★ +${formatCompact(growth.delta)} in ${Math.max(1, Math.round(growth.days))} days`,
    source: 'tracked',
  }
}

// starsPerYear is stars ÷ repo age (lib/popularity.ts), so stars ÷ starsPerYear recovers the
// repo's exact age — letting a single popularity.json snapshot prove "32.5k stars on a
// ~6-month-old repo" with no history at all.
export function youngRocket(p: { stars?: number; starsPerYear?: number }): HotFlag | undefined {
  if (p.stars === undefined || p.starsPerYear === undefined || p.starsPerYear <= 0) return undefined
  if (p.stars < YOUNG_ROCKET_MIN_STARS) return undefined
  const ageYears = p.stars / p.starsPerYear
  if (ageYears > YOUNG_ROCKET_MAX_AGE_YEARS) return undefined
  const months = Math.max(1, Math.round(ageYears * 12))
  return {
    reason: `★ ${formatCompact(p.stars)} in ~${months} month${months === 1 ? '' : 's'} (repo age)`,
    source: 'young',
  }
}

// rankings/hot-products.json — the small curated override for things we KNOW are exploding but the
// tracked history is too short to show yet. Every entry must carry its own reason string; the
// override only fills gaps the data can't see (a mechanical flag always wins in mergeHot).
export const CuratedHotSchema = z.object({
  _comment: z.string().optional(),
  hot: z.array(
    z.object({
      productId: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
})
export type CuratedHot = z.infer<typeof CuratedHotSchema>

// Mechanical flags win over curated ones: once the data can see the explosion, the measured
// reason string replaces the editorial one.
export function mergeHot(mechanical: Map<string, HotFlag>, curated: CuratedHot['hot']): Map<string, HotFlag> {
  const merged = new Map(mechanical)
  for (const entry of curated) {
    if (!merged.has(entry.productId)) {
      merged.set(entry.productId, { reason: entry.reason, source: 'curated' })
    }
  }
  return merged
}

// ---------- Segments ----------

// One product's popularity facts flattened for the /rankings/popular page. Optional fields
// follow PopularitySchema's contract: absent = not measured, never zero.
export interface PopularEntry {
  productId: string
  name: string
  arenaId: string
  arenaName: string
  oss: boolean
  stars?: number
  starsPerYear?: number
  npmWeekly?: number
  pypiWeekly?: number
}

// npm and PyPI weekly downloads share a unit (package installs per week), so summing the two
// registries for one product is an honest total — unlike blending stars with installs, which
// never happens anywhere in this module.
export function weeklyInstalls(p: { npmWeekly?: number; pypiWeekly?: number }): number | undefined {
  if (p.npmWeekly === undefined && p.pypiWeekly === undefined) return undefined
  return (p.npmWeekly ?? 0) + (p.pypiWeekly ?? 0)
}

// The same product can compete in several arenas (same repo, same counters) — one line per
// product, keeping the best-measured record (most stars, then most installs) so the ranking
// never shows the same repo twice.
export function dedupeByProduct<T extends PopularEntry>(entries: T[]): T[] {
  const best = new Map<string, T>()
  for (const e of entries) {
    const prev = best.get(e.productId)
    if (!prev) {
      best.set(e.productId, e)
      continue
    }
    const starDiff = (e.stars ?? -1) - (prev.stars ?? -1)
    const installDiff = (weeklyInstalls(e) ?? -1) - (weeklyInstalls(prev) ?? -1)
    if (starDiff > 0 || (starDiff === 0 && installDiff > 0)) best.set(e.productId, e)
  }
  return [...best.values()]
}

// Segment (a): every product with a measured public repo, by absolute stars; stars/yr breaks
// ties. Products without a star count are simply absent (no public repo tracked ≠ zero stars).
export function rankByStars<T extends PopularEntry>(entries: T[]): T[] {
  return entries
    .filter((e) => e.stars !== undefined)
    .sort((a, b) => b.stars! - a.stars! || (b.starsPerYear ?? 0) - (a.starsPerYear ?? 0) || a.name.localeCompare(b.name))
}

// Segment (b): every product with a measured registry download count, by weekly installs.
export function rankByInstalls<T extends PopularEntry>(entries: T[]): T[] {
  return entries
    .filter((e) => weeklyInstalls(e) !== undefined)
    .sort((a, b) => weeklyInstalls(b)! - weeklyInstalls(a)! || a.name.localeCompare(b.name))
}
