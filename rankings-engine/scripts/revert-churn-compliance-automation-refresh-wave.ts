// Surgical, auditable settle of judge re-roll churn from the 2026-10-21 story-runner
// compliance-automation refresh (PR #404), per the re-judge stability policy
// (docs/ACCURACY.md "Human review points" §1) and the committed precedents
// revert-churn-api-quality-sweep-wave.ts / revert-churn-equity-eqvista-wave.ts: a re-roll
// citing no new evidence converges back to the committed verdicts, so flips that cite none
// of the evidence that actually changed are sampling churn and revert to the pre-roll
// baseline.
//
// Scope: every compliance-automation product the refresh re-judged. Baseline is the commit
// the refresh branched from (BASELINE_REF below). The refresh only ADDED evidence rows
// (every pack grew, nothing removed), so the changed ids per product are computed
// mechanically as the pack diff: ids present in the branch's evidence file and absent from
// the baseline's. Rule, per cell: if (verdict, quality) changed vs baseline AND the new
// verdict cites none of that product's new evidence ids, restore the baseline verdict and
// patch the judge cache in place (same hash, reverted verdict object) so a future judge run
// does not resurrect the churn. Flips citing new evidence stand.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-compliance-automation-refresh-wave.ts [--write]

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

const CAT = 'compliance-automation'
const BASELINE_REF = 'c6dc6e380f4d' // merge-base of the refresh branch with main (pre-roll state)

function gitShowJson<T>(ref: string, file: string): T | null {
  try {
    const raw = execSync(`git show ${ref}:${file}`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64, stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw.toString('utf8')) as T
  } catch {
    return null
  }
}

function readCurrent(): VerdictRow[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), 'utf8'))
}

function newIdsFor(productId: string): Set<string> {
  const baseItems = gitShowJson<{ id: string }[]>(BASELINE_REF, `open-rankings/${CAT}/evidence/${productId}.json`) ?? []
  const baseIds = new Set(baseItems.map((i) => i.id))
  const curFile = path.join(ROOT, 'open-rankings', CAT, 'evidence', `${productId}.json`)
  const curItems: { id: string }[] = fs.existsSync(curFile) ? JSON.parse(fs.readFileSync(curFile, 'utf8')) : []
  return new Set(curItems.map((i) => i.id).filter((id) => !baseIds.has(id)))
}

function main(): void {
  const baselineRows = gitShowJson<VerdictRow[]>(BASELINE_REF, `open-rankings/${CAT}/verdicts.json`)
  if (!baselineRows) throw new Error(`no baseline verdicts at ${BASELINE_REF}`)
  const baseline = new Map(baselineRows.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const current = readCurrent()
  const newIdsByProduct = new Map<string, Set<string>>()
  let reverted = 0
  let stood = 0

  for (let i = 0; i < current.length; i++) {
    const row = current[i]
    const base = baseline.get(`${row.productId}:${row.storyId}`)
    if (!base) continue
    if (base.verdict === row.verdict && base.quality === row.quality) continue
    if (!newIdsByProduct.has(row.productId)) newIdsByProduct.set(row.productId, newIdsFor(row.productId))
    const newIds = newIdsByProduct.get(row.productId)!
    if (row.evidenceIds.some((id) => newIds.has(id))) {
      stood++
      continue // the flip rests on evidence that actually changed: stands
    }
    console.log(`${CAT}/${row.productId}:${row.storyId}  ${row.verdict}(q${row.quality}) -> baseline ${base.verdict}(q${base.quality})`)
    reverted++
    if (WRITE) {
      current[i] = { ...base }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, row.productId, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
      cache.verdict = { ...base }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE && reverted) {
    fs.writeFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), `${JSON.stringify(current, null, 2)}\n`)
  }
  console.log(`${CAT}: ${reverted} cell(s) ${WRITE ? 'reverted' : 'would revert'}, ${stood} flip(s) stand on new evidence (baseline ${BASELINE_REF})`)
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
