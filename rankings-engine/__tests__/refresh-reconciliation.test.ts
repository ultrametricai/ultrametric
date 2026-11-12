import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import type { Evidence, Story, Verdict } from '../../lib/schemas'
import { CELL_HASH_VERSION, PROMPT_VERSION, cellHash } from '../stages/judge'
import { migrateRetentionRoster, prepareRetainedRepair, reconcileRefresh, ReconciliationError } from '../refresh-reconciliation'

const story: Story = { id: 'story', title: 'Install dependencies', persona: 'developer', theme: 'core', group: 'core', weight: 2 }
const evidence: Evidence = { id: 'old', tier: 'claimed-docs', url: 'https://example.invalid/docs', excerpt: 'Install dependencies with the CLI.', fetchedAt: '2026-11-01T00:00:00Z' }
const old: Verdict = { productId: 'vendor', storyId: 'story', verdict: 'partial', quality: 5, confidence: 'high', rationale: 'missing for 10: independent corroboration', evidenceIds: ['old'], support: { subject: story.title, relation: 'direct', coverage: 'partial', citations: [{ evidenceId: 'old', quote: evidence.excerpt }] } }
const proposal: Verdict = { ...old, quality: 7, confidence: 'low', rationale: 'New wording; missing for 10: more documentation' }
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 }) })
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-reconciliation-')); roots.push(root)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  const write = (file: string, value: unknown) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n') }
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  const dir = 'open-rankings/test', cache = 'rankings-engine/cache/judge/test/vendor/story.json', ledger = 'rankings-engine/cache/refresh-retention/test/decisions.json'
  const save = (row = old, pack = [evidence], rubric = PROMPT_VERSION) => {
    write(`${dir}/evidence/vendor.json`, pack); write(`${dir}/verdicts.json`, [row])
    write(cache, { hash: cellHash(story, pack, rubric), keyVersion: CELL_HASH_VERSION, verdict: row, transport: 'mock' })
  }
  const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD') }
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture')
  write(`${dir}/products.json`, [{ id: 'vendor', name: 'Vendor', vendor: 'Vendor', type: 'commercial', urls: { site: 'https://example.invalid' } }])
  write(`${dir}/stories.json`, [story]); save()
  const baseline = commit()
  const run = (base = baseline) => reconcileRefresh({ arena: 'test', baseline: base, root })
  const blocked = () => { try { run(); throw new Error('Expected failure') } catch (error) { expect(error).toBeInstanceOf(ReconciliationError); return (error as ReconciliationError).report.blocked } }
  return { root, git, read, write, dir, cache, ledger, save, commit, baseline, run, blocked }
}

