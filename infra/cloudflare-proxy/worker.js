// Cloudflare Worker: serves Ultrametric (the product) at the ROOT of ultrametric.ai by
// transparently proxying to the Vercel deployment (built with no basePath since the
// 2026-09-28 rebrand). Route: ultrametric.ai/* — legacy /productarena/* URLs 301 here, except
// /productarena/data/* which serves the data files directly (the shipped ultrametric CLI
// fetches that path with redirect:'error'; see block 1a in fetch()).
//
// Also hosts POST /productarena/api/scan — the "test my product" quick scan behind the /submit
// page. It runs a fixed, keyless probe set (llms.txt, openapi.json, robots.txt, homepage hints)
// against a user-supplied URL. Because the input is an arbitrary URL, the endpoint is
// deliberately paranoid: https-only, no IP literals, no private/internal hostnames, no custom
// ports, capped redirects with per-hop revalidation, short timeouts, bounded reads, and a
// best-effort per-IP rate limit. It only ever GETs fixed well-known paths and treats every
// response as inert text.
//
// Also hosts POST /productarena/api/mcp-probe — the product pages' "Try it" live MCP
// handshake, which only ever contacts a static allowlist of vendor MCP endpoints (see the
// "Live MCP handshake probe" section below).
//
// Also hosts POST /productarena/api/try/:arena/:product/:probeId — the "Try it" microterminal's
// "run live" button, which re-runs one recorded keyless proof command as a worker-native fetch
// of its fixed URL (see the "Live probe re-runs" section below and live-probes.generated.js).
//
// Also hosts POST /productarena/mcp — a keyless, rate-limited remote MCP endpoint (see the
// "Remote MCP endpoint" section below and this directory's README.md).
//
// Also counts /productarena/compare?p=… selections into Workers KV (binding UM_COMPARE_STATS;
// the pre-rename PA_COMPARE_STATS binding is still honored as a fallback)
// and serves the keyless GET /productarena/api/popular-compares top-20 — see the
// "Compare popularity counter" section below. Pairs only; no IPs or user agents are stored.
//
// Also hosts the site's auth backend at /productarena/auth/* (WorkOS AuthKit login/callback,
// our own HMAC-signed pa_session cookie, /auth/me, /auth/logout) — see the "Auth backend"
// section below and docs/AUTH.md for setup — and the session-gated GET/PUT
// /productarena/api/watchlist (per-account starred product ids in KV; "Watchlist API" section)
// and GET/PUT /productarena/api/my-stack (per-account picks-per-arena stack map in KV;
// "My Stack API" section).
import { LIVE_PROBES } from './live-probes.generated.js'

const ORIGIN = 'https://ultrametric.vercel.app'
const ALLOWED_CORS = new Set(['https://ultrametric.ai', 'https://ultrametric.vercel.app'])

const MAX_BODY_BYTES = 128 * 1024
const FETCH_TIMEOUT_MS = 6000
const MAX_REDIRECTS = 3
const RATE_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 }
const rateBuckets = new Map() // per-isolate, best-effort

// Fixed-window, per-isolate, best-effort rate limiter shared by /api/scan and /mcp (each with
// its own bucket map and limits). Returns true when the caller should get a 429.
function isRateLimited(buckets, ip, { max, windowMs }) {
  const now = Date.now()
  const bucket = buckets.get(ip)
  if (bucket && now - bucket.ts < windowMs) {
    if (bucket.count >= max) return true
    bucket.count++
  } else {
    buckets.set(ip, { ts: now, count: 1 })
    if (buckets.size > 5000) buckets.clear()
  }
  return false
}

function corsHeaders(request) {
  const origin = request.headers.get('origin') ?? ''
  const allow = ALLOWED_CORS.has(origin) ? origin : 'https://ultrametric.ai'
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  }
}

function jsonResponse(request, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request) },
  })
}

// Reject anything that could reach infrastructure instead of a public product site.
function validateTarget(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return { error: 'not a valid URL' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'only http(s) URLs' }
  if (url.username || url.password) return { error: 'credentials in URLs are not allowed' }
  if (url.port && url.port !== '80' && url.port !== '443') return { error: 'custom ports are not allowed' }
  const host = url.hostname.toLowerCase()
  if (!host.includes('.')) return { error: 'not a public hostname' }
  // IPv4/IPv6 literals (covers 127.0.0.1, 10.x, 169.254.169.254, [::1], etc.)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) {
    return { error: 'IP addresses are not allowed' }
  }
  if (
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host.endsWith('.internal') || host.endsWith('.home.arpa') || host.endsWith('.arpa')
    || host.endsWith('.onion')
  ) {
    return { error: 'internal hostnames are not allowed' }
  }
  return { origin: `${url.protocol}//${url.host}` }
}

// GET one fixed path with timeout, manual capped redirects (each hop re-validated), and a
// bounded read. Returns { status, text, finalHost } or { error }.
async function safeGet(targetOrigin, path) {
  let current = targetOrigin + path
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = validateTarget(current)
    if (check.error) return { error: `blocked redirect: ${check.error}` }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let resp
    try {
      resp = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'ProductArena-scan/1.0 (+https://ultrametric.ai/productarena/submit)' },
      })
    } catch (err) {
      clearTimeout(timer)
      return { error: 'unreachable' }
    }
    clearTimeout(timer)
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location')
      if (!loc) return { status: resp.status, text: '' }
      current = new URL(loc, current).toString()
      continue
    }
    const reader = resp.body?.getReader()
    let text = ''
    if (reader) {
      const decoder = new TextDecoder()
      let bytes = 0
      while (bytes < MAX_BODY_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        text += decoder.decode(value, { stream: true })
      }
      await reader.cancel().catch(() => {})
    }
    return { status: resp.status, text }
  }
  return { error: 'too many redirects' }
}

function looksLikeHtmlErrorPage(text) {
  const head = text.slice(0, 2000).toLowerCase()
  return head.includes('<html') && (head.includes('not found') || head.includes('404'))
}

async function handleScan(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'POST only' })

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(rateBuckets, ip, RATE_LIMIT)) {
    return jsonResponse(request, 429, { error: 'rate limited — try again in a few minutes' })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse(request, 400, { error: 'JSON body required' })
  }
  const raw = typeof body?.url === 'string' ? body.url.trim().slice(0, 2048) : ''
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const check = validateTarget(withScheme)
  if (check.error) return jsonResponse(request, 400, { error: check.error })
  const target = check.origin

  const [llms, openapi, robots, home] = await Promise.all([
    safeGet(target, '/llms.txt'),
    safeGet(target, '/openapi.json'),
    safeGet(target, '/robots.txt'),
    safeGet(target, '/'),
  ])

  const llmsFound = !llms.error && llms.status === 200 && llms.text.trim().length > 0 && !looksLikeHtmlErrorPage(llms.text) && !llms.text.trimStart().startsWith('<')
  let openapiFound = false
  if (!openapi.error && openapi.status === 200) {
    try {
      const parsed = JSON.parse(openapi.text)
      openapiFound = typeof parsed?.openapi === 'string' || typeof parsed?.swagger === 'string'
    } catch { /* not a spec */ }
  }
  const robotsText = !robots.error && robots.status === 200 ? robots.text : ''
  const homeText = !home.error && home.status === 200 ? home.text.toLowerCase() : ''

  if (home.error && llms.error && openapi.error && robots.error) {
    return jsonResponse(request, 200, { ok: false, host: new URL(target).hostname, error: 'site unreachable from our scanner' })
  }

  return jsonResponse(request, 200, {
    ok: true,
    host: new URL(target).hostname,
    scannedAt: new Date().toISOString(),
    checks: {
      llmsTxt: { found: llmsFound, bytes: llmsFound ? llms.text.length : 0 },
      openapi: { found: openapiFound },
      robots: {
        found: robotsText.length > 0,
        blocksAllAgents: /user-agent:\s*\*\s*[\r\n]+\s*disallow:\s*\/\s*$/im.test(robotsText),
      },
      homepage: {
        reachable: !home.error && (home.status ?? 0) < 400,
        mentionsMcp: /\bmcp\b|model context protocol/.test(homeText),
        mentionsApi: /\bapi\b/.test(homeText),
        mentionsCli: /\bcli\b/.test(homeText),
        mentionsDocs: /docs\.|\/docs\b|documentation/.test(homeText),
      },
    },
  })
}

// ---------------------------------------------------------------------------------------------
// Live MCP probe: POST /productarena/api/mcp-probe {arena, product, action?, token?, useSandbox?}
//
// Powers the product pages' "Try it → live MCP" in three tiers:
//   1. keyless (default) — one JSON-RPC initialize (+ tools/list when the server answers), and
//      for curated endpoints one real read-only demo tool call (action: 'call', MCP_DEMO_CALLS);
//   2. BYO-key — the visitor pastes their own credential (`token`), forwarded once as an
//      Authorization header to the allowlisted vendor endpoint, never logged or stored;
//   3. sandbox — server-side DEMO_CRED_<PRODUCTID> wrangler secrets (`useSandbox: true`),
//      provisioning guide in docs/TRY-IT-DEMO-ACCOUNTS.md.
// Everything returns a sanitized summary. An auth failure is itself the result — a 401 with
// OAuth metadata proves the server is live and tells the visitor what it takes to use it.
//
// The client NEVER supplies a URL: {arena, product} is looked up in MCP_ENDPOINTS, a static
// allowlist generated at build time by scripts/generate-mcp-allowlist.mjs from committed data
// (products.json links.mcp + evidence + proof transcripts, with a vendor-domain guard). The
// same map is generated into lib/mcpEndpoints.ts for the site; a unit test
// (__tests__/mcp-probe.test.ts) asserts the two never drift. Same timeout / bounded-read /
// per-IP rate-limit patterns as /api/scan above.

