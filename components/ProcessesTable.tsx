'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import CeilingBar from '@/components/CeilingBar'
import IconChip from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import TableControls from '@/components/TableControls'
import UrgencyChip from '@/components/UrgencyChip'
import { useGeoSelection } from '@/components/useGeoSelection'
import { hiddenInCountryView, usFlagGlyph } from '@/lib/geoPreference'
import { phaseEmoji, phaseIcon, phaseTooltip, RANK_PRESET_ICONS } from '@/lib/processIcons'
import { URGENCY_TIERS } from '@/lib/processSim'
import type { PlaybookRow, ProcessRow, ProcessTableRow } from '@/lib/processRowTypes'
import { readParams, setParams } from '@/lib/urlState'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The /processes controller: one dense sortable/filterable table over the whole founder-process
// corpus (mega-table pattern — see components/MegaTable.tsx), replacing the phase-grouped card
// list. Rows are pre-flattened server-side; every row clicks out to its own process page.
// Each row leads with its curated process icon (lib/processIcons.ts) and its software chips
// carry real product logos (hasLogo resolved server-side — ProductLogoView is client-safe).
//
// Founder-timeline default (founder 2026-09-30: "bring back Rank By and default onto Founder
// timeline"): the table opens FLAT, sorted by timeOrder — the journey a founder actually walks
// — with the rank-by dropdown visibly showing 'Founder timeline'. The grouped-by-area view
// (founder 2026-09-28: friendly founder-lifecycle areas — the curated phase→area map in
// lib/processRows.ts — header rows carrying the process count, rows in timeOrder within each
// area) is now the dropdown's TOP entry 'Grouped by area' instead of the no-param default.
// Grouping and cross-corpus sorting still can't coexist honestly, so picking any rank-by
// preset or column sort from the grouped view switches back to the flat sorted table.
//
// ONE combined view (founder 2026-09-29): the curated end-to-end chains are rows in this same
// table. Founder follow-up the same day ("we don't need to say 'playbook' on those playbooks…
// playbooks are still processes — just more abstract or general processes with higher
// complexity"): no 'playbook' chip and no leading group — in the grouped view each chain row
// folds into its DOMINANT area (its first constituent process's area) at that constituent's
// timeOrder position; the constituent icon chips + route-dot strip signal composition without a
// category label. The flat view keeps its semantics: interleaved where the sort applies to the
// aggregate ceiling/title, appended after the processes on the per-process orderings.
// The /processes page passes `playbooks`; surfaces that omit it (the homepage's process mode)
// render exactly the process-only table they always did.
//
// Rank-by presets (founder ask 2026-09-18) — beyond the agent ceiling, five curated orderings
// over the corpus (fields on processes/corpus.json, coverage-tested):
//   Founder timeline — timeOrder, the sequence a founder actually hits these processes;
//   Regularity       — cadence, daily loops first through one-time setup;
//   Most annoying    — annoyance 1–5, the drudgery score;
//   Riskiest         — risk 1–5, cost of getting it wrong (legal/tax/security exposure);
//   Growth-focused   — growthImpact 1–5, how directly it drives revenue/user growth.
// The metric column adapts to the active preset so the number being ranked on is always visible.

// Row types (ProcessRow, PlaybookRow, ProcessTableRow) are defined in lib/processRowTypes.ts
// (repo-split boundary, docs/REPO-SPLIT-PLAN.md lib hard case: the server-side row builders in
// lib and this client table share them, and lib never imports from components). Re-exported
// here so existing importers keep working.
export type { PlaybookRow, ProcessRow, ProcessTableRow }

function compareValues(a: number | string | null, b: number | string | null, direction: Direction = 'asc') {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  const result = typeof a === 'string' ? a.localeCompare(String(b)) : a - Number(b)
  return direction === 'desc' ? -result : result
}

// The Steps column is gone (founder 2026-10-02 — the detail pages carry the per-step story);
// agentSteps/totalSteps stay row DATA (tooltips, other surfaces), just not a column or sort axis.
type Column = 'title' | 'phase' | 'pct' | 'order' | 'cadence' | 'annoyance' | 'risk' | 'growth'
type Direction = 'asc' | 'desc'

// Columns whose preset/default direction is ascending (timeline runs first→last; regularity
// runs daily→once). Everything numeric-desc otherwise.
const ASC_DEFAULT = new Set<Column>(['title', 'phase', 'order', 'cadence'])
const defaultDirection = (col: Column): Direction => (ASC_DEFAULT.has(col) ? 'asc' : 'desc')

