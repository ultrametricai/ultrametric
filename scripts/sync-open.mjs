#!/usr/bin/env node
// sync-open.mjs — the repo-split overlay (docs/REPO-SPLIT-PLAN.md, section 2).
//
// Two modes:
//
//   node scripts/sync-open.mjs
//     Overlay mode, for the CLOSED site repo's prebuild. Reads `open.lock`
//     ({ repo, sha, tarballSha256 }) from the working directory, downloads the codeload
//     tarball for that SHA (public repo, no auth), verifies the tarball sha256, extracts
//     the open repo's committed open-manifest.json from the tarball, and materializes every
//     entry with overlay: true at its canonical path. Any overlay path that collides with a
//     git-tracked path in the consuming repo fails the build: the open/closed boundary is
//     machine-enforced. Manifest paths are sanitized at load (no absolute paths, no `.` or
//     `..` segments) and every destination is resolved and verified to stay strictly inside
//     the consuming repo root before anything is removed or copied. A ledger
//     (`.open-overlay-manifest.json`, gitignored in the consuming repo) records every
//     materialized path; on the next run, ledger paths absent from the current pin's
//     manifest are removed under the same guards, so a dropped or renamed entry leaves no
//     stale files behind after a pin bump.
//
//   node scripts/sync-open.mjs --check
//     Manifest-drift gate, for the OPEN repo's CI. Validates the committed open-manifest.json
//     against the current git-tracked tree: every entry path exists; every git-tracked file
//     in the repo is covered by a most-specific entry (a new root file or top-level dir
//     without a manifest entry fails); overlay entries are open; the wholly-closed
//     top-level dirs carry no open entries.
//
// Exit code is the contract (house rules): 0 on success, 1 on any failure.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const MANIFEST_NAME = 'open-manifest.json'
const LOCK_NAME = 'open.lock'
const LEDGER_NAME = '.open-overlay-manifest.json'

function fail(message) {
  console.error(`sync-open: ${message}`)
  process.exit(1)
}

function gitTrackedFiles(cwd) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd, maxBuffer: 1024 * 1024 * 512 })
  return out.toString('utf8').split('\0').filter(Boolean)
}

// A manifest or ledger path must be a plain relative POSIX path: non-empty, not absolute,
// no backslashes, and no empty, `.`, or `..` segments. Anything else is rejected before
// any filesystem operation.
function isSafeRelativePath(p) {
  if (typeof p !== 'string' || p === '') return false
  if (path.isAbsolute(p) || p.includes('\\')) return false
  return p.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

// Resolve `relPath` against `root` and require the result to sit strictly inside `root`
// (never the root itself, never outside it). Returns the resolved absolute path, or null.
function resolveInsideRoot(root, relPath) {
  const resolved = path.resolve(root, relPath)
  const rel = path.relative(root, resolved)
  if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return null
  }
  return resolved
}

function loadManifest(filePath) {
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`cannot read ${filePath}: ${error.message}`)
  }
  if (manifest.version !== 1) fail(`unsupported manifest version: ${manifest.version}`)
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) fail('manifest has no entries')
  const seen = new Set()
  for (const entry of manifest.entries) {
    if (!isSafeRelativePath(entry.path)) {
      fail(`invalid entry path (must be relative, no "." or ".." segments): ${JSON.stringify(entry.path)}`)
    }
    if (!['dir', 'file'].includes(entry.type)) fail(`${entry.path}: invalid type ${entry.type}`)
    if (!['open', 'closed', 'both-during-migration'].includes(entry.disposition)) {
      fail(`${entry.path}: invalid disposition ${entry.disposition}`)
    }
    if (typeof entry.overlay !== 'boolean') fail(`${entry.path}: overlay must be boolean`)
    if (entry.overlay && entry.disposition !== 'open') fail(`${entry.path}: overlay entries must be open`)
    if (seen.has(entry.path)) fail(`duplicate entry path: ${entry.path}`)
    seen.add(entry.path)
  }
  return manifest
}

