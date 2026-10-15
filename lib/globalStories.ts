// Cross-arena view over `scope: 'global'` stories (see lib/schemas.ts's StorySchema and
// rankings-engine/scripts/tag-story-scopes.ts): a global story id that appears in TWO OR MORE arenas
// is comparable across the whole site — "who supports 2FA / an official CLI / webhooks across
// all software we rank" — and gets its own /global/[story] page (app/global/[story]/page.tsx).
// The 29 canonical lens ids qualify by construction (injected into every arena); a non-canonical
// global story qualifies only when at least two arenas independently authored it under the same
// id. Pure and `node:fs`-free (same contract as lib/data-helpers.ts): callers pass CategoryData[]
// (usually loadAll()), tests pass fixtures.
import { verdictFor, type CategoryData } from './data-helpers'
import type { Story, Verdict } from './schemas'

// One product's verdict on a global story, flattened to what the /global/[story] table renders.
export interface GlobalStoryCell {
  categoryId: string
  categoryName: string
  productId: string
  productName: string
  verdict: Verdict['verdict']
  quality: number
  evidenceCount: number
}

export interface GlobalStory {
  id: string
  // Title from the first arena carrying the story — canonical titles are identical everywhere
  // by contract, and a shared non-canonical id is the same authored story.
  title: string
  arenaCount: number
  // Every ranked product's verdict on this story, across every arena that carries it.
  cells: GlobalStoryCell[]
}

// Verdict strength for row ordering on the /global/ pages: same ladder as
// lib/storyVerdictsSort.ts's VERDICT_STRENGTH (full > partial > disputed > none > na).
const VERDICT_ORDER: Record<Verdict['verdict'], number> = { full: 4, partial: 3, disputed: 2, none: 1, na: 0 }

function cellsFor(data: CategoryData, story: Story): GlobalStoryCell[] {
  return data.products.map((p) => {
    const v = verdictFor(data, p.id, story.id)
    return {
      categoryId: data.category.id,
      categoryName: data.category.name,
      productId: p.id,
      productName: p.name,
      verdict: v.verdict,
      quality: v.quality,
      evidenceCount: v.evidenceIds.length,
    }
  })
}

// Every global story present (with scope 'global') in ≥2 arenas, with one cell per (arena,
// product) pair. Cells are sorted strongest-first (verdict ladder, then quality, then evidence
// count) so the page reads as a cross-software leaderboard; stories are sorted by arena
// coverage (widest first), then id, for a stable generateStaticParams order.
export function collectGlobalStories(categories: CategoryData[]): GlobalStory[] {
  const byId = new Map<string, { title: string; arenaIds: Set<string>; cells: GlobalStoryCell[] }>()
  for (const data of categories) {
    for (const story of data.stories) {
      if (story.scope !== 'global') continue
      const entry = byId.get(story.id) ?? { title: story.title, arenaIds: new Set<string>(), cells: [] }
      entry.arenaIds.add(data.category.id)
      entry.cells.push(...cellsFor(data, story))
      byId.set(story.id, entry)
    }
  }
  return [...byId.entries()]
    .filter(([, e]) => e.arenaIds.size >= 2)
    .map(([id, e]) => ({
      id,
      title: e.title,
      arenaCount: e.arenaIds.size,
      cells: [...e.cells].sort(
        (a, b) =>
          VERDICT_ORDER[b.verdict] - VERDICT_ORDER[a.verdict] ||
          b.quality - a.quality ||
          b.evidenceCount - a.evidenceCount ||
          a.productId.localeCompare(b.productId),
      ),
    }))
    .sort((a, b) => b.arenaCount - a.arenaCount || a.id.localeCompare(b.id))
}

export function findGlobalStory(categories: CategoryData[], storyId: string): GlobalStory | null {
  return collectGlobalStories(categories).find((s) => s.id === storyId) ?? null
}

// The set of story ids that have a /global/[story] page — what the product page's scope chip
// links to (a global story present in only one arena has nothing cross-arena to show yet).
export function globalStoryIds(categories: CategoryData[]): ReadonlySet<string> {
  return new Set(collectGlobalStories(categories).map((s) => s.id))
}
