// Step→vendor→API-call mapper: for every process step with a committed non-empty 'function'
// story mapping (the same rankable-step enumeration buildProcessCheckSteps and
// processLeaderboard use), take the step's TOP 4 vendors from the story-derived step ranking
// (plus the canonical node.vendor's judged product when not already among them) and ask the LLM
// for 1–3 CONCRETE API calls that vendor exposes for the step's function.
//
// GROUNDING IS THE HARD REQUIREMENT: the prompt carries the vendor's own collected evidence for
// its arena (the most step-relevant entries' url + excerpt, capped at MAX_EVIDENCE_PER_VENDOR),
// the vendor's documented MCP endpoint if any, and the node's canonical functionCalls as a
// semantic reference. Every returned call MUST cite a sourceUrl from exactly that provided set —
// the validator rejects anything else, and rejects method strings that don't look like a call.
// "No grounded calls" is a first-class honest answer (empty array), and empty cells are omitted
// from the committed file.
//
// Same honesty + cost architecture as map-step-stories.ts (the model for this script):
//   - the mapping is an ANNOTATION: verdicts, scoring, judge caches are never touched;
//   - judge-style correction rounds (up to 3) on rule violations;
//   - cached per (step, vendor) by a hash over the step text + vendor + evidence ids/urls used
//     + canonical calls + prompt version (pipeline/cache/step-calls/<arenaId>.json), so re-runs
//     are incremental and a mid-run crash resumes for free;
//   - the committed open-rankings/step-vendor-calls.json is assembled all-or-nothing: unscoped runs
//     require EVERY enumerated target fresh; scoped runs (--task / --tasks) apply the same rule
//     per task, committing every task whose full target set is fresh in cache.
//
// Usage: tsx pipeline/scripts/map-step-calls.ts [--task <id>] [--tasks <id,id,...>] [--report]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { isPopulated } from '../../lib/data'
import { mcpEndpointFor } from '../../lib/mcpEndpoints'
import {
  FunctionCallSchema, loadProcesses, VENDOR_ARENA, vendorProductId, type ProcessTask,
} from '../../lib/processes'
import { functionMappingFor, stepRanking } from '../../lib/processRankings'
import { EvidenceSchema, type Evidence } from '../../lib/schemas'
import {
  StepVendorCallsFileSchema, type StepVendorCallEntry,
} from '../../lib/stepVendorCalls'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, DATA_DIR, writeJson } from '../paths'

export const STEP_CALLS_PROMPT_VERSION = 'v1'

// The founder ask is "here are the ACTUAL calls", not an API reference dump.
export const MAX_CALLS_PER_VENDOR = 3

// Evidence entries offered per (step, vendor) prompt — the most step-relevant slice.
export const MAX_EVIDENCE_PER_VENDOR = 15

// Top-of-ranking vendors enumerated per step (canonical vendor appended when judged elsewhere).
export const TOP_VENDORS_PER_STEP = 4

// Parallel LLM calls — cells are independent, per-arena caches are mutated in memory and
// flushed synchronously, so a pool is safe.
const CONCURRENCY = 8

type FunctionCall = z.infer<typeof FunctionCallSchema>

// One (step, vendor) cell to map. `evidence` is the already-selected relevant slice — the ids
// and urls that go into both the prompt and the cell hash.
export interface CallTarget {
  taskId: string
  nodeId: string
  arenaId: string
  productId: string
  productName: string
  stepKey: string // `${taskId}:${nodeId}`
  label: string
  route: string | undefined
  taskTitle: string
  canonicalCalls: FunctionCall[]
  evidence: Evidence[]
  mcpEndpoint: string | null
}

