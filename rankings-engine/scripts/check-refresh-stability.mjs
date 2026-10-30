// Upgrades require new cited evidence. Lost prior support may justify a verified downgrade.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function downgradeAfterSupportLoss(old, next, before, after) {
  const rank = { none: 0, partial: 1, full: 2 }
  if (!Object.hasOwn(rank,old.verdict) || !Object.hasOwn(rank,next.verdict)
      || rank[next.verdict] > rank[old.verdict] || next.quality > old.quality) return false
  const previous = new Map(before.map(item => [item.id, item]))
  const current = new Map(after.map(item => [item.id, item]))
  if (next.evidenceIds.some(id => !current.has(id))
      || (next.verdict !== 'none' && next.evidenceIds.length === 0)) return false
  return old.evidenceIds.some(id => previous.has(id) && (!current.has(id)
    || ['tier','url','excerpt'].some(field => previous.get(id)[field] !== current.get(id)[field])))
}

export function unsupportedFlips(before, after, oldPacks, newPacks) {
  const oldRows = new Map(before.map(row => [`${row.productId}:${row.storyId}`, row]))
  return after.filter(row => {
    const old = oldRows.get(`${row.productId}:${row.storyId}`)
    if (!old || (old.verdict === row.verdict && old.quality === row.quality)) return false
    const oldIds = new Set((oldPacks[row.productId] ?? []).map(item => item.id))
    const newIds = new Set((newPacks[row.productId] ?? []).map(item => item.id))
    return !row.evidenceIds.some(id => !oldIds.has(id) && newIds.has(id))
      && !downgradeAfterSupportLoss(old, row, oldPacks[row.productId] ?? [], newPacks[row.productId] ?? [])
  })
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}
function read(ref, path) {
  // Missing files and invalid JSON fail closed rather than hiding a comparison gap.
  return JSON.parse(git('show', `${ref}:${path}`))
}
export function check(baseRef, headRef = 'HEAD') {
  const base = git('merge-base', baseRef, headRef)
  const files = git('diff', '--name-only', base, headRef, '--', 'open-rankings').split('\n')
  let failures = 0
  for (const file of files.filter(file => /^open-rankings\/[^/]+\/verdicts\.json$/.test(file))) {
    const before = read(base, file)
    const after = read(headRef, file)
    const arena = file.split('/')[1]
    const oldPacks = {}, newPacks = {}
    for (const product of new Set(before.map(row => row.productId))) {
      const path = `open-rankings/${arena}/evidence/${product}.json`
      oldPacks[product] = read(base, path)
      newPacks[product] = read(headRef, path)
    }
    for (const row of unsupportedFlips(before, after, oldPacks, newPacks)) {
      console.error(`${arena}/${row.productId}/${row.storyId}: grade changed without a new cited evidence ID`)
      failures++
    }
  }
  if (failures) throw new Error(`${failures} unsupported refresh grade changes; keep prior judgments or supply new evidence and re-judge`)
  console.log('Refresh stability passed')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  check(process.argv[2] ?? 'origin/main', process.argv[3] ?? 'HEAD')
}
