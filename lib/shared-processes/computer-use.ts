import { humanStepAudit } from '../humanSteps'
import { showComputerUseChips } from '../humanStepsUi'
import { computerUseOptions, isComputerUseCandidate } from '../processRankings'
import { loadProcesses } from '../processes'
import type { Part } from './schema'
import type { ComputerUseOption } from '../processRankings'

export type ComputerUseChoice = Pick<ComputerUseOption, 'arenaId' | 'productId' | 'name' | 'score'>

// Preserve the legacy step's evidence and applicability; alternative methods need
// their own mappings and do not inherit the default step's computer-use vendors.
export function computerUseForPart(sourceId: string, part: Part, optionId?: string): ComputerUseChoice[] {
  if (part.kind === 'reference') return []
  const node = loadProcesses().find(task => task.id === sourceId)?.dag.nodes.find(node => node.id === part.id)
  if (!node || !isComputerUseCandidate(node)) return []
  const defaultOption = node.methods?.length && part.options.some(option => option.id === 'default')
  if (defaultOption ? optionId !== 'default' : optionId !== undefined) return []
  const metadata = optionId ? part.options.find(option => option.id === optionId)?.metadata : part.metadata
  if (!metadata || !['form', 'person'].includes(String(metadata.route)) || metadata.legalSignature === true) return []
  const audit = humanStepAudit(sourceId, part.id)
  if (!showComputerUseChips(audit?.computerUse, node.legalSignature)) return []
  return computerUseOptions(sourceId, part.id).map(({ arenaId, productId, name, score }) => ({ arenaId, productId, name, score }))
}
