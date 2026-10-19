import type { LocalProbe } from './types'

// Payroll: the products live behind the login wall, so the keyless story is the agent-facing
// surface Gusto now ships in the open (contest #61). Gusto's official CLI
// (github.com/Gusto/gusto-cli, Apache-2.0, releases since v0.1.0 2026-07-08) documents a
// one-line keyless install served from cli.gusto.com — a first-party Gusto subdomain that
// 302s to the public gusto-cli-public mirror — and a first-party AGENTS.md at the repo root.
// Both endpoints answer keyless, read-only curls; nothing here installs or authenticates.
export const probes: LocalProbe[] = [
  {
    // The documented install one-liner's endpoint is live on Gusto's own domain: the script
    // head shows the self-updating installer that pulls the notarized binary from the latest
    // GitHub Release and verifies its SHA256.
    probeId: 'cli-install-live',
    productId: 'gusto',
    storyIds: ['agentic-official-cli'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -fsSL --max-time 20 https://cli.gusto.com/install.sh | head -8'],
    displayCommand: 'curl -fsSL https://cli.gusto.com/install.sh | head -8  # the documented CLI install script, live on Gusto’s own domain',
    expect: /GUSTO_CLI_REPO/,
    timeoutMs: 30_000,
  },
  {
    // The repo's first-party AGENTS.md — the agent-facing operating guide the README points
    // agents at — is served keylessly from the default branch.
    probeId: 'agents-md-live',
    productId: 'gusto',
    storyIds: ['agentic-agent-docs', 'agentic-official-cli'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -fsSL --max-time 20 https://raw.githubusercontent.com/Gusto/gusto-cli/main/AGENTS.md | head -4'],
    displayCommand: 'curl -fsSL https://raw.githubusercontent.com/Gusto/gusto-cli/main/AGENTS.md | head -4',
    expect: /Working with the gusto CLI \(for agents\)/,
    timeoutMs: 30_000,
  },
]
