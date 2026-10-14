import type { LocalProbe } from './types'

// Frontier model platforms, probed keylessly on the surfaces the founder asked about (index
// Jev — TypeSafe AI's System One model — in a frontier-models arena): TypeSafe's llms.txt +
// Mintlify .md docs mirrors, its auth-gated API surface (a keyless GET returns a structured
// authentication_error — proof the endpoint is live), and both official SDK registries
// (PyPI typesafe-sdk, npm @typesafe-ai/sdk). The rest of the roster: Anthropic and OpenAI
// serve llms.txt + .md docs mirrors and SDKs on the public registries, Google's Gemini API
// answers keyless calls with a structured PERMISSION_DENIED (and ai.google.dev has no
// llms.txt — recorded negative), Meta's open weights resolve on the keyless Hugging Face API
// (llama.com has no llms.txt — recorded negative), DeepSeek's weights resolve on HF while its
// /llms.txt serves the Docusaurus HTML shell rather than an agent index (recorded as the
// honest soft-404 it is), Mistral serves llms.txt + SDKs + HF weights, and xAI's Grok line
// serves a docs.x.ai llms.txt index with .md mirrors, an auth-gated api.x.ai endpoint (keyless
// GET returns a structured unauthenticated:no-credentials error — proof the endpoint is live),
// and the official xai-sdk on PyPI. All keyless, read-only.
export const probes: LocalProbe[] = [
  {
    // docs.typesafe.ai serves a full llms.txt docs index with .md mirrors for every page.
    probeId: 'docs-llms-txt',
    productId: 'jev',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.typesafe.ai/llms.txt | head -2'],
    displayCommand: 'curl -s https://docs.typesafe.ai/llms.txt | head -2',
    expect: /# TypeSafe AI/,
    timeoutMs: 30_000,
  },
  {
    // Every docs page mirrors to clean Markdown at the .md URL — here the models page, which
    // carries the public per-token price, rate limits, context budgets, and alias policy.
    probeId: 'docs-md-mirror',
    productId: 'jev',
    storyIds: ['agentic-agent-docs', 'transparent-token-pricing'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.typesafe.ai/models.md | head -8'],
    displayCommand: 'curl -s https://docs.typesafe.ai/models.md | head -8',
    expect: /flagship model and the first/,
    timeoutMs: 30_000,
  },
  {
    // The API endpoint is live and auth-gated: a keyless GET /v1/models returns TypeSafe's
    // structured authentication_error JSON, not a WAF page.
    probeId: 'api-auth-gate',
    productId: 'jev',
    storyIds: ['agentic-public-api', 'models-endpoint-discovery'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.typesafe.ai/v1/models | head -c 200'],
    displayCommand: 'curl -s https://api.typesafe.ai/v1/models',
    expect: /authentication_error/,
    timeoutMs: 30_000,
  },
  {
    // The official Python SDK resolves on PyPI (MIT-licensed).
    probeId: 'pypi-version',
    productId: 'jev',
    storyIds: ['agentic-sdks', 'quickstart-first-call'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/typesafe-sdk/json | grep -o '"name": *"typesafe-sdk"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/typesafe-sdk/json | grep '"name"'`,
    expect: /"name": ?"typesafe-sdk"/,
    timeoutMs: 30_000,
  },
  {
    // The official TypeScript SDK resolves on npm.
    probeId: 'npm-version',
    productId: 'jev',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['npm', 'view', '@typesafe-ai/sdk', 'version'],
    displayCommand: 'npm view @typesafe-ai/sdk version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // TypeSafe ships an official drop-in agent skill for Claude Code, Codex, and other agent
    // environments — documented at its own .md mirror.
    probeId: 'agent-skill-doc',
    productId: 'jev',
    storyIds: ['coding-agent-integrations', 'agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.typesafe.ai/agent-skill.md | head -8'],
    displayCommand: 'curl -s https://docs.typesafe.ai/agent-skill.md | head -8',
    expect: /Drop-in skill for Claude Code, Codex/,
    timeoutMs: 30_000,
  },
  {
    // Anthropic's developer docs serve a llms.txt index of the full platform documentation.
    probeId: 'docs-llms-txt',
    productId: 'claude',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.claude.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://docs.claude.com/llms.txt | head -2',
    expect: /# Anthropic Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Every platform docs page mirrors to Markdown at the .md URL — here the models overview.
    probeId: 'docs-md-mirror',
    productId: 'claude',
    storyIds: ['agentic-agent-docs', 'documented-context-window'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://platform.claude.com/docs/en/about-claude/models/overview.md | head -3'],
    displayCommand: 'curl -s https://platform.claude.com/docs/en/about-claude/models/overview.md | head -3',
    expect: /title: Models overview/,
    timeoutMs: 30_000,
  },
  {
    // The official TypeScript SDK resolves on npm.
    probeId: 'npm-version',
    productId: 'claude',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['npm', 'view', '@anthropic-ai/sdk', 'version'],
    displayCommand: 'npm view @anthropic-ai/sdk version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // developers.openai.com serves a llms.txt hub index routing to per-product doc indexes.
    probeId: 'docs-llms-txt',
    productId: 'gpt',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.openai.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://developers.openai.com/llms.txt | head -2',
    expect: /# OpenAI Developers/,
    timeoutMs: 30_000,
  },
  {
    // API docs pages mirror to Markdown at the .md URL — here the models catalog.
    probeId: 'docs-md-mirror',
    productId: 'gpt',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.openai.com/api/docs/models.md | head -2'],
    displayCommand: 'curl -s https://developers.openai.com/api/docs/models.md | head -2',
    expect: /# Models/,
    timeoutMs: 30_000,
  },
  {
    // The official Python SDK resolves on PyPI.
    probeId: 'pypi-version',
    productId: 'gpt',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/openai/json | grep -o '"name": *"openai"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/openai/json | grep '"name"'`,
    expect: /"name": ?"openai"/,
    timeoutMs: 30_000,
  },
  {
    // The Gemini API endpoint is live and auth-gated: a keyless GET /v1beta/models returns
    // Google's structured PERMISSION_DENIED JSON.
    probeId: 'api-auth-gate',
    productId: 'gemini',
    storyIds: ['agentic-public-api', 'models-endpoint-discovery'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://generativelanguage.googleapis.com/v1beta/models | head -c 300'],
    displayCommand: 'curl -s https://generativelanguage.googleapis.com/v1beta/models',
    expect: /PERMISSION_DENIED/,
    timeoutMs: 30_000,
  },
  {
    // The official google-genai Python SDK resolves on PyPI.
    probeId: 'pypi-version',
    productId: 'gemini',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/google-genai/json | grep -o '"name": *"google-genai"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/google-genai/json | grep '"name"'`,
    expect: /"name": ?"google-genai"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: ai.google.dev serves no llms.txt agent index.
    probeId: 'docs-llms-txt-absent',
    productId: 'gemini',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://ai.google.dev/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://ai.google.dev/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Meta's open weights resolve on the keyless Hugging Face API under the meta-llama org.
    probeId: 'hf-org-models',
    productId: 'llama',
    storyIds: ['open-weights-access', 'weights-ecosystem-derivatives'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://huggingface.co/api/models?author=meta-llama&limit=1' | head -c 120`],
    displayCommand: `curl -s 'https://huggingface.co/api/models?author=meta-llama&limit=1'`,
    expect: /"id":"meta-llama\//,
    timeoutMs: 30_000,
  },
  {
    // The canonical llama-models repo documents the model family and licenses.
    probeId: 'models-repo-readme',
    productId: 'llama',
    storyIds: ['open-weights-access'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://raw.githubusercontent.com/meta-llama/llama-models/HEAD/README.md | head -8'],
    displayCommand: 'curl -s https://raw.githubusercontent.com/meta-llama/llama-models/HEAD/README.md | head -8',
    expect: /Llama/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: llama.com serves no llms.txt agent index (301 → 404 after redirects).
    probeId: 'docs-llms-txt-absent',
    productId: 'llama',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.llama.com/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://www.llama.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // DeepSeek's open weights resolve on the keyless Hugging Face API under deepseek-ai.
    probeId: 'hf-org-models',
    productId: 'deepseek',
    storyIds: ['open-weights-access', 'weights-ecosystem-derivatives'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://huggingface.co/api/models?author=deepseek-ai&limit=1' | head -c 120`],
    displayCommand: `curl -s 'https://huggingface.co/api/models?author=deepseek-ai&limit=1'`,
    expect: /"id":"deepseek-ai\//,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: api-docs.deepseek.com/llms.txt answers 200 but serves the Docusaurus
    // HTML docs shell, not an agent-readable index — a soft-404, recorded as such.
    probeId: 'docs-llms-txt-soft404',
    productId: 'deepseek',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://api-docs.deepseek.com/llms.txt | head -c 15'],
    displayCommand: 'curl -s https://api-docs.deepseek.com/llms.txt | head -c 15',
    expect: /<!doctype html/,
    timeoutMs: 30_000,
  },
  {
    // docs.mistral.ai serves a llms.txt docs index.
    probeId: 'docs-llms-txt',
    productId: 'mistral',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.mistral.ai/llms.txt | head -2'],
    displayCommand: 'curl -s https://docs.mistral.ai/llms.txt | head -2',
    expect: /# MistralAI/,
    timeoutMs: 30_000,
  },
  {
    // The official Python SDK resolves on PyPI.
    probeId: 'pypi-version',
    productId: 'mistral',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/mistralai/json | grep -o '"name": *"mistralai"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/mistralai/json | grep '"name"'`,
    expect: /"name": ?"mistralai"/,
    timeoutMs: 30_000,
  },
  {
    // Mistral's open weights resolve on the keyless Hugging Face API under the mistralai org.
    probeId: 'hf-org-models',
    productId: 'mistral',
    storyIds: ['open-weights-access'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://huggingface.co/api/models?author=mistralai&limit=1' | head -c 120`],
    displayCommand: `curl -s 'https://huggingface.co/api/models?author=mistralai&limit=1'`,
    expect: /"id":"mistralai\//,
    timeoutMs: 30_000,
  },
  {
    // docs.x.ai serves a full llms.txt docs index with .md mirrors for every page.
    probeId: 'docs-llms-txt',
    productId: 'grok',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.x.ai/llms.txt | head -2'],
    displayCommand: 'curl -s https://docs.x.ai/llms.txt | head -2',
    expect: /# SpaceXAI API Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Every docs page mirrors to Markdown at the .md URL — here the models catalog, which
    // carries the public per-token price table and per-model context windows.
    probeId: 'docs-md-mirror',
    productId: 'grok',
    storyIds: ['agentic-agent-docs', 'transparent-token-pricing'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.x.ai/developers/models.md | head -12'],
    displayCommand: 'curl -s https://docs.x.ai/developers/models.md | head -12',
    expect: /\| grok-4/,
    timeoutMs: 30_000,
  },
  {
    // The xAI API endpoint is live and auth-gated: a keyless GET /v1/models returns xAI's
    // structured unauthenticated:no-credentials JSON, not a WAF page.
    probeId: 'api-auth-gate',
    productId: 'grok',
    storyIds: ['agentic-public-api', 'models-endpoint-discovery'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.x.ai/v1/models | head -c 200'],
    displayCommand: 'curl -s https://api.x.ai/v1/models',
    expect: /unauthenticated:no-credentials/,
    timeoutMs: 30_000,
  },
  {
    // The official Python SDK resolves on PyPI (Apache-2.0).
    probeId: 'pypi-version',
    productId: 'grok',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/xai-sdk/json | grep -o '"name": *"xai-sdk"' | head -1`],
    displayCommand: `curl -s https://pypi.org/pypi/xai-sdk/json | grep '"name"'`,
    expect: /"name": ?"xai-sdk"/,
    timeoutMs: 30_000,
  },
]
