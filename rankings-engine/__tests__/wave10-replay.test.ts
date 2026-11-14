import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'vitest'

test('wave10 evidence replay validates the claimed schema association offline', () => {
  execFileSync('python3', [path.join(process.cwd(), 'rankings-engine/__tests__/wave10_replay.py')], {
    cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
  })
})
