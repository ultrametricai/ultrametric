import { CURL_MCP_INIT, type LocalProbe } from './types'

// Payment fraud prevention: risk vendors sell to merchants, so most product surface hides
// behind sales calls — the keyless story is which vendors expose a programmatic surface an
// agent can even knock on. Stripe Radar rides Stripe's platform surface (401-gated REST,
// OAuth-gated MCP, llms.txt). Forter is the surprise: a live OAuth-gated MCP server
// (mcp.forter.com/v1, documented at docs.forter.com/mcp) plus a public health endpoint that
// answers keyless. Sift, Signifyd, and Riskified APIs all answer keyless with clean,
// documented challenges (Riskified's is its X-RISKIFIED-SHOP-DOMAIN header contract). Every
// vendor here serves llms.txt somewhere — sift.com and signifyd.com on the marketing site,
// Forter and Riskified on the docs hosts. Riskified's marketing site is 403 to non-browser
// agents (recorded via the crawl warnings, not a probe — nothing honestly recordable there).
// All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Radar's value-lists API (the rules/lists surface agents would manage) answers a keyless
    // request with Stripe's canonical 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'stripe-radar',
    storyIds: ['lists-velocity-management', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/radar/value_lists | head -4'],
    displayCommand: 'curl -si https://api.stripe.com/v1/radar/value_lists | head -4  # Radar lists API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP server answers a keyless initialize with its OAuth
    // protected-resource challenge — Radar objects (reviews, early fraud warnings) ride the
    // same platform surface.
    probeId: 'mcp-authgate',
    productId: 'stripe-radar',
    storyIds: ['agentic-mcp-server', 'agent-drives-rules'],
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
    // docs.stripe.com serves llms.txt (and .md twins of every Radar docs page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-radar',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Sift's Events API (the real-time scoring ingestion path) answers a keyless POST with
    // its documented status-51 Invalid API Key error.
    probeId: 'api-auth-challenge',
    productId: 'sift',
    storyIds: ['realtime-scoring-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.sift.com/v205/events -H 'Content-Type: application/json' -d '{}' | head -c 200`],
    displayCommand: `curl -s -X POST https://api.sift.com/v205/events -H 'Content-Type: application/json' -d '{}'  # keyless → status 51 "Invalid API Key"`,
    expect: /Invalid API Key/,
    timeoutMs: 30_000,
  },
  {
    // Sift's marketing site serves llms.txt.
    probeId: 'site-llms-txt',
    productId: 'sift',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://sift.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://sift.com/llms.txt | head -3',
    expect: /# Sift/,
    timeoutMs: 30_000,
  },
  {
    // Signifyd's v3 Orders API answers a keyless POST with a clean 401 Bearer challenge.
    probeId: 'api-auth-challenge',
    productId: 'signifyd',
    storyIds: ['realtime-scoring-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://api.signifyd.com/v3/orders/events/sales -H 'Content-Type: application/json' -d '{}' | grep -i 'HTTP/\\|www-authenticate'`],
    displayCommand: `curl -si -X POST https://api.signifyd.com/v3/orders/events/sales -H 'Content-Type: application/json' -d '{}'  # keyless → 401 Bearer challenge`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Signifyd's marketing site serves llms.txt.
    probeId: 'site-llms-txt',
    productId: 'signifyd',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.signifyd.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://www.signifyd.com/llms.txt | head -3',
    expect: /# Signifyd/,
    timeoutMs: 30_000,
  },
  {
    // Forter's documented remote MCP server (docs.forter.com/mcp) answers a keyless
    // initialize with its OAuth protected-resource challenge.
    probeId: 'mcp-authgate',
    productId: 'forter',
    storyIds: ['agentic-mcp-server', 'agent-triages-reviews'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.forter.com/v1 -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate\\|bearer token'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.forter.com/v1 -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the remote MCP server Forter documents at docs.forter.com/mcp`,
    expect: /oauth-protected-resource|Missing or invalid bearer token/,
    timeoutMs: 30_000,
  },
  {
    // Forter's API root answers keyless with its health check — the endpoint is real and
    // reachable; everything of substance is behind credentials.
    probeId: 'api-alive',
    productId: 'forter',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.forter.com/ | grep -i "HTTP/\\|ALIVE"'],
    displayCommand: `curl -si https://api.forter.com/ | grep -i 'HTTP/\\|ALIVE'  # keyless health check answers "I'm ALIVE !"`,
    expect: /ALIVE/,
    timeoutMs: 30_000,
  },
  {
    // docs.forter.com serves llms.txt.
    probeId: 'docs-llms-txt',
    productId: 'forter',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.forter.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.forter.com/llms.txt | head -3',
    expect: /# docs\.forter\.com/,
    timeoutMs: 30_000,
  },
  {
    // Riskified's decide endpoint answers a keyless POST with its documented
    // X-RISKIFIED-SHOP-DOMAIN header contract — the API is live and merchant-scoped.
    probeId: 'api-auth-challenge',
    productId: 'riskified',
    storyIds: ['realtime-scoring-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.riskified.com/api/decide -H 'Content-Type: application/json' -d '{}' | head -c 200`],
    displayCommand: `curl -s -X POST https://api.riskified.com/api/decide -H 'Content-Type: application/json' -d '{}'  # keyless → the documented X-RISKIFIED-SHOP-DOMAIN contract`,
    expect: /X-RISKIFIED-SHOP-DOMAIN/,
    timeoutMs: 30_000,
  },
  {
    // developers.riskified.com serves llms.txt (the marketing site is 403 to agents).
    probeId: 'docs-llms-txt',
    productId: 'riskified',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.riskified.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://developers.riskified.com/llms.txt | head -3',
    expect: /# Riskified documentation/,
    timeoutMs: 30_000,
  },
]