describe('scheduled refresh reconciliation', { timeout: 60000 }, () => {
  it.each([proposal, { ...proposal, verdict: 'full' as const, support: { ...old.support!, coverage: 'complete' as const } }])('retains the complete published row for unsupported quality/verdict rerolls', row => {
    const f = fixture(); f.save(row, [evidence, { ...evidence, id: 'unrelated', url: 'https://example.invalid/other' }])
    const raw = fs.readFileSync(path.join(f.root, f.cache), 'utf8')
    expect(f.run().retained).toEqual(['vendor:story'])
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([old])
    expect(fs.readFileSync(path.join(f.root, f.cache), 'utf8')).toBe(raw)
    expect(f.read(f.ledger).retained).toEqual([{ cell: 'vendor:story', origin: f.baseline, decisionBaseline: f.baseline }])
  })
  it('retains a quality increase when the new evidence is absent from structured support', () => {
    const f = fixture()
    const unrelated = { ...evidence, id: 'unrelated', url: 'https://example.invalid/other', excerpt: 'Account recovery requires a phone number.' }
    f.save({ ...proposal, evidenceIds: [...proposal.evidenceIds, unrelated.id] }, [evidence, unrelated])
    const raw = fs.readFileSync(path.join(f.root, f.cache), 'utf8')
    expect(f.run().retained).toEqual(['vendor:story'])
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([old])
    expect(fs.readFileSync(path.join(f.root, f.cache), 'utf8')).toBe(raw)
  })
  it('reassembles raw cache proposals on repeat runs and verifies retained baselines across commits', () => {
    const f = fixture(); const pack = [evidence, { ...evidence, id: 'other', url: 'https://example.invalid/other' }]
    f.save(proposal, pack); f.run()
    const ledger = f.read(f.ledger)
    f.write(`${f.dir}/verdicts.json`, [proposal]); f.run(); expect(f.read(f.ledger)).toEqual(ledger)
    const retainedBase = f.commit()
    f.save({ ...proposal, quality: 8 }, pack)
    expect(f.run(retainedBase).retained).toEqual(['vendor:story'])
    expect(f.read(f.ledger).retained[0].origin).toBe(f.baseline)
  })
  it('does not treat missing source digests or new labels as new support', () => {
    const f = fixture(); const added = { ...evidence, id: 'new', excerpt: 'A model paraphrase of the same capability.' }
    f.save({ ...proposal, evidenceIds: ['new'], support: { ...proposal.support!, citations: [{ evidenceId: 'new', quote: added.excerpt }] } }, [evidence, added])
    expect(f.run().retained).toEqual(['vendor:story'])
  })
  it.each(['changed', 'missing'])('blocks a retention when prior cited content is %s without verifying support loss', kind => {
    const f = fixture(); const changed = { ...evidence, id: kind === 'missing' ? 'renamed' : 'old', excerpt: 'Install dependencies with a different CLI.' }
    const row = { ...proposal, evidenceIds: [changed.id], support: { ...proposal.support!, citations: [{ evidenceId: changed.id, quote: changed.excerpt }] } }
    f.save(row, [changed]); const before = fs.readFileSync(path.join(f.root, `${f.dir}/verdicts.json`), 'utf8')
    expect(f.blocked()[0]).toMatchObject({ cell: 'vendor:story', reason: expect.stringContaining('Prior cited') })
    expect(fs.readFileSync(path.join(f.root, `${f.dir}/verdicts.json`), 'utf8')).toBe(before)
    expect(fs.existsSync(path.join(f.root, f.ledger))).toBe(false)
  })
  it.each(['url', 'digest'])('allows genuine new %s support', kind => {
    const f = fixture(); const initial = { ...evidence, sourceHash: 'a'.repeat(64) }
    f.save(old, [initial]); const baseline = f.commit()
    const added = { ...evidence, id: 'new', excerpt: 'Install dependencies with automated retries.', ...(kind === 'url' ? { url: 'https://example.invalid/new-docs' } : { sourceHash: 'b'.repeat(64) }) }
    const row = { ...proposal, evidenceIds: ['new'], support: { ...proposal.support!, citations: [{ evidenceId: 'new', quote: added.excerpt }] } }
    f.save(row, [added]); expect(f.run(baseline).accepted).toEqual(['vendor:story']); expect(f.read(`${f.dir}/verdicts.json`)).toEqual([row])
  })
  it('accepts verified loss-of-support downgrades but retains unsupported applicability changes', () => {
    const f = fixture(); const none: Verdict = { ...old, verdict: 'none', quality: 0, evidenceIds: [], support: { subject: story.title, relation: 'absent', coverage: 'none', citations: [] } }
    f.save(none, []); expect(f.run().accepted).toEqual(['vendor:story'])
    f.save({ ...none, verdict: 'na' }); expect(f.run().retained).toEqual(['vendor:story'])
    f.save({ ...none, verdict: 'na' }, []); expect(f.blocked()[0].cell).toBe('vendor:story')
  })
  it.each(['story', 'roster', 'rubric', 'subject'])('fails closed on %s mismatch', kind => {
    const f = fixture()
    if (kind === 'rubric') { f.save(old, [evidence], 'v5'); f.commit() }
    if (kind === 'subject') { f.save({ ...old, support: { ...old.support!, subject: 'Wrong story' } }); f.commit() }
    const baseline = f.git('rev-parse', 'HEAD'); f.save(proposal)
    if (kind === 'story') f.write(`${f.dir}/stories.json`, [{ ...story, title: 'Changed title' }])
    if (kind === 'roster') f.write(`${f.dir}/products.json`, f.read(`${f.dir}/products.json`).map((p: object) => ({ ...p, name: 'Changed vendor' })))
    expect(() => f.run(baseline)).toThrow(ReconciliationError)
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([proposal])
  })
  it.each(['identity', 'origin', 'cache', 'row'])('rejects tampered retained-baseline %s', kind => {
    const f = fixture(); f.save(proposal); f.run()
    const ledger = f.read(f.ledger)
    if (kind === 'identity') { ledger.identity = 'forged'; f.write(f.ledger, ledger) }
    if (kind === 'origin') { ledger.retained[0].origin = '0'.repeat(40); f.write(f.ledger, ledger) }
    if (kind === 'cache') f.write(f.cache, { ...f.read(f.cache), hash: 'forged' })
    if (kind === 'row') f.write(`${f.dir}/verdicts.json`, [{ ...old, rationale: 'Tampered missing for 10: other' }])
    const baseline = f.commit(); f.save({ ...proposal, quality: 8 })
    expect(() => f.run(baseline)).toThrow(ReconciliationError)
  })
  it('rejects a mismatching current raw cache and leaves all canonical files untouched', () => {
    const f = fixture(); f.save(proposal); f.write(f.cache, { ...f.read(f.cache), verdict: old })
    expect(f.blocked()[0].reason).toContain('raw judge cache')
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([proposal])
  })
  it('plans every cell before writing, even when an earlier cell can be retained', () => {
    const f = fixture(); const secondStory = { ...story, id: 'second' }; const second = { ...old, storyId: 'second' }
    f.write(`${f.dir}/stories.json`, [story, secondStory])
    f.write(`${f.dir}/verdicts.json`, [old, second])
    const secondCache = 'rankings-engine/cache/judge/test/vendor/second.json'
    f.write(secondCache, { hash: cellHash(secondStory, [evidence], PROMPT_VERSION), keyVersion: CELL_HASH_VERSION, verdict: second })
    const baseline = f.commit(); f.save(proposal)
    const broken = { ...second, quality: 9 }
    f.write(`${f.dir}/verdicts.json`, [proposal, broken])
    expect(() => f.run(baseline)).toThrow('vendor:second')
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([proposal, broken])
    expect(fs.existsSync(path.join(f.root, f.ledger))).toBe(false)
  })

  it('CLI emits a machine-readable report on success and blocked cells on failure', () => {
    const f = fixture(); const script = path.resolve(__dirname, '../scripts/reconcile-refresh.ts')
    const tsx = path.resolve(__dirname, '../../node_modules/tsx/dist/loader.mjs')
    const invoke = () => spawnSync(process.execPath, ['--import', tsx, script, '--category', 'test', '--baseline', f.baseline, '--report', 'diagnostics/report.json'], { cwd: f.root, encoding: 'utf8' })
    f.save(proposal); expect(invoke().status).toBe(0)
    expect(f.read('diagnostics/report.json').retained).toEqual(['vendor:story'])
    f.save(proposal); f.write(f.cache, { ...f.read(f.cache), hash: 'wrong' })
    expect(invoke().status).toBe(1)
    expect(f.read('diagnostics/report.json').blocked).toEqual([{ cell: 'vendor:story', reason: 'Proposal does not match current-input raw judge cache' }])
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([proposal])
  })

  it.each(['read-parent', 'ledger-parent', 'ledger-target', 'verdict-temp'])('rejects symlink %s paths before canonical writes', kind => {
    const f = fixture(); f.save(proposal)
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-link-target-')); roots.push(outside)
    const destination = path.join(outside, 'untouched')
    fs.writeFileSync(destination, 'sentinel')
    if (kind === 'read-parent') {
      const source = path.join(f.root, f.dir, 'evidence')
      fs.renameSync(source, path.join(outside, 'evidence'))
      fs.symlinkSync(path.join(outside, 'evidence'), source)
    }
    if (kind === 'ledger-parent') fs.symlinkSync(outside, path.join(f.root, 'rankings-engine/cache/refresh-retention'))
    if (kind === 'ledger-target') {
      fs.mkdirSync(path.dirname(path.join(f.root, f.ledger)), { recursive: true })
      fs.symlinkSync(destination, path.join(f.root, f.ledger))
    }
    if (kind === 'verdict-temp') fs.symlinkSync(destination, path.join(f.root, f.dir, 'verdicts.json.tmp'))
    expect(() => f.run()).toThrow(/regular file and directory parents/)
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([proposal])
    expect(fs.readFileSync(destination, 'utf8')).toBe('sentinel')
    if (kind !== 'ledger-target') expect(fs.existsSync(path.join(f.root, f.ledger))).toBe(false)
  })

  it('replays three committed refreshes against each decision baseline as proposals change known citations', () => {
    const f = fixture(); const b = { ...evidence, id: 'b', url: 'https://example.invalid/b', excerpt: 'Install dependencies using B.' }
    const pack = [evidence, b]
    f.save(proposal, pack); f.run(); const first = f.commit()
    const citingB = { ...proposal, quality: 8, evidenceIds: ['b'], support: { ...proposal.support!, citations: [{ evidenceId: 'b', quote: b.excerpt }] } }
    f.save(citingB, pack); expect(f.run(first).retained).toEqual(['vendor:story']); const second = f.commit()
    const raw = fs.readFileSync(path.join(f.root, f.cache), 'utf8')
    f.save(citingB, pack); expect(f.run(second).retained).toEqual(['vendor:story']); const third = f.commit()
    expect(f.read(f.ledger).retained).toEqual([{ cell: 'vendor:story', origin: f.baseline, decisionBaseline: second }])
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([old])
    expect(fs.readFileSync(path.join(f.root, f.cache), 'utf8')).toBe(raw)
    f.save(citingB, pack); expect(f.run(third).retained).toEqual(['vendor:story'])
  })

  it.each(['missing', 'malformed', 'unknown', 'nonancestor', 'wrong-evidence', 'wrong-row', 'wrong-catalog', 'lost-support'])('rejects %s decision baselines without canonical writes', kind => {
    const f = fixture(); const b = { ...evidence, id: 'b', url: 'https://example.invalid/b' }
    const pack = [evidence, b]
    f.save(proposal, pack); f.run(); const first = f.commit()
    const citingB = { ...proposal, quality: 8, evidenceIds: ['b'], support: { ...proposal.support!, citations: [{ evidenceId: 'b', quote: b.excerpt }] } }
    let forged = f.baseline
    if (['nonancestor', 'wrong-row', 'wrong-catalog', 'lost-support'].includes(kind)) {
      if (kind === 'wrong-row') f.write(`${f.dir}/verdicts.json`, [{ ...old, quality: 4 }])
      else if (kind === 'wrong-catalog') f.write(`${f.dir}/stories.json`, [{ ...story, title: 'Wrong story' }])
      else if (kind === 'lost-support') f.write(`${f.dir}/evidence/vendor.json`, [b])
      else f.write('branch-only.json', {})
      forged = f.commit()
      // The forged ancestor is in history, but the actual decision inputs are restored.
      // For the divergent-branch case it must not even be an ancestor of the ledger.
      if (kind === 'nonancestor') f.git('reset', '--hard', first)
      else f.git('checkout', first, '--', f.dir, f.cache, f.ledger)
    }
    f.save(citingB, pack); f.run(first)
    const ledger = f.read(f.ledger)
    if (kind === 'missing') delete ledger.retained[0].decisionBaseline
    else ledger.retained[0].decisionBaseline = kind === 'malformed' ? 'HEAD' : kind === 'unknown' ? '0'.repeat(40) : forged
    f.write(f.ledger, ledger); const baseline = f.commit(); f.save({ ...citingB, quality: 9 }, pack)
    const before = fs.readFileSync(path.join(f.root, `${f.dir}/verdicts.json`), 'utf8')
    expect(() => f.run(baseline)).toThrow(ReconciliationError)
    expect(fs.readFileSync(path.join(f.root, `${f.dir}/verdicts.json`), 'utf8')).toBe(before)
    expect(f.read(f.ledger)).toEqual(ledger)
  })

  it('rejects a decision baseline that names the retained baseline itself', () => {
    const f = fixture(); f.save(proposal); f.run(); const retained = f.commit()
    const ledger = f.read(f.ledger); ledger.retained[0].decisionBaseline = retained
    f.write(f.ledger, ledger); f.git('add', '.')
    // Git objects cannot naturally name their own SHA. A local replacement object
    // simulates this malformed history without mocking the provenance verifier.
    const tree = f.git('write-tree')
    const replacement = f.git('commit-tree', tree, '-p', f.baseline, '-m', 'self-referencing fixture')
    f.git('replace', retained, replacement); f.git('reset', '--hard', retained)
    f.save({ ...proposal, quality: 8 })
    expect(() => f.run(retained)).toThrow('Decision baseline must be a proper ancestor')
    expect(f.read(`${f.dir}/verdicts.json`)).toEqual([{ ...proposal, quality: 8 }])
  })

  it('accepts a checkout root reached through a symlinked prefix', () => {
    // macOS tmpdirs live under the /var -> /private/var symlink; a checkout's location
    // must not trip the regular-path guard, only symlinks inside the repo may.
    const f = fixture(); f.save(proposal)
    const alias = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-reconciliation-alias-')); roots.push(alias)
    const link = path.join(alias, 'repo')
    fs.symlinkSync(f.root, link)
    expect(reconcileRefresh({ arena: 'test', baseline: f.baseline, root: link }).retained).toEqual(['vendor:story'])
  })

  it('rejects a symlinked component inside the repo-relative path', () => {
    const f = fixture(); f.save(proposal)
    const real = path.join(f.root, 'open-rankings/test/verdicts.json')
    const aside = path.join(f.root, 'open-rankings/test/verdicts.real.json')
    fs.renameSync(real, aside); fs.symlinkSync(aside, real)
    const blocked = f.blocked()
    expect(String(blocked[0].reason)).toContain('Expected regular file and directory parents')
  })

})


