#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15): Stripe-style exhaustive agent-surface evidence pass for
# RAMP, in BOTH arenas that track it — expense-management and startup-banking (separate packs:
# rankings/<arena>/evidence/ramp.json). Same supplement recipe as
# append-payments-fairness-agentic-evidence.py: verbatim passages from CRAWLED/VERIFIED vendor
# pages that the per-source extraction caps plus the 40-story quota starved out of the packs.
# This wave's crawl added 12 expense-management and 18 startup-banking agent-surface urls.extra
# pages; extract surfaced only ~13/16 mostly one-line items from them.
#
# Every URL below is in that arena's ramp products.json urls (or is the live endpoint a probe
# verifies, or agents.ramp.com — live-verified 2026-09-15, served with a text/markdown alternate
# that the crawler's HTML converter would mangle, so it is quoted here instead of crawled).
#
# Verified-honest absences (NO doc items added, on purpose):
#   - No .md-suffix docs mirrors: docs.ramp.com HTML pages are JS shells (llms.txt says so
#     explicitly); the machine-readable surface is /llms-guides/*.txt + /llms-api.txt +
#     /llms-full.txt + /openapi/developer-api.json.
#   - No /.well-known/skills/index.json on ramp.com or docs.ramp.com (404 / JS shell,
#     checked 2026-09-15). Skills ship inside the CLI (`ramp skills`) and agents.ramp.com/skills.
#   - Bill approvals are NOT available via MCP ("Bill approvals aren't yet available via MCP")
#     — quoted with the gap intact.
#   - Ramp Data MCP "requires provisioned access" (partner program) — quoted with the gate.
#   - Incorporation API is "Private preview only", endpoints return 404 unless enabled — quoted
#     with the gate.
#   - demo-mcp.ramp.com (sample data) still requires OAuth (401 keyless, checked 2026-09-15);
#     only the Developer MCP (docs) server is fully unauthenticated.
#   - openness-*/privacy-*: out of this wave's scope; no agent-washing of unrelated axes.
#
# Run AFTER `pnpm pipeline extract --product ramp` in both arenas (extraction is monotonic and
# dedups by normalized excerpt, so re-running extract after this keeps these items stable). If
# `pnpm pipeline probe` ever wholesale-replaces probe-tier items, re-run this script to restore
# ramp-probe-4/5/6 (expense-management) and ramp-probe-4/5 (startup-banking).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

# --- shared verbatim supplements (same vendor surface, quoted into both packs where the
# arena's stories can use them; ids are unique within each pack) ---

SUPP_AI_AGENTS_CHANNELS = (
    'ramp-supp-ai-agents-channels', 'https://docs.ramp.com/llms-guides/build-for-ai-agents.txt',
    '"Give an AI agent read access, action authority, and (with approval) real purchasing power on Ramp — through MCP, the Ramp CLI, or both. Every action respects the authenticated user\'s role and lands in the Ramp audit log." The AI Agents guide documents two channels: MCP for "Off-the-shelf assistants (Claude, ChatGPT, Cursor, Claude Code, etc.) and any MCP-compatible tool" and the Ramp CLI for "Coding agents (or any agent with terminal access) and scripted/scheduled workflows"; "Estimated time: 5–15 minutes to your first agent action via MCP." Capabilities span reads ("Search transactions by merchant, amount, date, or user. Pull full spend exports and run SQL-style analysis (admins). Load vendor lists, accounting categories, tracking categories, departments, entities, treasury balances, and the org chart"), approvals ("Approve or reject transactions, reimbursements, and unified requests (purchase orders, fund requests, procurement approvals)"), edits, policy Q&A, and purchases. Honest gap kept verbatim: "Bill approvals aren\'t yet available via MCP — use the Ramp UI or the Blank Canvas Approvals API for now."')

