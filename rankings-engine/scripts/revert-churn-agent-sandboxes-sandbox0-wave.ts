// Surgical, auditable settle of judge re-roll churn from the PR #443 round-2 sandbox0 re-judge
// (the revert-churn.ts / revert-churn-equity-eqvista-wave.ts precedent: a re-roll citing no
// new evidence converges back to the committed verdicts, so flips that do not rest on the
// evidence that actually changed are sampling churn and revert to the pre-roll baseline).
//
// Scope: sandbox0 (agent-sandboxes). The round-2 evidence change was ONE row recorded for ONE
// cell: sandbox0-docs-38, the pause-resume.md TTL table (ttl soft timeout / hard_ttl deletion),
// recorded for auto-teardown-timeouts after the round-2 review showed that cell holding a
// partial on pause/billing evidence alone. Baseline is 772fe0489b, the commit the re-roll
// started from.
//
// Rule, per cell: the settled state is the ROLL_REF verdict for the target stories whose
// roll verdict rests on the changed row, and the BASELINE_REF verdict for every other cell
// that flipped; judge caches are patched in place (same hash, settled verdict object) so a
// future judge run does not resurrect the churn.
// The round-3 review flagged the textbook churn case: automation-rules-engine rode the TTL
// row from partial q4 to partial q5 while its own rationale concedes there is no rules engine
// and users must build reacting actions outside the product — fixed behaviors are not
// user-defined event-to-action rules. The same roll flipped ten other cells in both
// directions (e.g. pause-resume-state full→partial, agentic-mcp-client none→na) on unchanged
// or unrelated evidence; those revert to baseline.
// Two cells stand on the roll verdict, because it rests on the row recorded in round 2:
// auto-teardown-timeouts (full q8 on the ttl/hard_ttl table) and — per the round-4 review,
// which showed the baseline rationale ("no deletion documented") is false against the
// enriched pack — privacy-retention-controls (partial q5: hard_ttl expiry durably requests
// deletion of identity and RootFS state).
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-agent-sandboxes-sandbox0-wave.ts [--write]

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

const CAT = 'agent-sandboxes'
const PRODUCT = 'sandbox0'
const BASELINE_REF = '772fe0489b'
const ROLL_REF = '586cad2ecd'
const CHANGED_IDS = new Set(['sandbox0-docs-38'])
// The stories whose roll verdicts rest on the changed row (round-2 fix 586cad2ecd;
// round-4 review for privacy-retention-controls).
const TARGET_STORIES = new Set(['auto-teardown-timeouts', 'privacy-retention-controls'])

function readCurrent(): VerdictRow[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), 'utf8'))
}

function readRef(ref: string): VerdictRow[] {
  const raw = execSync(`git show ${ref}:open-rankings/${CAT}/verdicts.json`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 })
  return JSON.parse(raw.toString('utf8'))
}

function main(): void {
  const baseline = new Map(readRef(BASELINE_REF).map((r) => [`${r.productId}:${r.storyId}`, r]))
  const roll = new Map(readRef(ROLL_REF).map((r) => [`${r.productId}:${r.storyId}`, r]))
  const current = readCurrent()
  const reverted: string[] = []

  for (let i = 0; i < current.length; i++) {
    const row = current[i]
    if (row.productId !== PRODUCT) continue
    const key = `${row.productId}:${row.storyId}`
    const base = baseline.get(key)
    const rolled = roll.get(key)
    if (!base || !rolled) continue
    const target = TARGET_STORIES.has(row.storyId) && rolled.evidenceIds.some((id) => CHANGED_IDS.has(id))
    const settled = target ? rolled : base // target cells stand on the roll verdict; everything else settles to baseline
    if (settled.verdict === row.verdict && settled.quality === row.quality) continue
    console.log(`${CAT}/${PRODUCT}:${row.storyId}  ${row.verdict}(q${row.quality}) -> ${target ? 'roll' : 'baseline'} ${settled.verdict}(q${settled.quality})`)
    reverted.push(row.storyId)
    if (WRITE) {
      current[i] = { ...settled }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, PRODUCT, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
      cache.verdict = { ...settled }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE && reverted.length) {
    fs.writeFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), `${JSON.stringify(current, null, 2)}\n`)
  }
  console.log(`${CAT}/${PRODUCT}: ${reverted.length} cell(s) ${WRITE ? 'reverted' : 'would revert'} (baseline ${BASELINE_REF}, roll ${ROLL_REF})`)
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
