// Surgical, auditable settle of judge re-roll churn from the 2026-11-01 story-runner
// scheduling refresh (PR #556), per the re-judge stability policy
// (docs/ACCURACY.md "Human review points" §1) and the committed precedents
// revert-churn-compliance-automation-refresh-506.ts /
// revert-churn-desktop-os-refresh-wave.ts / revert-churn-robotics-platforms-refresh-wave.ts.
//
// The PR #556 review named these cells: cal-com/api-machine-spec,
// cal-com/ai-meeting-time-optimization, cal-com/automation-scheduled-jobs,
// cal-com/cross-calendar-blocking-sync, savvycal/focus-time-defense (all restored by
// earlier repair commits on the branch), and reclaim/agentic-mcp-server, whose
// partial -> none drop rested on the refresh deleting the recorded runtime probes
// reclaim-probe-rt-1 / reclaim-probe-rt-2 (restored to the pack with preserve: true
// before this settle, alongside motion-probe-rt-1 / motion-probe-rt-2), so the
// downgrade no longer rests on support loss and settles here.
//
// Rule, per cell: a (verdict, quality) flip vs the pre-refresh baseline stands only when it
// rests on evidence that actually changed. Content-aware extension for this wave (the review
// found re-crawled packs minting NEW ids for UNCHANGED excerpts, e.g. drata-docs-49
// repeating drata-docs-40): an id added by the refresh whose normalized excerpt already
// exists verbatim in the baseline pack is NOT changed evidence. Changed evidence is:
//   - an added id whose excerpt text is new to the pack,
//   - a removed id,
//   - a same-id excerpt replacement.
// A flip citing none of that (on either side) is sampling churn and converges back to the
// committed baseline verdict; the judge cache is patched in place (same hash, restored
// verdict) so a future judge run does not resurrect the churn. A revert is skipped (and
// reported) when the baseline verdict cites an id no longer in the pack.
//
// Baseline: origin/main at settle time (main's scheduling files are pre-refresh; the
// arena changed only in this PR).
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-scheduling-refresh-556.ts [--write]
//   (default: dry run, prints the plan only)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const CAT = 'scheduling'
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

function gitShowJson<T>(ref: string, file: string): T | null {
  try {
    const raw = execSync(`git show ${ref}:${file}`, {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 64,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(raw.toString('utf8')) as T
  } catch {
    return null
  }
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Content-equivalence for re-crawled excerpts: the refresh reformats bullet lists and
// truncates sentences without adding facts. Two excerpts are the same evidence when their
// normalized text matches, one contains the other, or their token sets overlap >= 0.8.
function nearDup(a: string, b: string): boolean {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return na === nb
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size) >= 0.8
}

// Ids whose evidence actually changed vs baseline: added-with-new-excerpt, removed, or
// same-id excerpt replaced. Added ids repeating a baseline excerpt are recorded separately.
function changedIdsFor(productId: string): { changed: Set<string>; repeats: Map<string, string> } {
  const file = `open-rankings/${CAT}/evidence/${productId}.json`
  const baseItems = gitShowJson<EvidenceItem[]>(BASELINE_REF, file) ?? []
  const baseById = new Map(baseItems.map((i) => [i.id, i]))
  const freshItems: EvidenceItem[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'evidence', `${productId}.json`), 'utf8'),
  )
  const freshIds = new Set(freshItems.map((i) => i.id))
  const changed = new Set<string>()
  const repeats = new Map<string, string>()
  for (const item of freshItems) {
    const old = baseById.get(item.id)
    if (old) {
      // same-id replacement counts as changed only when the content actually differs
      if (!nearDup(old.excerpt ?? '', item.excerpt ?? '')) changed.add(item.id)
      continue
    }
    const twin = baseItems.find((b) => nearDup(b.excerpt ?? '', item.excerpt ?? ''))
    if (twin) repeats.set(item.id, twin.id) // new id, repeated content: not changed evidence
    else changed.add(item.id) // genuinely new content
  }
  // Removals are content-aware too: the collect-community re-collect mints a new id for a
  // paraphrase of the same report, sometimes under an equivalent source URL (the PR #556
  // review's reclaim-comm-3 -> reclaim-comm-5-refresh-*, hn.algolia.com/api/v1/items/N vs
  // news.ycombinator.com/item?id=N for the same HN comment thread). A removed id whose
  // content survives in an equivalent-url fresh item (verbatim, containment, or token
  // overlap >= 0.5) is a re-mint, not lost support.
  // Equivalent source URLs: the HN API item endpoint and the HN web item page address the
  // same recorded comment thread.
  const canonUrl = (u: string | undefined): string => {
    if (!u) return ''
    const hn = u.match(/hn\.algolia\.com\/api\/v1\/items\/(\d+)/) ?? u.match(/news\.ycombinator\.com\/item\?id=(\d+)/)
    if (hn) return `hn:${hn[1]}`
    return u.replace(/\/+$/, '')
  }
  const overlap = (a: string, b: string): number => {
    const ta = new Set(norm(a).split(' '))
    const tb = new Set(norm(b).split(' '))
    if (!ta.size || !tb.size) return 0
    let shared = 0
    for (const t of ta) if (tb.has(t)) shared++
    return shared / Math.max(ta.size, tb.size)
  }
  // Re-minted community reports are condensed paraphrases, so the raw-token ratio can dip
  // under the bar on function words alone (reclaim-comm-3 vs its comm-5-refresh-* survivor
  // in the PR #556 review). Content survival compares the informative tokens: stopwords
  // stripped, shared share measured against the shorter excerpt.
  const STOP = new Set(
    ('a an and are as at be but by for from has have i if in into is it its like me my of on ' +
      'or our so than that the their them they this to was we were will with you your').split(' '),
  )
  const contentOverlap = (a: string, b: string): number => {
    const ta = new Set(norm(a).split(' ').filter((t) => t && !STOP.has(t)))
    const tb = new Set(norm(b).split(' ').filter((t) => t && !STOP.has(t)))
    if (!ta.size || !tb.size) return 0
    let shared = 0
    for (const t of ta) if (tb.has(t)) shared++
    return shared / Math.min(ta.size, tb.size)
  }
  for (const [id, old] of baseById) {
    if (freshIds.has(id)) continue
    const survivor = freshItems.find(
      (f) =>
        canonUrl(f.url) === canonUrl(old.url) &&
        (nearDup(old.excerpt ?? '', f.excerpt ?? '') ||
          overlap(old.excerpt ?? '', f.excerpt ?? '') >= 0.5 ||
          contentOverlap(old.excerpt ?? '', f.excerpt ?? '') >= 0.5),
    )
    if (survivor) repeats.set(id, survivor.id) // re-minted under a new id: not lost support
    else changed.add(id) // genuinely removed
  }
  return { changed, repeats }
}

