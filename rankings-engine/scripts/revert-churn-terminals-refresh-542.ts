// Surgical, auditable settle of judge re-roll churn from the 2026-10-30 story-runner
// terminals refresh (PR #542), per the re-judge stability policy
// (docs/ACCURACY.md "Human review points" §1) and the committed precedents
// revert-churn-compliance-automation-refresh-506.ts / revert-churn-desktop-os-refresh-wave.ts.
//
// Rule, per cell: a (verdict, quality) flip vs the pre-refresh baseline stands only when it
// rests on evidence that actually changed. Content-aware changed evidence is:
//   - an added id whose excerpt text is new to the pack (an added id that near-duplicates a
//     baseline excerpt is NOT new),
//   - a removed id,
//   - a same-id excerpt replacement (a same-id near-dup replacement is NOT a change).
// Directional stability: an upgrade stands only citing genuinely new content; a downgrade
// stands only on support loss; a non-rankable verdict change needs either side changed.
// A flip resting on none of that is sampling churn and converges back to the committed
// baseline verdict; the judge cache is patched in place (same hash, restored verdict) so a
// future judge run does not resurrect the churn.
//
// Extensions for this settle, from the PR #542 review threads:
//
// A. Restored recorded probes (review: "Recorded checks disappear", wezterm.json). The
//    refresh deleted the recorded runtime checks kitty-probe-rt-1, wezterm-probe-rt-1,
//    ghostty-probe-rt-1, and alacritty-probe-rt-1. They are restored to their packs with
//    `preserve: true` before this script runs, so they are unchanged evidence here.
//
// B. Probe-anchored flips (same thread: WezTerm fell full -> partial for headless use and
//    agent terminal control only because the recorded check vanished). For a cell whose
//    baseline verdict cites one of the restored probe rows, support loss consisting solely
//    of community-rotation removals (community-tier ids dropped by the re-collect) does not
//    sustain the flip: the hands-on record that grounded the baseline grade is back in the
//    pack. Such a cell settles to baseline, with baseline citations filtered to ids that
//    resolve in the current pack. Upgrades still stand only citing genuinely new content.
//
// C. Review-named overreach cells (threads on ghostty/agentic-autonomous-automation.json,
//    warp/ai-privacy-controls.json, warp/fonts-ligatures.json). These flips cite new
//    content, but the review verified the content does not establish the graded story, so
//    "genuinely new content" is not met and they settle to baseline:
//      - ghostty:agentic-autonomous-automation (partial -> baseline disputed): the new
//        rationale still says unattended execution depends on external tools.
//      - ghostty:tmux-compat (partial -> baseline none): citations show Neovim/htop working
//        and a request for tmux control mode, not tmux delivery.
//      - warp:ai-privacy-controls (partial -> baseline disputed): the hands-on report that
//        Active AI sent terminal data to LLMs without consent survives in the pack
//        (warp-comm-5-refresh-c863a0652662cc18, substituted for the rotated warp-comm-1);
//        toggles to disable the features do not resolve the dispute.
//      - warp:fonts-ligatures (partial -> baseline none): the single citation shows font
//        selection only; the rationale concedes ligatures, fallback, and tuning are absent.
//
// Baseline: origin/main as fetched at settle time (778dbac8f2; the arena changed only in
// this PR). A revert outside extensions B/C is skipped (and reported) when the baseline
// verdict cites an id no longer in the pack.
//
// D. Round-2 exclusions (review: "Old grades restore unsupported credit"). Three baseline
//    grades fail the v5 partial-credit boundary (developer building blocks and related
//    features earn no credit), so the refresh none judgments are the valid current-rules
//    answers and this script must not restore the old credit:
//      - ghostty:agentic-headless (credit was for the embeddable libghostty-vt library),
//      - wezterm:automation-bulk-operations (credit was for a user-scriptable loop),
//      - kitty:api-interactive-docs (credit was for runnable commands, not interactive docs).
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-terminals-refresh-542.ts [--write]
//   (default: dry run, prints the plan only)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const CAT = 'terminals'
const BASELINE_REF = process.env.BASELINE_REF ?? 'origin/main'

const RESTORED_PROBES = new Set([
  'kitty-probe-rt-1',
  'wezterm-probe-rt-1',
  'ghostty-probe-rt-1',
  'alacritty-probe-rt-1',
])

// Extension D: baseline grades that fail the v5 partial-credit boundary; never restored.
const EXCLUDE_RESTORE = new Set([
  'ghostty:agentic-headless',
  'wezterm:automation-bulk-operations',
  'kitty:api-interactive-docs',
])

// Extension C: review-named cells whose new citations do not establish the story.
// evidenceSubstitutions maps a rotated baseline citation to the surviving row with the
// same hands-on content; baseline citations with no survivor are dropped.
const FORCE_BASELINE = new Map<string, { reason: string; substitutions?: Record<string, string> }>([
  [
    'ghostty:agentic-autonomous-automation',
    { reason: 'new citations show scripting, not unattended execution (review thread)' },
  ],
  [
    'ghostty:tmux-compat',
    { reason: 'new citations show Neovim/htop and a control-mode request, not tmux delivery (review thread)' },
  ],
  [
    'warp:ai-privacy-controls',
    {
      reason: 'disable toggles do not resolve the recorded data-sharing report (review thread)',
      substitutions: { 'warp-comm-1': 'warp-comm-5-refresh-c863a0652662cc18' },
    },
  ],
  [
    'warp:fonts-ligatures',
    { reason: 'single citation shows font selection only; required features conceded absent (review thread)' },
  ],
])

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

