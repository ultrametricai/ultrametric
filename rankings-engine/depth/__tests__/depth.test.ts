import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../../paths'
import type { CertifyFetcher, CertifyFetchInit, CertifyFetchResult } from '../../scripts/certify'
import {
  ARENABENCH_VERSION,
  computeSurfaceLadder,
  type DepthCheckResult,
  type DepthTranscript,
} from '../arenabench'
import { DEPTH_TARGETS, STRIPE_TARGET, type DepthCheckDef } from '../checks'
import { digestLlmsTxt, digestOpenapi } from '../digests'
import { robotsAllows } from '../robots'
import { buildReport, makeRobotsGate, recordCheck, runDepth } from '../runner'

// ---------------------------------------------------------------------------
// Mock-fetcher harness (the certify.test.ts route-table pattern): routes keyed by
// "<METHOD> <url>"; a route may be a function of the init so one URL can answer
// differently per request body (the MCP endpoint takes three distinct POSTs).
// ---------------------------------------------------------------------------

type RouteResult = Partial<CertifyFetchResult> | 'network-error'
type Route = RouteResult | ((init?: CertifyFetchInit) => RouteResult)

function fetcherFor(routes: Record<string, Route>, calls: string[] = []): CertifyFetcher {
  return async (url, init) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    calls.push(key)
    const route = typeof routes[key] === 'function' ? (routes[key] as (i?: CertifyFetchInit) => RouteResult)(init) : routes[key]
    if (route === 'network-error') throw new Error('boom')
    if (!route) return { status: 404, contentType: 'text/html', body: '<!doctype html><html>not found</html>', headers: {} }
    return { status: 200, contentType: 'text/plain', body: '', headers: {}, ...route }
  }
}

const STRIPE_ERROR_401 = {
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ error: { message: 'You did not provide an API key.', type: 'invalid_request_error' } }),
}

const MCP_401 = {
  status: 401,
  contentType: 'application/json',
  body: '{"error": "unauthorized"}',
  headers: { 'www-authenticate': 'Bearer resource_metadata=https://mcp.stripe.com/.well-known/oauth-protected-resource' },
}

const SPEC_OK = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Stripe API' },
  paths: { '/v1/charges': { get: { responses: { '200': {} } }, post: { responses: { '200': {} } } } },
  components: { schemas: { charge: {}, error: { properties: { error: { type: 'object' } } } } },
})

const LLMS_OK = [
  '# Stripe docs',
  '',
  '- [API](https://docs.stripe.com/api.md)',
  '- [Testing](https://docs.stripe.com/testing.md)',
  'x'.repeat(120),
].join('\n')

// A mock Stripe world: docs + API answer keylessly, raw.githubusercontent is robots-walled so
// the spec comes from the documented repo's CDN mirror, and everything behind OAuth 401s.
function stripeRoutes(): Record<string, Route> {
  return {
    'GET https://docs.stripe.com/robots.txt': { body: 'User-agent: *\nDisallow: /admin\n' },
    'GET https://docs.stripe.com/mcp.md': { contentType: 'text/markdown', body: '# MCP\nThe hosted server is at https://mcp.stripe.com.' },
    'GET https://docs.stripe.com/api.md': { contentType: 'text/markdown', body: '# API reference' },
    'GET https://docs.stripe.com/llms.txt': { contentType: 'text/markdown', body: LLMS_OK },
    'GET https://mcp.stripe.com/robots.txt': { status: 404, contentType: 'text/plain', body: '' },
    'POST https://mcp.stripe.com': () => MCP_401,
    'GET https://mcp.stripe.com/.well-known/oauth-protected-resource': {
      contentType: 'application/json',
      body: JSON.stringify({ resource: 'https://mcp.stripe.com', authorization_servers: ['https://marketplace.stripe.com'] }),
    },
    'GET https://api.stripe.com/robots.txt': { status: 404, contentType: 'text/plain', body: '' },
    'GET https://api.stripe.com/': STRIPE_ERROR_401,
    'GET https://api.stripe.com/v1/charges': STRIPE_ERROR_401,
    'GET https://api.stripe.com/v1/customers': STRIPE_ERROR_401,
    'GET https://api.stripe.com/v1/ultrametric-depth-nonexistent': STRIPE_ERROR_401,
    'GET https://raw.githubusercontent.com/robots.txt': { body: 'User-agent: *\nDisallow: /\n' },
    'GET https://cdn.jsdelivr.net/robots.txt': { status: 404, contentType: 'text/plain', body: '' },
    'GET https://cdn.jsdelivr.net/gh/stripe/openapi@master/openapi/spec3.json': { contentType: 'application/json', body: SPEC_OK },
  }
}

