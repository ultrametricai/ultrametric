// Vendor radar (founder ask 2026-10-02: "we need a way not to miss new vendors that are hot and
// coming out — listen for new vendor launches and do a deep spike on them when they come out, so
// this data set is alive"): a KEYLESS daily scan of public launch surfaces for new products that
// fit an existing arena and show a real hotness signal, written up as a dated candidates report.
//
// Sources (all keyless, all public, one-or-two HTTP requests each, polite UA):
//   1. Hacker News via the Algolia search API (hn.algolia.com — keyless by design): Show HN and
//      "Launch HN" stories from the last HN_LOOKBACK_DAYS, plus front-page stories whose title is
//      launch-shaped (isLaunchTitle). Hotness = points, with a velocity fast-path for very fresh
//      stories (isHotHn).
//   2. Product Hunt's public frontpage feed (producthunt.com/feed — Atom, no key; a single feed
//      fetch, which PH publishes for exactly this kind of consumption). Frontpage presence IS the
//      hotness evidence — the feed does not expose vote counts keylessly and we never invent them.
//   3. GitHub repo search (api.github.com/search/repositories — keyless within 10 req/min; we make
//      ONE request, with GH_TOKEN used for the higher authenticated limit when present, same
//      preference as rankings-engine/stages/popularity.ts): repos created in the last
//      GITHUB_LOOKBACK_DAYS crossing a star-velocity threshold (isHotRepo).
//   4. YC Launches via ycombinator.com/launches.json (verified keyless 2026-10-21: the endpoint
//      answers plain JSON — Algolia-style {hits,nbHits,page,nbPages} pages of 20 — with title,
//      tagline, created_at, total_vote_count, and the company's name/url/batch/tags; robots.txt
//      allows /launches; /launches/rss and /launches/feed 404, so this JSON surface is the feed).
//      One-or-two page fetches cover YC_LOOKBACK_DAYS. Presence on YC's official launch feed
//      within the window is the signal (the Product Hunt frontpage precedent); the vote count is
//      reported verbatim as evidence, not thresholded.
//
// Matching: candidate text (title/tagline/description/topics) is scored lexically against the
// arena taxonomy — DOMAIN_VOCAB (rankings-engine/scripts/tag-story-scopes.ts, the same per-arena nouns
// yc-coverage-queue.ts matches with) extended with each arena's categories.json name tokens and
// its arena-sections.json section-name tokens (buildArenaVocab). MIN_ARENA_HITS distinct keyword
// hits are required, exactly like yc-coverage-queue's MIN_VOCAB_HITS: a candidate that doesn't
// speak any arena's language is not our vendor, however hot.
//
// Dedupe, so each candidate surfaces ONCE and already-tracked vendors never do:
//   · every open-rankings/<arena>/products.json product, by normalized site domain (rankings-engine/yc-shared.ts
//     normalizeDomain — never by name alone) AND by normalized name/id,
//   · the vendor registry (open-rankings/reviews/generated/<arena>--<product>.json), by product id,
//   · the committed seen-ledger rankings-engine/radar-seen.json: every candidate ever reported, keyed by
//     product domain (or github:owner/repo / normalized name when no product domain is public).
//
// Output: reports/vendor-radar/<date>.json + .md (the dated candidates report) and the updated
// seen-ledger. --issue-body <path> additionally writes the markdown ONLY when there are new
// candidates — .github/workflows/vendor-radar.yml puts it on the scan PR's body (the issue it
// files, via needs-human-issue.ts, carries only the triage's needs-human dispositions).
//
// HONESTY: the scan itself detects and reports — nothing under open-rankings/ changes from a scan, the
// radar NEVER creates a new ranking, and it NEVER touches a founder-affiliated product
// autonomously. Approval is criteria-based (policies/AGENT_POLICY.md "Vendor-radar candidate
// approval", founder authorization 2026-10-13, replacing checkbox approval): the companion
// radar-triage.ts applies the criteria mechanically and the bring-up on auto-approved candidates
// is a scoped standard engine run landing as a reviewed PR (docs/VENDOR-RADAR.md). Every
// evidence string in the report is verbatim-derived from the source's own response (points,
// dates, star counts); nothing is invented, and a source that fails to answer degrades to zero
// items with an honest note in the report, never a fabricated one.
//
// Invocation:
//   pnpm tsx rankings-engine/scripts/vendor-radar.ts                      # scan, write report + ledger
//   pnpm tsx rankings-engine/scripts/vendor-radar.ts --dry-run            # scan, print, write nothing
//   pnpm tsx rankings-engine/scripts/vendor-radar.ts --issue-body /tmp/vendor-radar-issue.md
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { DATA_DIR, ROOT, readCategories, writeJson } from '../paths'
import { ProductSchema, type Category } from '../../lib/schemas'
import { normalizeDomain } from '../yc-shared'
import { DOMAIN_VOCAB } from './tag-story-scopes'
import { decodeEntities } from './watch-vendor-news'

// Folded from the pre-rename pipeline/ location (the engine rename, 2026-10-14 — the same fix
// pattern as CACHE_DIR in rankings-engine/paths.ts); the committed ledger lives here.
export const SEEN_LEDGER_FILE = path.join(ROOT, 'rankings-engine', 'radar-seen.json')
export const REPORTS_DIR = path.join(ROOT, 'reports', 'vendor-radar')
const REVIEWS_DIR = path.join(DATA_DIR, 'reviews', 'generated')

