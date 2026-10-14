import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../..')
const SCRIPT = path.join('pipeline', 'scripts', 'verify-provenance.ts')

function run(args: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync('pnpm', ['tsx', SCRIPT, ...args], { cwd: repoRoot, encoding: 'utf8' })
    return { status: 0, stdout }
  } catch (err) {
    const e = err as { status?: number; stdout?: string }
    return { status: e.status ?? 1, stdout: e.stdout ?? '' }
  }
}

describe('verify-provenance script', () => {
  let tmpFile: string | undefined

  afterEach(() => {
    if (tmpFile) fs.rmSync(tmpFile, { force: true })
    tmpFile = undefined
  })

  it('round-trips: a committed rankings.json verifies as VALID (exit 0)', () => {
    const result = run([path.join('open-rankings', 'desktop-os', 'rankings.json')])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('VALID')
  })

  it('flags a tampered copy as INVALID (exit 1)', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, 'open-rankings', 'desktop-os', 'rankings.json'), 'utf8'))
    raw.leaderboard[0].score = raw.leaderboard[0].score === 0 ? 1 : 0
    tmpFile = path.join(os.tmpdir(), `pa-tampered-${process.pid}.json`)
    fs.writeFileSync(tmpFile, JSON.stringify(raw))
    const result = run([tmpFile])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('INVALID')
  })
})
