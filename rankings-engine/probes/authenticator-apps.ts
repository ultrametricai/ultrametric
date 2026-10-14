import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

// Authenticator apps, probed keylessly on the surfaces that decide agent-drivability: the
// bw CLI (npm) and official Bitwarden MCP server (stdio initialize handshake completes
// keylessly), 1Password's public no-auth docs MCP at 1password.dev/mcp plus its llms.txt and
// per-page .md mirrors, Ente's brew-packaged export CLI, and 2FAS's remarkably agent-forward
// docs plumbing (llms.txt with a "For AI agents" section, .md page mirrors, a machine-readable
// /.well-known/pricing.md — while its llms.txt explicitly declares "Public API: None").
// Twilio's own docs page carries the Authy API deprecation notice — captured verbatim.
// Google Authenticator and Microsoft Authenticator ship no CLI/API/package surface at all
// (nothing to probe; that absence is judged from crawled docs). All keyless and read-only.
export const probes: LocalProbe[] = [
  {
    // Official bw CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'bitwarden',
    storyIds: ['agentic-official-cli', 'agent-code-retrieval'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y @bitwarden/cli --version 2>&1 | tail -1'],
    displayCommand: 'npx -y @bitwarden/cli --version',
    expect: /\d{4}\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // Official Bitwarden MCP server completes a FULL keyless stdio initialize handshake.
    probeId: 'mcp-stdio-handshake',
    productId: 'bitwarden',
    storyIds: ['agentic-mcp-server'],
    bin: 'npx',
    argv: ['npx', '-y', '@bitwarden/mcp-server'],
    displayCommand: 'echo <jsonrpc initialize> | npx -y @bitwarden/mcp-server',
    stdinPayload: MCP_INITIALIZE,
    expect: /"serverInfo":\{"name":"Bitwarden MCP Server"/,
    longRunning: true,
    timeoutMs: 240_000,
  },
  {
    // Per-page .md mirror on Bitwarden's help site — on the CLI page that documents `bw serve`.
    probeId: 'own-docs-md-mirror',
    productId: 'bitwarden',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://bitwarden.com/help/cli.md | head -4'],
    displayCommand: 'curl -sL https://bitwarden.com/help/cli.md | head -4',
    expect: /# Password Manager CLI/,
    timeoutMs: 30_000,
  },
  {
    // Site-root llms.txt is live on bitwarden.com.
    probeId: 'own-site-llms-txt',
    productId: 'bitwarden',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://bitwarden.com/llms.txt | head -4'],
    displayCommand: 'curl -s https://bitwarden.com/llms.txt | head -4',
    expect: /# Bitwarden/,
    timeoutMs: 30_000,
  },
  {
    // 1Password's developer docs llms.txt (developer.1password.com moved to 1password.dev).
    probeId: 'own-docs-llms-txt',
    productId: '1password',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.1password.dev/llms.txt | head -4'],
    displayCommand: 'curl -sL https://www.1password.dev/llms.txt | head -4',
    expect: /# 1Password Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on the 1Password CLI get-started page.
    probeId: 'own-docs-md-mirror',
    productId: '1password',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.1password.dev/cli/get-started.md | head -8'],
    displayCommand: 'curl -sL https://www.1password.dev/cli/get-started.md | head -8',
    expect: /# Get started with 1Password CLI/,
    timeoutMs: 30_000,
  },
  {
    // 1Password's public docs MCP server answers a FULL keyless initialize handshake
    // ("The server is public and requires no authentication" — its own docs).
    probeId: 'docs-mcp-open-handshake',
    productId: '1password',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://www.1password.dev/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
    ],
    displayCommand: `curl -s -X POST https://www.1password.dev/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # FULL keyless handshake`,
    expect: /"serverInfo":\{"name":"1Password Developer"/,
    timeoutMs: 30_000,
  },
  {
    // Official op CLI is packaged in Homebrew as the 1password-cli cask.
    probeId: 'brew-cli-cask',
    productId: '1password',
    storyIds: ['agentic-official-cli', 'agent-code-retrieval'],
    bin: 'brew',
    argv: ['sh', '-c', 'brew info --json=v2 1password-cli 2>/dev/null | grep -o \'"desc": *"[^"]*"\' | head -1'],
    displayCommand: 'brew info --json=v2 1password-cli | grep desc',
    expect: /Command-line interface for 1Password/,
    timeoutMs: 60_000,
  },
  {
    // Ente's official CLI is packaged in Homebrew — its own description names the Auth
    // export-and-decrypt use case.
    probeId: 'brew-cli-formula',
    productId: 'ente-auth',
    storyIds: ['agentic-official-cli', 'open-format-export'],
    bin: 'brew',
    argv: ['sh', '-c', 'brew info --json=v2 ente-cli 2>/dev/null | grep -o \'"desc": *"[^"]*"\' | head -1'],
    displayCommand: 'brew info --json=v2 ente-cli | grep desc',
    expect: /exporting data from Ente and decrypt the export from Ente Auth/,
    timeoutMs: 60_000,
  },
  {
    // Site-root llms.txt is live on ente.com.
    probeId: 'own-site-llms-txt',
    productId: 'ente-auth',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://ente.com/llms.txt | head -4'],
    displayCommand: 'curl -s https://ente.com/llms.txt | head -4',
    expect: /# Ente/,
    timeoutMs: 30_000,
  },
  {
    // 2FAS's llms.txt — includes a literal "For AI agents" section and honestly declares
    // "Public API: None."
    probeId: 'own-site-llms-txt',
    productId: '2fas',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -A "Mozilla/5.0" https://2fas.com/llms.txt | head -4'],
    displayCommand: 'curl -s https://2fas.com/llms.txt | head -4',
    expect: /# 2FAS/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on 2fas.com (pattern: <path>.md without trailing slash).
    probeId: 'own-docs-md-mirror',
    productId: '2fas',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -A "Mozilla/5.0" https://2fas.com/auth.md | head -2'],
    displayCommand: 'curl -sL https://2fas.com/auth.md | head -2',
    expect: /# 2FAS Auth/,
    timeoutMs: 30_000,
  },
  {
    // Machine-readable pricing at a well-known URL — rare anywhere, unique in this arena.
    probeId: 'pricing-wellknown-md',
    productId: '2fas',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -A "Mozilla/5.0" https://2fas.com/.well-known/pricing.md | head -2'],
    displayCommand: 'curl -sL https://2fas.com/.well-known/pricing.md | head -2',
    expect: /# 2FAS Pricing/,
    timeoutMs: 30_000,
  },
  {
    // Twilio's own docs carry the Authy API deprecation notice — captured verbatim.
    probeId: 'api-deprecation-notice',
    productId: 'authy',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 https://www.twilio.com/docs/authy | grep -o 'The Authy API is now closed to new customers[^<]\\{0,80\\}' | head -1`],
    displayCommand: `curl -sL https://www.twilio.com/docs/authy | grep -o 'The Authy API is now closed to new customers...'`,
    expect: /closed to new customers/,
    timeoutMs: 30_000,
  },
]
