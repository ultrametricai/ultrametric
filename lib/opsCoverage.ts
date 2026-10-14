import fs from 'node:fs'
import path from 'node:path'
import { loadProcesses, vendorLabel, VENDOR_ARENA, type DagNode } from './processes'

// Aggregations for the UNLINKED /ops coverage dashboard (founder ask 2026-09-23: "a private
// dashboard for coverage: how deep we have tested all the vendors, arena coverage, missing
// vendors, cron job frequency, and monitoring product launches from these vendors").
//
// Everything here reads committed repo state at BUILD time — open-rankings/*/ evidence + verdicts,
// open-rankings/spike-queue.json, open-rankings/arena-roadmap.json, open-rankings/vendor-news.json, .github/workflows —
// and returns plain serializable rows for components/OpsDashboard.tsx. None of it is secret
// (copy-data.mjs already mirrors all of open-rankings/ world-readable); the /ops admin gate is about
// FOCUS, not secrecy. Reads are deliberately TOLERANT (the /queue page's
// convention): a missing optional file degrades to an honest empty section, never a build
// failure. All functions take a data-dir override so tests run on small fixture dirs.

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

function readJsonTolerant<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

// Lean local row shapes — this module reads raw JSON directly instead of lib/data.ts's
// loadCategory so it can stay tolerant (and so test fixtures don't need a full valid arena
// with every battle pair). Only the fields the dashboard aggregates are typed.
interface RawCategory { id: string; name: string }
interface RawProduct { id: string; name: string }
interface RawEvidence { id: string; tier: string }
interface RawVerdict { productId: string; verdict: string; evidenceIds: string[] }
interface RawSpikeEntry { arena: string; productId: string; name?: string; status: string; lastSpiked: string | null }
interface RawSpikeQueue { generatedAt: string; queue: RawSpikeEntry[] }

// ---------------------------------------------------------------------------
// 1. Depth coverage — how deeply each arena's vendors are tested
// ---------------------------------------------------------------------------

export interface ThinProduct {
  productId: string
  name: string
  evidence: number
}

export interface ArenaDepthRow {
  arenaId: string
  arenaName: string
  products: number
  medianEvidence: number
  minEvidence: number
  minEvidenceProductId: string
  /** % of non-na verdicts citing at least one probe- or github-tier evidence item. */
  probeBackedPct: number
  /** Products at or below the FLEET-WIDE bottom-decile evidence count — the thin tail. */
  bottomDecile: ThinProduct[]
  neverSpiked: number
  /** Age in days of the arena's stalest lastSpiked product (spiked ones only); null if none spiked. */
  oldestSpikeDays: number | null
  stalestProductId: string | null
}