// --- thresholds (tune here; documented in docs/VENDOR-RADAR.md) -------------------------------
export const HN_LOOKBACK_DAYS = 7
export const HN_MIN_POINTS = 40 // a launch this hot is worth a look whatever its age in-window
export const HN_FAST_MIN_POINTS = 20 // …or younger + climbing fast:
export const HN_FAST_MIN_POINTS_PER_HOUR = 8
export const GITHUB_LOOKBACK_DAYS = 30
export const GITHUB_MIN_STARS = 200 // query floor — velocity below decides
export const GITHUB_MIN_STARS_PER_DAY = 25
export const YC_LOOKBACK_DAYS = 7
export const YC_LAUNCHES_MAX_PAGES = 2 // 20 launches/page; 2 pages cover the lookback window
export const MIN_ARENA_HITS = 2 // distinct arena keywords required (yc-coverage-queue precedent)
export const MAX_MATCHED_ARENAS = 3
export const MAX_REPORT_CANDIDATES = 30 // issue readability cap; overflow is counted honestly

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-vendor-radar/1.0; +https://ultrametric.ai)'
const HN_API = 'https://hn.algolia.com/api/v1/search'
const PH_FEED_URL = 'https://www.producthunt.com/feed'
const GITHUB_SEARCH_API = 'https://api.github.com/search/repositories'
const YC_LAUNCHES_URL = 'https://www.ycombinator.com/launches.json'

// ---------------------------------------------------------------------------------------------
// Schemas: the seen-ledger (committed) and the dated report (committed)

export const SeenEntrySchema = z.object({
  key: z.string(),
  name: z.string(),
  firstSeen: z.string(), // yyyy-mm-dd of the run that first reported it — honest, never backdated
  sources: z.array(z.string()),
})
export type SeenEntry = z.infer<typeof SeenEntrySchema>

export const SeenLedgerSchema = z.object({
  _comment: z.string().optional(),
  updatedAt: z.string(),
  seen: SeenEntrySchema.array(),
})
export type SeenLedger = z.infer<typeof SeenLedgerSchema>

// 'yc-launches' = the radar's own ycombinator.com/launches.json scan; 'yc-directory' = queue
// candidates the weekly YC coverage lane hands to the same triage (yc-coverage-queue.ts
// radarReportFromQueue).
export const RADAR_SOURCE_KINDS = ['hn', 'producthunt', 'github', 'yc-launches', 'yc-directory'] as const

export const RadarSourceLinkSchema = z.object({
  kind: z.enum(RADAR_SOURCE_KINDS),
  url: z.string(),
  title: z.string(),
  evidence: z.string(), // verbatim-derived hotness evidence ("Show HN, 132 points in 9h", …)
})

export const RadarCandidateSchema = z.object({
  key: z.string(),
  name: z.string(),
  url: z.string(), // best product URL we have (source page when no product site is public)
  sources: RadarSourceLinkSchema.array().min(1),
  matchedArenas: z
    .object({ arena: z.string(), hits: z.number(), keywords: z.array(z.string()) })
    .array()
    .min(1),
  firstSeen: z.string(),
})
export type RadarCandidate = z.infer<typeof RadarCandidateSchema>

export const RadarReportSchema = z.object({
  _comment: z.string().optional(),
  generatedAt: z.string(),
  date: z.string(),
  thresholds: z.record(z.string(), z.number()),
  sources: z
    .object({
      kind: z.enum(RADAR_SOURCE_KINDS),
      queried: z.string(),
      items: z.number(),
      error: z.string().nullable(),
    })
    .array(),
  skipped: z.object({ tracked: z.number(), alreadySeen: z.number(), overflow: z.number() }),
  candidates: RadarCandidateSchema.array(),
})
export type RadarReport = z.infer<typeof RadarReportSchema>

// ---------------------------------------------------------------------------------------------
// Arena vocabulary: DOMAIN_VOCAB + category-name tokens + arena-section-name tokens

// Generic words that would make name-token matching swallow everything.
const NAME_TOKEN_STOPWORDS = new Set([
  'tools', 'platforms', 'apps', 'apis', 'services', 'management', 'automation', 'software',
  'systems', 'startup', 'modern', 'the', 'and', 'for', 'with', 'as', 'a',
])

export interface VocabWord {
  word: string
  re: RegExp
}

function tokensOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length >= 4 && !NAME_TOKEN_STOPWORDS.has(t))
}

// Per-arena keyword lists: DOMAIN_VOCAB where it exists, extended with the arena's display-name
// tokens and its section-name tokens — so arenas without a DOMAIN_VOCAB entry still match on
// their own nouns ("identity-verification" matches "identity", "verification"). One regex per
// word so hits count DISTINCT concepts (yc-coverage-queue's compileVocab rationale).
export function buildArenaVocab(
  categories: Pick<Category, 'id' | 'name'>[],
  sectionNameByArena: Map<string, string>,
): Map<string, VocabWord[]> {
  const vocab = new Map<string, VocabWord[]>()
  for (const cat of categories) {
    const words = new Set<string>(DOMAIN_VOCAB[cat.id] ?? [])
    for (const t of tokensOf(cat.name)) words.add(t)
    for (const t of tokensOf(sectionNameByArena.get(cat.id) ?? '')) words.add(t)
    vocab.set(
      cat.id,
      [...words].map((w) => ({ word: w, re: new RegExp(`\\b(${w})`, 'i') })),
    )
  }
  return vocab
}

