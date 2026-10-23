// Launch-watch unit tests: inline fixture literals over the exported pure functions — no
// network, no mocks (the vendor-radar.test.ts convention). Roster/apply IO runs against a
// mkdtemp data dir.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Product } from '../../lib/schemas'
import { TriageReportSchema, type TriageReport } from '../scripts/radar-triage'
import {
  LW_AUTO_APPROVE_HITS,
  applyLaunchBringups,
  buildMarkdown,
  collectWatchedProducts,
  dispositionFor,
  isLaunchHeadline,
  launchCandidates,
  launchItemsFromHtml,
  launchKey,
  matchText,
  partitionCandidates,
  type LaunchCandidate,
  type LaunchWatchReport,
} from '../scripts/launch-watch'
import { buildArenaVocab, mergeSeenEntries } from '../scripts/vendor-radar'

const product = (over: Partial<Product> = {}): Product => ({
  id: 'mercury',
  name: 'Mercury',
  vendor: 'Mercury Technologies',
  type: 'commercial',
  urls: { site: 'https://mercury.com', news: 'https://mercury.com/blog' },
  ...over,
})

// A taxonomy stand-in: ids are real arena ids so DOMAIN_VOCAB applies to the first, while the
// second exercises the category-name token path (the vendor-radar.test.ts pattern).
const VOCAB = buildArenaVocab(
  [
    { id: 'startup-banking', name: 'Startup Banking' },
    { id: 'legal-ops', name: 'Startup Legal & Incorporation' },
  ],
  new Map([
    ['startup-banking', 'Run the company'],
    ['legal-ops', 'Run the company'],
  ]),
)

const NEWSROOM_HTML = `
<html><body>
  <nav><a href="/pricing">Pricing</a></nav>
  <article><a href="/blog/mercury-invoicing"><h2>Mercury launches <em>invoicing</em> &amp; bill pay for every business bank account</h2></a></article>
  <article><a href="https://mercury.com/blog/incorporation-service">Announcing Mercury incorporation: registered agent and legal formation filings for startups</a></article>
  <article><a href="https://mercury.com/blog/incorporation-service">Announcing Mercury incorporation: registered agent and legal formation filings for startups</a></article>
  <article><a href="https://twitter.com/mercury/status/1">Announcing our new banking treasury yield product on another host</a></article>
  <article><a href="/blog/culture">How we think about remote culture at Mercury HQ</a></article>
</body></html>`

describe('launch item parsing', () => {
  it('keeps same-host headline anchors, resolves relative hrefs, dedupes, drops nav and cross-host links', () => {
    const items = launchItemsFromHtml(NEWSROOM_HTML, 'https://mercury.com/blog')
    expect(items.map((i) => i.url)).toEqual([
      'https://mercury.com/blog/mercury-invoicing',
      'https://mercury.com/blog/incorporation-service',
      'https://mercury.com/blog/culture',
    ])
    expect(items[0].title).toBe('Mercury launches invoicing & bill pay for every business bank account')
  })

  it('classifies launch-shaped headlines', () => {
    expect(isLaunchHeadline('Announcing Mercury incorporation for startups')).toBe(true)
    expect(isLaunchHeadline('Acme ships nothing but this is now generally available')).toBe(true)
    expect(isLaunchHeadline('How we think about remote culture at Mercury HQ')).toBe(false)
    expect(isLaunchHeadline('A deep dive into our database migration')).toBe(false)
  })

  it('folds URL slug words into the match text', () => {
    expect(matchText({ title: 'Announcing a new product', url: 'https://mercury.com/blog/registered-agent-filings' })).toContain(
      'registered agent filings',
    )
  })
})

describe('cross-arena candidates', () => {
  const mercury = { id: 'mercury', name: 'Mercury', arenas: ['startup-banking'] }
  const items = launchItemsFromHtml(NEWSROOM_HTML, 'https://mercury.com/blog')

  it('nominates only arenas the product is not rostered in, keyed launch:<product>:<arena>', () => {
    const candidates = launchCandidates(mercury, items, VOCAB, 'https://mercury.com/blog')
    const arenas = candidates.map((c) => c.arena)
    expect(arenas).toContain('legal-ops')
    expect(arenas).not.toContain('startup-banking') // already rostered there
    const legal = candidates.find((c) => c.arena === 'legal-ops')!
    expect(legal.key).toBe(launchKey('mercury', 'legal-ops'))
    expect(legal.title).toContain('Announcing Mercury incorporation')
  })

  it('ignores non-launch headlines even when they match an arena', () => {
    const candidates = launchCandidates(
      mercury,
      [{ title: 'How our legal and incorporation compliance filings work', url: 'https://mercury.com/blog/x' }],
      VOCAB,
      'https://mercury.com/blog',
    )
    expect(candidates).toEqual([])
  })
})

