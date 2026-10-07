import { processAnchorContract } from './compatibility'
import { sourceStepScope } from './source-step'
import { loadCategory } from '../data'
import { buildProcessCheckSteps } from '../processCheckData'
import { crossArenaStepRankings, functionMappingFor, stepVendorScore, type StepVendorScore } from '../processRankings'
import { loadProcesses } from '../processes'
import { hasLogo } from '../logos'
import type { SharedRecord } from './schema'

export interface StepComparisonProduct {
  id: string
  productId: string
  name: string
  href: string
  hasLogo: boolean
  score: number
  stories: Array<{
    id: string; title: string; verdict: string; quality: number; weight: number
    confidence: string; rationale: string
    evidence: Array<{ id: string; url: string; excerpt: string; fetchedAt: string; tier: string }>
  }>
}
export interface StepComparison {
  title?: string
  storyCount: number
  products: StepComparisonProduct[]
  additionalComparisons?: Array<StepComparison & { arenaId: string; arenaName: string }>
}
export type StepComparisons = Record<string, StepComparison>

function comparisonProduct(arenaId: string, score: StepVendorScore): StepComparisonProduct {
  const data = loadCategory(arenaId)
  return {
    id: `${arenaId}/${score.productId}`, productId: score.productId, name: score.name,
    href: `/arena/${arenaId}/product/${score.productId}`, hasLogo: hasLogo(score.productId), score: score.score,
    stories: score.cites.map(cite => {
      const verdict = data.verdicts.find(item => item.productId === score.productId && item.storyId === cite.storyId)!
      return {
        id: cite.storyId, title: cite.storyTitle, verdict: cite.verdict, quality: cite.quality, weight: cite.weight,
        confidence: verdict.confidence, rationale: verdict.rationale,
        evidence: (data.evidence[score.productId] ?? []).filter(evidence => verdict.evidenceIds.includes(evidence.id)).map(evidence => ({ id: evidence.id, url: evidence.url, excerpt: evidence.excerpt, fetchedAt: evidence.fetchedAt, tier: evidence.tier })),
      }
    }),
  }
}

// Read-only bridge from existing FUNCTION mappings to their preserved canonical scope.
// A migrated method node's original mapping describes its default option only. Nested
// alternatives and linked processes need their own authored mappings, never inheritance.
export function buildStepComparisons(record: SharedRecord): StepComparisons {
  const task = loadProcesses().find(task => task.id === record.id)
  if (!task) return {}
  const result: StepComparisons = {}
  const steps = buildProcessCheckSteps(task)
  const anchors = processAnchorContract(record, [record], task)
  for (const node of task.dag.nodes) {
    const step = steps.find(step => step.nodeId === node.id)
    const scope = sourceStepScope(record, node, anchors)
    if (!scope) continue
    const part = record.parts.find(part => part.id === node.id)!
    const mapping = functionMappingFor(task.id, node)
    const arena = step?.arenas.find(arena => arena.kind === 'function')
    const products = arena && mapping ? arena.vendors.filter(vendor => !vendor.shutdown).flatMap(vendor => {
      const score = stepVendorScore(arena.arenaId, mapping.storyIds, vendor.productId)
      return score ? [comparisonProduct(arena.arenaId, score)] : []
    }) : []
    // These already-published alternatives have distinct story sets. Keep the
    // original arena order and each arena's scores/citations in separate groups.
    // Provider/process aggregates continue to read only the function products.
    const additionalComparisons = crossArenaStepRankings(task.id, node).map(extra => ({
      arenaId: extra.arenaId, arenaName: extra.arenaName,
      storyCount: extra.stories.length,
      products: extra.vendors.map(score => comparisonProduct(extra.arenaId, score)),
    }))
    if (products.length || additionalComparisons.length) result[scope] = { title: part.title ?? part.id, storyCount: step?.storyCount ?? 0, products,
      ...(additionalComparisons.length ? { additionalComparisons } : {}),
    }
  }
  return result
}

export function comparisonCandidates(comparison: StepComparison | undefined): string[] {
  return comparison ? [comparison, ...(comparison.additionalComparisons ?? [])].flatMap(group => group.products.map(product => product.id)) : []
}
