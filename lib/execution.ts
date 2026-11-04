import { z } from 'zod'

export const EXECUTION_CATEGORIES = ['agent-native', 'agent-computer-use', 'human-online', 'human-offline'] as const
export type ExecutionCategory = typeof EXECUTION_CATEGORIES[number]
export const EXECUTION_LABELS: Record<ExecutionCategory, string> = {
  'agent-native': 'Agent Native',
  'agent-computer-use': 'Agent Computer Use',
  'human-online': 'Human Online',
  'human-offline': 'Human Offline',
}

// Automation evidence is separate from the selected execution category. A
// documented capability is not an observation of a completed workflow.
export const automationEvidenceSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unverified') }),
  z.strictObject({ status: z.literal('documented') }),
  z.strictObject({
    status: z.literal('observed'),
    scope: z.string().min(1),
    observedAt: z.iso.datetime(),
    receipt: z.string().min(1),
  }),
])

// An assessment describes the work's mechanism. It never grants authority or
// proves that a particular user's environment has the required connection.
export const executionSchema = z.strictObject({
  category: z.enum(EXECUTION_CATEGORIES).nullable(),
  basis: z.enum(['local-work', 'documented-interface', 'browser-evidence', 'human-work', 'unresolved']),
  rationale: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  reviewRequired: z.boolean(),
  automationEvidence: automationEvidenceSchema.optional(),
})
export type Execution = z.infer<typeof executionSchema>

const scopedApprovalSchema = z.object({ role: z.string().min(1), scope: z.string().min(1) })

// When a human approves an externally effectful step. Every mode except 'none' is a named,
// scoped human approval: 'every-run' approves each run case by case; 'first-run' approves the
// first run and the recorded approval stands for repeats; 'threshold' approves runs once the
// named threshold applies; 'pre-approvable' runs under a recorded STANDING approval, never an
// absent one. 'none' is reserved for steps with no external effect.
export const APPROVAL_MODES = ['every-run', 'first-run', 'threshold', 'pre-approvable', 'none'] as const
export type ApprovalMode = typeof APPROVAL_MODES[number]

export const approvalThresholdSchema = z.strictObject({
  kind: z.enum(['amount', 'data-sharing', 'recipients', 'irreversible']),
  value: z.string().min(1).optional(),
})

export const approvalSchema = z.strictObject({
  mode: z.enum(APPROVAL_MODES),
  threshold: approvalThresholdSchema.optional(),
  // Why the step carries this mode, citing the governing policy (policies/AGENT_POLICY.md).
  reason: z.string().min(1),
  // The named approver and approval scope where the record declares them.
  role: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
})
export type Approval = z.infer<typeof approvalSchema>

// Every committed approval object carries a mode and reason (the migration added them).
// The explicit null stays: the preserved legacy projection contract
// (schemas/legacy-process.schema.json) requires the key on every workflow step.
// requiresExecutionApproval still tolerates the pre-mode { role, scope } shape at runtime.
export const metadataApprovalSchema = approvalSchema.nullable()

export function approvalOf(metadata: Record<string, unknown>): Approval | undefined {
  if (metadata.approval == null) return undefined
  const parsed = approvalSchema.safeParse(metadata.approval)
  return parsed.success ? parsed.data : undefined
}

export function requiresExecutionApproval(metadata: Record<string, unknown>): boolean {
  const approval = approvalOf(metadata)
  if (approval) return approval.mode !== 'none'
  return metadata.approvalRequired === true || scopedApprovalSchema.safeParse(metadata.approval).success
}

export function validateApproval(metadata: Record<string, unknown>, scope: string): void {
  if (metadata.approval == null) return
  const parsed = approvalSchema.parse(metadata.approval)
  if ((parsed.mode === 'threshold') !== (parsed.threshold !== undefined)) {
    throw new Error(`${scope}: a threshold rides with mode "threshold" and only there`)
  }
  // approvalRequired is derived from the mode: true unless the mode is 'none'.
  if ((metadata.approvalRequired === true) !== (parsed.mode !== 'none')) {
    throw new Error(`${scope}: approvalRequired must equal (approval.mode !== 'none')`)
  }
  if ((metadata.reversibility === 'irreversible' || metadata.legalSignature === true) && parsed.mode !== 'every-run') {
    throw new Error(`${scope}: irreversible and signature steps carry approval mode "every-run"`)
  }
}

export function executionOf(metadata: Record<string, unknown>): Execution | undefined {
  return metadata.execution === undefined ? undefined : executionSchema.parse(metadata.execution)
}

export function executionLabel(execution: Execution | undefined): string {
  return execution?.category ? EXECUTION_LABELS[execution.category] : 'Execution needs review'
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
  const automation = execution.automationEvidence
  if (automation?.status === 'observed' && !execution.evidence.includes(automation.receipt)) {
    throw new Error(`${scope}: observed automation needs its receipt in the evidence list`)
  }
  if (category?.startsWith('agent-') && automation?.status === 'unverified') {
    throw new Error(`${scope}: agent execution needs supported automation evidence`)
  }
}