describe('dispositions', () => {
  const base = {
    key: launchKey('mercury', 'legal-ops'),
    productId: 'mercury',
    name: 'Mercury',
    arena: 'legal-ops',
    keywords: ['incorporation', 'legal', 'registered agent'],
    title: 'Announcing Mercury incorporation',
    url: 'https://mercury.com/blog/incorporation-service',
    sourceUrl: 'https://mercury.com/blog',
  }
  const identity = { site: 'https://mercury.com', docs: 'https://docs.mercury.com', type: 'commercial' as const, vendor: 'Mercury Technologies' }

  it('routes weak fits to a human and strong fits to auto-approval with a roster-ready bringup', () => {
    const weak = dispositionFor({ ...base, hits: LW_AUTO_APPROVE_HITS - 1 }, identity, 'Startup legal platforms.', '2026-10-23')
    expect(weak.status).toBe('needs-human')
    expect(weak.bringup).toBeNull()
    const strong = dispositionFor({ ...base, hits: LW_AUTO_APPROVE_HITS }, identity, 'Startup legal platforms.', '2026-10-23')
    expect(strong.status).toBe('auto-approved')
    expect(strong.bringup).toEqual({ site: 'https://mercury.com', docs: 'https://docs.mercury.com', type: 'commercial' })
    expect(strong.criterion).toBe('ranking-fit')
    expect(strong.evidence.join(' ')).toContain(base.url)
  })

  it('never auto-approves a founder-affiliated product', () => {
    const d = dispositionFor(
      { ...base, name: 'Ultrametric Agent', hits: LW_AUTO_APPROVE_HITS + 2 },
      { ...identity, site: 'https://ultrametric.ai' },
      'desc',
      '2026-10-23',
    )
    expect(d.status).toBe('needs-human')
  })

  it('produces rows the radar-triage report schema accepts (needs-human-issue compatibility)', () => {
    const report: TriageReport = {
      generatedAt: '2026-10-23T00:00:00.000Z',
      policy: 'launch-watch test',
      dispositions: [dispositionFor({ ...base, hits: 2 }, identity, 'desc', '2026-10-23')],
    }
    expect(TriageReportSchema.parse(report)).toBeTruthy()
  })
})

describe('seen-ledger partition', () => {
  const candidate = (over: Partial<LaunchCandidate> = {}): LaunchCandidate => ({
    key: launchKey('mercury', 'legal-ops'),
    productId: 'mercury',
    name: 'Mercury',
    arena: 'legal-ops',
    hits: 2,
    keywords: ['incorporation', 'legal'],
    title: 'Announcing Mercury incorporation',
    url: 'https://mercury.com/blog/incorporation-service',
    sourceUrl: 'https://mercury.com/blog',
    ...over,
  })

  it('reports an unseen pair once and keeps the strongest headline', () => {
    const { fresh, laterLaunches, alreadySeen } = partitionCandidates(
      [candidate({ hits: 2 }), candidate({ hits: 3, title: 'Stronger' })],
      new Set(),
      '2026-10-23',
    )
    expect(fresh).toHaveLength(1)
    expect(fresh[0].title).toBe('Stronger')
    expect(laterLaunches).toEqual([])
    expect(alreadySeen).toBe(0)
  })

  it('does not re-nominate a seen pair but merges the later launch URL into its ledger entry', () => {
    const seen = new Set([launchKey('mercury', 'legal-ops')])
    const { fresh, laterLaunches, alreadySeen } = partitionCandidates(
      [candidate({ url: 'https://mercury.com/blog/formation-v2' })],
      seen,
      '2026-11-30',
    )
    expect(fresh).toEqual([])
    expect(alreadySeen).toBe(1)
    expect(laterLaunches).toHaveLength(1)
    expect(laterLaunches[0].key).toBe(launchKey('mercury', 'legal-ops'))
    expect(laterLaunches[0].sources).toEqual(['https://mercury.com/blog/formation-v2'])
    // mergeSeenEntries keeps the pair's original firstSeen and unions the sources, so the later
    // launch lands in the committed ledger diff instead of vanishing.
    const merged = mergeSeenEntries([
      [{ key: launchKey('mercury', 'legal-ops'), name: 'Mercury → legal-ops', firstSeen: '2026-10-23', sources: ['https://mercury.com/blog/incorporation-service'] }],
      laterLaunches,
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].firstSeen).toBe('2026-10-23')
    expect(merged[0].sources).toEqual(['https://mercury.com/blog/incorporation-service', 'https://mercury.com/blog/formation-v2'])
  })
})