// GENERATED map — regenerate with `node scripts/generate-mcp-allowlist.mjs` and paste; do not
// hand-edit. Exported for the allowlist-sync unit test.
export const MCP_ENDPOINTS = {
  'accounting/xero': 'https://mcp.xero.com/mcp',
  'agentic-commerce/paypal-agent-commerce': 'https://mcp.paypal.com/mcp',
  'agentic-commerce/skyfire': 'https://mcp.skyfire.xyz/mcp',
  'agentic-commerce/stripe-agentic-commerce': 'https://mcp.stripe.com/',
  'ai-memory/mem0': 'https://mcp.mem0.ai/mcp',
  'ai-memory/supermemory': 'https://mcp.supermemory.ai/mcp',
  'ai-research-agents/undermind': 'https://mcp.undermind.ai/mcp',
  'ai-support-agents/intercom-fin': 'https://mcp.intercom.com/mcp',
  'ai-support-agents/lorikeet': 'https://mcp.lorikeetcx.ai/',
  'ai-support-agents/pylon': 'https://mcp.usepylon.com/',
  'api-platforms/postman': 'https://mcp.postman.com/mcp',
  'auth-platforms/better-auth': 'https://mcp.better-auth.com/mcp',
  'auth-platforms/workos': 'https://mcp.workos.com/mcp',
  'backend-as-a-service/supabase': 'https://mcp.supabase.com/mcp',
  'banking-as-a-service/stripe-treasury': 'https://mcp.stripe.com/',
  'banking-data-apis/stripe-financial-connections': 'https://mcp.stripe.com/',
  'billing-subscriptions/chargebee': 'https://mcp.chargebee.com/mcp',
  'billing-subscriptions/recurly': 'https://mcp.recurly.com/mcp',
  'billing-subscriptions/revenuecat': 'https://mcp.revenuecat.ai/mcp',
  'billing-subscriptions/stripe-billing': 'https://mcp.stripe.com/',
  'card-issuing/stripe-issuing': 'https://mcp.stripe.com/',
  'cloud-storage/box': 'https://mcp.box.com/',
  'customer-data-platforms/rudderstack': 'https://mcp.rudderstack.com/mcp',
  'design-tools/canva': 'https://mcp.canva.com/mcp',
  'design-tools/figma': 'https://mcp.figma.com/mcp',
  'docs-platforms/gitbook': 'https://mcp.gitbook.com/mcp',
  'docs-platforms/mintlify': 'https://mcp.mintlify.com/',
  'domain-registrars/dynadot': 'https://mcp.dynadot.com/mcp',
  'document-extraction/extend': 'https://mcp.extend.ai/mcp',
  'document-extraction/llamaparse': 'https://mcp.llamaindex.ai/mcp',
  'document-extraction/reducto': 'https://mcp.reducto.ai/mcp',
  'edge-platforms/cloudflare': 'https://mcp.cloudflare.com/mcp',
  'edge-platforms/vercel': 'https://mcp.vercel.com/',
  'email-apis/resend': 'https://mcp.resend.com/mcp',
  'email-marketing/bento': 'https://mcp.bentonow.com/mcp',
  'email-marketing/customer-io': 'https://mcp.customer.io/mcp',
  'email-marketing/loops': 'https://mcp.loops.so/',
  'email/agentmail': 'https://mcp.agentmail.to/mcp',
  'email/missive': 'https://mcp.missiveapp.com/',
  'equity-management/carta': 'https://mcp.app.carta.com/mcp',
  'error-tracking/honeybadger': 'https://mcp.honeybadger.io/mcp',
  'error-tracking/sentry': 'https://mcp.sentry.dev/mcp',
  'expense-management/navan': 'https://mcp.navan.com/mcp',
  'expense-management/ramp': 'https://mcp.ramp.com/mcp',
  'feature-flags/flagsmith': 'https://mcp.flagsmith.com/',
  'fraud-prevention/stripe-radar': 'https://mcp.stripe.com/',
  'identity-verification/stripe-identity': 'https://mcp.stripe.com/',
  'incident-management/incident-io': 'https://mcp.incident.io/mcp',
  'incident-management/pagerduty': 'https://mcp.pagerduty.com/mcp',
  'incident-management/rootly': 'https://mcp.rootly.com/mcp',
  'legal-ops/clerky': 'https://mcp.clerky.com/mcp',
  'marketplace-payments/stripe-connect': 'https://mcp.stripe.com/',
  'mcp-infrastructure/manufact': 'https://mcp.manufact.com/mcp',
  'meeting-ai/granola': 'https://mcp.granola.ai/mcp',
  'meeting-ai/otter': 'https://mcp.otter.ai/mcp',
  'mobile-payments/sumup': 'https://mcp.sumup.com/mcp',
  'notes-knowledge/poly': 'https://mcp.poly.app/mcp',
  'observability/honeycomb': 'https://mcp.honeycomb.io/mcp',
  'observability/new-relic': 'https://mcp.newrelic.com/mcp',
  'observability/sentry': 'https://mcp.sentry.dev/mcp',
  'payments/airwallex': 'https://mcp.airwallex.com/mcp',
  'payments/autumn': 'https://mcp.useautumn.com/mcp',
  'payments/checkout-com': 'https://mcp.checkout.com/',
  'payments/mollie': 'https://mcp.mollie.com/mcp',
  'payments/paddle': 'https://mcp.paddle.com/mcp',
  'payments/paypal': 'https://mcp.paypal.com/mcp',
  'payments/square': 'https://mcp.squareup.com/mcp',
  'payments/stripe': 'https://mcp.stripe.com/',
  'payroll/gusto': 'https://mcp.api.gusto.com/',
  'product-analytics/posthog': 'https://mcp.posthog.com/mcp',
  'product-feedback/productboard': 'https://mcp.productboard.com/',
  'scheduling/cal-com': 'https://mcp.cal.com/mcp',
  'scheduling/calendly': 'https://mcp.calendly.com/',
  'scheduling/reclaim': 'https://mcp.reclaim.ai/',
  'search-infra/algolia': 'https://mcp.algolia.com/mcp',
  'serverless-databases/neon': 'https://mcp.neon.tech/mcp',
  'stablecoin-payments/stripe-crypto': 'https://mcp.stripe.com/',
  'startup-banking/mercury': 'https://mcp.mercury.com/mcp',
  'startup-banking/ramp': 'https://mcp.ramp.com/mcp',
  'tax-automation/numeral': 'https://mcp.numeralhq.com/mcp',
  'tax-automation/stripe-tax': 'https://mcp.stripe.com/',
  'vector-databases/helixdb': 'https://mcp.helix-db.com/mcp',
  'vibe-coding/floot': 'https://mcp.floot.com/mcp',
  'voice-agents/retell': 'https://mcp.retellai.com/',
  'voice-agents/telli': 'https://mcp.telli.com/mcp',
  'voice-agents/vapi': 'https://mcp.vapi.ai/mcp',
  'web-scraping/context-dev': 'https://mcp.context.dev/mcp',
  'web-scraping/scrapingbee': 'https://mcp.scrapingbee.com/',
  'workflow-automation/make': 'https://mcp.make.com/',
}

const PROBE_RATE_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 }
const probeRateBuckets = new Map() // separate from /api/scan's and /mcp's buckets
const PROBE_PROTOCOL_VERSION = '2025-06-18'

// -- Demo tool calls ("Try it → run a real call") ----------------------------------------------
//
// For endpoints that answer keyless, the probe can go one step further than a handshake: ONE
// hand-curated, read-only, no-side-effect tool call with canned safe arguments
// (action: 'call'). The (endpoint, tool, args) triples ship in this worker — clients can never
// choose a tool or supply arguments; anything call-shaped in the request body is ignored.
//
// GENERATED map — regenerate with `node scripts/generate-mcp-demo-calls.mjs` (source:
// data/mcp-demo-calls.json, every entry verified live before curation) and paste; do not
// hand-edit. Mirrored in lib/mcpDemoCalls.ts; a unit test asserts the two never drift.
export const MCP_DEMO_CALLS = {
  'auth-platforms/better-auth': { tool: "search_docs", args: {"query":"sign in with google"}, label: "search the Better Auth docs for \"sign in with google\"" },
  'self/productarena': { tool: "top_products", args: {"metric":"agentReady","limit":5}, label: "rank the top 5 agent-ready products across every ranking" },
  'voice-agents/retell': { tool: "list_api_endpoints", args: {}, label: "list every API endpoint the Retell server exposes" },
}

// 'self/productarena' is this worker's own /productarena/mcp endpoint — see selfMcpFetch below.
const SELF_DEMO_KEY = 'self/productarena'
const SELF_MCP_ENDPOINT = 'https://ultrametric.ai/productarena/mcp'

const CALL_TIMEOUT_MS = 10_000 // tools/call may do real work upstream — longer than the 6s handshake budget
const CALL_RESULT_MAX_CHARS = 2048 // demo-call results are a taste, not an export

// -- BYO-key / sandbox credentials --------------------------------------------------------------
//
// SECURITY INVARIANT (asserted by __tests__/mcp-demo-call.test.ts, relied on by the UI copy
// "your key goes vendor-ward through our proxy once and is never logged or stored"):
//   - visitor-supplied tokens live only in this request's scope: forwarded as an Authorization
//     header to the single allowlisted HTTPS vendor endpoint, then dropped;
//   - NOTHING in this worker logs — zero console calls anywhere in the file (source-scanned
//     by a test, so a stray debug log fails CI);
//   - no storage: tokens never touch KV, caches, or any persisted state;
//   - responses are scrubbed: any echo of the credential in upstream output is redacted.
// Keep it that way when editing.

// Normalize a pasted credential into an Authorization header value. Accepts a bare key
// ("sk_test_…" → "Bearer sk_test_…") or a full header value ("Bearer x", "Basic y", "token z").
// Control characters are stripped so a pasted value can never smuggle extra headers.
function authHeaderValue(raw) {
  const t = String(raw).replace(/[\x00-\x1f\x7f]/g, '').trim()
  if (!t) return null
  return /^(bearer|basic|token)\s/i.test(t) ? t : `Bearer ${t}`
}

// Per-endpoint server-side demo credentials (the "use our sandbox account" tier): a wrangler
// secret named DEMO_CRED_<PRODUCTID> (id uppercased, dashes → underscores; e.g. payments/stripe
// → DEMO_CRED_STRIPE holding a Stripe TEST-MODE key). Provisioning list + setup steps:
// docs/TRY-IT-DEMO-ACCOUNTS.md. No secret provisioned → the tier simply doesn't appear.
function demoCredName(productId) {
  return `DEMO_CRED_${productId.toUpperCase().replace(/-/g, '_')}`
}

// Defense in depth: replace every occurrence of the credential (JSON-escaped, since we scan the
// serialized body) in an outgoing response payload. Upstream servers shouldn't echo credentials,
// but "shouldn't" is not an invariant we control.
function scrubSecrets(payload, secrets) {
  let text = JSON.stringify(payload)
  for (const secret of secrets) {
    if (typeof secret !== 'string' || secret.length < 6) continue // too short to be a real credential; avoid shredding text
    const needle = JSON.stringify(secret).slice(1, -1)
    text = text.split(needle).join('[redacted]')
  }
  return JSON.parse(text)
}

// Read a response body as text with the same MAX_BODY_BYTES cap as safeGet.
async function readBoundedBody(resp) {
  const reader = resp.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  while (bytes < MAX_BODY_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    text += decoder.decode(value, { stream: true })
  }
  await reader.cancel().catch(() => {})
  return text
}

// Streamable-HTTP servers may answer a POST as plain JSON or as an SSE stream containing the
// JSON-RPC response in a `data:` line — accept both, treat anything unparseable as null.
function parseJsonRpcBody(contentType, text) {
  if ((contentType ?? '').includes('text/event-stream')) {
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue
      try {
        const parsed = JSON.parse(line.slice(5).trim())
        if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed) return parsed
      } catch { /* keep scanning */ }
    }
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// POST one JSON-RPC message to an allowlisted endpoint. Returns
// { status, headers, message|null } or { error } (timeout / network failure).
// opts: { sessionId, authorization, timeoutMs } — `authorization` is the ONLY place a
// credential is ever attached, and only toward the allowlisted HTTPS vendor endpoint.
async function postJsonRpc(endpoint, message, fetchImpl, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS)
  let resp
  try {
    resp = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'manual', // allowlisted URLs only — never follow a server elsewhere (and never re-send auth elsewhere)
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROBE_PROTOCOL_VERSION,
        'user-agent': 'ProductArena-tryit/1.0 (+https://ultrametric.ai/productarena)',
        ...(opts.sessionId ? { 'mcp-session-id': opts.sessionId } : {}),
        ...(opts.authorization ? { authorization: opts.authorization } : {}),
      },
      body: JSON.stringify(message),
    })
  } catch {
    clearTimeout(timer)
    return { error: 'unreachable' }
  }
  clearTimeout(timer)
  const text = await readBoundedBody(resp)
  return {
    status: resp.status,
    headers: resp.headers,
    message: parseJsonRpcBody(resp.headers.get('content-type'), text),
  }
}

const clip = (value, max = 120) => String(value).slice(0, max)

