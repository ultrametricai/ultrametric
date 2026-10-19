#!/usr/bin/env python3
# One-shot helper for the ecommerce-platforms arena bring-up (2026-09-08): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/ecommerce-platforms/proofs/
# (see rankings-engine/probes/ecommerce-platforms.ts — all 14 recorded
# probes passed). Run AFTER `pnpm engine probe --category ecommerce-platforms` — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run this script after
# any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'shopify': [
        {
            'id': 'shopify-probe-rt-1',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/catalog/global-catalog',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Shopify's Global Catalog MCP server is live — a keyless JSON-RPC initialize POST to https://catalog.shopify.com/api/ucp/mcp completed a FULL handshake (HTTP 200, serverInfo universal-ucp-mcp, header x-shopify-ucp-mcp-api-version: 2026-08-25), and a keyless tools/list returns search_catalog/lookup_catalog/get_product.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-probe-rt-2',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/catalog/storefront-catalog',
            'excerpt': "PROBE runtime (recorded 2026-09-08): a Shopify-operated storefront's own UCP endpoint is live — a keyless JSON-RPC initialize POST to https://hardware.shopify.com/api/ucp/mcp completed a FULL handshake (serverInfo universal-commerce), the per-merchant /api/ucp/mcp surface documented for storefront catalogs, carts, and checkout.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-probe-rt-3',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/get-started/quickstart',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official @shopify/ucp-cli (npm, 'Reference CLI + MCP server for the Universal Commerce Protocol') installed keylessly and, with only a self-generated local profile (ucp profile init), ran a REAL cross-merchant Global Catalog search — live results with variant gids and per-merchant buy-now checkout permalinks (394 matches for 'wireless headphones').",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-probe-rt-4',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-08): a REAL cart was created keylessly on Shopify's own hardware store through the UCP CLI — ucp cart create --business https://hardware.shopify.com returned a live gid://shopify/Cart/ id with advertised payment handlers (shopify.card, shop_pay, gpay) and next-step checkout commands; no order was placed.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-probe-rt-5',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the documented agent-profile trust gate behaves as specified — a keyless raw tools/call search_catalog against catalog.shopify.com/api/ucp/mcp without a hosted profile returned the structured error invalid_profile_url ('Unable to fetch agent profile: Missing profile uri'), matching the documented meta.ucp-agent.profile requirement.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-probe-rt-6',
            'tier': 'probe',
            'url': 'https://www.shopify.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-08): shopify.com publishes an agent-oriented llms.txt on its main origin ('# Shopify ... selling online, in person, on marketplaces, through social, and now in AI chats'), and every shopify.dev docs page serves markdown at its URL + .md (verified on /docs/agents.md, content-type text/markdown).",
            'fetchedAt': NOW,
        },
    ],
    'medusa': [
        {
            'id': 'medusa-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.medusajs.com/learn/introduction/build-with-llms-ai/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Medusa's hosted remote MCP server is live at https://docs.medusajs.com/mcp — a keyless JSON-RPC initialize returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://docs.medusajs.com/.well-known/oauth-protected-resource, matching the documented Cloud-account OAuth gating (the server is available to Medusa Cloud users only).",
            'fetchedAt': NOW,
        },
        {
            'id': 'medusa-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.medusajs.com/resources/js-sdk',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official @medusajs/js-sdk (npm 2.x) installed keylessly into a throwaway fixture and imported cleanly — its default export is a constructor function.",
            'fetchedAt': NOW,
        },
    ],
    'woocommerce': [
        {
            'id': 'woocommerce-probe-rt-1',
            'tier': 'probe',
            'url': 'https://wordpress.org/plugins/woocommerce/',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the wordpress.org plugin registry reports WooCommerce live and current keylessly — slug woocommerce, version 11.1.0, active_installs 7,000,000 — machine-readable evidence of the GPL plugin's ecosystem scale.",
            'fetchedAt': NOW,
        },
    ],
    'bigcommerce': [
        {
            'id': 'bigcommerce-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.bigcommerce.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-08): BigCommerce's developer docs publish an llms.txt with 'Instructions for AI Agents' pointing at an MCP server, and that server completed a FULL keyless JSON-RPC initialize handshake at https://docs.bigcommerce.com/_mcp/server (serverInfo fern-docs-mcp-server) — a docs MCP, not a store-operations MCP.",
            'fetchedAt': NOW,
        },
    ],
    'swell': [
        {
            'id': 'swell-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.swell.is/apps/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official @swell/cli installed keylessly from npm and printed its version (@swell/cli/2.9.16).",
            'fetchedAt': NOW,
        },
        {
            'id': 'swell-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/swellstores/skills',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Swell publishes agent skills as plain markdown in the public swellstores/skills repo ('Your AI coding agent, now fluent in Swell Commerce development' — file contract, swell CLI, validate-deploy-verify cycle), installable as a Claude Code plugin marketplace.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/ecommerce-platforms/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f'{pid}: {item["id"]} already present, skipping')
            continue
        ev.append(item)
        print(f'{pid}: appended {item["id"]}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
