// Surgical, auditable settle of judge re-roll churn from the PR #463 round-4 obsessiondb
// re-judge (the revert-churn.ts / revert-churn-equity-eqvista-wave.ts precedent: a re-roll
// citing no genuinely new evidence converges back to the committed verdicts, so flips that do
// not rest on the evidence that actually changed are sampling churn and revert to the pre-roll
// baseline).
//
// Scope: obsessiondb (data-warehouses). The round-4 evidence change was the
// drivers-and-clients.md page joining the crawl sources, collected FOR the agentic-sdks cell
// (PR #463 review). Its genuinely new row is obsessiondb-docs-43; the other ids new to the
// pack (docs-44, docs-45, docs-46) are re-extraction echoes of pages already in the baseline
// corpus — docs-45 repeats docs-36's ingestion sentence verbatim-with-backticks — and the
// eqvista wave already established that citation of such rows is too loose a test. The re-roll
// flipped eleven cells, including streaming-ingest-latency partial q5 -> full q7 on exactly
// that duplicate row, reversing the round-3 judgment whose rationale names the absent
// write-to-query timing proof. Baseline is 417b4b5451, the commit the re-roll started from.
//
// Rule, per cell: if (verdict, quality) changed vs baseline, restore the baseline verdict and
// patch the judge cache in place (same hash, reverted verdict object) UNLESS the cell is the
// target story (agentic-sdks) — its fresh verdict rests on the page collected for it.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-data-warehouses-obsessiondb-wave.ts [--write]

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

const CAT = 'data-warehouses'
const PRODUCT = 'obsessiondb'
const BASELINE_REF = '417b4b5451'
// The story the drivers-and-clients.md page was collected for (PR #463 review round 4).
const TARGET_STORIES = new Set(['agentic-sdks'])

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
    if (TARGET_STORIES.has(row.storyId)) continue // the cell the new page is about: stands
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
}

main()
