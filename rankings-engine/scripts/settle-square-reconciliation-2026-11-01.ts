// Settle the square:agent-reconciles-daily-takings re-roll from the 2026-10-27
// cross-arena vendor-geo pass (PR #503).
//
// The pass's mobile-payments re-judge was the first run under the v5 rubric, so
// settle-cross-arena-geo-pass-churn.ts deliberately left that arena's moves standing.
// The PR #503 re-review contested this one cell: it moved partial q6 -> full q7 while
// citing no evidence the pass added (its citation delta swaps square-docs-12 for
// square-docs-3, both pre-pass entries) and its own rationale still lists the story's
// required steps as missing (transaction listing, payout-entry breakdowns, ledger
// support, hands-on corroboration). A `full` whose rationale concedes the core steps
// are undocumented fails the judge's own partial-credit boundary, so the stability
// policy's no-new-evidence rule applies cell-by-cell: the pre-pass baseline row is
// restored and the judge cache is re-keyed to the current evidence pack so a future
// `pnpm engine judge` run reproduces the settled verdict instead of re-rolling it.
//
// The baseline row cites only entries still present in the current pack (the pass
// added square-docs-30..32 and removed nothing), so it replays verbatim.
//
// Usage: pnpm exec tsx rankings-engine/scripts/settle-square-reconciliation-2026-11-01.ts \
//          --ref <pre-pass-baseline-ref> [--write]
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CACHE_DIR, categoryDir, readJson, writeJson } from '../paths'
import { EvidenceSchema, StorySchema, type Story } from '../../lib/schemas'
import { cellHash, CELL_HASH_VERSION, PROMPT_VERSION } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const refFlag = process.argv.indexOf('--ref')
const REF = refFlag >= 0 ? process.argv[refFlag + 1] : null
if (!REF) throw new Error('usage: settle-square-reconciliation-2026-11-01.ts --ref <baseline-ref> [--write]')

const CATEGORY = 'mobile-payments'
const PRODUCT = 'square'
const STORY = 'agent-reconciles-daily-takings'

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}

const show = (file: string) =>
  execSync(`git show ${REF}:${file}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()

const dataDir = categoryDir(CATEGORY)
const baseline: VerdictRow[] = JSON.parse(show(`open-rankings/${CATEGORY}/verdicts.json`))
const baseRow = baseline.find((r) => r.productId === PRODUCT && r.storyId === STORY)
if (!baseRow) throw new Error(`no baseline row for ${PRODUCT}:${STORY} at ${REF}`)

const verdictsPath = path.join(dataDir, 'verdicts.json')
const current: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))
const idx = current.findIndex((r) => r.productId === PRODUCT && r.storyId === STORY)
if (idx < 0) throw new Error(`no current row for ${PRODUCT}:${STORY}`)
const curRow = current[idx]

const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${PRODUCT}.json`))
const packIds = new Set(evidence.map((e) => e.id))
const missing = baseRow.evidenceIds.filter((id) => !packIds.has(id))
if (missing.length > 0) throw new Error(`baseline row cites entries absent from the current pack: ${missing.join(', ')}`)

const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
const story = (stories as Story[]).find((s) => s.id === STORY)
if (!story) throw new Error(`no story ${STORY} in ${CATEGORY}`)

console.log(`current: ${curRow.verdict} q${curRow.quality} (cites ${curRow.evidenceIds.join(', ')})`)
console.log(`settled: ${baseRow.verdict} q${baseRow.quality} (cites ${baseRow.evidenceIds.join(', ')})`)

if (!WRITE) {
  console.log('dry run: pass --write to apply')
  process.exit(0)
}

current[idx] = baseRow
writeJson(verdictsPath, current)
writeJson(path.join(CACHE_DIR, 'judge', CATEGORY, PRODUCT, `${STORY}.json`), {
  hash: cellHash(story, evidence, PROMPT_VERSION),
  keyVersion: CELL_HASH_VERSION,
  verdict: baseRow,
})
console.log(`wrote settled row and re-keyed cache for ${CATEGORY}/${PRODUCT}:${STORY}`)
