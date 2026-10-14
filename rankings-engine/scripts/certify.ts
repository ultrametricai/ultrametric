// The Agent-Ready conformance suite — the same suite vendors run self-serve via
// `ultrametric-cli certify <url>` (the CLI lives in its own repo; this is the maintainer-side
// implementation the weekly cert-sweep runs, protocol in docs/CERTIFICATION.md). Every check is
// keyless, read-only, and runs against the vendor's own public surfaces, mirroring the
// pipeline's probe conventions (pipeline/stages/probe.ts): llms.txt, docs .md mirrors, OpenAPI,
// an MCP initialize handshake, robots.txt, and a structured-errors spot check.
//
// Pure by construction: all network access goes through an injectable CertifyFetcher so the
// whole suite is unit-testable without touching the network (pipeline/__tests__/certify.test.ts).
// Every response is digested (sha256) into the report so a maintainer re-run can be compared
// check-by-check against a vendor-submitted cert-report.json.
import { createHash } from 'node:crypto'

export interface CertifyFetchResult {
  status: number
  contentType: string | null
  body: string
  /** Lower-cased header map (only the headers the checks read, e.g. www-authenticate). */
  headers: Record<string, string>
}

export interface CertifyFetchInit {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}

export type CertifyFetcher = (url: string, init?: CertifyFetchInit) => Promise<CertifyFetchResult>

const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-Certify/1.0; +https://ultrametric.ai)'
const FETCH_TIMEOUT_MS = 20_000

export const defaultCertifyFetcher: CertifyFetcher = async (url, init = {}) => {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { 'User-Agent': USER_AGENT, ...init.headers },
    body: init.body,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const body = await res.text()
  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })
  return { status: res.status, contentType: res.headers.get('content-type'), body, headers }
}

// ---------------------------------------------------------------------------
// Report shapes — machine-verifiable: a maintainer re-runs the same command and diffs the
// per-check statuses (and, where content is stable, the response digests).
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'fail' | 'skip'

export interface RequestDigest {
  url: string
  method: 'GET' | 'POST'
  /** null = network error / timeout (the request never completed). */
  status: number | null
  contentType: string | null
  bytes: number
  sha256: string | null
  fetchedAt: string
}

export type CheckId = 'llms-txt' | 'docs-md' | 'openapi' | 'mcp' | 'robots' | 'structured-errors'

export interface CertCheckResult {
  id: CheckId
  title: string
  status: CheckStatus
  detail: string
  requests: RequestDigest[]
}

export type CertLevel = 'agent-ready' | 'agent-native'

export interface CertReport {
  version: 1
  tool: 'ultrametric-cli certify'
  target: string
  startedAt: string
  finishedAt: string
  level: CertLevel | null
  checks: CertCheckResult[]
}

export const CHECK_TITLES: Record<CheckId, string> = {
  'llms-txt': 'llms.txt served (non-HTML, >100 bytes)',
  'docs-md': 'docs pages mirrored as markdown (.md)',
  openapi: 'OpenAPI spec at a conventional path',
  mcp: 'MCP endpoint speaks JSON-RPC',
  robots: 'robots.txt does not block all agents',
  'structured-errors': 'unknown API path returns JSON, not HTML',
}

// ---------------------------------------------------------------------------
// Small pure helpers (each independently unit-tested).
// ---------------------------------------------------------------------------

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function isHtmlish(contentType: string | null, body: string): boolean {
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('text/html')) return true
  return /^\s*(?:<!doctype html|<html)/i.test(body)
}

/** Absolute http(s) links ending in .md — markdown `](url)` links and bare URLs — resolved
 * against `baseUrl` for relative `](/path.md)` forms. Order-preserving, de-duplicated. */
export function extractMdLinks(llmsTxt: string, baseUrl: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    let resolved: string
    try {
      resolved = new URL(raw, baseUrl).toString()
    } catch {
      return
    }
    if (!/^https?:/.test(resolved)) return
    if (!seen.has(resolved)) {
      seen.add(resolved)
      out.push(resolved)
    }
  }
  for (const m of llmsTxt.matchAll(/\]\(([^)\s]+\.md)\)/g)) push(m[1])
  for (const m of llmsTxt.matchAll(/https?:\/\/[^\s)"'<>\]]+\.md\b/g)) push(m[0])
  return out
}

/** True when a robots.txt group applying to `User-agent: *` disallows everything (`Disallow: /`). */
export function robotsBlocksAllAgents(body: string): boolean {
  let appliesToAll = false
  let inGroupHeader = false
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (line === '') continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const field = m[1].toLowerCase()
    const value = m[2].trim()
    if (field === 'user-agent') {
      // Consecutive user-agent lines form one group header; a new header resets membership.
      if (!inGroupHeader) appliesToAll = false
      inGroupHeader = true
      if (value === '*') appliesToAll = true
    } else {
      inGroupHeader = false
      if (field === 'disallow' && value === '/' && appliesToAll) return true
    }
  }
  return false
}

