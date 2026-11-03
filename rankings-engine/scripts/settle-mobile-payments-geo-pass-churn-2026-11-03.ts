// Settle the mobile-payments re-judge churn inherited by PR #503.
//
// PR #503 adds geographic availability evidence for Square so generated reviews can render
// arena-scoped country rows. It does not add capability evidence for the 52 mobile-payments
// stories. The historical bring-up re-judged the whole arena under a newer prompt and changed
// 62 story grades even though the capability evidence was unchanged. Two of those rows cited
// the new Square geography page, but that page only lists countries where card acceptance is
// available; it does not establish same-week onboarding or improve Tap to Pay capability.
//
// This dated settlement restores the exact current-main story matrix and replaces only the
// verdict payload in each current judge-cache entry. Cache hashes and key versions stay keyed to
// the current evidence packs and prompt, so a later judge run replays the settled result instead
// of resurrecting prompt-only churn. Square's three new geo evidence rows remain in its pack.
//
// Usage:
//   pnpm exec tsx rankings-engine/scripts/settle-mobile-payments-geo-pass-churn-2026-11-03.ts \
//     --ref bcc6aecc9a89215a9d86d7094a3e60e8976798ab [--write]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const CATEGORY = 'mobile-payments'
const EXPECTED_BASE = 'bcc6aecc9a89215a9d86d7094a3e60e8976798ab'
const EXPECTED_BASELINE_HASH = '398c062b95a702e712461fc2d8936b925494d8f4b54bfb9a1a04d20075a37ba3'
const EXPECTED_PRE_SETTLEMENT_HASH = '25d2087f9599c44546edeabc49b4c3a4fcf42e33711b50b284aecc168b714424'
const EXPECTED_BASELINE_HISTORY_HASH = '7d79da13e15d7f555bd6f250c9dd57be844071b7d44676103fb88011adc3fd47'
const EXPECTED_PRE_SETTLEMENT_HISTORY_HASH = '56f22e22ca8f0a61a8a627943cc9d8bb33816700d2618f79b20d95bd1a82d806'
const EXPECTED_POST_DERIVE_HISTORY_HASH = '03c16ac1a9f604b916dd73d5b5509819205c7c34c20a700099fdfee753bded46'
const EXPECTED_PRODUCTS = ['adyen-pos', 'shopify-pos', 'square', 'stripe-terminal', 'sumup']
const EXPECTED_NEW_EVIDENCE: Record<string, string[]> = {
  'adyen-pos': [],
  'shopify-pos': [],
  square: ['square-docs-30', 'square-docs-31', 'square-docs-32'],
  'stripe-terminal': [],
  sumup: [],
}
const SQUARE_GEO_URL = 'https://squareup.com/help/us/en/article/4956-international-availability'

const WRITE = process.argv.includes('--write')
const refFlag = process.argv.indexOf('--ref')
const REF = refFlag >= 0 ? process.argv[refFlag + 1] : null
if (!REF) throw new Error('usage: settle-mobile-payments-geo-pass-churn-2026-11-03.ts --ref <baseline-ref> [--write]')

type Evidence = {
  id: string
  tier: string
  url: string
  excerpt: string
  fetchedAt: string
}

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}

type CacheEntry = {
  hash: string
  keyVersion: string
  verdict: VerdictRow
}

const git = (...args: string[]) => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const show = (ref: string, file: string) => git('show', `${ref}:${file}`)
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const rowKey = (row: VerdictRow) => `${row.productId}:${row.storyId}`

const resolvedRef = git('rev-parse', REF).trim()
if (resolvedRef !== EXPECTED_BASE) {
  throw new Error(`baseline ref resolved to ${resolvedRef}; expected ${EXPECTED_BASE}`)
}