export interface ArenaMatch {
  arena: string
  hits: number
  keywords: string[]
}

// All arenas the text speaks the language of: ≥ MIN_ARENA_HITS distinct keyword hits, strongest
// first (hits desc, then arena id asc — deterministic), capped at MAX_MATCHED_ARENAS. `hits`
// counts distinct matched vocab words; `keywords` is the display list — regex syntax stripped
// (DOMAIN_VOCAB words like 'game\\b') and then deduped, so it can be shorter than `hits`.
export function matchArenas(text: string, vocab: Map<string, VocabWord[]>): ArenaMatch[] {
  const matches: ArenaMatch[] = []
  for (const [arena, words] of vocab) {
    const matched = words.filter(({ re }) => re.test(text))
    if (matched.length < MIN_ARENA_HITS) continue
    const keywords = [...new Set(matched.map(({ word }) => word.replace(/\\b/g, '').replace(/[\\.()[\]|?+*^$]/g, ' ').replace(/\s+/g, ' ').trim()))]
    matches.push({ arena, hits: matched.length, keywords })
  }
  return matches
    .sort((a, b) => b.hits - a.hits || a.arena.localeCompare(b.arena))
    .slice(0, MAX_MATCHED_ARENAS)
}

// ---------------------------------------------------------------------------------------------
// Source item shapes + pure per-source candidate extraction (unit-tested, no network)

export interface RawCandidate {
  kind: (typeof RADAR_SOURCE_KINDS)[number]
  name: string
  url: string // best product URL this source knows
  sourceUrl: string // the launch-surface page (HN item, PH post, GitHub repo)
  title: string
  text: string // what arena matching runs against
  evidence: string
}

// "Show HN: Foo – tagline" / "Launch HN: Foo (YC W26) – tagline" → "Foo". Falls back to the
// whole title when there is no launch prefix (front-page stories).
export function extractLaunchName(title: string): string {
  const stripped = title.replace(/^(show|launch)\s+hn:\s*/i, '')
  const name = stripped.split(/\s+[–—-]\s+|:\s+/)[0].replace(/\s*\(YC [WXSF]\d{2}\)\s*/i, ' ').trim()
  return (name || title).slice(0, 80)
}

// Front-page stories are only radar material when the title itself announces a launch.
export function isLaunchTitle(title: string): boolean {
  if (/^(show|launch)\s+hn:/i.test(title)) return true
  return /\b(launch(es|ed|ing)?|introducing|announcing|unveil(s|ed)?|now (generally )?available|open[- ]sourc(es|ed|ing))\b/i.test(title)
}

// Hotness: HN_MIN_POINTS over the lookback window, or young-and-climbing
// (≥ HN_FAST_MIN_POINTS and ≥ HN_FAST_MIN_POINTS_PER_HOUR since posting).
export function isHotHn(points: number, ageHours: number): boolean {
  if (points >= HN_MIN_POINTS) return true
  const perHour = points / Math.max(1, ageHours)
  return points >= HN_FAST_MIN_POINTS && perHour >= HN_FAST_MIN_POINTS_PER_HOUR
}

export interface HnItem {
  objectID: string
  title: string
  url: string | null
  points: number
  created_at: string
}

export function hnItemsFromJson(json: unknown): HnItem[] {
  const hits = (json as { hits?: unknown[] })?.hits ?? []
  const out: HnItem[] = []
  for (const h of hits) {
    const it = h as Partial<HnItem> & { story_text?: string }
    if (typeof it.objectID !== 'string' || typeof it.title !== 'string') continue
    out.push({
      objectID: it.objectID,
      title: it.title,
      url: typeof it.url === 'string' && it.url.startsWith('http') ? it.url : null,
      points: typeof it.points === 'number' ? it.points : 0,
      created_at: typeof it.created_at === 'string' ? it.created_at : '',
    })
  }
  return out
}

export function hnCandidate(item: HnItem, now: Date): RawCandidate | null {
  if (!isLaunchTitle(item.title)) return null
  const ageHours = Math.max(0, (now.getTime() - Date.parse(item.created_at)) / 3_600_000)
  if (!isHotHn(item.points, ageHours)) return null
  const hnUrl = `https://news.ycombinator.com/item?id=${item.objectID}`
  const label = /^show\s+hn:/i.test(item.title) ? 'Show HN' : /^launch\s+hn:/i.test(item.title) ? 'Launch HN' : 'HN front page'
  return {
    kind: 'hn',
    name: extractLaunchName(item.title),
    url: item.url ?? hnUrl,
    sourceUrl: hnUrl,
    title: item.title,
    text: item.title,
    evidence: `${label}, ${item.points} points in ${Math.round(ageHours)}h (posted ${item.created_at.slice(0, 10)})`,
  }
}

export function githubStarsPerDay(stars: number, createdAt: string, now: Date): number {
  const days = Math.max(1, (now.getTime() - Date.parse(createdAt)) / 86_400_000)
  return stars / days
}