/** Any protocol-shaped reply to a JSON-RPC initialize: a JSON-RPC body (result or error,
 * plain JSON or SSE-framed) or an auth-gated 401 that surfaces OAuth protected-resource
 * metadata — a live MCP server's challenge is itself proof the endpoint speaks the protocol. */
export function mcpProtocolShaped(res: CertifyFetchResult): boolean {
  if (res.body.includes('"jsonrpc"')) return true
  if (res.status === 401) {
    const challenge = res.headers['www-authenticate'] ?? ''
    if (/resource_metadata|oauth/i.test(challenge)) return true
    if (/oauth|authorization_servers|resource_metadata/i.test(res.body)) return true
  }
  return false
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Last-two-label apex ("docs.stripe.com" -> "stripe.com") — good enough for the mcp.<apex>
 * candidate; vendors on multi-label public suffixes pass --mcp explicitly. */
export function apexDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname
    const labels = host.split('.')
    return labels.length <= 2 ? host : labels.slice(-2).join('.')
  } catch {
    return null
  }
}

export function mcpCandidates(target: string, explicit?: string): string[] {
  if (explicit) return [explicit]
  const origin = originOf(target)
  const apex = apexDomain(target)
  const out: string[] = []
  if (origin) out.push(`${origin}/mcp`)
  if (apex) out.push(`https://mcp.${apex}`, `https://mcp.${apex}/mcp`)
  return [...new Set(out)]
}

// Same conventional spec paths the pipeline probes (pipeline/stages/probe.ts).
export const OPENAPI_PATHS = ['/openapi.json', '/swagger.json', '/api/openapi.json', '/.well-known/openapi.json']

const MCP_INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'ultrametric-certify', version: '1.0' },
  },
})

// ---------------------------------------------------------------------------
// The runner: one recorded fetch wrapper + one function per check.
// ---------------------------------------------------------------------------

interface Recorder {
  fetch: (url: string, init?: CertifyFetchInit) => Promise<CertifyFetchResult | null>
  requests: RequestDigest[]
}

function makeRecorder(fetcher: CertifyFetcher, now: () => string): Recorder {
  const requests: RequestDigest[] = []
  return {
    requests,
    async fetch(url, init) {
      const method = init?.method ?? 'GET'
      try {
        const res = await fetcher(url, init)
        requests.push({
          url,
          method,
          status: res.status,
          contentType: res.contentType,
          bytes: Buffer.byteLength(res.body),
          sha256: sha256Hex(res.body),
          fetchedAt: now(),
        })
        return res
      } catch {
        requests.push({ url, method, status: null, contentType: null, bytes: 0, sha256: null, fetchedAt: now() })
        return null
      }
    },
  }
}

interface CheckCtx {
  target: string
  origin: string
  fetcher: CertifyFetcher
  now: () => string
}

function result(id: CheckId, status: CheckStatus, detail: string, requests: RequestDigest[]): CertCheckResult {
  return { id, title: CHECK_TITLES[id], status, detail, requests }
}

export const LLMS_TXT_MIN_BYTES = 100

async function checkLlmsTxt(ctx: CheckCtx): Promise<{ check: CertCheckResult; llmsBody: string | null }> {
  const r = makeRecorder(ctx.fetcher, ctx.now)
  const url = `${ctx.origin}/llms.txt`
  const res = await r.fetch(url)
  if (!res) return { check: result('llms-txt', 'fail', `${url} unreachable`, r.requests), llmsBody: null }
  if (res.status !== 200) {
    return { check: result('llms-txt', 'fail', `${url} -> HTTP ${res.status}`, r.requests), llmsBody: null }
  }
  if (isHtmlish(res.contentType, res.body)) {
    return { check: result('llms-txt', 'fail', `${url} returns HTML, not a plain-text llms.txt`, r.requests), llmsBody: null }
  }
  const bytes = Buffer.byteLength(res.body)
  if (bytes <= LLMS_TXT_MIN_BYTES) {
    return { check: result('llms-txt', 'fail', `${url} is only ${bytes} bytes (needs >${LLMS_TXT_MIN_BYTES})`, r.requests), llmsBody: null }
  }
  return { check: result('llms-txt', 'pass', `HTTP 200, ${bytes.toLocaleString('en-US')} bytes of non-HTML text`, r.requests), llmsBody: res.body }
}

