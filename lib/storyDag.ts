// Pure helpers behind components/StoryMap.tsx — heuristic clustering for an arena's domain-mined
// stories plus the Kahn layering the canon clusters render with. Domain stories have no curated
// builds-on graph (they're LLM-mined per arena), but they aren't flat either: "run a full payroll
// cycle", "run an off-cycle payroll" and "cancel or correct a submitted payroll" are one payroll-
// runs capability with variants. So within each taxonomy `group` we cluster titles by their
// leading stem (first significant token after the persona prefix), pick the highest-weight story
// as the cluster root, and list the rest as siblings under it. Deterministic and fs-free; unit
// tests (lib/__tests__/storyDag.test.ts) pin the behavior on two real arenas' fixtures.

import { stripPersonaPrefix } from './data-helpers'
import { humanizeTheme } from './themeLabels'

// Tokens that never carry the capability: articles/pronouns/prepositions plus the generic lead
// verbs mined titles open with ("have the agent…", "get automatic…", "see license…"). Dropping
// them makes the first remaining token the story's stem — the key noun/verb of the capability.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'my', 'i', 'me', 'it', 'its', 'their', 'them', 'this', 'that',
  'these', 'those', 'is', 'are', 'be', 'been', 'can', 'have', 'has', 'had', 'get', 'gets', 'see',
  'let', 'lets', 'use', 'via', 'with', 'without', 'for', 'to', 'in', 'into', 'of', 'on', 'off',
  'from', 'by', 'as', 'at', 'so', 'one', 'own', 'all', 'both', 'each', 'every', 'directly', 'up',
])

// Crude singularizer so "agents"/"agent" and "payrolls"/"payroll" share a stem. Deliberately
// conservative: only a trailing "s" after 3+ chars, never "ss" (address, process).
function singularize(token: string): string {
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

// Persona-stripped, lowercased, stopword-free significant tokens of a story title, in order.
export function significantTokens(title: string): string[] {
  return stripPersonaPrefix(title)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(singularize)
}

// The minimal story shape clustering needs — lib callers pass Story, StoryMap passes rows.
export interface ClusterableStory {
  id: string
  title: string
  weight: number
}

export interface DomainCluster {
  // Deterministic slug: the shared stem (multi-story clusters) or the story id (singletons).
  id: string
  // Tidied shared-stem label ("Run payroll", "Agent ops"), or null for singletons — a box header
  // repeating the lone story's own title would just say it twice.
  label: string | null
  // Highest-weight member (ties: first in input order) — the trunk the siblings hang off.
  rootId: string
  // Root first, then the remaining members in input order.
  storyIds: string[]
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "Run" alone is a weak header — extend the stem with a companion token every member shares.
// Among the shared candidates, prefer the one that is consistently earliest (smallest worst-case
// position across members; ties → earlier in the root's title), so "run an off-cycle payroll" +
// "run a full payroll cycle" labels "Run payroll", not "Run cycle".
function clusterLabel(stem: string, memberTokens: string[][]): string {
  const [rootTokens, ...rest] = memberTokens
  let best: { token: string; maxPos: number } | null = null
  for (let i = 1; i < rootTokens.length; i++) {
    const candidate = rootTokens[i]
    if (candidate === stem) continue
    const positions = rest.map((tokens) => tokens.indexOf(candidate, 1))
    if (positions.some((p) => p === -1)) continue
    const maxPos = Math.max(i, ...positions)
    if (best === null || maxPos < best.maxPos) best = { token: candidate, maxPos }
  }
  return capitalize(best ? `${stem} ${best.token}` : stem)
}

// Greedy leading-stem clustering over one group's stories: bucket by first significant token,
// buckets of one stay singletons. Pure and order-stable — same input, same clusters.
export function clusterDomainStories(stories: ClusterableStory[]): DomainCluster[] {
  const stemOf = new Map(stories.map((s) => [s.id, significantTokens(s.title)]))
  const buckets: Array<{ stem: string; members: ClusterableStory[] }> = []
  const byStem = new Map<string, { stem: string; members: ClusterableStory[] }>()
  for (const story of stories) {
    const stem = stemOf.get(story.id)![0] ?? story.id
    const bucket = byStem.get(stem)
    if (bucket) {
      bucket.members.push(story)
    } else {
      const fresh = { stem, members: [story] }
      byStem.set(stem, fresh)
      buckets.push(fresh)
    }
  }
  return buckets.map(({ stem, members }) => {
    const root = members.reduce((best, s) => (s.weight > best.weight ? s : best), members[0])
    const singleton = members.length === 1
    return {
      id: singleton ? members[0].id : `stem-${stem}`,
      label: singleton ? null : clusterLabel(stem, [root, ...members.filter((m) => m !== root)].map((m) => stemOf.get(m.id)!)),
      rootId: root.id,
      storyIds: [root.id, ...members.filter((m) => m !== root).map((m) => m.id)],
    }
  })
}

// Taxonomy group/theme id → box header ("pay-runs" → "Pay runs"). Defers to lib/icons.ts's
// humanizeTheme — the site's one kebab-id humanizer — so plain-language display overrides
// (e.g. 'action-primitives' → 'Agent actions') apply to story-map box headers too.
export function tidyGroupLabel(group: string): string {
  return humanizeTheme(group)
}

// Kahn layering (same approach as components/ProcessDag.tsx's layerNodes, over bare ids): each
// topological layer is one diagram row; >1 id in a layer renders side by side. Ids without edges
// are their own layers in input order; ids a cycle would strand are appended as their own rows.
export function layerByEdges(ids: string[], edges: Array<[string, string]>): string[][] {
  const idSet = new Set(ids)
  const order = new Map(ids.map((id, i) => [id, i]))
  const inDegree = new Map(ids.map((id) => [id, 0]))
  const children = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const [from, to] of edges) {
    if (!idSet.has(from) || !idSet.has(to)) continue
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
    children.get(from)?.push(to)
  }
  if (edges.length === 0) return ids.map((id) => [id])
  const layers: string[][] = []
  const seen = new Set<string>()
  let frontier = ids.filter((id) => (inDegree.get(id) ?? 0) === 0)
  while (frontier.length > 0) {
    const layer: string[] = []
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      layer.push(id)
      for (const child of children.get(id) ?? []) {
        const d = (inDegree.get(child) ?? 1) - 1
        inDegree.set(child, d)
        if (d <= 0) next.push(child)
      }
    }
    if (layer.length > 0) {
      layer.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      layers.push(layer)
    }
    frontier = next
  }
  for (const id of ids) if (!seen.has(id)) layers.push([id])
  return layers
}
