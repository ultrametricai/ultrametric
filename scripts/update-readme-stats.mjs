// `pnpm stats`: the README count gate. The generated count blocks are retired (founder
// round 8 removed the stats line and badge row; the founder's rankings-examples order,
// 2026-10-14, retired the arenas line in favor of a curated example list), so this script
// no longer writes anything. It now holds the retirement in place: it exits non-zero if a
// retired marker pair reappears or hand-written prose carries a count, and exits 0 silently
// otherwise. Idempotent by construction — running it never changes the README.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const README_PATH = path.join(ROOT, 'README.md')

// Marker pairs this script used to maintain. Retired: counts shown on pages are computed
// at build time, and README prose carries no counts (evidence doctrine).
const RETIRED_MARKERS = [
  '<!-- stats:start -->',
  '<!-- stat-badges:start -->',
  '<!-- arenas:start -->',
  '<!-- arenas:end -->',
]

// The no-counts rule, same shape as the __tests__/readme.test.ts pin: hand-written prose
// never carries a count or a date that will go stale.
const COUNT_PATTERN = /\b\d[\d,]* (rankings|products|verdicts|arenas|processes|markets)\b/
const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/

const readme = fs.readFileSync(README_PATH, 'utf8')
const errors = []

for (const marker of RETIRED_MARKERS) {
  if (readme.includes(marker)) {
    errors.push(`README.md contains the retired marker ${marker} — the generated count blocks stay retired`)
  }
}
const count = readme.match(COUNT_PATTERN)
if (count) errors.push(`README.md prose carries a count ("${count[0]}") — counts live on the generated site pages, not here`)
const date = readme.match(DATE_PATTERN)
if (date) errors.push(`README.md prose carries a date ("${date[0]}") that will go stale`)

if (errors.length > 0) {
  for (const e of errors) console.error(`update-readme-stats: ${e}`)
  process.exit(1)
}
console.log('update-readme-stats: README carries no generated count blocks (retired) — nothing to write')