export function targetHash(t: CallTarget, promptVersion: string): string {
  const payload = JSON.stringify({
    label: t.label,
    route: t.route,
    taskTitle: t.taskTitle,
    productId: t.productId,
    arenaId: t.arenaId,
    evidence: t.evidence.map((e) => [e.id, e.url]),
    mcpEndpoint: t.mcpEndpoint,
    canonicalCalls: t.canonicalCalls,
    promptVersion,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

// ---------------------------------------------------------------------------
// Validation — schema shape, then judge-style rules for the correction rounds
// ---------------------------------------------------------------------------

export const RawCallsSchema = z.object({
  method: z.string().min(1),
  type: z.enum(['rest', 'sdk', 'graphql', 'mcp', 'cli']),
  description: z.string().min(1).optional(),
  sourceUrl: z.string().min(1),
}).array()

export type RawCalls = z.infer<typeof RawCallsSchema>

const REST_RE = /^(GET|POST|PUT|PATCH|DELETE) \/\S+$/
const SDK_RE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+\([\s\S]*\)$/
const GRAPHQL_RE = /^(query|mutation)\s+[A-Za-z_]\w*/
const MCP_RE = /^[A-Za-z][\w.-]*$/
const CLI_RE = /^[a-z][\w@./-]*(\s+\S+)+$/

// Does this method string look like an actual invocation of the declared kind? Rejecting prose
// here is what keeps the committed file copy-pasteable.
export function methodShapeOk(method: string, type: RawCalls[number]['type']): boolean {
  if (method.length > 200) return false
  switch (type) {
    case 'rest':
      return REST_RE.test(method)
    case 'sdk':
      return SDK_RE.test(method)
    case 'graphql':
      // Either an operation document head or the REST-shaped POST to a /graphql endpoint.
      return GRAPHQL_RE.test(method) || REST_RE.test(method)
    case 'mcp':
      return MCP_RE.test(method) // a tool name: create_invoice, stripe_create_payment_link…
    case 'cli':
      return CLI_RE.test(method) // command + at least one argument: `vercel deploy --prod`
  }
}

// A human-readable violation for the correction round, or null when clean.
export function validateCalls(calls: RawCalls, allowedUrls: ReadonlySet<string>): string | null {
  if (calls.length > MAX_CALLS_PER_VENDOR) {
    return `${calls.length} calls exceeds the cap of ${MAX_CALLS_PER_VENDOR} — keep only the most central`
  }
  const seen = new Set<string>()
  for (const c of calls) {
    if (seen.has(c.method)) return `duplicate call "${c.method}"`
    seen.add(c.method)
    if (!allowedUrls.has(c.sourceUrl)) {
      return `sourceUrl "${c.sourceUrl}" is not one of the provided evidence URLs — cite EXACTLY one of the listed URLs, or drop the call`
    }
    if (!methodShapeOk(c.method, c.type)) {
      return `method "${c.method}" does not look like a ${c.type} call — use e.g. "POST /v1/invoices" (rest), "stripe.invoices.create(...)" (sdk), a bare tool name (mcp), or "cmd args" (cli)`
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const SYSTEM = `You identify the CONCRETE API calls a specific vendor product exposes for one step of a startup operating process, grounded ONLY in the evidence excerpts provided.
Rules:
- Return 0 to ${MAX_CALLS_PER_VENDOR} calls. Return [] when the evidence does not show a concrete API surface for this step — "no grounded calls" is a correct, expected answer. Never invent, never pad, never generalize beyond what an excerpt supports.
- Every call's sourceUrl MUST be copied EXACTLY from the provided evidence URLs (or the provided MCP endpoint, only for type "mcp" calls the evidence supports).
- method must be an actual invocation, matched to type:
  - rest: "POST /v1/invoices" (HTTP verb + path)
  - sdk: "stripe.invoices.create(...)" (dotted invocation with parens)
  - graphql: "mutation CreateInvoice(...)" or "POST /graphql"
  - mcp: the bare tool name, e.g. "create_invoice"
  - cli: command plus arguments, e.g. "gh pr create --fill"
- Prefer the 1-3 calls MOST central to performing this step's function; description is one short clause on what the call does for the step.
- The canonical reference calls describe how ANOTHER vendor's API models this step — a semantic hint for what to look for, never something to copy for this vendor.
Return JSON only: [{"method":"...","type":"rest|sdk|graphql|mcp|cli","description":"...","sourceUrl":"..."}]`

export function callPrompt(t: CallTarget, extra = ''): string {
  const canonical = t.canonicalCalls.length > 0
    ? t.canonicalCalls.map((c) => `- ${c.method}${c.description ? ` — ${c.description}` : ''}`).join('\n')
    : '(none declared)'
  const evidenceBlock = t.evidence.length > 0
    ? t.evidence.map((e) => `- [${e.tier}] ${e.url}\n  "${e.excerpt}"`).join('\n')
    : '(no evidence entries)'
  const mcp = t.mcpEndpoint
    ? `MCP endpoint (documented remote MCP server for this vendor): ${t.mcpEndpoint}`
    : 'MCP endpoint: none documented'
  return `Process: ${t.taskTitle}
Step: ${t.label} (route: ${t.route})
Vendor: ${t.productName} (${t.productId}, arena ${t.arenaId})

Canonical reference calls for this step (from the corpus's canonical vendor — semantic reference only):
${canonical}

${mcp}

Evidence for ${t.productName} (${t.evidence.length} entries — sourceUrl must be one of these URLs${t.mcpEndpoint ? ', or the MCP endpoint above' : ''}):
${evidenceBlock}

Which concrete API calls (0-${MAX_CALLS_PER_VENDOR}) does ${t.productName} expose that an agent would use to perform this step?${extra}`
}

// ---------------------------------------------------------------------------
// Evidence selection — deterministic step-relevance filter, never an LLM
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'each', 'all', 'via', 'per',
  'your', 'our', 'their', 'new', 'set', 'get', 'run', 'can', 'has', 'have', 'are', 'was',
])

export function stepTerms(t: Pick<CallTarget, 'label' | 'taskTitle' | 'canonicalCalls'>): string[] {
  const text = [
    t.label,
    t.taskTitle,
    ...t.canonicalCalls.flatMap((c) => [c.method, c.description ?? '']),
  ].join(' ')
  const terms = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) terms.add(raw)
  }
  return [...terms]
}

// The most step-relevant evidence entries: scored by distinct term hits in excerpt+url, ties
// (and the fill below the cap) kept in original file order so the selection — and therefore the
// cell hash — is stable across runs.
export function selectEvidence(all: Evidence[], terms: string[], cap = MAX_EVIDENCE_PER_VENDOR): Evidence[] {
  const scored = all.map((e, i) => {
    const haystack = `${e.excerpt} ${e.url}`.toLowerCase()
    const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0)
    return { e, i, score }
  })
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, cap)
    .map((s) => s.e)
}

