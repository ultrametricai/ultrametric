// Pure-function tests for the accuracy engine's staleness scanner
// (pipeline/scripts/staleness-scan.ts): age math, the audit signatures (api-quality gap, the
// cline agent-docs contradiction), flip candidacy, citation sampling, and the ranking score —
// no network, no fs.
import { describe, expect, it } from 'vitest'
import type { Evidence, Story, Verdict } from '@/lib/schemas'
import {
  ageDays,
  buildIssueBody,
  hasAgentDocsContradiction,
  hasApiQualityGap,
  isDeadStatus,
  isLlmsFlipCandidate,
  mcpFlipEndpoint,
  recordsAbsence,
  stalenessScore,
  topCitedUrls,
  type StalenessReport,
} from '@/pipeline/scripts/staleness-scan'

const ev = (id: string, overrides: Partial<Evidence> = {}): Evidence => ({
  id,
  tier: 'probe',
  url: `https://docs.acme.example/${id}`,
  excerpt: 'PROBE runtime: something',
  fetchedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
})

const verdict = (storyId: string, v: Verdict['verdict'], evidenceIds: string[] = [], productId = 'acme'): Verdict => ({
  productId,
  storyId,
  verdict: v,
  quality: v === 'none' || v === 'na' ? 0 : 5,
  confidence: 'medium',
  rationale: 'test',
  evidenceIds,
})

const story = (id: string, group: string, theme = 'agenticness'): Story => ({
  id,
  persona: 'ai-native',
  title: `As an AI-native user, ${id}`,
  theme,
  group,
  weight: 2,
})

describe('ageDays', () => {
  const now = new Date('2026-09-11T00:00:00.000Z')

  it('computes median and oldest in whole days', () => {
    const pack = [
      ev('a', { fetchedAt: '2026-09-10T00:00:00.000Z' }), // 1 day
      ev('b', { fetchedAt: '2026-09-01T00:00:00.000Z' }), // 10 days
      ev('c', { fetchedAt: '2026-06-13T00:00:00.000Z' }), // 90 days
    ]
    expect(ageDays(pack, now)).toEqual({ median: 10, oldest: 90 })
  })

  it('returns nulls for an empty pack and clamps future timestamps to 0', () => {
    expect(ageDays([], now)).toEqual({ median: null, oldest: null })
    expect(ageDays([ev('a', { fetchedAt: '2027-01-01T00:00:00.000Z' })], now)).toEqual({ median: 0, oldest: 0 })
  })
})

describe('hasApiQualityGap (the 54-product audit signature)', () => {
  const stories = [
    story('agentic-public-api', 'agent-access'),
    story('api-machine-spec', 'api-quality'),
    story('api-sandbox', 'api-quality'),
  ]

  it('flags full public-api with all api-quality cells zero-evidence none', () => {
    const verdicts = [
      verdict('agentic-public-api', 'full', ['e1']),
      verdict('api-machine-spec', 'none'),
      verdict('api-sandbox', 'none'),
    ]
    expect(hasApiQualityGap(stories, verdicts, 'acme')).toBe(true)
  })

  it('does not flag when any api-quality cell has evidence or a non-none verdict', () => {
    expect(hasApiQualityGap(stories, [
      verdict('agentic-public-api', 'full', ['e1']),
      verdict('api-machine-spec', 'partial', ['e2']),
      verdict('api-sandbox', 'none'),
    ], 'acme')).toBe(false)
    // An evidenced none is a REAL none — the crawl looked and found nothing.
    expect(hasApiQualityGap(stories, [
      verdict('agentic-public-api', 'full', ['e1']),
      { ...verdict('api-machine-spec', 'none'), evidenceIds: ['e3'] },
      verdict('api-sandbox', 'none'),
    ], 'acme')).toBe(false)
  })

  it('does not flag when the public API itself is none/na', () => {
    expect(hasApiQualityGap(stories, [
      verdict('agentic-public-api', 'none'),
      verdict('api-machine-spec', 'none'),
      verdict('api-sandbox', 'none'),
    ], 'acme')).toBe(false)
  })
})