export function isHotRepo(stars: number, createdAt: string, now: Date): boolean {
  return stars >= GITHUB_MIN_STARS && githubStarsPerDay(stars, createdAt, now) >= GITHUB_MIN_STARS_PER_DAY
}

export interface GhRepo {
  full_name: string
  name: string
  html_url: string
  homepage: string | null
  description: string | null
  topics: string[]
  stargazers_count: number
  created_at: string
}

export function ghReposFromJson(json: unknown): GhRepo[] {
  const items = (json as { items?: unknown[] })?.items ?? []
  const out: GhRepo[] = []
  for (const r of items) {
    const it = r as Partial<GhRepo>
    if (typeof it.full_name !== 'string' || typeof it.html_url !== 'string' || typeof it.created_at !== 'string') continue
    out.push({
      full_name: it.full_name,
      name: typeof it.name === 'string' ? it.name : it.full_name.split('/')[1] ?? it.full_name,
      html_url: it.html_url,
      homepage: typeof it.homepage === 'string' && it.homepage.startsWith('http') ? it.homepage : null,
      description: typeof it.description === 'string' ? it.description : null,
      topics: Array.isArray(it.topics) ? it.topics.filter((t): t is string => typeof t === 'string') : [],
      stargazers_count: typeof it.stargazers_count === 'number' ? it.stargazers_count : 0,
      created_at: it.created_at,
    })
  }
  return out
}

export function ghCandidate(repo: GhRepo, now: Date): RawCandidate | null {
  if (!isHotRepo(repo.stargazers_count, repo.created_at, now)) return null
  const perDay = Math.round(githubStarsPerDay(repo.stargazers_count, repo.created_at, now))
  return {
    kind: 'github',
    name: repo.name,
    url: repo.homepage ?? repo.html_url,
    sourceUrl: repo.html_url,
    title: repo.full_name,
    text: `${repo.name} ${repo.description ?? ''} ${repo.topics.join(' ')}`,
    evidence: `${repo.stargazers_count} stars (~${perDay}/day) since ${repo.created_at.slice(0, 10)}`,
  }
}

export interface PhEntry {
  name: string
  url: string
  text: string
  date: string | null
}

const stripHtml = (html: string): string => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

// Minimal Atom parsing for the PH frontpage feed: title, post link, published date, and the
// content snippet (which carries the tagline) for arena matching. No XML dependency, verbatim.
export function parsePhEntries(xml: string): PhEntry[] {
  const out: PhEntry[] = []
  for (const block of xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    const href = [...block.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .find((l) => !/rel=/.test(l) || /rel="?alternate"?/i.test(l))
      ?.match(/href="([^"]+)"/i)?.[1]
    if (!title || !href) continue
    const published = block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() ?? null
    const content = block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ?? ''
    const name = stripHtml(title)
    out.push({
      name,
      url: decodeEntities(href.trim()),
      text: `${name} ${stripHtml(content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).slice(0, 500)}`,
      date: published ? published.slice(0, 10) : null,
    })
    if (out.length >= 60) break
  }
  return out
}

export function phCandidate(entry: PhEntry): RawCandidate {
  return {
    kind: 'producthunt',
    name: entry.name,
    url: entry.url,
    sourceUrl: entry.url,
    title: entry.name,
    text: entry.text,
    evidence: `Product Hunt frontpage feed${entry.date ? `, posted ${entry.date}` : ''} (vote counts are not exposed keylessly — frontpage presence is the signal)`,
  }
}

// One launch from ycombinator.com/launches.json — only the fields the radar reads. `url` is the
// launch post (the feed's search_path); `company.url` is the product's own site when published.
export interface YcLaunch {
  title: string
  tagline: string
  createdAt: string
  votes: number
  url: string
  company: { name: string; url: string | null; batch: string | null; tags: string[] }
}

export function ycLaunchesFromJson(json: unknown): YcLaunch[] {
  const hits = (json as { hits?: unknown[] })?.hits ?? []
  const out: YcLaunch[] = []
  for (const h of hits) {
    const it = h as {
      title?: string
      tagline?: string
      created_at?: string
      total_vote_count?: number
      search_path?: string
      company?: { name?: string; url?: string; batch?: string; tags?: unknown[] }
    }
    if (typeof it.title !== 'string' || typeof it.created_at !== 'string' || typeof it.search_path !== 'string') continue
    out.push({
      title: it.title,
      tagline: typeof it.tagline === 'string' ? it.tagline : '',
      createdAt: it.created_at,
      votes: typeof it.total_vote_count === 'number' ? it.total_vote_count : 0,
      url: it.search_path,
      company: {
        name: typeof it.company?.name === 'string' ? it.company.name : it.title.split(/\s+[–—:-]\s+/)[0].slice(0, 80),
        url: typeof it.company?.url === 'string' && it.company.url.startsWith('http') ? it.company.url : null,
        batch: typeof it.company?.batch === 'string' ? it.company.batch : null,
        tags: Array.isArray(it.company?.tags) ? it.company.tags.filter((t): t is string => typeof t === 'string') : [],
      },
    })
  }
  return out
}

