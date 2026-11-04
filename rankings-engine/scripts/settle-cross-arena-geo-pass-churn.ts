// Settle the re-judge churn from the 2026-10-27 cross-arena vendor-geo pass (PR #503).
//
// The pass appended availability evidence to four packs and re-judged them. Three of those
// products (brex and ramp in expense-management, airwallex in payments) were already judged
// under the current rubric, so their re-rolls fall under the stability policy
// (CONTRIBUTING.md "Stability policy", applied by the settle/revert-churn scripts): on
// re-judges, any verdict change — flip or quality-only move — that cites NO NEW evidence is
// reverted as noise. Changes citing at least one genuinely new evidence id stand (brex
// global-reimbursements none→full cites the global-coverage supplement). The matching judge
// cache files are patched in place (same hash, reverted verdict object) so a future
// `pnpm engine judge` run does not resurrect the churn. Prints a full audit trail.
//
// mobile-payments is deliberately NOT settled here: its five packs were still cached under the
// pre-v5 key format, so that arena's re-judge is the v5 rubric applied for the first time, and
// reverting its moves would restore verdicts the current rubric no longer supports.
//
// Usage: pnpm exec tsx rankings-engine/scripts/settle-cross-arena-geo-pass-churn.ts --ref <baseline-ref> [--write]
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const refFlag = process.argv.indexOf('--ref')
const REF = refFlag >= 0 ? process.argv[refFlag + 1] : null
if (!REF) throw new Error('usage: settle-cross-arena-geo-pass-churn.ts --ref <baseline-ref> [--write]')

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}

const TARGETS: Array<{ category: string; product: string }> = [
  { category: 'expense-management', product: 'brex' },
  { category: 'expense-management', product: 'ramp' },
  { category: 'payments', product: 'airwallex' },
]

const show = (file: string) => execSync(`git show ${REF}:${file}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()

for (const { category, product } of TARGETS) {
  const verdictsPath = path.join(ROOT, 'open-rankings', category, 'verdicts.json')
  const evidencePath = path.join(ROOT, 'open-rankings', category, 'evidence', `${product}.json`)

  const baseline: VerdictRow[] = JSON.parse(show(`open-rankings/${category}/verdicts.json`))
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))
  const baselineItems: { id: string; excerpt: string }[] = JSON.parse(show(`open-rankings/${category}/evidence/${product}.json`))
  const currentItems: { id: string; excerpt: string }[] = JSON.parse(fs.readFileSync(evidencePath, 'utf8'))
  const baselineIds = new Set(baselineItems.map((e) => e.id))
  const baselineExcerpts = baselineItems.map((e) => norm(e.excerpt))
  // A "new" evidence id only counts as new substance when its excerpt is not already carried
  // (verbatim or as a containing sentence) by a baseline item — a re-extraction that duplicates
  // an existing sentence under a fresh id cannot launder a score move (the PR #484 rule).
  const newEvidenceIds = new Set(
    currentItems
      .filter((e) => !baselineIds.has(e.id))
      .filter((e) => {
        const x = norm(e.excerpt)
        return !baselineExcerpts.some((base) => base.includes(x) || x.includes(base))
      })
      .map((e) => e.id),
  )
  console.log(`== ${category}/${product} — new evidence ids: ${[...newEvidenceIds].sort().join(', ') || '(none)'}`)

  const byKey = new Map(baseline.map((row) => [`${row.productId}:${row.storyId}`, row]))
  let reverted = 0
  let kept = 0
  const settled = current.map((row) => {
    if (row.productId !== product) return row
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
      const cachePath = path.join(ROOT, 'rankings-engine', 'cache', 'judge', category, product, `${row.storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      cache.verdict = { ...base }
      fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
    }
    return base
  })

  console.log(`settle ${category}/${product}: ${kept} changes kept (new evidence), ${reverted} reverted as churn`)
  if (WRITE) {
    fs.writeFileSync(verdictsPath, `${JSON.stringify(settled, null, 2)}\n`)
    console.log(`wrote ${verdictsPath} — run: pnpm engine derive --category ${category}`)
  } else {
    console.log('dry run — pass --write to apply')
  }
}
