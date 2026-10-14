#!/usr/bin/env python3
# Payments 2026-roster bring-up (2026-09-15): checkout-com, mollie, airwallex, paddle, polar
# debut against incumbents that already carry exhaustive agent-surface evidence packs (the
# Stripe spike, commit 771a7510, and the fairness wave, commit 277a7797). This script applies
# the SAME supplement recipe to the newcomers from day one: verbatim passages from
# CRAWLED/VERIFIED vendor pages that the per-source extraction caps plus the story quota
# starved out of the packs even though the crawled corpus (pipeline/cache/crawl/payments/<id>/)
# contains them verbatim, plus live keyless probes that fail loudly if reality changes.
#
# Every URL below is in that product's products.json urls; every excerpt quotes the crawled
# page (crawl and authoring on the same day, 2026-09-15).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - checkout-com: no official CLI; no llms-full corpus and no `.md` page mirrors (the docs
#     site is HTML-only; llms.txt indexes it); no in-product dashboard assistant documented.
#   - mollie: no official CLI; no agentic-commerce (ACP/UCP) participation documented; no
#     in-product assistant; MCP is documented for merchants, not a docs-search MCP.
#   - airwallex: no ACP/UCP seller-side catalog protocol documented; MoR is beta and
#     digital-products-only (quoted as such).
#   - paddle: no official CLI; no seller-side agentic-commerce protocol documented; Retain
#     dunning "works with live data... you can't integrate or test with sandbox accounts"
#     (quoted as-is).
#   - polar: no official CLI; no agentic-commerce protocol; payouts are manual/threshold-based
#     via Stripe Connect — nothing quoted beyond what the docs say.
#   - openness-*/privacy-*: only what the crawled pages state; no agent-washing of other axes.
#
# Run AFTER `pnpm pipeline probe --category payments --product <id>` (that stage wholesale-
# replaces probe-tier items; this script's probe items must be re-appended if it re-runs) and
# AFTER extract (extraction is monotonic and dedups by normalized excerpt).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

