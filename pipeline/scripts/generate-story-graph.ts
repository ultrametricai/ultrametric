// Emits the story↔process connection DAG (lib/storyProcessGraph.ts's buildStoryGraph — founder ask
// 2026-09-22: "This connection between stories and processes should form a large DAG on our
// backend, so we know how everything connects") as rankings/graph.json, the committed public
// artifact. Ships exactly like every other data file: scripts/copy-data.mjs mirrors rankings/ →
// public/data/ before each build, so the graph is fetchable at /data/graph.json
// (the same mechanism the CLI's /data/categories.json reads use).
//
// Pure derivation — re-run after any corpus / mapping / verdict change; determinism against the
// committed file is enforced by lib/__tests__/storyProcessGraph.test.ts (same recompute posture as
// rankings.json vs pipeline/scripts/recompute-check.ts). No LLM, no network, no cache.
//
// Size sanity cap: the whole graph must stay under MAX_BYTES (5MB). If a future corpus pushes it
// over, this script fails loudly — the agreed split is then to keep the core DAG (process/step/
// story nodes + has-step/step-story edges) in graph.json and move story→product edges into
// per-arena files (rankings/graph-products/<arenaId>.json); don't raise the cap silently.
//
// Usage: tsx pipeline/scripts/generate-story-graph.ts
import fs from 'node:fs'
import path from 'node:path'
import { buildStoryGraph } from '../../lib/storyProcessGraph'

const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(ROOT, 'rankings', 'graph.json')
const MAX_BYTES = 5 * 1024 * 1024

// Rebuild rankings/graph.json from the committed corpus + mapping + verdicts. Called by the CLI
// below and by every automated flow whose judge/derive pass can move story→product verdicts
// (the scheduled runner workflows and pipeline/contest-check.ts) — same contract as
// generate-vendor-reviews.ts's writeVendorReviews(): any run that re-judges must regenerate
// the artifact before the byte-identity tests compare it.
export function writeStoryGraph(): void {
  const graph = buildStoryGraph(path.join(ROOT, 'rankings'))
  const json = `${JSON.stringify(graph, null, 2)}\n`
  const bytes = Buffer.byteLength(json, 'utf8')

  if (bytes > MAX_BYTES) {
    throw new Error(
      `graph.json would be ${(bytes / 1024 / 1024).toFixed(1)}MB (> ${MAX_BYTES / 1024 / 1024}MB cap) — `
      + 'split story→product edges into per-arena rankings/graph-products/<arenaId>.json files and keep '
      + 'the core DAG in graph.json (see the header comment).',
    )
  }

  fs.writeFileSync(OUT, json)

  const { nodes, edges } = graph.counts
  console.log(
    `wrote ${path.relative(ROOT, OUT)} (${(bytes / 1024).toFixed(0)}KB) — `
    + `${graph.nodes.length} nodes (${nodes.process} processes, ${nodes.step} steps, `
    + `${nodes.story} stories, ${nodes.product} products), `
    + `${graph.edges.length} edges (${edges['has-step']} has-step, ${edges['step-story']} step-story, `
    + `${edges['story-product']} story-product)`,
  )
}

if (require.main === module) writeStoryGraph()
