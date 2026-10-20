// Judge-model migration driver (sonnet-5 → claude-opus-5-5, prompt v3 → v4) — the generalized
// successor to rankings-engine/scripts/rejudge-pilot.ts, per the adopted docs/opus-5-5-judge-pilot.md
// recommendation: re-judge the fleet arena-by-arena through the Message Batches API (half
// price, no rate-limit contention with story-runner), land each arena atomically (judge cache +
// verdicts.json + rankings.json + labeled score-history in one commit), and never apply the
// churn policy's no-new-evidence revert rule to this wave — every flip is the judge change and
// is labeled as such (MIGRATION_NOTE below).
//
// Subcommands (state lives OUTSIDE the repo, like the pilot's scratch dir):
//   submit   --category <id>            snapshot baseline, build + submit the arena's batch
//   status   [--category <id>]          poll processing status of submitted batches
//   ingest   --category <id>            collect results → cache; interactive fallback for
//                                       parse failures / rule violations (same correction loop
//                                       as the judge stage); then finalize (see below)
//   restamp-pilot --category <id> --pilot <dir>
//                                       zero-LLM reuse of a scratch re-judge already produced
//                                       by THE SAME target model on the SAME prompt text and
//                                       evidence (validated cell-by-cell against the legacy v3
//                                       hash before restamping to the v4 scheme — the
//                                       restamp-judge-cache-intdir.ts fixed-point precedent)
//   adjust   --category <id> --file <adjustments.json>
//                                       apply human adjudications / audit reverts (array of
//                                       {productId, storyId, verdict}) to cache + verdicts.json
//                                       and re-finalize — used by the owner-product bias audit
//
// Finalize = re-apply protected human adjudications from the committed worklist (they outrank
// any model — docs/JUDGE-MIGRATION-2026-09-30-worklist.json records what the fresh judge said),
// assemble verdicts.json from the full cache matrix (staleness-checked like the judge stage),
// derive rankings + labeled score-history, and write a per-arena flip/rank report to the state
// dir for docs/judge-migration-2026-09-30.md.
//
// Spend guard: every batch/interactive token is metered into <state>/<cat>/usage.json and
// summed by `status`; the migration stops if projected fleet spend exceeds the $800 cap
// (memo estimate ~$570 via batch).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import {
  EvidenceSchema, ProductSchema, RankingsSchema, StorySchema, VerdictSchema,
  type Evidence, type Product, type Story, type Verdict,
} from '../../lib/schemas'
import { attachProvenance } from '../../lib/provenance'
import { buildRankings, cellScore, VERDICT_FACTORS } from '../../lib/scoring'
import { appendScoreHistoryOnChange } from '../../lib/scoreHistory'
import { extractJson, JUDGE_MODEL, llmJson, setClientForTests } from '../llm'
import {
  cellHash, judgePrompt, PROMPT_VERSION, RawVerdictSchema, SYSTEM, validateVerdictRules,
} from '../stages/judge'
import { CACHE_DIR, categoryDir, readJson, ROOT, writeJson } from '../paths'

export const MIGRATION_NOTE = 'judge-migration-2026-09-30: sonnet-5 → opus-5-5 (prompt v4)'
const WORKLIST_FILE = path.join(ROOT, 'docs', 'JUDGE-MIGRATION-2026-09-30-worklist.json')
const BATCH_MAX_TOKENS = 8192
// Batch API pricing for claude-opus-5-5 ($/MTok); interactive is 2x.
const BATCH_IN = 2, BATCH_OUT = 10, LIVE_IN = 4, LIVE_OUT = 20

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const stateDir = path.resolve(arg('state') ?? '/tmp/judge-migration-2026-09-30')
for (const forbidden of [path.join(ROOT, 'open-rankings'), path.join(ROOT, 'rankings-engine', 'cache')]) {
  if (stateDir === forbidden || stateDir.startsWith(forbidden + path.sep)) {
    throw new Error(`migrate-judge-batch: --state ${stateDir} is inside ${forbidden}`)
  }
}

type WorklistEntry = {
  category: string
  productId: string
  storyId: string
  markerExcerpt: string
  preservedVerdict: Verdict
  status: string
  freshJudgeSaid?: string
  action?: string
}

