// Pure, client-safe scoring for /stacks/battle (components/StackBattle.tsx): put two stacks —
// curated presets and/or custom product lists — side by side and compare their AGGREGATES.
//
// Honesty contract, stated up front because "battle" oversells it: these are aggregates of
// per-arena evidence scores (means, coverage counts, verified-interconnect counts), NOT a
// judged head-to-head. Scores are computed within each product's own arena, so cross-arena
// aggregates are directional; the one place a real judged battle exists — two products in the
// SAME arena — the slot row links to its arena battle page instead of pretending this page judged it.
import type { MyStackProduct } from './myStack'
import { stackPairKey } from './stackBuilder'

const round1 = (n: number) => Math.round(n * 10) / 10

export interface StackAggregates {
  productCount: number
  /** Distinct arenas the stack covers. */
  arenaCount: number
  /** Mean Overall score over products that have one (null when none do). */
  meanAiEra: number | null
  /** How many products the Overall-score mean rests on — a thin mean must read as thin. */
  aiEraCount: number
  meanAgentReady: number | null
  agentReadyCount: number
  /** Verified integration edges between the stack's own products, out of all its pairs. */
  verifiedInterconnects: number
  possiblePairs: number
  /** Lowest-Overall-score product — the stack's weakest evidence-scored link (null if none scored). */
  weakestLink: MyStackProduct | null
}

export function aggregateStack(products: MyStackProduct[], verifiedPairs: ReadonlyArray<string>): StackAggregates {
  const verified = new Set(verifiedPairs)
  const scored = products.filter((p): p is MyStackProduct & { aiEra: number } => p.aiEra !== null)
  const agentScored = products.filter((p) => p.agentReady !== null)
  let pairs = 0
  let verifiedCount = 0
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      if (products[i].id === products[j].id) continue
      pairs++
      if (verified.has(stackPairKey(products[i].id, products[j].id))) verifiedCount++
    }
  }
  const weakest = [...scored].sort((a, b) => a.aiEra - b.aiEra || a.id.localeCompare(b.id))[0] ?? null
  return {
    productCount: products.length,
    arenaCount: new Set(products.map((p) => p.arenaId)).size,
    meanAiEra: scored.length > 0 ? round1(scored.reduce((s, p) => s + p.aiEra, 0) / scored.length) : null,
    aiEraCount: scored.length,
    meanAgentReady:
      agentScored.length > 0
        ? round1(agentScored.reduce((s, p) => s + (p.agentReady as number), 0) / agentScored.length)
        : null,
    agentReadyCount: agentScored.length,
    verifiedInterconnects: verifiedCount,
    possiblePairs: pairs,
    weakestLink: weakest,
  }
}

// ---- per-arena slot rows ----

export interface SlotComparison {
  arenaId: string
  arenaName: string
  a: MyStackProduct[]
  b: MyStackProduct[]
  /** Which side's best Overall score wins this slot — null when a side is empty or unscored. */
  winner: 'a' | 'b' | 'tie' | null
  /** `/arena/{arenaId}/battle/{slug}` when exactly one product per side and their judged battle page exists. */
  battleHref: string | null
}

const bestScore = (products: MyStackProduct[]): number | null => {
  const scores = products.map((p) => p.aiEra).filter((s): s is number => s !== null)
  return scores.length > 0 ? Math.max(...scores) : null
}

