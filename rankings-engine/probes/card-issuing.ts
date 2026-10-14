import { CURL_MCP_INIT, type LocalProbe } from './types'

// Card-issuing platforms: every serious issuer processor here has made its docs an agent
// surface. Lithic's docs.lithic.com/mcp completes a keyless MCP initialize with real
// serverInfo ("Lithic Developer Documentation") — the Lago pattern in issuing. Stripe's
// remote MCP answers with its OAuth protected-resource challenge (Issuing objects ride the
// platform surface). Every vendor's API answers keyless with a clean challenge: Stripe's
// canonical 401 on /v1/issuing/cards, Lithic's 401 on /v1/cards, Marqeta's 401 on the
// self-serve sandbox, Highnote's GraphQL 401, and Adyen's balance-platform 401. llms.txt is
// live on all five docs hosts (Marqeta's at /docs/llms.txt, not the root — recorded as
// documented). Highnote has no MCP anywhere — the absence is the finding; its OpenAPI 3.1
// transport spec at highnote.com/openapi.json is the counterweight. All probes are keyless,
// read-only curls.
export const probes: LocalProbe[] = [
  {
    // Issuing's core object — the cards API — answers a keyless request with Stripe's
    // canonical 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'stripe-issuing',
    storyIds: ['virtual-card-creation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/issuing/cards | head -4'],
    displayCommand: 'curl -si https://api.stripe.com/v1/issuing/cards | head -4  # Issuing cards API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP server answers a keyless initialize with its OAuth
    // protected-resource challenge — Issuing objects (cards, cardholders, authorizations,
    // disputes) ride the same platform surface.
    probeId: 'mcp-authgate',
    productId: 'stripe-issuing',
    storyIds: ['agentic-mcp-server', 'agent-manages-program'],
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
    // docs.stripe.com serves llms.txt (and .md twins of every Issuing docs page, including
    // the dedicated Issuing-for-agents guide).
    probeId: 'docs-llms-txt',
    productId: 'stripe-issuing',
    storyIds: ['agentic-agent-docs', 'agent-issued-cards'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Lithic's documented docs MCP server (docs.lithic.com/docs/mcp) completes a keyless
    // initialize with real serverInfo — the only issuing vendor whose MCP handshake finishes
    // without auth.
    probeId: 'mcp-keyless-initialize',
    productId: 'lithic',
    storyIds: ['agentic-mcp-server', 'agent-manages-program'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.lithic.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.lithic.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /Lithic Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Lithic's cards API answers a keyless request with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'lithic',
    storyIds: ['virtual-card-creation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.lithic.com/v1/cards | head -3'],
    displayCommand: 'curl -si https://api.lithic.com/v1/cards | head -3  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.lithic.com serves llms.txt (and .md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'lithic',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.lithic.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.lithic.com/llms.txt | head -3',
    expect: /# Lithic Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Marqeta's self-serve sandbox API answers a keyless request with a clean 401 — the
    // sandbox is real and reachable before any sales call.
    probeId: 'api-auth-challenge',
    productId: 'marqeta',
    storyIds: ['auth-simulation-testing', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://sandbox-api.marqeta.com/v3/cards | head -3'],
    displayCommand: 'curl -si https://sandbox-api.marqeta.com/v3/cards | head -3  # self-serve sandbox, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Marqeta serves llms.txt on the docs path (the site root 404s — recorded as documented).
    probeId: 'docs-llms-txt',
    productId: 'marqeta',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.marqeta.com/docs/llms.txt | head -3'],
    displayCommand: 'curl -sL https://www.marqeta.com/docs/llms.txt | head -3',
    expect: /# Marqeta Docs/,
    timeoutMs: 30_000,
  },
  {
    // Highnote's GraphQL API (test environment) answers a keyless POST with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'highnote',
    storyIds: ['virtual-card-creation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://api.us.test.highnote.com/graphql -H 'Content-Type: application/json' -d '{"query":"{ ping }"}' | head -2`],
    displayCommand: `curl -si -X POST https://api.us.test.highnote.com/graphql -H 'Content-Type: application/json' -d '{"query":"{ ping }"}'  # keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Highnote publishes an OpenAPI 3.1 transport description of its GraphQL API at a stable
    // URL — no MCP server anywhere, but the machine spec is real.
    probeId: 'openapi-spec',
    productId: 'highnote',
    storyIds: ['agentic-public-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://highnote.com/openapi.json | head -c 150'],
    displayCommand: 'curl -s https://highnote.com/openapi.json | head -c 150',
    expect: /"openapi":\s*"3\.1/,
    timeoutMs: 30_000,
  },
  {
    // docs.highnote.com serves llms.txt (plus a 3.4MB llms-full.txt; docs pages have no .md
    // twins — the marketing site does).
    probeId: 'docs-llms-txt',
    productId: 'highnote',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.highnote.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.highnote.com/llms.txt | head -3',
    expect: /# Highnote Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Adyen's balance-platform API (the substrate under Issuing) answers a keyless POST with
    // a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'adyen-issuing',
    storyIds: ['virtual-card-creation', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://balanceplatform-api-test.adyen.com/bcl/v2/balanceAccounts -H 'Content-Type: application/json' -d '{}' | head -2`],
    displayCommand: `curl -si -X POST https://balanceplatform-api-test.adyen.com/bcl/v2/balanceAccounts -H 'Content-Type: application/json' -d '{}'  # keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.adyen.com serves llms.txt listing the Issuing .md twins.
    probeId: 'docs-llms-txt',
    productId: 'adyen-issuing',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.adyen.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.adyen.com/llms.txt | head -3',
    expect: /# Adyen Docs/,
    timeoutMs: 30_000,
  },
]
