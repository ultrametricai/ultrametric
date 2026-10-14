import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Official mem0 CLI (pypi mem0-cli), run keylessly through uvx — help prints the full
      // memory command surface (add/search/get/list/update/delete) without an account.
      probeId: 'cli-help',
      productId: 'mem0',
      storyIds: ['agentic-official-cli'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx --from mem0-cli mem0 --help | cat'],
      displayCommand: 'uvx --from mem0-cli mem0 --help',
      expect: /Memory Layer for AI Agents/,
      timeoutMs: 120_000,
    },
    {
      // OSS SDK is pip-installable and importable with no key: `from mem0 import Memory`.
      probeId: 'sdk-pip-import',
      productId: 'mem0',
      storyIds: ['agentic-sdks', 'self-host-oss-deployment'],
      bin: 'uv',
      argv: [
        'uv', 'run', '--no-project', '--with', 'mem0ai', 'python3', '-c',
        'import mem0; from mem0 import Memory; print("PA_PROBE_OK mem0ai", mem0.__version__)',
      ],
      displayCommand: `uv run --with mem0ai python3 -c 'import mem0; from mem0 import Memory; print("PA_PROBE_OK mem0ai", mem0.__version__)'`,
      expect: /PA_PROBE_OK mem0ai \d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Hosted MCP server answers keylessly with its OAuth challenge + protected-resource
      // metadata — live proof the endpoint exists and gates access (workos precedent).
      probeId: 'mcp-remote-handshake',
      productId: 'mem0',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.mem0.ai/mcp/',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.mem0.ai/mcp/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Zep docs MCP server completes a full keyless initialize handshake (open, no auth).
      probeId: 'docs-mcp-handshake',
      productId: 'zep',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://help.getzep.com/_mcp/server',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://help.getzep.com/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo"/,
      timeoutMs: 30_000,
    },
    {
      // Zep Memory MCP server (api.getzep.com/mcp) is live and IdP-gated: keyless initialize
      // draws the OAuth 401 challenge with protected-resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'zep',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.getzep.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.getzep.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource\/mcp/,
      timeoutMs: 30_000,
    },
    {
      // Graphiti — Zep's open-source temporal-knowledge-graph engine — installs and imports
      // from pypi with no key.
      probeId: 'sdk-pip-import',
      productId: 'zep',
      storyIds: ['agentic-sdks', 'entity-graph-memory'],
      bin: 'uv',
      argv: [
        'uv', 'run', '--no-project', '--with', 'graphiti-core', '--with', 'httpx', 'python3', '-c',
        'import graphiti_core; from graphiti_core import Graphiti; print("PA_PROBE_OK graphiti-core imported")',
      ],
      displayCommand: `uv run --with graphiti-core python3 -c 'from graphiti_core import Graphiti; print("PA_PROBE_OK graphiti-core imported")'`,
      expect: /PA_PROBE_OK graphiti-core imported/,
      timeoutMs: 120_000,
    },
    {
      probeId: 'cli-version',
      productId: 'letta',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', '@letta-ai/letta-code', '--version'],
      displayCommand: 'npx -y @letta-ai/letta-code --version',
      expect: /\d+\.\d+\.\d+ \(Letta Code\)/,
      timeoutMs: 120_000,
    },
    {
      // Keyless local App Server bring-up: `letta server --backend local` boots with no
      // account and prints its listen URLs; the probe captures the startup banner then kills it.
      probeId: 'local-server-keyless-boot',
      productId: 'letta',
      storyIds: ['self-host-oss-deployment', 'agentic-headless'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'pkill -f "letta-code" 2>/dev/null; (npx -y @letta-ai/letta-code server --backend local --listen ws://127.0.0.1:4500 >/tmp/pa-letta-app.log 2>&1 &); n=0; until grep -q "Listening on" /tmp/pa-letta-app.log 2>/dev/null; do n=$((n+1)); [ $n -ge 40 ] && break; sleep 2; done; cat /tmp/pa-letta-app.log; pkill -f "letta-code"; rm -f /tmp/pa-letta-app.log',
      ],
      displayCommand: 'npx -y @letta-ai/letta-code server --backend local --listen ws://127.0.0.1:4500  # keyless boot, then kill',
      expect: /Listening on ws:\/\/127\.0\.0\.1:4500/,
      timeoutMs: 180_000,
    },
    {
      // Hosted MCP server answers keylessly with its OAuth challenge (no API key required
      // by design — sign-in happens in the browser).
      probeId: 'mcp-remote-handshake',
      productId: 'supermemory',
      storyIds: ['agentic-mcp-server', 'assistant-memory-plugins'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.supermemory.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.supermemory.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Published machine-readable OpenAPI spec + live gated v3 API: the spec is keyless,
      // and a keyless POST to /v3/search draws a clean 401 from the live endpoint.
      probeId: 'openapi-and-live-api',
      productId: 'supermemory',
      storyIds: ['api-machine-spec', 'agentic-public-api'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s --max-time 20 https://supermemory.ai/openapi.json | head -c 200; echo; curl -s -i --max-time 20 -X POST https://api.supermemory.ai/v3/search -H "Content-Type: application/json" -d \'{"q":"probe"}\' | head -5',
      ],
      displayCommand: `curl -s https://supermemory.ai/openapi.json | head -c 200 && curl -si -X POST https://api.supermemory.ai/v3/search -d '{"q":"probe"}'`,
      expect: /"openapi"[\s\S]*401/,
      timeoutMs: 45_000,
    },
    {
      // Keyless end-to-end memory roundtrip on the official CLI: `cognee-cli demo` loads a
      // bundled knowledge graph (47 nodes/86 edges) and answers recall queries with no LLM
      // key, then `forget` tears the dataset down.
      probeId: 'cli-demo-roundtrip',
      productId: 'cognee',
      storyIds: ['agentic-official-cli', 'local-embedded-mode'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        'uvx --from cognee cognee-cli demo 2>/dev/null | tail -20; uvx --from cognee cognee-cli forget --dataset demo 2>/dev/null | tail -2',
      ],
      displayCommand: 'uvx --from cognee cognee-cli demo && uvx --from cognee cognee-cli forget --dataset demo',
      expect: /Demo graph loaded into dataset 'demo'/,
      timeoutMs: 300_000,
    },
    {
      // First-party cognee MCP server (pypi cognee-mcp) answers a stdio initialize handshake.
      probeId: 'mcp-stdio-handshake',
      productId: 'cognee',
      storyIds: ['agentic-mcp-server'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx cognee-mcp'],
      displayCommand: `echo '<jsonrpc initialize>' | uvx cognee-mcp`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 300_000,
    },
    {
      // Airweave's docs publish a full llms.txt index (agent instructions + .md links).
      probeId: 'llms-docs-index',
      productId: 'airweave',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.airweave.ai/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.airweave.ai/llms.txt | head -6',
      expect: /# Airweave/,
      timeoutMs: 30_000,
    },
    {
      // Docs serve clean markdown at page URL + .md and advertise the convention in-band.
      probeId: 'docs-md-endpoint',
      productId: 'airweave',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.airweave.ai/quickstart.md | head -6'],
      displayCommand: 'curl -s https://docs.airweave.ai/quickstart.md | head -6',
      expect: /append \.md to the page URL/,
      timeoutMs: 30_000,
    },
]
