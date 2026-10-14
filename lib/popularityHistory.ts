// Loader + pure series helpers for open-rankings/{cat}/popularity-history.jsonl — the one-line-per-
// product-per-run star/download snapshots appended by pipeline/stages/popularity.ts (see its
// PopularityHistoryLine). Same tolerant-optional contract as lib/scoreHistory.ts: a category
// without the file resolves to an empty map, a product with no lines to undefined — display
// code renders nothing, never an error. Display-only, like popularity itself: never fed into
// scoring.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { PopularitySchema } from './schemas'
import type { SeriesPoint } from './scoreTrend'

// One appended line: a Popularity record plus which product it belongs to and when the pipeline
// run happened. `runAt` advances every run; `fetchedAt` only advances when the numbers were
// actually re-fetched (a <7-day-old cache hit re-appends the same fetch) — which is why series
// extraction below dedupes on fetchedAt, not runAt.
export const PopularityHistoryLineSchema = PopularitySchema.extend({
  productId: z.string().min(1),
  runAt: z.string().datetime(),
})
export type PopularityHistoryLine = z.infer<typeof PopularityHistoryLineSchema>

export const POPULARITY_HISTORY_FILE = 'popularity-history.jsonl'

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

// Blank lines tolerated (trailing-newline append convention); a malformed line is a real error —
// the file is machine-written only, same stance as lib/scoreTrend.ts's parseScoreHistoryJsonl.
export function parsePopularityHistoryJsonl(text: string): PopularityHistoryLine[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => PopularityHistoryLineSchema.parse(JSON.parse(line)))
}

const historyCache = new Map<string, Map<string, PopularityHistoryLine[]>>()

export function loadPopularityHistory(categoryId: string, dir: string = DEFAULT_DIR()): Map<string, PopularityHistoryLine[]> {
  const cacheKey = `${dir}::${categoryId}`
  const hit = historyCache.get(cacheKey)
  if (hit) return hit

  const byProduct = new Map<string, PopularityHistoryLine[]>()
  const file = path.join(dir, categoryId, POPULARITY_HISTORY_FILE)
  if (fs.existsSync(file)) {
    for (const line of parsePopularityHistoryJsonl(fs.readFileSync(file, 'utf8'))) {
      const list = byProduct.get(line.productId)
      if (list) list.push(line)
      else byProduct.set(line.productId, [line])
    }
  }
  historyCache.set(cacheKey, byProduct)
  return byProduct
}

export type PopularityMetric = 'stars' | 'npmWeekly' | 'pypiWeekly'

// One metric's plottable series for one product: lines without the metric are dropped, repeated
// appends of the SAME fetch (identical fetchedAt — the 7-day cache re-appending on every run)
// collapse to one point so a flat line means "measured again, didn't move", never "measured
// once, copied twice". Sorted by fetchedAt — when the numbers were actually true.
export function popularitySeries(lines: PopularityHistoryLine[], metric: PopularityMetric): SeriesPoint[] {
  const byFetch = new Map<string, number>()
  for (const line of lines) {
    const value = line[metric]
    if (typeof value !== 'number') continue
    if (!byFetch.has(line.fetchedAt)) byFetch.set(line.fetchedAt, value)
  }
  return [...byFetch.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