// When the handshake hits an auth wall, the wall itself often tells us more: RFC 9728
// protected-resource metadata (advertised via WWW-Authenticate resource_metadata="…", with the
// spec's well-known path as fallback) names the resource, its scopes, and its authorization
// server. Fetch it so the visitor leaves the 401 with something actionable — never a URL the
// vendor could point off-host (same-hostname guard), and every field re-shaped/clipped like the
// rest of the probe summary. Any failure returns {} — enrichment only, never an error.
async function fetchAuthWallMetadata(endpoint, authHeader, fetchImpl) {
  let metaUrl = null
  const advertised = /resource_metadata="?([^",\s]+)"?/i.exec(authHeader ?? '')?.[1]
  const endpointUrl = new URL(endpoint)
  if (advertised) {
    try {
      const candidate = new URL(advertised)
      if (candidate.protocol === 'https:' && candidate.hostname === endpointUrl.hostname) {
        metaUrl = candidate.toString()
      }
    } catch { /* malformed advertisement — fall through to the well-known path */ }
  }
  if (!metaUrl) {
    const suffix = endpointUrl.pathname === '/' ? '' : endpointUrl.pathname
    metaUrl = `${endpointUrl.origin}/.well-known/oauth-protected-resource${suffix}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let resp
  try {
    resp = await fetchImpl(metaUrl, {
      method: 'GET',
      redirect: 'manual', // stay on the vendor host — never follow the wall elsewhere
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'ProductArena-tryit/1.0 (+https://ultrametric.ai/productarena)',
      },
    })
  } catch {
    clearTimeout(timer)
    return {}
  }
  clearTimeout(timer)
  if (resp.status !== 200) return {}
  let meta
  try {
    meta = JSON.parse(await readBoundedBody(resp))
  } catch {
    return {}
  }
  if (!meta || typeof meta !== 'object') return {}

  const out = {}
  if (typeof meta.resource_name === 'string' && meta.resource_name.trim()) {
    out.resourceName = clip(meta.resource_name.trim(), 80)
  }
  if (Array.isArray(meta.scopes_supported)) {
    const scopes = meta.scopes_supported.filter((s) => typeof s === 'string' && s.trim()).slice(0, 12).map((s) => clip(s.trim(), 60))
    if (scopes.length > 0) out.scopes = scopes
  }
  if (Array.isArray(meta.authorization_servers)) {
    const servers = meta.authorization_servers
      .map((s) => {
        try {
          return new URL(String(s)).hostname
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .slice(0, 3)
    if (servers.length > 0) out.authServers = servers
  }
  return out
}

// The probe itself: initialize, then (if the server answered) tools/list. Everything returned
// is reshaped into plain sanitized fields — no upstream body is ever echoed through verbatim.
// `fetchImpl` is injectable for tests (like handleJsonRpc's fetchJson). `authorization`
// (BYO-key / sandbox tiers) is forwarded to the vendor and appears nowhere in the result.
export async function probeMcpEndpoint(endpoint, fetchImpl = fetch, authorization = undefined) {
  const init = await postJsonRpc(endpoint, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROBE_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'productarena-try-it', version: '1.0' },
    },
  }, fetchImpl, { authorization })

  if (init.error) return { reachable: false, authRequired: false }

  if (init.status === 401 || init.status === 403) {
    const authHeader = init.headers.get('www-authenticate') ?? ''
    // Enrich the honest 401 with what the wall itself discloses (RFC 9728) — best-effort.
    // Skip it for an authenticated attempt: the visitor's credential was rejected, and the
    // generic wall metadata adds nothing to that answer.
    const meta = authorization ? {} : await fetchAuthWallMetadata(endpoint, authHeader, fetchImpl)
    return {
      reachable: true,
      authRequired: true,
      httpStatus: init.status,
      oauth: /bearer|resource_metadata|oauth/i.test(authHeader),
      ...meta,
    }
  }

  const serverInfo = init.message?.result?.serverInfo
  if (init.status < 200 || init.status >= 300 || !serverInfo) {
    // Live but not a handshake we understand (proxy page, redirect, protocol error) — still
    // an honest finding, reported without pretending we spoke MCP.
    return { reachable: true, authRequired: false, httpStatus: init.status, handshake: false }
  }

  const summary = {
    reachable: true,
    authRequired: false,
    httpStatus: init.status,
    handshake: true,
    serverInfo: { name: clip(serverInfo.name ?? ''), version: clip(serverInfo.version ?? '') },
    protocolVersion: clip(init.message.result.protocolVersion ?? ''),
  }

  const sessionId = init.headers.get('mcp-session-id') ?? undefined
  const tools = await postJsonRpc(endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, fetchImpl, { sessionId, authorization })
  const toolList = tools.error ? null : tools.message?.result?.tools
  if (Array.isArray(toolList)) {
    summary.toolCount = toolList.length
    summary.toolNames = toolList.slice(0, 10).map((t) => clip(t?.name ?? '', 80))
  }
  return summary
}

// Flatten a tools/call result into displayable text: join text-content parts (the common
// case), fall back to the serialized result. Clipped to CALL_RESULT_MAX_CHARS — the demo is
// a taste of the tool working, not a data export.
function callResultText(result) {
  const parts = Array.isArray(result?.content)
    ? result.content.filter((c) => c?.type === 'text' && typeof c.text === 'string').map((c) => c.text)
    : []
  const text = parts.length > 0 ? parts.join('\n') : JSON.stringify(result ?? null)
  return {
    resultText: text.slice(0, CALL_RESULT_MAX_CHARS),
    truncated: text.length > CALL_RESULT_MAX_CHARS,
  }
}

// Execute ONE curated demo tool call: initialize → notifications/initialized → tools/call with
// the shipped (tool, args) — never anything a client asked for. Same sanitized-summary
// discipline as probeMcpEndpoint; the call itself gets the longer CALL_TIMEOUT_MS budget.
export async function callMcpDemo(endpoint, demo, fetchImpl = fetch, authorization = undefined) {
  const init = await postJsonRpc(endpoint, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROBE_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'productarena-try-it', version: '1.0' },
    },
  }, fetchImpl, { authorization })

  if (init.error) return { reachable: false, authRequired: false }
  if (init.status === 401 || init.status === 403) {
    return { reachable: true, authRequired: true, httpStatus: init.status }
  }
  const serverInfo = init.message?.result?.serverInfo
  if (init.status < 200 || init.status >= 300 || !serverInfo) {
    return { reachable: true, authRequired: false, httpStatus: init.status, handshake: false }
  }

  const sessionId = init.headers.get('mcp-session-id') ?? undefined
  // Spec-required before requests; best-effort — stateless servers 202/ignore it.
  await postJsonRpc(endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' }, fetchImpl, { sessionId, authorization })

  const call = await postJsonRpc(
    endpoint,
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: demo.tool, arguments: demo.args } },
    fetchImpl,
    { sessionId, authorization, timeoutMs: CALL_TIMEOUT_MS },
  )

  const summary = {
    reachable: true,
    authRequired: false,
    httpStatus: init.status,
    handshake: true,
    serverInfo: { name: clip(serverInfo.name ?? ''), version: clip(serverInfo.version ?? '') },
  }
  if (call.error) {
    return { ...summary, call: { tool: demo.tool, label: demo.label, ok: false, error: 'tool call timed out or failed in transit' } }
  }
  const rpcErr = call.message?.error
  const result = call.message?.result
  if (!result || call.status < 200 || call.status >= 300) {
    const detail = rpcErr?.message ? clip(rpcErr.message, 200) : `HTTP ${call.status}`
    return { ...summary, call: { tool: demo.tool, label: demo.label, ok: false, error: `server rejected the call (${detail})` } }
  }
  return {
    ...summary,
    call: {
      tool: demo.tool,
      label: demo.label,
      ok: true,
      isError: result.isError === true,
      ...callResultText(result),
    },
  }
}

// In-process transport for the 'self/productarena' demo: /productarena/mcp IS this worker, and
// a worker fetch() of its own route would reach the origin (which only serves the site page),
// not this handler — so dispatch straight into handleJsonRpc. `fetchJson` is injectable for
// tests (defaults to the same fetchArenaJson the real /mcp endpoint uses).
function selfMcpFetch(fetchJson) {
  return async (_url, init) => {
    let parsed = null
    try {
      parsed = JSON.parse(init?.body ?? '')
    } catch { /* handleJsonRpc answers with a clean -32600 */ }
    const { status, body } = await handleJsonRpc(parsed, fetchJson)
    return new Response(body === null ? null : JSON.stringify(body), {
      status: body === null ? 202 : status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

// Request body: { arena, product, action?: 'probe'|'call', token?, useSandbox? }.
//   action 'probe' (default) — initialize (+ tools/list); 'call' — the ONE curated demo tool
//     call from MCP_DEMO_CALLS (client tool/args are never accepted).
//   token — BYO-key tier: a visitor-pasted credential, forwarded once as Authorization to the
//     allowlisted vendor endpoint and then discarded (see the SECURITY INVARIANT above).
//   useSandbox — sandbox tier: use the server-side DEMO_CRED_<PRODUCTID> wrangler secret.
// `env` carries the sandbox secrets; `selfFetchJson` is test injection for the self demo.
export async function handleMcpProbe(request, fetchImpl = fetch, env = undefined, selfFetchJson = undefined) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'POST only' })

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(probeRateBuckets, ip, PROBE_RATE_LIMIT)) {
    return jsonResponse(request, 429, { error: 'rate limited — try again in a few minutes' })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse(request, 400, { error: 'JSON body required' })
  }
  const arena = typeof body?.arena === 'string' ? body.arena.trim().slice(0, 100) : ''
  const product = typeof body?.product === 'string' ? body.product.trim().slice(0, 100) : ''
  if (!arena || !product) return jsonResponse(request, 400, { error: '"arena" and "product" are required' })
  const action = body?.action === 'call' ? 'call' : 'probe'

  const key = `${arena}/${product}`
  const isSelf = key === SELF_DEMO_KEY
  const endpoint = isSelf ? SELF_MCP_ENDPOINT : MCP_ENDPOINTS[key]
  if (!endpoint) {
    return jsonResponse(request, 404, { error: 'no allowlisted MCP endpoint for this product' })
  }
  const demo = MCP_DEMO_CALLS[key]
  const sandboxCred = !isSelf && typeof env?.[demoCredName(product)] === 'string' && env[demoCredName(product)] ? env[demoCredName(product)] : null

  // Resolve the auth tier. The raw token exists only in this scope — forwarded via
  // `authorization` to the one allowlisted HTTPS endpoint, scrubbed from the response,
  // never logged, never stored (SECURITY INVARIANT above).
  const rawToken = typeof body?.token === 'string' ? body.token.slice(0, 4096) : ''
  let authorization
  let auth = 'keyless'
  if (rawToken.trim()) {
    authorization = authHeaderValue(rawToken)
    auth = 'byo-key'
  } else if (body?.useSandbox === true) {
    if (!sandboxCred) return jsonResponse(request, 404, { error: 'no sandbox credential provisioned for this product' })
    authorization = authHeaderValue(sandboxCred)
    auth = 'sandbox'
  }
  const impl = isSelf ? selfMcpFetch(selfFetchJson) : fetchImpl

  if (action === 'call') {
    if (!demo) return jsonResponse(request, 404, { error: 'no curated demo call for this product' })
    // Self demo runs keyless in-process — a visitor credential has nothing to authenticate.
    const result = await callMcpDemo(endpoint, demo, impl, isSelf ? undefined : authorization)
    return jsonResponse(request, 200, scrubSecrets({
      ok: true,
      arena,
      product,
      endpoint,
      auth,
      calledAt: new Date().toISOString(),
      ...result,
    }, [rawToken.trim(), authorization, sandboxCred]))
  }

  const result = await probeMcpEndpoint(endpoint, impl, isSelf ? undefined : authorization)
  return jsonResponse(request, 200, scrubSecrets({
    ok: true,
    arena,
    product,
    endpoint,
    auth,
    probedAt: new Date().toISOString(),
    ...(demo ? { demoCall: { tool: demo.tool, label: demo.label } } : {}),
    ...(sandboxCred ? { sandboxAvailable: true } : {}),
    ...result,
  }, [rawToken.trim(), authorization, sandboxCred]))
}

// ---------------------------------------------------------------------------------------------
// Live probe re-runs: POST /productarena/api/try/:arena/:product/:probeId
//
// Powers the "Try it" microterminal's "run live" button: re-run one recorded keyless proof
// command, RIGHT NOW, as a worker-native fetch — so the terminal can show a live result next
// to the recording instead of only a replay.
//
// Attack-surface analysis (keep true when editing):
//   - The client supplies exactly three path segments; they are ONLY ever used as a lookup key
//     into LIVE_PROBES (live-probes.generated.js), a committed static manifest generated at
//     build time by pipeline/scripts/generate-live-probe-manifest.ts from the recorded proofs.
//     Unknown key -> 404. No query params, no body fields, are read at all.
//   - Every manifest entry is a fixed public https URL with static, credential-free headers and
//     a static body — the generator fails closed on shell interpolation, unknown curl flags,
//     auth-shaped headers, placeholder bodies, IP-literal/internal hosts, and non-https URLs.
//   - Execution is a plain fetch of that entry's exact (method, url, headers, body): no shell,
//     no string assembly from user input anywhere. A malicious caller can therefore reach only
//     the fixed URLs our own recorded probes already hit, at most 20 times/min/IP.
//   - The response is reshaped: status + content-type + a <=2 KB body excerpt. Upstream headers
//     (set-cookie included) are never forwarded; reads are byte-capped; timeout 10 s.
//   - Rate limit: per-isolate fixed window first, then a KV-backed cross-isolate window
//     (UM_COMPARE_STATS, `tryrl:` keys). KV keys are SHA-256-hashed IPs in minute buckets with
//     a 120 s TTL — no raw IPs at rest, nothing persists beyond two minutes. Missing binding
//     degrades to the per-isolate limiter.

const TRY_RATE_LIMIT = { max: 20, windowMs: 60 * 1000 }
const tryRateBuckets = new Map() // per-isolate first line; KV window below is the real cap
const TRY_TIMEOUT_MS = 10_000
const TRY_EXCERPT_MAX_CHARS = 2048 // the demo is a taste, not a mirror
const TRY_READ_MAX_BYTES = 32 * 1024 // bounded read; expectPattern is tested against this window

// Cross-isolate 20/min/IP window in KV. Key = tryrl:<sha256(ip) b64url, 22 chars>:<minute>,
// value = counter, TTL 120 s (KV minimum is 60; two windows covers clock skew). Fail-open on
// KV errors — the per-isolate limiter still applies.
async function tryKvRateLimited(kv, ip, nowMs = Date.now()) {
  if (!kv) return false
  try {
    const digest = await crypto.subtle.digest('SHA-256', authTextEncoder.encode(`try:${ip}`))
    const key = `tryrl:${b64urlEncode(new Uint8Array(digest)).slice(0, 22)}:${Math.floor(nowMs / TRY_RATE_LIMIT.windowMs)}`
    const current = parseInt((await kv.get(key)) ?? '0', 10)
    const count = Number.isFinite(current) ? current : 0
    if (count >= TRY_RATE_LIMIT.max) return true
    await kv.put(key, String(count + 1), { expirationTtl: 120 })
  } catch { /* KV hiccup — fall through to the per-isolate limiter's verdict */ }
  return false
}

// Execute one manifest entry as its exact argv-equivalent fetch and reshape the response into
// plain sanitized fields. `pass` compares the live result to what the RECORDED proof asserted
// (its status line and/or its own grep pattern); null when the recording pinned neither — the
// live run then reports what it saw without claiming a verdict.
export async function executeLiveProbe(probe, fetchImpl = fetch) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRY_TIMEOUT_MS)
  let resp
  try {
    resp = await fetchImpl(probe.url, {
      method: probe.method,
      redirect: probe.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'ProductArena-tryit/1.0 (+https://ultrametric.ai/productarena)',
        ...probe.headers, // static + credential-free by construction (generator fails closed)
      },
      ...(probe.body !== null && probe.method !== 'GET' && probe.method !== 'HEAD' ? { body: probe.body } : {}),
    })
  } catch {
    clearTimeout(timer)
    return { reachable: false, error: 'unreachable from our edge (network error or 10s timeout)', elapsedMs: Date.now() - started, pass: false }
  }
  clearTimeout(timer)

  // Bounded read; the reshape below is the ONLY thing that leaves — upstream headers
  // (set-cookie and all) are dropped here by construction.
  const reader = resp.body?.getReader()
  let text = ''
  let bytes = 0
  if (reader) {
    const decoder = new TextDecoder()
    while (bytes < TRY_READ_MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
    await reader.cancel().catch(() => {})
  }
  const elapsedMs = Date.now() - started

  const statusOk = probe.expectStatus === null || resp.status === probe.expectStatus
  let patternOk = true
  if (probe.expectPattern !== null) {
    try {
      patternOk = new RegExp(probe.expectPattern, probe.expectFlags ?? '').test(text)
    } catch {
      patternOk = true // pattern was vetted at generation time; never fail a run on our regex
    }
  }
  const hasAssertion = probe.expectStatus !== null || probe.expectPattern !== null
  return {
    reachable: true,
    status: resp.status,
    contentType: clip(resp.headers.get('content-type') ?? '', 100),
    elapsedMs,
    bodyExcerpt: text.slice(0, TRY_EXCERPT_MAX_CHARS),
    truncated: text.length > TRY_EXCERPT_MAX_CHARS || bytes >= TRY_READ_MAX_BYTES,
    pass: hasAssertion ? statusOk && patternOk : null,
    expected: {
      status: probe.expectStatus,
      pattern: probe.expectPattern,
    },
  }
}

export async function handleTryProbe(request, env, fetchImpl = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'POST only' })

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(tryRateBuckets, ip, TRY_RATE_LIMIT) || (await tryKvRateLimited(env?.UM_COMPARE_STATS ?? env?.PA_COMPARE_STATS, ip))) {
    return jsonResponse(request, 429, { error: 'rate limited (20 live runs / minute) — try again shortly' })
  }

  // Path segments are a LOOKUP KEY ONLY — never interpolated into a URL or anything else.
  const segments = new URL(request.url).pathname
    .slice('/api/try/'.length)
    .split('/')
    .map((s) => { try { return decodeURIComponent(s) } catch { return s } })
  if (segments.length !== 3 || segments.some((s) => !s || s.length > 100)) {
    return jsonResponse(request, 400, { error: 'expected /api/try/:arena/:product/:probeId' })
  }
  const [arena, product, probeId] = segments
  const probe = LIVE_PROBES[`${arena}/${product}/${probeId}`]
  if (!probe) return jsonResponse(request, 404, { error: 'no live-capable probe with that id (recorded-replay-only probes cannot be run live)' })

  const result = await executeLiveProbe(probe, fetchImpl)
  return jsonResponse(request, 200, {
    ok: true,
    arena,
    product,
    probeId,
    method: probe.method,
    url: probe.url,
    ranAt: new Date().toISOString(),
    ...result,
  })
}

// ---------------------------------------------------------------------------------------------
// Remote MCP endpoint: POST /productarena/mcp
//
// A keyless, rate-limited MCP server over the streamable-HTTP transport's plain-JSON response
// mode (client POSTs one JSON-RPC message, server answers with one application/json body; no
// SSE streams, no sessions — the server is fully stateless, which the MCP spec permits). It
// exposes the same eight tools as the stdio `productarena-mcp` npm package (mcp/ in the repo —
// keep the two in sync), fetching the Vercel origin's public /productarena/data/*.json files
// with a short in-isolate cache.
//
// No auth by design: this is the same public site data anyone can GET from /data/*. If we ever
// tier access ("API keys" for higher rate limits / bulk endpoints), gate it here — check an
// Authorization header before handleMcp's rate limiter and branch to a bigger limit.
// JSON-RPC handling is hand-rolled to keep the worker dependency-free.
const MCP_SERVER_VERSION = '0.2.0'
const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MCP_RATE_LIMIT = { max: 60, windowMs: 5 * 60 * 1000 }
const mcpRateBuckets = new Map() // separate from /api/scan's buckets

const DATA_CACHE_TTL_MS = 5 * 60 * 1000
const dataCache = new Map() // path -> { expiresAt, value } — per-isolate, best-effort

// Thrown for caller mistakes (unknown ids, bad params) — reported as a tool-error result.
class ArenaError extends Error {}

// GET one of the origin's static /productarena/data/*.json files, cached for 5 minutes.
async function fetchArenaJson(path) {
  const hit = dataCache.get(path)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const url = `${ORIGIN}/productarena${path}`
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } })
  if (!res.ok) throw new Error(`upstream GET ${path} -> HTTP ${res.status}`)
  const value = await res.json()
  if (dataCache.size > 500) dataCache.clear()
  dataCache.set(path, { expiresAt: Date.now() + DATA_CACHE_TTL_MS, value })
  return value
}

async function assertKnownArena(fetchJson, arena) {
  const categories = await fetchJson('/data/categories.json')
  if (!categories.some((c) => c.id === arena)) {
    throw new ArenaError(`unknown arena "${arena}" — see list_arenas for valid ids`)
  }
}

function requireString(args, key) {
  const value = args?.[key]
  if (typeof value !== 'string' || !value.trim()) throw new ArenaError(`"${key}" must be a non-empty string`)
  return value.trim()
}

// Flat (arena, product) index across every category (product ids are globally unique).
async function productIndex(fetchJson) {
  const categories = await fetchJson('/data/categories.json')
  const perArena = await Promise.all(
    categories.map(async (category) => {
      const products = await fetchJson(`/data/${category.id}/products.json`)
      return products.map((product) => ({ arena: category.id, product }))
    }),
  )
  return perArena.flat()
}

const TOP_METRICS = ['score', 'arenaScore', 'agentReady', 'agenticApp', 'apiQuality']

// Tool catalog — mirrors mcp/src/tools.ts + mcp/src/server.ts (the stdio npm package).
const MCP_TOOLS = [
  {
    name: 'list_arenas',
    title: 'List arenas',
    description: 'List every ProductArena arena/category (id, name, description, personas, themes).',
    inputSchema: { type: 'object', properties: {} },
    handler: async (fetchJson) => fetchJson('/data/categories.json'),
  },
  {
    name: 'get_rankings',
    title: 'Get rankings',
    description:
      'Get one arena\'s full leaderboard (coverage score, PA Score as "aiEra", agent-readiness, per-theme scores) plus its head-to-head battle log. Rankings are research outputs provided "as is" — verify against the cited evidence before acting (see /terms).',
    inputSchema: {
      type: 'object',
      required: ['arena'],
      properties: { arena: { type: 'string', description: 'Arena id, e.g. "desktop-os" — see list_arenas.' } },
    },
    handler: async (fetchJson, args) => {
      const arena = requireString(args, 'arena')
      await assertKnownArena(fetchJson, arena)
      return fetchJson(`/data/${arena}/rankings.json`)
    },
  },
  {
    name: 'get_product',
    title: 'Get product',
    description:
      "Get one product: metadata, leaderboard entry with rank, verdict counts, and a per-story verdict summary. For any single verdict's rationale and cited evidence URLs, follow up with get_verdict.",
    inputSchema: {
      type: 'object',
      required: ['arena', 'product'],
      properties: {
        arena: { type: 'string', description: 'Arena id — see list_arenas.' },
        product: { type: 'string', description: 'Product id within that arena — see get_rankings or search_products.' },
      },
    },
    handler: async (fetchJson, args) => {
      const arena = requireString(args, 'arena')
      const productId = requireString(args, 'product')
      await assertKnownArena(fetchJson, arena)
      const [products, stories, verdicts, rankings] = await Promise.all([
        fetchJson(`/data/${arena}/products.json`),
        fetchJson(`/data/${arena}/stories.json`),
        fetchJson(`/data/${arena}/verdicts.json`),
        fetchJson(`/data/${arena}/rankings.json`),
      ])
      const product = products.find((p) => p.id === productId)
      if (!product) throw new ArenaError(`unknown product "${productId}" in arena "${arena}" — see get_rankings or search_products`)
      const storyTitleById = new Map(stories.map((s) => [s.id, s.title]))
      const verdictCounts = { full: 0, partial: 0, none: 0, disputed: 0, na: 0 }
      const summaries = verdicts
        .filter((v) => v.productId === productId)
        .map((v) => {
          verdictCounts[v.verdict] += 1
          return {
            storyId: v.storyId,
            storyTitle: storyTitleById.get(v.storyId) ?? null,
            verdict: v.verdict,
            quality: v.quality,
            confidence: v.confidence,
          }
        })
      const index = rankings.leaderboard.findIndex((e) => e.productId === productId)
      const ranking = index === -1 ? null : { ...rankings.leaderboard[index], rank: index + 1 }
      return { arena, product, ranking, verdictCounts, verdicts: summaries }
    },
  },
  {
    name: 'get_verdict',
    title: 'Get verdict',
    description:
      'Get the full judged verdict for one (product, story) cell: verdict tier, quality, confidence, rationale, and the cited evidence URLs.',
    inputSchema: {
      type: 'object',
      required: ['arena', 'product', 'story'],
      properties: {
        arena: { type: 'string', description: 'Arena id — see list_arenas.' },
        product: { type: 'string', description: 'Product id within that arena.' },
        story: { type: 'string', description: "Story id — see get_product's verdicts list for valid ids." },
      },
    },
    handler: async (fetchJson, args) => {
      const arena = requireString(args, 'arena')
      const productId = requireString(args, 'product')
      const storyId = requireString(args, 'story')
      await assertKnownArena(fetchJson, arena)
      const [products, stories, verdicts, evidence] = await Promise.all([
        fetchJson(`/data/${arena}/products.json`),
        fetchJson(`/data/${arena}/stories.json`),
        fetchJson(`/data/${arena}/verdicts.json`),
        fetchJson(`/data/${arena}/evidence/${productId}.json`).catch(() => []),
      ])
      const product = products.find((p) => p.id === productId)
      if (!product) throw new ArenaError(`unknown product "${productId}" in arena "${arena}" — see get_rankings or search_products`)
      const story = stories.find((s) => s.id === storyId)
      if (!story) throw new ArenaError(`unknown story "${storyId}" in arena "${arena}" — see get_product's verdicts for valid story ids`)
      const verdict = verdicts.find((v) => v.productId === productId && v.storyId === storyId)
      if (!verdict) throw new ArenaError(`no verdict for product "${productId}" on story "${storyId}" in arena "${arena}"`)
      const evidenceById = new Map(evidence.map((e) => [e.id, e]))
      return {
        arena,
        productId,
        productName: product.name,
        storyId,
        storyTitle: story.title,
        storyWeight: story.weight ?? null,
        verdict: verdict.verdict,
        quality: verdict.quality,
        confidence: verdict.confidence,
        rationale: verdict.rationale,
        evidence: verdict.evidenceIds
          .map((id) => evidenceById.get(id))
          .filter(Boolean)
          .map((e) => ({ id: e.id, tier: e.tier, url: e.url })),
      }
    },
  },
  {
    name: 'search_products',
    title: 'Search products',
    description:
      'Search for products by id/name/vendor substring across every arena. Returns (arena, product) pairs to feed into get_product or compare.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', description: 'Case-insensitive substring to match against product id, name, or vendor.' } },
    },
    handler: async (fetchJson, args) => {
      const q = requireString(args, 'query').toLowerCase()
      const index = await productIndex(fetchJson)
      return index.filter(
        ({ product }) =>
          product.id.toLowerCase().includes(q) ||
          product.name.toLowerCase().includes(q) ||
          product.vendor.toLowerCase().includes(q),
      )
    },
  },
  {
    name: 'compare',
    title: 'Compare products',
    description:
      "Compare products across arenas by score: coverage score, PA Score, agent-readiness, Built-in AI score, API quality, and each product's rank within its own arena. Product ids are globally unique — no arena argument needed.",
    inputSchema: {
      type: 'object',
      required: ['products'],
      properties: {
        products: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Product ids to compare — see search_products.' },
      },
    },
    handler: async (fetchJson, args) => {
      const raw = Array.isArray(args?.products) ? args.products : null
      const ids = raw ? [...new Set(raw.filter((p) => typeof p === 'string').map((p) => p.trim().toLowerCase()).filter(Boolean))] : []
      if (ids.length === 0) throw new ArenaError('compare requires at least one product id — see search_products to find ids')
      const index = await productIndex(fetchJson)
      const byId = new Map(index.map((entry) => [entry.product.id, entry]))
      const found = ids.filter((id) => byId.has(id))
      const notFound = ids.filter((id) => !byId.has(id))
      const arenas = [...new Set(found.map((id) => byId.get(id).arena))]
      const rankingsByArena = new Map(
        await Promise.all(arenas.map(async (arena) => [arena, await fetchJson(`/data/${arena}/rankings.json`)])),
      )
      const products = found.map((id) => {
        const { arena, product } = byId.get(id)
        const leaderboard = rankingsByArena.get(arena)?.leaderboard ?? []
        const rankIndex = leaderboard.findIndex((e) => e.productId === id)
        const entry = rankIndex === -1 ? null : leaderboard[rankIndex]
        return {
          productId: id,
          name: product.name,
          vendor: product.vendor,
          arena,
          rank: rankIndex === -1 ? null : rankIndex + 1,
          fieldSize: leaderboard.length,
          score: entry?.score ?? null,
          arenaScore: entry?.aiEra ?? null,
          agentReady: entry?.agentReady ?? null,
          agenticApp: entry?.agenticApp ?? null,
          apiQuality: entry?.apiQuality ?? null,
        }
      })
      return {
        products,
        notFound,
        note:
          'Scores use the same formula everywhere, but each arena judges its own story set — cross-arena numbers are indicative, not a strict total ordering. Products in the same arena are directly comparable (see get_rankings for their head-to-head battles).',
      }
    },
  },
  {
    name: 'get_stacks',
    title: 'Get AI stacks',
    description:
      'Get ProductArena\'s curated cross-arena AI stacks (e.g. "local sovereign stack") with every scored slot resolved LIVE from current arena leaderboards; editorial slots are labeled as such.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (fetchJson) => {
      const stacks = await fetchJson('/data/ai-stacks.json')
      const arenaIds = new Set()
      for (const stack of stacks) {
        for (const slot of stack.slots) if (slot.pick.kind !== 'editorial') arenaIds.add(slot.pick.arenaId)
      }
      const arenaData = new Map(
        await Promise.all(
          [...arenaIds].map(async (arena) => {
            const [products, rankings] = await Promise.all([
              fetchJson(`/data/${arena}/products.json`).catch(() => null),
              fetchJson(`/data/${arena}/rankings.json`).catch(() => null),
            ])
            return [arena, products && rankings ? { products, rankings } : null]
          }),
        ),
      )
      return stacks.map((stack) => ({
        id: stack.id,
        name: stack.name,
        tagline: stack.tagline,
        audience: stack.audience,
        slots: stack.slots
          .map((slot) => {
            if (slot.pick.kind === 'editorial') {
              return {
                role: slot.role, why: slot.why, kind: 'editorial', arena: null, productId: null, productName: null,
                metric: null, metricValue: null, rank: null, note: slot.pick.note, editorialUrl: slot.pick.url,
              }
            }
            const data = arenaData.get(slot.pick.arenaId)
            if (!data) return null
            const metric = slot.pick.kind === 'product' ? (slot.pick.metric ?? 'agentReady') : slot.pick.metric
            const ossIds = new Set(data.products.filter((p) => p.type === 'oss').map((p) => p.id))
            const field = slot.pick.kind === 'arena-top' && slot.pick.ossOnly
              ? data.rankings.leaderboard.filter((e) => ossIds.has(e.productId))
              : data.rankings.leaderboard
            const ranked = [...field].filter((e) => e[metric] !== null).sort((a, b) => b[metric] - a[metric])
            const entry = slot.pick.kind === 'product' ? ranked.find((e) => e.productId === slot.pick.productId) : ranked[0]
            if (!entry) return null
            return {
              role: slot.role,
              why: slot.why,
              kind: slot.pick.kind,
              arena: slot.pick.arenaId,
              productId: entry.productId,
              productName: data.products.find((p) => p.id === entry.productId)?.name ?? entry.productId,
              metric,
              metricValue: entry[metric],
              rank: ranked.indexOf(entry) + 1,
              note: slot.pick.kind === 'product' ? slot.pick.note : null,
              editorialUrl: null,
            }
          })
          .filter(Boolean),
      }))
    },
  },
  {
    name: 'top_products',
    title: 'Top products',
    description:
      "Cross-arena top-N: flattens every arena's leaderboard and ranks all products by one metric. Metrics: score (story coverage), arenaScore (PA Score / aiEra), agentReady, agenticApp, apiQuality.",
    inputSchema: {
      type: 'object',
      required: ['metric'],
      properties: {
        metric: { type: 'string', enum: TOP_METRICS, description: 'Metric to rank by.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many products to return (default 10, max 50).' },
      },
    },
    handler: async (fetchJson, args) => {
      const metric = requireString(args, 'metric')
      const normalized = metric === 'aiEra' ? 'arenaScore' : metric
      if (!TOP_METRICS.includes(normalized)) throw new ArenaError(`unknown metric "${metric}" — use one of: ${TOP_METRICS.join(', ')}`)
      const field = normalized === 'arenaScore' ? 'aiEra' : normalized
      const rawLimit = typeof args?.limit === 'number' && Number.isFinite(args.limit) ? Math.floor(args.limit) : 10
      const capped = Math.max(1, Math.min(rawLimit, 50))
      const categories = await fetchJson('/data/categories.json')
      const perArena = await Promise.all(
        categories.map(async (category) => {
          const [products, rankings] = await Promise.all([
            fetchJson(`/data/${category.id}/products.json`).catch(() => null),
            fetchJson(`/data/${category.id}/rankings.json`).catch(() => null),
          ])
          if (!products || !rankings) return []
          const byId = new Map(products.map((p) => [p.id, p]))
          return rankings.leaderboard
            .filter((e) => e[field] !== null)
            .map((e) => ({
              productId: e.productId,
              name: byId.get(e.productId)?.name ?? e.productId,
              vendor: byId.get(e.productId)?.vendor ?? '',
              arena: category.id,
              metric: normalized,
              value: e[field],
              score: e.score,
              arenaScore: e.aiEra,
            }))
        }),
      )
      return perArena.flat().sort((a, b) => b.value - a.value).slice(0, capped)
    },
  },
]

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

