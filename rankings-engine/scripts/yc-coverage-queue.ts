// The YC coverage-queue engine: crawls YC's public company directory (keyless yc-oss/api mirror,
// same source as yc-fetch.ts) batch by batch — most recent first, F26 back toward W16 — and emits
// open-rankings/yc-queue.json: a ranked queue of ACTIVE YC companies that (a) are not already tracked in
// any arena (matched by normalized website domain, never by name), (b) plausibly fit an EXISTING
// arena, and (c) show a real docs/API surface an agent could be pointed at (quick keyless HTTP
// checks). The queue is the "always-gaining" loop's input: the weekly yc-coverage.yml workflow
// refreshes it and opens a work-queue issue with the next candidates; bring-ups then run the full
// evidence pipeline per product.
//
// Ranking = batch recency x arena fit x docs surface:
//   - recency: newest batch in the window = 1.0, decaying linearly to the oldest batch,
//   - fit: 1.0 when rankings-engine/scripts/yc-classify.ts already mapped the company to an existing
//     arena (open-rankings/yc-map.json), else a DOMAIN_VOCAB keyword match against the one-liner + tags
//     (>= MIN_VOCAB_HITS distinct arena keywords required; scaled by hit count),
//   - docs surface: fraction of DOCS_PROBE_PATHS that answer < 400 (0 hits still keeps a small
//     floor — a missing docs subdomain is weak evidence of a missing API).
//
// Deliberately keyless and bounded (<= HTTP_CONCURRENCY parallel checks, HTTP_TIMEOUT_MS
// timeouts) so it can run unattended in CI. Companies yc-classify marked as proposedArena
// (software, but no existing arena) or null/null (not rankable software) are excluded and
// counted in the per-batch stats instead — honest exclusions, not silent drops.
//
// Run with:
//   tsx rankings-engine/scripts/yc-coverage-queue.ts --years 2024-2026            # first wave
//   tsx rankings-engine/scripts/yc-coverage-queue.ts --years 2016-2026 --no-http  # full sweep, fit only
//   tsx rankings-engine/scripts/yc-coverage-queue.ts --issue-body /tmp/yc-queue-issue.md
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ProductSchema, YcMapSchema } from '../../lib/schemas'
import { readJson, resolveCategories, writeJson, ROOT } from '../paths'
import { batchCode, normalizeDomain, YC_ALL_COMPANIES_URL, type YcRawCompany } from '../yc-shared'
import { DOMAIN_VOCAB } from './tag-story-scopes'
import { RadarReportSchema, type RadarReport } from './vendor-radar'

const CACHE_DIR = path.join(ROOT, 'rankings-engine', 'cache', 'yc')
const FEED_CACHE = path.join(CACHE_DIR, 'companies-all.json')
const YC_MAP_PATH = path.join(ROOT, 'open-rankings', 'yc-map.json')
const QUEUE_PATH = path.join(ROOT, 'open-rankings', 'yc-queue.json')
// Human bring-up verdicts the crawler must remember: candidates that were verified and REJECTED
// (dead brand, no agent surface, no honest arena fit) stay out of every future queue instead of
// resurfacing weekly. Slug -> { date, reason }. Append here when a bring-up excludes a nominee.
const REJECTIONS_PATH = path.join(ROOT, 'open-rankings', 'yc-rejections.json')

// Oldest batch year the founder asked for: "the last 10 years", i.e. Winter 2016 onward.
const DEFAULT_FROM_YEAR = 2016
const MIN_VOCAB_HITS = 2
const HTTP_CONCURRENCY = 12
const HTTP_TIMEOUT_MS = 6000

// Keyless probes for a real docs/API surface. Subdomain probes are resolved against the apex
// domain; path probes against the company's own site host.
const DOCS_PROBE_PATHS = ['docs-subdomain', '/docs', '/developers', '/llms.txt'] as const

export const YcQueueCandidateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  batch: z.string().min(1),
  code: z.string().regex(/^[WXSF]\d{2}$/),
  website: z.string().min(1),
  domain: z.string().min(1),
  oneLiner: z.string(),
  arena: z.string().min(1),
  // 'classified' = yc-classify's LLM mapping in open-rankings/yc-map.json; 'vocab' = keyless
  // DOMAIN_VOCAB keyword match (weaker — verify before bring-up).
  fitSource: z.enum(['classified', 'vocab']),
  fitScore: z.number(),
  vocabHits: z.number(),
  docsChecked: z.array(z.string()),
  docsHits: z.array(z.string()),
  docsScore: z.number(),
  recency: z.number(),
  score: z.number(),
})

