// Cross-story dependency edges (rankings/story-edges.json): "from is a prerequisite/enabler of to",
// across cluster and theme boundaries — the complement of lib/storyGraph.ts, whose builds-on
// edges stay inside one cluster. Two consumers:
//   1. components/CapabilityDag.tsx (/global) lays out the whole canon as one dependency graph
//      over the UNION of both edge files (combinedCanonEdges).
//   2. components/StoryMap.tsx shows an "unlocks →" hint on stories a product passes that are
//      prerequisites of stories it fails (unlockHints) — honest framing: "passing X but failing
//      Y, which X enables", never "X is broken".
// Domain-mined stories have no curated edges, so they attach to canon prerequisites by THEME
// RULES (domainPrereqIds): an agent-themed arena story presumes the documented API + agent docs,
// an mcp-themed one presumes the MCP server, and so on — pure code, first-match-wins, tested in
// lib/__tests__/storyEdges.test.ts, no LLM anywhere. Zod-validated at module load and fs-free
// (JSON import), same contract as lib/storyGraph.ts.

import { z } from 'zod'
import edgesJson from '@/rankings/story-edges.json'
import { storyGraph } from './storyGraph'

export const StoryEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  // The honest justification — rendered as the edge tooltip on /global, so it must actually
  // explain the dependency, not restate it.
  why: z.string().min(40),
})

export const StoryEdgesFileSchema = z.object({
  edges: StoryEdgeSchema.array().min(1),
})

export type StoryEdge = z.infer<typeof StoryEdgeSchema>

export const storyEdges: StoryEdge[] = StoryEdgesFileSchema.parse(edgesJson).edges

// One edge of the combined canon dependency graph — curated cross-story edges keep their
// authored why; story-graph builds-on edges get a generic one (they were authored as "to builds
// on from", which is exactly what the tooltip should say).
export interface CanonDepEdge {
  from: string
  to: string
  why: string
  // 'cross' = rankings/story-edges.json (may cross clusters), 'builds-on' = rankings/story-graph.json.
  kind: 'cross' | 'builds-on'
}

// Union of both curated edge files over the canon, deduped on (from, to) with the cross-story
// edge winning (it carries a real why). The tests assert the union is acyclic.
export function combinedCanonEdges(): CanonDepEdge[] {
  const out = new Map<string, CanonDepEdge>()
  for (const [from, to] of storyGraph.edges) {
    out.set(`${from}→${to}`, { from, to, kind: 'builds-on', why: `Builds on: you can't have this without "${from}" underneath it.` })
  }
  for (const e of storyEdges) {
    out.set(`${e.from}→${e.to}`, { from: e.from, to: e.to, kind: 'cross', why: e.why })
  }
  return [...out.values()]
}

// Short node labels for the 29 canon stories — the full persona titles don't fit an SVG node.
// The unit test asserts this map covers pipeline/agentic-stories.ts's canon ids exactly, so a
// canon rename/addition fails here, not silently as an unlabeled node.
export const CANON_SHORT_LABELS: Record<string, string> = {
  'agentic-public-api': 'Public API',
  'agentic-official-cli': 'Official CLI',
  'agentic-mcp-server': 'MCP server',
  'agentic-mcp-client': 'MCP client',
  'agentic-webhooks': 'Webhooks',
  'agentic-sdks': 'Official SDKs',
  'agentic-agent-docs': 'Agent docs / llms.txt',
  'agentic-scoped-keys': 'Scoped API keys',
  'agentic-headless': 'Headless / CI',
  'agentic-builtin-assistant': 'Built-in assistant',
  'agentic-autonomous-automation': 'Autonomous automations',
  'agentic-nl-commands': 'NL commands',
  'agentic-ai-insights': 'AI insights',
  'openness-self-host': 'Self-hosting',
  'openness-full-export': 'Full data export',
  'openness-api-parity': 'API/UI parity',
  'openness-open-license': 'Open license',
  'automation-rules-engine': 'Rules engine',
  'automation-scheduled-jobs': 'Scheduled jobs',
  'automation-bulk-operations': 'Bulk operations',
  'automation-versioned-workflows': 'Versioned workflows',
  'api-interactive-docs': 'Interactive API docs',
  'api-machine-spec': 'Machine-readable spec',
  'api-versioning-policy': 'Versioning policy',
  'api-sandbox': 'API sandbox',
  'privacy-no-training': 'No AI training',
  'privacy-telemetry-optout': 'Telemetry opt-out',
  'privacy-data-residency': 'Data residency',
  'privacy-retention-controls': 'Retention controls',
}

