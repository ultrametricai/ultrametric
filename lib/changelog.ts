// Site-wide change events derived from rankings/{cat}/score-history.jsonl (see lib/scoreHistory.ts
// for the file's contract) — what /changelog and pipeline/scripts/generate-weekly-report.ts
// render. Everything here is derived, never stored: the history files stay the single source of
// truth, and re-deriving on the same files always yields the same events.
//
// Four event kinds, all honest by construction:
//   - arena-launched: a category whose first history day is later than the site's earliest
//     history day (arenas present at the epoch aren't "launches" — the epoch is just where
//     recorded history begins, see historyBegins()).
//   - product-added: a product whose first history day is later than its own arena's first day
//     (products present at arena launch are covered by the launch event's product count).
//   - overtake: a rank flip between two products, from recomputing the aiEra ranking at each
//     history timestamp (nulls unranked, ties keep the previous order so nothing "flips" on a
//     tie — mirrors lib/scoring.ts's nulls-last, stability-minded comparator).
//   - score-move: one product's aiEra moving by ≥ SCORE_MOVE_THRESHOLD between consecutive
//     recorded points.
//
// The pure derivation (deriveChangelog and friends) takes plain inputs so tests can run on
// fixtures; buildChangelog() at the bottom is the thin fs-backed assembler the page uses.
import { loadAll } from './data'
import { loadScoreHistory } from './scoreHistory'
import type { ScoreHistoryEntry } from './schemas'
import { roundScore, seriesFor } from './scoreTrend'

export const SCORE_MOVE_THRESHOLD = 2.0
export const CHANGELOG_MAX_DAYS = 30
export const CHANGELOG_MAX_EVENTS = 200

export interface ArenaHistoryInput {
  categoryId: string
  categoryName: string
  /** productId -> display name; ids missing here render by id (never an error). */
  productNames: Record<string, string>
  /** All of the arena's history entries, any order — the derivation sorts. */
  entries: ScoreHistoryEntry[]
}

export type ChangeEvent =
  | { kind: 'arena-launched'; date: string; categoryId: string; categoryName: string; productCount: number }
  | { kind: 'product-added'; date: string; categoryId: string; categoryName: string; productId: string; productName: string }
  | {
      kind: 'overtake'
      date: string
      categoryId: string
      categoryName: string
      productId: string
      productName: string
      productAiEra: number
      overtookId: string
      overtookName: string
      overtookAiEra: number
    }
  | { kind: 'score-move'; date: string; categoryId: string; categoryName: string; productId: string; productName: string; delta: number; to: number }

// UTC calendar day of an ISO timestamp (offsets normalized) — the grouping/comparison unit for
// "same day" everywhere in this module.
export function dayOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

// The earliest recorded day across all arenas — "history begins <this day>"; null only when
// there's no history anywhere yet.
export function historyBegins(arenas: ArenaHistoryInput[]): string | null {
  let min: number | null = null
  for (const arena of arenas) {
    for (const e of arena.entries) {
      const t = new Date(e.date).getTime()
      if (min === null || t < min) min = t
    }
  }
  return min === null ? null : dayOf(new Date(min).toISOString())
}

// Display/report order: newest first, then a deterministic within-timestamp order (launches
// before flips before moves before additions, then by arena/product) so re-derivation is
// byte-stable.
const KIND_ORDER: Record<ChangeEvent['kind'], number> = {
  'arena-launched': 0,
  overtake: 1,
  'score-move': 2,
  'product-added': 3,
}

function sortEvents(events: ChangeEvent[]): ChangeEvent[] {
  return events.sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime() ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.categoryId.localeCompare(b.categoryId) ||
      ('productId' in a && 'productId' in b ? a.productId.localeCompare(b.productId) : 0),
  )
}

