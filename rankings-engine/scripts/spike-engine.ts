// Spike engine: the standing deep-refresh loop over the whole product fleet.
//
// "Spike" here means what it means everywhere else in this repo (spike-check-*-baseline.ts,
// revert-churn-*-wave.ts): one exhaustive evidence pass over ONE product — re-crawl its full
// documented surface, discover new agent-era docs URLs from the vendor's own llms.txt, append
// them to the product's crawl surface, re-extract, re-probe, re-judge, and settle the result
// under the re-judge stability policy (keep verdict flips that cite newly-added evidence ids,
// revert the rest — the same rule revert-churn-api-quality-wave.ts applies).
//
// The engine maintains open-rankings/spike-queue.json: every judged product in the fleet, ranked by
//   priority = staleness × popularityBoost × founderBoost
// where staleness comes from open-rankings/staleness-report.json when one stands (accuracy-engine's
// weekly keyless scan) with a local median-evidence-age fallback, popularityBoost marks the
// curated open-rankings/popular-products.json set (display-only popularity is never blended into any
// Overall score — this is a WORK-PRIORITIZATION signal only, the same editorial-but-deliberate
// carve-out staleness-scan.ts documents for its weights), and founderBoost comes from
// open-rankings/spike-priorities.json (founder-curated multipliers per arena or per product).
//
// Two modes:
//   rank     (default; keyless, never mutates open-rankings/<arena>/) — recompute the queue ranking,
//            preserving each product's lastSpiked/lastRun history.
//   process  (requires ANTHROPIC_API_KEY) — take the top due product (or an explicit
//            --category/--product target), run one budget-capped exhaustive pass through the
//            EXISTING pipeline stages (crawl → extract → probe → judge), apply the churn
//            policy, then derive + refresh intervals and update the queue entry.
//
// The judge cache is respected by construction: the pass re-judges only cells whose cellHash
// moved (evidence actually changed). Without the key, `process` refuses to run rather than
// half-mutate an arena (appending evidence without a same-run re-judge would strand stale
// judge caches).
//
// Honesty rules: discovered URLs are appended only after a live 200 fetch; excerpts are
// verbatim from fetched content; nothing is ever invented; a vendor with no llms.txt simply
// contributes no discoveries (the absence is recorded in the queue entry's lastRun note).
//
// Invocation:
//   pnpm tsx rankings-engine/scripts/spike-engine.ts                       # rank only (keyless)
//   pnpm tsx rankings-engine/scripts/spike-engine.ts --process             # rank, then spike top due product
//   pnpm tsx rankings-engine/scripts/spike-engine.ts --process --category payments --product adyen
//   pnpm tsx rankings-engine/scripts/spike-engine.ts --issue-body /tmp/spike-issue.md
// Flags: --budget-urls N (default 12 new URLs per pass) · --dry-run (no writes) ·
//        --offline (rank without network; skips nothing else)
//
// Founder-visible state: the UNLINKED /queue page renders open-rankings/spike-queue.json verbatim.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { z } from 'zod'
import { DATA_DIR, ROOT, readCategories, writeJson } from '../paths'
import { EvidenceSchema, ProductSchema, type Verdict } from '../../lib/schemas'

export const QUEUE_FILE = path.join(DATA_DIR, 'spike-queue.json')
export const PRIORITIES_FILE = path.join(DATA_DIR, 'spike-priorities.json')
const STALENESS_REPORT_FILE = path.join(DATA_DIR, 'staleness-report.json')
const POPULAR_FILE = path.join(DATA_DIR, 'popular-products.json')

const TIMEOUT_MS = 10_000
export const DEFAULT_URL_BUDGET = 12
export const SPIKE_INTERVAL_DAYS = 21 // base re-spike cadence; boosts shorten it
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-spike-engine/1.0; +https://ultrametric.ai)'

export const SpikeRunSchema = z.object({
  at: z.string(),
  urlsAdded: z.array(z.string()),
  evidenceAdded: z.number(),
  cellsRejudged: z.number(),
  flipsKept: z.number(),
  flipsReverted: z.number(),
  note: z.string(),
})

