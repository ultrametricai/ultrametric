// Fleet-wide staleness scanner — the keyless heart of the accuracy engine
// (.github/workflows/accuracy-engine.yml, docs/ACCURACY.md). For every product it scores four
// families of staleness signal and writes data/staleness-report.json ranked worst-first:
//
//   1. evidence age        — fetchedAt percentiles of the product's evidence pack: packs whose
//                            median item is months old are due a re-crawl.
//   2. dead evidence URLs  — live sample-check of the TOP-CITED evidence URLs (the ones verdicts
//                            actually lean on): 404/410/DNS-dead citations mean verdicts standing
//                            on links that no longer exist — the "product pivoted/died since we
//                            judged it" tripwire.
//   3. crawl-gap signatures — pure-data contradictions the fleet audits keep finding:
//                            · api-quality gap: `agentic-public-api` full/partial while ALL four
//                              api-quality stories are zero-evidence none (the 54-product audit
//                              signature, see pipeline/scripts/append-api-quality-docs-evidence.py)
//                            · agent-docs contradiction (the cline case, commit 14e665a0): the
//                              evidence pack holds a positive "PROBE llms.txt: HTTP 200" item but
//                              the `agentic-agent-docs` verdict is still a zero-evidence none.
//   4. live flips          — re-checks like the cline case but against the LIVE site: a product
//                            whose agent-docs verdict is none with no positive probe, whose
//                            /llms.txt now answers 200 (llms-txt flip); or a documented remote MCP
//                            endpoint (lib/mcpEndpoints.ts allowlist) while `agentic-mcp-server`
//                            is still a none (mcp flip).
//
// KEYLESS by design: no LLM ever runs here. The scan only DETECTS and RANKS; re-crawling and
// re-judging stay in story-runner's keyed runs, which read this report to pick the worst-stale
// arena first (see story-runner.yml's "Pick arena" step). Scoring weights live in
// stalenessScore() below; everything pure is exported for pipeline/__tests__/staleness-scan.test.ts.
//
//   pnpm tsx pipeline/scripts/staleness-scan.ts [--category <id>] [--offline]
//     [--issue-body <path>] [--out <path>]
//
// --offline skips every network check (age + pure-data signatures only); --issue-body writes the
// accuracy-engine work-queue issue markdown alongside the JSON report.
import fs from 'node:fs'
import path from 'node:path'
import { MCP_ENDPOINTS } from '../../lib/mcpEndpoints'
import { isSharedCodeHostOrigin } from '../stages/probe'
import {
  EvidenceSchema, ProductSchema, StorySchema, VerdictSchema,
  type Evidence, type Product, type Story, type Verdict,
} from '../../lib/schemas'
import { DATA_DIR, readJson, resolveCategories, writeJson } from '../paths'

export const STALENESS_REPORT_FILE = 'staleness-report.json'

const TIMEOUT_MS = 8_000
const MAX_CONCURRENT = 4
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-staleness/1.0; +https://ultrametric.ai)'
// How many top-cited URLs get live-checked per product — bounded so a fleet run stays polite.
const CITED_URL_SAMPLE = 2

// Same positive-probe prefixes as pipeline/scripts/cert-candidates.ts / slo-check.ts — the
// canonical wording pipeline/stages/probe.ts stamps into probe evidence.
const LLMS_POSITIVE_PREFIX = 'PROBE llms.txt: HTTP 200'

export interface LiveFlip {
  url: string
  status: number
}

export interface ProductStaleness {
  arena: string
  productId: string
  /** 0–100, higher = staler / more in need of a keyed re-run. */
  staleness: number
  signals: {
    evidenceCount: number
    medianAgeDays: number | null
    oldestAgeDays: number | null
    /** Top-cited evidence URLs that answered 404/410 or nothing at all (status 0). */
    deadCitedUrls: Array<{ url: string; status: number }>
    checkedUrls: number
    apiQualityGap: boolean
    agentDocsContradiction: boolean
    /** Live /llms.txt answered 200 while the agent-docs verdict is a zero-evidence none. */
    llmsTxtFlip: LiveFlip | null
    /** Documented remote MCP endpoint while agentic-mcp-server is still a none. */
    mcpFlip: { endpoint: string } | null
  }
}

