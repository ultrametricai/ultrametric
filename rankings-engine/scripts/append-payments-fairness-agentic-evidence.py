#!/usr/bin/env python3
# Payments fairness wave (2026-09-14): the integrity counterpart to the Stripe agentic-capability
# spike (append-payments-stripe-agentic-evidence.py, commit 771a7510). Stripe got an exhaustive
# agent-surface evidence pass; its direct competitors' scores were still sitting on the same
# extraction caps. This script runs the IDENTICAL supplement recipe for adyen, paypal, and
# square: verbatim passages from CRAWLED/VERIFIED vendor pages that the per-source extraction
# caps (60k chars over 24-26 sources) plus the 40-story quota starved out of the packs even
# though the crawled corpus contains them verbatim. This wave's crawl added 11 adyen, 9 paypal,
# and 10 square agent-surface urls.extra pages; the extract runs surfaced only ~19/18/18
# mostly one-line items from them.
#
# Every URL below is in that product's products.json urls (or is the live endpoint a probe
# verifies); every excerpt quotes the crawled/live page (live-checked at authoring time,
# 2026-09-14 — the recon copies were fetched the same day the crawl ran).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - adyen: no official CLI, no hosted/remote MCP server (the documented MCP is local-only via
#     `npx @adyen/mcp`), no llms-full agent-instructions block; nothing to quote for
#     agentic-builtin-assistant (no in-product assistant documented).
#   - paypal: no official CLI; agentic commerce services are gated behind a contact form
#     (quoted as-is, gate included); no in-product Dashboard assistant documented.
#   - square: no official CLI; no documented seller-side agentic-commerce catalog protocol
#     (UCP/ACP participation not documented for Square sellers — unlike Stripe/Adyen/PayPal);
#     Square AI is quoted with its Beta label intact.
#   - openness-*/privacy-*: out of this wave's scope; no agent-washing of unrelated axes.
#
# Run AFTER `pnpm engine extract --product <id>` (extraction is monotonic and dedups by
# normalized excerpt, so re-running extract after this keeps these items stable). If
# `pnpm engine probe --category payments` ever wholesale-replaces probe-tier items, re-run
# this script to restore adyen-probe-5, paypal-probe-4/5, and square-probe-5/6.
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

