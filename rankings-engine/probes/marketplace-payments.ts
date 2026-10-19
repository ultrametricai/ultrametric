import { CURL_MCP_INIT, type LocalProbe } from './types'

// Marketplace & platform payments (payfac-as-a-service): the keyless story splits cleanly in
// two. The docs surfaces are wide open — Finix and Mangopay both run docs MCP servers that
// complete a keyless initialize with real serverInfo (Finix on docs.finix.com/mcp, Mangopay on
// Fern's docs.mangopay.com/_mcp/server), and Stripe, Adyen, Finix, Mangopay, and Rainforest
// all serve llms.txt. The money APIs are uniformly gated with clean, documented challenges:
// Stripe's canonical 401 on /v1/accounts, Adyen's 401 on checkout-test, Finix's HAL+JSON 401
// on the sandbox API, Mangopay's 401 on v2.01, and Tilled's documented
// "'tilled-account' header required" ladder — the missing-header contract answers before auth
// is even checked. Tilled is also the arena's absence finding: no llms.txt (HTTP 500), no
// MCP, no .md twins. All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Connect's core object — the accounts API — answers a keyless request with Stripe's
    // canonical 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'stripe-connect',
    storyIds: ['programmatic-seller-onboarding', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/accounts | head -4'],
    displayCommand: 'curl -si https://api.stripe.com/v1/accounts | head -4  # Connect accounts API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP server answers a keyless initialize with its OAuth
    // protected-resource challenge — Connect objects (accounts, transfers, payouts) ride the
    // same platform surface, scoped per connected account via the Stripe-Account header.
    probeId: 'mcp-authgate',
    productId: 'stripe-connect',
    storyIds: ['agentic-mcp-server', 'agent-onboards-sellers'],
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
    // docs.stripe.com serves llms.txt (and .md twins of every Connect docs page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-connect',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Adyen's Checkout API (the surface platforms split payments through) answers a keyless
    // POST with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'adyen-for-platforms',
    storyIds: ['split-payments-routing', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://checkout-test.adyen.com/v71/payments -H 'Content-Type: application/json' -d '{}' | head -2`],
    displayCommand: `curl -si -X POST https://checkout-test.adyen.com/v71/payments -H 'Content-Type: application/json' -d '{}'  # keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.adyen.com serves llms.txt and documents the .md twin convention in its header.
    probeId: 'docs-llms-txt',
    productId: 'adyen-for-platforms',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.adyen.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.adyen.com/llms.txt | head -3',
    expect: /# Adyen Docs/,
    timeoutMs: 30_000,
  },
  {
    // Finix's documented docs MCP server (docs.finix.com/additional-resources/developers/
    // mcp-server) completes a keyless initialize with real serverInfo — no auth required to
    // hand an agent the full API spec.
    probeId: 'mcp-keyless-initialize',
    productId: 'finix',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.finix.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.finix.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /serverInfo/,
    timeoutMs: 30_000,
  },
  {
    // Finix's sandbox API answers a keyless request with its HAL+JSON 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'finix',
    storyIds: ['programmatic-seller-onboarding', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://finix.sandbox-payments-api.com/identities | head -3'],
    displayCommand: 'curl -si https://finix.sandbox-payments-api.com/identities | head -3  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.finix.com serves llms.txt.
    probeId: 'docs-llms-txt',
    productId: 'finix',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.finix.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.finix.com/llms.txt | head -3',
    expect: /# Finix Docs/,
    timeoutMs: 30_000,
  },
  {
    // Mangopay's docs MCP server (Fern-hosted at docs.mangopay.com/_mcp/server) completes a
    // keyless initialize with real serverInfo.
    probeId: 'mcp-keyless-initialize',
    productId: 'mangopay',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.mangopay.com/_mcp/server -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.mangopay.com/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /fern-docs-mcp-server/,
    timeoutMs: 30_000,
  },
  {
    // Mangopay publishes its raw OpenAPI 3.1 spec at a stable URL.
    probeId: 'openapi-spec',
    productId: 'mangopay',
    storyIds: ['agentic-public-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.mangopay.com/openapi.json | head -c 120'],
    displayCommand: 'curl -s https://docs.mangopay.com/openapi.json | head -c 120',
    expect: /"openapi":\s*"3\.1/,
    timeoutMs: 30_000,
  },
  {
    // Mangopay's v2.01 API answers a keyless request with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'mangopay',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.mangopay.com/v2.01/testclient/users | head -3'],
    displayCommand: 'curl -si https://api.mangopay.com/v2.01/testclient/users | head -3  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.rainforestpay.com serves llms.txt (~180 pages; the docs home addresses AI agents
    // directly).
    probeId: 'docs-llms-txt',
    productId: 'rainforest',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.rainforestpay.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.rainforestpay.com/llms.txt | head -3',
    expect: /# Rainforest/,
    timeoutMs: 30_000,
  },
  {
    // Tilled's API answers a keyless request with its documented header contract — the
    // 'tilled-account' header requirement is checked before auth even runs.
    probeId: 'api-auth-challenge',
    productId: 'tilled',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.tilled.com/v1/payment-intents | head -c 120'],
    displayCommand: `curl -s https://api.tilled.com/v1/payment-intents | head -c 120  # keyless → documented 'tilled-account' header contract`,
    expect: /tilled-account/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative (launch-audit wave 4, 2026-09-22): Tilled publishes no llms.txt — the
    // site origin 308-redirects to www where it 404s, and docs.tilled.com answers unknown
    // paths with 500s (no agent-oriented docs index on either origin).
    probeId: 'site-llms-txt-absent',
    productId: 'tilled',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -o /dev/null -w "HTTP %{http_code}" https://tilled.com/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://tilled.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
]
