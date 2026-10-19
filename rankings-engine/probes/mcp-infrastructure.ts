import { CURL_MCP_INIT, type LocalProbe } from './types'

  // MCP infrastructure: the signature keyless proofs are (a) real JSON-RPC initialize
  // handshakes against each platform's hosted MCP endpoint — a live 401 OAuth challenge or a
  // per-user JSON-RPC error IS the product surface (managed auth) — (b) a keyless registry
  // search, and (c) real npm/pip/release installs of each platform's SDK or CLI into throwaway
  // fixtures, self-cleaned. All keyless; no accounts are created and no tools are executed.
export const probes: LocalProbe[] = [
    {
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'composio',
      storyIds: ['agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @composio/core --no-fund --no-audit --loglevel=error && node -e "const m=require('@composio/core'); console.log('PA_PROBE_OK Composio export:', typeof m.Composio)" && cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @composio/core && node -e "console.log('PA_PROBE_OK Composio export:', typeof require('@composio/core').Composio)"`,
      expect: /PA_PROBE_OK Composio export: function/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'pip-install-sdk-roundtrip',
      productId: 'composio',
      storyIds: ['agentic-sdks'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q composio && ./.venv/bin/python -c "import composio; print('PA_PROBE_OK composio', getattr(composio, '__version__', 'imported'))" && cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uv venv && uv pip install composio && python -c "import composio; print('PA_PROBE_OK composio', composio.__version__)"`,
      expect: /PA_PROBE_OK composio \d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'composio',
      storyIds: ['one-endpoint-hosted-connection', 'managed-oauth-vaulting', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://connect.composio.dev/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://connect.composio.dev/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'registry-keyless-search',
      productId: 'smithery',
      storyIds: ['registry-programmatic-api', 'server-registry-search', 'quality-scores-usage-signals'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 'https://registry.smithery.ai/servers?pageSize=3&q=browser' -H 'Accept: application/json' | head -c 900`,
      ],
      displayCommand: `curl -s 'https://registry.smithery.ai/servers?pageSize=3&q=browser' | head -c 900`,
      expect: /"servers":\[\{/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'smithery',
      storyIds: ['one-endpoint-hosted-connection', 'managed-oauth-vaulting', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://server.smithery.ai/exa/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://server.smithery.ai/exa/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'docs-mcp-handshake',
      productId: 'smithery',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://smithery.ai/docs/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 700`,
      ],
      displayCommand: `curl -s -X POST https://smithery.ai/docs/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"Smithery Documentation"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'npm-install-cli-version',
      productId: 'smithery',
      storyIds: ['publisher-cli-workflow', 'agentic-official-cli'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @smithery/cli --no-fund --no-audit --loglevel=error && ./node_modules/.bin/smithery --version && cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @smithery/cli && ./node_modules/.bin/smithery --version`,
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'registry-api-authgate',
      productId: 'glama',
      storyIds: ['registry-programmatic-api'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 'https://glama.ai/api/mcp/v1/servers?first=2' -H 'Accept: application/json' | head -c 700`,
      ],
      displayCommand: `curl -s 'https://glama.ai/api/mcp/v1/servers?first=2' | head -c 700`,
      expect: /API key|unauthorized/i,
      timeoutMs: 30_000,
    },
    {
      probeId: 'openapi-spec-fetch',
      productId: 'glama',
      storyIds: ['agentic-public-api', 'api-machine-spec'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 https://glama.ai/api/mcp/openapi.json | head -c 500`,
      ],
      displayCommand: `curl -s https://glama.ai/api/mcp/openapi.json | head -c 500`,
      expect: /"openapi"/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'mcp-remote-handshake',
      productId: 'pipedream-mcp',
      storyIds: ['one-endpoint-hosted-connection', 'per-end-user-multi-tenant-auth', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://remote.mcp.pipedream.net',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://remote.mcp.pipedream.net -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /external user id is required/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'pipedream-mcp',
      storyIds: ['agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @pipedream/sdk --no-fund --no-audit --loglevel=error && node -e "const m=require('@pipedream/sdk'); console.log('PA_PROBE_OK PipedreamClient export:', typeof m.PipedreamClient)" && cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @pipedream/sdk && node -e "console.log('PA_PROBE_OK PipedreamClient export:', typeof require('@pipedream/sdk').PipedreamClient)"`,
      expect: /PA_PROBE_OK PipedreamClient export: function/,
      timeoutMs: 180_000,
    },
    {
      // Real install of the vendor-published release binary — the same artifact the official
      // installer script (go.getgram.ai/cli.sh) fetches — into a throwaway dir, then a version
      // print. No sudo, self-cleaned.
      probeId: 'cli-release-install-version',
      productId: 'gram',
      storyIds: ['publisher-cli-workflow', 'agentic-official-cli'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && tag=$(curl -sf https://raw.githubusercontent.com/speakeasy-api/gram/refs/heads/main/cli/package.json | grep -oE '"(name|version)": *"[^"]*"' | sed -E 's/.*: *"([^"]*)"/\\1/' | paste -sd@ -) && echo "tag=$tag" && curl -fsSL "https://github.com/speakeasy-api/gram/releases/download/$tag/gram_darwin_arm64.zip" -o gram.zip && unzip -q gram.zip && ./gram --version && cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && curl -fsSL https://github.com/speakeasy-api/gram/releases/download/cli@<latest>/gram_darwin_arm64.zip -o gram.zip && unzip gram.zip && ./gram --version`,
      expect: /gram version \d+\.\d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      // Manufact's site-root llms.txt is a real agent-oriented index.
      probeId: 'llms-site-index',
      productId: 'manufact',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://manufact.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://manufact.com/llms.txt | head -6',
      expect: /# Manufact/,
      timeoutMs: 30_000,
    },
    {
      // Docs serve clean markdown at page URL + .md — the /mcp page names Manufact's own
      // hosted MCP server machine-readably.
      probeId: 'docs-md-endpoint',
      productId: 'manufact',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.manufact.com/mcp.md | head -8'],
      displayCommand: 'curl -s https://docs.manufact.com/mcp.md | head -8',
      expect: /Manufact MCP server/,
      timeoutMs: 30_000,
    },
    {
      // The MCP-cloud vendor's own hosted MCP server answers a keyless initialize with its
      // OAuth challenge — it ships what it sells.
      probeId: 'mcp-remote-handshake',
      productId: 'manufact',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.manufact.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.manufact.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // metorial.com publishes a site llms.txt (text/plain) that self-describes the MCP
      // integration platform and indexes the whole docs tree, noting every docs page mirrors
      // as markdown at URL + .mdx. Added at the 2026-09-25 YC F25 coverage-queue bring-up.
      probeId: 'llms-site-index',
      productId: 'metorial',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://metorial.com/llms.txt | head -4'],
      displayCommand: 'curl -s https://metorial.com/llms.txt | head -4',
      expect: /# Metorial[\s\S]*connects AI agents and MCP clients/,
      timeoutMs: 30_000,
    },
    {
      // Every docs page serves clean markdown at URL + .mdx (the llms.txt documents the
      // convention) — verified keylessly on the developer quickstart.
      probeId: 'docs-md-endpoint',
      productId: 'metorial',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://metorial.com/docs/build/quickstart.mdx | head -6'],
      displayCommand: 'curl -s https://metorial.com/docs/build/quickstart.mdx | head -6',
      expect: /# Developer quickstart[\s\S]*under 5 minutes/,
      timeoutMs: 30_000,
    },
    {
      // The public REST API is live and key-gated exactly as the docs describe: a keyless
      // GET /providers answers 401 unauthorized with a machine-readable error object that
      // names the Bearer-token header contract (glama registry-api-authgate pattern).
      probeId: 'registry-api-authgate',
      productId: 'metorial',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', "curl -s --max-time 20 'https://api.metorial.com/providers' -H 'Accept: application/json' | head -c 400"],
      displayCommand: "curl -s 'https://api.metorial.com/providers' | head -c 400",
      expect: /"code":"unauthorized"[\s\S]*Missing Authorization header/,
      timeoutMs: 30_000,
    },
]
