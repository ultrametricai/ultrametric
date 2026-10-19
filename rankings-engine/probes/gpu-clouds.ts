import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'runpod',
      storyIds: ['agentic-official-cli'],
      bin: 'runpodctl',
      argv: ['runpodctl', 'version'],
      displayCommand: 'runpodctl version  # installed via `brew install runpod/runpodctl/runpodctl`',
      expect: /runpodctl \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-help',
      productId: 'runpod',
      storyIds: ['agentic-official-cli', 'agent-provisions-gpu'],
      bin: 'runpodctl',
      argv: ['sh', '-c', 'runpodctl --help | cat'],
      displayCommand: 'runpodctl --help',
      expect: /manage gpu pods/,
      timeoutMs: 30_000,
    },
    {
      // Hosted API MCP server (mcp.getrunpod.io) draws a keyless 401 with its OAuth
      // protected-resource challenge — live, Sign-in-with-Runpod-gated, as documented.
      probeId: 'mcp-remote-handshake',
      productId: 'runpod',
      storyIds: ['agentic-mcp-server', 'agent-provisions-gpu'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.getrunpod.io/',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.getrunpod.io/ -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      // The documented no-auth docs MCP server completes a FULL keyless initialize handshake.
      probeId: 'docs-mcp-handshake',
      productId: 'runpod',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://docs.runpod.io/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 700`,
      ],
      displayCommand: `curl -s -X POST https://docs.runpod.io/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo"/,
      timeoutMs: 30_000,
    },
    {
      // Public OpenAPI spec + the live REST API answering keylessly with 401 — the documented
      // machine-readable surface an agent provisions Pods through.
      probeId: 'openapi-and-live-api',
      productId: 'runpod',
      storyIds: ['agentic-public-api', 'api-machine-spec', 'agent-provisions-gpu'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s --max-time 20 https://rest.runpod.io/v1/openapi.json | head -c 300; echo; curl -s -i --max-time 20 https://rest.runpod.io/v1/pods | head -4',
      ],
      displayCommand: 'curl -s https://rest.runpod.io/v1/openapi.json | head -c 300 && curl -si https://rest.runpod.io/v1/pods',
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      // Lambda publishes its Cloud API OpenAPI 3.1 spec keylessly; the live API next to it
      // answers a bare request with 401 — spec + auth-gate pair, no account involved.
      probeId: 'openapi-and-live-api',
      productId: 'lambda-labs',
      storyIds: ['agentic-public-api', 'api-machine-spec', 'agent-provisions-gpu'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s --max-time 20 https://cloud.lambda.ai/api/v1/openapi.json | head -c 400; echo; curl -s -i --max-time 20 https://cloud.lambda.ai/api/v1/instances | head -4',
      ],
      displayCommand: 'curl -s https://cloud.lambda.ai/api/v1/openapi.json | head -c 400 && curl -si https://cloud.lambda.ai/api/v1/instances',
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      // CKS provisioning API (api.coreweave.com) is live and token-gated: bare list-clusters
      // GET draws 401 exactly as the API reference documents.
      probeId: 'api-keyless-authgate',
      productId: 'coreweave',
      storyIds: ['agentic-public-api', 'agent-provisions-gpu'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s -i --max-time 20 https://api.coreweave.com/v1beta1/cks/clusters | head -4',
      ],
      displayCommand: 'curl -si https://api.coreweave.com/v1beta1/cks/clusters',
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      // CoreWeave's docs MCP endpoint completes a full keyless initialize handshake
      // (serverInfo "CoreWeave Docs") — agent-readable docs over MCP.
      probeId: 'docs-mcp-handshake',
      productId: 'coreweave',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://docs.coreweave.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 700`,
      ],
      displayCommand: `curl -s -X POST https://docs.coreweave.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"CoreWeave Docs"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-help',
      productId: 'vast-ai',
      storyIds: ['agentic-official-cli'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx --from vastai vastai --help | cat'],
      displayCommand: 'uvx --from vastai vastai --help',
      expect: /usage: vastai/,
      timeoutMs: 240_000,
    },
    {
      // The arena's signature probe: the official CLI searches the LIVE GPU marketplace with
      // no account and no key — real RTX 4090 offers with real prices come back.
      probeId: 'cli-keyless-market-search',
      productId: 'vast-ai',
      storyIds: ['keyless-catalog-pricing-api', 'gpu-availability-transparency', 'agentic-official-cli'],
      bin: 'uvx',
      argv: ['sh', '-c', `uvx --from vastai vastai search offers 'gpu_name=RTX_4090 num_gpus=1' -o 'dph' | head -12`],
      displayCommand: `uvx --from vastai vastai search offers 'gpu_name=RTX_4090 num_gpus=1' -o 'dph' | head -12`,
      expect: /RTX_4090/,
      timeoutMs: 240_000,
    },
    {
      // Same keyless market read straight off the REST endpoint: live offers with per-GPU-hour
      // prices (dph_total) from a bare GET.
      probeId: 'api-keyless-offer-search',
      productId: 'vast-ai',
      storyIds: ['keyless-catalog-pricing-api', 'agentic-public-api'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 'https://console.vast.ai/api/v0/bundles/' -H 'Accept: application/json' | head -c 600`,
      ],
      displayCommand: `curl -s 'https://console.vast.ai/api/v0/bundles/' | head -c 600`,
      expect: /"dph_total"/,
      timeoutMs: 30_000,
    },
    {
      // Official installer into a throwaway HOME (installs to ~/.paperspace/bin), then a real
      // version print — nothing escapes the fixture.
      probeId: 'cli-install-version',
      productId: 'paperspace',
      storyIds: ['agentic-official-cli'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `h=$(mktemp -d) && HOME="$h" sh -c 'curl -fsSL https://paperspace.com/install.sh | sh >/dev/null 2>&1; "$HOME/.paperspace/bin/pspace" version; "$HOME/.paperspace/bin/pspace" --help | head -16' ; rm -rf "$h"`,
      ],
      displayCommand: `HOME=$(mktemp -d) sh -c 'curl -fsSL https://paperspace.com/install.sh | sh && ~/.paperspace/bin/pspace version && ~/.paperspace/bin/pspace --help'`,
      expect: /pspace v\d+\.\d+\.\d+/,
      timeoutMs: 180_000,
    },
]
