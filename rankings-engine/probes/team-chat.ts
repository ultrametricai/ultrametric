import type { LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Buzz has no docs site or llms.txt — its agent-facing documentation IS the open repo.
      // The raw README is the canonical "what agents can do here" surface (agents as teammates,
      // buzz-cli, ACP harness, git hosting, voice huddles) and is keylessly fetchable.
      probeId: 'oss-readme-agent-docs',
      productId: 'buzz',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/block/buzz/main/README.md | head -20'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/block/buzz/main/README.md | head -20',
      expect: /Buzz/,
      timeoutMs: 30_000,
    },
    {
      // The repo ships a production single-node Docker Compose bundle (Postgres, Redis, MinIO,
      // Caddy TLS) — the self-host story is real, documented, and keylessly verifiable.
      probeId: 'selfhost-compose-docs',
      productId: 'buzz',
      storyIds: ['openness-self-host'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/block/buzz/main/deploy/compose/README.md | head -8'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/block/buzz/main/deploy/compose/README.md | head -8',
      expect: /Docker Compose deployment/,
      timeoutMs: 30_000,
    },
    {
      // Root AGENTS.md (agents.md standard): a vendor-shipped AI-agent contributor guide,
      // keylessly fetchable — found in the 2026-09-15 hot-repos fairness wave.
      probeId: 'agents-md-guide',
      productId: 'buzz',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/block/buzz/main/AGENTS.md | head -3'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/block/buzz/main/AGENTS.md | head -3',
      expect: /AI Agent Contributor Guide/,
      timeoutMs: 30_000,
    },
    {
      // The Desktop-bundled managed-agent skill pack (frontmatter name: buzz-cli) — vendor-shipped
      // agent instructions mirrored into .agents/.claude/.codex/.goose skills dirs.
      probeId: 'managed-skill-pack',
      productId: 'buzz',
      storyIds: ['agentic-agent-docs', 'agentic-nl-commands'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/block/buzz/main/desktop/src-tauri/src/managed_agents/nest_skill.md | head -4'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/block/buzz/main/desktop/src-tauri/src/managed_agents/nest_skill.md | head -4',
      expect: /name: buzz-cli/,
      timeoutMs: 30_000,
    },
    {
      // The documented `helm install oci://ghcr.io/block/buzz/charts/buzz` distribution is live:
      // an anonymous GHCR pull token lists the published chart versions, keylessly.
      probeId: 'helm-oci-tags',
      productId: 'buzz',
      storyIds: ['openness-self-host'],
      bin: 'curl',
      argv: ['sh', '-c', 'TOK=$(curl -s --max-time 20 "https://ghcr.io/token?scope=repository:block/buzz/charts/buzz:pull" | sed -n "s/.*\\"token\\":\\"\\([^\\"]*\\)\\".*/\\1/p"); curl -s --max-time 20 -H "Authorization: Bearer $TOK" https://ghcr.io/v2/block/buzz/charts/buzz/tags/list'],
      displayCommand: 'curl -s -H "Authorization: Bearer $(curl -s \'https://ghcr.io/token?scope=repository:block/buzz/charts/buzz:pull\' | jq -r .token)" https://ghcr.io/v2/block/buzz/charts/buzz/tags/list',
      expect: /"name":"block\/buzz\/charts\/buzz","tags":\["0\.1\.\d+/,
      timeoutMs: 45_000,
    },
    {
      // The LICENSE file at HEAD is the Apache License 2.0 verbatim — open license verified
      // from the source of truth, not a badge.
      probeId: 'open-license-apache2',
      productId: 'buzz',
      storyIds: ['openness-open-license'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/block/buzz/main/LICENSE | head -3'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/block/buzz/main/LICENSE | head -3',
      expect: /Apache License/,
      timeoutMs: 30_000,
    },
    {
      // Zulip publishes no agent-legible docs index on its own origin: zulip.com/llms.txt
      // answers a clean HTTP 404 (verified live 2026-09-23, matching the spike engine's
      // recorded absence for this pass). An honest negative — the absence proof for the
      // agent-docs surface (Zulip's REST/API docs live at zulip.com/api/, human-oriented).
      probeId: 'own-llms-txt-absent',
      productId: 'zulip',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 -o /dev/null -w "llms.txt HTTP %{http_code}\\n" https://zulip.com/llms.txt'],
      displayCommand: 'curl -s -o /dev/null -w "llms.txt HTTP %{http_code}" https://zulip.com/llms.txt',
      expect: /llms\.txt HTTP 404/,
      timeoutMs: 30_000,
    },
]
