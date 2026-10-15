import type { LocalProbe } from './types'

// Domain registrars, probed keylessly on the agent-era surfaces that separate the field:
// Porkbun's credential-free pricing API and mock server plus its official npm MCP server,
// Name.com's live prod+sandbox API and skill.md agent onboarding, Cloudflare Registrar's
// per-product llms.txt and .md doc mirrors with its at-cost pledge verbatim, GoDaddy's remote
// Streamable-HTTP MCP endpoint / developer llms.txt / OTE sandbox, Dynadot's API endpoint and
// live auth-gated MCP, and Namecheap recorded honestly: its API answers keyless XML errors on
// prod AND sandbox while its entire website (docs, pricing) serves a Cloudflare challenge to
// keyless fetches — both sides recorded. All keyless, read-only. Verified live 2026-09-22.
export const probes: LocalProbe[] = [
  {
    // Keyless pricing API — the machine-readable price list, no signup needed.
    probeId: 'pricing-api',
    productId: 'porkbun',
    storyIds: ['pricing-api', 'published-price-list'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.porkbun.com/api/json/v3/pricing/get -H 'Content-Type: application/json' -d '{}' | head -c 150`],
    displayCommand: `curl -s -X POST https://api.porkbun.com/api/json/v3/pricing/get -H 'Content-Type: application/json' -d '{}'`,
    expect: /"status":"SUCCESS","pricing"/,
    timeoutMs: 30_000,
  },
  {
    // Credential-free mock server — agents can rehearse the whole API without an account.
    probeId: 'mock-server',
    productId: 'porkbun',
    storyIds: ['sandbox-test-keys', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.porkbun.com/api/json/v3/mock/domain/listAll | head -c 150'],
    displayCommand: 'curl -s https://api.porkbun.com/api/json/v3/mock/domain/listAll',
    expect: /"status":\s*"SUCCESS",\s*"count"/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'site-llms-txt',
    productId: 'porkbun',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://porkbun.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://porkbun.com/llms.txt | head -3',
    expect: /# Porkbun/,
    timeoutMs: 30_000,
  },
  {
    // Official MCP server resolves on the public npm registry.
    probeId: 'mcp-npm-version',
    productId: 'porkbun',
    storyIds: ['agentic-mcp-server'],
    bin: 'npm',
    argv: ['npm', 'view', '@porkbunllc/mcp-server', 'version'],
    displayCommand: 'npm view @porkbunllc/mcp-server version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // The production API endpoint answers keyless with a clean JSON error.
    probeId: 'api-hello',
    productId: 'name-com',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.name.com/v4/hello | head -c 100'],
    displayCommand: 'curl -s https://api.name.com/v4/hello',
    expect: /"message":"Unauthenticated"/,
    timeoutMs: 30_000,
  },
  {
    // The documented test environment is live at api.dev.name.com.
    probeId: 'sandbox-hello',
    productId: 'name-com',
    storyIds: ['sandbox-test-keys'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.dev.name.com/v4/hello | head -c 100'],
    displayCommand: 'curl -s https://api.dev.name.com/v4/hello',
    expect: /"message":"Unauthenticated"/,
    timeoutMs: 30_000,
  },
  {
    // Official agent skill served at docs.name.com/skill.md (agentskills-style frontmatter).
    probeId: 'docs-skill-md',
    productId: 'name-com',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.name.com/skill.md | head -5'],
    displayCommand: 'curl -s https://docs.name.com/skill.md | head -5',
    expect: /name: Namecom/,
    timeoutMs: 30_000,
  },
  {
    // Official MCP server resolves on the public npm registry.
    probeId: 'mcp-npm-version',
    productId: 'name-com',
    storyIds: ['agentic-mcp-server'],
    bin: 'npm',
    argv: ['npm', 'view', 'namecom-mcp', 'version'],
    displayCommand: 'npm view namecom-mcp version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // Registrar-scoped llms.txt (per-product index under /registrar/).
    probeId: 'registrar-llms-txt',
    productId: 'cloudflare-registrar',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.cloudflare.com/registrar/llms.txt | head -3'],
    displayCommand: 'curl -s https://developers.cloudflare.com/registrar/llms.txt | head -3',
    expect: /# Registrar/,
    timeoutMs: 30_000,
  },
  {
    // The at-cost pledge, verbatim, from the .md mirror of the registrar docs index.
    probeId: 'docs-md-mirror',
    productId: 'cloudflare-registrar',
    storyIds: ['agentic-agent-docs', 'at-cost-pricing'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.cloudflare.com/registrar/index.md | grep -m1 "No markup"'],
    displayCommand: 'curl -s https://developers.cloudflare.com/registrar/index.md | grep "No markup"',
    expect: /No markup\. No surprise fees\./,
    timeoutMs: 30_000,
  },
  {
    // The v4 registrar API route exists and answers keyless with a structured routing error.
    probeId: 'api-route-live',
    productId: 'cloudflare-registrar',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.cloudflare.com/client/v4/accounts/x/registrar/domains | head -c 200'],
    displayCommand: 'curl -s https://api.cloudflare.com/client/v4/accounts/x/registrar/domains',
    expect: /"code":7003/,
    timeoutMs: 30_000,
  },
  {
    // Remote Streamable-HTTP MCP endpoint answers JSON-RPC (keyless handshake negotiation).
    probeId: 'remote-mcp-endpoint',
    productId: 'godaddy',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.godaddy.com/v1/domains/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"productarena-probe","version":"1.0"}}}' | head -c 200`],
    displayCommand: `curl -s -X POST https://api.godaddy.com/v1/domains/mcp -d '<initialize>'`,
    expect: /"jsonrpc":"2\.0"/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'dev-llms-txt',
    productId: 'godaddy',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.godaddy.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://developer.godaddy.com/llms.txt | head -3',
    expect: /# GoDaddy Developer Platform/,
    timeoutMs: 30_000,
  },
  {
    // Keyless OpenAPI 3.1 spec for the v3 domains API.
    probeId: 'openapi-spec',
    productId: 'godaddy',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.godaddy.com/openapi/domains-v3.json | head -c 150'],
    displayCommand: 'curl -s https://developer.godaddy.com/openapi/domains-v3.json | head -c 150',
    expect: /"openapi": "3\.1\.0"/,
    timeoutMs: 30_000,
  },
  {
    // The documented OTE sandbox environment is live (keyless 401, not a 404).
    probeId: 'ote-sandbox-live',
    productId: 'godaddy',
    storyIds: ['sandbox-test-keys'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 'https://api.ote-godaddy.com/v1/domains/available?domain=example.com'`],
    displayCommand: `curl -s -o /dev/null -w "HTTP %{http_code}" 'https://api.ote-godaddy.com/v1/domains/available?domain=example.com'`,
    expect: /HTTP 401/,
    timeoutMs: 30_000,
  },
  {
    // The legacy JSON API endpoint answers keyless with a structured error.
    probeId: 'api-endpoint-live',
    productId: 'dynadot',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://api.dynadot.com/api3.json?key=x&command=search&domain0=example.com' | head -c 150`],
    displayCommand: `curl -s 'https://api.dynadot.com/api3.json?key=x&command=search&domain0=example.com'`,
    expect: /"Error":"invalid key"/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'site-llms-txt',
    productId: 'dynadot',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.dynadot.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://www.dynadot.com/llms.txt | head -3',
    expect: /# Dynadot/,
    timeoutMs: 30_000,
  },
  {
    // The documented MCP endpoint is live and auth-gated (401, not a 404).
    probeId: 'mcp-endpoint-live',
    productId: 'dynadot',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://mcp.dynadot.com/mcp'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://mcp.dynadot.com/mcp',
    expect: /HTTP 401/,
    timeoutMs: 30_000,
  },
  {
    // The XML API answers keyless with a clean structured error (the API is real and live).
    probeId: 'api-xml-endpoint',
    productId: 'namecheap',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.namecheap.com/xml.response | head -c 200'],
    displayCommand: 'curl -s https://api.namecheap.com/xml.response',
    expect: /Parameter APIUser is missing/,
    timeoutMs: 30_000,
  },
  {
    // The documented sandbox environment is alive too.
    probeId: 'sandbox-xml-endpoint',
    productId: 'namecheap',
    storyIds: ['sandbox-test-keys'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.sandbox.namecheap.com/xml.response | head -c 200'],
    displayCommand: 'curl -s https://api.sandbox.namecheap.com/xml.response',
    expect: /Parameter APIUser is missing/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative, recorded: the entire website (docs, pricing, API reference) serves a
    // Cloudflare challenge to keyless fetches — the reason this entry's docs corpus is thin.
    probeId: 'site-challenge-wall',
    productId: 'namecheap',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" https://www.namecheap.com/'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://www.namecheap.com/',
    expect: /HTTP 403/,
    timeoutMs: 30_000,
  },
]