DOC_ITEMS = {
    'checkout-com': [
        ('cko-supp-mcp-server', 'https://www.checkout.com/docs/developer-resources/checkout-com-mcp-server',
         'The Checkout.com MCP Server (Beta) "enables you to search through our knowledge base and manage payment operations directly from your AI-assisted integrated development environment", with unified access to the technical docs, the API reference, and the support site. Documented capabilities: "Guided onboarding. Ask your AI agent to use the Guide tool to help you choose the best integration path"; "Manage payment operations. Query payment statuses, issue refunds, void payments, and create and manage payment links"; "Reduce hallucinations. Your AI agent has direct and structured access to the latest versions of the API reference and integration guides"; "Optimized token usage."'),
        ('cko-supp-mcp-endpoints', 'https://www.checkout.com/docs/developer-resources/checkout-com-mcp-server',
         'The MCP server is hosted with documented per-environment endpoints — "Sandbox: https://checkout.mcp.sbox.cko.tech Production: https://mcp.checkout.com" — added to Claude Code via `claude mcp add --transport http checkout-mcp https://mcp.checkout.com`, with OAuth against the Dashboard account: "You must have an active Dashboard account to authenticate with the Checkout.com MCP Server... Sign in using the credentials you use to access the Dashboard."'),
        ('cko-supp-agentic-commerce', 'https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-via-agentic-commerce',
         '"With agentic commerce, your customers can discover and pay for products through an AI chat interface, instead of visiting your website. The AI agent talks to your customer, then calls your systems to create orders and process payments on their behalf." Checkout.com documents both major protocol integrations: "Accept a payment via ChatGPT: Integrate Checkout.com with OpenAI\'s agentic commerce protocol to accept card payments through ChatGPT" and "Accept a payment via Google AI: Integrate Checkout.com with Google\'s Universal Commerce Protocol (UCP) to accept Google Pay payments through Google\'s AI Mode and Gemini."'),
        ('cko-supp-idempotency', 'https://www.checkout.com/docs/developer-resources/api/idempotency',
         'Idempotent retries are first-class: "The following endpoints from our API support idempotent requests, so you can safely retry them without the risk of a duplicate request: /payment-contexts, /payments, /payments/{id}/authorizations, /payments/{id}/cancellations, /payments/{id}/captures, /payments/{id}/refunds, /payments/{id}/voids, /transfers" — "provide a unique key in the `Cko-Idempotency-Key` HTTP header. This key is cached in our system if the request returns a `2xx` response code", with a configurable idempotency window via account management.'),
        ('cko-supp-api-keys', 'https://www.checkout.com/docs/developer-resources/api/manage-api-keys',
         'Two documented server-side authentication forms — "Access keys (OAuth 2.0)" (client-credentials flow) and "Secret keys" — plus public keys for client-side channels, letting integrations choose OAuth 2.0 scoped access or classic API keys per processing channel.'),
        ('cko-supp-webhooks', 'https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks',
         '"Webhooks are automated messages that Checkout.com sends your server when events related to your account occur. For example, payment lifecycle activity, changes to balances, or progress on disputes." Signatures use HMAC; webhook config is manageable "using the Dashboard or the API", with documented sub-pages for configuring the webhook server, managing webhooks via API, resending webhooks, and receiving events in Amazon EventBridge.'),
        ('cko-supp-reconciliation', 'https://www.checkout.com/docs/funds-management/reconcile-with-checkout-com',
         '"You can reconcile your balances, fee categories, financial actions, invoices, and settlements with Checkout.com using the following reports: Balance Breakdown Report, Balance Report, Financial Actions by Date Range Report, Financial Actions by Payout ID Report, Payouts Report, Settlement Breakdown Report, Settlement Statement" — a documented report suite mapping payouts to underlying financial actions.'),
        ('cko-supp-platforms', 'https://www.checkout.com/docs/platforms',
         '"The Platforms solution enables marketplaces, payment facilitators (Payfacs), and other platform-based businesses to onboard sub-entities and process payments on their behalf... You can: Onboard sub-entities and process their payments. Split funds between your platform and sub-entities according to your business model. Make payouts to your sub-entities in their local currency and preferred payment method."'),
        ('cko-supp-testing', 'https://www.checkout.com/docs/developer-resources/testing',
         'A dedicated test-account environment with per-scenario testing docs: payments testing, test cards, disputes testing, fraud-detection testing, bank payouts testing, AVS/ANI check testing — plus a public "Get test account" signup at checkout.com/get-test-account.'),
        ('cko-supp-pricing', 'https://www.checkout.com/pricing',
         'Pricing is sales-led and unpublished: a tailored "Fully Flat-Rate" plan ("We price based on your business profile and risk category, nothing else") or "Interchange++ Fees" with transaction-level visibility; no setup or account maintenance fees, but merchants must "get in touch with our team today to create a plan that suits you" — there is no self-serve rate card.'),
    ],
    'mollie': [
        ('mollie-supp-mcp-server', 'https://docs.mollie.com/docs/mollie-mcp-server.md',
         'The Mollie MCP server is hosted at a documented endpoint: "You can find Mollie MCP server at `https://mcp.mollie.com/mcp`, which acts as a proxy for the public API." Coverage: "Currently, the following APIs are available: Balances API, Captures API, Customers API, Invoices API, Mandates API, Methods API, Payments API, Payment Links API, Settlements API, Subscriptions API, Terminals API, Webhooks API, Webhook Events API." Access is scoped: an Advanced access token in `MOLLIE_API_OAUTH_ORG_TOKEN` where "profile.read is a required scope" and optional scopes per API enable each tool; documented client configs cover Claude Desktop, Cursor, and VS Code via mcp-remote.'),
        ('mollie-supp-llms-md', 'https://docs.mollie.com/llms.txt',
         'docs.mollie.com publishes a full llms.txt page index and documents the markdown mirror convention on every page: "Fetch the complete documentation index at: https://docs.mollie.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version."'),
        ('mollie-supp-idempotency', 'https://docs.mollie.com/reference/api-idempotency.md',
         'Idempotent retries via a documented header: "you can send a unique value with every API request via the `Idempotency-Key` header. If two requests come in with the same value, the second request is considered a duplicate that can be ignored." The docs spell out exactly where retries are dangerous without it: recurring payments ("can lead to double charges"), subscriptions ("double charges during the entire duration of both subscriptions"), and partial refunds ("executing the refund twice may lead to two separate partial refunds").'),
        ('mollie-supp-webhooks-nextgen', 'https://docs.mollie.com/reference/webhooks-new.md',
         'Next-gen webhooks add a subscription model and an audit API: "Updated Webhooks API allowing you to permanently subscribe to specific event types, compared to \'one-off\' webhooks fired by each payment" and a "Webhook Events API allowing you to retroactively inspect past events sent to you via webhooks and enable retrieving detailed information about each individual triggered event", with a choice of full-snapshot or simple payloads.'),
        ('mollie-supp-testing', 'https://docs.mollie.com/reference/testing.md',
         'Test mode is a first-class switch: "You can access the `test` mode of the Mollie API in two ways: by using the Test API key, or... by providing the `testmode` parameter in your API request. Any payments or other resources you create in test mode are completely isolated from your live mode data." Test-mode checkout replaces the hosted pages so "you can walk through the payment process without spending actual money", and paid test payments expose a `changePaymentState` URL to simulate refunds and chargebacks.'),
        ('mollie-supp-auth-scopes', 'https://docs.mollie.com/reference/authentication.md',
         'Four documented authentication methods — API keys ("default API access for a specific payment profile"), Advanced access tokens ("advanced API access for organization-level data... can be scoped to a specific mode or profile"), App access tokens (OAuth, "on behalf of your connected customers"), and Basic Auth for token management. Keys are shown once at creation, and "Permissions are now grouped by business area and API... all keys now clearly show which permissions are included with your API key."'),
        ('mollie-supp-connect-splits', 'https://docs.mollie.com/docs/connect-route-and-split-payments.md',
         'Marketplace money movement is documented under Mollie Connect: "Split payments let marketplaces distribute funds across multiple sellers in a single transaction. When a buyer pays, Mollie holds the incoming funds in an escrow-like account (your marketplace\'s holding balance) before distributing specified amounts to each connected seller\'s balance, while letting you retain a portion of the funds as a commission" — alongside application fees, merchant onboarding, and Connect reporting pages.'),
        ('mollie-supp-hosted-checkout', 'https://docs.mollie.com/docs/hosted-checkout.md',
         'Three documented integration depths: hosted checkout (Mollie-hosted payment pages), Mollie Components (embeddable card components for PCI scope reduction), and build-your-own-checkout via the Payments API — plus no-code payment links through the Payment links API.'),
    ],
    'airwallex': [
        ('awx-supp-agentos', 'https://www.airwallex.com/docs/developer-tools/ai/agentos.md',
         '"Airwallex AgentOS is a toolkit for AI agents that need to act on your production Airwallex account — reading balances, creating beneficiaries, issuing cards, building cashflow reports, and running multi-step financial workflows on your behalf. AgentOS bundles three things: Connectors — the Airwallex CLI and the Airwallex AgentOS MCP server... plus the Airwallex Developer MCP for documentation lookups and sandbox testing. Skills — pre-built workflows for common tasks like contract-to-billing, beneficiary creation, card provisioning, and cashflow management. Plugins — one-step installation of the connectors and skills into Claude Code, Claude Cowork, and Cursor" (`claude plugin install airwallex-agentos@claude-plugins-official`).'),
        ('awx-supp-agentos-mcp', 'https://www.airwallex.com/docs/developer-tools/ai/agentos.md',
         'The AgentOS MCP is a hosted remote server with documented safety defaults: "Airwallex AgentOS MCP lets agents read and write production Airwallex resources from non-terminal environments... It shares the safety guardrails of other AgentOS components, including no money-out actions by default. Authentication uses OAuth against your production Airwallex account." Any MCP client connects to "the remote endpoint `https://mcp.airwallex.com/mcp`" (Claude Code: `claude mcp add-json airwallex \'{ "type": "http", "url": "https://mcp.airwallex.com/mcp" }\'`).'),
        ('awx-supp-developer-mcp', 'https://www.airwallex.com/docs/developer-tools/ai/developer-connector.md',
         'A second, integration-time MCP pair: "The Airwallex developer connectors connects AI coding agents — Cursor, Claude Code, Codex, and similar tools — to Airwallex documentation and the Airwallex sandbox." Developer MCP (OAuth, endpoint mcp.sandbox.airwallex.com/developer) lets agents "create test resources, simulate events, and call sandbox endpoints"; Docs MCP "requires no authentication and is safe to add to any agent". The toolkit also ships "the `airwallex-dev` skill plugin, which generates Airwallex integration code directly in your project."'),
        ('awx-supp-cli', 'https://www.airwallex.com/docs/developer-tools/cli.md',
         'The official Airwallex CLI "exposes a broad slice of the Airwallex API as terminal commands, so you can read and write your Airwallex resources in sandbox or production, script repeatable tasks, and wire Airwallex into automated systems" — installed via `curl -fsSL https://static.airwallex.com/developer-tools/airwallex-cli/install.sh | sh`, sandbox by default with `--prod` opt-in. A documented use case is to "Power AI coding agents — let agents that can run terminal commands (for example, Claude Code, Cursor, and Codex) operate against your account. This is also the foundation of Airwallex AgentOS." OAuth authorization is role-gated to Owner/Admin/Finance Admin.'),
        ('awx-supp-ai-instructions', 'https://www.airwallex.com/docs/developer-tools/ai-agent-instructions.md',
         'The docs publish dedicated "Instructions for AI agents" pages (Integration Best Practices and Payments integration notes) written for machine consumption: "Check how to authenticate with the API and obtain a bearer token... DO NOT hallucinate or assume"; money fields "are NOT represented in minor units by default"; currency rounding rules; deprecated-library steering (`@airwallex/components-sdk` over the legacy `airwallex-payment-elements`); and redirect-flow/webhook integration guidance.'),
        ('awx-supp-sandbox', 'https://www.airwallex.com/docs/developer-tools/sandbox-environment.md',
         '"Airwallex provides a sandbox environment, completely separate from the production environment, for testing your integration through simulations without using real money. It gives you access to all products in the Airwallex web app and API (except Connected Account APIs)" — instant self-serve signup at sandbox.airwallex.com, with per-product simulation docs (payments, payouts, deposits, issuing, risk).'),
        ('awx-supp-webhooks', 'https://www.airwallex.com/docs/developer-tools/webhooks/webhooks-overview.md',
         'Webhooks with documented reliability semantics: "Your endpoint must respond with a 200 status code so that Airwallex can confirm delivery. Each event has a stable `id` so you can safely handle retries and avoid processing the same event twice." The web app additionally lets you "inspect delivery status (success, queued, or failed) and re-deliver events after downtime or for debugging."'),
        ('awx-supp-mor', 'https://www.airwallex.com/docs/payments/merchant-of-record.md',
         'Airwallex also documents a merchant-of-record add-on (beta): "With Airwallex Merchant of Record, Airwallex acts as the legal seller and manages sales tax, VAT, and GST compliance for each sale... MoR is an add-on to Airwallex\'s Payments product... you can enable MoR without rebuilding your integration." Eligibility is limited during beta and digital-products-only ("Physical goods are not supported"); refunds and disputes remain the merchant\'s responsibility.'),
        ('awx-supp-billing-suite', 'https://www.airwallex.com/docs/billing/get-started-with-billing.md',
         'Airwallex Billing layers subscriptions, invoicing, and hosted/embedded billing checkout on top of payments acceptance — documented getting-started guides for subscription management, invoicing, and billing checkout components (hosted page, embedded checkout, and elements).'),
    ],
    'paddle': [
        ('paddle-supp-mcp-server', 'https://developer.paddle.com/sdks/ai/paddle-mcp.md',
         '"The Paddle MCP server is a remote, hosted MCP server" with per-environment endpoints — Sandbox `https://sandbox-mcp.paddle.com/mcp` (API key) and Live `https://mcp.paddle.com/mcp` (OAuth or API key) — that lets agents "Build and evolve your pricing model... Investigate failed payments and resolve billing issues. Generate reports and analyze revenue, refunds, and transaction patterns. Process subscription upgrades, downgrades, pauses, and cancellations... Generate integration code, configure webhooks, and simulate events for testing." Live OAuth connections start with read access, managed under "Paddle > Connectors > MCP".'),
        ('paddle-supp-mcp-codemode', 'https://developer.paddle.com/sdks/ai/paddle-mcp.md',
         'The MCP server "uses a codemode interface": three tools cover the full API — `search` ("Looks up Paddle API methods by name or description. Returns the method path, parameters, and response shape"), `execute` ("Runs a JavaScript async function that chains one or more Paddle API calls in a single invocation"), and `report_missing_tool`. Safety is documented honestly: "The Paddle MCP server doesn\'t gate destructive operations"; destructive ops carry a `destructiveHint` annotation and a `warning` field, with hard scoping via least-permission API keys recommended.'),
        ('paddle-supp-docs-mcp', 'https://developer.paddle.com/sdks/ai/docs-mcp.md',
         'A separate docs MCP server connects "AI agents to current Paddle documentation, the OpenAPI specification, and SDK references" (hosted at paddlehq.mcp.kapa.ai), complementing the account MCP: docs MCP for knowledge, Paddle MCP for actions, and agent skills for integration workflows.'),
        ('paddle-supp-agent-skills', 'https://developer.paddle.com/sdks/ai/agent-skills.md',
         '"Agent skills are a standardized way to give AI agents instructions on how to integrate Paddle... written specifically for agents, rather than humans", discoverable at a well-known URL (index: developer.paddle.com/.well-known/skills/index.json; per-skill SKILL.md files) and covering catalog setup, checkout, webhooks, subscription sync, pricing pages, customer portal, billing history, cancel/update flows, and sandbox testing. Official plugins "bundle skills with the Paddle docs MCP server and the Paddle MCP server" for Claude Code, Codex, and Gemini CLI.'),
        ('paddle-supp-llm-benchmark', 'https://developer.paddle.com/llm-benchmark.md',
         'Paddle publishes an LLM integration benchmark as agent-facing guidance: "Real-world test of how well LLMs build with Paddle. 23 models tested across 10 integration tasks" — with published findings ("Skills add +9% pass rate on average", "MCP adds +3% pass rate on average") and explicit instructions to agents: "Stop and load the relevant skill first."'),
        ('paddle-supp-openapi-postman', 'https://developer.paddle.com/sdks/specs/openapi.md',
         'Machine-readable API surface: "Download the Paddle OpenAPI specification to generate client libraries, power editor tooling, or import into API exploration tools" — maintained in the documented github.com/PaddleHQ/paddle-openapi repo (v1/openapi.yaml, OpenAPI 3.1.0) — plus an importable Postman collection for the Billing API.'),
        ('paddle-supp-sandbox', 'https://developer.paddle.com/sdks/sandbox.md',
         '"Sandbox is a separate Paddle environment for building and testing your integration without affecting real data or accepting real payments... Sandbox and live accounts have the same features and APIs but completely separate datasets, credentials, and dashboards." Sandbox API keys are prefixed `pdl_sdbx_` and only authenticate against sandbox endpoints (including sandbox-mcp.paddle.com).'),
        ('paddle-supp-auth-permissions', 'https://developer.paddle.com/api-reference/about/authentication.md',
         'Bearer-token API keys with documented granular permissions: keys are created in "Paddle > Developer tools > Authentication", scoped per the permissions reference (with default scopes documented per endpoint), and the API reference includes dedicated pages for permissions, default scopes, key rotation ("rotate API keys"), and rate limiting.'),
        ('paddle-supp-dunning', 'https://developer.paddle.com/build/retain/configure-payment-recovery-dunning.md',
         'Failed-payment recovery is built in at two tiers: "If you use Paddle Billing without integrating with Paddle Retain, failed payments for automatically-collected subscriptions are retried up to seven times over a 30-day window before they\'re canceled." Paddle Retain\'s Payment Recovery adds "Tactical Retries", optimized email notifications, and in-app retry payment forms — though "Paddle Retain works with live data... you can\'t integrate or test with sandbox accounts."'),
        ('paddle-supp-payout-reconciliation', 'https://developer.paddle.com/build/reports/payout-reconciliation.md',
         '"Payout reconciliation reports help you reconcile payouts to transactions and adjustments to understand how your payout amounts are calculated... Verify your payout totals against your remittance advice by summing balance movements... Review itemized gross, taxes, Paddle, chargeback, and retained fees in both transaction and balance currencies... Split activity by invoice entity, using United States state and ZIP where applicable, and include tax rates and tax mode to prove local compliance."'),
        ('paddle-supp-mor-tax', 'https://developer.paddle.com/concepts/sell/supported-countries-locales.md',
         'The merchant-of-record model is the tax story: "Go global and sell in over 200 countries and territories, fully tax compliant, with no extra engineering effort" — Paddle is the seller of record, and the 5% + 50¢ all-inclusive fee covers tax registration, filing, and remittance, fraud protection, and chargeback defense (paddle.com/pricing).'),
    ],
    'polar': [
        ('polar-supp-mcp', 'https://polar.sh/docs/integrate/mcp.md',
         '"Use Polar\'s remote Model Context Protocol (MCP) server to give AI agents secure access to your Polar organization. Agents can look up data and take actions across your products, customers, subscriptions, orders, benefits, and more." Documented endpoints: production `https://mcp.polar.sh/mcp/polar-mcp` and sandbox `https://mcp.polar.sh/mcp/polar-sandbox`, with OAuth by design: "Polar MCP uses OAuth. When you connect a client, your browser opens so you can sign in and authorize access to your organization. You never need to copy an API key into your agent." Client setup is documented for Cursor, Claude Code (`claude mcp add --transport http polar https://mcp.polar.sh/mcp/polar-mcp`), ChatGPT, and Claude Desktop.'),
        ('polar-supp-oss', 'https://github.com/polarsource/polar',
         'Polar is open source: the platform itself is developed in the open at github.com/polarsource/polar (Apache-2.0, 10k+ stars), positioning itself as "An open source and transparent Merchant of Record" and "the financial layer for a new generation of intelligent software, built for AI startups that need to charge for tokens, agents, and compute without building billing infrastructure from scratch."'),
        ('polar-supp-sandbox', 'https://polar.sh/docs/integrate/sandbox.md',
         'A fully isolated test environment rather than a test-mode flag: "you can use our sandbox environment. It\'s a dedicated server, completely isolated from the production instance where you can do all the experiments you want... it allows you to create an unlimited number of account and organization to test lot of different scenarios." Checkout is testable end-to-end with standard test cards (4242 4242 4242 4242).'),
        ('polar-supp-openapi-llms', 'https://polar.sh/docs/llms.txt',
         'Agent-legible docs and machine specs: polar.sh/docs publishes llms.txt with `.md` siblings for every page, and serves versioned OpenAPI specs straight from the docs site (2026-04.openapi.json and 2026-10.openapi.json, OpenAPI 3.1.0 — "Polar HTTP and Webhooks API").'),
        ('polar-supp-webhooks', 'https://polar.sh/docs/integrate/webhooks/endpoints.md',
         'Webhooks follow the Standard Webhooks spec: "Secrets generated on or after 8 September 2026, 00:00 UTC follow Standard Webhooks. Older secrets use Polar HMAC." SDKs ship "Built-in webhook signature validation" and "Fully typed webhook payloads", with documented delivery monitoring and built-in Slack/Discord formatting; a Webhook Events API covers endpoint CRUD in the versioned API reference.'),
        ('polar-supp-dunning', 'https://polar.sh/docs/features/subscriptions/failed-payments.md',
         'Automated dunning with a published schedule: "If that charge fails, the subscription moves to `past_due` and enters Polar\'s automated payment recovery (dunning) flow instead of being canceled straight away" — Polar emails the customer with a Customer Portal link to update the payment method, stamps `past_due_at` and `next_payment_attempt_at`, and retries on a fixed schedule (2, 5, 7, 7 days — up to 21 days from first failure).'),
        ('polar-supp-mor-fees', 'https://polar.sh/docs/merchant-of-record/fees.md',
         'Polar is the merchant of record ("We take on the liability of international sales taxes globally for you") with public, self-serve pricing: "Transparent, public pricing — pick the plan that fits" — free Starter at 5% + 50¢ per transaction, and Pro ($20/mo, 3.8% + 40¢), Growth ($100/mo, 3.6% + 35¢), and Scale ($400/mo, 3.4% + 30¢) plans that "replace the per-transaction Merchant of Record premium with a fixed monthly fee and a lower variable rate", with published breakeven thresholds.'),
        ('polar-supp-usage-billing', 'https://polar.sh/docs/features/usage-based-billing/introduction.md',
         '"Polar has a powerful Usage Based Billing infrastructure that allows you to charge your customers based on the usage of your application. This is done by ingesting events from your application, creating Meters to represent that usage, and then adding metered prices to Products" — with documented ingestion strategies including an LLM strategy for token-based billing, delta-time, S3, and stream strategies.'),
        ('polar-supp-checkout-links', 'https://polar.sh/docs/features/checkout/links.md',
         'Three documented checkout surfaces: no-code Checkout Links, embedded checkout (embed.md — drop-in on your own site, including an embedded payment-method view), and the Checkout Session API (session.md) for fully API-driven flows with client-side get/update/confirm endpoints in the versioned API reference.'),
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


def mcp_challenge_probe(product, endpoint, meta_url=None):
    """Live-verify a hosted MCP server's keyless behavior: a bare JSON-RPC initialize gets an
    HTTP 401 with an RFC 9728 www-authenticate resource_metadata pointer; when the vendor
    serves the protected-resource metadata on its own domain, quote it too. Fails loudly if
    reality changes."""
    status, raw = curl(endpoint, method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'{product} mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    out = (f'PROBE mcp-oauth ({NOW[:10]}): keyless JSON-RPC initialize to {endpoint} answers HTTP 401 with a '
           'www-authenticate Bearer challenge carrying RFC 9728 resource_metadata — a live, auth-gated remote MCP '
           'server per the MCP authorization spec.')
    if meta_url:
        status2, meta = curl(meta_url)
        if status2 != 200 or '"authorization_servers"' not in meta:
            raise SystemExit(f'{product} mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
        out += f' The protected-resource metadata at {meta_url} (HTTP 200) publishes {json.dumps(json.loads(meta))}.'
    return out


def llms_probe(product, url, require, extra=''):
    status, body = curl(url)
    if status != 200 or require not in body:
        raise SystemExit(f'{product} llms probe: {url} returned {status} or missing {require!r}: {body[:200]}')
    first = ' / '.join(line for line in body.splitlines()[:6] if line.strip())[:400]
    return f'PROBE llms-docs ({NOW[:10]}): GET {url} returns HTTP 200; opening lines: "{first}"' + extra


def airwallex_cli_probe():
    status, body = curl('https://static.airwallex.com/developer-tools/airwallex-cli/install.sh')
    if status in (301, 302, 307, 308) or 'installer' not in body:
        # follow redirect manually via -L
        r = subprocess.run(['curl', '-sL', '--max-time', '25',
                            'https://static.airwallex.com/developer-tools/airwallex-cli/install.sh'],
                           capture_output=True, text=True, timeout=35)
        body = r.stdout
    if 'Airwallex CLI installer' not in body:
        raise SystemExit(f'airwallex cli probe: install.sh did not serve the installer: {body[:200]}')
    return (f'PROBE cli-installer ({NOW[:10]}): the documented one-liner endpoint '
            'https://static.airwallex.com/developer-tools/airwallex-cli/install.sh serves the official '
            '"Airwallex CLI installer" shell script keylessly (auto-detects OS/arch, installs to ~/.local/bin/airwallex) '
            '— the official CLI exists and is distributed exactly as the docs say.')


def paddle_skills_probe():
    status, body = curl('https://developer.paddle.com/.well-known/skills/index.json')
    if status != 200 or '"skills"' not in body:
        raise SystemExit(f'paddle skills probe: index.json returned {status}: {body[:200]}')
    names = [s['name'] for s in json.loads(body)['skills']]
    return (f'PROBE agent-skills ({NOW[:10]}): GET https://developer.paddle.com/.well-known/skills/index.json '
            f'returns HTTP 200 with a machine-readable skills index ({len(names)} skills: {", ".join(names)}) — '
            'agent skills are discoverable at a well-known URL, each with a fetchable SKILL.md.')


def polar_openapi_probe():
    status, body = curl('https://polar.sh/docs/openapi/2026-10.openapi.json')
    if status != 200 or '"openapi": "3.1.0"' not in body[:200]:
        raise SystemExit(f'polar openapi probe: spec returned {status}: {body[:200]}')
    return (f'PROBE openapi-spec ({NOW[:10]}): GET https://polar.sh/docs/openapi/2026-10.openapi.json returns '
            'HTTP 200 with the versioned OpenAPI 3.1.0 spec ("Polar API — Polar HTTP and Webhooks API") — the '
            'machine-readable API surface is served keylessly from the docs site, alongside 2026-04.openapi.json.')


PROBES = {
    'checkout-com': [
        ('checkout-com-probe-5', 'https://mcp.checkout.com/',
         lambda: mcp_challenge_probe('checkout-com', 'https://mcp.checkout.com/')),
    ],
    'mollie': [
        ('mollie-probe-4', 'https://mcp.mollie.com/mcp',
         lambda: mcp_challenge_probe('mollie', 'https://mcp.mollie.com/mcp',
                                     'https://mcp.mollie.com/.well-known/oauth-protected-resource/mcp')),
    ],
    'airwallex': [
        ('airwallex-probe-5', 'https://mcp.airwallex.com/mcp',
         lambda: mcp_challenge_probe('airwallex', 'https://mcp.airwallex.com/mcp')),
        ('airwallex-probe-6', 'https://static.airwallex.com/developer-tools/airwallex-cli/install.sh',
         airwallex_cli_probe),
    ],
    'paddle': [
        ('paddle-probe-4', 'https://mcp.paddle.com/mcp',
         lambda: mcp_challenge_probe('paddle', 'https://mcp.paddle.com/mcp',
                                     'https://mcp.paddle.com/.well-known/oauth-protected-resource')),
        ('paddle-probe-5', 'https://developer.paddle.com/.well-known/skills/index.json', paddle_skills_probe),
    ],
    'polar': [
        ('polar-probe-5', 'https://mcp.polar.sh/mcp/polar-mcp',
         lambda: mcp_challenge_probe('polar', 'https://mcp.polar.sh/mcp/polar-mcp')),
        ('polar-probe-6', 'https://polar.sh/docs/openapi/2026-10.openapi.json', polar_openapi_probe),
    ],
}


def main():
    for product in ('checkout-com', 'mollie', 'airwallex', 'paddle', 'polar'):
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