// ---- theme rules: attach an arena's domain-mined stories to canon prerequisites ----

// First-match-wins keyword rules over a DOMAIN story's kebab-case theme id (same bucketing
// idiom as lib/icons.ts's THEME_RULES). Deliberately conservative: only themes whose stories
// almost always presume the canon capability get a rule — everything else attaches to nothing.
// Order matters: mcp before the broad agent catch-all, so an 'mcp-clients' theme lands on the
// MCP-server prerequisite rather than the generic API one.
export const DOMAIN_PREREQ_RULES: Array<[RegExp, string[]]> = [
  // MCP-flavored arena stories presume the official MCP server exists to connect to.
  [/mcp|tools-function|structured-tool/, ['agentic-mcp-server']],
  // Agent-operates-the-product stories presume programmatic access + docs an agent can read.
  [/agent|autonom|copilot|orchestration|nl-task|human-in-the-loop/, ['agentic-public-api', 'agentic-agent-docs']],
  // API/SDK/webhook/integration-surface stories presume the documented public API.
  [/api|sdk|webhook|connector|integration|extensib|plugin|headless/, ['agentic-public-api']],
  // Automation/workflow stories presume the trigger/action machinery.
  [/automation|workflow|triggers|runbook/, ['automation-rules-engine']],
  // Self-host/local-first stories presume the core product is self-hostable.
  [/self-host|local-first/, ['openness-self-host']],
  // Portability/migration/export stories presume full export exists.
  [/portability|export|migration/, ['openness-full-export']],
]

// Canon prerequisite ids for one domain-story theme (possibly []). Pure over the theme string.
export function domainPrereqIds(theme: string): string[] {
  for (const [test, ids] of DOMAIN_PREREQ_RULES) {
    if (test.test(theme)) return ids
  }
  return []
}

// Derived canon→domain edges for one arena's story list. Canon stories are skipped (their edges
// are curated above); a derived edge only exists when its canon prerequisite is actually present
// in the list, so the result is always renderable as-is.
export function domainPrereqEdges(
  stories: Array<{ id: string; theme: string }>,
  canonIds: ReadonlySet<string>,
): Array<{ from: string; to: string }> {
  const present = new Set(stories.map((s) => s.id))
  const out: Array<{ from: string; to: string }> = []
  for (const s of stories) {
    if (canonIds.has(s.id)) continue
    for (const from of domainPrereqIds(s.theme)) {
      if (from !== s.id && present.has(from)) out.push({ from, to: s.id })
    }
  }
  return out
}

// ---- "unlocks →" hints for the per-product story map ----

// The verdict ladder the hints care about: a prerequisite the product delivers (full/partial)
// pointing at a dependent story it doesn't (none/disputed). n/a stories never appear on either
// side — "not applicable" is not "failing".
const PASSING = new Set(['full', 'partial'])
const FAILING = new Set(['none', 'disputed'])

export interface UnlockHint {
  storyId: string
  // Display label: the canon short label when the target is canon, else the target's own title
  // (caller strips the persona prefix for rendering).
  label: string
  // Full target title for the tooltip.
  title: string
}

// storyId → the dependent stories this product FAILS that the passing story enables. Only
// stories present in `rows` participate; edges are the curated canon union plus the theme-rule
// attachments for this arena's domain stories. Deterministic: hints follow edge-file order.
export function unlockHints(
  rows: Array<{ storyId: string; title: string; theme: string; verdict: string }>,
  canonIds: ReadonlySet<string>,
): Map<string, UnlockHint[]> {
  const byId = new Map(rows.map((r) => [r.storyId, r]))
  const edges: Array<{ from: string; to: string }> = [
    ...combinedCanonEdges(),
    ...domainPrereqEdges(rows.map((r) => ({ id: r.storyId, theme: r.theme })), canonIds),
  ]
  const hints = new Map<string, UnlockHint[]>()
  for (const { from, to } of edges) {
    const source = byId.get(from)
    const target = byId.get(to)
    if (!source || !target) continue
    if (!PASSING.has(source.verdict) || !FAILING.has(target.verdict)) continue
    const list = hints.get(from) ?? []
    if (list.some((h) => h.storyId === to)) continue
    list.push({ storyId: to, label: CANON_SHORT_LABELS[to] ?? target.title, title: target.title })
    hints.set(from, list)
  }
  return hints
}
