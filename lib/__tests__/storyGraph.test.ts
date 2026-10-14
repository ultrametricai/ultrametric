// Structural validation of the curated canon story DAG (open-rankings/story-graph.json via
// lib/storyGraph.ts). The canon ids come straight from pipeline/agentic-stories.ts — the single
// source of truth normalize.ts injects into every arena — so a canon rename or addition that
// isn't mirrored in the graph fails here, not silently in the map render.

import { describe, expect, it } from 'vitest'
import {
  AGENTIC_FEATURE_STORIES, AGENTIC_STORIES, API_QUALITY_STORIES, AUTOMATION_STORIES,
  OPENNESS_STORIES, PRIVACY_STORIES,
} from '@/pipeline/agentic-stories'
import { canonGraphStoryIds, clusterEdges, storyGraph } from '@/lib/storyGraph'

const CANON = [
  ...AGENTIC_STORIES,
  ...AGENTIC_FEATURE_STORIES,
  ...OPENNESS_STORIES,
  ...AUTOMATION_STORIES,
  ...API_QUALITY_STORIES,
  ...PRIVACY_STORIES,
]
const canonIds = new Set(CANON.map((s) => s.id))
const themeOf = new Map(CANON.map((s) => [s.id, s.theme]))

describe('story-graph.json', () => {
  it('references only canonical story ids in edges', () => {
    for (const [from, to] of storyGraph.edges) {
      expect(canonIds.has(from), `edge from unknown id ${from}`).toBe(true)
      expect(canonIds.has(to), `edge to unknown id ${to}`).toBe(true)
      expect(from).not.toBe(to)
    }
  })

  it('clusters partition the canon exactly (every id once, nothing else)', () => {
    const seen = new Map<string, string>()
    for (const cluster of storyGraph.clusters) {
      for (const id of cluster.storyIds) {
        expect(canonIds.has(id), `cluster ${cluster.id} has non-canon id ${id}`).toBe(true)
        expect(seen.has(id), `id ${id} in both ${seen.get(id)} and ${cluster.id}`).toBe(false)
        seen.set(id, cluster.id)
      }
    }
    expect(seen.size).toBe(canonIds.size)
    expect(canonGraphStoryIds.size).toBe(canonIds.size)
  })

  it('keeps every edge inside a single cluster', () => {
    const clusterOf = new Map(storyGraph.clusters.flatMap((c) => c.storyIds.map((id) => [id, c.id] as const)))
    for (const [from, to] of storyGraph.edges) {
      expect(clusterOf.get(from), `edge ${from}→${to} crosses clusters`).toBe(clusterOf.get(to))
    }
  })

  it('gives every cluster a single theme and a rootId that is a member with no parent', () => {
    for (const cluster of storyGraph.clusters) {
      const themes = new Set(cluster.storyIds.map((id) => themeOf.get(id)))
      expect(themes.size, `cluster ${cluster.id} spans themes ${[...themes].join(', ')}`).toBe(1)
      expect(cluster.rootId, `cluster ${cluster.id} has no rootId`).toBeDefined()
      expect(cluster.storyIds).toContain(cluster.rootId)
      const incoming = clusterEdges(cluster).filter(([, to]) => to === cluster.rootId)
      expect(incoming, `root ${cluster.rootId} of ${cluster.id} has parents`).toHaveLength(0)
    }
  })

  it('is acyclic', () => {
    // Kahn count: if the peel-off covers every node with an edge, there is no cycle.
    const ids = [...canonIds]
    const inDegree = new Map(ids.map((id) => [id, 0]))
    const children = new Map<string, string[]>(ids.map((id) => [id, []]))
    for (const [from, to] of storyGraph.edges) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
      children.get(from)!.push(to)
    }
    const queue = ids.filter((id) => inDegree.get(id) === 0)
    let seen = 0
    while (queue.length > 0) {
      const id = queue.shift()!
      seen++
      for (const child of children.get(id)!) {
        const d = inDegree.get(child)! - 1
        inDegree.set(child, d)
        if (d === 0) queue.push(child)
      }
    }
    expect(seen).toBe(ids.length)
  })
})
