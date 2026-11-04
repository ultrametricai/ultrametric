import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ProductSchema, type Category, type Product } from '../../lib/schemas'
import { buildArenaVocab, matchArenas, type RadarCandidate } from '../scripts/vendor-radar'
import { triageCandidate, MIN_FIT_HITS, isFounderAffiliated, type Disposition, type TriageIo } from '../scripts/radar-triage'
import { rosterDedupeKey, slugify, vendorOf } from '../scripts/radar-bringup'
import { fetchPublic, publicUrl, receipt, type Page, type Receipt } from './public-fetch'

export const REPOSITORY = 'ultrametricai/ultrametric'
export const IssueSchema = z.object({
  number: z.number().int().positive(), body: z.string().max(30000), title: z.string().max(256),
  state: z.literal('open'), updated_at: z.string(),
  labels: z.array(z.object({ name: z.string() })), pull_request: z.unknown().optional(),
})
export type Issue = z.infer<typeof IssueSchema>
export interface Submission {
  issue: number; source: string; revision: string; name: string; arena: string;
  urls: string[]; why: string; affiliated: boolean; disclosure: string;
}
const FIELDS = ['Product name', 'Category', 'Product site', 'URLs', 'Why it matters', 'Are you affiliated with this product?', 'Affiliation detail (if yes)']
export function digest(text: string): string { return createHash('sha256').update(text).digest('hex') }

export function normalizeIssue(input: unknown): Submission {
  const issue = IssueSchema.parse(input)
  if (issue.labels.some(l => ['needs-founder', 'intake-paused'].includes(l.name))) throw new Error('submission paused for human review')
  if (issue.pull_request || !issue.labels.some(l => l.name === 'product-request')) throw new Error('requires an open product-request issue')
  const fields = new Map<string, string>()
  for (const match of issue.body.matchAll(/^### ([^\r\n]+)\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)) {
    if (fields.has(match[1]) || !FIELDS.includes(match[1])) throw new Error('duplicate or unknown form field; human review required')
    fields.set(match[1], match[2].trim().replace(/^_No response_$/, ''))
  }
  const get = (key: string) => fields.get(key) ?? ''
  const name = get('Product name')
  const arena = get('Category')
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .+&()'/-]{0,99}$/u.test(name) || !slugify(name)) throw new Error('product name needs review')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(arena) || arena.length > 80) throw new Error('use an exact arena id or new')
  const why = get('Why it matters')
  if (!why || why.length > 5000) throw new Error('missing or oversized rationale')
  const affiliation = get('Are you affiliated with this product?')
  const disclosure = get('Affiliation detail (if yes)')
  if (!['Yes', 'No'].includes(affiliation) || (affiliation === 'Yes' && !disclosure)) throw new Error('explicit affiliation and disclosure required')
  if (disclosure.length > 2000) throw new Error('oversized affiliation disclosure')
  const urls = [...new Set((`${get('Product site')}\n${get('URLs')}`.match(/https?:\/\/[^\s<>\)]+/g) ?? []).map(u => publicUrl(u).href))]
  if (!urls.length || urls.length > 8) throw new Error('provide one to eight public HTTPS URLs, including an explicit product site')
  const explicit = get('Product site') || [...get('URLs').matchAll(/^\s*(?:[-*]\s*)?(?:Site|Website):\s*(https:\/\/\S+)\s*$/gmi)].map(m => m[1]).join(' ')
  let primary: string
  if (explicit) primary = publicUrl(explicit).href
  else if (urls.length === 1 && (new URL(urls[0]).pathname === '/' || new URL(urls[0]).hostname === 'github.com') && !/^(docs|developer|developers)\./.test(new URL(urls[0]).hostname)) primary = urls[0]
  else throw new Error('unclear product surface: provide Product site or a single Site: line; URL order is not identity')
  if (new URL(primary).search) throw new Error('product site query parameters require human identity review')
  if (!urls.includes(primary)) throw new Error('product site must be an unambiguous URL')
  urls.splice(urls.indexOf(primary), 1)
  urls.unshift(primary)
  // GitHub source identity is exact owner/repo, not an arbitrary URL that starts with it.
  for (const value of urls) {
    const u = new URL(value)
    if (u.hostname === 'github.com' && !/^\/[\w.-]+\/[\w.-]+\/?$/.test(u.pathname)) throw new Error('GitHub URLs must identify a repository root')
  }
  return { issue: issue.number, source: `https://github.com/${REPOSITORY}/issues/${issue.number}`,
    revision: digest(issue.body), name, arena, urls, why, affiliated: affiliation === 'Yes', disclosure }
}

