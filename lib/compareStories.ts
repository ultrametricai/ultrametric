// Pure, client-safe helpers for /compare's story-level rows (components/CompareBuilder.tsx).
// Same contract as lib/compare.ts: no node builtins, no zod at runtime (type-only imports), so
// the client bundle stays lean. The verdict data itself is NEVER server-serialized into the
// compare page — CompareBuilder fetches each selected arena's static stories.json/verdicts.json
// (public/data mirrors of open-rankings/, see scripts/copy-data.mjs) at runtime and feeds the parsed
// results through these helpers, keeping them unit-testable without fetch or React.
import type { Verdict } from './schemas'
import type { StoryTierKind } from './storyTiers'

export type VerdictKind = Verdict['verdict']

// The slice of a story-tiers.json entry a compare cell renders (see lib/storyTiers.ts —
// type-only import above keeps zod/node:fs out of the client bundle).
export interface CompareCellTier {
  tier: StoryTierKind
  tierNote?: string
}

// The slice of a Story the compare table renders/searches — everything else in stories.json
// (persona, group, origin) is dropped at parse time to keep in-memory caches small. `theme`
// survives so story rows can carry their theme's emoji + tooltip (components/ThemeIcon.tsx).
export interface CompareStoryMeta {
  id: string
  title: string
  weight: number
  scope: 'global' | 'category' | 'product' | null
  theme: string | null
}

// One arena's story-level data, parsed from its fetched stories.json + verdicts.json.
export interface ArenaStoryData {
  stories: CompareStoryMeta[]
  storyIds: ReadonlySet<string>
  /** `${productId}:${storyId}` -> that cell's verdict tier + quality. */
  cells: ReadonlyMap<string, { verdict: VerdictKind; quality: number }>
  /** `${productId}:${storyId}` -> pricing-tier annotation, where classified (story-tiers.json). */
  tiers: ReadonlyMap<string, CompareCellTier>
}

// Per-arena fetch lifecycle as CompareBuilder tracks it. `undefined` (arena not yet requested)
// is treated the same as 'loading' by storyCell.
export type ArenaFetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: ArenaStoryData }

// What one (product, story) cell should render. 'other-arena' is the honest cross-arena case:
// the story simply doesn't exist in that product's arena, which is not the same as 'none'
// (judged, no evidence) — see the n/a semantics in lib/schemas.ts's VerdictSchema.
export type StoryCellState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'other-arena' }
  | { kind: 'verdict'; verdict: VerdictKind; quality: number; tier?: StoryTierKind; tierNote?: string }

// Cap on user-added story rows (`?s=`), mirroring MAX_COMPARE's role for `?p=`.
export const MAX_COMPARE_STORIES = 12

// How many key-story rows render before "show all shared stories".
export const DEFAULT_KEY_STORY_ROWS = 8

const VERDICT_KINDS: ReadonlySet<string> = new Set(['full', 'partial', 'none', 'disputed', 'na'])
const SCOPES: ReadonlySet<string> = new Set(['global', 'category', 'product'])
const TIER_KINDS: ReadonlySet<string> = new Set(['free', 'paid', 'enterprise', 'unknown'])

// Parses `?s=story-a,story-b` into a deduped, trimmed id list capped at MAX_COMPARE_STORIES.
// Unlike parseCompareParam (lib/compare.ts) there is no validity set here: story ids can only
// be validated against arena data that arrives asynchronously, so unknown ids survive parsing
// and CompareBuilder prunes them once every selected arena has loaded (stale share links
// degrade, not error — same philosophy as `?p=`).
export function parseStoriesParam(raw: string | null | undefined): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const piece of raw.split(',')) {
    const id = piece.trim()
    if (id === '' || out.includes(id)) continue
    out.push(id)
    if (out.length === MAX_COMPARE_STORIES) break
  }
  return out
}

export function encodeStoriesParam(ids: string[]): string {
  return ids.join(',')
}

