import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { llmJson } from '../llm'
import { createHash } from 'node:crypto'
import { reconcileRefresh, prepareRetainedRepair } from '../refresh-reconciliation'
import { cellHash, CELL_HASH_VERSION, PROMPT_VERSION, validateVerdictRules } from '../stages/judge'
vi.mock('../stages/derive', () => ({ runDerive: vi.fn(async () => {}) }))
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execFileSync: vi.fn((command: string, args: string[], options: object) =>
    command === 'pnpm' ? Buffer.alloc(0) : actual.execFileSync(command, args, options)) }
})
vi.mock('../llm', async importOriginal => ({ ...await importOriginal<typeof import('../llm')>(), llmJson: vi.fn() }))
import { allowed, mergeData, projection, restoreChurn, rowAtLine, rekeyEvidence, remapVerdictEvidence, sourceCacheMatches, judgeRepairCell, repair, repairProgress } from '../refresh-repair'
import type { Evidence, Verdict, Story } from '../../lib/schemas'
import { parseSloHistoryJsonl, summarizeSlo, type SloEntry } from '../../lib/slo'
const old: Verdict = { productId: 'vendor', storyId: 'story', verdict: 'partial', quality: 5, confidence: 'high', rationale: 'missing for 10: callback documentation', evidenceIds: ['old'] }
const evidence = (id: string): Evidence => ({ id, tier: 'claimed-docs', url: `https://example.invalid/docs/${id}`, excerpt: 'Documented behavior', fetchedAt: '2026-10-30T00:00:00Z' })
describe('refresh repair policy', () => {
  it('rejects the #567 no-op repairs even if evidence timestamps or order change', () => {
    const packs = { vendor: [evidence('old'), evidence('second')] }
    const later = { vendor: [...packs.vendor].reverse().map(row => ({ ...row, fetchedAt: '2026-11-03T00:00:00Z' })) }
    expect(repairProgress([old], [old], packs, later)).toBe(false)
    expect(repairProgress([old], [{ ...old, quality: 4 }], packs, later)).toBe(true)
    expect(repairProgress([old], [old], packs, { vendor: [{ ...evidence('old'), excerpt: 'corrected source' }] })).toBe(true)
  })
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
    expect(projection('open-rankings/payments/score-intervals.json', 'email')).toBe(true)
    expect(allowed('open-rankings/payments/score-intervals.json', 'email')).toBe(true)
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
  it('unions original uptime batches regardless of chronology without rewriting main', () => {
    const line = (date: string, up = true) => JSON.stringify({ date, arena: 'email', productId: 'vendor', surface: 'mcp', url: 'https://example.invalid', up, status: up ? 200 : 503 } satisfies SloEntry) + '\n'
    const a = line('2026-10-01'), b = line('2026-10-02', false), c = line('2026-10-03'), d = line('2026-10-04')
    const file = 'open-rankings/slo-history.jsonl'
    const main = a + c + d + '\n'
    for (const proposed of [a + b + c, a + c + b]) {
      const result = mergeData(a + c, main, proposed, file)!
      expect(result).toBe(main + b)
      expect(summarizeSlo(parseSloHistoryJsonl(result))).toEqual(summarizeSlo(parseSloHistoryJsonl(a + b + c + d)))
    }
    expect(mergeData(a, a + b, a + b, file)).toBe(a + b)
    expect(mergeData(a + a, a + a + b, a + a + c, file)).toBe(a + a + b + c)
    for (const [current, proposed] of [[b, a + c], [a, ''], [a, null], [a, a.replace('200', '201')], [null, a], [a, '{bad}']]) {
      expect(() => mergeData(a, current, proposed, file)).toThrow()
    }
    expect(() => mergeData(a + a, a, a + a + b, file)).toThrow(/removed or rewritten/)
  })
  it('allows immutable shard additions and identical ingestion, rejecting modifications and deletions', () => {
    const file = 'open-rankings/slo-history/2026-10-01-unique.jsonl'
    const row = JSON.stringify({ date: '2026-10-01', arena: 'email', productId: 'vendor', surface: 'mcp', url: 'https://example.invalid', up: true, status: 200 }) + '\n'
    expect(allowed(file, 'email')).toBe(true)
    expect(projection(file, 'email')).toBe(false)
    for (const bad of ['open-rankings/slo-history/run.ts', 'open-rankings/slo-history/sub/run.jsonl', 'open-rankings/slo-history/../run.jsonl']) expect(allowed(bad, 'email')).toBe(false)
    expect(mergeData(null, null, row, file)).toBe(row)
    expect(mergeData(null, row, row, file)).toBe(row)
    expect(mergeData(row, row, row, file)).toBe(row)
    for (const [base, current, proposed] of [[row, row, null], [row, null, row], [row, row, row + '\n'], [row, row + '\n', row], [null, row, row + '\n'], [null, null, '{bad}']]) {
      expect(() => mergeData(base, current, proposed, file)).toThrow()
    }
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
  it('keeps structured quotations valid when repair renames evidence and migrates its cache', () => {
    const baseline = evidence('old')
    const proposed = { ...baseline, id: 'renumbered' }
    const normalized = rekeyEvidence([baseline], [proposed])
    const row: Verdict = { ...old, evidenceIds: [proposed.id], support: {
      subject: story.title, relation: 'direct', coverage: 'partial',
      citations: [{ evidenceId: proposed.id, quote: proposed.excerpt }],
    } }
    const cache = { hash: cellHash(story, [proposed], PROMPT_VERSION), keyVersion: CELL_HASH_VERSION, verdict: row }
    expect(sourceCacheMatches(cache, row, story, [proposed])).toBe(true)
    const remapped = remapVerdictEvidence(row, normalized.renamed)
    expect(validateVerdictRules(remapped, normalized.evidence, story)).toBeNull()
    expect(remapped.support?.citations).toEqual([{ evidenceId: baseline.id, quote: proposed.excerpt }])
    expect(row.support?.citations[0].evidenceId).toBe(proposed.id)
    expect(sourceCacheMatches({ ...cache, hash: cellHash(story, normalized.evidence, PROMPT_VERSION), verdict: remapped }, remapped, story, normalized.evidence)).toBe(true)
    expect(remapVerdictEvidence(old, {})).toEqual(old)
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
  it.each(['candidate', 'main'])('blocks retained decisions from %s before repair writes or paid reviewer audits', async source => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'um-retained-repair-'))
    const previous = process.cwd()
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim()
    const write = (file: string, value: unknown) => {
      const target = path.join(dir, file); fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n')
    }
    const fake = vi.mocked(llmJson); fake.mockReset()
    try {
      git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
      const rows = [old, { ...old, productId: 'other' }]
      write('open-rankings/fixture/verdicts.json', rows)
      write('open-rankings/fixture/evidence/vendor.json', [evidence('old')])
      write('rankings-engine/cache/judge/fixture/vendor/story.json', { verdict: source === 'main' ? { ...old, quality: 8 } : old })
      if (source === 'main') write('rankings-engine/cache/refresh-retention/fixture/decisions.json', { retained: ['vendor:story'] })
      git('add', '.'); git('commit', '-qm', 'trusted'); const main = git('rev-parse', 'HEAD')
      if (source === 'candidate') {
        write('rankings-engine/cache/judge/fixture/vendor/story.json', { verdict: { ...old, quality: 8 } })
        write('rankings-engine/cache/refresh-retention/fixture/decisions.json', { retained: ['vendor:story'] })
      } else write('open-rankings/fixture/evidence/vendor.json', [evidence('old'), evidence('new')])
      git('add', '.'); git('commit', '-qm', 'proposed'); const head = git('rev-parse', 'HEAD')
      git('checkout', '--detach', main)
      const line = JSON.stringify(rows, null, 2).split('\n').findIndex(text => text.includes('"other"')) + 1
      process.chdir(dir)
      await expect(repair({ head, main, arena: 'fixture', keyed: true, findings: [{
        id: 'other-finding', path: 'open-rankings/fixture/verdicts.json', commit: head, line,
        body: 'Check this other product capability',
      }] })).rejects.toThrow()
      expect(fake).not.toHaveBeenCalled()
      expect(git('status', '--porcelain')).toBe('')
    } finally { process.chdir(previous); fs.rmSync(dir, { recursive: true, force: true }) }
  })

  for (const kind of ['code', 'symlink', 'unsupported-finding', 'slo-conflict']) it(`rejects ${kind} changes before executing PR code or writing repairs`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'um-repair-guard-'))
    const previous = process.cwd()
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim()
    try {
      git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
      fs.mkdirSync(path.join(dir, 'open-rankings/fixture/evidence'), { recursive: true })
      const file = path.join(dir, 'open-rankings/fixture/evidence/vendor.json')
      fs.writeFileSync(file, '[]\n')
      const observation = { date: '2026-10-01', arena: 'fixture', productId: 'vendor', surface: 'mcp', url: 'https://example.invalid', up: true, status: 200 }
      fs.writeFileSync(path.join(dir, 'open-rankings/slo-history.jsonl'), JSON.stringify(observation) + '\n')
      git('add', '.'); git('commit', '-m', 'trusted')
      const main = git('rev-parse', 'HEAD')
      if (kind === 'code') fs.writeFileSync(path.join(dir, 'package.json'), '{"scripts":{"test":"untrusted"}}')
      else if (kind === 'symlink') { fs.unlinkSync(file); fs.symlinkSync('/tmp/untrusted-target', file) }
      else if (kind === 'slo-conflict') {
        fs.mkdirSync(path.join(dir, 'open-rankings/slo-history'))
        fs.writeFileSync(path.join(dir, 'open-rankings/slo-history/new-run.jsonl'), JSON.stringify({ ...observation, up: false, status: 503 }) + '\n')
      }
      else fs.writeFileSync(file, '[{}]\n')
      git('add', '-A'); git('commit', '-m', 'proposed')
      const head = git('rev-parse', 'HEAD'); git('checkout', '--detach', main)
      process.chdir(dir)
      const findings = kind === 'unsupported-finding'
        ? [{ id: '567-claims', path: 'open-rankings/fixture/claims/vendor.json', commit: head, line: 2, body: 'FAQ questions are not capability claims' }] : []
      await expect(repair({ head, main, arena: 'fixture', findings, keyed: false })).rejects.toThrow(
        kind === 'code' ? 'outside its arena' : kind === 'symlink' ? 'regular data file' : kind === 'slo-conflict' ? 'Conflicting SLO observation' : 'Unsupported repair finding')
      expect(git('status', '--porcelain')).toBe('')
    } finally { process.chdir(previous); fs.rmSync(dir, { recursive: true, force: true }) }
  })
})