export interface Catalog {
  revision: string;
  categories: Category[];
  products: { arena: string; product: Product }[];
  roadmap: { id: string; name: string; status: string; candidateProducts: string[] }[];
}
export interface IntakeReport {
  schemaVersion: 1; baseRevision: string; submission: Submission; route: 'draft-bringup' | 'arena-review' | 'needs-human' | 'duplicate';
  reason: string; identity: string; branch: string; arena: string | null;
  receipts: Receipt[]; disposition?: Disposition; proposedProduct?: Product;
  roadmap?: Catalog['roadmap'][number]; duplicate?: { arena: string; id: string };
}

export function safeTriageIo(pages: Map<string, Page>, receipts: Receipt[], get: (url: string) => Promise<Page>): Omit<TriageIo, 'fetchPage'> & { fetchPage: (url: string) => Promise<Page> } {
  async function read(url: string): Promise<Page> {
    if (pages.has(url)) return pages.get(url)!
    if (receipts.length >= 12) throw new Error('intake fetch budget exhausted')
    try {
      const page = await get(publicUrl(url).href)
      receipts.push(receipt(page)); pages.set(url, page)
      return page
    } catch (error) {
      receipts.push({ url, status: 0, checkedAt: new Date().toISOString(), sha256: digest(''), excerpt: '', error: String(error) })
      throw error
    }
  }
  return {
    fetchPage: read,
    async fetchRepo(fullName) {
      if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) return { error: 'invalid repository identity' }
      try {
        const base = `https://api.github.com/repos/${fullName}`
        const page = await read(base)
        if (page.status !== 200) return { error: `GitHub HTTP ${page.status}` }
        const repo = z.object({ archived: z.boolean(), fork: z.boolean(), description: z.string().nullable(), stargazers_count: z.number().nonnegative(), created_at: z.iso.datetime() }).parse(JSON.parse(page.html))
        const readmePage = await read(`${base}/readme`)
        if (readmePage.status !== 200) return { error: `README HTTP ${readmePage.status}` }
        const data = z.object({ encoding: z.literal('base64'), content: z.string() }).parse(JSON.parse(readmePage.html))
        const readme = Buffer.from(data.content, 'base64').toString('utf8')
        let contributors: number | null = null
        // A bounded exact count for small repos. Larger repos leave the ratio unavailable,
        // as existing policy prescribes; sustained star-velocity checks still run.
        const contrib = await read(`${base}/contributors?per_page=100`)
        if (contrib.status === 200) {
          const list = z.array(z.object({ login: z.string() })).parse(JSON.parse(contrib.html))
          if (list.length < 100) contributors = list.length
        }
        return { archived: repo.archived, fork: repo.fork, description: repo.description, stars: repo.stargazers_count,
          createdAt: repo.created_at, contributors, readme, readmeBytes: Buffer.byteLength(readme), readmeHead: readme.slice(0, 2000) }
      } catch (error) { return { error: String(error) } }
    },
  }
}

// Preserve listing paths: a common domain does not make two packages one product.
export function productIdentity(value: string): string {
  const url = publicUrl(value)
  const host = url.hostname.replace(/^www\./, '')
  const codeKey = rosterDedupeKey(value)!
  if (codeKey.includes('/')) return codeKey
  return host + url.pathname.replace(/\/+$/, '')
}

