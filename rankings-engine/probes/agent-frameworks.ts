import type { LocalProbe } from './types'

  // The Claude Agent SDK drives the Claude Code CLI as its engine (code.claude.com/docs/en/
  // agent-sdk/overview) — a keyless version print of that engine is the SDK's own runtime proof.
export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'claude-agent-sdk',
      storyIds: ['agentic-official-cli'],
      bin: 'claude',
      argv: ['claude', '--version'],
      displayCommand: 'claude --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
]
