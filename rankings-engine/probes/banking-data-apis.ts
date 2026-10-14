import { CURL_MCP_INIT, type LocalProbe } from './types'

// Banking data APIs: the arena where the docs-MCP split is starkest. MX (docs.mx.com/mcp) and
// Yapily (docs.yapily.com/mcp) complete keyless MCP initializes with real serverInfo; TrueLayer's
// docs MCP answers a clean JSON-RPC authgate; Plaid's Dashboard MCP (api.dashboard.plaid.com)
// answers {"error":"Unauthorized"} exactly as its OAuth docs say; Teller and Mastercard have no
// MCP anywhere (Teller's whole agent surface is llms.txt + .md twins — probed as documented,
// the absence of the rest recorded in the arena description). API keyless challenges differ and
// the differences are findings: Stripe/MX/TrueLayer/Finicity give clean 401s, Plaid answers a
// documented 400 naming the missing client_id, Teller a 400, and Yapily's edge 404s bare paths
// (its OpenAPI spec is the machine surface probed instead). llms.txt is live on all seven docs
// hosts — Teller's at /docs/llms.txt, not the root (recorded as served). All probes are
// keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Financial Connections accounts — the core data object — answers keyless with Stripe's
    // canonical 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'stripe-financial-connections',
    storyIds: ['realtime-balance-checks', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/financial_connections/accounts | head -2'],
    displayCommand: 'curl -si https://api.stripe.com/v1/financial_connections/accounts | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP answers a keyless initialize with its Unauthorized
    // challenge — Financial Connections accounts ride the platform surface.
    probeId: 'mcp-authgate',
    productId: 'stripe-financial-connections',
    storyIds: ['agent-links-and-reads', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://mcp.stripe.com/ -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://mcp.stripe.com/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the remote MCP server Stripe documents at docs.stripe.com/mcp`,
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // docs.stripe.com serves llms.txt (and .md twins of every Financial Connections page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-financial-connections',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Plaid answers a keyless POST with its documented 400 naming the missing client_id — a
    // machine-legible challenge, just not a 401.
    probeId: 'api-auth-challenge',
    productId: 'plaid',
    storyIds: ['realtime-balance-checks', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://production.plaid.com/accounts/balance/get -H 'Content-Type: application/json' -d '{}' | head -2`],
    displayCommand: `curl -si -X POST https://production.plaid.com/accounts/balance/get -H 'Content-Type: application/json' -d '{}'  # keyless → 400 naming the missing client_id`,
    expect: /400/,
    timeoutMs: 30_000,
  },
  {
    // Plaid's Dashboard MCP server answers keyless exactly as its OAuth docs say it will.
    probeId: 'mcp-authgate',
    productId: 'plaid',
    storyIds: ['agent-links-and-reads', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://api.dashboard.plaid.com/mcp/sse -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 120`,
    ],
    displayCommand: `curl -s -X POST https://api.dashboard.plaid.com/mcp/sse -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the Dashboard MCP Plaid documents (OAuth mcp:dashboard scope)`,
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // plaid.com/docs serves llms.txt (plus index.html.md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'plaid',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://plaid.com/docs/llms.txt | head -3'],
    displayCommand: 'curl -sL https://plaid.com/docs/llms.txt | head -3',
    expect: /# Plaid Technical Documentation/,
    timeoutMs: 30_000,
  },
  {
    // MX's docs MCP completes a keyless initialize with real serverInfo.
    probeId: 'mcp-keyless-initialize',
    productId: 'mx',
    storyIds: ['agent-links-and-reads', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.mx.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.mx.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /MX Documentation/,
    timeoutMs: 30_000,
  },
  {
    // MX's Platform API answers keyless with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'mx',
    storyIds: ['transactions-history-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 https://api.mx.com/users -H 'Accept: application/vnd.mx.api.v1+json' | head -2`],
    displayCommand: `curl -si https://api.mx.com/users -H 'Accept: application/vnd.mx.api.v1+json' | head -2  # keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.mx.com serves llms.txt (and .md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'mx',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.mx.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.mx.com/llms.txt | head -3',
    expect: /# MX Documentation/,
    timeoutMs: 30_000,
  },
  {
    // The Finicity-era API host still answers under Mastercard: keyless request → clean 401.
    probeId: 'api-auth-challenge',
    productId: 'mastercard-open-finance',
    storyIds: ['transactions-history-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.finicity.com/aggregation/v1/customers | head -2'],
    displayCommand: 'curl -si https://api.finicity.com/aggregation/v1/customers | head -2  # Finicity-era API host under Mastercard, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // developer.mastercard.com serves a platform-wide llms.txt with 185 open-finance-us .md
    // twins — the old open-banking-us paths are gone (recorded rebrand).
    probeId: 'docs-llms-txt',
    productId: 'mastercard-open-finance',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.mastercard.com/llms.txt | head -2'],
    displayCommand: 'curl -sL https://developer.mastercard.com/llms.txt | head -2',
    expect: /# Mastercard Developers/,
    timeoutMs: 30_000,
  },
  {
    // Teller's API answers a keyless request with a 400 rather than a 401 challenge —
    // recorded as-is.
    probeId: 'api-auth-challenge',
    productId: 'teller',
    storyIds: ['realtime-balance-checks', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.teller.io/accounts | head -2'],
    displayCommand: 'curl -si https://api.teller.io/accounts | head -2  # keyless → 400, not a 401 challenge',
    expect: /400/,
    timeoutMs: 30_000,
  },
  {
    // Teller serves llms.txt on the docs path (the site root 404s — recorded as served).
    probeId: 'docs-llms-txt',
    productId: 'teller',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://teller.io/docs/llms.txt | head -3'],
    displayCommand: 'curl -sL https://teller.io/docs/llms.txt | head -3',
    expect: /# Teller Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // TrueLayer's Data API answers keyless with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'truelayer',
    storyIds: ['transactions-history-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.truelayer.com/data/v1/accounts | head -2'],
    displayCommand: 'curl -si https://api.truelayer.com/data/v1/accounts | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // TrueLayer's docs MCP answers a keyless initialize with a clean JSON-RPC authgate (its
    // product MCP is a disclaimed experiment — recorded in the docs evidence, not probed).
    probeId: 'mcp-authgate',
    productId: 'truelayer',
    storyIds: ['agent-links-and-reads', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.truelayer.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://docs.truelayer.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # JSON-RPC "Authorization required" authgate`,
    expect: /Authorization required/,
    timeoutMs: 30_000,
  },
  {
    // docs.truelayer.com serves llms.txt ("append .md to any documentation page URL").
    probeId: 'docs-llms-txt',
    productId: 'truelayer',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.truelayer.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.truelayer.com/llms.txt | head -3',
    expect: /# TrueLayer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Yapily's docs MCP completes a keyless initialize with real serverInfo — documented on
    // its dedicated AI-agents docs page alongside llms.txt and Agent Skills.
    probeId: 'mcp-keyless-initialize',
    productId: 'yapily',
    storyIds: ['agent-links-and-reads', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.yapily.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.yapily.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /Yapily API Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Yapily publishes its full OpenAPI 3.0 spec at a stable keyless URL.
    probeId: 'openapi-spec',
    productId: 'yapily',
    storyIds: ['agentic-public-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.yapily.com/docs/v3/openapi.json | head -c 150'],
    displayCommand: 'curl -s https://api.yapily.com/docs/v3/openapi.json | head -c 150',
    expect: /"openapi":\s*"3\.0/,
    timeoutMs: 30_000,
  },
  {
    // docs.yapily.com serves llms.txt (and .md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'yapily',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.yapily.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.yapily.com/llms.txt | head -3',
    expect: /# Yapily API Documentation/,
    timeoutMs: 30_000,
  },
]
