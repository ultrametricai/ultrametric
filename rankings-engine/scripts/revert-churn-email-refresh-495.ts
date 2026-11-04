// Surgical, auditable settle of judge re-roll churn from the 2026-10-27 story-runner
// email refresh (PR #495), per the re-judge stability policy and the committed
// precedents revert-churn-compliance-automation-refresh-506.ts /
// revert-churn-desktop-os-refresh-wave.ts.
//
// Rule, per cell: this wave settles exactly the rows the CI gate flags. The gate
// (check-refresh-stability.mjs's unsupportedFlips, built on evidence-source.mjs's
// sourceHash-aware newSourceSupport / supportDisappeared) already applies the
// content-aware churn doctrine: an upgrade stands only on a verified new source,
// a downgrade stands only on verified support loss, and a re-minted or reworded
// excerpt of an unchanged source is not new evidence. A flagged flip is therefore
// sampling churn and converges back to the committed baseline verdict. The judge
// cache is patched in place (restored verdict) so a future judge run does not
// resurrect the churn. When a reverted cell's baseline citation has no survivor in
// the refreshed pack (the re-collect sampled different comments from the same
// immutable source, e.g. a Hacker News thread), the baseline evidence row is
// restored verbatim into the pack — the keyed-union rule: a dropped excerpt with no
// verified source change is collection churn, not lost support. Because cellHash
// covers every evidence row of the pack, each restore invalidates every cached hash
// for that product; the settle recomputes those hashes under the prompt version each
// cache was minted with (recovered by matching the stored hash against the
// pre-restore pack), so the whole pack's caches stay consistent instead of silently
// going stale and re-judging on the next category run.
//
// Baseline: origin/main, the merge-base of the refresh branch at settle time
// (main's email files are pre-refresh; the arena changed only in this PR).
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-email-refresh-495.ts [--write]
//   (default: dry run, prints the plan only)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
// The gate's own predicate, so the settle and the check cannot diverge.
import { unsupportedFlips } from './check-refresh-stability.mjs'
import { cellHash } from '../stages/judge'

type JudgeStory = Parameters<typeof cellHash>[0]
type JudgeEvidence = Parameters<typeof cellHash>[1]
const PROMPT_VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const CAT = 'email'
const BASELINE_REF = process.env.BASELINE_REF ?? 'origin/main'

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}
type EvidenceItem = { id: string; tier?: string; url?: string; excerpt?: string }

