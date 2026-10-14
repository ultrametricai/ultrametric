// Curated "builds-on" DAG over the canonical lens stories (open-rankings/story-graph.json), zod-validated
// at module load so a malformed edit fails the build, not the reader. The graph is hand-authored
// — stories aren't flat: you can't have webhooks without an API, MCP presumes programmatic
// access, headless presumes a CLI — and components/StoryMap.tsx renders it as the canon half of
// the per-product story map. Structural invariants beyond the schema (every id canonical, the
// clusters partition the canon exactly, edges stay inside one cluster, no cycles) live in
// lib/__tests__/storyGraph.test.ts rather than here: the canon ids come from
// pipeline/agentic-stories.ts, which must not leak into the app bundle.

import { z } from 'zod'
import graphJson from '@/open-rankings/story-graph.json'

export const StoryGraphSchema = z.object({
  // [from, to] — "to builds on from". Always within a single cluster (tested).
  edges: z.array(z.tuple([z.string().min(1), z.string().min(1)])),
  clusters: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      // The capability the rest of the cluster hangs off — rendered first. Optional in the
      // schema shape, but every curated cluster sets it (edge-less clusters need the anchor).
      rootId: z.string().min(1).optional(),
      storyIds: z.array(z.string().min(1)).min(1),
    }),
  ),
})

export type StoryGraph = z.infer<typeof StoryGraphSchema>
export type StoryGraphCluster = StoryGraph['clusters'][number]

export const storyGraph: StoryGraph = StoryGraphSchema.parse(graphJson)

// Every story id the curated graph covers — the complement (an arena's domain-mined stories)
// goes through lib/storyDag.ts's heuristic clustering instead.
export const canonGraphStoryIds: ReadonlySet<string> = new Set(
  storyGraph.clusters.flatMap((c) => c.storyIds),
)

// The curated edges that live inside one cluster (all of them, per the test — this filter is
// belt-and-braces for renderers keyed to a single cluster's member set).
export function clusterEdges(cluster: StoryGraphCluster): Array<[string, string]> {
  const members = new Set(cluster.storyIds)
  return storyGraph.edges.filter(([from, to]) => members.has(from) && members.has(to))
}
