import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadStepPrompts, stepPromptFor, StepPromptsRetirementSchema } from '../../lib/stepPrompts'

describe('public execution prompt retirement', () => {
  it('exports an explicit retirement contract instead of executable records', () => {
    const notice = JSON.parse(readFileSync('open-rankings/step-prompts.json', 'utf8'))
    expect(StepPromptsRetirementSchema.parse(notice).code).toBe('STEP_PROMPTS_RETIRED')
    expect(StepPromptsRetirementSchema.safeParse([{ taskId: 'synthetic', nodeId: 'n1', prompt: 'Create a resource' }]).success).toBe(false)
    expect(existsSync('rankings-engine/cache/step-prompts')).toBe(false)
  })

  it('fails explicitly for loaders, including unknown IDs', () => {
    for (const load of [loadStepPrompts, () => stepPromptFor('synthetic', 'n1')]) {
      expect(load).toThrow(expect.objectContaining({ code: 'STEP_PROMPTS_RETIRED' }))
    }
  })

  it('rejects generation and report commands without rewriting the export', () => {
    const file = 'open-rankings/step-prompts.json'
    const before = readFileSync(file, 'utf8')
    for (const args of [[], ['--report'], ['--task', 'synthetic']]) {
      expect(() => execFileSync(process.execPath, ['--import', 'tsx', path.resolve('rankings-engine/scripts/map-step-prompts.ts'), ...args], { stdio: 'pipe' }))
        .toThrow(/STEP_PROMPTS_RETIRED|StepPromptsRetiredError/)
    }
    expect(readFileSync(file, 'utf8')).toBe(before)
  })
})
