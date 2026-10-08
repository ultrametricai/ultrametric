import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'claude-code',
      storyIds: ['agentic-official-cli'],
      bin: 'claude',
      argv: ['claude', '--version'],
      displayCommand: 'claude --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-serve-handshake',
      productId: 'claude-code',
      storyIds: ['agentic-mcp-server'],
      bin: 'claude',
      argv: ['claude', 'mcp', 'serve'],
      displayCommand: `echo '<jsonrpc initialize>' | claude mcp serve`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'codex',
      storyIds: ['agentic-official-cli'],
      bin: 'codex',
      argv: ['codex', '--version'],
      displayCommand: 'codex --version',
      expect: /codex-cli \d/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-server-handshake',
      productId: 'codex',
      storyIds: ['agentic-mcp-server'],
      bin: 'codex',
      argv: ['codex', 'mcp-server'],
      displayCommand: `echo '<jsonrpc initialize>' | codex mcp-server`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 30_000,
    },
    {
      probeId: 'exec-headless-help',
      productId: 'codex',
      storyIds: ['agentic-headless'],
      bin: 'codex',
      argv: ['codex', 'exec', '--help'],
      displayCommand: 'codex exec --help',
      expect: /non-interactively/i,
      timeoutMs: 30_000,
    },
    {
      // cubic's docs publish a full llms.txt index — first line names the product docs.
      probeId: 'llms-docs-index',
      productId: 'cubic',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.cubic.dev/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.cubic.dev/llms.txt | head -6',
      expect: /# cubic documentation/,
      timeoutMs: 30_000,
    },
    {
      // cubic's hosted MCP server (docs warn to use the www host exactly) answers a keyless
      // initialize with its OAuth challenge — protected-resource metadata + scopes in one header.
      probeId: 'mcp-remote-handshake',
      productId: 'cubic',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://www.cubic.dev/api/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://www.cubic.dev/api/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Antigravity publishes a full llms.txt index (products, pricing, and the whole docs
      // tree — subagents, skills, hooks, MCP) — agent-oriented docs verified keylessly.
      // Added at the 2026-09-14 bring-up (LLM-lab families wave).
      probeId: 'llms-docs-index',
      productId: 'antigravity',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://antigravity.google/llms.txt | head -4'],
      displayCommand: 'curl -s https://antigravity.google/llms.txt | head -4',
      expect: /# Google Antigravity[\s\S]*agentic coding platform/,
      timeoutMs: 30_000,
    },
    {
      // Every Antigravity docs page is served as raw markdown at <path>.md (content-type
      // text/markdown) — the docs surface an agent reads without a browser.
      probeId: 'docs-md-endpoint',
      productId: 'antigravity',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --compressed --max-time 20 https://antigravity.google/docs/getting-started.md | head -6'],
      displayCommand: 'curl -s --compressed https://antigravity.google/docs/getting-started.md | head -6',
      expect: /# Getting Started with Antigravity/,
      timeoutMs: 30_000,
    },
    {
      // Random Labs' Slate docs (docs.randomlabs.ai, Mintlify) publish an llms.txt index —
      // first line names the product. The marketing site is an SPA catch-all (every path 200s
      // with the same shell), so the docs SUBDOMAIN is the real agent-readable surface.
      // Added at the 2026-09-14 bring-up (YC S24 coverage-queue wave).
      probeId: 'llms-docs-index',
      productId: 'random-labs',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.randomlabs.ai/llms.txt | head -4'],
      displayCommand: 'curl -s https://docs.randomlabs.ai/llms.txt | head -4',
      expect: /# Slate/,
      timeoutMs: 30_000,
    },
    {
      // Every Slate docs page is served as raw markdown at <path>.md — keyless agent-readable docs.
      probeId: 'docs-md-endpoint',
      productId: 'random-labs',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.randomlabs.ai/en/getting-started/quickstart.md | head -8'],
      displayCommand: 'curl -s https://docs.randomlabs.ai/en/getting-started/quickstart.md | head -8',
      expect: /# Quickstart/,
      timeoutMs: 30_000,
    },
    {
      // The documented install path (npm i -g @randomlabs/slate) resolves to a live public npm
      // package whose bin registers the `slate` CLI — the official CLI exists, proven keylessly
      // from the registry without installing anything.
      probeId: 'npm-cli-package',
      productId: 'random-labs',
      storyIds: ['agentic-official-cli'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.npmjs.org/@randomlabs/slate/latest | head -c 400'],
      displayCommand: 'curl -s https://registry.npmjs.org/@randomlabs/slate/latest | head -c 400',
      expect: /"bin":\{"slate":"bin\/slate"\}/,
      timeoutMs: 30_000,
    },
    {
      // Conductor publishes a full llms.txt site index (changelog.md, /markdown/* mirrors, and
      // the whole docs tree). Added at the 2026-09-14 bring-up (YC S24 coverage-queue wave).
      probeId: 'llms-site-index',
      productId: 'conductor',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.conductor.build/llms.txt | head -4'],
      displayCommand: 'curl -s https://www.conductor.build/llms.txt | head -4',
      expect: /# Conductor[\s\S]*coding agents/,
      timeoutMs: 30_000,
    },
    {
      // Every Conductor docs page is served as raw markdown at <path>.md (content-type
      // text/markdown) — here the hosted-MCP reference page.
      probeId: 'docs-md-endpoint',
      productId: 'conductor',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.conductor.build/docs/api/mcp.md | head -8'],
      displayCommand: 'curl -s https://www.conductor.build/docs/api/mcp.md | head -8',
      expect: /Conductor MCP server/,
      timeoutMs: 30_000,
    },
    {
      // Conductor's hosted MCP server (api.conductor.build/mcp, Streamable HTTP) answers a
      // keyless initialize with its OAuth challenge — 401 + protected-resource metadata and the
      // mcp:tools scope in the www-authenticate header.
      probeId: 'mcp-remote-handshake',
      productId: 'conductor',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.conductor.build/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.conductor.build/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Cursor's docs llms.txt index — sectioned agent-surface tree (Agent, cloud-agents, CLI
      // incl. headless, SDK, API docs); every page mirrors as raw markdown at URL + `.md`.
      // Added in the 2026-09-15 hot-repos fairness wave (cursor exhaustive pass).
      probeId: 'llms-docs-index',
      productId: 'cursor',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://cursor.com/docs/llms.txt | head -4'],
      displayCommand: 'curl -s https://cursor.com/docs/llms.txt | head -4',
      expect: /# Cursor Documentation/,
      timeoutMs: 30_000,
    },
    {
      // The Cloud Agents API v1 ships a downloadable OpenAPI spec — machine-readable schema
      // for the durable-agent + runs surface (docs/cloud-agent/api/endpoints.md links it).
      probeId: 'cloud-agents-openapi',
      productId: 'cursor',
      storyIds: ['api-machine-spec', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://cursor.com/docs-static/cloud-agents-openapi.yaml | head -4'],
      displayCommand: 'curl -s https://cursor.com/docs-static/cloud-agents-openapi.yaml | head -4',
      expect: /title: Cursor Cloud Agents API/,
      timeoutMs: 30_000,
    },
    {
      // api.cursor.com is live and key-gated exactly as docs/api.md documents: a keyless
      // GET /v1/me answers 401 "Invalid User API Key" (Basic/Bearer with user or
      // service-account API keys).
      probeId: 'api-auth-challenge',
      productId: 'cursor',
      storyIds: ['agentic-public-api', 'api-key-auth'],
      bin: 'curl',
      argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.cursor.com/v1/me'],
      displayCommand: 'curl -si https://api.cursor.com/v1/me',
      expect: /Invalid User API Key/,
      timeoutMs: 30_000,
    },
    {
      // ByteAsk publishes a product-site llms.txt (text/plain) that self-describes the C/C++
      // coding agent, install channels, editors, pricing, and data handling — agent-oriented
      // docs verified keylessly. Added at the 2026-09-25 YC F26 coverage-queue bring-up.
      probeId: 'llms-docs-index',
      productId: 'byteask',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://byteask.ai/llms.txt | head -4'],
      displayCommand: 'curl -s https://byteask.ai/llms.txt | head -4',
      expect: /# ByteAsk[\s\S]*AI coding agent for C and C\+\+/,
      timeoutMs: 30_000,
    },
    {
      // The docs subdomain serves its own llms.txt index of the CLI documentation pages
      // (random-labs precedent: the docs host is the agent-readable surface; byteask.ai's
      // /docs/* paths are an SPA shell that 200s unknown pages). Same recorded pattern.
      probeId: 'docs-llms-index',
      productId: 'byteask',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.byteask.ai/llms.txt | head -4'],
      displayCommand: 'curl -s https://docs.byteask.ai/llms.txt | head -4',
      expect: /# ByteAsk Docs[\s\S]*Documentation for ByteAsk/,
      timeoutMs: 30_000,
    },
    {
      // Grok Build's docs are agent-readable keylessly: every docs.x.ai page serves a markdown
      // mirror at the same URL + `.md` (the site's llms.txt documents the convention and
      // indexes the full Grok Build section). Recorded at the 2026-10-08 family-judgement
      // bring-up (byteask/random-labs llms-index precedent, applied to the .md mirror that is
      // the product's own overview page).
      probeId: 'docs-md-mirror',
      productId: 'grok-build',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.x.ai/build/overview.md | head -8'],
      displayCommand: 'curl -s https://docs.x.ai/build/overview.md | head -8',
      expect: /# Grok Build[\s\S]*extensible coding agent/,
      timeoutMs: 30_000,
    },
]
