// Surgical, auditable revert of judge re-roll churn introduced by the supabase
// serverless-databases second-arena bring-up (founder ask 2026-09-23: "supabase should show up
// in developer databases and be compared against neon"). Same mechanics and ruling as
// revert-churn-serverless-databases-neon-wave.ts: a re-judged cell whose verdict or quality
// changed while citing NO evidence id that is new to the product's pack is re-roll noise, not
// an evidence-driven change, and is reverted to its prior state. Patches both verdicts.json
// and the matching judge cache files in place (same hash, reverted verdict object) so a future
// `pnpm pipeline judge` run doesn't resurrect the churn.
//
// Wave specifics:
//  - supabase's spike-settled baseline was committed mid-wave; this script settles the
//    post-spike re-judge that followed append-serverless-databases-supabase-runtime-probes.py
//    (3 new probe-rt evidence items, wiped-and-restored around the spike's probe stage).
//    OLD_REF must be set to that intermediate commit.
//
// Usage: OLD_REF=<ref> pnpm exec tsx pipeline/scripts/revert-churn-serverless-databases-supabase-wave.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
// Pre-re-judge state: the intermediate commit holding the spike-settled verdicts.
const OLD_REF = process.env.OLD_REF ?? 'HEAD'
const WRITE = process.argv.includes('--write')

// Only the products this wave re-judged — other products' cells are untouched cache reads.
// Value = the ref whose evidence pack that product was last judged against (the "new
// evidence" baseline for the no-new-citation rule).
const WAVE: Record<string, Record<string, string>> = {
  'serverless-databases': { supabase: OLD_REF },
}

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds?: string[]
}
type GoldenCell = { category: string; productId: string; storyId: string; expectedVerdict: string }

const goldens: GoldenCell[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'pipeline', 'golden', 'golden-cells.json'), 'utf8'),
)
const goldenByKey = new Map(goldens.map((g) => [`${g.category}/${g.productId}:${g.storyId}`, g.expectedVerdict]))

let reverted = 0
let kept = 0
for (const [cat, pids] of Object.entries(WAVE)) {
  const file = path.join(ROOT, 'rankings', cat, 'verdicts.json')
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(file, 'utf8'))
  const old: VerdictRow[] = JSON.parse(
    execSync(`git show ${OLD_REF}:data/${cat}/verdicts.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
  )
  const oldByKey = new Map(old.map((v) => [`${v.productId}:${v.storyId}`, v]))
  const oldEvidenceIds: Record<string, Set<string>> = {}
  for (const [pid, evRef] of Object.entries(pids)) {
    const ev = JSON.parse(
      execSync(`git show ${evRef}:data/${cat}/evidence/${pid}.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
    ) as { id: string }[]
    oldEvidenceIds[pid] = new Set(ev.map((e) => e.id))
  }

  const next = current.map((v) => {
    if (!(v.productId in pids)) return v
    const o = oldByKey.get(`${v.productId}:${v.storyId}`)
    if (!o) return v
    if (o.verdict === v.verdict && o.quality === v.quality) return v
    const citesNew = (v.evidenceIds ?? []).some((id) => !oldEvidenceIds[v.productId].has(id))
    const goldenTier = goldenByKey.get(`${cat}/${v.productId}:${v.storyId}`)
    const breaksGolden = goldenTier !== undefined && o.verdict === goldenTier && v.verdict !== goldenTier
    if (citesNew && !breaksGolden) {
      console.log(`KEEP   ${cat}/${v.productId}:${v.storyId} ${o.verdict}/q${o.quality} -> ${v.verdict}/q${v.quality} (cites new evidence)`)
      kept++
      return v
    }
    const reason = breaksGolden ? 'contradicts golden cell' : 'no new citation'
    console.log(`REVERT ${cat}/${v.productId}:${v.storyId} ${v.verdict}/q${v.quality} -> ${o.verdict}/q${o.quality} (${reason})`)
    reverted++
    if (WRITE) {
      const cacheFile = path.join(ROOT, 'pipeline', 'cache', 'judge', cat, v.productId, `${v.storyId}.json`)
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: unknown }
      cached.verdict = { ...o }
      fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2) + '\n')
    }
    return { ...o }
  })

  if (WRITE) fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
}
console.log(`Kept ${kept} evidence-driven change(s); ${WRITE ? 'reverted' : 'would revert'} ${reverted} churn cell(s).${WRITE ? '' : ' Run with --write to apply.'}`)
