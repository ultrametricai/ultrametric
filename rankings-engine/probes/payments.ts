import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'stripe',
      storyIds: ['agentic-official-cli'],
      bin: 'stripe',
      argv: ['stripe', '--version'],
      displayCommand: 'stripe --version',
      expect: /stripe version \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-resources-discovery',
      productId: 'stripe',
      storyIds: ['agentic-official-cli', 'agentic-headless'],
      bin: 'stripe',
      argv: ['stripe', 'resources'],
      displayCommand: 'stripe resources',
      expect: /payment_intents/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-webhook-listen-help',
      productId: 'stripe',
      storyIds: ['agentic-webhooks', 'webhook-delivery-reliability'],
      bin: 'stripe',
      argv: ['stripe', 'listen', '--help'],
      displayCommand: 'stripe listen --help',
      expect: /webhook/i,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'stripe',
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
      probeId: 'mcp-remote-discovery',
      productId: 'paypal',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.paypal.com/.well-known/oauth-protected-resource/mcp'],
      displayCommand: 'curl -s https://mcp.paypal.com/.well-known/oauth-protected-resource/mcp',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to PayPal's hosted MCP answers the RFC 9728 OAuth
      // challenge (401 + www-authenticate resource_metadata) — the server is live and
      // speaks the MCP authorization spec.
      probeId: 'mcp-remote-handshake',
      productId: 'paypal',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.paypal.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.paypal.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      // developer.paypal.com publishes a sectioned llms.txt index (each section links its own
      // per-area page index) — keyless, agent-oriented docs discovery.
      probeId: 'llms-docs-index',
      productId: 'paypal',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.paypal.com/llms.txt | head -8'],
      displayCommand: 'curl -s https://developer.paypal.com/llms.txt | head -8',
      expect: /# PayPal Developer Documentation/,
      timeoutMs: 30_000,
    },
    {
      // docs.adyen.com publishes llms.txt per the llmstxt.org convention, links llms-full.txt,
      // and documents that every page renders as markdown at URL + `.md`.
      probeId: 'llms-docs-index',
      productId: 'adyen',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.adyen.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.adyen.com/llms.txt | head -6',
      expect: /# Adyen Docs/,
      timeoutMs: 30_000,
    },
    {
      // The documented `.md` suffix convention, checked against the MCP-server docs page.
      probeId: 'docs-md-endpoint',
      productId: 'adyen',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.adyen.com/development-resources/mcp-server.md | head -14'],
      displayCommand: 'curl -s https://docs.adyen.com/development-resources/mcp-server.md | head -14',
      expect: /Model Context Protocol/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to Square's hosted MCP (mcp.squareup.com) answers the
      // RFC 9728 OAuth challenge — live remote server, OAuth-gated with granular scopes.
      probeId: 'mcp-remote-handshake',
      productId: 'square',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.squareup.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.squareup.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-discovery',
      productId: 'square',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.squareup.com/.well-known/oauth-protected-resource/mcp'],
      displayCommand: 'curl -s https://mcp.squareup.com/.well-known/oauth-protected-resource/mcp',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      // developer.squareup.com's llms.txt declares the docs "Designed to be consumable by
      // both human developers and AI agents" and ships explicit per-agent guidance.
      probeId: 'llms-docs-index',
      productId: 'square',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.squareup.com/llms.txt | head -8'],
      displayCommand: 'curl -s https://developer.squareup.com/llms.txt | head -8',
      expect: /Square Developer Platform/,
      timeoutMs: 30_000,
    },
    {
      // Autumn's docs publish a full llms.txt index.
      probeId: 'llms-docs-index',
      productId: 'autumn',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.useautumn.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.useautumn.com/llms.txt | head -6',
      expect: /# Autumn/,
      timeoutMs: 30_000,
    },
    {
      // Docs serve clean markdown at page URL + .md — the MCP page documents the hosted server.
      probeId: 'docs-md-endpoint',
      productId: 'autumn',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.useautumn.com/documentation/mcp.md | head -8'],
      displayCommand: 'curl -s https://docs.useautumn.com/documentation/mcp.md | head -8',
      expect: /Documentation Index/,
      timeoutMs: 30_000,
    },
    {
      // Autumn's hosted MCP answers a keyless initialize with an OAuth challenge whose
      // www-authenticate header enumerates the full scope surface (customers, plans, billing,
      // analytics…) — the agent capability map in one header.
      probeId: 'mcp-remote-handshake',
      productId: 'autumn',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.useautumn.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.useautumn.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Checkout.com's docs publish a topic-grouped llms.txt index (the marketing site has its
      // own at www.checkout.com/llms.txt as well).
      probeId: 'llms-docs-index',
      productId: 'checkout-com',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.checkout.com/docs/llms.txt | head -4'],
      displayCommand: 'curl -s https://www.checkout.com/docs/llms.txt | head -4',
      expect: /# Checkout\.com documentation/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to Checkout.com's hosted MCP (documented at
      // /docs/developer-resources/checkout-com-mcp-server; sandbox twin at
      // checkout.mcp.sbox.cko.tech). The live server answers 401 with a Bearer challenge naming
      // its OAuth scopes (mcp_full_access) and RFC 9728 resource_metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'checkout-com',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.checkout.com/',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.checkout.com/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /Missing Bearer token|resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      // docs.mollie.com publishes llms.txt and documents the `.md` suffix convention in it.
      probeId: 'llms-docs-index',
      productId: 'mollie',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.mollie.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.mollie.com/llms.txt | head -6',
      expect: /# Mollie Documentation/,
      timeoutMs: 30_000,
    },
    {
      // The documented `.md` suffix convention, checked against the MCP-server docs page.
      probeId: 'docs-md-endpoint',
      productId: 'mollie',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.mollie.com/docs/mollie-mcp-server.md | head -10'],
      displayCommand: 'curl -s https://docs.mollie.com/docs/mollie-mcp-server.md | head -10',
      expect: /Mollie MCP Server/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to Mollie's hosted MCP (documented endpoint
      // mcp.mollie.com/mcp) answers 401 + RFC 9728 resource_metadata — live and spec-compliant.
      probeId: 'mcp-remote-handshake',
      productId: 'mollie',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.mollie.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.mollie.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-discovery',
      productId: 'mollie',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.mollie.com/.well-known/oauth-protected-resource/mcp'],
      displayCommand: 'curl -s https://mcp.mollie.com/.well-known/oauth-protected-resource/mcp',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      // www.airwallex.com/docs publishes llms.txt with `.md` siblings for every page.
      probeId: 'llms-docs-index',
      productId: 'airwallex',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.airwallex.com/docs/llms.txt | head -4'],
      displayCommand: 'curl -s https://www.airwallex.com/docs/llms.txt | head -4',
      expect: /# Airwallex Product Documentation/,
      timeoutMs: 30_000,
    },
    {
      // The `.md` convention, checked against the AgentOS page — Airwallex's agent toolkit
      // (CLI + AgentOS MCP + Developer MCP + skills + Claude Code/Cursor plugins).
      probeId: 'docs-md-endpoint',
      productId: 'airwallex',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.airwallex.com/docs/developer-tools/ai/agentos.md | head -6'],
      displayCommand: 'curl -s https://www.airwallex.com/docs/developer-tools/ai/agentos.md | head -6',
      expect: /Airwallex AgentOS/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to the documented AgentOS MCP endpoint
      // (mcp.airwallex.com/mcp) answers 401 + RFC 9728 resource_metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'airwallex',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.airwallex.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.airwallex.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      // The documented one-line CLI installer serves keylessly — the official Airwallex CLI
      // exists and is distributed exactly as the docs say (install verified separately).
      probeId: 'cli-installer-served',
      productId: 'airwallex',
      storyIds: ['agentic-official-cli'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://static.airwallex.com/developer-tools/airwallex-cli/install.sh | head -6'],
      displayCommand: 'curl -sL https://static.airwallex.com/developer-tools/airwallex-cli/install.sh | head -6',
      expect: /Airwallex CLI installer/,
      timeoutMs: 30_000,
    },
    {
      // developer.paddle.com publishes a sectioned llms.txt (+ llms-full.txt and `.md`
      // siblings) with explicit agent guidance, including an LLM benchmark page.
      probeId: 'llms-docs-index',
      productId: 'paddle',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.paddle.com/llms.txt | head -4'],
      displayCommand: 'curl -s https://developer.paddle.com/llms.txt | head -4',
      expect: /# Paddle Developer Docs/,
      timeoutMs: 30_000,
    },
    {
      // The `.md` convention, checked against the hosted MCP server's docs page (which also
      // documents the sandbox twin at sandbox-mcp.paddle.com/mcp).
      probeId: 'docs-md-endpoint',
      productId: 'paddle',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.paddle.com/sdks/ai/paddle-mcp.md | head -6'],
      displayCommand: 'curl -s https://developer.paddle.com/sdks/ai/paddle-mcp.md | head -6',
      expect: /Paddle MCP server/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to Paddle's hosted MCP (mcp.paddle.com/mcp) answers 401 +
      // RFC 9728 resource_metadata — live, OAuth- or API-key-gated as documented.
      probeId: 'mcp-remote-handshake',
      productId: 'paddle',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.paddle.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.paddle.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-discovery',
      productId: 'paddle',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.paddle.com/.well-known/oauth-protected-resource'],
      displayCommand: 'curl -s https://mcp.paddle.com/.well-known/oauth-protected-resource',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      // Paddle's OpenAPI spec is published in the documented PaddleHQ/paddle-openapi repo —
      // the machine-readable API surface, fetchable keylessly.
      probeId: 'openapi-spec-served',
      productId: 'paddle',
      storyIds: ['api-machine-spec'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/PaddleHQ/paddle-openapi/HEAD/v1/openapi.yaml | head -4'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/PaddleHQ/paddle-openapi/HEAD/v1/openapi.yaml | head -4',
      expect: /openapi: 3\.1\.0/,
      timeoutMs: 30_000,
    },
    {
      // polar.sh/docs publishes llms.txt with `.md` siblings and versioned OpenAPI specs.
      probeId: 'llms-docs-index',
      productId: 'polar',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://polar.sh/docs/llms.txt | head -4'],
      displayCommand: 'curl -s https://polar.sh/docs/llms.txt | head -4',
      expect: /# Polar/,
      timeoutMs: 30_000,
    },
    {
      // The `.md` convention, checked against the MCP docs page (remote server + sandbox twin
      // at mcp.polar.sh/mcp/polar-sandbox, OAuth so "you never need to copy an API key").
      probeId: 'docs-md-endpoint',
      productId: 'polar',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://polar.sh/docs/integrate/mcp.md | head -8'],
      displayCommand: 'curl -s https://polar.sh/docs/integrate/mcp.md | head -8',
      expect: /Model Context Protocol/,
      timeoutMs: 30_000,
    },
    {
      // Keyless JSON-RPC initialize to Polar's hosted MCP (mcp.polar.sh/mcp/polar-mcp) answers
      // 401 + RFC 9728 resource_metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'polar',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.polar.sh/mcp/polar-mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.polar.sh/mcp/polar-mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      // Polar serves its versioned OpenAPI 3.1 spec straight from the docs site.
      probeId: 'openapi-spec-served',
      productId: 'polar',
      storyIds: ['api-machine-spec'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://polar.sh/docs/openapi/2026-10.openapi.json | head -c 300'],
      displayCommand: 'curl -s https://polar.sh/docs/openapi/2026-10.openapi.json | head -c 300',
      expect: /"openapi": "3\.1\.0"/,
      timeoutMs: 30_000,
    },
]