export const DOCS_MD_SAMPLE_SIZE = 3

async function checkDocsMd(ctx: CheckCtx, llmsBody: string | null): Promise<CertCheckResult> {
  const r = makeRecorder(ctx.fetcher, ctx.now)
  const candidates = llmsBody ? extractMdLinks(llmsBody, `${ctx.origin}/llms.txt`).slice(0, DOCS_MD_SAMPLE_SIZE) : []
  // No llms.txt links to sample: fall back to the `.md`-suffix convention on the target's own
  // path (docs.example.com/guide -> /guide.md), which only exists for non-root targets.
  if (candidates.length === 0) {
    try {
      const u = new URL(ctx.target)
      if (u.pathname !== '/' && u.pathname !== '') candidates.push(`${u.origin}${u.pathname.replace(/\/$/, '')}.md`)
    } catch {
      /* invalid target already rejected upstream */
    }
  }
  if (candidates.length === 0) {
    return result('docs-md', 'skip', 'no .md candidates to sample (llms.txt lists none and the target URL has no doc path)', r.requests)
  }
  let passed = 0
  for (const url of candidates) {
    const res = await r.fetch(url)
    if (res && res.status === 200 && !isHtmlish(res.contentType, res.body)) passed++
  }
  if (passed > 0) {
    return result('docs-md', 'pass', `${passed}/${candidates.length} sampled docs pages served as markdown`, r.requests)
  }
  return result('docs-md', 'fail', `none of ${candidates.length} sampled .md candidates served markdown`, r.requests)
}

/** Valid-spec bar: JSON with a string `openapi` version and an object `paths` map. */
export function isValidOpenapiSpec(body: string): boolean {
  try {
    const json = JSON.parse(body) as Record<string, unknown>
    return (
      json !== null &&
      typeof json === 'object' &&
      typeof json.openapi === 'string' &&
      typeof json.paths === 'object' &&
      json.paths !== null
    )
  } catch {
    return false
  }
}

async function checkOpenapi(ctx: CheckCtx): Promise<{ check: CertCheckResult; specBody: string | null }> {
  const r = makeRecorder(ctx.fetcher, ctx.now)
  for (const p of OPENAPI_PATHS) {
    const url = `${ctx.origin}${p}`
    const res = await r.fetch(url)
    if (res && res.status === 200 && isValidOpenapiSpec(res.body)) {
      return { check: result('openapi', 'pass', `valid OpenAPI document at ${url}`, r.requests), specBody: res.body }
    }
  }
  return {
    check: result('openapi', 'fail', `no valid OpenAPI document at ${OPENAPI_PATHS.join(', ')}`, r.requests),
    specBody: null,
  }
}

async function checkMcp(ctx: CheckCtx, explicitUrl?: string): Promise<CertCheckResult> {
  const r = makeRecorder(ctx.fetcher, ctx.now)
  const candidates = mcpCandidates(ctx.target, explicitUrl)
  for (const url of candidates) {
    const res = await r.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: MCP_INITIALIZE,
    })
    if (res && mcpProtocolShaped(res)) {
      const via = res.status === 401 ? 'OAuth challenge (401 + protected-resource metadata)' : `JSON-RPC reply (HTTP ${res.status})`
      return result('mcp', 'pass', `${url} answered initialize with a ${via}`, r.requests)
    }
  }
  return result(
    'mcp',
    'fail',
    `no protocol-shaped initialize reply from ${candidates.join(', ')} (pass --mcp <url> if the endpoint lives elsewhere)`,
    r.requests,
  )
}

async function checkRobots(ctx: CheckCtx): Promise<CertCheckResult> {
  const r = makeRecorder(ctx.fetcher, ctx.now)
  const url = `${ctx.origin}/robots.txt`
  const res = await r.fetch(url)
  if (!res || res.status !== 200) {
    return result('robots', 'pass', `no robots.txt at ${url} — nothing blocked`, r.requests)
  }
  if (robotsBlocksAllAgents(res.body)) {
    return result('robots', 'fail', `${url} disallows everything for User-agent: *`, r.requests)
  }
  return result('robots', 'pass', `${url} does not block all agents`, r.requests)
}