// Handle one parsed JSON-RPC message. Returns { status, body } where body === null means
// "202 Accepted, empty response" (notifications/responses per streamable HTTP). `fetchJson`
// is injected so tests can run this without a network (see __tests__/mcp.test.ts).
export async function handleJsonRpc(message, fetchJson = fetchArenaJson) {
  if (Array.isArray(message)) {
    // JSON-RPC batching was removed in MCP protocol 2025-06-18 — reject cleanly.
    return { status: 400, body: rpcError(null, -32600, 'batch requests are not supported') }
  }
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { status: 400, body: rpcError(message?.id, -32600, 'invalid JSON-RPC 2.0 request') }
  }
  const { id, method, params } = message

  // Notifications (no id) and client responses: acknowledge with 202/empty.
  if (id === undefined || id === null) return { status: 202, body: null }

  switch (method) {
    case 'initialize': {
      const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : ''
      const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0]
      return {
        status: 200,
        body: rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'productarena-mcp', version: MCP_SERVER_VERSION },
          instructions:
            'Evidence-graded product rankings from ProductArena (ultrametric.ai/productarena). Start with list_arenas, then get_rankings/get_product; every score traces to cited evidence via get_verdict. Data is © Ultrametric Inc — brief quotes with attribution are welcome (see the repo DATA-LICENSE).',
        }),
      }
    }
    case 'ping':
      return { status: 200, body: rpcResult(id, {}) }
    case 'tools/list':
      return {
        status: 200,
        body: rpcResult(id, {
          tools: MCP_TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
        }),
      }
    case 'tools/call': {
      const name = typeof params?.name === 'string' ? params.name : ''
      const tool = MCP_TOOLS.find((t) => t.name === name)
      if (!tool) return { status: 200, body: rpcError(id, -32602, `unknown tool "${name}"`) }
      try {
        const result = await tool.handler(fetchJson, params?.arguments ?? {})
        return {
          status: 200,
          body: rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }),
        }
      } catch (err) {
        // Tool-level failures (bad ids, upstream hiccups) are tool results with isError, not
        // protocol errors — the agent should see the message and self-correct.
        const messageText = err instanceof Error ? err.message : String(err)
        return {
          status: 200,
          body: rpcResult(id, { content: [{ type: 'text', text: `Error: ${messageText}` }], isError: true }),
        }
      }
    }
    default:
      return { status: 200, body: rpcError(id, -32601, `method "${method}" not supported (this server implements initialize, ping, tools/list, tools/call)`) }
  }
}