export const YcQueueSchema = z.object({
  generatedAt: z.string(),
  source: z.string(),
  batchWindow: z.object({ from: z.string(), to: z.string() }),
  httpChecked: z.boolean(),
  batches: z.array(
    z.object({
      code: z.string(),
      batch: z.string(),
      total: z.number(),
      active: z.number(),
      alreadyTracked: z.number(),
      noExistingArenaFit: z.number(),
      rejected: z.number(),
      candidates: z.number(),
    }),
  ),
  candidates: z.array(YcQueueCandidateSchema),
})

export type YcQueue = z.infer<typeof YcQueueSchema>
export type YcQueueCandidate = z.infer<typeof YcQueueCandidateSchema>

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 }

// Sortable ordinal for a "<Season> <Year>" batch name; null for anything else ("Unspecified").
function batchOrdinal(batch: string): number | null {
  const m = /^(Winter|Spring|Summer|Fall) (\d{4})$/.exec(batch)
  if (!m) return null
  return Number(m[2]) * 4 + SEASON_ORDER[m[1]]
}

async function ensureFeed(refetch: boolean): Promise<YcRawCompany[]> {
  if (!refetch && fs.existsSync(FEED_CACHE)) {
    return JSON.parse(fs.readFileSync(FEED_CACHE, 'utf8')) as YcRawCompany[]
  }
  console.log(`Fetching ${YC_ALL_COMPANIES_URL} ...`)
  const res = await fetch(YC_ALL_COMPANIES_URL)
  if (!res.ok) throw new Error(`yc-oss/api fetch failed: ${res.status} ${res.statusText}`)
  const all = (await res.json()) as YcRawCompany[]
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  writeJson(FEED_CACHE, all)
  return all
}

// Compiled per-arena vocab: for each arena, one regex per keyword so we can count DISTINCT
// keyword hits (a single regex with alternation only says "matched", not how many concepts).
function compileVocab(arenaIds: Set<string>): Map<string, { word: string; re: RegExp }[]> {
  const compiled = new Map<string, { word: string; re: RegExp }[]>()
  for (const [arena, words] of Object.entries(DOMAIN_VOCAB)) {
    if (!arenaIds.has(arena)) continue
    compiled.set(
      arena,
      words.map((w) => ({ word: w, re: new RegExp(`\\b(${w})`, 'i') })),
    )
  }
  return compiled
}

function bestVocabArena(
  text: string,
  vocab: Map<string, { word: string; re: RegExp }[]>,
): { arena: string; hits: number } | null {
  let best: { arena: string; hits: number } | null = null
  for (const [arena, words] of vocab) {
    let hits = 0
    for (const { re } of words) if (re.test(text)) hits++
    if (hits < MIN_VOCAB_HITS) continue
    // Deterministic tiebreak: more hits wins, then alphabetical arena id.
    if (!best || hits > best.hits || (hits === best.hits && arena < best.arena)) {
      best = { arena, hits }
    }
  }
  return best
}

function probeUrl(domain: string, probe: (typeof DOCS_PROBE_PATHS)[number]): string {
  if (probe === 'docs-subdomain') {
    // docs.<apex>: strip one subdomain level if the site itself lives on one (app.foo.com -> docs.foo.com).
    const parts = domain.split('.')
    const apex = parts.length > 2 ? parts.slice(-2).join('.') : domain
    return `https://docs.${apex}/`
  }
  return `https://${domain}${probe}`
}

async function fetchStatus(url: string): Promise<{ ok: boolean; finalUrl: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    void res.body?.cancel().catch(() => {})
    return { ok: res.status < 400, finalUrl: res.url || url }
  } catch {
    return { ok: false, finalUrl: url }
  } finally {
    clearTimeout(timer)
  }
}

// Soft-404 control: SPA/auth catch-alls answer 200 for EVERY path (wave-1 verification found
// exactly this on two nominees — /docs redirecting to /signin counted as a "docs surface").
// If a domain 200s this deliberately-nonexistent path, its path probes (/docs, /developers,
// /llms.txt) earn no credit, and the docs-subdomain probe only counts when it actually lands
// on a docs.* host instead of bouncing back to the marketing root.
const SOFT_404_CONTROL_PATH = '/__pa-yc-queue-404-control__'

