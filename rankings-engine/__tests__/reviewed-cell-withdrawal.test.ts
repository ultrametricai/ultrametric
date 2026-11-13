import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { type Evidence, type Story, type Verdict } from '../../lib/schemas'
import { CELL_HASH_VERSION, PROMPT_VERSION, cellHash } from '../stages/judge'
import { reconcileRefresh } from '../refresh-reconciliation'
import { planReviewedWithdrawal, verifyReviewedWithdrawal, type WithdrawalTrust } from '../reviewed-cell-withdrawal'
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
const digest = (v: unknown) => hash(JSON.stringify(v))
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })))
const arena = 'customer-data-platforms', dir = `open-rankings/${arena}`
const targets = ['hightouch:pii-field-controls', 'rudderstack:third-party-source-feeds']
const cache = (r: Verdict) => `rankings-engine/cache/judge/${arena}/${r.productId}/${r.storyId}.json`
const ledger = `rankings-engine/cache/refresh-retention/${arena}/decisions.json`
function fixture(retention = false, mutate?: (stage: 'baseline' | 'head', f: { write: (p: string, v: unknown) => void; read: typeof readJson; rows: Verdict[] }) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'withdrawal-')); roots.push(root)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  const write = (p: string, v: unknown) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), JSON.stringify(v, null, 2) + '\n') }
  const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
  const commit = () => { git('add', '.'); git('commit', '-qm', 'synthetic fixture'); return git('rev-parse', 'HEAD') }
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('remote', 'add', 'origin', 'https://example.invalid/fixture/repo.git')
  const products = ['hightouch', 'rudderstack'].map(id => ({ id, name: id, vendor: id, type: 'commercial', urls: { site: 'https://example.invalid' } }))
  const stories: Story[] = ['pii-field-controls', 'third-party-source-feeds'].map(id => ({ id, title: id, persona: 'developer', theme: 'core', group: 'core', weight: 2 }))
  const oldEvidence: Evidence = { id: 'old', tier: 'claimed-docs', url: 'https://example.invalid/old', excerpt: 'General settings.', fetchedAt: '2026-11-01T00:00:00Z' }
  const newEvidence = { ...oldEvidence, id: 'novel', url: 'https://example.invalid/new', excerpt: 'A distinct but irrelevant capability.' }
  const none = (productId: string, s: Story): Verdict => ({ productId, storyId: s.id, verdict: 'none', quality: 0, confidence: 'high', rationale: 'No support', evidenceIds: [], support: { subject: s.title, relation: 'absent', coverage: 'none', citations: [] } })
  const positive = (r: Verdict, e: Evidence): Verdict => ({ ...r, verdict: 'partial', quality: 3, rationale: 'missing for 10: relevant support', evidenceIds: [e.id], support: { subject: r.storyId, relation: 'direct', coverage: 'partial', citations: [{ evidenceId: e.id, quote: e.excerpt }] } })
  let rows = products.flatMap(p => stories.map(s => none(p.id, s)))
  if (retention) rows[1] = positive(rows[1], oldEvidence)
  const save = (pack: Evidence[]) => {
    write(`${dir}/verdicts.json`, rows)
    products.forEach(p => write(`${dir}/evidence/${p.id}.json`, pack))
    rows.forEach(r => write(cache(r), { hash: cellHash(stories.find(s => s.id === r.storyId)!, pack, PROMPT_VERSION), keyVersion: CELL_HASH_VERSION, verdict: r, transport: 'synthetic' }))
  }
  write(`rankings-engine/cache/story-tiers/${arena}/synthetic.json`, { tier: 'synthetic' });
  write(`${dir}/products.json`, products); write(`${dir}/stories.json`, stories); save([oldEvidence])
  mutate?.('baseline', { write, read, rows }); const baseline = commit()
  rows = rows.map(r => targets.includes(`${r.productId}:${r.storyId}`) ? positive(r, newEvidence) : r)
  if (retention) rows[1] = { ...rows[1], quality: 4 }
  save([oldEvidence, newEvidence])
  if (retention) reconcileRefresh({ arena, baseline, root })
  mutate?.('head', { write, read, rows }); const head = commit()
  const filesAt = (ref: string) => Object.fromEntries(git('ls-tree', '-r', '--name-only', ref, '--', dir, 'rankings-engine/cache').split('\n').filter(Boolean).map(p => [p, execFileSync('git', ['show', `${ref}:${p}`], { cwd: root }).toString('base64')]))
  const identity = (files: Record<string, string>) => digest(Object.keys(files).sort().map(p => [p, files[p]]))
  const b = filesAt(baseline), c = filesAt(head)
  const parse = (files: Record<string, string>, p: string) => JSON.parse(Buffer.from(files[p], 'base64').toString())
  const authority = { version: 1, status: 'approved', reviewer: 'synthetic-reviewer', binding: { repository: 'fixture/repo', repositoryUrl: 'https://example.invalid/fixture/repo.git', pullRequest: 650, arena, baseline, head, baselineSnapshot: identity(b), currentSnapshot: identity(c) }, decisions: targets.map(cell => {
    const old = parse(b, `${dir}/verdicts.json`).find((r: Verdict) => `${r.productId}:${r.storyId}` === cell)!
    const cur = parse(c, `${dir}/verdicts.json`).find((r: Verdict) => `${r.productId}:${r.storyId}` === cell)!
    return { cell, findingId: `synthetic-review-${cell}`, findingDigest: digest(`synthetic finding ${cell}`), decision: 'withdraw-to-authenticated-baseline', baselineRowHash: digest(old), currentRowHash: digest(cur), baselineRawCacheHash: hash(Buffer.from(b[cache(old)], 'base64')), currentRawCacheHash: hash(Buffer.from(c[cache(cur)], 'base64')) }
  }) }
  // Approval exists solely inside disposable fictional test repositories.
  git('checkout', '-q', baseline)
  const adjudicationPath = 'rankings-engine/reviewed-withdrawals/synthetic.json'
  const approve = () => { write(adjudicationPath, authority); const main = commit(); return { ...authority.binding, main, adjudicationPath, adjudicationHash: hash(fs.readFileSync(path.join(root, adjudicationPath))) } }
  const approved = approve()
  const pins: WithdrawalTrust = { repository: approved.repository, repositoryUrl: approved.repositoryUrl, pullRequest: 650, arena, baseline, head, main: approved.main, adjudicationPath, adjudicationHash: approved.adjudicationHash }
  const reapprove = () => { const a = approve(); pins.main = a.main; pins.adjudicationHash = a.adjudicationHash }
  return { root, git, read, write, pins, authority, reapprove, b, c, plan: () => planReviewedWithdrawal(root, pins) }
}

