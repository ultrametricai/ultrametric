// Surgical, auditable revert of judge re-roll churn introduced by the linear api-quality
// crawl-gap re-judge (2026-09-14) — the follow-up to the 2026-09-10 wave (see
// revert-churn-api-quality-wave.ts): linear was on the same 54-offender audit list as asana
// but never got the fix. Same mechanics and ruling: a re-judged cell whose verdict or quality
// changed while citing NO evidence id that is new to the product's pack is re-roll noise, not
// an evidence-driven change, and is reverted to its prior state. Patches both verdicts.json
// and the matching judge cache files in place (same hash, reverted verdict object) so a future
// `pnpm engine judge` run doesn't resurrect the churn.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-linear-wave.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
// Pre-wave state: the commit this wave's worktree branched from.
const OLD_REF = process.env.OLD_REF ?? 'HEAD'
const WRITE = process.argv.includes('--write')

// Only the product this wave re-judged — other products' cells are untouched cache reads
// (their intdir-staleness was reconciled verdict-unchanged by restamp-judge-cache-intdir.ts).
const WAVE: Record<string, string[]> = {
  'project-management': ['linear'],
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
for (const [cat, pids] of Object.entries(WAVE)) {
  const file = path.join(ROOT, 'open-rankings', cat, 'verdicts.json')
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(file, 'utf8'))
  const old: VerdictRow[] = JSON.parse(
    execSync(`git show ${OLD_REF}:data/${cat}/verdicts.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
  )
  const oldByKey = new Map(old.map((v) => [`${v.productId}:${v.storyId}`, v]))
  const oldEvidenceIds: Record<string, Set<string>> = {}
  for (const pid of pids) {
    const ev = JSON.parse(
      execSync(`git show ${OLD_REF}:data/${cat}/evidence/${pid}.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
    ) as { id: string }[]
    oldEvidenceIds[pid] = new Set(ev.map((e) => e.id))
  }

  const next = current.map((v) => {
    if (!pids.includes(v.productId)) return v
    const o = oldByKey.get(`${v.productId}:${v.storyId}`)
    if (!o) return v
    if (o.verdict === v.verdict && o.quality === v.quality) return v
    const citesNew = (v.evidenceIds ?? []).some((id) => !oldEvidenceIds[v.productId].has(id))
    if (citesNew) return v
    console.log(`REVERT ${cat}/${v.productId}:${v.storyId} ${v.verdict}/q${v.quality} -> ${o.verdict}/q${o.quality} (no new citation)`)
    reverted++
    if (WRITE) {
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', cat, v.productId, `${v.storyId}.json`)
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: unknown }
      cached.verdict = { ...o }
      fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2) + '\n')
    }
    return { ...o }
  })

  if (WRITE) fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
}
console.log(`${WRITE ? 'Reverted' : 'Would revert'} ${reverted} cell(s).${WRITE ? '' : ' Run with --write to apply.'}`)