type Usage = {
  batchRequests: number; batchInputTokens: number; batchOutputTokens: number
  liveCalls: number; liveInputTokens: number; liveOutputTokens: number
}
const zeroUsage = (): Usage => ({
  batchRequests: 0, batchInputTokens: 0, batchOutputTokens: 0,
  liveCalls: 0, liveInputTokens: 0, liveOutputTokens: 0,
})
const costUSD = (u: Usage): number =>
  (u.batchInputTokens * BATCH_IN + u.batchOutputTokens * BATCH_OUT
    + u.liveInputTokens * LIVE_IN + u.liveOutputTokens * LIVE_OUT) / 1e6

function readUsage(cat: string): Usage {
  const f = path.join(stateDir, cat, 'usage.json')
  return fs.existsSync(f) ? { ...zeroUsage(), ...JSON.parse(fs.readFileSync(f, 'utf8')) } : zeroUsage()
}
function writeUsage(cat: string, u: Usage): void {
  writeJson(path.join(stateDir, cat, 'usage.json'), u)
}

// Legacy (pre-v4) hash scheme — used ONLY to validate that a scratch pilot cell was judged
// against the exact evidence pack still on disk before restamping it to the v4 scheme.
function legacyCellHash(story: Story, evidence: Evidence[], promptVersion: string): string {
  const payload = JSON.stringify({
    storyId: story.id,
    title: story.title,
    evidence: evidence.map((e) => [e.id, e.excerpt]),
    promptVersion,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

// Meter interactive fallback calls (llmJson correction rounds included) into the ledger, same
// wrapping trick as rejudge-pilot.ts.
function meterLiveCalls(usage: Usage): void {
  const real = new Anthropic()
  setClientForTests({
    messages: {
      create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
        const res = await real.messages.create(params)
        usage.liveCalls += 1
        usage.liveInputTokens += res.usage.input_tokens
        usage.liveOutputTokens += res.usage.output_tokens
        return res
      },
    },
  } as unknown as Anthropic)
}

type ArenaData = { dataDir: string; products: Product[]; stories: Story[]; evidenceOf: Map<string, Evidence[]> }
function loadArena(cat: string): ArenaData {
  const dataDir = categoryDir(cat)
  const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const evidenceOf = new Map(
    products.map((p) => [p.id, readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))]),
  )
  return { dataDir, products, stories, evidenceOf }
}

function cacheFileOf(cat: string, productId: string, storyId: string): string {
  return path.join(CACHE_DIR, 'judge', cat, productId, `${storyId}.json`)
}

// Snapshot the PRE-migration committed verdicts/rankings once per arena (diff baseline).
function snapshotBaseline(cat: string): void {
  const base = path.join(stateDir, cat, 'baseline-verdicts.json')
  if (fs.existsSync(base)) return
  fs.mkdirSync(path.join(stateDir, cat), { recursive: true })
  fs.copyFileSync(path.join(categoryDir(cat), 'verdicts.json'), base)
  fs.copyFileSync(path.join(categoryDir(cat), 'rankings.json'), path.join(stateDir, cat, 'baseline-rankings.json'))
}

async function submit(cat: string): Promise<void> {
  snapshotBaseline(cat)
  const { products, stories, evidenceOf } = loadArena(cat)
  const client = new Anthropic()
  const manifest: Array<{ customId: string; productId: string; storyId: string; hash: string }> = []
  const requests: Anthropic.Messages.BatchCreateParams.Request[] = []
  let skipped = 0
  for (const p of products) {
    const evidence = evidenceOf.get(p.id)!
    for (const story of stories) {
      const hash = cellHash(story, evidence, PROMPT_VERSION)
      const cacheFile = cacheFileOf(cat, p.id, story.id)
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string }
        if (cached.hash === hash) { skipped += 1; continue }
      }
      const customId = `c${manifest.length}`
      manifest.push({ customId, productId: p.id, storyId: story.id, hash })
      requests.push({
        custom_id: customId,
        params: {
          model: JUDGE_MODEL,
          max_tokens: BATCH_MAX_TOKENS,
          system: SYSTEM,
          messages: [{ role: 'user', content: judgePrompt(p.name, story, evidence) }],
        },
      })
    }
  }
  if (requests.length === 0) {
    console.log(`${cat}: nothing to submit (all ${skipped} cells already cached under the current scheme)`)
    writeJson(path.join(stateDir, cat, 'batch.json'), { batchId: null, submittedAt: new Date().toISOString(), requests: 0, skipped })
    writeJson(path.join(stateDir, cat, 'manifest.json'), manifest)
    return
  }
  const batch = await client.messages.batches.create({ requests })
  writeJson(path.join(stateDir, cat, 'manifest.json'), manifest)
  writeJson(path.join(stateDir, cat, 'batch.json'), {
    batchId: batch.id, submittedAt: new Date().toISOString(), requests: requests.length, skipped,
  })
  console.log(`${cat}: submitted batch ${batch.id} — ${requests.length} cells (${skipped} cache-valid skips)`)
}