SUPP_MCP_SERVER = (
    'ramp-supp-mcp-server', 'https://docs.ramp.com/llms-guides/ramp-mcp.txt',
    '"Ramp MCP allows you to securely connect Ramp with AI assistants like ChatGPT and Claude, so you can query Ramp data and take actions with natural language. Admins can analyze data to identify spend trends and forecasting insights, while employees can check balances, request reimbursements, or get policy answers directly from their daily tools." Production server: https://mcp.ramp.com/mcp; demo data: https://demo-mcp.ramp.com/mcp. Multi-business support is documented ("Ramp treats any unused path in the form https://mcp.ramp.com/<business-identifier>/mcp as an alias for the production Ramp MCP server"), and admin access control is built in: "Navigate to Company → Integrations → Ramp MCP in your Ramp dashboard... Set restrictions based on roles, departments, or specific users... Employee Tools: Available to all Ramp users, but respect individual user permissions... Admin Tools: Only available to users with admin or business owner permissions."')

SUPP_THREE_MCP = (
    'ramp-supp-three-mcp-servers', 'https://docs.ramp.com/llms-guides/mcp.txt',
    '"The Model Context Protocol (MCP) lets AI assistants talk to your systems directly—no copy-paste, no context switching. Ramp ships three MCP servers, each scoped to a different audience": Ramp MCP (account-scoped, https://mcp.ramp.com/mcp), Developer MCP (unauthenticated docs server, https://mcp.ramp.com/developer/mcp — "It gives AI assistants live access to Ramp\'s developer documentation, API reference, and OpenAPI schemas... does not require a Ramp account, OAuth login, API key, or developer app", with tools like developer_docs_search / developer_docs_schema / developer_docs_read), and Ramp Data MCP (https://mcp.ramp.com/ramp-data/mcp, "exposes Ramp\'s datasets — Ramp Rate software benchmarks and AI Index business AI adoption metrics"; access is gated: "Ramp Data requires provisioned access. Apply to the Ramp Data Partner Program to request credentials").')

SUPP_CLI = (
    'ramp-supp-cli-agent-mode', 'https://raw.githubusercontent.com/ramp-public/ramp-cli/HEAD/README.md',
    'The open-source Ramp CLI (github.com/ramp-public/ramp-cli) installs via `curl -fsSL https://agents.ramp.com/install.sh | sh` or `brew install ramp-public/ramp/ramp-cli`, authenticates with browser OAuth (`ramp auth login`), and is built for agents: "`--agent` outputs JSON for scripting and AI agent consumption" (default when piped), `--no-input` disables prompts for CI, and 12 resources cover accounting, bills (search/get/draft/pending/approve), cards, funds (list/activate/creds/lock), purchase-orders, receipts (upload/attach), reimbursements (list/pending/submit/approve/edit), requests, transactions (list/get/approve/edit/missing/flag-missing/explain-missing/memo-suggestions/trips), travel, and users (me/search/org-chart). Standalone agents get first-class auth: "Standalone agents authenticate without a browser by exchanging OAuth client credentials for a production access token" (`ramp --env production agent login`, RAMP_CLIENT_ID/RAMP_CLIENT_SECRET), and `ramp profile human` / `ramp profile agent` switch stored identities — "RAMP_PROFILE pins an identity for automation."')

SUPP_AGENT_CARDS = (
    'ramp-supp-agent-cards', 'https://docs.ramp.com/llms-guides/build-for-ai-agents.txt',
    'Agent Cards give agents real, constrained payment authority: the CLI ships packaged skills, and "agentic-purchase — drives the Agent Cards capability end-to-end (request credential → checkout → audit)". "The credential is merchant- and amount-scoped, requested immediately before one checkout, and not for subscriptions or later merchant charges; use Virtual Cards for those reusable cases." Guardrails are documented: "Required for Agent Cards: at least one active fund"; "Spend programs — back agent purchases with recurring-budget templates"; "Audit log — every write operation lands in the customer\'s Ramp audit log automatically, no extra wiring"; sessions expire ("Read-only sessions expire one week after last use. Read-write sessions expire 24 hours after last use").')

