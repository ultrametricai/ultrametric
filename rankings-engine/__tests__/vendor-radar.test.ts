import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GITHUB_MIN_STARS,
  HN_MIN_POINTS,
  MAX_MATCHED_ARENAS,
  MIN_ARENA_HITS,
  RadarReportSchema,
  assembleCandidates,
  buildArenaVocab,
  buildMarkdown,
  candidateKey,
  extractLaunchName,
  ghCandidate,
  ghReposFromJson,
  githubStarsPerDay,
  hnCandidate,
  githubRepoKey,
  hnItemsFromJson,
  isHotHn,
  isHotRepo,
  isLaunchTitle,
  loadSeenLedger,
  matchArenas,
  mergeSeenEntries,
  normalizeName,
  parsePhEntries,
  phCandidate,
  ycCandidate,
  ycLaunchesFromJson,
  YC_LOOKBACK_DAYS,
  type RadarReport,
  type RawCandidate,
  type SeenEntry,
} from '../scripts/vendor-radar'

// Pure units for the vendor radar: fake HN/PH/GitHub items → arena matches, dedupe against the
// tracked fleet + seen-ledger, hotness thresholds, and the report/issue shape. NO network — the
// fetchers are exercised only through their pure parsers here (the committed inaugural
// reports/vendor-radar/ run is the integration evidence).

const NOW = new Date('2026-10-02T12:00:00Z')

// A tiny taxonomy standing in for categories.json + arena-sections.json. 'browser-agents' has a
// DOMAIN_VOCAB entry in the real tag-story-scopes vocabulary; 'made-up-arena' exercises the
// name/section-token fallback for arenas without one.
const VOCAB = buildArenaVocab(
  [
    { id: 'browser-agents', name: 'Browser Agents' },
    { id: 'made-up-arena', name: 'Identity Verification' },
  ],
  new Map([
    ['browser-agents', 'AI & Agents'],
    ['made-up-arena', 'Security & Identity'],
  ]),
)

describe('buildArenaVocab + matchArenas', () => {
  it('matches an arena through its DOMAIN_VOCAB nouns, counting distinct keywords', () => {
    const matches = matchArenas('Headless browser automation for AI agents with CAPTCHA solving', VOCAB)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].arena).toBe('browser-agents')
    expect(matches[0].hits).toBeGreaterThanOrEqual(MIN_ARENA_HITS)
    expect(matches[0].keywords).toContain('browser')
  })

  it('falls back to category-name + section-name tokens for arenas without DOMAIN_VOCAB', () => {
    const matches = matchArenas('Identity verification API for onboarding', VOCAB)
    expect(matches.map((m) => m.arena)).toContain('made-up-arena')
  })

  it(`requires ${MIN_ARENA_HITS} distinct keyword hits — one word is not an arena match`, () => {
    expect(matchArenas('A browser for reading recipes', VOCAB)).toEqual([])
    expect(matchArenas('Completely unrelated gardening newsletter', VOCAB)).toEqual([])
  })

  it(`caps at ${MAX_MATCHED_ARENAS} arenas, strongest first, deterministically`, () => {
    const matches = matchArenas(
      'Browser agent with headless playwright sessions, identity verification, and security onboarding',
      VOCAB,
    )
    expect(matches.length).toBeLessThanOrEqual(MAX_MATCHED_ARENAS)
    for (let i = 1; i < matches.length; i++) expect(matches[i - 1].hits).toBeGreaterThanOrEqual(matches[i].hits)
  })
})

