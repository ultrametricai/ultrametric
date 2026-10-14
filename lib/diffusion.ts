import path from 'node:path'
import type { GlobalStoryCell } from './globalStories'
import { loadScoreHistory } from './scoreHistory'

// Capability diffusion curves: for one global canon story (lib/globalStories.ts), the share of
// tracked products whose verdict is full/partial, month by month.
//
// HONEST APPROXIMATION — read before trusting the curve. Verdict-change history is not stored
// per cell (score-history.jsonl tracks scores, judge caches get rewritten), so the curve does
// NOT show when each product ADOPTED the capability. It shows adoption among products AS THEY
// ENTER TRACKING: the denominator at month M is every (arena, product) cell first tracked at or
// before M (first score-history entry = the product's entry into tracking), and the numerator
// counts those cells whose CURRENT verdict is full/partial — i.e. each product is assumed to
// have held its current verdict since it entered. Exact per-cell verdict history starts
// accruing only from here forward. Every rendering of the curve must carry this caveat (see
// app/global/[story]/page.tsx).
//
// The curve math is pure (tested in lib/__tests__/diffusion.test.ts against fixtures); only
// firstTrackedLookup at the bottom touches fs, via lib/scoreHistory.ts's cached loader.

export interface DiffusionPoint {
  // Calendar month, 'YYYY-MM'.
  month: string
  // Cells (arena, product pairs) first tracked at or before this month.
  tracked: number
  // Of those, cells whose current verdict is full or partial.
  adopters: number
  // 100 * adopters / tracked, 1-decimal.
  pct: number
}

export type FirstTracked = (cell: GlobalStoryCell) => string | null

const isAdopter = (cell: GlobalStoryCell) => cell.verdict === 'full' || cell.verdict === 'partial'

const monthOf = (date: string) => date.slice(0, 7)

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

// Headline stat: adoption among ALL cells right now (no tracking dates involved) — "official
// MCP servers: X% of N tracked products".
export function adoptionNow(cells: GlobalStoryCell[]): { adopters: number; total: number; pct: number } {
  const adopters = cells.filter(isAdopter).length
  return {
    adopters,
    total: cells.length,
    pct: cells.length === 0 ? 0 : Math.round((adopters / cells.length) * 1000) / 10,
  }
}

// One point per calendar month from the earliest first-tracked cell through `now`, inclusive.
// Cells without a first-tracked date (no score-history yet) are excluded from the curve — they
// still count in adoptionNow. Returns [] when no cell has a tracking date.
export function diffusionCurve(cells: GlobalStoryCell[], firstTracked: FirstTracked, now: Date = new Date()): DiffusionPoint[] {
  const dated = cells.flatMap((cell) => {
    const date = firstTracked(cell)
    return date ? [{ month: monthOf(date), adopter: isAdopter(cell) }] : []
  })
  if (dated.length === 0) return []

  const start = dated.reduce((min, d) => (d.month < min ? d.month : min), dated[0].month)
  const end = monthOf(now.toISOString())

  const points: DiffusionPoint[] = []
  for (let month = start; month <= end; month = nextMonth(month)) {
    const entered = dated.filter((d) => d.month <= month)
    if (entered.length === 0) continue
    const adopters = entered.filter((d) => d.adopter).length
    points.push({
      month,
      tracked: entered.length,
      adopters,
      pct: Math.round((adopters / entered.length) * 1000) / 10,
    })
  }
  return points
}

// fs-backed FirstTracked: a cell's entry into tracking is its product's first line in that
// arena's score-history.jsonl (seeded from git history, grown by derive — lib/scoreHistory.ts).
// Null when the arena has no history file or the product no entries yet.
export function firstTrackedLookup(dir: string = path.join(process.cwd(), 'open-rankings')): FirstTracked {
  return (cell) => {
    const entries = loadScoreHistory(cell.categoryId, dir).get(cell.productId)
    if (!entries || entries.length === 0) return null
    // File order is append order, but compare timestamps defensively (dates mix "Z" and
    // offset forms, so string order isn't chronological) — same reasoning as seriesFor.
    return entries.reduce((min, e) => (new Date(e.date).getTime() < new Date(min).getTime() ? e.date : min), entries[0].date)
  }
}
