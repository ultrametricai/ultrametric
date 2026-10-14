// Vendor news watcher (founder ask 2026-09-23: "monitoring product launches from these vendors
// and blog posts on agentic changes they've made"): sweep every tracked product for a
// blog/changelog/news surface, pull its recent post titles, and flag the AGENTIC-RELEVANT ones
// by keyword into open-rankings/vendor-news.json. Rendered on the unlinked /ops dashboard, where posts
// newer than a product's lastSpiked date (open-rankings/spike-queue.json) form the "re-spike these" list.
//
// Source discovery, cheapest-first and honest:
//   1. Explicit corpus URLs — any products.json url (site/docs/extra/links) whose path contains
//      a blog/changelog/news segment, truncated to the section root (a deep post URL like
//      relayfi.com/blog/profit-first-method/ yields the source relayfi.com/blog).
//   2. Derived guesses — <site-origin>/blog and <site-origin>/changelog, used ONLY after a live
//      200 HTML fetch verifies them (no source is recorded from a guess that didn't answer).
// Per source, extraction is RSS-first: try <src>/feed, <src>/rss.xml, <src>/atom.xml; then the
// page's own <link rel="alternate" type="application/(rss|atom)+xml"> pointer; only then fall
// back to same-origin anchor-text scraping. Scraped items may honestly carry date: null — the
// re-spike cross-signal on /ops only fires on items with a real date (or never-spiked vendors).
//
// BUDGETED and resumable: at most --budget HTTP fetches per run (default 150), ≤5 per product,
// sequential with a polite delay. Products are processed least-recently-checked first and a
// source checked within the last 7 days is skipped, so repeated runs walk the whole fleet in
// slices; a run that exhausts its budget writes an honest partial (budget.exhausted: true) and
// the next run picks up where it left off. Merges are per-product: a run only replaces the
// products it actually re-checked.
//
// Everything written is verbatim from fetched content — titles, links, and dates come from the
// vendor's own feed or page; nothing is invented. Keyword flagging (isAgenticTitle) is a cheap
// lexical signal for FOCUS, not a verdict input: it never touches any Overall score.
//
// Invocation:
//   pnpm tsx rankings-engine/scripts/watch-vendor-news.ts                 # walk the fleet under budget
//   pnpm tsx rankings-engine/scripts/watch-vendor-news.ts --budget 40     # smaller slice
//   pnpm tsx rankings-engine/scripts/watch-vendor-news.ts --category ai-coding
//   pnpm tsx rankings-engine/scripts/watch-vendor-news.ts --dry-run       # no write
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { DATA_DIR, readCategories, writeJson } from '../paths'
import { ProductSchema, type Product } from '../../lib/schemas'

export const NEWS_FILE = path.join(DATA_DIR, 'vendor-news.json')
export const DEFAULT_FETCH_BUDGET = 150
export const MAX_FETCHES_PER_PRODUCT = 5
export const MAX_ITEMS_PER_SOURCE = 10
export const RECHECK_DAYS = 7
const FETCH_TIMEOUT_MS = 8_000
const POLITE_DELAY_MS = 150
const USER_AGENT =
  'Mozilla/5.0 (compatible; Ultrametric-news-watcher/1.0; +https://ultrametric.ai)'

// ---------------------------------------------------------------------------
// State file schema (open-rankings/vendor-news.json)
// ---------------------------------------------------------------------------

export const NewsItemSchema = z.object({
  productId: z.string(),
  arenaId: z.string(),
  title: z.string(),
  url: z.string(),
  date: z.string().nullable(), // ISO yyyy-mm-dd when the feed/page carried one; null when not
  agentic: z.boolean(),
})
export type NewsItem = z.infer<typeof NewsItemSchema>

export const NewsSourceSchema = z.object({
  productId: z.string(),
  arenaId: z.string(),
  url: z.string(), // the section root actually checked
  derived: z.boolean(), // true = /blog|/changelog guess, not a corpus URL
  method: z.enum(['rss', 'atom', 'scrape', 'none']),
  checkedAt: z.string(),
  fetches: z.number(),
  items: z.number(),
})
export type NewsSource = z.infer<typeof NewsSourceSchema>