function coveringEntry(manifest, file) {
  // Most-specific match: exact file entry, else the longest dir-entry prefix.
  let best = null
  for (const entry of manifest.entries) {
    if (entry.type === 'file' && entry.path === file) return entry
    if (entry.type === 'dir' && file.startsWith(entry.path + '/')) {
      if (!best || entry.path.length > best.path.length) best = entry
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// --check: validate the manifest against this repo's git-tracked tree.
// ---------------------------------------------------------------------------
function check() {
  const root = process.cwd()
  const manifest = loadManifest(path.join(root, MANIFEST_NAME))
  const tracked = gitTrackedFiles(root)
  const trackedSet = new Set(tracked)
  const errors = []

  // 1. Every entry path exists in the tracked tree.
  for (const entry of manifest.entries) {
    if (entry.type === 'file') {
      if (!trackedSet.has(entry.path)) errors.push(`missing tracked file: ${entry.path}`)
    } else {
      const prefix = entry.path + '/'
      if (!tracked.some(f => f.startsWith(prefix))) errors.push(`empty or missing dir entry: ${entry.path}`)
    }
  }

  // 2. Full-tree classification: every git-tracked file has a covering entry, so a new
  // root file or top-level directory cannot land unclassified.
  for (const file of tracked) {
    if (!coveringEntry(manifest, file)) errors.push(`unclassified tracked file: ${file}`)
  }

  // 3. Wholly-closed top-level dirs carry no open entries.
  for (const closedTop of ['app', 'components', 'infra']) {
    for (const entry of manifest.entries) {
      const inside = entry.path === closedTop || entry.path.startsWith(closedTop + '/')
      if (inside && entry.disposition === 'open') {
        errors.push(`open entry inside closed dir: ${entry.path}`)
      }
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`sync-open --check: ${error}`)
    process.exit(1)
  }
  console.log(`sync-open --check: ${manifest.entries.length} entries consistent with the tracked tree`)
}

// ---------------------------------------------------------------------------
// Overlay mode: materialize the pinned open artifact into the consuming repo.
// ---------------------------------------------------------------------------
function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function readLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return []
  let ledger
  try {
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  } catch (error) {
    fail(`cannot parse ${LEDGER_NAME} (delete it to reset the overlay state): ${error.message}`)
  }
  if (!Array.isArray(ledger.paths) || !ledger.paths.every(p => typeof p === 'string')) {
    fail(`${LEDGER_NAME} is malformed (delete it to reset the overlay state)`)
  }
  return ledger.paths
}

// Apply the overlay entries from `manifest` (whose source tree sits at `sourceDir`) into
// `root`. Ordering is the safety contract: validate every destination, run the collision
// gate against resolved git-tracked paths, remove ledgered stale paths, copy, write the
// new ledger. Nothing is removed or copied before the first two steps pass.
function materializeOverlay(root, sourceDir, manifest) {
  const overlayEntries = manifest.entries.filter(entry => entry.overlay)
  if (overlayEntries.length === 0) fail('pinned manifest has no overlay entries')

  // Every destination resolves strictly inside the consuming repo root. Manifest paths
  // are already sanitized by loadManifest; this guards the resolved form too.
  const targets = []
  for (const entry of overlayEntries) {
    const target = resolveInsideRoot(root, entry.path)
    if (!target) fail(`overlay path escapes the repo root: ${entry.path}`)
    targets.push({ entry, target })
  }

  // Collision gate on RESOLVED paths: an overlay destination that is (or contains, or is
  // itself) a git-tracked path in the consuming repo means the boundary drifted. Fail
  // loudly before any removal; fix the manifest or the consuming tree, never both copies.
  const tracked = gitTrackedFiles(root)
  const trackedResolved = tracked.map(f => path.resolve(root, f))
  const trackedResolvedSet = new Set(trackedResolved)
  const collisions = []
  for (const { entry, target } of targets) {
    if (trackedResolvedSet.has(target)) {
      collisions.push(entry.path)
      continue
    }
    if (entry.type === 'dir') {
      const prefix = target + path.sep
      collisions.push(...trackedResolved.filter(f => f.startsWith(prefix)).map(f => path.relative(root, f)))
    }
  }
  if (collisions.length > 0) {
    for (const hit of collisions.slice(0, 50)) console.error(`sync-open: collision with tracked path: ${hit}`)
    fail(`${collisions.length} tracked path(s) collide with overlay entries`)
  }

  // Ledger reconciliation: remove paths a previous run materialized that the current
  // pin's manifest no longer lists, so a dropped or renamed entry leaves no stale files.
  const ledgerPath = path.join(root, LEDGER_NAME)
  const previousPaths = readLedger(ledgerPath)
  const currentPaths = new Set(overlayEntries.map(entry => entry.path))
  let removed = 0
  for (const stale of previousPaths) {
    if (currentPaths.has(stale)) continue
    if (!isSafeRelativePath(stale)) {
      fail(`${LEDGER_NAME} contains an invalid path (delete it to reset the overlay state): ${JSON.stringify(stale)}`)
    }
    const resolved = resolveInsideRoot(root, stale)
    if (!resolved) {
      fail(`${LEDGER_NAME} contains a path outside the repo root (delete it to reset the overlay state): ${stale}`)
    }
    const prefix = resolved + path.sep
    if (trackedResolvedSet.has(resolved) || trackedResolved.some(f => f.startsWith(prefix))) {
      console.log(`sync-open: ledger path ${stale} is now git-tracked in the consuming repo; leaving it in place`)
      continue
    }
    fs.rmSync(resolved, { recursive: true, force: true })
    removed += 1
  }

  // Materialize at canonical paths, byte-for-byte.
  let files = 0
  for (const { entry, target } of targets) {
    const source = path.join(sourceDir, entry.path)
    if (!fs.existsSync(source)) fail(`pinned tree is missing overlay path: ${entry.path}`)
    fs.rmSync(target, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.cpSync(source, target, { recursive: true })
    files += 1
  }

  fs.writeFileSync(
    ledgerPath,
    JSON.stringify({ version: 1, note: 'Generated by scripts/sync-open.mjs; lists overlay paths for stale cleanup.', paths: [...currentPaths].sort() }, null, 2) + '\n'
  )
  return { files, removed }
}

async function overlay() {
  const root = process.cwd()
  let lock
  try {
    lock = JSON.parse(fs.readFileSync(path.join(root, LOCK_NAME), 'utf8'))
  } catch (error) {
    fail(`cannot read ${LOCK_NAME}: ${error.message}`)
  }
  const { repo, sha, tarballSha256 } = lock
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) fail(`${LOCK_NAME}: invalid repo`)
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) fail(`${LOCK_NAME}: sha must be 40 hex chars`)
  if (!/^[0-9a-f]{64}$/.test(tarballSha256 ?? '')) fail(`${LOCK_NAME}: tarballSha256 must be 64 hex chars`)

  // Download (cached by SHA; the checksum re-verifies the cache too).
  const cacheDir = path.join(root, 'node_modules', '.cache', 'open-artifact')
  fs.mkdirSync(cacheDir, { recursive: true })
  const tarPath = path.join(cacheDir, `${sha}.tar.gz`)
  let tarball
  if (fs.existsSync(tarPath)) {
    tarball = fs.readFileSync(tarPath)
  } else {
    const url = `https://codeload.github.com/${repo}/tar.gz/${sha}`
    console.log(`sync-open: downloading ${url}`)
    const response = await fetch(url)
    if (!response.ok) fail(`download failed: HTTP ${response.status} for ${url}`)
    tarball = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(tarPath, tarball)
  }
  const actual = sha256(tarball)
  if (actual !== tarballSha256) {
    fs.rmSync(tarPath, { force: true })
    fail(`tarball sha256 mismatch: expected ${tarballSha256}, got ${actual}`)
  }

  // Extract to a temp dir (codeload tarballs wrap everything in <repo>-<sha>/).
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-artifact-'))
  try {
    execFileSync('tar', ['-xzf', tarPath, '-C', extractDir, '--strip-components=1'])

    // The OPEN repo owns the definition of what is open: read the manifest from the pin.
    const manifest = loadManifest(path.join(extractDir, MANIFEST_NAME))
    const { files, removed } = materializeOverlay(root, extractDir, manifest)
    const staleNote = removed > 0 ? `, removed ${removed} stale ledger path(s)` : ''
    console.log(`sync-open: materialized ${files} overlay entries from ${repo}@${sha.slice(0, 12)}${staleNote}`)
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true })
  }
}

if (process.argv.includes('--check')) {
  check()
} else {
  await overlay()
}