// null when the launch is older than YC_LOOKBACK_DAYS — the feed pages back years, the radar
// wants the current window. Evidence is verbatim-derived: the feed's own vote count and dates.
export function ycCandidate(launch: YcLaunch, now: Date): RawCandidate | null {
  const ageDays = (now.getTime() - Date.parse(launch.createdAt)) / 86_400_000
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > YC_LOOKBACK_DAYS) return null
  return {
    kind: 'yc-launches',
    name: launch.company.name,
    url: launch.company.url ?? launch.url,
    sourceUrl: launch.url,
    title: launch.title,
    text: `${launch.title} ${launch.tagline} ${launch.company.tags.join(' ')}`,
    evidence: `YC launch, ${launch.votes} votes (posted ${launch.createdAt.slice(0, 10)}${launch.company.batch ? `, batch ${launch.company.batch}` : ''})`,
  }
}

// ---------------------------------------------------------------------------------------------
// Keys + dedupe (pure)

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Launch-surface hosts that identify a POST, never a product — they must not become domain keys
// or dedupe against tracked product domains. 'ycombinator.com' covers the YC Launches post pages
// (normalizeDomain strips www.) exactly as news.ycombinator.com covers HN items.
const AGGREGATOR_HOSTS = new Set(['news.ycombinator.com', 'ycombinator.com', 'producthunt.com', 'github.com', 'gist.github.com'])

// Shared project-listing hosts (package registries, app stores, model hubs): a URL there
// identifies one LISTING, never the product's own domain. Keying on the bare hostname would
// let the first PyPI-homepaged project swallow every later one (the ledger's old
// domain:pypi.org entry did exactly that until its one-time keyed migration, 2026-10-19).
const SHARED_LISTING_HOSTS = new Set([
  'pypi.org', 'npmjs.com', 'crates.io', 'rubygems.org', 'packagist.org', 'nuget.org',
  'hub.docker.com', 'marketplace.visualstudio.com', 'apps.apple.com', 'play.google.com',
  'chromewebstore.google.com', 'huggingface.co',
])

// `github:owner/repo` key for any github.com repo URL, whatever source surfaced it — the same
// repo must not key as github:owner/repo from the GitHub scan and name:… from an HN post.
export function githubRepoKey(url: string | undefined | null): string | null {
  const m = url?.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+\/[^/?#]+)/i)
  return m ? `github:${m[1].toLowerCase().replace(/\.git$/, '')}` : null
}

// Stable identity for the seen-ledger: github:owner/repo for anything living at a repo URL;
// the product's own domain when public; the normalized name otherwise (PH posts and
// shared-listing pages keylessly expose no product domain).
export function candidateKey(c: Pick<RawCandidate, 'kind' | 'name' | 'url' | 'title'>): string {
  const repoKey = githubRepoKey(c.url)
  if (repoKey) return repoKey
  const domain = normalizeDomain(c.url)
  if (domain && !AGGREGATOR_HOSTS.has(domain) && !SHARED_LISTING_HOSTS.has(domain)) return `domain:${domain}`
  if (c.kind === 'github') return `github:${c.title.toLowerCase()}`
  return `name:${normalizeName(c.name)}`
}

export interface DedupeContext {
  trackedDomains: Set<string> // normalized product site domains across every arena
  trackedNames: Set<string> // normalized product names + ids + registry ids
  trackedRepos: Set<string> // github:owner/repo keys from every product's urls.github
  seenKeys: Set<string> // rankings-engine/radar-seen.json — everything ever reported
}

export interface AssembleResult {
  candidates: RadarCandidate[]
  skippedTracked: number
  skippedSeen: number
}

// Match, threshold, dedupe, and merge raw items into report candidates. Same-key items from
// different sources merge into one candidate with every source link kept (the cross-source
// corroboration is itself evidence). Deterministic order: strongest arena hits desc, name asc.
export function assembleCandidates(raw: RawCandidate[], vocab: Map<string, VocabWord[]>, ctx: DedupeContext, date: string): AssembleResult {
  const byKey = new Map<string, RadarCandidate>()
  let skippedTracked = 0
  const skippedSeenKeys = new Set<string>()
  for (const item of raw) {
    const matchedArenas = matchArenas(item.text, vocab)
    if (matchedArenas.length === 0) continue
    const key = candidateKey(item)
    const domain = key.startsWith('domain:') ? key.slice('domain:'.length) : null
    if (
      (domain && ctx.trackedDomains.has(domain))
      || (key.startsWith('github:') && ctx.trackedRepos.has(key))
      || ctx.trackedNames.has(normalizeName(item.name))
    ) {
      skippedTracked++
      continue
    }
    if (ctx.seenKeys.has(key)) {
      skippedSeenKeys.add(key)
      continue
    }
    const source = { kind: item.kind, url: item.sourceUrl, title: item.title, evidence: item.evidence }
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.sources.some((s) => s.url === source.url)) existing.sources.push(source)
      // Keep the strongest arena match set (more hits = better text, e.g. GH description over a bare title).
      if ((matchedArenas[0]?.hits ?? 0) > (existing.matchedArenas[0]?.hits ?? 0)) existing.matchedArenas = matchedArenas
      if (!AGGREGATOR_HOSTS.has(normalizeDomain(existing.url) ?? '')) continue
      existing.url = item.url // upgrade a post-only URL to a product URL when a later source has one
      continue
    }
    byKey.set(key, { key, name: item.name, url: item.url, sources: [source], matchedArenas, firstSeen: date })
  }
  const candidates = [...byKey.values()].sort(
    (a, b) => (b.matchedArenas[0]?.hits ?? 0) - (a.matchedArenas[0]?.hits ?? 0) || a.name.localeCompare(b.name),
  )
  return { candidates, skippedTracked, skippedSeen: skippedSeenKeys.size }
}

