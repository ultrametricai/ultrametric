// Surgical, auditable churn settle for the edge-platforms integration-enrichment re-judge
// (wave-2 spike backfill, 2026-09-16). Commit 54b6a895b ("Enrich the integration graph from
// official integrations directories") appended integration evidence to vercel/netlify evidence
// packs WITHOUT re-judging, leaving all 96 cells per product stale (cellHash moved) and making
// every edge-platforms arena reassemble throw — which blocked the fly-io/railway/render spike
// passes. The remedy judge.ts prescribes is `judge --category edge-platforms --product <p>`;
// this script then settles that re-judge under the SAME churn ruling as
// revert-churn-api-quality-wave.ts: a flip survives only when it cites at least one evidence
// id that did not exist in the pre-enrichment pack (54b6a895b^ — the state the prior verdicts
// were judged against); every other flip is re-roll noise and reverts to the prior verdict.
// Patches both verdicts.json and the matching judge cache files in place (fresh hash kept,
// reverted verdict object) so a future `pnpm pipeline judge` run doesn't resurrect the churn.
//
// Usage: pnpm exec tsx pipeline/scripts/revert-churn-edge-integrations-wave.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)
// Env: OLD_VERDICTS_REF (default HEAD) — ref holding the settled pre-re-judge verdicts.json;
//      OLD_EVIDENCE_REF (default 54b6a895b^) — pre-enrichment evidence state.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OLD_VERDICTS_REF = process.env.OLD_VERDICTS_REF ?? 'HEAD'
const OLD_EVIDENCE_REF = process.env.OLD_EVIDENCE_REF ?? '54b6a895b^'
const WRITE = process.argv.includes('--write')

// Only the products this wave re-judged — other products' cells are untouched cache reads.
const WAVE: Record<string, string[]> = {
  'edge-platforms': ['vercel', 'netlify'],
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

let reverted = 0
let kept = 0
for (const [cat, pids] of Object.entries(WAVE)) {
  const file = path.join(ROOT, 'rankings', cat, 'verdicts.json')
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(file, 'utf8'))
  const old: VerdictRow[] = JSON.parse(
    execSync(`git show ${OLD_VERDICTS_REF}:data/${cat}/verdicts.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
  )
  const oldByKey = new Map(old.map((v) => [`${v.productId}:${v.storyId}`, v]))
  const oldEvidenceIds: Record<string, Set<string>> = {}
  for (const pid of pids) {
    const ev = JSON.parse(
      execSync(`git show ${OLD_EVIDENCE_REF}:data/${cat}/evidence/${pid}.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
    ) as { id: string }[]
    oldEvidenceIds[pid] = new Set(ev.map((e) => e.id))
  }

  const next = current.map((v) => {
    if (!pids.includes(v.productId)) return v
    const o = oldByKey.get(`${v.productId}:${v.storyId}`)
    if (!o) return v
    if (o.verdict === v.verdict && o.quality === v.quality) return v
    const citesNew = (v.evidenceIds ?? []).some((id) => !oldEvidenceIds[v.productId].has(id))
    if (citesNew) {
      kept++
      console.log(`KEEP   ${cat}/${v.productId}:${v.storyId} ${o.verdict}/q${o.quality} -> ${v.verdict}/q${v.quality} (cites enrichment evidence)`)
      return v
    }
    console.log(`REVERT ${cat}/${v.productId}:${v.storyId} ${v.verdict}/q${v.quality} -> ${o.verdict}/q${o.quality} (no new citation)`)
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
console.log(
  `${WRITE ? 'Kept' : 'Would keep'} ${kept} flip(s), ${WRITE ? 'reverted' : 'would revert'} ${reverted} cell(s).${WRITE ? '' : ' Run with --write to apply.'}`,
)
