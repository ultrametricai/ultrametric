import { describe, expect, it } from 'vitest'
import {
  apexDomain,
  apiRootFrom,
  certificationLevel,
  extractMdLinks,
  isValidOpenapiSpec,
  LLMS_TXT_MIN_BYTES,
  mcpCandidates,
  mcpProtocolShaped,
  robotsBlocksAllAgents,
  runCertify,
  STRUCTURED_ERRORS_PROBE_PATH,
  type CertifyFetcher,
  type CertifyFetchResult,
  type CertReport,
} from '../scripts/certify'

// ---------------------------------------------------------------------------
// Mock-fetcher harness: a route table keyed by "<METHOD> <url>"; anything unrouted 404s.
// ---------------------------------------------------------------------------

type Route = Partial<CertifyFetchResult> | 'network-error'

function fetcherFor(routes: Record<string, Route>): CertifyFetcher {
  return async (url, init) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const route = routes[key]
    if (route === 'network-error') throw new Error('boom')
    if (!route) return { status: 404, contentType: 'text/html', body: '<!doctype html><html>not found</html>', headers: {} }
    return { status: 200, contentType: 'text/plain', body: '', headers: {}, ...route }
  }
}

const LLMS_OK = {
  contentType: 'text/plain; charset=utf-8',
  body: `# Acme\n\nAgent docs.\n\n- [Quickstart](https://docs.acme.dev/quickstart.md)\n- [API](/api.md)\n${'x'.repeat(80)}`,
}

const OPENAPI_OK = {
  contentType: 'application/json',
  body: JSON.stringify({ openapi: '3.1.0', info: { title: 'acme' }, servers: [{ url: 'https://api.acme.dev/v1' }], paths: { '/things': {} } }),
}

const MCP_401_OAUTH = {
  status: 401,
  contentType: 'application/json',
  body: '{"error":"unauthorized"}',
  headers: { 'www-authenticate': 'Bearer resource_metadata="https://acme.dev/.well-known/oauth-protected-resource"' },
}

// A fully conformant vendor — every check passes.
const FULL_PASS_ROUTES: Record<string, Route> = {
  'GET https://acme.dev/llms.txt': LLMS_OK,
  'GET https://docs.acme.dev/quickstart.md': { contentType: 'text/markdown', body: '# Quickstart' },
  'GET https://acme.dev/api.md': { contentType: 'text/markdown', body: '# API' },
  'GET https://acme.dev/openapi.json': OPENAPI_OK,
  'POST https://acme.dev/mcp': MCP_401_OAUTH,
  'GET https://acme.dev/robots.txt': { body: 'User-agent: *\nDisallow: /admin\n' },
  [`GET https://api.acme.dev/v1${STRUCTURED_ERRORS_PROBE_PATH}`]: {
    status: 404,
    contentType: 'application/json',
    body: '{"error":{"type":"not_found"}}',
  },
}

async function certify(routes: Record<string, Route>, target = 'https://acme.dev', opts: { mcpUrl?: string; apiUrl?: string } = {}): Promise<CertReport> {
  return runCertify(target, { ...opts, fetcher: fetcherFor(routes), now: () => '2026-09-08T00:00:00.000Z' })
}

function statusOf(report: CertReport, id: string): string {
  return report.checks.find((c) => c.id === id)!.status
}

