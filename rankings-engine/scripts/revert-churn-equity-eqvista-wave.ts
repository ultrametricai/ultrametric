// Surgical, auditable settle of judge re-roll churn from the PR #428 round-2 eqvista re-judge
// (the revert-churn.ts / revert-churn-api-quality-sweep-wave.ts precedent: a re-roll citing no
// new evidence converges back to the committed verdicts, so flips that do not rest on the
// evidence that actually changed are sampling churn and revert to the pre-roll baseline).
//
// Scope: eqvista (equity-management). The round-2 evidence change was four rows recorded FOR
// two cells (rankings-engine/scripts/append-eqvista-certificates-waterfall-evidence.py:
// certificate rows for digital-share-certificates, the liquidation-preference row for
// exit-waterfall-analysis). Baseline is c6c158841, the commit the re-roll started from.
//
// Rule, per cell: if (verdict, quality) changed vs baseline, restore the baseline verdict and
// patch the judge cache in place (same hash, reverted verdict object) UNLESS the cell is one
// of the two target stories and cites the changed evidence. This tightens the api-quality
// wave's citation-only exemption after round 3 of the PR #428 review showed why citation alone
// is too loose: law-firm-collaboration flipped none->partial citing the certificate rows while
// its own rationale concedes no outside-counsel workflow is documented (the corpus's only
// law-firm lines are marketing: "We Serve the Clients of Major Law Firms"), and
// safe-convertible-issuance rode the pricing row partial->full while the story's core steps
// (document creation, sending, conversion-term modeling) stay unsupported per its own
// rationale. valuation-409a-inplatform flipped partial->full citing exactly its baseline
// evidence ids — textbook re-roll churn. The two targeted cells stand: their fresh verdicts
// rest on the rows recorded for them.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-equity-eqvista-wave.ts [--write]

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

const CAT = 'equity-management'
const PRODUCT = 'eqvista'
const BASELINE_REF = 'c6c158841'
const CHANGED_IDS = new Set([
  'eqvista-supp-cert-faq',
  'eqvista-supp-cert-signing',
  'eqvista-supp-cert-esign-pricing',
  'eqvista-supp-waterfall-preferences',
])
// The stories the changed rows were recorded for (the append script's documented targets).
const TARGET_STORIES = new Set(['digital-share-certificates', 'exit-waterfall-analysis'])

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
    if (TARGET_STORIES.has(row.storyId) && row.evidenceIds.some((id) => CHANGED_IDS.has(id))) continue // the cells the new evidence is about: stand
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
