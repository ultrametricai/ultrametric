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
// Rule, per cell (the eqvista wave's tightened rule): if (verdict, quality) changed vs
// baseline, restore the baseline verdict and patch the judge cache in place (same hash,
// reverted verdict object) UNLESS the cell is the target story and cites the changed row.
// The round-3 review flagged the textbook case: automation-rules-engine rode the TTL row from
// partial q4 to partial q5 while its own rationale concedes there is no rules engine and users
// must build reacting actions outside the product — fixed behaviors are not user-defined
// event-to-action rules. The same roll also flipped eleven other cells in both directions
// (e.g. privacy-retention-controls none→partial, pause-resume-state full→partial,
// agentic-mcp-client none→na) on unchanged or unrelated evidence; all revert.
// auto-teardown-timeouts stands: its fresh full q8 rests on the row recorded for it.
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
const CHANGED_IDS = new Set(['sandbox0-docs-38'])
// The story the changed row was recorded for (see the round-2 fix commit 586cad2ecd).
const TARGET_STORIES = new Set(['auto-teardown-timeouts'])

function readCurrent(): VerdictRow[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), 'utf8'))
}

function readBaseline(): VerdictRow[] {
  const raw = execSync(`git show ${BASELINE_REF}:open-rankings/${CAT}/verdicts.json`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 })
  return JSON.parse(raw.toString('utf8'))
}

function main(): void {
  const baseline = new Map(readBaseline().map((r) => [`${r.productId}:${r.storyId}`, r]))
  const current = readCurrent()
  const reverted: string[] = []

  for (let i = 0; i < current.length; i++) {
    const row = current[i]
    if (row.productId !== PRODUCT) continue
    const base = baseline.get(`${row.productId}:${row.storyId}`)
    if (!base) continue
    if (base.verdict === row.verdict && base.quality === row.quality) continue
    if (TARGET_STORIES.has(row.storyId) && row.evidenceIds.some((id) => CHANGED_IDS.has(id))) continue // the cell the new evidence is about: stands
    console.log(`${CAT}/${PRODUCT}:${row.storyId}  ${row.verdict}(q${row.quality}) -> baseline ${base.verdict}(q${base.quality})`)
    reverted.push(row.storyId)
    if (WRITE) {
      current[i] = { ...base }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, PRODUCT, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
      cache.verdict = { ...base }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE && reverted.length) {
    fs.writeFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), `${JSON.stringify(current, null, 2)}\n`)
  }
  console.log(`${CAT}/${PRODUCT}: ${reverted.length} cell(s) ${WRITE ? 'reverted' : 'would revert'} (baseline ${BASELINE_REF})`)
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
