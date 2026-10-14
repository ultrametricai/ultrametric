import { CURL_MCP_INIT, type LocalProbe } from './types'

// Email marketing: the arena where the agent era arrived early — five of six vendors ship an
// official MCP surface. Loops runs a hosted OAuth-gated MCP (mcp.loops.so) plus llms.txt and
// an agents hub; Customer.io hosts mcp.customer.io behind OAuth; Kit's remote MCP lives at
// app.kit.com/mcp (paid plans); Bento's hosted endpoint answers a keyless initialize with a
// JSON-RPC error naming its credential headers — live and speaking the protocol; Klaviyo's
// official MCP server is a local PyPI package (no hosted endpoint), recorded as exactly that
// via the public registry. Mailchimp is the control group: a deep, live REST API (clean 401
// problem+json) and no agent surface anywhere. All probes are keyless, read-only curls,
// verified live before being committed.
export const probes: LocalProbe[] = [
  {
    // loops.so/llms.txt is a real curated agent-docs index (not a soft 404) — it opens by
    // declaring the product's honest scope: marketing + transactional from one API.
    probeId: 'site-llms-txt',
    productId: 'loops',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://loops.so/llms.txt | head -6'],
    displayCommand: 'curl -sL https://loops.so/llms.txt | head -6',
    expect: /email platform for software companies/,
    timeoutMs: 30_000,
  },
  {
    // The hosted MCP server Loops documents at loops.so/agents/mcp answers a keyless
    // initialize with its OAuth protected-resource challenge — live, gated, speaking MCP.
    probeId: 'mcp-authgate',
    productId: 'loops',
    storyIds: ['agentic-mcp-server', 'agent-drives-campaign'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.loops.so -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.loops.so -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the hosted MCP server from loops.so/agents/mcp`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // The documented REST API answers a keyless contact lookup with a clean 401 — the
    // endpoint from loops.so/docs/api-reference is real and API-key gated, exactly as documented.
    probeId: 'api-auth-challenge',
    productId: 'loops',
    storyIds: ['contacts-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -si --max-time 20 'https://app.loops.so/api/v1/contacts/find?email=probe@example.com' | head -3"],
    displayCommand: "curl -si 'https://app.loops.so/api/v1/contacts/find?email=probe@example.com' | head -3  # documented REST API, keyless → 401",
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // The hosted MCP server from docs.customer.io/ai/mcp answers a keyless initialize with
    // its OAuth challenge naming the protected-resource metadata.
    probeId: 'mcp-authgate',
    productId: 'customer-io',
    storyIds: ['agentic-mcp-server', 'agent-audits-program'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://mcp.customer.io/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://mcp.customer.io/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the hosted MCP server Customer.io documents`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // The App API's campaigns endpoint (docs.customer.io/api) challenges a keyless request
    // with a clean 401 — the campaign surface an agent would drive is live and token-gated.
    probeId: 'api-auth-challenge',
    productId: 'customer-io',
    storyIds: ['campaign-via-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.customer.io/v1/campaigns | head -3'],
    displayCommand: 'curl -si https://api.customer.io/v1/campaigns | head -3  # the documented App API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Klaviyo's public API answers a keyless request with its documented auth challenge —
    // the www-authenticate header names the Klaviyo-API-Key scheme.
    probeId: 'api-auth-challenge',
    productId: 'klaviyo',
    storyIds: ['engagement-data-api-read', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -si --max-time 20 https://a.klaviyo.com/api/accounts/ -H 'revision: 2025-07-15' | grep -i 'HTTP/\\|www-authenticate'"],
    displayCommand: "curl -si https://a.klaviyo.com/api/accounts/ -H 'revision: 2025-07-15'  # the public API, keyless → Klaviyo-API-Key challenge",
    expect: /Klaviyo-API-Key/,
    timeoutMs: 30_000,
  },
  {
    // www.klaviyo.com/llms.txt is a real, curated AI-guidance file — it opens by describing
    // Klaviyo's headless/agent access story in its own words.
    probeId: 'site-llms-txt',
    productId: 'klaviyo',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.klaviyo.com/llms.txt | head -6'],
    displayCommand: 'curl -sL https://www.klaviyo.com/llms.txt | head -6',
    expect: /autonomous B2C CRM/,
    timeoutMs: 30_000,
  },
  {
    // Klaviyo's official MCP server ships as a local PyPI package (klaviyo-mcp-server),
    // authored by their Developer Experience team — no hosted endpoint, so the public
    // registry record is the honest keyless proof.
    probeId: 'mcp-pypi-package',
    productId: 'klaviyo',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://pypi.org/pypi/klaviyo-mcp-server/json | head -c 300'],
    displayCommand: 'curl -s https://pypi.org/pypi/klaviyo-mcp-server/json | head -c 300  # the official MCP server, published on PyPI',
    expect: /Klaviyo Developer Experience Team/,
    timeoutMs: 30_000,
  },
  {
    // Mailchimp's Marketing API root answers keyless with its documented problem+json 401 —
    // a deep, live REST API from the pre-agent era; no MCP or llms.txt surface exists.
    probeId: 'api-auth-challenge',
    productId: 'mailchimp',
    storyIds: ['campaign-via-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://us1.api.mailchimp.com/3.0/ | head -c 240'],
    displayCommand: 'curl -s https://us1.api.mailchimp.com/3.0/ | head -c 240  # Marketing API root, keyless → documented 401 problem+json',
    expect: /API Key Invalid/,
    timeoutMs: 30_000,
  },
  {
    // Kit's remote MCP server (developers.kit.com/mcp/kit-mcp) answers a keyless initialize
    // with its OAuth protected-resource challenge. Available on paid plans only — the gate
    // is the finding.
    probeId: 'mcp-authgate',
    productId: 'kit',
    storyIds: ['agentic-mcp-server', 'agent-builds-segment'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -si --max-time 20 -X POST https://app.kit.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -i 'HTTP/\\|www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://app.kit.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the remote Kit MCP (paid plans)`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // developers.kit.com/llms.txt is a first-class agent-docs index — every doc page is also
    // served as .md, and the MCP pages are listed right at the top.
    probeId: 'docs-llms-txt',
    productId: 'kit',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.kit.com/llms.txt | head -6'],
    displayCommand: 'curl -sL https://developers.kit.com/llms.txt | head -6',
    expect: /Kit Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // The v4 API (developers.kit.com/api-reference) answers keyless with its documented JSON
    // authentication failure — live and OAuth/key-gated, on paid plans.
    probeId: 'api-auth-challenge',
    productId: 'kit',
    storyIds: ['contacts-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.kit.com/v4/subscribers | head -c 120'],
    displayCommand: 'curl -s https://api.kit.com/v4/subscribers | head -c 120  # v4 API, keyless → Authentication Failed',
    expect: /Authentication Failed/,
    timeoutMs: 30_000,
  },
  {
    // Bento's hosted MCP endpoint (bentonow.com/docs/integrations/mcp) answers a keyless
    // initialize with a JSON-RPC error naming the credential headers it requires — a live
    // MCP server speaking the protocol, credential-gated.
    probeId: 'mcp-credential-gate',
    productId: 'bento',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://mcp.bentonow.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 240`,
    ],
    displayCommand: `curl -s -X POST https://mcp.bentonow.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # Bento's hosted MCP endpoint`,
    expect: /Missing one or more required Bento credential headers/,
    timeoutMs: 30_000,
  },
  {
    // Bento's subscriber-fetch API answers keyless with an HTTP Basic denial — the documented
    // API surface is live and secret-key gated.
    probeId: 'api-auth-challenge',
    productId: 'bento',
    storyIds: ['contacts-crud-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 'https://app.bentonow.com/api/v1/fetch/subscribers?site_uuid=probe' | head -c 120"],
    displayCommand: "curl -s 'https://app.bentonow.com/api/v1/fetch/subscribers?site_uuid=probe' | head -c 120  # documented API, keyless → Basic auth denial",
    expect: /Access denied/,
    timeoutMs: 30_000,
  },
]
