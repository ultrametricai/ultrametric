import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Granola's hosted MCP server draws a keyless 401 with MCP OAuth resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'granola',
      storyIds: ['agentic-mcp-server', 'meeting-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.granola.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.granola.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401[\s\S]*oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Fireflies' hosted MCP server draws a keyless 401 with MCP OAuth resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'fireflies',
      storyIds: ['agentic-mcp-server', 'meeting-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.fireflies.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.fireflies.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401[\s\S]*oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Fireflies docs MCP completes a FULL keyless initialize handshake (Mintlify docs MCP).
      probeId: 'docs-mcp-handshake',
      productId: 'fireflies',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://docs.fireflies.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://docs.fireflies.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"result":\{"protocolVersion"/,
      timeoutMs: 30_000,
    },
    {
      // Fireflies GraphQL API answers a keyless query with its documented auth challenge.
      probeId: 'graphql-keyless-auth',
      productId: 'fireflies',
      storyIds: ['agentic-public-api', 'transcripts-via-api'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.fireflies.ai/graphql',
        '-H', 'Content-Type: application/json',
        '-d', '{"query":"{ user { email } }"}',
      ],
      displayCommand: `curl -si -X POST https://api.fireflies.ai/graphql -H 'Content-Type: application/json' -d '{"query":"{ user { email } }"}'`,
      expect: /auth_failed/,
      timeoutMs: 30_000,
    },
    {
      // Otter's hosted MCP server draws a keyless 401 with MCP OAuth resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'otter',
      storyIds: ['agentic-mcp-server', 'meeting-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.otter.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.otter.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401[\s\S]*oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Fathom's hosted MCP server draws a keyless 401 with MCP OAuth resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'fathom',
      storyIds: ['agentic-mcp-server', 'meeting-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.fathom.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.fathom.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401[\s\S]*oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Fathom's documented REST base answers keylessly with 401 plus its documented
      // RateLimit-* headers — live endpoint matching developers.fathom.ai exactly.
      probeId: 'api-keyless-401',
      productId: 'fathom',
      storyIds: ['agentic-public-api', 'transcripts-via-api'],
      bin: 'curl',
      argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.fathom.ai/external/v1/meetings'],
      displayCommand: 'curl -si https://api.fathom.ai/external/v1/meetings',
      expect: /HTTP\/2 401[\s\S]*ratelimit-limit/i,
      timeoutMs: 30_000,
    },
    {
      // Fathom publishes its machine-readable OpenAPI spec at the URL its own llms.txt
      // advertises — fetched keylessly.
      probeId: 'openapi-spec',
      productId: 'fathom',
      storyIds: ['api-machine-spec'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        'curl -s --max-time 30 https://developers.fathom.ai/api-reference/openapi.yaml | head -8',
      ],
      displayCommand: 'curl -s https://developers.fathom.ai/api-reference/openapi.yaml | head -8',
      expect: /openapi: 3\.\d/,
      timeoutMs: 60_000,
    },
    {
      // Fellow's hosted MCP server draws a keyless 401 Bearer challenge at the documented URL.
      probeId: 'mcp-remote-handshake',
      productId: 'fellow',
      storyIds: ['agentic-mcp-server', 'meeting-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://fellow.app/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://fellow.app/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401[\s\S]*Bearer/,
      timeoutMs: 30_000,
    },
]