// ---------------------------------------------------------------------------------------------
// Compare popularity counter: every proxied GET of /productarena/compare?p=a,b(,c…) increments
// a normalized-pair counter in Workers KV (binding UM_COMPARE_STATS; pre-rename
// PA_COMPARE_STATS honored as a fallback), and the keyless
// GET /productarena/api/popular-compares returns the top pairs for the /compare page's
// "Most compared" strip.
//
// Honesty & privacy by construction:
// - Pairs only: the KV keys are `pair:<idA>|<idB>` (ids sorted, lowercased) with an integer
//   count. No IPs, user agents, timestamps-per-hit, or any per-visitor state — nothing here
//   can identify a person.
// - The worker has no product catalog, so it accepts raw ids but guards the keyspace: ids must
//   match a strict slug shape and length cap, at most MAX_COMPARE_IDS ids per request are
//   counted, and the /compare CLIENT filters the endpoint's pairs down to ids it can actually
//   resolve — junk pairs never render.
// - KV get→put has no atomic increment, so concurrent hits can drop a count. Fine at current
//   traffic; this is a popularity signal, not accounting.
// - Missing binding (namespace not yet created / worker not redeployed with it) degrades
//   silently for counting and returns an explicit error for the endpoint — the client renders
//   nothing on error (honest empty state).
const COMPARE_PAIR_PREFIX = 'pair:'
const COMPARE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_COMPARE_IDS = 6 // C(6,2) = 15 pair writes worst-case per request
const POPULAR_COMPARES_LIMIT = 20
const POPULAR_CACHE_TTL_MS = 5 * 60 * 1000
let popularComparesCache = null // { expiresAt, body } — per-isolate, best-effort

