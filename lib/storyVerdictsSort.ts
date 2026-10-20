// Pure row-building + sort/filter logic for components/StoryVerdictsTable.tsx, kept out of the
// client component so it's testable without rendering React — the same split as
// lib/arenaTableSort.ts / components/ArenaTable.tsx. Everything imported here is node:fs-free
// (data-helpers + verification are explicitly client-safe), so the client bundle stays clean.

import {
  evidenceById, originLabel, uncertaintyFor, vendorResponseFor, verdictFor, type CategoryData,
} from './data-helpers'
import type { Evidence, Story, UncertaintyEntry, VendorResponse, Verdict } from './schemas'
import type { StoryTier, StoryTierKind } from './storyTiers'
import { parseStoryPersona } from './storyText'
import { cellAuthGated, strongestEvidence, verificationLevel, type VerificationLevel } from './verification'

export type StoryVerdictColumn =
  | 'importance'
  | 'title'
  | 'persona'
  | 'theme'
  | 'weight'
  | 'verdict'
  | 'quality'
  | 'verification'
  | 'evidence'

export type SortDirection = 'asc' | 'desc'

// One related founder process, flattened to exactly what the table's "Processes" column chip
// renders — icon + title linking to /processes/<slug>#steps. Serializable (server page →
// client table); produced by lib/storyGraph.ts's storyProcessesForArena, defined here (the
// table's client-safe types module) so the client bundle never touches node:fs.
export interface StoryProcessLink {
  slug: string
  title: string
  icon: string
}

// One cited evidence item, flattened to exactly what the expanded row renders — url, tier
// badge, excerpt. Serializable (server page → client table), no Map/CategoryData crossing.
export interface StoryVerdictEvidenceLink {
  id: string
  tier: Evidence['tier']
  url: string
  excerpt: string
}

// One (story, verdict) cell for a single product, flattened server-side so the client table
// never needs the full CategoryData.
export interface StoryVerdictRow {
  storyId: string
  title: string
  persona: string
  // parseStoryPersona(title) split, precomputed here so the client table renders and sorts the
  // de-framed text without re-parsing per render: `action` is the standalone capability
  // sentence the Story column displays, `personaLabel` the prose persona for the PersonaChip
  // (falls back to the story's machine persona tag so the chip never goes missing).
  action: string
  personaLabel: string
  // originLabel(story) — surfaced as the title tooltip, same as the old vertical list.
  origin: string
  theme: string
  group: string
  weight: number
  verdict: Verdict['verdict']
  quality: number
  confidence: Verdict['confidence']
  rationale: string
  verification: VerificationLevel
  // cellAuthGated (lib/verification.ts): this verdict cites a probe that hit a live auth wall
  // — the table renders the ⚿ marker so "we couldn't test past sign-in" never reads as absence.
  authGated: boolean
  evidence: StoryVerdictEvidenceLink[]
  // strongestEvidence(...)?.url — the single best "proof ↗" link, or null if nothing cited.
  proofUrl: string | null
  // Story scope (global/category/product — see lib/schemas.ts's StorySchema), undefined for
  // stories not yet tagged; the table renders it as a [G]/[C]/[P] chip and a filter option.
  scope?: Story['scope']
  // `/global/{storyId}` when this is a global story with a cross-arena comparison page (see
  // lib/globalStories.ts's globalStoryIds), else null — the [G] chip links here.
  globalHref: string | null
  // Multi-judge agreement ('2/3' etc) when an uncertainty entry exists for this cell.
  agreement?: UncertaintyEntry['agreement']
  // vendorResponseFor(...) for this cell, or null — the verified official vendor response the
  // expanded row renders (see components/StoryVerdictsTable.tsx's block and
  // docs/vendor-responses.md). Full VendorResponse shape is already serializable (plain JSON).
  vendorResponse: VendorResponse | null
  // Pricing-tier annotation for this cell (lib/storyTiers.ts) — which plan tier the cited
  // evidence says the capability needs. Undefined when the arena/cell was never classified
  // (only full/partial cells are); 'unknown' when classified but the evidence never states
  // gating. Display-only, never part of sorting weight or scores.
  tier?: StoryTierKind
  // The gating one-liner behind a non-unknown tier ("SSO on Enterprise plan only") — the
  // TierChip tooltip.
  tierNote?: string
}

