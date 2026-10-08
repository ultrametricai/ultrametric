// The Overall score's lead badge — deliberately more prominent than AgenticBadge (bigger type,
// solid emerald ring) since v2.4 re-prioritizes the whole site around this number. Internally
// still keyed on the `aiEra` field/formula (see README's "Overall score (formerly AI-Era Index)"
// section for the blend formula and weights) — only the display label changed.
//
// The pill itself renders a bare number (`32/100`, mono/bold) with no "Arena" prefix — the
// surrounding heading/column-header/label is responsible for saying "Overall score" once so a
// bare number is never ambiguous in context (see callers). The tooltip still carries the full
// formula + component breakdown regardless.

export interface AiEraComponents {
  agentReady: number | null
  apiQuality: number | null
  openness: number | null
  agenticApp: number | null
  automation: number | null
}

// 68% confidence band on the score, from data/{cat}/score-intervals.json (see
// lib/scoreIntervals.ts). Only ever rendered when real interval data exists — callers without a
// computed band simply omit the prop and the badge is unchanged.
export interface ScoreBand {
  low: number
  high: number
}

const FORMULA =
  'Overall score (0–100): agent-ready ×0.30 · API quality ×0.20 · openness ×0.20 · agentic app ×0.15 · automation ×0.15 (n/a components excluded, weights renormalized). Every component is evidence-judged — see /methodology.'

import Link from 'next/link'

// Half-width shown as "±N" — the tooltip carries the exact (possibly asymmetric) low–high band.
export const bandHalfWidth = (band: ScoreBand): number => Math.round((band.high - band.low) / 2)

// Exported for components/ScoreViewMenu.tsx (the product header's score dropdown): the menu's
// 'Overall score' entry carries the same derivation tooltip this pill computes.
export function aiEraTooltip(components?: AiEraComponents, band?: ScoreBand): string {
  const bandLine = band
    ? `\n±${bandHalfWidth(band)} (68% band: ${band.low.toFixed(0)}–${band.high.toFixed(0)}) — propagated from measured judge re-roll variance; untested cells widen it. See README "Score intervals".`
    : ''
  if (!components) return FORMULA + bandLine
  const fmt = (n: number | null) => (n === null ? 'n/a' : n.toFixed(0))
  return (
    `Agent-ready ${fmt(components.agentReady)} · API quality ${fmt(components.apiQuality)} · ` +
    `Openness ${fmt(components.openness)} · Agentic app ${fmt(components.agenticApp)} · ` +
    `Automation ${fmt(components.automation)}\n${FORMULA}${bandLine}`
  )
}

// One pill, three densities — the compact variants exist so every Overall score on the site wears
// the SAME visual (founder feedback 2026-09-14: no bare-text scores anywhere):
//   md — headline placements (product page hero)
//   sm — table cells (arena/mega leaderboards)
//   xs — inline/dense spots (family mini-table, stack chips, battle aggregates, /missing)
const SIZE_CLASS = {
  md: 'px-3 py-1 text-sm',
  sm: 'px-2 py-0.5 text-xs',
  xs: 'px-1.5 py-px text-[10px]',
} as const

export default function AiEraBadge({
  value,
  size = 'md',
  components,
  href,
  interval,
  showBand = false,
  label,
}: {
  value: number | null
  size?: 'md' | 'sm' | 'xs'
  components?: AiEraComponents
  // Optional click-through (e.g. /methodology#arena-score). Callers must NOT set this when the
  // badge is rendered inside another link (arena/battle cards) — nested anchors are invalid.
  href?: string
  // 68% confidence band from score-intervals.json (undefined/null when no interval data exists —
  // the badge then renders exactly as before; a band is never fabricated). When present it is
  // always appended to the tooltip. `showBand` is retired (the inline "±N" read as noise —
  // founder feedback 2026-09-11); the band now lives only in the tooltip. Prop kept so existing
  // call sites don't churn.
  interval?: ScoreBand | null
  showBand?: boolean
  // Optional label INSIDE the pill ("Overall score") — founder 2026-09-15: on the vendor page the
  // score name belongs in the pill, matching AgenticBadge's self-labeled pills; elsewhere the
  // column header/heading still carries the name and the pill stays number-only.
  label?: string
}) {
  const sizeClass = SIZE_CLASS[size]
  if (value === null) {
    return (
      <span
        title={aiEraTooltip(components)}
        className={`inline-flex w-fit items-center rounded-full bg-zinc-900 font-semibold italic text-zinc-500 ring-1 ring-zinc-800 ${sizeClass}`}
      >
        n/a
      </span>
    )
  }
  const band = interval ?? undefined
  const badge = (
    <span
      title={aiEraTooltip(components, band)}
      className={`inline-flex w-fit cursor-help items-center gap-1.5 rounded-full bg-emerald-400 font-mono font-bold text-zinc-950 ring-1 ring-emerald-300 tabular-nums ${sizeClass}`}
    >
      {label && <span className="font-sans text-[0.72em] font-semibold uppercase tracking-wide opacity-80">{label}</span>}
      {value.toFixed(0)}
      <span className="font-medium opacity-60">/100</span>
    </span>
  )
  if (href) {
    return (
      <Link href={href} title="How is this calculated?" className="inline-flex">
        {badge}
      </Link>
    )
  }
  return badge
}
