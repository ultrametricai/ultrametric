import { buildProcessCheckSteps } from '../processCheckData'
import { loadProcesses } from '../processes'
import type { ProcessCheckStep } from '../processCheck'
import type { SharedRecord } from './schema'
import type { ProcessProviderChoice } from './provider-choice'
import type { VendorPreview } from './vendor-preview'
import type { StepComparisons } from './step-comparisons'
import type { SelectionContract } from './selection-compatibility'
import { processGraphs } from './graph'
import { resolveServiceCandidates } from './service-candidates'

export function processSelectionContract(record: SharedRecord, records: SharedRecord[], comparisons: StepComparisons, choice?: ProcessProviderChoice, vendor?: VendorPreview): SelectionContract {
  const groups: SelectionContract['groups'] = (choice?.groups ?? []).map(group => ({ scope: group.scope, arenaId: group.arenaId, candidates: group.candidates.map(candidate => candidate.id) }))
  if (vendor) {
    const source = record.parts.find(part => `${record.id}:${part.id}` === vendor.choiceScope)
    const candidates = resolveServiceCandidates(source?.references ?? []).map(candidate => candidate.id)
    // Unranked vendor references share the chooser but have no arena lens key.
    const arenas = new Set(candidates.filter(candidate => !candidate.startsWith('vendor/')).map(candidate => candidate.split('/')[0]))
    if (arenas.size === 1) groups.push({ scope: vendor.choiceScope, arenaId: [...arenas][0], candidates })
  }
  const tasks = loadProcesses()
  const checks = new Map<string, ProcessCheckStep[]>()
  const nodes = processGraphs(record, records).flatMap(graph => graph.nodes).sort((a, b) => b.scope.length - a.scope.length)
  const steps: SelectionContract['steps'] = Object.entries(comparisons).map(([scope, comparison]) => {
    const node = nodes.find(node => scope === node.scope || scope.startsWith(`${node.scope}:`))
    const [taskId, nodeId] = (node?.sourceScope ?? '').split(':')
    const task = tasks.find(task => task.id === taskId)
    if (task && !checks.has(taskId)) checks.set(taskId, buildProcessCheckSteps(task))
    return { scope, choiceScope: vendor?.choiceScope ?? choice?.stepScopes[scope],
      // Candidates come from the step's FUNCTION comparison only. The cross-arena judged
      // groups (additionalComparisons) live on the reader branch; when they land, their
      // positive-score products join this same list — the eligibility rule is unchanged.
      candidates: comparison.products.filter(product => product.score > 0 && product.stories.some(story => story.quality > 0)).map(product => product.id),
      legacyStep: checks.get(taskId)?.find(step => step.nodeId === nodeId),
    }
  })
  return { groups, steps }
}
