import { CURL_MCP_INIT, type LocalProbe } from './types'

  // Workflow automation: n8n's CLI comes from a scratch npm-prefix install prepended to PATH by
  // the operator (same convention as bun above); zapier-platform-cli v19 renamed its binary to
  // `zapier-platform`. The temporal roundtrip is the arena's signature local proof: boot the
  // dev server headless on a throwaway port + db file, ask the cluster for its health over gRPC,
  // list workflows, tear down — the exact local-dev loop an agent runs, fully self-cleaned.
  // Remote MCP endpoints (Zapier, Make, Pipedream) are probed keylessly: an auth-gated MCP
  // server answers a bare initialize POST with its own auth challenge, proving the endpoint
  // exists and speaks the protocol.
export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'n8n',
      storyIds: ['agentic-official-cli'],
      bin: 'n8n',
      argv: ['n8n', '--version'],
      displayCommand: 'n8n --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 60_000,
    },
    {
      probeId: 'export-workflow-help',
      productId: 'n8n',
      storyIds: ['agentic-headless', 'environments-source-control'],
      bin: 'n8n',
      argv: ['sh', '-c', 'n8n export:workflow --help | cat'],
      displayCommand: 'n8n export:workflow --help',
      expect: /Export all workflows/,
      timeoutMs: 60_000,
    },
    {
      probeId: 'cli-version',
      productId: 'zapier',
      storyIds: ['agentic-official-cli', 'custom-connector-sdk'],
      bin: 'zapier-platform',
      argv: ['zapier-platform', '--version'],
      displayCommand: 'zapier-platform --version',
      expect: /CLI version: \d+\.\d+\.\d+/,
      timeoutMs: 60_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'zapier',
      storyIds: ['agentic-mcp-server', 'workflows-as-mcp-tools'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.zapier.com/api/mcp/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.zapier.com/api/mcp/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /Expected Bearer token for MCP authentication/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-discovery',
      productId: 'make',
      storyIds: ['agentic-mcp-server', 'workflows-as-mcp-tools'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.make.com/.well-known/oauth-protected-resource'],
      displayCommand: 'curl -s https://mcp.make.com/.well-known/oauth-protected-resource',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'temporal',
      storyIds: ['agentic-official-cli'],
      bin: 'temporal',
      argv: ['temporal', '--version'],
      displayCommand: 'temporal --version',
      expect: /temporal version \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Full local-dev roundtrip: headless dev server on a throwaway port + db file, gRPC
      // health check, workflow list, teardown. Self-cleaned.
      probeId: 'dev-server-roundtrip',
      productId: 'temporal',
      storyIds: ['local-dev-instance', 'agentic-headless'],
      bin: 'temporal',
      argv: [
        'sh', '-c',
        'pkill -f "temporal server start-dev" 2>/dev/null; sleep 1; rm -f /tmp/pa-temporal-probe.db; (temporal server start-dev --headless --port 17233 --db-filename /tmp/pa-temporal-probe.db >/dev/null 2>&1 &); n=0; while [ $n -lt 30 ] && ! temporal operator cluster health --address localhost:17233 >/dev/null 2>&1; do sleep 1; n=$((n+1)); done; temporal operator cluster health --address localhost:17233; temporal workflow list --address localhost:17233; pkill -f "temporal server start-dev"; rm -f /tmp/pa-temporal-probe.db',
      ],
      displayCommand: 'temporal server start-dev --headless --port 17233 & temporal operator cluster health --address localhost:17233 && temporal workflow list --address localhost:17233',
      expect: /SERVING/,
      timeoutMs: 90_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'pipedream',
      storyIds: ['agentic-mcp-server', 'workflows-as-mcp-tools'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.pipedream.net',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.pipedream.net -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /external user id is required/,
      timeoutMs: 30_000,
    },
    {
      // Windmill Cloud's public API answers /api/version keyless — the documented OpenAPI
      // surface (app.windmill.dev/openapi.html) is live and reachable by an agent.
      probeId: 'api-version-endpoint',
      productId: 'windmill',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://app.windmill.dev/api/version'],
      displayCommand: 'curl -s https://app.windmill.dev/api/version',
      expect: /v\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Official CLI straight off npm answers --version keyless (npx one-shot install).
      probeId: 'cli-version',
      productId: 'windmill',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'windmill-cli', '--version'],
      displayCommand: 'npx -y windmill-cli --version',
      expect: /CLI version: \d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Docs ship .md mirrors for agents (per llms.txt) — the MCP guide (generate a
      // workspace MCP URL, run flows from Claude/Cursor) round-trips as raw Markdown.
      probeId: 'docs-md-endpoint',
      productId: 'windmill',
      storyIds: ['agentic-agent-docs', 'workflows-as-mcp-tools'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.windmill.dev/docs/core_concepts/mcp.md | head -6'],
      displayCommand: 'curl -s https://www.windmill.dev/docs/core_concepts/mcp.md | head -6',
      expect: /MCP/,
      timeoutMs: 30_000,
    },
    {
      // Gumloop publishes a full llms.txt docs index for agents on the docs origin.
      probeId: 'llms-site-index',
      productId: 'gumloop',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.gumloop.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.gumloop.com/llms.txt | head -6',
      expect: /# Gumloop/,
      timeoutMs: 30_000,
    },
    {
      // Every Gumloop docs page ships a raw-Markdown .md mirror — the MCP connector guide
      // (attach custom MCP servers to agents) round-trips keyless.
      probeId: 'docs-md-endpoint',
      productId: 'gumloop',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.gumloop.com/nodes/mcp/custom_mcp_servers.md | head -8'],
      displayCommand: 'curl -s https://docs.gumloop.com/nodes/mcp/custom_mcp_servers.md | head -8',
      expect: /MCP/,
      timeoutMs: 30_000,
    },
    {
      // Lindy's docs origin publishes an llms.txt index for agents.
      probeId: 'llms-site-index',
      productId: 'lindy',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.lindy.ai/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.lindy.ai/llms.txt | head -6',
      expect: /# Lindy/,
      timeoutMs: 30_000,
    },
    {
      // Lindy docs pages serve raw-Markdown .md mirrors — the hosted-MCP-servers guide
      // (point Lindy at any MCP server, it builds actions from its tools) round-trips keyless.
      probeId: 'docs-md-endpoint',
      productId: 'lindy',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.lindy.ai/integrations/mcp.md | head -8'],
      displayCommand: 'curl -s https://docs.lindy.ai/integrations/mcp.md | head -8',
      expect: /MCP/,
      timeoutMs: 30_000,
    },
    {
      // Activepieces Cloud answers /api/v1/flags keyless — the documented public REST API
      // surface (activepieces.com/docs/endpoints/overview) is live and reachable by an agent.
      probeId: 'api-flags-endpoint',
      productId: 'activepieces',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://cloud.activepieces.com/api/v1/flags | head -c 300'],
      displayCommand: 'curl -s https://cloud.activepieces.com/api/v1/flags | head -c 300',
      expect: /"ENVIRONMENT":"prod"/,
      timeoutMs: 30_000,
    },
    {
      // Activepieces docs ship .md mirrors — the MCP server guide (expose flows/pieces as MCP
      // tools to AI assistants) round-trips as raw Markdown keyless.
      probeId: 'docs-md-endpoint',
      productId: 'activepieces',
      storyIds: ['agentic-agent-docs', 'workflows-as-mcp-tools'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.activepieces.com/docs/mcp/overview.md | head -8'],
      displayCommand: 'curl -s https://www.activepieces.com/docs/mcp/overview.md | head -8',
      expect: /MCP/,
      timeoutMs: 30_000,
    },
    {
      // Official CLI straight off npm answers --version keyless (npx one-shot install) —
      // the same binary that runs `trigger.dev dev`, `deploy`, and `install-mcp`.
      probeId: 'cli-version',
      productId: 'trigger-dev',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'trigger.dev@latest', '--version'],
      displayCommand: 'npx -y trigger.dev@latest --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Trigger.dev docs ship .md mirrors — the MCP server install guide (npx trigger.dev
      // install-mcp wires the MCP server into Claude/Cursor/etc.) round-trips keyless.
      probeId: 'docs-md-endpoint',
      productId: 'trigger-dev',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://trigger.dev/docs/mcp-introduction.md | head -8'],
      displayCommand: 'curl -s https://trigger.dev/docs/mcp-introduction.md | head -8',
      expect: /MCP/,
      timeoutMs: 30_000,
    },
]