// ---------------------------------------------------------------------------------------------
// Report + issue markdown

const HONESTY_LINES = [
  'The radar NEVER creates a new ranking and NEVER touches a founder-affiliated product autonomously — nothing under `open-rankings/` changes from the scan itself.',
  'Candidates are triaged against the auto-approval criteria in `policies/AGENT_POLICY.md` ("Vendor-radar candidate approval", founder authorization 2026-10-13, replacing checkbox approval): existing-ranking fit, public docs surface, shipped product, no founder affiliation. The bring-up on auto-approved candidates runs via the standard engine stages as a reviewed PR (`docs/VENDOR-RADAR.md`); candidates failing a criterion are recorded as skipped with the reason and its evidence.',
]

export function buildMarkdown(report: RadarReport): string {
  const lines: string[] = []
  lines.push(`## Vendor radar — candidates ${report.date}`)
  lines.push('')
  const srcLine = report.sources
    .map((s) => `${s.kind}: ${s.error ? `ERROR (${s.error})` : `${s.items} items`}`)
    .join(' · ')
  lines.push(
    `Keyless scan (\`rankings-engine/scripts/vendor-radar.ts\`): ${srcLine} · ` +
      `${report.candidates.length} new candidate${report.candidates.length === 1 ? '' : 's'} ` +
      `(${report.skipped.tracked} already tracked, ${report.skipped.alreadySeen} previously surfaced` +
      `${report.skipped.overflow > 0 ? `, ${report.skipped.overflow} over the per-report cap` : ''}).`,
  )
  lines.push('')
  for (const l of HONESTY_LINES) lines.push(`> ${l}`)
  lines.push('')
  for (const c of report.candidates) {
    lines.push(`- [ ] **${c.name}** — ${c.url}`)
    lines.push(`  - arenas: ${c.matchedArenas.map((m) => `\`${m.arena}\` (${m.hits} hits: ${m.keywords.slice(0, 6).join(', ')})`).join(' · ')}`)
    for (const s of c.sources) lines.push(`  - ${s.kind}: [${s.title}](${s.url}) — ${s.evidence}`)
    lines.push(`  - first seen: ${c.firstSeen}`)
  }
  if (report.candidates.length === 0) {
    lines.push('_No new candidates this run — every hot launch either matched no arena, is already tracked, or has surfaced before._')
  }
  lines.push('')
  lines.push('_Generated by vendor-radar.yml (daily, keyless). Full machine-readable report: `reports/vendor-radar/' + report.date + '.json`._')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Network (never exercised by tests)

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

interface SourceStat {
  kind: (typeof RADAR_SOURCE_KINDS)[number]
  queried: string
  items: number
  error: string | null
}

async function scanHn(now: Date): Promise<{ stat: SourceStat; raw: RawCandidate[] }> {
  const cutoff = Math.floor(now.getTime() / 1000) - HN_LOOKBACK_DAYS * 86_400
  const queries = [
    `${HN_API}?tags=show_hn&numericFilters=created_at_i>${cutoff},points>=${HN_FAST_MIN_POINTS}&hitsPerPage=100`,
    `${HN_API}?query=%22Launch%20HN%22&tags=story&numericFilters=created_at_i>${cutoff},points>=${HN_FAST_MIN_POINTS}&hitsPerPage=50`,
    `${HN_API}?tags=front_page&numericFilters=created_at_i>${cutoff}&hitsPerPage=50`,
  ]
  const stat: SourceStat = { kind: 'hn', queried: `Algolia search, last ${HN_LOOKBACK_DAYS}d (show_hn + "Launch HN" + front_page)`, items: 0, error: null }
  const raw: RawCandidate[] = []
  const seenIds = new Set<string>()
  for (const q of queries) {
    try {
      for (const item of hnItemsFromJson(JSON.parse(await fetchText(q)))) {
        if (seenIds.has(item.objectID)) continue
        seenIds.add(item.objectID)
        stat.items++
        const c = hnCandidate(item, now)
        if (c) raw.push(c)
      }
    } catch (err) {
      stat.error = stat.error ?? String(err)
    }
  }
  return { stat, raw }
}

async function scanProductHunt(): Promise<{ stat: SourceStat; raw: RawCandidate[] }> {
  const stat: SourceStat = { kind: 'producthunt', queried: 'frontpage Atom feed (single fetch)', items: 0, error: null }
  const raw: RawCandidate[] = []
  try {
    const entries = parsePhEntries(await fetchText(PH_FEED_URL, { Accept: 'application/atom+xml,application/xml' }))
    stat.items = entries.length
    for (const e of entries) raw.push(phCandidate(e))
  } catch (err) {
    stat.error = String(err)
  }
  return { stat, raw }
}

async function scanGithub(now: Date): Promise<{ stat: SourceStat; raw: RawCandidate[] }> {
  const since = new Date(now.getTime() - GITHUB_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
  const q = `${GITHUB_SEARCH_API}?q=${encodeURIComponent(`created:>=${since} stars:>=${GITHUB_MIN_STARS}`)}&sort=stars&order=desc&per_page=50`
  const stat: SourceStat = {
    kind: 'github',
    queried: `search API, repos created >=${since} with >=${GITHUB_MIN_STARS} stars (one request, keyless limit respected)`,
    items: 0,
    error: null,
  }
  const raw: RawCandidate[] = []
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`
    for (const repo of ghReposFromJson(JSON.parse(await fetchText(q, headers)))) {
      stat.items++
      const c = ghCandidate(repo, now)
      if (c) raw.push(c)
    }
  } catch (err) {
    stat.error = String(err)
  }
  return { stat, raw }
}

