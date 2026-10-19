import { CURL_MCP_INIT, type LocalProbe } from './types'

// Expense management: fintech vendors keep the product behind the login wall, so the keyless
// story is agent ACCESS to spend data — and this arena has three live hosted MCP servers.
// Ramp's production MCP (mcp.ramp.com, documented in its llms-guides) and Navan's
// (mcp.navan.com, documented on developer.navan.com/mcp/) challenge keyless initializes for
// a Bearer token; Brex's hosted MCP lives at api.brex.com/mcp and answers with a full RFC
// 9728 OAuth protected-resource challenge. Ramp also ships an open-source CLI whose
// vendor-documented install script is served from agents.ramp.com — a domain named for its
// audience. Brex publishes real OpenAPI YAML bundles; Ramp, Brex, Navan, and BILL all serve
// llms.txt on their developer origins. Expensify's Integration Server answers a dummy-
// credential job request with HTTP 200 and an in-band "Authentication error" — a pre-REST
// design, recorded as exactly that. BILL's v3 spend API 401s cleanly. All probes are
// keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Ramp's Developer API answers a keyless request with its access-token error — the
    // documented endpoint is real and OAuth-gated (note the 404-with-error-body flavor).
    probeId: 'api-auth-challenge',
    productId: 'ramp',
    storyIds: ['expenses-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.ramp.com/developer/v1/transactions | head -c 200'],
    displayCommand: 'curl -s https://api.ramp.com/developer/v1/transactions  # the documented Developer API, keyless → access-token error',
    expect: /Access token with given access_token not found/,
    timeoutMs: 30_000,
  },
  {
    // Ramp's production hosted MCP server (docs.ramp.com/llms-guides/ramp-mcp: "Production:
    // https://mcp.ramp.com/mcp") answers keyless initialize with its token challenge.
    probeId: 'mcp-authgate',
    productId: 'ramp',
    storyIds: ['agentic-mcp-server', 'agent-closes-the-books'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://mcp.ramp.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://mcp.ramp.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Ramp's production MCP server, keyless → token challenge`,
    expect: /No access token provided/,
    timeoutMs: 30_000,
  },
  {
    // docs.ramp.com serves llms.txt — an agent-oriented index including MCP, CLI, and
    // "build for AI agents" guides.
    probeId: 'docs-llms-txt',
    productId: 'ramp',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.ramp.com/llms.txt | head -4'],
    displayCommand: 'curl -sL https://docs.ramp.com/llms.txt | head -4',
    expect: /# Ramp Developer API/,
    timeoutMs: 30_000,
  },
  {
    // The install script for Ramp's open-source CLI is live at agents.ramp.com — the
    // vendor-documented one-liner target, on a subdomain named for its audience.
    probeId: 'cli-install-live',
    productId: 'ramp',
    storyIds: ['agentic-official-cli'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sI --max-time 20 https://agents.ramp.com/install.sh | head -1'],
    displayCommand: 'curl -sI https://agents.ramp.com/install.sh | head -1  # the documented CLI install script, live',
    expect: /200/,
    timeoutMs: 30_000,
  },
  {
    // Ramp's Developer MCP (docs server) completes a REAL initialize with no credentials at
    // all — documented as unauthenticated ("does not require a Ramp account, OAuth login,
    // API key, or developer app"), verified live 2026-09-15.
    probeId: 'mcp-developer-keyless-initialize',
    productId: 'ramp',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://mcp.ramp.com/developer/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 300`,
    ],
    displayCommand: `curl -s -X POST https://mcp.ramp.com/developer/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Ramp's docs MCP server, fully unauthenticated → real initialize result`,
    expect: /"serverInfo":\{"name":"Ramp MCP Remote"/,
    timeoutMs: 30_000,
  },
  {
    // The canonical OpenAPI schema linked from docs.ramp.com/llms.txt is live and starts with
    // the production server block — the machine spec agents generate clients from.
    probeId: 'openapi-machine-spec',
    productId: 'ramp',
    storyIds: ['api-machine-spec', 'agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 30 https://docs.ramp.com/openapi/developer-api.json | head -c 300'],
    displayCommand: 'curl -s https://docs.ramp.com/openapi/developer-api.json | head -c 300  # canonical OpenAPI schema, keyless',
    expect: /"url": "https:\/\/api\.ramp\.com"/,
    timeoutMs: 45_000,
  },
  {
    // Brex's platform API answers a keyless request with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'brex',
    storyIds: ['expenses-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://platform.brexapis.com/v2/transactions/card/primary | head -1'],
    displayCommand: 'curl -si https://platform.brexapis.com/v2/transactions/card/primary | head -1  # the documented platform API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Brex's hosted MCP server (developer.brex.com/docs/mcp: "hosted at
    // https://api.brex.com/mcp") answers keyless initialize with a full RFC 9728 OAuth
    // protected-resource challenge.
    probeId: 'mcp-authgate',
    productId: 'brex',
    storyIds: ['agentic-mcp-server', 'agent-closes-the-books'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://api.brex.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://api.brex.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Brex's hosted MCP server, keyless → OAuth challenge`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Brex publishes real OpenAPI YAML bundles for its APIs, in the open.
    probeId: 'openapi-spec',
    productId: 'brex',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.brex.com/_bundle/openapi/expenses_api.yaml | head -3'],
    displayCommand: 'curl -s https://developer.brex.com/_bundle/openapi/expenses_api.yaml | head -3  # published OpenAPI spec',
    expect: /openapi: 3/,
    timeoutMs: 30_000,
  },
  {
    // Brex's marketing site serves llms.txt (and every page a .md variant).
    probeId: 'site-llms-txt',
    productId: 'brex',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.brex.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://www.brex.com/llms.txt | head -3',
    expect: /LLM documentation for Brex/,
    timeoutMs: 30_000,
  },
  {
    // Expensify's Integration Server answers a dummy-credential job request with HTTP 200
    // and an in-band "Authentication error" — the pre-REST design, recorded as-is.
    probeId: 'api-auth-challenge',
    productId: 'expensify',
    storyIds: ['expenses-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations' -d 'requestJobDescription={"type":"get","credentials":{"partnerUserID":"probe","partnerUserSecret":"probe"},"inputSettings":{"type":"policyList"}}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations -d 'requestJobDescription={...}'  # the Integration Server API: HTTP 200, in-band auth error`,
    expect: /Authentication error/,
    timeoutMs: 30_000,
  },
  {
    // Navan's hosted MCP server (developer.navan.com/mcp/) answers keyless initialize with
    // a JSON-RPC Bearer-token challenge.
    probeId: 'mcp-authgate',
    productId: 'navan',
    storyIds: ['agentic-mcp-server', 'agent-closes-the-books'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://mcp.navan.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://mcp.navan.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Navan's hosted MCP server, keyless → Bearer challenge`,
    expect: /Missing Bearer token/,
    timeoutMs: 30_000,
  },
  {
    // developer.navan.com serves llms.txt describing the Expense API and MCP for agents.
    probeId: 'docs-llms-txt',
    productId: 'navan',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.navan.com/llms.txt | head -4'],
    displayCommand: 'curl -sL https://developer.navan.com/llms.txt | head -4',
    expect: /# Navan Developer Portal/,
    timeoutMs: 30_000,
  },
  {
    // BILL's v3 spend API (Spend & Expense budgets endpoint) answers a keyless request with
    // a clean Unauthorized.
    probeId: 'api-auth-challenge',
    productId: 'bill-spend-expense',
    storyIds: ['expenses-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://gateway.prod.bill.com/connect/v3/spend/budgets | head -c 200'],
    displayCommand: 'curl -s https://gateway.prod.bill.com/connect/v3/spend/budgets  # the documented v3 spend API, keyless → Unauthorized',
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // developer.bill.com serves llms.txt — a markdown docs index for agents.
    probeId: 'docs-llms-txt',
    productId: 'bill-spend-expense',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.bill.com/llms.txt | head -4'],
    displayCommand: 'curl -sL https://developer.bill.com/llms.txt | head -4',
    expect: /# BILL API documentation/,
    timeoutMs: 30_000,
  },
]