export const SpikeEntrySchema = z.object({
  arena: z.string(),
  productId: z.string(),
  name: z.string(),
  priority: z.number(),
  components: z.object({
    staleness: z.number(),
    stalenessSource: z.enum(['report', 'evidence-age', 'none']),
    popularityBoost: z.number(),
    founderBoost: z.number(),
  }),
  status: z.enum(['due', 'queued', 'spiked', 'error']),
  lastSpiked: z.string().nullable(),
  nextDue: z.string().nullable(),
  lastRun: SpikeRunSchema.nullable(),
})

export const SpikeQueueSchema = z.object({
  _comment: z.string(),
  generatedAt: z.string(),
  queue: z.array(SpikeEntrySchema),
})

export const SpikePrioritiesSchema = z.object({
  _comment: z.string(),
  arenas: z.record(z.string(), z.number()),
  products: z.record(z.string(), z.number()),
})

export type SpikeEntry = z.infer<typeof SpikeEntrySchema>
export type SpikeQueue = z.infer<typeof SpikeQueueSchema>
export type SpikePriorities = z.infer<typeof SpikePrioritiesSchema>

const QUEUE_COMMENT =
  'Generated by rankings-engine/scripts/spike-engine.ts — the standing deep-refresh queue. ' +
  'priority = staleness × popularityBoost × founderBoost (work prioritization only; ' +
  'popularity never touches any Overall score). Rendered at the unlinked /queue page.'

// ---------------------------------------------------------------------------
// Pure ranking helpers (unit-tested in rankings-engine/__tests__/spike-engine.test.ts)
// ---------------------------------------------------------------------------

// Same shape as staleness-scan's age axis but spanning the full 0-100 range: fresh evidence
// (≤30 days median) scores 0; 210+ days scores 100; no evidence at all is maximally stale.
export function stalenessFromAge(medianAgeDays: number | null): number {
  if (medianAgeDays === null) return 100
  return Math.round(Math.min(100, Math.max(0, ((medianAgeDays - 30) / 180) * 100)) * 10) / 10
}

export function medianEvidenceAgeDays(evidence: Array<{ fetchedAt: string }>, now: Date): number | null {
  const ages = evidence
    .map((e) => (now.getTime() - Date.parse(e.fetchedAt)) / 86_400_000)
    .filter((d) => Number.isFinite(d))
    .sort((a, b) => a - b)
  if (ages.length === 0) return null
  const mid = Math.floor(ages.length / 2)
  const median = ages.length % 2 === 1 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2
  return Math.round(median * 10) / 10
}

export function founderBoostFor(priorities: SpikePriorities, arena: string, productId: string): number {
  return priorities.products[`${arena}/${productId}`] ?? priorities.arenas[arena] ?? 1
}

export function priorityScore(staleness: number, popularityBoost: number, founderBoost: number): number {
  // Floor at 1 so a just-spiked popular/founder-priority product still outranks a
  // just-spiked nobody instead of everything collapsing to 0.
  return Math.round(Math.max(1, staleness) * popularityBoost * founderBoost * 10) / 10
}

export function nextDueFrom(lastSpiked: string, popularityBoost: number, founderBoost: number): string {
  const days = SPIKE_INTERVAL_DAYS / Math.max(1, popularityBoost * founderBoost)
  return new Date(Date.parse(lastSpiked) + days * 86_400_000).toISOString()
}

export function statusFor(lastSpiked: string | null, nextDue: string | null, now: Date): 'due' | 'spiked' {
  if (lastSpiked === null || nextDue === null) return 'due'
  return Date.parse(nextDue) <= now.getTime() ? 'due' : 'spiked'
}

// The churn policy — identical rule to revert-churn-api-quality-wave.ts: a flip survives only
// when it cites at least one evidence id that did not exist before the pass. One addition the
// wave scripts never needed: a revert is only VALID when the old verdict's citations still
// resolve in the CURRENT evidence file. The probe stage wholesale-replaces tier:'probe' items
// (new ids), so an old verdict citing a replaced probe id cannot be restored without leaving a
// dangling citation (lib/data.ts throws on those) — in that case the fresh judgment stands.
export function churnDecision(
  oldRow: Verdict | undefined,
  newRow: Verdict,
  oldEvidenceIds: Set<string>,
  currentEvidenceIds: Set<string>,
): 'keep' | 'revert' | 'unchanged' {
  if (!oldRow) return 'keep' // no prior verdict — a brand-new cell, nothing to revert to
  if (oldRow.verdict === newRow.verdict && oldRow.quality === newRow.quality) return 'unchanged'
  const citesNew = newRow.evidenceIds.some((id) => !oldEvidenceIds.has(id))
  if (citesNew) return 'keep'
  const oldStillResolves = oldRow.evidenceIds.every((id) => currentEvidenceIds.has(id))
  return oldStillResolves ? 'revert' : 'keep'
}

