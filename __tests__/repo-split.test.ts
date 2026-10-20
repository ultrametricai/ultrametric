import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Boundary gates: the committed open-manifest.json and
// docs/repo-split-census.json must match the live git-tracked tree, so a file added, moved,
// or deleted without a manifest/census update fails CI instead of drifting silently.

const tracked = execFileSync('git', ['ls-files', '-z'], { maxBuffer: 1024 * 1024 * 512 })
  .toString('utf8').split('\0').filter(Boolean)

describe('open-manifest.json', () => {
  it('passes sync-open --check against the tracked tree (exit code 0)', () => {
    // execFileSync throws on a non-zero exit code; the gate is the exit code, not output.
    execFileSync(process.execPath, ['scripts/sync-open.mjs', '--check'])
  })

  it('lists only open entries with unique paths (the closed set left with the strip)', () => {
    const manifest = JSON.parse(readFileSync('open-manifest.json', 'utf8'))
    const paths = manifest.entries.map((entry: { path: string }) => entry.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const entry of manifest.entries) {
      expect(entry.disposition).toBe('open')
      expect(['dir', 'file']).toContain(entry.type)
    }
  })
})

describe('docs/repo-split-census.json', () => {
  const census = JSON.parse(readFileSync('docs/repo-split-census.json', 'utf8'))
  const liveTestFiles = tracked.filter(f => /\.test\.(ts|tsx|mjs)$/.test(f)).sort()

  it('lists exactly the live test files (file exists if and only if listed)', () => {
    expect([...census.open.files].sort()).toEqual(liveTestFiles)
  })

  it('count and total match the file list', () => {
    expect(census.open.count).toBe(census.open.files.length)
    expect(census.total).toBe(census.open.count)
    expect(census.total).toBe(liveTestFiles.length)
  })

  it('every test file sits in an open suite (plan section 1 tests table)', () => {
    for (const file of liveTestFiles) {
      const open = file.startsWith('__tests__/') || file.startsWith('lib/') ||
        file.startsWith('rankings-engine/') || file === 'scripts/content-audit.test.mjs'
      expect(open, `${file} is outside the open suites`).toBe(true)
    }
  })

  it('carries the node --test file explicitly (vitest glob blind spot)', () => {
    expect(census.nodeTestRunner.files).toContain('scripts/content-audit.test.mjs')
    expect(census.open.files).toContain('scripts/content-audit.test.mjs')
  })
})
