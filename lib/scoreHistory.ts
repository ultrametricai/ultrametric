// Loader + forward-fill appender for open-rankings/{cat}/score-history.jsonl — the append-only,
// change-only time series of each product's Overall score (aiEra) and agent-readiness (see
// lib/schemas.ts's ScoreHistoryEntrySchema doc). Seeded from git history by
// rankings-engine/scripts/build-score-history.ts; grown by rankings-engine/stages/derive.ts via
// appendScoreHistoryOnChange below. The pure helpers (parsing, series, 30d trend delta) live in
// lib/scoreTrend.ts so client components can use them without this module's fs dependency.
import fs from 'node:fs'
import path from 'node:path'
import type { Rankings, ScoreHistoryEntry } from './schemas'
import { parseScoreHistoryJsonl, roundScore, seriesFor, trendDelta } from './scoreTrend'

export type { ScoreHistoryEntry }
export { seriesFor, trendDelta }

export const SCORE_HISTORY_FILE = 'score-history.jsonl'

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

const historyCache = new Map<string, Map<string, ScoreHistoryEntry[]>>()

// Per-product history for one category, in file (chronological append) order. Same
// tolerant-optional contract as popularity in lib/data.ts: a category without a
// score-history.jsonl yet resolves to an empty map, and a product with no entries to
// undefined — display code renders "no history yet", never an error.
export function loadScoreHistory(categoryId: string, dir: string = DEFAULT_DIR()): Map<string, ScoreHistoryEntry[]> {
  const cacheKey = `${dir}::${categoryId}`
  const hit = historyCache.get(cacheKey)
  if (hit) return hit

  const byProduct = new Map<string, ScoreHistoryEntry[]>()
  const file = path.join(dir, categoryId, SCORE_HISTORY_FILE)
  if (fs.existsSync(file)) {
    for (const entry of parseScoreHistoryJsonl(fs.readFileSync(file, 'utf8'))) {
      const list = byProduct.get(entry.productId)
      if (list) list.push(entry)
      else byProduct.set(entry.productId, [entry])
    }
  }
  historyCache.set(cacheKey, byProduct)
  return byProduct
}

// Convenience for table rows: the 30-day trend delta of one tracked metric (Overall score /
// agent-readiness — the two series in score-history.jsonl) for one product, null when there
// aren't ≥2 plottable points yet.
export function metricTrendDelta(
  categoryId: string,
  productId: string,
  metric: 'aiEra' | 'agentReady',
  dir: string = DEFAULT_DIR(),
  now: Date = new Date(),
): number | null {
  const entries = loadScoreHistory(categoryId, dir).get(productId)
  if (!entries) return null
  return trendDelta(seriesFor(entries, metric), now)
}

// Back-compat alias: the Overall score (aiEra) flavor predates metricTrendDelta.
export function overallScoreTrendDelta(
  categoryId: string,
  productId: string,
  dir: string = DEFAULT_DIR(),
  now: Date = new Date(),
): number | null {
  return metricTrendDelta(categoryId, productId, 'aiEra', dir, now)
}

// Forward-fill: appends one line per product whose ROUNDED aiEra/agentReady differs from that
// product's last line in the file (or that has no line yet). Append-only and idempotent per
// run — re-running derive on unchanged verdicts appends nothing, because the rounded values
// still match the file's tail. Returns the number of lines appended. Mirrors
// rankings-engine/stages/popularity.ts's popularity-history.jsonl append, minus the per-run cadence.
// `note` (optional) labels every appended line with a provenance marker — used by judge-model
// migration waves so score discontinuities that reflect a judge change, not an evidence change,
// are stamped as such in the series (ScoreHistoryEntrySchema.note).
export function appendScoreHistoryOnChange(categoryDir: string, rankings: Rankings, date: string = rankings.generatedAt, note?: string): number {
  const file = path.join(categoryDir, SCORE_HISTORY_FILE)
  const existing = fs.existsSync(file) ? parseScoreHistoryJsonl(fs.readFileSync(file, 'utf8')) : []
  const last = new Map<string, ScoreHistoryEntry>()
  for (const entry of existing) last.set(entry.productId, entry)

  const lines: ScoreHistoryEntry[] = []
  for (const entry of rankings.leaderboard) {
    const aiEra = roundScore(entry.aiEra)
    const agentReady = roundScore(entry.agentReady)
    const prev = last.get(entry.productId)
    if (prev && prev.aiEra === aiEra && prev.agentReady === agentReady) continue
    lines.push({ productId: entry.productId, date, aiEra, agentReady, ...(note ? { note } : {}) })
  }
  if (lines.length > 0) {
    fs.appendFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  }
  return lines.length
}
