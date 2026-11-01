import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { llmJson } from '../llm'
import { cellHash, CELL_HASH_VERSION, PROMPT_VERSION } from '../stages/judge'
vi.mock('../llm', async importOriginal => ({ ...await importOriginal<typeof import('../llm')>(), llmJson: vi.fn() }))
import { allowed, mergeData, projection, restoreChurn, rowAtLine, rekeyEvidence, sourceCacheMatches, judgeRepairCell, repair } from '../refresh-repair'
import type { Evidence, Verdict, Story } from '../../lib/schemas'
const old: Verdict = { productId: 'vendor', storyId: 'story', verdict: 'partial', quality: 5, confidence: 'high', rationale: 'missing for 10: callback documentation', evidenceIds: ['old'] }
const evidence = (id: string): Evidence => ({ id, tier: 'claimed-docs', url: 'https://example.invalid/docs', excerpt: 'Documented behavior', fetchedAt: '2026-10-30T00:00:00Z' })
describe('refresh repair policy', () => {
  it('restores a previous judged cell for unsupported grade and quality churn', () => {
    const proposed = { ...old, verdict: 'full' as const, quality: 9 }
    const result = restoreChurn([old], [proposed], { vendor: [evidence('old')] }, { vendor: [evidence('old')] })
    expect(result.rows).toEqual([old]); expect(result.restored).toEqual(['vendor:story'])
  })
  it('preserves changed grades citing new evidence', () => {
    const proposed = { ...old, quality: 9, evidenceIds: ['new'] }
    expect(restoreChurn([old], [proposed], { vendor: [evidence('old')] }, { vendor: [evidence('new')] }).rows).toEqual([proposed])
  })
  it('blocks restoration when old citations disappeared', () => {
    const proposed = { ...old, quality: 9, evidenceIds: [] }
    const result = restoreChurn([old], [proposed], { vendor: [evidence('old')] }, { vendor: [] })
    expect(result.blocked).toEqual(['vendor:story']); expect(result.restored).toEqual([])
  })
  it('keeps a current-input downgrade instead of restoring an unsupported positive claim', () => {
    const none = { ...old, verdict: 'none' as const, quality: 0, evidenceIds: [] }
    const result = restoreChurn([old], [none], { vendor: [evidence('old')] }, { vendor: [] })
    expect(result.rows).toEqual([none]); expect(result.blocked).toEqual([]); expect(result.restored).toEqual([])
  })
  it('restricts writes to one arena, caches and declared projections', () => {
    expect(allowed('open-rankings/email/verdicts.json', 'email')).toBe(true)
    expect(allowed('rankings-engine/cache/judge/email/vendor/story.json', 'email')).toBe(true)
    for (const file of ['.github/workflows/ci.yml', 'package.json', 'open-rankings/email/../../lib/schemas.ts', 'open-rankings/email/evil.ts', 'open-rankings/payments/verdicts.json']) expect(allowed(file, 'email')).toBe(false)
    expect(projection('open-rankings/email/score-history.jsonl', 'email')).toBe(true)
    expect(projection('open-rankings/email/evidence/vendor.json', 'email')).toBe(false)
    expect(allowed('README.md', 'email')).toBe(true)
    expect(projection('README.md', 'email')).toBe(false)
    expect(() => mergeData('old prose', 'main edit', 'PR edit', 'README.md')).toThrow('Concurrent')
  })
  it('does not discard concurrent canonical edits', () => {
    expect(() => mergeData('old', 'new main', 'new PR', 'evidence.json')).toThrow('Concurrent source edits')
    expect(mergeData('old', 'old', 'new PR', 'evidence.json')).toBe('new PR')
    expect(mergeData('old', 'new main', 'old', 'evidence.json')).toBe('new main')
    expect(mergeData('old', 'old', null, 'evidence.json')).toBeNull()
  })
  it('unions append-only uptime while rejecting rewritten history', () => {
    expect(mergeData('a\n', 'a\nb\n', 'a\nc\n', 'open-rankings/slo-history.jsonl')).toBe('a\nb\nc\n')
    expect(() => mergeData('a\n', 'b\n', 'a\nc\n', 'open-rankings/slo-history.jsonl')).toThrow()
    expect(() => mergeData('a\n', 'a\n', '', 'open-rankings/slo-history.jsonl')).toThrow()
    expect(() => mergeData('a\n', 'a\n', null, 'open-rankings/slo-history.jsonl')).toThrow()
  })
  it('maps an inline review to the exact original cell', () => {
    const other = { ...old, storyId: 'other' }
    const text = JSON.stringify([old, other], null, 2)
    const line = text.split('\n').findIndex(line => line.includes('"other"')) + 1
    expect(rowAtLine(text, line)?.storyId).toBe('other')
    expect(rowAtLine(text, 1)).toBeNull()
    expect(() => rowAtLine(JSON.stringify([old]), 1)).toThrow('Cannot map')
  })
})

