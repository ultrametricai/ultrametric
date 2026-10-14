import type { LocalProbe } from './types'

// First probes for the ai-assistants arena, added with the Grok bring-up (2026-09-14 LLM-lab
// families wave). The incumbent assistants (ChatGPT, Claude, Gemini, Perplexity, Copilot) are
// login-gated consumer apps with no keyless local surface worth recording; Grok's vendor ships
// a keyless-probeable developer edge (docs.x.ai llms.txt + api.x.ai's clean 401 challenge)
// that backs its agent-access stories, so we record it the same way we do for every other
// vendor that publishes one.
export const probes: LocalProbe[] = [
  {
    // The xAI API answers a keyless request with a clean structured 401 — a live, documented
    // public API endpoint behind the Grok products (grok.com's own billing/docs route API
    // traffic through the same account system).
    probeId: 'api-keyless-401',
    productId: 'grok',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://api.x.ai/v1/models | head -3; curl -s --max-time 20 https://api.x.ai/v1/models'],
    displayCommand: 'curl -si https://api.x.ai/v1/models | head -3; curl -s https://api.x.ai/v1/models',
    expect: /HTTP\/2 401[\s\S]*unauthenticated:no-credentials/,
    timeoutMs: 60_000,
  },
  {
    // docs.x.ai publishes a full llms.txt index covering the Grok app docs (grok/*.md), with
    // every page fetchable as markdown — agent-oriented docs, verified keylessly.
    probeId: 'llms-docs-index',
    productId: 'grok',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 https://docs.x.ai/llms.txt | grep -i -m 4 -E 'documentation|grok/overview|grok/user-guide'"],
    displayCommand: "curl -s https://docs.x.ai/llms.txt | grep -iE 'documentation|grok/overview|grok/user-guide'",
    expect: /docs\.x\.ai\/grok\/(overview|user-guide)\.md/,
    timeoutMs: 60_000,
  },
  {
    // The vendor also serves a public MCP server card for its docs server — the
    // .well-known/mcp discovery surface an agent uses to find it, fetched keylessly.
    probeId: 'docs-mcp-server-card',
    productId: 'grok',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.x.ai/.well-known/mcp/server-card.json | head -12'],
    displayCommand: 'curl -s https://docs.x.ai/.well-known/mcp/server-card.json | head -12',
    expect: /xai-docs-mcp/,
    timeoutMs: 60_000,
  },
  // Personal-assistant bring-ups (2026-09-14): Poke (The Interaction Company) and Martin are
  // the two independent personal assistants with a real keyless developer edge — Poke ships a
  // public inbound API + custom-MCP ingestion, Martin publishes an llms.txt-indexed docs set
  // with every page fetchable as markdown.
  {
    // Poke's documented public API endpoint (poke.com/docs/api) answers a keyless POST with a
    // clean structured 401 — live proof the inbound-message API exists and enforces Bearer keys.
    probeId: 'api-keyless-401',
    productId: 'poke',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 -X POST https://poke.com/api/v1/inbound/api-message -H \'Content-Type: application/json\' -d \'{"message":"ping"}\' | head -3; curl -s --max-time 20 -X POST https://poke.com/api/v1/inbound/api-message -H \'Content-Type: application/json\' -d \'{"message":"ping"}\''],
    displayCommand: 'curl -si -X POST https://poke.com/api/v1/inbound/api-message -H \'Content-Type: application/json\' -d \'{"message":"ping"}\'',
    expect: /HTTP\/2 401[\s\S]*"error":"Unauthorized"/,
    timeoutMs: 60_000,
  },
  {
    // Poke's API and custom-MCP docs are server-rendered and fetchable keylessly — the pages
    // that document the inbound endpoint and MCP-server ingestion an agent would integrate with.
    probeId: 'docs-api-mcp-pages',
    productId: 'poke',
    storyIds: ['agentic-public-api', 'agentic-mcp-client'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 https://poke.com/docs/api | grep -o -m 2 'api/v1/inbound/api-message' | head -2; curl -s --max-time 20 https://poke.com/docs/mcp-servers | grep -io -m 2 'mcp server' | head -2"],
    displayCommand: "curl -s https://poke.com/docs/api | grep -o 'api/v1/inbound/api-message'; curl -s https://poke.com/docs/mcp-servers | grep -io 'mcp server'",
    expect: /api\/v1\/inbound\/api-message[\s\S]*[Mm][Cc][Pp] [Ss]erver/,
    timeoutMs: 60_000,
  },
  // Launch-audit wave 4 (2026-09-22): muse and gemini were claimed-docs-only — zero probe-tier
  // evidence. Neither ships a keyless developer surface; the honest probes are absence proofs
  // (the yubikey docs-llms-txt-absent pattern): recorded reality, negative results included.
  {
    // Muse (Meta's personal agent) auth-walls its entire non-marketing surface: /llms.txt and
    // /openapi.json both answer keyless fetches with HTTP 401 — no published agent docs, no
    // public API spec. The 401 (not 404) shows the origin is live and deliberately gated.
    probeId: 'llms-openapi-authwalled',
    productId: 'muse',
    storyIds: ['agentic-agent-docs', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -o /dev/null -w "llms.txt HTTP %{http_code}\\n" https://muse.ai/llms.txt; curl -s --max-time 20 -o /dev/null -w "openapi.json HTTP %{http_code}\\n" https://muse.ai/openapi.json'],
    displayCommand: 'curl -s -o /dev/null -w "llms.txt HTTP %{http_code}" https://muse.ai/llms.txt; curl -s -o /dev/null -w "openapi.json HTTP %{http_code}" https://muse.ai/openapi.json',
    expect: /llms\.txt HTTP 401[\s\S]*openapi\.json HTTP 401/,
    timeoutMs: 60_000,
  },
  {
    // Muse publishes no MCP discovery surface: the .well-known server card 404s, and the
    // api.muse.ai origin (which answers in JSON, so it exists) exposes no keyless routes.
    probeId: 'mcp-discovery-absent',
    productId: 'muse',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -o /dev/null -w "server-card HTTP %{http_code}\\n" https://muse.ai/.well-known/mcp/server-card.json; curl -si --max-time 20 https://api.muse.ai/v1/ping | grep -i -m 2 -E "^HTTP|content-type"'],
    displayCommand: 'curl -s -o /dev/null -w "server-card HTTP %{http_code}" https://muse.ai/.well-known/mcp/server-card.json; curl -si https://api.muse.ai/v1/ping | grep -iE "^HTTP|content-type"',
    expect: /server-card HTTP 404[\s\S]*HTTP\/2 404[\s\S]*application\/json/i,
    timeoutMs: 60_000,
  },
  {
    // The Gemini consumer app publishes neither an llms.txt nor an MCP server card on its own
    // origin — clean 404s, recorded as the absence proof for the assistant's agent surface
    // (the developer API lives in the separate frontier-models/gemini product, not this app).
    probeId: 'llms-mcp-absent',
    productId: 'gemini',
    storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -o /dev/null -w "llms.txt HTTP %{http_code}\\n" https://gemini.google.com/llms.txt; curl -s --max-time 20 -o /dev/null -w "server-card HTTP %{http_code}\\n" https://gemini.google.com/.well-known/mcp/server-card.json'],
    displayCommand: 'curl -s -o /dev/null -w "llms.txt HTTP %{http_code}" https://gemini.google.com/llms.txt; curl -s -o /dev/null -w "server-card HTTP %{http_code}" https://gemini.google.com/.well-known/mcp/server-card.json',
    expect: /llms\.txt HTTP 404[\s\S]*server-card HTTP 404/,
    timeoutMs: 60_000,
  },
  {
    // docs.trymartin.com publishes an llms.txt index covering all 16 doc pages — the
    // agent-discovery surface for Martin's docs, fetched keylessly.
    probeId: 'llms-docs-index',
    productId: 'martin',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 https://docs.trymartin.com/llms.txt | grep -m 4 -E 'introduction|calendar|email-triage'"],
    displayCommand: "curl -s https://docs.trymartin.com/llms.txt | grep -E 'introduction|calendar|email-triage'",
    expect: /docs\.trymartin\.com\/(introduction|integrations\/calendar|background-tasks\/email-triage)\.md/,
    timeoutMs: 60_000,
  },
  {
    // Every Martin doc page is fetchable as raw markdown at <page>.md — verified keylessly on
    // the introduction page, which itself points agents at the llms.txt index.
    probeId: 'docs-md-endpoint',
    productId: 'martin',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.trymartin.com/introduction.md | head -8'],
    displayCommand: 'curl -s https://docs.trymartin.com/introduction.md | head -8',
    expect: /# Introduction[\s\S]*personal assistant|Documentation Index[\s\S]*# Introduction/,
    timeoutMs: 60_000,
  },
  {
    // askjo.ai publishes a canonical llms.txt (text/plain) that self-describes the personal
    // agent — surfaces, integrations, per-user cloud-machine architecture, ZDR model routing,
    // and pricing — and tells agents to prefer it over scraping the marketing site. Added at
    // the 2026-09-25 YC X26 coverage-queue bring-up.
    probeId: 'llms-docs-index',
    productId: 'jo',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://askjo.ai/llms.txt | head -4'],
    displayCommand: 'curl -s https://askjo.ai/llms.txt | head -4',
    expect: /# jo[\s\S]*personal agent for real life/,
    timeoutMs: 60_000,
  },
  {
    // jo's backend serves its OpenAPI 3.1 spec keylessly at /openapi.json (FastAPI, with the
    // Swagger UI at /docs) — a machine-readable description of the API surface the apps and
    // bridges drive, fetched without any credential (glama openapi-spec-fetch pattern).
    probeId: 'openapi-spec-fetch',
    productId: 'jo',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://askjo.ai/openapi.json | head -c 160'],
    displayCommand: 'curl -s https://askjo.ai/openapi.json | head -c 160',
    expect: /"openapi":"3\.1/,
    timeoutMs: 60_000,
  },
  // Founder roster expansion (2026-10-01): dots (OpenAI), Grok Bot (xAI), Kimi (Moonshot AI),
  // and Perplexity Computer. Keyless probes only — positives where a real agent surface exists,
  // honest absence proofs where it doesn't (the muse/gemini pattern).
  {
    // learn.chatgpt.com's llms.txt (307 → /docs/llms.txt, text/plain) carries a dedicated
    // "## Dots" section indexing every dots doc page — agent-discoverable docs, keyless.
    probeId: 'llms-docs-index',
    productId: 'dots',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -sL --max-time 20 https://learn.chatgpt.com/llms.txt | grep -i -m 4 -E '## Dots|docs/dots'"],
    displayCommand: "curl -sL https://learn.chatgpt.com/llms.txt | grep -iE '## Dots|docs/dots'",
    expect: /learn\.chatgpt\.com\/docs\/dots(\.md|\/)/,
    timeoutMs: 60_000,
  },
  {
    // Every dots doc page serves raw markdown at the .md URL (the page itself says "Markdown
    // versions of documentation pages are available by appending .md") — fetched keylessly.
    probeId: 'docs-md-endpoint',
    productId: 'dots',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://learn.chatgpt.com/docs/dots.md | head -4'],
    displayCommand: 'curl -s https://learn.chatgpt.com/docs/dots.md | head -4',
    expect: /# Meet dots/,
    timeoutMs: 60_000,
  },
  {
    // docs.x.ai's llms.txt indexes a full grok-bot/*.md docs section (21 pages, every one
    // fetchable as markdown) — Grok Bot's agent-oriented docs surface, verified keylessly.
    probeId: 'llms-docs-index',
    productId: 'grok-bot',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 https://docs.x.ai/llms.txt | grep -m 4 'grok-bot/'"],
    displayCommand: "curl -s https://docs.x.ai/llms.txt | grep 'grok-bot/'",
    expect: /docs\.x\.ai\/grok-bot\/(overview|get-started)\.md/,
    timeoutMs: 60_000,
  },
  {
    // Honest absence proof: the only OpenAPI spec on the docs origin is "xAI's REST API" (the
    // api.x.ai model API — a different product), and it contains ZERO grok-bot paths. No public
    // Grok Bot API surface exists; recorded so the spec's presence can't be misread as one.
    probeId: 'api-surface-absent',
    productId: 'grok-bot',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.x.ai/openapi.json | head -c 120; echo; echo "grok-bot mentions in spec: $(curl -s --max-time 20 https://docs.x.ai/openapi.json | grep -c grok-bot)"'],
    displayCommand: 'curl -s https://docs.x.ai/openapi.json | head -c 120; echo "grok-bot mentions in spec: $(curl -s https://docs.x.ai/openapi.json | grep -c grok-bot)"',
    expect: /"title":"xAI's REST API"[\s\S]*grok-bot mentions in spec: 0/,
    timeoutMs: 60_000,
  },
  {
    // Honest absence proof: kimi.com publishes no llms.txt — the path 302-redirects to the SPA
    // root instead of serving an agent docs index (the assistant app has no docs site at all;
    // platform.kimi.ai/docs is the vendor's separate API-platform product).
    probeId: 'llms-txt-absent',
    productId: 'kimi',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 https://www.kimi.com/llms.txt | grep -i -m 3 -E "^HTTP|^location|^content-type"'],
    displayCommand: 'curl -si https://www.kimi.com/llms.txt | grep -iE "^HTTP|^location|^content-type"',
    expect: /HTTP\/2 302/,
    timeoutMs: 60_000,
  },
  {
    // The vendor's own product-plans doc (fetchable as markdown, keyless) states the Kimi
    // Membership tiers bundle Kimi Code — the official CLI whose docs live at
    // kimi.com/code/docs/en/, which serves keylessly.
    probeId: 'membership-code-cli-docs',
    productId: 'kimi',
    storyIds: ['agentic-official-cli'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 https://platform.kimi.ai/docs/guide/product-plans.md | grep -o -m 1 'Kimi Membership currently includes'; curl -s --max-time 20 'https://www.kimi.com/code/docs/en/' | grep -io -m 2 'kimi code' | head -2"],
    displayCommand: "curl -s https://platform.kimi.ai/docs/guide/product-plans.md | grep -o 'Kimi Membership currently includes'; curl -s https://www.kimi.com/code/docs/en/ | grep -io 'kimi code'",
    expect: /Kimi Membership currently includes[\s\S]*[Kk]imi [Cc]ode/,
    timeoutMs: 60_000,
  },
  {
    // Perplexity Computer's documented MCP endpoint answers a keyless JSON-RPC initialize with
    // a clean structured 401 Bearer/OAuth challenge pointing at its own protected-resource
    // metadata — live proof the hosted MCP server exists and enforces OAuth, no API key involved.
    probeId: 'mcp-endpoint-oauth-401',
    productId: 'perplexity-computer',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -si --max-time 20 -X POST https://www.perplexity.ai/rest/computer/mcp -H \'Content-Type: application/json\' -H \'Accept: application/json, text/event-stream\' -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0.0.1"}}}\' | grep -i -m 3 -E "^HTTP|www-authenticate" | cut -c 1-400'],
    displayCommand: 'curl -si -X POST https://www.perplexity.ai/rest/computer/mcp -H \'Content-Type: application/json\' -d \'{"jsonrpc":"2.0","id":1,"method":"initialize",...}\' | grep -iE "^HTTP|www-authenticate"',
    expect: /HTTP\/2 401[\s\S]*www-authenticate: Bearer/i,
    timeoutMs: 60_000,
  },
  {
    // The endpoint's RFC 9728 OAuth protected-resource metadata is served keylessly at the
    // .well-known path — naming the MCP resource and its authorization server, the discovery
    // document an MCP client uses to connect with a Perplexity account instead of an API key.
    probeId: 'mcp-oauth-resource-metadata',
    productId: 'perplexity-computer',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://www.perplexity.ai/.well-known/oauth-protected-resource/rest/computer/mcp | head -c 300'],
    displayCommand: 'curl -s https://www.perplexity.ai/.well-known/oauth-protected-resource/rest/computer/mcp | head -c 300',
    expect: /"resource":"https:\/\/www\.perplexity\.ai\/rest\/computer\/mcp"/,
    timeoutMs: 60_000,
  },
]