function main(): void {
  const baselineRows = gitShowJson<VerdictRow[]>(BASELINE_REF, `open-rankings/${CAT}/verdicts.json`)
  if (!baselineRows) throw new Error(`missing verdicts at ${BASELINE_REF}`)
  const baseline = new Map(baselineRows.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const verdictsPath = path.join(ROOT, 'open-rankings', CAT, 'verdicts.json')
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))
  const packInfo = new Map<string, ReturnType<typeof changedIdsFor>>()
  const currentIdsByProduct = new Map<string, Set<string>>()
  let reverted = 0
  let stood = 0
  let skipped = 0

  for (let i = 0; i < current.length; i++) {
    const row = current[i]
    const key = `${row.productId}:${row.storyId}`
    const base = baseline.get(key)
    if (!base) continue // product or story new to the arena: nothing to settle against
    if (base.verdict === row.verdict && base.quality === row.quality) continue
    const pid = row.productId
    if (!packInfo.has(pid)) packInfo.set(pid, changedIdsFor(pid))
    const { changed, repeats } = packInfo.get(pid)!
    // Directional rule, the content-aware form of check-refresh-stability.mjs:
    // an upgrade stands only when the new verdict cites genuinely new content; a
    // downgrade stands only on support loss (a baseline citation removed or its
    // content changed). A downgrade citing only new positive content with its
    // prior support intact is reinterpretation.
    const rank: Record<string, number> = { none: 0, partial: 1, full: 2 }
    const citesNewContent = row.evidenceIds.some((id) => changed.has(id))
    const supportLoss = base.evidenceIds.some((id) => changed.has(id))
    const rankable = Object.hasOwn(rank, base.verdict) && Object.hasOwn(rank, row.verdict)
    const isUp =
      rankable &&
      (rank[row.verdict] > rank[base.verdict] ||
        (rank[row.verdict] === rank[base.verdict] && row.quality > base.quality))
    const isDown =
      rankable &&
      (rank[row.verdict] < rank[base.verdict] ||
        (rank[row.verdict] === rank[base.verdict] && row.quality < base.quality))
    const restsOnChange = isUp
      ? citesNewContent
      : isDown
        ? supportLoss
        : citesNewContent || supportLoss
    if (restsOnChange) {
      stood++
      continue
    }
    if (!currentIdsByProduct.has(pid)) {
      const items: EvidenceItem[] = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'evidence', `${pid}.json`), 'utf8'),
      )
      currentIdsByProduct.set(pid, new Set(items.map((e) => e.id)))
    }
    const curIds = currentIdsByProduct.get(pid)!
    // Restore the baseline verdict with citations remapped through re-mints (a removed id
    // whose content survives under a new same-url id cites the survivor instead).
    const restoredIds = base.evidenceIds.map((id) => (curIds.has(id) ? id : (repeats.get(id) ?? id)))
    if (restoredIds.some((id) => !curIds.has(id))) {
      skipped++
      console.log(`SKIP ${CAT}/${key}: baseline citation no longer resolves in the pack`)
      continue
    }
    const restored = { ...base, evidenceIds: restoredIds }
    reverted++
    const repeatNote = row.evidenceIds
      .filter((id) => repeats.has(id))
      .map((id) => `${id} repeats ${repeats.get(id)}`)
      .join(', ')
    console.log(
      `REVERT ${CAT}/${key}  ${row.verdict}(q${row.quality}) -> baseline ${base.verdict}(q${base.quality})` +
        (repeatNote ? `  [${repeatNote}]` : ''),
    )
    if (WRITE) {
      current[i] = { ...restored }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, pid, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { verdict: VerdictRow }
      cache.verdict = { ...restored }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE) fs.writeFileSync(verdictsPath, `${JSON.stringify(current, null, 2)}\n`)
  console.log(
    `${CAT}: ${reverted} churn cell(s) ${WRITE ? 'settled to baseline' : 'would settle to baseline'}, ` +
      `${stood} flip(s) stand on changed evidence, ${skipped} skipped (baseline ${BASELINE_REF})`,
  )
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
