import { z } from 'zod'

export const EXECUTION_CATEGORIES = ['agent-native', 'agent-computer-use', 'human-online', 'human-offline'] as const
export type ExecutionCategory = typeof EXECUTION_CATEGORIES[number]
export const EXECUTION_LABELS: Record<ExecutionCategory, string> = {
  'agent-native': 'Agent Native',
  'agent-computer-use': 'Agent Computer Use',
  'human-online': 'Human Online',
  'human-offline': 'Human Offline',
}

// An assessment describes the work's mechanism. It never grants authority or
// proves that a particular user's environment has the required connection.
export const executionSchema = z.strictObject({
  category: z.enum(EXECUTION_CATEGORIES).nullable(),
  basis: z.enum(['local-work', 'documented-interface', 'browser-evidence', 'human-work', 'unresolved']),
  rationale: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  reviewRequired: z.boolean(),
})
export type Execution = z.infer<typeof executionSchema>

export function executionOf(metadata: Record<string, unknown>): Execution | undefined {
  return metadata.execution === undefined ? undefined : executionSchema.parse(metadata.execution)
}

export function executionLabel(execution: Execution | undefined): string {
  return execution?.category ? EXECUTION_LABELS[execution.category] : 'Execution needs review'
}

export function agentExecution(execution: Execution | undefined): boolean {
  return execution?.category === 'agent-native' || execution?.category === 'agent-computer-use'
}

export function validateExecution(metadata: Record<string, unknown>, scope: string): void {
  const execution = executionOf(metadata)
  if (!execution) return
  const { category, basis, reviewRequired } = execution
  if ((category === null) !== (basis === 'unresolved') || category === null && !reviewRequired) {
    throw new Error(`${scope}: unresolved execution needs a null category and review`)
  }
  if (category === 'agent-native' && !['local-work', 'documented-interface'].includes(basis)) {
    throw new Error(`${scope}: Agent Native needs local work or a documented interface`)
  }
  if (category === 'agent-computer-use' && basis !== 'browser-evidence') {
    throw new Error(`${scope}: Agent Computer Use needs browser evidence`)
  }
  if (category?.startsWith('human-') && basis !== 'human-work') {
    throw new Error(`${scope}: human execution needs a human-work basis`)
  }
  if (metadata.legalSignature === true && category?.startsWith('agent-')) {
    throw new Error(`${scope}: an agent cannot perform the required human signature`)
  }
}