// Fictional Git fixtures exercise the full repair path. Model replies and derived
// projections are mocked; provenance verification and reconciliation run normally.
function retainedFixture(count = 2, sameProduct = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'um-retained-repair-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  const dir = 'open-rankings/fixture', ledgerPath = 'rankings-engine/cache/refresh-retention/fixture/decisions.json'
  const cachePath = (productId: string, storyId = 'story') => `rankings-engine/cache/judge/fixture/${productId}/${storyId}.json`
  const write = (file: string, value: unknown) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n') }
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD') }
  const ids = [...Array.from({ length: count }, (_, i) => `retained-${i}`), 'target-a', 'target-b']
  const products = (sameProduct ? ['vendor'] : ids).map(id => ({
    id, name: id, vendor: id, type: 'commercial', urls: { site: 'https://example.invalid' },
  }))
  const stories = sameProduct ? ids.map(id => ({ ...story, id })) : [story]
  const cells = sameProduct ? ids.map(storyId => ({ productId: 'vendor', storyId })) : ids.map(productId => ({ productId, storyId: 'story' }))
  const supported = (productId: string, id: string, quality: number, storyId = 'story'): Verdict => ({ ...old, productId, storyId, quality, evidenceIds: [id], support: {
    subject: story.title, relation: 'direct', coverage: 'partial', citations: [{ evidenceId: id, quote: evidence(id).excerpt }],
  } })
  const cache = (row: Verdict) => write(cachePath(row.productId, row.storyId), {
    hash: cellHash(stories.find(item => item.id === row.storyId)!, read(`${dir}/evidence/${row.productId}.json`), PROMPT_VERSION), keyVersion: CELL_HASH_VERSION,
    verdict: row, transport: 'offline-fixture',
  })
  git('init', '-qb', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
  write(`${dir}/products.json`, products); write(`${dir}/stories.json`, stories)
  const baselineRows = cells.map(cell => supported(cell.productId, 'old', 5, cell.storyId))
  for (const row of baselineRows) { write(`${dir}/evidence/${row.productId}.json`, [evidence('old')]); cache(row) }
  write(`${dir}/verdicts.json`, baselineRows); const main = commit()
  const isTarget = (cell: { productId: string; storyId: string }) => (sameProduct ? cell.storyId : cell.productId).startsWith('target-')
  for (const cell of cells.filter(isTarget)) write(`${dir}/evidence/${cell.productId}.json`, [evidence('old'), evidence('new')])
  const proposals = cells.map(cell => {
    const row = supported(cell.productId, isTarget(cell) ? 'new' : 'old', 7, cell.storyId); cache(row); return row
  })
  write(`${dir}/verdicts.json`, proposals)
  reconcileRefresh({ arena: 'fixture', baseline: main, root })
  const refreshIdentity = () => {
    const rows: Verdict[] = read(`${dir}/verdicts.json`)
    const snapshot = { products: read(`${dir}/products.json`), stories: read(`${dir}/stories.json`), rows,
      packs: Object.fromEntries(products.map(p => [p.id, read(`${dir}/evidence/${p.id}.json`)])),
      caches: Object.fromEntries(rows.map(row => [`${row.productId}:${row.storyId}`, read(cachePath(row.productId, row.storyId))])),
    }
    write(ledgerPath, { ...read(ledgerPath), identity: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') })
  }
  const finding = (head: string, productId = 'target-a') => ({ id: productId, path: `${dir}/verdicts.json`, commit: head,
    line: git('show', `${head}:${dir}/verdicts.json`).split('\n').findIndex(line => line.includes(`"${productId}"`)) + 1,
    body: 'Check this fictional capability against its cited evidence.',
  })
  return { root, git, dir, ledgerPath, cachePath, write, read, commit, main, products, supported, cache, refreshIdentity, finding }
}

describe('provenance-aware retained repair', { timeout: 60000 }, () => {
  it('updates an unreviewed stale refresh onto trusted main without changing canonical evidence or verdicts', async () => {
    const f = retainedFixture(), previous = process.cwd(), fake = vi.mocked(llmJson); fake.mockReset()
    try {
      f.write('open-rankings/predictions.json', [{ id: 'fictional-pr-prediction' }])
      const head = f.commit()
      const rows = f.read(`${f.dir}/verdicts.json`)
      const packs = f.products.map(product => [product.id, f.read(`${f.dir}/evidence/${product.id}.json`)])
      f.git('checkout', '--detach', f.main)
      f.write('open-rankings/predictions.json', [{ id: 'fictional-new-main-prediction' }])
      const main = f.commit(); process.chdir(f.root)
      const report = await repair({ head, main, arena: 'fixture', keyed: false, findings: [] })
      expect(report.mode).toBe('base-update')
      expect(report.rejudged).toEqual([]); expect(report.audits).toEqual([])
      expect(fake).not.toHaveBeenCalled()
      expect(f.read(`${f.dir}/verdicts.json`)).toEqual(rows)
      for (const [id, pack] of packs) expect(f.read(`${f.dir}/evidence/${id}.json`)).toEqual(pack)
    } finally { process.chdir(previous); fs.rmSync(f.root, { recursive: true, force: true }) }
  })

  it('does not count a main update as addressing an unchanged review finding', async () => {
    const f = retainedFixture(), previous = process.cwd(), fake = vi.mocked(llmJson); fake.mockReset()
    try {
      const head = f.commit()
      f.git('checkout', '--detach', f.main)
      f.write('open-rankings/predictions.json', [{ id: 'fictional-new-main-prediction' }])
      const main = f.commit(); process.chdir(f.root)
      fake.mockResolvedValueOnce({ addressed: true, reason: 'No canonical correction', evidenceIds: ['new'] })
      await expect(repair({ head, main, arena: 'fixture', keyed: true, findings: [f.finding(head)] }))
        .rejects.toThrow('no canonical arena change')
    } finally { process.chdir(previous); fs.rmSync(f.root, { recursive: true, force: true }) }
  })

  it('repairs two ordinary cells beside 49 retained cells, then supports a repeat repair and the next producer refresh', async () => {
    const f = retainedFixture(49), previous = process.cwd(), fake = vi.mocked(llmJson); fake.mockReset()
    try {
      const head = f.commit(), ledger = f.read(f.ledgerPath)
      const rawBytes = f.products.filter(p => p.id.startsWith('retained-')).map(p => [p.id, fs.readFileSync(path.join(f.root, f.cachePath(p.id)), 'utf8')])
      const retainedRows = f.read(`${f.dir}/verdicts.json`).filter((row: Verdict) => row.productId.startsWith('retained-'))
      f.git('checkout', '--detach', f.main); process.chdir(f.root)
      for (const product of ['target-a', 'target-b']) fake.mockResolvedValueOnce({ addressed: false, reason: 'Fixture concern', evidenceIds: ['new'] })
        .mockResolvedValueOnce(f.supported(product, 'new', 6))
        .mockResolvedValueOnce({ addressed: true, reason: 'Fixture correction checked', evidenceIds: ['new'] })
      const report = await repair({ head, main: f.main, arena: 'fixture', keyed: true, findings: [f.finding(head), f.finding(head, 'target-b')] })
      expect(report.rejudged).toEqual(['target-a:story', 'target-b:story']); expect(fake).toHaveBeenCalledTimes(6)
      expect(f.read(`${f.dir}/verdicts.json`).filter((row: Verdict) => row.productId.startsWith('retained-'))).toEqual(retainedRows)
      for (const [product, bytes] of rawBytes) expect(fs.readFileSync(path.join(f.root, f.cachePath(product)), 'utf8')).toBe(bytes)
      expect(f.read(f.ledgerPath).retained).toEqual(ledger.retained)
      expect(f.read(f.ledgerPath).identity).not.toBe(ledger.identity)
      const repaired = f.commit(); fake.mockReset()
      await expect(repair({ head: repaired, main: repaired, arena: 'fixture', keyed: false, findings: [] })).rejects.toThrow('no canonical arena change')
      expect(fake).not.toHaveBeenCalled(); expect(f.git('status', '--porcelain')).toBe('')
      const next = f.read(`${f.dir}/verdicts.json`).map((row: Verdict) => ({ ...row, quality: 8 }))
      for (const row of next) f.cache(row)
      f.write(`${f.dir}/verdicts.json`, next)
      const reportNext = reconcileRefresh({ arena: 'fixture', baseline: repaired, root: f.root })
      expect(reportNext.retained).toHaveLength(51)
      expect(f.read(f.ledgerPath).retained[0]).toEqual({ cell: 'retained-0:story', origin: f.main, decisionBaseline: repaired })
      expect(f.read(`${f.dir}/verdicts.json`).find((row: Verdict) => row.productId === 'target-a').quality).toBe(6)
    } finally { process.chdir(previous); fs.rmSync(f.root, { recursive: true, force: true }) }
  })

  it('repairs a different story in the same product without rewriting its retained raw cache', async () => {
    const f = retainedFixture(1, true), previous = process.cwd(), fake = vi.mocked(llmJson); fake.mockReset()
    try {
      const head = f.commit(), cacheFile = f.cachePath('vendor', 'retained-0')
      const raw = fs.readFileSync(path.join(f.root, cacheFile), 'utf8')
      f.git('checkout', '--detach', f.main); process.chdir(f.root)
      fake.mockResolvedValueOnce({ addressed: false, reason: 'Fixture concern', evidenceIds: ['new'] })
        .mockResolvedValueOnce(f.supported('vendor', 'new', 6, 'target-a'))
        .mockResolvedValueOnce({ addressed: true, reason: 'Fixture correction checked', evidenceIds: ['new'] })
      const report = await repair({ head, main: f.main, arena: 'fixture', keyed: true, findings: [f.finding(head)] })
      expect(report.rejudged).toEqual(['vendor:target-a'])
      expect(fs.readFileSync(path.join(f.root, cacheFile), 'utf8')).toBe(raw)
      expect(f.read(f.ledgerPath).retained).toEqual([{ cell: 'vendor:retained-0', origin: f.main, decisionBaseline: f.main }])
    } finally { process.chdir(previous); fs.rmSync(f.root, { recursive: true, force: true }) }
  })

  for (const kind of ['target', 'identity', 'origin', 'nonancestor', 'missing-entry', 'duplicate-entry', 'orphan-entry', 'missing-ledger', 'cache', 'support', 'normalization', 'main-drift', 'inherited-drift']) {
    it(`rejects ${kind} before writes or model calls`, async () => {
      const f = retainedFixture(), previous = process.cwd(), fake = vi.mocked(llmJson); fake.mockReset()
      try {
        let main = f.main
        if (kind === 'identity') f.write(f.ledgerPath, { ...f.read(f.ledgerPath), identity: 'forged' })
        if (kind === 'origin') {
          const ledger = f.read(f.ledgerPath); ledger.retained[0].origin = '0'.repeat(40); f.write(f.ledgerPath, ledger)
        }
        if (kind === 'nonancestor') {
          const foreign = f.commit(), ledger = f.read(f.ledgerPath)
          ledger.retained[0].decisionBaseline = foreign; f.write(f.ledgerPath, ledger)
        }
        if (kind.endsWith('-entry')) {
          const ledger = f.read(f.ledgerPath)
          if (kind === 'missing-entry') ledger.retained.shift()
          if (kind === 'duplicate-entry') ledger.retained.push(ledger.retained[0])
          if (kind === 'orphan-entry') ledger.retained.push({ ...ledger.retained[0], cell: 'target-a:story' })
          f.write(f.ledgerPath, ledger)
        }
        if (kind === 'missing-ledger') fs.rmSync(path.join(f.root, f.ledgerPath))
        if (kind === 'cache') {
          const file = f.cachePath('retained-0'); f.write(file, { ...f.read(file), hash: 'forged' }); f.refreshIdentity()
        }
        if (kind === 'support') {
          f.write(`${f.dir}/evidence/retained-0.json`, [{ ...evidence('old'), excerpt: 'Changed source' }]); f.refreshIdentity()
        }
        if (kind === 'normalization') {
          // An extra label for already-known content would be normalized away, changing
          // the raw cache input even though the retained citation itself is unchanged.
          const file = `${f.dir}/evidence/retained-0.json`
          f.write(file, [evidence('old'), { ...evidence('old'), id: 'alias' }])
          f.cache(f.read(f.cachePath('retained-0')).verdict); f.refreshIdentity()
        }
        if (kind === 'inherited-drift') main = f.commit()
        if (kind === 'inherited-drift') f.write(`${f.dir}/evidence/target-a.json`, [evidence('old')])
        const head = f.commit(); f.git('checkout', '--detach', main)
        if (kind === 'main-drift') {
          f.write(`${f.dir}/evidence/retained-0.json`, [evidence('old'), evidence('main-addition')]); main = f.commit()
        }
        process.chdir(f.root)
        await expect(repair({ head, main, arena: 'fixture', keyed: true,
          findings: [f.finding(head, kind === 'target' ? 'retained-0' : 'target-a')],
        })).rejects.toThrow()
        expect(fake).not.toHaveBeenCalled(); expect(f.git('status', '--porcelain')).toBe('')
      } finally { process.chdir(previous); fs.rmSync(f.root, { recursive: true, force: true }) }
    })
  }

  it('does not retag a newly restored ordinary row as raw model output', async () => {
    const f = retainedFixture(), previous = process.cwd(), fake = vi.mocked(llmJson); fake.mockReset()
    try {
      const head = f.commit(), raw = f.read(f.cachePath('target-b'))
      f.git('checkout', '--detach', f.main); process.chdir(f.root)
      fake.mockResolvedValueOnce({ addressed: false, reason: 'Fixture concern', evidenceIds: ['new'] })
        .mockResolvedValueOnce(f.supported('target-a', 'new', 6))
        .mockResolvedValueOnce({ addressed: true, reason: 'Fixture correction checked', evidenceIds: ['new'] })
        .mockResolvedValueOnce({ addressed: false, reason: 'Fixture concern', evidenceIds: ['old'] })
        .mockResolvedValueOnce(f.supported('target-b', 'old', 8))
        .mockResolvedValueOnce({ addressed: true, reason: 'Fixture restoration checked', evidenceIds: ['old'] })
      await expect(repair({ head, main: f.main, arena: 'fixture', keyed: true,
        findings: [f.finding(head), f.finding(head, 'target-b')],
      })).rejects.toThrow('Cell needs a scoped re-judge under the current rubric: target-b:story')
      expect(fake).toHaveBeenCalledTimes(6)
      expect(f.read(f.cachePath('target-b'))).toEqual(raw)
      expect(f.read(`${f.dir}/verdicts.json`).find((row: Verdict) => row.productId === 'target-b').quality).toBe(7)
    } finally { process.chdir(previous); fs.rmSync(f.root, { recursive: true, force: true }) }
  })

  it('rejects a post-plan retained cache rewrite before issuing a new ledger', () => {
    const f = retainedFixture()
    try {
      const candidate = (file: string) => fs.existsSync(path.join(f.root, file)) ? fs.readFileSync(path.join(f.root, file), 'utf8') : null
      const plan = prepareRetainedRepair({ arena: 'fixture', main: f.main, root: f.root, candidate, targets: ['target-a:story'] })!
      const rows: Verdict[] = f.read(`${f.dir}/verdicts.json`)
      const packs = Object.fromEntries(f.products.map(p => [p.id, f.read(`${f.dir}/evidence/${p.id}.json`)]))
      const caches = Object.fromEntries(rows.map(row => [`${row.productId}:${row.storyId}`, f.read(f.cachePath(row.productId))]))
      caches['retained-0:story'].verdict = rows[0]
      expect(() => plan.ledgerFor(rows, packs, caches)).toThrow('changed retained provenance')
    } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
  })
})