export function submissionIdentity(submission: Submission): { identity: string; branch: string } {
  const identity = productIdentity(submission.urls[0])
  return { identity, branch: `submission-intake/${digest(`${submission.arena}\n${identity}`).slice(0, 24)}` }
}

// The radar taxonomy has sparse vocabularies for some live categories. These
// intake-only additions come from those categories' definitions; they do not lower
// the qualification threshold or change the existing radar/launch workflows.
const INTAKE_VOCAB: Record<string, string[]> = {
  accounting: ['ledger', 'bank feeds', 'invoicing', 'month-end close'],
  'security-scanners': ['secret detection', 'sast', 'sca', 'container scanning'],
  'infra-as-code': ['declarative', 'provisioning', 'state management', 'plan preview'],
  'vibe-coding': ['prompt-to-app', 'natural language', 'full-stack', 'app generation'],
  'product-analytics': ['instrumentation', 'funnels', 'retention', 'session replay', 'experimentation'],
  crm: ['crm', 'contacts', 'deals', 'sales pipeline', 'customer relationship'],
  'legal-ops': ['board consents', 'safes', 'e-signature', 'compliance filings'],
  'robotics-platforms': ['robots', 'simulating', 'middleware', 'robot simulation', 'robot fleet'],
  'ai-assistants': ['chat', 'file analysis', 'knowledge work', 'general-purpose'],
  'ai-research-agents': ['cited reports', 'sources', 'searches', 'synthesize'],
  'workflow-automation': ['triggers', 'visual builders', 'durable runs', 'connect apps'],
  observability: ['metrics', 'logs', 'traces', 'slos', 'alerting'],
  'compliance-screening': ['sanctions', 'pep', 'transaction monitoring', 'financial-crime', 'investigations'],
}

export function buildSubmissionVocab(categories: Category[]): ReturnType<typeof buildArenaVocab> {
  const vocabulary = buildArenaVocab(categories, new Map())
  for (const [arena, additions] of Object.entries(INTAKE_VOCAB)) {
    const words = vocabulary.get(arena)
    if (!words) continue
    for (const word of additions) if (!words.some(w => w.word === word)) words.push({ word, re: new RegExp(`\\b(?:${word})\\b`, 'i') })
  }
  return vocabulary
}