async function scanYcLaunches(now: Date): Promise<{ stat: SourceStat; raw: RawCandidate[] }> {
  const stat: SourceStat = {
    kind: 'yc-launches',
    queried: `ycombinator.com/launches.json, last ${YC_LOOKBACK_DAYS}d (keyless JSON feed, up to ${YC_LAUNCHES_MAX_PAGES} pages)`,
    items: 0,
    error: null,
  }
  const raw: RawCandidate[] = []
  const cutoff = now.getTime() - YC_LOOKBACK_DAYS * 86_400_000
  for (let page = 0; page < YC_LAUNCHES_MAX_PAGES; page++) {
    try {
      const launches = ycLaunchesFromJson(JSON.parse(await fetchText(`${YC_LAUNCHES_URL}?page=${page}`, { Accept: 'application/json' })))
      if (launches.length === 0) break
      stat.items += launches.length
      for (const l of launches) {
        const c = ycCandidate(l, now)
        if (c) raw.push(c)
      }
      // The feed is newest-first: once a page's oldest launch is out of window, stop paging.
      const oldest = Math.min(...launches.map((l) => Date.parse(l.createdAt)))
      if (oldest < cutoff) break
    } catch (err) {
      stat.error = stat.error ?? String(err)
      break
    }
  }
  return { stat, raw }
}

// ---------------------------------------------------------------------------------------------
// Dedupe context loading + ledger IO

