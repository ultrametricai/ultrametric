import assert from 'node:assert/strict'
import test from 'node:test'
import { unsupportedFlips } from './check-refresh-stability.mjs'

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
