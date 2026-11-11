// Roster pick + mechanical discovery for the scheduled api-quality gap-repair workflow
// (.github/workflows/api-gap-repair.yml) — the CI counterpart of the dated local repair
// waves (reports/evidence-parity/2026-11-0*-api-quality-wave*.json).
//
// Pick mode reads an OFFLINE staleness report (rankings-engine/scripts/staleness-scan.ts
// --offline, which already suppresses ledger-covered products via
// loadApiQualityRepairCoverage), keeps the rows still carrying the api-quality gap
// signature, and routes every row:
//
//   - exclusions file (rankings-engine/api-gap-exclusions.json): route 'skip' defers the
//     product; route 'needs-human' sends it to the run's needs-human issue.
//   - affiliated/disclosed products (products.json `affiliation`) always go to the
//     needs-human issue: their repairs land as their own disclosed, bias-audited PR.
//   - everything else is picked worst-stale-first, up to --top.
//
// For each picked product it then discovers MECHANICAL evidence candidates only: a
// machine-readable API description (OpenAPI/Swagger) found either through the docs/site
// llms.txt spec listing (relative links resolved — a relative-link llms.txt defeated an
// earlier discovery pass) or at the well-known spec paths the probe stage also tries.
// Candidates land in a wave manifest with literal body-slice markers; nothing is appended
// here. The committed harness (rankings-engine/scripts/api-gap-verify.py) re-fetches and
// verifies every candidate fail-closed before any append, and withholds what it cannot
// verify. Stories with no mechanically discoverable surface (interactive docs, sandbox,
// versioning policy, and machine-spec when nothing was found) are recorded as withheld
// `needs-research` rows: they stay OUT of the ledger's `cells`, so the staleness signature
// keeps flagging them until a research wave (local coordinator template) covers them.
//
// Moves mode re-reads verdicts + rankings after judge/derive and emits the PR body's
// moves table against the `before` snapshot captured at pick time.
//
//   pnpm exec tsx rankings-engine/scripts/api-gap-pick.ts \
//     --report <staleness-report.json> --exclusions rankings-engine/api-gap-exclusions.json \
//     --manifest <out.json> [--top 12] [--roster "arena/product,arena/product"] \
//     [--needs-human <out.md>] [--offline]
//   pnpm exec tsx rankings-engine/scripts/api-gap-pick.ts --moves --manifest <file> --out <out.md>
//
// --offline skips the discovery fetches (every picked story becomes a needs-research row);
// --roster overrides the scan pick but never bypasses the exclusion/affiliation routing.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { isSharedCodeHostOrigin } from '../stages/probe'
import { ProductSchema, StorySchema, VerdictSchema, EvidenceSchema, type Evidence, type Product } from '../../lib/schemas'
import { recordsAbsence } from './staleness-scan'
import { DATA_DIR, readJson } from '../paths'

const TIMEOUT_MS = 8_000
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-api-gap/1.0; +https://ultrametric.ai)'
// Bounded discovery: at most this many spec-candidate URLs fetched per product, and at
// most this many verified spec items proposed per product.
const CANDIDATE_FETCH_CAP = 10
const SPEC_ITEM_CAP = 2

// ---------------------------------------------------------------------------------------------
// Schemas for the inputs this script consumes

export const ExclusionEntrySchema = z.object({
  arena: z.string().min(1),
  product: z.string().min(1),
  route: z.enum(['skip', 'needs-human']),
  reason: z.string().min(10),
})
export type ExclusionEntry = z.infer<typeof ExclusionEntrySchema>
export const ExclusionsFileSchema = z.object({ exclusions: ExclusionEntrySchema.array() })

// The slice of the staleness report this script needs (full shape in staleness-scan.ts).
const ReportSchema = z.object({
  generatedAt: z.string(),
  products: z.array(z.object({
    arena: z.string(),
    productId: z.string(),
    staleness: z.number(),
    signals: z.object({ apiQualityGap: z.boolean() }).passthrough(),
  }).passthrough()),
}).passthrough()

// ---------------------------------------------------------------------------------------------
// Routing (pure, tested)

export interface Candidate { arena: string; product: string; staleness: number | null }
export interface RoutedRow extends Candidate { reason: string }
export interface RoutedPick { picked: Candidate[]; deferred: RoutedRow[]; needsHuman: RoutedRow[] }