// Narrows freshly-fetched stories.json/verdicts.json into ArenaStoryData. Structural checks by
// hand (no zod client-side — bundle lean); anything malformed THROWS so the caller records a
// fetch failure and the UI says "couldn't load story data" — a broken file must never render
// as fake verdicts. `tiersJson` is the optional story-tiers.json payload (undefined when the
// arena has no file — most don't); a malformed TIER entry is skipped rather than failing the
// whole arena, because tiers are a display-only annotation, never load-bearing like verdicts.
export function toArenaStoryData(storiesJson: unknown, verdictsJson: unknown, tiersJson?: unknown): ArenaStoryData {
  if (!Array.isArray(storiesJson) || !Array.isArray(verdictsJson)) {
    throw new Error('malformed arena story data')
  }
  const stories: CompareStoryMeta[] = storiesJson.map((s) => {
    if (typeof s !== 'object' || s === null) throw new Error('malformed story entry')
    const { id, title, weight, scope, theme } = s as Record<string, unknown>
    if (typeof id !== 'string' || id === '' || typeof title !== 'string' || title === '') {
      throw new Error('malformed story entry')
    }
    return {
      id,
      title,
      weight: typeof weight === 'number' ? weight : 1,
      scope: typeof scope === 'string' && SCOPES.has(scope) ? (scope as CompareStoryMeta['scope']) : null,
      theme: typeof theme === 'string' && theme !== '' ? theme : null,
    }
  })
  const cells = new Map<string, { verdict: VerdictKind; quality: number }>()
  for (const v of verdictsJson) {
    if (typeof v !== 'object' || v === null) throw new Error('malformed verdict entry')
    const { productId, storyId, verdict, quality } = v as Record<string, unknown>
    if (
      typeof productId !== 'string' || productId === '' ||
      typeof storyId !== 'string' || storyId === '' ||
      typeof verdict !== 'string' || !VERDICT_KINDS.has(verdict) ||
      typeof quality !== 'number'
    ) {
      throw new Error('malformed verdict entry')
    }
    cells.set(`${productId}:${storyId}`, { verdict: verdict as VerdictKind, quality })
  }
  const tiers = new Map<string, CompareCellTier>()
  if (Array.isArray(tiersJson)) {
    for (const t of tiersJson) {
      if (typeof t !== 'object' || t === null) continue
      const { productId, storyId, tier, tierNote } = t as Record<string, unknown>
      if (
        typeof productId !== 'string' || productId === '' ||
        typeof storyId !== 'string' || storyId === '' ||
        typeof tier !== 'string' || !TIER_KINDS.has(tier)
      ) {
        continue
      }
      tiers.set(`${productId}:${storyId}`, {
        tier: tier as StoryTierKind,
        tierNote: typeof tierNote === 'string' && tierNote !== '' ? tierNote : undefined,
      })
    }
  }
  return { stories, storyIds: new Set(stories.map((s) => s.id)), cells, tiers }
}

// The KEY stories for a selection: `scope: 'global'` stories present in EVERY loaded arena —
// the canonical lens stories (MCP server, official CLI, public API, privacy/no-training, …)
// qualify by construction since they're injected into every arena (see lib/globalStories.ts).
// Weight-3 stories first, then weight desc, title asc for a deterministic order that doesn't
// depend on any one arena's file order. Title/weight come from the first arena (canonical
// titles are identical everywhere by contract). Empty input -> empty output.
export function sharedKeyStories(arenas: ArenaStoryData[]): CompareStoryMeta[] {
  if (arenas.length === 0) return []
  const [first, ...rest] = arenas
  return first.stories
    .filter((s) => s.scope === 'global' && rest.every((a) => a.storyIds.has(s.id)))
    .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title))
}

// A story available for user-added rows, tagged with which of the selected arenas carry it —
// the UI uses arenaIds to hint that a category-scoped pick will render n/a for products in
// other arenas.
export interface UnionStory extends CompareStoryMeta {
  arenaIds: string[]
}

// Union of the loaded arenas' stories, deduped by id (first arena's title wins — shared ids
// are the same authored story, see lib/globalStories.ts). Order follows first appearance.
export function storyUnion(arenas: Array<{ arenaId: string; data: ArenaStoryData }>): UnionStory[] {
  const byId = new Map<string, UnionStory>()
  for (const { arenaId, data } of arenas) {
    for (const s of data.stories) {
      const existing = byId.get(s.id)
      if (existing) existing.arenaIds.push(arenaId)
      else byId.set(s.id, { ...s, arenaIds: [arenaId] })
    }
  }
  return [...byId.values()]
}

// Case-insensitive title-substring search over the union, excluding ids already on the table
// (key stories + already-added rows). Empty/whitespace query -> no suggestions.
export function searchStories(
  pool: UnionStory[],
  query: string,
  excludeIds: ReadonlySet<string>,
  max: number,
): UnionStory[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return pool.filter((s) => !excludeIds.has(s.id) && s.title.toLowerCase().includes(q)).slice(0, max)
}

// Resolves what one product's cell shows for a story row, given that product's arena fetch
// state. A story the arena doesn't carry is 'other-arena' (honest n/a, not a verdict); a story
// the arena DOES carry but has no verdict cell for is treated as a load error — lib/data.ts
// guarantees a full product x story matrix, so a hole means broken data, and we never invent
// a verdict to paper over it.
export function storyCell(
  state: ArenaFetchState | undefined,
  productId: string,
  storyId: string,
): StoryCellState {
  if (!state || state.status === 'loading') return { kind: 'loading' }
  if (state.status === 'error') return { kind: 'error' }
  if (!state.data.storyIds.has(storyId)) return { kind: 'other-arena' }
  const cell = state.data.cells.get(`${productId}:${storyId}`)
  if (!cell) return { kind: 'error' }
  const tier = state.data.tiers.get(`${productId}:${storyId}`)
  return { kind: 'verdict', verdict: cell.verdict, quality: cell.quality, tier: tier?.tier, tierNote: tier?.tierNote }
}
