import { CURL_MCP_INIT, type LocalProbe } from './types'

  // Developer docs platforms: the deliciously self-referential arena — these vendors SELL the
  // agent-docs layer (llms.txt, .md mirrors, docs MCP servers) this site scores every arena on,
  // so the signature probes check whether each vendor drinks their own champagne on their OWN
  // docs site: live llms.txt indexes, per-page .md mirrors, and keyless MCP initialize
  // handshakes against the docs MCP servers they generate for customers. CLI probes install the
  // published npm packages into throwaway npx caches; the docusaurus probe scaffolds a real
  // site into a mktemp fixture (--skip-install, self-cleaned). All keyless and read-only.
export const probes: LocalProbe[] = [
    {
      // Mintlify's own docs serve llms.txt — the product feature, demonstrated on themselves.
      probeId: 'own-docs-llms-txt',
      productId: 'mintlify',
      storyIds: ['llms-txt-generated', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.mintlify.com/docs/llms.txt | head -6'],
      displayCommand: 'curl -s https://www.mintlify.com/docs/llms.txt | head -6  # the vendor drinks its own champagne',
      expect: /# Mintlify/,
      timeoutMs: 30_000,
    },
    {
      // Per-page .md mirror on Mintlify's own docs.
      probeId: 'own-docs-md-mirror',
      productId: 'mintlify',
      storyIds: ['md-mirror-endpoints', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.mintlify.com/docs/quickstart.md | head -8'],
      displayCommand: 'curl -sL https://www.mintlify.com/docs/quickstart.md | head -8',
      expect: /# Quickstart/,
      timeoutMs: 30_000,
    },
    {
      // The per-site Search MCP server Mintlify generates for every customer, live on
      // Mintlify's own docs: a FULL keyless initialize handshake at {docs-domain}/mcp.
      probeId: 'docs-mcp-handshake',
      productId: 'mintlify',
      storyIds: ['docs-mcp-for-readers', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://www.mintlify.com/docs/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
      ],
      displayCommand: `curl -s -X POST https://www.mintlify.com/docs/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the per-site MCP server Mintlify ships for every customer, on its own docs`,
      expect: /"serverInfo"/,
      timeoutMs: 30_000,
    },
    {
      // Mintlify Index MCP (index.mintlify.com): keyless full handshake, cross-site docs search
      // for all developers and agents.
      probeId: 'index-mcp-handshake',
      productId: 'mintlify',
      storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://index.mintlify.com -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
      ],
      displayCommand: `curl -s -X POST https://index.mintlify.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"mintlify-universal-search"/,
      timeoutMs: 30_000,
    },
    {
      // The hosted admin MCP answers a keyless initialize with its OAuth challenge.
      probeId: 'admin-mcp-authgate',
      productId: 'mintlify',
      storyIds: ['agentic-mcp-server', 'ai-agent-maintains-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.mintlify.com',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.mintlify.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The official CLI installs keylessly from npm; its help lists validate/broken-links/
      // export — the docs quality gates an agent can run headlessly.
      probeId: 'cli-install-help',
      productId: 'mintlify',
      storyIds: ['agentic-official-cli', 'ci-broken-link-checks'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y mint --help 2>&1 | head -16'],
      displayCommand: 'npx -y mint --help | head -16',
      expect: /broken-links/,
      timeoutMs: 240_000,
    },
    {
      // GitBook's own docs serve llms.txt.
      probeId: 'own-docs-llms-txt',
      productId: 'gitbook',
      storyIds: ['llms-txt-generated', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://gitbook.com/docs/llms.txt | head -6'],
      displayCommand: 'curl -sL https://gitbook.com/docs/llms.txt | head -6',
      expect: /# GitBook/,
      timeoutMs: 30_000,
    },
    {
      // Per-page .md mirror on GitBook's own docs.
      probeId: 'own-docs-md-mirror',
      productId: 'gitbook',
      storyIds: ['md-mirror-endpoints', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://gitbook.com/docs/getting-started/quickstart.md | head -5'],
      displayCommand: 'curl -sL https://gitbook.com/docs/getting-started/quickstart.md | head -5',
      expect: /# Quickstart/,
      timeoutMs: 30_000,
    },
    {
      // The auto-generated per-site MCP server every published GitBook site gets, live on
      // GitBook's own docs ({site}/~gitbook/mcp): FULL keyless initialize handshake.
      probeId: 'docs-mcp-handshake',
      productId: 'gitbook',
      storyIds: ['docs-mcp-for-readers', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST 'https://gitbook.com/docs/~gitbook/mcp' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
      ],
      displayCommand: `curl -s -X POST 'https://gitbook.com/docs/~gitbook/mcp' -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the MCP server GitBook auto-generates for every published site, on its own docs`,
      expect: /"serverInfo"/,
      timeoutMs: 30_000,
    },
    {
      // GitBook's organization-level write MCP answers keylessly with its OAuth challenge.
      probeId: 'org-mcp-authgate',
      productId: 'gitbook',
      storyIds: ['agentic-mcp-server', 'ai-agent-maintains-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.gitbook.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.gitbook.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // ReadMe's llms.txt supports a ?query= search parameter — retrieval built into the
      // index file itself, demonstrated on ReadMe's own docs.
      probeId: 'own-docs-llms-txt-query',
      productId: 'readme',
      storyIds: ['llms-txt-generated', 'agentic-agent-docs', 'instant-search-quality'],
      bin: 'curl',
      argv: ['sh', '-c', `curl -sL --max-time 25 'https://docs.readme.com/llms.txt?query=mcp+server' | head -12`],
      displayCommand: `curl -sL 'https://docs.readme.com/llms.txt?query=mcp+server' | head -12  # llms.txt with built-in search, on ReadMe's own docs`,
      expect: /Search Results/,
      timeoutMs: 30_000,
    },
    {
      // Per-page .md mirror on ReadMe's own docs.
      probeId: 'own-docs-md-mirror',
      productId: 'readme',
      storyIds: ['md-mirror-endpoints', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.readme.com/main/docs/your-projects-mcp-server.md | head -12'],
      displayCommand: 'curl -sL https://docs.readme.com/main/docs/your-projects-mcp-server.md | head -12',
      expect: /# MCP/,
      timeoutMs: 30_000,
    },
    {
      // The per-project MCP server ReadMe ships for customers, live on ReadMe's own docs:
      // FULL keyless initialize handshake with serverInfo "ReadMe Documentation".
      probeId: 'docs-mcp-handshake',
      productId: 'readme',
      storyIds: ['docs-mcp-for-readers', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://docs.readme.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
      ],
      displayCommand: `curl -s -X POST https://docs.readme.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the per-project MCP server ReadMe ships, on its own docs`,
      expect: /"serverInfo":\{"name":"ReadMe Documentation"/,
      timeoutMs: 30_000,
    },
    {
      // Official rdme CLI installs keylessly from npm and prints its version.
      probeId: 'cli-version',
      productId: 'readme',
      storyIds: ['agentic-official-cli', 'git-sync-workflow'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y rdme --version 2>&1 | tail -1'],
      displayCommand: 'npx -y rdme --version',
      expect: /rdme\/\d+\.\d+\.\d+/,
      timeoutMs: 240_000,
    },
    {
      // Real scaffold roundtrip in a throwaway fixture: create-docusaurus generates a complete,
      // self-hostable docs site (config, sidebars, docs/, blog/) with no account and no keys.
      probeId: 'scaffold-roundtrip',
      productId: 'docusaurus',
      storyIds: ['agentic-official-cli', 'static-export-portability', 'openness-self-host'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        'd=$(mktemp -d) && cd "$d" && npx -y create-docusaurus@latest pa-probe classic --typescript --skip-install 2>&1 | tail -6; echo "--- scaffold files ---"; ls pa-probe; cd / && rm -rf "$d"',
      ],
      displayCommand: 'mktemp -d && npx -y create-docusaurus@latest pa-probe classic --typescript --skip-install && ls pa-probe',
      expect: /docusaurus\.config\.ts/,
      timeoutMs: 300_000,
    },
    {
      // Fern's docs MCP server, live on Fern's own docs: FULL keyless initialize handshake.
      // (Fern's llms.txt advertises /_mcp/server at the site root, which 404s — the live
      // endpoint sits under the docs subpath. The 404 is itself a finding.)
      probeId: 'docs-mcp-handshake',
      productId: 'fern',
      storyIds: ['docs-mcp-for-readers', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://buildwithfern.com/learn/_mcp/server -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 600`,
      ],
      displayCommand: `curl -s -X POST https://buildwithfern.com/learn/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # the docs MCP server Fern generates, on its own docs`,
      expect: /"serverInfo":\{"name":"fern-docs-mcp-server"/,
      timeoutMs: 30_000,
    },
    {
      // Fern's own llms.txt leads with literal "Instructions for AI Agents".
      probeId: 'own-docs-llms-txt',
      productId: 'fern',
      storyIds: ['llms-txt-generated', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://buildwithfern.com/llms.txt | head -8'],
      displayCommand: 'curl -s https://buildwithfern.com/llms.txt | head -8',
      expect: /Instructions for AI Agents/,
      timeoutMs: 30_000,
    },
    {
      // Per-page .md mirror on Fern's own docs — on the very page documenting the feature.
      probeId: 'own-docs-md-mirror',
      productId: 'fern',
      storyIds: ['md-mirror-endpoints', 'agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://buildwithfern.com/learn/docs/ai-features/llms-txt.md | head -6'],
      displayCommand: 'curl -sL https://buildwithfern.com/learn/docs/ai-features/llms-txt.md | head -6',
      expect: /# `llms\.txt`/,
      timeoutMs: 30_000,
    },
    {
      // Every Fern-hosted docs domain serves a machine-readable public API spec.
      probeId: 'docs-public-openapi',
      productId: 'fern',
      storyIds: ['api-machine-spec', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://buildwithfern.com/openapi.json | head -c 500'],
      displayCommand: 'curl -s https://buildwithfern.com/openapi.json | head -c 500',
      expect: /"title": "Fern Public API"/,
      timeoutMs: 30_000,
    },
    {
      // Official fern CLI installs keylessly from npm and prints its version.
      probeId: 'cli-version',
      productId: 'fern',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y fern-api --version 2>&1 | tail -1'],
      displayCommand: 'npx -y fern-api --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 240_000,
    },
]