describe('watched products', () => {
  it('merges arenas per product id and keeps only products with a urls.news opt-in', () => {
    const rosters = new Map<string, Product[]>([
      ['startup-banking', [product()]],
      ['expense-management', [product({ urls: { site: 'https://mercury.com' } }), product({ id: 'other', name: 'Other', urls: { site: 'https://other.example' } })]],
    ])
    const watched = collectWatchedProducts(rosters)
    expect(watched).toHaveLength(1)
    expect(watched[0].id).toBe('mercury')
    expect(watched[0].arenas.sort()).toEqual(['expense-management', 'startup-banking'])
    expect(watched[0].news).toEqual(['https://mercury.com/blog'])
  })
})

describe('markdown', () => {
  it('states an empty run explicitly and cites the dated report', () => {
    const report: LaunchWatchReport = {
      generatedAt: '2026-10-23T00:00:00.000Z',
      date: '2026-10-23',
      thresholds: {},
      sources: [{ productId: 'mercury', url: 'https://mercury.com/blog', items: 12, launchShaped: 2, error: null }],
      skipped: { alreadySeen: 0, overflow: 0 },
      candidates: [],
    }
    const md = buildMarkdown(report)
    expect(md).toContain('No new candidates this run')
    expect(md).toContain('reports/launch-watch/2026-10-23.json')
  })
})

describe('apply', () => {
  const triageWith = (status: 'auto-approved' | 'needs-human'): TriageReport => ({
    generatedAt: '2026-10-23T00:00:00.000Z',
    policy: 'launch-watch test',
    dispositions: [
      {
        key: launchKey('mercury', 'legal-ops'),
        name: 'Mercury → legal-ops',
        url: 'https://mercury.com/blog/incorporation-service',
        arena: 'legal-ops',
        status,
        criterion: 'ranking-fit',
        reason: 'test',
        evidence: ['test'],
        bringup: status === 'auto-approved' ? { site: 'https://mercury.com', type: 'commercial' } : null,
      },
    ],
  })

  const setup = (triage: TriageReport) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-watch-'))
    fs.writeFileSync(
      path.join(dir, 'categories.json'),
      JSON.stringify([
        { id: 'startup-banking', name: 'Startup Banking' },
        { id: 'legal-ops', name: 'Startup Legal & Incorporation' },
      ]),
    )
    fs.mkdirSync(path.join(dir, 'startup-banking'))
    fs.mkdirSync(path.join(dir, 'legal-ops'))
    fs.writeFileSync(path.join(dir, 'startup-banking', 'products.json'), JSON.stringify([product()], null, 2) + '\n')
    fs.writeFileSync(path.join(dir, 'legal-ops', 'products.json'), JSON.stringify([], null, 2) + '\n')
    const triagePath = path.join(dir, 'triage.json')
    fs.writeFileSync(triagePath, JSON.stringify(triage, null, 2) + '\n')
    return { dir, triagePath }
  }

  it('copies the existing identity into the target roster once, with a scoped-entry disclosure', () => {
    const { dir, triagePath } = setup(triageWith('auto-approved'))
    expect(applyLaunchBringups(triagePath, 2, dir)).toEqual(['legal-ops mercury'])
    const roster = JSON.parse(fs.readFileSync(path.join(dir, 'legal-ops', 'products.json'), 'utf8')) as Product[]
    expect(roster).toHaveLength(1)
    expect(roster[0].id).toBe('mercury')
    expect(roster[0].urls.site).toBe('https://mercury.com')
    expect(roster[0].affiliation).toContain('judged separately in startup-banking')
    // idempotent: a second apply adds nothing
    expect(applyLaunchBringups(triagePath, 2, dir)).toEqual([])
  })

  it('applies nothing for needs-human rows or a zero cap', () => {
    const { dir, triagePath } = setup(triageWith('needs-human'))
    expect(applyLaunchBringups(triagePath, 2, dir)).toEqual([])
    const { dir: dir2, triagePath: triagePath2 } = setup(triageWith('auto-approved'))
    expect(applyLaunchBringups(triagePath2, 0, dir2)).toEqual([])
  })
})
