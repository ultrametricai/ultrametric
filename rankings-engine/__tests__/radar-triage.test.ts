import { describe, expect, it, vi } from 'vitest'
import {
  MIN_FIT_HITS,
  findAgenticSignal,
  isPlainTextLlms,
  OSS_README_MIN_BYTES,
  PLACEMENT_CAVEAT,
  TriageReportSchema,
  buildTriageMarkdown,
  checkOssSubstance,
  checkRankingFit,
  findDocsLink,
  githubRepoOf,
  isFounderAffiliated,
  isWaitlistOnly,
  triageCandidate,
  triageReport,
  YOUNG_REPO_MAX_AGE_DAYS,
  YOUNG_REPO_STARS_PER_CONTRIBUTOR,
  YOUNG_REPO_STARS_PER_DAY,
  youngRepoAnomaly,
  type RepoFacts,
  type TriageIo,
} from '../scripts/radar-triage'
import type { RadarCandidate } from '../scripts/vendor-radar'

// Pure units for the criteria triage (policies/AGENT_POLICY.md "Vendor-radar candidate
// approval"): injected fetch results, no network — same convention as vendor-radar.test.ts.

const ARENAS = new Set(['browser-agents', 'ai-coding'])

function candidate(overrides: Partial<RadarCandidate> = {}): RadarCandidate {
  return {
    key: 'domain:driftbase.dev',
    name: 'Driftbase',
    url: 'https://driftbase.dev',
    sources: [{ kind: 'hn', url: 'https://news.ycombinator.com/item?id=1', title: 'Show HN: Driftbase', evidence: 'Show HN, 120 points in 9h' }],
    matchedArenas: [{ arena: 'browser-agents', hits: 4, keywords: ['browser', 'agent', 'playwright', 'headless'] }],
    firstSeen: '2026-10-13',
    ...overrides,
  }
}

function io(overrides: Partial<TriageIo> = {}): TriageIo {
  return {
    fetchPage: async () => ({ status: 200, html: '<a href="/docs">Documentation</a> <a href="/pricing">Pricing</a> API reference' }),
    fetchRepo: async () => ({ archived: false, fork: false, description: 'a real tool', stars: 900, createdAt: '2026-08-01T00:00:00Z', contributors: 45, readmeBytes: 9000, readmeHead: '## Install\nnpm i driftbase', readme: '## Install\nnpm i driftbase\n## API reference' }),
    ...overrides,
  }
}

const REPO_OK: RepoFacts = { archived: false, fork: false, description: 'browser agent sdk', stars: 900, createdAt: '2026-08-01T00:00:00Z', contributors: 45, readmeBytes: 8000, readmeHead: '## Quickstart\npip install x', readme: '## Quickstart\npip install x\nShips an MCP server.' }

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()

