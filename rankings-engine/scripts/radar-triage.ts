// Radar candidate triage (founder authorization 2026-10-13, policies/AGENT_POLICY.md
// "Vendor-radar candidate approval"): applies the four auto-approval criteria to vendor-radar
// candidates mechanically, where a criterion can be checked without an LLM:
//
//   1. existing-ranking fit    — the candidate's strongest lexical arena match (the same
//                                matchArenas classifier the radar nominates with) must reach
//                                MIN_FIT_HITS distinct keyword hits on an existing arena.
//                                Keyword hits place a product; they do not confirm it belongs
//                                (the 2026-10-13 bring-up filed ZCode, a coding agent, under
//                                agent-skills on the word "skill"). Until a better classifier
//                                exists, every auto-approved disposition carries the matched
//                                arena's open-rankings/categories.json definition in its evidence
//                                and the PLACEMENT_CAVEAT in its reason, so the bring-up PR
//                                asks the reviewer to confirm placement against the definition.
//   2. public docs surface     — a reachable docs site / API reference on the product's own
//                                domain, or a substantive README for an open-source product.
//   3. shipped product         — not a waitlist/coming-soon page; for OSS, not an archived
//                                repo, a link list, a course, or a placeholder.
//   4. no founder affiliation  — founder-affiliated products are never auto-approved; they are
//                                routed to a human (needs-human) for disclosure + bias audit.
//
// Every disposition carries its evidence: the URLs fetched, the HTTP statuses, and what the
// response showed. A fetch that fails is recorded as the failure it was, never guessed around.
// Candidates whose only public URL is a launch post (Product Hunt and other aggregator pages
// are bot-walled to CI) fail the docs-surface criterion with that stated reason — the normal
// outcome for launch-page-only candidates.
//
// The triage NEVER creates a ranking and NEVER auto-approves a founder-affiliated product;
// bring-up of an auto-approved candidate still runs the standard scoped pipeline and lands as
// a reviewed PR (docs/vendor-radar.md).
//
// Invocation:
//   pnpm tsx rankings-engine/scripts/radar-triage.ts --report reports/vendor-radar/<date>.json \
//     [--out <dispositions.json>] [--md <dispositions.md>]
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { readCategories } from '../paths'
import { RadarReportSchema, normalizeName, type RadarCandidate } from './vendor-radar'

// --- thresholds --------------------------------------------------------------------------------
export const MIN_FIT_HITS = 3 // "clearly fits": stronger than the radar's nomination floor (2)
export const OSS_README_MIN_BYTES = 1500 // a README below this cannot document a real product
// Star-velocity anomaly floor: a repo gaining stars faster than this sustained rate shows
// popularity the radar cannot verify keylessly (star inflation is a documented launch-surface
// pattern — the 2026-10 issue sweep found several). Anomalous repos route to needs-human, not
// auto-approval.
export const STARS_PER_DAY_ANOMALY = 500
export const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-radar-triage/1.0; +https://ultrametric.ai)'

// Founder-affiliated identifiers (house rules: affiliated products are disclosed and
// bias-audited, never auto-approved). Checked against candidate name and resolved domain.
export const AFFILIATED_PATTERNS = ['ultrametric', 'productarena']

// Launch-post hosts: a page about the launch, not the product. A candidate whose only URL is
// one of these has no product docs surface we can verify keylessly.
export const LAUNCH_POST_HOSTS = new Set(['producthunt.com', 'www.producthunt.com', 'news.ycombinator.com'])

// Lexical placement is a nomination signal, not a classification. The caveat rides on every
// auto-approved disposition (and through it, the bring-up PR body) until a definition-aware
// classifier replaces keyword hits.
export const PLACEMENT_CAVEAT = 'placement: keyword-matched, confirm against arena definition at review'

export const DispositionSchema = z.object({
  key: z.string(),
  name: z.string(),
  url: z.string(),
  arena: z.string().nullable(), // the arena a passer would be brought up into
  status: z.enum(['auto-approved', 'skipped', 'needs-human']),
  criterion: z.enum(['ranking-fit', 'docs-surface', 'shipped-product', 'founder-affiliation']).nullable(),
  reason: z.string(),
  evidence: z.array(z.string()), // URLs fetched + HTTP statuses + what the response showed
  // Roster-ready URLs for an auto-approved candidate (null otherwise): what a bring-up PR
  // writes into open-rankings/<arena>/products.json before the scoped pipeline runs.
  bringup: z
    .object({
      site: z.string(),
      docs: z.string().optional(),
      github: z.string().optional(),
      type: z.enum(['oss', 'commercial']),
    })
    .nullable(),
})
export type Disposition = z.infer<typeof DispositionSchema>