export const NewsStateSchema = z.object({
  _comment: z.string().optional(),
  generatedAt: z.string(),
  budget: z.object({ cap: z.number(), used: z.number(), exhausted: z.boolean() }),
  sources: NewsSourceSchema.array(),
  items: NewsItemSchema.array(),
})
export type NewsState = z.infer<typeof NewsStateSchema>

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in rankings-engine/__tests__/watch-vendor-news.test.ts)
// ---------------------------------------------------------------------------

// The founder's agentic-relevance keywords, verbatim from the ask: mcp|agent|ai |llm|assistant|
// copilot|api v|sdk. Lexical substring match on the lowercased title — 'agent' also catches
// 'agentic'/'agents', 'ai ' needs the trailing space so 'air'/'detail' stay quiet (while
// 'OpenAI launches…' deliberately matches). A focus signal only, never a score input.
export const AGENTIC_KEYWORDS = ['mcp', 'agent', 'ai ', 'llm', 'assistant', 'copilot', 'api v', 'sdk'] as const

export function isAgenticTitle(title: string): boolean {
  const t = ` ${title.toLowerCase()} ` // pad so a trailing 'ai' still matches 'ai '
  return AGENTIC_KEYWORDS.some((k) => t.includes(k))
}

// Path segments that mark a URL as a news-ish surface.
const SOURCE_SEGMENT_RE = /^(blog|changelog|news|updates|release-notes|releases)$/i

// Truncate any URL to its news-section root: https://a.com/x/blog/deep/post → https://a.com/x/blog.
// Returns null when no path segment matches (the URL isn't a news surface).
export function sectionRootOf(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const segments = u.pathname.split('/').filter(Boolean)
  const i = segments.findIndex((s) => SOURCE_SEGMENT_RE.test(s))
  if (i === -1) return null
  return `${u.origin}/${segments.slice(0, i + 1).join('/')}`
}

export interface CandidateSource {
  url: string
  derived: boolean
}

// All candidate news sources for one product, explicit corpus URLs first (deduped section
// roots, cap 2), else /blog + /changelog derived from the site origin. Derived candidates are
// only ever RECORDED after a live 200 verification in checkSource().
export function candidateSourcesFor(product: Pick<Product, 'urls' | 'links'>): CandidateSource[] {
  const urls: string[] = [
    product.urls?.changelog, // the schema's dedicated field wins when present
    product.urls?.site,
    product.urls?.docs,
    ...(product.urls?.extra ?? []),
    ...Object.values(product.links ?? {}),
  ].filter((u): u is string => typeof u === 'string')

  const explicit: string[] = []
  for (const u of urls) {
    const root = sectionRootOf(u)
    if (root && !explicit.includes(root)) explicit.push(root)
  }
  if (explicit.length > 0) return explicit.slice(0, 2).map((url) => ({ url, derived: false }))

  const site = product.urls?.site
  if (!site) return []
  try {
    const origin = new URL(site).origin
    return [
      { url: `${origin}/blog`, derived: true },
      { url: `${origin}/changelog`, derived: true },
    ]
  } catch {
    return []
  }
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&#x27;': "'", '&#8217;': '’', '&#8216;': '‘', '&#8211;': '–',
  '&#8212;': '—', '&#8230;': '…',
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m)
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function isoDateOf(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function tagText(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return null
  const inner = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return stripTags(inner) || null
}

export interface FeedItem {
  title: string
  url: string
  date: string | null
}

export type FeedKind = 'rss' | 'atom'

// Minimal RSS/Atom item extraction — titles, links, dates, verbatim, no XML dependency.
// Returns null when the payload contains no recognizable feed entries (an HTML 404 page on a
// guessed /rss.xml path falls through here rather than yielding junk).
export function parseFeedItems(xml: string): { kind: FeedKind; items: FeedItem[] } | null {
  const rssBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  const atomBlocks = rssBlocks.length === 0 ? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [] : []
  const kind: FeedKind = rssBlocks.length > 0 ? 'rss' : 'atom'
  const blocks = rssBlocks.length > 0 ? rssBlocks : atomBlocks
  if (blocks.length === 0) return null

  const items: FeedItem[] = []
  for (const block of blocks) {
    const title = tagText(block, 'title')
    let url: string | null = null
    if (kind === 'rss') {
      url = tagText(block, 'link') ?? tagText(block, 'guid')
    } else {
      // Atom: prefer the rel="alternate" (or rel-less) link's href attribute.
      const links = [...block.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0])
      const alt = links.find((l) => !/rel=/.test(l) || /rel="?alternate"?/i.test(l)) ?? links[0]
      url = alt?.match(/href="([^"]+)"/i)?.[1] ?? null
    }
    const date = isoDateOf(
      tagText(block, 'pubDate') ?? tagText(block, 'published') ?? tagText(block, 'updated') ?? tagText(block, 'dc:date'),
    )
    if (title && url) items.push({ title, url: decodeEntities(url.trim()), date })
    if (items.length >= MAX_ITEMS_PER_SOURCE) break
  }
  return items.length > 0 ? { kind, items } : null
}