/** API root: --api wins; else the OpenAPI spec's first absolute servers[].url. */
export function apiRootFrom(explicit: string | undefined, specBody: string | null): string | null {
  if (explicit) return explicit.replace(/\/$/, '')
  if (!specBody) return null
  try {
    const json = JSON.parse(specBody) as { servers?: Array<{ url?: unknown }> }
    const first = json.servers?.find((s) => typeof s.url === 'string' && /^https?:\/\//.test(s.url))
    return first ? (first.url as string).replace(/\/$/, '') : null
  } catch {
    return null
  }
}

export const STRUCTURED_ERRORS_PROBE_PATH = '/ultrametric-certify-nonexistent-path'

async function checkStructuredErrors(ctx: CheckCtx, apiRoot: string | null): Promise<CertCheckResult> {
  const r = makeRecorder(ctx.fetcher, ctx.now)
  if (!apiRoot) {
    return result('structured-errors', 'skip', 'no API root known (no --api flag and no servers[] in the OpenAPI spec)', r.requests)
  }
  const url = `${apiRoot}${STRUCTURED_ERRORS_PROBE_PATH}`
  const res = await r.fetch(url, { headers: { Accept: 'application/json' } })
  if (!res) return result('structured-errors', 'fail', `${url} unreachable`, r.requests)
  if (res.status < 400) {
    return result('structured-errors', 'fail', `${url} -> HTTP ${res.status} for a path that should not exist`, r.requests)
  }
  if (isHtmlish(res.contentType, res.body)) {
    return result('structured-errors', 'fail', `${url} -> HTTP ${res.status} with an HTML error page, not JSON`, r.requests)
  }
  let parses = false
  try {
    JSON.parse(res.body)
    parses = true
  } catch {
    parses = (res.contentType ?? '').toLowerCase().includes('json')
  }
  if (!parses) {
    return result('structured-errors', 'fail', `${url} -> HTTP ${res.status} but the body is not JSON`, r.requests)
  }
  return result('structured-errors', 'pass', `${url} -> HTTP ${res.status} with a JSON error body`, r.requests)
}

// ---------------------------------------------------------------------------
// Levels.
// ---------------------------------------------------------------------------

// Certified Agent-Ready  = llms.txt + (MCP or OpenAPI) + robots-ok.
// Certified Agent-Native = every check passes; structured-errors may be 'skip' only when it
// was genuinely inapplicable (no API root discoverable) — a skip is never silently a pass
// anywhere else.
export function certificationLevel(checks: CertCheckResult[]): CertLevel | null {
  const by = new Map(checks.map((c) => [c.id, c.status]))
  const pass = (id: CheckId) => by.get(id) === 'pass'
  const ready = pass('llms-txt') && (pass('mcp') || pass('openapi')) && pass('robots')
  if (!ready) return null
  const native =
    pass('llms-txt') &&
    pass('docs-md') &&
    pass('openapi') &&
    pass('mcp') &&
    pass('robots') &&
    (pass('structured-errors') || by.get('structured-errors') === 'skip')
  return native ? 'agent-native' : 'agent-ready'
}

export const CERT_LEVEL_TITLES: Record<CertLevel, string> = {
  'agent-ready': 'Certified Agent-Ready',
  'agent-native': 'Certified Agent-Native',
}

// ---------------------------------------------------------------------------
// The suite.
// ---------------------------------------------------------------------------

export interface CertifyOptions {
  /** Explicit MCP endpoint (skips the conventional candidates). */
  mcpUrl?: string
  /** Explicit API root for the structured-errors check. */
  apiUrl?: string
  fetcher?: CertifyFetcher
  now?: () => string
}

export async function runCertify(target: string, opts: CertifyOptions = {}): Promise<CertReport> {
  const fetcher = opts.fetcher ?? defaultCertifyFetcher
  const now = opts.now ?? (() => new Date().toISOString())
  const origin = originOf(/^https?:\/\//.test(target) ? target : `https://${target}`)
  if (!origin) throw new Error(`not a valid URL: ${target}`)
  const normalizedTarget = /^https?:\/\//.test(target) ? target : `https://${target}`
  const ctx: CheckCtx = { target: normalizedTarget, origin, fetcher, now }

  const startedAt = now()
  const llms = await checkLlmsTxt(ctx)
  const docsMd = await checkDocsMd(ctx, llms.llmsBody)
  const openapi = await checkOpenapi(ctx)
  const mcp = await checkMcp(ctx, opts.mcpUrl)
  const robots = await checkRobots(ctx)
  const structured = await checkStructuredErrors(ctx, apiRootFrom(opts.apiUrl, openapi.specBody))
  const checks = [llms.check, docsMd, openapi.check, mcp, robots, structured]

  return {
    version: 1,
    tool: 'ultrametric-cli certify',
    target: normalizedTarget,
    startedAt,
    finishedAt: now(),
    level: certificationLevel(checks),
    checks,
  }
}
