import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyChangedFiles, isDocsOnlyPath } from './docs-fast-path.mjs'

// The classifier the CI docs fast path gates on (.github/workflows/ci.yml). The suite
// pins both directions: every path the allowlist derivation marked safe, and — more
// importantly — every known gate input stays OUTSIDE the allowlist so a docs-only PR
// can never skip a gate that reads it.

test('root prose files no gate reads are docs-only', () => {
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'CODE_OF_CONDUCT.md', 'METHODOLOGY.md']) {
    assert.equal(isDocsOnlyPath(f), true, f)
  }
})

test('README and CONTRIBUTING are docs-only because the fast path runs their gates', () => {
  // Covered on the fast path by pnpm stats + __tests__/readme.test.ts +
  // __tests__/coverage.test.ts (see ci.yml's fast-path step).
  assert.equal(isDocsOnlyPath('README.md'), true)
  assert.equal(isDocsOnlyPath('CONTRIBUTING.md'), true)
})

test('docs prose and media are docs-only', () => {
  for (const f of [
    'docs/SCORING.md',
    'docs/ACCURACY.md',
    'docs/vendor-research/openai-dots.md',
    'docs/demo.gif',
    'docs/artifacts.png',
    'docs/demo.mp4',
  ]) {
    assert.equal(isDocsOnlyPath(f), true, f)
  }
})

test('assets/readme media are docs-only (readme.test.ts runs on the fast path)', () => {
  assert.equal(isDocsOnlyPath('assets/readme/demo.mp4'), true)
  assert.equal(isDocsOnlyPath('assets/readme/new-screenshot.png'), true)
})

test('json under docs/ is excluded: those files feed tests', () => {
  // docs/repo-split-census.json → __tests__/repo-split.test.ts;
  // docs/geo-resolution-worklist.json → lib/__tests__/processGeoResolutions.test.ts.
  for (const f of [
    'docs/repo-split-census.json',
    'docs/geo-resolution-worklist.json',
    'docs/JUDGE-MIGRATION-2026-09-30-worklist.json',
    'docs/catalog-task-briefs/preservation-baseline.json',
  ]) {
    assert.equal(isDocsOnlyPath(f), false, f)
  }
})

test('docs/TIMELINE-INVERSIONS.md is excluded: byte-identity drift gate reads it', () => {
  assert.equal(isDocsOnlyPath('docs/TIMELINE-INVERSIONS.md'), false)
})

test('markdown in the tested content trees is excluded', () => {
  for (const f of [
    'open-lore/LORE.md',
    'open-lore/README.md',
    'open-law/LAWS.md',
    'open-processes/SITUATIONS.md',
    'open-processes/README.md',
    'open-modules/README.md',
    'open-documents/README.md',
    'policies/AGENT_POLICY.md',
    'scripts/README.md',
    '.github/pull_request_template.md',
  ]) {
    assert.equal(isDocsOnlyPath(f), false, f)
  }
})

test('code, data, and workflow files are excluded', () => {
  for (const f of [
    'lib/scoring.ts',
    'open-rankings/categories.json',
    '.github/workflows/ci.yml',
    'scripts/docs-fast-path.mjs',
    'package.json',
    'assets/banner.svg',
    'open-manifest.json',
  ]) {
    assert.equal(isDocsOnlyPath(f), false, f)
  }
})

test('code and data files inside the allowlisted directories are excluded', () => {
  // Lintable or test-feeding extensions never ride the fast path, even under docs/
  // or assets/readme/ (a docs/vendor-research/example.mjs would otherwise skip lint).
  for (const f of [
    'docs/vendor-research/example.mjs',
    'docs/helper.ts',
    'docs/script.js',
    'docs/tool.py',
    'docs/config.yml',
    'docs/data.jsonl',
    'docs/notes',
    'docs/.hidden',
    'assets/readme/snippet.mjs',
    'assets/readme/data.json',
  ]) {
    assert.equal(isDocsOnlyPath(f), false, f)
  }
})

test('extension matching is case-insensitive for media, exact for direction', () => {
  assert.equal(isDocsOnlyPath('docs/screenshot.PNG'), true)
  assert.equal(isDocsOnlyPath('docs/GUIDE.MD'), true)
  // A trailing-dot or dot-only name is not a prose extension.
  assert.equal(isDocsOnlyPath('docs/file.'), false)
})

test('lookalike prefixes do not match the real allowlist directories', () => {
  assert.equal(isDocsOnlyPath('docs-private/notes.md'), false)
  assert.equal(isDocsOnlyPath('assets/readme-extra/x.png'), false)
  assert.equal(isDocsOnlyPath('not-docs/README.md'), false)
})

test('classifyChangedFiles: all-docs list passes', () => {
  const r = classifyChangedFiles(['README.md', 'docs/SCORING.md', ''])
  assert.equal(r.docsOnly, true)
  assert.deepEqual(r.offenders, [])
  assert.deepEqual(r.changed, ['README.md', 'docs/SCORING.md'])
})

test('classifyChangedFiles: one non-docs file fails the whole list (fail-closed)', () => {
  const r = classifyChangedFiles(['docs/SCORING.md', 'lib/scoring.ts'])
  assert.equal(r.docsOnly, false)
  assert.deepEqual(r.offenders, ['lib/scoring.ts'])
})

test('classifyChangedFiles: empty and whitespace-only lists fail (fail-closed)', () => {
  assert.equal(classifyChangedFiles([]).docsOnly, false)
  assert.equal(classifyChangedFiles(['', '  ']).docsOnly, false)
})

test('backslash paths never pass the allowlist', () => {
  assert.equal(isDocsOnlyPath('docs\\SCORING.md'), false)
  assert.equal(classifyChangedFiles(['docs\\TIMELINE-INVERSIONS.md']).docsOnly, false)
})
