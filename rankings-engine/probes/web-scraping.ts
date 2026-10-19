// Keyless local probes for the web-scraping arena (see ./types.ts for the shape and ./index.ts
// for registration). Every probe is cheap, keyless, and read-only.
import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
  {
    // Riveter publishes its full current-generation OpenAPI 3.2 spec as a raw machine-readable
    // YAML file at a stable docs URL — the exact artifact an agent needs to drive the API.
    probeId: 'openapi-machine-spec',
    productId: 'riveter',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.riveterhq.com/openapi.yaml | head -3'],
    displayCommand: 'curl -s https://docs.riveterhq.com/openapi.yaml | head -3',
    expect: /title: Riveter API/,
    timeoutMs: 30_000,
  },
  {
    // The documented production API (api.riveterhq.com/v1) is live and answers a keyless
    // request with a structured JSON auth challenge — proof the endpoint exists, speaks JSON,
    // and gates access exactly as the spec's ApiKeyAuth (Authorization: Bearer) documents.
    probeId: 'api-keyless-auth-challenge',
    productId: 'riveter',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.riveterhq.com/v1/quick_search',
      '-H', 'Content-Type: application/json',
      '-d', '{"query":"productarena probe"}',
    ],
    displayCommand: `curl -si -X POST https://api.riveterhq.com/v1/quick_search -H 'Content-Type: application/json' -d '{"query":"productarena probe"}'`,
    expect: /"error_type":"unauthorized"/,
    timeoutMs: 30_000,
  },
  {
    // Real pip install of the official Python SDK into a throwaway venv, then an import plus
    // version print — an install AND import roundtrip in one transcript, self-cleaned.
    probeId: 'pip-install-import-roundtrip',
    productId: 'riveter',
    storyIds: ['agentic-sdks'],
    bin: 'uv',
    argv: [
      'sh', '-c',
      `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q riveter-sdk && ./.venv/bin/python -c "from importlib.metadata import version; import riveter; print('PA_PROBE_OK riveter-sdk', version('riveter-sdk'))" ; cd / && rm -rf "$d"`,
    ],
    displayCommand: `mktemp -d && uv venv && uv pip install riveter-sdk && python -c "import riveter; print('PA_PROBE_OK riveter-sdk', version('riveter-sdk'))"`,
    expect: /PA_PROBE_OK riveter-sdk \d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // Context.dev's hosted remote MCP server (mcp.context.dev/mcp, documented at
    // docs.context.dev/install-mcp) draws a keyless 401 with an OAuth protected-resource
    // challenge — live, bearer-gated MCP endpoint.
    probeId: 'mcp-remote-handshake',
    productId: 'context-dev',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.context.dev/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.context.dev/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /resource_metadata="https:\/\/mcp\.context\.dev/,
    timeoutMs: 30_000,
  },
  {
    // The documented production API (api.context.dev/v1, per the OpenAPI spec's servers
    // block) answers a keyless request with a structured Bearer-key challenge (HTTP 401,
    // "No API key provided" + a pointer to the key dashboard).
    probeId: 'api-keyless-auth-challenge',
    productId: 'context-dev',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.context.dev/v1/web/scrape/markdown'],
    displayCommand: 'curl -si https://api.context.dev/v1/web/scrape/markdown',
    expect: /No API key provided/,
    timeoutMs: 30_000,
  },
  {
    // Full OpenAPI 3.1 spec served keyless at a stable URL — the machine-readable
    // contract an agent needs to drive every Context.dev endpoint.
    probeId: 'openapi-machine-spec',
    productId: 'context-dev',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://www.context.dev/openapi.json | head -c 300'],
    displayCommand: 'curl -s https://www.context.dev/openapi.json | head -c 300',
    expect: /"openapi":"3\.1/,
    timeoutMs: 30_000,
  },
]
