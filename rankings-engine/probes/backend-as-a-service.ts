// Local, keyless probes for the backend-as-a-service arena (see ./types.ts for the contract).
// Created in the 2026-09 hot-repos fairness wave; filled by the supabase evidence pass.
// Every command verified live on 2026-09-15 before adoption.
import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
  {
    // Official Supabase CLI: version prints keylessly (bare semver on stdout).
    probeId: 'cli-version',
    productId: 'supabase',
    storyIds: ['agentic-official-cli'],
    bin: 'npx',
    argv: ['npx', '-y', 'supabase', '--version'],
    displayCommand: 'npx -y supabase --version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 120_000,
  },
  {
    // Hosted Supabase MCP server answers keylessly with its OAuth challenge (RFC 9728 metadata
    // pointer; the metadata publishes the granular per-scope permission model).
    probeId: 'mcp-remote-handshake',
    productId: 'supabase',
    storyIds: ['agentic-mcp-server', 'agent-provisions-backend'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.supabase.com/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.supabase.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Machine-discoverable agent-skills catalog at a well-known URL (agentskills.io discovery
    // spec), keyless — the index `npx skills add supabase/agent-skills` consumes.
    probeId: 'agent-skills-wellknown',
    productId: 'supabase',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['curl', '-s', '--max-time', '20', 'https://supabase.com/.well-known/agent-skills/index.json'],
    displayCommand: 'curl -s https://supabase.com/.well-known/agent-skills/index.json',
    expect: /schemas\.agentskills\.io\/discovery/,
    timeoutMs: 30_000,
  },
]
