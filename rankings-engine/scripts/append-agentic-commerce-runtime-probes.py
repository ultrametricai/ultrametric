#!/usr/bin/env python3
# One-shot helper for the agentic-commerce arena bring-up (2026-09-14): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/agentic-commerce/proofs/
# (see pipeline/probes/agentic-commerce.ts — all 23 recorded probes passed). Run AFTER
# `pnpm pipeline probe --category agentic-commerce` — that stage wholesale-replaces probe-tier
# evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'stripe-agentic-commerce': [
        {
            'id': 'stripe-ac-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.stripe.com/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-14): Stripe's hosted MCP server is live and gated exactly as documented — a keyless JSON-RPC initialize POST to https://mcp.stripe.com answered HTTP 401 with the OAuth challenge pointing at docs.stripe.com/mcp, the per-spec auth contract an agent reads before connecting.",
            'fetchedAt': NOW,
        },
        {
            'id': 'stripe-ac-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.stripe.com/payments/machine/mpp.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the Machine Payments Protocol is published in the open — https://mpp.dev/ answers a plain GET with the full markdown spec index ('# MPP — Machine Payments Protocol... the open standard for machine-to-machine payments via HTTP 402'), including governance, quickstarts, and llms-full.txt guidance; and the mppx SDK resolves on the public npm registry (npm view mppx → 0.9.3).",
            'fetchedAt': NOW,
        },
        {
            'id': 'stripe-ac-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.stripe.com/skills.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the machine-readable skills catalog is live at the documented keyless well-known URL — https://docs.stripe.com/.well-known/skills/index.json returns the JSON index of Stripe-maintained agent skills (connect-recommend, stripe-best-practices, stripe-directory, ...).",
            'fetchedAt': NOW,
        },
        {
            'id': 'stripe-ac-probe-rt-4',
            'tier': 'probe',
            'url': 'https://docs.stripe.com/agentic-commerce/link-cli.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the Link CLI — the agent-wallet client documented for retrieving one-time-use payment credentials and permissioned financial data — is published on the public npm registry (npm view @stripe/link-cli → 0.19.2; source at github.com/stripe/link-cli).",
            'fetchedAt': NOW,
        },
    ],
    'shopify-ucp': [
        {
            'id': 'shopify-ucp-probe-rt-1',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/catalog/global-catalog',
            'excerpt': "PROBE runtime (recorded 2026-09-14): Shopify's Global Catalog MCP server is live — a keyless JSON-RPC initialize POST to https://catalog.shopify.com/api/ucp/mcp completed a FULL handshake (HTTP 200, serverInfo universal-ucp-mcp, header x-shopify-ucp-mcp-api-version: 2026-08-25).",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-ucp-probe-rt-2',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/catalog/storefront-catalog',
            'excerpt': "PROBE runtime (recorded 2026-09-14): a Shopify-operated storefront's own UCP endpoint is live — a keyless JSON-RPC initialize POST to https://hardware.shopify.com/api/ucp/mcp completed a FULL handshake (serverInfo universal-commerce), the per-merchant /api/ucp/mcp surface every UCP-enabled storefront exposes to agents.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-ucp-probe-rt-3',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-14): a REAL cart was created keylessly on Shopify's own hardware store through the UCP protocol — @shopify/ucp-cli with a self-generated local profile searched the live catalog (variant gid://shopify/ProductVariant/47695038775318) and ucp cart create returned a live gid://shopify/Cart/ id plus the documented next steps (ucp checkout create from the cart id). Ephemeral; no checkout, no payment.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-ucp-probe-rt-4',
            'tier': 'probe',
            'url': 'https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the documented agent-profile trust gate behaves as specified — a keyless raw tools/call search_catalog against catalog.shopify.com/api/ucp/mcp without a hosted agent profile returned the structured error invalid_profile_url, matching the documented requirement that agents identify themselves via a hosted profile before acting.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-ucp-probe-rt-5',
            'tier': 'probe',
            'url': 'https://ucp.dev/',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the Universal Commerce Protocol spec is published in the open — https://ucp.dev/llms.txt serves the versioned specification index ('# Universal Commerce Protocol (UCP)... an open standard that enables gen AI agents to safely, securely, and privately execute commerce actions'), with dated releases (2026-08-25, 2026-04-08, ...) and the GitHub org Universal-Commerce-Protocol.",
            'fetchedAt': NOW,
        },
    ],
    'paypal-agent-commerce': [
        {
            'id': 'paypal-ac-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developer.paypal.com/ai-tools/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-14): PayPal's remote MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.paypal.com/mcp answered HTTP 401 with 'www-authenticate: Bearer realm=\"OAuth\", resource_metadata=\"https://mcp.paypal.com/.well-known/oauth-protected-resource/mcp\"', and that RFC 9728 metadata URL answers keylessly, naming the resource and its authorization server (PKCE S256, dynamic client registration at /register).",
            'fetchedAt': NOW,
        },
        {
            'id': 'paypal-ac-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developer.paypal.com/ai-tools/toolkit',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the PayPal Agent Toolkit resolves on the public npm registry (npm view @paypal/agent-toolkit → 1.11.0, published 2026-09-01; Python twin paypal-agent-toolkit 1.11.0 on PyPI) — the SDK covering orders, invoices, subscriptions, tracking, disputes, refunds, and transactions for MCP, OpenAI Agents SDK, LangChain, CrewAI, Vercel AI SDK, and Bedrock.",
            'fetchedAt': NOW,
        },
    ],
    'coinbase-x402': [
        {
            'id': 'coinbase-x402-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.cdp.coinbase.com/x402/buyer/discover-services.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the x402 Bazaar discovery index is keyless by design and live — a plain GET to https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources returned real payable-service listings (USDC amounts, asset contracts, network eip155:8453/Base, scheme exact, maxTimeoutSeconds) with no CDP API key, exactly as the docs state.",
            'fetchedAt': NOW,
        },
        {
            'id': 'coinbase-x402-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.cdp.coinbase.com/x402/seller/facilitator.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the hosted CDP facilitator auth-gates as documented — a keyless GET to https://api.cdp.coinbase.com/platform/v2/x402/supported answered HTTP 401 Unauthorized — and the protocol SDK resolves on the public npm registry (npm view x402 → 1.2.0, published by the x402 Foundation with SLSA provenance).",
            'fetchedAt': NOW,
        },
    ],
    'crossmint': [
        {
            'id': 'crossmint-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.crossmint.com/agents/agent-checkouts-quickstart.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the Agent Checkouts endpoint is live and agent-scoped — a keyless POST to https://www.crossmint.com/api/unstable/agent-checkouts answered with the structured challenge 'Authentication required. Supported methods: [API Key, ServerKeyAgent]', naming the agent-specific server-key credential the docs describe.",
            'fetchedAt': NOW,
        },
        {
            'id': 'crossmint-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.crossmint.com/agents/overview.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): docs.crossmint.com serves llms.txt keylessly — '# Crossmint... checkout for onchain and physical-world assets... and payment infrastructure for AI agents — all across 50+ blockchains through a single API' — and every docs page serves markdown at the same URL + .md.",
            'fetchedAt': NOW,
        },
    ],
    'visa-intelligent-commerce': [
        {
            'id': 'visa-ic-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developer.visa.com/capabilities/trusted-agent-protocol/trusted-agent-protocol-specifications',
            'excerpt': "PROBE runtime (recorded 2026-09-14): the Trusted Agent Protocol is published in the open — https://raw.githubusercontent.com/visa/trusted-agent-protocol/main/README.md serves the spec README keylessly, and the repo ships a reference implementation (agent-registry, cdn-proxy, merchant-backend, tap-agent) under an open license.",
            'fetchedAt': NOW,
        },
        {
            'id': 'visa-ic-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developer.visa.com/capabilities/visa-intelligent-commerce',
            'excerpt': "PROBE runtime (recorded 2026-09-14): Visa's developer gateway is live and credential-gated exactly as documented — a keyless GET to https://api.visa.com/vdp/helloworld answered with the structured challenge {\"responseStatus\":{\"status\":400,\"code\":\"9123\",...,\"message\":\"Expected input credential was not present\"}} — and the Visa Acceptance Agent Toolkit MCP server resolves on the public npm registry (npm view @visaacceptance/mcp → 0.0.96, Visa-staff maintainers).",
            'fetchedAt': NOW,
        },
    ],
    'skyfire': [
        {
            'id': 'skyfire-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.skyfire.xyz/reference/introspect-token.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): Skyfire's token API is live and key-gated as documented — a keyless POST to https://api.skyfire.xyz/api/v1/tokens/introspect answered with the structured challenge {\"code\":\"NOT_AUTHORIZED\",\"message\":\"Invalid API Key\"} — and docs.skyfire.xyz serves llms.txt keylessly ('# Skyfire Developer Portal Documentation... the open identity and payments layer for AI agents').",
            'fetchedAt': NOW,
        },
    ],
}


def main():
    for product, items in ITEMS.items():
        path = f'open-rankings/agentic-commerce/evidence/{product}.json'
        ev = json.load(open(path))
        have = {e['id'] for e in ev}
        added = 0
        for item in items:
            if item['id'] not in have:
                ev.append(item)
                added += 1
        with open(path, 'w') as f:
            json.dump(ev, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{product}: +{added} runtime-probe items ({len(ev)} total)')


if __name__ == '__main__':
    main()
