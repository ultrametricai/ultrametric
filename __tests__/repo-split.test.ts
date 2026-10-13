import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// The open manifest classifies the live tracked tree; suite boundaries are checked
// directly so they do not depend on a historical census report.

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

  it('keeps the internal docs directory out of the public tree and overlay', () => {
    expect(tracked.filter(file => file.startsWith('docs/'))).toEqual([])
    const manifest = JSON.parse(readFileSync('open-manifest.json', 'utf8'))
    expect(manifest.entries.filter((entry: { path: string }) => entry.path === 'docs' || entry.path.startsWith('docs/'))).toEqual([])
  })
})

describe('open test suites', () => {
  const liveTestFiles = tracked.filter(f => /\.test\.(ts|tsx|mjs)$/.test(f)).sort()

  it('every tracked test file sits in an open suite', () => {
    expect(liveTestFiles.length).toBeGreaterThan(0)
    for (const file of liveTestFiles) {
      const open = file.startsWith('__tests__/') || file.startsWith('lib/') ||
        file.startsWith('pipeline/') || file === 'scripts/content-audit.test.mjs'
      expect(open, `${file} is outside the open suites`).toBe(true)
    }
  })

  it('runs the tracked node --test suite in CI (vitest glob blind spot)', () => {
    expect(liveTestFiles).toContain('scripts/content-audit.test.mjs')
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('node --test scripts/content-audit.test.mjs')
  })
})