// Content-equivalence for re-crawled excerpts: two excerpts are the same evidence when
// their normalized text matches, one contains the other, or their token sets overlap >= 0.8.
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

type PackDelta = {
  changed: Set<string>
  repeats: Map<string, string>
  removedCommunity: Set<string>
  currentIds: Set<string>
}

// Ids whose evidence actually changed vs baseline: added-with-new-excerpt, removed, or
// same-id excerpt replaced. Added ids repeating a baseline excerpt are recorded separately.
// Removed community-tier ids are tracked for extension B.
function changedIdsFor(productId: string): PackDelta {
  const file = `open-rankings/${CAT}/evidence/${productId}.json`
  const baseItems = gitShowJson<EvidenceItem[]>(BASELINE_REF, file) ?? []
  const baseById = new Map(baseItems.map((i) => [i.id, i]))
  const freshItems: EvidenceItem[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'evidence', `${productId}.json`), 'utf8'),
  )
  const freshIds = new Set(freshItems.map((i) => i.id))
  const changed = new Set<string>()
  const repeats = new Map<string, string>()
  const removedCommunity = new Set<string>()
  for (const item of freshItems) {
    const old = baseById.get(item.id)
    if (old) {
      if (!nearDup(old.excerpt ?? '', item.excerpt ?? '')) changed.add(item.id)
      continue
    }
    const twin = baseItems.find((b) => nearDup(b.excerpt ?? '', item.excerpt ?? ''))
    if (twin) repeats.set(item.id, twin.id)
    else changed.add(item.id)
  }
  for (const [id, item] of baseById) {
    if (freshIds.has(id)) continue
    changed.add(id)
    if (item.tier === 'community') removedCommunity.add(id)
  }
  return { changed, repeats, removedCommunity, currentIds: freshIds }
}

function main(): void {
  const baselineRows = gitShowJson<VerdictRow[]>(BASELINE_REF, `open-rankings/${CAT}/verdicts.json`)
  if (!baselineRows) throw new Error(`missing verdicts at ${BASELINE_REF}`)
  const baseline = new Map(baselineRows.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const verdictsPath = path.join(ROOT, 'open-rankings', CAT, 'verdicts.json')
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))
  const packInfo = new Map<string, PackDelta>()
  let reverted = 0
  let stood = 0
  let skipped = 0

  for (let i = 0; i < current.length; i++) {
    const row = current[i]
    const key = `${row.productId}:${row.storyId}`
    const base = baseline.get(key)
    if (!base) continue // product or story new to the arena: nothing to settle against
    if (base.verdict === row.verdict && base.quality === row.quality) continue
    if (EXCLUDE_RESTORE.has(key)) {
      stood++
      console.log(`EXCLUDE ${CAT}/${key}: baseline grade fails the v5 partial-credit boundary; refresh judgment stands`)
      continue
    }
    const pid = row.productId
    if (!packInfo.has(pid)) packInfo.set(pid, changedIdsFor(pid))
    const { changed, repeats, removedCommunity, currentIds } = packInfo.get(pid)!
    const rank: Record<string, number> = { none: 0, partial: 1, full: 2 }
    const citesNewContent = row.evidenceIds.some((id) => changed.has(id))
    const lostIds = base.evidenceIds.filter((id) => changed.has(id) && !currentIds.has(id))
    const replacedIds = base.evidenceIds.filter((id) => changed.has(id) && currentIds.has(id))
    let supportLoss = lostIds.length > 0 || replacedIds.length > 0
    // Extension B: baseline cites a restored recorded probe, and the only support loss is
    // community rotation: the hands-on basis for the baseline grade is intact.
    const probeAnchored = base.evidenceIds.some((id) => RESTORED_PROBES.has(id))
    if (
      probeAnchored &&
      supportLoss &&
      replacedIds.length === 0 &&
      lostIds.every((id) => removedCommunity.has(id))
    ) {
      supportLoss = false
    }
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
    const forced = FORCE_BASELINE.get(key)
    if (restsOnChange && !forced) {
      stood++
      continue
    }
    // Baseline citations must resolve in the current pack. Extensions B and C settle with
    // citations filtered to resolvable ids (plus documented substitutions); plain-rule
    // reverts keep the conservative skip.
    const substitutions = forced?.substitutions ?? {}
    const restoredIds = base.evidenceIds
      .map((id) => substitutions[id] ?? id)
      .filter((id) => currentIds.has(id))
    const droppedIds = base.evidenceIds.filter(
      (id) => !currentIds.has(substitutions[id] ?? id),
    )
    if (droppedIds.length > 0 && !forced && !probeAnchored) {
      skipped++
      console.log(`SKIP ${CAT}/${key}: baseline citation no longer resolves in the pack`)
      continue
    }
    reverted++
    const repeatNote = row.evidenceIds
      .filter((id) => repeats.has(id))
      .map((id) => `${id} repeats ${repeats.get(id)}`)
      .join(', ')
    console.log(
      `REVERT ${CAT}/${key}  ${row.verdict}(q${row.quality}) -> baseline ${base.verdict}(q${base.quality})` +
        (forced ? `  [forced: ${forced.reason}]` : '') +
        (droppedIds.length > 0 ? `  [dropped rotated citations: ${droppedIds.join(', ')}]` : '') +
        (repeatNote ? `  [${repeatNote}]` : ''),
    )
    if (WRITE) {
      current[i] = { ...base, evidenceIds: restoredIds }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, pid, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { verdict: VerdictRow }
      cache.verdict = { ...base, evidenceIds: restoredIds }
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