async function status(onlyCat?: string): Promise<void> {
  const client = new Anthropic()
  const cats = onlyCat ? [onlyCat] : fs.readdirSync(stateDir).filter((c) => fs.existsSync(path.join(stateDir, c, 'batch.json')))
  let totalCost = 0
  const lines: string[] = []
  for (const cat of cats.sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(stateDir, cat, 'batch.json'), 'utf8')) as { batchId: string | null; requests: number }
    totalCost += costUSD(readUsage(cat))
    if (!meta.batchId) { lines.push(`${cat}: no-batch (fully cached)`); continue }
    const b = await client.messages.batches.retrieve(meta.batchId)
    lines.push(`${cat}: ${b.processing_status} — ok ${b.request_counts.succeeded} err ${b.request_counts.errored} proc ${b.request_counts.processing} / ${meta.requests}`)
  }
  console.log(lines.join('\n'))
  console.log(`ingested spend so far: $${totalCost.toFixed(2)}`)
}

async function judgeInteractive(productName: string, story: Story, evidence: Evidence[], firstViolation?: string): Promise<Verdict> {
  let raw = await llmJson({
    schema: RawVerdictSchema,
    system: SYSTEM,
    prompt: judgePrompt(productName, story, evidence, firstViolation
      ? `\nYour previous verdict violated a rule: ${firstViolation}. Correct it. If quality is below 10, the rationale MUST contain the literal phrase "missing for 10:" followed by the specific gaps.`
      : ''),
  })
  let verdict = raw as Verdict
  let violation = validateVerdictRules(verdict, evidence)
  for (let round = 0; violation && round < 3; round++) {
    raw = await llmJson({
      schema: RawVerdictSchema,
      system: SYSTEM,
      prompt: judgePrompt(productName, story, evidence, `\nYour previous verdict violated a rule: ${violation}. Correct it. If quality is below 10, the rationale MUST contain the literal phrase "missing for 10:" followed by the specific gaps.`),
    })
    verdict = raw as Verdict
    violation = validateVerdictRules(verdict, evidence)
  }
  if (violation) throw new Error(`still violates rules: ${violation}`)
  return verdict
}

