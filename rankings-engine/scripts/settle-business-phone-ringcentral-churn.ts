// Settle the RingCentral re-judge churn from the PR #484 review fix (2026-10-26).
//
// The review's evidence-gap fix (application-scopes page added to urls.extra plus the
// append-business-phone-docs-evidence.py supplement) re-judged the whole ringcentral pack.
// Stability policy (CONTRIBUTING.md "Stability policy"): on re-judges, any verdict flip that
// cites NO NEW evidence is reverted as noise. This script applies that ruling against the
// pre-fix baseline ref: changes (verdict flips AND quality-only moves, the existing
// settlement scripts' contract) citing at least one of the new evidence ids stand
// (agentic-scoped-keys partial→full cites the scopes supplement); flips citing none revert to
// the baseline verdict row, and the matching judge cache files are patched in place (same
// hash, reverted verdict object) so a future `pnpm engine judge` run doesn't resurrect the
// churn. Prints a full audit trail.
//
// Usage: pnpm exec tsx rankings-engine/scripts/settle-business-phone-ringcentral-churn.ts --ref <baseline-ref> [--write]
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const refFlag = process.argv.indexOf('--ref')
const REF = refFlag >= 0 ? process.argv[refFlag + 1] : null
if (!REF) throw new Error('usage: settle-business-phone-ringcentral-churn.ts --ref <baseline-ref> [--write]')

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}

const CATEGORY = 'business-phone'
const PRODUCT = 'ringcentral'
const verdictsPath = path.join(ROOT, 'open-rankings', CATEGORY, 'verdicts.json')
const evidencePath = path.join(ROOT, 'open-rankings', CATEGORY, 'evidence', `${PRODUCT}.json`)

const show = (file: string) => execSync(`git show ${REF}:${file}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
const baseline: VerdictRow[] = JSON.parse(show(`open-rankings/${CATEGORY}/verdicts.json`))
const current: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))
const baselineEvidence = new Set((JSON.parse(show(`open-rankings/${CATEGORY}/evidence/${PRODUCT}.json`)) as { id: string }[]).map((e) => e.id))
const currentEvidence = new Set((JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as { id: string }[]).map((e) => e.id))
const newEvidenceIds = new Set([...currentEvidence].filter((id) => !baselineEvidence.has(id)))

const byKey = new Map(baseline.map((row) => [`${row.productId}:${row.storyId}`, row]))
let reverted = 0
let kept = 0
const settled = current.map((row) => {
  if (row.productId !== PRODUCT) return row
  const base = byKey.get(`${row.productId}:${row.storyId}`)
  if (!base || (base.verdict === row.verdict && base.quality === row.quality)) return row
  const citesNew = row.evidenceIds.some((id) => newEvidenceIds.has(id))
  if (citesNew) {
    kept += 1
    console.log(`KEEP   ${row.storyId}: ${base.verdict} q${base.quality} → ${row.verdict} q${row.quality} (cites new evidence)`)
    return row
  }
  reverted += 1
  console.log(`REVERT ${row.storyId}: ${row.verdict} q${row.quality} → ${base.verdict} q${base.quality} (no new evidence cited)`)
  if (WRITE) {
    const cachePath = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CATEGORY, PRODUCT, `${row.storyId}.json`)
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    cache.verdict = { ...base }
    fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
  }
  return base
})

console.log(`settle: ${kept} flips kept (new evidence), ${reverted} reverted as churn`)
if (WRITE) {
  fs.writeFileSync(verdictsPath, `${JSON.stringify(settled, null, 2)}\n`)
  console.log(`wrote ${verdictsPath} — run: pnpm engine derive --category ${CATEGORY}`)
} else {
  console.log('dry run — pass --write to apply')
}
