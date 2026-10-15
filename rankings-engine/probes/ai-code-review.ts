import { CURL_MCP_INIT, type LocalProbe } from './types'

// AI code review: the reviewers of agent-written code, probed keylessly on the agent surfaces
// they expose themselves — llms.txt indexes and per-page .md mirrors on every vendor's docs,
// JSON-RPC initialize handshakes against their remote MCP servers (Greptile's answers a FULL
// keyless handshake; Qodo's and cubic's answer with clean auth challenges), a bare keyless POST
// against Greptile's public review API, and registry-verified npx installs of the three CLIs
// published to npm (greptile, @withgraphite/graphite-cli, @cubic-dev-ai/cli). CodeRabbit's and
// Qodo's CLIs install via curl|sh only (no registry package), so they get no install probe.
// All keyless and read-only.
export const probes: LocalProbe[] = [
  {
    // CodeRabbit's docs serve a live llms.txt index (headline: Agentic Change Management).
    probeId: 'own-docs-llms-txt',
    productId: 'coderabbit',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.coderabbit.ai/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.coderabbit.ai/llms.txt | head -6',
    expect: /# CodeRabbit/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on CodeRabbit's docs, with an agent-oriented index preamble.
    probeId: 'own-docs-md-mirror',
    productId: 'coderabbit',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.coderabbit.ai/getting-started/quickstart.md | head -12'],
    displayCommand: 'curl -sL https://docs.coderabbit.ai/getting-started/quickstart.md | head -12',
    expect: /# Quickstart/,
    timeoutMs: 30_000,
  },
  {
    // Greptile's docs llms.txt (docs.greptile.com is a dead parked domain — the live docs
    // moved under greptile.com/docs, and the index lives there too).
    probeId: 'own-docs-llms-txt',
    productId: 'greptile',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://www.greptile.com/docs/llms.txt | head -6'],
    displayCommand: 'curl -s https://www.greptile.com/docs/llms.txt | head -6',
    expect: /# Greptile/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on Greptile's docs.
    probeId: 'own-docs-md-mirror',
    productId: 'greptile',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.greptile.com/docs/quickstart.md | head -12'],
    displayCommand: 'curl -sL https://www.greptile.com/docs/quickstart.md | head -12',
    expect: /# 5-Minute Quickstart/,
    timeoutMs: 30_000,
  },
  {
    // Greptile's remote MCP server completes a FULL keyless initialize handshake — HTTP 200
    // with serverInfo and tools capability, no token required for the handshake itself.
    probeId: 'mcp-open-handshake',
    productId: 'greptile',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://api.greptile.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
    ],
    displayCommand: `curl -s -X POST https://api.greptile.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # FULL keyless handshake`,
    expect: /"serverInfo":\{"name":"Greptile MCP Server"/,
    timeoutMs: 30_000,
  },
  {
    // Greptile's public review API is live and cleanly auth-gated keylessly.
    probeId: 'api-auth-challenge',
    productId: 'greptile',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.greptile.com/v2/repositories -H 'Content-Type: application/json' -d '{}' | head -c 200`],
    displayCommand: `curl -s -X POST https://api.greptile.com/v2/repositories -H 'Content-Type: application/json' -d '{}'`,
    expect: /No API key provided/,
    timeoutMs: 30_000,
  },
  {
    // Official greptile CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'greptile',
    storyIds: ['agentic-official-cli', 'cli-local-review'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y greptile --version 2>&1 | tail -1'],
    displayCommand: 'npx -y greptile --version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // Graphite's docs llms.txt (site-root /llms.txt is a soft-404 "Page not found" — the
    // real index lives under /docs, a finding recorded honestly).
    probeId: 'own-docs-llms-txt',
    productId: 'graphite',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://graphite.com/docs/llms.txt | head -6'],
    displayCommand: 'curl -s https://graphite.com/docs/llms.txt | head -6',
    expect: /# Graphite/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on Graphite's docs — on the AI-reviews page itself.
    probeId: 'own-docs-md-mirror',
    productId: 'graphite',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://graphite.com/docs/ai-reviews.md | head -12'],
    displayCommand: 'curl -sL https://graphite.com/docs/ai-reviews.md | head -12',
    expect: /# AI Reviews/,
    timeoutMs: 30_000,
  },
  {
    // Official Graphite CLI (gt) installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'graphite',
    storyIds: ['agentic-official-cli', 'cli-local-review'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y @withgraphite/graphite-cli --version 2>&1 | tail -1'],
    displayCommand: 'npx -y @withgraphite/graphite-cli --version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // Qodo's docs serve llms.txt ("Qodo is an AI code review and governance platform...").
    probeId: 'own-docs-llms-txt',
    productId: 'qodo',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.qodo.ai/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.qodo.ai/llms.txt | head -6',
    expect: /# Qodo/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on Qodo's docs — the code-review overview page.
    probeId: 'own-docs-md-mirror',
    productId: 'qodo',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.qodo.ai/code-review/overview.md | head -12'],
    displayCommand: 'curl -sL https://docs.qodo.ai/code-review/overview.md | head -12',
    expect: /# How Qodo code review works/,
    timeoutMs: 30_000,
  },
  {
    // Qodo's hosted MCP gateway answers a keyless initialize with a clean Bearer challenge.
    probeId: 'mcp-authgate',
    productId: 'qodo',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://sdk.qodo.ai/v1/tools/mcp/',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://sdk.qodo.ai/v1/tools/mcp/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /MT-AUTH-MISSING/,
    timeoutMs: 30_000,
  },
  {
    // Cursor's docs serve llms.txt with .md links for every page, Bugbot's included.
    probeId: 'own-docs-llms-txt',
    productId: 'cursor-bugbot',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://cursor.com/llms.txt | head -6'],
    displayCommand: 'curl -s https://cursor.com/llms.txt | head -6',
    expect: /# Cursor Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the Bugbot docs page itself.
    probeId: 'own-docs-md-mirror',
    productId: 'cursor-bugbot',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://cursor.com/docs/bugbot.md | head -6'],
    displayCommand: 'curl -sL https://cursor.com/docs/bugbot.md | head -6',
    expect: /# Bugbot/,
    timeoutMs: 30_000,
  },
  {
    // cubic's docs serve llms.txt.
    probeId: 'own-docs-llms-txt',
    productId: 'cubic',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.cubic.dev/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.cubic.dev/llms.txt | head -6',
    expect: /# cubic documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on cubic's docs.
    probeId: 'own-docs-md-mirror',
    productId: 'cubic',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.cubic.dev/ai-review/quickstart.md | head -12'],
    displayCommand: 'curl -sL https://docs.cubic.dev/ai-review/quickstart.md | head -12',
    expect: /# Developer quickstart/,
    timeoutMs: 30_000,
  },
  {
    // cubic's remote MCP server answers a keyless initialize with its OAuth challenge
    // (response filtered to the status + auth header — the page's CSP header is enormous).
    probeId: 'mcp-authgate',
    productId: 'cubic',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s -i --max-time 20 -X POST https://www.cubic.dev/api/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -iE '^HTTP|^www-authenticate'`,
    ],
    displayCommand: `curl -si -X POST https://www.cubic.dev/api/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>' | grep -iE '^HTTP|^www-authenticate'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Official cubic CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'cubic',
    storyIds: ['agentic-official-cli', 'cli-local-review'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y @cubic-dev-ai/cli --version 2>&1 | tail -1'],
    displayCommand: 'npx -y @cubic-dev-ai/cli --version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
]
