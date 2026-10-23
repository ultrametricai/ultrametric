// Launch watch: ROSTERED vendors entering NEW arenas.
//
// The vendor radar (vendor-radar.ts) finds products we do not track; its dedupe deliberately
// skips every tracked vendor. This script covers the complementary blind spot the Gusto
// formation/banking launch exposed (2026-10-22): a vendor we already rank in one arena ships a
// product that belongs in another. It scans each rostered product's own launch-announcement
// surface — the committed, opt-in `urls.news` field (schema: lib/schemas.ts; seeded only where
// a keyless GET was verified) — for launch-shaped headlines, runs the radar's arena keyword-fit
// machinery over each headline, and nominates (product, arena) pairs for arenas the product is
// not yet rostered in.
//
// Fetching is keyless with the radar's conventions: dedicated UA, bounded timeout, one GET per
// news URL per run, POLITE_DELAY_MS between requests (the watch-vendor-news pacing precedent).
// Verified reachable at seeding time (2026-10-23, HTTP 200 to the pipeline UA): stripe
// newsroom, ramp blog, mercury blog, vercel/linear/github changelogs, cloudflare/plaid blogs,
// notion releases. gusto.com stays unseeded — it answers HTTP 403 Cloudflare challenges to the
// engine's fetch.
//
// Output rides the existing radar pipeline:
//   - candidates are keyed `launch:<productId>:<arena>` in the shared seen-ledger
//     (rankings-engine/radar-seen.json), so each launch is reported once;
//   - the dated report lands in reports/launch-watch/<date>.{json,md};
//   - dispositions are written as a radar-triage TriageReport
//     (reports/launch-watch/<date>-triage.json): needs-human rows flow through
//     needs-human-issue.ts --generator launch-watch; auto-approved rows (strong keyword fit,
//     never founder-affiliated) are applied by `--apply` and ride the scan PR, where the
//     scheduled workflow runs the scoped standard engine stages before committing.
//
// The scan itself changes nothing under open-rankings/; `--apply` only copies an existing
// product identity into the target arena's roster, and scores still come only from the scoped
// engine run (crawl → extract → probe → judge --product → derive). It never creates a new
// arena and never auto-approves a founder-affiliated product.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ProductSchema, type Category, type Product } from '../../lib/schemas'
import { DATA_DIR, ROOT, readCategories, writeJson } from '../paths'
import {
  SEEN_LEDGER_FILE,
  type SeenEntry,
  buildArenaVocab,
  loadSeenLedger,
  matchArenas,
  mergeSeenEntries,
  type ArenaMatch,
  type VocabWord,
} from './vendor-radar'
import { PLACEMENT_CAVEAT, TriageReportSchema, isFounderAffiliated, type Disposition, type TriageReport } from './radar-triage'
import { decodeEntities } from './watch-vendor-news'

export const LW_REPORTS_DIR = path.join(ROOT, 'reports', 'launch-watch')
export const LW_MAX_ITEMS_PER_SOURCE = 40 // newest links on a news page; beyond this is archive
export const LW_MIN_HEADLINE_CHARS = 18 // shorter anchor text is navigation, not a headline
export const LW_AUTO_APPROVE_HITS = 4 // distinct arena keywords in one headline: unambiguous fit
export const LW_MAX_REPORT_CANDIDATES = 20
export const LW_DEFAULT_APPLY_CAP = 2 // roster appends per run, bounding the judge spend
const FETCH_TIMEOUT_MS = 15_000
const POLITE_DELAY_MS = 150
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-launch-watch/1.0; +https://ultrametric.ai)'

export const LW_POLICY =
  `launch-watch v1: launch-shaped headline on the vendor's own urls.news surface, ` +
  `arena keyword fit via the radar vocabulary (nominate on matchArenas, auto-approve at ` +
  `${LW_AUTO_APPROVE_HITS}+ distinct hits, founder-affiliated products always needs-human), ` +
  `target arena must not already roster the product`

// ---------------------------------------------------------------------------------------------
// Watched products: every rostered product that opted in via urls.news, with the full set of
// arenas it is already rostered in (candidates must point somewhere it is NOT).

export interface WatchedProduct {
  id: string
  name: string
  vendor: string
  type: Product['type']
  site: string
  docs?: string
  news: string[]
  arenas: string[] // every arena that rosters this product id (news field or not)
}

