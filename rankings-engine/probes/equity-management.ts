import { CURL_MCP_INIT, type LocalProbe } from './types'

// Cap table & equity management: fintech vendors keep the product itself behind the login
// wall, so the keyless story here is the ACCESS story — whose ownership data can an agent
// actually reach for? Carta anchors: its developer platform answers keyless calls with real
// auth challenges and it documents a remote MCP server (mcp.app.carta.com) whose OAuth
// protected-resource metadata names cap-table scopes (read_mcp_companies). Ledgy publishes
// its GraphQL reference on a public docs site and its endpoint answers keyless posts with an
// API-key challenge. Cake Equity and Vestd serve llms.txt on their marketing sites. Pulley's
// api.pulley.com exists and challenges auth but publishes no developer docs — recorded as
// exactly that. Fidelity Private Shares exposes no keyless programmatic surface at all
// (public support articles only) — no probe is honestly recordable, and that absence is a
// finding, not an oversight. All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Carta's Issuer API answers a keyless request with a clean 401 auth challenge — the
    // documented endpoint is real and gated by OAuth, exactly as the docs say.
    probeId: 'api-auth-challenge',
    productId: 'carta',
    storyIds: ['equity-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.carta.com/v1alpha1/issuers | head -4'],
    displayCommand: 'curl -si https://api.carta.com/v1alpha1/issuers | head -4  # the documented Issuer API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Carta's documented remote MCP server (docs.carta.com claude-mcp-setup guide) answers a
    // keyless initialize with its OAuth protected-resource challenge.
    probeId: 'mcp-authgate',
    productId: 'carta',
    storyIds: ['agentic-mcp-server', 'agent-reconciles-ownership'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.app.carta.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.app.carta.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the remote MCP server Carta documents for Claude/Codex`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // The MCP server's OAuth protected-resource metadata is public and names the cap-table
    // scopes an agent can be granted — read_mcp_companies, read_mcp_firms, read_mcp_crm.
    probeId: 'mcp-scopes-metadata',
    productId: 'carta',
    storyIds: ['agentic-scoped-keys', 'agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://mcp.app.carta.com/.well-known/oauth-protected-resource/mcp | head -c 500'],
    displayCommand: 'curl -s https://mcp.app.carta.com/.well-known/oauth-protected-resource/mcp  # scoped cap-table permissions, in the open',
    expect: /read_mcp_companies/,
    timeoutMs: 30_000,
  },
  {
    // api.pulley.com is live and challenges auth on a keyless request — but Pulley publishes
    // no developer documentation for it. The endpoint's existence and its undocumented status
    // are both part of the record.
    probeId: 'api-auth-challenge',
    productId: 'pulley',
    storyIds: ['equity-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.pulley.com/v1/stakeholders | head -c 200'],
    displayCommand: 'curl -s https://api.pulley.com/v1/stakeholders  # live API host, auth-gated, no public docs',
    expect: /user not found|current user unavailable/,
    timeoutMs: 30_000,
  },
  {
    // Pulley's help center serves llms.txt — an agent-readable index of the product docs.
    probeId: 'help-llms-txt',
    productId: 'pulley',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://help.pulley.com/llms.txt | head -6'],
    displayCommand: 'curl -sL https://help.pulley.com/llms.txt | head -6',
    expect: /# Pulley Help Center/,
    timeoutMs: 30_000,
  },
  {
    // Ledgy publishes its GraphQL API reference on a public docs site (docs.ledgy.com,
    // SpectaQL-generated from the real schema) — no login wall in front of the API docs.
    probeId: 'public-api-reference',
    productId: 'ledgy',
    storyIds: ['equity-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.ledgy.com/ | grep -o "<title>[^<]*" | head -1'],
    displayCommand: 'curl -s https://docs.ledgy.com/ | grep -o \'<title>[^<]*\'  # public GraphQL API reference, no login wall',
    expect: /GraphQL API Reference/,
    timeoutMs: 30_000,
  },
  {
    // Ledgy's GraphQL endpoint answers a keyless POST with its Bearer-key challenge — the
    // documented endpoint is live and expects the API key the docs describe.
    probeId: 'graphql-auth-challenge',
    productId: 'ledgy',
    storyIds: ['equity-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://app.ledgy.com/graphql -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}' | head -c 300`,
    ],
    displayCommand: `curl -s -X POST https://app.ledgy.com/graphql -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}'  # live endpoint, challenges for the API key`,
    expect: /Invalid key format/,
    timeoutMs: 30_000,
  },
  {
    // Cake Equity's site serves llms.txt — a curated agent-oriented index of the product.
    probeId: 'site-llms-txt',
    productId: 'cake-equity',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.cakeequity.com/llms.txt | head -6'],
    displayCommand: 'curl -sL https://www.cakeequity.com/llms.txt | head -6',
    expect: /# Cake Equity/,
    timeoutMs: 30_000,
  },
  {
    // Vestd's site serves llms.txt describing the platform for agents.
    probeId: 'site-llms-txt',
    productId: 'vestd',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.vestd.com/llms.txt | head -6'],
    displayCommand: 'curl -sL https://www.vestd.com/llms.txt | head -6',
    expect: /# Vestd/,
    timeoutMs: 30_000,
  },
]
