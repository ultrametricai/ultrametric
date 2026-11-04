// Docs-only fast-path classifier for CI (.github/workflows/ci.yml).
//
// Given the list of files a PR changes, decide whether EVERY one of them is prose or
// media that the heavy gates (vitest suite, lint, typecheck, shared-process checks,
// recompute-check) never read, so the validation job can skip those gates and run the
// small fast-path gate set instead (pnpm stats, the README/coverage vitest files, and
// the manifest check — see ci.yml).
//
// Fail-closed by construction: a file is docs-only when a rule here says so;
// everything else (including an empty change list, a rename into an unknown tree, or a
// brand-new extension) runs the full suite. When in doubt, leave the path off the
// allowlist.
//
// The allowlist is DERIVED from what the gates actually read (audited 2026-10-23):
//
//   Allowed, because the fast path runs the exact gates that read them:
//   - README.md, CONTRIBUTING.md — read by __tests__/readme.test.ts,
//     __tests__/coverage.test.ts, and scripts/update-readme-stats.mjs (`pnpm stats`);
//     ci.yml's fast path runs all three.
//   - assets/readme/** — existence/size checks live in __tests__/readme.test.ts,
//     which the fast path runs.
//
//   Allowed, because no gate reads them (mentions in code are comments only):
//   - AGENTS.md, CLAUDE.md, CODE_OF_CONDUCT.md, METHODOLOGY.md at the repo root.
//   - docs/** prose and media, EXCEPT the exclusions below.
//
//   Inside docs/ and assets/readme/, only prose/media EXTENSIONS pass (see
//   PROSE_MEDIA_EXTENSIONS): a code file dropped under docs/ (say
//   docs/vendor-research/example.mjs) is lintable and must take the full suite, and
//   every *.json under docs/ is a potential test input — docs/repo-split-census.json
//   feeds __tests__/repo-split.test.ts, docs/geo-resolution-worklist.json feeds
//   lib/__tests__/processGeoResolutions.test.ts, and future worklists follow the same
//   pattern — so neither extension class is allowlisted.
//
//   Also excluded inside docs/ (a test input despite its prose extension):
//   - docs/TIMELINE-INVERSIONS.md — byte-identity drift gate in
//     lib/__tests__/processDeps.test.ts.
//
//   Deliberately NOT allowlisted: markdown anywhere else. open-lore/, open-law/,
//   open-processes/, open-modules/, open-documents/ markdown is schema- or
//   drift-tested (lore.test.ts, situations.test.ts, businessLogicMap.test.ts,
//   canonical-projections.test.ts, ...), and policies/ markdown is behavioral input
//   for agents. Those edits run the full suite.
//
// CLI: node scripts/docs-fast-path.mjs <changed-files.txt>
//   exit 0 → every changed file is docs-only; exit 1 → at least one is not (offenders
//   are printed), or the list is empty/unreadable.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS_ONLY_EXACT = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'CLAUDE.md',
  'CODE_OF_CONDUCT.md',
  'METHODOLOGY.md',
])

const DOCS_EXCLUDED_EXACT = new Set(['docs/TIMELINE-INVERSIONS.md'])

// The only extensions that may ride the fast path inside the allowlisted
// directories. Everything else — code (.ts/.mjs/.py), data (.json/.jsonl/.yml),
// unknown extensions, extensionless files — is lintable, testable, or both, and
// takes the full suite.
const PROSE_MEDIA_EXTENSIONS = new Set([
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.mp4',
  '.mov',
  '.pdf',
])

function hasProseMediaExtension(file) {
  const base = file.slice(file.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false // extensionless or dotfile
  return PROSE_MEDIA_EXTENSIONS.has(base.slice(dot).toLowerCase())
}

/** True when a single changed path is covered by the docs-only allowlist. */
export function isDocsOnlyPath(file) {
  if (typeof file !== 'string' || file.length === 0) return false
  // git and `gh pr diff --name-only` emit forward slashes; normalize defensively so a
  // backslash path can only ever FAIL the allowlist, not dodge an exclusion.
  if (file.includes('\\')) return false
  if (DOCS_ONLY_EXACT.has(file)) return true
  if (file.startsWith('assets/readme/')) return hasProseMediaExtension(file)
  if (file.startsWith('docs/')) {
    if (DOCS_EXCLUDED_EXACT.has(file)) return false
    return hasProseMediaExtension(file)
  }
  return false
}

/**
 * Classify a PR's changed-file list. Fail-closed: docsOnly is true only when the list
 * is non-empty and every entry passes isDocsOnlyPath.
 */
export function classifyChangedFiles(files) {
  const changed = files.map((f) => f.trim()).filter((f) => f.length > 0)
  const offenders = changed.filter((f) => !isDocsOnlyPath(f))
  return {
    docsOnly: changed.length > 0 && offenders.length === 0,
    changed,
    offenders,
  }
}

const invokedAsCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsCli) {
  const listPath = process.argv[2]
  if (!listPath) {
    console.error('usage: node scripts/docs-fast-path.mjs <changed-files.txt>')
    process.exit(1)
  }
  let raw
  try {
    raw = readFileSync(listPath, 'utf8')
  } catch (err) {
    console.error(`docs-fast-path: cannot read ${listPath} (${err.message}) — full suite`)
    process.exit(1)
  }
  const { docsOnly, changed, offenders } = classifyChangedFiles(raw.split('\n'))
  if (docsOnly) {
    console.log(`docs-fast-path: all ${changed.length} changed file(s) are docs-only`)
    process.exit(0)
  }
  if (changed.length === 0) {
    console.log('docs-fast-path: empty change list — full suite (fail-closed)')
  } else {
    console.log(`docs-fast-path: ${offenders.length} file(s) outside the allowlist — full suite:`)
    for (const f of offenders) console.log(`  ${f}`)
  }
  process.exit(1)
}