export const TriageReportSchema = z.object({
  _comment: z.string().optional(),
  generatedAt: z.string(),
  policy: z.string(),
  dispositions: DispositionSchema.array(),
})
export type TriageReport = z.infer<typeof TriageReportSchema>

// --- pure criterion checks (unit-tested, no network) --------------------------------------------

export function isFounderAffiliated(name: string, url: string): boolean {
  const hay = `${normalizeName(name)} ${url.toLowerCase()}`
  return AFFILIATED_PATTERNS.some((p) => hay.includes(p))
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function githubRepoOf(candidate: Pick<RadarCandidate, 'url' | 'sources'>): string | null {
  const urls = [candidate.url, ...candidate.sources.map((s) => s.url)]
  for (const u of urls) {
    const m = u.match(/^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)/i)
    if (m) return m[1].replace(/\.git$/, '')
  }
  return null
}

// Arena fit: strongest lexical match must clear MIN_FIT_HITS on an arena that exists today.
// The radar never creates a ranking; an unmatched or weakly-matched candidate is skipped.
export function checkRankingFit(candidate: Pick<RadarCandidate, 'matchedArenas'>, existingArenas: Set<string>): { arena: string } | { fail: string } {
  const top = candidate.matchedArenas.find((m) => existingArenas.has(m.arena))
  if (!top) return { fail: 'no matched arena exists in open-rankings/' }
  if (top.hits < MIN_FIT_HITS) {
    return { fail: `strongest existing-arena match (${top.arena}) has ${top.hits} keyword hits, below the MIN_FIT_HITS=${MIN_FIT_HITS} auto-approval floor` }
  }
  return { arena: top.arena }
}

// README substance: link lists, courses, and placeholders are not shipped products however
// starred. Patterns are checked against the README head + repo description.
const LIST_OR_COURSE_RE = /\bawesome[ -]|curated list|a (curated )?collection of|tutorial|course for beginners|beginner course|cheat ?sheet|interview questions\b/i

export interface RepoFacts {
  archived: boolean
  fork: boolean
  description: string | null
  stars: number
  createdAt: string // ISO date the repo was created
  readmeBytes: number
  readmeHead: string // first ~2000 chars, for substance checks
}

export function starsPerDay(repo: Pick<RepoFacts, 'stars' | 'createdAt'>, now: Date): number {
  const days = Math.max(1, (now.getTime() - Date.parse(repo.createdAt)) / 86_400_000)
  return repo.stars / days
}

export function checkOssSubstance(name: string, repo: RepoFacts): { ok: true } | { fail: string; criterion: 'docs-surface' | 'shipped-product' } {
  if (repo.archived) return { fail: 'repository is archived', criterion: 'shipped-product' }
  if (repo.fork) return { fail: 'repository is a fork, not the product source', criterion: 'shipped-product' }
  const text = `${name} ${repo.description ?? ''} ${repo.readmeHead}`
  if (LIST_OR_COURSE_RE.test(text)) {
    return { fail: 'repository is a link collection / course, not a shipped product', criterion: 'shipped-product' }
  }
  if (repo.readmeBytes < OSS_README_MIN_BYTES) {
    return { fail: `README is ${repo.readmeBytes} bytes, below the ${OSS_README_MIN_BYTES}-byte substance floor`, criterion: 'docs-surface' }
  }
  return { ok: true }
}

// Waitlist detection: waitlist/coming-soon language with none of the shipped-product signals
// (docs, pricing, sign-in, install) anywhere on the page.
const WAITLIST_RE = /join (the )?waitlist|coming soon|be the first to know|request (early )?access|get early access/i
const SHIPPED_RE = /\b(docs|documentation|pricing|sign in|log ?in|get started|install|npm i|pip install|api reference)\b/i

export function isWaitlistOnly(html: string): boolean {
  return WAITLIST_RE.test(html) && !SHIPPED_RE.test(html)
}

