// Surgical, auditable revert of judge re-roll churn introduced by the Mercury API-accuracy
// spike re-judge wave (2026-09-14: startup-banking mercury + brex + ramp). Same mechanics and
// ruling as pipeline/scripts/revert-churn-api-quality-wave.ts (which follows revert-churn.ts,
// the probe-wave precedent): a re-judged cell whose verdict or quality changed while citing NO
// evidence id that is new to the product's pack is re-roll noise, not an evidence-driven
// change, and is reverted to its prior state. This subsumes the na<->none rule (those flips
// never cite new evidence). Patches both verdicts.json and the matching judge cache files in
// place (same hash, reverted verdict object) so a future `pnpm pipeline judge` run doesn't
// resurrect the churn.
//
// Wave specifics:
//  - mercury was re-judged because this spike expanded its evidence pack (crawl-gap fixes:
//    sandbox docs, interactive reference, changelog, Go SDK, agent skills, openapi re-probe).
//    Its "new evidence" baseline is the pack at OLD_REF (pre-spike HEAD).
//  - brex and ramp were re-judged only to clear a PRE-EXISTING hash-stale condition: the
//    integrations-enrichment commit 54b6a895 expanded their packs (brex/ramp-docs-1x,
//    *-intdir-1) without re-judging, which blocked `pnpm pipeline judge` from assembling
//    startup-banking/verdicts.json at all. Their caches at pre-spike HEAD verify 0-stale
//    against the 54b6a895^ packs (see spike-check-baseline.ts), so their "new evidence"
//    baseline is 54b6a895^ — changes citing the enrichment items ARE evidence-driven and kept.
//  - GOLDEN GUARD: a changed cell whose OLD tier matches its golden-cell expectation
//    (pipeline/golden/golden-cells.json) and whose NEW tier contradicts it is reverted even if
//    it cites new evidence, unless a human re-adjudicates the golden first. Concrete case this
//    wave: mercury:agentic-mcp-server full->partial — the flip's only new citation
//    (mercury-docs-32, an NL-prompt marketing line) carries no capability information; the
//    read-only tool surface was already known (mercury-probe-5) and priced into quality (8,
//    "missing for 10: write/action capabilities"), and the golden adjudicated the tier as
//    "runtime-verified, unambiguous full". A single reroll reproduced partial, i.e. this is
//    current-judge tier-drift on unchanged facts — exactly what goldens exist to pin.
//
// Usage: pnpm exec tsx pipeline/scripts/revert-churn-mercury-api-wave.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)
//   OLD_REF: the pre-wave commit to diff verdicts against (default HEAD).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
// Pre-wave state: the commit this wave's worktree branched from.
const OLD_REF = process.env.OLD_REF ?? 'HEAD'
const WRITE = process.argv.includes('--write')

// Only the products this wave re-judged — other products' cells are untouched cache reads.
// Value = the ref whose evidence pack that product was last judged against (the "new
// evidence" baseline for the no-new-citation rule).
const WAVE: Record<string, Record<string, string>> = {
  'startup-banking': { mercury: OLD_REF, brex: '54b6a895^', ramp: '54b6a895^' },
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
