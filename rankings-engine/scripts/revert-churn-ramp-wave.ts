// Surgical, auditable revert of judge re-roll churn introduced by the ramp lane of the
// 2026-09-15 hot-repos fairness wave (Stripe-style exhaustive agent-surface pass for ramp in
// BOTH arenas that track it: expense-management and startup-banking). Same mechanics and ruling
// as revert-churn-payments-fairness-wave.ts: a re-judged cell whose verdict or quality changed
// while citing NO evidence id that is new to the product's pack is re-roll noise, not an
// evidence-driven change, and is reverted to its prior state. This subsumes the na<->none rule.
// Patches both verdicts.json and the matching judge cache files in place (same hash, reverted
// verdict object) so a future `pnpm engine judge` run doesn't resurrect the churn.
//
// Wave specifics:
//  - ramp was re-judged in both arenas because this wave expanded its packs (12/18 new
//    agent-surface urls.extra crawled + re-extract, 13/17 verbatim supplement items, 3/2 live
//    probes — see append-ramp-agentic-evidence.py). No stale-cache complication: the wave-lead
//    verified both arenas' judge caches hash-fresh at HEAD before the wave touched them, so the
//    "new evidence" baseline for ramp in both arenas is plain HEAD (the commit this wave's
//    worktree branched from).
//  - No golden cells exist for these arenas at authoring time; the golden guard still runs.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-ramp-wave.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)
//   OLD_REF: the pre-wave commit to diff verdicts against (default HEAD).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
// Pre-wave state: the commit this wave's worktree branched from.
const OLD_REF = process.env.OLD_REF ?? 'HEAD'
const WRITE = process.argv.includes('--write')

// Only the product this lane re-judged — other products' cells are untouched cache reads.
// Value = the ref whose evidence pack that product was last judged against (the "new
// evidence" baseline for the no-new-citation rule). Fresh at HEAD for this wave.
const WAVE: Record<string, Record<string, string>> = {
  'expense-management': { ramp: 'HEAD' },
  'startup-banking': { ramp: 'HEAD' },
}

// Honesty override: cells force-reverted to their pre-wave state EVEN THOUGH the re-roll cites
// new evidence, because the verdict contradicts the evidence on its face. Documented case:
// expense-management/ramp:agentic-sdks — Ramp ships NO official language SDKs (zero SDK
// mentions in the crawled corpus; the CLI/MCP/OpenAPI surface is real but is not a client
// library). Two independent re-rolls returned full/q9 while the rationale itself admits
// "only API/CLI/MCP are evidenced, not language-specific SDKs"; the startup-banking judge
// ruled the same material none/q0. Keeping full here would be agent-washing, so the cell
// stays at its committed pre-wave verdict (none/q0) until Ramp actually ships SDKs.
const FORCE_REVERT = new Set(['expense-management/ramp:agentic-sdks'])

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
    const forced = FORCE_REVERT.has(`${cat}/${v.productId}:${v.storyId}`)
    if (citesNew && !breaksGolden && !forced) {
      console.log(`KEEP   ${cat}/${v.productId}:${v.storyId} ${o.verdict}/q${o.quality} -> ${v.verdict}/q${v.quality} (cites new evidence)`)
      kept++
      return v
    }
    const reason = breaksGolden ? 'contradicts golden cell' : forced ? 'honesty override — see FORCE_REVERT' : 'no new citation'
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
