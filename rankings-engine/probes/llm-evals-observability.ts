// Keyless local probes for the llm-evals-observability arena (see ./types.ts for the shape and
// ./index.ts for registration). Every probe is cheap, keyless, and read-only.
import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
  {
    // Cekura's docs publish a full llms.txt index (site summary + per-page .md links).
    probeId: 'llms-docs-index',
    productId: 'cekura',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.cekura.ai/llms.txt | head -6'],
    displayCommand: 'curl -s https://docs.cekura.ai/llms.txt | head -6',
    expect: /# Cekura/,
    timeoutMs: 30_000,
  },
  {
    // Hosted remote MCP server (api.cekura.ai/mcp) is live and auth-gated: a keyless
    // initialize draws the OAuth 401 challenge with protected-resource metadata
    // (blaxel/mem0 precedent).
    probeId: 'mcp-remote-handshake',
    productId: 'cekura',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.cekura.ai/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://api.cekura.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Official CLI (pypi `cekura`, the `[cli]` extra), run keylessly through uvx — help
    // prints the full command surface (agents/scenarios/metrics/run/calls/alerts/...)
    // without an account.
    probeId: 'cli-help',
    productId: 'cekura',
    storyIds: ['agentic-official-cli'],
    bin: 'uvx',
    argv: ['sh', '-c', `uvx --from 'cekura[cli]' cekura --help | cat`],
    displayCommand: `uvx --from 'cekura[cli]' cekura --help`,
    expect: /testing and observability for voice AI agents/,
    timeoutMs: 120_000,
  },
]