// llms.txt discovery: pick markdown-link URLs on the vendor's own registrable domain that the
// product does not already crawl, preferring agent-era surfaces. Pure so it's testable.
export function discoverUrlsFromLlmsTxt(
  llmsTxt: string,
  docsUrl: string,
  existingUrls: Set<string>,
  budget: number,
): string[] {
  const domain = registrableDomain(new URL(docsUrl).hostname)
  const found: string[] = []
  const seen = new Set<string>()
  const re = /\((https?:\/\/[^\s)]+)\)|^(https?:\/\/\S+)$/gm
  for (const m of llmsTxt.matchAll(re)) {
    const raw = (m[1] ?? m[2] ?? '').replace(/[),.]+$/, '')
    if (!raw) continue
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      continue
    }
    if (registrableDomain(u.hostname) !== domain) continue
    const url = u.toString()
    if (existingUrls.has(url) || seen.has(url)) continue
    seen.add(url)
    found.push(url)
  }
  const AGENT_TOKENS = /mcp|agent|llms|openapi|webhook|cli|sdk|api-reference|skills|ai\b/i
  const ranked = [...found.filter((u) => AGENT_TOKENS.test(u)), ...found.filter((u) => !AGENT_TOKENS.test(u))]
  return ranked.slice(0, budget)
}

export function registrableDomain(hostname: string): string {
  const parts = hostname.split('.')
  return parts.slice(-2).join('.')
}

// Deterministic queue ordering: priority desc, then staleness desc, then arena/product alpha.
export function sortQueue(entries: SpikeEntry[]): SpikeEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.priority - a.priority ||
      b.components.staleness - a.components.staleness ||
      a.arena.localeCompare(b.arena) ||
      a.productId.localeCompare(b.productId),
  )
}

// ---------------------------------------------------------------------------
// IO
// ---------------------------------------------------------------------------

function readJsonIf<T>(schema: z.ZodType<T>, file: string): T | null {
  if (!fs.existsSync(file)) return null
  try {
    return schema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    return null
  }
}

const StalenessReportSchema = z.object({
  generatedAt: z.string(),
  products: z.array(
    z.object({ arena: z.string(), productId: z.string(), staleness: z.number() }),
  ),
})

function loadPriorities(): SpikePriorities {
  return (
    readJsonIf(SpikePrioritiesSchema, PRIORITIES_FILE) ?? {
      _comment: 'missing open-rankings/spike-priorities.json — all boosts default to 1',
      arenas: {},
      products: {},
    }
  )
}

function loadExistingQueue(): Map<string, SpikeEntry> {
  const existing = readJsonIf(SpikeQueueSchema, QUEUE_FILE)
  const map = new Map<string, SpikeEntry>()
  for (const e of existing?.queue ?? []) map.set(`${e.arena}/${e.productId}`, e)
  return map
}