async function checkDocsSurface(domain: string): Promise<{ checked: string[]; hits: string[] }> {
  const checked = DOCS_PROBE_PATHS.map((p) => probeUrl(domain, p))
  const control = await fetchStatus(`https://${domain}${SOFT_404_CONTROL_PATH}`)
  const results = await Promise.all(checked.map(fetchStatus))
  const hits = checked.filter((url, i) => {
    const r = results[i]
    if (!r.ok) return false
    if (url.startsWith('https://docs.')) {
      // Subdomain probe: must actually land on a docs.* host (redirects back to the apex/root
      // are marketing bounces, not a docs surface).
      try {
        return new URL(r.finalUrl).hostname.startsWith('docs.')
      } catch {
        return false
      }
    }
    return !control.ok
  })
  return { checked, hits }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function parseArgs(argv: string[]) {
  const args = { fromYear: DEFAULT_FROM_YEAR, toYear: 9999, http: true, refetch: false, issueBody: '', radarReport: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--years') {
      const m = /^(\d{4})-(\d{4})$/.exec(argv[++i] ?? '')
      if (!m) throw new Error('--years expects e.g. 2024-2026')
      args.fromYear = Number(m[1])
      args.toYear = Number(m[2])
    } else if (argv[i] === '--no-http') args.http = false
    else if (argv[i] === '--refetch') args.refetch = true
    else if (argv[i] === '--issue-body') args.issueBody = argv[++i] ?? ''
    else if (argv[i] === '--radar-report') args.radarReport = argv[++i] ?? ''
    else throw new Error(`unknown arg: ${argv[i]}`)
  }
  return args
}

// How many top queue candidates the weekly lane hands to radar-triage per run.
export const RADAR_TOP = 10

// The queue's top candidates in the vendor-radar report shape, so the weekly YC lane runs the
// same radar-triage.ts over them: same criteria (policies/AGENT_POLICY.md "Vendor-radar
// candidate approval"), same reports/vendor-radar/ triage files, same issue flow. Everything is
// verbatim-derived from the queue entry: `hits` is the real lexical hit count, so the triage's
// ranking-fit floor binds these candidates exactly as it does radar candidates (a yc-classify
// 'classified' fit rides in the source evidence line and earns no extra lexical hits), and the
// keyless docs-probe results ride along as evidence.
export function radarReportFromQueue(queue: YcQueue, date: string, top = RADAR_TOP): RadarReport {
  const picked = queue.candidates.slice(0, top)
  return RadarReportSchema.parse({
    _comment:
      'Generated by rankings-engine/scripts/yc-coverage-queue.ts --radar-report — the top YC coverage-queue candidates in the vendor-radar report shape, the input radar-triage.ts applies the auto-approval criteria to. Nomination only: nothing here changes a score or verdict.',
    generatedAt: new Date().toISOString(),
    date,
    thresholds: { MIN_VOCAB_HITS, RADAR_TOP: top },
    sources: [
      {
        kind: 'yc-directory',
        queried: `open-rankings/yc-queue.json top ${top} (directory source: ${queue.source})`,
        items: picked.length,
        error: null,
      },
    ],
    skipped: { tracked: 0, alreadySeen: 0, overflow: Math.max(0, queue.candidates.length - picked.length) },
    candidates: picked.map((c) => ({
      key: `domain:${c.domain}`,
      name: c.name,
      url: c.website,
      sources: [
        {
          kind: 'yc-directory',
          url: `https://www.ycombinator.com/companies/${c.slug}`,
          title: `${c.name} (YC ${c.code})`,
          evidence: `YC directory (${queue.source}), batch ${c.batch}, status Active; fit: ${c.fitSource}${c.vocabHits > 0 ? ` (${c.vocabHits} vocab hits)` : ''}; docs probes answering: ${c.docsHits.length ? c.docsHits.join(', ') : 'none'}`,
        },
      ],
      matchedArenas: [{ arena: c.arena, hits: c.vocabHits, keywords: [] }],
      firstSeen: date,
    })),
  })
}

