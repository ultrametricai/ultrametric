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
//     machine-enforced.
//
//   node scripts/sync-open.mjs --check
//     Manifest-drift gate, for the OPEN repo's CI. Validates the committed open-manifest.json
//     against the current git-tracked tree: every entry path exists; every tracked file under
//     a split directory is covered by exactly one most-specific entry; overlay entries are
//     open; the wholly-closed top-level dirs carry no open entries.
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

function fail(message) {
  console.error(`sync-open: ${message}`)
  process.exit(1)
}

function gitTrackedFiles(cwd) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd, maxBuffer: 1024 * 1024 * 512 })
  return out.toString('utf8').split('\0').filter(Boolean)
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
    if (typeof entry.path !== 'string' || entry.path === '' || entry.path.startsWith('/') ||
        entry.path.endsWith('/') || entry.path.split('/').includes('..')) {
      fail(`invalid entry path: ${JSON.stringify(entry.path)}`)
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

  // 2. Split-dir completeness: every tracked file under a split dir has a covering entry.
  for (const splitDir of manifest.splitDirs ?? []) {
    const prefix = splitDir + '/'
    for (const file of tracked) {
      if (!file.startsWith(prefix)) continue
      if (!coveringEntry(manifest, file)) errors.push(`uncovered file in split dir: ${file}`)
    }
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
    const overlayEntries = manifest.entries.filter(entry => entry.overlay)
    if (overlayEntries.length === 0) fail('pinned manifest has no overlay entries')

    // Collision gate: an overlay path that is git-tracked in the consuming repo means the
    // boundary drifted. Fail loudly; fix the manifest or the consuming tree, never both copies.
    const tracked = gitTrackedFiles(root)
    const collisions = []
    for (const entry of overlayEntries) {
      const hits = entry.type === 'file'
        ? tracked.filter(f => f === entry.path)
        : tracked.filter(f => f.startsWith(entry.path + '/'))
      collisions.push(...hits)
    }
    if (collisions.length > 0) {
      for (const hit of collisions.slice(0, 50)) console.error(`sync-open: collision with tracked path: ${hit}`)
      fail(`${collisions.length} tracked path(s) collide with overlay entries`)
    }

    // Materialize at canonical paths, byte-for-byte.
    let files = 0
    for (const entry of overlayEntries) {
      const source = path.join(extractDir, entry.path)
      if (!fs.existsSync(source)) fail(`pinned tree is missing overlay path: ${entry.path}`)
      const target = path.join(root, entry.path)
      fs.rmSync(target, { recursive: true, force: true })
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.cpSync(source, target, { recursive: true })
      files += 1
    }
    console.log(`sync-open: materialized ${files} overlay entries from ${repo}@${sha.slice(0, 12)}`)
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true })
  }
}

if (process.argv.includes('--check')) {
  check()
} else {
  await overlay()
}
