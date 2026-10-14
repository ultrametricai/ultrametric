// Shared shape and JSON-RPC payloads for the per-arena probe modules in this directory
// (assembled by ./index.ts, executed by pipeline/stages/probe-record.ts).

export interface LocalProbe {
  probeId: string
  productId: string
  storyIds: string[]
  bin: string
  argv: string[]
  /** Rendered as the `$ ...` prompt line and stored as the sidecar `command`. */
  displayCommand: string
  /** JSON-RPC payload piped to stdin for MCP stdio handshakes. */
  stdinPayload?: string
  /** Transcript must match for the probe to pass. */
  expect: RegExp
  /**
   * Servers (e.g. `claude mcp serve`) never exit on their own: the runner terminates them
   * after the handshake window and the sidecar exitCode reports the ASSERTION result
   * (0 = expected handshake observed, 1 = not) instead of a process exit code.
   */
  longRunning?: boolean
  timeoutMs: number
}

export const MCP_INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'productarena-probe', version: '1.0' },
  },
}) + '\n'

// Remote MCP endpoints are probed with a bare curl initialize POST: a live, auth-gated MCP
// server answers with its OAuth challenge (401 + protected-resource metadata), which is
// exactly the keyless, read-only proof that the endpoint exists and speaks the protocol.
export const CURL_MCP_INIT = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'productarena-probe', version: '1.0' },
  },
})