describe('runCertify', () => {
  it('awards Certified Agent-Native when every check passes', async () => {
    const report = await certify(FULL_PASS_ROUTES)
    expect(report.checks.map((c) => [c.id, c.status])).toEqual([
      ['llms-txt', 'pass'],
      ['docs-md', 'pass'],
      ['openapi', 'pass'],
      ['mcp', 'pass'],
      ['robots', 'pass'],
      ['structured-errors', 'pass'],
    ])
    expect(report.level).toBe('agent-native')
    expect(report.tool).toBe('ultrametric-cli certify')
    expect(report.version).toBe(1)
  })

  it('records a sha256 digest, byte count, and timestamp for every request', async () => {
    const report = await certify(FULL_PASS_ROUTES)
    for (const check of report.checks) {
      for (const req of check.requests) {
        expect(req.fetchedAt).toBe('2026-09-08T00:00:00.000Z')
        expect(req.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(req.bytes).toBeGreaterThanOrEqual(0)
      }
    }
    // llms.txt digest is deterministic for the same body.
    const [a, b] = await Promise.all([certify(FULL_PASS_ROUTES), certify(FULL_PASS_ROUTES)])
    expect(a.checks[0].requests[0].sha256).toBe(b.checks[0].requests[0].sha256)
  })

  it('awards Agent-Ready (not Native) when only llms.txt + OpenAPI + robots pass', async () => {
    const routes = { ...FULL_PASS_ROUTES }
    delete routes['POST https://acme.dev/mcp']
    const report = await certify(routes)
    expect(statusOf(report, 'mcp')).toBe('fail')
    expect(report.level).toBe('agent-ready')
  })

  it('awards no level without llms.txt', async () => {
    const routes = { ...FULL_PASS_ROUTES }
    delete routes['GET https://acme.dev/llms.txt']
    const report = await certify(routes)
    expect(statusOf(report, 'llms-txt')).toBe('fail')
    expect(report.level).toBeNull()
  })

  it('fails llms.txt that is HTML or too small', async () => {
    const html = await certify({ ...FULL_PASS_ROUTES, 'GET https://acme.dev/llms.txt': { contentType: 'text/html', body: `<html>${'x'.repeat(200)}</html>` } })
    expect(statusOf(html, 'llms-txt')).toBe('fail')
    const tiny = await certify({ ...FULL_PASS_ROUTES, 'GET https://acme.dev/llms.txt': { body: 'x'.repeat(LLMS_TXT_MIN_BYTES) } })
    expect(tiny.checks[0].detail).toMatch(/bytes/)
    expect(statusOf(tiny, 'llms-txt')).toBe('fail')
  })

  it('samples .md mirrors from llms.txt links and passes on >=1 markdown response', async () => {
    const routes = { ...FULL_PASS_ROUTES }
    delete routes['GET https://acme.dev/api.md'] // one of two samples 404s — still a pass
    const report = await certify(routes)
    expect(statusOf(report, 'docs-md')).toBe('pass')
    expect(report.checks[1].detail).toMatch(/1\/2 sampled/)
  })

  it('fails docs-md when every sampled candidate serves HTML', async () => {
    const routes = {
      ...FULL_PASS_ROUTES,
      'GET https://docs.acme.dev/quickstart.md': { contentType: 'text/html', body: '<html>app shell</html>' },
      'GET https://acme.dev/api.md': { contentType: 'text/html', body: '<html>app shell</html>' },
    }
    expect(statusOf(await certify(routes), 'docs-md')).toBe('fail')
  })

  it('skips docs-md for a root target with no llms.txt links, and falls back to <path>.md otherwise', async () => {
    const noLinks = { ...FULL_PASS_ROUTES, 'GET https://acme.dev/llms.txt': { body: 'plain prose, no links at all. '.repeat(10) } }
    expect(statusOf(await certify(noLinks), 'docs-md')).toBe('skip')

    const withPath = {
      ...noLinks,
      'GET https://acme.dev/guide.md': { contentType: 'text/markdown', body: '# Guide' },
    }
    const report = await certify(withPath, 'https://acme.dev/guide')
    expect(statusOf(report, 'docs-md')).toBe('pass')
  })

  it('rejects an openapi.json that is not a valid spec', async () => {
    const routes = { ...FULL_PASS_ROUTES, 'GET https://acme.dev/openapi.json': { contentType: 'application/json', body: '{"hello":"world"}' } }
    const report = await certify(routes)
    expect(statusOf(report, 'openapi')).toBe('fail')
    // With MCP still up, llms+MCP+robots keeps agent-ready.
    expect(report.level).toBe('agent-ready')
  })

  it('accepts a JSON-RPC 200 reply as an MCP pass and honors --mcp', async () => {
    const routes = { ...FULL_PASS_ROUTES }
    delete routes['POST https://acme.dev/mcp']
    routes['POST https://mcp.example.net/rpc'] = {
      contentType: 'application/json',
      body: '{"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"acme"}}}',
    }
    const report = await certify(routes, 'https://acme.dev', { mcpUrl: 'https://mcp.example.net/rpc' })
    expect(statusOf(report, 'mcp')).toBe('pass')
    expect(report.checks.find((c) => c.id === 'mcp')!.requests).toHaveLength(1)
  })

  it('fails robots when User-agent: * disallows everything', async () => {
    const routes = { ...FULL_PASS_ROUTES, 'GET https://acme.dev/robots.txt': { body: 'User-agent: *\nDisallow: /\n' } }
    const report = await certify(routes)
    expect(statusOf(report, 'robots')).toBe('fail')
    expect(report.level).toBeNull()
  })

  it('treats a missing robots.txt as not blocking', async () => {
    const routes = { ...FULL_PASS_ROUTES }
    delete routes['GET https://acme.dev/robots.txt']
    expect(statusOf(await certify(routes), 'robots')).toBe('pass')
  })

  it('spot-checks structured errors off the spec servers[] and fails HTML error pages', async () => {
    const htmlError = {
      ...FULL_PASS_ROUTES,
      [`GET https://api.acme.dev/v1${STRUCTURED_ERRORS_PROBE_PATH}`]: { status: 404, contentType: 'text/html', body: '<html>404</html>' },
    }
    const report = await certify(htmlError)
    expect(statusOf(report, 'structured-errors')).toBe('fail')
    expect(report.level).toBe('agent-ready') // native requires the errors check too
  })

  it('skips structured errors when no API root is known — and still allows agent-native', async () => {
    const routes = {
      ...FULL_PASS_ROUTES,
      'GET https://acme.dev/openapi.json': {
        contentType: 'application/json',
        body: JSON.stringify({ openapi: '3.0.0', paths: {} }), // valid spec, no servers[]
      },
    }
    const report = await certify(routes)
    expect(statusOf(report, 'structured-errors')).toBe('skip')
    expect(report.level).toBe('agent-native')
  })

  it('uses --api for the structured-errors root', async () => {
    const routes = {
      ...FULL_PASS_ROUTES,
      [`GET https://api.other.dev${STRUCTURED_ERRORS_PROBE_PATH}`]: { status: 404, contentType: 'application/json', body: '{"e":1}' },
    }
    const report = await certify(routes, 'https://acme.dev', { apiUrl: 'https://api.other.dev' })
    const check = report.checks.find((c) => c.id === 'structured-errors')!
    expect(check.status).toBe('pass')
    expect(check.requests[0].url).toBe(`https://api.other.dev${STRUCTURED_ERRORS_PROBE_PATH}`)
  })

  it('survives network errors (recorded as status null) and rejects garbage targets', async () => {
    const routes: Record<string, Route> = { ...FULL_PASS_ROUTES, 'GET https://acme.dev/llms.txt': 'network-error' }
    const report = await certify(routes)
    expect(statusOf(report, 'llms-txt')).toBe('fail')
    expect(report.checks[0].requests[0].status).toBeNull()
    await expect(runCertify('http://', { fetcher: fetcherFor({}) })).rejects.toThrow(/not a valid URL/)
  })
})

describe('pure helpers', () => {
  it('extractMdLinks finds markdown links and bare URLs, resolves relative paths, dedupes', () => {
    const links = extractMdLinks(
      '- [A](https://a.dev/x.md)\n- [B](/b.md)\nsee https://a.dev/x.md and https://c.dev/c.md too',
      'https://acme.dev/llms.txt',
    )
    expect(links).toEqual(['https://a.dev/x.md', 'https://acme.dev/b.md', 'https://c.dev/c.md'])
  })

  it('robotsBlocksAllAgents only trips on a full wildcard disallow', () => {
    expect(robotsBlocksAllAgents('User-agent: *\nDisallow: /')).toBe(true)
    expect(robotsBlocksAllAgents('User-agent: *\nDisallow: /admin')).toBe(false)
    expect(robotsBlocksAllAgents('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private')).toBe(false)
    expect(robotsBlocksAllAgents('User-agent: GPTBot\nUser-agent: *\nDisallow: /')).toBe(true)
    expect(robotsBlocksAllAgents('')).toBe(false)
  })

  it('mcpProtocolShaped accepts jsonrpc bodies and 401 OAuth challenges only', () => {
    const base = { status: 200, contentType: 'application/json', body: '', headers: {} }
    expect(mcpProtocolShaped({ ...base, body: '{"jsonrpc":"2.0","error":{"code":-32000}}' })).toBe(true)
    expect(mcpProtocolShaped({ ...base, status: 401, headers: { 'www-authenticate': 'Bearer resource_metadata="x"' } })).toBe(true)
    expect(mcpProtocolShaped({ ...base, status: 401, body: '{"authorization_servers":["https://auth"]}' })).toBe(true)
    expect(mcpProtocolShaped({ ...base, status: 401, body: 'nope' })).toBe(false)
    expect(mcpProtocolShaped({ ...base, status: 200, contentType: 'text/html', body: '<html></html>' })).toBe(false)
  })

  it('isValidOpenapiSpec requires an openapi version string and a paths object', () => {
    expect(isValidOpenapiSpec('{"openapi":"3.1.0","paths":{}}')).toBe(true)
    expect(isValidOpenapiSpec('{"swagger":"2.0","paths":{}}')).toBe(false)
    expect(isValidOpenapiSpec('{"openapi":"3.1.0"}')).toBe(false)
    expect(isValidOpenapiSpec('not json')).toBe(false)
  })

  it('apiRootFrom prefers the explicit flag and strips trailing slashes', () => {
    expect(apiRootFrom('https://api.x.dev/', OPENAPI_OK.body)).toBe('https://api.x.dev')
    expect(apiRootFrom(undefined, OPENAPI_OK.body)).toBe('https://api.acme.dev/v1')
    expect(apiRootFrom(undefined, '{"openapi":"3.0.0","paths":{},"servers":[{"url":"/v1"}]}')).toBeNull()
    expect(apiRootFrom(undefined, null)).toBeNull()
  })

  it('mcpCandidates derives origin + mcp.<apex> candidates, or just the explicit URL', () => {
    expect(mcpCandidates('https://docs.stripe.com/payments')).toEqual([
      'https://docs.stripe.com/mcp',
      'https://mcp.stripe.com',
      'https://mcp.stripe.com/mcp',
    ])
    expect(mcpCandidates('https://acme.dev', 'https://x.dev/mcp')).toEqual(['https://x.dev/mcp'])
    expect(apexDomain('https://a.b.c.dev/x')).toBe('c.dev')
  })

  it('certificationLevel implements the two published levels', () => {
    const mk = (statuses: Record<string, 'pass' | 'fail' | 'skip'>) =>
      Object.entries(statuses).map(([id, status]) => ({ id: id as never, title: '', detail: '', requests: [], status }))
    const all = { 'llms-txt': 'pass', 'docs-md': 'pass', openapi: 'pass', mcp: 'pass', robots: 'pass', 'structured-errors': 'pass' } as const
    expect(certificationLevel(mk(all))).toBe('agent-native')
    expect(certificationLevel(mk({ ...all, 'docs-md': 'fail' }))).toBe('agent-ready')
    expect(certificationLevel(mk({ ...all, openapi: 'fail' }))).toBe('agent-ready')
    expect(certificationLevel(mk({ ...all, openapi: 'fail', mcp: 'fail' }))).toBeNull()
    expect(certificationLevel(mk({ ...all, robots: 'fail' }))).toBeNull()
    expect(certificationLevel(mk({ ...all, 'structured-errors': 'skip' }))).toBe('agent-native')
    expect(certificationLevel(mk({ ...all, 'structured-errors': 'fail' }))).toBe('agent-ready')
  })
})