export async function assess(submission: Submission, catalog: Catalog, get = fetchPublic): Promise<IntakeReport> {
  // Per product + requested arena, not per issue: duplicate issues share one draft.
  const { identity, branch } = submissionIdentity(submission)
  const report: IntakeReport = { schemaVersion: 1, baseRevision: catalog.revision, submission, identity, branch, route: 'needs-human', reason: '', arena: null, receipts: [] }
  const stop = (reason: string) => { report.reason = reason; return report }
  const knownAffiliated = catalog.products.filter(({ product }) => product.affiliation)
  if (submission.urls.some(url => isFounderAffiliated(submission.name, url)) || /\b(foreloop|afk)\b/i.test(submission.name) ||
    knownAffiliated.some(({ product }) => product.name.toLowerCase() === submission.name.toLowerCase() || submission.urls.some(url => Object.values(product.urls).flat().some(known => productIdentity(known) === productIdentity(url))))) {
    return stop('Affiliated identity: human disclosure and bias audit required.')
  }
  const duplicate = catalog.products.find(({ arena, product }) => arena === submission.arena &&
    (product.id === slugify(submission.name) || product.name.toLowerCase() === submission.name.toLowerCase() ||
      [product.urls.site, product.urls.github].some(known => known && productIdentity(known) === productIdentity(submission.urls[0]))))
  if (duplicate) { report.route = 'duplicate'; report.duplicate = { arena: duplicate.arena, id: duplicate.product.id }; return stop('Product already rostered in the requested arena; use the correction flow for new evidence.') }
  if (catalog.products.some(({ product }) => submission.urls.slice(1).some(url => [product.urls.site, product.urls.github].some(known => known && productIdentity(known) === productIdentity(url))))) return stop('Supporting link identifies another rostered product; confirm identity before bring-up.')
  if (catalog.products.some(({ arena, product }) => arena === submission.arena && rosterDedupeKey(product.urls.site) === rosterDedupeKey(submission.urls[0]))) return stop('Existing roster shares this host but has a different product path; confirm identity before adding a product.')
  if (/^(?:www\.)?(?:npmjs\.com|pypi\.org|huggingface\.co|apps\.apple\.com|play\.google\.com|producthunt\.com)$/.test(new URL(submission.urls[0]).hostname)) return stop('Shared listing host: confirm the vendor product site or source repository before bring-up.')
  const roadmap = catalog.roadmap.find(r => r.id === submission.arena && r.status !== 'live')
  if (roadmap) {
    report.route = 'arena-review'; report.roadmap = roadmap; report.arena = roadmap.id
    return stop('Planned arena: review peer set and create the arena through the submission exception in AGENT_POLICY. Every peer must pass triage; this report does not mark the arena live.')
  }
  if (!catalog.categories.some(c => c.id === submission.arena)) return stop('Unknown arena or new peer set: human arena review required.')
  const pages = new Map<string, Page>()
  const io = safeTriageIo(pages, report.receipts, get)
  try {
    const primary = submission.urls[0]
    let verifiedText: string
    if (new URL(primary).hostname === 'github.com') {
      const repo = await io.fetchRepo(new URL(primary).pathname.slice(1).replace(/\/$/, ''))
      if ('error' in repo) return stop(repo.error)
      verifiedText = `${repo.description ?? ''} ${repo.readme}`
    } else {
      const page = await io.fetchPage(primary)
      if (page.status !== 200) return stop(`Product surface HTTP ${page.status}; retry after review.`)
      // Redirects across identities may be legitimate acquisitions, but require review.
      if (productIdentity(page.url) !== identity) return stop('Product redirects to a different identity; review the canonical product URL.')
      verifiedText = page.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
    }
    // Submission rationale is not evidence and cannot manufacture placement keyword hits.
    const matches = matchArenas(verifiedText, buildSubmissionVocab(catalog.categories))
    if (!matches[0] || matches[0].hits < MIN_FIT_HITS || matches[0].arena !== submission.arena || matches[1]?.hits === matches[0].hits) return stop('Fetched surface does not uniquely support the requested arena; human placement review required.')
    const candidate: RadarCandidate = { key: identity, name: submission.name, url: primary,
      // The issue source lives in submission.source, not radar.sources: the radar's
      // githubRepoOf scans source URLs and would mistake our issue repo for the product.
      sources: [],
      matchedArenas: matches, firstSeen: report.receipts[0].checkedAt }
    const d = await triageCandidate(candidate, new Set(catalog.categories.map(c => c.id)), io, new Map(catalog.categories.map(c => [c.id, c.description])))
    report.disposition = d; report.arena = d.arena
    if (d.status !== 'auto-approved' || !d.bringup) return stop(d.reason)
    // All discovered roster URLs pass the same syntax gate, including docs links.
    Object.values(d.bringup).filter(u => u.startsWith('http')).forEach(u => publicUrl(u))
    report.proposedProduct = ProductSchema.parse({ id: slugify(submission.name), name: submission.name, vendor: vendorOf(d), type: d.bringup.type,
      urls: { site: d.bringup.site, docs: d.bringup.docs, github: d.bringup.github },
      ...(submission.affiliated ? { affiliation: `Vendor self-submission (${submission.source}): ${submission.disclosure}` } : {}) })
    report.route = 'draft-bringup'
    return stop('Mechanical triage passed. Draft contains a proposed roster input and source receipts. Confirm identity and placement, then run the scoped engine and bias audit before publication.')
  } catch (error) { return stop(`Source verification failed: ${String(error)}`) }
}
