import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'vitest'

describe('canonical authored briefs', () => {
  it('keeps all nested briefs complete, distinct, and linked to valid sources', () => {
    execFileSync('python3', ['scripts/shared-processes/test_task_briefs.py'], {
      cwd: path.resolve(__dirname, '../..'), encoding: 'utf8', stdio: 'pipe',
    })
  })
})