describe('hasAgentDocsContradiction (the cline signature)', () => {
  const positiveLlms = ev('llms', { excerpt: 'PROBE llms.txt: HTTP 200 at https://docs.acme.example/llms.txt # Acme' })

  it('flags a zero-evidence agent-docs none alongside a positive llms.txt probe', () => {
    expect(hasAgentDocsContradiction([positiveLlms], [verdict('agentic-agent-docs', 'none')], 'acme')).toBe(true)
  })

  it('stays quiet when the verdict cites evidence, is non-none, or the probe is negative', () => {
    expect(hasAgentDocsContradiction([positiveLlms], [verdict('agentic-agent-docs', 'partial', ['llms'])], 'acme')).toBe(false)
    expect(hasAgentDocsContradiction(
      [ev('llms', { excerpt: 'PROBE llms.txt: HTTP 404 at https://docs.acme.example/llms.txt' })],
      [verdict('agentic-agent-docs', 'none')],
      'acme',
    )).toBe(false)
    // claimed-docs tier quoting the same words is not a probe verification
    expect(hasAgentDocsContradiction(
      [ev('llms', { tier: 'claimed-docs', excerpt: 'PROBE llms.txt: HTTP 200 at x' })],
      [verdict('agentic-agent-docs', 'none')],
      'acme',
    )).toBe(false)
  })

  it('ignores a positive probe at a shared code-host origin (the llama-cpp false positive)', () => {
    const foreign = ev('llms', {
      url: 'https://github.com/llms.txt',
      excerpt: 'PROBE llms.txt: HTTP 200 at https://github.com/llms.txt # GitHub',
    })
    expect(hasAgentDocsContradiction([foreign], [verdict('agentic-agent-docs', 'none')], 'acme')).toBe(false)
  })
})

describe('isLlmsFlipCandidate', () => {
  it('is a candidate only when agent-docs is none AND no positive probe exists', () => {
    expect(isLlmsFlipCandidate([], [verdict('agentic-agent-docs', 'none')], 'acme')).toBe(true)
    expect(isLlmsFlipCandidate(
      [ev('llms', { excerpt: 'PROBE llms.txt: HTTP 200 at x' })],
      [verdict('agentic-agent-docs', 'none')],
      'acme',
    )).toBe(false) // that's the contradiction case — no live fetch needed
    expect(isLlmsFlipCandidate([], [verdict('agentic-agent-docs', 'partial', ['e'])], 'acme')).toBe(false)
    expect(isLlmsFlipCandidate([], [], 'acme')).toBe(false) // story absent in this arena
  })
})

