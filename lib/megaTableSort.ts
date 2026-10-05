// Pure sort/filter logic for components/MegaTable.tsx — the homepage's single global,
// sortable/filterable table over every product in every arena (see lib/megaTable.ts for the
// server-side row builder). Split out the same way lib/arenaTableSort.ts is split from
// ArenaTable.tsx: testable without rendering React, and keeps the client component a thin view.

export type MegaTableColumn =
  | 'rank'
  | 'name'
  | 'arena'
  | 'oss'
  | 'initScore'
  | 'agentReady'
  | 'agenticApp'
  | 'apiQuality'
  | 'popularity'

export type SortDirection = 'asc' | 'desc'

export interface MegaTableAccessGlyph {
  char: string
  className: string
  title: string
  // Internal link to the story section on the product page that this glyph's verdict (and its
  // evidence) lives on — the glyph is a citation, so clicking it goes to the receipts.
  href: string
}

export interface MegaTableRow {
  productId: string
  name: string
  vendor: string
  type: 'oss' | 'commercial'
  arenaId: string
  arenaName: string
  hasLogo: boolean
  // Blended Overall score (see AiEraBadge) — kept as `initScore` for naming parity with
  // lib/arenaTableSort.ts's ArenaTableRow.
  initScore: number | null
  agentReady: number | null
  agenticApp: number | null
  apiQuality: number | null
  // True when every api-quality cell for this product is a zero-evidence none/na — i.e. we
  // never found (or probed) anything either way, so the honest render is "untested", not "0".
  apiUntested: boolean
  // Same rule for the other two group-scoped Overall-score components (agent-access →
  // agentReady, agentic-features → agenticApp). Optional so fixtures/callers predating them
  // stay valid — absent reads as "not untested" (render the number as before).
  agentReadyUntested?: boolean
  agenticAppUntested?: boolean
  // GitHub star count — see lib/arenaTableSort.ts's ArenaTableRow.popularity doc.
  popularity: number | null
  // Repo link for the GitHub ★ cell's click-through (product.urls.github when curated). Optional
  // so fixtures/callers predating it stay valid.
  githubUrl?: string
  // Verified YC batch code (e.g. "S22") — see lib/schemas.ts's ProductSchema.ycBatch doc. Optional
  // (not `| null`, unlike popularity) so existing MegaTableRow fixtures/callers built before this
  // field existed stay valid without every one needing an update.
  ycBatch?: string
  // Enterprise-motion flag (lib/schemas.ts ProductSchema.enterprise) — optional for the same
  // fixture-compat reason as ycBatch. Data only in this table since the founder 2026-10-05
  // batch (no next-to-title pill here); the product page still renders EnterpriseBadge.
  enterprise?: boolean
  // Verified shutdown note (lib/schemas.ts ProductSchema.shutdown) — optional for the same
  // fixture-compat reason as ycBatch. Rendered as the compact ShutdownBadge next to the name
  // (tooltip = the dated vendor note); the row itself stays ranked (lib/shutdown.ts).
  shutdown?: string
  // Arena-level not-applicable dimensions (CategorySchema.naDimensions, hardware arenas) —
  // optional for fixture compat; the table renders n/a for these instead of a number.
  naDimensions?: string[]
  // True for a judged product-family line whose parent is a different product (e.g.
  // stripe-issuing under Stripe) — the homepage hides these by default so a company appears
  // once; the "Include all products of companies" toggle reveals them. Optional for
  // fixture compat.
  isFamilySubProduct?: boolean
  // Same product judged in a second arena (airwallex in payments AND startup-banking): the
  // default companies view keeps only its best-scoring arena row; the "Include all products"
  // toggle reveals the rest (founder 2026-09-21: "we have airwallex twice on the main table").
  isSecondaryArena?: boolean
  // 🔥 "hot right now" reason string (see lib/hotProducts.ts) — null when not hot; optional for
  // the same fixture-compat reason as ycBatch. Rendered as the small HotChip next to the name
  // (tooltip = the reason), never sorted on and never part of any score.
  hotReason?: string | null
  // 30-day Overall score trend delta (see lib/scoreTrend.ts's trendDelta) — null when the product
  // has <2 history points yet; optional for the same fixture-compat reason as ycBatch. Rendered
  // as the ▲/▼/— arrow next to the Overall score badge, never sorted on.
  trendDelta?: number | null
  // 30-day agent-readiness trend delta — same contract as trendDelta, rendered as the arrow in
  // the Agent-ready column ("is this product getting more agent-friendly?").
  agentReadyTrendDelta?: number | null
  // Score-confidence summary (see lib/confidence.ts): grade + the fractions behind it, rendered
  // as the small chip next to the Overall score badge. Optional for the same fixture-compat
  // reason as ycBatch.
  confidence?: import('./confidence').ProductConfidence
  // 68% confidence band on the Overall score (see lib/scoreIntervals.ts) — surfaced in the badge's
  // title attr only, never a visible column. Optional/null for the same fixture-compat +
  // tolerant-absence reasons as trendDelta: no interval data ⇒ no band rendered anywhere.
  interval?: { low: number; high: number } | null
  access: { MCP: MegaTableAccessGlyph; CLI: MegaTableAccessGlyph; API: MegaTableAccessGlyph }
}

// AGENT-READY is this table's whole reason for existing (a cross-arena "can your agent even
// reach this product" view), so it — not the per-row Overall score — is both the default sort
// column and what `rank` re-derives when no other sort is active.
export const DEFAULT_COLUMN: MegaTableColumn = 'agentReady'
export const DEFAULT_DIRECTION: SortDirection = 'desc'