const fixedNow = () => '2026-01-01T00:00:00.000Z'

// ---------------------------------------------------------------------------
// robots.txt evaluation
// ---------------------------------------------------------------------------

describe('robotsAllows', () => {
  it('applies the * group when no token matches', () => {
    const body = 'User-agent: *\nDisallow: /private\n'
    expect(robotsAllows(body, '/public', 'ultrametric-depth').allowed).toBe(true)
    expect(robotsAllows(body, '/private/x', 'ultrametric-depth').allowed).toBe(false)
  })

  it('prefers the most specific matching user-agent group', () => {
    const body = 'User-agent: *\nDisallow: /\n\nUser-agent: ultrametric\nAllow: /\n'
    expect(robotsAllows(body, '/anything', 'ultrametric-depth').allowed).toBe(true)
    expect(robotsAllows(body, '/anything', 'otherbot').allowed).toBe(false)
  })

  it('longest matching rule wins; allow wins ties', () => {
    const body = 'User-agent: *\nDisallow: /docs\nAllow: /docs/open\n'
    expect(robotsAllows(body, '/docs/secret', '*').allowed).toBe(false)
    expect(robotsAllows(body, '/docs/open/page', '*').allowed).toBe(true)
  })

  it('supports * wildcards and $ anchors', () => {
    const body = 'User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp*\n'
    expect(robotsAllows(body, '/guide.pdf', '*').allowed).toBe(false)
    expect(robotsAllows(body, '/guide.pdf.html', '*').allowed).toBe(true)
    expect(robotsAllows(body, '/tmp-cache/x', '*').allowed).toBe(false)
  })

  it('empty Disallow and empty files allow everything', () => {
    expect(robotsAllows('User-agent: *\nDisallow:\n', '/x', '*').allowed).toBe(true)
    expect(robotsAllows('', '/x', '*').allowed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Digests
// ---------------------------------------------------------------------------

describe('digestOpenapi', () => {
  it('summarizes a valid spec', () => {
    const d = digestOpenapi(SPEC_OK)
    expect(d).toMatchObject({
      parses: true,
      openapi: '3.0.0',
      title: 'Stripe API',
      pathCount: 1,
      operationCount: 2,
      operationsWithResponses: 2,
      componentSchemaCount: 2,
      errorSchemaFields: ['error'],
    })
  })

  it('reports non-JSON bodies as unparseable', () => {
    expect(digestOpenapi('<!doctype html>').parses).toBe(false)
  })
})

describe('digestLlmsTxt', () => {
  it('counts markdown doc links and headings', () => {
    const d = digestLlmsTxt(LLMS_OK, 'https://docs.stripe.com/llms.txt')
    expect(d.mdLinkCount).toBe(2)
    expect(d.headingCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Ladder math
// ---------------------------------------------------------------------------

function result(partial: Partial<DepthCheckResult> & Pick<DepthCheckResult, 'checkId' | 'level' | 'outcome'>): DepthCheckResult {
  return { surface: 'mcp', title: '', detail: '', evidence: '', docUrl: '', ...partial }
}

describe('computeSurfaceLadder', () => {
  it('climbs through fully-passed levels', () => {
    const ladder = computeSurfaceLadder('mcp', [
      result({ checkId: 'a', level: 1, outcome: 'pass' }),
      result({ checkId: 'b', level: 2, outcome: 'pass' }),
    ])
    expect(ladder.rung).toBe(2)
    expect(ladder.partial).toBeUndefined()
    expect(ladder.blocked).toBeUndefined()
  })

  it('a pass/auth-gated mix stops the climb and is reported as partial, not averaged', () => {
    const ladder = computeSurfaceLadder('mcp', [
      result({ checkId: 'a', level: 1, outcome: 'pass' }),
      result({ checkId: 'b', level: 2, outcome: 'pass' }),
      result({ checkId: 'c', level: 3, outcome: 'pass' }),
      result({ checkId: 'd', level: 3, outcome: 'auth-gated', detail: 'needs OAuth' }),
      result({ checkId: 'e', level: 4, outcome: 'auth-gated' }),
    ])
    expect(ladder.rung).toBe(2)
    expect(ladder.partial).toEqual({
      level: 3,
      verified: ['c'],
      unverified: [{ checkId: 'd', outcome: 'auth-gated', detail: 'needs OAuth' }],
    })
  })

  it('a failed check blocks the ladder at its level', () => {
    const ladder = computeSurfaceLadder('mcp', [
      result({ checkId: 'a', level: 1, outcome: 'pass' }),
      result({ checkId: 'b', level: 2, outcome: 'fail' }),
      result({ checkId: 'c', level: 3, outcome: 'pass' }),
    ])
    expect(ladder.rung).toBe(1)
    expect(ladder.blocked).toEqual({ level: 2, failed: ['b'] })
  })

  it('robots-disallowed is a recorded wall, not a block', () => {
    const ladder = computeSurfaceLadder('mcp', [
      result({ checkId: 'a', level: 1, outcome: 'pass' }),
      result({ checkId: 'b', level: 2, outcome: 'robots-disallowed', detail: 'walled' }),
    ])
    expect(ladder.rung).toBe(1)
    expect(ladder.blocked).toBeUndefined()
    expect(ladder.partial).toEqual({
      level: 2,
      verified: [],
      unverified: [{ checkId: 'b', outcome: 'robots-disallowed', detail: 'walled' }],
    })
  })

  it('a level with only declared walls yields partial with nothing verified', () => {
    const ladder = computeSurfaceLadder('mcp', [
      result({ checkId: 'a', level: 1, outcome: 'pass' }),
      result({ checkId: 'b', level: 2, outcome: 'auth-gated', detail: 'wall' }),
    ])
    expect(ladder.rung).toBe(1)
    expect(ladder.partial?.level).toBe(2)
    expect(ladder.partial?.verified).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Recording + grading against the mock Stripe world (no network anywhere).
// ---------------------------------------------------------------------------

describe('runDepth against the mock Stripe world', () => {
  it('grades the expected ladder: both surfaces verified to L2 with partial L3', async () => {
    const calls: string[] = []
    const { report } = await runDepth(STRIPE_TARGET, { fetcher: fetcherFor(stripeRoutes(), calls), now: fixedNow })

    const mcp = report.surfaces.find((s) => s.surface === 'mcp')!
    expect(mcp.rung).toBe(2)
    expect(mcp.partial?.level).toBe(3)
    expect(mcp.partial?.verified.sort()).toEqual(['mcp-malformed-request-shape', 'mcp-protected-resource-metadata'])
    expect(mcp.partial?.unverified).toEqual([
      expect.objectContaining({ checkId: 'mcp-tool-schema-lint', outcome: 'auth-gated' }),
    ])

    const api = report.surfaces.find((s) => s.surface === 'api')!
    expect(api.rung).toBe(2)
    expect(api.partial?.level).toBe(3)
    expect(api.partial?.verified.sort()).toEqual([
      'api-error-shape-auth',
      'api-error-shape-consistency',
      'api-llms-txt',
      'api-openapi-published',
    ])
    expect(api.partial?.unverified.map((u) => u.checkId).sort()).toEqual(['api-idempotency-probe', 'api-rate-limit-probe'])

    // Declared walls never issue requests.
    expect(calls.some((c) => c.includes('agent-trial'))).toBe(false)
    const l4l5 = report.surfaces.flatMap((s) => s.checks).filter((c) => c.level >= 4)
    expect(l4l5).toHaveLength(4)
    expect(l4l5.every((c) => c.outcome === 'auth-gated')).toBe(true)
  })

  it('robots disallow is absolute: the walled URL is recorded but never fetched', async () => {
    const calls: string[] = []
    const { transcripts } = await runDepth(STRIPE_TARGET, { fetcher: fetcherFor(stripeRoutes(), calls), now: fixedNow })
    const openapi = transcripts.find((t) => t.checkId === 'api-openapi-published')!
    const walled = openapi.requests[0]
    expect(walled.url).toContain('raw.githubusercontent.com')
    expect(walled.robots).toMatchObject({ consulted: true, allowed: false })
    expect(walled.status).toBeNull()
    expect(calls).not.toContain(`GET ${walled.url}`)
    // The documented repo's CDN mirror served the spec instead.
    expect(openapi.requests[1]).toMatchObject({ status: 200, digest: expect.objectContaining({ kind: 'openapi' }) })
  })

  it('run output is replayable: regrading recorded transcripts reproduces the report', async () => {
    const fetcher = fetcherFor(stripeRoutes())
    const { report, transcripts } = await runDepth(STRIPE_TARGET, { fetcher, now: fixedNow })
    const byCheck = new Map(transcripts.filter((t) => !t.checkId.startsWith('robots-')).map((t) => [t.checkId, t]))
    const robots = transcripts.filter((t) => t.checkId.startsWith('robots-'))
    expect(buildReport(STRIPE_TARGET, byCheck, robots)).toEqual(report)
  })
})

describe('recordCheck sanitization', () => {
  const leakyDef: DepthCheckDef = {
    id: 'leaky',
    surface: 'api',
    level: 2,
    title: 'leaky',
    docUrl: 'https://example.com',
    requests: [{ url: 'https://example.com/x', method: 'GET', robotsApplies: false }],
    grade: () => ({ outcome: 'pass', detail: '' }),
  }

  it('stored bodies pass the no-secrets gate', async () => {
    const fetcher = fetcherFor({
      'GET https://example.com/x': { body: 'Authorization: Bearer sk-live-abc123 and an api key: hunter2' },
    })
    const gate = makeRobotsGate(fetcher, fixedNow, 'stripe')
    const t = await recordCheck(leakyDef, 'stripe', fetcher, gate, fixedNow)
    expect(t.requests[0].body).toContain('[redacted]')
    expect(t.requests[0].body).not.toMatch(/sk-|key|token/i)
  })
})

// ---------------------------------------------------------------------------
// Target definition hygiene + committed pilot replay (the recompute-check analogue:
// committed depth reports must regrade identically from their committed transcripts).
// ---------------------------------------------------------------------------

describe('depth target definitions', () => {
  it('check ids are unique and keyless walls are declared for every L4/L5 check', () => {
    for (const target of Object.values(DEPTH_TARGETS)) {
      const ids = target.checks.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const check of target.checks.filter((c) => c.level >= 4)) {
        expect(check.wall, `${check.id} must declare its wall`).toBeDefined()
        expect(check.requests).toHaveLength(0)
      }
      for (const check of target.checks) expect(check.docUrl).toMatch(/^https:\/\//)
    }
  })
})

describe('committed depth pilots', () => {
  const depthDir = path.join(ROOT, 'open-rankings', 'experiments', 'depth')
  const pilotDirs = fs.existsSync(depthDir)
    ? fs.readdirSync(depthDir).filter((d) => fs.existsSync(path.join(depthDir, d, 'report.json')))
    : []

  it('at least one pilot snapshot is committed', () => {
    expect(pilotDirs.length).toBeGreaterThan(0)
  })

  it.each(pilotDirs)('%s regrades identically from its committed transcripts', (dirName) => {
    const dir = path.join(depthDir, dirName)
    const committed = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) as {
      arenabenchVersion: string
      target: { productId: string }
      surfaces: Array<{ checks: Array<{ evidence: string }> }>
    }
    const target = DEPTH_TARGETS[committed.target.productId]
    expect(target).toBeDefined()
    // Replay only pilots recorded under the current spec version; older snapshots stay
    // attributed to their own version (docs/AGENTIC-DEPTH-PROGRAM.md §2).
    if (committed.arenabenchVersion !== ARENABENCH_VERSION) return
    const byCheck = new Map<string, DepthTranscript>()
    const robots: DepthTranscript[] = []
    for (const file of fs.readdirSync(path.join(dir, 'transcripts')).sort()) {
      const t = JSON.parse(fs.readFileSync(path.join(dir, 'transcripts', file), 'utf8')) as DepthTranscript
      if (t.checkId.startsWith('robots-')) robots.push(t)
      else byCheck.set(t.checkId, t)
    }
    expect(buildReport(target, byCheck, robots)).toEqual(committed)
    // Every evidence pointer resolves to a committed transcript.
    for (const s of committed.surfaces) {
      for (const c of s.checks) expect(fs.existsSync(path.join(dir, c.evidence))).toBe(true)
    }
  })
})
