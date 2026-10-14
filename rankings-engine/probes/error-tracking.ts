import { CURL_MCP_INIT, type LocalProbe } from './types'

// Error tracking: the arena where agent access to production errors is becoming the product.
// Sentry and Honeybadger run hosted OAuth-gated MCP servers whose keyless initialize answers
// with an oauth-protected-resource challenge; GlitchTip ships MCP built into the product
// (app.glitchtip.com/mcp answers 401 with its OAuth error body). Every vendor's REST API
// answers a keyless request with a clean auth challenge — six different flavors of the same
// honest 401. Sentry publishes a real OpenAPI schema (sentry-api-schema) and Rollbar serves
// its OpenAPI 3.1 spec straight off its docs origin; both docs sites serve llms.txt. Rollbar
// and Raygun publish stdio MCP servers (rollbar-mcp-server, mcp-server-raygun) and BugSnag's
// official MCP is SmartBear's self-hosted @smartbear/mcp — none of those are remote endpoints,
// so no handshake is honestly recordable for them; the absence is the finding. All probes are
// keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Sentry's REST API answers a keyless request with its DRF auth challenge — the
    // documented API root is real and token-gated exactly as docs.sentry.io/api describes.
    probeId: 'api-auth-challenge',
    productId: 'sentry',
    storyIds: ['issues-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://sentry.io/api/0/projects/ | head -c 200'],
    displayCommand: 'curl -s https://sentry.io/api/0/projects/  # the documented REST API, keyless → auth challenge',
    expect: /Authentication credentials were not provided/,
    timeoutMs: 30_000,
  },
  {
    // Sentry's hosted remote MCP server answers a keyless initialize with its OAuth
    // protected-resource challenge — the endpoint docs.sentry.io/product/sentry-mcp documents.
    probeId: 'mcp-authgate',
    productId: 'sentry',
    storyIds: ['agentic-mcp-server', 'agent-triages-errors'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.sentry.dev/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.sentry.dev/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Sentry's hosted MCP server, keyless → OAuth challenge`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // docs.sentry.io serves llms.txt — an agent-readable index of the documentation.
    probeId: 'docs-llms-txt',
    productId: 'sentry',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.sentry.io/llms.txt | head -4'],
    displayCommand: 'curl -sL https://docs.sentry.io/llms.txt | head -4',
    expect: /# Sentry Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Sentry publishes its full derefed OpenAPI schema in the open (sentry-api-schema repo).
    probeId: 'openapi-schema',
    productId: 'sentry',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json | head -c 200'],
    displayCommand: 'curl -s https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json | head -c 200  # the public OpenAPI schema',
    expect: /"openapi"/,
    timeoutMs: 30_000,
  },
  {
    // BugSnag's Data Access API answers a keyless request with its auth challenge.
    probeId: 'api-auth-challenge',
    productId: 'bugsnag',
    storyIds: ['issues-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.bugsnag.com/user/organizations | head -c 200'],
    displayCommand: 'curl -s https://api.bugsnag.com/user/organizations  # the Data Access API, keyless → auth challenge',
    expect: /Authentication Required/,
    timeoutMs: 30_000,
  },
  {
    // Rollbar's REST API answers a keyless request with its access-token challenge.
    probeId: 'api-auth-challenge',
    productId: 'rollbar',
    storyIds: ['issues-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.rollbar.com/api/1/items/ | head -c 200'],
    displayCommand: 'curl -s https://api.rollbar.com/api/1/items/  # the documented REST API, keyless → access-token challenge',
    expect: /access token required/,
    timeoutMs: 30_000,
  },
  {
    // Rollbar serves its OpenAPI 3.1 spec straight off the docs origin — the docs banner
    // points AI agents at llms.txt and this spec.
    probeId: 'openapi-spec',
    productId: 'rollbar',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.rollbar.com/openapi/62de9e1b6316c304034d006a | head -c 200'],
    displayCommand: 'curl -s https://docs.rollbar.com/openapi/62de9e1b6316c304034d006a | head -c 200  # OpenAPI 3.1, served from the docs site',
    expect: /"openapi"/,
    timeoutMs: 30_000,
  },
  {
    // docs.rollbar.com serves llms.txt — markdown index for agents (every docs page also
    // serves a .md variant).
    probeId: 'docs-llms-txt',
    productId: 'rollbar',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.rollbar.com/llms.txt | head -4'],
    displayCommand: 'curl -sL https://docs.rollbar.com/llms.txt | head -4',
    expect: /# Rollbar Docs/,
    timeoutMs: 30_000,
  },
  {
    // Honeybadger's hosted remote MCP server (documented in its llms.txt: "point an MCP
    // client at https://mcp.honeybadger.io/mcp") answers keyless initialize with its OAuth
    // protected-resource challenge.
    probeId: 'mcp-authgate',
    productId: 'honeybadger',
    storyIds: ['agentic-mcp-server', 'agent-triages-errors'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.honeybadger.io/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.honeybadger.io/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Honeybadger's hosted MCP server, keyless → OAuth challenge`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Honeybadger's Data API answers a keyless request with its access-denied challenge.
    probeId: 'api-auth-challenge',
    productId: 'honeybadger',
    storyIds: ['issues-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://app.honeybadger.io/v2/projects | head -c 200'],
    displayCommand: 'curl -s https://app.honeybadger.io/v2/projects  # the documented Data API, keyless → access denied',
    expect: /Access denied/,
    timeoutMs: 30_000,
  },
  {
    // GlitchTip's hosted instance speaks the Sentry-compatible REST API and challenges a
    // keyless request — SDK and API compatibility is the product's core claim.
    probeId: 'api-auth-challenge',
    productId: 'glitchtip',
    storyIds: ['issues-api-read', 'agentic-public-api', 'open-ingest-protocol'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://app.glitchtip.com/api/0/projects/ | head -c 200'],
    displayCommand: 'curl -s https://app.glitchtip.com/api/0/projects/  # Sentry-compatible API on the hosted instance, keyless → 401',
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // GlitchTip ships an MCP server built into the product; the hosted instance's /mcp
    // endpoint answers keyless initialize with its OAuth error body.
    probeId: 'mcp-authgate',
    productId: 'glitchtip',
    storyIds: ['agentic-mcp-server', 'agent-triages-errors'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://app.glitchtip.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://app.glitchtip.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # MCP built into the product, keyless → auth required`,
    expect: /Authentication required/,
    timeoutMs: 30_000,
  },
  {
    // Raygun's v3 API answers a keyless request with an RFC 9110 problem+json Unauthorized.
    probeId: 'api-auth-challenge',
    productId: 'raygun',
    storyIds: ['issues-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.raygun.com/v3/applications | head -c 200'],
    displayCommand: 'curl -s https://api.raygun.com/v3/applications  # the documented v3 API, keyless → RFC 9110 Unauthorized',
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
]
