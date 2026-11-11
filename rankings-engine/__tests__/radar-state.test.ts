import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { createRadarRunId, importLegacyLedger, loadSeenEntries, mergeSeenEntries,
  sha256, writeDiscovery, writeImmutable, type DiscoveryRecord, type SeenEntry } from '../radar-state'
import { reconcileRadarState } from '../scripts/reconcile-radar-state'

const dirs: string[] = []
function temporary(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-state-'))
  dirs.push(dir)
  return dir
}
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })))
const entry = (key: string, firstSeen = '2026-11-03', sources = ['https://example.test/launch']): SeenEntry => ({ key, name: key, firstSeen, sources })
function discovery(root: string, runId: string, seen: SeenEntry[]): DiscoveryRecord {
  const reportPath = `reports/vendor-radar/runs/${runId}.json`
  const data = JSON.stringify({ candidates: seen }) + '\n'
  writeImmutable(path.join(root, reportPath), data)
  return { schemaVersion: 1, kind: 'scan', producer: 'vendor-radar', runId,
    generatedAt: '2026-11-03T00:00:00Z', report: { path: reportPath, sha256: sha256(data) }, seen }
}
function repository(): { root: string; git: (...args: string[]) => string } {
  const root = temporary()
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Radar fixture')
  git('config', 'user.email', 'radar@example.test')
  git('config', 'commit.gpgsign', 'false')
  git('commit', '--allow-empty', '-m', 'base')
  return { root, git }
}

describe('immutable discovery storage', () => {
  it('merges disjoint concurrent branches without touching the legacy ledger', () => {
    const { root, git } = repository()
    for (const [branch, key] of [['scan-a', 'a'], ['scan-b', 'b']]) {
      git('checkout', '-b', branch, 'main')
      writeDiscovery(discovery(root, branch, [entry(key)]), root)
      git('add', '.')
      git('commit', '-m', branch)
    }
    git('checkout', 'main')
    git('merge', '--no-edit', 'scan-a')
    git('merge', '--no-edit', 'scan-b')
    expect(loadSeenEntries(root).map((e) => e.key)).toEqual(['a', 'b'])
    expect(fs.existsSync(path.join(root, 'rankings-engine/radar-seen.json'))).toBe(false)
  })

  it('unions legacy and new entries deterministically, including tied names and duplicate sources', () => {
    const root = temporary()
    const old = { ...entry('a', '2026-11-01', ['z', 'a', 'z']), name: 'Zed' }
    const tied = { ...old, name: 'Able', sources: ['b'] }
    const later = entry('a', '2026-11-03', ['c'])
    const legacy = Buffer.from(JSON.stringify({ _comment: 'original metadata', updatedAt: 'unchanged', seen: [old] }))
    writeImmutable(path.join(root, 'rankings-engine/radar-seen.json'), legacy)
    importLegacyLedger(legacy, root)
    writeDiscovery(discovery(root, 'new-run', [tied, later]), root)
    const expected = [{ key: 'a', name: 'Able', firstSeen: '2026-11-01', sources: ['a', 'b', 'c', 'z'] }]
    expect(loadSeenEntries(root)).toEqual(expected)
    expect(mergeSeenEntries([[later, tied], [old]])).toEqual(expected)
    expect(fs.readFileSync(path.join(root, 'rankings-engine/radar-seen.json'))).toEqual(legacy)
  })

  it('gives same-day invocations distinct report identities and refuses overwrites', () => {
    const root = temporary()
    const now = new Date('2026-11-03T00:00:00Z')
    const a = createRadarRunId(now), b = createRadarRunId(now)
    expect(a).not.toBe(b)
    for (const id of [a, b]) writeDiscovery(discovery(root, id, [entry(id)]), root)
    expect(loadSeenEntries(root)).toHaveLength(2)
    expect(() => writeImmutable(path.join(root, `reports/vendor-radar/runs/${a}.json`), 'replacement')).toThrow(/immutable file conflict/)
  })

  it('requires intact report provenance for every candidate before suppressing a key', () => {
    const root = temporary()
    const record = discovery(root, 'run', [entry('a')])
    expect(() => writeDiscovery({ ...record, seen: [entry('absent')] }, root)).toThrow(/absent from/)
    writeDiscovery(record, root)
    fs.writeFileSync(path.join(root, record.report.path), '{"candidates":[]}')
    expect(() => loadSeenEntries(root)).toThrow(/report hash mismatch/)
    fs.rmSync(path.join(root, record.report.path))
    expect(() => loadSeenEntries(root)).toThrow()
  })

  it('rejects malformed records and damaged legacy imports', () => {
    const root = temporary()
    const { path: file } = importLegacyLedger(Buffer.from(JSON.stringify({ updatedAt: 'x', seen: [] })), root)
    fs.writeFileSync(path.join(root, file), '{}')
    expect(() => loadSeenEntries(root)).toThrow(/legacy snapshot hash mismatch/)
    expect(() => importLegacyLedger(Buffer.from('{'), root)).toThrow()
  })
})

