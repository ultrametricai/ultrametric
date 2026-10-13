// The story↔process connection layer (lib/storyProcessGraph.ts) — three layers, same posture as the
// other derivation tests: (1) the reverse index reproduces the committed step→stories mapping
// exactly for sampled arenas, (2) the full DAG is well-formed (every edge endpoint exists, no
// dangling task/story refs, tags only where they belong), (3) the committed public artifact
// rankings/graph.json deep-equals a fresh in-process build (determinism across builds — the same
// recompute contract rankings.json has with pipeline/scripts/recompute-check.ts).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import { processIcon } from '@/lib/processIcons'
import { loadStepStoryMap } from '@/lib/processRankings'
import { loadProcesses, processSlug } from '@/lib/processes'
import {
  buildStoryGraph, processesForStory, processNodeId, productNodeId, stepNodeId, storyNodeId,
  storyProcessesForArena,
} from '@/lib/storyProcessGraph'

const DATA_DIR = path.resolve(__dirname, '../../rankings')
const GRAPH_FILE = path.join(DATA_DIR, 'graph.json')

const tasks = loadProcesses(DATA_DIR)
const taskById = new Map(tasks.map((t) => [t.id, t]))

// Three sampled arenas spanning all three mapping kinds: startup-banking (function),
// ai-assistants (computer-use + extra + function), payroll (function).
const SAMPLE_ARENAS = ['startup-banking', 'ai-assistants', 'payroll']

describe('processesForStory (reverse index vs process-step-stories.json)', () => {
  for (const arenaId of SAMPLE_ARENAS) {
    it(`reproduces every committed mapping entry for ${arenaId}, and nothing else`, () => {
      const entries = loadStepStoryMap(DATA_DIR).filter((e) => e.arenaId === arenaId)
      expect(entries.length).toBeGreaterThan(0)

      // Forward direction: every (entry, storyId) shows up as an appearance with the exact
      // (taskId, nodeId, kind) — and its display fields match the corpus, not a re-derivation.
      const expected = new Map<string, Set<string>>() // storyId -> "taskId|nodeId|kind"
      for (const e of entries) {
        // Referential integrity of the committed mapping itself: no dangling task/step refs.
        const task = taskById.get(e.taskId)
        expect(task, `mapping references unknown task ${e.taskId}`).toBeDefined()
        const node = task!.dag.nodes.find((n) => n.id === e.nodeId)
        expect(node, `mapping references unknown step ${e.taskId}:${e.nodeId}`).toBeDefined()
        for (const sid of e.storyIds) {
          const set = expected.get(sid) ?? new Set<string>()
          set.add(`${e.taskId}|${e.nodeId}|${e.kind}`)
          expected.set(sid, set)
        }
      }

      for (const [storyId, keys] of expected) {
        const appearances = processesForStory(arenaId, storyId, DATA_DIR)
        expect(new Set(appearances.map((a) => `${a.taskId}|${a.nodeId}|${a.kind}`))).toEqual(keys)
        for (const a of appearances) {
          const task = taskById.get(a.taskId)!
          expect(a.title).toBe(task.title)
          expect(a.slug).toBe(processSlug(task.title))
          expect(a.icon).toBe(processIcon(a.taskId))
          expect(a.nodeLabel).toBe(task.dag.nodes.find((n) => n.id === a.nodeId)!.label)
        }
      }

      // Reverse direction: a story the mapping never references maps to no process.
      const mapped = new Set(expected.keys())
      const unmapped = loadCategory(arenaId, DATA_DIR).stories.find((s) => !mapped.has(s.id))
      if (unmapped) expect(processesForStory(arenaId, unmapped.id, DATA_DIR)).toEqual([])
    })
  }

  it('returns [] for unknown stories/arenas instead of throwing', () => {
    expect(processesForStory('startup-banking', 'no-such-story', DATA_DIR)).toEqual([])
    expect(processesForStory('no-such-arena', 'whatever', DATA_DIR)).toEqual([])
  })
})

describe('storyProcessesForArena (the table-column prop shape)', () => {
  it('is the per-task dedupe of processesForStory, lean and non-empty per key', () => {
    const rec = storyProcessesForArena('startup-banking', DATA_DIR)
    const arenaStoryIds = new Set(loadCategory('startup-banking', DATA_DIR).stories.map((s) => s.id))
    expect(Object.keys(rec).length).toBeGreaterThan(0)
    for (const [storyId, links] of Object.entries(rec)) {
      expect(arenaStoryIds.has(storyId), `unknown story ${storyId}`).toBe(true)
      expect(links.length).toBeGreaterThan(0)
      // Deduped by process: one chip per task, first-appearance order preserved.
      const appearances = processesForStory('startup-banking', storyId, DATA_DIR)
      const expectedSlugs: string[] = []
      for (const a of appearances) if (!expectedSlugs.includes(a.slug)) expectedSlugs.push(a.slug)
      expect(links.map((l) => l.slug)).toEqual(expectedSlugs)
      for (const l of links) expect(Object.keys(l).sort()).toEqual(['icon', 'slug', 'title'])
    }
  })
})

