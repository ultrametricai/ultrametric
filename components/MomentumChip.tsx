import { belowCompactStarsFloor, formatCompact, hasSignal } from '@/lib/popularity'
import type { Popularity } from '@/lib/schemas'

// Momentum/popularity chip — a keyless, evidence-free "will this project be alive tomorrow?"
// signal (see pipeline/stages/popularity.ts). Deliberately NOT styled like AiEraBadge/ScoreBar
// (no emerald "score" treatment): this is adoption data from public registries, not a judged
// verdict, and must never look like it's part of the Overall score (see METHODOLOGY.md's
// "Popularity is not part of the Overall score" section).
//
// No signal renders NOTHING, in both variants (founder 2026-10-08): in compact (dense table
// cells) so a column full of empty products doesn't turn into a wall of muted placeholder text,
// and in the full-size variant (product page header) because the absence of the chip IS the
// absence of a signal — the muted "no public signals" text it used to show there was noise.
//
// PyPI installs render only in the full-size variant (founder 2026-09-30: no PyPI data in the
// ranking tables — compact IS the ranking-table variant). The data stays committed and still
// shows on product pages; a pypi-only record counts as no signal in compact mode.
//
// Compact also suppresses a stars-only record under COMPACT_STARS_FLOOR (founder 2026-10-02,
// the ByteAsk case — see lib/popularity.ts): a lonely "★ 24 ▲ 89/yr" in a ranking row read as
// "$89/yr" pricing, and an annualized rate extrapolated from a weeks-old repo is noise, not an
// adoption signal. Data untouched; the product page's full-size chip shows everything.
export default function MomentumChip({
  popularity,
  compact = false,
}: {
  popularity: Popularity | undefined
  compact?: boolean
}) {
  const compactSignal =
    popularity !== undefined &&
    (popularity.stars !== undefined || popularity.starsPerYear !== undefined || popularity.npmWeekly !== undefined) &&
    !belowCompactStarsFloor(popularity)
  if (!hasSignal(popularity) || (compact && !compactSignal)) return null

  const title = `Popularity signal as of ${popularity.fetchedAt.slice(0, 10)} — sourced from public registries (GitHub/npm/PyPI), not part of the Overall score.`

  return (
    <span title={title} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-zinc-400">
      {popularity.stars !== undefined && (
        <span title="GitHub stars" className="text-zinc-300">★ {formatCompact(popularity.stars)}</span>
      )}
      {popularity.starsPerYear !== undefined && (
        <span className="text-emerald-400">▲ {formatCompact(popularity.starsPerYear)}/yr</span>
      )}
      {popularity.npmWeekly !== undefined && <span>npm {formatCompact(popularity.npmWeekly)}/wk</span>}
      {!compact && popularity.pypiWeekly !== undefined && <span>pypi {formatCompact(popularity.pypiWeekly)}/wk</span>}
    </span>
  )
}