// href paths that are section navigation, not posts.
const NAV_PATH_RE = /\/(tag|tags|category|categories|author|authors|page|topics?|archive)\//i

// Anchor-text fallback for pages without a discoverable feed: same-origin links deeper than the
// section root, with real (≥3-word or ≥18-char) anchor text. Dates are NOT guessed — scraped
// items carry date: null unless the anchor block itself has a <time datetime>.
export function extractAnchorPosts(html: string, sourceUrl: string): FeedItem[] {
  let base: URL
  try {
    base = new URL(sourceUrl)
  } catch {
    return []
  }
  const rootPath = base.pathname.replace(/\/+$/, '')
  const items: FeedItem[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\b([^>]*)href="([^"#]+)"([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const [, pre, href, post, inner] = m
    let u: URL
    try {
      u = new URL(href, base)
    } catch {
      continue
    }
    if (u.origin !== base.origin) continue
    const p = u.pathname.replace(/\/+$/, '')
    // A post lives DEEPER than the section root (…/blog/some-post), never at or above it.
    if (!p.startsWith(`${rootPath}/`) || p === rootPath) continue
    if (NAV_PATH_RE.test(`${p}/`)) continue
    const title = stripTags(inner)
    if (title.length < 18 && title.split(/\s+/).length < 3) continue
    const url = `${u.origin}${p}`
    if (seen.has(url)) continue
    seen.add(url)
    // <time datetime="…"> inside or beside the anchor is the only date evidence we accept here.
    const timeAttr = `${pre} ${post} ${inner}`.match(/datetime="([^"]+)"/i)?.[1] ?? null
    items.push({ title: title.slice(0, 200), url, date: isoDateOf(timeAttr) })
    if (items.length >= MAX_ITEMS_PER_SOURCE) break
  }
  return items
}

// <link rel="alternate" type="application/rss+xml|atom+xml" href="…"> discovery in page HTML.
export function discoverFeedUrl(html: string, baseUrl: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    if (!/rel="?alternate"?/i.test(tag)) continue
    if (!/application\/(rss|atom)\+xml/i.test(tag)) continue
    const href = tag.match(/href="([^"]+)"/i)?.[1]
    if (!href) continue
    try {
      return new URL(decodeEntities(href), baseUrl).toString()
    } catch {
      continue
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Fetching (budgeted)
// ---------------------------------------------------------------------------

interface FetchResult {
  ok: boolean
  status: number
  text: string
}

async function fetchText(url: string): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const text = res.ok ? await res.text() : ''
    return { ok: res.ok, status: res.status, text }
  } catch {
    return { ok: false, status: 0, text: '' }
  } finally {
    clearTimeout(timer)
  }
}