describe('buildStoryGraph (the backend DAG)', () => {
  const graph = buildStoryGraph(DATA_DIR)
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))

  it('has unique node ids and counts that match the arrays', () => {
    expect(nodeById.size).toBe(graph.nodes.length)
    const nodeCounts = { process: 0, step: 0, story: 0, product: 0 }
    for (const n of graph.nodes) nodeCounts[n.type] += 1
    expect(graph.counts.nodes).toEqual(nodeCounts)
    const edgeCounts = { 'has-step': 0, 'step-story': 0, 'story-product': 0 }
    for (const e of graph.edges) edgeCounts[e.type] += 1
    expect(graph.counts.edges).toEqual(edgeCounts)
  })

  it('contains every process and every DAG step exactly once, correctly labelled', () => {
    for (const task of tasks) {
      expect(nodeById.get(processNodeId(task.id))?.label).toBe(task.title)
      for (const node of task.dag.nodes) {
        expect(nodeById.get(stepNodeId(task.id, node.id))?.label).toBe(node.label)
      }
    }
    expect(graph.counts.nodes.process).toBe(tasks.length)
    expect(graph.counts.nodes.step).toBe(tasks.reduce((n, t) => n + t.dag.nodes.length, 0))
  })

  it('every edge connects existing nodes of the right types, with tags only where they belong', () => {
    for (const e of graph.edges) {
      const from = nodeById.get(e.from)
      const to = nodeById.get(e.to)
      expect(from, `dangling edge source ${e.from}`).toBeDefined()
      expect(to, `dangling edge target ${e.to}`).toBeDefined()
      if (e.type === 'has-step') {
        expect([from!.type, to!.type]).toEqual(['process', 'step'])
        expect(e.kind).toBeUndefined()
        expect(e.verdict).toBeUndefined()
      } else if (e.type === 'step-story') {
        expect([from!.type, to!.type]).toEqual(['step', 'story'])
        expect(['function', 'computer-use', 'extra']).toContain(e.kind)
        expect(e.verdict).toBeUndefined()
      } else {
        expect([from!.type, to!.type]).toEqual(['story', 'product'])
        expect(['full', 'partial']).toContain(e.verdict)
        expect(e.kind).toBeUndefined()
      }
    }
  })

  it('every story and product node is reachable (no orphans) and resolves in its arena', () => {
    const targets = new Set(graph.edges.map((e) => e.to))
    for (const n of graph.nodes) {
      if (n.type === 'story' || n.type === 'product') {
        expect(targets.has(n.id), `orphan ${n.type} node ${n.id}`).toBe(true)
      }
    }
  })

  it('story→product edges are exactly the judged full/partial verdicts of referenced stories', () => {
    // Group actual edges per story node, then recompute straight from each arena's verdicts.
    const byStory = new Map<string, Map<string, string>>() // storyNode -> productNode -> verdict
    for (const e of graph.edges) {
      if (e.type !== 'story-product') continue
      const m = byStory.get(e.from) ?? new Map<string, string>()
      m.set(e.to, e.verdict!)
      byStory.set(e.from, m)
    }
    for (const n of graph.nodes) {
      if (n.type !== 'story') continue
      const [, arenaId, storyId] = n.id.match(/^story:([^:]+):(.+)$/)!
      const data = loadCategory(arenaId, DATA_DIR)
      expect(data.stories.find((s) => s.id === storyId)?.title).toBe(n.label)
      const expected = new Map<string, string>()
      for (const v of data.verdicts) {
        if (v.storyId === storyId && (v.verdict === 'full' || v.verdict === 'partial')) {
          expected.set(productNodeId(arenaId, v.productId), v.verdict)
        }
      }
      expect(byStory.get(storyNodeId(arenaId, storyId)) ?? new Map()).toEqual(expected)
    }
  })

  it('matches the committed rankings/graph.json byte-for-byte (deterministic across builds)', () => {
    // The committed artifact was produced by a separate process (pipeline/scripts/
    // generate-story-graph.ts) — deep-equality with this fresh build IS the double-build
    // determinism check, and the drift gate after any corpus/mapping/verdict change.
    expect(fs.existsSync(GRAPH_FILE), 'run: tsx pipeline/scripts/generate-story-graph.ts').toBe(true)
    const committed = fs.readFileSync(GRAPH_FILE, 'utf8')
    expect(committed).toBe(`${JSON.stringify(graph, null, 2)}\n`)
    // Size sanity cap — the generator enforces it too; if this trips, split story→product
    // edges into per-arena files (see the generator's header comment).
    expect(Buffer.byteLength(committed, 'utf8')).toBeLessThan(5 * 1024 * 1024)
  })
})
