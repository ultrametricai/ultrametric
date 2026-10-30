import assert from 'node:assert/strict'
import test from 'node:test'
import { unsupportedFlips, downgradeAfterSupportLoss } from './check-refresh-stability.mjs'

const old = { productId: 'vendor', storyId: 'install', verdict: 'partial', quality: 5, evidenceIds: ['a'] }
const pack = { vendor: [{ id: 'a' }, { id: 'existing-unused' }] }
function flips(change, evidence = pack) {
  return unsupportedFlips([old], [{ ...old, ...change }], pack, evidence)
}
test('unchanged grades tolerate rationale and confidence edits', () => {
  assert.equal(flips({ rationale: 'clearer', confidence: 'high' }).length, 0)
})
test('grade and quality changes require new evidence in the pack', () => {
  assert.equal(flips({ verdict: 'full' }).length, 1)
  assert.equal(flips({ quality: 6 }).length, 1)
  assert.equal(flips({ verdict: 'none', evidenceIds: [] }).length, 1)
  assert.equal(flips({ verdict: 'full', evidenceIds: ['existing-unused'] }).length, 1)
})
test('a fabricated citation or uncited new evidence does not authorize a flip', () => {
  assert.equal(flips({ verdict: 'full', evidenceIds: ['missing'] }).length, 1)
  assert.equal(flips({ verdict: 'full' }, { vendor: [...pack.vendor, { id: 'new' }] }).length, 1)
})
test('a flip citing a new, present evidence ID passes', () => {
  assert.equal(flips({ verdict: 'full', evidenceIds: ['new'] }, { vendor: [...pack.vendor, { id: 'new' }] }).length, 0)
})
test('new cells have no previous grade to preserve', () => {
  assert.equal(flips({ storyId: 'new-story', verdict: 'full' }).length, 0)
})

// Exercise the actual Git merge-base, changed-file selection, and pack reads.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const checker = fileURLToPath(new URL('./check-refresh-stability.mjs', import.meta.url))
function repositoryCase(change, nextPack, removePack = false, inspectCandidate = false) {
  const dir = mkdtempSync(join(tmpdir(), 'um-stability-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe', encoding: 'utf8' }).trim()
  const arena = join(dir, 'open-rankings', 'fixture')
  try {
    git('init', '-b', 'main')
    git('config', 'user.name', 'Stability Test')
    git('config', 'user.email', 'fixture@example.invalid')
    mkdirSync(join(arena, 'evidence'), { recursive: true })
    writeFileSync(join(arena, 'verdicts.json'), JSON.stringify([old]))
    writeFileSync(join(arena, 'evidence', 'vendor.json'), JSON.stringify(pack.vendor))
    git('add', '.')
    git('commit', '-m', 'base fixture')
    const base = git('rev-parse', 'HEAD')
    writeFileSync(join(arena, 'verdicts.json'), JSON.stringify([{ ...old, ...change }]))
    writeFileSync(join(arena, 'evidence', 'vendor.json'), JSON.stringify(nextPack))
    if (removePack) rmSync(join(arena, 'evidence', 'vendor.json'))
    git('add', '-A')
    git('commit', '-m', 'refresh fixture')
    const candidate = git('rev-parse', 'HEAD')
    if (inspectCandidate) git('checkout', '--detach', base)
    return spawnSync(process.execPath, [checker, base, ...(inspectCandidate ? [candidate] : [])], { cwd: dir, encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
test('Git comparison accepts a changed grade citing a newly committed evidence ID', () => {
  const result = repositoryCase({ verdict: 'full', evidenceIds: ['new'] }, [...pack.vendor, { id: 'new' }])
  assert.equal(result.status, 0, result.stderr)
})
test('Git comparison rejects a changed grade with only existing evidence', () => {
  const result = repositoryCase({ verdict: 'full' }, pack.vendor)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /fixture\/vendor\/install: grade changed without a new cited evidence ID/)
})
test('Git comparison fails closed when the new evidence pack is missing', () => {
  const result = repositoryCase({ verdict: 'full' }, pack.vendor, true)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not exist/)
})

test('checks a candidate commit without checking out its code', () => {
  const result = repositoryCase({ verdict: 'full' }, pack.vendor, false, true)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /grade changed without a new cited evidence ID/)
})

const source = { id: 'source', tier: 'claimed-docs', url: 'https://example.invalid/docs', excerpt: 'documented feature', fetchedAt: '2026-10-30' }
const positive = { ...old, verdict: 'full', quality: 8, evidenceIds: ['source'] }
test('lost prior support permits only non-upward judgments', () => {
  const none = { ...positive, verdict: 'none', quality: 0, evidenceIds: [] }
  assert.equal(downgradeAfterSupportLoss(positive, none, [source], []), true)
  assert.equal(downgradeAfterSupportLoss(positive, none, [source], [{ ...source, excerpt: 'different content' }]), true)
  assert.equal(downgradeAfterSupportLoss(positive, none, [source], [{ ...source, fetchedAt: 'later' }]), false)
  assert.equal(downgradeAfterSupportLoss(positive, { ...none, verdict: 'na' }, [source], []), false)
  assert.equal(downgradeAfterSupportLoss(positive, { ...none, verdict: 'disputed' }, [source], []), false)
})
test('lost support cannot justify an upgrade, higher quality, or fabricated citations', () => {
  const partial = { ...positive, verdict: 'partial', quality: 6 }
  assert.equal(downgradeAfterSupportLoss(partial, { ...positive, quality: 5 }, [source], []), false)
  assert.equal(downgradeAfterSupportLoss(positive, { ...positive, quality: 9, evidenceIds: ['other'] }, [source], [{ ...source, id: 'other' }]), false)
  assert.equal(downgradeAfterSupportLoss(positive, { ...positive, quality: 7, evidenceIds: ['invented'] }, [source], []), false)
  assert.equal(downgradeAfterSupportLoss(positive, { ...positive, verdict: 'partial', quality: 6, evidenceIds: [] }, [source], []), false)
})
test('downgrade classification is shared with the refresh stability gate', () => {
  assert.equal(unsupportedFlips([positive], [{ ...positive, verdict: 'none', quality: 0, evidenceIds: [] }], { vendor: [source] }, { vendor: [] }).length, 0)
  assert.equal(unsupportedFlips([positive], [{ ...positive, quality: 9, evidenceIds: [] }], { vendor: [source] }, { vendor: [] }).length, 1)
})