// Shareable ?order= values (founder 2026-09-21, lib/urlState.ts): every pickable column, with
// the timeOrder column spelled 'timeline' in the URL (?order=order reads badly; ?order=timeline
// says what it is). Bad values fall back silently, any valid ?order= opens the flat sorted
// table, and both `timeline` and the raw `order` are accepted on read. Since 2026-09-30 the
// no-param default is the flat FOUNDER-TIMELINE sort — so the UI elides ?order= for timeline
// (the new default) and writes every other ordering, pct now included; the grouped-by-area
// view (the former 2026-09-28 default) is shareable as ?order=grouped.
const ALL_COLUMNS: readonly Column[] = ['title', 'phase', 'pct', 'order', 'cadence', 'annoyance', 'risk', 'growth']
const columnToParam = (col: Column): string => (col === 'order' ? 'timeline' : col)
function paramToColumn(value: string | null): Column | null {
  if (value === null) return null
  if (value === 'timeline') return 'order'
  return (ALL_COLUMNS as readonly string[]).includes(value) ? (value as Column) : null
}

// The rank-by dropdown's values: the sortable columns plus the grouped-by-area view (founder
// 2026-09-30: grouping is a secondary option now, the TOP entry of the dropdown).
type PresetCol = Column | 'grouped'

// Icons are the house `pi:` tokens (lib/processIcons.ts RANK_PRESET_ICONS — founder 2026-10-08:
// the dropdown's raw emoji join the custom set); the emoji survive only as the mobile native
// <select>'s text-only option decoration (TableControls renders them, never the token string).
const PRESETS: Array<{ col: PresetCol; label: string; icon: string; emoji: string }> = [
  { col: 'grouped', label: 'Grouped by area', ...RANK_PRESET_ICONS.grouped },
  { col: 'order', label: 'Founder timeline', ...RANK_PRESET_ICONS.order },
  { col: 'pct', label: 'Most automatable', ...RANK_PRESET_ICONS.pct },
  { col: 'cadence', label: 'Regularity', ...RANK_PRESET_ICONS.cadence },
  { col: 'annoyance', label: 'Most annoying', ...RANK_PRESET_ICONS.annoyance },
  { col: 'risk', label: 'Riskiest', ...RANK_PRESET_ICONS.risk },
  { col: 'growth', label: 'Growth-focused', ...RANK_PRESET_ICONS.growth },
]

// The adaptive metric column: which of the five orderings it currently shows. Defaults to the
// regularity axis when the sort lives elsewhere (ceiling, title…).
type Metric = 'order' | 'cadence' | 'annoyance' | 'risk' | 'growth'
const METRIC_META: Record<Metric, { header: string; tooltip: string }> = {
  order: { header: 'Timeline', tooltip: 'The order a founder typically hits this process — incorporation first, then banking, payroll, …' },
  cadence: { header: 'Cadence', tooltip: 'How often this really recurs in a running company — daily loops through one-time setup' },
  annoyance: { header: 'Annoyance', tooltip: 'Curated drudgery score: how much of a toil this is to do by hand (1–5)' },
  risk: { header: 'Risk', tooltip: 'Cost of getting it wrong — legal, tax, and security exposure (1–5)' },
  growth: { header: 'Growth impact', tooltip: 'How directly this process drives revenue and user growth (1–5)' },
}

// The timeline-axis handling for situations, PINNED (founder 2026-10-01): a situation has no
// timeOrder slot — it is reactive, not a stop on the journey — so on the timeline axis every
// situation sorts AFTER every timeline process, and the situation tail orders by urgency
// (hours → days → weeks: the hotter clock reads first), then title. Every OTHER axis (ceiling,
// risk, annoyance, cadence…) interleaves situations honestly — they have real values there.
const timelineRank = (row: ProcessTableRow): number => row.timeOrder ?? Number.MAX_SAFE_INTEGER
const urgencyRank = (row: ProcessTableRow): number => (row.urgency ? URGENCY_TIERS.indexOf(row.urgency) : -1)
const timelineCompare = (a: ProcessTableRow, b: ProcessTableRow): number =>
  timelineRank(a) - timelineRank(b) || urgencyRank(a) - urgencyRank(b) || a.title.localeCompare(b.title)

function fieldOf(row: ProcessTableRow, col: Column): number | string | null {
  if (col === 'title') return row.title
  if (col === 'phase') return row.phase
  if (col === 'pct') return row.pct
  if (col === 'order') return row.timeOrder === null && row.kind !== 'situation' ? null : timelineRank(row)
  if (col === 'cadence') return row.cadenceRank
  if (col === 'annoyance') return row.annoyance
  if (col === 'risk') return row.risk
  return row.growthImpact
}

// 1–5 score rendered as dots, tooltip carries the number.
function ScoreDots({ value, label }: { value: number; label: string }) {
  return (
    <span title={`${label}: ${value}/5`} className="font-mono text-xs tracking-tight text-zinc-300">
      <span className="text-emerald-300">{'●'.repeat(value)}</span>
      <span className="text-zinc-700">{'○'.repeat(5 - value)}</span>
    </span>
  )
}

