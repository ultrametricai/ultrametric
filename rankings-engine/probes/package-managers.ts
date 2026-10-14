import type { LocalProbe } from './types'

  // Package & toolchain managers: a CLI-native arena, so the probes go beyond version prints —
  // real installs into throwaway mktemp fixtures (self-cleaned; the global stores/caches these
  // populate live under HOME and are the managers' normal operation). nix has a probe entry but
  // is skipped gracefully where the multi-user install isn't present; bun is exercised from a
  // scratch npm-prefix install prepended to PATH by the operator (binAvailable honors PATH).
export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'homebrew',
      storyIds: ['agentic-official-cli'],
      bin: 'brew',
      argv: ['brew', '--version'],
      displayCommand: 'brew --version',
      expect: /Homebrew \d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'info-json-output',
      productId: 'homebrew',
      storyIds: ['machine-readable-cli-output', 'agentic-headless'],
      bin: 'brew',
      argv: ['sh', '-c', 'brew info --json=v2 ca-certificates | head -c 1200'],
      displayCommand: 'brew info --json=v2 ca-certificates | head -c 1200',
      expect: /"formulae"/,
      timeoutMs: 60_000,
    },
    {
      probeId: 'cli-version',
      productId: 'nix',
      storyIds: ['agentic-official-cli'],
      bin: 'nix',
      argv: ['nix', '--version'],
      displayCommand: 'nix --version',
      expect: /nix \(Nix\) \d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'pnpm',
      storyIds: ['agentic-official-cli'],
      bin: 'pnpm',
      argv: ['pnpm', '--version'],
      displayCommand: 'pnpm --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Real install into a throwaway fixture: manifest in, lockfile out — the headless
      // install + reproducible-lockfile loop an agent runs, end to end, self-cleaned.
      probeId: 'install-lockfile-roundtrip',
      productId: 'pnpm',
      storyIds: ['agent-headless-dependency-install', 'lockfile-reproducible-install'],
      bin: 'pnpm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && printf '{"name":"pa-probe-fixture","version":"1.0.0","dependencies":{"is-odd":"3.0.1"}}' > package.json && pnpm install --reporter=append-only && head -3 pnpm-lock.yaml && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && printf '{"dependencies":{"is-odd":"3.0.1"}}' > package.json && pnpm install --reporter=append-only && head -3 pnpm-lock.yaml`,
      expect: /lockfileVersion/,
      timeoutMs: 120_000,
    },
    {
      probeId: 'cli-version',
      productId: 'uv',
      storyIds: ['agentic-official-cli'],
      bin: 'uv',
      argv: ['uv', '--version'],
      displayCommand: 'uv --version',
      expect: /uv \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Real venv + install roundtrip in a throwaway fixture, finishing with --format=json so
      // the transcript shows the machine-readable surface an agent parses. Self-cleaned.
      probeId: 'venv-pip-install-roundtrip',
      productId: 'uv',
      storyIds: ['agent-headless-dependency-install', 'machine-readable-cli-output'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        'd=$(mktemp -d) && cd "$d" && uv venv && uv pip install requests && uv pip list --format=json && rm -rf "$d"',
      ],
      displayCommand: 'mktemp -d && uv venv && uv pip install requests && uv pip list --format=json',
      expect: /"requests"/,
      timeoutMs: 120_000,
    },
    {
      probeId: 'pip-interface-help',
      productId: 'uv',
      storyIds: ['incumbent-interface-compat', 'agentic-official-cli'],
      bin: 'uv',
      argv: ['sh', '-c', 'uv pip install --help | cat'],
      displayCommand: 'uv pip install --help',
      expect: /Install packages into an environment/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'bun',
      storyIds: ['agentic-official-cli'],
      bin: 'bun',
      argv: ['bun', '--version'],
      displayCommand: 'bun --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Real install into a throwaway fixture; bun.lock is text-based JSONC, so the transcript
      // shows the parseable lockfile an agent can read and diff. Self-cleaned.
      probeId: 'install-lockfile-roundtrip',
      productId: 'bun',
      storyIds: ['agent-headless-dependency-install', 'parseable-lockfile-format'],
      bin: 'bun',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && printf '{"name":"pa-probe-fixture","version":"1.0.0","dependencies":{"is-odd":"3.0.1"}}' > package.json && bun install && head -3 bun.lock && bun pm ls && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && printf '{"dependencies":{"is-odd":"3.0.1"}}' > package.json && bun install && head -3 bun.lock && bun pm ls`,
      expect: /lockfileVersion/,
      timeoutMs: 120_000,
    },
    {
      probeId: 'cli-version',
      productId: 'mise',
      storyIds: ['agentic-official-cli'],
      bin: 'mise',
      argv: ['mise', '--version'],
      displayCommand: 'mise --version',
      expect: /\d{4}\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'registry-and-json-ls',
      productId: 'mise',
      storyIds: ['machine-readable-cli-output', 'registry-breadth'],
      bin: 'mise',
      argv: ['sh', '-c', 'mise ls --json; mise registry | head -12'],
      displayCommand: 'mise ls --json && mise registry | head -12',
      expect: /aqua:|vfox:/,
      timeoutMs: 60_000,
    },
]