const verdictsRel = `open-rankings/${CATEGORY}/verdicts.json`
const verdictsPath = path.join(ROOT, verdictsRel)
const historyRel = `open-rankings/${CATEGORY}/score-history.jsonl`
const historyPath = path.join(ROOT, historyRel)
const baselineRaw = show(resolvedRef, verdictsRel)
const currentRaw = fs.readFileSync(verdictsPath, 'utf8')
const baselineHistoryRaw = show(resolvedRef, historyRel)
const currentHistoryRaw = fs.readFileSync(historyPath, 'utf8')
const baselineHash = sha256(baselineRaw)
const currentHash = sha256(currentRaw)
const baselineHistoryHash = sha256(baselineHistoryRaw)
const currentHistoryHash = sha256(currentHistoryRaw)
if (baselineHash !== EXPECTED_BASELINE_HASH) {
  throw new Error(`baseline verdict hash drifted: ${baselineHash}; expected ${EXPECTED_BASELINE_HASH}`)
}
if (![EXPECTED_PRE_SETTLEMENT_HASH, EXPECTED_BASELINE_HASH].includes(currentHash)) {
  throw new Error(
    `current verdicts are neither the audited pre-settlement matrix nor the settled baseline: ${currentHash}`,
  )
}
if (baselineHistoryHash !== EXPECTED_BASELINE_HISTORY_HASH) {
  throw new Error(
    `baseline score-history hash drifted: ${baselineHistoryHash}; expected ${EXPECTED_BASELINE_HISTORY_HASH}`,
  )
}
if (![EXPECTED_PRE_SETTLEMENT_HISTORY_HASH, EXPECTED_POST_DERIVE_HISTORY_HASH, EXPECTED_BASELINE_HISTORY_HASH]
  .includes(currentHistoryHash)) {
  throw new Error(
    `current score history is neither the audited pre-settlement, post-derive, nor baseline file: ${currentHistoryHash}`,
  )
}

const baseline: VerdictRow[] = JSON.parse(baselineRaw)
const current: VerdictRow[] = JSON.parse(currentRaw)
const baselineByKey = new Map(baseline.map((row) => [rowKey(row), row]))
const currentByKey = new Map(current.map((row) => [rowKey(row), row]))
if (baseline.length !== 260 || current.length !== baseline.length) {
  throw new Error(`unexpected matrix size: baseline=${baseline.length}, current=${current.length}; expected 260`)
}
if (baselineByKey.size !== baseline.length || currentByKey.size !== current.length) {
  throw new Error('duplicate product/story row in mobile-payments verdict matrix')
}
for (const key of baselineByKey.keys()) {
  if (!currentByKey.has(key)) throw new Error(`current matrix is missing baseline row ${key}`)
}
for (const key of currentByKey.keys()) {
  if (!baselineByKey.has(key)) throw new Error(`current matrix has unexpected row ${key}`)
}

const products = [...new Set(baseline.map((row) => row.productId))].sort()
if (!isDeepStrictEqual(products, EXPECTED_PRODUCTS)) {
  throw new Error(`unexpected product set: ${products.join(', ')}`)
}

for (const product of products) {
  const evidenceRel = `open-rankings/${CATEGORY}/evidence/${product}.json`
  const before: Evidence[] = JSON.parse(show(resolvedRef, evidenceRel))
  const after: Evidence[] = JSON.parse(fs.readFileSync(path.join(ROOT, evidenceRel), 'utf8'))
  const beforeById = new Map(before.map((item) => [item.id, item]))
  const afterById = new Map(after.map((item) => [item.id, item]))
  for (const [id, item] of beforeById) {
    if (!afterById.has(id)) throw new Error(`${product}: baseline evidence ${id} was removed`)
    if (!isDeepStrictEqual(afterById.get(id), item)) {
      throw new Error(`${product}: baseline evidence ${id} changed instead of being preserved`)
    }
  }
  const added = after.filter((item) => !beforeById.has(item.id)).map((item) => item.id).sort()
  if (!isDeepStrictEqual(added, EXPECTED_NEW_EVIDENCE[product])) {
    throw new Error(`${product}: unexpected new evidence ids: ${added.join(', ') || '(none)'}`)
  }
}

