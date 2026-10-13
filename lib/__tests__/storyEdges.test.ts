// Structural validation of the curated cross-story dependency edges (rankings/story-edges.json via
// lib/storyEdges.ts) plus the pure theme-rule/hint machinery. Canon ids come straight from
// pipeline/agentic-stories.ts — same source-of-truth arrangement as lib/__tests__/storyGraph.test.ts —
// so a canon rename that isn't mirrored here fails loudly, not as a silently dangling edge.

import { describe, expect, it } from 'vitest'
import {
  AGENTIC_FEATURE_STORIES, AGENTIC_STORIES, API_QUALITY_STORIES, AUTOMATION_STORIES,
  OPENNESS_STORIES, PRIVACY_STORIES,
} from '@/pipeline/agentic-stories'
import {
  CANON_SHORT_LABELS, combinedCanonEdges, domainPrereqEdges, domainPrereqIds, storyEdges,
  unlockHints,
} from '@/lib/storyEdges'
import { storyGraph } from '@/lib/storyGraph'

const CANON = [
  ...AGENTIC_STORIES,
  ...AGENTIC_FEATURE_STORIES,
  ...OPENNESS_STORIES,
  ...AUTOMATION_STORIES,
  ...API_QUALITY_STORIES,
  ...PRIVACY_STORIES,
]
const canonIds = new Set(CANON.map((s) => s.id))

