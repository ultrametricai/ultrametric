import { CURL_MCP_INIT, type LocalProbe } from './types'

// AI customer support agents: the first agent category with real enterprise revenue — and the
// most SaaS-gated arena probed so far, so the keyless surface splits sharply. Fin, Pylon,
// Lorikeet, and Parahelp publish agent-legible docs (llms.txt, .md mirrors) and live, cleanly
// auth-gated APIs and MCP servers we handshake keylessly; Sierra and Decagon login-gate their
// docs entirely — recorded honestly as findings, since "docs your customers' agents can't
// read" is itself information in this arena. All probes are keyless and read-only.
export const probes: LocalProbe[] = [
  {
    // Fin's own marketing site serves llms.txt — agent-legible docs from the market leader.
    probeId: 'own-site-llms-txt',
    productId: 'intercom-fin',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://fin.ai/llms.txt | head -6'],
    displayCommand: 'curl -s https://fin.ai/llms.txt | head -6',
    expect: /# Fin/,
    timeoutMs: 30_000,
  },
  {
    // The developer platform's llms.txt indexes the whole API surface for agents.
    probeId: 'devdocs-llms-txt',
    productId: 'intercom-fin',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://developers.intercom.com/llms.txt | head -6'],
    displayCommand: 'curl -s https://developers.intercom.com/llms.txt | head -6',
    expect: /Intercom and Fin Developer Platform/,
    timeoutMs: 30_000,
  },
  {
    // The public REST API answers keyless requests with a clean structured auth challenge.
    probeId: 'api-auth-challenge',
    productId: 'intercom-fin',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.intercom.io/me'],
    displayCommand: 'curl -si https://api.intercom.io/me',
    expect: /missing_authorization/,
    timeoutMs: 30_000,
  },
  {
    // The hosted MCP server answers a keyless initialize with its OAuth bearer challenge.
    probeId: 'mcp-authgate',
    productId: 'intercom-fin',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.intercom.com/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.intercom.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /invalid_token|Bearer realm="OAuth"/,
    timeoutMs: 30_000,
  },
  {
    // Official Node SDK is published and current on the public npm registry.
    probeId: 'sdk-npm-registry',
    productId: 'intercom-fin',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['sh', '-c', 'npm view intercom-client name version 2>&1 | head -4'],
    displayCommand: 'npm view intercom-client name version',
    expect: /intercom-client/,
    timeoutMs: 60_000,
  },
  {
    // Decagon's site serves llms.txt — the only agent-legible doc surface it exposes keylessly.
    probeId: 'site-llms-txt',
    productId: 'decagon',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://decagon.ai/llms.txt | head -8'],
    displayCommand: 'curl -s https://decagon.ai/llms.txt | head -8',
    expect: /# Decagon/,
    timeoutMs: 30_000,
  },
  {
    // The public sitemap enumerates the product surface: AOPs, chat/email/voice channels,
    // testing-qa, insights — the keyless map of what Decagon ships.
    probeId: 'product-surface-sitemap',
    productId: 'decagon',
    storyIds: ['omnichannel-coverage'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://decagon.ai/sitemap.xml | grep -o 'https://decagon.ai/product/[^<]*' | sort | head -12`],
    displayCommand: `curl -s https://decagon.ai/sitemap.xml | grep -o 'https://decagon.ai/product/[^<]*' | sort | head -12`,
    expect: /product\/voice/,
    timeoutMs: 30_000,
  },
  {
    // FINDING, recorded honestly: docs.decagon.ai is login-gated — no public technical docs
    // for customers' agents (or anyone keyless) to read.
    probeId: 'docs-login-gate',
    productId: 'decagon',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -i --max-time 20 https://docs.decagon.ai/ 2>&1 | head -12'],
    displayCommand: 'curl -si https://docs.decagon.ai/ | head -12  # finding: technical docs are login-gated',
    expect: /login|307/i,
    timeoutMs: 30_000,
  },
  {
    // Sierra's tau-bench — the agent benchmark it publishes openly — fetched from the
    // official sierra-research repo, keyless.
    probeId: 'taubench-repo-readme',
    productId: 'sierra',
    storyIds: ['pre-launch-simulation'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://raw.githubusercontent.com/sierra-research/tau-bench/HEAD/README.md | head -8'],
    displayCommand: 'curl -sL https://raw.githubusercontent.com/sierra-research/tau-bench/HEAD/README.md | head -8',
    expect: /tau/i,
    timeoutMs: 30_000,
  },
  {
    // The public sitemap proves the Agent SDK / Agent Studio surface exists — the deepest
    // keyless look Sierra allows.
    probeId: 'product-surface-sitemap',
    productId: 'sierra',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://sierra.ai/sitemap.xml | grep -o '<loc>https://sierra.ai/product/[^<]*' | sort | head -12`],
    displayCommand: `curl -s https://sierra.ai/sitemap.xml | grep -o '<loc>https://sierra.ai/product/[^<]*' | sort | head -12`,
    expect: /agent-sdk/,
    timeoutMs: 30_000,
  },
  {
    // FINDING, recorded honestly: docs.sierra.ai has no agent-legible surface — llms.txt
    // resolves to the login SPA's HTML shell, not a plain-text index.
    probeId: 'docs-login-gate',
    productId: 'sierra',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s -o /dev/null -w 'llms.txt: HTTP %{http_code} %{content_type}\\n' -L --max-time 20 https://docs.sierra.ai/llms.txt`],
    displayCommand: `curl -sL https://docs.sierra.ai/llms.txt -o /dev/null -w 'llms.txt: HTTP %{http_code} %{content_type}'  # finding: resolves to the login SPA's HTML shell, not an agent-legible index`,
    expect: /text\/html/,
    timeoutMs: 30_000,
  },
  {
    // Pylon's own docs serve llms.txt (GitBook) — agent-legible index of the whole doc set.
    probeId: 'docs-llms-txt',
    productId: 'pylon',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.usepylon.com/pylon-docs/llms.txt | head -6'],
    displayCommand: 'curl -sL https://docs.usepylon.com/pylon-docs/llms.txt | head -6',
    expect: /# Pylon/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror — on the very page documenting Pylon's own MCP server.
    probeId: 'docs-md-mirror',
    productId: 'pylon',
    storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.usepylon.com/pylon-docs/integrations/pylon-mcp.md | head -8'],
    displayCommand: 'curl -sL https://docs.usepylon.com/pylon-docs/integrations/pylon-mcp.md | head -8',
    expect: /# Pylon MCP/,
    timeoutMs: 30_000,
  },
  {
    // The public REST API answers keyless requests with a clean Bearer-scheme challenge.
    probeId: 'api-auth-challenge',
    productId: 'pylon',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.usepylon.com/me'],
    displayCommand: 'curl -si https://api.usepylon.com/me',
    expect: /Bearer authorization scheme/,
    timeoutMs: 30_000,
  },
  {
    // The first-party MCP server answers a keyless initialize with its OAuth challenge and
    // publicly readable protected-resource metadata.
    probeId: 'mcp-authgate',
    productId: 'pylon',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.usepylon.com',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.usepylon.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Lorikeet's docs llms.txt — the public index leads with its MCP server docs.
    probeId: 'docs-llms-txt',
    productId: 'lorikeet',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.lorikeetcx.ai/llms.txt | head -8'],
    displayCommand: 'curl -s https://docs.lorikeetcx.ai/llms.txt | head -8',
    expect: /Lorikeet MCP Server/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the MCP server doc itself.
    probeId: 'docs-md-mirror',
    productId: 'lorikeet',
    storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.lorikeetcx.ai/mcp/mcp-server.md | head -8'],
    displayCommand: 'curl -s https://docs.lorikeetcx.ai/mcp/mcp-server.md | head -8',
    expect: /# Lorikeet MCP Server/,
    timeoutMs: 30_000,
  },
  {
    // The public API answers keyless requests with a structured, documented error (RFC 7807
    // style, linking its own error docs).
    probeId: 'api-auth-challenge',
    productId: 'lorikeet',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.lorikeetcx.ai/v1/customer'],
    displayCommand: 'curl -si https://api.lorikeetcx.ai/v1/customer',
    expect: /Missing LORIKEET_CLIENT_ID/,
    timeoutMs: 30_000,
  },
  {
    // The hosted MCP endpoint is live: a GET is refused with 405 (streamable-HTTP servers
    // only speak POST), proving the endpoint exists keylessly.
    probeId: 'mcp-endpoint-live',
    productId: 'lorikeet',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -i --max-time 20 https://mcp.lorikeetcx.ai 2>&1 | head -8'],
    displayCommand: 'curl -si https://mcp.lorikeetcx.ai | head -8',
    expect: /405|Method Not Allowed/i,
    timeoutMs: 30_000,
  },
  {
    // Parahelp's docs serve llms.txt (Mintlify).
    probeId: 'docs-llms-txt',
    productId: 'parahelp',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.parahelp.com/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.parahelp.com/llms.txt | head -6',
    expect: /# Parahelp docs/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the customer-agent API doc.
    probeId: 'docs-md-mirror',
    productId: 'parahelp',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.parahelp.com/customer-agent/api.md | head -8'],
    displayCommand: 'curl -s https://docs.parahelp.com/customer-agent/api.md | head -8',
    expect: /# API/,
    timeoutMs: 30_000,
  },
  {
    // The public API reference at app.parahelp.com/api/docs is reachable keylessly.
    probeId: 'public-api-docs',
    productId: 'parahelp',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://app.parahelp.com/api/docs | head -c 400; echo'],
    displayCommand: 'curl -sL https://app.parahelp.com/api/docs | head -c 400',
    expect: /parahelp|openapi|swagger|scalar/i,
    timeoutMs: 30_000,
  },
]