// Normalize a raw ?p= value into unique, sorted, shape-valid product ids (or [] if unusable).
export function normalizeCompareIds(p) {
  if (typeof p !== 'string') return []
  const ids = [...new Set(p.split(',').map((s) => s.trim().toLowerCase()).filter((s) => COMPARE_ID_RE.test(s)))]
  if (ids.length < 2) return []
  return ids.slice(0, MAX_COMPARE_IDS).sort()
}

// Unordered pair keys for one selection: every 2-combination of the normalized ids.
export function comparePairKeys(p) {
  const ids = normalizeCompareIds(p)
  const keys = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) keys.push(`${COMPARE_PAIR_PREFIX}${ids[i]}|${ids[j]}`)
  }
  return keys
}

// Increment each pair's counter — fire-and-forget via ctx.waitUntil so the proxy response
// never waits on KV. Read-modify-write per key (KV has no atomic increment; see above).
export async function bumpComparePairs(kv, p) {
  if (!kv) return
  const keys = comparePairKeys(p)
  await Promise.all(keys.map(async (key) => {
    try {
      const current = parseInt((await kv.get(key)) ?? '0', 10)
      await kv.put(key, String((Number.isFinite(current) ? current : 0) + 1))
    } catch { /* best-effort — a lost count is fine */ }
  }))
}

// GET /productarena/api/popular-compares — keyless, top ~20 pairs, cached 5 minutes (per-isolate
// cache + cache-control for downstream caches). Read-only public aggregates: permissive CORS.
export async function handlePopularCompares(request, kv) {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'content-type': 'application/json',
    'cache-control': 'public, max-age=300',
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'GET only' }), { status: 405, headers })
  }
  if (!kv) {
    return new Response(JSON.stringify({ error: 'compare stats not available' }), { status: 503, headers })
  }
  if (popularComparesCache && popularComparesCache.expiresAt > Date.now()) {
    return new Response(popularComparesCache.body, { status: 200, headers })
  }
  let list
  try {
    list = await kv.list({ prefix: COMPARE_PAIR_PREFIX, limit: 1000 })
  } catch {
    return new Response(JSON.stringify({ error: 'compare stats not available' }), { status: 503, headers })
  }
  const entries = await Promise.all((list?.keys ?? []).map(async ({ name }) => {
    const count = parseInt((await kv.get(name).catch(() => '0')) ?? '0', 10)
    const [a, b] = name.slice(COMPARE_PAIR_PREFIX.length).split('|')
    return { a, b, count: Number.isFinite(count) ? count : 0 }
  }))
  const pairs = entries
    .filter((e) => e.a && e.b && e.count > 0)
    .sort((x, y) => y.count - x.count)
    .slice(0, POPULAR_COMPARES_LIMIT)
  const body = JSON.stringify({ ok: true, pairs, updatedAt: new Date().toISOString() })
  popularComparesCache = { expiresAt: Date.now() + POPULAR_CACHE_TTL_MS, body }
  return new Response(body, { status: 200, headers })
}

function mcpCorsHeaders() {
  // Public, read-only data — permissive CORS is deliberate (unlike /api/scan). We don't rely
  // on Origin for auth (there is none) and serve no user-specific state, so DNS-rebinding
  // concerns from the MCP spec don't apply here.
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
  }
}

// Returns a Response, or null to fall through to the transparent proxy — a plain browser GET
// of /productarena/mcp serves the Next app's human-readable "Use ProductArena from your agent"
// page at the same URL the JSON-RPC endpoint lives on.
async function handleMcp(request) {
  const headers = mcpCorsHeaders()
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method === 'GET' && !(request.headers.get('accept') ?? '').includes('text/event-stream')) {
    return null
  }
  if (request.method !== 'POST') {
    // No SSE/GET stream and no sessions to DELETE — stateless plain-JSON mode only.
    return new Response(JSON.stringify(rpcError(null, -32600, 'POST a single JSON-RPC message (streamable HTTP, JSON response mode)')), {
      status: 405,
      headers: { ...headers, allow: 'POST, OPTIONS', 'content-type': 'application/json' },
    })
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(mcpRateBuckets, ip, MCP_RATE_LIMIT)) {
    return new Response(JSON.stringify(rpcError(null, -32000, 'rate limited (60 requests / 5 min per IP) — try again in a few minutes')), {
      status: 429,
      headers: { ...headers, 'retry-after': '300', 'content-type': 'application/json' },
    })
  }

  let parsed
  try {
    parsed = await request.json()
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'parse error: body must be JSON')), {
      status: 400,
      headers: { ...headers, 'content-type': 'application/json' },
    })
  }

  const { status, body } = await handleJsonRpc(parsed)
  if (body === null) return new Response(null, { status, headers })
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } })
}

// ---------------------------------------------------------------------------------------------
// Auth backend: /productarena/auth/* (WorkOS AuthKit)
//
// The site is a static export — there is no Next server — so this worker IS the auth backend.
// Login is the standard AuthKit hosted-page flow (docs verified 2026-09-14):
//   - authorize URL:  GET https://api.workos.com/user_management/authorize
//       params client_id, redirect_uri, response_type=code, provider=authkit, state
//       https://workos.com/docs/reference/user-management/authentication/get-authorization-url
//   - code exchange:  POST https://api.workos.com/user_management/authenticate
//       JSON body { client_id, client_secret: <WorkOS API key>, grant_type:
//       "authorization_code", code } → { user: { id, email, … }, access_token, … }
//       https://workos.com/docs/reference/user-management/authentication/code
//   - logout URL:     GET https://api.workos.com/user_management/sessions/logout
//       params session_id (the access_token JWT's `sid` claim), return_to
//       https://workos.com/docs/reference/authkit/logout/get-logout-url
//
// We do NOT keep WorkOS's tokens around. The callback mints OUR session: `pa_session`, an
// HttpOnly Secure SameSite=Lax cookie scoped to ultrametric.ai (Path=/), holding a
// compact HMAC-SHA256-signed payload {sub, email, sid, exp} — no PII beyond the email, exp
// capped at 30 days, key = the PA_SESSION_KEY worker secret, signing via WebCrypto. /auth/me
// verifies it and answers {email} (or 401) for the client-side session hook (lib/session.ts).
//
// CSRF on the callback: /auth/login mints a random nonce, sets it in a short-lived `pa_state`
// cookie AND embeds it in the OAuth state parameter (alongside return_to); /auth/callback
// requires the two nonces to match. return_to is only ever honored as an ultrametric.ai path.
//
// Configuration (see docs/AUTH.md): WORKOS_CLIENT_ID is a plain var in wrangler.toml;
// WORKOS_API_KEY and PA_SESSION_KEY are worker secrets (`wrangler secret put …`). Until all
// three are set the routes fail closed with an explicit "auth not configured" 500 — the site
// itself is unaffected (the client hook degrades to anonymous).
//
// PA_SESSION_KEY is a legacy, pre-rename secret name — the deployed Cloudflare secret is
// stored under it, so renaming the binding here would break auth until the secret is re-put
// under the new name. Keep the name until the founder provisions a UM_SESSION_KEY secret and
// this read gains a dual-binding fallback (founder action — see FOUNDER-ASKS).

const WORKOS_API = 'https://api.workos.com'
const AUTH_SITE = 'https://ultrametric.ai'
const AUTH_CALLBACK_URL = `${AUTH_SITE}/auth/callback`
const SESSION_COOKIE = 'pa_session'
const STATE_COOKIE = 'pa_state'
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60 // hard cap — verifySession also rejects longer exps
// No sliding refresh by design: the exp minted at login is final, so a stolen cookie can never
// outlive 30 days, and rotating PA_SESSION_KEY (docs/AUTH.md) stays a true kill switch.

// -- Mock mode (dev-only test harness) ----------------------------------------------------------
//
// WORKOS_MOCK=1 short-circuits /auth/login into an immediate pa_session for test@ultrametric.ai
// with NO WorkOS round-trip and NO secrets, so the whole flow (login → account chip → star →
// /watchlist → logout) is testable before the founder sets the real config:
//
//   cd infra/cloudflare-proxy && wrangler dev --var WORKOS_MOCK:1
//
// Two safeguards keep mock mode out of production:
//   1. WORKOS_MOCK must NEVER be added to wrangler.toml [vars] — pass it per-run via
//      `wrangler dev --var WORKOS_MOCK:1` only (wrangler.toml carries the same warning).
//   2. Hard host guard (isMockAuth): mock never activates for requests on ultrametric.ai, even
//      if the var somehow ships in a deploy — production behavior is unchanged regardless.
const MOCK_EMAIL = 'test@ultrametric.ai'
const MOCK_SUB = 'user_mock_test'
// Dev-only cookie-signing fallback so mock mode needs no PA_SESSION_KEY either. Worthless as a
// secret by design: the host guard means it can only ever sign cookies off-production.
const MOCK_SESSION_KEY = 'pa-mock-dev-session-key-not-a-secret'

export function isMockAuth(env, url) {
  return env?.WORKOS_MOCK === '1' && url.hostname !== 'ultrametric.ai'
}

// Per-request auth context: the mock flag, the origin return_to is validated against (mock runs
// on http://localhost:8787, so its own origin), and the cookie-signing key.
function authContext(env, url) {
  const mock = isMockAuth(env, url)
  return {
    mock,
    site: mock ? url.origin : AUTH_SITE,
    sessionKey: env?.PA_SESSION_KEY || (mock ? MOCK_SESSION_KEY : null),
  }
}

const authTextEncoder = new TextEncoder()

function b64urlEncode(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    authTextEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return b64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, authTextEncoder.encode(data))))
}

// Constant-time string compare (both sides are same-alphabet base64url here).
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Mint a pa_session value: base64url(JSON{sub,email,sid,exp}) + '.' + base64url(HMAC-SHA256).
export async function createSessionCookieValue(secret, { sub, email, sid }, nowMs = Date.now()) {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_S
  const payload = b64urlEncode(authTextEncoder.encode(JSON.stringify({ sub, email, sid, exp })))
  return `${payload}.${await hmacSign(secret, payload)}`
}

// Verify a pa_session value → claims object, or null for anything invalid: bad shape, bad
// signature (constant-time compare), expired, or an exp further out than we would ever mint.
export async function verifySessionCookieValue(secret, value, nowMs = Date.now()) {
  if (typeof value !== 'string' || !value) return null
  const parts = value.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  if (!timingSafeEqual(parts[1], await hmacSign(secret, parts[0]))) return null
  let claims
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])))
  } catch {
    return null
  }
  if (!claims || typeof claims !== 'object') return null
  if (typeof claims.email !== 'string' || !claims.email) return null
  if (typeof claims.exp !== 'number') return null
  if (claims.exp * 1000 <= nowMs) return null
  if (claims.exp > Math.floor(nowMs / 1000) + SESSION_MAX_AGE_S + 60) return null
  return claims
}

// Pull the WorkOS session id out of the access_token JWT's `sid` claim (needed for the logout
// URL). Decode-only — the token came straight from WorkOS over TLS, we never trust it for auth.
export function sidFromAccessToken(token) {
  if (typeof token !== 'string') return undefined
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  try {
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])))
    return typeof claims?.sid === 'string' && claims.sid !== '' ? claims.sid : undefined
  } catch {
    return undefined
  }
}

