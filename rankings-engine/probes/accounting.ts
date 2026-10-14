import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      probeId: 'mcp-remote-handshake',
      productId: 'xero',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.xero.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.xero.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/[12](?:\.1)? 401/,
      timeoutMs: 30_000,
    },
    // --- 2026-09-16 roster expansion (freshbooks/zoho-books/wave/digits/kick/mercury-books/
    // bench). Probes exist only where a live keyless machine surface does: digits (hosted MCP
    // + llms.txt + .md mirrors), kick (GitBook docs MCP + llms.txt + .md mirrors), zoho-books
    // (served OpenAPI zip). freshbooks/wave/mercury-books/bench have no keyless machine
    // surface — the generic probe stage records those absences as negative evidence instead.
    {
      // Digits' hosted MCP (api.digits.com/mcp) auth-gates a keyless initialize with an
      // RFC 9728 www-authenticate resource_metadata challenge — same shape as mcp.xero.com.
      probeId: 'mcp-remote-handshake',
      productId: 'digits',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.digits.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.digits.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-oauth-metadata',
      productId: 'digits',
      storyIds: ['agentic-mcp-server', 'agentic-scoped-keys'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://api.digits.com/.well-known/oauth-protected-resource'],
      displayCommand: 'curl -s https://api.digits.com/.well-known/oauth-protected-resource',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'llms-docs-index',
      productId: 'digits',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://developer.digits.com/llms.txt'],
      displayCommand: 'curl -s https://developer.digits.com/llms.txt',
      expect: /# Digits Connect API Documentation/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'docs-md-endpoint',
      productId: 'digits',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://developer.digits.com/docs/overview.md'],
      displayCommand: 'curl -s https://developer.digits.com/docs/overview.md',
      expect: /Digits Connect API/,
      timeoutMs: 30_000,
    },
    {
      // GitBook publishes a keyless docs-search MCP for docs.kick.co: a bare JSON-RPC
      // initialize completes the handshake (docs surface, not Kick account data).
      probeId: 'mcp-docs-handshake',
      productId: 'kick',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://docs.kick.co/~gitbook/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST 'https://docs.kick.co/~gitbook/mcp' -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"protocolVersion"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'llms-docs-index',
      productId: 'kick',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://docs.kick.co/llms.txt'],
      displayCommand: 'curl -s https://docs.kick.co/llms.txt',
      expect: /# Kick Docs/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'docs-md-endpoint',
      productId: 'kick',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://docs.kick.co/readme.md'],
      displayCommand: 'curl -s https://docs.kick.co/readme.md',
      expect: /self-driving bookkeeping/i,
      timeoutMs: 30_000,
    },
    {
      // The "Download Zoho Books OpenAPI Document" link on the API introduction page serves
      // a real zip of the full OpenAPI corpus.
      probeId: 'openapi-spec-served',
      productId: 'zoho-books',
      storyIds: ['api-machine-spec'],
      bin: 'curl',
      argv: ['curl', '-s', '-I', '--max-time', '20', 'https://www.zoho.com/books/api/v3/openapi-all.zip'],
      displayCommand: 'curl -sI https://www.zoho.com/books/api/v3/openapi-all.zip',
      // .{0,8} tolerates the ANSI bold-reset escape curl emits around header names in a pty.
      expect: /content-type.{0,8}: application\/zip/i,
      timeoutMs: 30_000,
    },
]