const squareEvidence: Evidence[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, `open-rankings/${CATEGORY}/evidence/square.json`), 'utf8'),
)
for (const id of EXPECTED_NEW_EVIDENCE.square) {
  const item = squareEvidence.find((candidate) => candidate.id === id)
  if (!item || item.tier !== 'claimed-docs' || item.url !== SQUARE_GEO_URL
      || !item.excerpt.includes('(observed 2026-10-27)')) {
    throw new Error(`${id}: expected the dated Square international-availability evidence row`)
  }
}

let changedRows = 0
let changedGrades = 0
let changedCaches = 0
const cacheWrites: Array<{ file: string; contents: string }> = []
for (const baseRow of baseline) {
  const key = rowKey(baseRow)
  const currentRow = currentByKey.get(key)!
  if (!isDeepStrictEqual(currentRow, baseRow)) changedRows += 1
  if (currentRow.verdict !== baseRow.verdict || currentRow.quality !== baseRow.quality) changedGrades += 1

  const cachePath = path.join(
    ROOT,
    'rankings-engine',
    'cache',
    'judge',
    CATEGORY,
    baseRow.productId,
    `${baseRow.storyId}.json`,
  )
  const cache: CacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  if (typeof cache.hash !== 'string' || cache.hash.length === 0 || typeof cache.keyVersion !== 'string') {
    throw new Error(`${key}: malformed current cache key metadata`)
  }
  if (!isDeepStrictEqual(cache.verdict, currentRow) && !isDeepStrictEqual(cache.verdict, baseRow)) {
    throw new Error(`${key}: cache verdict matches neither the audited current row nor baseline row`)
  }
  if (!isDeepStrictEqual(cache.verdict, baseRow)) {
    changedCaches += 1
    const settled = { ...cache, verdict: baseRow }
    cacheWrites.push({ file: cachePath, contents: `${JSON.stringify(settled, null, 2)}\n` })
  }
}

const baselineHistoryLines = baselineHistoryRaw.trimEnd().split('\n').length
const currentHistoryLines = currentHistoryRaw.trimEnd().split('\n').length
const removedHistoryLines = currentHistoryLines - baselineHistoryLines
if (removedHistoryLines < 0) {
  throw new Error(`current score history has ${currentHistoryLines} rows; baseline has ${baselineHistoryLines}`)
}

console.log(`baseline: ${resolvedRef}`)
console.log(`matrix rows restored: ${changedRows}; grade/quality changes restored: ${changedGrades}`)
console.log(`cache verdict payloads restored: ${changedCaches}; cache hashes/key versions preserved`)
console.log(`prompt-only score-history rows removed: ${removedHistoryLines}`)

if (!WRITE) {
  console.log('dry run: pass --write to apply')
  process.exit(0)
}

for (const cacheWrite of cacheWrites) fs.writeFileSync(cacheWrite.file, cacheWrite.contents)
fs.writeFileSync(verdictsPath, baselineRaw)
fs.writeFileSync(historyPath, baselineHistoryRaw)
const settledHash = sha256(fs.readFileSync(verdictsPath, 'utf8'))
if (settledHash !== EXPECTED_BASELINE_HASH) {
  throw new Error(`settled verdict matrix hash ${settledHash} did not match baseline`)
}
console.log(`wrote ${verdictsRel}; exact baseline hash ${settledHash}`)
const settledHistoryHash = sha256(fs.readFileSync(historyPath, 'utf8'))
if (settledHistoryHash !== EXPECTED_BASELINE_HISTORY_HASH) {
  throw new Error(`settled score-history hash ${settledHistoryHash} did not match baseline`)
}
console.log(`wrote ${historyRel}; exact baseline hash ${settledHistoryHash}`)
