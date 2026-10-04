// Pure, `node:fs`-free helpers split out of lib/data.ts so CLIENT components (ArenaTable,
// StoryMatrix) can import them directly without dragging lib/data.ts's `node:fs`/`node:path`
// imports into the browser bundle — Turbopack hard-errors on a client-reachable module
// statically importing a Node builtin, even if the code path is never actually called client-
// side. lib/data.ts re-exports everything here for backward compatibility, so existing server
// call sites (`import { verdictFor } from '@/lib/data'`) are unaffected.
import type { Certification } from './certifications'
import type { Category, Claim, Evidence, Popularity, Product, Rankings, Stack, Story, UncertaintyEntry, VendorResponse, Verdict } from './schemas'
import { parseStoryPersona } from './storyText'

// "canonical", "normalized · v2", etc — see lib/schemas.ts's StoryOriginSchema. Falls back to
// "unknown" for stories migrated/authored before origin existed. Shared by both the (client)
// StoryMatrix and the (server) product detail page, so it lives here rather than in either.
export function originLabel(story: Story): string {
  const origin = story.origin
  if (!origin) return 'unknown'
  return origin.promptVersion ? `${origin.kind} · ${origin.promptVersion}` : origin.kind
}

export interface CategoryData {
  category: Category
  products: Product[]
  stories: Story[]
  evidence: Record<string, Evidence[]>
  verdicts: Verdict[]
  rankings: Rankings
  stacks: Stack[]
  // Keyless popularity/momentum signal, keyed by productId — see lib/schemas.ts's
  // PopularityMapSchema and pipeline/stages/popularity.ts. `data/{cat}/popularity.json` is
  // optional (not every category has been through the popularity stage yet, and even when it
  // has, most products have no discoverable GitHub/npm/pypi signal), so this is `{}` rather
  // than undefined when absent — display code should look up by productId and treat a miss as
  // "no public signals", not as an error.
  popularity: Record<string, Popularity>
  // Keyed by productId — see lib/schemas.ts's ClaimSchema and pipeline/stages/claims.ts.
  // `data/{cat}/claims/` is optional (not every category has been through the claims stage yet)
  // and, even when present, an individual product's file may be missing — both cases resolve to
  // `[]` for that productId rather than an error, same "absence is not an error" contract as
  // popularity above.
  claims: Record<string, Claim[]>
  // Multi-judge uncertainty results — see lib/schemas.ts's UncertaintyEntrySchema and
  // pipeline/scripts/uncertainty-pass.ts. `data/{cat}/uncertainty.json` is optional (most
  // categories are never a "close race", and even a qualifying one only covers its decisive
  // cells) — absence resolves to `[]`, same "absence is not an error" contract as popularity and
  // claims above. Use uncertaintyFor(data, productId, storyId) rather than scanning this array
  // directly.
  uncertainty: UncertaintyEntry[]
  // Verified official vendor responses to specific verdicts — see lib/schemas.ts's
  // VendorResponseSchema and docs/VENDOR-RESPONSES.md. `data/{cat}/vendor-responses.json` is
  // optional (most categories have none) — absence resolves to `[]`, same "absence is not an
  // error" contract as popularity/claims/uncertainty above. Use vendorResponseFor(data,
  // productId, storyId) rather than scanning this array directly.
  vendorResponses: VendorResponse[]
  // Agent-Ready certifications earned through the self-serve conformance suite — see
  // lib/certifications.ts and docs/CERTIFICATION.md. `data/{cat}/certifications.json` is
  // optional (most arenas have none) — absence resolves to `[]`, same "absence is not an
  // error" contract as everything above. Use activeCertificationFor(data.certifications,
  // productId) rather than scanning this array directly: entries past their 180-day expiry
  // must not render as current certifications.
  certifications: Certification[]
}

export function battleSlug(a: string, b: string): string {
  return `${a}-vs-${b}`
}

export function parseBattleSlug(slug: string, products: Product[]): { a: string; b: string } | null {
  for (const a of products) {
    const prefix = `${a.id}-vs-`
    if (!slug.startsWith(prefix)) continue
    const b = slug.slice(prefix.length)
    if (b !== a.id && products.some((p) => p.id === b)) return { a: a.id, b }
  }
  return null
}

// Resolves a `/vs/{slug}` slug (now a permanent redirect to the arena battle page — see
// app/vs/[slug]/page.tsx) to a category's battle. Product ids are globally unique, so a slug
// parses into a real (a, b) pair in at most the categories that rank BOTH products; for the
// few pairs that battle in two arenas, the first category in `categories` order wins — the
// same battle the /vs page rendered before it became a redirect. Returns null if no category
// recognizes the slug (unknown slug / stale link).
export function findBattleBySlug(
  categories: CategoryData[],
  slug: string,
): { data: CategoryData; battle: Rankings['battles'][number] } | null {
  for (const data of categories) {
    const pair = parseBattleSlug(slug, data.products)
    if (!pair) continue
    const battle = data.rankings.battles.find((b) => b.a === pair.a && b.b === pair.b)
    if (battle) return { data, battle }
  }
  return null
}

