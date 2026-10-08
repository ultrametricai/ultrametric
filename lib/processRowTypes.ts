import type { GeoNotesByCountry } from '@/lib/geoPreference'
import type { ProcessKind, Urgency } from '@/lib/processSim'

// Row shapes for the founder-process tables. These types live in lib (not components) so the
// server-side row builders (lib/processRows.ts, lib/shared-processes/index-rows.ts) and the
// client table (components/ProcessesTable.tsx) both import them from the artifact side of the
// repo-split boundary (docs/REPO-SPLIT-PLAN.md, lib hard case): lib never imports from
// components.

export interface ProcessRow {
  slug: string
  title: string
  // Curated emoji for this process (lib/processIcons.ts), resolved server-side by task id.
  icon: string
  phase: string
  // Friendly display area over the internal phase (lib/processRows.ts PHASE_AREA — curated and
  // totality-tested) plus its founder-lifecycle rank (AREA_ORDER index), both resolved
  // server-side so the client table component never imports the node-only builder.
  area: string
  areaRank: number
  // The GEO dimension (founder 2026-09-28) — required on every corpus process. us/us-state
  // rows wear the 🇺🇸 flag after the title (usFlagGlyph — keyed strictly on geoScope, founder
  // 2026-10-02); global rows wear no scope glyph. Never re-sorts — and since the country-view
  // filter (founder 2026-10-02) the scope also feeds hiddenInCountryView.
  geoScope: 'global' | 'us' | 'us-state'
  // The country-view filter data (founder 2026-10-02: "?geo=in should hide the processes that
  // are not used in that country"): per country, the committed note's curated kind + its own
  // summary (rendered on the detail pages — ProcessGeoNotes; the table's hidden-rows
  // disclosure is gone, founder 2026-10-05). {} on global rows — they never filter.
  geoNotesByCountry: GeoNotesByCountry
  pct: number
  agentSteps: number
  totalSteps: number
  complexity: string
  // Record kind (founder 2026-10-01): 'situation' rows are reactive — they render `trigger`
  // as their subtitle, wear the `urgency` chip, and carry timeOrder null (no founder-timeline
  // slot; they sort after the timeline — see timelineRank in components/ProcessesTable.tsx).
  kind: ProcessKind
  trigger: string | null
  urgency: Urgency | null
  // The five-orderings fields (curated in processes/corpus.json; cadence label/rank resolved
  // server-side so the client table stays free of the node-only cadence helpers). timeOrder is
  // null on kind 'situation'.
  timeOrder: number | null
  cadenceLabel: string
  cadenceRank: number
  annoyance: number
  risk: number
  growthImpact: number
  vendors: Array<{ id: string; label: string; arena: string | null; hasLogo: boolean }>
}

// A curated end-to-end chain (journeys/chains.json) as a row in the SAME table (founder
// 2026-09-29: one view for the processes under the process search — the separate playbooks
// section is gone). Serialized server-side by lib/processRows.ts buildPlaybookRows.
export interface PlaybookRow {
  id: string
  title: string
  tagline: string
  icon: string
  href: string
  // The dominant area — the area of the chain's FIRST constituent process (founder 2026-09-29:
  // playbooks are still processes, so a chain row folds into an area group, not its own group)
  // — with its lifecycle rank and that first constituent's timeOrder, all resolved server-side,
  // so the grouped view slots the row into the area at its journey position.
  dominantArea: string
  areaRank: number
  timeOrder: number
  // The constituent processes (icon chips in the Phase column) and their distinct phases —
  // the phase filter scopes playbooks by membership, not by a single phase they don't have.
  processes: Array<{ id: string; icon: string; title: string; phase: string }>
  phases: string[]
  // Aggregate agent ceiling across every step of every process in the chain.
  pct: number
  agentSteps: number
  totalSteps: number
  steps: Array<{ label: string; route: 'agent' | 'form' | 'person'; legalSignature: boolean }>
  // The combined vendor cell (founder 2026-10-02: show the vendors, not a 'Go to process' link)
  // — the constituent processes' vendor chips, deduped in journey order, same shape and cap as
  // a process row's.
  vendors: Array<{ id: string; label: string; arena: string | null; hasLogo: boolean }>
}

// Shared records can lack legacy index metrics. Missing values stay blank and sort last.
type OptionalIndexField = 'geoScope' | 'pct' | 'agentSteps' | 'timeOrder' | 'cadenceLabel' | 'cadenceRank' | 'annoyance' | 'risk' | 'growthImpact'
export type ProcessTableRow = Omit<ProcessRow, OptionalIndexField> & {
  [K in OptionalIndexField]: ProcessRow[K] | null
} & { href?: string }
