// Local, keyless probes for the edge-platforms arena (see ./types.ts for the contract).
// Created in the 2026-09 hot-repos fairness wave; filled by the vercel + cloudflare evidence
// pass. Every command verified live on 2026-09-15 before adoption.
import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
  {
    // Official Vercel CLI: version prints keylessly.
    probeId: 'cli-version',
    productId: 'vercel',
    storyIds: ['agentic-official-cli'],
    bin: 'npx',
    argv: ['npx', '-y', 'vercel@latest', '--version'],
    displayCommand: 'npx -y vercel@latest --version',
    expect: /Vercel CLI \d+\.\d+\.\d+/,
    timeoutMs: 120_000,
  },
  {
    // Hosted Vercel MCP server answers keylessly with its OAuth challenge (RFC 9728 metadata).
    probeId: 'mcp-remote-handshake',
    productId: 'vercel',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.vercel.com',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.vercel.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Machine-readable agent resource catalog at a well-known URL, keyless.
    probeId: 'ai-catalog',
    productId: 'vercel',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['curl', '-s', '--max-time', '20', 'https://vercel.com/.well-known/ai-catalog.json'],
    displayCommand: 'curl -s https://vercel.com/.well-known/ai-catalog.json',
    expect: /"specVersion"/,
    timeoutMs: 30_000,
  },
  {
    // Official Workers CLI (wrangler): version prints keylessly.
    probeId: 'cli-version',
    productId: 'cloudflare',
    storyIds: ['agentic-official-cli'],
    bin: 'npx',
    argv: ['npx', '-y', 'wrangler@latest', '--version'],
    displayCommand: 'npx -y wrangler@latest --version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 120_000,
  },
  {
    // The Cloudflare docs MCP server completes a REAL initialize with no credentials at all.
    probeId: 'mcp-docs-keyless-initialize',
    productId: 'cloudflare',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'curl', '-s', '--max-time', '20', '-X', 'POST', 'https://docs.mcp.cloudflare.com/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -s -X POST https://docs.mcp.cloudflare.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /"serverInfo":\{"name":"docs-ai-search"/,
    timeoutMs: 30_000,
  },
  {
    // The account-wide Code Mode MCP server answers keylessly with its OAuth challenge.
    probeId: 'mcp-codemode-handshake',
    productId: 'cloudflare',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.cloudflare.com/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.cloudflare.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
]
