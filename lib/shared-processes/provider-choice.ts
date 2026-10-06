import { aggregateStepCoverage } from '../processRankings'
import { loadCategories } from '../data'
import type { SharedRecord } from './schema'
import type { StepComparisons } from './step-comparisons'
import { resolveServiceCandidates, type ServiceCandidate } from './service-candidates'
import { vendorEvidenceHref } from './coverage-links'

export interface ProviderScore { score: number; assessedSteps: number; evidenceHref?: string; steps: Array<{ scope: string; title: string; score: number | null; evidenceHref?: string }> }
export interface ProviderGroup { scope: string; arenaId: string; title: string; candidates: ServiceCandidate[]; scores: Record<string, ProviderScore>; stepCount: number; partScope?: string }
export interface ProcessProviderChoice { groups: ProviderGroup[]; stepScopes: Record<string, string> }

export function buildProcessProviderChoice(record: SharedRecord, comparisons: StepComparisons): ProcessProviderChoice | undefined {
  if (record.id === 'form_001') return undefined // existing approved filing chooser
  const categories = new Map(loadCategories().map(category => [category.id, category.name]))
  const grouped = new Map<string, Map<string, ServiceCandidate>>()
  const stepScopes: Record<string, string> = {}
  for (const [stepScope, comparison] of Object.entries(comparisons)) {
    const arenas = new Set(comparison.products.map(product => product.id.split('/')[0]))
    if (arenas.size !== 1) continue // no inferred mixing of unrelated service categories
    const arena = [...arenas][0]
    stepScopes[stepScope] = `${record.id}:provider:${arena}`
    const candidates = grouped.get(arena) ?? new Map<string, ServiceCandidate>()
    for (const product of comparison.products) candidates.set(product.id, { id: product.id, name: product.name, href: product.href, logoId: product.hasLogo ? product.productId : null })
    grouped.set(arena, candidates)
  }
  const groups: ProviderGroup[] = [...grouped].map(([arenaId, candidates]) => {
    // Reuse an unambiguous explicitly authored candidate step instead of duplicating
    // its chooser at the top. Matching by resolved category IDs, never label guesses.
    const authoredChoices = record.parts.filter(part => {
      const candidates = resolveServiceCandidates(part.references)
      return part.kind === 'step' && candidates.length > 0 && candidates.every(candidate => candidate.id.startsWith(`${arenaId}/`))
    })
    const partScope = authoredChoices.length === 1 && !comparisons[`${record.id}:${authoredChoices[0].id}`] ? `${record.id}:${authoredChoices[0].id}` : undefined
    const steps = Object.entries(comparisons).filter(([scope]) => stepScopes[scope] === `${record.id}:provider:${arenaId}`)
    const scores = Object.fromEntries([...candidates.keys()].map(id => {
      const breakdown = steps.map(([scope, comparison]) => {
        const product = comparison.products.find(product => product.id === id)
        return { scope, title: comparison.title ?? scope, score: product?.score ?? null, evidenceHref: product ? vendorEvidenceHref(product.href, product.stories.map(story => story.id)) : undefined }
      })
      const assessed = breakdown.flatMap(step => step.score === null ? [] : [step.score])
      const stories = steps.flatMap(([, comparison]) => comparison.products.find(product => product.id === id)?.stories.map(story => story.id) ?? [])
      return [id, { score: aggregateStepCoverage(assessed, steps.length), assessedSteps: assessed.length, steps: breakdown, evidenceHref: vendorEvidenceHref(candidates.get(id)!.href, stories) }]
    }))
    return { scores, stepCount: steps.length, scope: `${record.id}:provider:${arenaId}`, arenaId, title: categories.get(arenaId) ?? arenaId,
      candidates: [...candidates.values()].sort((a, b) => scores[b.id].score - scores[a.id].score || scores[b.id].assessedSteps - scores[a.id].assessedSteps || a.name.localeCompare(b.name)), partScope }
  }).sort((a, b) => a.title.localeCompare(b.title))
  return groups.length ? { groups, stepScopes } : undefined
}