// Docs-surface discovery on a product page: a link whose href names a docs/API-reference
// surface. Returns the first such href resolved against the page URL.
const DOCS_HREF_RE = /href="([^"]*(?:\/docs\b|\/documentation\b|\/developers?\b|\/api-reference\b|\/api\/docs\b|docs\.[a-z0-9.-]+|developer\.[a-z0-9.-]+|readthedocs|mintlify|gitbook)[^"]*)"/i

export function findDocsLink(html: string, baseUrl: string): string | null {
  const m = html.match(DOCS_HREF_RE)
  if (!m) return null
  try {
    return new URL(m[1], baseUrl).toString()
  } catch {
    return null
  }
}

// --- IO (injectable so tests stay offline) ------------------------------------------------------

export interface TriageIo {
  fetchPage: (url: string) => Promise<{ status: number; html: string }>
  fetchRepo: (fullName: string) => Promise<RepoFacts | { error: string }>
}

export function realTriageIo(): TriageIo {
  return {
    async fetchPage(url) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'follow',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        return { status: res.status, html: res.ok ? await res.text() : '' }
      } catch {
        return { status: 0, html: '' } // status 0 = network-level failure (timeout, DNS, TLS)
      }
    },
    async fetchRepo(fullName) {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT }
      if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`
      try {
        const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        if (!res.ok) return { error: `GitHub API HTTP ${res.status}` }
        const j = (await res.json()) as { archived?: boolean; fork?: boolean; description?: string | null; stargazers_count?: number; created_at?: string }
        const readmeRes = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
          headers: { ...headers, Accept: 'application/vnd.github.raw' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        const readme = readmeRes.ok ? await readmeRes.text() : ''
        return {
          archived: Boolean(j.archived),
          fork: Boolean(j.fork),
          description: j.description ?? null,
          stars: typeof j.stargazers_count === 'number' ? j.stargazers_count : 0,
          createdAt: typeof j.created_at === 'string' ? j.created_at : new Date(0).toISOString(),
          readmeBytes: Buffer.byteLength(readme),
          readmeHead: readme.slice(0, 2000),
        }
      } catch (err) {
        return { error: String(err) }
      }
    },
  }
}

// --- the triage itself --------------------------------------------------------------------------

export async function triageCandidate(candidate: RadarCandidate, existingArenas: Set<string>, io: TriageIo, arenaDefinitions?: Map<string, string>): Promise<Disposition> {
  const base = { key: candidate.key, name: candidate.name, url: candidate.url }
  const evidence: string[] = []

  // 4. founder affiliation first: an affiliated product is routed to a human whatever else holds.
  if (isFounderAffiliated(candidate.name, candidate.url)) {
    return { ...base, arena: null, status: 'needs-human', criterion: 'founder-affiliation', reason: 'founder-affiliated products require human review, disclosure, and a bias audit', evidence, bringup: null }
  }

  // 1. existing-ranking fit. The match is lexical; record the matched arena's definition next
  // to the keyword hits so the reviewer can check placement against what the arena actually is.
  const fit = checkRankingFit(candidate, existingArenas)
  if ('fail' in fit) {
    return { ...base, arena: null, status: 'skipped', criterion: 'ranking-fit', reason: fit.fail, evidence, bringup: null }
  }
  const hits = candidate.matchedArenas.find((m) => m.arena === fit.arena)
  const definition = arenaDefinitions?.get(fit.arena)
  if (definition) {
    evidence.push(`arena-definition ${fit.arena}: "${definition}" (lexical match: ${hits ? hits.keywords.join(', ') : 'n/a'})`)
  }

  // 2 + 3 for OSS: the repo is the product surface.
  const repoName = githubRepoOf(candidate)
  if (repoName) {
    const repo = await io.fetchRepo(repoName)
    if ('error' in repo) {
      return { ...base, arena: fit.arena, status: 'skipped', criterion: 'docs-surface', reason: `GitHub repo ${repoName} could not be verified (${repo.error})`, evidence, bringup: null }
    }
    evidence.push(`github:${repoName} — archived=${repo.archived} fork=${repo.fork} stars=${repo.stars} created=${repo.createdAt.slice(0, 10)} readme=${repo.readmeBytes}B`)
    const substance = checkOssSubstance(candidate.name, repo)
    if ('fail' in substance) {
      return { ...base, arena: fit.arena, status: 'skipped', criterion: substance.criterion, reason: substance.fail, evidence, bringup: null }
    }
    const velocity = starsPerDay(repo, new Date())
    if (velocity > STARS_PER_DAY_ANOMALY) {
      return {
        ...base,
        arena: fit.arena,
        status: 'needs-human',
        criterion: 'shipped-product',
        reason: `star velocity ~${Math.round(velocity)}/day exceeds the ${STARS_PER_DAY_ANOMALY}/day anomaly floor — popularity unverifiable keylessly, human review required`,
        evidence,
        bringup: null,
      }
    }
    const githubUrl = `https://github.com/${repoName}`
    return {
      ...base,
      arena: fit.arena,
      status: 'auto-approved',
      criterion: null,
      reason: `existing-arena fit (${fit.arena}), substantive README (${repo.readmeBytes}B), active repo; ${PLACEMENT_CAVEAT}`,
      evidence,
      bringup: { site: candidate.url, docs: githubUrl, github: githubUrl, type: 'oss' },
    }
  }

  // 2 + 3 for hosted products: the product's own site must answer and carry a docs surface.
  const host = hostOf(candidate.url)
  if (!host || LAUNCH_POST_HOSTS.has(host)) {
    return { ...base, arena: fit.arena, status: 'skipped', criterion: 'docs-surface', reason: 'only public URL is a launch post (no product site surfaced keylessly), so no docs surface can be verified', evidence, bringup: null }
  }
  const page = await io.fetchPage(candidate.url)
  evidence.push(`${candidate.url} — HTTP ${page.status}`)
  if (page.status !== 200) {
    return { ...base, arena: fit.arena, status: 'skipped', criterion: 'docs-surface', reason: page.status === 0 ? 'product site fetch failed (network error)' : `product site did not answer (HTTP ${page.status})`, evidence, bringup: null }
  }
  if (isWaitlistOnly(page.html)) {
    return { ...base, arena: fit.arena, status: 'skipped', criterion: 'shipped-product', reason: 'page is a waitlist/coming-soon surface with no shipped-product signals', evidence, bringup: null }
  }
  const docsLink = findDocsLink(page.html, candidate.url)
  if (!docsLink) {
    return { ...base, arena: fit.arena, status: 'skipped', criterion: 'docs-surface', reason: 'no docs site or API reference linked from the product page', evidence, bringup: null }
  }
  const docs = await io.fetchPage(docsLink)
  evidence.push(`${docsLink} — HTTP ${docs.status}`)
  if (docs.status !== 200) {
    return { ...base, arena: fit.arena, status: 'skipped', criterion: 'docs-surface', reason: `linked docs surface did not answer (HTTP ${docs.status})`, evidence, bringup: null }
  }
  return {
    ...base,
    arena: fit.arena,
    status: 'auto-approved',
    criterion: null,
    reason: `existing-arena fit (${fit.arena}), reachable docs surface, shipped product page; ${PLACEMENT_CAVEAT}`,
    evidence,
    bringup: { site: candidate.url, docs: docsLink, type: 'commercial' },
  }
}