export interface DepthCoverage {
  fleet: {
    arenas: number
    products: number
    verdicts: number
    evidenceItems: number
    medianEvidencePerProduct: number
    probeBackedPct: number
    bottomDecileThreshold: number
    neverSpiked: number
    oldestSpikeDays: number | null
  }
  arenas: ArenaDepthRow[]
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

const DAY_MS = 24 * 3600 * 1000

export function buildDepthCoverage(dir: string = DEFAULT_DIR(), now: number = Date.now()): DepthCoverage {
  const categories = readJsonTolerant<RawCategory[]>(path.join(dir, 'categories.json')) ?? []
  const spike = readJsonTolerant<RawSpikeQueue>(path.join(dir, 'spike-queue.json'))
  const lastSpikedOf = new Map<string, string | null>()
  for (const e of spike?.queue ?? []) lastSpikedOf.set(`${e.arena}/${e.productId}`, e.lastSpiked)

  interface ArenaScan {
    cat: RawCategory
    products: RawProduct[]
    evidenceCounts: Map<string, number>
    probeBacked: number
    judged: number // non-na verdicts
    verdicts: number
  }
  const scans: ArenaScan[] = []
  const fleetEvidenceCounts: number[] = []

  for (const cat of categories) {
    const base = path.join(dir, cat.id)
    const products = readJsonTolerant<RawProduct[]>(path.join(base, 'products.json'))
    const verdicts = readJsonTolerant<RawVerdict[]>(path.join(base, 'verdicts.json'))
    if (!products || !verdicts) continue // unpopulated arena — arena-coverage section's business

    const evidenceCounts = new Map<string, number>()
    const strongIds = new Map<string, Set<string>>() // productId -> probe/github evidence ids
    for (const p of products) {
      const evidence = readJsonTolerant<RawEvidence[]>(path.join(base, 'evidence', `${p.id}.json`)) ?? []
      evidenceCounts.set(p.id, evidence.length)
      fleetEvidenceCounts.push(evidence.length)
      strongIds.set(p.id, new Set(evidence.filter((e) => e.tier === 'probe' || e.tier === 'github').map((e) => e.id)))
    }

    let probeBacked = 0
    let judged = 0
    for (const v of verdicts) {
      if (v.verdict === 'na') continue // wrong-axis cells are excluded from the denominator
      judged += 1
      const strong = strongIds.get(v.productId)
      if (strong && v.evidenceIds.some((id) => strong.has(id))) probeBacked += 1
    }
    scans.push({ cat, products, evidenceCounts, probeBacked, judged, verdicts: verdicts.length })
  }

  fleetEvidenceCounts.sort((a, b) => a - b)
  const bottomDecileThreshold = percentile(fleetEvidenceCounts, 0.1)

  const arenas: ArenaDepthRow[] = scans.map((s) => {
    const counts = [...s.evidenceCounts.values()].sort((a, b) => a - b)
    let minProduct: RawProduct | null = null
    for (const p of s.products) {
      if (!minProduct || (s.evidenceCounts.get(p.id) ?? 0) < (s.evidenceCounts.get(minProduct.id) ?? 0)) minProduct = p
    }
    let neverSpiked = 0
    let oldest: { days: number; productId: string } | null = null
    for (const p of s.products) {
      const last = lastSpikedOf.get(`${s.cat.id}/${p.id}`)
      if (last === undefined) continue // product not in the queue yet — the queue re-rank will pick it up
      if (last === null) {
        neverSpiked += 1
        continue
      }
      const days = Math.floor((now - Date.parse(last)) / DAY_MS)
      if (!oldest || days > oldest.days) oldest = { days, productId: p.id }
    }
    return {
      arenaId: s.cat.id,
      arenaName: s.cat.name,
      products: s.products.length,
      medianEvidence: median(counts),
      minEvidence: counts[0] ?? 0,
      minEvidenceProductId: minProduct?.id ?? '',
      probeBackedPct: s.judged === 0 ? 0 : Math.round((100 * s.probeBacked) / s.judged),
      bottomDecile: s.products
        .filter((p) => (s.evidenceCounts.get(p.id) ?? 0) <= bottomDecileThreshold)
        .map((p) => ({ productId: p.id, name: p.name, evidence: s.evidenceCounts.get(p.id) ?? 0 }))
        .sort((a, b) => a.evidence - b.evidence),
      neverSpiked,
      oldestSpikeDays: oldest?.days ?? null,
      stalestProductId: oldest?.productId ?? null,
    }
  })

  const fleetJudged = scans.reduce((n, s) => n + s.judged, 0)
  const fleetProbeBacked = scans.reduce((n, s) => n + s.probeBacked, 0)
  const spikedDates = [...lastSpikedOf.values()].filter((d): d is string => d !== null)
  const oldestSpike = spikedDates.length
    ? Math.floor((now - Math.min(...spikedDates.map((d) => Date.parse(d)))) / DAY_MS)
    : null

  return {
    fleet: {
      arenas: scans.length,
      products: fleetEvidenceCounts.length,
      verdicts: scans.reduce((n, s) => n + s.verdicts, 0),
      evidenceItems: fleetEvidenceCounts.reduce((a, b) => a + b, 0),
      medianEvidencePerProduct: median(fleetEvidenceCounts),
      probeBackedPct: fleetJudged === 0 ? 0 : Math.round((100 * fleetProbeBacked) / fleetJudged),
      bottomDecileThreshold,
      neverSpiked: [...lastSpikedOf.values()].filter((d) => d === null).length,
      oldestSpikeDays: oldestSpike,
    },
    arenas: arenas.sort((a, b) => a.medianEvidence - b.medianEvidence || a.arenaId.localeCompare(b.arenaId)),
  }
}

// ---------------------------------------------------------------------------
// 2. Arena coverage — live vs roadmap, plus the missing-vendor census
// ---------------------------------------------------------------------------

export interface RoadmapRow {
  id: string
  name: string
  tier: number | null
  status: string
}

export interface UntrackedVendor {
  vendor: string
  label: string
  steps: number
  /** Most common optionsArenaId among the steps this vendor appears on — the implied category
   *  when the corpus declares one; null = no arena covers those steps yet. */
  impliedArena: string | null
}

export interface ArenaCoverage {
  liveArenas: number
  plannedArenas: RoadmapRow[]
  /** Roadmap says live but the data dir isn't populated — a promise the repo isn't keeping. */
  liveNotPopulated: string[]
  /** Populated arenas absent from the roadmap file — coverage the roadmap undersells. */
  populatedNotInRoadmap: string[]
  untrackedVendors: UntrackedVendor[]
}

type CensusNode = Pick<DagNode, 'vendor' | 'vendorOptions' | 'optionsArenaId'>

// The missing-vendor list: every process-corpus vendor chip with no VENDOR_ARENA mapping (the
// "honest unlinked chips" of lib/processes.ts), with how many steps name it and the arena the
// corpus implies for it. Pure over nodes so tests can feed a synthetic corpus.
export function untrackedVendorCensus(nodes: CensusNode[]): UntrackedVendor[] {
  const acc = new Map<string, { steps: number; arenas: Map<string, number> }>()
  for (const n of nodes) {
    const vendors = [...(n.vendor ? [n.vendor] : []), ...(n.vendorOptions ?? [])]
    for (const v of vendors) {
      if (VENDOR_ARENA[v]) continue
      const e = acc.get(v) ?? { steps: 0, arenas: new Map() }
      e.steps += 1
      if (n.optionsArenaId) e.arenas.set(n.optionsArenaId, (e.arenas.get(n.optionsArenaId) ?? 0) + 1)
      acc.set(v, e)
    }
  }
  return [...acc.entries()]
    .map(([vendor, e]) => ({
      vendor,
      label: vendorLabel(vendor),
      steps: e.steps,
      impliedArena: [...e.arenas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.steps - a.steps || a.vendor.localeCompare(b.vendor))
}

export function buildArenaCoverage(dir: string = DEFAULT_DIR()): ArenaCoverage {
  const categories = readJsonTolerant<RawCategory[]>(path.join(dir, 'categories.json')) ?? []
  const populated = new Set(
    categories.filter((c) => fs.existsSync(path.join(dir, c.id, 'verdicts.json'))).map((c) => c.id),
  )
  const roadmap =
    readJsonTolerant<Array<{ id: string; name: string; tier?: number; status: string }>>(
      path.join(dir, 'arena-roadmap.json'),
    ) ?? []

  let tasks: ReturnType<typeof loadProcesses> = []
  try {
    tasks = loadProcesses(dir)
  } catch {
    // No/invalid corpus (open-processes/corpus.json) resolved from this dir (fixtures) — census
    // degrades to empty.
  }

  return {
    liveArenas: populated.size,
    plannedArenas: roadmap
      .filter((r) => r.status !== 'live' && !populated.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, tier: r.tier ?? null, status: r.status })),
    liveNotPopulated: roadmap.filter((r) => r.status === 'live' && !populated.has(r.id)).map((r) => r.id),
    populatedNotInRoadmap: [...populated].filter((id) => !roadmap.some((r) => r.id === id)).sort(),
    untrackedVendors: untrackedVendorCensus(tasks.flatMap((t) => t.dag.nodes)),
  }
}

// ---------------------------------------------------------------------------
// 3. Cron / engine health — schedules as configured + last-run evidence from data
// ---------------------------------------------------------------------------

export interface WorkflowSchedule {
  file: string
  name: string
  crons: string[]
  /** Non-schedule triggers (push, pull_request, workflow_dispatch, issues…) for cron-less workflows. */
  triggers: string[]
}

export interface LastRunSignal {
  label: string
  /** ISO date of the newest committed artifact, or null when the file doesn't exist yet. */
  date: string | null
  source: string
}

export interface CronHealth {
  workflows: WorkflowSchedule[]
  /** The convention the workflow files can't show: which engine runs in the founder's session. */
  sessionCronNote: string
  lastRuns: LastRunSignal[]
}

// Parse just what the dashboard needs from a workflow file: its name and its cron lines. Line
// regexes, not a YAML parser — schedules in this repo are all literal `- cron: '…'` lines.
const TRIGGER_KEYS = ['push', 'pull_request', 'workflow_dispatch', 'issues', 'issue_comment'] as const

export function parseWorkflowSchedule(file: string, text: string): WorkflowSchedule {
  const name = text.match(/^name:\s*(.+?)\s*$/m)?.[1] ?? path.basename(file, '.yml')
  const crons = [...text.matchAll(/-\s*cron:\s*'([^']+)'/g)].map((m) => m[1])
  // Trigger keys appear as two-space-indented `on:` children in every workflow this repo has.
  const triggers = TRIGGER_KEYS.filter((k) => new RegExp(`^  ${k}:`, 'm').test(text))
  return { file: path.basename(file), name, crons, triggers }
}

function lastJsonlDate(file: string, field: string): string | null {
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8').trimEnd()
  } catch {
    return null
  }
  const lastLine = raw.slice(raw.lastIndexOf('\n') + 1)
  try {
    const v = (JSON.parse(lastLine) as Record<string, unknown>)[field]
    return typeof v === 'string' ? v : null
  } catch {
    return null
  }
}

export function buildCronHealth(repoRoot: string = process.cwd(), dir: string = DEFAULT_DIR()): CronHealth {
  const wfDir = path.join(repoRoot, '.github', 'workflows')
  let workflows: WorkflowSchedule[] = []
  try {
    workflows = fs
      .readdirSync(wfDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map((f) => parseWorkflowSchedule(f, fs.readFileSync(path.join(wfDir, f), 'utf8')))
      .sort((a, b) => a.file.localeCompare(b.file))
  } catch {
    // No workflows dir (fixtures) — an empty schedule table, honestly.
  }

  // Last-run evidence comes from COMMITTED artifacts, not the GitHub API (this site is a static
  // export — it can't ask Actions anything at runtime). Each signal names the artifact so the
  // founder can verify; the page labels the whole section "as of last build".
  const categories = readJsonTolerant<RawCategory[]>(path.join(dir, 'categories.json')) ?? []
  let newestScore: string | null = null
  let newestPopularity: string | null = null
  for (const c of categories) {
    const s = lastJsonlDate(path.join(dir, c.id, 'score-history.jsonl'), 'date')
    if (s && (!newestScore || s > newestScore)) newestScore = s
    const p =
      lastJsonlDate(path.join(dir, c.id, 'popularity-history.jsonl'), 'runAt') ??
      lastJsonlDate(path.join(dir, c.id, 'popularity-history.jsonl'), 'date')
    if (p && (!newestPopularity || p > newestPopularity)) newestPopularity = p
  }
  const spike = readJsonTolerant<RawSpikeQueue>(path.join(dir, 'spike-queue.json'))
  const staleness = readJsonTolerant<{ generatedAt?: string }>(path.join(dir, 'staleness-report.json'))
  const news = readJsonTolerant<{ generatedAt?: string }>(path.join(dir, 'vendor-news.json'))
  const slo =
    lastJsonlDate(path.join(dir, 'slo-history.jsonl'), 'checkedAt') ??
    lastJsonlDate(path.join(dir, 'slo-history.jsonl'), 'date') ??
    lastJsonlDate(path.join(dir, 'slo-history.jsonl'), 'at')

  return {
    workflows,
    sessionCronNote:
      'spike-engine.yml keeps no schedule by design: since 2026-09-21 the daily 04:23 UTC spike ' +
      'runs as a session cron — in the founder’s Claude session, gates + commit + deploy in one ' +
      'pass — and the workflow stays dispatch-only as the manual/backup path. The vendor-news ' +
      'watcher (pipeline/scripts/watch-vendor-news.ts) follows the same convention: session-run, ' +
      'budgeted, resumable.',
    lastRuns: [
      { label: 'Score history (story-runner / engines)', date: newestScore, source: 'open-rankings/*/score-history.jsonl' },
      { label: 'Popularity history (daily-snapshot)', date: newestPopularity, source: 'open-rankings/*/popularity-history.jsonl' },
      { label: 'Agent-surface SLO check (daily-snapshot / story-runner)', date: slo, source: 'open-rankings/slo-history.jsonl' },
      { label: 'Spike queue re-rank (session cron)', date: spike?.generatedAt ?? null, source: 'open-rankings/spike-queue.json' },
      { label: 'Staleness scan (accuracy-engine, Wednesdays)', date: staleness?.generatedAt ?? null, source: 'open-rankings/staleness-report.json' },
      { label: 'Vendor news watcher (session cron)', date: news?.generatedAt ?? null, source: 'open-rankings/vendor-news.json' },
    ],
  }
}

// ---------------------------------------------------------------------------
// 4. Vendor news + the re-spike cross-signal
// ---------------------------------------------------------------------------

export interface OpsNewsItem {
  productId: string
  productName: string
  arenaId: string
  title: string
  url: string
  date: string | null
  agentic: boolean
}

export interface RespikeCandidate {
  productId: string
  productName: string
  arenaId: string
  lastSpiked: string | null
  newestAgenticDate: string | null
  title: string
  url: string
}

export interface NewsCoverage {
  generatedAt: string | null
  budget: { cap: number; used: number; exhausted: boolean } | null
  sourcesChecked: number
  productsWithSource: number
  feedSources: number
  items: OpsNewsItem[]
  agenticCount: number
  /** Vendors whose newest agentic-flagged post is NEWER than their lastSpiked (or never spiked
   *  at all) — the "we should re-spike these" list. Dateless items can't prove recency and only
   *  count for never-spiked vendors. */
  respike: RespikeCandidate[]
}

interface RawNewsState {
  generatedAt?: string
  budget?: { cap: number; used: number; exhausted: boolean }
  sources?: Array<{ productId: string; method: string }>
  items?: Array<{ productId: string; arenaId: string; title: string; url: string; date: string | null; agentic: boolean }>
}

export function buildNewsCoverage(dir: string = DEFAULT_DIR()): NewsCoverage {
  const state = readJsonTolerant<RawNewsState>(path.join(dir, 'vendor-news.json'))
  const spike = readJsonTolerant<RawSpikeQueue>(path.join(dir, 'spike-queue.json'))
  const nameOf = new Map<string, string>()
  const lastSpikedOf = new Map<string, string | null>()
  for (const e of spike?.queue ?? []) {
    const key = `${e.arena}/${e.productId}`
    lastSpikedOf.set(key, e.lastSpiked)
    nameOf.set(key, e.name ?? e.productId)
  }

  const items: OpsNewsItem[] = (state?.items ?? []).map((i) => ({
    productId: i.productId,
    productName: nameOf.get(`${i.arenaId}/${i.productId}`) ?? i.productId,
    arenaId: i.arenaId,
    title: i.title,
    url: i.url,
    date: i.date,
    agentic: i.agentic,
  }))

  const respikeByProduct = new Map<string, RespikeCandidate>()
  for (const i of items) {
    if (!i.agentic) continue
    const key = `${i.arenaId}/${i.productId}`
    if (!lastSpikedOf.has(key)) continue // not a judged queue product — nothing to re-spike
    const lastSpiked = lastSpikedOf.get(key) ?? null
    const newer =
      lastSpiked === null
        ? true // never spiked: any agentic post is a reason
        : i.date !== null && i.date > lastSpiked.slice(0, 10)
    if (!newer) continue
    const existing = respikeByProduct.get(key)
    if (!existing || (i.date ?? '') > (existing.newestAgenticDate ?? '')) {
      respikeByProduct.set(key, {
        productId: i.productId,
        productName: i.productName,
        arenaId: i.arenaId,
        lastSpiked,
        newestAgenticDate: i.date,
        title: i.title,
        url: i.url,
      })
    }
  }

  const sources = state?.sources ?? []
  return {
    generatedAt: state?.generatedAt ?? null,
    budget: state?.budget ?? null,
    sourcesChecked: sources.length,
    productsWithSource: new Set(sources.filter((s) => s.method !== 'none').map((s) => s.productId)).size,
    feedSources: sources.filter((s) => s.method === 'rss' || s.method === 'atom').length,
    items,
    agenticCount: items.filter((i) => i.agentic).length,
    respike: [...respikeByProduct.values()].sort(
      (a, b) => (b.newestAgenticDate ?? '').localeCompare(a.newestAgenticDate ?? '') || a.productId.localeCompare(b.productId),
    ),
  }
}