export function buildStoryVerdictRows(
  data: CategoryData,
  productId: string,
  // Ids that have a /global/[story] page (lib/globalStories.ts's globalStoryIds) — optional so
  // callers that never render the chip link (tests, llms.md) can skip the cross-arena load.
  globalStoryIds?: ReadonlySet<string>,
  // `${productId}:${storyId}` -> pricing-tier annotation (lib/storyTiers.ts's storyTiersByCell)
  // — optional, same tolerant contract as the file itself: unclassified arenas pass nothing.
  tiersByCell?: ReadonlyMap<string, StoryTier>,
): StoryVerdictRow[] {
  const evidence = evidenceById(data)
  return data.stories.map((s) => {
    const v = verdictFor(data, productId, s.id)
    const tier = tiersByCell?.get(`${productId}:${s.id}`)
    const proof = strongestEvidence(v, evidence)
    const parsed = parseStoryPersona(s.title)
    return {
      storyId: s.id,
      title: s.title,
      persona: s.persona,
      action: parsed.action,
      personaLabel: parsed.persona ?? s.persona,
      origin: originLabel(s),
      theme: s.theme,
      group: s.group,
      weight: s.weight,
      scope: s.scope,
      globalHref: s.scope === 'global' && globalStoryIds?.has(s.id) ? `/global/${s.id}` : null,
      verdict: v.verdict,
      quality: v.quality,
      confidence: v.confidence,
      rationale: v.rationale,
      verification: verificationLevel(v, evidence),
      authGated: cellAuthGated(v, evidence),
      evidence: v.evidenceIds
        .map((eid) => evidence.get(eid))
        .filter((e): e is Evidence => e !== undefined)
        .map((e) => ({ id: e.id, tier: e.tier, url: e.url, excerpt: e.excerpt })),
      proofUrl: proof?.url ?? null,
      agreement: uncertaintyFor(data, productId, s.id)?.agreement,
      vendorResponse: vendorResponseFor(data, productId, s.id) ?? null,
      tier: tier?.tier,
      tierNote: tier?.tierNote,
    }
  })
}

// Per-cell version of lib/data-helpers.ts's isGroupUntested rule: a zero-evidence none/na means
// we found nothing pro or con and never probed — rendering its quality as 0 would overstate
// what we know, so the table shows "untested" and sorts it last (like a null).
export function isStoryUntested(row: Pick<StoryVerdictRow, 'verdict' | 'evidence'>): boolean {
  return (row.verdict === 'none' || row.verdict === 'na') && row.evidence.length === 0
}

// Verdict strength ladder for sorting: a full pass beats partial beats disputed beats an
// evidenced "none", with "n/a" (story doesn't apply) last.
const VERDICT_STRENGTH: Record<Verdict['verdict'], number> = {
  full: 4,
  partial: 3,
  disputed: 2,
  none: 1,
  na: 0,
}

// How independently substantiated the verdict is: hands-on probe > community corroboration >
// vendor's own claim > actively disputed > nothing citable at all.
const VERIFICATION_RANK: Record<VerificationLevel, number> = {
  tested: 4,
  corroborated: 3,
  'vendor-claim': 2,
  disputed: 1,
  unverified: 0,
}

// Human-readable label for the live "Sorted by ___" strip, mirroring arenaTableSort's
// COLUMN_LABELS convention.
export const COLUMN_LABELS: Record<StoryVerdictColumn, string> = {
  importance: 'importance (agentic first)',
  title: 'story title',
  persona: 'user type',
  theme: 'theme',
  weight: 'weight',
  verdict: 'verdict strength',
  quality: 'quality',
  verification: 'verification',
  evidence: 'evidence count',
}