describe('mcpFlipEndpoint', () => {
  it('flags an allowlisted endpoint whose mcp-server verdict is none', () => {
    // payments/stripe is in the committed allowlist (lib/mcpEndpoints.ts)
    expect(mcpFlipEndpoint('payments', 'stripe', [verdict('agentic-mcp-server', 'none', [], 'stripe')]))
      .toMatch(/^https:\/\/mcp\.stripe\.com\//)
    expect(mcpFlipEndpoint('payments', 'stripe', [verdict('agentic-mcp-server', 'full', ['e'], 'stripe')])).toBeNull()
    expect(mcpFlipEndpoint('payments', 'not-allowlisted', [verdict('agentic-mcp-server', 'none', [], 'not-allowlisted')])).toBeNull()
  })
})

describe('recordsAbsence', () => {
  it('recognizes negative probes whose URL 404ing live is consistent, not stale', () => {
    expect(recordsAbsence(ev('a', { excerpt: 'PROBE llms.txt: HTTP 404 at https://x.example/llms.txt' }))).toBe(true)
    expect(recordsAbsence(ev('b', { excerpt: 'PROBE openapi: all candidate paths 404 (/openapi.json, /swagger.json)' }))).toBe(true)
    expect(recordsAbsence(ev('c', { excerpt: 'PROBE mcp-link: HTTP 404 at https://x.example/mcp (curated link may be stale)' }))).toBe(true)
    // positives and auth walls are live resources worth re-checking
    expect(recordsAbsence(ev('d', { excerpt: 'PROBE llms.txt: HTTP 200 at https://x.example/llms.txt' }))).toBe(false)
    expect(recordsAbsence(ev('e', { excerpt: 'PROBE runtime: POST returned HTTP 401 with an OAuth challenge' }))).toBe(false)
    expect(recordsAbsence(ev('f', { tier: 'claimed-docs', excerpt: 'docs mention HTTP 404 at some point' }))).toBe(false)
  })
})

describe('topCitedUrls', () => {
  it('excludes negative-probe artifacts from the dead-link sample', () => {
    const pack = [
      ev('neg', { url: 'https://x.example/openapi.json', excerpt: 'PROBE openapi: HTTP 404 at https://x.example/openapi.json' }),
      ev('pos', { url: 'https://x.example/docs' }),
    ]
    const verdicts = [verdict('s1', 'none', ['neg']), verdict('s2', 'partial', ['pos'])]
    expect(topCitedUrls(pack, verdicts, 'acme', 5)).toEqual(['https://x.example/docs'])
  })

  it('ranks by citation count then url, https-only, capped', () => {
    const pack = [
      ev('e1', { url: 'https://a.example/one' }),
      ev('e2', { url: 'https://b.example/two' }),
      ev('e3', { url: 'https://c.example/three' }),
      ev('e4', { url: 'http://insecure.example/' }),
    ]
    const verdicts = [
      verdict('s1', 'full', ['e2', 'e4']),
      verdict('s2', 'partial', ['e2', 'e1']),
      verdict('s3', 'partial', ['e3', 'e1'], 'other-product'), // other product's citations ignored
    ]
    expect(topCitedUrls(pack, verdicts, 'acme', 2)).toEqual(['https://b.example/two', 'https://a.example/one'])
  })
})

describe('isDeadStatus + stalenessScore', () => {
  it('treats 404/410/no-response as dead, auth and server blips as alive', () => {
    expect([0, 404, 410].every(isDeadStatus)).toBe(true)
    expect([200, 301, 401, 403, 405, 429, 500, 503].some(isDeadStatus)).toBe(false)
  })

  it('ranks contradictions and flips above pure age, capped at 100', () => {
    const fresh = stalenessScore({ medianAgeDays: 5, deadCitedUrls: 0, apiQualityGap: false, agentDocsContradiction: false, llmsTxtFlip: false, mcpFlip: false })
    expect(fresh).toBe(0)
    const aged = stalenessScore({ medianAgeDays: 210, deadCitedUrls: 0, apiQualityGap: false, agentDocsContradiction: false, llmsTxtFlip: false, mcpFlip: false })
    expect(aged).toBe(40)
    const contradicted = stalenessScore({ medianAgeDays: 5, deadCitedUrls: 0, apiQualityGap: false, agentDocsContradiction: true, llmsTxtFlip: true, mcpFlip: false })
    expect(contradicted).toBe(40)
    expect(contradicted).toBeGreaterThan(fresh)
    const everything = stalenessScore({ medianAgeDays: 999, deadCitedUrls: 5, apiQualityGap: true, agentDocsContradiction: true, llmsTxtFlip: true, mcpFlip: true })
    expect(everything).toBe(100)
    // no evidence at all maxes the age axis
    expect(stalenessScore({ medianAgeDays: null, deadCitedUrls: 0, apiQualityGap: false, agentDocsContradiction: false, llmsTxtFlip: false, mcpFlip: false })).toBe(40)
  })
})

describe('buildIssueBody', () => {
  it('renders the ranked tables and flip callouts', () => {
    const report: StalenessReport = {
      generatedAt: '2026-09-14T00:00:00.000Z',
      offline: false,
      fleet: { arenas: 2, products: 2, urlsChecked: 3, deadUrls: 1, apiQualityGaps: 1, agentDocsContradictions: 0, llmsTxtFlips: 1, mcpFlips: 0 },
      arenasRanked: ['payments', 'ai-coding'],
      arenas: [
        { arena: 'payments', staleness: 55, products: 1 },
        { arena: 'ai-coding', staleness: 12, products: 1 },
      ],
      products: [
        {
          arena: 'payments',
          productId: 'acme-pay',
          staleness: 55,
          signals: {
            evidenceCount: 4, medianAgeDays: 120, oldestAgeDays: 200,
            deadCitedUrls: [{ url: 'https://dead.example/doc', status: 404 }], checkedUrls: 2,
            apiQualityGap: true, agentDocsContradiction: false,
            llmsTxtFlip: { url: 'https://acme-pay.example/llms.txt', status: 200 }, mcpFlip: null,
          },
        },
        {
          arena: 'ai-coding',
          productId: 'fresh-tool',
          staleness: 12,
          signals: {
            evidenceCount: 9, medianAgeDays: 80, oldestAgeDays: 90,
            deadCitedUrls: [], checkedUrls: 2,
            apiQualityGap: false, agentDocsContradiction: false, llmsTxtFlip: null, mcpFlip: null,
          },
        },
      ],
    }
    const body = buildIssueBody(report, 5)
    expect(body).toContain('## Accuracy-engine work queue — 2026-09-14')
    expect(body).toContain('| 1 | payments | 55 | 1 |')
    expect(body).toContain('| 1 | acme-pay | payments | 55 | age 120d · 1 dead url · api-quality gap · llms.txt flip |')
    expect(body).toContain('https://acme-pay.example/llms.txt answers HTTP 200 live right now')
    expect(body).not.toContain('undefined')
  })
})