describe('HN parsing + hotness', () => {
  it('extracts launch names from Show HN / Launch HN titles, stripping YC batch tags', () => {
    expect(extractLaunchName('Show HN: Driftbase – realtime sync for agents')).toBe('Driftbase')
    expect(extractLaunchName('Launch HN: Driftbase (YC W26) – realtime sync')).toBe('Driftbase')
    expect(extractLaunchName('Show HN: Driftbase')).toBe('Driftbase')
  })

  it('isLaunchTitle accepts launch-shaped front-page titles and rejects plain news', () => {
    expect(isLaunchTitle('Show HN: Anything')).toBe(true)
    expect(isLaunchTitle('Acme launches a hosted MCP gateway')).toBe(true)
    expect(isLaunchTitle('Introducing Driftbase')).toBe(true)
    expect(isLaunchTitle('Why I left my job at a bank')).toBe(false)
    expect(isLaunchTitle('The launchpad at Cape Canaveral')).toBe(false) // 'launchpad' is not 'launch'
  })

  it(`isHotHn: ≥${HN_MIN_POINTS} points always; fewer only when young and climbing`, () => {
    expect(isHotHn(HN_MIN_POINTS, 100)).toBe(true)
    expect(isHotHn(25, 2)).toBe(true) // 12.5 points/hour
    expect(isHotHn(25, 48)).toBe(false) // old and slow
    expect(isHotHn(10, 1)).toBe(false) // fast but below the fast-path floor
  })

  it('hnItemsFromJson + hnCandidate: hot Show HN story becomes a raw candidate, cold one does not', () => {
    const items = hnItemsFromJson({
      hits: [
        { objectID: '1', title: 'Show HN: Driftbase – browser agent sessions', url: 'https://driftbase.dev', points: 120, created_at: '2026-10-02T03:00:00Z' },
        { objectID: '2', title: 'Show HN: Coldstart – a thing', url: 'https://coldstart.io', points: 5, created_at: '2026-09-28T03:00:00Z' },
        { objectID: '3', title: 'Ask HN: malformed, no url', points: 99, created_at: '2026-10-01T00:00:00Z' },
      ],
    })
    expect(items).toHaveLength(3)
    const hot = hnCandidate(items[0], NOW)
    expect(hot).not.toBeNull()
    expect(hot?.name).toBe('Driftbase')
    expect(hot?.url).toBe('https://driftbase.dev')
    expect(hot?.sourceUrl).toBe('https://news.ycombinator.com/item?id=1')
    expect(hot?.evidence).toContain('120 points')
    expect(hnCandidate(items[1], NOW)).toBeNull()
    expect(hnCandidate(items[2], NOW)).toBeNull() // not launch-shaped
  })
})

describe('GitHub parsing + star velocity', () => {
  it('githubStarsPerDay / isHotRepo: both the stars floor and the velocity threshold bind', () => {
    expect(Math.round(githubStarsPerDay(300, '2026-09-29T12:00:00Z', NOW))).toBe(100)
    expect(isHotRepo(300, '2026-09-29T12:00:00Z', NOW)).toBe(true)
    expect(isHotRepo(GITHUB_MIN_STARS - 1, '2026-10-01T12:00:00Z', NOW)).toBe(false) // under floor
    expect(isHotRepo(300, '2026-08-03T12:00:00Z', NOW)).toBe(false) // 5/day — under velocity
  })

  it('ghReposFromJson + ghCandidate: homepage preferred, description+topics feed the matcher', () => {
    const repos = ghReposFromJson({
      items: [
        {
          full_name: 'acme/driftbase', name: 'driftbase', html_url: 'https://github.com/acme/driftbase',
          homepage: 'https://driftbase.dev', description: 'Headless browser sessions for agents',
          topics: ['playwright', 'agents'], stargazers_count: 900, created_at: '2026-09-25T00:00:00Z',
        },
      ],
    })
    const c = ghCandidate(repos[0], NOW)
    expect(c).not.toBeNull()
    expect(c?.url).toBe('https://driftbase.dev')
    expect(c?.sourceUrl).toBe('https://github.com/acme/driftbase')
    expect(c?.text).toContain('playwright')
    expect(c?.evidence).toMatch(/900 stars \(~\d+\/day\) since 2026-09-25/)
  })
})

const PH_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Driftbase</title>
    <link rel="alternate" href="https://www.producthunt.com/posts/driftbase"/>
    <published>2026-10-02T07:01:00Z</published>
    <content type="html">&lt;p&gt;Headless browser sessions for AI agents — playwright-compatible.&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Mug Buddy</title>
    <link rel="alternate" href="https://www.producthunt.com/posts/mug-buddy"/>
    <published>2026-10-02T07:02:00Z</published>
    <content type="html">A smart coaster that keeps coffee warm.</content>
  </entry>
