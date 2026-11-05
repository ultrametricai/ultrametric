import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }))
vi.mock('../stages/judge', () => ({ cellHash: vi.fn(() => 'hash'), CELL_HASH_VERSION: 'v2' }))

const originalArgv = process.argv

afterEach(() => {
  process.argv = originalArgv
  vi.restoreAllMocks()
  vi.resetModules()
})

it.each([false, true])('uses lineage for same-day waves, preserving cache hits and later churn (clock skew: %s)', async (skew) => {
  const hashes = ['a', 'b', 'c', 'd'].map(c => c.repeat(40))
  const epoch = Date.parse('2026-09-20T12:00:00Z') / 1000
  const row = (storyId: string, verdict: string, rationale: string) => ({
    productId: 'vendor', storyId, verdict, quality: verdict === 'none' ? 0 : 5, rationale, evidenceIds: [],
  })
  const rows = [
    [row('later-wave', 'none', 'baseline'), row('cache-hit', 'none', 'baseline'), row('prior-wave', 'full', 'baseline')],
    [row('later-wave', 'full', 'churn'), row('cache-hit', 'full', 'churn'), row('prior-wave', 'full', 'baseline')],
    [row('later-wave', 'full', 'wave'), row('cache-hit', 'full', 'churn'), row('prior-wave', 'full', 'wave')],
    [row('later-wave', 'full', 'wave'), row('cache-hit', 'full', 'churn'), row('prior-wave', 'partial', 'later churn')],
  ]
  vi.mocked(execFileSync).mockImplementation((_file, args) => {
    const argv = args as string[]
    if (argv[0] === 'log' && argv.includes('--first-parent')) {
      return Buffer.from(hashes.map((hash, i) => `${hash}|${epoch + (skew && i === 2 ? -60 : i)}|step`).join('\n'))
    }
    if (argv[0] === 'log') return Buffer.from(argv[2].endsWith(hashes[2]) ? 'judge migration: fixture' : 'refresh')
    if (argv[0] === 'rev-parse') return Buffer.from(hashes[3])
    if (argv.includes('--format=%cI')) return Buffer.from('2026-09-20T12:00:03Z')
    if (argv[0] === 'show') {
      const [hash, path] = argv[1].split(':')
      if (path.endsWith('/verdicts.json')) return Buffer.from(JSON.stringify(rows[hashes.indexOf(hash)]))
      if (path.includes('/evidence/')) return Buffer.from('[]')
    }
    throw new Error(`Unexpected git call: ${argv.join(' ')}`)
  })
  vi.spyOn(fs, 'readdirSync').mockReturnValue([{ name: 'fixture', isDirectory: () => true }] as never)
  vi.spyOn(fs, 'existsSync').mockImplementation(path => String(path).endsWith('/verdicts.json'))
  vi.spyOn(fs, 'readFileSync').mockImplementation(path => {
    if (String(path).endsWith('/stories.json')) return JSON.stringify(rows[0].map(r => ({ id: r.storyId, title: r.storyId })))
    if (String(path).endsWith('/products.json')) return JSON.stringify([{ id: 'vendor' }])
    throw new Error(`Unexpected read: ${String(path)}`)
  })
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  process.argv = ['node', 'legacy-transitions-audit.ts']
  await import('../scripts/legacy-transitions-audit')
  const report = JSON.parse(String(stdout.mock.calls[0][0]))
  expect(report.standingWaveReconfirmed.total).toBe(1)
  expect(report.standingChurn.cells.map((cell: { storyId: string }) => cell.storyId).sort()).toEqual(['cache-hit', 'prior-wave'])
  expect(report.transitions.find((cell: { storyId: string }) => cell.storyId === 'later-wave').class).toBe('unsupported-churn:standing-wave-reconfirmed')
})
