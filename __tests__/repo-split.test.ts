import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Repo-split gates (docs/REPO-SPLIT-PLAN.md, Phase 0): the committed open-manifest.json and
// docs/repo-split-census.json must match the live git-tracked tree, so a file added, moved,
// or deleted without a manifest/census update fails CI instead of vanishing in the split.

const tracked = execFileSync('git', ['ls-files', '-z'], { maxBuffer: 1024 * 1024 * 512 })
  .toString('utf8').split('\0').filter(Boolean)

describe('open-manifest.json', () => {
  it('passes sync-open --check against the tracked tree (exit code 0)', () => {
    // execFileSync throws on a non-zero exit code; the gate is the exit code, not output.
    execFileSync(process.execPath, ['scripts/sync-open.mjs', '--check'])
  })

  it('partitions every entry into a known disposition with unique paths', () => {
    const manifest = JSON.parse(readFileSync('open-manifest.json', 'utf8'))
    const paths = manifest.entries.map((entry: { path: string }) => entry.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const entry of manifest.entries) {
      expect(['open', 'closed', 'both-during-migration']).toContain(entry.disposition)
      expect(['dir', 'file']).toContain(entry.type)
      if (entry.overlay) expect(entry.disposition).toBe('open')
    }
  })
})

describe('docs/repo-split-census.json', () => {
  const census = JSON.parse(readFileSync('docs/repo-split-census.json', 'utf8'))
  const liveTestFiles = tracked.filter(f => /\.test\.(ts|tsx|mjs)$/.test(f)).sort()

  it('lists exactly the live test files (file exists if and only if listed)', () => {
    const listed = [...census.open.files, ...census.closed.files].sort()
    expect(listed).toEqual(liveTestFiles)
  })

  it('open and closed counts sum to the total', () => {
    expect(census.open.count).toBe(census.open.files.length)
    expect(census.closed.count).toBe(census.closed.files.length)
    expect(census.open.count + census.closed.count).toBe(census.total)
    expect(census.total).toBe(liveTestFiles.length)
  })

  it('assigns each file the disposition of its suite (plan section 1 tests table)', () => {
    const openSet = new Set(census.open.files)
    const closedSet = new Set(census.closed.files)
    for (const file of liveTestFiles) {
      const open = file.startsWith('__tests__/') || file.startsWith('lib/') ||
        file.startsWith('pipeline/') || file === 'scripts/content-audit.test.mjs'
      expect(open ? openSet.has(file) : closedSet.has(file), `${file} disposition`).toBe(true)
    }
  })

  it('carries the node --test file explicitly (vitest glob blind spot)', () => {
    expect(census.nodeTestRunner.files).toContain('scripts/content-audit.test.mjs')
    expect(census.open.files).toContain('scripts/content-audit.test.mjs')
  })
})
