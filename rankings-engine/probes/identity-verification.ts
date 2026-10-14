import { CURL_MCP_INIT, type LocalProbe } from './types'

// Identity verification & KYC: the arena's agent story is uneven and the probes record both
// sides. Persona's docs MCP (docs.withpersona.com/mcp) completes a keyless initialize with
// real serverInfo (fern-docs-mcp-server) — the open end. Sumsub's docs.sumsub.com/mcp answers
// a clean JSON-RPC "Authorization required" authgate (its account MCP at api.sumsub.com/mcp
// needs an OAuth role permission per docs). Stripe's platform MCP answers its documented
// Unauthorized challenge — Identity objects ride the same surface. Entrust (ex-Onfido) and
// Veriff have no MCP anywhere — absences recorded in the arena description, not faked here.
// Every vendor's API answers keyless with a challenge: Stripe and Persona and Veriff and
// Onfido's API hosts give clean 401s, Plaid answers 400 naming the missing client_id, and
// Sumsub's edge returns a Cloudflare-fronted 403 "Unauthorized (cfb)" instead of a plain
// 401 — recorded as-is, the difference is the finding. llms.txt is live on all six docs
// hosts (Veriff's only on devdocs.veriff.com — developers.veriff.com silently redirects).
// All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // Identity's core object — verification sessions — answers a keyless request with
    // Stripe's canonical 401 challenge.
    probeId: 'api-auth-challenge',
    productId: 'stripe-identity',
    storyIds: ['session-lifecycle-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.stripe.com/v1/identity/verification_sessions | head -4'],
    displayCommand: 'curl -si https://api.stripe.com/v1/identity/verification_sessions | head -4  # Identity sessions API, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Stripe's documented remote MCP server answers a keyless initialize with its
    // Unauthorized challenge — Identity verification sessions ride the platform surface.
    probeId: 'mcp-authgate',
    productId: 'stripe-identity',
    storyIds: ['agent-runs-verification', 'agentic-mcp-server'],
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
    // docs.stripe.com serves llms.txt (and .md twins of every Identity docs page).
    probeId: 'docs-llms-txt',
    productId: 'stripe-identity',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.stripe.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.stripe.com/llms.txt | head -3',
    expect: /# Stripe Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Persona's docs MCP server completes a keyless initialize with real serverInfo — the
    // only IDV vendor whose MCP handshake finishes without auth.
    probeId: 'mcp-keyless-initialize',
    productId: 'persona',
    storyIds: ['agent-runs-verification', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.withpersona.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -o '"serverInfo":{[^}]*}'`,
    ],
    displayCommand: `curl -s -X POST https://docs.withpersona.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # keyless initialize completes with serverInfo`,
    expect: /fern-docs-mcp-server/,
    timeoutMs: 30_000,
  },
  {
    // Persona's inquiries API answers a keyless request with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'persona',
    storyIds: ['session-lifecycle-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.withpersona.com/api/v1/inquiries | head -3'],
    displayCommand: 'curl -si https://api.withpersona.com/api/v1/inquiries | head -3  # keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // docs.withpersona.com serves llms.txt opening with an "Instructions for AI Agents"
    // section that points agents at the MCP server.
    probeId: 'docs-llms-txt',
    productId: 'persona',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.withpersona.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.withpersona.com/llms.txt | head -3',
    expect: /# Persona/,
    timeoutMs: 30_000,
  },
  {
    // Sumsub's documented MCP endpoint answers a keyless initialize with a clean JSON-RPC
    // authgate — the account MCP exists and wants its documented OAuth role.
    probeId: 'mcp-authgate',
    productId: 'sumsub',
    storyIds: ['agent-runs-verification', 'agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.sumsub.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 200`,
    ],
    displayCommand: `curl -s -X POST https://docs.sumsub.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # JSON-RPC "Authorization required" authgate`,
    expect: /Authorization required/,
    timeoutMs: 30_000,
  },
  {
    // Sumsub's API edge answers keyless with a Cloudflare-fronted 403 "Unauthorized (cfb)"
    // rather than a plain 401 — recorded as-is.
    probeId: 'api-auth-challenge',
    productId: 'sumsub',
    storyIds: ['session-lifecycle-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.sumsub.com/resources/applicants/x/one | head -c 200'],
    displayCommand: 'curl -s https://api.sumsub.com/resources/applicants/x/one  # keyless → 403 "Unauthorized (cfb)", not a plain 401',
    expect: /Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // docs.sumsub.com serves llms.txt (and .md twins on /docs/ and /reference/ paths).
    probeId: 'docs-llms-txt',
    productId: 'sumsub',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.sumsub.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://docs.sumsub.com/llms.txt | head -3',
    expect: /# Sumsub Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Veriff's sessions API answers a keyless POST with a clean 401.
    probeId: 'api-auth-challenge',
    productId: 'veriff',
    storyIds: ['session-lifecycle-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://stationapi.veriff.com/v1/sessions -H 'Content-Type: application/json' -d '{}' | head -2`],
    displayCommand: `curl -si -X POST https://stationapi.veriff.com/v1/sessions -H 'Content-Type: application/json' -d '{}'  # keyless → 401`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // Veriff's llms.txt lives on devdocs.veriff.com — the old developers.veriff.com host
    // silently redirects, so the probe hits the real docs host.
    probeId: 'docs-llms-txt',
    productId: 'veriff',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://devdocs.veriff.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://devdocs.veriff.com/llms.txt | head -3',
    expect: /# Veriff Dev Documentation/,
    timeoutMs: 30_000,
  },
  {
    // The Onfido-era API host still answers under Entrust: keyless request → clean 401.
    probeId: 'api-auth-challenge',
    productId: 'entrust-onfido',
    storyIds: ['session-lifecycle-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.eu.onfido.com/v3.6/applicants | head -2'],
    displayCommand: 'curl -si https://api.eu.onfido.com/v3.6/applicants | head -2  # Onfido-era API host under Entrust, keyless → 401',
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // The rebranded docs host serves llms.txt under the Entrust name — the rebrand is
    // machine-visible.
    probeId: 'docs-llms-txt',
    productId: 'entrust-onfido',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://documentation.identity.entrust.com/llms.txt | head -3'],
    displayCommand: 'curl -sL https://documentation.identity.entrust.com/llms.txt | head -3',
    expect: /# Entrust Identity Verification Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Plaid's IDV endpoint answers a keyless POST with a documented 400 naming the missing
    // credentials — a machine-legible challenge, just not a 401.
    probeId: 'api-auth-challenge',
    productId: 'plaid-idv',
    storyIds: ['session-lifecycle-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -X POST https://production.plaid.com/identity_verification/list -H 'Content-Type: application/json' -d '{}' | head -2`],
    displayCommand: `curl -si -X POST https://production.plaid.com/identity_verification/list -H 'Content-Type: application/json' -d '{}'  # keyless → 400 naming the missing credentials`,
    expect: /400/,
    timeoutMs: 30_000,
  },
  {
    // plaid.com/docs serves llms.txt (plus index.html.md twins of every docs page).
    probeId: 'docs-llms-txt',
    productId: 'plaid-idv',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://plaid.com/docs/llms.txt | head -3'],
    displayCommand: 'curl -sL https://plaid.com/docs/llms.txt | head -3',
    expect: /# Plaid Technical Documentation/,
    timeoutMs: 30_000,
  },
]