export function issueBodyFor(queue: YcQueue, top = 10): string {
  const lines: string[] = []
  lines.push(
    `Ranked YC coverage queue (window ${queue.batchWindow.from}-${queue.batchWindow.to}, generated ${queue.generatedAt}). ` +
      `Full queue: \`open-rankings/yc-queue.json\` (${queue.candidates.length} candidates). ` +
      `Each bring-up runs the full evidence pipeline for its arena — this queue only nominates; it never scores.`,
  )
  lines.push('')
  lines.push('| # | Company | Batch | Arena (fit) | Docs surface | Score |')
  lines.push('|---|---------|-------|-------------|--------------|-------|')
  queue.candidates.slice(0, top).forEach((c, i) => {
    lines.push(
      `| ${i + 1} | [${c.name}](https://${c.domain}) | ${c.code} | ${c.arena} (${c.fitSource}) | ${
        c.docsHits.length ? c.docsHits.join(', ') : 'none found'
      } | ${c.score.toFixed(3)} |`,
    )
  })
  lines.push('')
  lines.push('Per-batch: ' + queue.batches.map((b) => `${b.code} ${b.candidates}`).join(', '))
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const all = await ensureFeed(args.refetch)

  const categories = resolveCategories()
  const arenaIds = new Set(categories.map((c) => c.id))
  const vocab = compileVocab(arenaIds)

  // Already-tracked products, by normalized site domain (never by name).
  const trackedDomains = new Set<string>()
  for (const category of categories) {
    const products = readJson(ProductSchema.array(), path.join(ROOT, 'open-rankings', category.id, 'products.json'))
    for (const p of products) {
      const d = normalizeDomain(p.urls.site)
      if (d) trackedDomains.add(d)
    }
  }

  // yc-classify's LLM verdicts (modern batches only; older batches fall back to vocab).
  const ycMap = fs.existsSync(YC_MAP_PATH)
    ? YcMapSchema.parse(JSON.parse(fs.readFileSync(YC_MAP_PATH, 'utf8')))
    : []
  const classified = new Map(ycMap.map((c) => [c.slug, c]))

  // Bring-up rejections (open-rankings/yc-rejections.json): human-verified "never nominate again" verdicts.
  const rejections: Record<string, { date: string; reason: string }> = fs.existsSync(REJECTIONS_PATH)
    ? JSON.parse(fs.readFileSync(REJECTIONS_PATH, 'utf8'))
    : {}

  // Window: every real "<Season> <Year>" batch within [fromYear, toYear], newest first.
  const inWindow = all.filter((c) => {
    const m = /^(?:Winter|Spring|Summer|Fall) (\d{4})$/.exec(c.batch)
    if (!m) return false
    const y = Number(m[1])
    return y >= args.fromYear && y <= args.toYear
  })
  const batchNames = Array.from(new Set(inWindow.map((c) => c.batch))).sort(
    (a, b) => batchOrdinal(b)! - batchOrdinal(a)!,
  )
  if (batchNames.length === 0) throw new Error('no batches in window')

  const batchStats: YcQueue['batches'] = []
  const candidates: Omit<YcQueueCandidate, 'docsChecked' | 'docsHits' | 'docsScore' | 'score'>[] = []

  for (let bi = 0; bi < batchNames.length; bi++) {
    const batch = batchNames[bi]
    const code = batchCode(batch)!
    const members = inWindow.filter((c) => c.batch === batch)
    const active = members.filter((c) => c.status === 'Active')
    // Newest batch = 1.0, oldest in window > 0 — linear so a W16 hit can still surface when its
    // fit + docs surface are strong.
    const recency = (batchNames.length - bi) / batchNames.length

    let alreadyTracked = 0
    let noFit = 0
    let rejectedCount = 0
    let count = 0
    for (const c of active) {
      if (rejections[c.slug]) {
        rejectedCount++
        continue
      }
      const domain = normalizeDomain(c.website)
      if (!domain) {
        noFit++
        continue
      }
      if (trackedDomains.has(domain)) {
        alreadyTracked++
        continue
      }

      const cls = classified.get(c.slug)
      let arena: string | null = null
      let fitSource: 'classified' | 'vocab' = 'vocab'
      let fitScore = 0
      let vocabHits = 0
      if (cls?.mappedArena && arenaIds.has(cls.mappedArena)) {
        arena = cls.mappedArena
        fitSource = 'classified'
        fitScore = 1
        // Lexical hits against the mapped arena still get counted (score unchanged): the
        // radar-triage hand-off (radarReportFromQueue) applies its lexical ranking-fit floor to
        // these candidates exactly as it does to radar candidates.
        const words = vocab.get(arena)
        if (words) {
          const text = `${c.one_liner ?? ''} ${(c.tags ?? []).join(' ')} ${(c.industries ?? []).join(' ')}`
          vocabHits = words.filter(({ re }) => re.test(text)).length
        }
      } else if (cls && (cls.proposedArena || (!cls.mappedArena && !cls.proposedArena))) {
        // yc-classify already judged this one: software-without-an-existing-arena, or not
        // rankable software at all. Honest exclusion — don't second-guess it with keywords.
        noFit++
        continue
      } else {
        const text = `${c.one_liner ?? ''} ${(c.tags ?? []).join(' ')} ${(c.industries ?? []).join(' ')}`
        const best = bestVocabArena(text, vocab)
        if (!best) {
          noFit++
          continue
        }
        arena = best.arena
        vocabHits = best.hits
        fitScore = Math.min(0.35 + 0.1 * best.hits, 0.85)
      }

      candidates.push({
        slug: c.slug,
        name: c.name,
        batch,
        code,
        website: c.website || c.url,
        domain,
        oneLiner: c.one_liner ?? '',
        arena: arena!,
        fitSource,
        fitScore,
        vocabHits,
        recency,
      })
      count++
    }
    batchStats.push({
      code,
      batch,
      total: members.length,
      active: active.length,
      alreadyTracked,
      noExistingArenaFit: noFit,
      rejected: rejectedCount,
      candidates: count,
    })
  }

  console.log(`Window ${batchNames[batchNames.length - 1]} -> ${batchNames[0]}: ${candidates.length} candidates before docs checks.`)

  // Docs-surface checks, bounded. --no-http keeps fit-only ranking (docsScore floor applies).
  const docsResults = args.http
    ? await mapLimit(candidates, HTTP_CONCURRENCY, (c) => checkDocsSurface(c.domain))
    : candidates.map(() => ({ checked: [] as string[], hits: [] as string[] }))

  const full: YcQueueCandidate[] = candidates.map((c, i) => {
    const docsScore = args.http ? docsResults[i].hits.length / DOCS_PROBE_PATHS.length : 0
    const score = Number((c.recency * c.fitScore * (0.25 + 0.75 * docsScore)).toFixed(4))
    return { ...c, docsChecked: docsResults[i].checked, docsHits: docsResults[i].hits, docsScore, score }
  })
  full.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))

  const queue: YcQueue = YcQueueSchema.parse({
    generatedAt: new Date().toISOString(),
    source: YC_ALL_COMPANIES_URL,
    batchWindow: { from: batchCode(batchNames[batchNames.length - 1])!, to: batchCode(batchNames[0])! },
    httpChecked: args.http,
    batches: batchStats,
    candidates: full,
  })
  writeJson(QUEUE_PATH, queue)

  console.log(`\nPer-batch (newest first):`)
  for (const b of batchStats) {
    console.log(
      `  ${b.code}  active ${String(b.active).padStart(3)}  tracked ${String(b.alreadyTracked).padStart(3)}  no-fit ${String(b.noExistingArenaFit).padStart(4)}  rejected ${b.rejected}  candidates ${b.candidates}`,
    )
  }
  console.log(`\nTop 15:`)
  for (const c of full.slice(0, 15)) {
    console.log(`  ${c.score.toFixed(3)}  ${c.code}  ${c.name} -> ${c.arena} (${c.fitSource}${c.docsHits.length ? `, docs: ${c.docsHits.length}/${DOCS_PROBE_PATHS.length}` : ''})`)
  }
  console.log(`\nWrote ${full.length} candidates to ${path.relative(ROOT, QUEUE_PATH)}`)

  if (args.issueBody) {
    fs.writeFileSync(args.issueBody, issueBodyFor(queue))
    console.log(`Wrote issue body to ${args.issueBody}`)
  }

  if (args.radarReport) {
    const report = radarReportFromQueue(queue, new Date().toISOString().slice(0, 10))
    fs.mkdirSync(path.dirname(args.radarReport), { recursive: true })
    fs.writeFileSync(args.radarReport, JSON.stringify(report, null, 2) + '\n')
    console.log(`Wrote radar-shaped top ${report.candidates.length} candidates to ${args.radarReport}`)
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
