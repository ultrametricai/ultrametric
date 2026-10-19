import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// Agent-surface SLO history — loader + uptime math over open-rankings/slo-history.jsonl, the
// append-only log written by rankings-engine/scripts/slo-check.ts (one line per keyless check of a
// product's documented agent surface: its llms.txt, remote MCP endpoint, or openapi.json).
// Split the usual way (lib/scoreHistory.ts / lib/scoreTrend.ts): the parse + summary math is
// pure and unit-tested (lib/__tests__/slo.test.ts); only the loaders at the bottom touch fs.

export const SLO_HISTORY_FILE = 'slo-history.jsonl'

// How long a surface must have been tracked before we quote an uptime percentage at all.
// Under this, display code says "tracking since <date>" — a 100% computed over two days of
// checks is technically true and practically a lie.
export const SLO_MIN_TRACKING_DAYS = 7

export const SLO_WINDOW_DAYS = 30

export const SloSurfaceSchema = z.enum(['llms-txt', 'mcp', 'openapi'])
export type SloSurface = z.infer<typeof SloSurfaceSchema>

export const SloEntrySchema = z.object({
  date: z.string().min(1),
  productId: z.string().min(1),
  arena: z.string().min(1),
  surface: SloSurfaceSchema,
  url: z.string().min(1),
  up: z.boolean(),
  // Raw HTTP status of the check; 0 means no HTTP response at all (timeout / network error).
  status: z.number().int(),
})
export type SloEntry = z.infer<typeof SloEntrySchema>

export const SLO_SURFACE_LABELS: Record<SloSurface, string> = {
  'llms-txt': 'llms.txt',
  mcp: 'MCP',
  openapi: 'openapi.json',
}

// Status-class → up/down, shared by the checker (writing) and by nothing else at read time
// (readers trust the recorded boolean; this stays here so the policy is unit-tested next to
// the math that consumes it). Down means the surface is genuinely unreachable or gone:
// timeout/network error (status 0), 404/410, or a 5xx. Everything else that answered counts
// as up — including 401/403/405/406, because an auth-gated MCP endpoint or a WAF-challenged
// llms.txt is a live surface answering without credentials, not an outage.
export function classifyUp(status: number): boolean {
  if (status === 0) return false
  if (status === 404 || status === 410) return false
  if (status >= 500) return false
  return true
}

// Same tolerant-blank-lines / strict-malformed-lines contract as parseScoreHistoryJsonl —
// the file is machine-written only.
export function parseSloHistoryJsonl(text: string): SloEntry[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => SloEntrySchema.parse(JSON.parse(line)))
}

// One (arena, product, surface, url) series, summarized for display. URL is part of the series
// identity: a handful of products document TWO remote MCP endpoints (a docs-MCP and an API-MCP),
// and each is its own uptime series — aggregateBySurface below folds them back to one row where
// the UI wants one line per surface.
export interface SurfaceSlo {
  arena: string
  productId: string
  surface: SloSurface
  // URL from the most recent check (the checker can re-derive a moved URL between runs).
  url: string
  firstDate: string
  lastDate: string
  // All-time counts, and the rolling-window uptime the UI quotes.
  checks: number
  windowChecks: number
  windowUpChecks: number
  // Percentage of up checks inside the window, 1-decimal. Null when windowChecks === 0.
  windowUptimePct: number | null
  currentlyUp: boolean
  // Date of the first check in the trailing consecutive-down run — "down since". Null when up.
  downSince: string | null
  lastStatus: number
}

function pct1(up: number, total: number): number {
  return Math.round((up / total) * 1000) / 10
}

// Trailing-slash-insensitive series key, matching the checker's dedupe.
const normUrl = (url: string) => url.replace(/\/+$/, '')

// Groups entries by (arena, product, surface, url) and computes each series' uptime summary.
// Entries are re-sorted by date (stable within equal dates) even though the file is
// append-ordered — cheap insurance against interleaved backfills, same reasoning as
// lib/scoreTrend.ts's seriesFor.
export function summarizeSlo(entries: SloEntry[], now: Date = new Date(), windowDays: number = SLO_WINDOW_DAYS): SurfaceSlo[] {
  const byKey = new Map<string, SloEntry[]>()
  for (const e of entries) {
    const key = `${e.arena}/${e.productId}/${e.surface}/${normUrl(e.url)}`
    const list = byKey.get(key)
    if (list) list.push(e)
    else byKey.set(key, [e])
  }

  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000
  const summaries: SurfaceSlo[] = []
  for (const list of byKey.values()) {
    const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const last = sorted[sorted.length - 1]
    const windowEntries = sorted.filter((e) => new Date(e.date).getTime() >= cutoff)
    const windowUp = windowEntries.filter((e) => e.up).length

    // Walk back through the trailing consecutive-down run for "down since".
    let downSince: string | null = null
    if (!last.up) {
      let i = sorted.length - 1
      while (i >= 0 && !sorted[i].up) {
        downSince = sorted[i].date
        i--
      }
    }

    summaries.push({
      arena: last.arena,
      productId: last.productId,
      surface: last.surface,
      url: last.url,
      firstDate: sorted[0].date,
      lastDate: last.date,
      checks: sorted.length,
      windowChecks: windowEntries.length,
      windowUpChecks: windowUp,
      windowUptimePct: windowEntries.length > 0 ? pct1(windowUp, windowEntries.length) : null,
      currentlyUp: last.up,
      downSince,
      lastStatus: last.status,
    })
  }
  return summaries.sort(
    (a, b) =>
      a.arena.localeCompare(b.arena) ||
      a.productId.localeCompare(b.productId) ||
      a.surface.localeCompare(b.surface) ||
      a.url.localeCompare(b.url),
  )
}