export interface ArenaStaleness {
  arena: string
  staleness: number
  products: number
}

export interface StalenessReport {
  generatedAt: string
  offline: boolean
  fleet: {
    arenas: number
    products: number
    urlsChecked: number
    deadUrls: number
    apiQualityGaps: number
    agentDocsContradictions: number
    llmsTxtFlips: number
    mcpFlips: number
  }
  /** Arena ids, worst-stale first — what story-runner.yml's rotation consumes. */
  arenasRanked: string[]
  arenas: ArenaStaleness[]
  /** Every product, worst-stale first. */
  products: ProductStaleness[]
}

// ---------------------------------------------------------------------------------------------
// Pure signal detectors (exported for tests)

const DAY_MS = 24 * 60 * 60 * 1000

export function ageDays(evidence: Evidence[], now: Date): { median: number | null; oldest: number | null } {
  if (evidence.length === 0) return { median: null, oldest: null }
  const days = evidence
    .map((e) => Math.max(0, (now.getTime() - Date.parse(e.fetchedAt)) / DAY_MS))
    .sort((a, b) => a - b)
  const mid = Math.floor(days.length / 2)
  const median = days.length % 2 === 1 ? days[mid] : (days[mid - 1] + days[mid]) / 2
  return { median: Math.round(median), oldest: Math.round(days[days.length - 1]) }
}

const verdictFor = (verdicts: Verdict[], productId: string, storyId: string): Verdict | undefined =>
  verdicts.find((v) => v.productId === productId && v.storyId === storyId)

// The 54-product audit signature: public API judged real, yet every api-quality story is a
// zero-evidence none — the api-quality crawl never covered the API surface it needed to.
export function hasApiQualityGap(stories: Story[], verdicts: Verdict[], productId: string): boolean {
  const publicApi = verdictFor(verdicts, productId, 'agentic-public-api')
  if (!publicApi || (publicApi.verdict !== 'full' && publicApi.verdict !== 'partial')) return false
  const apiStories = stories.filter((s) => s.group === 'api-quality')
  if (apiStories.length === 0) return false
  return apiStories.every((s) => {
    const v = verdictFor(verdicts, productId, s.id)
    return v !== undefined && v.verdict === 'none' && v.evidenceIds.length === 0
  })
}

// The cline signature: a positive llms.txt probe already sits in the evidence pack, but the
// agent-docs verdict is still a zero-evidence none — the judge never saw (or never cited) it.
// A positive probe at a shared code-host origin is excluded: github.com/llms.txt is GitHub's
// platform file, not the product's, and counting it produced the llama-cpp false contradiction
// (issue #85). Legacy packs may still carry such items until their next probe run drops them.
export function hasAgentDocsContradiction(evidence: Evidence[], verdicts: Verdict[], productId: string): boolean {
  const agentDocs = verdictFor(verdicts, productId, 'agentic-agent-docs')
  if (!agentDocs || agentDocs.verdict !== 'none' || agentDocs.evidenceIds.length > 0) return false
  return evidence.some((e) => e.tier === 'probe' && e.excerpt.startsWith(LLMS_POSITIVE_PREFIX) && !isSharedCodeHostOrigin(e.url))
}

// Candidate for the LIVE llms.txt re-check: agent-docs none AND no positive probe recorded
// (when a positive probe exists it's the contradiction above — no fetch needed).
export function isLlmsFlipCandidate(evidence: Evidence[], verdicts: Verdict[], productId: string): boolean {
  const agentDocs = verdictFor(verdicts, productId, 'agentic-agent-docs')
  if (!agentDocs || agentDocs.verdict !== 'none') return false
  return !evidence.some((e) => e.tier === 'probe' && e.excerpt.startsWith(LLMS_POSITIVE_PREFIX))
}