describe('criterion checks', () => {
  it('ranking fit requires MIN_FIT_HITS on an arena that exists — the radar never creates rankings', () => {
    expect(checkRankingFit(candidate(), ARENAS)).toEqual({ arena: 'browser-agents' })
    const weak = checkRankingFit(candidate({ matchedArenas: [{ arena: 'browser-agents', hits: MIN_FIT_HITS - 1, keywords: ['browser', 'agent'] }] }), ARENAS)
    expect(weak).toHaveProperty('fail')
    const missing = checkRankingFit(candidate({ matchedArenas: [{ arena: 'not-an-arena', hits: 9, keywords: ['x'] }] }), ARENAS)
    expect(missing).toEqual({ fail: 'no matched arena exists in open-rankings/' })
  })

  it('OSS substance: archived repos, forks, link lists, and thin READMEs fail with the right criterion', () => {
    expect(checkOssSubstance('x', REPO_OK)).toEqual({ ok: true })
    expect(checkOssSubstance('x', { ...REPO_OK, archived: true })).toMatchObject({ criterion: 'shipped-product' })
    expect(checkOssSubstance('x', { ...REPO_OK, fork: true })).toMatchObject({ criterion: 'shipped-product' })
    expect(checkOssSubstance('awesome-agents', { ...REPO_OK, description: 'A curated list of agent tools' })).toMatchObject({ criterion: 'shipped-product' })
    expect(checkOssSubstance('x', { ...REPO_OK, readmeBytes: OSS_README_MIN_BYTES - 1 })).toMatchObject({ criterion: 'docs-surface' })
  })

  it('waitlist pages are recognized only when no shipped-product signal is present', () => {
    expect(isWaitlistOnly('<h1>Join the waitlist</h1>')).toBe(true)
    expect(isWaitlistOnly('<h1>Join the waitlist</h1> <a href="/docs">docs</a>')).toBe(false)
    expect(isWaitlistOnly('<h1>Get started</h1>')).toBe(false)
  })

  it('docs links resolve relative to the page and match docs-shaped hrefs only', () => {
    expect(findDocsLink('<a href="/docs">Docs</a>', 'https://x.dev')).toBe('https://x.dev/docs')
    expect(findDocsLink('<a href="https://docs.x.dev/start">Docs</a>', 'https://x.dev')).toBe('https://docs.x.dev/start')
    expect(findDocsLink('<a href="/blog">Blog</a>', 'https://x.dev')).toBeNull()
  })

  it('docs-link discovery skips static assets and docs URLs quoted in another site\'s query string (issue #434, Munito)', () => {
    // A bundler-named stylesheet matches the /docs token on the hyphen word boundary.
    expect(findDocsLink('<link rel="stylesheet" href="/assets/docs-DacSO4We.css">', 'https://x.dev')).toBeNull()
    // The asset is skipped, not fatal: the real docs link later in the page still wins.
    expect(
      findDocsLink('<link rel="stylesheet" href="/assets/docs-DacSO4We.css"><a href="https://docs.x.dev/">Docs</a>', 'https://x.dev'),
    ).toBe('https://docs.x.dev/')
    // A docs URL inside a share/prompt link's query string is not that site's docs surface.
    expect(findDocsLink('<a href="https://chat.example.com/?q=read%20https%3A%2F%2Fdocs.x.dev%2Fllms.txt">Ask</a>', 'https://x.dev')).toBeNull()
  })

  it('findAgenticSignal names the matched phrase; plain prose is not an agentic surface', () => {
    expect(findAgenticSignal('Full API reference for developers')).toBe('API reference')
    expect(findAgenticSignal('Ships an MCP server out of the box')).toBe('MCP server')
    expect(findAgenticSignal('See our llms.txt for agents')).toBe('llms.txt')
    expect(findAgenticSignal('The fastest way to warm your coffee')).toBeNull()
    expect(findAgenticSignal('We apply AI to your workflow')).toBeNull()
  })

  it('isPlainTextLlms rejects SPA catch-all HTML, JSON, non-text content types, and empty bodies', () => {
    expect(isPlainTextLlms('# Driftbase\n> docs for agents')).toBe(true)
    expect(isPlainTextLlms('# Driftbase', 'text/plain; charset=utf-8')).toBe(true)
    expect(isPlainTextLlms('# Driftbase', 'text/markdown')).toBe(true)
    expect(isPlainTextLlms('<!DOCTYPE html><html>')).toBe(false)
    expect(isPlainTextLlms('   ')).toBe(false)
    expect(isPlainTextLlms('{"error":"not found"}')).toBe(false) // JSON body, no declared type
    expect(isPlainTextLlms('# Driftbase', 'application/json')).toBe(false)
    expect(isPlainTextLlms('# Driftbase', 'text/html; charset=utf-8')).toBe(false)
    expect(isPlainTextLlms('Not Found', 'text/plain')).toBe(false) // catch-all string, no H1 — not a document
  })

  it('young-repo trip-wire (a): sustained rate at or above the young-repo floor trips, below it does not', () => {
    const now = new Date()
    // 20 days old, 2400 stars ≈ 120/day — trips on rate alone even with many contributors.
    const rate = youngRepoAnomaly({ stars: 2400, createdAt: daysAgo(20), contributors: 500 }, now)
    expect(rate).toContain(`${YOUNG_REPO_STARS_PER_DAY}/day`)
    // 20 days old, 1000 stars = 50/day with a healthy contributor base — no trip.
    expect(youngRepoAnomaly({ stars: 1000, createdAt: daysAgo(20), contributors: 80 }, now)).toBeNull()
  })

  it('young-repo trip-wire (b): stars above 20× max(contributors, 1) trips, including zero contributors', () => {
    const now = new Date()
    // 20 days old, 1500 stars = 75/day (below the rate floor) but only 10 contributors → 1500 > 200.
    const ratio = youngRepoAnomaly({ stars: 1500, createdAt: daysAgo(20), contributors: 10 }, now)
    expect(ratio).toContain(`${YOUNG_REPO_STARS_PER_CONTRIBUTOR}× stars-per-contributor`)
    // max(contributors, 1): zero recorded contributors still divides by 1.
    expect(youngRepoAnomaly({ stars: 25, createdAt: daysAgo(10), contributors: 0 }, now)).toContain('stars-per-contributor')
    // 10 days old, 100 stars, 10 contributors → 100 ≤ 200 — no trip.
    expect(youngRepoAnomaly({ stars: 100, createdAt: daysAgo(10), contributors: 10 }, now)).toBeNull()
  })

  it('young-repo trip-wires fail open on a missing contributor count and never fire at or past 60 days', () => {
    const now = new Date()
    // Contributor count unavailable: the ratio wire is skipped (rate is below its floor) — fail-open.
    expect(youngRepoAnomaly({ stars: 1500, createdAt: daysAgo(20), contributors: null }, now)).toBeNull()
    // The rate wire needs no contributor count, so it still fires with the count unavailable.
    expect(youngRepoAnomaly({ stars: 2400, createdAt: daysAgo(20), contributors: null }, now)).not.toBeNull()
    // Repos at or past the age boundary keep the old behavior: only the 500/day floor applies.
    // The boundary date derives from the same `now` the check reads — a second Date.now() read
    // would leave the repo a few milliseconds under 60 days and flake the exact-boundary case.
    expect(youngRepoAnomaly({ stars: 30_000, createdAt: new Date(now.getTime() - YOUNG_REPO_MAX_AGE_DAYS * 86_400_000).toISOString(), contributors: 1 }, now)).toBeNull()
    expect(youngRepoAnomaly({ stars: 30_000, createdAt: daysAgo(120), contributors: 1 }, now)).toBeNull()
  })

  it('founder affiliation matches name and url, routing to a human', () => {
    expect(isFounderAffiliated('Ultrametric CLI', 'https://example.com')).toBe(true)
    expect(isFounderAffiliated('Driftbase', 'https://ultrametric.ai/tool')).toBe(true)
    expect(isFounderAffiliated('Driftbase', 'https://driftbase.dev')).toBe(false)
  })

  it('githubRepoOf finds the repo in the product URL or any source URL', () => {
    expect(githubRepoOf(candidate({ url: 'https://github.com/acme/driftbase' }))).toBe('acme/driftbase')
    expect(
      githubRepoOf(candidate({ sources: [{ kind: 'github', url: 'https://github.com/acme/driftbase', title: 'acme/driftbase', evidence: '500 stars' }] })),
    ).toBe('acme/driftbase')
    expect(githubRepoOf(candidate())).toBeNull()
  })
})