// null ONLY when the ledger file does not exist yet (a legitimate first run). A ledger that
// exists but fails to read/parse/validate THROWS and fails the whole run: silently treating a
// corrupt ledger as empty would rewrite it with just this run's candidates, wiping the entire
// seen-history and re-nominating everything ever reported.
export function loadSeenLedger(file: string = SEEN_LEDGER_FILE): SeenLedger | null {
  if (!fs.existsSync(file)) return null
  try {
    return SeenLedgerSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch (err) {
    throw new Error(`vendor-radar: seen-ledger at ${file} exists but does not parse/validate — refusing to run (a rewrite would wipe the seen-history). Fix the file first. Cause: ${String(err)}`)
  }
}

// Union of seen-entries across ledgers: one entry per key, earliest firstSeen wins (the honest
// first-report date), source lists merged. Folds in ledger updates stranded on not-yet-merged
// vendor-radar/* branches (--merge-seen) so a run never re-nominates a candidate just because
// an earlier run's PR is still open, and the next merged PR carries the stranded keys to main.
export function mergeSeenEntries(lists: SeenEntry[][]): SeenEntry[] {
  const byKey = new Map<string, SeenEntry>()
  for (const list of lists) {
    for (const e of list) {
      const prior = byKey.get(e.key)
      if (!prior) {
        byKey.set(e.key, { ...e, sources: [...e.sources] })
        continue
      }
      if (e.firstSeen < prior.firstSeen) {
        prior.firstSeen = e.firstSeen
        prior.name = e.name
      }
      for (const s of e.sources) if (!prior.sources.includes(s)) prior.sources.push(s)
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function loadDedupeContext(extraSeen: SeenEntry[][]): DedupeContext {
  const trackedDomains = new Set<string>()
  const trackedNames = new Set<string>()
  const trackedRepos = new Set<string>()
  for (const cat of readCategories()) {
    const file = path.join(DATA_DIR, cat.id, 'products.json')
    if (!fs.existsSync(file)) continue
    for (const p of ProductSchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8')))) {
      const d = normalizeDomain(p.urls?.site)
      if (d) trackedDomains.add(d)
      const repoKey = githubRepoKey(p.urls?.github)
      if (repoKey) trackedRepos.add(repoKey)
      trackedNames.add(normalizeName(p.name))
      trackedNames.add(normalizeName(p.id))
    }
  }
  // The vendor registry: open-rankings/reviews/generated/<arena>--<product>.json — product ids again,
  // belt-and-braces in case a registry record outlives a roster edit.
  if (fs.existsSync(REVIEWS_DIR)) {
    for (const f of fs.readdirSync(REVIEWS_DIR)) {
      const product = f.replace(/\.json$/, '').split('--')[1]
      if (product) trackedNames.add(normalizeName(product))
    }
  }
  const seenKeys = new Set(
    [...(loadSeenLedger()?.seen ?? []), ...extraSeen.flat()].map((s) => s.key),
  )
  return { trackedDomains, trackedNames, trackedRepos, seenKeys }
}

// ---------------------------------------------------------------------------------------------
// Run

export async function run(argv: string[]): Promise<RadarReport> {
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const argAll = (flag: string): string[] =>
    argv.flatMap((a, i) => (a === flag && argv[i + 1] !== undefined ? [argv[i + 1]] : []))
  const dryRun = argv.includes('--dry-run')
  const issueBodyPath = arg('--issue-body')
  // Ledgers from not-yet-merged vendor-radar/* branches (the workflow extracts them before the
  // scan): their keys join the dedupe set and the written ledger, so stranded seen-history
  // reaches main with the next merged PR instead of being lost.
  const extraSeen = argAll('--merge-seen').map((f) => {
    const l = loadSeenLedger(f)
    if (!l) throw new Error(`vendor-radar: --merge-seen ${f}: no ledger file there`)
    return l.seen
  })
  const now = new Date()
  const date = now.toISOString().slice(0, 10)

  const sections = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'arena-sections.json'), 'utf8')) as {
    sections: { id: string; name: string; arenaIds: string[] }[]
  }
  const sectionNameByArena = new Map<string, string>()
  for (const s of sections.sections) for (const a of s.arenaIds) sectionNameByArena.set(a, s.name)
  const vocab = buildArenaVocab(readCategories(), sectionNameByArena)
  const ctx = loadDedupeContext(extraSeen)

  const [hn, ph, gh, yc] = [await scanHn(now), await scanProductHunt(), await scanGithub(now), await scanYcLaunches(now)]
  const raw = [...hn.raw, ...ph.raw, ...gh.raw, ...yc.raw]
  const { candidates: all, skippedTracked, skippedSeen } = assembleCandidates(raw, vocab, ctx, date)
  const overflow = Math.max(0, all.length - MAX_REPORT_CANDIDATES)
  const candidates = all.slice(0, MAX_REPORT_CANDIDATES)

  const report: RadarReport = {
    _comment:
      'Generated by rankings-engine/scripts/vendor-radar.ts — new-vendor candidates from public launch surfaces (HN Algolia, Product Hunt frontpage feed, GitHub repo search, YC Launches JSON feed), lexically matched to the arena taxonomy. The radar never creates a new ranking and never touches a founder-affiliated product autonomously. Candidates are triaged against the auto-approval criteria in policies/AGENT_POLICY.md (founder authorization 2026-10-13); the bring-up on auto-approved candidates is a scoped standard engine run landing as a reviewed PR (docs/VENDOR-RADAR.md). Evidence strings are verbatim-derived from each source’s own response.',
    generatedAt: now.toISOString(),
    date,
    thresholds: {
      HN_LOOKBACK_DAYS, HN_MIN_POINTS, HN_FAST_MIN_POINTS, HN_FAST_MIN_POINTS_PER_HOUR,
      GITHUB_LOOKBACK_DAYS, GITHUB_MIN_STARS, GITHUB_MIN_STARS_PER_DAY,
      YC_LOOKBACK_DAYS, YC_LAUNCHES_MAX_PAGES,
      MIN_ARENA_HITS, MAX_MATCHED_ARENAS, MAX_REPORT_CANDIDATES,
    },
    sources: [hn.stat, ph.stat, gh.stat, yc.stat],
    skipped: { tracked: skippedTracked, alreadySeen: skippedSeen, overflow },
    candidates,
  }
  const markdown = buildMarkdown(report)

  console.log(
    `vendor-radar: ${raw.length} hot launch items (hn ${hn.stat.items}, ph ${ph.stat.items}, gh ${gh.stat.items}, yc ${yc.stat.items}) → ` +
      `${candidates.length} new candidates (${skippedTracked} tracked, ${skippedSeen} already seen${overflow > 0 ? `, ${overflow} overflow` : ''})`,
  )
  for (const s of report.sources) if (s.error) console.log(`vendor-radar: ${s.kind} degraded — ${s.error}`)
  for (const c of candidates) console.log(`  ${c.name} → ${c.matchedArenas.map((m) => m.arena).join(', ')} [${c.sources.map((s) => s.kind).join('+')}]`)

  if (dryRun) {
    console.log('vendor-radar: --dry-run, nothing written')
    return report
  }

  writeJson(path.join(REPORTS_DIR, `${date}.json`), RadarReportSchema.parse(report))
  fs.writeFileSync(path.join(REPORTS_DIR, `${date}.md`), markdown + '\n')

  const prior = loadSeenLedger()
  const ledger: SeenLedger = {
    _comment:
      'Seen-ledger for rankings-engine/scripts/vendor-radar.ts: every candidate the radar has ever reported, keyed by product domain (or github:owner/repo / normalized name). A key listed here never surfaces again — firstSeen is the honest date of the run that first reported it.',
    updatedAt: now.toISOString(),
    seen: mergeSeenEntries([
      prior?.seen ?? [],
      ...extraSeen,
      candidates.map((c) => ({ key: c.key, name: c.name, firstSeen: c.firstSeen, sources: c.sources.map((s) => s.url) })),
    ]),
  }
  writeJson(SEEN_LEDGER_FILE, SeenLedgerSchema.parse(ledger))
  console.log(`vendor-radar: wrote reports/vendor-radar/${date}.{json,md} + seen-ledger (${ledger.seen.length} entries)`)

  if (issueBodyPath && candidates.length > 0) {
    fs.mkdirSync(path.dirname(issueBodyPath), { recursive: true })
    fs.writeFileSync(issueBodyPath, markdown + '\n')
    console.log(`vendor-radar: wrote issue body to ${issueBodyPath}`)
  } else if (issueBodyPath) {
    console.log('vendor-radar: no new candidates — no issue body written (no issue will be filed)')
  }
  return report
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