export function collectWatchedProducts(rosters: Map<string, Product[]>): WatchedProduct[] {
  const byId = new Map<string, WatchedProduct>()
  for (const [arena, products] of rosters) {
    for (const p of products) {
      let w = byId.get(p.id)
      if (!w) {
        w = { id: p.id, name: p.name, vendor: p.vendor, type: p.type, site: p.urls.site, docs: p.urls.docs, news: [], arenas: [] }
        byId.set(p.id, w)
      }
      if (!w.arenas.includes(arena)) w.arenas.push(arena)
      if (p.urls.news && !w.news.includes(p.urls.news)) w.news.push(p.urls.news)
    }
  }
  return [...byId.values()]
    .filter((w) => w.news.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------------------------
// Pure HTML → launch items (unit-tested, no network)

export interface LaunchItem {
  title: string
  url: string
}

// Anchors on the news page whose text looks like a headline: tags stripped from the text,
// relative hrefs resolved against the page, same-host links only (a vendor's newsroom links to
// its own posts; cross-host links are social/footer chrome), deduped by URL.
export function launchItemsFromHtml(html: string, baseUrl: string): LaunchItem[] {
  const items: LaunchItem[] = []
  const seen = new Set<string>()
  const base = new URL(baseUrl)
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*"([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = decodeEntities(m[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
    if (title.length < LW_MIN_HEADLINE_CHARS) continue
    let url: URL
    try {
      url = new URL(decodeEntities(m[1]), base)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    if (url.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue
    url.hash = ''
    const key = url.toString()
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ title, url: key })
    if (items.length >= LW_MAX_ITEMS_PER_SOURCE) break
  }
  return items
}

// Launch-shaped headline on a vendor's own surface. Deliberately tighter than the radar's
// isLaunchTitle (which parses HN title prefixes): vendor newsrooms mix launches with hiring
// posts, research, and customer stories, and only the launches are entry candidates.
const LAUNCH_HEADLINE_RE =
  /\b(launch(es|ed|ing)?|introduc(es|ing|ed)|announc(es|ing|ed)|unveil(s|ed|ing)?|debuts?|now available|now in beta|early access|general availability|generally available|rolls? out|rolling out|meet the new|is here)\b/i

export function isLaunchHeadline(title: string): boolean {
  return LAUNCH_HEADLINE_RE.test(title)
}

// ---------------------------------------------------------------------------------------------
// Candidates: one per (product, target arena) the product is not rostered in

export interface LaunchCandidate {
  key: string // launch:<productId>:<arena>
  productId: string
  name: string
  arena: string
  hits: number
  keywords: string[]
  title: string
  url: string // the launch post
  sourceUrl: string // the urls.news page the headline came from
}

export function launchKey(productId: string, arena: string): string {
  return `launch:${productId}:${arena}`
}

// Words from the post's URL path join the headline for matching — vendor slugs carry real
// signal ("/blog/mercury-personal-banking") and the radar matches title+tagline the same way.
export function matchText(item: LaunchItem): string {
  let pathWords = ''
  try {
    pathWords = decodeURIComponent(new URL(item.url).pathname).replace(/[-_/.]+/g, ' ')
  } catch {
    // keep title-only matching
  }
  return `${item.title} ${pathWords}`.trim()
}

export function launchCandidates(
  product: Pick<WatchedProduct, 'id' | 'name' | 'arenas'>,
  items: LaunchItem[],
  vocab: Map<string, VocabWord[]>,
  sourceUrl: string,
): LaunchCandidate[] {
  const byKey = new Map<string, LaunchCandidate>()
  for (const item of items) {
    if (!isLaunchHeadline(item.title)) continue
    const matches: ArenaMatch[] = matchArenas(matchText(item), vocab)
    for (const m of matches) {
      if (product.arenas.includes(m.arena)) continue // already judged there
      const key = launchKey(product.id, m.arena)
      const prior = byKey.get(key)
      if (prior && prior.hits >= m.hits) continue // keep the strongest headline per pair
      byKey.set(key, {
        key,
        productId: product.id,
        name: product.name,
        arena: m.arena,
        hits: m.hits,
        keywords: m.keywords,
        title: item.title,
        url: item.url,
        sourceUrl,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => b.hits - a.hits || a.key.localeCompare(b.key))
}

// ---------------------------------------------------------------------------------------------
// Dispositions: the radar-triage report shape, so needs-human-issue.ts and the PR body machinery
// consume launch-watch output unchanged.

export function dispositionFor(
  c: LaunchCandidate,
  product: Pick<WatchedProduct, 'site' | 'docs' | 'type' | 'vendor'>,
  arenaDescription: string,
  date: string,
): Disposition {
  const affiliated = isFounderAffiliated(c.name, product.site)
  const strong = c.hits >= LW_AUTO_APPROVE_HITS
  const status = affiliated || !strong ? 'needs-human' : 'auto-approved'
  const reason = affiliated
    ? 'founder-affiliated products are never auto-approved; a human confirms the cross-arena entry'
    : strong
      ? `rostered vendor's own launch surface names the arena's language (${c.hits} distinct keyword hits ≥ ${LW_AUTO_APPROVE_HITS}); identity, logo, and vendor facts already tracked`
      : `cross-arena entry needs a human call: ${c.hits} keyword hit(s) below the auto-approve floor of ${LW_AUTO_APPROVE_HITS}`
  return {
    key: c.key,
    name: `${c.name} → ${c.arena}`,
    url: c.url,
    arena: c.arena,
    status,
    criterion: 'ranking-fit',
    reason,
    evidence: [
      `headline "${c.title}" — ${c.url} (fetched ${date}, keyless GET of the vendor's own urls.news surface ${c.sourceUrl})`,
      `keyword fit: ${c.keywords.slice(0, 8).join(', ')}`,
      `arena definition: ${arenaDescription}`,
      PLACEMENT_CAVEAT,
    ],
    bringup: status === 'auto-approved' ? { site: product.site, ...(product.docs ? { docs: product.docs } : {}), type: product.type === 'government' ? 'commercial' : product.type } : null,
  }
}

// ---------------------------------------------------------------------------------------------
// Report

export const LaunchWatchSourceStatSchema = z.object({
  productId: z.string(),
  url: z.string(),
  items: z.number(),
  launchShaped: z.number(),
  error: z.string().nullable(),
})

export const LaunchWatchReportSchema = z.object({
  _comment: z.string().optional(),
  generatedAt: z.string(),
  date: z.string(),
  thresholds: z.record(z.string(), z.number()),
  sources: LaunchWatchSourceStatSchema.array(),
  skipped: z.object({ alreadySeen: z.number(), overflow: z.number() }),
  candidates: z
    .object({
      key: z.string(),
      productId: z.string(),
      name: z.string(),
      arena: z.string(),
      hits: z.number(),
      keywords: z.array(z.string()),
      title: z.string(),
      url: z.string(),
      sourceUrl: z.string(),
    })
    .array(),
})
export type LaunchWatchReport = z.infer<typeof LaunchWatchReportSchema>

export function buildMarkdown(report: LaunchWatchReport): string {
  const lines: string[] = []
  lines.push(`## Launch watch — rostered vendors entering new arenas ${report.date}`)
  lines.push('')
  const errors = report.sources.filter((s) => s.error)
  lines.push(
    `Keyless scan of ${report.sources.length} committed \`urls.news\` surfaces ` +
      `(\`rankings-engine/scripts/launch-watch.ts\`): ${report.candidates.length} new (product, arena) ` +
      `candidate${report.candidates.length === 1 ? '' : 's'} (${report.skipped.alreadySeen} previously surfaced` +
      `${report.skipped.overflow > 0 ? `, ${report.skipped.overflow} over the per-report cap` : ''}` +
      `${errors.length > 0 ? `; ${errors.map((s) => `${s.productId}: ${s.error}`).join(' · ')}` : ''}).`,
  )
  lines.push('')
  lines.push('> The scan itself changes nothing under `open-rankings/`. Needs-human rows go to the companion issue; auto-approved rows are applied on this branch only together with their scoped engine run, so every debut score comes from judged evidence.')
  lines.push('')
  for (const c of report.candidates) {
    lines.push(`- [ ] **${c.name}** → \`${c.arena}\` (${c.hits} hits: ${c.keywords.slice(0, 6).join(', ')})`)
    lines.push(`  - [${c.title}](${c.url}) — from ${c.sourceUrl}`)
  }
  if (report.candidates.length === 0) {
    lines.push('_No new candidates this run — no launch-shaped headline matched an arena its vendor is not already rostered in._')
  }
  lines.push('')
  lines.push('_Generated by launch-watch.yml (weekly, keyless). Full machine-readable report: `reports/launch-watch/' + report.date + '.json`._')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Apply: copy an existing product identity into the target arena's roster (auto-approved rows
// only, capped). The scoped engine run that follows — not this append — produces the scores.

export function applyLaunchBringups(triagePath: string, cap: number, dataDir: string = DATA_DIR): string[] {
  const triage = TriageReportSchema.parse(JSON.parse(fs.readFileSync(triagePath, 'utf8')))
  const applied: string[] = []
  for (const d of triage.dispositions) {
    if (applied.length >= cap) break
    if (d.status !== 'auto-approved' || !d.bringup || !d.arena) continue
    const m = /^launch:(.+):([^:]+)$/.exec(d.key)
    if (!m || m[2] !== d.arena) continue
    const productId = m[1]
    const sourceEntry = findRosterEntry(productId, dataDir)
    if (!sourceEntry) continue
    const targetFile = path.join(dataDir, d.arena, 'products.json')
    if (!fs.existsSync(targetFile)) continue
    const roster = ProductSchema.array().parse(JSON.parse(fs.readFileSync(targetFile, 'utf8')))
    if (roster.some((p) => p.id === productId)) continue
    const entry = ProductSchema.parse({
      id: sourceEntry.product.id,
      name: sourceEntry.product.name,
      vendor: sourceEntry.product.vendor,
      type: sourceEntry.product.type,
      urls: {
        site: sourceEntry.product.urls.site,
        ...(sourceEntry.product.urls.docs ? { docs: sourceEntry.product.urls.docs } : {}),
        ...(sourceEntry.product.urls.news ? { news: sourceEntry.product.urls.news } : {}),
      },
      affiliation:
        `Cross-arena entry (launch-watch ${triage.generatedAt.slice(0, 10)}): ${sourceEntry.product.name} is judged separately in ` +
        `${sourceEntry.arena}; this entry judges only the offering announced at ${d.url}.`,
    })
    roster.push(entry)
    fs.writeFileSync(targetFile, JSON.stringify(roster, null, 2) + '\n')
    applied.push(`${d.arena} ${productId}`)
  }
  return applied
}

function findRosterEntry(productId: string, dataDir: string): { arena: string; product: Product } | null {
  const categories = JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf8')) as { id: string }[]
  for (const cat of categories) {
    const file = path.join(dataDir, cat.id, 'products.json')
    if (!fs.existsSync(file)) continue
    const roster = ProductSchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    const product = roster.find((p) => p.id === productId)
    if (product) return { arena: cat.id, product }
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Network + run (never exercised by tests)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(url: string): Promise<{ status: number; html: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  return { status: res.status, html: res.ok ? await res.text() : '' }
}

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

function argAll(argv: string[], flag: string): string[] {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) if (argv[i] === flag && argv[i + 1]) out.push(argv[i + 1])
  return out
}

export async function run(argv: string[]): Promise<LaunchWatchReport> {
  const dryRun = argv.includes('--dry-run')
  const issueBody = argValue(argv, '--issue-body')
  const extraSeen = argAll(argv, '--merge-seen').map((f) => {
    const l = loadSeenLedger(f)
    if (!l) throw new Error(`launch-watch: --merge-seen ${f}: no ledger file there`)
    return l.seen
  })
  const now = new Date()
  const date = now.toISOString().slice(0, 10)

  const sections = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'arena-sections.json'), 'utf8')) as {
    sections: { id: string; name: string; arenaIds: string[] }[]
  }
  const sectionNameByArena = new Map<string, string>()
  for (const s of sections.sections) for (const a of s.arenaIds) sectionNameByArena.set(a, s.name)
  const categories: Category[] = readCategories()
  const vocab = buildArenaVocab(categories, sectionNameByArena)
  const descriptionByArena = new Map(categories.map((c) => [c.id, c.description]))

  const rosters = new Map<string, Product[]>()
  for (const cat of categories) {
    const file = path.join(DATA_DIR, cat.id, 'products.json')
    if (!fs.existsSync(file)) continue
    rosters.set(cat.id, ProductSchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8'))))
  }
  const watched = collectWatchedProducts(rosters)
  const productById = new Map(watched.map((w) => [w.id, w]))

  const ledger = loadSeenLedger()
  const seenKeys = new Set(mergeSeenEntries([ledger?.seen ?? [], ...extraSeen]).map((e) => e.key))

  const stats: z.infer<typeof LaunchWatchSourceStatSchema>[] = []
  const allCandidates: LaunchCandidate[] = []
  const lastFetchByHost = new Map<string, number>()
  for (const w of watched) {
    for (const newsUrl of w.news) {
      const host = new URL(newsUrl).hostname
      const since = Date.now() - (lastFetchByHost.get(host) ?? 0)
      if (since < POLITE_DELAY_MS) await sleep(POLITE_DELAY_MS - since)
      try {
        const { status, html } = await fetchPage(newsUrl)
        lastFetchByHost.set(host, Date.now())
        if (status !== 200) {
          stats.push({ productId: w.id, url: newsUrl, items: 0, launchShaped: 0, error: `HTTP ${status}` })
          continue
        }
        const items = launchItemsFromHtml(html, newsUrl)
        const launchShaped = items.filter((i) => isLaunchHeadline(i.title)).length
        stats.push({ productId: w.id, url: newsUrl, items: items.length, launchShaped, error: null })
        allCandidates.push(...launchCandidates(w, items, vocab, newsUrl))
      } catch (err) {
        lastFetchByHost.set(host, Date.now())
        stats.push({ productId: w.id, url: newsUrl, items: 0, launchShaped: 0, error: String(err instanceof Error ? err.message : err) })
      }
    }
  }

  // Dedupe across sources (same key can surface from two news URLs — keep the strongest) and
  // against the seen-ledger.
  const byKey = new Map<string, LaunchCandidate>()
  let alreadySeen = 0
  for (const c of allCandidates.sort((a, b) => b.hits - a.hits || a.key.localeCompare(b.key))) {
    if (seenKeys.has(c.key)) {
      alreadySeen++
      continue
    }
    if (!byKey.has(c.key)) byKey.set(c.key, c)
  }
  const fresh = [...byKey.values()]
  const overflow = Math.max(0, fresh.length - LW_MAX_REPORT_CANDIDATES)
  const candidates = fresh.slice(0, LW_MAX_REPORT_CANDIDATES)

  const report: LaunchWatchReport = {
    _comment:
      'Generated by rankings-engine/scripts/launch-watch.ts — rostered vendors whose own launch surfaces (committed urls.news) announce products that keyword-match an arena the vendor is not rostered in. The scan changes nothing under open-rankings/; dispositions ride the companion triage report and every debut score comes from the scoped standard engine run.',
    generatedAt: now.toISOString(),
    date,
    thresholds: { LW_MAX_ITEMS_PER_SOURCE, LW_MIN_HEADLINE_CHARS, LW_AUTO_APPROVE_HITS, LW_MAX_REPORT_CANDIDATES },
    sources: stats,
    skipped: { alreadySeen, overflow },
    candidates,
  }
  LaunchWatchReportSchema.parse(report)

  const triage: TriageReport = {
    _comment: 'Launch-watch dispositions in the radar-triage report shape: needs-human rows feed needs-human-issue.ts --generator launch-watch; auto-approved rows feed launch-watch --apply.',
    generatedAt: now.toISOString(),
    policy: LW_POLICY,
    dispositions: candidates.map((c) => {
      const w = productById.get(c.productId)
      if (!w) throw new Error(`launch-watch: candidate for unwatched product ${c.productId}`)
      return dispositionFor(c, w, descriptionByArena.get(c.arena) ?? '(no arena description)', date)
    }),
  }
  TriageReportSchema.parse(triage)

  const markdown = buildMarkdown(report)
  console.log(
    `launch-watch: ${stats.length} sources → ${candidates.length} new (product, arena) candidates ` +
      `(${alreadySeen} already seen${overflow > 0 ? `, ${overflow} overflow` : ''})`,
  )
  for (const s of stats) if (s.error) console.log(`launch-watch: ${s.productId} ${s.url} degraded — ${s.error}`)
  for (const c of candidates) console.log(`  ${c.name} → ${c.arena} (${c.hits} hits) — ${c.title}`)

  if (dryRun) {
    console.log('launch-watch: --dry-run, nothing written')
    return report
  }

  fs.mkdirSync(LW_REPORTS_DIR, { recursive: true })
  writeJson(path.join(LW_REPORTS_DIR, `${date}.json`), report)
  fs.writeFileSync(path.join(LW_REPORTS_DIR, `${date}.md`), markdown + '\n')
  writeJson(path.join(LW_REPORTS_DIR, `${date}-triage.json`), triage)

  const newEntries: SeenEntry[] = candidates.map((c) => ({
    key: c.key,
    name: `${c.name} → ${c.arena}`,
    firstSeen: date,
    sources: [c.url],
  }))
  const merged = mergeSeenEntries([ledger?.seen ?? [], ...extraSeen, newEntries])
  writeJson(SEEN_LEDGER_FILE, {
    ...(ledger?._comment ? { _comment: ledger._comment } : {}),
    updatedAt: now.toISOString(),
    seen: merged,
  })

  if (issueBody && candidates.length > 0) fs.writeFileSync(issueBody, markdown + '\n')
  return report
}

if (require.main === module) {
  const argv = process.argv.slice(2)
  const applyPath = argValue(argv, '--apply')
  if (applyPath) {
    const cap = Number(argValue(argv, '--cap') ?? LW_DEFAULT_APPLY_CAP)
    const applied = applyLaunchBringups(applyPath, cap)
    for (const line of applied) console.log(line)
    process.exit(0)
  }
  run(argv).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
