import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProductSchema } from '@/lib/schemas'
import { RankingsSchema } from '@/lib/schemas'

describe('derive stage', () => {
  let tmpDir: string | undefined

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = undefined
  })

  it('writes a valid rankings.json with one battle per product pair from the CLI', () => {
    const repoRoot = path.resolve(__dirname, '../..')
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-derive-'))
    fs.cpSync(path.join(repoRoot, 'open-rankings'), tmpDir, { recursive: true })

    // `run` is required: pnpm 12 ships a built-in `pipeline` command that shadows the
    // script in shorthand form.
    execFileSync('pnpm', ['run', 'pipeline', 'derive', '--category', 'desktop-os'], {
      cwd: repoRoot,
      env: { ...process.env, UM_DATA_DIR: tmpDir },
    })

    const productCount = ProductSchema.array().parse(
      JSON.parse(fs.readFileSync(path.join(tmpDir, 'desktop-os', 'products.json'), 'utf8')),
    ).length
    const expectedBattles = (productCount * (productCount - 1)) / 2

    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'desktop-os', 'rankings.json'), 'utf8'))
    const rankings = RankingsSchema.parse(raw)
    expect(rankings.battles).toHaveLength(expectedBattles)
    expect(rankings.leaderboard).toHaveLength(productCount)
    // buildRankings' actual sort key is aiEra desc (nulls last), tie-broken by score desc —
    // not raw score — since v2.4's Overall score. Assert every adjacent pair respects that.
    for (let i = 0; i < rankings.leaderboard.length - 1; i++) {
      const a = rankings.leaderboard[i]
      const b = rankings.leaderboard[i + 1]
      if (a.aiEra === null && b.aiEra === null) {
        expect(a.score).toBeGreaterThanOrEqual(b.score)
      } else if (a.aiEra === null) {
        throw new Error(`entry ${i} has null aiEra but entry ${i + 1} does not — nulls must sort last`)
      } else if (b.aiEra !== null) {
        expect(a.aiEra === b.aiEra ? a.score >= b.score : a.aiEra > b.aiEra).toBe(true)
      }
    }
  })
})