export async function triageReport(report: { candidates: RadarCandidate[] }, existingArenas: Set<string>, io: TriageIo, arenaDefinitions?: Map<string, string>): Promise<TriageReport> {
  const dispositions: Disposition[] = []
  for (const c of report.candidates) dispositions.push(await triageCandidate(c, existingArenas, io, arenaDefinitions))
  return {
    _comment:
      'Generated by rankings-engine/scripts/radar-triage.ts — mechanical application of the auto-approval criteria in policies/AGENT_POLICY.md (founder authorization 2026-10-13). auto-approved: eligible for a scoped standard-engine-run bring-up PR. skipped: failed a criterion, with the evidence. needs-human: founder-affiliated or otherwise reserved for human review. The triage creates no rankings and changes nothing under open-rankings/.',
    generatedAt: new Date().toISOString(),
    policy: 'policies/AGENT_POLICY.md#vendor-radar-candidate-approval',
    dispositions,
  }
}

export function buildTriageMarkdown(report: TriageReport): string {
  const lines: string[] = []
  const counts = { 'auto-approved': 0, skipped: 0, 'needs-human': 0 } as Record<Disposition['status'], number>
  for (const d of report.dispositions) counts[d.status]++
  lines.push(`### Triage dispositions (criteria: \`${report.policy}\`)`)
  lines.push('')
  lines.push(`${counts['auto-approved']} auto-approved · ${counts.skipped} skipped · ${counts['needs-human']} needs-human`)
  lines.push('')
  lines.push('| candidate | status | criterion | reason |')
  lines.push('| --- | --- | --- | --- |')
  for (const d of report.dispositions) {
    lines.push(`| [${d.name}](${d.url})${d.arena ? ` → \`${d.arena}\`` : ''} | ${d.status} | ${d.criterion ?? ''} | ${d.reason} |`)
  }
  return lines.join('\n')
}

// --- CLI ----------------------------------------------------------------------------------------

async function main(argv: string[]): Promise<void> {
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const reportPath = arg('--report')
  if (!reportPath) {
    console.error('usage: pnpm tsx rankings-engine/scripts/radar-triage.ts --report reports/vendor-radar/<date>.json [--out <json>] [--md <md>]')
    process.exit(1)
  }
  const radar = RadarReportSchema.parse(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
  const categories = readCategories()
  const existingArenas = new Set(categories.map((c) => c.id))
  const arenaDefinitions = new Map<string, string>(categories.map((c) => [c.id, c.description]))
  const triage = await triageReport(radar, existingArenas, realTriageIo(), arenaDefinitions)
  const out = arg('--out')
  const md = arg('--md')
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(TriageReportSchema.parse(triage), null, 2) + '\n')
  }
  const markdown = buildTriageMarkdown(triage)
  if (md) {
    fs.mkdirSync(path.dirname(md), { recursive: true })
    fs.writeFileSync(md, markdown + '\n')
  }
  console.log(markdown)
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
