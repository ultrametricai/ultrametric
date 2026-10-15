import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Official Vapi CLI, installed via the vendor's install.sh into ~/.vapi/bin.
      probeId: 'cli-version',
      productId: 'vapi',
      storyIds: ['agentic-official-cli'],
      bin: 'sh',
      argv: ['sh', '-c', '"$HOME/.vapi/bin/vapi" --version'],
      displayCommand: 'vapi --version  # installed via `curl -sSL https://vapi.ai/install.sh | bash`',
      expect: /vapi version \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Hosted Vapi MCP server draws a keyless 401 — live, bearer-gated endpoint.
      probeId: 'mcp-remote-handshake',
      productId: 'vapi',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.vapi.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.vapi.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'retell',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', '@retell-ai/retell-cli', '--version'],
      displayCommand: 'npx -y @retell-ai/retell-cli --version',
      expect: /retell \d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Retell's hosted MCP server completes a full KEYLESS initialize handshake (tool calls
      // authenticate later with a bearer key) — serverInfo "retell-sdk" comes back openly.
      probeId: 'mcp-remote-handshake',
      productId: 'retell',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.retellai.com',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.retellai.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"retell-sdk"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'elevenlabs-agents',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', '@elevenlabs/cli', '--version'],
      displayCommand: 'npx -y @elevenlabs/cli --version',
      expect: /elevenlabs \d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // ElevenLabs hosted MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'elevenlabs-agents',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.elevenlabs.io/v1/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.elevenlabs.io/v1/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'bland',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'bland-cli', '--version'],
      displayCommand: 'npx -y bland-cli --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Bland's hosted MCP endpoint draws a keyless 401 — live, key-gated.
      probeId: 'mcp-remote-handshake',
      productId: 'bland',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.bland.ai/v1/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.bland.ai/v1/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'livekit-agents',
      storyIds: ['agentic-official-cli'],
      bin: 'lk',
      argv: ['lk', '--version'],
      displayCommand: 'lk --version',
      expect: /lk version \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Keyless self-host: `livekit-server --dev` boots locally with placeholder keys and
      // serves HTTP 200 on :7880; probe polls it then tears down.
      probeId: 'local-server-keyless-boot',
      productId: 'livekit-agents',
      storyIds: ['self-host-oss-runtime', 'openness-self-host'],
      bin: 'livekit-server',
      argv: [
        'sh', '-c',
        'pkill -f "livekit-server --dev" 2>/dev/null; (livekit-server --dev >/tmp/pa-livekit.log 2>&1 &); n=0; until curl -s --max-time 2 http://localhost:7880/ >/dev/null 2>&1; do n=$((n+1)); [ $n -ge 20 ] && break; sleep 1; done; curl -s -i --max-time 5 http://localhost:7880/ | head -2; grep -iE "starting in development mode|placeholder keys|starting LiveKit server" /tmp/pa-livekit.log | head -3; pkill -f "livekit-server --dev"; rm -f /tmp/pa-livekit.log',
      ],
      displayCommand: 'livekit-server --dev  # keyless boot, curl :7880, then kill',
      expect: /HTTP\/1\.1 200 OK/,
      timeoutMs: 90_000,
    },
    {
      // livekit-agents framework installs and imports from pypi with no key.
      probeId: 'sdk-pip-import',
      productId: 'livekit-agents',
      storyIds: ['agentic-sdks'],
      bin: 'uv',
      argv: [
        'uv', 'run', '--no-project', '--with', 'livekit-agents', 'python3', '-c',
        'import livekit.agents as a; print("PA_PROBE_OK livekit-agents", a.__version__)',
      ],
      displayCommand: `uv run --with livekit-agents python3 -c 'import livekit.agents as a; print("PA_PROBE_OK livekit-agents", a.__version__)'`,
      expect: /PA_PROBE_OK livekit-agents \d+\.\d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      // Official Pipecat CLI (pypi pipecat-ai[cli]) runs keylessly via uvx.
      probeId: 'cli-help',
      productId: 'pipecat',
      storyIds: ['agentic-official-cli'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx --from "pipecat-ai[cli]" pipecat --help | cat'],
      displayCommand: 'uvx --from "pipecat-ai[cli]" pipecat --help',
      expect: /Command-line tools for building Pipecat AI applications/,
      timeoutMs: 300_000,
    },
    {
      // pipecat-ai framework installs and imports from pypi with no key.
      probeId: 'sdk-pip-import',
      productId: 'pipecat',
      storyIds: ['agentic-sdks', 'self-host-oss-runtime'],
      bin: 'uv',
      argv: [
        'uv', 'run', '--no-project', '--with', 'pipecat-ai', 'python3', '-c',
        'import pipecat; print("PA_PROBE_OK pipecat-ai imported")',
      ],
      displayCommand: `uv run --with pipecat-ai python3 -c 'import pipecat; print("PA_PROBE_OK pipecat-ai imported")'`,
      expect: /PA_PROBE_OK pipecat-ai imported/,
      timeoutMs: 180_000,
    },
    {
      // Bolna's docs publish a full llms.txt index (bare docs domain redirects; follow it).
      probeId: 'llms-docs-index',
      productId: 'bolna',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.bolna.ai/llms.txt | head -6'],
      displayCommand: 'curl -sL https://docs.bolna.ai/llms.txt | head -6',
      expect: /# Bolna Docs/,
      timeoutMs: 30_000,
    },
    {
      // Bolna's hosted MCP (82 account tools per docs) answers a keyless initialize with a
      // Bearer challenge + protected-resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'bolna',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.bolna.ai/api/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.bolna.ai/api/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // telli's docs publish a full llms.txt index describing the platform, cookbooks, and
      // REST API surface — the agent-readable docs entry point.
      probeId: 'llms-docs-index',
      productId: 'telli',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.telli.com/llms.txt | head -6'],
      displayCommand: 'curl -sL https://docs.telli.com/llms.txt | head -6',
      expect: /# telli Documentation/,
      timeoutMs: 30_000,
    },
    {
      // telli's hosted MCP server (mcp.telli.com/mcp, fronting Charlie) answers a keyless
      // initialize with a Bearer challenge + oauth-protected-resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'telli',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.telli.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.telli.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // telli publishes its V2 OpenAPI spec at a stable keyless docs URL, declaring the live
      // production server (api.telli.com) — the machine-readable artifact an agent needs to
      // drive the contacts/agents API.
      probeId: 'openapi-machine-spec',
      productId: 'telli',
      storyIds: ['api-machine-spec', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.telli.com/openapi-v2.json | head -c 300'],
      displayCommand: 'curl -sL https://docs.telli.com/openapi-v2.json | head -c 300',
      expect: /"title": "telli API"/,
      timeoutMs: 30_000,
    },
    {
      // Deepgram's docs MCP server (developers.deepgram.com/_mcp/server, documented in the
      // llms.txt agent instructions) completes a full KEYLESS initialize handshake — the
      // Fern-hosted docs server answers with serverInfo openly.
      probeId: 'docs-mcp-handshake',
      productId: 'deepgram',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://developers.deepgram.com/_mcp/server',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://developers.deepgram.com/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"fern-docs-mcp-server"/,
      timeoutMs: 30_000,
    },
    {
      // Deepgram's production API answers a keyless request with a structured JSON auth
      // challenge — the documented Token/Bearer gate on api.deepgram.com is live.
      probeId: 'api-keyless-auth-challenge',
      productId: 'deepgram',
      storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
      bin: 'curl',
      argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.deepgram.com/v1/projects'],
      displayCommand: 'curl -si https://api.deepgram.com/v1/projects',
      expect: /"category":"UNAUTHORIZED"/,
      timeoutMs: 30_000,
    },
    {
      // Site-wide llms.txt index with explicit AI-agent instructions (append .md for clean
      // Markdown of any docs page, per-section llms.txt indexes, docs MCP server pointer).
      probeId: 'llms-site-index',
      productId: 'deepgram',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developers.deepgram.com/llms.txt | head -8'],
      displayCommand: 'curl -s https://developers.deepgram.com/llms.txt | head -8',
      expect: /Instructions for AI Agents/,
      timeoutMs: 30_000,
    },
]