async function ingest(cat: string): Promise<void> {
  const meta = JSON.parse(fs.readFileSync(path.join(stateDir, cat, 'batch.json'), 'utf8')) as { batchId: string | null }
  const manifest = JSON.parse(fs.readFileSync(path.join(stateDir, cat, 'manifest.json'), 'utf8')) as Array<{ customId: string; productId: string; storyId: string; hash: string }>
  const byCustomId = new Map(manifest.map((m) => [m.customId, m]))
  const { products, stories, evidenceOf } = loadArena(cat)
  const productByIdx = new Map(products.map((p) => [p.id, p]))
  const storyByIdx = new Map(stories.map((s) => [s.id, s]))
  const usage = readUsage(cat)
  meterLiveCalls(usage)

  const fallback: Array<{ productId: string; storyId: string; hash: string; violation?: string }> = []
  if (meta.batchId) {
    const client = new Anthropic()
    const b = await client.messages.batches.retrieve(meta.batchId)
    if (b.processing_status !== 'ended') throw new Error(`${cat}: batch ${meta.batchId} is ${b.processing_status}, not ended`)
    let ok = 0
    for await (const result of await client.messages.batches.results(meta.batchId)) {
      const cell = byCustomId.get(result.custom_id)
      if (!cell) throw new Error(`${cat}: unknown custom_id ${result.custom_id}`)
      if (result.result.type !== 'succeeded') {
        fallback.push(cell)
        continue
      }
      const msg = result.result.message
      usage.batchRequests += 1
      usage.batchInputTokens += msg.usage.input_tokens
      usage.batchOutputTokens += msg.usage.output_tokens
      const text = msg.content.filter((blk): blk is Anthropic.TextBlock => blk.type === 'text').map((blk) => blk.text).join('')
      if (msg.stop_reason === 'max_tokens') { fallback.push(cell); continue }
      const json = extractJson(text)
      const parsed = json === undefined ? undefined : RawVerdictSchema.safeParse(json)
      if (!parsed?.success) { fallback.push(cell); continue }
      const verdict: Verdict = { ...parsed.data, productId: cell.productId, storyId: cell.storyId }
      const violation = validateVerdictRules(verdict, evidenceOf.get(cell.productId)!)
      if (violation) { fallback.push({ ...cell, violation }); continue }
      writeJson(cacheFileOf(cat, cell.productId, cell.storyId), { hash: cell.hash, verdict })
      ok += 1
    }
    console.log(`${cat}: batch ingested — ${ok} cells from batch, ${fallback.length} need interactive fallback`)
  }

  // Interactive fallback (parse failures, truncations, rule violations, batch errors) — the
  // exact judge-stage correction loop, metered at interactive pricing.
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < fallback.length) {
      const cell = fallback[next]
      next += 1
      const p = productByIdx.get(cell.productId)!
      const story = storyByIdx.get(cell.storyId)!
      const raw = await judgeInteractive(p.name, story, evidenceOf.get(p.id)!, cell.violation)
      const verdict: Verdict = { ...raw, productId: p.id, storyId: story.id }
      writeJson(cacheFileOf(cat, p.id, story.id), { hash: cell.hash, verdict })
      console.log(`${cat}: fallback ${p.id}:${story.id} → ${verdict.verdict} q${verdict.quality}`)
    }
  }))
  writeUsage(cat, usage)
  finalizeArena(cat)
}

// Zero-LLM reuse of a scratch re-judge produced by the SAME model + prompt text: every scratch
// cell's stored legacy-v3 hash must match the CURRENT evidence pack (proof the pilot judged
// exactly what is on disk); then the cell is restamped under the v4 scheme.
function restampPilot(cat: string, pilotDir: string): void {
  snapshotBaseline(cat)
  const { products, stories, evidenceOf } = loadArena(cat)
  const pilotUsage = JSON.parse(fs.readFileSync(path.join(pilotDir, cat, 'usage.json'), 'utf8')) as { model: string }
  if (pilotUsage.model !== JUDGE_MODEL) throw new Error(`pilot model ${pilotUsage.model} !== target ${JUDGE_MODEL}`)
  let restamped = 0
  for (const p of products) {
    const evidence = evidenceOf.get(p.id)!
    for (const story of stories) {
      const cellFile = path.join(pilotDir, cat, 'cells', p.id, `${story.id}.json`)
      const cached = JSON.parse(fs.readFileSync(cellFile, 'utf8')) as { hash: string; verdict: unknown }
      const legacy = legacyCellHash(story, evidence, 'v3')
      if (cached.hash !== legacy) {
        throw new Error(`restamp-pilot: ${cat}/${p.id}:${story.id} pilot hash does not match current evidence under the legacy scheme — evidence changed since the pilot; re-judge this arena instead`)
      }
      const verdict = VerdictSchema.parse(cached.verdict)
      writeJson(cacheFileOf(cat, p.id, story.id), { hash: cellHash(story, evidence, PROMPT_VERSION), verdict })
      restamped += 1
    }
  }
  console.log(`${cat}: restamped ${restamped} pilot cells (model ${pilotUsage.model}, prompt text v3≡v4) into the judge cache at zero LLM cost`)
  writeJson(path.join(stateDir, cat, 'batch.json'), { batchId: null, restampedFromPilot: pilotDir, requests: 0, skipped: restamped })
  finalizeArena(cat)
}