// Text columns default ascending (A→Z); every ranked/numeric column defaults descending
// (strongest/highest first) — same convention as arenaTableSort's defaultDirectionFor.
export function defaultDirectionFor(column: StoryVerdictColumn): SortDirection {
  return column === 'title' || column === 'theme' || column === 'persona' ? 'asc' : 'desc'
}

// The default reading order: what matters most for the AI era first. Agenticness-theme stories
// (the shared canon: MCP, CLI, API, headless, autonomy) lead, then story weight (3 = the
// arena's decisive stories), then quality so within a tier the strongest showing reads first.
// Title as the final tiebreaker keeps the order stable across re-renders.
function importanceKey(row: StoryVerdictRow): [number, number, number] {
  return [row.theme === 'agenticness' ? 0 : 1, -row.weight, -(isStoryUntested(row) ? -1 : row.quality)]
}

function compareImportance(a: StoryVerdictRow, b: StoryVerdictRow): number {
  const ka = importanceKey(a)
  const kb = importanceKey(b)
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i]
  }
  return a.action.localeCompare(b.action)
}

function compareNullableNumber(a: number | null, b: number | null, direction: SortDirection): number {
  // Nulls (untested cells on the quality column) always sort last regardless of direction —
  // "we don't know" is never honestly the best or worst quality.
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return direction === 'desc' ? b - a : a - b
}

function numericValue(row: StoryVerdictRow, column: Exclude<StoryVerdictColumn, 'title' | 'theme' | 'persona' | 'importance'>): number | null {
  switch (column) {
    case 'weight':
      return row.weight
    case 'verdict':
      return VERDICT_STRENGTH[row.verdict]
    case 'quality':
      return isStoryUntested(row) ? null : row.quality
    case 'verification':
      return VERIFICATION_RANK[row.verification]
    case 'evidence':
      return row.evidence.length
  }
}

export function sortStoryVerdictRows(
  rows: StoryVerdictRow[],
  column: StoryVerdictColumn,
  direction: SortDirection,
): StoryVerdictRow[] {
  return [...rows].sort((a, b) => {
    if (column === 'importance') {
      const cmp = compareImportance(a, b)
      return direction === 'desc' ? cmp : -cmp
    }
    if (column === 'title' || column === 'theme' || column === 'persona') {
      // The Story column displays row.action (persona frame stripped) — sort by what the
      // reader sees, not the hidden "As a …" prefix that would bucket rows by persona.
      const key = column === 'title' ? ('action' as const) : column === 'persona' ? ('personaLabel' as const) : ('theme' as const)
      const cmp = a[key].localeCompare(b[key])
      return direction === 'desc' ? -cmp : cmp
    }
    return compareNullableNumber(numericValue(a, column), numericValue(b, column), direction)
  })
}

// Case-insensitive substring match over title + persona + theme + group (the text filter),
// optionally intersected with an exact theme (the theme dropdown), an exact scope (the scope
// dropdown), an exact pricing tier (the tier dropdown — 'free'/'paid'/'enterprise' match
// classified rows only; unclassified/unknown rows never match a tier filter), and/or an exact
// user type (the persona dropdown, matching the "User type" column's personaLabel). Empty
// theme/scope/tier/persona = no restriction.
export function filterStoryVerdictRows(
  rows: StoryVerdictRow[],
  query: string,
  theme = '',
  scope = '',
  tier = '',
  persona = '',
): StoryVerdictRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (theme !== '' && r.theme !== theme) return false
    if (scope !== '' && r.scope !== scope) return false
    if (tier !== '' && r.tier !== tier) return false
    if (persona !== '' && r.personaLabel !== persona) return false
    if (q === '') return true
    return (
      r.title.toLowerCase().includes(q) ||
      r.persona.toLowerCase().includes(q) ||
      r.theme.toLowerCase().includes(q) ||
      r.group.toLowerCase().includes(q)
    )
  })
}
