// Server-side payload builders for the Virtual Startup v3 run layer (lib/virtualStartupRun.ts is
// the pure client-safe half; this file owns the node:fs-backed resolution, same split convention
// as lib/processes.ts vs lib/processSim.ts). Everything built here is a serialization of already-
// judged/committed data — canonical agent-access verdicts (lib/accessGlyphs.ts), verbatim
// published-pricing facts (lib/pricing.ts), and the corpus risk axis (processes/corpus.json) —
// never a new judgment.
import popularIds from '../data/popular-products.json'
import { ACCESS_COLUMNS, bestAccessVerdict } from './accessGlyphs'
import { loadCategory } from './data'
import { hasLogo } from './logos'
import { formatCompact } from './popularity'
import { weeklyInstalls } from './popularRanking'
import { ENTRY_PLAN_UNIT, isPricingUnavailable, loadPricing, PRICING_ARENAS, formatFactAmount, type PricingFact } from './pricing'
import { loadArtifacts, loadProcesses, type ProcessTask } from './processes'
import type { VendorRole } from './processSim'
import {
  likelyChoiceOrder,
  VS_AI_FIRM_ARENA,
  VS_AI_FIRM_IDS,
  type VsAssistant,
  type VsPopularityMap,
  type VsPopularityProduct,
  type VsProducedArtifact,
} from './virtualStartup'
import type { VsAccessMap, VsAccessSurface, VsPricingInfo, VsPricingMap, VsVerdictKind } from './virtualStartupRun'

// The canonical MCP/CLI agent-access verdicts for every swap option of every role — the exact
// verdicts components/AgentAccessGlyphs.tsx renders, reduced to their kind strings so the client
// outcome model can read them without dragging CategoryData across the boundary.
export function buildVsAccess(roles: VendorRole[], dir?: string): VsAccessMap {
  const mcpStories = ACCESS_COLUMNS.find((c) => c.label === 'MCP')!.storyIds
  const cliStories = ACCESS_COLUMNS.find((c) => c.label === 'CLI')!.storyIds
  const out: VsAccessMap = {}
  for (const role of roles) {
    const data = loadCategory(role.arenaId, dir)
    const verdictOf = (productId: string, storyIds: string[]): VsVerdictKind => {
      // bestAccessVerdict reduces over the stories present in the arena — an arena carrying
      // none of them has nothing to say, which is honestly 'na', never a guess.
      if (!storyIds.some((id) => data.stories.some((s) => s.id === id))) return 'na'
      return bestAccessVerdict(data, productId, storyIds).verdict
    }
    const byProduct: Record<string, VsAccessSurface> = {}
    for (const option of role.alternatives) {
      byProduct[option.id] = {
        mcp: verdictOf(option.id, mcpStories),
        cli: verdictOf(option.id, cliStories),
      }
    }
    out[role.arenaId] = byProduct
  }
  return out
}

// Deterministic headline fact for one product — the same selection order as lib/pricing.ts
// pricingCellFor (cheapest usage fact in the arena's primary unit, else cheapest usage fact,
// else cheapest entry plan, else the free tier), kept here because the scorecard needs the raw
// amount (for the entry-plan sum) alongside the display label. Selection only — never
// arithmetic on the extracted figures.
function headlineFact(facts: PricingFact[], primary: string | undefined): PricingFact | undefined {
  const cost = (f: PricingFact) => f.amountUsd + (f.percent ?? 0)
  const byCost = (a: PricingFact, b: PricingFact) => cost(a) - cost(b)
  const usage = facts.filter((f) => f.tier === 'usage').sort(byCost)
  return (
    usage.find((f) => f.unit === primary) ??
    usage[0] ??
    facts.filter((f) => f.tier === 'entry-paid').sort(byCost)[0] ??
    facts.find((f) => f.tier === 'free')
  )
}

// Published-pricing headlines for every swap option of every price-covered role arena
// (lib/pricing.ts PRICING_ARENAS) — verbatim-extracted facts with their source URL and fetch
// date, or the honest { unclear } record. Products the pricing stage hasn't touched get no
// entry at all; the scorecard renders that as "no published pricing".
export function buildVsPricing(roles: VendorRole[], dir?: string): VsPricingMap {
  const out: VsPricingMap = {}
  for (const role of roles) {
    const arena = PRICING_ARENAS[role.arenaId]
    if (!arena) continue
    const map = loadPricing(role.arenaId, dir)
    const byProduct: Record<string, VsPricingInfo> = {}
    for (const option of role.alternatives) {
      const entry = map[option.id]
      if (!entry) continue
      if (isPricingUnavailable(entry)) {
        byProduct[option.id] = { kind: 'unclear', reason: entry.reason }
        continue
      }
      const fact = headlineFact(entry.facts, arena.primary)
      if (!fact) continue
      byProduct[option.id] = {
        kind: 'fact',
        label: fact.tier === 'free' ? 'free tier' : formatFactAmount(fact),
        unit: fact.unit,
        tier: fact.tier,
        amountUsd: fact.amountUsd,
        ...(fact.percent !== undefined ? { percent: fact.percent } : {}),
        // The only facts the scorecard may sum: sticker prices the page itself states per month.
        monthly: fact.tier === 'entry-paid' && fact.unit === ENTRY_PLAN_UNIT,
        sourceUrl: fact.sourceUrl,
        asOf: fact.fetchedAt.slice(0, 10),
      }
    }
    if (Object.keys(byProduct).length > 0) out[role.arenaId] = byProduct
  }
  return out
}