SUPP_AGENTS_SITE = (
    'ramp-supp-agents-site', 'https://agents.ramp.com/',
    'agents.ramp.com — "Finance for teams that run on agents. Ramp lets your AI agents buy, pay, procure, and complete work through Ramp while every transaction stays connected to the business context finance teams need." Documented agent-identity model: "One key per agent — tied to a human sponsor on your team. Flexible permissions — decide what each agent can read and do. Long-running access — for background agents that run on a schedule. Full attribution — every action traces back to the agent that took it." Payment controls: "Flexible spend restrictions — per agent, per task, per merchant. Customizable human-in-the-loop policy — auto-approve the routine, hold what matters for a human. Auto-expiring cards — from seconds to quarters. No pre-funding needed — run on credit, settle later." (Live-verified 2026-09-15; the page ships a text/markdown alternate for machine readers.) The agentic-purchase skill page (agents.ramp.com/skills/ramp-agentic-purchase) documents "End-to-end agent card purchasing: pick a fund, get a payment token via `ramp` CLI, pay via browser, then fill all missing transaction items", single-use tokens ("Each call returns a fresh CVV — get creds immediately before checkout"), a mandatory audit rationale ("--rationale is required on every subcommand"), and hard human-handoff rules ("Stop if anything unexpected happens. 3DS challenge, login wall, CAPTCHA, bot-block page... screenshot, hand off to the user").')

SUPP_MACHINE_DOCS = (
    'ramp-supp-machine-docs', 'https://docs.ramp.com/llms.txt',
    'docs.ramp.com publishes a full machine-readable docs surface: llms.txt is a "Machine-readable index for Ramp\'s Developer API documentation" with explicit agent usage instructions ("If you are given a docs URL on docs.ramp.com... do not fetch the rendered HTML page for content. These pages are JavaScript shells... fetch the matching file under /llms-guides/"), per-guide plain-text exports (/llms-guides/<slug>.txt), a plain-text API reference (/llms-api.txt, "Generated endpoint and schema reference"), full exports (/llms-guides.txt and /llms-full.txt, "Single file with both guides and endpoint reference"), and the canonical OpenAPI schema at /openapi/developer-api.json. The index also ships "Automation Recommendations" telling agents which channel to pick: MCP for conversational workflows, the CLI ("The CLI outputs JSON in agent mode and is built for scripted loops"), webhooks for event triggers, and the Developer API for server-to-server.')

SUPP_SANDBOX = (
    'ramp-supp-sandbox', 'https://docs.ramp.com/llms-guides/sandbox.txt',
    '"The Ramp sandbox is a testing environment where developers and partners can safely build, test, and experiment with Ramp\'s API without affecting live production data." Documented endpoints: Ramp frontend https://demo.ramp.com and API base https://demo-api.ramp.com; "No real money movement: Demo accounts cannot process actual financial transactions." The sandbox ships simulation hooks: "You can simulate user events through the demo actions panel... directly within the Ramp sandbox with ⌘ J" — pay current bill, mark reimbursement as paid, add transactions. The CLI defaults to it ("By default, the CLI connects to the Sandbox environment") and Ramp MCP works against sandbox accounts.')

SUPP_WEBHOOKS = (
    'ramp-supp-webhooks', 'https://docs.ramp.com/llms-guides/webhooks.txt',
    '"Webhooks allow your application to receive real-time notifications about events that occur in your Ramp account. Instead of polling our API, webhooks push notifications to your specified endpoint whenever an event happens." llms.txt names webhooks "the canonical surface for any event-driven workflow" — "For \'notify me when X happens\' workflows — large transactions, bill approvals, card issuance, status changes, anomaly conditions: Use Ramp Webhooks... with a handler service (Lambda, Ramplify, Cloud Run, or similar)."')

SUPP_SCOPES = (
    'ramp-supp-oauth-scopes', 'https://docs.ramp.com/llms-guides/authorization.txt',
    '"Ramp uses OAuth 2.0 for secure API access, providing granular permission control through scopes and supporting multiple authorization flows for different use cases" — Client Credentials ("Internal integrations, server-to-server"), Authorization Code ("Third-party apps, public integrations"), and Refresh Token grants. "Ramp\'s permission model uses OAuth 2.0 scopes to control access to different resources and operations. Most resource scopes follow the pattern resource:permission" (transactions:read, bills:write, cards:read_vault for "sensitive card data (PAN, CVV)", bank_accounts:read, applications:write, ...) and the guidance is least-privilege: "configure only the scopes your app needs."')