export const COLUMN_LABELS: Record<MegaTableColumn, string> = {
  rank: 'AGENT-READY',
  name: 'product name',
  arena: 'arena',
  oss: 'open source',
  initScore: 'Overall score',
  agentReady: 'AGENT-READY',
  agenticApp: 'BUILT-IN AI',
  apiQuality: 'API quality',
  popularity: 'Popularity',
}

// The columns a reader can actually pick as a sort (everything but the synthetic 'rank', which
// is a fixed identity, never a live sort) — also the legal values of the shareable ?rank= URL
// param (components/MegaTable.tsx, lib/urlState.ts).
export const SORTABLE_COLUMNS = [
  'name',
  'arena',
  'oss',
  'initScore',
  'agentReady',
  'agenticApp',
  'apiQuality',
  'popularity',
] as const satisfies readonly MegaTableColumn[]

// Tolerant ?rank= parse — anything that isn't a sortable column name is null (the caller falls
// back to the default silently; a bad shared URL must never break the table).
export function parseMegaColumn(value: string | null): MegaTableColumn | null {
  return value !== null && (SORTABLE_COLUMNS as readonly string[]).includes(value)
    ? (value as MegaTableColumn)
    : null
}

// `oss` defaults to desc like the numeric columns: desc = open-source rows first (oss sorts as
// 1, commercial as 0), so the first click answers "which of these are open source?".
export function defaultDirectionFor(column: MegaTableColumn): SortDirection {
  return column === 'name' || column === 'arena' ? 'asc' : 'desc'
}

function compareNullableNumber(a: number | null, b: number | null, direction: SortDirection): number {
  // Nulls (no applicable evidence for this axis) always sort last, regardless of direction.
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return direction === 'desc' ? b - a : a - b
}

type StringField = 'name' | 'arenaName'
type NumericField = 'initScore' | 'agentReady' | 'agenticApp' | 'apiQuality' | 'popularity'

function stringFieldFor(column: MegaTableColumn): StringField | null {
  if (column === 'name') return 'name'
  if (column === 'arena') return 'arenaName'
  return null
}

// The column a given MegaTableColumn actually reads from a row (rank has no own field; it
// re-derives the default AGENT-READY order).
const NUMERIC_FIELDS: Record<MegaTableColumn, NumericField | null> = {
  rank: 'agentReady',
  name: null,
  arena: null,
  oss: null, // boolean-backed (row.type), special-cased in sortMegaRows
  initScore: 'initScore',
  agentReady: 'agentReady',
  agenticApp: 'agenticApp',
  apiQuality: 'apiQuality',
  popularity: 'popularity',
}

function numericFieldFor(column: MegaTableColumn): NumericField | null {
  return NUMERIC_FIELDS[column]
}

export function sortMegaRows(rows: MegaTableRow[], column: MegaTableColumn, direction: SortDirection): MegaTableRow[] {
  if (column === 'oss') {
    // Stable partition on row.type — desc puts open-source rows first; ties keep input order.
    const ossRank = (r: MegaTableRow) => (r.type === 'oss' ? 1 : 0)
    return [...rows].sort((a, b) => (direction === 'desc' ? ossRank(b) - ossRank(a) : ossRank(a) - ossRank(b)))
  }
  const strField = stringFieldFor(column)
  if (strField !== null) {
    return [...rows].sort((a, b) => {
      const cmp = a[strField].localeCompare(b[strField])
      return direction === 'desc' ? -cmp : cmp
    })
  }
  const field = numericFieldFor(column) as NumericField
  return [...rows].sort((a, b) => compareNullableNumber(a[field], b[field], direction))
}

// Case-insensitive substring match over product name, vendor, AND arena name/id — people type
// "payments" or "banking" expecting the category's products, not just literal product names.
export function filterMegaRowsByQuery(rows: MegaTableRow[], query: string): MegaTableRow[] {
  const q = query.trim().toLowerCase()
  if (q === '') return rows
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q)
      || r.vendor.toLowerCase().includes(q)
      || r.arenaName.toLowerCase().includes(q)
      || r.arenaId.includes(q),
  )
}

// Arena dropdown filter — `'all'` (the default) means every arena.
export function filterMegaRowsByArena(rows: MegaTableRow[], arenaId: string): MegaTableRow[] {
  if (arenaId === 'all') return rows
  return rows.filter((r) => r.arenaId === arenaId)
}

// Fixed rank identity: each product's position in the full (unfiltered) list sorted by the
// default column (AGENT-READY desc, nulls last) — doesn't jump around when the visible sort
// or filter changes, same rationale as ArenaTable's rankOf.
// Keyed by arenaId:productId — the same product can compete in two arenas (devin in
// software-factory + ai-coding, square in payments + mobile-payments), and a bare productId
// key would give both rows whichever rank was written last.
export function megaRowKey(row: Pick<MegaTableRow, 'arenaId' | 'productId'>): string {
  return `${row.arenaId}:${row.productId}`
}

export function rankMegaRows(rows: MegaTableRow[]): Map<string, number> {
  const sorted = sortMegaRows(rows, DEFAULT_COLUMN, DEFAULT_DIRECTION)
  const map = new Map<string, number>()
  sorted.forEach((row, i) => map.set(megaRowKey(row), i + 1))
  return map
}