function deriveArenaEvents(arena: ArenaHistoryInput, siteEpochDay: string): ChangeEvent[] {
  const { categoryId, categoryName, productNames, entries } = arena
  if (entries.length === 0) return []
  const nameOf = (id: string) => productNames[id] ?? id
  const events: ChangeEvent[] = []

  // Group entries by exact timestamp (one pipeline run stamps every changed product with the
  // same date), chronologically.
  const byTimestamp = new Map<string, ScoreHistoryEntry[]>()
  for (const e of entries) {
    const list = byTimestamp.get(e.date)
    if (list) list.push(e)
    else byTimestamp.set(e.date, [e])
  }
  const timestamps = [...byTimestamp.keys()].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  const arenaFirstDay = dayOf(timestamps[0])

  // First recorded day per product → arena launch (with how many products it started tracking)
  // and later product additions.
  const firstDayByProduct = new Map<string, string>()
  for (const ts of timestamps) {
    for (const e of byTimestamp.get(ts)!) {
      if (!firstDayByProduct.has(e.productId)) firstDayByProduct.set(e.productId, dayOf(ts))
    }
  }
  if (arenaFirstDay > siteEpochDay) {
    const productCount = [...firstDayByProduct.values()].filter((d) => d === arenaFirstDay).length
    events.push({ kind: 'arena-launched', date: timestamps[0], categoryId, categoryName, productCount })
  }
  for (const [productId, firstDay] of firstDayByProduct) {
    if (firstDay > arenaFirstDay) {
      // Its first timestamp, not just day, so the event sorts truthfully among that day's others.
      const firstTs = timestamps.find((ts) => byTimestamp.get(ts)!.some((e) => e.productId === productId))!
      events.push({ kind: 'product-added', date: firstTs, categoryId, categoryName, productId, productName: nameOf(productId) })
    }
  }

  // Score moves: consecutive recorded aiEra points ≥ threshold apart. seriesFor drops nulls and
  // sorts, so a null gap ("measured, not applicable" for a while) doesn't fake a move of 0.
  const byProduct = new Map<string, ScoreHistoryEntry[]>()
  for (const e of entries) {
    const list = byProduct.get(e.productId)
    if (list) list.push(e)
    else byProduct.set(e.productId, [e])
  }
  for (const [productId, productEntries] of byProduct) {
    const series = seriesFor(productEntries, 'aiEra')
    for (let i = 1; i < series.length; i++) {
      const delta = roundScore(series[i].value - series[i - 1].value)!
      if (Math.abs(delta) >= SCORE_MOVE_THRESHOLD) {
        events.push({
          kind: 'score-move',
          date: series[i].date,
          categoryId,
          categoryName,
          productId,
          productName: nameOf(productId),
          delta,
          to: series[i].value,
        })
      }
    }
  }

  // Rank flips: replay the arena's aiEra ranking at every timestamp. Ties keep the previous
  // order (no phantom flip on equal scores); products with null aiEra are unranked, exactly
  // like lib/scoring.ts's nulls-last leaderboard; a flip is only reported between two products
  // that were BOTH ranked before this timestamp — a new entrant "overtaking" nobody isn't news
  // (it's a product-added event).
  const values = new Map<string, number>()
  let prevRank = new Map<string, number>()
  for (const ts of timestamps) {
    for (const e of byTimestamp.get(ts)!) {
      if (e.aiEra === null) values.delete(e.productId)
      else values.set(e.productId, e.aiEra)
    }
    const order = [...values.keys()].sort(
      (a, b) =>
        values.get(b)! - values.get(a)! ||
        (prevRank.get(a) ?? Number.MAX_SAFE_INTEGER) - (prevRank.get(b) ?? Number.MAX_SAFE_INTEGER) ||
        a.localeCompare(b),
    )
    const rank = new Map(order.map((id, i) => [id, i]))
    for (const a of order) {
      const beforeA = prevRank.get(a)
      if (beforeA === undefined) continue
      for (const b of order) {
        const beforeB = prevRank.get(b)
        if (beforeB === undefined) continue
        if (beforeA > beforeB && rank.get(a)! < rank.get(b)!) {
          events.push({
            kind: 'overtake',
            date: ts,
            categoryId,
            categoryName,
            productId: a,
            productName: nameOf(a),
            productAiEra: values.get(a)!,
            overtookId: b,
            overtookName: nameOf(b),
            overtookAiEra: values.get(b)!,
          })
        }
      }
    }
    prevRank = rank
  }

  return events
}

// All events across all arenas, newest first. Empty input → empty output, never an error.
export function deriveChangelog(arenas: ArenaHistoryInput[]): ChangeEvent[] {
  const epoch = historyBegins(arenas)
  if (epoch === null) return []
  return sortEvents(arenas.flatMap((arena) => deriveArenaEvents(arena, epoch)))
}

// Page cap: only the most recent `maxDays` distinct days that actually have events, and at most
// `maxEvents` overall — /changelog is a recent-history page, not an archive (the history files
// remain the archive).
export function capChangelog(
  events: ChangeEvent[],
  maxDays: number = CHANGELOG_MAX_DAYS,
  maxEvents: number = CHANGELOG_MAX_EVENTS,
): ChangeEvent[] {
  const sorted = sortEvents([...events])
  const keptDays = new Set<string>()
  const out: ChangeEvent[] = []
  for (const e of sorted) {
    const day = dayOf(e.date)
    if (!keptDays.has(day)) {
      if (keptDays.size >= maxDays) break
      keptDays.add(day)
    }
    out.push(e)
    if (out.length >= maxEvents) break
  }
  return out
}

// Events newest-first grouped into [day, events] pairs, newest day first — the shape both the
// /changelog page and the weekly report's day sections render from.
export function groupByDay(events: ChangeEvent[]): Array<[string, ChangeEvent[]]> {
  const sorted = sortEvents([...events])
  const groups: Array<[string, ChangeEvent[]]> = []
  for (const e of sorted) {
    const day = dayOf(e.date)
    const last = groups[groups.length - 1]
    if (last && last[0] === day) last[1].push(e)
    else groups.push([day, [e]])
  }
  return groups
}

// fs-backed assembler: every populated arena's history (tolerant-optional — an arena without a
// score-history.jsonl contributes nothing) shaped for the pure derivation above. loadAll and
// loadScoreHistory are both cached, so calling this from several pages costs one read.
export function collectArenaHistories(dir?: string): ArenaHistoryInput[] {
  return loadAll(dir).map((data) => ({
    categoryId: data.category.id,
    categoryName: data.category.name,
    productNames: Object.fromEntries(data.products.map((p) => [p.id, p.name])),
    entries: [...loadScoreHistory(data.category.id, dir ?? undefined).values()].flat(),
  }))
}

export function buildChangelog(dir?: string): { events: ChangeEvent[]; historyBegins: string | null } {
  const arenas = collectArenaHistories(dir)
  return { events: deriveChangelog(arenas), historyBegins: historyBegins(arenas) }
}
