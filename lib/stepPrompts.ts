import { z } from 'zod'

export const StepPromptsRetirementSchema = z.strictObject({
  schemaVersion: z.literal(1),
  status: z.literal('retired'),
  code: z.literal('STEP_PROMPTS_RETIRED'),
  message: z.string().min(1),
  guidance: z.literal('open-processes/catalog.json'),
})

export class StepPromptsRetiredError extends Error {
  readonly code = 'STEP_PROMPTS_RETIRED'
  constructor() {
    super('Public execution prompts are retired. Read open-processes/catalog.json for guidance; select private versioned instructions explicitly.')
    this.name = 'StepPromptsRetiredError'
  }
}

export function loadStepPrompts(): never {
  throw new StepPromptsRetiredError()
}

export function stepPromptFor(_taskId: string, _nodeId: string): never {
  throw new StepPromptsRetiredError()
}
