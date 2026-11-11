import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'vitest'

test('scheduled producer ordering, diagnostics and publication scope stay fail closed', () => {
  for (const file of ['refresh_producer_controller.py', 'refresh_policy_controller.py']) {
    execFileSync('python3', [path.join(process.cwd(), 'rankings-engine/__tests__', file)], {
      cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
    })
  }
})
