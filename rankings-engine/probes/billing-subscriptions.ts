import { CURL_MCP_INIT, type LocalProbe } from './types'

// Billing & subscriptions: the money system of record, so the keyless story is agent ACCESS
// to billing state. Lago is the arena's high-water mark — its marketing-site MCP endpoint
// (getlago.com/mcp, documented in the ai-agents guide + llms.txt) answers a keyless initialize
// with a real serverInfo, no auth at all. Stripe, Chargebee, and Recurly all ship OAuth-gated
// remote MCP servers that answer initialize with RFC 9728 protected-resource challenges.
// Every vendor's REST API answers keyless with a clean challenge (Recurly only after you speak
// its versioned Accept header — the 406 version ladder is itself documented behavior). Orb and
// Metronome publish llms.txt + raw OpenAPI but no MCP endpoint — recorded as exactly that.
// All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // The Subscriptions API answers a keyless request with Stripe's canonical 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'stripe-billing',
    storyIds: ['subscription-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/subscriptions | head -4'],
    displayCommand: 'curl -si https://api.stripe.com/v1/subscriptions | head -4  # the subscription-lifecycle API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP server (docs.stripe.com/mcp) answers a keyless initialize
    // with its OAuth protected-resource challenge.
    probeId: 'mcp-authgate',
    productId: 'stripe-billing',
    storyIds: ['agentic-mcp-server', 'agent-manages-subscriptions'],
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
    // docs.stripe.com serves llms.txt (and .md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-billing',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Stripe publishes its full OpenAPI spec in the open (github.com/stripe/openapi).
    probeId: 'openapi-spec',
    productId: 'stripe-billing',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json | head -c 200'],
    displayCommand: 'curl -s https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json | head -c 200',
    expect: /components|schemas/,
    timeoutMs: 30_000,
  },
  {
    // Chargebee's API v2 answers keyless with its documented basic-auth challenge (any site
    // subdomain will do — test.chargebee.com is Chargebee's own canonical example host).
    probeId: 'api-auth-challenge',
    productId: 'chargebee',
    storyIds: ['subscription-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 https://test.chargebee.com/api/v2/customers | grep -i 'HTTP/\\|api_authentication'`],
    displayCommand: `curl -si https://test.chargebee.com/api/v2/customers | grep -i 'HTTP/\\|api_authentication'  # keyless → 401 with Chargebee's api_authentication_required code`,
    expect: /api_authentication_required|401/,
    timeoutMs: 30_000,
  },
  {
    // Chargebee documents MCP servers (ai-in-chargebee docs); the hosted endpoint answers a
    // keyless initialize with its OAuth protected-resource challenge and tool:invoke scope.
    probeId: 'mcp-authgate',
    productId: 'chargebee',
    storyIds: ['agentic-mcp-server', 'agent-manages-subscriptions'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.chargebee.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.chargebee.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Chargebee's hosted MCP, OAuth-gated with a tool:invoke scope`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Chargebee's marketing site serves llms.txt (docs and API reference hosts do too).
    probeId: 'site-llms-txt',
    productId: 'chargebee',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.chargebee.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://www.chargebee.com/llms.txt | head -3',
    expect: /# Chargebee/,
    timeoutMs: 30_000,
  },
  {
    // Chargebee publishes a public OpenAPI spec (github.com/chargebee/openapi).
    probeId: 'openapi-spec',
    productId: 'chargebee',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/chargebee/openapi/main/spec/chargebee_api_v2_pc_v2_spec.json | head -c 120'],
    displayCommand: 'curl -s https://raw.githubusercontent.com/chargebee/openapi/main/spec/chargebee_api_v2_pc_v2_spec.json | head -c 120',
    expect: /openapi/,
    timeoutMs: 30_000,
  },
  {
    // Recurly's v3 API requires a versioned Accept header (keyless GET without one gets the
    // documented 406 version ladder); with the header it answers a clean Bearer challenge.
    probeId: 'api-auth-challenge',
    productId: 'recurly',
    storyIds: ['subscription-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 https://v3.recurly.com/accounts -H 'Accept: application/vnd.recurly.v2021-02-25' | grep -i 'HTTP/\\|www-authenticate\\|Authorization header'`],
    displayCommand: `curl -si https://v3.recurly.com/accounts -H 'Accept: application/vnd.recurly.v2021-02-25'  # versioned keyless call → 401 Bearer challenge`,
    expect: /must provide a valid Authorization header|401/,
    timeoutMs: 30_000,
  },
  {
    // Recurly Compass's public MCP server (documented at docs.recurly.com
    // compass-public-mcp-server) answers initialize with its OAuth challenge.
    probeId: 'mcp-authgate',
    productId: 'recurly',
    storyIds: ['agentic-mcp-server', 'agent-reads-billing-state'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.recurly.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.recurly.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the Compass public MCP server Recurly documents`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Recurly's marketing site serves llms.txt.
    probeId: 'site-llms-txt',
    productId: 'recurly',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://recurly.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://recurly.com/llms.txt | head -3',
    expect: /# Recurly/,
    timeoutMs: 30_000,
  },
  {
    // Lago's agent-discovery MCP server answers a keyless initialize with a real result — no
    // auth wall at all. The only vendor in the arena whose MCP handshake completes keyless.
    probeId: 'mcp-keyless-initialize',
    productId: 'lago',
    storyIds: ['agentic-mcp-server', 'agent-reads-billing-state'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://getlago.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 400`,
    ],
    displayCommand: `curl -s -X POST https://getlago.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless MCP initialize completes — serverInfo comes back`,
    expect: /Lago Agent Discovery/,
    timeoutMs: 30_000,
  },
  {
    // Lago's hosted API answers keyless with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'lago',
    storyIds: ['subscription-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.getlago.com/api/v1/customers | head -c 200'],
    displayCommand: 'curl -s https://api.getlago.com/api/v1/customers  # hosted API, keyless → {"status":401,"error":"Unauthorized"}',
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // Lago publishes its OpenAPI spec at a public URL.
    probeId: 'openapi-spec',
    productId: 'lago',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://swagger.getlago.com/openapi.yaml | head -3'],
    displayCommand: 'curl -s https://swagger.getlago.com/openapi.yaml | head -3',
    expect: /Lago API documentation/,
    timeoutMs: 30_000,
  },
  {
    // Orb's API answers keyless with a descriptive 401 that links its own error docs.
    probeId: 'api-auth-challenge',
    productId: 'orb',
    storyIds: ['subscription-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.withorb.com/v1/customers | head -c 250'],
    displayCommand: 'curl -s https://api.withorb.com/v1/customers  # keyless → 401 with a docs-linked error body',
    expect: /Authorization header is expected/,
    timeoutMs: 30_000,
  },
  {
    // Orb's docs serve llms.txt (the marketing site does not — recorded on the docs host).
    probeId: 'docs-llms-txt',
    productId: 'orb',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.withorb.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.withorb.com/llms.txt | head -3',
    expect: /# Orb/,
    timeoutMs: 30_000,
  },
  {
    // Metronome's API answers keyless with AWS API Gateway's UnauthorizedException.
    probeId: 'api-auth-challenge',
    productId: 'metronome',
    storyIds: ['usage-event-ingestion', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 https://api.metronome.com/v1/customers | grep -i 'HTTP/\\|errortype\\|Unauthorized'`],
    displayCommand: `curl -si https://api.metronome.com/v1/customers | grep -i 'HTTP/\\|errortype\\|Unauthorized'  # keyless → 401 UnauthorizedException`,
    expect: /UnauthorizedException|Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // Metronome publishes its OpenAPI spec on the docs host.
    probeId: 'openapi-spec',
    productId: 'metronome',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.metronome.com/openapi.json | head -c 150'],
    displayCommand: 'curl -s https://docs.metronome.com/openapi.json | head -c 150',
    expect: /BillingProviderType|components/,
    timeoutMs: 30_000,
  },
  {
    // RevenueCat's hosted remote MCP server (mcp.revenuecat.ai/mcp, documented at
    // revenuecat.com/docs/tools/mcp/setup) draws a keyless 401 with an OAuth
    // protected-resource challenge — live, bearer-gated MCP endpoint.
    probeId: 'mcp-remote-handshake',
    productId: 'revenuecat',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.revenuecat.ai/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.revenuecat.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /resource_metadata="https:\/\/mcp\.revenuecat\.ai/,
    timeoutMs: 30_000,
  },
  {
    // REST API v2 answers a keyless request with its documented structured error object
    // (type authentication_error + errors.rev.cat doc pointer) — the Bearer gate is live.
    probeId: 'api-keyless-auth-challenge',
    productId: 'revenuecat',
    storyIds: ['agentic-public-api', 'agent-reads-billing-state'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.revenuecat.com/v2/projects'],
    displayCommand: 'curl -si https://api.revenuecat.com/v2/projects',
    expect: /"type":"authentication_error"/,
    timeoutMs: 30_000,
  },
  {
    // Docs ship clean .md mirrors for agents (append .md to any docs URL, per the root
    // llms.txt) — the MCP-server page itself round-trips as raw Markdown.
    probeId: 'docs-md-endpoint',
    productId: 'revenuecat',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://www.revenuecat.com/docs/tools/mcp.md | head -5'],
    displayCommand: 'curl -s https://www.revenuecat.com/docs/tools/mcp.md | head -5',
    expect: /RevenueCat MCP [Ss]erver/,
    timeoutMs: 30_000,
  },
]