export function rebuildQueue(now: Date, dryRun: boolean): SpikeQueue {
  const priorities = loadPriorities()
  const popular = new Set<string>(readJsonIf(z.array(z.string()), POPULAR_FILE) ?? [])
  const report = readJsonIf(StalenessReportSchema, STALENESS_REPORT_FILE)
  const reportByKey = new Map<string, number>()
  for (const p of report?.products ?? []) reportByKey.set(`${p.arena}/${p.productId}`, p.staleness)
  const history = loadExistingQueue()

  const entries: SpikeEntry[] = []
  for (const cat of readCategories()) {
    const productsFile = path.join(DATA_DIR, cat.id, 'products.json')
    const verdictsFile = path.join(DATA_DIR, cat.id, 'verdicts.json')
    if (!fs.existsSync(productsFile) || !fs.existsSync(verdictsFile)) continue // page-only / unjudged arenas never queue
    const products = ProductSchema.array().parse(JSON.parse(fs.readFileSync(productsFile, 'utf8')))
    for (const p of products) {
      const key = `${cat.id}/${p.id}`
      const prior = history.get(key)
      let staleness: number
      let stalenessSource: 'report' | 'evidence-age' | 'none'
      const fromReport = reportByKey.get(key)
      if (fromReport !== undefined) {
        // The report's 0-100 combines age with dead-link/flip signals; use it as-is.
        staleness = fromReport
        stalenessSource = 'report'
      } else {
        const evFile = path.join(DATA_DIR, cat.id, 'evidence', `${p.id}.json`)
        const evidence = readJsonIf(EvidenceSchema.array(), evFile)
        if (evidence) {
          staleness = stalenessFromAge(medianEvidenceAgeDays(evidence, now))
          stalenessSource = 'evidence-age'
        } else {
          staleness = 100
          stalenessSource = 'none'
        }
      }
      const popularityBoost = popular.has(p.id) ? 1.25 : 1
      const founderBoost = founderBoostFor(priorities, cat.id, p.id)
      const lastSpiked = prior?.lastSpiked ?? null
      const nextDue = lastSpiked ? nextDueFrom(lastSpiked, popularityBoost, founderBoost) : null
      entries.push({
        arena: cat.id,
        productId: p.id,
        name: p.name,
        priority: priorityScore(staleness, popularityBoost, founderBoost),
        components: { staleness, stalenessSource, popularityBoost, founderBoost },
        status: prior?.status === 'error' ? 'error' : statusFor(lastSpiked, nextDue, now),
        lastSpiked,
        nextDue,
        lastRun: prior?.lastRun ?? null,
      })
    }
  }

  const queue: SpikeQueue = { _comment: QUEUE_COMMENT, generatedAt: now.toISOString(), queue: sortQueue(entries) }
  if (!dryRun) writeJson(QUEUE_FILE, queue)
  return queue
}

// ---------------------------------------------------------------------------
// The spike pass
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<{ status: number; text: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    })
    const text = await res.text()
    clearTimeout(timer)
    return { status: res.status, text }
  } catch {
    return null
  }
}