class Budget {
  used = 0
  constructor(readonly cap: number) {}
  get exhausted(): boolean {
    return this.used >= this.cap
  }
  /** Spend one fetch; false when the cap is already reached (caller must stop, not fudge). */
  spend(): boolean {
    if (this.exhausted) return false
    this.used += 1
    return true
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface SourceResult {
  method: NewsSource['method']
  fetches: number
  items: FeedItem[]
}

// One source, ≤ perSourceCap fetches: explicit sources try guessed feed paths first (cheap XML
// wins), then the page itself (feed pointer, else scrape); derived guesses verify the page
// FIRST so a 404 costs one fetch and records nothing.
async function checkSource(src: CandidateSource, budget: Budget, perSourceCap: number): Promise<SourceResult | 'budget'> {
  let fetches = 0
  const spend = async (url: string): Promise<FetchResult | null> => {
    if (fetches >= perSourceCap || !budget.spend()) return null
    fetches += 1
    await sleep(POLITE_DELAY_MS)
    return fetchText(url)
  }
  const root = src.url.replace(/\/+$/, '')

  const tryFeed = async (url: string): Promise<SourceResult | null> => {
    const res = await spend(url)
    if (!res?.ok) return null
    const parsed = parseFeedItems(res.text)
    return parsed ? { method: parsed.kind, fetches, items: parsed.items } : null
  }

  if (!src.derived) {
    for (const guess of [`${root}/feed`, `${root}/rss.xml`, `${root}/atom.xml`]) {
      const hit = await tryFeed(guess)
      if (hit) return hit
      if (budget.exhausted || fetches >= perSourceCap) return 'budget'
    }
  }

  const page = await spend(root)
  if (page === null) return 'budget'
  if (!page.ok) return { method: 'none', fetches, items: [] }

  // The page might itself BE a feed (some corpus 'blog' urls point straight at XML).
  const asFeed = parseFeedItems(page.text)
  if (asFeed) return { method: asFeed.kind, fetches, items: asFeed.items }

  const feedUrl = discoverFeedUrl(page.text, root)
  if (feedUrl && fetches < perSourceCap && !budget.exhausted) {
    const hit = await tryFeed(feedUrl)
    if (hit) return hit
  }

  const scraped = extractAnchorPosts(page.text, root)
  return { method: scraped.length > 0 ? 'scrape' : 'none', fetches, items: scraped }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function loadState(file: string = NEWS_FILE): NewsState | null {
  try {
    return NewsStateSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    return null
  }
}

interface Tracked {
  arenaId: string
  product: Product
  sources: CandidateSource[]
}

function trackedProducts(categoryFilter?: string): Tracked[] {
  const out: Tracked[] = []
  for (const cat of readCategories()) {
    if (categoryFilter && cat.id !== categoryFilter) continue
    const file = path.join(DATA_DIR, cat.id, 'products.json')
    if (!fs.existsSync(file)) continue
    const products = ProductSchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    for (const product of products) {
      const sources = candidateSourcesFor(product)
      if (sources.length > 0) out.push({ arenaId: cat.id, product, sources })
    }
  }
  return out
}

export async function run(argv: string[]): Promise<NewsState> {
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const budget = new Budget(Number(arg('--budget') ?? DEFAULT_FETCH_BUDGET))
  const dryRun = argv.includes('--dry-run')
  const category = arg('--category')

  const prior = loadState()
  const checkedAtByProduct = new Map<string, string>()
  for (const s of prior?.sources ?? []) {
    const cur = checkedAtByProduct.get(s.productId)
    if (!cur || s.checkedAt > cur) checkedAtByProduct.set(s.productId, s.checkedAt)
  }

  const now = new Date()
  const freshCutoff = new Date(now.getTime() - RECHECK_DAYS * 24 * 3600 * 1000).toISOString()
  // Least-recently-checked first (never-checked leads), so budget slices walk the whole fleet.
  const worklist = trackedProducts(category)
    .filter((t) => (checkedAtByProduct.get(t.product.id) ?? '') < freshCutoff)
    .sort((a, b) => {
      const ca = checkedAtByProduct.get(a.product.id) ?? ''
      const cb = checkedAtByProduct.get(b.product.id) ?? ''
      return ca < cb ? -1 : ca > cb ? 1 : a.product.id.localeCompare(b.product.id)
    })

  const newSources: NewsSource[] = []
  const newItems: NewsItem[] = []
  const processed = new Set<string>() // productIds re-checked this run
  let feedsFound = 0

  for (const t of worklist) {
    if (budget.exhausted) break
    let productFetches = 0
    const runSources: NewsSource[] = []
    const runItems: NewsItem[] = []
    let complete = true
    for (const src of t.sources) {
      const cap = Math.min(MAX_FETCHES_PER_PRODUCT - productFetches, MAX_FETCHES_PER_PRODUCT)
      if (cap <= 0) break
      const result = await checkSource(src, budget, cap)
      if (result === 'budget') {
        complete = false
        break
      }
      productFetches += result.fetches
      // Derived guesses that answered nothing are not recorded as sources — no fabricated surface.
      if (src.derived && result.method === 'none') continue
      runSources.push({
        productId: t.product.id,
        arenaId: t.arenaId,
        url: src.url,
        derived: src.derived,
        method: result.method,
        checkedAt: now.toISOString(),
        fetches: result.fetches,
        items: result.items.length,
      })
      if (result.method === 'rss' || result.method === 'atom') feedsFound += 1
      for (const item of result.items) {
        if (runItems.some((i) => i.url === item.url)) continue
        runItems.push({
          productId: t.product.id,
          arenaId: t.arenaId,
          title: item.title,
          url: item.url,
          date: item.date,
          agentic: isAgenticTitle(item.title),
        })
      }
      // One working feed per product is enough — don't spend budget on the second source.
      if ((result.method === 'rss' || result.method === 'atom') && result.items.length > 0) break
    }
    // A product interrupted mid-check keeps its PRIOR state; only completed checks replace it.
    if (complete) {
      processed.add(t.product.id)
      newSources.push(...runSources)
      newItems.push(...runItems)
    }
  }

  // Merge: this run's completed products replace their prior rows; everyone else carries over.
  const sources = [
    ...(prior?.sources ?? []).filter((s) => !processed.has(s.productId)),
    ...newSources,
  ].sort((a, b) => a.productId.localeCompare(b.productId) || a.url.localeCompare(b.url))
  const items = [
    ...(prior?.items ?? []).filter((i) => !processed.has(i.productId)),
    ...newItems,
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.productId.localeCompare(b.productId) || a.url.localeCompare(b.url))

  const state: NewsState = {
    _comment:
      'Generated by rankings-engine/scripts/watch-vendor-news.ts — recent blog/changelog post titles per tracked product, agentic-relevant ones keyword-flagged (a FOCUS signal for the unlinked /ops dashboard, never a Overall score input). Budgeted and resumable: budget.exhausted true means an honest partial; the next run continues from the least-recently-checked product. All titles/links/dates verbatim from the vendor’s own feed or page.',
    generatedAt: now.toISOString(),
    budget: { cap: budget.cap, used: budget.used, exhausted: budget.exhausted },
    sources,
    items,
  }

  console.log(
    `watch-vendor-news: checked ${processed.size} products (${budget.used}/${budget.cap} fetches` +
      `${budget.exhausted ? ', budget exhausted — honest partial' : ''}), ` +
      `${feedsFound} feeds found this run · state now ${sources.length} sources, ${items.length} items ` +
      `(${items.filter((i) => i.agentic).length} agentic-flagged)`,
  )
  if (!dryRun) writeJson(NEWS_FILE, state)
  else console.log('watch-vendor-news: --dry-run, nothing written')
  return state
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
