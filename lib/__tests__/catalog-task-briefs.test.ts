import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'vitest'

const root = path.resolve(__dirname, '../..')

describe('canonical task descriptions', () => {
  it('preserves reviewed descriptions, source URLs and current-main fields', () => {
    execFileSync('python3', ['scripts/shared-processes/check-task-briefs.py'], {
      cwd: root, encoding: 'utf8', stdio: 'pipe',
    })
  })

  it('runs portable assertions and rejects changes to the preservation contract', () => {
    execFileSync('python3', [
      'scripts/shared-processes/test_task_briefs.py', 'TaskBriefPreservationTests',
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  })
})