// Only ever send readers back to a path on OUR origin (ultrametric.ai in production; the
// request's own localhost origin in mock mode) — absolute URLs on any other origin,
// scheme-relative //host tricks, and backslash smuggling all fall back to the PA home page.
export function sanitizeReturnTo(raw, site = AUTH_SITE) {
  const fallback = `${site}/`
  if (typeof raw !== 'string' || raw === '') return fallback
  let path = raw
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url
    try {
      url = new URL(raw)
    } catch {
      return fallback
    }
    if (url.origin !== site) return fallback
    path = url.pathname + url.search + url.hash
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback
  return site + path
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

// Session cookie attributes. Mock mode serves off http://localhost, so the cookie must be
// host-only (no Domain — a Domain=ultrametric.ai cookie is rejected there) and non-Secure.
function sessionSetCookie(ctx, value, maxAge) {
  return ctx.mock
    ? `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`
    : `${SESSION_COOKIE}=${value}; Domain=ultrametric.ai; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

function stateSetCookie(value, maxAge) {
  return `${STATE_COOKIE}=${value}; Domain=ultrametric.ai; Path=/auth; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

function authJson(status, body, extraHeaders) {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' })
  for (const [k, v] of Object.entries(extraHeaders ?? {})) headers.append(k, v)
  return new Response(JSON.stringify(body), { status, headers })
}

// Fail-closed helper for missing configuration — explicit so a half-set-up deploy is obvious.
function authNotConfigured(missing) {
  return authJson(500, {
    error: `auth not configured: ${missing} is not set — see docs/AUTH.md for the two "wrangler secret put" commands and the WORKOS_CLIENT_ID var`,
  })
}

// All four /productarena/auth/* routes. `fetchImpl` is injectable for tests (no network), same
// pattern as probeMcpEndpoint / handleJsonRpc above.
export async function handleAuth(request, env, fetchImpl = fetch) {
  const url = new URL(request.url)
  const ctx = authContext(env, url)
  const route = url.pathname.slice('/auth'.length)
  if (request.method !== 'GET') {
    return authJson(405, { error: 'GET only' }, { allow: 'GET' })
  }

  // GET /auth/me → {email} from a valid pa_session cookie, else 401. Keyless: verification
  // only needs PA_SESSION_KEY. Same-origin only (the static site fetches it relatively), so no
  // CORS headers — cross-origin readers can't see the result.
  if (route === '/me') {
    if (!ctx.sessionKey) return authNotConfigured('PA_SESSION_KEY secret')
    const claims = await verifySessionCookieValue(ctx.sessionKey, getCookie(request, SESSION_COOKIE))
    if (!claims) return authJson(401, { error: 'no session' })
    return authJson(200, { email: claims.email })
  }

  // GET /auth/login?return_to=… → 302 to the WorkOS AuthKit hosted page. State carries
  // {nonce, return_to}; the nonce is mirrored into the short-lived pa_state cookie (CSRF).
  if (route === '/login') {
    // Mock mode (dev-only, see the section comment above): skip WorkOS entirely — mint the
    // pa_session for the fixed test identity and bounce straight back to return_to.
    if (ctx.mock) {
      const cookieValue = await createSessionCookieValue(ctx.sessionKey, {
        sub: MOCK_SUB,
        email: MOCK_EMAIL,
        sid: undefined, // no WorkOS session exists — logout goes straight back to return_to
      })
      return new Response(null, {
        status: 302,
        headers: {
          location: sanitizeReturnTo(url.searchParams.get('return_to'), ctx.site),
          'set-cookie': sessionSetCookie(ctx, cookieValue, SESSION_MAX_AGE_S),
          'cache-control': 'no-store',
        },
      })
    }
    if (!env?.WORKOS_CLIENT_ID) return authNotConfigured('WORKOS_CLIENT_ID var')
    const returnTo = sanitizeReturnTo(url.searchParams.get('return_to'))
    const nonce = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)))
    const state = b64urlEncode(authTextEncoder.encode(JSON.stringify({ n: nonce, r: returnTo })))
    const authorize = new URL(`${WORKOS_API}/user_management/authorize`)
    authorize.searchParams.set('client_id', env.WORKOS_CLIENT_ID)
    authorize.searchParams.set('redirect_uri', AUTH_CALLBACK_URL)
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('provider', 'authkit')
    authorize.searchParams.set('state', state)
    const hint = url.searchParams.get('screen_hint')
    if (hint === 'sign-up' || hint === 'sign-in') authorize.searchParams.set('screen_hint', hint)
    return new Response(null, {
      status: 302,
      headers: {
        location: authorize.toString(),
        'set-cookie': stateSetCookie(nonce, 600),
        'cache-control': 'no-store',
      },
    })
  }

  // GET /auth/callback?code=…&state=… → CSRF check, code exchange, mint pa_session, bounce
  // back to the state's return_to.
  if (route === '/callback') {
    if (!env?.WORKOS_CLIENT_ID) return authNotConfigured('WORKOS_CLIENT_ID var')
    if (!env?.WORKOS_API_KEY) return authNotConfigured('WORKOS_API_KEY secret')
    if (!env?.PA_SESSION_KEY) return authNotConfigured('PA_SESSION_KEY secret')

    const oauthError = url.searchParams.get('error')
    if (oauthError) {
      return authJson(400, { error: `WorkOS returned an error: ${String(oauthError).slice(0, 200)}` })
    }
    const code = url.searchParams.get('code')
    if (!code) return authJson(400, { error: 'missing code' })

    let state
    try {
      state = JSON.parse(new TextDecoder().decode(b64urlDecode(url.searchParams.get('state') ?? '')))
    } catch {
      return authJson(400, { error: 'malformed state' })
    }
    const cookieNonce = getCookie(request, STATE_COOKIE)
    if (!cookieNonce || typeof state?.n !== 'string' || !timingSafeEqual(state.n, cookieNonce)) {
      return authJson(400, { error: 'state mismatch (CSRF check failed) — start again from /productarena/auth/login' })
    }

    // Code → user. https://workos.com/docs/reference/user-management/authentication/code
    let exchange
    try {
      exchange = await fetchImpl(`${WORKOS_API}/user_management/authenticate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.WORKOS_CLIENT_ID,
          client_secret: env.WORKOS_API_KEY,
          grant_type: 'authorization_code',
          code,
        }),
      })
    } catch {
      return authJson(502, { error: 'could not reach WorkOS for the code exchange' })
    }
    if (!exchange.ok) {
      return authJson(502, { error: `WorkOS code exchange failed (HTTP ${exchange.status})` })
    }
    let data
    try {
      data = await exchange.json()
    } catch {
      return authJson(502, { error: 'WorkOS code exchange returned a non-JSON body' })
    }
    const user = data?.user
    if (typeof user?.id !== 'string' || typeof user?.email !== 'string' || user.email === '') {
      return authJson(502, { error: 'WorkOS code exchange response had no user' })
    }

    const cookieValue = await createSessionCookieValue(env.PA_SESSION_KEY, {
      sub: user.id,
      email: user.email,
      sid: sidFromAccessToken(data.access_token),
    })
    const headers = new Headers({ 'cache-control': 'no-store' })
    headers.set('location', sanitizeReturnTo(typeof state.r === 'string' ? state.r : ''))
    headers.append('set-cookie', sessionSetCookie(ctx, cookieValue, SESSION_MAX_AGE_S))
    headers.append('set-cookie', stateSetCookie('', 0)) // one-time nonce — burn it
    return new Response(null, { status: 302, headers })
  }

  // GET /auth/logout?return_to=… → clear pa_session; if we know the WorkOS session id, bounce
  // through WorkOS's logout URL (ends the AuthKit session too) with return_to; else go
  // straight back. https://workos.com/docs/reference/authkit/logout/get-logout-url
  if (route === '/logout') {
    const returnTo = sanitizeReturnTo(url.searchParams.get('return_to'), ctx.site)
    const claims = ctx.sessionKey
      ? await verifySessionCookieValue(ctx.sessionKey, getCookie(request, SESSION_COOKIE))
      : null
    let location = returnTo
    // Mock sessions have no WorkOS sid, so mock logout is always the direct bounce (the !mock
    // guard is belt-and-braces — never send a dev browser to WorkOS).
    if (!ctx.mock && typeof claims?.sid === 'string' && claims.sid !== '') {
      const logout = new URL(`${WORKOS_API}/user_management/sessions/logout`)
      logout.searchParams.set('session_id', claims.sid)
      logout.searchParams.set('return_to', returnTo)
      location = logout.toString()
    }
    const headers = new Headers({ 'cache-control': 'no-store', location })
    headers.append('set-cookie', sessionSetCookie(ctx, '', 0))
    return new Response(null, { status: 302, headers })
  }

  return authJson(404, { error: 'unknown auth route' })
}

// ---------------------------------------------------------------------------------------------
// Watchlist API: GET/PUT /productarena/api/watchlist — the logged-in reader's starred product
// ids (the account feature login unlocks; client: lib/watchlist.ts + components/WatchButton.tsx).
//
//   GET                      → { ok, ids: string[] }
//   PUT  { ids: string[] }   → { ok, ids } (normalized) — replaces the whole list; the client
//                              always sends its full merged state, so PUT is idempotent.
//
// Auth-gated by the same pa_session cookie the /auth/* routes mint — 401 otherwise (anonymous
// readers stay localStorage-only client-side). Same-origin only: no CORS headers, so a
// cross-origin page can never read or write a reader's list, and SameSite=Lax means cross-site
// PUTs never carry the cookie anyway. Storage: one KV value per account under
// watchlist:<WorkOS user id> — the UM_WATCHLIST namespace when bound, else UM_COMPARE_STATS
// (pre-rename PA_* binding names honored as fallbacks; the watchlist: prefix can't collide
// with its pair: keys), so going live needs no new
// namespace. Ids are product slugs; anything unshaped is dropped and the list is capped —
// junk could only ever waste bytes, the site resolves ids against its own catalog client-side.

const WATCHLIST_KEY_PREFIX = 'watchlist:'
const WATCHLIST_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/ // same slug shape as compare ids
const WATCHLIST_MAX_IDS = 500
const WATCHLIST_RATE_LIMIT = { max: 120, windowMs: 5 * 60 * 1000 }
const watchlistRateBuckets = new Map() // separate from the other buckets

// null = not an array at all (a 400); otherwise the deduped, slug-validated, capped list.
export function normalizeWatchlistIds(raw) {
  if (!Array.isArray(raw)) return null
  const ids = []
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const id = value.trim().toLowerCase()
    if (!WATCHLIST_ID_RE.test(id) || ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= WATCHLIST_MAX_IDS) break
  }
  return ids
}

export async function handleWatchlist(request, env) {
  const url = new URL(request.url)
  const ctx = authContext(env, url)
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return authJson(405, { error: 'GET or PUT only' }, { allow: 'GET, PUT' })
  }
  if (!ctx.sessionKey) return authNotConfigured('PA_SESSION_KEY secret')
  const claims = await verifySessionCookieValue(ctx.sessionKey, getCookie(request, SESSION_COOKIE))
  if (!claims || typeof claims.sub !== 'string' || claims.sub === '') {
    return authJson(401, { error: 'log in to keep a watchlist' })
  }
  const kv = env?.UM_WATCHLIST ?? env?.PA_WATCHLIST ?? env?.UM_COMPARE_STATS ?? env?.PA_COMPARE_STATS
  if (!kv) return authJson(503, { error: 'watchlist storage not available' })
  const key = `${WATCHLIST_KEY_PREFIX}${claims.sub}`

  if (request.method === 'GET') {
    let ids = []
    try {
      const stored = await kv.get(key)
      ids = normalizeWatchlistIds(stored ? JSON.parse(stored) : []) ?? []
    } catch {
      ids = [] // unreadable KV / stored junk degrades to empty, same as the client-side parser
    }
    return authJson(200, { ok: true, ids })
  }

  // PUT
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(watchlistRateBuckets, ip, WATCHLIST_RATE_LIMIT)) {
    return authJson(429, { error: 'rate limited — try again in a few minutes' })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return authJson(400, { error: 'JSON body required' })
  }
  const ids = normalizeWatchlistIds(body?.ids)
  if (ids === null) return authJson(400, { error: '"ids" must be an array of product-id strings' })
  try {
    await kv.put(key, JSON.stringify(ids))
  } catch {
    return authJson(503, { error: 'watchlist storage not available' })
  }
  return authJson(200, { ok: true, ids })
}

// ---------------------------------------------------------------------------------------------
// My Stack API: GET/PUT /productarena/api/my-stack — the logged-in reader's account stack, an
// ORDERED LIST of product picks per arena, first = primary (client: lib/myStack.ts's
// account-stack half; UI: /my-stack + /account "Your stack" and the process pages' "Check my
// process"). Same posture as the Watchlist API above in every particular — session gate,
// same-origin only (no CORS), KV storage, rate limit, tolerant normalization:
//
//   GET                       → { ok, stack: { [arenaId]: productId[] } }
//   PUT  { stack: {…} }       → { ok, stack } (normalized) — replaces the whole map; the client
//                               always sends its full merged state, so PUT is idempotent.
//
// v1 → v2: values used to be a single productId string ("one pick per arena"). Both shapes are
// accepted — from a PUT body and from stored KV — a bare string migrates to a one-element
// array; normalized output is always v2 arrays (the same dual-shape contract as the client's
// parseStackMap).
//
// Storage: one KV value per account under stack:<WorkOS user id> — the UM_WATCHLIST namespace
// when bound, else UM_COMPARE_STATS (pre-rename PA_* binding names honored as fallbacks;
// the stack: prefix can't collide with pair:/watchlist:/
// tryrl: keys). Both keys and values must be slug-shaped and the map is capped (arenas AND
// picks per arena); junk could only ever waste bytes — the site resolves the map against its
// own judged catalog client-side.

const STACK_KEY_PREFIX = 'stack:'
const STACK_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/ // same slug shape as watchlist/compare ids
const STACK_MAX_ARENAS = 100
const STACK_MAX_PICKS_PER_ARENA = 8 // mirrors lib/myStack.ts MAX_PICKS_PER_ARENA
const STACK_RATE_LIMIT = { max: 120, windowMs: 5 * 60 * 1000 }
const stackRateBuckets = new Map() // separate from the other buckets

// null = not a plain object at all (a 400); otherwise the slug-validated, capped map of arrays.
// Junk entries (non-string/non-array values, unslug-like keys/values, dupes, over-cap picks)
// are dropped, not errors; a v1 string value normalizes to [string].
export function normalizeStackMap(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const stack = {}
  let kept = 0
  for (const [rawArena, rawValue] of Object.entries(raw)) {
    const list = typeof rawValue === 'string' ? [rawValue] : Array.isArray(rawValue) ? rawValue : null
    if (list === null) continue
    const arenaId = rawArena.trim().toLowerCase()
    if (!STACK_ID_RE.test(arenaId)) continue
    const picks = []
    for (const rawProduct of list) {
      if (typeof rawProduct !== 'string') continue
      const productId = rawProduct.trim().toLowerCase()
      if (!STACK_ID_RE.test(productId) || picks.includes(productId)) continue
      picks.push(productId)
      if (picks.length >= STACK_MAX_PICKS_PER_ARENA) break
    }
    if (picks.length === 0) continue
    stack[arenaId] = picks
    kept += 1
    if (kept >= STACK_MAX_ARENAS) break
  }
  return stack
}

export async function handleMyStack(request, env) {
  const url = new URL(request.url)
  const ctx = authContext(env, url)
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return authJson(405, { error: 'GET or PUT only' }, { allow: 'GET, PUT' })
  }
  if (!ctx.sessionKey) return authNotConfigured('PA_SESSION_KEY secret')
  const claims = await verifySessionCookieValue(ctx.sessionKey, getCookie(request, SESSION_COOKIE))
  if (!claims || typeof claims.sub !== 'string' || claims.sub === '') {
    return authJson(401, { error: 'log in to keep a stack' })
  }
  const kv = env?.UM_WATCHLIST ?? env?.PA_WATCHLIST ?? env?.UM_COMPARE_STATS ?? env?.PA_COMPARE_STATS
  if (!kv) return authJson(503, { error: 'stack storage not available' })
  const key = `${STACK_KEY_PREFIX}${claims.sub}`

  if (request.method === 'GET') {
    let stack = {}
    try {
      const stored = await kv.get(key)
      stack = normalizeStackMap(stored ? JSON.parse(stored) : {}) ?? {}
    } catch {
      stack = {} // unreadable KV / stored junk degrades to empty, same as the client-side parser
    }
    return authJson(200, { ok: true, stack })
  }

  // PUT
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (isRateLimited(stackRateBuckets, ip, STACK_RATE_LIMIT)) {
    return authJson(429, { error: 'rate limited — try again in a few minutes' })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return authJson(400, { error: 'JSON body required' })
  }
  const stack = normalizeStackMap(body?.stack)
  if (stack === null) return authJson(400, { error: '"stack" must be an object of arenaId → productId list (or single id)' })
  try {
    await kv.put(key, JSON.stringify(stack))
  } catch {
    return authJson(503, { error: 'stack storage not available' })
  }
  return authJson(200, { ok: true, stack })
}

// Retired-landing /process/<slug> guides whose product /processes/<slug> equivalent has a
// DIFFERENT slug (left: landing slug, right: corpus slug per lib/processes.ts processSlug()),
// plus the app-specific guides with no corpus equivalent (mapped to '' → the /processes
// index). Every other crawled landing slug matches the corpus slug byte-for-byte and passes
// through unchanged — see the routing block in fetch() below.
const PROCESS_SLUG_RENAMES = {
  'close-the-books': 'bookkeeping-close',
  'get-an-ein': 'get-ein',
  'file-a-trademark': 'file-trademark',
  'file-delaware-franchise-tax': 'file-de-franchise-tax',
  'generate-a-company-website': 'generate-a-website',
  'hire-your-first-employee': 'hire-first-employee',
  'incorporate-a-delaware-c-corp': 'incorporate-c-corp',
  'send-an-nda': 'send-nda',
  // AFK-app-specific guides — no corpus equivalent; land on the corpus index.
  'extract-ultrametric-context': '',
  'list-capabilities': '',
  'list-my-tasks': '',
  'summarize-my-company': '',
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // ── Ultrametric rebrand cutover (founder 2026-09-28) ─────────────────────────────────
    // The product moved from ultrametric.ai/productarena/* to the root of ultrametric.ai.
    // '/' serves the company landing homepage — since 2026-09-29 ported into the product app
    // itself (app/home, block 2 below) — and the product's index page ("Open rankings for the
    // AI era") serves at /overall for now.
    // 1. Legacy /productarena URLs 301 without the prefix — every old deep link, badge embed,
    //    and indexed page keeps working; the bare product URL goes to /overall.
    if (url.pathname === '/productarena' || url.pathname.startsWith('/productarena/')) {
      const stripped = url.pathname.slice('/productarena'.length) || '/'
      // 1a. /productarena/data/* serves the data files DIRECTLY (same pathname-rewrite trick as
      //     /overall below), not a 301: the shipped ultrametric CLI (≤0.4.1 ProductArenaClient)
      //     fetches these exact URLs with redirect:'error', so a redirect fails every `arena`
      //     command with NETWORK_ERROR (verified 2026-10-05, docs/cli-sandbox-spike/). Serving
      //     200 here fixes every installed CLI without an npm release. Non-data legacy paths
      //     keep the redirects below.
      if (stripped === '/data' || stripped.startsWith('/data/')) {
        url.pathname = stripped // fall through to the origin proxy below
      } else if (stripped === '/') {
        // Bare /productarena → /overall as an UNCACHEABLE 302: the target is "for now" (founder),
        // and the earlier 301 to '/' got permanently cached by browsers — never again. Deep paths
        // keep 301 (their root-path targets are stable; old links/badges/SEO keep working).
        return new Response(null, {
          status: 302,
          headers: { Location: `https://ultrametric.ai/overall${url.search}`, 'Cache-Control': 'no-store' },
        })
      } else {
        return Response.redirect(`https://ultrametric.ai${stripped}${url.search}`, 301)
      }
    }
    // 1b. /v2 → /get-started (founder 2026-09-29 rename): the dedicated Ultrametric CLI/MCP
    //     product page lives at app/get-started; every /v2 link 301s there. NOTE: a Cloudflare
    //     ZONE rule still intercepts /v2 ahead of this worker and serves the retired landing
    //     origin's snapshot — the redirect takes effect the moment the founder removes it.
    if (url.pathname === '/v2' || url.pathname.startsWith('/v2/')) {
      return new Response(null, {
        status: 301,
        headers: { Location: `https://ultrametric.ai/get-started${url.search}`, 'Cache-Control': 'no-store' },
      })
    }
    // 1c. /virtual-startup → /startup-sim (founder 2026-10-01 rename): the open startup
    //     simulator moved routes. Old links carry live state in the query (?run= replay
    //     permalinks, ?preset=/?yc= setups, ?geo=), so the query string rides the 301 verbatim;
    //     sub-paths keep their tail (the /v2 pattern, but path-preserving — the sim may grow
    //     sub-routes and old deep links should land on their new twin, not the index).
    if (url.pathname === '/virtual-startup' || url.pathname.startsWith('/virtual-startup/')) {
      const tail = url.pathname.slice('/virtual-startup'.length)
      return new Response(null, {
        status: 301,
        headers: { Location: `https://ultrametric.ai/startup-sim${tail}${url.search}`, 'Cache-Control': 'no-store' },
      })
    }
    // 2. The landing pages are ported INTO the product app (founder 2026-09-29: "the top bar
    //    we use should be constant through the site") — the separate Astro landing origin, its
    //    HTMLRewriter header-injection shims, and its asset passthroughs (/_astro, /faces) are
    //    all retired. '/' serves the ported landing homepage (app/home) via the same
    //    pathname-rewrite trick as /overall below; /company and /tos are ordinary product
    //    routes now and just fall through to the proxy. Old Astro-only paths 301:
    if (url.pathname === '/') {
      url.pathname = '/home'
    }
    // 2a. /afk (the AFK product page's original path) → its ported home.
    if (url.pathname === '/afk' || url.pathname.startsWith('/afk/')) {
      return Response.redirect(`https://ultrametric.ai/company${url.search}`, 301)
    }
    // 2b. The /process/* landing guides are superseded by the product /processes corpus.
    //     84 of the 96 crawled landing slugs match a corpus slug (or alias) exactly and keep
    //     their slug; PROCESS_SLUG_RENAMES maps the renamed ones and sends the app-specific
    //     guides with no corpus equivalent to the index. Unknown slugs pass through unchanged
    //     (the corpus route 404s them, same end state as the retired landing origin).
    if (url.pathname === '/process' || url.pathname.startsWith('/process/')) {
      const slug = url.pathname.slice('/process/'.length).replace(/\/+$/, '')
      const mapped = Object.prototype.hasOwnProperty.call(PROCESS_SLUG_RENAMES, slug)
        ? PROCESS_SLUG_RENAMES[slug]
        : slug
      const target = mapped ? `/processes/${mapped}` : '/processes'
      return Response.redirect(`https://ultrametric.ai${target}${url.search}`, 301)
    }
    // 3. /overall serves the product homepage (the Next app's index at the origin root).
    if (url.pathname === '/overall' || url.pathname === '/overall/') {
      url.pathname = '/'
    }

    if (url.pathname.startsWith('/auth/')) return handleAuth(request, env)
    if (url.pathname === '/api/watchlist') return handleWatchlist(request, env)
    if (url.pathname === '/api/my-stack') return handleMyStack(request, env)
    if (url.pathname === '/api/scan') return handleScan(request)
    if (url.pathname === '/api/mcp-probe') return handleMcpProbe(request, fetch, env)
    if (url.pathname.startsWith('/api/try/')) return handleTryProbe(request, env)
    if (url.pathname === '/api/popular-compares') {
      return handlePopularCompares(request, env?.UM_COMPARE_STATS ?? env?.PA_COMPARE_STATS)
    }
    // /productarena/mcp retired (founder 2026-09-23): ProductArena is not offered over its own
    // MCP server — a first-party Ultrametric MCP + API is coming instead. JSON-RPC POSTs get an
    // explicit 410 pointing at the data API; GETs fall through to the site's /mcp redirect page.
    if (url.pathname === '/mcp' && request.method === 'POST') {
      return new Response(
        JSON.stringify({ error: 'gone', message: 'The ProductArena MCP server is retired. Use the JSON data API (https://ultrametric.ai/data/categories.json) or /llms.txt. A first-party Ultrametric MCP is coming.' }),
        { status: 410, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Compare popularity: count pair selections without ever delaying the page (see the
    // "Compare popularity counter" section). GETs only; the response is the plain proxy below.
    if (request.method === 'GET' && url.pathname === '/compare' && url.searchParams.get('p')) {
      ctx?.waitUntil?.(bumpComparePairs(env?.UM_COMPARE_STATS ?? env?.PA_COMPARE_STATS, url.searchParams.get('p')))
    }

    const upstream = new URL(url.pathname + url.search, ORIGIN)
    const resp = await fetch(upstream, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    })
    // Rewrite any absolute redirects back onto ultrametric.ai
    const headers = new Headers(resp.headers)
    const loc = headers.get('location')
    if (loc && loc.startsWith(ORIGIN)) {
      headers.set('location', loc.replace(ORIGIN, 'https://ultrametric.ai'))
    }
    return new Response(resp.body, { status: resp.status, headers })
  },
}