// battleSlugs: every existing battle page as an `{arenaId}/{a}-vs-{b}` key (`{a}-vs-{b}` in the
// battle's stored order) — passed down from the server (lib/data.ts battles) because the client
// can't know which order a pair's battle was generated in, and a dead battle link would be
// worse than no link. The arena prefix matters: the same pair battles in two arenas in a few
// cases, and the slot row must link its own arena's battle.
export function slotComparisons(
  aProducts: MyStackProduct[],
  bProducts: MyStackProduct[],
  battleSlugs: ReadonlyArray<string>,
): SlotComparison[] {
  const slugs = new Set(battleSlugs)
  const arenas = new Map<string, { arenaName: string; a: MyStackProduct[]; b: MyStackProduct[] }>()
  const note = (p: MyStackProduct, side: 'a' | 'b') => {
    const entry = arenas.get(p.arenaId) ?? { arenaName: p.arenaName, a: [], b: [] }
    entry[side].push(p)
    arenas.set(p.arenaId, entry)
  }
  for (const p of aProducts) note(p, 'a')
  for (const p of bProducts) note(p, 'b')

  return [...arenas.entries()]
    .sort((x, y) => x[1].arenaName.localeCompare(y[1].arenaName))
    .map(([arenaId, { arenaName, a, b }]) => {
      const aBest = bestScore(a)
      const bBest = bestScore(b)
      const winner =
        aBest === null || bBest === null ? null : aBest > bBest ? 'a' : bBest > aBest ? 'b' : 'tie'
      let battleHref: string | null = null
      if (a.length === 1 && b.length === 1 && a[0].id !== b[0].id) {
        const forward = `${a[0].id}-vs-${b[0].id}`
        const backward = `${b[0].id}-vs-${a[0].id}`
        const slug = slugs.has(`${arenaId}/${forward}`) ? forward : slugs.has(`${arenaId}/${backward}`) ? backward : null
        battleHref = slug ? `/arena/${arenaId}/battle/${slug}` : null
      }
      return { arenaId, arenaName, a, b, winner, battleHref }
    })
}

// ---- verdict ----

// One honest summary sentence over the aggregates. It names what the numbers actually are
// (means of per-arena evidence scores) and refuses to crown a winner on a sub-noise gap —
// within Δ2 of mean Overall score the verdict says "effectively even".
export const VERDICT_EVEN_DELTA = 2

export function battleVerdict(
  aLabel: string,
  bLabel: string,
  a: StackAggregates,
  b: StackAggregates,
): string {
  if (a.meanAiEra === null || b.meanAiEra === null) {
    return 'Not enough scored products on both sides to compare the aggregates.'
  }
  const delta = round1(a.meanAiEra - b.meanAiEra)
  const [leadLabel, lead, trailLead] =
    delta > 0
      ? ([aLabel, { mean: a.meanAiEra, count: a.aiEraCount }, { mean: b.meanAiEra, count: b.aiEraCount }] as const)
      : ([bLabel, { mean: b.meanAiEra, count: b.aiEraCount }, { mean: a.meanAiEra, count: a.aiEraCount }] as const)
  const head =
    Math.abs(delta) < VERDICT_EVEN_DELTA
      ? `${aLabel} and ${bLabel} are effectively even on mean Overall score (${a.meanAiEra.toFixed(1)}/100 vs ${b.meanAiEra.toFixed(1)}/100)`
      : `${leadLabel} leads on mean Overall score, ${lead.mean.toFixed(1)}/100 vs ${trailLead.mean.toFixed(1)}/100 across ${lead.count} vs ${trailLead.count} scored products`
  const interconnect =
    a.possiblePairs > 0 && b.possiblePairs > 0
      ? `; verified interconnects ${a.verifiedInterconnects}/${a.possiblePairs} vs ${b.verifiedInterconnects}/${b.possiblePairs}`
      : ''
  return `${head}${interconnect} — an aggregate of per-ranking evidence scores, not a judged head-to-head.`
}

// ---- share-URL state (?a=…&b=…) ----

// Each side is either a curated preset id (data/ai-stacks.json) or a comma-separated custom
// product list. Preset ids are matched first — they're kebab-case slugs from a reviewed file,
// so a collision with a product id would be a data bug, not a runtime ambiguity.
export type BattleSideState =
  | { kind: 'preset'; presetId: string }
  | { kind: 'custom'; ids: string[] }
  | { kind: 'empty' }

export const MAX_BATTLE_SIDE = 24

export function parseBattleSideParam(
  raw: string | null | undefined,
  validIds: ReadonlySet<string>,
  presetIds: ReadonlySet<string>,
): BattleSideState {
  if (!raw) return { kind: 'empty' }
  const trimmed = raw.trim()
  if (presetIds.has(trimmed)) return { kind: 'preset', presetId: trimmed }
  const ids: string[] = []
  for (const piece of trimmed.split(',')) {
    const id = piece.trim()
    if (id === '' || !validIds.has(id) || ids.includes(id)) continue
    ids.push(id)
    if (ids.length === MAX_BATTLE_SIDE) break
  }
  return ids.length > 0 ? { kind: 'custom', ids } : { kind: 'empty' }
}

export function encodeBattleSideParam(state: BattleSideState): string {
  if (state.kind === 'preset') return state.presetId
  if (state.kind === 'custom') return state.ids.join(',')
  return ''
}