describe('story-edges.json', () => {
  it('references only canonical story ids, with no self-edges or duplicates', () => {
    const seen = new Set<string>()
    for (const e of storyEdges) {
      expect(canonIds.has(e.from), `edge from unknown id ${e.from}`).toBe(true)
      expect(canonIds.has(e.to), `edge to unknown id ${e.to}`).toBe(true)
      expect(e.from).not.toBe(e.to)
      const key = `${e.from}→${e.to}`
      expect(seen.has(key), `duplicate edge ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('never repeats a story-graph builds-on edge (the files complement each other)', () => {
    const graphEdges = new Set(storyGraph.edges.map(([from, to]) => `${from}→${to}`))
    for (const e of storyEdges) {
      expect(graphEdges.has(`${e.from}→${e.to}`), `${e.from}→${e.to} already in story-graph.json`).toBe(false)
    }
  })

  it('stays acyclic when unioned with the story-graph edges', () => {
    const edges = combinedCanonEdges()
    const inDegree = new Map<string, number>([...canonIds].map((id) => [id, 0]))
    const children = new Map<string, string[]>([...canonIds].map((id) => [id, []]))
    for (const { from, to } of edges) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
      children.get(from)!.push(to)
    }
    // Kahn: every node must drain — leftovers mean a cycle.
    const queue = [...canonIds].filter((id) => inDegree.get(id) === 0)
    let drained = 0
    while (queue.length > 0) {
      const id = queue.shift()!
      drained++
      for (const child of children.get(id) ?? []) {
        const d = (inDegree.get(child) ?? 1) - 1
        inDegree.set(child, d)
        if (d === 0) queue.push(child)
      }
    }
    expect(drained).toBe(canonIds.size)
  })

  it('justifies every edge with a substantive why (schema floor is 40 chars)', () => {
    for (const e of storyEdges) {
      expect(e.why.length, `${e.from}→${e.to} why too thin`).toBeGreaterThanOrEqual(40)
    }
  })
})

describe('combinedCanonEdges', () => {
  it('unions both files, cross edges keeping their authored why', () => {
    const edges = combinedCanonEdges()
    expect(edges.length).toBe(storyGraph.edges.length + storyEdges.length)
    const cross = edges.filter((e) => e.kind === 'cross')
    expect(cross.length).toBe(storyEdges.length)
    for (const e of cross) {
      const authored = storyEdges.find((s) => s.from === e.from && s.to === e.to)
      expect(e.why).toBe(authored!.why)
    }
  })
})

describe('CANON_SHORT_LABELS', () => {
  it('covers the canon exactly — every id labeled, nothing extra', () => {
    const labeled = new Set(Object.keys(CANON_SHORT_LABELS))
    for (const id of canonIds) expect(labeled.has(id), `no short label for ${id}`).toBe(true)
    for (const id of labeled) expect(canonIds.has(id), `label for non-canon id ${id}`).toBe(true)
  })
})

describe('domainPrereqIds / domainPrereqEdges', () => {
  it('routes mcp themes to the MCP server before the broad agent rule', () => {
    expect(domainPrereqIds('mcp-clients')).toEqual(['agentic-mcp-server'])
    expect(domainPrereqIds('agent-ops')).toEqual(['agentic-public-api', 'agentic-agent-docs'])
    expect(domainPrereqIds('api-platforms')).toEqual(['agentic-public-api'])
    expect(domainPrereqIds('automation-workflows')).toEqual(['automation-rules-engine'])
    expect(domainPrereqIds('pricing-limits')).toEqual([])
  })

  it('resolved prerequisite ids are all canonical', () => {
    // Every id a rule can emit must be canon — a typo here would render a dangling edge.
    const emitted = new Set(['mcp-x', 'agent-x', 'api-x', 'automation-x', 'self-host-x', 'portability-x'].flatMap(domainPrereqIds))
    for (const id of emitted) expect(canonIds.has(id), `rule emits non-canon id ${id}`).toBe(true)
  })

  it('attaches only domain stories whose canon prerequisite is present, skipping canon stories', () => {
    const stories = [
      { id: 'agentic-public-api', theme: 'agenticness' }, // canon → never a target
      { id: 'run-agent-end-to-end', theme: 'agent-ops' },
      { id: 'connect-mcp-tooling', theme: 'mcp-clients' }, // prereq (mcp server) absent → no edge
      { id: 'flat-pricing', theme: 'pricing-limits' }, // no rule → no edge
    ]
    expect(domainPrereqEdges(stories, canonIds)).toEqual([
      { from: 'agentic-public-api', to: 'run-agent-end-to-end' },
    ])
  })
})

describe('unlockHints', () => {
  const row = (storyId: string, verdict: string, theme = 'agenticness', title = `story ${storyId}`) => ({
    storyId,
    title,
    theme,
    verdict,
  })

  it('hints on a passing prerequisite whose dependent fails, with the honest framing data', () => {
    const rows = [
      row('agentic-public-api', 'full'),
      row('agentic-headless', 'none', 'agenticness', 'As an AI-native user, I can run the product headlessly / in CI for automation'),
    ]
    const hints = unlockHints(rows, canonIds)
    const hint = hints.get('agentic-public-api')
    expect(hint).toBeDefined()
    expect(hint![0]).toEqual({
      storyId: 'agentic-headless',
      label: 'Headless / CI',
      title: 'As an AI-native user, I can run the product headlessly / in CI for automation',
    })
  })

  it('stays silent when the dependent passes, is n/a, or the prerequisite itself fails', () => {
    expect(unlockHints([row('agentic-public-api', 'full'), row('agentic-headless', 'partial')], canonIds).size).toBe(0)
    expect(unlockHints([row('agentic-public-api', 'full'), row('agentic-headless', 'na')], canonIds).size).toBe(0)
    expect(unlockHints([row('agentic-public-api', 'none'), row('agentic-headless', 'none')], canonIds).size).toBe(0)
  })

  it('includes theme-rule attachments for failing domain stories', () => {
    const rows = [
      row('agentic-public-api', 'full'),
      row('agentic-agent-docs', 'full'),
      { storyId: 'agent-runs-payroll', title: 'As a founder, I can have the agent run payroll end-to-end', theme: 'agent-ops', verdict: 'none' },
    ]
    const hints = unlockHints(rows, canonIds)
    expect(hints.get('agentic-public-api')![0].storyId).toBe('agent-runs-payroll')
    // Domain targets have no short label — they fall back to their own title.
    expect(hints.get('agentic-agent-docs')![0].label).toBe('As a founder, I can have the agent run payroll end-to-end')
  })

  it('never duplicates a target within one story hint list', () => {
    const rows = [
      row('agentic-public-api', 'full'),
      { storyId: 'agent-api-thing', title: 'agent api', theme: 'agent-api', verdict: 'none' },
    ]
    // 'agent-api' matches the agent rule (public-api + agent-docs), then would match api too if
    // rules cascaded — first-match-wins plus dedupe keeps exactly one hint.
    const hints = unlockHints(rows, canonIds)
    expect(hints.get('agentic-public-api')!.filter((h) => h.storyId === 'agent-api-thing')).toHaveLength(1)
  })
})