function SortableTh({
  children, col, current, direction, onSort, sortable = true, className = '',
}: {
  children: ReactNode
  col: Column
  // null while the grouped view is active — no column is sorted-on, so none reads as current.
  current: Column | null
  direction: Direction
  onSort: (col: Column) => void
  sortable?: boolean
  className?: string
}) {
  if (!sortable) {
    return <th scope="col" className={`sticky top-0 z-20 bg-zinc-950 px-2 py-2 font-normal ${className}`}>{children}</th>
  }
  const isCurrent = col === current
  const ariaSort: 'ascending' | 'descending' | 'none' = !isCurrent ? 'none' : direction === 'asc' ? 'ascending' : 'descending'
  return (
    <th scope="col" aria-sort={ariaSort} className={`sticky top-0 z-20 bg-zinc-950 px-2 py-2 font-normal ${className}`}>
      <button type="button" onClick={() => onSort(col)} className={`flex items-center gap-1 whitespace-nowrap hover:text-emerald-300 ${isCurrent ? 'text-emerald-300' : ''}`}>
        {children}
        {isCurrent && <span aria-hidden>{direction === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

// The columns a playbook honestly has a value for (aggregate ceiling, its name). On any
// other sort — the five curated per-process orderings and phase — playbooks lack the field, so
// the flat view lists them AFTER the sorted processes (missing values last), ceiling-desc.
const PLAYBOOK_SORTABLE = new Set<Column>(['title', 'pct'])
function playbookFieldOf(row: PlaybookRow, col: Column): number | string {
  if (col === 'title') return row.title
  return row.pct
}

// The flat view's union row type: process and playbook rows sorted through one comparator.
type FlatItem = { kind: 'process'; row: ProcessTableRow } | { kind: 'playbook'; row: PlaybookRow }

export default function ProcessesTable({
  rows,
  phases,
  playbooks = [],
}: {
  rows: ProcessTableRow[]
  phases: string[]
  playbooks?: PlaybookRow[]
}) {
  // The founder-timeline flat sort is the default view (founder 2026-09-30); the grouped-by-
  // area view is opt-in via the rank-by dropdown's top entry. Column/direction only apply while
  // grouped is off — grouping and cross-corpus sorting can't coexist honestly.
  const [grouped, setGrouped] = useState(false)
  const [column, setColumn] = useState<Column>('order')
  const [direction, setDirection] = useState<Direction>('asc')
  const [phase, setPhase] = useState('all')
  const [query, setQuery] = useState('')
  // Cadence click-to-filter (founder 2026-10-02): clicking a cadence value in a row scopes the
  // table to that cadence; clicking the same value again clears it. Client state only — the
  // cadence cell is the control and the visible active state, no URL param.
  const [cadence, setCadence] = useState<string | null>(null)
  // Non-null while the reader has a non-US country selected (the header country control —
  // components/HeaderGeoControl.tsx — seeds the shared store). The scope glyph is selection-independent since the founder batch 2026-10-02:
  // us/us-state rows always wear the 🇺🇸 flag (usFlagGlyph — strictly geoScope-keyed, the label
  // telling federal from state work) and global rows wear nothing, identically in the server
  // render and under any selection. Never re-sorts; since the country-view filter (founder
  // 2026-10-02, tightened 2026-10-05: a non-global view must not show US-only processes) a
  // COUNTRY selection hides EVERY US-scoped row (hiddenInCountryView — 'analog' notes
  // included) — the no-selection default and 🌐 Global keep the full corpus. The country
  // filter just filters (founder 2026-10-05: the hidden-rows disclosure line is gone) — the
  // per-country analog story lives on each process detail page (ProcessGeoNotes).
  const geo = useGeoSelection()

  // Shareable-view URL state (lib/urlState.ts), read once on mount so the static HTML is
  // untouched: ?order=<preset>, ?phase=<phase>, ?pq=<text> (pq, not q — this table co-mounts
  // with MegaTable on the homepage's process mode and the two filters must coexist). Invalid
  // values fall back to the defaults silently.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     (external system). The static HTML must render the default view, so these cannot be useState
     initializers (hydration mismatch); the effect runs once and renders at most one extra pass. */
  useEffect(() => {
    const p = readParams()
    const raw = p.get('order')
    if (raw === 'grouped') {
      // The shareable grouped-by-area view (the former no-param default, founder 2026-09-28).
      setGrouped(true)
      setColumn('pct')
      setDirection('desc')
    } else {
      const col = paramToColumn(raw)
      if (col !== null) {
        // Any shared column ?order= opens the FLAT sorted table in its preset direction.
        // ?order=timeline is accepted on read even though the UI elides it on write (it IS
        // the no-param default since 2026-09-30).
        setGrouped(false)
        setColumn(col)
        setDirection(defaultDirection(col))
      }
    }
    const ph = p.get('phase')
    if (ph !== null && phases.includes(ph)) setPhase(ph)
    const q = p.get('pq')
    if (q !== null && q !== '') setQuery(q)
    // Mount-only by design: the URL is the INITIAL view; after that the reader's clicks own it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Every phase change (the <select> AND the in-row phase buttons) mirrors into ?phase=,
  // with the 'all' default elided.
  function changePhase(value: string) {
    setPhase(value)
    setParams({ phase: value === 'all' ? null : value })
  }

  // Sort changes mirror into ?order= (the founder-timeline default elided). Direction is
  // deliberately NOT in the URL: a shared ordering opens in its preset direction — the
  // orderings are what's shared. Any sort leaves the grouped view for the flat table.
  function changeSort(col: Column, dir: Direction) {
    setGrouped(false)
    setColumn(col)
    setDirection(dir)
    setParams({ order: col === 'order' ? null : columnToParam(col) })
  }

  // The dropdown's 'Grouped by area' entry: the founder-lifecycle grouped view, shareable.
  function pickGrouped() {
    setGrouped(true)
    setColumn('pct')
    setDirection('desc')
    setParams({ order: 'grouped' })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        // The country-view filter (founder 2026-10-02, tightened 2026-10-05): under a country
        // selection every US-scoped row hides — the committed analogs live on the process
        // detail pages. No selection / 🌐 Global ⇒ geo is null ⇒ the full corpus, as before.
        (geo === null || !hiddenInCountryView(r, geo))
        && (phase === 'all' || r.phase === phase)
        && (cadence === null || r.cadenceLabel === cadence)
        && (q === '' || r.title.toLowerCase().includes(q) || r.vendors.some((v) => v.label.toLowerCase().includes(q))),
    )
  }, [rows, phase, cadence, query, geo])

  // Playbooks live in the same table under the same controls (founder 2026-09-29): the phase
  // filter keeps a playbook while any of its constituent processes is in that phase; the text
  // filter matches its name, tagline, and constituent process titles.
  const filteredPlaybooks = useMemo(() => {
    const q = query.trim().toLowerCase()
    // A chain row has no cadence of its own (its metric cell is the honest dash), so an active
    // cadence filter scopes to process rows only.
    if (cadence !== null) return []
    return playbooks.filter(
      (p) =>
        (phase === 'all' || p.phases.includes(phase))
        && (q === ''
          || p.title.toLowerCase().includes(q)
          || p.tagline.toLowerCase().includes(q)
          || p.processes.some((t) => t.title.toLowerCase().includes(q))),
    )
  }, [playbooks, phase, cadence, query])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = fieldOf(a, column)
      const bv = fieldOf(b, column)
      const cmp = compareValues(av, bv, direction)
      // Ties (cadence buckets, 1–5 scores) fall back to the founder timeline so the order is
      // deterministic and still reads as a journey inside each bucket — with the slot-less
      // situations after the timeline, by urgency then title (timelineCompare).
      if (cmp === 0) return timelineCompare(a, b)
      return cmp
    })
  }, [filtered, column, direction])

  // The flat sorted view over BOTH row kinds. Where the active column applies to playbooks
  // (title, aggregate ceiling) they interleave with the processes through one comparator;
  // on the per-process orderings (timeline, cadence, annoyance, risk, growth, phase) they lack
  // the field, so they follow the sorted processes — missing values last, ceiling-desc.
  const flatItems = useMemo<FlatItem[]>(() => {
    const processItems: FlatItem[] = sorted.map((row) => ({ kind: 'process', row }))
    if (filteredPlaybooks.length === 0) return processItems
    if (!PLAYBOOK_SORTABLE.has(column)) {
      const tail: FlatItem[] = [...filteredPlaybooks]
        .sort((a, b) => b.pct - a.pct || a.title.localeCompare(b.title))
        .map((row) => ({ kind: 'playbook', row }))
      return [...processItems, ...tail]
    }
    const playbookItems: FlatItem[] = filteredPlaybooks.map((row) => ({ kind: 'playbook', row }))
    return [...processItems, ...playbookItems].sort((a, b) => {
      const av = a.kind === 'process' ? fieldOf(a.row, column) : playbookFieldOf(a.row, column)
      const bv = b.kind === 'process' ? fieldOf(b.row, column) : playbookFieldOf(b.row, column)
      const cmp = compareValues(av, bv, direction)
      if (cmp === 0) {
        // Process–process ties keep the founder-timeline fallback the table always had
        // (situations after the timeline — timelineCompare); ties involving a playbook resolve
        // by title so the order stays deterministic.
        if (a.kind === 'process' && b.kind === 'process') return timelineCompare(a.row, b.row)
        return a.row.title.localeCompare(b.row.title)
      }
      return cmp
    })
  }, [sorted, filteredPlaybooks, column, direction])

  function handleSort(col: Column) {
    // From the grouped view any header click starts a fresh flat sort in the column's preset
    // direction (there's no current sort to toggle).
    if (grouped) changeSort(col, defaultDirection(col))
    else if (col === column) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    else changeSort(col, defaultDirection(col))
  }

  // The grouped view's area sections: filtered rows bucketed by area, areas in founder-lifecycle
  // order (areaRank rides on every row), rows in timeOrder within each area. Chain rows fold
  // into their DOMINANT area (founder 2026-09-29: playbooks are still processes — no leading
  // 'Playbooks' group) at their first constituent's timeOrder; on a timeOrder tie the plain
  // process leads (a chain shares its first constituent's timeOrder, so the constituent reads
  // first, then the chain that starts with it), chain–chain ties resolve by title. The phase
  // filter above collapses this to the matching area(s) for free — filtered/filteredPlaybooks
  // already only hold that phase's rows.
  const groups = useMemo(() => {
    if (!grouped) return null
    const byArea = new Map<string, { areaRank: number; items: FlatItem[] }>()
    const add = (area: string, areaRank: number, item: FlatItem) => {
      const bucket = byArea.get(area)
      if (bucket) bucket.items.push(item)
      else byArea.set(area, { areaRank, items: [item] })
    }
    for (const r of filtered) add(r.area, r.areaRank, { kind: 'process', row: r })
    for (const p of filteredPlaybooks) add(p.dominantArea, p.areaRank, { kind: 'playbook', row: p })
    return [...byArea.entries()]
      .map(([area, g]) => ({
        area,
        areaRank: g.areaRank,
        items: [...g.items].sort(
          // Playbook rows always carry their first constituent's timeOrder; process rows rank
          // through timelineRank (situations — the whole 'Situations' group — have no slot, so
          // inside that group the urgency clock orders the rows, hours first, then title).
          (a, b) =>
            (a.kind === 'playbook' ? a.row.timeOrder : timelineRank(a.row))
              - (b.kind === 'playbook' ? b.row.timeOrder : timelineRank(b.row))
            || (a.kind === b.kind ? 0 : a.kind === 'process' ? -1 : 1)
            || (a.kind === 'process' && b.kind === 'process' ? urgencyRank(a.row) - urgencyRank(b.row) : 0)
            || a.row.title.localeCompare(b.row.title),
        ),
      }))
      .sort((a, b) => a.areaRank - b.areaRank)
  }, [filtered, filteredPlaybooks, grouped])

  // Which ordering the adaptive metric column shows.
  const metric: Metric = (['order', 'cadence', 'annoyance', 'risk', 'growth'] as const).includes(column as Metric)
    ? (column as Metric)
    : 'cadence'

  function metricCell(r: ProcessTableRow): ReactNode {
    if (metric !== 'order' && fieldOf(r, metric) === null) return null
    if (metric === 'order' && r.timeOrder === null && r.kind !== 'situation') return null
    if (metric === 'order') {
      // A situation has no slot on the founder timeline — an honest dash, not an invented
      // number (the same convention as the playbook rows' missing per-process metrics).
      if (r.timeOrder === null) {
        // zinc-500 (founder 2026-10-05 contrast lift) — the dash carries a real tooltip, so it
        // sits at the tertiary tier rather than the decorative one.
        return (
          <span className="text-xs text-zinc-500" title="Situation — reactive, trigger-driven: it has no slot on the founder timeline; the urgency chip carries its clock">
            —
          </span>
        )
      }
      return <span className="font-mono text-xs tabular-nums text-zinc-400">#{r.timeOrder}</span>
    }
    if (metric === 'cadence') {
      // The cadence value is the filter (founder 2026-10-02, the in-row phase button idiom):
      // click it to scope the table to that cadence; click the same value again to clear.
      const active = cadence === r.cadenceLabel
      return (
        <button
          type="button"
          aria-pressed={active}
          onClick={() => setCadence(active ? null : r.cadenceLabel)}
          title={`${r.cadenceLabel} cadence — click to ${active ? 'clear the cadence filter' : `filter to ${r.cadenceLabel}`}`}
          className={`cursor-pointer text-xs transition hover:text-emerald-300 ${active ? 'text-emerald-300' : 'text-zinc-400'}`}
        >
          {r.cadenceLabel}
        </button>
      )
    }
    if (metric === 'annoyance') return <ScoreDots value={r.annoyance!} label="Annoyance" />
    if (metric === 'risk') return <ScoreDots value={r.risk!} label="Risk" />
    return <ScoreDots value={r.growthImpact!} label="Growth impact" />
  }

  // One process row — identical markup in the grouped and flat views (the founder ask keeps the
  // existing columns/rows unchanged under the area headers).
  function processRow(r: ProcessTableRow): ReactNode {
    const href = r.href ?? `/processes/${r.slug}`
    return (
      <tr key={r.slug} className="transition hover:bg-zinc-800/70">
        <td className="max-w-[260px] px-2 py-2">
          <span className="flex items-center gap-1.5">
            <IconChip icon={r.icon} title={`${r.title} — ${r.phase} ${r.kind === 'situation' ? 'situation' : 'process'}`} />
            <Link href={href} className="font-medium hover:text-emerald-300">
              {r.title}
            </Link>
            {(() => {
              // Only US-scoped work wears a title-trailing glyph (founder 2026-10-02): the 🇺🇸
              // flag, keyed strictly on geoScope; global rows wear no scope glyph at all.
              const flag = usFlagGlyph(r.geoScope)
              return flag !== null && <span
                aria-hidden
                className="text-[10px] opacity-70"
                title={flag.label}
              >
                {flag.glyph}
              </span>
            })()}
            {r.urgency !== null && <UrgencyChip tier={r.urgency} />}
          </span>
          {/* Situations (founder 2026-10-01): the trigger — the event that puts a founder
              here — is the row's subtitle; process rows stay single-line. */}
          {r.kind === 'situation' && r.trigger !== null && (
            <span className="mt-0.5 block pl-6 text-[11px] leading-snug text-zinc-400">{r.trigger}</span>
          )}
        </td>
        {/* zinc-400, not 500 (founder 2026-10-05 contrast lift: the area cells read
            dark-on-dark on the hover-tinted rows). */}
        <td className="hidden px-2 py-2 text-xs text-zinc-400 md:table-cell">
          {/* Founder 2026-09-18: the phase is the filter — click it to scope the table
              to that phase; click again (or pick All) to clear. */}
          {r.phase && <button
            type="button"
            onClick={() => changePhase(phase === r.phase ? 'all' : r.phase)}
            title={`${phaseTooltip(r.phase)} — click to ${phase === r.phase ? 'clear the phase filter' : `filter to ${r.phase}`}`}
            className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap transition hover:text-emerald-300 ${phase === r.phase ? 'text-emerald-300' : ''}`}
          >
            <IconChip icon={phaseIcon(r.phase)} title={phaseTooltip(r.phase)} />
            {r.phase}
          </button>}
        </td>
        <td className="px-2 py-2">
          {r.pct !== null && <CeilingBar pct={r.pct} />}
        </td>
        {/* The Steps cell left with its column (founder 2026-10-02) — the detail page's
            step-by-step carries the per-step story. */}
        <td className="whitespace-nowrap px-2 py-2">{metricCell(r)}</td>
        <td className="hidden px-2 py-2 lg:table-cell">
          {/* The vendor cell fills its width (founder 2026-10-05): EVERY vendor renders as a
              chip in one visual row — the flex-wrap + one-chip-row max-height + overflow-hidden
              trick hides whatever doesn't fit — and the '→' (replacing '+N') opens the process
              for the full roster. Chips keep their ?via= lens links; no tooltips on vendor
              chips (founder 2026-10-05) — aria-labels carry the destination instead. Chip text
              is text-xs (founder 2026-10-08: the 10px labels were too small beside the 18px
              logos) — same lift in HomeProcessesMini, pinned in the styling test. */}
          {r.vendors.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-hidden max-h-[28px]">
                {r.vendors.map((v) =>
                  v.arena ? (
                    // Founder 2026-09-25: a vendor chip opens the PROCESS through that
                    // vendor (?via= lens, lib/processLens.ts) — not the vendor's own page.
                    <Link key={v.label} href={r.href ? href : `${href}?via=${v.arena}:${v.id}`} aria-label={r.href ? `Open ${r.title} — view ${v.label} alongside the other options` : `Open ${r.title} viewed via ${v.label}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-zinc-700 py-px pl-0.5 pr-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300">
                      <ProductLogoView product={{ id: v.id, name: v.label }} size={18} hasLogo={v.hasLogo} />
                      {v.label}
                    </Link>
                  ) : (
                    <span key={v.label} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-zinc-800 py-px pl-0.5 pr-1.5 text-xs text-zinc-500">
                      <ProductLogoView product={{ id: v.id, name: v.label }} size={18} hasLogo={v.hasLogo} />
                      {v.label}
                    </span>
                  ),
                )}
              </span>
              <Link
                href={href}
                aria-label={`All vendors and steps — open ${r.title}`}
                className="shrink-0 text-xs text-zinc-400 transition hover:text-emerald-300"
              >
                →
              </Link>
            </span>
          )}
        </td>
      </tr>
    )
  }

  // One chain row — no category label (founder 2026-09-29: "we don't need to say 'playbook'…
  // playbooks are still processes"): the tagline, multi-icon constituent chips, and per-step
  // route strip naturally signal composition under the same columns — constituent-process chips
  // where a process shows its phase, the aggregate ceiling, agent/total steps with the route
  // dots, and an honest dash on the per-process metric axes it doesn't have.
  function playbookRow(p: PlaybookRow): ReactNode {
    return (
      <tr key={`playbook-${p.id}`} className="transition hover:bg-zinc-800/70">
        <td className="max-w-[260px] px-2 py-2">
          <span className="flex items-center gap-1.5">
            <IconChip icon={p.icon} title={`${p.title} — multi-process`} />
            <Link href={p.href} className="font-medium hover:text-emerald-300">
              {p.title}
            </Link>
          </span>
          {/* No tagline (founder 2026-09-29: titles are self-evident) — the field stays as
              search-matching data only. */}
        </td>
        <td className="hidden px-2 py-2 md:table-cell">
          {/* Where a process shows its one phase, a playbook spans several processes — the old
              playbooks table's 'Processes' chips, at the same breakpoint. */}
          <span className="flex flex-wrap items-center gap-1 text-xs text-zinc-400">
            {p.processes.map((t, i) => (
              <IconChip key={`${t.id}-${i}`} icon={t.icon} title={`${t.title} — ${t.phase} process`} />
            ))}
            <span className="text-zinc-500">{p.processes.length}</span>
          </span>
        </td>
        <td className="px-2 py-2">
          <CeilingBar pct={p.pct} />
        </td>
        {/* The aggregate Steps cell left with its column (founder 2026-10-02). */}
        <td className="whitespace-nowrap px-2 py-2">
          {/* zinc-500 (founder 2026-10-05 contrast lift) — a tooltip-carrying dash, tertiary
              tier like the situation rows' timeline dash. */}
          <span className="text-xs text-zinc-500" title="Multi-process row — the constituent processes carry the timeline/cadence/annoyance/risk/growth values; the combined row ranks by its aggregate ceiling">
            —
          </span>
        </td>
        <td className="hidden px-2 py-2 lg:table-cell">
          {/* The vendors themselves (founder 2026-10-02) — the constituents' chips in journey
              order, the exact process-row cell contract (?via= lens). Same 2026-10-05 fill-the-
              width idiom as the process rows: every chip renders, the one-row clip hides the
              overflow, and '→' opens the playbook for the full roster. */}
          {p.vendors.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-hidden max-h-[28px]">
                {p.vendors.map((v) =>
                  v.arena ? (
                    <Link key={v.label} href={`${p.href}?via=${v.arena}:${v.id}`} aria-label={`Open ${p.title} viewed via ${v.label}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-zinc-700 py-px pl-0.5 pr-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300">
                      <ProductLogoView product={{ id: v.id, name: v.label }} size={18} hasLogo={v.hasLogo} />
                      {v.label}
                    </Link>
                  ) : (
                    <span key={v.label} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-zinc-800 py-px pl-0.5 pr-1.5 text-xs text-zinc-500">
                      <ProductLogoView product={{ id: v.id, name: v.label }} size={18} hasLogo={v.hasLogo} />
                      {v.label}
                    </span>
                  ),
                )}
              </span>
              <Link
                href={p.href}
                aria-label={`All vendors and steps — open ${p.title}`}
                className="shrink-0 text-xs text-zinc-400 transition hover:text-emerald-300"
              >
                →
              </Link>
            </span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      {/* The controls row's geo dropdown moved to the site header (founder 2026-10-07:
          "move this into the top bar … then we don't need it per page" —
          components/HeaderGeoControl.tsx). The table keeps every geo-adaptive behavior
          (country-view filter, scope glyphs) through the same shared store. */}
      <TableControls
        presetsAsDropdown
        presets={PRESETS}
        // The grouped view reads as its own dropdown entry; otherwise the sorted column shows
        // (visibly 'Founder timeline' in the no-param default — founder 2026-09-30).
        activeColumn={grouped ? 'grouped' : column}
        presetActive={grouped || direction === defaultDirection(column)}
        onPreset={(col) => (col === 'grouped' ? pickGrouped() : changeSort(col, defaultDirection(col)))}
        scope={{
          value: phase,
          onChange: changePhase,
          ariaLabel: 'Filter by phase',
          options: [
            // Founder 2026-09-23: reads "areas" to users, not the internal "phases" term.
            { value: 'all', label: 'All areas' },
            // Each area wears its house glyph (phaseIcon `pi:` token — founder 2026-10-08: the
            // dropdown joins the custom set; TableControls renders it via IconGlyph). The
            // legacy curated emoji survives ONLY as the below-sm native <option> decoration,
            // where SVG can't render (phaseEmoji — the text-only precedent).
            ...phases.map((p) => ({ value: p, label: p, icon: phaseIcon(p), emoji: phaseEmoji(p) })),
          ],
        }}
        query={query}
        onQuery={(value) => {
          setQuery(value)
          setParams({ pq: value.trim() === '' ? null : value })
        }}
      />
      {/* The old "← grouped by area" reset pill is gone (founder 2026-09-30): the grouped view
          lives in the rank-by dropdown as its top entry, so the way back is always visible. */}
      {/* The shared table shell (components/tableStyles.ts) — founder 2026-10-05: one wrapper
          and header treatment sitewide; this table is the reference. */}
      <div className={`${TABLE_SHELL} md:overflow-x-visible`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            {/* In the grouped view no column is sorted-on (current=null, aria-sort none) —
                clicking any header sorts that column and flattens the table. Headers are
                sentence case at a readable size (founder 2026-10-05: one case style, no ALL
                CAPS; text-xs minimum) — still under the body's text-sm. */}
            <tr className={TABLE_HEADER_ROW}>
              <SortableTh col="title" current={grouped ? null : column} direction={direction} onSort={handleSort}><span title="A real startup operating process, mapped step by step">Process</span></SortableTh>
              {/* 'Area' (founder 2026-10-05): the sitewide Phase→Area doctrine reaches the
                  header — the column/filter mechanics still key on the internal phase field. */}
              <SortableTh col="phase" current={grouped ? null : column} direction={direction} onSort={handleSort} className="hidden md:table-cell"><span title="Where in the life of the company this process happens (formation, finance, hiring…)">Area</span></SortableTh>
              <SortableTh col="pct" current={grouped ? null : column} direction={direction} onSort={handleSort}><span title="Agentic %: the share of this process's steps an AI agent can run today — the rest still needs forms or people">Agentic %</span></SortableTh>
              {/* The Steps column is gone (founder 2026-10-02) — the detail pages carry the
                  per-step story; the Agentic % bar is the honest summary here. */}
              {/* Adaptive metric column: shows whichever of the five orderings is active (falls
                  back to cadence) — the ranked-on number is always on screen. */}
              <SortableTh col={metric} current={grouped ? null : column} direction={direction} onSort={handleSort}><span title={METRIC_META[metric].tooltip}>{METRIC_META[metric].header}</span></SortableTh>
              <SortableTh col="title" current={grouped ? null : column} direction={direction} onSort={handleSort} sortable={false} className="hidden lg:table-cell"><span title="The main vendors this process runs on — judged vendors open this process viewed through that vendor">Vendor</span></SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {/* Grouped view (founder 2026-09-29: playbooks are still processes — chain rows
                fold into their dominant area at their timeline position, no leading group). */}
            {groups !== null
              ? groups.map((g) => (
                  <Fragment key={g.area}>
                    {/* Area header: friendly name + row count (chain rows count as processes —
                        founder 2026-09-29). colSpan spans whatever columns the breakpoint shows
                        (hidden columns collapse it), so the header reads fine at the homepage
                        width and inside the mobile scroll shell. */}
                    <tr className="bg-zinc-900/50">
                      <th colSpan={5} scope="colgroup" className="px-2 pb-1.5 pt-3 text-left font-normal">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-display text-sm font-semibold tracking-tight text-zinc-100">{g.area}</span>
                          <span className="text-[11px] text-zinc-500">
                            {/* The Situations group counts honestly in its own vocabulary. */}
                            {g.items.length}{' '}
                            {g.area === 'Situations'
                              ? g.items.length === 1 ? 'situation' : 'situations'
                              : g.items.length === 1 ? 'process' : 'processes'}
                          </span>
                        </span>
                      </th>
                    </tr>
                    {g.items.map((it) => (it.kind === 'playbook' ? playbookRow(it.row) : processRow(it.row)))}
                  </Fragment>
                ))
              : flatItems.map((it) => (it.kind === 'playbook' ? playbookRow(it.row) : processRow(it.row)))}
            {sorted.length === 0 && filteredPlaybooks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  {/* Echo the active filters — same convention as the product tables. One
                      vocabulary (founder 2026-09-29): chain rows are processes too. */}
                  No processes match{query.trim() ? <> &ldquo;{query}&rdquo;</> : ''}{phase !== 'all' ? ` in the ${phase} phase` : ''}{cadence !== null ? ` at the ${cadence} cadence` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* No hidden-rows disclosure under the table (founder 2026-10-05: the country filter
          just filters) — the per-country analog detail lives on each process detail page
          (ProcessGeoNotes). */}
    </div>
  )
}