// ---------------------------------------------------------------------------
// Target enumeration — the same rankable-step slice buildProcessCheckSteps walks
// ---------------------------------------------------------------------------

const evidenceCache = new Map<string, Evidence[]>()

function evidenceFor(arenaId: string, productId: string): Evidence[] {
  const key = `${arenaId}/${productId}`
  const hit = evidenceCache.get(key)
  if (hit) return hit
  const file = path.join(categoryDir(arenaId), 'evidence', `${productId}.json`)
  const entries = fs.existsSync(file)
    ? EvidenceSchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    : []
  evidenceCache.set(key, entries)
  return entries
}

const productNameCache = new Map<string, Map<string, string>>()

function productNamesFor(arenaId: string): Map<string, string> {
  const hit = productNameCache.get(arenaId)
  if (hit) return hit
  const file = path.join(categoryDir(arenaId), 'products.json')
  const names = fs.existsSync(file)
    ? new Map(
        (JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string; name: string }>)
          .map((p) => [p.id, p.name] as const),
      )
    : new Map<string, string>()
  productNameCache.set(arenaId, names)
  return names
}

export function enumerateCallTargets(tasks: ProcessTask[]): CallTarget[] {
  const targets: CallTarget[] = []
  for (const task of tasks) {
    for (const node of task.dag.nodes) {
      // Rankable-step gate — identical conditions to buildProcessCheckSteps/processLeaderboard:
      // a committed non-empty 'function' mapping onto a populated arena, with a live ranking.
      const entry = functionMappingFor(task.id, node, DATA_DIR)
      if (!entry || entry.storyIds.length === 0 || !isPopulated(entry.arenaId, DATA_DIR)) continue
      const ranking = stepRanking(task.id, node, DATA_DIR)
      if (!ranking) continue

      const base = {
        taskId: task.id,
        nodeId: node.id,
        stepKey: `${task.id}:${node.id}`,
        label: node.label,
        route: node.route,
        taskTitle: task.title,
        canonicalCalls: node.functionCalls ?? [],
      }
      const terms = stepTerms(base)
      const push = (arenaId: string, productId: string) => {
        targets.push({
          ...base,
          arenaId,
          productId,
          productName: productNamesFor(arenaId).get(productId) ?? productId,
          evidence: selectEvidence(evidenceFor(arenaId, productId), terms),
          mcpEndpoint: mcpEndpointFor(arenaId, productId),
        })
      }

      // Top vendors of the step's story-derived ranking, in ranking order.
      const seen = new Set<string>()
      for (const v of ranking.vendors.slice(0, TOP_VENDORS_PER_STEP)) {
        seen.add(`${ranking.arenaId}:${v.productId}`)
        push(ranking.arenaId, v.productId)
      }
      // The canonical node.vendor's product, when judged (its arena populated, product real)
      // and not already among the top slice — evidence lives in ITS arena, which may differ
      // from the step's covering arena (mercury on an expense-management step).
      if (node.vendor) {
        const arenaId = VENDOR_ARENA[node.vendor]
        const productId = vendorProductId(node.vendor)
        if (
          arenaId && isPopulated(arenaId, DATA_DIR) && productNamesFor(arenaId).has(productId)
          && !seen.has(`${arenaId}:${productId}`)
        ) {
          push(arenaId, productId)
        }
      }
    }
  }
  return targets
}

