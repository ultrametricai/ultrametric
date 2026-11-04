// Surgical, auditable settle of judge re-roll churn from the 2026-10-26 story-runner
// robotics-platforms refresh (PR #474), per the re-judge stability policy
// (docs/ACCURACY.md "Human review points" §1) and the committed precedents
// revert-churn-api-quality-sweep-wave.ts / revert-churn-equity-eqvista-wave.ts: a re-roll
// that does not rest on evidence that actually changed converges back to the committed
// verdicts; such flips are sampling churn and revert to the pre-roll baseline.
//
// Scope: every robotics-platforms product the refresh re-judged. Baseline is the merge-base the
// refresh branched from; the refresh state is the branch head the bot pushed. This refresh
// changed evidence three ways: it ADDED rows, it DROPPED one viam community row, and —
// because collect-community rewrites the comm-N sequence — it REPLACED the excerpt under
// several community ids (nvidia-isaac, ros2, viam) while keeping the ids. An
// id-only pack diff therefore undercounts changed evidence (review finding on the first
// settle pass), so changed ids are computed as: ids added, ids removed, and ids whose
// excerpt text differs between the two refs.
//
// Rule, per cell where the refresh changed (verdict, quality) vs baseline:
//   - the flip STANDS (refresh verdict kept) when the refresh verdict cites a changed id,
//     OR the baseline verdict cites a changed-or-removed id (restoring it would attach its
//     rationale and credit to evidence that no longer says what it cited);
//   - otherwise the flip is re-roll churn: the baseline verdict is restored in
//     verdicts.json and the judge cache is patched in place (same hash, reverted verdict
//     object) so a future judge run does not resurrect the churn.
// Cells in KEEP were individually re-rolled through the live judge after review and keep
// the engine's fresh verdict regardless of this rule.
//
// The script is idempotent from the two refs: it can re-run on a branch that already
// carries an earlier settle, un-reverting cells the earlier id-only pass over-reverted.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-robotics-platforms-refresh-wave.ts [--write]

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')

type VerdictRow = {
  productId: string
  storyId: string
  verdict: 'full' | 'partial' | 'none' | 'disputed' | 'na'
  quality: number
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  evidenceIds: string[]
}

type EvidenceItem = { id: string; excerpt?: string }

const CAT = 'robotics-platforms'
const BASELINE_REF = '9c82f764b9fa' // merge-base of the refresh branch with main (pre-roll state)
const REFRESH_REF = '5fa31d3865' // the refresh head the bot pushed (post-roll state)
// Cells re-rolled through the live judge after review; their fresh verdicts stand as produced.
const KEEP = new Set(['nvidia-isaac:agentic-nl-commands', 'viam:sim-to-real'])

function gitShowJson<T>(ref: string, file: string): T | null {
  try {
    const raw = execSync(`git show ${ref}:${file}`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64, stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw.toString('utf8')) as T
  } catch {
    return null
  }
}

// Ids whose evidence actually changed between the refs: added, removed, or same-id excerpt
// replaced (the collect-community rewrite case).
function changedIdsFor(productId: string): Set<string> {
  const file = `open-rankings/${CAT}/evidence/${productId}.json`
  const base = new Map((gitShowJson<EvidenceItem[]>(BASELINE_REF, file) ?? []).map((i) => [i.id, i.excerpt ?? '']))
  const fresh = new Map((gitShowJson<EvidenceItem[]>(REFRESH_REF, file) ?? []).map((i) => [i.id, i.excerpt ?? '']))
  const changed = new Set<string>()
  for (const [id, excerpt] of fresh) if (!base.has(id) || base.get(id) !== excerpt) changed.add(id)
  for (const id of base.keys()) if (!fresh.has(id)) changed.add(id)
  return changed
}

function main(): void {
  const baselineRows = gitShowJson<VerdictRow[]>(BASELINE_REF, `open-rankings/${CAT}/verdicts.json`)
  const refreshRows = gitShowJson<VerdictRow[]>(REFRESH_REF, `open-rankings/${CAT}/verdicts.json`)
  if (!baselineRows || !refreshRows) throw new Error(`missing verdicts at ${BASELINE_REF} or ${REFRESH_REF}`)
  const baseline = new Map(baselineRows.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const refresh = new Map(refreshRows.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), 'utf8'))
  const changedByProduct = new Map<string, Set<string>>()
  let reverted = 0
  let stood = 0

  for (let i = 0; i < current.length; i++) {
    const key = `${current[i].productId}:${current[i].storyId}`
    if (KEEP.has(key)) continue
    const base = baseline.get(key)
    const roll = refresh.get(key)
    if (!base || !roll) continue
    if (base.verdict === roll.verdict && base.quality === roll.quality) continue
    const pid = current[i].productId
    if (!changedByProduct.has(pid)) changedByProduct.set(pid, changedIdsFor(pid))
    const changed = changedByProduct.get(pid)!
    const flipRestsOnChange = roll.evidenceIds.some((id) => changed.has(id)) || base.evidenceIds.some((id) => changed.has(id))
    const target = flipRestsOnChange ? roll : base
    if (flipRestsOnChange) stood++
    else {
      reverted++
      console.log(`${CAT}/${key}  ${roll.verdict}(q${roll.quality}) -> baseline ${base.verdict}(q${base.quality})`)
    }
    if (WRITE && (current[i].verdict !== target.verdict || current[i].quality !== target.quality || current[i].rationale !== target.rationale)) {
      current[i] = { ...target }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, pid, `${current[i].storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
      cache.verdict = { ...target }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE) {
    fs.writeFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), `${JSON.stringify(current, null, 2)}\n`)
  }
  console.log(`${CAT}: ${reverted} churn cell(s) ${WRITE ? 'settled to baseline' : 'would settle to baseline'}, ${stood} flip(s) stand on changed evidence (baseline ${BASELINE_REF}, refresh ${REFRESH_REF})`)
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
