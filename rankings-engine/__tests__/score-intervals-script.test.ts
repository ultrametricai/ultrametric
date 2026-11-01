import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const script = path.join(repoRoot, 'rankings-engine', 'scripts', 'compute-confidence-intervals.ts')
const categories = ['meeting-ai', 'virtual-mailboxes'] as const
const triggerCategory = categories[0]
const nonTriggerCategory = categories[1]

function makeFixture(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'um-score-intervals-'))
  const allCategories = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'open-rankings', 'categories.json'), 'utf8'),
  ) as Array<{ id: string }>
  fs.writeFileSync(
    path.join(dataDir, 'categories.json'),
    `${JSON.stringify(allCategories.filter((category) => categories.includes(category.id as typeof categories[number])), null, 2)}\n`,
  )

  for (const category of categories) {
    const source = path.join(repoRoot, 'open-rankings', category)
    const destination = path.join(dataDir, category)
    fs.mkdirSync(destination)
    for (const file of ['products.json', 'stories.json', 'verdicts.json', 'rankings.json']) {
      fs.copyFileSync(path.join(source, file), path.join(destination, file))
    }
    const uncertainty = path.join(source, 'uncertainty.json')
    if (fs.existsSync(uncertainty)) {
      fs.copyFileSync(uncertainty, path.join(destination, 'uncertainty.json'))
    }
    // A category-only implementation would leave this stale sentinel in the non-trigger arena.
    fs.writeFileSync(path.join(destination, 'score-intervals.json'), '[]\n')
  }
  return dataDir
}

function run(dataDir: string, args: string[]): void {
  execFileSync(process.execPath, [tsxCli, script, ...args], {
    cwd: repoRoot,
    env: { ...process.env, UM_DATA_DIR: dataDir },
    stdio: 'pipe',
  })
}

function intervalBytes(dataDir: string, category: string): string {
  return fs.readFileSync(path.join(dataDir, category, 'score-intervals.json'), 'utf8')
}

describe('compute-confidence-intervals script', () => {
  const tmpDirs: string[] = []

  afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true })
    tmpDirs.length = 0
  })

  it('keeps fleet artifacts identical when invoked by a category refresh', () => {
    const categoryRefresh = makeFixture()
    const fullRefresh = makeFixture()
    tmpDirs.push(categoryRefresh, fullRefresh)

    run(categoryRefresh, ['--category', triggerCategory])
    run(fullRefresh, [])

    for (const category of categories) {
      expect(intervalBytes(categoryRefresh, category)).toBe(intervalBytes(fullRefresh, category))
    }
    const nonTriggerEntries = JSON.parse(intervalBytes(categoryRefresh, nonTriggerCategory)) as unknown[]
    const nonTriggerProducts = JSON.parse(
      fs.readFileSync(path.join(categoryRefresh, nonTriggerCategory, 'products.json'), 'utf8'),
    ) as unknown[]
    expect(nonTriggerEntries).toHaveLength(nonTriggerProducts.length)
  })

  it('rejects an unknown category trigger before rewriting any fleet artifact', () => {
    const dataDir = makeFixture()
    tmpDirs.push(dataDir)

    expect(() => run(dataDir, ['--category', 'not-a-real-arena'])).toThrow()
    for (const category of categories) {
      expect(intervalBytes(dataDir, category)).toBe('[]\n')
    }
  })
})
