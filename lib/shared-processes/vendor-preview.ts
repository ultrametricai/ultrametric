import { loadStepStoryMap, stepVendorScore } from '../processRankings'
import type { SharedRecord } from './schema'
import { resolveServiceCandidates } from './service-candidates'

export interface CapabilityEvidence {
  candidateId: string
  name: string
  score: number
  stories: Array<{ id: string; title: string; verdict: string; quality: number; weight: number }>
  href: string
}
export interface VendorCoverage {
  score: number
  scope: string
  storyCount: number
}
export interface VendorPreview {
  choiceScope: string
  parentChoiceScope?: string
  evidence: Record<string, CapabilityEvidence[]>
  coverage: Record<string, VendorCoverage>
}

// Explicit preview bridge: these source node mappings describe these canonical scopes.
// The filing mapping belongs to the repaired default option, never its foreign alternatives.
// No graph, instructions, route, or risk assessment is projected from the legacy loader.
export function buildVendorPreview(record: SharedRecord, scope = record.id, parentScopes: Record<string, string> = {}): VendorPreview | undefined {
  if (record.id !== 'form_001') return undefined
  const choice = record.parts.find(part => part.id === 'n1')
  if (!choice) return undefined
  const candidates = resolveServiceCandidates(choice.references)
  const mappings = loadStepStoryMap()
  const evidence: VendorPreview['evidence'] = {}
  for (const nodeId of ['n4', 'n6', 'n7']) {
    const part = record.parts.find(part => part.id === nodeId)
    if (!part || (nodeId === 'n4' && !part.options.some(option => option.id === 'default'))) continue
    const mapping = mappings.find(entry => entry.taskId === record.id && entry.nodeId === nodeId && entry.kind === 'function' && entry.arenaId === 'legal-ops')
    if (!mapping) continue
    const scope = `${record.id}:${nodeId}${nodeId === 'n4' ? ':default' : ''}`
    evidence[scope] = candidates.flatMap(candidate => {
      const [arenaId, productId] = candidate.id.split('/')
      if (arenaId !== mapping.arenaId || !candidate.href) return []
      const score = stepVendorScore(arenaId, mapping.storyIds, productId)
      if (!score) return []
      return [{
        candidateId: candidate.id, name: candidate.name, score: score.score, href: candidate.href,
        stories: score.cites.map(cite => ({ id: cite.storyId, title: cite.storyTitle, verdict: cite.verdict, quality: cite.quality, weight: cite.weight })),
      }]
    })
  }
  const coverage: VendorPreview['coverage'] = {}
  const filingScope = `${record.id}:n4:default`
  for (const item of evidence[filingScope] ?? []) {
    coverage[item.candidateId] = { score: item.score, scope: filingScope, storyCount: item.stories.length }
  }
  const remap = (key: string) => scope + key.slice(record.id.length)
  return {
    choiceScope: `${scope}:${choice.id}`,
    parentChoiceScope: parentScopes[remap(filingScope)],
    coverage: Object.fromEntries(Object.entries(coverage).map(([id, value]) => [id, { ...value, scope: remap(value.scope) }])),
    evidence: Object.fromEntries(Object.entries(evidence).map(([key, value]) => [remap(key), value])),
  }
}
