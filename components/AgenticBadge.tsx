import Link from 'next/link'
import type { ReactNode } from 'react'

const PALETTES = {
  emerald: {
    high: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
    mid: 'bg-emerald-950/70 text-emerald-400/90 ring-emerald-900',
    low: 'bg-zinc-900 text-emerald-700 ring-zinc-800',
  },
  violet: {
    high: 'bg-violet-950 text-violet-300 ring-violet-800',
    mid: 'bg-violet-950/70 text-violet-400/90 ring-violet-900',
    low: 'bg-zinc-900 text-violet-700 ring-zinc-800',
  },
  sky: {
    high: 'bg-sky-950 text-sky-300 ring-sky-800',
    mid: 'bg-sky-950/70 text-sky-400/90 ring-sky-900',
    low: 'bg-zinc-900 text-sky-700 ring-zinc-800',
  },
} as const

export type AgenticBadgeKind = 'agent-ready' | 'agentic-app' | 'api-quality'

// Exported for components/ScoreMiniTable.tsx (the product header's score mini table) so its
// cells reuse the exact labels/derivation tooltips these pills carry.
export const LABELS: Record<AgenticBadgeKind, string> = {
  'agent-ready': 'AGENT-READY',
  'agentic-app': 'BUILT-IN AI',
  'api-quality': 'API',
}

// Hover text spelling out the distinction the short labels can't carry — the two indexes are
// easy to conflate ("agent-ready vs agentic sounds like the same thing") but measure opposite
// directions: can YOUR agent drive the product, vs does the product itself act agentically.
// One clause each (founder tooltip sweep 2026-10-02) — the long contrast essays moved to
// /methodology, which every click-through lands on.
export const TITLES: Record<AgenticBadgeKind, string> = {
  'agent-ready': 'Outside-in: can YOUR agent drive this product — API, MCP, CLI, headless runs, agent docs',
  'agentic-app': 'Inside-out: how agentic the product itself is for its users — assistants, autonomous features',
  'api-quality': 'The programmable surface — machine-readable spec, docs, sandbox, versioning discipline',
}

const COLORS: Record<AgenticBadgeKind, keyof typeof PALETTES> = {
  'agent-ready': 'emerald',
  'agentic-app': 'violet',
  'api-quality': 'sky',
}

// Renders one of the three group-scoped agenticness indexes: agent-ready ("can your agent
// drive it" — group agent-access, emerald), agentic-app ("does the product act agentically
// itself" — group agentic-features, violet), or api-quality ("how good is the API surface" —
// group api-quality, sky). null renders a muted n/a badge in the same color family so the set
// always reads as matched.
// Since v2.4 (the Overall score), these badges are secondary to AiEraBadge wherever both appear —
// `size="sm"` shrinks padding/type for those contexts (leaderboard rows, the Overall score strip).
// `showLabel={false}` drops the metric name from the pill (kept in the title + sr-only text) —
// for table columns whose header already says AGENT-READY/BUILT-IN AI, where repeating the label
// on every row says the same word N times.
export default function AgenticBadge({
  kind,
  value,
  size = 'md',
  showLabel = true,
  untested = false,
  href,
}: {
  kind: AgenticBadgeKind
  value: number | null
  size?: 'md' | 'sm'
  showLabel?: boolean
  // "Untested" honesty (lib/data-helpers.ts isGroupUntested): when every cell behind this index
  // is a zero-evidence none/na, a numeric 0 would overstate what we know — callers with
  // CategoryData in hand pass this to render "untested" instead. Optional so existing callers
  // keep the numeric render.
  untested?: boolean
  // Optional click-through to where the index is explained (usually /methodology#ai-era, the
  // Overall-score component table these two indexes feed). Callers must NOT set this when the badge
  // already renders inside another link — nested anchors are invalid.
  href?: string
}) {
  const label = LABELS[kind]
  const palette = PALETTES[COLORS[kind]]
  const sizeClass = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0 text-[10px]'
  // Two click-through destinations exist: the generic /methodology (how the index is measured)
  // and a product's own /score page (the transparent per-vendor calculation) — the link title
  // says which one the reader will land on.
  const hrefTitle = href?.includes('/score')
    ? `${TITLES[kind]} — see the exact calculation behind this number, with the evidence`
    : `${TITLES[kind]} — how it's measured, on /methodology`
  const wrap = (badge: ReactNode) =>
    href ? (
      <Link
        href={href}
        title={hrefTitle}
        className="um-pill-link w-fit"
      >
        {badge}
      </Link>
    ) : (
      badge
    )
  if (untested) {
    return wrap(
      <span
        title={href ? undefined : `${TITLES[kind]} — no evidence found or probed either way for this index: unscored, not zero.`}
        className={`inline-flex w-fit items-center rounded-full bg-zinc-900 font-medium italic text-zinc-500 ring-1 ring-zinc-800 ${sizeClass}`}
      >
        {showLabel ? `${label} untested` : 'untested'}
      </span>,
    )
  }
  if (value === null) {
    return wrap(
      <span title={href ? undefined : TITLES[kind]} className={`inline-flex w-fit items-center rounded-full bg-zinc-900 font-medium italic text-zinc-400 ring-1 ring-zinc-800 ${sizeClass}`}>
        {showLabel ? `${label} n/a` : 'n/a'}
      </span>,
    )
  }
  const style = value >= 66 ? palette.high : value >= 33 ? palette.mid : palette.low
  return wrap(
    <span title={href ? undefined : TITLES[kind]} className={`inline-flex w-fit items-center gap-1 rounded-full font-medium ring-1 ${style} ${sizeClass}`}>
      {showLabel ? label : <span className="sr-only">{label}</span>}
      {/* "/100" spelled out on every numeric render (founder ask 2026-09-15: a bare "72" reads
          as arbitrary; "72/100" reads as a score) — muted like AiEraBadge's suffix. */}
      <span className="font-mono tabular-nums">{value.toFixed(0)}<span className="font-medium opacity-60">/100</span></span>
    </span>,
  )
}