function applyAdjustments(cat: string, file: string): void {
  const adjustments = JSON.parse(fs.readFileSync(file, 'utf8')) as Verdict[]
  const { stories, evidenceOf } = loadArena(cat)
  const storyByIdx = new Map(stories.map((s) => [s.id, s]))
  for (const v of adjustments) {
    const verdict = VerdictSchema.parse(v)
    const story = storyByIdx.get(verdict.storyId)
    if (!story) throw new Error(`adjust: unknown story ${verdict.storyId}`)
    const hash = cellHash(story, evidenceOf.get(verdict.productId)!, PROMPT_VERSION)
    writeJson(cacheFileOf(cat, verdict.productId, verdict.storyId), { hash, verdict })
    console.log(`${cat}: adjusted ${verdict.productId}:${verdict.storyId} → ${verdict.verdict} q${verdict.quality}`)
  }
  finalizeArena(cat)
}

function finalizeArena(cat: string): void {
  const { dataDir, products, stories, evidenceOf } = loadArena(cat)

  // 1. Protected human adjudications outrank any model: re-apply them to the cache verbatim
  //    (current-scheme hash) and record what the fresh judge said in the committed worklist.
  const worklist = fs.existsSync(WORKLIST_FILE)
    ? (JSON.parse(fs.readFileSync(WORKLIST_FILE, 'utf8')) as { entries: WorklistEntry[]; notes?: unknown })
    : { entries: [] as WorklistEntry[] }
  let worklistTouched = false
  for (const entry of worklist.entries) {
    if (entry.category !== cat) continue
    const story = stories.find((s) => s.id === entry.storyId)
    if (!story) throw new Error(`worklist: unknown story ${cat}/${entry.storyId}`)
    const cacheFile = cacheFileOf(cat, entry.productId, entry.storyId)
    const hash = cellHash(story, evidenceOf.get(entry.productId)!, PROMPT_VERSION)
    const fresh = fs.existsSync(cacheFile)
      ? (JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { verdict: Verdict }).verdict
      : undefined
    if (fresh) {
      entry.freshJudgeSaid = `${fresh.verdict} q${fresh.quality} (conf ${fresh.confidence})`
      const agrees = fresh.verdict === entry.preservedVerdict.verdict && fresh.quality === entry.preservedVerdict.quality
      entry.action = agrees
        ? 'preserved human adjudication (opus-5-5 independently reached the same verdict/quality; annotated rationale kept as the record of the human call)'
        : 'preserved human adjudication over the fresh opus-5-5 verdict (human adjudications outrank any model)'
    } else {
      entry.action = 'preserved human adjudication (no fresh verdict produced for this cell)'
    }
    entry.status = 'preserved'
    writeJson(cacheFile, { hash, verdict: entry.preservedVerdict })
    worklistTouched = true
  }
  if (worklistTouched) writeJson(WORKLIST_FILE, worklist)

  // 2. Assemble verdicts.json from the full cache matrix, staleness-checked (judge-stage rule).
  const all: Verdict[] = []
  for (const p of products) {
    const evidence = evidenceOf.get(p.id)!
    for (const story of stories) {
      const cacheFile = cacheFileOf(cat, p.id, story.id)
      if (!fs.existsSync(cacheFile)) throw new Error(`finalize: matrix incomplete — missing ${cat}/${p.id}:${story.id}`)
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: unknown }
      const currentHash = cellHash(story, evidence, PROMPT_VERSION)
      if (cached.hash !== currentHash) throw new Error(`finalize: stale cached verdict for ${cat}/${p.id}:${story.id}`)
      all.push(VerdictSchema.parse(cached.verdict))
    }
  }
  all.sort((x, y) => x.productId.localeCompare(y.productId) || x.storyId.localeCompare(y.storyId))
  writeJson(path.join(dataDir, 'verdicts.json'), all)

  // 3. Derive rankings + labeled score-history (the derive stage, plus the migration note).
  const rankings = RankingsSchema.parse(
    attachProvenance(cat, buildRankings(products, stories, all, new Date().toISOString())),
  )
  writeJson(path.join(dataDir, 'rankings.json'), rankings)
  const appended = appendScoreHistoryOnChange(dataDir, rankings, rankings.generatedAt, MIGRATION_NOTE)

  // 4. Per-arena migration report (flip stats + before/after leaderboard) for the labeling doc.
  const baseline = readJson(VerdictSchema.array(), path.join(stateDir, cat, 'baseline-verdicts.json'))
  const baseRankings = readJson(RankingsSchema, path.join(stateDir, cat, 'baseline-rankings.json'))
  const storyByIdx = new Map(stories.map((s) => [s.id, s]))
  const baseByCell = new Map(baseline.map((v) => [`${v.productId}:${v.storyId}`, v]))
  let exact = 0, direction = 0
  const transitions: Record<string, number> = {}
  const flips: Array<{ cell: string; base: string; now: string; scoreDelta: number }> = []
  for (const v of all) {
    const bv = baseByCell.get(`${v.productId}:${v.storyId}`)
    if (!bv) continue // cell new since baseline (story/product added) — not a migration flip
    if (bv.verdict === v.verdict) { exact += 1; direction += 1; continue }
    if ((VERDICT_FACTORS[bv.verdict] > 0) === (VERDICT_FACTORS[v.verdict] > 0)) direction += 1
    const t = `${bv.verdict}→${v.verdict}`
    transitions[t] = (transitions[t] ?? 0) + 1
    const story = storyByIdx.get(v.storyId)!
    flips.push({
      cell: `${v.productId}:${v.storyId}`,
      base: `${bv.verdict} q${bv.quality}`,
      now: `${v.verdict} q${v.quality}`,
      scoreDelta: Math.round((cellScore(v, story) - cellScore(bv, story)) * 10) / 10,
    })
  }
  const comparable = all.filter((v) => baseByCell.has(`${v.productId}:${v.storyId}`)).length
  const baseRank = new Map(baseRankings.leaderboard.map((e, i) => [e.productId, { rank: i + 1, aiEra: e.aiEra }]))
  const leaderboard = rankings.leaderboard.map((e, i) => {
    const b = baseRank.get(e.productId)
    return {
      productId: e.productId, rank: i + 1, baseRank: b?.rank ?? null,
      move: b ? b.rank - (i + 1) : null, baseAiEra: b?.aiEra ?? null, aiEra: e.aiEra,
    }
  })
  writeJson(path.join(stateDir, cat, 'report.json'), {
    category: cat, cells: all.length, comparable, exactAgreement: exact,
    exactAgreementPct: comparable ? +((exact / comparable) * 100).toFixed(1) : null,
    directionAgreementPct: comparable ? +((direction / comparable) * 100).toFixed(1) : null,
    flips: flips.length, transitions, scoreHistoryAppended: appended,
    leaderboard,
    biggestFlips: flips.sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta)).slice(0, 15),
  })
  const usage = readUsage(cat)
  console.log(
    `${cat}: finalized — ${all.length} verdicts, ${flips.length}/${comparable} flips `
    + `(${comparable ? ((exact / comparable) * 100).toFixed(1) : 'n/a'}% exact agreement), `
    + `score-history +${appended}, spend $${costUSD(usage).toFixed(2)}`,
  )
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  const cat = arg('category')
  if (cmd === 'submit') { if (!cat) throw new Error('--category required'); await submit(cat); return }
  if (cmd === 'submit-all') {
    // Arena ids from a whitespace-separated file — submits every arena that has no batch.json
    // yet (safe to re-run after a partial failure).
    const file = arg('file')
    if (!file) throw new Error('--file required')
    const cats = fs.readFileSync(path.resolve(file), 'utf8').split(/\s+/).filter(Boolean)
    for (const c of cats) {
      if (fs.existsSync(path.join(stateDir, c, 'batch.json'))) { console.log(`${c}: already submitted — skip`); continue }
      try {
        await submit(c)
      } catch (err) {
        console.error(`SUBMIT FAILED: ${c}: ${err instanceof Error ? err.message : err}`)
      }
    }
    console.log('ALL-SUBMITTED')
    return
  }
  if (cmd === 'status') { await status(cat); return }
  if (cmd === 'ingest') { if (!cat) throw new Error('--category required'); await ingest(cat); return }
  if (cmd === 'restamp-pilot') {
    const pilot = arg('pilot')
    if (!cat || !pilot) throw new Error('--category and --pilot required')
    restampPilot(cat, path.resolve(pilot))
    return
  }
  if (cmd === 'adjust') {
    const file = arg('file')
    if (!cat || !file) throw new Error('--category and --file required')
    applyAdjustments(cat, path.resolve(file))
    return
  }
  console.error('usage: tsx rankings-engine/scripts/migrate-judge-batch.ts <submit|status|ingest|restamp-pilot|adjust> --category <id> [--pilot <dir>] [--file <json>] [--state <dir>]')
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
