import type { LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // The open skills.sh CLI runs keylessly from npm.
      probeId: 'cli-version',
      productId: 'skills-cli',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'skills', '--version'],
      displayCommand: 'npx -y skills --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Lists a repo's skills (name + trigger description) WITHOUT installing — the
      // review-before-install path, keyless against a public repo.
      probeId: 'registry-list',
      productId: 'skills-cli',
      storyIds: ['browse-searchable-catalog', 'inspect-before-install'],
      bin: 'npx',
      argv: ['npx', '-y', 'skills', 'add', 'vercel-labs/agent-skills', '--list'],
      displayCommand: 'npx -y skills add vercel-labs/agent-skills --list',
      // The pty recording colorizes the count (`Found \x1b[32m9\x1b[39m skills`) — allow ANSI
      // escapes between the words.
      expect: /Found .{0,12}\d+.{0,12} skills/,
      timeoutMs: 180_000,
    },
    {
      // A REAL end-to-end skill install into a scratch project dir: fetches obra/superpowers,
      // copies one skill into ./.claude/skills, then prints the installed SKILL.md frontmatter.
      // Fully keyless and non-interactive (agent-detected).
      probeId: 'scratch-install-roundtrip',
      productId: 'superpowers',
      storyIds: ['one-command-install', 'agent-installs-skill', 'plain-files-portability'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-skill-sp; mkdir -p /tmp/pa-skill-sp; cd /tmp/pa-skill-sp; npx -y skills add obra/superpowers --skill test-driven-development -a claude-code -y --copy; echo "--- installed SKILL.md frontmatter ---"; sed -n 1,4p .claude/skills/test-driven-development/SKILL.md; cd /; rm -rf /tmp/pa-skill-sp',
      ],
      displayCommand: 'npx -y skills add obra/superpowers --skill test-driven-development -a claude-code -y --copy  # in a scratch dir, then print installed SKILL.md frontmatter',
      expect: /name: test-driven-development/,
      timeoutMs: 300_000,
    },
    {
      // Same REAL install roundtrip for the official Anthropic skills repo (skill-creator).
      probeId: 'scratch-install-roundtrip',
      productId: 'anthropic-skills',
      storyIds: ['one-command-install', 'agent-installs-skill', 'selective-install'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-skill-an; mkdir -p /tmp/pa-skill-an; cd /tmp/pa-skill-an; npx -y skills add anthropics/skills --skill skill-creator -a claude-code -y --copy; echo "--- installed SKILL.md frontmatter ---"; sed -n 1,3p .claude/skills/skill-creator/SKILL.md; cd /; rm -rf /tmp/pa-skill-an',
      ],
      displayCommand: 'npx -y skills add anthropics/skills --skill skill-creator -a claude-code -y --copy  # in a scratch dir, then print installed SKILL.md frontmatter',
      expect: /name: skill-creator/,
      timeoutMs: 300_000,
    },
    {
      // Same REAL install roundtrip for mattpocock/skills (tdd) — selective install by name.
      probeId: 'scratch-install-roundtrip',
      productId: 'mattpocock-skills',
      storyIds: ['one-command-install', 'agent-installs-skill', 'selective-install'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-skill-mp; mkdir -p /tmp/pa-skill-mp; cd /tmp/pa-skill-mp; npx -y skills add mattpocock/skills --skill tdd -a claude-code -y --copy; echo "--- installed SKILL.md frontmatter ---"; sed -n 1,3p .claude/skills/tdd/SKILL.md; cd /; rm -rf /tmp/pa-skill-mp',
      ],
      displayCommand: 'npx -y skills add mattpocock/skills --skill tdd -a claude-code -y --copy  # in a scratch dir, then print installed SKILL.md frontmatter',
      expect: /name: tdd/,
      timeoutMs: 300_000,
    },
    {
      // openai/plugins skills install cross-harness: plugin-creator lands in ./.agents/skills
      // (the Codex agent dir) — proving the catalog's skills are plain portable folders.
      probeId: 'scratch-install-roundtrip',
      productId: 'codex-plugins',
      storyIds: ['agent-installs-skill', 'plain-files-portability'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-skill-cx; mkdir -p /tmp/pa-skill-cx; cd /tmp/pa-skill-cx; npx -y skills add openai/plugins --skill plugin-creator -a codex -y --copy; echo "--- installed SKILL.md frontmatter ---"; sed -n 1,3p .agents/skills/plugin-creator/SKILL.md; cd /; rm -rf /tmp/pa-skill-cx',
      ],
      displayCommand: 'npx -y skills add openai/plugins --skill plugin-creator -a codex -y --copy  # in a scratch dir, then print installed SKILL.md frontmatter',
      expect: /name: plugin-creator/,
      timeoutMs: 300_000,
    },
    {
      // Same REAL install roundtrip for garrytan/gstack — the repo publishes ONE router skill
      // ("gstack", the top-level SKILL.md that dispatches to the 23 specialists), and the open
      // skills CLI fetches and installs it keylessly into ./.claude/skills.
      probeId: 'scratch-install-roundtrip',
      productId: 'gstack',
      storyIds: ['one-command-install', 'agent-installs-skill'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-skill-gs; mkdir -p /tmp/pa-skill-gs; cd /tmp/pa-skill-gs; npx -y skills add garrytan/gstack --skill gstack -a claude-code -y --copy; echo "--- installed SKILL.md frontmatter ---"; sed -n 1,5p .claude/skills/gstack/SKILL.md; cd /; rm -rf /tmp/pa-skill-gs',
      ],
      displayCommand: 'npx -y skills add garrytan/gstack --skill gstack -a claude-code -y --copy  # in a scratch dir, then print installed SKILL.md frontmatter',
      expect: /name: gstack/,
      timeoutMs: 300_000,
    },
    {
      // Review-before-install, keyless: every gstack skill is a plain SKILL.md whose full
      // instructions are public — fetch the /review skill's frontmatter straight from the repo.
      probeId: 'skillmd-inspect',
      productId: 'gstack',
      storyIds: ['inspect-before-install', 'plain-files-portability', 'per-skill-documentation'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s https://raw.githubusercontent.com/garrytan/gstack/HEAD/review/SKILL.md | sed -n 1,8p',
      ],
      displayCommand: 'curl -s https://raw.githubusercontent.com/garrytan/gstack/HEAD/review/SKILL.md | sed -n 1,8p',
      expect: /name: review/,
      timeoutMs: 60_000,
    },
    {
      // The Codex marketplace manifest is a public, keyless JSON catalog of curated plugins.
      probeId: 'marketplace-manifest',
      productId: 'codex-plugins',
      storyIds: ['browse-searchable-catalog', 'team-distribution'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s https://raw.githubusercontent.com/openai/plugins/HEAD/.agents/plugins/marketplace.json | head -40',
      ],
      displayCommand: 'curl -s https://raw.githubusercontent.com/openai/plugins/HEAD/.agents/plugins/marketplace.json | head -40',
      expect: /"openai-curated"/,
      timeoutMs: 60_000,
    },
    {
      // Owner product (disclosed on the record): the ultrametric CLI runs keylessly from npm,
      // pinned to the version its docs commit to (docs.ultrametric.ai/cli/install covers 0.4.1).
      probeId: 'cli-version',
      productId: 'ultrametric',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'ultrametric@0.4.1', '--version'],
      displayCommand: 'npx -y ultrametric@0.4.1 --version',
      expect: /0\.4\.1/,
      timeoutMs: 120_000,
    },
    {
      // Review-before-install: `init --dry-run` previews the two SKILL.md installs (Codex's
      // .agents/skills and Claude Code's .claude/skills) without writing, keyless, in a scratch
      // dir so no local login or settings leak in (the docs/SELF-EVAL.md method).
      probeId: 'init-dry-run-preview',
      productId: 'ultrametric',
      storyIds: ['inspect-before-install', 'multi-harness-support'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/um-skill-um; mkdir -p /tmp/um-skill-um/project; cd /tmp/um-skill-um/project; npx -y ultrametric@0.4.1 --data-dir /tmp/um-skill-um/data init --dry-run; cd /; rm -rf /tmp/um-skill-um',
      ],
      displayCommand: 'npx -y ultrametric@0.4.1 init --dry-run  # in a scratch project dir',
      expect: /\.claude\/skills\/ultrametric\/SKILL\.md/,
      timeoutMs: 180_000,
    },
    {
      // A REAL end-to-end install into a scratch project dir: `init` writes the skill for both
      // harnesses, then the installed SKILL.md frontmatter is printed. Keyless, non-interactive.
      probeId: 'scratch-install-roundtrip',
      productId: 'ultrametric',
      storyIds: ['one-command-install', 'agent-installs-skill', 'plain-files-portability'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/um-skill-rt; mkdir -p /tmp/um-skill-rt/project; cd /tmp/um-skill-rt/project; npx -y ultrametric@0.4.1 --data-dir /tmp/um-skill-rt/data init; echo "--- installed SKILL.md frontmatter ---"; sed -n 1,4p .claude/skills/ultrametric/SKILL.md; cd /; rm -rf /tmp/um-skill-rt',
      ],
      displayCommand: 'npx -y ultrametric@0.4.1 init  # in a scratch project dir, then print installed SKILL.md frontmatter',
      expect: /name: ultrametric/,
      timeoutMs: 180_000,
    },
    {
      // The hosted MCP's keyless surface, recorded as the finding: initialize is refused with
      // the documented AUTH_REQUIRED body (the RFC 9728 wall docs/SELF-EVAL.md recorded).
      // `expect` matches the refusal — a PASS here records the wall, it does not credit a
      // keyless handshake.
      probeId: 'mcp-auth-wall',
      productId: 'ultrametric',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -sS -X POST https://api.ultrametric.ai/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"productarena-probe","version":"1.0"}}}\'',
      ],
      displayCommand: 'curl -sS -X POST https://api.ultrametric.ai/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"productarena-probe","version":"1.0"}}}\'',
      expect: /AUTH_REQUIRED/,
      timeoutMs: 60_000,
    },
    {
      // The arena data surface keylessly from any shell — the defect row in docs/SELF-EVAL.md
      // (NETWORK_ERROR on a redirecting data path), re-probed after the worker fix deployed.
      probeId: 'arena-keyless-data',
      productId: 'ultrametric',
      storyIds: ['agentic-headless', 'agentic-public-api'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/um-arena-probe; mkdir -p /tmp/um-arena-probe; npx -y ultrametric@0.4.1 --data-dir /tmp/um-arena-probe arena categories --json | head -c 600; rm -rf /tmp/um-arena-probe',
      ],
      displayCommand: 'npx -y ultrametric@0.4.1 arena categories --json | head -c 600',
      expect: /"id"/,
      timeoutMs: 180_000,
    },
]