</feed>`

describe('Product Hunt feed parsing', () => {
  it('parsePhEntries pulls name, post link, date, and the content snippet for matching', () => {
    const entries = parsePhEntries(PH_FIXTURE)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      name: 'Driftbase',
      url: 'https://www.producthunt.com/posts/driftbase',
      date: '2026-10-02',
    })
    expect(entries[0].text).toContain('playwright-compatible')
  })

  it('phCandidate states the keyless-votes honesty line verbatim in its evidence', () => {
    const c = phCandidate(parsePhEntries(PH_FIXTURE)[0])
    expect(c.evidence).toContain('vote counts are not exposed keylessly')
  })
})

// Shape verified against the live endpoint 2026-10-21: Algolia-style {hits,...} pages with the
// company block carrying the product's own URL, batch, and tags.
const YC_FIXTURE = {
  hits: [
    {
      id: 1, title: 'Driftbase - Browser sessions for AI agents', tagline: 'Headless playwright sessions for agents.',
      slug: 'abc-driftbase', created_at: '2026-10-01T19:00:00.000Z', total_vote_count: 42,
      company: { name: 'Driftbase', url: 'https://driftbase.dev', tags: ['AI', 'Developer Tools'], batch: 'Fall 2026' },
      search_path: 'https://www.ycombinator.com/launches/abc-driftbase',
    },
    {
      id: 2, title: 'Mug Buddy - Coffee, warm', tagline: 'A smart coaster.',
      slug: 'xyz-mug-buddy', created_at: '2026-08-01T19:00:00.000Z', total_vote_count: 7,
      company: { name: 'Mug Buddy', tags: [], batch: 'Summer 2026' },
      search_path: 'https://www.ycombinator.com/launches/xyz-mug-buddy',
    },
    { id: 3, title: 'Malformed, no search_path', created_at: '2026-10-01T00:00:00Z' },
  ],
  nbHits: 3345, page: 0, nbPages: 50, hitsPerPage: 20,
}

describe('YC Launches parsing', () => {
  it('ycLaunchesFromJson keeps well-formed launches with company url/batch/tags, drops malformed ones', () => {
    const launches = ycLaunchesFromJson(YC_FIXTURE)
    expect(launches).toHaveLength(2)
    expect(launches[0]).toMatchObject({ votes: 42, url: 'https://www.ycombinator.com/launches/abc-driftbase' })
    expect(launches[0].company).toEqual({ name: 'Driftbase', url: 'https://driftbase.dev', batch: 'Fall 2026', tags: ['AI', 'Developer Tools'] })
    expect(launches[1].company.url).toBeNull()
  })

  it(`ycCandidate keeps launches within ${YC_LOOKBACK_DAYS}d, verbatim vote/batch evidence, product URL preferred`, () => {
    const [inWindow, stale] = ycLaunchesFromJson(YC_FIXTURE)
    const c = ycCandidate(inWindow, NOW)
    expect(c).not.toBeNull()
    expect(c?.kind).toBe('yc-launches')
    expect(c?.name).toBe('Driftbase')
    expect(c?.url).toBe('https://driftbase.dev')
    expect(c?.sourceUrl).toBe('https://www.ycombinator.com/launches/abc-driftbase')
    expect(c?.text).toContain('playwright')
    expect(c?.evidence).toBe('YC launch, 42 votes (posted 2026-10-01, batch Fall 2026)')
    expect(ycCandidate(stale, NOW)).toBeNull() // outside the lookback window
  })

  it('a launch without a company URL keys by name — ycombinator.com is a post host, never a product domain', () => {
    const stale = ycLaunchesFromJson(YC_FIXTURE)[1]
    const c = ycCandidate(stale, new Date('2026-08-02T12:00:00Z'))
    expect(c?.url).toBe('https://www.ycombinator.com/launches/xyz-mug-buddy')
    expect(candidateKey(c!)).toBe('name:mugbuddy')
  })
})

describe('candidateKey + normalizeName', () => {
  it('keys by product domain when public, never by an aggregator host', () => {
    expect(candidateKey({ kind: 'hn', name: 'Driftbase', url: 'https://www.driftbase.dev/x', title: 't' })).toBe('domain:driftbase.dev')
    expect(candidateKey({ kind: 'github', name: 'driftbase', url: 'https://github.com/acme/driftbase', title: 'acme/driftbase' })).toBe('github:acme/driftbase')
    expect(candidateKey({ kind: 'producthunt', name: 'Mug Buddy', url: 'https://www.producthunt.com/posts/mug-buddy', title: 'Mug Buddy' })).toBe('name:mugbuddy')
  })

  it('a github repo URL keys as github:owner/repo whatever source surfaced it (no per-source drift)', () => {
    expect(candidateKey({ kind: 'hn', name: 'Driftbase', url: 'https://github.com/acme/driftbase', title: 'Show HN: Driftbase' })).toBe('github:acme/driftbase')
    expect(githubRepoKey('https://github.com/Acme/Driftbase/tree/main')).toBe('github:acme/driftbase')
    expect(githubRepoKey('https://driftbase.dev')).toBeNull()
  })

  it('a shared listing host (pypi, npm, app stores) never becomes a bare-domain key', () => {
    expect(candidateKey({ kind: 'github', name: 'laya-mlx', url: 'https://pypi.org/project/laya-mlx/', title: 'mizorewww/laya-mlx' })).toBe('github:mizorewww/laya-mlx')
    expect(candidateKey({ kind: 'hn', name: 'Laya MLX', url: 'https://pypi.org/project/laya-mlx/', title: 'Show HN: Laya MLX' })).toBe('name:layamlx')
  })

  it('normalizeName collapses case and punctuation', () => {
    expect(normalizeName('Drift-Base 2.0')).toBe('driftbase20')
  })
})

function raw(partial: Partial<RawCandidate>): RawCandidate {
  return {
    kind: 'hn',
    name: 'Driftbase',
    url: 'https://driftbase.dev',
    sourceUrl: 'https://news.ycombinator.com/item?id=1',
    title: 'Show HN: Driftbase',
    text: 'Headless browser sessions for AI agents with playwright',
    evidence: 'Show HN, 120 points in 9h',
    ...partial,
  }
}

const EMPTY_CTX = () => ({
  trackedDomains: new Set<string>(),
  trackedNames: new Set<string>(),
  trackedRepos: new Set<string>(),
  seenKeys: new Set<string>(),
})

describe('assembleCandidates', () => {
  it('keeps arena-matched items, drops non-matching ones, stamps firstSeen with the run date', () => {
    const { candidates } = assembleCandidates(
      [raw({}), raw({ name: 'Mug Buddy', url: 'https://mugbuddy.com', sourceUrl: 'https://news.ycombinator.com/item?id=2', text: 'A smart coaster that keeps coffee warm' })],
      VOCAB,
      EMPTY_CTX(),
      '2026-10-02',
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0].name).toBe('Driftbase')
    expect(candidates[0].firstSeen).toBe('2026-10-02')
    expect(candidates[0].matchedArenas[0].arena).toBe('browser-agents')
  })

  it('dedupes against tracked product domains AND tracked names AND tracked github repos', () => {
    const byDomain = assembleCandidates([raw({})], VOCAB, { ...EMPTY_CTX(), trackedDomains: new Set(['driftbase.dev']) }, '2026-10-02')
    expect(byDomain.candidates).toEqual([])
    expect(byDomain.skippedTracked).toBe(1)
    const byName = assembleCandidates([raw({})], VOCAB, { ...EMPTY_CTX(), trackedNames: new Set(['driftbase']) }, '2026-10-02')
    expect(byName.candidates).toEqual([])
    expect(byName.skippedTracked).toBe(1)
    // 'Driftbase by Acme' misses the exact-name check, but its repo URL matches the roster's urls.github.
    const byRepo = assembleCandidates(
      [raw({ name: 'Driftbase by Acme', url: 'https://github.com/acme/driftbase' })],
      VOCAB,
      { ...EMPTY_CTX(), trackedRepos: new Set(['github:acme/driftbase']) },
      '2026-10-02',
    )
    expect(byRepo.candidates).toEqual([])
    expect(byRepo.skippedTracked).toBe(1)
  })

  it('dedupes against the seen-ledger so a candidate surfaces exactly once', () => {
    const first = assembleCandidates([raw({})], VOCAB, EMPTY_CTX(), '2026-10-01')
    expect(first.candidates).toHaveLength(1)
    const seenKeys = new Set(first.candidates.map((c) => c.key))
    const second = assembleCandidates([raw({})], VOCAB, { ...EMPTY_CTX(), seenKeys }, '2026-10-02')
    expect(second.candidates).toEqual([])
    expect(second.skippedSeen).toBe(1)
  })

  it('merges same-key items from different sources into one candidate with every source link', () => {
    const gh = raw({
      kind: 'github',
      sourceUrl: 'https://github.com/acme/driftbase',
      title: 'acme/driftbase',
      evidence: '900 stars (~128/day) since 2026-09-25',
    })
    const { candidates } = assembleCandidates([raw({}), gh], VOCAB, EMPTY_CTX(), '2026-10-02')
    expect(candidates).toHaveLength(1)
    expect(candidates[0].sources.map((s) => s.kind).sort()).toEqual(['github', 'hn'])
  })
})

function reportOf(candidates: ReturnType<typeof assembleCandidates>['candidates']): RadarReport {
  return RadarReportSchema.parse({
    generatedAt: NOW.toISOString(),
    date: '2026-10-02',
    thresholds: { HN_MIN_POINTS },
    sources: [
      { kind: 'hn', queried: 'fixture', items: 2, error: null },
      { kind: 'producthunt', queried: 'fixture', items: 2, error: null },
      { kind: 'github', queried: 'fixture', items: 1, error: 'HTTP 403' },
    ],
    skipped: { tracked: 1, alreadySeen: 0, overflow: 0 },
    candidates,
  })
}

describe('report + issue markdown', () => {
  it('the report round-trips its own schema (the shape the workflow and ledger rely on)', () => {
    const { candidates } = assembleCandidates([raw({})], VOCAB, EMPTY_CTX(), '2026-10-02')
    const report = reportOf(candidates)
    expect(report.candidates).toHaveLength(1)
    expect(report.candidates[0].key).toBe('domain:driftbase.dev')
  })

  it('markdown carries the criteria-triage line, evidence links, and the no-new-rankings statement', () => {
    const { candidates } = assembleCandidates([raw({})], VOCAB, EMPTY_CTX(), '2026-10-02')
    const md = buildMarkdown(reportOf(candidates))
    expect(md).toContain('- [ ] **Driftbase** — https://driftbase.dev')
    expect(md).toContain('NEVER creates a new ranking and NEVER touches a founder-affiliated product')
    expect(md).toContain('auto-approval criteria in `policies/AGENT_POLICY.md`')
    expect(md).toContain('runs via the standard engine stages')
    expect(md).toContain('[Show HN: Driftbase](https://news.ycombinator.com/item?id=1)')
    expect(md).toContain('github: ERROR (HTTP 403)') // degraded sources stay visible, never hidden
  })

  it('an empty run says so honestly instead of inventing candidates', () => {
    const md = buildMarkdown(reportOf([]))
    expect(md).toContain('No new candidates this run')
  })
})

describe('seen-ledger IO', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-seen-'))

  it('a missing ledger is a legitimate first run (null)', () => {
    expect(loadSeenLedger(path.join(tmp, 'nope.json'))).toBeNull()
  })

  it('a corrupt ledger FAILS the run instead of silently wiping the seen-history', () => {
    const corrupt = path.join(tmp, 'corrupt.json')
    fs.writeFileSync(corrupt, '{"updatedAt": "2026-10-02"') // truncated JSON
    expect(() => loadSeenLedger(corrupt)).toThrow(/refusing to run/)
    const wrongShape = path.join(tmp, 'wrong-shape.json')
    fs.writeFileSync(wrongShape, JSON.stringify({ updatedAt: 'x', seen: [{ key: 1 }] }))
    expect(() => loadSeenLedger(wrongShape)).toThrow(/refusing to run/)
  })

  it('a valid ledger loads', () => {
    const ok = path.join(tmp, 'ok.json')
    fs.writeFileSync(ok, JSON.stringify({ updatedAt: 'x', seen: [{ key: 'domain:a.dev', name: 'A', firstSeen: '2026-10-01', sources: ['https://a.dev'] }] }))
    expect(loadSeenLedger(ok)?.seen).toHaveLength(1)
  })
})

describe('mergeSeenEntries', () => {
  const entry = (key: string, firstSeen: string, sources: string[]): SeenEntry => ({ key, name: key, firstSeen, sources })

  it('unions by key, keeps the earliest firstSeen, merges sources, and sorts', () => {
    const merged = mergeSeenEntries([
      [entry('name:b', '2026-10-03', ['https://s1'])],
      [entry('name:a', '2026-10-02', ['https://s2']), entry('name:b', '2026-10-01', ['https://s1', 'https://s3'])],
    ])
    expect(merged.map((e) => e.key)).toEqual(['name:a', 'name:b'])
    expect(merged[1].firstSeen).toBe('2026-10-01')
    expect(merged[1].sources).toEqual(['https://s1', 'https://s3'])
  })
})