function runStage(args: string[]): void {
  const res = spawnSync('pnpm', args, { cwd: ROOT, stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`spike-engine: \`pnpm ${args.join(' ')}\` exited ${res.status}`)
}

interface PassResult {
  urlsAdded: string[]
  evidenceAdded: number
  cellsRejudged: number
  flipsKept: number
  flipsReverted: number
  note: string
}

async function spikeProduct(arena: string, productId: string, urlBudget: number, dryRun: boolean): Promise<PassResult> {
  const arenaDir = path.join(DATA_DIR, arena)
  const productsFile = path.join(arenaDir, 'products.json')
  // Read raw (not schema-parsed) everywhere this function WRITES back: zod .parse() strips
  // unknown keys, and a queue engine must never silently drop fields other lanes added.
  const products = JSON.parse(fs.readFileSync(productsFile, 'utf8')) as Array<{
    id: string
    urls: { site?: string; docs?: string; extra?: string[] }
  }>
  const product = products.find((p) => p.id === productId)
  if (!product) throw new Error(`spike-engine: unknown product ${arena}/${productId}`)

  const evidenceFile = path.join(arenaDir, 'evidence', `${productId}.json`)
  const verdictsFile = path.join(arenaDir, 'verdicts.json')
  const oldEvidence = readJsonIf(EvidenceSchema.array(), evidenceFile) ?? []
  const oldEvidenceIds = new Set(oldEvidence.map((e) => e.id))
  const oldVerdicts: Verdict[] = fs.existsSync(verdictsFile)
    ? (JSON.parse(fs.readFileSync(verdictsFile, 'utf8')) as Verdict[])
    : []
  const oldByStory = new Map(oldVerdicts.filter((v) => v.productId === productId).map((v) => [v.storyId, v]))

  // 1. Discovery: the vendor's own llms.txt, on the docs origin — new same-domain URLs the
  //    product doesn't crawl yet, verified live (200) before they're appended.
  const notes: string[] = []
  const urlsAdded: string[] = []
  const docsUrl = product.urls.docs ?? product.urls.site
  if (docsUrl) {
    const origin = new URL(docsUrl).origin
    const llms = await fetchText(`${origin}/llms.txt`)
    if (llms && llms.status === 200 && /^#|\]\(http/m.test(llms.text)) {
      const existing = new Set<string>([
        ...(product.urls.extra ?? []),
        product.urls.site ?? '',
        product.urls.docs ?? '',
      ])
      const candidates = discoverUrlsFromLlmsTxt(llms.text, docsUrl, existing, urlBudget)
      for (const url of candidates) {
        const live = await fetchText(url)
        if (live && live.status === 200 && live.text.trim().length > 0) urlsAdded.push(url)
      }
      if (urlsAdded.length === 0) notes.push('llms.txt live; no new same-domain URLs beyond the crawled surface')
    } else {
      notes.push(`no llms.txt on ${origin} (recorded absence)`)
    }
  } else {
    notes.push('product has no docs/site URL — discovery skipped')
  }

  if (dryRun) {
    return {
      urlsAdded,
      evidenceAdded: 0,
      cellsRejudged: 0,
      flipsKept: 0,
      flipsReverted: 0,
      note: `dry run — would append ${urlsAdded.length} url(s); ${notes.join('; ') || 'discovery ok'}`,
    }
  }

  if (urlsAdded.length > 0) {
    product.urls.extra = [...(product.urls.extra ?? []), ...urlsAdded]
    writeJson(productsFile, products)
  }

  // 2. The existing pipeline does the actual work — crawl/extract/probe/judge all respect
  //    their own caches, so unchanged evidence costs no LLM calls.
  runStage(['tsx', 'rankings-engine/cli.ts', 'crawl', '--category', arena, '--product', productId])
  runStage(['tsx', 'rankings-engine/cli.ts', 'extract', '--category', arena, '--product', productId])
  runStage(['tsx', 'rankings-engine/cli.ts', 'probe', '--category', arena, '--product', productId])
  runStage(['tsx', 'rankings-engine/cli.ts', 'judge', '--category', arena, '--product', productId])
  runStage(['tsx', 'rankings-engine/cli.ts', 'judge', '--category', arena]) // reassemble verdicts.json

  // 3. Churn policy over the fresh verdicts.
  const newEvidence = readJsonIf(EvidenceSchema.array(), evidenceFile) ?? []
  const currentEvidenceIds = new Set(newEvidence.map((e) => e.id))
  const evidenceAdded = newEvidence.filter((e) => !oldEvidenceIds.has(e.id)).length
  const newVerdicts: Verdict[] = fs.existsSync(verdictsFile)
    ? (JSON.parse(fs.readFileSync(verdictsFile, 'utf8')) as Verdict[])
    : []
  let flipsKept = 0
  let flipsReverted = 0
  let cellsRejudged = 0
  const settled = newVerdicts.map((v) => {
    if (v.productId !== productId) return v
    const old = oldByStory.get(v.storyId)
    const decision = churnDecision(old, v, oldEvidenceIds, currentEvidenceIds)
    if (decision === 'unchanged') return v
    cellsRejudged++
    if (decision === 'keep') {
      flipsKept++
      return v
    }
    flipsReverted++
    console.log(`REVERT ${arena}/${productId}:${v.storyId} ${v.verdict}/q${v.quality} -> ${old!.verdict}/q${old!.quality} (no new citation)`)
    // Patch the judge cache too (same mechanics as revert-churn-*-wave.ts): keep the current
    // hash, restore the old verdict, so the next judge run doesn't resurrect the churn.
    const cacheFile = path.join(ROOT, 'pipeline', 'cache', 'judge', arena, productId, `${v.storyId}.json`)
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string }
      writeJson(cacheFile, { hash: cached.hash, verdict: old })
    }
    return old!
  })
  writeJson(verdictsFile, settled)

  // 4. Re-derive and refresh intervals from the settled matrix.
  runStage(['tsx', 'rankings-engine/cli.ts', 'derive', '--category', arena])
  runStage(['tsx', 'rankings-engine/scripts/compute-confidence-intervals.ts', '--category', arena])

  return {
    urlsAdded,
    evidenceAdded,
    cellsRejudged,
    flipsKept,
    flipsReverted,
    note: notes.join('; ') || 'full pass complete',
  }
}