describe('branch reconciliation', () => {
  it('records only newly retained files across successive branches and still rejects conflicts', () => {
    const { root, git } = repository()
    git('checkout', '-b', 'first-scan')
    const first = discovery(root, 'first-run', [entry('first')])
    writeDiscovery(first, root)
    writeImmutable(path.join(root, 'rankings-engine/radar-seen.json'), JSON.stringify({ updatedAt: 'old', seen: [entry('legacy')] }))
    writeImmutable(path.join(root, 'reports/vendor-radar/2026-11-01.json'), 'historical report')
    git('add', '.'); git('commit', '-m', 'first scan')
    git('checkout', 'main')
    reconcileRadarState(['first-scan'], root)
    const manifestDir = path.join(root, 'reports/radar-imports/manifests')
    const firstManifests = fs.readdirSync(manifestDir)
    expect(firstManifests).toHaveLength(1)
    git('add', '.'); git('commit', '-m', 'retain first scan')

    // A later tip on the old branch reuses both legacy snapshots and per-run files.
    git('checkout', 'first-scan')
    git('commit', '--allow-empty', '-m', 'unchanged older history')
    git('checkout', 'main')
    reconcileRadarState(['first-scan'], root)
    expect(fs.readdirSync(manifestDir)).toEqual(firstManifests)

    git('checkout', '-b', 'next-scan')
    const next = discovery(root, 'next-run', [entry('next')])
    writeDiscovery(next, root)
    git('add', '.'); git('commit', '-m', 'next scan inherits retained history')
    git('checkout', 'main')
    reconcileRadarState(['next-scan'], root)
    const added = fs.readdirSync(manifestDir).filter((name) => !firstManifests.includes(name))
    expect(added).toHaveLength(1)
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, added[0]), 'utf8'))
    expect(manifest.files.map((file: { source: string }) => file.source)).toEqual([
      'rankings-engine/radar-discoveries/vendor-radar-next-run-scan.json', next.report.path,
    ])
    expect(loadSeenEntries(root).map((e) => e.key)).toEqual(['first', 'legacy', 'next'])

    fs.writeFileSync(path.join(root, first.report.path), 'conflicting retained bytes')
    expect(() => reconcileRadarState(['next-scan'], root)).toThrow(/immutable file conflict/)
  })

  it('retains missing and conflicting legacy reports even when main already has every seen key', () => {
    const { root, git } = repository()
    const ledger = JSON.stringify({ updatedAt: 'x', seen: [entry('a')] })
    const report = 'reports/vendor-radar/2026-11-02.json'
    const triage = 'reports/vendor-radar/2026-11-02-triage.json'
    writeImmutable(path.join(root, 'rankings-engine/radar-seen.json'), ledger)
    writeImmutable(path.join(root, report), 'main report')
    git('add', '.'); git('commit', '-m', 'main ledger')
    git('checkout', '-b', 'old-scan')
    fs.writeFileSync(path.join(root, report), 'original report on branch')
    writeImmutable(path.join(root, triage), 'original approval on branch')
    git('add', '.'); git('commit', '-m', 'original scan')
    const commit = git('rev-parse', 'HEAD')
    git('checkout', 'main')
    reconcileRadarState(['old-scan'], root)
    const manifestDir = path.join(root, 'reports/radar-imports/manifests')
    const names = fs.readdirSync(manifestDir)
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, names[0]), 'utf8'))
    expect(manifest.sourceCommit).toBe(commit)
    expect(manifest.files.map((f: { source: string }) => f.source).sort()).toEqual([report, triage].sort())
    for (const f of manifest.files) expect(sha256(fs.readFileSync(path.join(root, f.retained)))).toBe(f.sha256)
    expect(fs.readFileSync(path.join(root, report), 'utf8')).toBe('main report')
    reconcileRadarState(['old-scan'], root)
    expect(fs.readdirSync(manifestDir)).toEqual(names)
    expect(fs.readFileSync(path.join(root, 'rankings-engine/radar-seen.json'), 'utf8')).toBe(ledger)
  })

  it('imports both producers records with their reports and retains legacy snapshot bytes', () => {
    const { root, git } = repository()
    git('checkout', '-b', 'vendor')
    writeDiscovery(discovery(root, 'vendor-run', [entry('new')]), root)
    const legacy = JSON.stringify({ updatedAt: 'old', seen: [entry('old')] })
    writeImmutable(path.join(root, 'rankings-engine/radar-seen.json'), legacy)
    git('add', '.'); git('commit', '-m', 'vendor')
    git('checkout', '-b', 'launch', 'main')
    const record = discovery(root, 'launch-run', [entry('launch:p:a')])
    const launchPath = 'reports/launch-watch/runs/launch-run.json'
    fs.mkdirSync(path.dirname(path.join(root, launchPath)), { recursive: true })
    fs.renameSync(path.join(root, record.report.path), path.join(root, launchPath))
    writeDiscovery({ ...record, producer: 'launch-watch', report: { ...record.report, path: launchPath } }, root)
    git('add', '.'); git('commit', '-m', 'launch')
    git('checkout', 'main')
    reconcileRadarState(['vendor', 'launch'], root)
    expect(loadSeenEntries(root).map((e) => e.key)).toEqual(['launch:p:a', 'new', 'old'])
    expect(fs.readFileSync(path.join(root, `rankings-engine/radar-discoveries/legacy/${sha256(legacy)}.json`), 'utf8')).toBe(legacy)
    expect(fs.existsSync(path.join(root, 'rankings-engine/radar-seen.json'))).toBe(false)
  })
})
