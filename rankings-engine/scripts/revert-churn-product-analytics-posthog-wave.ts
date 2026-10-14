// Surgical, auditable revert of judge re-roll churn introduced by the hot-repos fairness wave
// (2026-09-15: product-analytics/posthog — the same Stripe-spike recipe run fleet-wide on the
// wave's target products). Same mechanics and ruling as revert-churn-stripe-agentic-wave.ts and
// revert-churn-payments-fairness-wave.ts: a re-judged cell whose verdict or quality changed
// while citing NO evidence id that is new to the product's pack is re-roll noise, not an
// evidence-driven change, and is reverted to its prior state. Patches both verdicts.json and
// the matching judge cache files in place (same hash, reverted verdict object) so a future
// `pnpm pipeline judge` run doesn't resurrect the churn.
//
// Wave specifics:
//  - posthog was re-judged because this wave expanded its evidence pack (20 new agent-surface
//    urls.extra crawled + monotonic re-extract (+14 docs items), 22 verbatim supplement items,
//    2 live probes — see append-product-analytics-posthog-agentic-evidence.py).
//  - STALE-CACHE complication (same shape as the Stripe wave): commit 54b6a895 (integrations
//    wave) appended committed-but-never-judged docs/intdir items to posthog's pack. posthog's
//    HEAD caches verify 0-stale against 54b6a895^, so THAT ref is the "new evidence" baseline
//    for the no-new-citation rule — flips citing 54b6a895 items count as evidence-driven, per
//    the Stripe-wave precedent (771a7510). amplitude/mixpanel were restamped, not re-judged.
//  - No product-analytics golden cells exist at authoring time; the golden guard still runs.
//
// Usage: pnpm exec tsx pipeline/scripts/revert-churn-product-analytics-posthog-wave.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)
//   OLD_REF: the pre-wave commit to diff verdicts against (default HEAD — this wave's worktree
//   branched from HEAD and commits only at the end).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OLD_REF = process.env.OLD_REF ?? 'HEAD'
const WRITE = process.argv.includes('--write')

// Only the products this wave re-judged — other products' cells are untouched cache reads.
// Value = the ref whose evidence pack that product was last judged against (the "new
// evidence" baseline for the no-new-citation rule).
const WAVE: Record<string, Record<string, string>> = {
  'product-analytics': { posthog: '54b6a895^' },
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
  const file = path.join(ROOT, 'open-rankings', cat, 'verdicts.json')
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