const story: Story = { id: 'story', title: 'Install dependencies', persona: 'developer', theme: 'core', group: 'core', weight: 2 }
describe('changed-source identities and scoped judging', () => {
  it('rekeys changed source content but leaves timestamps alone', () => {
    const before = evidence('old')
    expect(rekeyEvidence([before], [{ ...before, fetchedAt: '2026-10-31T00:00:00Z' }]).renamed).toEqual({})
    for (const changed of [{ ...before, excerpt: 'new fact' }, { ...before, tier: 'probe' as const }, { ...before, url: 'https://example.invalid/new' }]) {
      const result = rekeyEvidence([before], [changed])
      expect(result.renamed.old).toMatch(/^old-refresh-[a-f0-9]{16}$/)
      expect(result.evidence[0]).toEqual({ ...changed, id: result.renamed.old })
      expect(rekeyEvidence([before], result.evidence).renamed).toEqual({})
    }
  })
  it('keeps identities stable when the next extraction reuses its original labels', () => {
    const changed = { ...evidence('old'), excerpt: 'new fact' }
    const first = rekeyEvidence([evidence('old')], [changed])
    const next = rekeyEvidence(first.evidence, [changed])
    expect(next.evidence).toEqual(first.evidence)
    const mainVerdict = { ...old, evidenceIds: [first.evidence[0].id] }
    const noise = { ...mainVerdict, quality: 9 }
    expect(restoreChurn([mainVerdict], [noise], { vendor: first.evidence }, { vendor: next.evidence }).restored).toEqual(['vendor:story'])
  })
  it('preserves source identity when extraction renumbers or reorders known content', () => {
    const a = { ...evidence('a'), excerpt: 'first fact' }
    const b = { ...evidence('b'), excerpt: 'second fact' }
    const moved = rekeyEvidence([a,b], [{ ...b,id:'a' },{ ...a,id:'b' }])
    expect(moved.evidence).toEqual([b,a])
    expect(moved.renamed).toEqual({ a:'b', b:'a' })
    expect(rekeyEvidence([a], [{ ...a,id:'brand-new-label' }]).evidence).toEqual([a])
  })
  it('rejects duplicate identities and deterministic-name collisions', () => {
    expect(() => rekeyEvidence([], [evidence('a'), evidence('a')])).toThrow('Duplicate')
    const changed = { ...evidence('old'), excerpt: 'new fact' }
    const renamed = rekeyEvidence([evidence('old')], [changed]).evidence[0]
    expect(() => rekeyEvidence([evidence('old')], [changed, renamed])).toThrow('collision')
  })
  it('does not restore old claims whose source content changed under the same ID', () => {
    const result = restoreChurn([old], [{ ...old, quality: 9 }], { vendor: [evidence('old')] }, { vendor: [{ ...evidence('old'), excerpt: 'different fact' }] })
    expect(result.blocked).toEqual(['vendor:story']); expect(result.restored).toEqual([])
  })
  it('accepts only the exact source cache before an evidence-label migration', () => {
    const pack = [evidence('old')]
    const cache = { hash: cellHash(story, pack, PROMPT_VERSION), keyVersion: CELL_HASH_VERSION, verdict: old }
    expect(sourceCacheMatches(cache, old, story, pack)).toBe(true)
    expect(sourceCacheMatches({ ...cache, verdict: { ...old, quality: 9 } }, old, story, pack)).toBe(false)
    expect(sourceCacheMatches(cache, old, story, [{ ...pack[0], excerpt: 'changed' }])).toBe(false)
    expect(sourceCacheMatches({ ...cache, keyVersion: 'old' }, old, story, pack)).toBe(false)
  })
  it('corrects an invented model citation through the existing judge rules', async () => {
    const fake = vi.mocked(llmJson); fake.mockReset()
    fake.mockResolvedValueOnce({ ...old, evidenceIds: ['invented'] }).mockResolvedValueOnce(old)
    expect(await judgeRepairCell('vendor', 'Vendor', story, [evidence('old')], 'Diagnostic context')).toEqual(old)
    expect(fake).toHaveBeenCalledTimes(2)
    expect(fake.mock.calls[1][0].prompt).toContain('unknown evidence id')
  })
  it('stops after three invalid model responses', async () => {
    const fake = vi.mocked(llmJson); fake.mockReset(); fake.mockResolvedValue({ ...old, evidenceIds: ['invented'] })
    await expect(judgeRepairCell('vendor', 'Vendor', story, [evidence('old')], '')).rejects.toThrow('could not pass')
    expect(fake).toHaveBeenCalledTimes(3)
  })
})
describe('trusted-main Git boundary', () => {
  for (const kind of ['code', 'symlink']) it(`rejects ${kind} changes before executing PR code or writing repairs`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'um-repair-guard-'))
    const previous = process.cwd()
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim()
    try {
      git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
      fs.mkdirSync(path.join(dir, 'open-rankings/fixture/evidence'), { recursive: true })
      const file = path.join(dir, 'open-rankings/fixture/evidence/vendor.json')
      fs.writeFileSync(file, '[]\n'); git('add', '.'); git('commit', '-m', 'trusted')
      const main = git('rev-parse', 'HEAD')
      if (kind === 'code') fs.writeFileSync(path.join(dir, 'package.json'), '{"scripts":{"test":"untrusted"}}')
      else { fs.unlinkSync(file); fs.symlinkSync('/tmp/untrusted-target', file) }
      git('add', '-A'); git('commit', '-m', 'proposed')
      const head = git('rev-parse', 'HEAD'); git('checkout', '--detach', main)
      process.chdir(dir)
      await expect(repair({ head, main, arena: 'fixture', findings: [], keyed: false })).rejects.toThrow(kind === 'code' ? 'outside its arena' : 'regular data file')
      expect(git('status', '--porcelain')).toBe('')
    } finally { process.chdir(previous); fs.rmSync(dir, { recursive: true, force: true }) }
  })
})