export function routeCandidates(
  candidates: Candidate[],
  exclusions: ExclusionEntry[],
  affiliationOf: (arena: string, product: string) => string | undefined,
  top: number,
): RoutedPick {
  const picked: Candidate[] = []
  const deferred: RoutedRow[] = []
  const needsHuman: RoutedRow[] = []
  for (const c of candidates) {
    const excluded = exclusions.find((e) => e.arena === c.arena && e.product === c.product)
    if (excluded?.route === 'skip') {
      deferred.push({ ...c, reason: excluded.reason })
      continue
    }
    if (excluded?.route === 'needs-human') {
      needsHuman.push({ ...c, reason: excluded.reason })
      continue
    }
    const affiliation = affiliationOf(c.arena, c.product)
    if (affiliation !== undefined) {
      needsHuman.push({
        ...c,
        reason: 'Affiliated/disclosed product (products.json `affiliation`): repairs land as their own disclosed, bias-audited PR after human review, never through the autonomous workflow.',
      })
      continue
    }
    if (picked.length < top) picked.push(c)
  }
  return { picked, deferred, needsHuman }
}

export function parseRoster(roster: string): Array<{ arena: string; product: string }> {
  return roster.split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [arena, product, ...rest] = pair.split('/')
    if (!arena || !product || rest.length > 0) throw new Error(`roster entry must be arena/product: ${pair}`)
    return { arena, product }
  })
}

// The roster narrows the scan pick; it never widens eligibility. An entry without a gap
// row fails the run (loudly, so a typo cannot silently shrink a dispatched wave) instead
// of spending discovery, judging, and a PR on an already-repaired product.
export function resolveRosterCandidates(
  pairs: Array<{ arena: string; product: string }>,
  gapRows: Array<{ arena: string; productId: string; staleness: number }>,
  isKnown: (arena: string, product: string) => boolean,
): Candidate[] {
  return pairs.map(({ arena, product }) => {
    if (!isKnown(arena, product)) throw new Error(`roster entry not found in ${arena}/products.json: ${product}`)
    const row = gapRows.find((r) => r.arena === arena && r.productId === product)
    if (!row) throw new Error(`roster entry ${arena}/${product} does not carry the api-quality gap signature; the workflow only repairs gap rows`)
    return { arena, product, staleness: row.staleness }
  })
}

// ---------------------------------------------------------------------------------------------
// Spec discovery (pure parts exported for tests; fetching is injectable)

export interface DiscoveryFetchResult { status: number; text: string; contentType: string | null }
export type DiscoveryFetcher = (url: string) => Promise<DiscoveryFetchResult | null>

export const WELL_KNOWN_SPEC_PATHS = ['/openapi.json', '/openapi.yaml', '/swagger.json', '/api/openapi.json', '/.well-known/openapi.json']

