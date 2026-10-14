import type { LocalProbe } from './types'

// Self-hosted AI assistant runtimes, probed keylessly on the surfaces the founder asked about
// ("openclaw type arena and what it can do"): the OpenClaw install channel (npm openclaw
// 2026.9.5 + the openclaw.ai/install.sh installer), BOTH its llms.txt indexes, its .md docs
// mirrors (nodes/computer-use.md — capability-based desktop control), and ClawHub's keyless
// public skills API (GET /api/v1/search — the registry behind the 5,400+-skill ecosystem).
// The rest of the roster: open-webui and khoj resolve on PyPI, anythingllm and lobe-chat on
// Docker Hub's keyless v2 API, librechat and lobe-chat ship llms.txt + .md docs mirrors, and
// LobeHub serves a keyless /.well-known/mcp discovery document. Honest negatives recorded:
// docs.anythingllm.com and docs.khoj.dev both 404 llms.txt. All keyless, read-only.
export const probes: LocalProbe[] = [
  {
    // OpenClaw resolves on the public npm registry (CalVer 2026.x).
    probeId: 'npm-version',
    productId: 'openclaw',
    storyIds: ['one-command-install', 'agentic-official-cli'],
    bin: 'npm',
    argv: ['npm', 'view', 'openclaw', 'version'],
    displayCommand: 'npm view openclaw version',
    expect: /\d{4}\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // The documented one-command installer is live at the vendor domain.
    probeId: 'installer-script-live',
    productId: 'openclaw',
    storyIds: ['one-command-install'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://openclaw.ai/install.sh'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://openclaw.ai/install.sh',
    expect: /HTTP 200/,
    timeoutMs: 30_000,
  },
  {
    // docs.openclaw.ai serves a full llms.txt docs index (1,300+ lines).
    probeId: 'docs-llms-txt',
    productId: 'openclaw',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.openclaw.ai/llms.txt | head -3'],
    displayCommand: 'curl -s https://docs.openclaw.ai/llms.txt | head -3',
    expect: /# OpenClaw/,
    timeoutMs: 30_000,
  },
  {
    // Every docs page mirrors to clean Markdown at the .md URL — here the computer-use page.
    probeId: 'docs-md-mirror',
    productId: 'openclaw',
    storyIds: ['agentic-agent-docs', 'paired-device-control'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.openclaw.ai/nodes/computer-use.md | head -3'],
    displayCommand: 'curl -s https://docs.openclaw.ai/nodes/computer-use.md | head -3',
    expect: /control of Gateway and paired node desktops/,
    timeoutMs: 30_000,
  },
  {
    // ClawHub's public skills registry answers keyless search (steipete/weather: 170k downloads).
    probeId: 'clawhub-search-api',
    productId: 'openclaw',
    storyIds: ['skills-registry-install', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://clawhub.ai/api/v1/search?q=weather&limit=2' | head -c 200`],
    displayCommand: `curl -s 'https://clawhub.ai/api/v1/search?q=weather&limit=2'`,
    expect: /"results":\[\{"canonicalUrl"/,
    timeoutMs: 30_000,
  },
  {
    // The registry's keyless detail endpoint resolves a published skill by owner+slug
    // (steipete/weather — 170k downloads at recording).
    probeId: 'clawhub-skill-detail',
    productId: 'openclaw',
    storyIds: ['community-ecosystem-scale', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://clawhub.ai/api/v1/skills/weather?owner=steipete' | head -c 200`],
    displayCommand: `curl -s 'https://clawhub.ai/api/v1/skills/weather?owner=steipete'`,
    expect: /"skill":\{"slug":"weather"/,
    timeoutMs: 30_000,
  },
  {
    // Open WebUI resolves on PyPI — `pip install open-webui` is the documented quick start.
    probeId: 'pypi-version',
    productId: 'open-webui',
    storyIds: ['one-command-install'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/open-webui/json | grep -o '"name": *"open-webui"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/open-webui/json | grep '"name"'`,
    expect: /"name": ?"open-webui"/,
    timeoutMs: 30_000,
  },
  {
    // docs.openwebui.com serves a curated llms.txt index (plus llms-full).
    probeId: 'docs-llms-txt',
    productId: 'open-webui',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.openwebui.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://docs.openwebui.com/llms.txt | head -2',
    expect: /# Open WebUI Docs/,
    timeoutMs: 30_000,
  },
  {
    // librechat.ai serves an llms.txt map of the docs.
    probeId: 'site-llms-txt',
    productId: 'librechat',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.librechat.ai/llms.txt | head -2'],
    displayCommand: 'curl -s https://www.librechat.ai/llms.txt | head -2',
    expect: /# LibreChat/,
    timeoutMs: 30_000,
  },
  {
    // The MCP feature docs mirror to Markdown — LibreChat as MCP client is first-party doc.
    probeId: 'docs-md-mirror',
    productId: 'librechat',
    storyIds: ['agentic-agent-docs', 'agentic-mcp-client'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.librechat.ai/docs/features/mcp.md | head -3'],
    displayCommand: 'curl -s https://www.librechat.ai/docs/features/mcp.md | head -3',
    expect: /Model Context Protocol \(MCP\)/,
    timeoutMs: 30_000,
  },
  {
    // AnythingLLM's documented install channel is the Docker Hub image (keyless v2 API).
    probeId: 'dockerhub-image',
    productId: 'anythingllm',
    storyIds: ['one-command-install'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://hub.docker.com/v2/repositories/mintplexlabs/anythingllm/' | grep -o '"name": *"anythingllm"' | head -1`],
    displayCommand: `curl -s 'https://hub.docker.com/v2/repositories/mintplexlabs/anythingllm/' | grep '"name"'`,
    expect: /"name": ?"anythingllm"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: docs.anythingllm.com publishes no llms.txt.
    probeId: 'docs-llms-txt-absent',
    productId: 'anythingllm',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -o /dev/null -w "HTTP %{http_code}" https://docs.anythingllm.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://docs.anythingllm.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Khoj resolves on PyPI — `pip install khoj` is the documented self-host path.
    probeId: 'pypi-version',
    productId: 'khoj',
    storyIds: ['one-command-install'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/khoj/json | grep -o '"name": *"khoj"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/khoj/json | grep '"name"'`,
    expect: /"name": ?"khoj"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: docs.khoj.dev publishes no llms.txt.
    probeId: 'docs-llms-txt-absent',
    productId: 'khoj',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -o /dev/null -w "HTTP %{http_code}" https://docs.khoj.dev/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://docs.khoj.dev/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // lobehub.com's llms.txt opens with an explicit "When to use this site (AI agents)" section.
    probeId: 'site-llms-txt',
    productId: 'lobe-chat',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://lobehub.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://lobehub.com/llms.txt | head -2',
    expect: /# LobeHub/,
    timeoutMs: 30_000,
  },
  {
    // LobeHub serves keyless WebMCP discovery metadata at the well-known path.
    probeId: 'wellknown-mcp-discovery',
    productId: 'lobe-chat',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://lobehub.com/.well-known/mcp | head -c 200'],
    displayCommand: 'curl -s https://lobehub.com/.well-known/mcp',
    expect: /"description":"Use LobeHub/,
    timeoutMs: 30_000,
  },
  {
    // The self-hostable image is on Docker Hub keylessly (6.1M pulls at recording).
    probeId: 'dockerhub-image',
    productId: 'lobe-chat',
    storyIds: ['one-command-install'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://hub.docker.com/v2/repositories/lobehub/lobe-chat/' | grep -o '"name": *"lobe-chat"' | head -1`],
    displayCommand: `curl -s 'https://hub.docker.com/v2/repositories/lobehub/lobe-chat/' | grep '"name"'`,
    expect: /"name": ?"lobe-chat"/,
    timeoutMs: 30_000,
  },
]
