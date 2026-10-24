// Surgical, auditable revert of judge re-roll churn introduced by the gpus 2026-10-23
// refresh wave (PR #455, review finding: "GPU scores count different questions").
// Baseline is 3d11983e2a, the lane's pre-judge roster commit, whose verdicts.json is the
// arena's last committed judged state — the settle-vs-pre-pass-baseline rule.
//
// Named cells, each a flip whose new verdict cites NO evidence id new to the pack (re-roll
// noise under the re-judge stability policy, docs/ACCURACY.md "Human review points"):
//
//   R1 (na<->none applicability churn, both sides cite []):
//     - nvidia-rtx-pro-6000 / agentic-mcp-server: none -> na. The baseline `none` follows the
//       judge's own applicability rule (official ecosystem makes an MCP server plausible, so
//       the axis applies) and matches all ten peer products.
//     - nvidia-b200 / upscaling-frame-generation: na -> none. The baseline `na` matches the
//       other data-center accelerators (mi355x, mi325x, b300, gaudi-3).
//
//   R3 (named exact reverts to the baseline row, new verdict cites nothing):
//     - nvidia-h200-sxm / agentic-headless: partial(q3) -> na. Peer data-center accelerators
//       kept partial/full on the same axis in the same wave.
//     - nvidia-rtx-pro-6000 / agentic-headless: partial(q3) -> none. Same churn shape.
//
//   R1 against the in-wave baseline f6cce632a7 (the PR's own judged state, the pre-pass
//   baseline for the amd-mi325x re-judge that followed
//   append-gpus-mi325x-memory-docs-evidence.py; that re-judge's legitimate flips all cite the
//   new docs-22/docs-23 ids — these two cite nothing new):
//     - amd-mi325x / api-machine-spec: none -> na baseline na
//     - amd-mi325x / automation-rules-engine: na -> none baseline none
//
// NOT reverted: nvidia-rtx-5090 / agentic-mcp-server (na -> none) — it moves TO the
// rule-conformant peer consensus. The pre-existing nvidia-h200-sxm `none` on
// upscaling-frame-generation (vs peers' `na`) predates this wave and is left to the next
// evidence-driven re-judge rather than hand-tuned here.
//
// Writes verdicts.json and patches the matching judge cache files in place (same hash,
// reverted verdict object) so a future `pnpm engine judge` run doesn't resurrect the churn
// (the revert-churn.ts mechanics). Run derive + dependents after.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-gpus-refresh-wave.ts [--write]

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OLD_REF = '3d11983e2a' // pre-refresh roster commit: baseline for the 8 pre-existing products
const WAVE_REF = 'f6cce632a7' // the wave's own judged state: baseline for the mi325x re-judge pass
const CATEGORY = 'gpus'
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

const CELLS: Array<{ productId: string; storyId: string; rule: 'R1' | 'R3'; ref: string }> = [
  { productId: 'nvidia-rtx-pro-6000', storyId: 'agentic-mcp-server', rule: 'R1', ref: OLD_REF },
  { productId: 'nvidia-b200', storyId: 'upscaling-frame-generation', rule: 'R1', ref: OLD_REF },
  { productId: 'nvidia-h200-sxm', storyId: 'agentic-headless', rule: 'R3', ref: OLD_REF },
  { productId: 'nvidia-rtx-pro-6000', storyId: 'agentic-headless', rule: 'R3', ref: OLD_REF },
  { productId: 'amd-mi325x', storyId: 'api-machine-spec', rule: 'R1', ref: WAVE_REF },
  { productId: 'amd-mi325x', storyId: 'automation-rules-engine', rule: 'R1', ref: WAVE_REF },
]

function key(r: { productId: string; storyId: string }): string {
  return `${r.productId}:${r.storyId}`
}

const current: VerdictRow[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-rankings', CATEGORY, 'verdicts.json'), 'utf8'),
)
function readRef(ref: string): Map<string, VerdictRow> {
  const rows: VerdictRow[] = JSON.parse(
    execSync(`git show ${ref}:open-rankings/${CATEGORY}/verdicts.json`, {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 64,
    }).toString('utf8'),
  )
  return new Map(rows.map((r) => [key(r), r]))
}
const baselines = new Map([...new Set(CELLS.map((c) => c.ref))].map((ref) => [ref, readRef(ref)]))

let reverted = 0
const final = current.map((row) => {
  const cell = CELLS.find((c) => key(c) === key(row))
  if (!cell) return row
  const oldRow = baselines.get(cell.ref)!.get(key(row))
  if (!oldRow) throw new Error(`baseline row missing for ${key(row)}`)
  if (oldRow.verdict === row.verdict) {
    console.log(`SKIP ${key(row)}: already at baseline verdict '${row.verdict}'`)
    return row
  }
  const newIds = new Set(row.evidenceIds)
  const oldIds = new Set(oldRow.evidenceIds)
  const citesNew = [...newIds].some((id) => !oldIds.has(id))
  if (citesNew) throw new Error(`REFUSING ${key(row)}: the flip cites evidence ids new to the cell — not churn`)
  // The flip cites nothing the baseline didn't: revert to the baseline row verbatim.
  const ev: Array<{ id: string }> = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'open-rankings', CATEGORY, 'evidence', `${row.productId}.json`), 'utf8'),
  )
  const packIds = new Set(ev.map((e) => e.id))
  const missing = oldRow.evidenceIds.filter((id) => !packIds.has(id))
  if (missing.length > 0) throw new Error(`REFUSING ${key(row)}: baseline cites ids absent from the refreshed pack: ${missing.join(', ')}`)
  console.log(`${cell.rule} ${key(row)}: ${row.verdict} (q${row.quality}) -> ${oldRow.verdict} (q${oldRow.quality}) [baseline ${cell.ref}]`)
  reverted += 1
  return { ...oldRow }
})

if (!WRITE) {
  console.log(`DRY RUN: ${reverted} cell(s) would be reverted. Re-run with --write to apply.`)
  process.exit(0)
}

fs.writeFileSync(
  path.join(ROOT, 'open-rankings', CATEGORY, 'verdicts.json'),
  JSON.stringify(final, null, 2) + '\n',
)

// Patch judge cache files in place: keep hash, replace verdict object, so a future judge run
// reads the reverted verdict from cache instead of resurrecting the churned one.
let patched = 0
for (const cell of CELLS) {
  const finalRow = final.find((r) => key(r) === key(cell))!
  const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CATEGORY, cell.productId, `${cell.storyId}.json`)
  if (!fs.existsSync(cacheFile)) {
    console.warn(`WARN: cache file missing, skipping: ${cacheFile}`)
    continue
  }
  const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { verdict: Record<string, unknown> }
  cached.verdict = { ...finalRow }
  fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2) + '\n')
  patched += 1
}
console.log(`Reverted ${reverted} cell(s); patched ${patched} judge cache file(s). Run derive + dependents next.`)