// A committed-data-documented remote MCP endpoint while the mcp-server verdict is a none.
export function mcpFlipEndpoint(arena: string, productId: string, verdicts: Verdict[]): string | null {
  const endpoint = MCP_ENDPOINTS[`${arena}/${productId}`]
  if (!endpoint) return null
  const mcpServer = verdictFor(verdicts, productId, 'agentic-mcp-server')
  if (!mcpServer || mcpServer.verdict !== 'none') return null
  return endpoint
}

// Probe items that RECORDED absence (negative probes: "PROBE openapi: HTTP 404 at …", "all
// candidate paths 404", stale-curated-link notes). Their URL 404ing live is CONSISTENT with the
// evidence, not staleness — checking them would flag every honest negative as a dead citation.
export function recordsAbsence(e: Evidence): boolean {
  return e.tier === 'probe' && /HTTP 4\d\d at |all candidate paths 404|curated link may be stale/.test(e.excerpt)
}

// Citation-weighted URL sample: the evidence URLs verdicts lean on hardest. Deterministic
// (count desc, url asc), https-only, negative-probe artifacts excluded, capped at `limit`
// distinct URLs.
export function topCitedUrls(evidence: Evidence[], verdicts: Verdict[], productId: string, limit: number = CITED_URL_SAMPLE): string[] {
  const byId = new Map(evidence.map((e) => [e.id, e]))
  const counts = new Map<string, number>()
  for (const v of verdicts) {
    if (v.productId !== productId) continue
    for (const id of v.evidenceIds) {
      const e = byId.get(id)
      if (!e || !e.url.startsWith('https://') || recordsAbsence(e)) continue
      counts.set(e.url, (counts.get(e.url) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([url]) => url)
}

// Dead = the citation no longer resolves to anything: 404/410, or no HTTP response at all
// (DNS gone / connection refused — the pivoted-startup case). Auth walls (401/403), rate
// limits (429), method walls (405) and 5xx blips are all ALIVE: the resource exists.
export const isDeadStatus = (status: number): boolean => status === 0 || status === 404 || status === 410

export interface StalenessSignals {
  medianAgeDays: number | null
  deadCitedUrls: number
  apiQualityGap: boolean
  agentDocsContradiction: boolean
  llmsTxtFlip: boolean
  mcpFlip: boolean
}

// The ranking function. Weights are editorial but deliberate: contradictions/flips (a wrong
// verdict TODAY) outrank age (a verdict that may merely be due); dead citations sit between.
export function stalenessScore(s: StalenessSignals): number {
  let score = 0
  if (s.medianAgeDays !== null) {
    // 0 pts through 30 days, then linear to the 40-pt cap at 210 days.
    score += Math.min(40, Math.max(0, ((s.medianAgeDays - 30) / 180) * 40))
  } else {
    score += 40 // no evidence at all is maximally stale on the age axis
  }
  score += Math.min(30, s.deadCitedUrls * 15)
  if (s.apiQualityGap) score += 15
  if (s.agentDocsContradiction) score += 20
  if (s.llmsTxtFlip) score += 20
  if (s.mcpFlip) score += 15
  return Math.round(Math.min(100, score) * 10) / 10
}

// ---------------------------------------------------------------------------------------------
// Live checks (skipped under --offline)

async function fetchStatus(url: string): Promise<number> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    void res.body?.cancel().catch(() => {})
    return res.status
  } catch {
    return 0
  }
}

// GET /llms.txt and confirm it's a real text document (same tells as worker.js's handleScan):
// 200, non-empty, not an HTML error page served with a 200.
async function fetchLlmsStatus(url: string): Promise<{ status: number; found: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status !== 200) {
      void res.body?.cancel().catch(() => {})
      return { status: res.status, found: false }
    }
    const text = (await res.text()).slice(0, 65536)
    const found = text.trim().length > 0 && !text.trimStart().startsWith('<')
    return { status: res.status, found }
  } catch {
    return { status: 0, found: false }
  }
}

// slo-check.ts's cursor worker pool — bounded concurrency without dependencies.
async function mapPool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: MAX_CONCURRENT }, worker))
  return results
}