DOC_ITEMS = {
    'adyen': [
        # --- MCP server (docs extra-3 mcp-server.md + github Adyen/adyen-mcp, crawled extra-23) ---
        ('adyen-supp-mcp-tools', 'https://docs.adyen.com/development-resources/mcp-server.md',
         'The Adyen MCP server (github.com/Adyen/adyen-mcp, Alpha) runs locally via `npx -y @adyen/mcp --env=TEST` (or `--env=LIVE --livePrefix=YOUR_PREFIX_URL`) and "contains a set of tools that lets you interact with the Adyen APIs for common use cases": Checkout API sessions (create /sessions, get session result, get /paymentMethods), payment links (create/get/expire), and modifications (cancel an authorized payment, refund a captured payment), plus Management API tools for merchant accounts, terminals (list/reassign/schedule actions/settings), webhooks (list/get/test), payment method settings, users, API credentials, and allowed origins. The README advises "to only run a subset of tools required for your particular use case" via `--tools=...`, and the API key is passed via the ADYEN_API_KEY environment variable ("without exposing the key in your shell history").'),
        ('adyen-supp-mcp-credential-roles', 'https://docs.adyen.com/development-resources/mcp-server.md',
         'MCP access rides on Adyen\'s standard scoped credentials: "To authenticate the requests you will make using the MCP, generate an API key. Make sure that your API credential has the following roles" — a documented role list (Merchant PAL webservice role, Checkout webservice role, Management API—Payment methods read, Account read, Terminals read, Assign Terminal, Terminal actions read/read-write, Android files read, Terminal settings read/read-write) that the merchant assigns per credential in the Customer Area.'),
        # --- Agent-legible docs (extra-13 documentation-tools.md) ---
        ('adyen-supp-docs-tools', 'https://docs.adyen.com/development-resources/documentation-tools.md',
         '"Adyen makes documentation accessible to developers as well as the software and AI tools they create." Documented agent-docs surface: llms.txt at docs.adyen.com/llms.txt ("follows the proposed standard to help LLMs discover documentation... for example, to build a custom AI assistant that can answer questions about Adyen products"); "Most pages on our documentation site can be rendered as a raw markdown file by simply appending `.md` to the URL"; and a "full documentation mirror as a compressed ZIP file" (adyen-docs-mirror.zip) — "Give context to AI agents: Provide the full documentation set to code assistants, chatbots, or other AI tools. This works well in restricted or air gapped environments."'),
        ('adyen-supp-openapi-source-of-truth', 'https://docs.adyen.com/development-resources/documentation-tools.md',
         'The Adyen OpenAPI Specification repository (github.com/Adyen/adyen-openapi) "contains OpenAPI specifications for every public API Adyen offers. These specifications are the single source of truth for our APIs" — usable to generate client libraries, create Postman collections, and "Provide context to LLMs: The specification files can be used as valuable context to code assistants when working with Adyen APIs, especially when paired with Adyen MCP."'),
        # --- Adyen Agentic (extra-14..19) ---
        ('adyen-supp-agentic-overview', 'https://docs.adyen.com/online-payments/agentic-commerce.md',
         'Adyen Agentic is a documented product with per-role integration guides: "Agentic Commerce enables AI agents like Gemini, ChatGPT, and Copilot to act on behalf of shoppers... Your integration path depends on your role in the agentic commerce flow" — a Merchant path ("You accept payments from shoppers who use AI agents and want to expose your product catalog or checkout process to those agents") and an Agent platform path ("You operate the AI agent platform that acts on behalf of shoppers and makes purchases on their behalf").'),
        ('adyen-supp-agentic-feed', 'https://docs.adyen.com/online-payments/agentic-commerce/merchant/agentic-feed-api-integration.md',
         'The Adyen Product Feed API is "a centralized product knowledge hub that synchronizes your inventory with AI platforms" via asynchronous batch processing and "semantic mapping between your inventory data and industry-standard Agentic Commerce protocols": POST /v1/ingestions "Ingests a list of up to 200 items for asynchronous processing to OpenAI and/or Meta. Each item declares its target platforms via `platforms`"; DELETE /v1/ingestions removes up to 200 products per call; GET /v1/ingestions/{ingestionId} returns per-platform processing state with per-product errors. Base URLs: commerce-suite-test.adyen.com and commerce-suite-live.adyen.com; auth via X-API-Key or Basic Auth.'),
        ('adyen-supp-agentic-cart', 'https://docs.adyen.com/online-payments/agentic-commerce/merchant/agentic-cart-api-integration.md',
         'The Agentic Cart API makes Adyen the protocol translator so merchants integrate once: "the AI agent platform communicates with Adyen to initiate payments on behalf of shoppers. Adyen translates the information to be able to communicate with you... Adyen communicates with your server so that you do not need to integrate with multiple agent platforms." The merchant exposes session endpoints Adyen calls — create, update (recalculate totals), commit ("Run a final price or stock check before Adyen authorizes the payment"), cancel ("Release reserved inventory"), finalize, and an advanced complete-session flow with a payment token — with a documented five-second response SLA and post-purchase order events (shipping tracking) back to the agent.'),
        ('adyen-supp-agentic-protocols-both-sides', 'https://docs.adyen.com/online-payments/agentic-commerce/agent-platform.md',
         'Adyen documents BOTH major agentic-commerce protocols on both sides of the transaction: for agent platforms, "AI agent integration with ACP: Manage the full Agentic Commerce Protocol (ACP) checkout flow on behalf of Adyen merchants" and "AI agent integration with UCP: Manage the full Universal Commerce Protocol (UCP) checkout flow", plus agentic payments via "ACP delegated payments: Delegate payments to Adyen with encrypted payment data" and a "UCP Tokenization Handler: Tokenize payment credentials with Adyen for the Universal Commerce Protocol (UCP) checkout flow."'),
        ('adyen-supp-google-ucp', 'https://docs.adyen.com/online-payments/agentic-commerce/merchant/google-agentic-commerce.md',
         'Google Agentic Commerce integration: "Use this integration for processing Google Pay payments through Adyen, when Google agents (Google AI Mode or Gemini) initiate transactions with you... Google handles product discovery, checkout session management, and showing the Google Pay payment sheet to the shopper. Your server gets an encrypted payment token from google, and you pass it to Adyen to complete the payment" — the merchant sets up "your server to handle Google\'s Universal Commerce Protocol (UCP)", and "Adyen sends a webhook message with the payment outcome to your webhook server."'),
        # --- Scoped credentials (extra-20 api-credentials.md) ---
        ('adyen-supp-api-credential-scoping', 'https://docs.adyen.com/development-resources/api-credentials.md',
         'Adyen API credentials are scoped by construction: each credential carries "Roles: Permissions that define what the credential is allowed to do", and "You can also create multiple API credentials to improve security and control access... more credentials provide finer control over permissions" (documented examples: separate credentials per sales channel, a dedicated credential for unreferenced refunds, separating "the permissions for initiating and capturing payments"). Account scope is also controllable: "Credentials created on a merchant account can only access that merchant account."'),
        # --- AI risk/optimization (extra-22 uplift.md) ---
        ('adyen-supp-uplift-ai', 'https://docs.adyen.com/uplift.md',
         'Adyen Uplift is the platform\'s AI optimization layer: "Adyen Uplift helps you strike a balance between conversion, risk and cost. You get recommendations that are tailored for your business and use AI to optimize the full payment funnel" — with payment-optimization experiments you can "start, evaluate, and stop", machine-learning fraud detection trained on global transaction data, and per-transaction cost optimization.'),
    ],
    'paypal': [
        # --- Remote MCP server (extra-7 ai-tools/mcp-server.md) ---
        ('paypal-supp-remote-mcp', 'https://developer.paypal.com/ai-tools/mcp-server.md',
         'PayPal ships BOTH deployment modes of its MCP server: local via `npx -y @paypal/mcp --tools=all` (PAYPAL_ACCESS_TOKEN + PAYPAL_ENVIRONMENT=SANDBOX|PRODUCTION), and "the remotely hosted MCP server" with documented environment endpoints — Sandbox `https://mcp.sandbox.paypal.com`, Production `https://mcp.paypal.com` — supporting two transports (SSE at /sse and Streamable HTTP at /mcp) and token authorization with the account\'s client ID/secret from the Developer Dashboard. "With remote MCP server, users can continue their tasks across devices with a single login after authentication."'),
        ('paypal-supp-agent-tools-inventory', 'https://developer.paypal.com/ai-tools/agent-tools.md',
         'The documented agent-toolkit tool inventory spans the merchant back office: catalog (`create_product`, `list_product`, `show_product_details`), disputes (`list_disputes`, `get_dispute`, `accept_dispute_claim` — "Accept a dispute claim, resolving it in favor of the buyer"), invoices (`create_invoice`, `list_invoices`, `get_invoice`, `send_invoice`, `send_invoice_reminder`, `cancel_sent_invoice`, `generate_invoice_qr_code`), payments (`create_order`, `pay_order`, `create_refund`, `get_order`, `get_refund`), reporting (`get_merchant_insights`, `list_transaction`), shipment tracking (create/get/update), and subscriptions (create/update/cancel subscription, create/list plans, show details). Each tool documents parameters and a sample prompt.'),
        ('paypal-supp-insights-tool', 'https://developer.paypal.com/ai-tools/agent-tools.md',
         'Agents can pull business analytics through a dedicated tool: `get_merchant_insights` — "Retrieve business intelligence metrics and analytics for a merchant, filtered by start date, end date, insight type, and time interval" (insight_type ORDERS or SALES; intervals DAILY/WEEKLY/MONTHLY/QUARTERLY/YEARLY; sample prompt "Give me insights on my sales data from 01/01/2025 to 02/01/2025 using daily time intervals"). The remote MCP server additionally exposes commerce tools for "product search and checkout using PayPal for payments" behind an `x-feature-flags: commerce:true` header ("These tools are for gift cards only for now, but more is coming soon").'),
        ('paypal-supp-toolkit-frameworks', 'https://developer.paypal.com/ai-tools/toolkit.md',
         '"PayPal\'s agent toolkit supports the integration of PayPal APIs into AI agent workflows using Amazon Bedrock, CrewAI, LangChain, Model Context Protocol (MCP), OpenAI\'s Agents SDK, and Vercel\'s AI SDK" in TypeScript and Python (github.com/paypal/agent-toolkit). Documented best practices for agent builders include "Always use the sandbox environment for initial testing to avoid real transactions" and "Use well-defined system prompts to control the behavior of the agent."'),
        ('paypal-supp-llm-support', 'https://developer.paypal.com/ai-tools/build-with-llm.md',
         '"PayPal recently launched a Model Context Protocol (MCP) server that customers can use to access the power of PayPal using natural language with any AI agent. PayPal\'s remote MCP server now supports large language models (LLMs) from Anthropic and OpenAI" — the quickstart shows generating a client-credentials access token against api-m.paypal.com/v1/oauth2/token and wiring it to the remote server in cURL, Python, and TypeScript.'),
        # --- Agent Ready / agentic commerce (extra-17/20/21, extra-18/19) ---
        ('paypal-supp-agent-ready-protocols', 'https://developer.paypal.com/agent-ready/overview.md',
         '"Agent Ready helps Braintree merchants accept payments from AI shopping assistants across major platforms, including ChatGPT, Google AI Mode, and Gemini, without building separate integrations for each. PayPal supports two agentic commerce protocols": ACP ("Enable instant checkout in ChatGPT Apps using delegated payment tokens through Braintree") and UCP ("Enable the Buy button in Google AI Mode and Gemini using the Google Pay payment handler through Braintree"). "Accept payments initiated by AI agents on behalf of customers... Leverage your existing Braintree merchant account and processing relationship."'),
        ('paypal-supp-acp-ucp-guides', 'https://developer.paypal.com/agent-ready/agentic-commerce-protocol.md',
         'Both protocol integrations have full developer guides: the ACP guide walks through "build[ing] a custom ChatGPT app that accepts payments using the Agentic Commerce Protocol (ACP) and the ChatGPT Apps SDK... configuring Braintree as your payment provider, processing delegated payment tokens, and testing"; the UCP guide covers "the Google Pay payment handler for Google\'s Universal Commerce Protocol (UCP) with Braintree as your payment provider... where Google Pay returns a tokenized credential that Braintree can process" (developer.paypal.com/agent-ready/universal-commerce-protocol).'),
        ('paypal-supp-agentic-commerce-services', 'https://developer.paypal.com/agentic-commerce-services/about.md',
         '"Merchants can use PayPal\'s agentic commerce services to create AI-powered shopping experiences, so customers can shop using everyday language." Two documented pillars: Agent Ready ("accept payments through AI assistants with minimal changes to their current payment setup... supporting both supervised and automatic shopping scenarios") and Store Sync; catalog connections ship via "PayPal\'s partners like Wix, Cymbio, Commerce (BigCommerce & Feedonomics), and Shopware". Access is gated: "merchants must complete this form to contact the AI team at PayPal and request access."'),
        ('paypal-supp-store-sync', 'https://developer.paypal.com/store-sync/overview.md',
         'Store Sync "connects your product catalog and commerce API with PayPal\'s agentic commerce services, enabling AI agents to discover your products, create and manage shopping carts, and complete purchases on behalf of customers through conversational interfaces... Your existing order management system receives the order just as it would from any other channel." Scope is documented honestly: "Store Sync currently supports merchants who are selling physical goods to US-based customers in USD" and requires an Orders v2 or Braintree integration.'),
        # --- Braintree machine surface (site of the braintree family product) ---
        ('paypal-supp-braintree-graphql', 'https://developer.paypal.com/braintree/graphql/',
         'Braintree (PayPal\'s gateway) exposes a first-class GraphQL API — "Resources and tools to integrate with Braintree\'s GraphQL API" — with guides to "Set up your client", "Create a transaction", and "Vault a payment method", an in-browser API Explorer for testing queries, and an end-to-end example integration; graphql.braintreepayments.com redirects to this developer hub.'),
    ],
    'square': [
        # --- Remote MCP (extra-13 docs/mcp.md + extra-20 square-mcp-server README) ---
        ('square-supp-mcp-remote', 'https://developer.squareup.com/docs/mcp.md',
         '"The Square remote MCP server is hosted at: https://mcp.squareup.com/mcp... Square recommends using the remote MCP server, which supports OAuth login with more control and granular permissions. This lets you securely sign in with your Square account and authorize only the scopes your application needs, with no manual token management required." It "connects your AI tools directly to the full Square API platform, giving you programmatic access to everything the APIs offer", with documented setup for Claude.ai (Enterprise/Teams/Max integrations), Claude Desktop, Goose, Cursor, and Windsurf; "For testing, you can run a local instance configured to access a seller\'s Sandbox environment."'),
        ('square-supp-mcp-tools', 'https://raw.githubusercontent.com/square/square-mcp-server/HEAD/README.md',
         'The Square MCP server (github.com/square/square-mcp-server, Beta) uses a discovery-oriented tool design — `get_service_info` ("Discover methods available for a service"), `get_type_info` ("Get detailed parameter requirements"), and `make_api_request` ("Execute API calls to Square") — over a service catalog spanning payments, checkout, catalog, inventory, customers, orders, invoices, disputes, bookings, giftcards, labor, locations, and more. Local mode runs via `npx square-mcp-server start` with documented env controls including SANDBOX=true and `DISALLOW_WRITES=true` ("Restrict to read-only operations") plus SQUARE_VERSION pinning.'),
        # --- Agent-legible docs (live llms.txt, verified by square-probe-6) ---
        ('square-supp-llms-agent-guidance', 'https://developer.squareup.com/llms.txt',
         'Square\'s developer llms.txt declares the platform "Designed to be consumable by both human developers and AI agents" and ships explicit agent guidance: "For agents: every write endpoint accepts an idempotency key; every list endpoint supports cursor-based pagination... Use this file as the compact index for Square developer documentation. For full-document ingestion, fetch the full documentation corpus (developer.squareup.com/llms-full.txt). To answer specific questions, fetch only the relevant API links from this index instead of loading the full corpus unless explicitly needed." Docs pages also render as raw markdown by appending `.md` to the URL.'),
        # --- Built-in assistant (extra-14 squareup.com/us/en/ai) ---
        ('square-supp-square-ai-assistant', 'https://squareup.com/us/en/ai',
         'Square AI (Beta) is an in-product assistant for sellers: "Square AI is built into your everyday tools to pull game-changing insights from your data and handle routine tasks to help you get ahead... Skip the report hunting, filter setting, and manual analysis — just ask about your data." It answers natural-language questions over the seller\'s own sales/inventory data and "brings in web data so you can ask about local weather, events, news, and reviews"; seller testimonials describe using it to "quickly analyze our best-selling items to feature on our online ordering menus" and to "plot the contribution of loose candy over time".'),
        # --- GraphQL (extra-15/16) ---
        ('square-supp-graphql', 'https://developer.squareup.com/docs/devtools/graphql.md',
         'Square ships a GraphQL API alongside REST: "GraphQL queries can improve performance and reduce development time by letting you request exactly the data you need... One GraphQL query can retrieve data that requires multiple Square API calls", with a schema covering orders, catalog, customers, inventory, and other Square objects, plus a hosted GraphQL Explorer for building and running queries against Sandbox or production.'),
        # --- Interactive reference (extra-19 api-explorer.md) ---
        ('square-supp-api-explorer', 'https://developer.squareup.com/docs/devtools/api-explorer.md',
         '"API Explorer is an interactive web application you can use to build, view, and send HTTP requests that call Square APIs. API Explorer lets you test your requests using actual Sandbox or production resources in your account" — a documented interactive API reference wired to real accounts, complemented by API Logs ("view the request and response of API calls") and webhook event logs.'),
        # --- Scoped access (extra-17/18) ---
        ('square-supp-oauth-scopes', 'https://developer.squareup.com/docs/build-basics/access-tokens.md',
         'Square access is scope-controlled: "Access tokens are credentials that allow applications to securely interact with Square APIs. An access token authenticates your application and authorizes access to resources in a Square account", and the OAuth API "connect[s] your application to a seller\'s account using OAuth" with per-permission scopes — the same granular-permission model the remote MCP server\'s OAuth login uses ("authorize only the scopes your application needs").'),
    ],
}


