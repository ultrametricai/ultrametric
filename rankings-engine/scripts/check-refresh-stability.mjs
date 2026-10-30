// Refreshes may change a grade only when they cite an evidence ID new to that pack.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function unsupportedFlips(before, after, oldPacks, newPacks) {
  const oldRows = new Map(before.map(row => [`${row.productId}:${row.storyId}`, row]))
  return after.filter(row => {
    const old = oldRows.get(`${row.productId}:${row.storyId}`)
    if (!old || (old.verdict === row.verdict && old.quality === row.quality)) return false
    const oldIds = new Set((oldPacks[row.productId] ?? []).map(item => item.id))
    const newIds = new Set((newPacks[row.productId] ?? []).map(item => item.id))
    return !row.evidenceIds.some(id => !oldIds.has(id) && newIds.has(id))
  })
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}
function read(ref, path) {
  // Missing files and invalid JSON fail closed rather than hiding a comparison gap.
  return JSON.parse(git('show', `${ref}:${path}`))
}
export function check(baseRef) {
  const base = git('merge-base', baseRef, 'HEAD')
  const files = git('diff', '--name-only', base, 'HEAD', '--', 'open-rankings').split('\n')
  let failures = 0
  for (const file of files.filter(file => /^open-rankings\/[^/]+\/verdicts\.json$/.test(file))) {
    const before = read(base, file)
    const after = read('HEAD', file)
    const arena = file.split('/')[1]
    const oldPacks = {}, newPacks = {}
    for (const product of new Set(before.map(row => row.productId))) {
      const path = `open-rankings/${arena}/evidence/${product}.json`
      oldPacks[product] = read(base, path)
      newPacks[product] = read('HEAD', path)
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
  check(process.argv[2] ?? 'origin/main')
}