// Folds multi-endpoint series (same arena/product/surface, different URLs) into one row per
// surface for the product page's uptime line: the percentage combines every check of that
// surface, the row is up only when EVERY endpoint is up, and downSince is the earliest
// trailing-down start among the down endpoints.
export function aggregateBySurface(summaries: SurfaceSlo[]): SurfaceSlo[] {
  const byKey = new Map<string, SurfaceSlo[]>()
  for (const s of summaries) {
    const key = `${s.arena}/${s.productId}/${s.surface}`
    const list = byKey.get(key)
    if (list) list.push(s)
    else byKey.set(key, [s])
  }
  return [...byKey.values()]
    .map((group) => {
      if (group.length === 1) return group[0]
      const windowChecks = group.reduce((n, s) => n + s.windowChecks, 0)
      const windowUpChecks = group.reduce((n, s) => n + s.windowUpChecks, 0)
      const down = group.filter((s) => !s.currentlyUp)
      const latest = group.reduce((a, b) => (new Date(b.lastDate) > new Date(a.lastDate) ? b : a))
      return {
        ...latest,
        firstDate: group.reduce((min, s) => (new Date(s.firstDate) < new Date(min) ? s.firstDate : min), group[0].firstDate),
        checks: group.reduce((n, s) => n + s.checks, 0),
        windowChecks,
        windowUpChecks,
        windowUptimePct: windowChecks > 0 ? pct1(windowUpChecks, windowChecks) : null,
        currentlyUp: down.length === 0,
        downSince:
          down.length === 0
            ? null
            : down.reduce<string | null>((min, s) => {
                const d = s.downSince ?? s.lastDate
                return min === null || new Date(d) < new Date(min) ? d : min
              }, null),
        lastStatus: (down[0] ?? latest).lastStatus,
      }
    })
    .sort(
      (a, b) => a.arena.localeCompare(b.arena) || a.productId.localeCompare(b.productId) || a.surface.localeCompare(b.surface),
    )
}

// Has this series been tracked long enough to quote a percentage? Under
// SLO_MIN_TRACKING_DAYS the honest rendering is "tracking since <firstDate>".
export function hasMatureSloHistory(s: SurfaceSlo, now: Date = new Date()): boolean {
  return now.getTime() - new Date(s.firstDate).getTime() >= SLO_MIN_TRACKING_DAYS * 24 * 60 * 60 * 1000
}

export function currentlyDownSurfaces(summaries: SurfaceSlo[]): SurfaceSlo[] {
  return summaries.filter((s) => !s.currentlyUp)
}

// "99.4%" / "100%" — trailing ".0" dropped so the common all-up case reads clean.
export function formatUptimePct(pct: number): string {
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// fs loaders — same module-level cache pattern as lib/scoreHistory.ts.
// ---------------------------------------------------------------------------

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

const sloCache = new Map<string, SloEntry[]>()

// Tolerant-optional, like every other sidecar file: no slo-history.jsonl yet resolves to [],
// and every consumer renders "no tracking yet", never an error.
export function loadSloHistory(dir: string = DEFAULT_DIR()): SloEntry[] {
  const hit = sloCache.get(dir)
  if (hit) return hit
  const file = path.join(dir, SLO_HISTORY_FILE)
  const entries = fs.existsSync(file) ? parseSloHistoryJsonl(fs.readFileSync(file, 'utf8')) : []
  sloCache.set(dir, entries)
  return entries
}

export function loadSloSummaries(dir: string = DEFAULT_DIR(), now: Date = new Date()): SurfaceSlo[] {
  return summarizeSlo(loadSloHistory(dir), now)
}

// The product page's per-surface summaries for one product (empty when never checked), one row
// per surface even for multi-endpoint products.
export function productSurfaceSlos(arena: string, productId: string, dir: string = DEFAULT_DIR(), now: Date = new Date()): SurfaceSlo[] {
  return aggregateBySurface(loadSloSummaries(dir, now).filter((s) => s.arena === arena && s.productId === productId))
}
