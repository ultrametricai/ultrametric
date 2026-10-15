import { CURL_MCP_INIT, type LocalProbe } from './types'

// Stablecoin payments: the machine-payments arena, and its probes read like it. FOUR hosts
// complete keyless docs-MCP initializes with real serverInfo — Bridge (apidocs.bridge.xyz,
// Stripe's stablecoin arm), Circle Docs, Coinbase Developer Documentation, and MoonPay
// Developer Docs. Paxos runs a live MCP at docs.paxos.com/mcp that answers a strict JSON-RPC
// Accept-negotiation error rather than completing keyless — recorded as-is. BVNK is the
// arena's absence: docs.bvnk.com/mcp serves the Docusaurus SPA shell, not an MCP server (the
// docs host is a 200-for-everything catch-all, so only body-verified surfaces are probed).
// Every API answers keyless with a clean 401 (Stripe crypto onramp sessions, Bridge, Circle
// w3s, BVNK's CloudFront edge, Coinbase CDP, MoonPay, Paxos). Machine specs: MoonPay ships
// OpenAPI 3.1 and Paxos OpenAPI 3.0 at stable keyless URLs. llms.txt is live on all six
// docs hosts. All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Stripe's crypto onramp sessions endpoint answers keyless with the canonical 401.
    probeId: 'api-auth-challenge',
    productId: 'stripe-crypto',
    storyIds: ['accept-stablecoin-checkout', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/crypto/onramp_sessions | head -2'],
    displayCommand: 'curl -si https://api.stripe.com/v1/crypto/onramp_sessions | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP answers a keyless initialize with its Unauthorized
    // challenge — crypto objects ride the platform surface.
    probeId: 'mcp-authgate',
    productId: 'stripe-crypto',
    storyIds: ['agent-initiated-payments', 'agentic-mcp-server'],
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
    // Bridge — Stripe's stablecoin orchestration/issuance arm — completes a keyless docs-MCP
    // initialize with real serverInfo.
    probeId: 'bridge-mcp-keyless-initialize',
    productId: 'stripe-crypto',
    storyIds: ['stablecoin-issuance', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://apidocs.bridge.xyz/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://apidocs.bridge.xyz/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Bridge docs MCP, keyless initialize completes`,
    expect: /"name":"Bridge"/,
    timeoutMs: 30_000,
  },
  {
    // Bridge's API answers keyless with a clean 401.
    probeId: 'bridge-api-auth-challenge',
    productId: 'stripe-crypto',
    storyIds: ['stablecoin-payouts', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.bridge.xyz/v0/customers | head -2'],
    displayCommand: 'curl -si https://api.bridge.xyz/v0/customers | head -2  # Bridge API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.stripe.com serves llms.txt (and .md twins of every crypto docs page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-crypto',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Circle's docs MCP completes a keyless initialize with real serverInfo — documented on
    // its /ai/mcp page as part of the Agent Stack.
    probeId: 'mcp-keyless-initialize',
    productId: 'circle',
    storyIds: ['agent-initiated-payments', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://developers.circle.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://developers.circle.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /Circle Docs/,
    timeoutMs: 30_000,
  },
  {
    // Circle's programmable-wallets API answers keyless with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'circle',
    storyIds: ['wallet-provisioning-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.circle.com/v1/w3s/wallets | head -2'],
    displayCommand: 'curl -si https://api.circle.com/v1/w3s/wallets | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // developers.circle.com serves llms.txt with a curated index including nine OpenAPI yamls.
    probeId: 'docs-llms-txt',
    productId: 'circle',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.circle.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://developers.circle.com/llms.txt | head -3',
    expect: /# Circle Developer Platform/,
    timeoutMs: 30_000,
  },
  {
    // BVNK's API edge answers keyless with a 401 (CloudFront, empty body) — the challenge is
    // in the status line.
    probeId: 'api-auth-challenge',
    productId: 'bvnk',
    storyIds: ['stablecoin-payouts', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.bvnk.com/api/wallet | head -2'],
    displayCommand: 'curl -si https://api.bvnk.com/api/wallet | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.bvnk.com serves a real llms.txt — probed by content because the host is a
    // 200-for-everything Docusaurus catch-all (its /mcp path serves the SPA shell, not an
    // MCP server — the arena's recorded absence).
    probeId: 'docs-llms-txt',
    productId: 'bvnk',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.bvnk.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.bvnk.com/llms.txt | head -3',
    expect: /# BVNK API Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Coinbase's developer-docs MCP completes a keyless initialize with real serverInfo.
    probeId: 'mcp-keyless-initialize',
    productId: 'coinbase-payments',
    storyIds: ['agent-initiated-payments', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.cdp.coinbase.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.cdp.coinbase.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /Coinbase Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // The CDP platform API answers keyless with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'coinbase-payments',
    storyIds: ['wallet-provisioning-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.cdp.coinbase.com/platform/v2/evm/accounts | head -2'],
    displayCommand: 'curl -si https://api.cdp.coinbase.com/platform/v2/evm/accounts | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.cdp.coinbase.com serves llms.txt (full page index at /_llms/docs.md).
    probeId: 'docs-llms-txt',
    productId: 'coinbase-payments',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.cdp.coinbase.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.cdp.coinbase.com/llms.txt | head -3',
    expect: /# Coinbase Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // MoonPay's docs MCP completes a keyless initialize with real serverInfo — documented on
    // its using-agents page.
    probeId: 'mcp-keyless-initialize',
    productId: 'moonpay',
    storyIds: ['agent-initiated-payments', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://dev.moonpay.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://dev.moonpay.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /MoonPay Developer Docs/,
    timeoutMs: 30_000,
  },
  {
    // MoonPay's API answers keyless with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'moonpay',
    storyIds: ['fiat-onramp-integration', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.moonpay.com/v1/transactions | head -2'],
    displayCommand: 'curl -si https://api.moonpay.com/v1/transactions | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // MoonPay publishes its Platform API as OpenAPI 3.1 at a stable keyless URL.
    probeId: 'openapi-spec',
    productId: 'moonpay',
    storyIds: ['agentic-public-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.moonpay.com/platform/openapi.json | head -c 120'],
    displayCommand: 'curl -s https://api.moonpay.com/platform/openapi.json | head -c 120',
    expect: /"openapi":"3\.1/,
    timeoutMs: 30_000,
  },
  {
    // dev.moonpay.com serves llms.txt.
    probeId: 'docs-llms-txt',
    productId: 'moonpay',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://dev.moonpay.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://dev.moonpay.com/llms.txt | head -3',
    expect: /# MoonPay Developer Docs/,
    timeoutMs: 30_000,
  },
  {
    // Paxos runs a live MCP at docs.paxos.com/mcp that answers strict JSON-RPC Accept
    // negotiation instead of completing keyless — recorded as-is.
    probeId: 'mcp-strict-accept',
    productId: 'paxos',
    storyIds: ['agent-initiated-payments', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.paxos.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://docs.paxos.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # live MCP answering strict JSON-RPC Accept negotiation`,
    expect: /jsonrpc/,
    timeoutMs: 30_000,
  },
  {
    // Paxos's API answers keyless with a clean 401 (RFC 7807 problem+json).
    probeId: 'api-auth-challenge',
    productId: 'paxos',
    storyIds: ['stablecoin-payouts', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.paxos.com/v2/profiles | head -2'],
    displayCommand: 'curl -si https://api.paxos.com/v2/profiles | head -2  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Paxos publishes its full API as OpenAPI 3.0 at a stable keyless URL.
    probeId: 'openapi-spec',
    productId: 'paxos',
    storyIds: ['agentic-public-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.paxos.com/docs/paxos-v2.openapi.json | head -c 120'],
    displayCommand: 'curl -s https://developer.paxos.com/docs/paxos-v2.openapi.json | head -c 120',
    expect: /"openapi": "3\.0/,
    timeoutMs: 30_000,
  },
  {
    // docs.paxos.com serves llms.txt.
    probeId: 'docs-llms-txt',
    productId: 'paxos',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.paxos.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.paxos.com/llms.txt | head -3',
    expect: /# Paxos Documentation/,
    timeoutMs: 30_000,
  },
]