// ---------------------------------------------------------------------------
// Issue body (work-queue markdown, same pattern as staleness-scan/yc-coverage)
// ---------------------------------------------------------------------------

export function buildIssueBody(queue: SpikeQueue, top = 10): string {
  const lines = [
    `# Spike queue — ${queue.generatedAt}`,
    '',
    'Ranked by staleness × popularity × founder priority (work prioritization only).',
    '',
    '| # | product | arena | priority | staleness | last spiked | status |',
    '|---|---------|-------|----------|-----------|-------------|--------|',
  ]
  queue.queue.slice(0, top).forEach((e, i) => {
    lines.push(
      `| ${i + 1} | ${e.name} | ${e.arena} | ${e.priority} | ${e.components.staleness} | ${e.lastSpiked ?? 'never'} | ${e.status} |`,
    )
  })
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Args {
  process: boolean
  category?: string
  product?: string
  budgetUrls: number
  dryRun: boolean
  issueBody?: string
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { process: false, budgetUrls: DEFAULT_URL_BUDGET, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--process') args.process = true
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--category') args.category = argv[++i]
    else if (a === '--product') args.product = argv[++i]
    else if (a === '--budget-urls') args.budgetUrls = Number(argv[++i])
    else if (a === '--issue-body') args.issueBody = argv[++i]
    else throw new Error(`spike-engine: unknown arg ${a}`)
  }
  if (!Number.isFinite(args.budgetUrls) || args.budgetUrls < 0) throw new Error('spike-engine: bad --budget-urls')
  if ((args.category && !args.product) || (!args.category && args.product))
    throw new Error('spike-engine: --category and --product must be given together')
  return args
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const now = new Date()
  let queue = rebuildQueue(now, args.dryRun)
  console.log(`spike-engine: queue ranked — ${queue.queue.length} products, top: ${queue.queue[0]?.arena}/${queue.queue[0]?.productId} @ ${queue.queue[0]?.priority}`)

  if (args.process) {
    if (!process.env.ANTHROPIC_API_KEY && !args.dryRun) {
      throw new Error('spike-engine: --process needs ANTHROPIC_API_KEY (a pass appends evidence and must re-judge in the same run)')
    }
    const target = args.category
      ? queue.queue.find((e) => e.arena === args.category && e.productId === args.product)
      : queue.queue.find((e) => e.status === 'due')
    if (!target) {
      console.log('spike-engine: nothing due — done.')
      return
    }
    console.log(`spike-engine: spiking ${target.arena}/${target.productId} (priority ${target.priority})`)
    let result: PassResult
    try {
      result = await spikeProduct(target.arena, target.productId, args.budgetUrls, args.dryRun)
    } catch (err) {
      if (!args.dryRun) {
        target.status = 'error'
        target.lastRun = {
          at: now.toISOString(),
          urlsAdded: [],
          evidenceAdded: 0,
          cellsRejudged: 0,
          flipsKept: 0,
          flipsReverted: 0,
          note: `pass failed: ${err instanceof Error ? err.message : String(err)}`,
        }
        writeJson(QUEUE_FILE, queue)
      }
      throw err
    }
    if (!args.dryRun) {
      // Re-rank with the pass recorded: staleness signals moved, so rebuild from disk.
      target.lastSpiked = now.toISOString()
      target.status = 'spiked'
      target.lastRun = { at: now.toISOString(), ...result }
      writeJson(QUEUE_FILE, queue)
      queue = rebuildQueue(new Date(), false)
    }
    console.log(
      `spike-engine: ${target.arena}/${target.productId} — +${result.urlsAdded.length} urls, +${result.evidenceAdded} evidence, ${result.cellsRejudged} cells moved (${result.flipsKept} kept, ${result.flipsReverted} reverted)`,
    )
  }

  if (args.issueBody) {
    fs.writeFileSync(args.issueBody, buildIssueBody(queue))
    console.log(`spike-engine: issue body written to ${args.issueBody}`)
  }
}

if (require.main === module) {
  run()
    .then(() => {
      // Same force-exit as rankings-engine/cli.ts: kept-alive HTTP sessions from the discovery
      // fetches (seen live on docs.mem0.ai, 2026-09-15) hold the event loop open after all
      // work is written; all writes above are synchronous.
      setImmediate(() => process.exit(0))
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
