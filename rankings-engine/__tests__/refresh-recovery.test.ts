import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'vitest'

test('explicit receipt recovery remains authenticated, replayed and fail closed', () => {
  execFileSync('python3', [path.join(process.cwd(), 'rankings-engine/__tests__/refresh_recovery_controller.py')], {
    cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
  })
})
