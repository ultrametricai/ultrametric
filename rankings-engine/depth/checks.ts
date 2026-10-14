// Check definitions + pure graders for the depth pilot. A check is (1) a request plan the
// runner executes and records, and (2) a grade function that reads ONLY the recorded
// transcript — never the network — so the committed pilot can be regraded in tests and by
// `run.ts --replay`. Scope is the program's keyless boundary: public surfaces, no account
// creation, no credentials, no payments. A 401 with a conformant structured error is a PASS
// for the error-shape checks (the wall is the finding); checks that fundamentally need an
// authenticated session are declared with `wall` and recorded as 'auth-gated' without ever
// being attempted.

import type { DepthLevel, DepthOutcome, DepthRequestRecord, DepthTranscript, Surface } from './arenabench'
import { digestLlmsTxt, digestOpenapi } from './digests'

export interface DepthRequestPlan {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  /** GETs on documented pages/files are robots-gated; protocol POSTs to an RPC endpoint are
   * not crawling, so robots does not apply (the request is still fully recorded). */
  robotsApplies: boolean
  /** Deterministic large-body summary stored in the transcript for replayable grading. */
  digest?: (rawBody: string, url: string) => Record<string, unknown>
  /** Stop issuing later requests in this plan once one returned this status. */
  stopOnStatus?: number
}

export interface Graded {
  outcome: DepthOutcome
  detail: string
}

export interface DepthCheckDef {
  id: string
  surface: Surface
  level: DepthLevel
  title: string
  /** Vendor documentation establishing the surface/URL (the citation behind the check). */
  docUrl: string
  requests: DepthRequestPlan[]
  /** Declared wall: the check is recorded as gated, its requests (if any) never issued. */
  wall?: { outcome: Extract<DepthOutcome, 'auth-gated' | 'skip'>; reason: string }
  grade: (t: DepthTranscript) => Graded
}

export interface DepthTarget {
  productId: string
  categoryId: string
  vendor: string
  checks: DepthCheckDef[]
}

// ---------------------------------------------------------------------------
// Grading helpers (pure over DepthRequestRecord).
// ---------------------------------------------------------------------------

function responded(r: DepthRequestRecord | undefined): r is DepthRequestRecord {
  return r !== undefined && r.status !== null
}

/** 'robots-disallowed' when every request was robots-blocked, 'unreachable' when none got an
 * HTTP response; null when at least one response exists to grade. */
function transportFailure(t: DepthTranscript): Graded | null {
  if (t.requests.length === 0) return { outcome: 'unreachable', detail: 'no requests recorded' }
  if (t.requests.every((r) => r.robots.consulted && !r.robots.allowed)) {
    return {
      outcome: 'robots-disallowed',
      detail: `robots.txt disallows every candidate URL for our user agent (${t.requests.map((r) => r.url).join(', ')})`,
    }
  }
  if (!t.requests.some((r) => responded(r))) {
    return { outcome: 'unreachable', detail: 'no candidate URL returned an HTTP response' }
  }
  return null
}

function looksHtml(r: DepthRequestRecord): boolean {
  const ct = (r.contentType ?? '').toLowerCase()
  if (ct.includes('text/html')) return true
  const head = r.body ?? r.bodyExcerpt ?? ''
  return /^\s*(?:<!doctype html|<html)/i.test(head)
}