// 'Which AI firm are you using' roster (founder batch 2026-09-30, item 7): the VS_AI_FIRM_IDS
// roster resolved against the JUDGED ai-assistants arena — real product names only, in roster
// order, with the committed-logo flag. A roster id missing from the judged products would be a
// data regression: fail the build loudly rather than render an unjudged option.
export function buildVsAssistants(dir?: string): VsAssistant[] {
  const data = loadCategory(VS_AI_FIRM_ARENA, dir)
  return VS_AI_FIRM_IDS.map((id) => {
    const p = data.products.find((x) => x.id === id)
    if (!p) throw new Error(`virtual-startup: AI firm "${id}" missing from the judged ${VS_AI_FIRM_ARENA} roster`)
    return { id, name: p.name, hasLogo: hasLogo(id) }
  })
}

// Registry artifact labels keyed by artifact id (processes/artifacts.json) — the lookup
// vsTaskLinkage resolves producesArtifact tags against.
export function vsArtifactLabels(): Map<string, string> {
  return new Map(loadArtifacts().map((a) => [a.id, a.label]))
}

// Corpus linkage for one sim task payload (founder round 2026-10-07, items 2–3 + diagram forks):
//   nodeIds  — the DAG node ids, parallel to the flattened steps, behind the terminal's
//              /processes/{slug}#step-{taskId}-{nodeId} deep links (the pinned anchor contract);
//   produces — the registry artifact each step's producesArtifact tag names, with its committed
//              label, or null (the document panel is computed from exactly these tags);
//   fork     — the first step whose committed dag.edges diverge, with the parallel branches'
//              first-step labels (the journey diagram's branch/join treatment; linear DAGs
//              carry nothing).
// Pure serialization of committed corpus/registry data; an unknown artifact id fails the build.
export function vsTaskLinkage(
  task: ProcessTask,
  artifactLabels: Map<string, string>,
): { nodeIds: string[]; produces: (VsProducedArtifact | null)[]; fork?: { at: string; branches: string[] } } {
  const nodeIds = task.dag.nodes.map((n) => n.id)
  const produces = task.dag.nodes.map((n) => {
    if (!n.producesArtifact) return null
    const label = artifactLabels.get(n.producesArtifact)
    if (!label) {
      throw new Error(`virtual-startup: step ${task.id}/${n.id} produces unknown artifact "${n.producesArtifact}"`)
    }
    return { id: n.producesArtifact, label }
  })
  const edges = task.dag.edges ?? []
  const labelOf = new Map(task.dag.nodes.map((n) => [n.id, n.label]))
  const forkNode = task.dag.nodes.find((n) => edges.filter((e) => e.from === n.id).length > 1)
  const fork = forkNode
    ? {
        at: forkNode.label,
        branches: edges.filter((e) => e.from === forkNode.id).map((e) => labelOf.get(e.to) ?? e.to),
      }
    : undefined
  return { nodeIds, produces, ...(fork ? { fork } : {}) }
}

// The corpus risk axis (processes/corpus.json `risk`, 1–5) keyed by task id — the event engine's
// plausibility gate reads it client-side.
export function buildVsTaskRisks(dir?: string): Record<string, number> {
  return Object.fromEntries(loadProcesses(dir).map((t) => [t.id, t.risk]))
}

// 'Likely choice' ordering payload (founder round 5, item 7): per role arena, every swap
// option's committed adoption/popularity signal resolved into a best-first PRESENTATION order
// (lib/virtualStartup.ts likelyChoiceOrder) plus per-product signal labels — the receipts.
// Committed data only: data/popular-products.json curated membership, data/{arena}/
// popularity.json stars and npm+PyPI weekly installs. Products with no signal carry no label
// and keep the judged order at the tail — absence is absence, never a fake rank.
export function buildVsPopularity(roles: VendorRole[], dir?: string): VsPopularityMap {
  const curated = new Set(popularIds as string[])
  const out: VsPopularityMap = {}
  for (const role of roles) {
    const data = loadCategory(role.arenaId, dir)
    const products: VsPopularityProduct[] = role.alternatives.map((o) => {
      const pop = data.popularity[o.id]
      return {
        id: o.id,
        name: o.name,
        curated: curated.has(o.id),
        stars: pop?.stars,
        installs: pop ? weeklyInstalls(pop) : undefined,
      }
    })
    const signals: Record<string, string> = {}
    for (const p of products) {
      const parts: string[] = []
      if (p.curated) parts.push('clearly popular (curated set — unranked; alphabetical within)')
      if (p.stars !== undefined) parts.push(`★ ${formatCompact(p.stars)} GitHub stars`)
      if (p.installs !== undefined) parts.push(`${formatCompact(p.installs)} weekly installs`)
      if (parts.length > 0) signals[p.id] = parts.join(' · ')
    }
    out[role.arenaId] = { order: likelyChoiceOrder(products), signals }
  }
  return out
}
