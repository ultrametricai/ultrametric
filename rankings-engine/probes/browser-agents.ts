import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

  // Browser automation for agents: the signature keyless proofs are (a) real MCP stdio
  // initialize handshakes against the first-party servers the vendors publish (uvx/npx pulls
  // the published package — an install AND a handshake in one transcript), (b) a full
  // self-host roundtrip for the OSS browser API (docker up → create a live session through the
  // REST API → teardown), and (c) real pip/npm/installer installs into throwaway fixtures.
  // All keyless and self-cleaned; no cloud accounts, no tasks executed against third parties.
export const probes: LocalProbe[] = [
    {
      probeId: 'mcp-stdio-handshake',
      productId: 'browser-use',
      storyIds: ['agentic-mcp-server', 'nl-task-to-completion'],
      bin: 'uvx',
      argv: ['sh', '-c', `uvx --from 'browser-use[cli]' browser-use --mcp`],
      displayCommand: `echo '<jsonrpc initialize>' | uvx --from 'browser-use[cli]' browser-use --mcp`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 240_000,
    },
    {
      probeId: 'pip-install-import-roundtrip',
      productId: 'browser-use',
      storyIds: ['agentic-sdks', 'local-browser-mode'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q browser-use && ./.venv/bin/python -c "from importlib.metadata import version; import browser_use; print('PA_PROBE_OK browser-use', version('browser-use'))" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uv venv && uv pip install browser-use && python -c "import browser_use; print('PA_PROBE_OK browser-use', version('browser-use'))"`,
      expect: /PA_PROBE_OK browser-use \d+\.\d+/,
      timeoutMs: 240_000,
    },
    {
      probeId: 'npm-install-import-roundtrip',
      productId: 'stagehand',
      storyIds: ['agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @browserbasehq/stagehand --no-fund --no-audit --loglevel=error && node -e "import('@browserbasehq/stagehand').then(m=>console.log('PA_PROBE_OK Stagehand export:', typeof m.Stagehand))" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @browserbasehq/stagehand && node -e "import('@browserbasehq/stagehand').then(m=>console.log('PA_PROBE_OK Stagehand export:', typeof m.Stagehand))"`,
      expect: /PA_PROBE_OK Stagehand export: function/,
      timeoutMs: 240_000,
    },
    {
      probeId: 'mcp-stdio-handshake',
      productId: 'stagehand',
      storyIds: ['agentic-mcp-server', 'dom-action-primitives'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y @browserbasehq/mcp'],
      displayCommand: `echo '<jsonrpc initialize>' | npx -y @browserbasehq/mcp`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 180_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'skyvern',
      storyIds: ['agentic-mcp-server', 'hosted-task-api'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.skyvern.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.skyvern.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'pip-install-cli-roundtrip',
      productId: 'skyvern',
      storyIds: ['agentic-sdks', 'agentic-official-cli', 'local-browser-mode'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q skyvern && ./.venv/bin/python -c "from importlib.metadata import version; print('PA_PROBE_OK skyvern', version('skyvern'))" && ./.venv/bin/skyvern --help | head -8 ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uv venv && uv pip install skyvern && skyvern --help`,
      expect: /Manage and run your local Skyvern environment/,
      timeoutMs: 300_000,
    },
    {
      probeId: 'mcp-stdio-handshake',
      productId: 'hyperbrowser',
      storyIds: ['agentic-mcp-server'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y hyperbrowser-mcp'],
      displayCommand: `echo '<jsonrpc initialize>' | npx -y hyperbrowser-mcp`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 180_000,
    },
    {
      probeId: 'npm-install-import-roundtrip',
      productId: 'hyperbrowser',
      storyIds: ['agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @hyperbrowser/sdk --no-fund --no-audit --loglevel=error && node -e "const m=require('@hyperbrowser/sdk'); console.log('PA_PROBE_OK Hyperbrowser export:', typeof m.Hyperbrowser)" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @hyperbrowser/sdk && node -e "console.log('PA_PROBE_OK Hyperbrowser export:', typeof require('@hyperbrowser/sdk').Hyperbrowser)"`,
      expect: /PA_PROBE_OK Hyperbrowser export: function/,
      timeoutMs: 240_000,
    },
    {
      // Full keyless self-host roundtrip for the OSS browser API: boot the official image on a
      // throwaway port, wait for /v1/health, create a LIVE browser session through the REST
      // API, list it back, tear the container down.
      probeId: 'docker-selfhost-session-roundtrip',
      productId: 'steel',
      storyIds: ['openness-self-host', 'agentic-public-api', 'parallel-fleet-scale'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-steel-probe >/dev/null 2>&1; docker run -d --name pa-steel-probe -p 13000:3000 ghcr.io/steel-dev/steel-browser && n=0; while [ $n -lt 60 ] && ! curl -s http://localhost:13000/v1/health >/dev/null 2>&1; do sleep 2; n=$((n+1)); done; curl -s http://localhost:13000/v1/health; echo; curl -s -X POST http://localhost:13000/v1/sessions -H "Content-Type: application/json" -d "{}" | head -c 300; echo; curl -s http://localhost:13000/v1/sessions | head -c 200; echo; docker rm -f pa-steel-probe >/dev/null 2>&1',
      ],
      displayCommand: `docker run -d --name pa-steel-probe -p 13000:3000 ghcr.io/steel-dev/steel-browser && curl localhost:13000/v1/health && curl -X POST localhost:13000/v1/sessions -d '{}' && curl localhost:13000/v1/sessions`,
      expect: /"status":"live"/,
      timeoutMs: 300_000,
    },
    {
      // Official installer into a throwaway HOME (installs to ~/.steel/bin), then a version
      // print — no PATH or shell-profile mutation escapes the fixture.
      probeId: 'cli-install-version',
      productId: 'steel',
      storyIds: ['agentic-official-cli'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `h=$(mktemp -d) && HOME="$h" sh -c 'curl -sSf https://setup.steel.dev | sh -s -- --non-interactive >/dev/null 2>&1; "$HOME/.steel/bin/steel" --version' ; rm -rf "$h"`,
      ],
      displayCommand: `HOME=$(mktemp -d) sh -c 'curl -sSf https://setup.steel.dev | sh -s -- --non-interactive && ~/.steel/bin/steel --version'`,
      expect: /steel \d+\.\d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'npm-install-import-roundtrip',
      productId: 'steel',
      storyIds: ['agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install steel-sdk --no-fund --no-audit --loglevel=error && node -e "const m=require('steel-sdk'); console.log('PA_PROBE_OK Steel export:', typeof m.Steel)" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install steel-sdk && node -e "console.log('PA_PROBE_OK Steel export:', typeof require('steel-sdk').Steel)"`,
      expect: /PA_PROBE_OK Steel export: function/,
      timeoutMs: 240_000,
    },
    {
      // Notte's docs publish a full llms.txt index with explicit agent instructions.
      probeId: 'llms-docs-index',
      productId: 'notte',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.notte.cc/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.notte.cc/llms.txt | head -6',
      expect: /# Notte/,
      timeoutMs: 30_000,
    },
    {
      // Notte's hosted MCP (api.notte.cc/mcp/) answers a keyless initialize with its OAuth
      // challenge + protected-resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'notte',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.notte.cc/mcp/',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.notte.cc/mcp/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Smooth's docs publish a full llms.txt index (every page also served as raw .md) — the
      // agent-consumable docs surface, fetched keyless.
      probeId: 'llms-docs-index',
      productId: 'smooth',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.smooth.sh/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.smooth.sh/llms.txt | head -6',
      expect: /# Smooth/,
      timeoutMs: 30_000,
    },
    {
      // Smooth publishes its complete OpenAPI 3.1 spec at a stable docs URL, declaring the live
      // production server (api.smooth.sh/api/v1) — the machine-readable artifact an agent needs
      // to drive the hosted task API.
      probeId: 'openapi-machine-spec',
      productId: 'smooth',
      storyIds: ['api-machine-spec', 'agentic-public-api', 'hosted-task-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.smooth.sh/api-reference/openapi.json | head -c 200'],
      displayCommand: 'curl -s https://docs.smooth.sh/api-reference/openapi.json | head -c 200',
      expect: /"openapi": "3\.1\.0"/,
      timeoutMs: 30_000,
    },
    {
      // Real pip install of the published SDK into a throwaway venv: version print plus the
      // bundled `smooth` CLI's own help banner ("Browser automation for AI agents") — an
      // install AND a CLI-exists proof in one keyless transcript, self-cleaned.
      probeId: 'pip-install-cli-roundtrip',
      productId: 'smooth',
      storyIds: ['agentic-sdks', 'agentic-official-cli'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q smooth-py && ./.venv/bin/python -c "from importlib.metadata import version; print('PA_PROBE_OK smooth-py', version('smooth-py'))" && ./.venv/bin/smooth --help | head -8 ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uv venv && uv pip install smooth-py && python -c "print('PA_PROBE_OK smooth-py', version('smooth-py'))" && smooth --help`,
      expect: /Browser automation for AI agents/,
      timeoutMs: 300_000,
    },
]