function gitShowJson<T>(ref: string, file: string): T {
  const raw = execSync(`git show ${ref}:${file}`, {
    cwd: ROOT,
    maxBuffer: 1024 * 1024 * 64,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return JSON.parse(raw.toString('utf8')) as T
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const overlap = (a: string, b: string): number => {
  const ta = new Set(norm(a).split(' '))
  const tb = new Set(norm(b).split(' '))
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

// A baseline citation whose id the refresh dropped but whose content survives in a
// same-url fresh item (verbatim, containment, or token overlap >= 0.5) is a re-mint;
// the restored verdict cites the survivor (same convention as the #506 settle).
// Content equivalence is mandatory: a shared id stem or url alone is not survivorship,
// because a multi-comment source (an HN thread) re-mints unrelated comments under the
// same url, and citing one of those would change what the verdict rests on.
function remintMap(baseItems: EvidenceItem[], freshItems: EvidenceItem[]): Map<string, string> {
  const freshIds = new Set(freshItems.map((i) => i.id))
  const repeats = new Map<string, string>()
  for (const old of baseItems) {
    if (freshIds.has(old.id)) continue
    const oldNorm = norm(old.excerpt ?? '')
    const survivor = freshItems.find((f) => {
      if (f.url !== old.url) return false
      const fNorm = norm(f.excerpt ?? '')
      return (
        oldNorm === fNorm ||
        oldNorm.includes(fNorm) ||
        fNorm.includes(oldNorm) ||
        overlap(old.excerpt ?? '', f.excerpt ?? '') >= 0.5
      )
    })
    if (survivor) repeats.set(old.id, survivor.id)
  }
  return repeats
}

function main(): void {
  const verdictsFile = `open-rankings/${CAT}/verdicts.json`
  const before = gitShowJson<VerdictRow[]>(BASELINE_REF, verdictsFile)
  const verdictsPath = path.join(ROOT, verdictsFile)
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))

  const oldPacks: Record<string, EvidenceItem[]> = {}
  const newPacks: Record<string, EvidenceItem[]> = {}
  const preRestorePacks: Record<string, EvidenceItem[]> = {}
  for (const productId of new Set(before.map((r) => r.productId))) {
    const packFile = `open-rankings/${CAT}/evidence/${productId}.json`
    oldPacks[productId] = gitShowJson<EvidenceItem[]>(BASELINE_REF, packFile)
    newPacks[productId] = JSON.parse(fs.readFileSync(path.join(ROOT, packFile), 'utf8'))
    preRestorePacks[productId] = newPacks[productId].map((item) => ({ ...item }))
  }

  const flagged = unsupportedFlips(before, current, oldPacks, newPacks) as VerdictRow[]
  const flaggedKeys = new Set(flagged.map((r) => `${r.productId}:${r.storyId}`))
  const baseline = new Map(before.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const remints = new Map<string, Map<string, string>>()

  let reverted = 0
  let restoredEvidence = 0
  const packsToWrite = new Set<string>()
  for (let i = 0; i < current.length; i++) {
    const row = current[i]
    const key = `${row.productId}:${row.storyId}`
    if (!flaggedKeys.has(key)) continue
    const base = baseline.get(key)
    if (!base) continue
    const pid = row.productId
    if (!remints.has(pid)) remints.set(pid, remintMap(oldPacks[pid] ?? [], newPacks[pid] ?? []))
    const repeats = remints.get(pid)!
    const curIds = new Set((newPacks[pid] ?? []).map((e) => e.id))
    const restoredIds = base.evidenceIds.map((id) => (curIds.has(id) ? id : (repeats.get(id) ?? id)))
    // Keyed-union evidence restore: a baseline citation with no survivor in the
    // refreshed pack returns verbatim (the re-collect dropped it without any
    // verified change to its source).
    for (const id of restoredIds.filter((rid) => !curIds.has(rid))) {
      const item = (oldPacks[pid] ?? []).find((e) => e.id === id)
      if (!item) throw new Error(`${CAT}/${key}: baseline cites ${id} but ${BASELINE_REF} pack lacks it`)
      newPacks[pid].push({ ...item })
      curIds.add(id)
      packsToWrite.add(pid)
      restoredEvidence++
      console.log(`RESTORE ${CAT}/${pid} evidence ${id} (dropped by re-collect, source unchanged)`)
    }
    const restored = { ...base, evidenceIds: restoredIds }
    reverted++
    console.log(
      `REVERT ${CAT}/${key}  ${row.verdict}(q${row.quality}) -> baseline ${base.verdict}(q${base.quality})`,
    )
    if (WRITE) {
      current[i] = { ...restored }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, pid, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { verdict: VerdictRow }
      cache.verdict = { ...restored }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE) {
    fs.writeFileSync(verdictsPath, `${JSON.stringify(current, null, 2)}\n`)
    for (const pid of packsToWrite) {
      const packPath = path.join(ROOT, 'open-rankings', CAT, 'evidence', `${pid}.json`)
      fs.writeFileSync(packPath, `${JSON.stringify(newPacks[pid], null, 2)}\n`)
    }
    // Pack restores invalidate every cached hash for the product (cellHash covers the
    // whole pack). Recompute each cache's hash under the prompt version it was minted
    // with, recovered by matching the stored hash against the pre-restore pack; a hash
    // minted under a different pack state stays untouched (it already misses cleanly).
    const stories: JudgeStory[] = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'stories.json'), 'utf8'),
    )
    const storyById = new Map(stories.map((s) => [s.id, s]))
    for (const pid of packsToWrite) {
      const prePack = preRestorePacks[pid] as JudgeEvidence
      const postPack = newPacks[pid] as JudgeEvidence
      const cacheDir = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, pid)
      let rehashed = 0
      for (const file of fs.readdirSync(cacheDir).filter((f) => f.endsWith('.json'))) {
        const story = storyById.get(file.replace(/\.json$/, ''))
        if (!story) continue
        const cachePath = path.join(cacheDir, file)
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as { hash: string }
        const minted = PROMPT_VERSIONS.find((v) => cellHash(story, prePack, v) === cache.hash)
        if (!minted) continue
        cache.hash = cellHash(story, postPack, minted)
        fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
        rehashed++
      }
      console.log(`${CAT}/${pid}: ${rehashed} judge cache hash(es) recomputed after pack restore`)
    }
    const residual = unsupportedFlips(before, current, oldPacks, newPacks) as VerdictRow[]
    console.log(`residual flagged rows after settle: ${residual.length}`)
    for (const r of residual) console.log(`  RESIDUAL ${CAT}/${r.productId}/${r.storyId}`)
  }
  console.log(
    `${CAT}: ${reverted} churn cell(s) ${WRITE ? 'settled to baseline' : 'would settle to baseline'}, ` +
      `${restoredEvidence} dropped citation(s) restored (baseline ${BASELINE_REF})`,
  )
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