function parseJsonBody(r: DepthRequestRecord): Record<string, unknown> | null {
  if (!r.body) return null
  try {
    const v: unknown = JSON.parse(r.body.trim())
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Stripe's documented error envelope: a JSON body with an `error` object carrying string
 * `message` and `type` (https://docs.stripe.com/api/errors). */
function hasStructuredErrorEnvelope(r: DepthRequestRecord): boolean {
  const json = parseJsonBody(r)
  if (!json) return false
  const err = json.error
  if (typeof err !== 'object' || err === null) return false
  const e = err as Record<string, unknown>
  return typeof e.message === 'string' && typeof e.type === 'string'
}

function gradeStructuredError(r: DepthRequestRecord | undefined, expectStatus?: number): Graded {
  if (!responded(r)) return { outcome: 'unreachable', detail: 'no HTTP response' }
  if (r.status !== null && r.status < 400) {
    return { outcome: 'fail', detail: `${r.url} -> HTTP ${r.status}; expected a 4xx for an unauthenticated request` }
  }
  if (expectStatus !== undefined && r.status !== expectStatus) {
    return { outcome: 'fail', detail: `${r.url} -> HTTP ${r.status}; expected ${expectStatus}` }
  }
  if (looksHtml(r)) return { outcome: 'fail', detail: `${r.url} -> HTTP ${r.status} with an HTML error page, not JSON` }
  if (!hasStructuredErrorEnvelope(r)) {
    return { outcome: 'fail', detail: `${r.url} -> HTTP ${r.status} but the body is not the documented error envelope` }
  }
  return {
    outcome: 'pass',
    detail: `${r.url} -> HTTP ${r.status} with a structured JSON error (error.type + error.message) — the wall is recorded, not bypassed`,
  }
}

// ---------------------------------------------------------------------------
// The Stripe pilot target.
// ---------------------------------------------------------------------------

const MCP_ENDPOINT = 'https://mcp.stripe.com'
const API_ROOT = 'https://api.stripe.com'
const DOCS = 'https://docs.stripe.com'

const jsonRpc = (method: string) =>
  JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method,
    params:
      method === 'initialize'
        ? { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'productarena-probe', version: '1.0' } }
        : {},
  })

const MCP_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }

export const STRIPE_TARGET: DepthTarget = {
  productId: 'stripe',
  categoryId: 'payments',
  vendor: 'Stripe',
  checks: [
    // ----------------------------------------------------------------- MCP —
    {
      id: 'mcp-documented',
      surface: 'mcp',
      level: 1,
      title: 'MCP server documented at a public docs page',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [{ url: `${DOCS}/mcp.md`, method: 'GET', robotsApplies: true }],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)
        if (!r || r.status !== 200) return { outcome: 'fail', detail: `HTTP ${r?.status} for the documented MCP page` }
        if (looksHtml(r)) return { outcome: 'fail', detail: 'docs page .md mirror served HTML' }
        const text = r.body ?? r.bodyExcerpt ?? ''
        if (!text.includes('mcp.stripe.com')) {
          return { outcome: 'fail', detail: 'docs page does not name the hosted MCP endpoint' }
        }
        return { outcome: 'pass', detail: `${DOCS}/mcp.md -> HTTP 200 markdown naming the hosted endpoint mcp.stripe.com` }
      },
    },
    {
      id: 'mcp-initialize-handshake',
      surface: 'mcp',
      level: 2,
      title: 'Hosted MCP endpoint answers a JSON-RPC initialize',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [
        { url: MCP_ENDPOINT, method: 'POST', headers: MCP_HEADERS, body: jsonRpc('initialize'), robotsApplies: false },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        const challenge = r.headers?.['www-authenticate'] ?? ''
        if ((r.body ?? '').includes('"jsonrpc"')) {
          return { outcome: 'pass', detail: `initialize answered with a JSON-RPC body (HTTP ${r.status})` }
        }
        if (r.status === 401 && /resource_metadata|oauth/i.test(challenge + (r.body ?? ''))) {
          return {
            outcome: 'pass',
            detail:
              'initialize answered with the MCP authorization challenge (HTTP 401 + WWW-Authenticate resource_metadata) — a live server speaking the protocol auth spec',
          }
        }
        return { outcome: 'fail', detail: `initialize -> HTTP ${r.status} without a protocol-shaped reply` }
      },
    },
    {
      id: 'mcp-protected-resource-metadata',
      surface: 'mcp',
      level: 3,
      title: 'RFC 9728 protected-resource metadata is served and well-formed',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [{ url: `${MCP_ENDPOINT}/.well-known/oauth-protected-resource`, method: 'GET', robotsApplies: true }],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        if (r.status !== 200) return { outcome: 'fail', detail: `metadata endpoint -> HTTP ${r.status}` }
        const json = parseJsonBody(r)
        if (!json) return { outcome: 'fail', detail: 'metadata endpoint did not return a JSON object' }
        const servers = json.authorization_servers
        if (!Array.isArray(servers) || servers.length === 0) {
          return { outcome: 'fail', detail: 'metadata lacks a non-empty authorization_servers array' }
        }
        return {
          outcome: 'pass',
          detail: `oauth-protected-resource metadata is valid JSON with ${servers.length} authorization server(s)`,
        }
      },
    },
    {
      id: 'mcp-malformed-request-shape',
      surface: 'mcp',
      level: 3,
      title: 'Malformed request answered with a structured error, not HTML',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [
        {
          url: MCP_ENDPOINT,
          method: 'POST',
          headers: MCP_HEADERS,
          body: '{"jsonrpc": "2.0", "method": "initialize"', // deliberately truncated JSON
          robotsApplies: false,
        },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        if (r.status !== null && r.status < 400) {
          return { outcome: 'fail', detail: `malformed JSON accepted with HTTP ${r.status}` }
        }
        if (looksHtml(r)) return { outcome: 'fail', detail: `HTTP ${r.status} with an HTML error page` }
        const structured = parseJsonBody(r) !== null || (r.contentType ?? '').toLowerCase().includes('json')
        return structured
          ? { outcome: 'pass', detail: `malformed JSON rejected with HTTP ${r.status} and a JSON error body` }
          : { outcome: 'fail', detail: `HTTP ${r.status} but the error body is not JSON` }
      },
    },
    {
      id: 'mcp-tool-schema-lint',
      surface: 'mcp',
      level: 3,
      title: 'tools/list returns schema-valid tool definitions',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [
        { url: MCP_ENDPOINT, method: 'POST', headers: MCP_HEADERS, body: jsonRpc('tools/list'), robotsApplies: false },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        if (r.status === 401) {
          return {
            outcome: 'auth-gated',
            detail:
              'tools/list sits behind the OAuth wall (HTTP 401): the tool-schema lint needs an authorized session, so it is not reachable credential-free — recorded, not bypassed',
          }
        }
        const json = parseJsonBody(r)
        const result = json && typeof json.result === 'object' && json.result !== null ? (json.result as Record<string, unknown>) : null
        const tools = result && Array.isArray(result.tools) ? (result.tools as unknown[]) : null
        if (!tools) return { outcome: 'fail', detail: `tools/list -> HTTP ${r.status} without a tools array` }
        const bad = tools.filter((tool) => {
          if (typeof tool !== 'object' || tool === null) return true
          const tl = tool as Record<string, unknown>
          const schema = tl.inputSchema
          const desc = typeof tl.description === 'string' ? tl.description.trim() : ''
          return (
            typeof tl.name !== 'string' ||
            desc === '' ||
            typeof schema !== 'object' ||
            schema === null ||
            (schema as Record<string, unknown>).type !== 'object'
          )
        })
        return bad.length === 0
          ? { outcome: 'pass', detail: `${tools.length} tools, all with names, descriptions, and object input schemas` }
          : { outcome: 'fail', detail: `${bad.length}/${tools.length} tools missing a name, description, or object input schema` }
      },
    },
    {
      id: 'mcp-agent-trial',
      surface: 'mcp',
      level: 4,
      title: 'Agent task trial through the MCP server',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [],
      wall: {
        outcome: 'auth-gated',
        reason:
          'L4 requires an OAuth-scoped sandbox workspace for an agent to do real work through the server (program §3, Phase 3 infrastructure); not reachable credential-free',
      },
      grade: (t) => ({ outcome: t.notRun?.outcome ?? 'skip', detail: t.notRun?.reason ?? 'declared wall' }),
    },
    {
      id: 'mcp-sustained-use',
      surface: 'mcp',
      level: 5,
      title: 'Sustained, adversarial, long-horizon use',
      docUrl: 'https://docs.stripe.com/mcp',
      requests: [],
      wall: {
        outcome: 'auth-gated',
        reason:
          'L5 requires repeated authenticated trials over time (program §1); not reachable credential-free',
      },
      grade: (t) => ({ outcome: t.notRun?.outcome ?? 'skip', detail: t.notRun?.reason ?? 'declared wall' }),
    },
    // ----------------------------------------------------------------- API —
    {
      id: 'api-reference-documented',
      surface: 'api',
      level: 1,
      title: 'API reference served as agent-readable markdown',
      docUrl: 'https://docs.stripe.com/api',
      requests: [{ url: `${DOCS}/api.md`, method: 'GET', robotsApplies: true }],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        if (r.status !== 200 || looksHtml(r)) {
          return { outcome: 'fail', detail: `${DOCS}/api.md -> HTTP ${r.status}${looksHtml(r) ? ' (HTML)' : ''}` }
        }
        return { outcome: 'pass', detail: `${DOCS}/api.md -> HTTP 200 markdown (${r.bytes} bytes)` }
      },
    },
    {
      id: 'api-endpoint-responds',
      surface: 'api',
      level: 2,
      title: 'API origin resolves and answers an unauthenticated request',
      docUrl: 'https://docs.stripe.com/api',
      requests: [{ url: `${API_ROOT}/`, method: 'GET', headers: { Accept: 'application/json' }, robotsApplies: true }],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        return { outcome: 'pass', detail: `${API_ROOT}/ answered HTTP ${r.status} to a keyless request` }
      },
    },
    {
      id: 'api-error-shape-auth',
      surface: 'api',
      level: 3,
      title: 'Unauthenticated resource request returns the documented error envelope',
      docUrl: 'https://docs.stripe.com/api/errors',
      requests: [
        { url: `${API_ROOT}/v1/charges`, method: 'GET', headers: { Accept: 'application/json' }, robotsApplies: true },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        return gradeStructuredError(t.requests.find(responded), 401)
      },
    },
    {
      id: 'api-error-shape-consistency',
      surface: 'api',
      level: 3,
      title: 'Error envelope is consistent across endpoints, including unknown paths',
      docUrl: 'https://docs.stripe.com/api/errors',
      requests: [
        { url: `${API_ROOT}/v1/customers`, method: 'GET', headers: { Accept: 'application/json' }, robotsApplies: true },
        {
          url: `${API_ROOT}/v1/ultrametric-depth-nonexistent`,
          method: 'GET',
          headers: { Accept: 'application/json' },
          robotsApplies: true,
        },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const graded = t.requests.filter(responded).map((r) => gradeStructuredError(r))
        const failing = graded.find((g) => g.outcome !== 'pass')
        if (failing) return failing
        return {
          outcome: 'pass',
          detail: `${t.requests.length}/${t.requests.length} endpoints (including an unknown path) answered 4xx with the same structured error envelope`,
        }
      },
    },
    {
      id: 'api-openapi-published',
      surface: 'api',
      level: 3,
      title: 'Published OpenAPI spec retrieves and is structurally valid',
      docUrl: 'https://github.com/stripe/openapi',
      requests: [
        {
          url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
          method: 'GET',
          robotsApplies: true,
          digest: (body) => digestOpenapi(body),
          stopOnStatus: 200,
        },
        // Mirror of the same documented repo, used only if the primary host is bot-walled
        // (AGENTS.md: document the wall, substitute a reachable source).
        {
          url: 'https://cdn.jsdelivr.net/gh/stripe/openapi@master/openapi/spec3.json',
          method: 'GET',
          robotsApplies: true,
          digest: (body) => digestOpenapi(body),
          stopOnStatus: 200,
        },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find((q) => q.status === 200 && q.digest?.kind === 'openapi')
        if (!r || !r.digest) {
          const statuses = t.requests.map((q) => `${q.url} -> ${q.robots.allowed ? `HTTP ${q.status}` : 'robots-disallowed'}`)
          return { outcome: 'fail', detail: `no candidate served the spec (${statuses.join('; ')})` }
        }
        const d = r.digest as Record<string, unknown>
        const openapi = typeof d.openapi === 'string' ? d.openapi : null
        const pathCount = Number(d.pathCount ?? 0)
        const operationCount = Number(d.operationCount ?? 0)
        const withResponses = Number(d.operationsWithResponses ?? 0)
        const schemaCount = Number(d.componentSchemaCount ?? 0)
        const errorFields = Array.isArray(d.errorSchemaFields) ? (d.errorSchemaFields as string[]) : null
        if (d.parses !== true || !openapi || !openapi.startsWith('3.')) {
          return { outcome: 'fail', detail: `spec at ${r.url} is not a parseable OpenAPI 3.x document` }
        }
        if (pathCount === 0 || schemaCount === 0 || withResponses !== operationCount) {
          return {
            outcome: 'fail',
            detail: `spec structure incomplete: ${pathCount} paths, ${withResponses}/${operationCount} operations with responses, ${schemaCount} schemas`,
          }
        }
        if (!errorFields || !errorFields.includes('error')) {
          return { outcome: 'fail', detail: 'spec declares no components.schemas.error envelope to validate error responses against' }
        }
        return {
          outcome: 'pass',
          detail: `OpenAPI ${openapi} from ${r.url}: ${pathCount} paths, ${operationCount} operations (all with responses), ${schemaCount} component schemas, error envelope declared`,
        }
      },
    },
    {
      id: 'api-llms-txt',
      surface: 'api',
      level: 3,
      title: 'llms.txt conforms: plain text indexing markdown doc mirrors',
      docUrl: 'https://docs.stripe.com/building-with-llms',
      requests: [
        {
          url: `${DOCS}/llms.txt`,
          method: 'GET',
          robotsApplies: true,
          digest: (body, url) => digestLlmsTxt(body, url),
        },
      ],
      grade(t) {
        const failure = transportFailure(t)
        if (failure) return failure
        const r = t.requests.find(responded)!
        if (r.status !== 200) return { outcome: 'fail', detail: `${DOCS}/llms.txt -> HTTP ${r.status}` }
        if (looksHtml(r)) return { outcome: 'fail', detail: 'llms.txt served HTML' }
        if (r.bytes <= 100) return { outcome: 'fail', detail: `llms.txt is only ${r.bytes} bytes` }
        const mdLinks = Number(r.digest?.mdLinkCount ?? 0)
        if (mdLinks === 0) return { outcome: 'fail', detail: 'llms.txt lists no .md doc mirrors' }
        return { outcome: 'pass', detail: `llms.txt -> HTTP 200, ${r.bytes} bytes indexing ${mdLinks} .md doc mirrors` }
      },
    },
    {
      id: 'api-rate-limit-probe',
      surface: 'api',
      level: 3,
      title: 'Documented rate limits enforced and reported via headers',
      docUrl: 'https://docs.stripe.com/rate-limits',
      requests: [],
      wall: {
        outcome: 'auth-gated',
        reason:
          'rate limits are enforced per authenticated credential; observing enforcement would mean hammering the unauthenticated endpoint, which only ever answers 401 — not reachable credential-free',
      },
      grade: (t) => ({ outcome: t.notRun?.outcome ?? 'skip', detail: t.notRun?.reason ?? 'declared wall' }),
    },
    {
      id: 'api-idempotency-probe',
      surface: 'api',
      level: 3,
      title: 'Repeated writes with the idempotency header dedupe',
      docUrl: 'https://docs.stripe.com/api/idempotent_requests',
      requests: [],
      wall: {
        outcome: 'auth-gated',
        reason: 'idempotent writes require an authenticated sandbox credential; not reachable credential-free',
      },
      grade: (t) => ({ outcome: t.notRun?.outcome ?? 'skip', detail: t.notRun?.reason ?? 'declared wall' }),
    },
    {
      id: 'api-agent-trial',
      surface: 'api',
      level: 4,
      title: 'Agent task trial against a sandbox account',
      docUrl: 'https://docs.stripe.com/testing',
      requests: [],
      wall: {
        outcome: 'auth-gated',
        reason:
          'L4 requires a disposable sandbox account and scoped test credentials (program §3, Phase 3 infrastructure); not reachable credential-free',
      },
      grade: (t) => ({ outcome: t.notRun?.outcome ?? 'skip', detail: t.notRun?.reason ?? 'declared wall' }),
    },
    {
      id: 'api-sustained-use',
      surface: 'api',
      level: 5,
      title: 'Sustained, adversarial, long-horizon use',
      docUrl: 'https://docs.stripe.com/testing',
      requests: [],
      wall: {
        outcome: 'auth-gated',
        reason: 'L5 requires repeated authenticated trials over time (program §1); not reachable credential-free',
      },
      grade: (t) => ({ outcome: t.notRun?.outcome ?? 'skip', detail: t.notRun?.reason ?? 'declared wall' }),
    },
  ],
}

export const NOT_PILOTED: Partial<Record<Surface, string>> = {
  cli: 'CLI ladder not graded in this pilot; recorded credential-free CLI proofs exist at open-rankings/payments/proofs/stripe/ (cli-version, cli-resources-discovery, cli-webhook-listen-help)',
  automation: 'webhooks/bulk/workflow checks need an account to register endpoints against; deferred to the sandboxed trial phase',
  'human-ai-ux': 'agent-operated web UI trials are Phase 3 scope (program §3)',
}

export const DEPTH_TARGETS: Record<string, DepthTarget> = {
  stripe: STRIPE_TARGET,
}