SUPP_RAMP_AI = (
    'ramp-supp-ramp-agents-product', 'https://ramp.com/ai',
    'Ramp\'s in-product AI is a named, shipping layer: "Ramp Intelligence" is "a layer of AI technology that sits across all our products", and Ramp agents are positioned as autonomous finance teammates — "Think of Ramp agents as the best associates you\'ve ever met—fast, accurate, and they never complain about paperwork." Documented autonomous behaviors: "Learning from past invoices, Ramp\'s agent applies your logic instantly during processing"; "Approves when it\'s safe. Escalates when it\'s not"; "Ramp agents scan transactions in real-time for anomalies"; "Ramp automates each step, from collecting receipts to drafting memos." Guardrails quoted verbatim: "No money ever moves without a human confirmation" and agents "flag anything unclear or risky immediately for your review."')

DOC_ITEMS = {
    'expense-management': [
        SUPP_AI_AGENTS_CHANNELS,
        SUPP_MCP_SERVER,
        SUPP_THREE_MCP,
        SUPP_CLI,
        SUPP_AGENT_CARDS,
        SUPP_AGENTS_SITE,
        SUPP_MACHINE_DOCS,
        SUPP_SANDBOX,
        SUPP_SCOPES,
        SUPP_RAMP_AI,
        # --- expense-arena-specific ---
        ('ramp-supp-virtual-cards-vault', 'https://docs.ramp.com/llms-guides/virtual-cards.txt',
         'Virtual cards are programmable end-to-end: "Issue fund-backed virtual cards for people or conventional backend payment flows. Deliver card details to a user\'s browser through a Ramp-served iframe, or retrieve them through the Vault API for an approved server-side flow" — "Vault API (server-side) — your backend creates a card and retrieves the PAN, CVV, and expiration in one synchronous call" (gated behind the cards:read_vault scope and Ramp approval).'),
        ('ramp-supp-ai-usage-tracking', 'https://docs.ramp.com/llms-guides/ai-usage.txt',
         'Ramp ingests AI spend telemetry as a first-class integration: "Add a Ramp broadcast destination to your AI platform so customers can bring their Ramp API key and receive their own model usage, token, cost, and attribution data in Ramp." Platforms POST batches to /developer/v1/ai-usage/unified ("Each event includes model, provider, token usage, pricing context, optional reported cost, optional latency, and customer attribution metadata"), authenticated by a customer-generated key "scoped to ai_usage:write"; "Ramp ingests the events into the customer\'s AI spend analytics without requiring them to poll invoices, scrape dashboards, or maintain per-provider ETL."'),
        ('ramp-supp-spend-controls-agents', 'https://docs.ramp.com/llms-guides/spend-controls.txt',
         'Spend controls are documented as "The policy layer behind every dollar spent on Ramp — budgets, templates, and approval workflows that apply equally to cards, reimbursements, bills, and agent purchases." Funds are "A budget with restrictions — amount, interval (daily, monthly, total), allowed merchant categories, allowed merchants, allowed countries" — the same primitives that constrain what an AI agent can spend (per the AI Agents guide: "Funds — funds that constrain what an agent can spend"; "Spend programs — back agent purchases with recurring-budget templates instead of one-off funds").'),
    ],
    'startup-banking': [
        SUPP_AI_AGENTS_CHANNELS,
        SUPP_MCP_SERVER,
        SUPP_THREE_MCP,
        SUPP_CLI,
        SUPP_AGENT_CARDS,
        SUPP_AGENTS_SITE,
        SUPP_MACHINE_DOCS,
        SUPP_SANDBOX,
        SUPP_WEBHOOKS,
        SUPP_SCOPES,
        SUPP_RAMP_AI,
        # --- banking-arena-specific ---
        ('ramp-supp-banking-api', 'https://docs.ramp.com/llms-guides/banking.txt',
         'The Banking API reads a business\'s cash position programmatically: "Read the cash position of a Ramp business — the accounts holding it and how their available balance has moved day over day." Documented account types map to products: WALLET_ACCOUNT ("Checking Account — the operating-cash deposit account. A business can have more than one"), BROKERAGE_ACCOUNT ("Ramp Investment Account — a self-directed money market position"), MANAGED_PORTFOLIO_ACCOUNT ("Managed Portfolio — a fixed-income portfolio managed by Moment Advisors. Currently in limited release"). Endpoints: "GET /developer/v1/banking/accounts returns the set above for the calling business. GET /developer/v1/banking/accounts/{account_id}/balance-history returns the balance available to the business per day... filterable with start_date and end_date (ISO 8601). GET /developer/v1/banking/syncable-transactions returns banking transactions available to sync to an accounting provider." Honest caveats kept: "The account list and balance-history endpoints may receive breaking changes" and "Banking is US-only"; auth is the treasury:read scope.'),
        ('ramp-supp-checking-account', 'https://ramp.com/treasury',
         'Ramp Business Banking (Treasury): "Pay instantly from a Checking Account* with 2% APY1 while reserve cash earns up to 4.46%2" in an Investment Account ("a custom fixed-income portfolio. Professionally managed† and fully automated"). "Unlimited free same-day ACH and international wires for bill payments"; "deposits in a Ramp Checking Account receive FDIC insurance up to tens of millions of dollars per depositor" via IntraFi\'s ICS service. Disclosures quoted intact: "Ramp is a fintech company, not a bank. Checking Account deposit services provided by First Internet Bank of Indiana, Member FDIC" and "The Investment Account is not a bank deposit and is not FDIC insured."'),
        ('ramp-supp-incorporation-api', 'https://docs.ramp.com/llms-guides/incorporation.txt',
         'Ramp documents a company-formation API for partners — an agent-led banking-adjacent surface: "Approved private-preview partners can form a US LLC or, when separately enabled, a C-Corp through Ramp\'s incorporation provider and track the formation to completion. This workflow requires a Ramp-enabled agent-led application flow." Endpoints: GET /developer/v1/incorporation/countries|states|industries (NAICS), POST /developer/v1/incorporation/applicant ("idempotent per business"), POST /developer/v1/incorporation/formation, GET /developer/v1/incorporation/company-status, GET /developer/v1/incorporation/documents. Scopes incorporation:read / incorporation:write. Gate quoted intact: "Incorporation is not generally available and is not included in the public API reference... the endpoints return 404 when incorporation access is disabled."'),
        ('ramp-supp-applications-api', 'https://docs.ramp.com/llms-guides/applications.txt',
         'Partners can open Ramp accounts programmatically: "Pre-fill a Ramp application on behalf of a new business as a Ramp partner. Ramp emails the applicant, they finish sign-up in the Ramp UI, and your platform can optionally obtain API access to the new business through OAuth." The CLI exposes the same surface to agents ("applications — Apply for a Ramp account" is a top-level CLI command), governed by applications:read / applications:write scopes ("Submit and manage financing applications").'),
        ('ramp-supp-stablecoin-billpay', 'https://docs.ramp.com/llms-guides/monetary-values.txt',
         'The API\'s monetary model documents stablecoin support: "Most Ramp API monetary values use integers in the smallest denomination of the relevant currency... Standard currencies such as USD, EUR, and JPY use ISO 4217 codes. Some schemas also support stablecoin identifiers such as USDC, which can be used for eligible stablecoin Bill Pay payments." Honest caveat kept: "A currency\'s presence in a schema does not mean every payment method supports it."'),
        ('ramp-supp-bank-transfer-automation', 'https://ramp.com/banking',
         'Ramp\'s banking automation claims, quoted from the product page: "80% of bank transfers automated4", "100% of Ramp payments auto-reconciled", and "Instant payments via RTP. Vendors get paid 2 days faster." Yield mechanics: returns come from "government money market funds and short-term prime mutual funds" plus "U.S. Treasury securities and investment grade corporate bonds"; the Investment Account requires "Your total position must be at least $5,000" while the checking account has "no minimum balance requirement."'),
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


def ramp_mcp_oauth_probe():
    """Live-verify the hosted Ramp MCP server's keyless behavior: bare JSON-RPC initialize gets
    HTTP 401 with an RFC 9728 www-authenticate resource_metadata pointer, and that metadata
    resolves with authorization_servers plus the granular scopes list. Fails loudly if reality
    changes."""
    status, raw = curl('https://mcp.ramp.com/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'ramp mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    meta_url = 'https://mcp.ramp.com/.well-known/oauth-protected-resource/mcp'
    status2, meta = curl(meta_url)
    if status2 != 200 or '"authorization_servers"' not in meta or '"scopes_supported"' not in meta:
        raise SystemExit(f'ramp mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    meta_json = json.loads(meta)
    return ('PROBE mcp-oauth (' + NOW[:10] + '): keyless JSON-RPC initialize to https://mcp.ramp.com/mcp answers HTTP 401 '
            'with www-authenticate: Bearer resource_metadata=' + meta_url + '; that metadata (HTTP 200) publishes '
            + json.dumps(meta_json) +
            ' — a live, OAuth-gated remote MCP server per the MCP authorization spec, with granular read/write scopes '
            '(including treasury:read) enumerated in scopes_supported.')


def ramp_developer_mcp_probe():
    """Live-verify the UNAUTHENTICATED Developer MCP server: a bare JSON-RPC initialize succeeds
    keylessly (HTTP 200 + serverInfo) — no account, OAuth, or API key, exactly as documented."""
    status, raw = curl('https://mcp.ramp.com/developer/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT)
    if status != 200 or '"serverInfo"' not in raw:
        raise SystemExit(f'ramp developer-mcp probe: keyless initialize returned {status}: {raw[:300]}')
    result = json.loads(raw)['result']
    return ('PROBE mcp-developer (' + NOW[:10] + '): keyless JSON-RPC initialize to https://mcp.ramp.com/developer/mcp '
            'returns HTTP 200 with serverInfo ' + json.dumps(result.get('serverInfo')) +
            ' (protocolVersion ' + result.get('protocolVersion', '?') + ') — Ramp\'s docs MCP server really is fully '
            'unauthenticated, as documented ("does not require a Ramp account, OAuth login, API key, or developer app").')


def ramp_openapi_probe(require_path):
    """Live-verify the canonical OpenAPI schema: fetch /openapi/developer-api.json, assert it
    parses, and assert the arena-relevant path is present."""
    status, raw = curl('https://docs.ramp.com/openapi/developer-api.json')
    if status != 200:
        raise SystemExit(f'ramp openapi probe: returned {status}')
    spec = json.loads(raw)
    paths = spec.get('paths', {})
    if require_path not in paths:
        raise SystemExit(f'ramp openapi probe: {require_path} missing from spec ({len(paths)} paths)')
    return ('PROBE openapi (' + NOW[:10] + '): GET https://docs.ramp.com/openapi/developer-api.json returns HTTP 200 — '
            f'a parseable OpenAPI document titled "{spec["info"]["title"]}" ({spec["info"]["version"]}) with '
            f'{len(paths)} documented paths, including {require_path} — the "Canonical OpenAPI schema" the llms.txt '
            'index links for machine consumption.')


PROBES = {
    'expense-management': [
        ('ramp-probe-4', 'https://mcp.ramp.com/mcp', ramp_mcp_oauth_probe),
        ('ramp-probe-5', 'https://mcp.ramp.com/developer/mcp', ramp_developer_mcp_probe),
        ('ramp-probe-6', 'https://docs.ramp.com/openapi/developer-api.json',
         lambda: ramp_openapi_probe('/developer/v1/transactions')),
    ],
    'startup-banking': [
        ('ramp-probe-4', 'https://mcp.ramp.com/mcp', ramp_mcp_oauth_probe),
        ('ramp-probe-5', 'https://docs.ramp.com/openapi/developer-api.json',
         lambda: ramp_openapi_probe('/developer/v1/banking/accounts')),
    ],
}


def main():
    for cat in ('expense-management', 'startup-banking'):
        path = f'rankings/{cat}/evidence/ramp.json'
        ev = json.load(open(path))
        existing = {e['id'] for e in ev}

        for iid, url, excerpt in DOC_ITEMS[cat]:
            if iid in existing:
                print(f'{cat}/{iid}: already present, skipping')
                continue
            ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'{cat}: appended {iid}')

        for probe_id, probe_url, run in PROBES[cat]:
            if probe_id in existing:
                print(f'{cat}/{probe_id}: already present, skipping')
                continue
            excerpt = run()
            ev.append({'id': probe_id, 'tier': 'probe', 'url': probe_url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'{cat}: appended {probe_id}')

        with open(path, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{cat}: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