// ---------------------------------------------------------------------------
// Cache + run
// ---------------------------------------------------------------------------

interface CacheEntry {
  hash: string
  calls: RawCalls
}

type ArenaCache = Record<string, CacheEntry> // key: `${taskId}:${nodeId}:${productId}`

function cacheFileFor(arenaId: string): string {
  return path.join(CACHE_DIR, 'step-calls', `${arenaId}.json`)
}

function readArenaCache(file: string): ArenaCache {
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ArenaCache
}

const cacheKeyOf = (t: CallTarget) => `${t.stepKey}:${t.productId}`

async function mapCell(t: CallTarget): Promise<RawCalls> {
  const allowed = new Set(t.evidence.map((e) => e.url))
  if (t.mcpEndpoint) allowed.add(t.mcpEndpoint)
  // No evidence and no MCP endpoint → nothing could ever ground a call. Deterministic empty.
  if (allowed.size === 0) return []

  let raw = await llmJson({ schema: RawCallsSchema, system: SYSTEM, prompt: callPrompt(t) })
  let violation = validateCalls(raw, allowed)
  for (let round = 0; violation && round < 3; round++) {
    raw = await llmJson({
      schema: RawCallsSchema,
      system: SYSTEM,
      // Correction-round message only — the initial prompt and PROMPT_VERSION stay untouched
      // (email-lane precedent 2026-09-23; namecheap Go-SDK trap 2026-09-28: the model kept
      // answering with a bare Go function "CheckWithContext(ctx, domains...)", so the reminder
      // now spells out the dotted-invocation shape for sdk calls).
      prompt: callPrompt(t, `\n\nYour previous answer violated a rule: ${violation}. Correct it — at most ${MAX_CALLS_PER_VENDOR} calls, every sourceUrl copied exactly from the provided URLs, every method a real invocation with NO annotations or parenthetical variants in the method string (put variant notes like "with attachments" in description), and no two calls sharing the same method — fold endpoint variants into one call. CRITICAL REMINDERS: an sdk method MUST be a DOTTED invocation like "client.domains.check(...)" — a bare function name from a language binding (Go's "CheckWithContext(ctx, ...)", a lone "createInvoice(...)") is NOT acceptable: write the dotted client/namespace invocation the evidence shows, or cite the underlying HTTP call as type rest instead. Return [] if nothing is genuinely grounded.`),
    })
    violation = validateCalls(raw, allowed)
  }
  if (violation) throw new Error(`map-step-calls: ${t.stepKey}/${t.productId} still violates rules: ${violation}`)
  return raw
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

function parseTasksFlag(): string[] | undefined {
  const single = arg('--task')
  const multi = arg('--tasks')
  const ids = [
    ...(single ? [single] : []),
    ...(multi ? multi.split(',').map((s) => s.trim()).filter(Boolean) : []),
  ]
  return ids.length > 0 ? ids : undefined
}

export async function runMapper({ tasks: taskIds }: { tasks?: string[] } = {}): Promise<void> {
  const allTasks = loadProcesses(DATA_DIR)
  if (taskIds) {
    for (const id of taskIds) {
      if (!allTasks.some((t) => t.id === id)) throw new Error(`unknown task id: ${id}`)
    }
  }
  const allTargets = enumerateCallTargets(allTasks)
  const runTargets = taskIds ? allTargets.filter((t) => taskIds.includes(t.taskId)) : allTargets

  // Load every touched arena cache once; mutate in memory; flush synchronously per answer.
  const caches = new Map<string, ArenaCache>()
  const cacheOf = (arenaId: string): ArenaCache => {
    let c = caches.get(arenaId)
    if (!c) {
      c = readArenaCache(cacheFileFor(arenaId))
      caches.set(arenaId, c)
    }
    return c
  }

  const stale = runTargets.filter(
    (t) => cacheOf(t.arenaId)[cacheKeyOf(t)]?.hash !== targetHash(t, STEP_CALLS_PROMPT_VERSION),
  )
  console.log(`map-calls: ${runTargets.length} (step, vendor) cells enumerated, ${stale.length} stale`)

  let done = 0
  await runPool(stale, CONCURRENCY, async (t) => {
    const calls = await mapCell(t)
    const cache = cacheOf(t.arenaId)
    cache[cacheKeyOf(t)] = { hash: targetHash(t, STEP_CALLS_PROMPT_VERSION), calls }
    writeJson(cacheFileFor(t.arenaId), cache)
    done += 1
    console.log(`map-calls: [${done}/${stale.length}] ${t.stepKey} × ${t.productId} — ${calls.length} grounded call(s)`)
  })

  // Assemble the committed mapping from cached cells, all-or-nothing. Unscoped: every
  // enumerated target must be fresh. Scoped: per-task all-or-nothing — every task whose FULL
  // target set is fresh is committed (so earlier scoped runs are kept), stale tasks are skipped
  // with a warning and the file simply doesn't cover them yet.
  const freshOf = (t: CallTarget): CacheEntry | null => {
    const cached = cacheOf(t.arenaId)[cacheKeyOf(t)]
    return cached && cached.hash === targetHash(t, STEP_CALLS_PROMPT_VERSION) ? cached : null
  }

  const byTask = new Map<string, CallTarget[]>()
  for (const t of allTargets) byTask.set(t.taskId, [...(byTask.get(t.taskId) ?? []), t])

  const entries: StepVendorCallEntry[] = []
  const coveredTasks: string[] = []
  const staleTasks: string[] = []
  for (const [taskId, targets] of byTask) {
    const cells = targets.map((t) => ({ t, cached: freshOf(t) }))
    if (cells.some((c) => c.cached === null)) {
      staleTasks.push(taskId)
      continue
    }
    coveredTasks.push(taskId)
    for (const { t, cached } of cells) {
      if (cached!.calls.length === 0) continue // honest empties are omitted from the committed file
      entries.push({ taskId: t.taskId, nodeId: t.nodeId, arenaId: t.arenaId, productId: t.productId, calls: cached!.calls })
    }
  }

  if (!taskIds && staleTasks.length > 0) {
    console.warn(`map-calls: mapping incomplete — ${staleTasks.length} task(s) have missing/stale cells (${staleTasks.slice(0, 5).join(', ')}…); not writing step-vendor-calls.json`)
    return
  }
  if (coveredTasks.length === 0) {
    console.warn('map-calls: no task has a fully fresh cell set; not writing step-vendor-calls.json')
    return
  }

  entries.sort(
    (a, b) =>
      a.taskId.localeCompare(b.taskId) ||
      a.nodeId.localeCompare(b.nodeId) ||
      a.arenaId.localeCompare(b.arenaId) ||
      a.productId.localeCompare(b.productId),
  )
  writeJson(path.join(DATA_DIR, 'step-vendor-calls.json'), StepVendorCallsFileSchema.parse(entries))
  const cellsCovered = coveredTasks.reduce((acc, id) => acc + (byTask.get(id)?.length ?? 0), 0)
  console.log(
    `map-calls: wrote ${entries.length} grounded (step, vendor) entries to open-rankings/step-vendor-calls.json — ` +
    `${coveredTasks.length}/${byTask.size} tasks covered (${cellsCovered} cells, ${cellsCovered - entries.length} honest empties omitted)` +
    (staleTasks.length > 0 ? `; NOT covered: ${staleTasks.join(', ')}` : ''),
  )
}

function printReport(): void {
  const file = path.join(DATA_DIR, 'step-vendor-calls.json')
  if (!fs.existsSync(file)) {
    console.log('report: no step-vendor-calls.json yet')
    return
  }
  const entries = StepVendorCallsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  const tasks = new Set(entries.map((e) => e.taskId))
  const steps = new Set(entries.map((e) => `${e.taskId}:${e.nodeId}`))
  const byType = new Map<string, number>()
  for (const e of entries) for (const c of e.calls) byType.set(c.type, (byType.get(c.type) ?? 0) + 1)
  const total = entries.reduce((acc, e) => acc + e.calls.length, 0)
  console.log(`report: ${entries.length} (step, vendor) entries — ${tasks.size} tasks, ${steps.size} steps, ${total} calls`)
  for (const [type, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`report: ${type} — ${n} calls`)
  }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

// tsx entrypoint — skipped when imported by tests (same pattern as map-step-stories.ts).
if (require.main === module) {
  if (process.argv.includes('--report')) {
    printReport()
  } else {
    runMapper({ tasks: parseTasksFlag() }).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
