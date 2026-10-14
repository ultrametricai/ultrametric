// The integration graph: schema + loader + graph helpers for open-rankings/{cat}/integrations.json —
// which tracked products verifiably connect to which others, extracted from each product's
// COLLECTED EVIDENCE CORPUS (docs/GitHub/community evidence; for the most-connected products the
// corpus deliberately includes their official integrations-directory page via urls.extra) by
// pipeline/stages/integrations.ts — the stage itself never crawls. Honesty contract
// (mirrors lib/pricing.ts): every edge carries the id of the evidence item it came from plus a
// verbatim excerpt verified (in code, not by prompt) to appear inside that evidence item's own
// excerpt — an edge that can't be traced byte-for-byte back to collected evidence is dropped at
// the stage, never written. Absence of an edge means "no evidence found in our corpus", NEVER
// "doesn't integrate" — display code must always phrase it that way.
//
// Same tolerant-optional load contract as popularity/claims/pricing: a missing integrations.json
// is an empty list, never an error.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { CategoryData } from './data-helpers'

// One directed claim: "the owning product's evidence says it integrates with `productId`".
// `arena` is the target's home arena (its canonical /arena/... link); `sourceEvidenceId` points
// into the OWNING product's open-rankings/{cat}/evidence/{id}.json; `excerpt` is the verbatim quote from
// that evidence item containing the target's name.
export const IntegrationEdgeSchema = z.object({
  productId: z.string().min(1),
  arena: z.string().min(1),
  sourceEvidenceId: z.string().min(1),
  excerpt: z.string().min(8).max(400),
})

export const ProductIntegrationsSchema = z.object({
  productId: z.string().min(1),
  integratesWith: IntegrationEdgeSchema.array().min(1),
})

// open-rankings/{cat}/integrations.json shape: one entry per product with ≥1 verified edge, in
// products.json order. A product absent from the file has no verified edges (either the stage
// hasn't run or nothing survived verification) — display code renders absence as absence.
export const IntegrationsFileSchema = ProductIntegrationsSchema.array()

export type IntegrationEdge = z.infer<typeof IntegrationEdgeSchema>
export type ProductIntegrations = z.infer<typeof ProductIntegrationsSchema>

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')
const integrationsCache = new Map<string, ProductIntegrations[]>()

export function loadIntegrations(categoryId: string, dir: string = DEFAULT_DIR()): ProductIntegrations[] {
  const cacheKey = `${dir}::${categoryId}`
  const hit = integrationsCache.get(cacheKey)
  if (hit) return hit
  const file = path.join(dir, categoryId, 'integrations.json')
  const list = fs.existsSync(file)
    ? IntegrationsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    : []
  integrationsCache.set(cacheKey, list)
  return list
}

// ---- graph helpers ----

// One evidence-backed mention behind a neighbor relation, direction preserved: the claim was
// found in `fromProductId`'s evidence (its arena is `fromArena`), citing `evidenceId` there.
export interface IntegrationSource {
  fromProductId: string
  fromArena: string
  evidenceId: string
  excerpt: string
}

export interface IntegrationNeighbor {
  productId: string
  // The neighbor's home arena (for linking) — the `arena` stamped on the edge when the neighbor
  // was the target, or the arena of the file it appeared in when it was the source.
  arena: string
  sources: IntegrationSource[]
}

// productId -> neighbors. Edges are symmetricized (an "A integrates with B" claim makes B a
// neighbor of A AND A a neighbor of B) with direction preserved per source via fromProductId.
export type IntegrationGraph = Map<string, IntegrationNeighbor[]>

// Sorted-pair key for "is this pair verified?" checks — the exact format
// lib/stackBuilder.ts's stackPairKey mirrors (cross-checked in tests).
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