// ---------------------------------------------------------------------------------------------
// Work-queue issue body (consumed by accuracy-engine.yml's `gh issue create`)

export function buildIssueBody(report: StalenessReport, top: number = 20): string {
  const lines: string[] = []
  const date = report.generatedAt.slice(0, 10)
  lines.push(`## Accuracy-engine work queue — ${date}`)
  lines.push('')
  lines.push(
    `Fleet scan (keyless, \`pipeline/scripts/staleness-scan.ts\`): ` +
    `${report.fleet.products} products across ${report.fleet.arenas} arenas · ` +
    `${report.fleet.urlsChecked} top-cited URLs live-checked, ${report.fleet.deadUrls} dead · ` +
    `${report.fleet.llmsTxtFlips} llms.txt flips · ${report.fleet.mcpFlips} MCP flips · ` +
    `${report.fleet.apiQualityGaps} api-quality gaps · ${report.fleet.agentDocsContradictions} agent-docs contradictions.`,
  )
  lines.push('')
  lines.push('Story-runner picks the worst-stale arena first while this report stands (see story-runner.yml). ' +
    'Flips and contradictions below need a KEYED re-crawl + re-judge — the scan never re-judges.')
  lines.push('')
  lines.push('### Worst-stale arenas')
  lines.push('')
  lines.push('| # | arena | staleness | products |')
  lines.push('|---|-------|-----------|----------|')
  report.arenas.slice(0, 10).forEach((a, i) => {
    lines.push(`| ${i + 1} | ${a.arena} | ${a.staleness} | ${a.products} |`)
  })
  lines.push('')
  lines.push(`### Worst-stale products (top ${top})`)
  lines.push('')
  lines.push('| # | product | arena | staleness | signals |')
  lines.push('|---|---------|-------|-----------|---------|')
  report.products.slice(0, top).forEach((p, i) => {
    const s = p.signals
    const tags = [
      s.medianAgeDays !== null ? `age ${s.medianAgeDays}d` : 'no evidence',
      ...(s.deadCitedUrls.length > 0 ? [`${s.deadCitedUrls.length} dead url${s.deadCitedUrls.length === 1 ? '' : 's'}`] : []),
      ...(s.apiQualityGap ? ['api-quality gap'] : []),
      ...(s.agentDocsContradiction ? ['agent-docs contradiction'] : []),
      ...(s.llmsTxtFlip ? ['llms.txt flip'] : []),
      ...(s.mcpFlip ? ['mcp flip'] : []),
    ]
    lines.push(`| ${i + 1} | ${p.productId} | ${p.arena} | ${p.staleness} | ${tags.join(' · ')} |`)
  })
  const flips = report.products.filter((p) => p.signals.llmsTxtFlip || p.signals.mcpFlip || p.signals.agentDocsContradiction)
  if (flips.length > 0) {
    lines.push('')
    lines.push('### Flips + contradictions needing a keyed re-judge')
    lines.push('')
    for (const p of flips) {
      const s = p.signals
      if (s.agentDocsContradiction) lines.push(`- **${p.arena}/${p.productId}** — positive \`PROBE llms.txt: HTTP 200\` already in the evidence pack, but \`agentic-agent-docs\` is a zero-evidence none (the cline signature).`)
      if (s.llmsTxtFlip) lines.push(`- **${p.arena}/${p.productId}** — \`agentic-agent-docs\` is none, but ${s.llmsTxtFlip.url} answers HTTP ${s.llmsTxtFlip.status} live right now.`)
      if (s.mcpFlip) lines.push(`- **${p.arena}/${p.productId}** — documented remote MCP endpoint ${s.mcpFlip.endpoint} (allowlist), but \`agentic-mcp-server\` is none.`)
    }
  }
  lines.push('')
  lines.push('_Generated by accuracy-engine.yml (weekly, keyless). Close after the listed arenas have been through keyed story-runner runs._')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------

interface CliArgs {
  category?: string
  offline: boolean
  issueBody?: string
  out?: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { offline: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--category') args.category = argv[++i]
    else if (argv[i] === '--offline') args.offline = true
    else if (argv[i] === '--issue-body') args.issueBody = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  return args
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const now = new Date()

  interface Loaded {
    arena: string
    product: Product
    evidence: Evidence[]
    stories: Story[]
    verdicts: Verdict[]
  }
  const loaded: Loaded[] = []
  let arenaCount = 0
  for (const cat of resolveCategories(args.category)) {
    const dir = path.join(DATA_DIR, cat.id)
    const verdictsFile = path.join(dir, 'verdicts.json')
    if (!fs.existsSync(verdictsFile)) continue // unpopulated arena
    arenaCount++
    const products = readJson(ProductSchema.array(), path.join(dir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dir, 'stories.json'))
    const verdicts = readJson(VerdictSchema.array(), verdictsFile)
    for (const product of products) {
      const evidenceFile = path.join(dir, 'evidence', `${product.id}.json`)
      const evidence = fs.existsSync(evidenceFile) ? readJson(EvidenceSchema.array(), evidenceFile) : []
      loaded.push({ arena: cat.id, product, evidence, stories, verdicts })
    }
  }

  console.log(`staleness-scan: ${loaded.length} products across ${arenaCount} arenas${args.offline ? ' (offline — no live checks)' : ''}`)

  // --- live checks, deduped fleet-wide -------------------------------------------------------
  const statusByUrl = new Map<string, number>()
  const llmsByUrl = new Map<string, { status: number; found: boolean }>()
  if (!args.offline) {
    const citedUrls = new Set<string>()
    for (const item of loaded) {
      for (const url of topCitedUrls(item.evidence, item.verdicts, item.product.id)) citedUrls.add(url)
    }
    const llmsUrls = new Set<string>()
    for (const item of loaded) {
      if (!isLlmsFlipCandidate(item.evidence, item.verdicts, item.product.id)) continue
      try {
        const origin = new URL(item.product.urls.docs ?? item.product.urls.site).origin
        // A shared code-host origin serves the HOST's llms.txt, not the product's — probing it
        // would flag a false flip for every repo-hosted product (see pipeline/stages/probe.ts).
        if (isSharedCodeHostOrigin(origin)) continue
        llmsUrls.add(`${origin}/llms.txt`)
      } catch { /* malformed product URL — skip */ }
    }
    const citedList = [...citedUrls].sort()
    const llmsList = [...llmsUrls].sort()
    console.log(`staleness-scan: live-checking ${citedList.length} top-cited URLs + ${llmsList.length} llms.txt candidates (≤${MAX_CONCURRENT} concurrent, ${TIMEOUT_MS / 1000}s timeout)`)
    const citedStatuses = await mapPool(citedList, fetchStatus)
    citedList.forEach((url, i) => statusByUrl.set(url, citedStatuses[i]))
    const llmsResults = await mapPool(llmsList, fetchLlmsStatus)
    llmsList.forEach((url, i) => llmsByUrl.set(url, llmsResults[i]))
  }

  // --- assemble per-product rows -------------------------------------------------------------
  const products: ProductStaleness[] = loaded.map((item) => {
    const { arena, product, evidence, stories, verdicts } = item
    const age = ageDays(evidence, now)
    const sampled = args.offline ? [] : topCitedUrls(evidence, verdicts, product.id)
    const deadCitedUrls = sampled
      .map((url) => ({ url, status: statusByUrl.get(url) ?? 0 }))
      .filter((r) => isDeadStatus(r.status))

    let llmsTxtFlip: LiveFlip | null = null
    if (!args.offline && isLlmsFlipCandidate(evidence, verdicts, product.id)) {
      try {
        const origin = new URL(product.urls.docs ?? product.urls.site).origin
        const url = `${origin}/llms.txt`
        const res = llmsByUrl.get(url)
        if (!isSharedCodeHostOrigin(origin) && res?.found) llmsTxtFlip = { url, status: res.status }
      } catch { /* malformed product URL */ }
    }

    const mcpEndpoint = mcpFlipEndpoint(arena, product.id, verdicts)
    const signals: ProductStaleness['signals'] = {
      evidenceCount: evidence.length,
      medianAgeDays: age.median,
      oldestAgeDays: age.oldest,
      deadCitedUrls,
      checkedUrls: sampled.length,
      apiQualityGap: hasApiQualityGap(stories, verdicts, product.id),
      agentDocsContradiction: hasAgentDocsContradiction(evidence, verdicts, product.id),
      llmsTxtFlip,
      mcpFlip: mcpEndpoint ? { endpoint: mcpEndpoint } : null,
    }
    return {
      arena,
      productId: product.id,
      staleness: stalenessScore({
        medianAgeDays: signals.medianAgeDays,
        deadCitedUrls: signals.deadCitedUrls.length,
        apiQualityGap: signals.apiQualityGap,
        agentDocsContradiction: signals.agentDocsContradiction,
        llmsTxtFlip: signals.llmsTxtFlip !== null,
        mcpFlip: signals.mcpFlip !== null,
      }),
      signals,
    }
  })
  products.sort((a, b) => b.staleness - a.staleness || a.arena.localeCompare(b.arena) || a.productId.localeCompare(b.productId))

  const byArena = new Map<string, ProductStaleness[]>()
  for (const p of products) {
    const list = byArena.get(p.arena)
    if (list) list.push(p)
    else byArena.set(p.arena, [p])
  }
  const arenas: ArenaStaleness[] = [...byArena.entries()]
    .map(([arena, rows]) => ({
      arena,
      staleness: Math.round((rows.reduce((sum, r) => sum + r.staleness, 0) / rows.length) * 10) / 10,
      products: rows.length,
    }))
    .sort((a, b) => b.staleness - a.staleness || a.arena.localeCompare(b.arena))

  const report: StalenessReport = {
    generatedAt: now.toISOString(),
    offline: args.offline,
    fleet: {
      arenas: arenaCount,
      products: products.length,
      urlsChecked: statusByUrl.size,
      deadUrls: [...statusByUrl.values()].filter(isDeadStatus).length,
      apiQualityGaps: products.filter((p) => p.signals.apiQualityGap).length,
      agentDocsContradictions: products.filter((p) => p.signals.agentDocsContradiction).length,
      llmsTxtFlips: products.filter((p) => p.signals.llmsTxtFlip !== null).length,
      mcpFlips: products.filter((p) => p.signals.mcpFlip !== null).length,
    },
    arenasRanked: arenas.map((a) => a.arena),
    arenas,
    products,
  }

  const outFile = args.out ?? path.join(DATA_DIR, STALENESS_REPORT_FILE)
  writeJson(outFile, report)
  console.log(`staleness-scan: wrote ${path.relative(process.cwd(), outFile)}`)

  if (args.issueBody) {
    fs.mkdirSync(path.dirname(args.issueBody), { recursive: true })
    fs.writeFileSync(args.issueBody, buildIssueBody(report) + '\n')
    console.log(`staleness-scan: wrote work-queue issue body to ${args.issueBody}`)
  }

  // Human-readable summary table, worst first.
  console.log('\nWorst-stale products:')
  console.log('  score  product                              arena                     signals')
  for (const p of products.slice(0, 15)) {
    const s = p.signals
    const tags = [
      s.medianAgeDays !== null ? `age ${s.medianAgeDays}d` : 'no evidence',
      ...(s.deadCitedUrls.length > 0 ? [`${s.deadCitedUrls.length} dead`] : []),
      ...(s.apiQualityGap ? ['api-gap'] : []),
      ...(s.agentDocsContradiction ? ['docs-contradiction'] : []),
      ...(s.llmsTxtFlip ? ['llms-flip'] : []),
      ...(s.mcpFlip ? ['mcp-flip'] : []),
    ]
    console.log(`  ${String(p.staleness).padStart(5)}  ${p.productId.padEnd(35)}  ${p.arena.padEnd(24)}  ${tags.join(' · ')}`)
  }
  console.log(`\nWorst-stale arenas: ${report.arenasRanked.slice(0, 10).join(', ')}`)
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