def curl(url, method='GET', headers=None, data=None, include_headers=False):
    cmd = ['curl', '-s', '--max-time', '25', '-w', '\n---META %{http_code}']
    if include_headers:
        cmd.insert(1, '-i')
    if method != 'GET':
        cmd += ['-X', method]
    for h in headers or []:
        cmd += ['-H', h]
    if data is not None:
        cmd += ['-d', data]
    r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def mcp_oauth_probe(product, base):
    """Live-verify a hosted MCP server's keyless behavior: a bare JSON-RPC initialize gets an
    HTTP 401 with an RFC 9728 www-authenticate resource_metadata pointer, and that metadata
    resolves with authorization_servers. Fails loudly if reality changes."""
    status, raw = curl(f'{base}/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'{product} mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    meta_url = f'{base}/.well-known/oauth-protected-resource/mcp'
    status2, meta = curl(meta_url)
    if status2 != 200 or '"authorization_servers"' not in meta:
        raise SystemExit(f'{product} mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    meta_json = json.loads(meta)
    return ('PROBE mcp-oauth (' + NOW[:10] + f'): keyless JSON-RPC initialize to {base}/mcp answers HTTP 401 with '
            'www-authenticate: Bearer realm="OAuth", resource_metadata=' + meta_url + ' '
            '{"error":"invalid_token","error_description":"Missing or invalid access token"}; that metadata (HTTP 200) '
            'publishes ' + json.dumps(meta_json) +
            ' — a live, OAuth-gated remote MCP server per the MCP authorization spec.')


def llms_probe(product, url, require, extra=''):
    """Live-verify a keyless llms.txt (or .md) endpoint and quote its opening lines."""
    status, body = curl(url)
    if status != 200 or require not in body:
        raise SystemExit(f'{product} llms probe: {url} returned {status} or missing {require!r}: {body[:200]}')
    first = ' / '.join(line for line in body.splitlines()[:6] if line.strip())[:400]
    return ('PROBE llms-docs (' + NOW[:10] + f'): GET {url} returns HTTP 200; opening lines: "{first}"' + extra)


def adyen_probe():
    base = llms_probe('adyen', 'https://docs.adyen.com/llms.txt', '# Adyen Docs')
    status, body = curl('https://docs.adyen.com/development-resources/mcp-server.md')
    if status != 200 or 'Model Context Protocol' not in body:
        raise SystemExit(f'adyen md probe: mcp-server.md returned {status}')
    return (base + ' — the index links llms-full.txt ("the full concatenated Markdown corpus of every page") and states '
            '"Every page is also available as Markdown by appending `.md` to the URL" (live-verified: '
            'development-resources/mcp-server.md returns HTTP 200 text/plain markdown).')


def paypal_llms_probe():
    return llms_probe('paypal', 'https://developer.paypal.com/llms.txt', '# PayPal Developer Documentation',
                      ' — a sectioned index (get-started, payments, revenue incl. agentic commerce, developer '
                      'resources, platforms) where each section links its own per-area llms.txt page index, and '
                      'docs pages render as markdown at the same URL + `.md`.')


def square_llms_probe():
    return llms_probe('square', 'https://developer.squareup.com/llms.txt', 'Square Developer Platform',
                      ' — declares the docs "Designed to be consumable by both human developers and AI agents", '
                      'ships per-agent guidance (idempotency keys on every write endpoint, cursor pagination on '
                      'every list endpoint) and links the full corpus at developer.squareup.com/llms-full.txt.')


PROBES = {
    'adyen': [('adyen-probe-5', 'https://docs.adyen.com/llms.txt', adyen_probe)],
    'paypal': [
        ('paypal-probe-4', 'https://mcp.paypal.com/mcp', lambda: mcp_oauth_probe('paypal', 'https://mcp.paypal.com')),
        ('paypal-probe-5', 'https://developer.paypal.com/llms.txt', paypal_llms_probe),
    ],
    'square': [
        ('square-probe-5', 'https://mcp.squareup.com/mcp', lambda: mcp_oauth_probe('square', 'https://mcp.squareup.com')),
        ('square-probe-6', 'https://developer.squareup.com/llms.txt', square_llms_probe),
    ],
}


def main():
    for product in ('adyen', 'paypal', 'square'):
        path = f'open-rankings/payments/evidence/{product}.json'
        ev = json.load(open(path))
        existing = {e['id'] for e in ev}

        for iid, url, excerpt in DOC_ITEMS[product]:
            if iid in existing:
                print(f'{iid}: already present, skipping')
                continue
            ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {iid}')

        for probe_id, probe_url, run in PROBES[product]:
            if probe_id in existing:
                print(f'{probe_id}: already present, skipping')
                continue
            excerpt = run()
            ev.append({'id': probe_id, 'tier': 'probe', 'url': probe_url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {probe_id}')

        with open(path, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{product}: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
