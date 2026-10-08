import Link from 'next/link'
import { aiEraTooltip, type AiEraComponents, type ScoreBand } from '@/components/AiEraBadge'
import { LABELS, TITLES, type AgenticBadgeKind } from '@/components/AgenticBadge'

// The product header's score mini table (founder 2026-10-08 revision, superseding the same-day
// ScoreViewMenu dropdown — it hid too much): Overall plus the three per-dimension indexes
// render TOGETHER, one glance, no interaction. Overall is visually primary (the bigger number,
// emerald-tinted lead cell); Agent-ready / Built-in AI / API quality sit beside it as compact
// labeled cells. Server component — the grid is plain static HTML.
//
// Everything the separate pills carried rides along per cell: the derivation tooltip, the
// /score receipts anchor (each cell clicks through to this product's transparent calculation
// page), and the honesty renders — an n/a dimension (naDimensions arenas) shows n/a, and an
// untested dimension shows "untested" (unscored, not zero). That last one is the founder's
// point of the revision: an untested api-quality now says so VISIBLY in the grid rather than
// being menu-hidden (supersedes the 2026-10-02 "the api-quality pill simply doesn't render"
// rule for this surface; untested stays data everywhere else).

export interface ScoreCell {
  kind: AgenticBadgeKind
  /** The committed leaderboard value — null renders the honest n/a cell (naDimensions arenas). */
  value: number | null
  /** isGroupUntested honesty: unscored-not-zero renders "untested", never a number. */
  untested?: boolean
  /** The per-dimension /score anchor — undefined for n/a dimensions, same as the old pills. */
  href?: string
}

// One compact dimension cell: label over value, tooltip and /score anchor riding along.
function DimensionCell({ cell }: { cell: ScoreCell }) {
  const title = cell.untested
    ? `${TITLES[cell.kind]} — no evidence found or probed either way for this index: unscored, not zero.`
    : cell.href
      ? `${TITLES[cell.kind]} — see the exact calculation behind this number, with the evidence`
      : TITLES[cell.kind]
  const body = (
    <>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
        {LABELS[cell.kind]}
      </span>
      {cell.untested || cell.value === null ? (
        <span className="text-sm italic leading-none text-zinc-500">
          {cell.untested ? 'untested' : 'n/a'}
        </span>
      ) : (
        <span className="font-mono text-sm font-semibold leading-none text-zinc-200 tabular-nums">
          {cell.value.toFixed(0)}
          <span className="font-medium text-zinc-500">/100</span>
        </span>
      )}
    </>
  )
  const cellClass = 'flex flex-col justify-center gap-1 bg-zinc-950 px-3 py-2'
  return cell.href ? (
    <Link href={cell.href} title={title} className={`${cellClass} transition hover:bg-zinc-900`}>
      {body}
    </Link>
  ) : (
    <span title={title} className={cellClass}>
      {body}
    </span>
  )
}

export default function ScoreMiniTable({ overall, cells }: {
  overall: {
    value: number | null
    /** This product's /score receipts page — the exact stories, verdicts, and arithmetic. */
    href: string
    components: AiEraComponents
    /** 68% band from score-intervals.json — tooltip-only, never fabricated (see AiEraBadge). */
    interval?: ScoreBand | null
  }
  cells: ScoreCell[]
}) {
  return (
    // gap-px over the border color draws the hairline cell dividers both directions —
    // 2 columns on narrow screens, one row of four (Overall + three dimensions) on sm+.
    <div className="inline-grid w-fit grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
      <Link
        href={overall.href}
        title={aiEraTooltip(overall.components, overall.interval ?? undefined)}
        className="flex flex-col justify-center gap-1 bg-emerald-400/10 px-4 py-2 transition hover:bg-emerald-400/20"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
          Overall score
        </span>
        {overall.value === null ? (
          <span className="text-xl italic leading-none text-zinc-500">n/a</span>
        ) : (
          <span className="font-mono text-2xl font-bold leading-none text-emerald-300 tabular-nums">
            {overall.value.toFixed(0)}
            <span className="text-sm font-medium opacity-60">/100</span>
          </span>
        )}
      </Link>
      {cells.map((cell) => (
        <DimensionCell key={cell.kind} cell={cell} />
      ))}
    </div>
  )
}