describe('triageCandidate', () => {
  it('auto-approves a hosted product with a reachable docs surface, carrying roster-ready URLs', async () => {
    const d = await triageCandidate(candidate(), ARENAS, io())
    expect(d.status).toBe('auto-approved')
    expect(d.arena).toBe('browser-agents')
    expect(d.bringup).toEqual({ site: 'https://driftbase.dev', docs: 'https://driftbase.dev/docs', type: 'commercial' })
    expect(d.evidence.some((e) => e.includes('HTTP 200'))).toBe(true)
    expect(d.reason).toContain(PLACEMENT_CAVEAT)
  })

  it('auto-approves a substantive OSS repo through the GitHub API facts', async () => {
    const d = await triageCandidate(candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' }), ARENAS, io())
    expect(d.status).toBe('auto-approved')
    expect(d.bringup).toMatchObject({ github: 'https://github.com/acme/driftbase', type: 'oss' })
    expect(d.reason).toContain(PLACEMENT_CAVEAT)
  })

  it('records the matched arena definition and keywords in evidence when definitions are supplied', async () => {
    const defs = new Map([['browser-agents', 'Agents that drive a real browser to complete web tasks.']])
    const d = await triageCandidate(candidate(), ARENAS, io(), defs)
    expect(d.status).toBe('auto-approved')
    expect(d.evidence.some((e) => e.startsWith('arena-definition browser-agents:') && e.includes('drive a real browser') && e.includes('playwright'))).toBe(true)
  })

  it('skips launch-post-only candidates on the docs-surface criterion with the stated reason', async () => {
    const d = await triageCandidate(candidate({ url: 'https://www.producthunt.com/products/driftbase', key: 'name:driftbase' }), ARENAS, io())
    expect(d.status).toBe('skipped')
    expect(d.criterion).toBe('docs-surface')
    expect(d.reason).toContain('launch post')
  })

  it('skips candidates whose only URL is a YC launch page, so the launch post never passes product-site checks', async () => {
    const fetchPage = vi.fn(async () => ({ status: 200, html: '<html>Launch YC: Driftbase — API docs, playwright, webhooks</html>' }))
    for (const url of ['https://www.ycombinator.com/launches/abc-driftbase', 'https://ycombinator.com/companies/driftbase']) {
      const d = await triageCandidate(candidate({ url, key: 'name:driftbase' }), ARENAS, io({ fetchPage }))
      expect(d.status).toBe('skipped')
      expect(d.criterion).toBe('docs-surface')
      expect(d.reason).toContain('launch post')
    }
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('skips waitlist pages on shipped-product and unreachable sites on docs-surface, recording HTTP evidence', async () => {
    const waitlist = await triageCandidate(candidate(), ARENAS, io({ fetchPage: async () => ({ status: 200, html: 'Join the waitlist' }) }))
    expect(waitlist).toMatchObject({ status: 'skipped', criterion: 'shipped-product' })
    const dead = await triageCandidate(candidate(), ARENAS, io({ fetchPage: async () => ({ status: 404, html: '' }) }))
    expect(dead).toMatchObject({ status: 'skipped', criterion: 'docs-surface' })
    expect(dead.evidence[0]).toContain('HTTP 404')
  })

  it('records the agentic surface as a fetched URL + one-line evidence on every auto-approval', async () => {
    const hosted = await triageCandidate(candidate(), ARENAS, io())
    expect(hosted.status).toBe('auto-approved')
    expect(hosted.evidence.some((e) => e.startsWith('agentic-surface: https://driftbase.dev/docs') && e.includes('API reference'))).toBe(true)
    const oss = await triageCandidate(candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' }), ARENAS, io())
    expect(oss.status).toBe('auto-approved')
    expect(oss.evidence.some((e) => e.startsWith('agentic-surface: https://api.github.com/repos/acme/driftbase/readme') && e.includes('API reference'))).toBe(true)
  })

  it('an OSS signal found only in the repo description cites the repo endpoint, not the README', async () => {
    const d = await triageCandidate(
      candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' }),
      ARENAS,
      io({ fetchRepo: async () => ({ ...REPO_OK, description: 'hosted MCP server for browsers', readme: '## Quickstart\npip install x' }) }),
    )
    expect(d.status).toBe('auto-approved')
    expect(d.evidence.some((e) => e.startsWith('agentic-surface: https://api.github.com/repos/acme/driftbase —') && e.includes('description names "MCP server"'))).toBe(true)
  })

  it('skips a hosted product with docs but no agentic surface, recording the llms.txt probe', async () => {
    const d = await triageCandidate(
      candidate(),
      ARENAS,
      io({
        fetchPage: async (url) =>
          url.endsWith('/llms.txt') ? { status: 404, html: '' } : { status: 200, html: '<a href="/docs">Documentation</a> <a href="/pricing">Pricing</a>' },
      }),
    )
    expect(d).toMatchObject({ status: 'skipped', criterion: 'agentic-surface', bringup: null })
    expect(d.reason).toContain('no citable agentic surface')
    expect(d.evidence.some((e) => e.includes('/llms.txt — HTTP 404'))).toBe(true)
  })

  it('a plain-text llms.txt is itself the citable agentic surface; a JSON catch-all is not', async () => {
    const page = { status: 200, html: '<a href="/docs">Documentation</a> <a href="/pricing">Pricing</a>' }
    const d = await triageCandidate(
      candidate(),
      ARENAS,
      io({
        fetchPage: async (url) =>
          url.endsWith('/llms.txt') ? { status: 200, html: '# Driftbase\ndocs for agents', contentType: 'text/plain; charset=utf-8' } : page,
      }),
    )
    expect(d.status).toBe('auto-approved')
    expect(d.evidence.some((e) => e.startsWith('agentic-surface: https://driftbase.dev/llms.txt') && e.includes('text/plain'))).toBe(true)
    const json = await triageCandidate(
      candidate(),
      ARENAS,
      io({
        fetchPage: async (url) =>
          url.endsWith('/llms.txt') ? { status: 200, html: '{"hello":"world"}', contentType: 'application/json' } : page,
      }),
    )
    expect(json).toMatchObject({ status: 'skipped', criterion: 'agentic-surface' })
    expect(json.evidence.some((e) => e.includes('/llms.txt — HTTP 200, application/json'))).toBe(true)
  })

  it('skips an OSS repo whose README names no public API, MCP server, or agent docs', async () => {
    const d = await triageCandidate(
      candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' }),
      ARENAS,
      io({ fetchRepo: async () => ({ ...REPO_OK, description: 'a desktop theme pack', readmeHead: '## Quickstart\npip install x', readme: '## Quickstart\npip install x' }) }),
    )
    expect(d).toMatchObject({ status: 'skipped', criterion: 'agentic-surface', bringup: null })
    expect(d.reason).toContain('no citable agentic surface')
  })

  it('routes star-velocity anomalies to needs-human instead of auto-approving', async () => {
    const d = await triageCandidate(
      candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' }),
      ARENAS,
      io({ fetchRepo: async () => ({ ...REPO_OK, stars: 9000, createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() }) }),
    )
    expect(d).toMatchObject({ status: 'needs-human', criterion: 'shipped-product', bringup: null })
    expect(d.reason).toContain('anomaly floor')
  })

  it('routes young repos tripping either young-repo wire to needs-human on popularity grounds', async () => {
    const gh = candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' })
    // (a) rate: 20 days old at ~120/day (below the 500/day floor, above the young-repo floor).
    const rate = await triageCandidate(gh, ARENAS, io({ fetchRepo: async () => ({ ...REPO_OK, stars: 2400, createdAt: daysAgo(20), contributors: 500 }) }))
    expect(rate).toMatchObject({ status: 'needs-human', criterion: 'shipped-product', bringup: null })
    expect(rate.reason).toContain('young-repo floor')
    // (b) ratio: 75/day but 1500 stars on 10 contributors.
    const ratio = await triageCandidate(gh, ARENAS, io({ fetchRepo: async () => ({ ...REPO_OK, stars: 1500, createdAt: daysAgo(20), contributors: 10 }) }))
    expect(ratio).toMatchObject({ status: 'needs-human', criterion: 'shipped-product', bringup: null })
    expect(ratio.reason).toContain('stars-per-contributor')
  })

  it('fails open when the contributor count is unavailable, and keeps the old behavior for repos past 60 days', async () => {
    const gh = candidate({ url: 'https://github.com/acme/driftbase', key: 'github:acme/driftbase' })
    // Young repo, ratio would trip, but the count is unavailable and the rate is below its floor:
    // the candidate proceeds (fail-open) and the evidence records the unavailable count.
    const open = await triageCandidate(gh, ARENAS, io({ fetchRepo: async () => ({ ...REPO_OK, stars: 1500, createdAt: daysAgo(20), contributors: null }) }))
    expect(open.status).toBe('auto-approved')
    expect(open.evidence.some((e) => e.includes('contributors=unavailable'))).toBe(true)
    // A repo at 60+ days with an extreme stars-per-contributor ratio but sub-500/day velocity
    // auto-approves exactly as before the young-repo wires existed.
    const old = await triageCandidate(gh, ARENAS, io({ fetchRepo: async () => ({ ...REPO_OK, stars: 30_000, createdAt: daysAgo(120), contributors: 1 }) }))
    expect(old.status).toBe('auto-approved')
  })

  it('routes founder-affiliated candidates to needs-human before any other check', async () => {
    const d = await triageCandidate(candidate({ name: 'Ultrametric Radar' }), ARENAS, io())
    expect(d).toMatchObject({ status: 'needs-human', criterion: 'founder-affiliation', bringup: null })
  })
})

describe('triage report + markdown', () => {
  it('round-trips the schema and renders a disposition row per candidate with counts', async () => {
    const report = await triageReport({ candidates: [candidate(), candidate({ name: 'Ultrametric Radar', key: 'name:ultrametricradar' })] }, ARENAS, io())
    const parsed = TriageReportSchema.parse(report)
    expect(parsed.dispositions).toHaveLength(2)
    const md = buildTriageMarkdown(parsed)
    expect(md).toContain('1 auto-approved · 0 skipped · 1 needs-human')
    expect(md).toContain('policies/AGENT_POLICY.md')
    expect(md).toContain('| [Driftbase](https://driftbase.dev) → `browser-agents` | auto-approved |')
  })
})
