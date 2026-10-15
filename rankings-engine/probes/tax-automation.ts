import { CURL_MCP_INIT, type LocalProbe } from './types'

// Sales-tax automation: the arena splits into agent-era vendors and a pre-agent one. Kintsugi's
// account-data MCP (docs.trykintsugi.com/mcp) completes a keyless initialize with real
// serverInfo and instructions — the handshake finishes before any API key is asked for. Stripe
// and Avalara both answer keyless MCP initializes with RFC 9728 oauth-protected-resource
// challenges (Avalara runs FIVE hosted MCP servers; mcp.avalara.com/avatax recorded). Numeral's
// MCP answers with a clean JSON-RPC "Bearer token not provided" 401. Every vendor's API answers
// keyless with a documented challenge — Anrok's all-POST API replies with its literal
// 'Missing "Authorization" header.' contract, Kintsugi's 422 lists the required
// x-organization-id header, TaxJar's 401 names the denied route. llms.txt is live on Stripe,
// Avalara, Numeral, and Kintsugi docs hosts; TaxJar (the Stripe-owned line) and Anrok have
// none — the absence is the finding. All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Stripe Tax's calculations API answers a keyless POST with Stripe's canonical 401.
    probeId: 'api-auth-challenge',
    productId: 'stripe-tax',
    storyIds: ['realtime-tax-calculation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://api.stripe.com/v1/tax/calculations -H 'Content-Type: application/json' | head -3`],
    displayCommand: `curl -si -X POST https://api.stripe.com/v1/tax/calculations | head -3  # Tax calculations API, keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP server answers a keyless initialize with its OAuth
    // protected-resource challenge — Tax tools (calculations, registrations, settings) ride
    // the same platform surface.
    probeId: 'mcp-authgate',
    productId: 'stripe-tax',
    storyIds: ['agentic-mcp-server', 'agent-reads-tax-state'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.stripe.com/ -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.stripe.com/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the remote MCP server Stripe documents at docs.stripe.com/mcp`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // docs.stripe.com serves llms.txt (and .md twins of every Tax docs page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-tax',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Avalara's hosted AvaTax MCP server (one of five it documents at
    // developer.avalara.com/mcp-servers) answers a keyless initialize with its RFC 9728
    // oauth-protected-resource challenge.
    probeId: 'mcp-authgate',
    productId: 'avalara',
    storyIds: ['agentic-mcp-server', 'agent-reads-tax-state'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.avalara.com/avatax -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.avalara.com/avatax -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the AvaTax MCP server Avalara documents at developer.avalara.com/mcp-servers`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // AvaTax's transactions API answers a keyless POST with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'avalara',
    storyIds: ['realtime-tax-calculation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://rest.avatax.com/api/v2/transactions/create -H 'Content-Type: application/json' -d '{}' | head -2`],
    displayCommand: `curl -si -X POST https://rest.avatax.com/api/v2/transactions/create -H 'Content-Type: application/json' -d '{}'  # keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // developer.avalara.com serves llms.txt (plus llms-api-endpoints.txt indexing all 471
    // AvaTax v2 endpoints, and .md twins of every portal page).
    probeId: 'docs-llms-txt',
    productId: 'avalara',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.avalara.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://developer.avalara.com/llms.txt | head -3',
    expect: /# Avalara Developer/,
    timeoutMs: 30_000,
  },
  {
    // Anrok's all-POST API answers a keyless request with its documented literal challenge —
    // the 'Missing "Authorization" header.' contract from the API reference.
    probeId: 'api-auth-challenge',
    productId: 'anrok',
    storyIds: ['realtime-tax-calculation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.anrok.com/v1/seller/transactions/createEphemeral -H 'Content-Type: application/json' -d '{}' | head -c 120`],
    displayCommand: `curl -s -X POST https://api.anrok.com/v1/seller/transactions/createEphemeral -H 'Content-Type: application/json' -d '{}'  # keyless → documented Authorization-header contract`,
    expect: /Missing "Authorization" header/,
    timeoutMs: 30_000,
  },
  {
    // Anrok publishes its raw OpenAPI 3.1 spec at a stable URL.
    probeId: 'openapi-spec',
    productId: 'anrok',
    storyIds: ['agentic-public-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://apidocs.anrok.com/openapi.yaml | head -4'],
    displayCommand: 'curl -s https://apidocs.anrok.com/openapi.yaml | head -4',
    expect: /openapi: 3\.1/,
    timeoutMs: 30_000,
  },
  {
    // TaxJar's rates API answers a keyless request with its documented 401 naming the denied
    // route — the API surface is real; there is no llms.txt or MCP anywhere on the
    // Stripe-owned line, and that absence is the arena finding.
    probeId: 'api-auth-challenge',
    productId: 'taxjar',
    storyIds: ['realtime-tax-calculation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.taxjar.com/v2/rates/90002 | head -c 120'],
    displayCommand: 'curl -s https://api.taxjar.com/v2/rates/90002 | head -c 120  # keyless → 401 naming the route',
    expect: /Not authorized for route/,
    timeoutMs: 30_000,
  },
  {
    // Numeral's account-data MCP server answers a keyless initialize with a clean JSON-RPC
    // auth challenge.
    probeId: 'mcp-authgate',
    productId: 'numeral',
    storyIds: ['agentic-mcp-server', 'agent-reads-tax-state'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://mcp.numeralhq.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 120`,
    ],
    displayCommand: `curl -s -X POST https://mcp.numeralhq.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the MCP server Numeral documents at docs.numeral.com/mcp`,
    expect: /Bearer token not provided/,
    timeoutMs: 30_000,
  },
  {
    // docs.numeral.com serves llms.txt (and .md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'numeral',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.numeral.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.numeral.com/llms.txt | head -3',
    expect: /# Numeral API/,
    timeoutMs: 30_000,
  },
  {
    // Kintsugi's account-data MCP server completes a keyless initialize with real serverInfo
    // and its tool-use instructions — the handshake finishes before any API key is asked for
    // (tool calls then require the key in headers).
    probeId: 'mcp-keyless-initialize',
    productId: 'kintsugi',
    storyIds: ['agentic-mcp-server', 'agent-reads-tax-state'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.trykintsugi.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.trykintsugi.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /"name":"kintsugi"/,
    timeoutMs: 30_000,
  },
  {
    // Kintsugi's tax-estimation API answers a keyless POST with a documented 422 listing the
    // required x-organization-id header — the request contract is public down to the field
    // level.
    probeId: 'api-auth-challenge',
    productId: 'kintsugi',
    storyIds: ['realtime-tax-calculation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.trykintsugi.com/v1/tax/estimate -H 'Content-Type: application/json' -d '{}' | head -c 150`],
    displayCommand: `curl -s -X POST https://api.trykintsugi.com/v1/tax/estimate -H 'Content-Type: application/json' -d '{}'  # keyless → documented 422 header contract`,
    expect: /x-organization-id/,
    timeoutMs: 30_000,
  },
  {
    // docs.trykintsugi.com serves llms.txt (plus a 367KB llms-full.txt).
    probeId: 'docs-llms-txt',
    productId: 'kintsugi',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.trykintsugi.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.trykintsugi.com/llms.txt | head -3',
    expect: /# Kintsugi Developer Docs/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative from the 2026-09-24 depth spike: Anrok's API docs host publishes no
    // llms.txt (404) — the queue's recorded absence, pinned as a replayable proof.
    probeId: 'docs-llms-txt-absent',
    productId: 'anrok',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://apidocs.anrok.com/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://apidocs.anrok.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
]
