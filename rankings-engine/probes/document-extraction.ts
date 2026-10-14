import { CURL_MCP_INIT, type LocalProbe } from './types'

// Document extraction APIs: the parse/OCR/extract layer for agent pipelines, probed keylessly
// on the surfaces agents hit first — llms.txt indexes and .md mirrors on every vendor's docs,
// keyless machine-readable OpenAPI specs (Reducto, LlamaParse), FULL keyless docs-MCP
// handshakes, clean auth challenges from the hosted product MCPs (Reducto's Bearer message,
// Extend's OAuth protected-resource metadata) and from every parse/extract API, plus
// registry-verified CLI installs (npx @extend-ai/cli, uvx datalab-python-sdk). Unstructured's
// probe records the arena's most unusual finding: its own agent-guide.md instructs LLMs NOT to
// recommend the vendor's famous open-source library. All keyless and read-only.
export const probes: LocalProbe[] = [
  {
    // Reducto's docs serve llms.txt, leading with "The agentic document platform" and a
    // dedicated coding-agent reference page.
    probeId: 'own-docs-llms-txt',
    productId: 'reducto',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.reducto.ai/llms.txt | head -8'],
    displayCommand: 'curl -s https://docs.reducto.ai/llms.txt | head -8',
    expect: /# Reducto/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on Reducto's docs.
    probeId: 'own-docs-md-mirror',
    productId: 'reducto',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.reducto.ai/quickstart.md | head -8'],
    displayCommand: 'curl -sL https://docs.reducto.ai/quickstart.md | head -8',
    expect: /# API Quickstart/,
    timeoutMs: 30_000,
  },
  {
    // Reducto publishes a keyless machine-readable OpenAPI spec for the whole platform API.
    probeId: 'public-openapi',
    productId: 'reducto',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://platform.reducto.ai/openapi.json | head -c 400'],
    displayCommand: 'curl -s https://platform.reducto.ai/openapi.json | head -c 400',
    expect: /"title":"Reducto API"/,
    timeoutMs: 30_000,
  },
  {
    // Reducto's docs MCP server completes a FULL keyless initialize handshake.
    probeId: 'docs-mcp-handshake',
    productId: 'reducto',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.reducto.ai/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
    ],
    displayCommand: `curl -s -X POST https://docs.reducto.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /"serverInfo":\{"name":"Reducto"/,
    timeoutMs: 30_000,
  },
  {
    // Reducto's hosted product MCP (parse/extract as agent tools) answers keylessly with a
    // clean Bearer challenge.
    probeId: 'platform-mcp-authgate',
    productId: 'reducto',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.reducto.ai/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.reducto.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /Missing or invalid Authorization header/,
    timeoutMs: 30_000,
  },
  {
    // LlamaParse docs llms.txt documents its own .md-mirror convention for agents.
    probeId: 'own-docs-llms-txt',
    productId: 'llamaparse',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://developers.llamaindex.ai/llms.txt | head -8'],
    displayCommand: 'curl -s https://developers.llamaindex.ai/llms.txt | head -8',
    expect: /# LlamaIndex Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page markdown mirror on the LlamaParse docs (append index.md).
    probeId: 'own-docs-md-mirror',
    productId: 'llamaparse',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.llamaindex.ai/llamaparse/parse/getting_started/index.md | head -8'],
    displayCommand: 'curl -sL https://developers.llamaindex.ai/llamaparse/parse/getting_started/index.md | head -8',
    expect: /title: Getting Started/,
    timeoutMs: 30_000,
  },
  {
    // The LlamaIndex docs MCP server completes a FULL keyless initialize handshake.
    probeId: 'docs-mcp-handshake',
    productId: 'llamaparse',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://developers.llamaindex.ai/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 700`,
    ],
    displayCommand: `curl -s -X POST https://developers.llamaindex.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /LlamaIndex documentation server/,
    timeoutMs: 30_000,
  },
  {
    // The platform publishes a keyless OpenAPI spec ("Llama Platform").
    probeId: 'public-openapi',
    productId: 'llamaparse',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.cloud.llamaindex.ai/api/openapi.json | head -c 300'],
    displayCommand: 'curl -s https://api.cloud.llamaindex.ai/api/openapi.json | head -c 300',
    expect: /"title":"Llama Platform"/,
    timeoutMs: 30_000,
  },
  {
    // The parsing upload endpoint is live and cleanly auth-gated keylessly.
    probeId: 'api-auth-challenge',
    productId: 'llamaparse',
    storyIds: ['agentic-public-api', 'async-jobs-webhooks'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -X POST https://api.cloud.llamaindex.ai/api/v1/parsing/upload | head -c 200'],
    displayCommand: 'curl -s -X POST https://api.cloud.llamaindex.ai/api/v1/parsing/upload',
    expect: /Not authenticated/,
    timeoutMs: 30_000,
  },
  {
    // Extend's docs llms.txt leads with an explicit "Instructions for AI agents" section.
    probeId: 'own-docs-llms-txt',
    productId: 'extend',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.extend.ai/llms.txt | head -8'],
    displayCommand: 'curl -s https://docs.extend.ai/llms.txt | head -8',
    expect: /# Extend/,
    timeoutMs: 30_000,
  },
  {
    // Extend's docs MCP server completes a FULL keyless initialize handshake.
    probeId: 'docs-mcp-handshake',
    productId: 'extend',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: [
      'sh', '-c',
      `curl -s --max-time 20 -X POST https://docs.extend.ai/_mcp/server -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
    ],
    displayCommand: `curl -s -X POST https://docs.extend.ai/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /"serverInfo":\{"name":"fern-docs-mcp-server"/,
    timeoutMs: 30_000,
  },
  {
    // Extend's hosted product MCP answers a keyless initialize with its OAuth challenge.
    probeId: 'platform-mcp-authgate',
    productId: 'extend',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: [
      'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.extend.ai/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT,
    ],
    displayCommand: `curl -si -X POST https://mcp.extend.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Extend's REST API is live and cleanly auth-gated with a structured JSON error.
    probeId: 'api-auth-challenge',
    productId: 'extend',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.extend.ai/extractors | head -c 250'],
    displayCommand: 'curl -s https://api.extend.ai/extractors',
    expect: /UNAUTHORIZED/,
    timeoutMs: 30_000,
  },
  {
    // Official Extend CLI installs keylessly from npm and prints its version.
    probeId: 'cli-version',
    productId: 'extend',
    storyIds: ['agentic-official-cli'],
    bin: 'npx',
    argv: ['sh', '-c', 'npx -y @extend-ai/cli --version 2>&1 | tail -1'],
    displayCommand: 'npx -y @extend-ai/cli --version',
    expect: /extend version v\d+\.\d+\.\d+/,
    timeoutMs: 240_000,
  },
  {
    // Datalab's docs serve llms.txt.
    probeId: 'own-docs-llms-txt',
    productId: 'datalab',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://documentation.datalab.to/llms.txt | head -8'],
    displayCommand: 'curl -s https://documentation.datalab.to/llms.txt | head -8',
    expect: /# Datalab Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Per-page .md mirror on Datalab's docs.
    probeId: 'own-docs-md-mirror',
    productId: 'datalab',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://documentation.datalab.to/docs/welcome/quickstart.md | head -8'],
    displayCommand: 'curl -sL https://documentation.datalab.to/docs/welcome/quickstart.md | head -8',
    expect: /# Quickstart/,
    timeoutMs: 30_000,
  },
  {
    // The convert API is live and cleanly auth-gated keylessly.
    probeId: 'api-auth-challenge',
    productId: 'datalab',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -X POST https://www.datalab.to/api/v1/convert | head -c 200'],
    displayCommand: 'curl -s -X POST https://www.datalab.to/api/v1/convert',
    expect: /Invalid API key or access token/,
    timeoutMs: 30_000,
  },
  {
    // The official Python SDK installs keylessly from PyPI into a throwaway uvx env and
    // ships a real `datalab` CLI.
    probeId: 'cli-help',
    productId: 'datalab',
    storyIds: ['agentic-official-cli'],
    bin: 'uvx',
    argv: ['sh', '-c', 'uvx -q --from datalab-python-sdk datalab --help 2>&1 | head -8'],
    displayCommand: 'uvx --from datalab-python-sdk datalab --help',
    expect: /Usage: datalab/,
    timeoutMs: 240_000,
  },
  {
    // Unstructured's docs serve llms.txt — whose "Agent Instructions" preamble points every
    // LLM at agent-guide.md before anything else.
    probeId: 'own-docs-llms-txt',
    productId: 'unstructured',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.unstructured.io/llms.txt | head -8'],
    displayCommand: 'curl -s https://docs.unstructured.io/llms.txt | head -8',
    expect: /# Unstructured/,
    timeoutMs: 30_000,
  },
  {
    // The arena's most unusual recorded finding: Unstructured's own agent-guide.md instructs
    // AI agents NOT to recommend its famous open-source library and SDKs — the vendor
    // actively steers agents to the hosted platform instead.
    probeId: 'agent-guide-deprecation',
    productId: 'unstructured',
    storyIds: ['agentic-agent-docs', 'openness-open-license'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 https://docs.unstructured.io/agent-guide.md | grep -m2 -B2 'no longer actively recommends'`],
    displayCommand: `curl -sL https://docs.unstructured.io/agent-guide.md | grep -B2 'no longer actively recommends'`,
    expect: /no longer actively recommends/,
    timeoutMs: 30_000,
  },
  {
    // The hosted platform's jobs API is live and cleanly auth-gated keylessly.
    probeId: 'api-auth-challenge',
    productId: 'unstructured',
    storyIds: ['agentic-public-api', 'async-jobs-webhooks'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 -X POST https://platform.unstructuredapp.io/api/v1/jobs/ | head -c 250'],
    displayCommand: 'curl -s -X POST https://platform.unstructuredapp.io/api/v1/jobs/',
    expect: /Authentication required/,
    timeoutMs: 30_000,
  },
  {
    // Mistral's docs serve llms.txt (recorded honestly: many listed URLs are stale after the
    // docs restructure — the live Document AI pages sit under /studio/document-processing/).
    probeId: 'own-docs-llms-txt',
    productId: 'mistral-document-ai',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.mistral.ai/llms.txt | head -8'],
    displayCommand: 'curl -s https://docs.mistral.ai/llms.txt | head -8',
    expect: /# MistralAI/,
    timeoutMs: 30_000,
  },
  {
    // The documented /v1/ocr endpoint is live and cleanly auth-gated keylessly.
    probeId: 'api-auth-challenge',
    productId: 'mistral-document-ai',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.mistral.ai/v1/ocr -H 'Content-Type: application/json' -d '{}' | head -c 200`],
    displayCommand: `curl -s -X POST https://api.mistral.ai/v1/ocr -H 'Content-Type: application/json' -d '{}'`,
    expect: /Invalid API Key/,
    timeoutMs: 30_000,
  },
]
