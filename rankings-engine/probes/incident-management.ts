import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // PagerDuty's hosted remote MCP server answers a keyless initialize with its OAuth
      // challenge and protected-resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'pagerduty',
      storyIds: ['agentic-mcp-server', 'agent-acks-escalates-api'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.pagerduty.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.pagerduty.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The Events API v2 ingestion endpoint is live and self-describing: an empty keyless POST
      // returns a structured validation error naming the required routing_key/event_action.
      probeId: 'events-api-live',
      productId: 'pagerduty',
      storyIds: ['agentic-public-api', 'alert-ingest-routing'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s -i --max-time 20 -X POST https://events.pagerduty.com/v2/enqueue -H 'Content-Type: application/json' -d '{}' | sed -n '1p;$p'`,
      ],
      displayCommand: `curl -si -X POST https://events.pagerduty.com/v2/enqueue -H 'Content-Type: application/json' -d '{}'  # live endpoint answers with a structured validation error`,
      expect: /'routing_key' cannot be blank/,
      timeoutMs: 30_000,
    },
    {
      // incident.io's hosted remote MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'incident-io',
      storyIds: ['agentic-mcp-server', 'agent-acks-escalates-api'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.incident.io/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.incident.io/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // incident.io publishes per-tag OpenAPI specs keylessly (linked from docs llms.txt).
      probeId: 'openapi-tag-spec',
      productId: 'incident-io',
      storyIds: ['api-machine-spec', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.incident.io/openapi/tags/incidents-v2.json | head -8'],
      displayCommand: 'curl -s https://docs.incident.io/openapi/tags/incidents-v2.json | head -8',
      expect: /"openapi": "3\./,
      timeoutMs: 30_000,
    },
    {
      // Rootly's hosted remote MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'rootly',
      storyIds: ['agentic-mcp-server', 'agent-acks-escalates-api'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.rootly.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.rootly.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The official rootly-mcp-server installs keylessly from pypi and starts far enough to log
      // its server_start audit event (124 tools, stdio transport) before cleanly gating on
      // ROOTLY_API_TOKEN — the token requirement is itself documented behavior.
      probeId: 'mcp-stdio-start',
      productId: 'rootly',
      storyIds: ['agentic-mcp-server'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `{ printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}'; sleep 12; } | uvx rootly-mcp-server 2>&1 | grep -m 2 -E 'server_start|ROOTLY_API_TOKEN'`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | uvx rootly-mcp-server  # pypi install + server_start audit line, then documented ROOTLY_API_TOKEN gate`,
      expect: /"event_type": "server_start"/,
      timeoutMs: 180_000,
    },
    {
      // FireHydrant's official MCP server (npm) completes a FULL keyless stdio initialize
      // handshake — serverInfo FireHydrant.
      probeId: 'mcp-stdio-handshake',
      productId: 'firehydrant',
      storyIds: ['agentic-mcp-server', 'agent-acks-escalates-api'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        `{ printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}'; sleep 10; } | npx -y firehydrant-mcp start --transport stdio 2>/dev/null | head -1 | cut -c 1-400`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | npx -y firehydrant-mcp start --transport stdio  # full keyless stdio handshake`,
      expect: /"serverInfo":\{"name":"FireHydrant"/,
      timeoutMs: 180_000,
    },
    {
      // Better Stack's documented Uptime API endpoint is live and cleanly auth-gated keylessly.
      probeId: 'api-auth-challenge',
      productId: 'betterstack',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://uptime.betterstack.com/api/v2/monitors | head -4'],
      displayCommand: 'curl -si https://uptime.betterstack.com/api/v2/monitors | head -4',
      expect: /HTTP\/[12](?:\.1)? 401/,
      timeoutMs: 30_000,
    },
]