// The #1-vs-#2 battle for a category's Arena-Score leaderboard — the homepage's "Leading
// battles" section and llms.txt's example battle links. Null only for a category with fewer than
// two products (every populated category has at least two — see lib/data.ts's expectedPairs
// check — so this is purely a defensive fallback, not an expected runtime case).
export function leadingBattle(data: CategoryData): Rankings['battles'][number] | null {
  const [first, second] = data.rankings.leaderboard
  if (!first || !second) return null
  const idx = (id: string) => data.products.findIndex((p) => p.id === id)
  const [a, b] =
    idx(first.productId) <= idx(second.productId) ? [first.productId, second.productId] : [second.productId, first.productId]
  return data.rankings.battles.find((bt) => bt.a === a && bt.b === b) ?? null
}

export function verdictFor(data: CategoryData, productId: string, storyId: string): Verdict {
  const v = data.verdicts.find((x) => x.productId === productId && x.storyId === storyId)
  if (!v) throw new Error(`missing verdict for cell ${productId}:${storyId}`)
  return v
}

export function evidenceById(data: CategoryData): Map<string, Evidence> {
  return new Map(Object.values(data.evidence).flat().map((e) => [e.id, e]))
}

// Looks up the multi-judge uncertainty result for one cell, if any was recorded — see
// CategoryData.uncertainty's doc. Undefined (not an error) for the overwhelming majority of
// cells: most arenas were never a "close race", and even a qualifying one only re-judged its
// decisive agenticness-theme cells.
export function uncertaintyFor(data: CategoryData, productId: string, storyId: string): UncertaintyEntry | undefined {
  return data.uncertainty.find((u) => u.productId === productId && u.storyId === storyId)
}

// Looks up the vendor response to show for one cell, if any — the 'standing' one when present
// (lib/data.ts enforces at most one per cell), else the most recent 'superseded' one (still the
// public record, just labeled as incorporated by a later re-judge). Undefined for the
// overwhelming majority of cells — see CategoryData.vendorResponses's doc.
export function vendorResponseFor(data: CategoryData, productId: string, storyId: string): VendorResponse | undefined {
  const forCell = data.vendorResponses.filter((r) => r.productId === productId && r.storyId === storyId)
  if (forCell.length === 0) return undefined
  return (
    forCell.find((r) => r.status === 'standing') ??
    [...forCell].sort((a, b) => b.respondedAt.localeCompare(a.respondedAt))[0]
  )
}

// Every story title is authored as "As a(n) {persona description}, {clause}" (see
// pipeline/agentic-stories.ts + normalize.ts + depth-mine.ts's commonRules). The persona clause
// is redundant once a story has its own persona tag/column/chip, so this strips it for
// *display only* — the underlying Story.title is never mutated, and if a title doesn't match
// the expected shape (defensive: hand-edited/legacy titles), it's returned unchanged rather
// than mangled. Thin wrapper over lib/storyText.ts's parseStoryPersona — call that directly
// when you also want the persona label (e.g. to render a PersonaChip next to the action).
export function stripPersonaPrefix(title: string): string {
  return parseStoryPersona(title).action
}

// Buckets items by a key, preserving the order each key was first seen. Used to group
// stories/rounds by theme→group without imposing an alphabetical or schema-declared order.
export function groupInOrder<T>(items: T[], keyOf: (item: T) => string): Array<[string, T[]]> {
  const order: string[] = []
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(item)
  }
  return order.map((key) => [key, buckets.get(key)!])
}

// "Untested" = every cell in the group is a zero-evidence none/na: we found nothing pro or con
// and never probed it, so rendering the group score as 0 would overstate what we know. Tables
// use this to show "untested" instead of a hard 0 (e.g. API quality for CLI-first products
// whose evidence packs simply never covered an API surface).
export function isGroupUntested(data: CategoryData, productId: string, group: string): boolean {
  const groupStories = data.stories.filter((s) => s.group === group)
  if (groupStories.length === 0) return true
  return groupStories.every((s) => {
    const v = verdictFor(data, productId, s.id)
    return (v.verdict === 'none' || v.verdict === 'na') && v.evidenceIds.length === 0
  })
}

// Theme-scoped twin of isGroupUntested, for the two Overall-score components that are theme scores
// rather than group scores (openness ← theme 'openness', automation ← theme 'automation-depth'
// — see lib/scoring.ts). Same honesty rule: a theme score built entirely from zero-evidence
// none/na cells is "untested", not 0.
export function isThemeUntested(data: CategoryData, productId: string, theme: string): boolean {
  const themeStories = data.stories.filter((s) => s.theme === theme)
  if (themeStories.length === 0) return true
  return themeStories.every((s) => {
    const v = verdictFor(data, productId, s.id)
    return (v.verdict === 'none' || v.verdict === 'na') && v.evidenceIds.length === 0
  })
}
