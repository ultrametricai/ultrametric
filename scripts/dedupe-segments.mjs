// Post-build dedup for the Vercel packaging disk (docs/BUILD-SIZE.md, round 3).
//
// This Next version writes every prerendered page's flight payload twice:
//   <page>.rsc                                   (the page payload)
//   <page>.segments/**/_full.segment.rsc         (byte-identical copy, ~2.9 GB fleet-wide)
// There is no config gate (segment prefetching is unconditional), and the duplication is
// what overflows Vercel's build-container disk during output packaging. Replacing the
// _full copy with a HARDLINK to the page .rsc frees the bytes at the source side of the
// copy; it changes nothing about what is served (same path, same bytes).
//
// Safety: a link replaces a file ONLY after a byte-for-byte comparison — anything that
// isn't an exact duplicate is left untouched and counted honestly in the report.
import { createHash } from 'node:crypto'
import { readFileSync, statSync, linkSync, unlinkSync, readdirSync } from 'node:fs'
import path from 'node:path'

const APP_DIR = process.argv[2] ?? '.next/server/app'

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

let linked = 0
let freedBytes = 0
let skippedDifferent = 0
let skippedMissing = 0

const dryRun = process.argv.includes('--dry-run')

for (const file of walk(APP_DIR)) {
  if (!file.endsWith('/_full.segment.rsc')) continue
  // <base>.segments/**/_full.segment.rsc → the sibling page payload is <base>.rsc
  const segRoot = file.slice(0, file.indexOf('.segments/'))
  const pageRsc = `${segRoot}.rsc`
  let pageStat
  try {
    pageStat = statSync(pageRsc)
  } catch {
    skippedMissing++
    continue
  }
  const segStat = statSync(file)
  if (segStat.ino === pageStat.ino) continue // already linked
  if (segStat.size !== pageStat.size || digest(file) !== digest(pageRsc)) {
    skippedDifferent++
    continue
  }
  if (!dryRun) {
    unlinkSync(file)
    linkSync(pageRsc, file)
  }
  linked++
  freedBytes += segStat.size
}

console.log(
  `dedupe-segments${dryRun ? ' (dry run)' : ''}: ${linked} _full.segment.rsc linked to their page .rsc, ` +
    `${(freedBytes / 1024 / 1024 / 1024).toFixed(2)} GB freed; ` +
    `${skippedDifferent} skipped (content differs), ${skippedMissing} skipped (no sibling .rsc)`,
)
