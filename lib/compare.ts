// Pure, client-safe helpers for /compare (components/CompareBuilder.tsx) — URL state
// encode/parse plus the row-winner and shared-theme logic the comparison table renders from.
// Split from lib/compareData.ts the same way lib/megaTableSort.ts is split from lib/megaTable.ts:
// this file must stay free of node builtins so the client component can import it, and it keeps
// the URL/table logic testable without rendering React.

// One product's lean comparison row — built server-side (lib/compareData.ts) from CategoryData
// and passed to the client as a plain prop, so the browser never carries verdicts/evidence.
export interface CompareProduct {
  id: string
  name: string
  arenaId: string
  arenaName: string
  type: 'oss' | 'commercial' | 'government'
  aiEra: number | null
  agentReady: number | null
  agenticApp: number | null
  apiQuality: number | null
  // Per-theme weighted scores from the product's own arena leaderboard entry. Theme ids are
  // arena-specific, so two products only share a theme row when both arenas define the theme
  // (see sharedThemes below).
  themeScores: Record<string, number | null>
  // Precomputed MCP/CLI/API glyph chars (✓ ~ ! —) — see lib/accessGlyphs.ts. Chars only:
  // the client derives styling via accessGlyphClass, keeping the serialized rows minimal.
  access: { MCP: string; CLI: string; API: string }
  hasLogo: boolean
}

export const MAX_COMPARE = 6

// What /compare shows before the user picks anything: a classic head-to-head (Linear vs Asana)
// instead of an empty shell, so the page demonstrates itself on first load. Only used when the
// `?p=` param is entirely absent — `?p=` present (even empty) is an explicit selection and is
// respected as-is, so deep links and "remove everything" both behave.
export const DEFAULT_COMPARE_IDS = ['linear', 'asana']

// Initial selection for CompareBuilder: absent `?p=` → the default pairing (filtered against
// the live product set, so a renamed id degrades to a smaller default instead of erroring);
// present `?p=` → parsed as usual.
export function initialCompareIds(raw: string | null, validIds: ReadonlySet<string>): string[] {
  if (raw === null) return DEFAULT_COMPARE_IDS.filter((id) => validIds.has(id))
  return parseCompareParam(raw, validIds)
}

// Parses `?p=stripe,mercury,claude-code` into a deduped, validated id list capped at
// MAX_COMPARE. Unknown ids (stale links, typos) are dropped silently rather than erroring —
// a share link should degrade to whatever subset still exists.
export function parseCompareParam(raw: string | null | undefined, validIds: ReadonlySet<string>): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const piece of raw.split(',')) {
    const id = piece.trim()
    if (id === '' || !validIds.has(id) || out.includes(id)) continue
    out.push(id)
    if (out.length === MAX_COMPARE) break
  }
  return out
}

export function encodeCompareParam(ids: string[]): string {
  return ids.join(',')
}

// Theme ids scored (non-null) for at least two of the selected products — the only theme rows
// worth rendering in a comparison (a theme only one product has is a fact about its arena, not
// a comparison). Order preserves first appearance across the selection, so rows don't reshuffle
// as products are added.
export function sharedThemes(products: CompareProduct[]): string[] {
  const counts = new Map<string, number>()
  for (const p of products) {
    for (const [theme, score] of Object.entries(p.themeScores)) {
      if (score !== null) counts.set(theme, (counts.get(theme) ?? 0) + 1)
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([theme]) => theme)
}

// Indices of the per-row winner(s) — every index tied at the max. Empty when fewer than two
// values are non-null: a "winner" against nothing (or against all-n/a) is noise, not signal.
export function rowWinners(values: Array<number | null>): number[] {
  const present = values.filter((v): v is number => v !== null)
  if (present.length < 2) return []
  const max = Math.max(...present)
  return values.flatMap((v, i) => (v === max ? [i] : []))
}

// 'automation-depth' → 'Automation depth' — display label for a theme id. Re-exported from
// lib/icons.ts (the site's one kebab-id humanizer) under this module's historical name.
export { humanizeTheme as themeLabel } from './icons'

// Client-side styling for the serialized access glyph chars (mirrors lib/accessGlyphs.ts's
// accessGlyphFor, which isn't imported here to keep verdict types out of the client bundle).
export function accessGlyphClass(char: string): string {
  if (char === '✓' || char === '~') return 'text-emerald-400'
  if (char === '!') return 'text-red-400'
  return 'text-zinc-400'
}
