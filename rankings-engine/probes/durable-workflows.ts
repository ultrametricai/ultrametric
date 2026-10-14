import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

// Durable execution engines: the arena where every vendor ships a real CLI and every vendor
// serves agent-legible docs — all six publish llms.txt, five serve per-page .md mirrors
// (Inngest uses a /docs-markdown/ mirror path instead of a .md suffix). The signature probes
// are real CLI runs from public registries (npx/uvx), live MCP handshakes (Restate's docs MCP
// answers a FULL keyless initialize; Trigger.dev's and DBOS's stdio MCP servers hand-shake
// locally; Temporal's and Inngest's hosted MCPs answer with clean OAuth challenges), and
// keyless API auth challenges. All keyless and read-only.
export const probes: LocalProbe[] = [
  {
    // Temporal's docs serve llms.txt with per-page .md guidance for agents.
    probeId: 'own-docs-llms-txt',
    productId: 'temporal',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.temporal.io/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.temporal.io/llms.txt | head -6',
    expect: /# Temporal Platform Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the core workflows concept page.
    probeId: 'own-docs-md-mirror',
    productId: 'temporal',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.temporal.io/workflows.md | head -8'],
    displayCommand: 'curl -sL https://docs.temporal.io/workflows.md | head -8',
    expect: /# Temporal Workflow/,
    timeoutMs: 30_000,
  },
  {
    // The hosted docs MCP server advertised in Temporal's own llms.txt answers a keyless
    // initialize with its OAuth challenge.
    probeId: 'docs-mcp-authgate',
    productId: 'temporal',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://temporal.mcp.kapa.ai',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://temporal.mcp.kapa.ai -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the docs MCP advertised in Temporal's own llms.txt`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // The official CLI (dev server + client in one binary) prints its version.
    probeId: 'cli-version',
    productId: 'temporal',
    storyIds: ['agentic-official-cli', 'local-dev-testing-loop'],
    bin: 'temporal',
    argv: ['temporal', '--version'],
    displayCommand: 'temporal --version',
    expect: /temporal version \d+\.\d+\.\d+/,
    timeoutMs: 30_000,
  },
  {
    // Inngest's llms.txt leads with its agent-era positioning.
    probeId: 'own-site-llms-txt',
    productId: 'inngest',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://www.inngest.com/llms.txt | head -6'],
    displayCommand: 'curl -s https://www.inngest.com/llms.txt | head -6',
    expect: /durable workflow engine/,
    timeoutMs: 30_000,
  },
  {
    // Markdown mirror of the durable-execution explainer (Inngest serves /docs-markdown/
    // mirrors instead of .md suffixes).
    probeId: 'docs-markdown-mirror',
    productId: 'inngest',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.inngest.com/docs-markdown/learn/how-functions-are-executed | head -8'],
    displayCommand: 'curl -sL https://www.inngest.com/docs-markdown/learn/how-functions-are-executed | head -8',
    expect: /# How Inngest functions are executed/,
    timeoutMs: 30_000,
  },
  {
    // Official CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'inngest',
    storyIds: ['agentic-official-cli', 'local-dev-testing-loop'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y inngest-cli@latest --version 2>&1 | tail -1'],
    displayCommand: 'npx -y inngest-cli@latest --version',
    expect: /inngest version \d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // The hosted Cloud MCP server answers a keyless initialize with its bearer challenge.
    probeId: 'cloud-mcp-authgate',
    productId: 'inngest',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.inngest.com/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://api.inngest.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /realm="inngest-mcp"|invalid_token/,
    timeoutMs: 30_000,
  },
  {
    // The public REST API answers keyless requests with a clean JSON 401.
    probeId: 'api-auth-challenge',
    productId: 'inngest',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.inngest.com/v1/events'],
    displayCommand: 'curl -si https://api.inngest.com/v1/events',
    expect: /"error":\s*"Unauthorized"/,
    timeoutMs: 30_000,
  },
  {
    // Trigger.dev's docs serve llms.txt.
    probeId: 'own-docs-llms-txt',
    productId: 'trigger-dev',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://trigger.dev/docs/llms.txt | head -6'],
    displayCommand: 'curl -s https://trigger.dev/docs/llms.txt | head -6',
    expect: /# Trigger\.dev/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the how-it-works page.
    probeId: 'own-docs-md-mirror',
    productId: 'trigger-dev',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://trigger.dev/docs/how-it-works.md | head -8'],
    displayCommand: 'curl -sL https://trigger.dev/docs/how-it-works.md | head -8',
    expect: /# How Trigger\.dev works/,
    timeoutMs: 30_000,
  },
  {
    // Official CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'trigger-dev',
    storyIds: ['agentic-official-cli', 'local-dev-testing-loop'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y trigger.dev@latest --version 2>&1 | tail -1'],
    displayCommand: 'npx -y trigger.dev@latest --version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // The CLI ships a first-party stdio MCP server: FULL keyless initialize handshake.
    probeId: 'mcp-stdio-handshake',
    productId: 'trigger-dev',
    storyIds: ['agentic-mcp-server'],
    bin: 'npx',
    argv: ['npx', '-y', 'trigger.dev@latest', 'mcp'],
    displayCommand: `echo '<jsonrpc initialize>' | npx -y trigger.dev@latest mcp`,
    stdinPayload: MCP_INITIALIZE,
    expect: /"serverInfo":\{"name":"trigger"/,
    longRunning: true,
    timeoutMs: 240_000,
  },
  {
    // The public management API answers keyless requests with an RFC-7807 problem JSON.
    probeId: 'api-auth-challenge',
    productId: 'trigger-dev',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.trigger.dev/api/v1/projects'],
    displayCommand: 'curl -si https://api.trigger.dev/api/v1/projects',
    expect: /"title":\s*"Unauthorized"/,
    timeoutMs: 30_000,
  },
  {
    // Restate's docs serve llms.txt.
    probeId: 'own-docs-llms-txt',
    productId: 'restate',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.restate.dev/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.restate.dev/llms.txt | head -6',
    expect: /# Restate/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the hosting overview.
    probeId: 'own-docs-md-mirror',
    productId: 'restate',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.restate.dev/hosting/overview.md | head -8'],
    displayCommand: 'curl -s https://docs.restate.dev/hosting/overview.md | head -8',
    expect: /# Choose how to run Restate/,
    timeoutMs: 30_000,
  },
  {
    // Restate's hosted docs MCP answers a FULL keyless initialize handshake — no auth wall.
    probeId: 'docs-mcp-handshake',
    productId: 'restate',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.restate.dev/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
    ],
    displayCommand: `curl -s -X POST https://docs.restate.dev/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # FULL keyless handshake, no auth wall`,
    expect: /"serverInfo":\{"name":"Restate"/,
    timeoutMs: 30_000,
  },
  {
    // Official CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'restate',
    storyIds: ['agentic-official-cli', 'local-dev-testing-loop'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y @restatedev/restate --version 2>&1 | tail -1'],
    displayCommand: 'npx -y @restatedev/restate --version',
    expect: /restate-cli \d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // Hatchet's docs serve llms.txt.
    probeId: 'own-docs-llms-txt',
    productId: 'hatchet',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.hatchet.run/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.hatchet.run/llms.txt | head -6',
    expect: /# Hatchet Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror — on the cookbook for exposing Hatchet tasks as agent/MCP tools.
    probeId: 'own-docs-md-mirror',
    productId: 'hatchet',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.hatchet.run/cookbooks/hatchet-and-mcp.md | head -8'],
    displayCommand: 'curl -sL https://docs.hatchet.run/cookbooks/hatchet-and-mcp.md | head -8',
    expect: /# Hatchet and MCP/,
    timeoutMs: 30_000,
  },
  {
    // The cloud API refuses keyless requests cleanly (403, JSON content-type).
    probeId: 'api-auth-challenge',
    productId: 'hatchet',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -i --max-time 20 https://cloud.onhatchet.run/api/v1/tenants 2>&1 | head -10'],
    displayCommand: 'curl -si https://cloud.onhatchet.run/api/v1/tenants | head -10',
    expect: /403/,
    timeoutMs: 30_000,
  },
  {
    // The Python SDK installs keylessly from PyPI into a throwaway uvx env and imports.
    probeId: 'sdk-uvx-install',
    productId: 'hatchet',
    storyIds: ['agentic-sdks'],
    bin: 'uvx',
    argv: ['sh', '-c', `uvx --from hatchet-sdk python -c 'import importlib.metadata; print("hatchet-sdk", importlib.metadata.version("hatchet-sdk"))' 2>&1 | tail -2`],
    displayCommand: `uvx --from hatchet-sdk python -c 'import importlib.metadata; print("hatchet-sdk", importlib.metadata.version("hatchet-sdk"))'`,
    expect: /hatchet-sdk \d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // The official CLI installer script is real and public.
    probeId: 'cli-installer-script',
    productId: 'hatchet',
    storyIds: ['agentic-official-cli'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -fsSL --max-time 20 https://install.hatchet.run/install.sh | head -8'],
    displayCommand: 'curl -fsSL https://install.hatchet.run/install.sh | head -8',
    expect: /Hatchet CLI Installation Script/,
    timeoutMs: 30_000,
  },
  {
    // DBOS's docs serve llms.txt.
    probeId: 'own-docs-llms-txt',
    productId: 'dbos',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.dbos.dev/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.dbos.dev/llms.txt | head -6',
    expect: /# DBOS Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the architecture page.
    probeId: 'own-docs-md-mirror',
    productId: 'dbos',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.dbos.dev/architecture.md | head -8'],
    displayCommand: 'curl -sL https://docs.dbos.dev/architecture.md | head -8',
    expect: /# DBOS Architecture/,
    timeoutMs: 30_000,
  },
  {
    // The dbos CLI installs keylessly from PyPI into a throwaway uvx env and prints its help.
    probeId: 'cli-help',
    productId: 'dbos',
    storyIds: ['agentic-official-cli', 'local-dev-testing-loop'],
    bin: 'uvx',
    argv: ['sh', '-c', 'uvx --from dbos dbos --help 2>&1 | head -12'],
    displayCommand: 'uvx --from dbos dbos --help | head -12',
    expect: /Usage: dbos \[OPTIONS\] COMMAND/,
    timeoutMs: 240_000,
  },
  {
    // The official Conductor MCP server (uvx dbos-mcp): FULL keyless stdio initialize.
    probeId: 'mcp-stdio-handshake',
    productId: 'dbos',
    storyIds: ['agentic-mcp-server'],
    bin: 'uvx',
    argv: ['uvx', 'dbos-mcp'],
    displayCommand: `echo '<jsonrpc initialize>' | uvx dbos-mcp`,
    stdinPayload: MCP_INITIALIZE,
    expect: /"name":"dbos-conductor"/,
    longRunning: true,
    timeoutMs: 240_000,
  },
  {
    // The Conductor control-plane API publishes a machine-readable OpenAPI 3.1 spec, keyless.
    probeId: 'conductor-openapi',
    productId: 'dbos',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://cloud.dbos.dev/conductor/v2/openapi.json | head -c 400'],
    displayCommand: 'curl -s https://cloud.dbos.dev/conductor/v2/openapi.json | head -c 400',
    expect: /"components":\{"schemas"/,
    timeoutMs: 30_000,
  },
]
