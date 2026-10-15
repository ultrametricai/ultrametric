import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Obsidian has no CLI (checked at bring-up), but its community-plugin registry is a
      // public JSON file in the vendor's own obsidian-releases repo — counting it keylessly
      // proves the plugin ecosystem's scale, not just the marketing claim.
      probeId: 'plugin-registry-count',
      productId: 'obsidian',
      storyIds: ['community-plugin-ecosystem'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        `curl -s --max-time 30 https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json | python3 -c 'import json,sys; d=json.load(sys.stdin); print("PA_PROBE_OK obsidian community plugins:", len(d))'`,
      ],
      displayCommand: `curl -s https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json | python3 -c 'import json,sys; print("PA_PROBE_OK obsidian community plugins:", len(json.load(sys.stdin)))'`,
      expect: /PA_PROBE_OK obsidian community plugins: \d{4}/,
      timeoutMs: 60_000,
    },
    {
      // Logseq's plugin marketplace is a public registry repo under the vendor org — one
      // package per directory; counting it keylessly proves marketplace scale.
      probeId: 'marketplace-registry-count',
      productId: 'logseq',
      storyIds: ['community-plugin-ecosystem'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        `curl -s --max-time 30 https://api.github.com/repos/logseq/marketplace/contents/packages | python3 -c 'import json,sys; d=json.load(sys.stdin); print("PA_PROBE_OK logseq marketplace packages:", len(d))'`,
      ],
      displayCommand: `curl -s https://api.github.com/repos/logseq/marketplace/contents/packages | python3 -c 'import json,sys; print("PA_PROBE_OK logseq marketplace packages:", len(json.load(sys.stdin)))'`,
      expect: /PA_PROBE_OK logseq marketplace packages: \d{3}/,
      timeoutMs: 60_000,
    },
    {
      // Official Anytype MCP server (npm @anyproto/anytype-mcp) launches keylessly from npx;
      // without the local Anytype app it prints its startup banner and the API-connection
      // requirement — proof the vendor ships a real MCP server binary that fronts the local API.
      probeId: 'mcp-stdio-launch',
      productId: 'anytype',
      storyIds: ['agentic-mcp-server'],
      bin: 'npx',
      argv: ['npx', '-y', '@anyproto/anytype-mcp'],
      displayCommand: `echo '<jsonrpc initialize>' | npx -y @anyproto/anytype-mcp`,
      stdinPayload: MCP_INITIALIZE,
      expect: /Initializing Anytype MCP Server/,
      longRunning: true,
      timeoutMs: 180_000,
    },
    {
      // The local API's machine-readable OpenAPI spec ships in the vendor's core repo
      // (anytype-heart, the engine every desktop app embeds) — fetched keylessly.
      probeId: 'openapi-spec-in-repo',
      productId: 'anytype',
      storyIds: ['api-machine-spec'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        `curl -s --max-time 30 https://raw.githubusercontent.com/anyproto/anytype-heart/main/core/api/docs/openapi.json | python3 -c 'import json,sys; d=json.load(sys.stdin); print("PA_PROBE_OK anytype openapi:", d.get("openapi", d.get("swagger","spec")), "paths:", len(d.get("paths",{})))'`,
      ],
      displayCommand: `curl -s https://raw.githubusercontent.com/anyproto/anytype-heart/main/core/api/docs/openapi.json | python3 -c 'import json,sys; d=json.load(sys.stdin); print("PA_PROBE_OK anytype openapi:", d.get("openapi"), "paths:", len(d.get("paths",{})))'`,
      expect: /PA_PROBE_OK anytype openapi: .* paths: \d+/,
      timeoutMs: 60_000,
    },
    {
      // Capacities publishes a machine-readable OpenAPI 3.1 spec and the live API answers a
      // keyless request with a clean 401 — spec + live-endpoint pair.
      probeId: 'openapi-and-live-api',
      productId: 'capacities',
      storyIds: ['agentic-public-api', 'api-machine-spec'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        'curl -s --max-time 20 https://api.capacities.io/openapi.json | head -c 200; echo; curl -s -i --max-time 20 https://api.capacities.io/spaces | head -6',
      ],
      displayCommand: 'curl -s https://api.capacities.io/openapi.json | head -c 200; curl -si https://api.capacities.io/spaces | head -6',
      expect: /"openapi":"3\.1\.0"[\s\S]*HTTP\/2 401/,
      timeoutMs: 60_000,
    },
    {
      // Hosted Capacities MCP server draws a keyless 401 with MCP OAuth resource metadata and
      // mcp:read/mcp:write scopes — live, protocol-speaking endpoint.
      probeId: 'mcp-remote-handshake',
      productId: 'capacities',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.capacities.io/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.capacities.io/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401[\s\S]*mcp:read mcp:write/,
      timeoutMs: 30_000,
    },
    {
      // Reflect's documented REST API (base reflect.app/api) answers keyless requests with a
      // clean JSON 401 — the endpoint documented at reflect.academy/api is live.
      probeId: 'api-keyless-401',
      productId: 'reflect',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['curl', '-s', '-i', '--max-time', '20', 'https://reflect.app/api/graphs'],
      displayCommand: 'curl -si https://reflect.app/api/graphs',
      expect: /HTTP\/2 401[\s\S]*Authentication required/,
      timeoutMs: 30_000,
    },
    {
      // Poly publishes an agent-oriented llms.txt docs index (plus llms-full.txt and /raw/*.md
      // mirrors of every page). Added at the 2026-09-14 poly bring-up (design-tools wave
      // disambiguation: withpoly.com 301s to poly.app; the product is a knowledge/file system,
      // not a design tool).
      probeId: 'llms-txt-fetch',
      productId: 'poly',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.poly.app/llms.txt | head -3'],
      displayCommand: 'curl -sL https://docs.poly.app/llms.txt | head -3',
      expect: /# docs\.poly\.app/,
      timeoutMs: 30_000,
    },
    {
      // Poly's hosted MCP server (documented at docs.poly.app/integrations/using-mcp — search,
      // fetch, and a virtual `poly` CLI as MCP tools) answers a keyless JSON-RPC initialize
      // with its OAuth challenge + protected-resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'poly',
      storyIds: ['agentic-mcp-server', 'agent-reads-writes-notes'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.poly.app/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.poly.app/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
]
