import { CURL_MCP_INIT, type LocalProbe } from './types'

// Agentic commerce: the arena where the keyless story IS the product story — these platforms
// exist so that agents can transact, and most of them prove it in the open. Shopify's UCP
// surface completes full keyless MCP handshakes and lets a keyless local profile create a REAL
// cart on Shopify's own hardware store (ephemeral, no checkout, no payment — same recorded flow
// as the ecommerce-platforms lane). Stripe publishes MPP at mpp.dev as agent-readable markdown
// and ships mppx/link-cli on the public registry; its hosted MCP answers initialize with the
// documented OAuth challenge. PayPal's remote MCP challenges keylessly and publishes RFC 9728
// protected-resource metadata. Coinbase's x402 Bazaar discovery index answers keyless GETs with
// real payable-service listings (documented as intentionally public), while the facilitator
// itself auth-gates. Crossmint's agent-checkouts endpoint names its agent-specific credential
// (ServerKeyAgent) in the keyless auth challenge. Skyfire's token APIs challenge keylessly and
// its docs serve llms.txt. All probes are keyless and read-only; registry installs use
// throwaway fixtures.
export const probes: LocalProbe[] = [
  // --- Stripe Agentic Commerce ---
  {
    // Stripe's hosted MCP server answers a keyless initialize with its documented OAuth
    // challenge pointing at docs.stripe.com/mcp.
    probeId: 'mcp-remote-handshake',
    productId: 'stripe-agentic-commerce',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.stripe.com',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.stripe.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /docs\.stripe\.com\/mcp/,
    timeoutMs: 30_000,
  },
  {
    // mpp.dev serves the Machine Payments Protocol spec index as agent-readable markdown at
    // the root — the open HTTP 402 protocol Stripe co-authored with Tempo, published in the open.
    probeId: 'mpp-dev-protocol-docs',
    productId: 'stripe-agentic-commerce',
    storyIds: ['http-402-machine-payments', 'open-spec-published'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://mpp.dev/ | head -4'],
    displayCommand: 'curl -s https://mpp.dev/ | head -4  # the MPP spec site answers agents in markdown',
    expect: /# MPP — Machine Payments Protocol/,
    timeoutMs: 30_000,
  },
  {
    // The machine-readable skills catalog at a keyless well-known URL — the index agents fetch
    // to install Stripe's own commerce skills.
    probeId: 'skills-wellknown-index',
    productId: 'stripe-agentic-commerce',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.stripe.com/.well-known/skills/index.json | head -c 300'],
    displayCommand: 'curl -s https://docs.stripe.com/.well-known/skills/index.json  # Stripe-maintained agent skills, keyless',
    expect: /"skills":\[\{"name":/,
    timeoutMs: 30_000,
  },
  {
    // The mppx SDK (validate + middleware for HTTP 402 machine payments) is live on the
    // public npm registry.
    probeId: 'npm-mppx-registry',
    productId: 'stripe-agentic-commerce',
    storyIds: ['http-402-machine-payments', 'agentic-sdks'],
    bin: 'npm',
    argv: ['sh', '-c', 'echo "mppx version: $(npm view mppx version)"'],
    displayCommand: 'npm view mppx version  # the machine-payments SDK, on the public registry',
    expect: /mppx version: \d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // The Link CLI — the agent-wallet client documented at docs.stripe.com/agentic-commerce/
    // link-cli (open-source at github.com/stripe/link-cli) — is published on npm.
    probeId: 'npm-link-cli-registry',
    productId: 'stripe-agentic-commerce',
    storyIds: ['agent-wallet-provisioning', 'agentic-official-cli'],
    bin: 'npm',
    argv: ['sh', '-c', 'echo "link-cli version: $(npm view @stripe/link-cli version)"'],
    displayCommand: 'npm view @stripe/link-cli version  # the Link agent-wallet CLI, on the public registry',
    expect: /link-cli version: \d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },

  // --- Shopify Agentic Commerce (UCP) ---
  {
    // ucp.dev publishes the full versioned Universal Commerce Protocol spec as an llms.txt
    // index — open, keyless, agent-readable.
    probeId: 'ucp-spec-llms',
    productId: 'shopify-ucp',
    storyIds: ['open-spec-published', 'agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://ucp.dev/llms.txt | head -3'],
    displayCommand: 'curl -s https://ucp.dev/llms.txt | head -3  # the open UCP spec index',
    expect: /# Universal Commerce Protocol \(UCP\)/,
    timeoutMs: 30_000,
  },
  {
    // Shopify's Global Catalog MCP server completes a FULL keyless JSON-RPC initialize —
    // serverInfo universal-ucp-mcp.
    probeId: 'mcp-remote-handshake',
    productId: 'shopify-ucp',
    storyIds: ['agentic-mcp-server', 'agent-catalog-search'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s -i --max-time 20 -X POST https://catalog.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -E 'HTTP/|ucp-mcp-api-version|serverInfo' | head -4`,
    ],
    displayCommand: `curl -si -X POST https://catalog.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # full keyless handshake`,
    expect: /"serverInfo":\{"name":"universal-ucp-mcp"/,
    timeoutMs: 30_000,
  },
  {
    // A Shopify-operated storefront (hardware.shopify.com) answers the same keyless initialize
    // on its own /api/ucp/mcp — every UCP-enabled merchant storefront exposes this endpoint.
    probeId: 'storefront-ucp-handshake',
    productId: 'shopify-ucp',
    storyIds: ['merchant-agent-onboarding', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://hardware.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 400`,
    ],
    displayCommand: `curl -s -X POST https://hardware.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # merchant-storefront UCP endpoint`,
    expect: /"serverInfo":\{"name":"universal-commerce"/,
    timeoutMs: 30_000,
  },
  {
    // The documented agent-profile gate, observed live: a keyless tools/call without a hosted
    // agent profile returns the structured invalid_profile_url error — agents must identify
    // themselves before they can act.
    probeId: 'ucp-profile-gate',
    productId: 'shopify-ucp',
    storyIds: ['agent-identity-tiers', 'agent-traffic-controls'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://catalog.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_catalog","arguments":{"query":"wireless headphones"}}}' | head -c 300`,
    ],
    displayCommand: `curl -s -X POST https://catalog.shopify.com/api/ucp/mcp -d '<tools/call search_catalog without agent profile>'  # the documented agent-identity gate answers with a structured error`,
    expect: /invalid_profile_url/,
    timeoutMs: 30_000,
  },
  {
    // The agent flow, run for real and keylessly: fresh local profile, live Global Catalog
    // search for a variant on Shopify's own hardware store, then a REAL cart created through
    // the protocol — the response returns a live gid://shopify/Cart id. Ephemeral; no
    // checkout, no payment.
    probeId: 'ucp-cart-create-keyless',
    productId: 'shopify-ucp',
    storyIds: ['agent-cart-create', 'agentic-headless'],
    bin: 'npm',
    argv: [
      'sh', '-c',
      `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @shopify/ucp-cli --no-fund --no-audit --loglevel=error >/dev/null 2>&1 && ./node_modules/.bin/ucp profile init --name pa-probe >/dev/null 2>&1; v=$(./node_modules/.bin/ucp catalog search --business https://hardware.shopify.com --set /query='card reader' --format json | grep -o 'gid://shopify/ProductVariant/[0-9]*' | head -1) && echo "variant: $v" && ./node_modules/.bin/ucp cart create --business https://hardware.shopify.com --set "/line_items/0/item/id=$v" --set /line_items/0/quantity=1 --format md | grep -A 2 'result.id' ; cd / && rm -rf "$d"`,
    ],
    displayCommand: `ucp catalog search --business https://hardware.shopify.com --set /query='card reader' && ucp cart create --business https://hardware.shopify.com --set "/line_items/0/item/id=<variant>"  # real keyless cart via UCP on Shopify's own store`,
    expect: /gid:\/\/shopify\/Cart\//,
    timeoutMs: 300_000,
  },

  // --- PayPal Agentic Commerce ---
  {
    // PayPal's remote MCP server answers a keyless initialize with its OAuth challenge — the
    // www-authenticate header names the RFC 9728 protected-resource metadata.
    probeId: 'mcp-authgate',
    productId: 'paypal-agent-commerce',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s -i --max-time 20 -X POST https://mcp.paypal.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.paypal.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the remote MCP server PayPal documents for agents`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // The MCP server's RFC 9728 protected-resource metadata is public and names the resource
    // and its authorization server — the machine-readable auth contract an agent reads first.
    probeId: 'mcp-oauth-metadata',
    productId: 'paypal-agent-commerce',
    storyIds: ['agentic-mcp-server', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://mcp.paypal.com/.well-known/oauth-protected-resource/mcp | head -c 400'],
    displayCommand: 'curl -s https://mcp.paypal.com/.well-known/oauth-protected-resource/mcp  # public OAuth resource metadata',
    expect: /"resource":"https:\/\/mcp\.paypal\.com\/mcp"/,
    timeoutMs: 30_000,
  },
  {
    // The PayPal Agent Toolkit is live on the public npm registry (Python twin on PyPI).
    probeId: 'npm-agent-toolkit-registry',
    productId: 'paypal-agent-commerce',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['sh', '-c', 'echo "agent-toolkit version: $(npm view @paypal/agent-toolkit version)"'],
    displayCommand: 'npm view @paypal/agent-toolkit version',
    expect: /agent-toolkit version: \d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },

  // --- Coinbase x402 ---
  {
    // The x402 Bazaar discovery index answers keyless GETs with real payable-service listings
    // (amounts, assets, networks, schemes) — documented as intentionally public: "You do not
    // need a CDP API key."
    probeId: 'bazaar-keyless-discovery',
    productId: 'coinbase-x402',
    storyIds: ['payable-service-directory', 'agent-catalog-search'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources | head -c 300'],
    displayCommand: 'curl -s https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources  # the x402 Bazaar, keyless by design',
    expect: /"items":\[\{"accepts":/,
    timeoutMs: 30_000,
  },
  {
    // The hosted CDP facilitator itself auth-gates: a keyless call to the documented
    // /x402/supported endpoint answers with a clean Unauthorized.
    probeId: 'facilitator-auth-challenge',
    productId: 'coinbase-x402',
    storyIds: ['http-402-machine-payments'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.cdp.coinbase.com/platform/v2/x402/supported | grep -i "HTTP/\\|unauthorized" | head -3'],
    displayCommand: 'curl -si https://api.cdp.coinbase.com/platform/v2/x402/supported  # the hosted facilitator, auth-gated',
    expect: /401|[Uu]nauthorized/,
    timeoutMs: 30_000,
  },
  {
    // The x402 SDK is on the public registry, published by the x402 Foundation.
    probeId: 'npm-x402-registry',
    productId: 'coinbase-x402',
    storyIds: ['agentic-sdks', 'http-402-machine-payments'],
    bin: 'npm',
    argv: ['sh', '-c', 'echo "x402 version: $(npm view x402 version)"'],
    displayCommand: 'npm view x402 version  # the protocol SDK, on the public registry',
    expect: /x402 version: \d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },

  // --- Crossmint ---
  {
    // The agent-checkouts endpoint answers a keyless POST with an auth challenge that names
    // its agent-specific credential type — ServerKeyAgent — proving the documented endpoint
    // is live and agent-scoped.
    probeId: 'agent-checkouts-authgate',
    productId: 'crossmint',
    storyIds: ['agent-checkout-complete', 'agentic-public-api'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://www.crossmint.com/api/unstable/agent-checkouts -H 'Content-Type: application/json' -d '{}' | head -c 300`,
    ],
    displayCommand: `curl -s -X POST https://www.crossmint.com/api/unstable/agent-checkouts -d '{}'  # live endpoint, names its agent credential in the challenge`,
    expect: /ServerKeyAgent/,
    timeoutMs: 30_000,
  },
  {
    // docs.crossmint.com serves llms.txt describing the platform — including its AI-agent
    // payment infrastructure — for agents.
    probeId: 'docs-llms-txt',
    productId: 'crossmint',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.crossmint.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://docs.crossmint.com/llms.txt | head -3',
    expect: /# Crossmint/,
    timeoutMs: 30_000,
  },

  // --- Visa Intelligent Commerce ---
  {
    // The Trusted Agent Protocol spec + reference implementation are public on GitHub — the
    // agent-identity layer Visa publishes for merchants to distinguish trusted agent traffic.
    probeId: 'tap-spec-readme',
    productId: 'visa-intelligent-commerce',
    storyIds: ['open-spec-published', 'agent-identity-tiers'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/visa/trusted-agent-protocol/main/README.md | head -3'],
    displayCommand: 'curl -s https://raw.githubusercontent.com/visa/trusted-agent-protocol/main/README.md | head -3  # the published TAP spec + reference implementation',
    expect: /Trusted Agent Protocol/,
    timeoutMs: 30_000,
  },
  {
    // Visa's API gateway answers a keyless hello-world with its structured credential
    // challenge — the developer platform is live and gated exactly as documented.
    probeId: 'api-auth-challenge',
    productId: 'visa-intelligent-commerce',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.visa.com/vdp/helloworld | head -c 200'],
    displayCommand: 'curl -s https://api.visa.com/vdp/helloworld  # keyless → structured credential challenge',
    expect: /Expected input credential was not present/,
    timeoutMs: 30_000,
  },
  {
    // The Visa Acceptance Agent Toolkit's MCP server is published on npm by Visa staff.
    probeId: 'npm-acceptance-mcp-registry',
    productId: 'visa-intelligent-commerce',
    storyIds: ['agentic-mcp-server', 'agentic-sdks'],
    bin: 'npm',
    argv: ['sh', '-c', 'echo "visaacceptance mcp version: $(npm view @visaacceptance/mcp version)"'],
    displayCommand: 'npm view @visaacceptance/mcp version  # the Visa Acceptance MCP server, on the public registry',
    expect: /visaacceptance mcp version: \d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },

  // --- Skyfire ---
  {
    // Skyfire's token API answers a keyless introspection POST with its structured
    // NOT_AUTHORIZED challenge — the documented endpoint is live and key-gated as described.
    probeId: 'api-auth-challenge',
    productId: 'skyfire',
    storyIds: ['scoped-payment-tokens', 'agentic-public-api'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://api.skyfire.xyz/api/v1/tokens/introspect -H 'Content-Type: application/json' -d '{}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://api.skyfire.xyz/api/v1/tokens/introspect -d '{}'  # documented token API, keyless → structured challenge`,
    expect: /NOT_AUTHORIZED/,
    timeoutMs: 30_000,
  },
  {
    // docs.skyfire.xyz serves llms.txt — the agent-readable index of the developer portal.
    probeId: 'docs-llms-txt',
    productId: 'skyfire',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.skyfire.xyz/llms.txt | head -3'],
    displayCommand: 'curl -s https://docs.skyfire.xyz/llms.txt | head -3',
    expect: /# Skyfire Developer Portal/,
    timeoutMs: 30_000,
  },
]
