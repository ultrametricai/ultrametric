import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Floot's primary build surface IS a remote MCP server, and it answers a keyless
      // JSON-RPC initialize with a full 200 handshake: serverInfo name "floot" plus build
      // instructions — the strongest possible keyless proof the agent surface is live.
      probeId: 'mcp-remote-handshake',
      productId: 'floot',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '--max-time', '20', '-X', 'POST', 'https://mcp.floot.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -s -X POST https://mcp.floot.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"floot"/,
      timeoutMs: 30_000,
    },
    {
      // MCP discovery manifest at the RFC-style well-known path names the registry entry
      // (com.floot/floot), transport, and OAuth requirement machine-readably.
      probeId: 'mcp-wellknown-manifest',
      productId: 'floot',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://floot.com/.well-known/mcp.json | head -12'],
      displayCommand: 'curl -s https://floot.com/.well-known/mcp.json | head -12',
      expect: /com\.floot\/floot/,
      timeoutMs: 30_000,
    },
    {
      // Curated llms.txt at the site root — Floot's docs are HTML-only (.md 404s), so
      // llms.txt/llms-full.txt is the documented machine-readable docs surface.
      probeId: 'llms-site-index',
      productId: 'floot',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://floot.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://floot.com/llms.txt | head -6',
      expect: /# Floot/,
      timeoutMs: 30_000,
    },
]
