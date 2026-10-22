// Surgical, auditable settle of judge re-roll churn from the PR #410 api-quality follow-up
// re-judges (the revert-churn.ts / revert-churn-api-quality-wave.ts precedent: a re-roll
// citing no new evidence converges back to the committed verdicts, so flips that cite none
// of the evidence that actually changed are sampling churn and revert to the pre-roll
// baseline).
//
// Scope: the four products re-judged after the PR #410 review. For attio, fireworks-ai and
// skyvern the only evidence change was the *-supp-api-playground row (interactive-docs
// confirmation); baseline is 105fad75b (the commit the re-roll started from). For bugsnag
// the only change was rewording bugsnag-supp-data-access-docs to a verbatim quote; baseline
// is 44770882d. Rule, per cell: if (verdict, quality) changed vs baseline AND the new
// verdict cites none of that product's changed evidence ids, restore the baseline verdict
// and patch the judge cache in place (same hash, reverted verdict object) so a future judge
// run does not resurrect the churn. Flips citing the changed evidence stand (notably
// api-interactive-docs, the cells the new evidence is about). The PR #410 review's two
// churn findings (skyvern automation-rules-engine none->partial on pre-existing Zapier
// evidence, attio agent-updates-deal-stages partial->full with central gaps in its own
// rationale) both fall under the rule.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-api-quality-sweep-wave.ts [--write]

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

const CASES: Array<{ cat: string; productId: string; baselineRef: string; changedIds: string[] }> = [
  { cat: 'crm', productId: 'attio', baselineRef: '105fad75b', changedIds: ['attio-supp-api-playground'] },
  { cat: 'inference-providers', productId: 'fireworks-ai', baselineRef: '105fad75b', changedIds: ['fireworks-ai-supp-api-playground'] },
  { cat: 'browser-agents', productId: 'skyvern', baselineRef: '105fad75b', changedIds: ['skyvern-supp-api-playground'] },
  { cat: 'error-tracking', productId: 'bugsnag', baselineRef: '44770882d', changedIds: ['bugsnag-supp-data-access-docs'] },
]

function readCurrent(cat: string): VerdictRow[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', cat, 'verdicts.json'), 'utf8'))
}

function readBaseline(cat: string, ref: string): VerdictRow[] {
  const raw = execSync(`git show ${ref}:open-rankings/${cat}/verdicts.json`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 })
  return JSON.parse(raw.toString('utf8'))
}

function main(): void {
  let total = 0
  for (const { cat, productId, baselineRef, changedIds } of CASES) {
    const changed = new Set(changedIds)
    const baseline = new Map(readBaseline(cat, baselineRef).map((r) => [`${r.productId}:${r.storyId}`, r]))
    const current = readCurrent(cat)
    const reverted: string[] = []

    for (let i = 0; i < current.length; i++) {
      const row = current[i]
      if (row.productId !== productId) continue
      const base = baseline.get(`${row.productId}:${row.storyId}`)
      if (!base) continue
      if (base.verdict === row.verdict && base.quality === row.quality) continue
      if (row.evidenceIds.some((id) => changed.has(id))) continue // cites the changed evidence: stands
      console.log(
        `${cat}/${productId}:${row.storyId}  ${row.verdict}(q${row.quality}) -> baseline ${base.verdict}(q${base.quality})`,
      )
      reverted.push(row.storyId)
      total++
      if (WRITE) {
        current[i] = { ...base }
        const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', cat, productId, `${row.storyId}.json`)
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
        cache.verdict = { ...base }
        fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
      }
    }

    if (WRITE && reverted.length) {
      fs.writeFileSync(path.join(ROOT, 'open-rankings', cat, 'verdicts.json'), `${JSON.stringify(current, null, 2)}\n`)
    }
    console.log(`${cat}/${productId}: ${reverted.length} cell(s) ${WRITE ? 'reverted' : 'would revert'} (baseline ${baselineRef})`)
  }
  console.log(`\nTotal: ${total} cell(s). ${WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.'}`)
}

main()