// Spec-candidate URLs out of an llms.txt body: markdown links and bare URLs whose path
// looks like an API description document. Relative links resolve against the llms.txt
// URL — a relative-link llms.txt defeated an earlier absolute-only discovery pass.
export function extractSpecUrls(llmsText: string, llmsUrl: string, cap: number = CANDIDATE_FETCH_CAP): string[] {
  const hrefs: string[] = []
  for (const m of llmsText.matchAll(/\]\(([^)\s]+)\)/g)) hrefs.push(m[1])
  for (const m of llmsText.matchAll(/(?<![(\]])\bhttps?:\/\/[^\s)\]"']+/g)) hrefs.push(m[0])
  for (const m of llmsText.matchAll(/^(?:[-*]\s+)?(\/[^\s)\]"']+\.(?:json|ya?ml))\s*$/gim)) hrefs.push(m[1])
  const out: string[] = []
  for (const href of hrefs) {
    let resolved: URL
    try {
      resolved = new URL(href, llmsUrl)
    } catch {
      continue
    }
    if (resolved.protocol !== 'https:') continue
    if (!/\.(json|ya?ml)$/i.test(resolved.pathname)) continue
    if (!/openapi|swagger/i.test(resolved.pathname)) continue
    const url = resolved.toString()
    if (!out.includes(url)) out.push(url)
    if (out.length >= cap) break
  }
  return out
}

export interface SpecSignature {
  /** Literal body slices the verify harness re-checks fail-closed. */
  markers: string[]
  /** Human-readable fragment for the evidence excerpt, built from the same slices. */
  descriptor: string
}

// Recognizes an OpenAPI/Swagger document and returns literal slices of ITS OWN body as the
// verification markers, so the fail-closed re-check can never pass on a rotated or
// soft-200 page. Returns null for anything that is not plainly a spec DOCUMENT: an HTML
// shell, a JSON page that merely mentions the format, or a markdown/prose page carrying an
// `openapi:` example must not become machine-spec evidence.
export function specSignature(body: string): SpecSignature | null {
  const trimmed = body.trimStart()
  if (trimmed.startsWith('<')) return null
  const jsonVersion = body.match(/"(openapi|swagger)"\s*:\s*"[^"\n]*"/)
  if (jsonVersion) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      if (typeof parsed !== 'object' || parsed === null || !('openapi' in parsed || 'swagger' in parsed)) return null
      // Spec structure, not just the version key: OpenAPI/Swagger documents carry an
      // info object and an operation surface.
      if (!('info' in parsed)) return null
      if (!('paths' in parsed || 'webhooks' in parsed || 'components' in parsed)) return null
    } catch {
      return null
    }
    const title = body.match(/"title"\s*:\s*"[^"\n]*"/)
    const markers = [jsonVersion[0], ...(title ? [title[0]] : [])]
    return { markers, descriptor: markers.join(', ') }
  }
  // YAML branch: a column-0 fenced code block means a prose page QUOTING a spec, not a
  // spec — real YAML documents can only carry fences INDENTED inside block scalars
  // (`description: |` with markdown examples), so indented fences stay allowed. A real
  // document also carries the version key plus the info and operation sections at the
  // top level (column 0), which prose and markdown pages do not.
  if (/^```/m.test(body)) return null
  const yamlVersion = body.match(/^(openapi|swagger):[^\n]*/m)
  if (!yamlVersion) return null
  if (!/^info:/m.test(body)) return null
  if (!/^(paths|webhooks|components|servers):/m.test(body)) return null
  const marker = yamlVersion[0].trimEnd()
  const title = body.match(/^\s*title:[^\n]*/m)
  const markers = [marker, ...(title ? [title[0].trim()] : [])]
  return { markers, descriptor: markers.join(', ') }
}

export interface ManifestItem {
  arena: string
  product: string
  storyId: string
  id: string
  tier: 'claimed-docs'
  url: string
  markers: string[]
  excerpt: string
  source: 'llms-txt' | 'well-known'
}

export function buildSpecItem(
  arena: string, product: string, url: string, sig: SpecSignature,
  source: ManifestItem['source'], date: string, seq: number,
): ManifestItem {
  const compact = date.replaceAll('-', '')
  const sourceLabel = source === 'llms-txt'
    ? "the product docs' llms.txt spec listing"
    : 'a well-known spec path on the documented origin'
  return {
    arena,
    product,
    storyId: 'api-machine-spec',
    id: `${product}-apigap-machine-spec-${compact}${seq > 1 ? `-${seq}` : ''}`,
    tier: 'claimed-docs',
    url,
    markers: sig.markers,
    excerpt: `Published machine-readable API description at ${url}: ${sig.descriptor}. Discovered mechanically (${sourceLabel}) by the scheduled api-gap-repair workflow; markers re-verified live, fail-closed, at append time.`,
    source,
  }
}

const isTextPlainish = (contentType: string | null): boolean => {
  const ct = (contentType ?? '').toLowerCase()
  return ct.includes('text/plain') || ct.includes('text/markdown') || (ct.startsWith('text/') && !ct.includes('html'))
}

const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export interface WithheldRow {
  arena: string
  product: string
  storyId: string
  disposition: 'needs-research'
  reason: string
}

// URLs already carrying POSITIVE evidence in the pack: these are skipped during
// discovery (nothing to add). Rows that RECORD absence (negative openapi probes, stale
// curated links) are deliberately excluded from the set: a URL that 404ed when the probe
// ran can start serving a real spec later, and the recorded negative must not block the
// re-check that detects it.
export function positiveEvidenceUrls(evidence: Evidence[]): Set<string> {
  return new Set(evidence.filter((e) => !recordsAbsence(e)).map((e) => e.url))
}

export async function discoverProduct(
  arena: string,
  product: Product,
  apiStoryIds: string[],
  existingEvidenceUrls: ReadonlySet<string>,
  fetcher: DiscoveryFetcher,
  date: string,
): Promise<{ items: ManifestItem[]; withheld: WithheldRow[] }> {
  const origins: string[] = []
  for (const base of [product.urls.docs, product.urls.site]) {
    if (!base) continue
    const origin = originOf(base)
    if (origin && !isSharedCodeHostOrigin(origin) && !origins.includes(origin)) origins.push(origin)
  }

  // Candidate URLs, llms.txt listings first (vendor-advertised beats convention-guessed).
  const candidates: Array<{ url: string; source: ManifestItem['source'] }> = []
  const push = (url: string, source: ManifestItem['source']): void => {
    if (!candidates.some((c) => c.url === url)) candidates.push({ url, source })
  }
  for (const origin of origins) {
    const llms = await fetcher(`${origin}/llms.txt`)
    if (llms && llms.status === 200 && isTextPlainish(llms.contentType)) {
      for (const url of extractSpecUrls(llms.text, `${origin}/llms.txt`)) push(url, 'llms-txt')
    }
  }
  for (const origin of origins) {
    for (const p of WELL_KNOWN_SPEC_PATHS) push(`${origin}${p}`, 'well-known')
  }

  const items: ManifestItem[] = []
  let fetched = 0
  for (const candidate of candidates) {
    if (items.length >= SPEC_ITEM_CAP || fetched >= CANDIDATE_FETCH_CAP) break
    if (existingEvidenceUrls.has(candidate.url)) continue // already in the pack — nothing to add
    fetched++
    const res = await fetcher(candidate.url)
    if (!res || res.status !== 200) continue
    const sig = specSignature(res.text)
    if (!sig) continue
    items.push(buildSpecItem(arena, product.id, candidate.url, sig, candidate.source, date, items.length + 1))
  }

  // Everything the mechanical pass cannot establish stays withheld, never guessed: these
  // rows are excluded from the ledger's `cells`, so the gap signature keeps flagging the
  // product until a research wave covers it.
  const coveredStories = new Set(items.map((i) => i.storyId))
  const withheld: WithheldRow[] = apiStoryIds
    .filter((storyId) => !coveredStories.has(storyId))
    .map((storyId) => ({
      arena,
      product: product.id,
      storyId,
      disposition: 'needs-research',
      reason: 'No mechanically verifiable surface for this story; needs a coordinator research wave (the local dated-wave template).',
    }))
  return { items, withheld }
}

// ---------------------------------------------------------------------------------------------
// Before/after snapshots and the moves table (pure, tested)

export interface StorySnapshot { [storyId: string]: string }
export interface ProductSnapshot { score: number | null; apiQuality: number | null; stories: StorySnapshot }

export function snapshotProduct(
  verdicts: Array<{ productId: string; storyId: string; verdict: string; quality: number }>,
  leaderboard: Array<{ productId: string; score: number; apiQuality?: number }>,
  productId: string,
  apiStoryIds: string[],
): ProductSnapshot {
  const stories: StorySnapshot = {}
  for (const storyId of apiStoryIds) {
    const v = verdicts.find((x) => x.productId === productId && x.storyId === storyId)
    stories[storyId] = v ? (v.verdict === 'none' ? 'none' : `${v.verdict} q${v.quality}`) : 'absent'
  }
  const row = leaderboard.find((x) => x.productId === productId)
  return { score: row?.score ?? null, apiQuality: row?.apiQuality ?? null, stories }
}

const CANONICAL_API_STORIES = ['api-machine-spec', 'api-interactive-docs', 'api-sandbox', 'api-versioning-policy']

export function buildMovesTable(
  rows: Array<{ arena: string; product: string; before: ProductSnapshot; after: ProductSnapshot }>,
): string {
  const move = (a: string | number | null, b: string | number | null): string => {
    const fmt = (v: string | number | null): string => (v === null ? '—' : String(v))
    return fmt(a) === fmt(b) ? fmt(a) : `${fmt(a)} → ${fmt(b)}`
  }
  const lines = [
    '| product | arena | machine-spec | interactive-docs | sandbox | versioning-policy | score |',
    '|---|---|---|---|---|---|---|',
  ]
  for (const r of rows) {
    const cells = CANONICAL_API_STORIES.map((s) => move(r.before.stories[s] ?? 'absent', r.after.stories[s] ?? 'absent'))
    lines.push(`| ${r.product} | ${r.arena} | ${cells.join(' | ')} | ${move(r.before.score, r.after.score)} |`)
  }
  return lines.join('\n')
}

export function buildNeedsHumanBody(
  needsHuman: RoutedRow[], deferred: RoutedRow[], date: string,
): string {
  const lines: string[] = []
  lines.push(`## api-gap-repair: rows routed to a human — ${date}`)
  lines.push('')
  lines.push('These products carry the api-quality gap signature but are outside the autonomous workflow: affiliated/disclosed products need disclosure review and a bias audit, and excluded rows carry a standing reason. A coordinator agent repairs them through the dated local wave template (`reports/evidence-parity/`), never this workflow.')
  lines.push('')
  lines.push('| product | arena | reason |')
  lines.push('|---------|-------|--------|')
  for (const r of needsHuman) lines.push(`| ${r.product} | ${r.arena} | ${r.reason} |`)
  if (deferred.length > 0) {
    lines.push('')
    lines.push('Deferred this run (no action needed yet):')
    lines.push('')
    for (const r of deferred) lines.push(`- **${r.arena}/${r.product}** — ${r.reason}`)
  }
  lines.push('')
  lines.push('_Generated by api-gap-repair.yml. Close after the listed rows have been repaired or ruled on._')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Manifest shape (consumed by rankings-engine/scripts/api-gap-verify.py)

export interface WaveManifest {
  wave: string
  date: string
  scan: string
  picked: Array<Candidate & { before: ProductSnapshot }>
  deferred: RoutedRow[]
  needsHuman: RoutedRow[]
  items: ManifestItem[]
  withheld: WithheldRow[]
  // Fail-closed check families the generic harness replays (empty for mechanical CI
  // manifests; the dated local wave scripts populate them for research-grade rows).
  negativeChecks: Record<string, Array<string | [string, number[]]>>
  postChecks: Record<string, { url: string; payload: string; expectedStatus: number; markers: string[] }>
  tlsMismatchChecks: Record<string, { host: string; url: string; recordedWrongName: string }>
  hostDelays: Record<string, number>
}

// ---------------------------------------------------------------------------------------------
// CLI

interface CliArgs {
  moves: boolean
  offline: boolean
  report?: string
  exclusions?: string
  manifest?: string
  needsHuman?: string
  out?: string
  roster?: string
  top: number
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { moves: false, offline: false, top: 12 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--moves') args.moves = true
    else if (argv[i] === '--offline') args.offline = true
    else if (argv[i] === '--report') args.report = argv[++i]
    else if (argv[i] === '--exclusions') args.exclusions = argv[++i]
    else if (argv[i] === '--manifest') args.manifest = argv[++i]
    else if (argv[i] === '--needs-human') args.needsHuman = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
    else if (argv[i] === '--roster') args.roster = argv[++i]
    else if (argv[i] === '--top') args.top = Number(argv[++i])
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  if (!Number.isInteger(args.top) || args.top <= 0) throw new Error(`--top must be a positive integer, got: ${args.top}`)
  return args
}

function apiStoryIdsFor(arena: string): string[] {
  const stories = readJson(StorySchema.array(), path.join(DATA_DIR, arena, 'stories.json'))
  return stories.filter((s) => s.group === 'api-quality').map((s) => s.id)
}

function loadArena(arena: string): { products: Product[] } {
  return { products: readJson(ProductSchema.array(), path.join(DATA_DIR, arena, 'products.json')) }
}

const LeaderboardSchema = z.object({
  leaderboard: z.array(z.object({ productId: z.string(), score: z.number(), apiQuality: z.number().optional() }).passthrough()),
}).passthrough()

function snapshotFor(arena: string, productId: string): ProductSnapshot {
  const verdicts = readJson(VerdictSchema.array(), path.join(DATA_DIR, arena, 'verdicts.json'))
  const rankings = readJson(LeaderboardSchema, path.join(DATA_DIR, arena, 'rankings.json'))
  return snapshotProduct(verdicts, rankings.leaderboard, productId, apiStoryIdsFor(arena))
}

async function defaultFetcher(url: string): Promise<DiscoveryFetchResult | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const text = (await res.text()).slice(0, 2_000_000)
    return { status: res.status, text, contentType: res.headers.get('content-type') }
  } catch {
    return null
  }
}

async function runPick(args: CliArgs): Promise<void> {
  if (!args.report || !args.exclusions || !args.manifest) {
    throw new Error('pick mode needs --report, --exclusions, and --manifest')
  }
  const date = new Date().toISOString().slice(0, 10)
  const exclusions = ExclusionsFileSchema.parse(JSON.parse(fs.readFileSync(args.exclusions, 'utf8'))).exclusions
  const report = ReportSchema.parse(JSON.parse(fs.readFileSync(args.report, 'utf8')))
  const gapRows = report.products.filter((p) => p.signals.apiQualityGap)

  let candidates: Candidate[]
  if (args.roster) {
    candidates = resolveRosterCandidates(
      parseRoster(args.roster),
      gapRows.map((r) => ({ arena: r.arena, productId: r.productId, staleness: r.staleness })),
      (arena, product) => loadArena(arena).products.some((p) => p.id === product),
    )
  } else {
    candidates = gapRows.map((r) => ({ arena: r.arena, product: r.productId, staleness: r.staleness }))
  }

  const affiliationCache = new Map<string, Map<string, string | undefined>>()
  const affiliationOf = (arena: string, product: string): string | undefined => {
    let byId = affiliationCache.get(arena)
    if (!byId) {
      byId = new Map(loadArena(arena).products.map((p) => [p.id, p.affiliation]))
      affiliationCache.set(arena, byId)
    }
    return byId.get(product)
  }

  const routed = routeCandidates(candidates, exclusions, affiliationOf, args.top)
  console.log(`api-gap-pick: ${gapRows.length} gap rows → ${routed.picked.length} picked, ${routed.needsHuman.length} needs-human, ${routed.deferred.length} deferred`)

  const items: ManifestItem[] = []
  const withheld: WithheldRow[] = []
  const picked: WaveManifest['picked'] = []
  for (const c of routed.picked) {
    const product = loadArena(c.arena).products.find((p) => p.id === c.product)
    if (!product) throw new Error(`picked product missing from ${c.arena}/products.json: ${c.product}`)
    const storyIds = apiStoryIdsFor(c.arena)
    const evidenceFile = path.join(DATA_DIR, c.arena, 'evidence', `${c.product}.json`)
    const existingUrls = positiveEvidenceUrls(
      fs.existsSync(evidenceFile) ? readJson(EvidenceSchema.array(), evidenceFile) : [],
    )
    if (args.offline) {
      withheld.push(...storyIds.map((storyId): WithheldRow => ({
        arena: c.arena,
        product: c.product,
        storyId,
        disposition: 'needs-research',
        reason: 'Discovery ran offline; nothing was checked live.',
      })))
    } else {
      const found = await discoverProduct(c.arena, product, storyIds, existingUrls, defaultFetcher, date)
      items.push(...found.items)
      withheld.push(...found.withheld)
      console.log(`api-gap-pick: ${c.arena}/${c.product} — ${found.items.length} spec candidates, ${found.withheld.length} withheld stories`)
    }
    picked.push({ ...c, before: snapshotFor(c.arena, c.product) })
  }

  const manifest: WaveManifest = {
    wave: `api-gap-repair ci wave ${date}`,
    date,
    scan: `offline staleness scan ${report.generatedAt}: ${gapRows.length} gap rows after ledger suppression`,
    picked,
    deferred: routed.deferred,
    needsHuman: routed.needsHuman,
    items,
    withheld,
    negativeChecks: {},
    postChecks: {},
    tlsMismatchChecks: {},
    hostDelays: {},
  }
  fs.mkdirSync(path.dirname(args.manifest), { recursive: true })
  fs.writeFileSync(args.manifest, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`api-gap-pick: wrote ${args.manifest} (${items.length} candidate items)`)

  // Written only when a row was routed to a human, so the workflow files an issue iff the
  // file exists (the vendor-radar/accuracy-engine convention).
  if (args.needsHuman && routed.needsHuman.length > 0) {
    fs.mkdirSync(path.dirname(args.needsHuman), { recursive: true })
    fs.writeFileSync(args.needsHuman, buildNeedsHumanBody(routed.needsHuman, routed.deferred, date) + '\n')
    console.log(`api-gap-pick: wrote needs-human body to ${args.needsHuman} (${routed.needsHuman.length} rows)`)
  }
}

function runMoves(args: CliArgs): void {
  if (!args.manifest || !args.out) throw new Error('moves mode needs --manifest and --out')
  const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8')) as WaveManifest
  const rows = manifest.picked.map((p) => ({
    arena: p.arena,
    product: p.product,
    before: p.before,
    after: snapshotFor(p.arena, p.product),
  }))
  fs.mkdirSync(path.dirname(args.out), { recursive: true })
  fs.writeFileSync(args.out, buildMovesTable(rows) + '\n')
  console.log(`api-gap-pick: wrote moves table to ${args.out}`)
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2))
  void (args.moves ? Promise.resolve(runMoves(args)) : runPick(args)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