describe('authenticated retention roster migration', { timeout: 60000 }, () => {
  function migrationFixture() {
    const f = fixture()
    f.save(proposal); f.run()
    const baseline = f.commit()
    const originalProducts = f.read(`${f.dir}/products.json`)
    const added = { ...originalProducts[0], id: 'added', name: 'Added' }
    const addedRow = { ...old, productId: 'added' }
    const addedCache = 'rankings-engine/cache/judge/test/added/story.json'
    // Inserting a reviewed product before an existing one preserves its relative order.
    f.write(`${f.dir}/products.json`, [added, ...originalProducts])
    f.write(`${f.dir}/evidence/added.json`, [evidence])
    f.write(`${f.dir}/verdicts.json`, [addedRow, old])
    f.write(addedCache, { hash: cellHash(story, [evidence], PROMPT_VERSION), keyVersion: CELL_HASH_VERSION, verdict: addedRow, transport: 'mock' })
    const main = f.commit()
    const candidate = (file: string) => fs.existsSync(path.join(f.root, file)) ? fs.readFileSync(path.join(f.root, file), 'utf8') : null
    const migrate = (base = baseline, trusted = main) => migrateRetentionRoster({ arena: 'test', baseline: base, main: trusted, root: f.root })
    return { ...f, baseline, main, addedCache, candidate, migrate }
  }

  it('changes only the authenticated ledger identity and passes repair verification', () => {
    const f = migrationFixture(), before = f.read(f.ledger)
    expect(() => prepareRetainedRepair({ arena: 'test', main: f.main, root: f.root, candidate: f.candidate, targets: [] })).toThrow('identity mismatch')
    const result = f.migrate()
    expect(result.retained).toEqual(before.retained)
    expect(result.identity).not.toBe(before.identity)
    expect(f.git('diff', '--name-only')).toBe(f.ledger)
    expect(prepareRetainedRepair({ arena: 'test', main: f.main, root: f.root, candidate: f.candidate, targets: [] })!.cells).toEqual(new Set(['vendor:story']))
  })

  it('authenticates a sibling reviewed main branch after explicit integration', () => {
    const f = migrationFixture()
    const origin = f.read(f.ledger).retained[0].origin
    const tree = f.git('rev-parse', 'HEAD^{tree}')
    const main = f.git('commit-tree', tree, '-p', origin, '-m', 'reviewed roster branch')
    const integrated = f.git('commit-tree', tree, '-p', f.baseline, '-p', main, '-m', 'maintainer integration')
    f.git('reset', '--hard', integrated)
    f.migrate(f.baseline, main)
    expect(prepareRetainedRepair({ arena: 'test', main, root: f.root, candidate: f.candidate, targets: [] })!.cells).toEqual(new Set(['vendor:story']))
  })

  it.each(['origin', 'decisionBaseline', 'duplicate', 'orphan'])('rejects historically tampered %s provenance', kind => {
    const f = migrationFixture()
    f.git('reset', '--hard', f.baseline)
    const ledger = f.read(f.ledger)
    if (kind === 'duplicate') ledger.retained.push(ledger.retained[0])
    else if (kind === 'orphan') ledger.retained[0].cell = 'absent:story'
    else ledger.retained[0][kind] = '0'.repeat(40)
    f.write(f.ledger, ledger); const baseline = f.commit()
    expect(() => f.migrate(baseline, baseline)).toThrow()
    expect(f.git('status', '--porcelain')).toBe('')
  })

  it.each(['ledger', 'old-product', 'taxonomy', 'old-evidence', 'old-row', 'old-cache', 'new-product', 'new-evidence', 'new-row', 'new-cache'])('rejects %s tampering without writing', kind => {
    const f = migrationFixture()
    if (kind === 'ledger') f.write(f.ledger, { ...f.read(f.ledger), identity: 'forged' })
    if (kind === 'old-product' || kind === 'new-product') {
      const rows = f.read(`${f.dir}/products.json`)
      rows[kind === 'new-product' ? 0 : 1].name = 'Changed'
      f.write(`${f.dir}/products.json`, rows)
    }
    if (kind === 'taxonomy') f.write(`${f.dir}/stories.json`, [{ ...story, title: 'Changed' }])
    if (kind.endsWith('evidence')) f.write(`${f.dir}/evidence/${kind.startsWith('old') ? 'vendor' : 'added'}.json`, [{ ...evidence, fetchedAt: '2026-11-02T00:00:00Z' }])
    if (kind.endsWith('row')) {
      const rows = f.read(`${f.dir}/verdicts.json`)
      rows[kind.startsWith('new') ? 0 : 1].rationale = 'Changed rationale'
      f.write(`${f.dir}/verdicts.json`, rows)
    }
    if (kind.endsWith('cache')) {
      const file = kind.startsWith('old') ? f.cache : f.addedCache
      f.write(file, { ...f.read(file), transport: 'changed metadata' })
    }
    const before = f.git('diff'), ledger = f.candidate(f.ledger)
    expect(() => f.migrate()).toThrow()
    expect(f.git('diff')).toBe(before)
    expect(f.candidate(f.ledger)).toBe(ledger)
    expect(fs.existsSync(path.join(f.root, `${f.ledger}.tmp`))).toBe(false)
  })

  it.each(['baseline', 'main'])('rejects a nonancestor %s without writing', kind => {
    const f = migrationFixture()
    f.write('divergent.json', {}); const divergent = f.commit()
    f.git('reset', '--hard', f.main)
    expect(() => f.migrate(kind === 'baseline' ? divergent : f.baseline, kind === 'main' ? divergent : f.main)).toThrow()
    expect(f.git('status', '--porcelain')).toBe('')
  })

  it('rejects a historically forged ledger even when the current copy matches', () => {
    const f = migrationFixture()
    f.git('reset', '--hard', f.baseline)
    const forged = { ...f.read(f.ledger), identity: 'forged' }
    f.write(f.ledger, forged); const baseline = f.commit()
    expect(() => f.migrate(baseline, baseline)).toThrow('unchanged authenticated ledger')
    expect(f.git('status', '--porcelain')).toBe('')
  })

  it('rejects a symlinked temporary ledger before writing', () => {
    const f = migrationFixture(), outside = path.join(f.root, 'sentinel')
    fs.writeFileSync(outside, 'unchanged')
    fs.symlinkSync(outside, path.join(f.root, `${f.ledger}.tmp`))
    const before = f.candidate(f.ledger)
    expect(() => f.migrate()).toThrow('regular file and directory parents')
    expect(f.candidate(f.ledger)).toBe(before)
    expect(fs.readFileSync(outside, 'utf8')).toBe('unchanged')
  })
})