export function buildIntegrationGraph(
  arenas: Array<{ arena: string; integrations: ProductIntegrations[] }>,
): IntegrationGraph {
  const graph: IntegrationGraph = new Map()
  const neighborFor = (ownerId: string, neighborId: string, neighborArena: string): IntegrationNeighbor => {
    const list = graph.get(ownerId) ?? []
    if (!graph.has(ownerId)) graph.set(ownerId, list)
    let n = list.find((x) => x.productId === neighborId)
    if (!n) {
      n = { productId: neighborId, arena: neighborArena, sources: [] }
      list.push(n)
    }
    return n
  }
  for (const { arena, integrations } of arenas) {
    for (const entry of integrations) {
      for (const edge of entry.integratesWith) {
        // A self-loop carries no connection information — drop it defensively (the stage never
        // writes one, but the graph must not render "X integrates with X" from a bad file).
        if (edge.productId === entry.productId) continue
        const source: IntegrationSource = {
          fromProductId: entry.productId,
          fromArena: arena,
          evidenceId: edge.sourceEvidenceId,
          excerpt: edge.excerpt,
        }
        neighborFor(entry.productId, edge.productId, edge.arena).sources.push(source)
        neighborFor(edge.productId, entry.productId, arena).sources.push(source)
      }
    }
  }
  return graph
}

export function neighborsOf(graph: IntegrationGraph, productId: string): IntegrationNeighbor[] {
  return graph.get(productId) ?? []
}

// Every verified unordered pair as 'a|b' keys — the serializable prop /stacks/builder passes to
// the client for the interconnect check.
export function verifiedPairKeys(graph: IntegrationGraph): string[] {
  const keys = new Set<string>()
  for (const [productId, neighbors] of graph) {
    for (const n of neighbors) keys.add(pairKey(productId, n.productId))
  }
  return [...keys].sort()
}

export interface IntegrationStats {
  // Unique unordered product pairs with ≥1 verified mention.
  totalPairs: number
  // Total evidence-backed mentions behind those pairs (a pair claimed from both sides counts 2).
  totalMentions: number
  // Products with ≥1 neighbor.
  connectedProducts: number
  // Most-connected products, by neighbor count (ties broken by productId for determinism).
  topConnected: Array<{ productId: string; arena: string; neighborCount: number }>
}

export function integrationStats(graph: IntegrationGraph, topN = 10): IntegrationStats {
  const pairs = new Set<string>()
  const mentionIds = new Set<string>()
  const arenaOf = new Map<string, string>()
  for (const [productId, neighbors] of graph) {
    for (const n of neighbors) {
      pairs.add(pairKey(productId, n.productId))
      arenaOf.set(n.productId, n.arena)
      for (const s of n.sources) {
        // Each source appears on both sides of its symmetricized pair — dedupe on the directed
        // claim (from, evidence item, target), where the target is the pair member that isn't
        // the claimer.
        const targetId = s.fromProductId === productId ? n.productId : productId
        mentionIds.add(`${s.fromProductId}::${s.evidenceId}::${targetId}`)
        arenaOf.set(s.fromProductId, s.fromArena)
      }
    }
  }
  const topConnected = [...graph.entries()]
    .map(([productId, neighbors]) => ({
      productId,
      arena: arenaOf.get(productId) ?? '',
      neighborCount: neighbors.length,
    }))
    .sort((a, b) => b.neighborCount - a.neighborCount || a.productId.localeCompare(b.productId))
    .slice(0, topN)
  return {
    totalPairs: pairs.size,
    totalMentions: mentionIds.size,
    connectedProducts: graph.size,
    topConnected,
  }
}

// productId -> display ref across loaded categories, for rendering graph nodes. A product
// tracked in multiple arenas keeps its first arena (categories order) — the same canonical-link
// convention the stage uses for edge targets.
export interface ProductRef {
  name: string
  arenaId: string
  arenaName: string
}

export function productRefIndex(categories: CategoryData[]): Map<string, ProductRef> {
  const index = new Map<string, ProductRef>()
  for (const data of categories) {
    for (const p of data.products) {
      if (!index.has(p.id)) {
        index.set(p.id, { name: p.name, arenaId: data.category.id, arenaName: data.category.name })
      }
    }
  }
  return index
}

// Fleet-wide graph across every populated category — the shape both /integrations and the
// product page's "Verified integrations" chips consume. Cached per dir like lib/data.ts.
const graphCache = new Map<string, IntegrationGraph>()

export function loadIntegrationGraph(
  categoryIds: string[],
  dir: string = DEFAULT_DIR(),
): IntegrationGraph {
  const cacheKey = `${dir}::${categoryIds.join(',')}`
  const hit = graphCache.get(cacheKey)
  if (hit) return hit
  const graph = buildIntegrationGraph(
    categoryIds.map((id) => ({ arena: id, integrations: loadIntegrations(id, dir) })),
  )
  graphCache.set(cacheKey, graph)
  return graph
}
