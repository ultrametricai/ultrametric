import { CURL_MCP_INIT, type LocalProbe } from './types'

  // E-commerce platforms: the signature keyless proofs are Shopify's Universal Commerce
  // Protocol surface — a FULL keyless MCP initialize handshake against the Global Catalog
  // (catalog.shopify.com/api/ucp/mcp) and against a Shopify-operated storefront's own
  // /api/ucp/mcp, a REAL cross-merchant catalog search and a REAL cart created through the
  // @shopify/ucp-cli with only a local self-generated profile (no account, no key), plus the
  // documented profile gate on raw tools/call — alongside registry installs of each vendor's
  // official CLI/SDK and the docs-MCP/auth-challenge handshakes the other vendors publish.
  // Nothing places an order or touches payment; carts are ephemeral by design.
export const probes: LocalProbe[] = [
    {
      // Shopify's Global Catalog MCP server completes a FULL keyless JSON-RPC initialize —
      // serverInfo universal-ucp-mcp, x-shopify-ucp-mcp-api-version: 2026-08-25.
      probeId: 'mcp-remote-handshake',
      productId: 'shopify',
      storyIds: ['agentic-mcp-server', 'agent-catalog-discovery'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s -i --max-time 20 -X POST https://catalog.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | grep -E 'HTTP/|ucp-mcp-api-version|serverInfo' | head -4`,
      ],
      displayCommand: `curl -si -X POST https://catalog.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # full keyless handshake`,
      expect: /"serverInfo":\{"name":"universal-ucp-mcp"/,
      timeoutMs: 30_000,
    },
    {
      // A Shopify-operated storefront (hardware.shopify.com) answers the same keyless
      // initialize on its own /api/ucp/mcp — serverInfo universal-commerce.
      probeId: 'storefront-ucp-handshake',
      productId: 'shopify',
      storyIds: ['agent-storefront-commerce', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://hardware.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 400`,
      ],
      displayCommand: `curl -s -X POST https://hardware.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # merchant-storefront UCP endpoint`,
      expect: /"serverInfo":\{"name":"universal-commerce"/,
      timeoutMs: 30_000,
    },
    {
      // The documented agent-profile gate, observed live: a keyless tools/call without a
      // hosted profile returns the structured invalid_profile_url error the docs describe.
      probeId: 'ucp-profile-gate',
      productId: 'shopify',
      storyIds: ['agentic-scoped-keys', 'agent-storefront-commerce'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://catalog.shopify.com/api/ucp/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_catalog","arguments":{"query":"wireless headphones"}}}' | head -c 300`,
      ],
      displayCommand: `curl -s -X POST https://catalog.shopify.com/api/ucp/mcp -d '<tools/call search_catalog without agent profile>'  # documented profile gate answers with a structured error`,
      expect: /invalid_profile_url/,
      timeoutMs: 30_000,
    },
    {
      // Real registry install of the official UCP CLI into a throwaway fixture + version print.
      probeId: 'npm-install-ucp-cli',
      productId: 'shopify',
      storyIds: ['agentic-official-cli', 'agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @shopify/ucp-cli --no-fund --no-audit --loglevel=error && echo "ucp version: $(./node_modules/.bin/ucp --version)" && ./node_modules/.bin/ucp --help | head -12 ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @shopify/ucp-cli && ucp --version && ucp --help`,
      expect: /ucp version: \d+\.\d+\.\d+/,
      timeoutMs: 240_000,
    },
    {
      // The agent flow, run for real and keylessly: a fresh local profile (self-generated, no
      // account) then a live cross-merchant Global Catalog search returning variant gids and
      // buy-now checkout permalinks.
      probeId: 'ucp-catalog-search-keyless',
      productId: 'shopify',
      storyIds: ['agent-catalog-discovery', 'agentic-headless', 'agent-storefront-commerce'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @shopify/ucp-cli --no-fund --no-audit --loglevel=error >/dev/null 2>&1 && ./node_modules/.bin/ucp profile init --name pa-probe >/dev/null 2>&1; ./node_modules/.bin/ucp catalog search --set /query='wireless headphones' --set /context/address_country=US --view :compact --format md | head -24 ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `npm install @shopify/ucp-cli && ucp profile init --name pa-probe && ucp catalog search --set /query='wireless headphones'  # keyless live cross-merchant search`,
      expect: /gid:\/\/shopify\/ProductVariant\/\d+/,
      timeoutMs: 300_000,
    },
    {
      // And the cart step: a REAL cart created keylessly on Shopify's own hardware store —
      // the response returns a live gid://shopify/Cart id. Ephemeral; no checkout, no payment.
      probeId: 'ucp-cart-create-keyless',
      productId: 'shopify',
      storyIds: ['agent-storefront-commerce', 'agent-order-lifecycle'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @shopify/ucp-cli --no-fund --no-audit --loglevel=error >/dev/null 2>&1 && ./node_modules/.bin/ucp profile init --name pa-probe >/dev/null 2>&1; v=$(./node_modules/.bin/ucp catalog search --business https://hardware.shopify.com --set /query='card reader' --format json | grep -o 'gid://shopify/ProductVariant/[0-9]*' | head -1) && echo "variant: $v" && ./node_modules/.bin/ucp cart create --business https://hardware.shopify.com --set "/line_items/0/item/id=$v" --set /line_items/0/quantity=1 --format md | grep -A 2 'result.id' ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `ucp catalog search --business https://hardware.shopify.com --set /query='card reader' && ucp cart create --business https://hardware.shopify.com --set /line_items/0/item/id=<variant>  # real keyless cart on Shopify's own store`,
      expect: /gid:\/\/shopify\/Cart\//,
      timeoutMs: 300_000,
    },
    {
      // shopify.com publishes an agent-oriented llms.txt on the main origin (the docs origin
      // shopify.dev serves per-page markdown instead — see the next probe).
      probeId: 'llms-txt-fetch',
      productId: 'shopify',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.shopify.com/llms.txt | head -4'],
      displayCommand: 'curl -sL https://www.shopify.com/llms.txt | head -4',
      expect: /# Shopify/,
      timeoutMs: 30_000,
    },
    {
      // Every shopify.dev docs page serves its markdown source at the same URL + .md.
      probeId: 'docs-md-agents',
      productId: 'shopify',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://shopify.dev/docs/agents.md | sed -n 1,14p'],
      displayCommand: 'curl -s https://shopify.dev/docs/agents.md | sed -n 1,14p',
      expect: /Build commerce agents with UCP/,
      timeoutMs: 30_000,
    },
    {
      // Medusa's hosted remote MCP server is live and cleanly OAuth-gated keylessly (Cloud
      // accounts only — the 401 challenge with resource metadata is the documented behavior).
      probeId: 'mcp-remote-auth-challenge',
      productId: 'medusa',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://docs.medusajs.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://docs.medusajs.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata/,
      timeoutMs: 30_000,
    },
    {
      // Official @medusajs/js-sdk installs keylessly from npm and imports.
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'medusa',
      storyIds: ['agentic-sdks'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @medusajs/js-sdk --no-fund --no-audit --loglevel=error && node -e "import('@medusajs/js-sdk').then(m=>console.log('PA_PROBE_OK medusa js-sdk export:', typeof (m.default ?? m.Medusa)))" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @medusajs/js-sdk && node -e "import('@medusajs/js-sdk').then(m=>console.log('PA_PROBE_OK medusa js-sdk export:', typeof m.default))"`,
      expect: /PA_PROBE_OK medusa js-sdk export: function/,
      timeoutMs: 240_000,
    },
    {
      // The wordpress.org plugin registry reports WooCommerce's live version and install base
      // keylessly — machine-readable ecosystem-scale evidence.
      probeId: 'registry-plugin-info',
      productId: 'woocommerce',
      storyIds: ['app-extension-marketplace', 'openness-open-license'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request%5Bslug%5D=woocommerce' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("slug:", d["slug"], "version:", d["version"], "active_installs:", d["active_installs"], "requires:", d.get("requires"))'`,
      ],
      displayCommand: `curl -s 'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=woocommerce' | python3 -c '<print slug, version, active_installs>'`,
      expect: /slug: woocommerce version: \d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // BigCommerce's docs MCP server (published in docs.bigcommerce.com/llms.txt) completes a
      // FULL keyless initialize handshake.
      probeId: 'docs-mcp-handshake',
      productId: 'bigcommerce',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://docs.bigcommerce.com/_mcp/server -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 500`,
      ],
      displayCommand: `curl -s -X POST https://docs.bigcommerce.com/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'  # docs MCP from docs.bigcommerce.com/llms.txt`,
      expect: /"serverInfo":\{"name":"fern-docs-mcp-server"/,
      timeoutMs: 30_000,
    },
    {
      // Official @swell/cli installs keylessly from npm and prints its version.
      probeId: 'npm-install-cli-version',
      productId: 'swell',
      storyIds: ['agentic-official-cli'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @swell/cli --no-fund --no-audit --loglevel=error && ./node_modules/.bin/swell --version ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @swell/cli && swell --version`,
      expect: /@swell\/cli\/\d+\.\d+\.\d+/,
      timeoutMs: 240_000,
    },
    {
      // Swell publishes agent skills as plain markdown in a public repo (swellstores/skills).
      probeId: 'skills-readme-fetch',
      productId: 'swell',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://raw.githubusercontent.com/swellstores/skills/main/README.md | head -8'],
      displayCommand: 'curl -s https://raw.githubusercontent.com/swellstores/skills/main/README.md | head -8',
      expect: /Your AI coding agent, now fluent in \[Swell Commerce\]/,
      timeoutMs: 30_000,
    },
]