describe('dormant reviewed withdrawal planning', () => {
  it.each([false, true])('restores exact rows, preserves source bytes, and authenticates retention=%s', retention => {
    const f = fixture(retention), initial = f.git('status', '--porcelain'), result = f.plan()
    expect(result.rows.filter(r => targets.includes(`${r.productId}:${r.storyId}`)).every(r => r.verdict === 'none' && r.quality === 0)).toBe(true)
    for (const [p, bytes] of Object.entries(f.c)) if (p !== `${dir}/verdicts.json`) expect(result.files[p]).toBe(bytes)
    if (retention) expect(result.files[ledger]).toBe(f.c[ledger])
    verifyReviewedWithdrawal(f.root, f.pins, result.proof, result.files)
    expect(f.git('status', '--porcelain')).toBe(initial)
    expect(f.plan()).toEqual(result)
  })
  it.each(['status', 'extra', 'head', 'baselineSnapshot', 'repository', 'pullRequest', 'arena', 'cell', 'findingId', 'findingDigest', 'baselineRowHash', 'currentRawCacheHash', 'duplicate'])('rejects tampered/stale authority %s', field => {
    const f = fixture()
    const a = f.authority
    if (field === 'status') a.status = 'pending'
    else if (field === 'extra') Object.assign(a, { commentApproval: true })
    else if (field === 'duplicate') a.decisions.push(a.decisions[0])
    else if (field in a.binding) Object.assign(a.binding, { [field]: field === 'pullRequest' ? 651 : 'wrong' })
    else Object.assign(a.decisions[0], { [field]: field === 'findingId' ? '' : 'wrong' })
    f.reapprove(); expect(() => f.plan()).toThrow()
  })
  it('ignores worktree edits and refuses absent or changed committed authority', () => {
    const f = fixture(); f.write(f.pins.adjudicationPath, { status: 'approved' }); expect(f.plan().proof.authority.hash).toBe(f.pins.adjudicationHash)
    f.pins.adjudicationHash = '0'.repeat(64); expect(() => f.plan()).toThrow('digest')
    f.pins.main = f.pins.baseline; expect(() => f.plan()).toThrow('Missing committed')
  })
  it.each(['proof', 'row', 'cache', 'evidence', 'extra-file', 'retention', 'story-tiers'])('rejects candidate/proof tampering: %s', field => {
    const f = fixture(true), p = f.plan()
    if (field === 'proof') p.proof.decisions[0].findingDigest = '1'.repeat(64)
    else if (field === 'row') { p.rows[0].rationale = 'arbitrary substituted none'; p.files[`${dir}/verdicts.json`] = Buffer.from(JSON.stringify(p.rows)).toString('base64') }
    else if (field === 'extra-file') p.files.extra = 'AA=='
    else { const file = field === 'retention' ? ledger : field === 'story-tiers' ? `rankings-engine/cache/story-tiers/${arena}/synthetic.json` : Object.keys(p.files).find(k => k.includes(field === 'cache' ? '/judge/' : '/evidence/'))!; p.files[file] += 'AA==' }
    expect(() => verifyReviewedWithdrawal(f.root, f.pins, p.proof, p.files)).toThrow()
  })
  it.each(['rubric', 'cache-row', 'missing-cache', 'roster', 'story', 'matrix', 'no-op', 'upgrade', 'other-row'])('rejects authenticated-authority source defect: %s', defect => {
    const f = fixture(false, (stage, { write, read, rows }) => {
      if (stage !== 'head') return
      if (defect === 'rubric') { const c = read(cache(rows[0])); c.hash = 'old-rubric'; write(cache(rows[0]), c) }
      if (defect === 'cache-row') { const c = read(cache(rows[0])); c.verdict.rationale = 'forged'; write(cache(rows[0]), c) }
      if (defect === 'missing-cache') write(cache(rows[0]), null)
      if (defect === 'roster') { const p = read(`${dir}/products.json`); p[0].name = 'Changed'; write(`${dir}/products.json`, p) }
      if (defect === 'story') { const s = read(`${dir}/stories.json`); s[0].title = 'Changed'; write(`${dir}/stories.json`, s) }
      if (defect === 'matrix') write(`${dir}/verdicts.json`, [...rows, rows[0]])
      if (['no-op', 'upgrade', 'other-row'].includes(defect)) {
        const r = read(`${dir}/verdicts.json`); const index = defect === 'other-row' ? 1 : 0
        r[index].verdict = defect === 'upgrade' ? 'na' : 'none'; r[index].quality = 0; r[index].rationale = 'changed'; write(`${dir}/verdicts.json`, r)
      }
    })
    expect(() => f.plan()).toThrow()
  })
  it('rejects changed historical cache even with matching adjudication hashes', () => {
    const f = fixture(false, (stage, { write, read, rows }) => { if (stage === 'baseline') { const c = read(cache(rows[0])); c.keyVersion = 'obsolete'; write(cache(rows[0]), c) } })
    expect(() => f.plan()).toThrow('Unauthenticated')
  })
  it.each(['no-op', 'upgrade', 'positive-baseline', 'cited-baseline'])('rejects cache-authenticated withdrawal direction: %s', mode => {
    const f = fixture(false, (stage, { write, read, rows }) => {
      const changeBaseline = mode === 'positive-baseline' || mode === 'cited-baseline'
      if (stage !== (changeBaseline ? 'baseline' : 'head')) return
      const all = read(`${dir}/verdicts.json`), row = all[0]
      if (changeBaseline) {
        row.evidenceIds = ['old']
        row.support = { subject: row.storyId, relation: mode === 'positive-baseline' ? 'direct' : 'absent', coverage: mode === 'positive-baseline' ? 'partial' : 'none', citations: [{ evidenceId: 'old', quote: 'General settings.' }] }
        if (mode === 'positive-baseline') { row.verdict = 'partial'; row.quality = 1; row.rationale = 'missing for 10: further support' }
      } else {
        row.verdict = mode === 'upgrade' ? 'na' : 'none'; row.quality = 0; row.evidenceIds = []
        row.support = { subject: row.storyId, relation: 'absent', coverage: 'none', citations: [] }
      }
      write(`${dir}/verdicts.json`, all)
      const c = read(cache(rows[0])); c.verdict = row; write(cache(rows[0]), c)
    })
    expect(() => f.plan()).toThrow('Withdrawal requires')
  })
  it('rejects a cited none baseline even when its old citation changed in current evidence', () => {
    const f = fixture(false, (stage, { write, read, rows }) => {
      if (stage === 'baseline') {
        const r = read(`${dir}/verdicts.json`)
        r[0].evidenceIds = ['old']; r[0].support.citations = [{ evidenceId: 'old', quote: 'General settings.' }]
        write(`${dir}/verdicts.json`, r)
        const c = read(cache(rows[0])); c.verdict = r[0]; write(cache(rows[0]), c)
      }
      if (stage === 'head') {
        const pack = read(`${dir}/evidence/hightouch.json`); pack[0].excerpt = 'Changed historical content.'
        write(`${dir}/evidence/hightouch.json`, pack)
        for (const r of rows.filter(r => r.productId === 'hightouch')) {
          const c = read(cache(r)); const story = read(`${dir}/stories.json`).find((s: Story) => s.id === r.storyId)
          c.hash = cellHash(story, pack, PROMPT_VERSION); write(cache(r), c)
        }
      }
    })
    expect(() => f.plan()).toThrow()
  })
  it('rejects forged existing retention even with refreshed adjudication identity', () => {
    const f = fixture(true, (stage, { write, read }) => {
      if (stage === 'head') { const l = read(ledger); l.retained[0].origin = '0'.repeat(40); write(ledger, l) }
    })
    expect(() => f.plan()).toThrow()
  })
  it('rejects a valid but stale shared ancestor with otherwise matching approval pins', () => {
    const f = fixture()
    const shared = f.git('commit-tree', f.git('rev-parse', `${f.pins.baseline}^{tree}`), '-p', f.pins.baseline, '-m', 'new common ancestor')
    const head = f.git('commit-tree', f.git('rev-parse', `${f.pins.head}^{tree}`), '-p', shared, '-m', 'reparent synthetic head')
    f.git('checkout', '-q', shared)
    f.authority.binding.head = head; f.pins.head = head; f.reapprove()
    expect(f.git('merge-base', f.pins.main, f.pins.head)).toBe(shared)
    expect(() => f.plan()).toThrow('unique main/head merge base')
  })
  it('rejects a target changed on trusted main despite matching approved source snapshots', () => {
    const f = fixture()
    const rows = f.read(`${dir}/verdicts.json`)
    rows[0].rationale = 'Newer main decision that must survive'
    f.write(`${dir}/verdicts.json`, rows)
    const raw = f.read(cache(rows[0])); raw.verdict = rows[0]; f.write(cache(rows[0]), raw)
    f.authority.reviewer = 'synthetic-second-reviewer'; f.reapprove()
    expect(f.git('merge-base', f.pins.main, f.pins.head)).toBe(f.pins.baseline)
    expect(() => f.plan()).toThrow('Trusted main target decision changed')
  })
  it.each(['stories.json', 'products.json'])('rejects a changed trusted-main catalog: %s', file => {
    const f = fixture(), catalog = f.read(`${dir}/${file}`)
    if (file === 'stories.json') catalog[0].title = 'New main rubric'
    else catalog[0].name = 'New main product'
    f.write(`${dir}/${file}`, catalog)
    f.authority.reviewer = 'synthetic-catalog-reviewer'; f.reapprove()
    expect(() => f.plan()).toThrow('Catalog or rubric changed')
  })
  it('rejects wrong repository and nonancestor baseline', () => {
    const f = fixture(); f.git('remote', 'set-url', 'origin', 'https://example.invalid/other/repo.git'); expect(() => f.plan()).toThrow('origin')
    f.git('remote', 'set-url', 'origin', f.pins.repositoryUrl); f.pins.baseline = f.pins.main; expect(() => f.plan()).toThrow()
  })
})
