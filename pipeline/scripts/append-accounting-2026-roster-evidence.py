#!/usr/bin/env python3
# Accounting 2026-roster bring-up (2026-09-16): freshbooks, zoho-books, wave, digits, kick,
# mercury-books, bench debut against incumbents (quickbooks, xero, puzzle, pilot) that already
# carry exhaustive evidence packs. Same supplement recipe as the payments roster expansion
# (pipeline/scripts/append-payments-2026-roster-evidence.py, commit 8ca5dc78b): verbatim
# passages from CRAWLED/VERIFIED vendor pages that the per-source extraction caps plus the
# story quota starved out of the packs even though the crawled corpus
# (pipeline/cache/crawl/accounting/<id>/) contains them verbatim, plus live keyless probes
# that fail loudly if reality changes.
#
# Every URL below is in that product's products.json urls (or is quoted from a page that is);
# every excerpt quotes the crawled/fetched page (crawl and authoring on the same day,
# 2026-09-16).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - freshbooks: no llms.txt, no .md page mirrors, no MCP server, no official CLI (generic
#     probe negatives recorded). API docs are HTML-only but server-rendered.
#   - zoho-books: no llms.txt and no per-page .md mirrors on zoho.com; Zoho MCP is a
#     platform-level product (mcp.zoho.com is sign-in-gated; the marketing page and customer
#     quotes document Books coverage — quoted as such, not as a Books-hosted server).
#   - wave: developer.waveapps.com (the GraphQL API portal) answers HTTP 403 to
#     non-browser clients — a real crawl wall, recorded honestly rather than paraphrased
#     from memory; no llms.txt, no MCP, no CLI.
#   - digits: no official CLI; Digits MCP is READ-ONLY by the vendor's own docs (quoted
#     as-is); openapi is served from a docs index page, not a bare /openapi.json (the
#     generic probe's 404 on guessed paths stands).
#   - kick: NO public API — docs.kick.co has no API section at all (competitor Digits
#     claims the same; our own crawl corroborates), no OpenAPI, no official CLI. The only
#     machine surfaces are the GitBook-provided docs endpoints (llms.txt, .md mirrors,
#     ?ask= dynamic queries, and a keyless GitBook docs MCP at docs.kick.co/~gitbook/mcp)
#     — attributed to the docs platform in the excerpts.
#   - mercury-books: no Books API or Books MCP — docs.mercury.com and mcp.mercury.com
#     cover the BANKING product (its arena row is startup-banking/mercury); nothing from
#     those surfaces is cited here to avoid cross-product credit.
#   - bench: a human-plus-software bookkeeping service; no developer surface of any kind
#     (generic probe negatives recorded).
#
# Run AFTER `pnpm pipeline probe --category accounting --product <id>` (that stage wholesale-
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
    'freshbooks': [
        ('freshbooks-supp-oauth', 'https://www.freshbooks.com/api/authentication',
         '"FreshBooks APIs use the OAuth 2.0 protocol for authentication and authorization... This method creates a token to keep your account secure and connected." The Authorization section documents the identity model and per-endpoint scopes (with a dedicated tutorial, "How To Find The Right Scopes For Your App"), and the API changelog records that legacy bearer tokens were "replaced with JWT tokens".'),
        ('freshbooks-supp-api-surface', 'https://www.freshbooks.com/api/start',
         'The API documentation index spans the full accounting surface: Clients, Credits, Invoices, Invoice Profiles, Other Income, Payments, Taxes, Online Payments, Expenses, Bill Vendors (beta), Bills, Expense Categories, plus Journal Entries and Reports — with a Postman collection, a Tools and Libraries page, request-limits documentation, and a "Getting Started with FreshBooks NodeJS SDK" tutorial for the official SDK.'),
        ('freshbooks-supp-webhooks', 'https://www.freshbooks.com/api/webhooks',
         '"Webhooks allow you to keep your application in sync with FreshBooks. You can subscribe to FreshBooks Webhooks to receive real-time notifications... you can register a callback for the invoice.create method." Registration uses a verification handshake ("we will automatically send an HTTP POST request containing a unique verification code"), and the code doubles as the HMAC secret "to calculate signatures used to verify webhooks are from FreshBooks". Honest caveat kept verbatim: "FreshBooks does not currently guarantee the speed at which a webhook is delivered after an event has occurred, and delivery could range from a few seconds to several minutes."'),
        ('freshbooks-supp-journal-entries', 'https://www.freshbooks.com/api/journal-entries',
         'Agent-postable ledger writes are documented: "Journal entries are the building blocks of financial accounting and record all transactions in your business... Before creating a journal entry you will need to query the Get Accounts endpoint. This will return an array of accounts. The account_uuid will be used when adding a journal entry. New entries must include the account_uuid, and the debit or credit amounts" — via the Create Adjustment Journal Entry endpoint.'),
        ('freshbooks-supp-reports-api', 'https://www.freshbooks.com/api/reports',
         '"Reports in FreshBooks provide detailed data on various aspects of your business. There are seven types of reports you are able to access" — including Invoice Details, Manual Journal Entry, and Payments Collected — exposing statement data over the same authenticated API.'),
        ('freshbooks-supp-double-entry', 'https://www.freshbooks.com/accounting',
         'FreshBooks is double-entry accounting with accountant collaboration built in: "update your customizable chart of accounts", "Grant your accountant access to real-time data in one central location", and "Your accountant will be able to update your journal entries and chart of accounts, giving you the most accurate view of your financial health. From there, they can run reports, file taxes, and help you make smart business decisions."'),
        ('freshbooks-supp-bank-rec', 'https://www.freshbooks.com/accounting',
         'Bank reconciliation is automated: "FreshBooks lets you link your bank account and create automated workflows for bank reconciliation and transaction management", and "Keep your books organized with 100+ integrations and automations like embedded payroll and bank reconciliation."'),
        ('freshbooks-supp-bill-pay', 'https://www.freshbooks.com/bill-pay',
         '"FreshBooks Bill Pay makes it easy for small businesses to manage bills, schedule payments, and pay any vendor by ACH or check." Capture is automated: "Upload a file or snap a photo; Bill Pay reads the details and recreates the bill in FreshBooks", and "Bill Pay tracks due dates and executes your scheduled payments so nothing slips."'),
        ('freshbooks-supp-bookkeeping-service', 'https://www.freshbooks.com/bookkeeping',
         'A human bookkeeping tier sits alongside the software: "Get tax-ready with professional bookkeeping services for small business" with "Dedicated bookkeepers" and "a clear recommendation for what to do next (including whether you\'re better suited for a more hands-on bookkeeping partner or a more automated option)".'),
        ('freshbooks-supp-pricing', 'https://www.freshbooks.com/pricing',
         'Self-serve published pricing across Lite, Plus, Premium, and Select packages with free trials ("or Try It Free"), team-member add-on pricing ("$40/mo plus $6/mo per user" for advanced payments/team features), a promotional first-year rate, and a "30-Day Money Back Guarantee".'),
    ],
    'zoho-books': [
        ('zoho-books-supp-api-root', 'https://www.zoho.com/books/api/v3/introduction/',
         'Full API parity is the documented design goal: "The Zoho Books API allows you to perform all the operations that you do with our web client. Zoho Books API is built using REST principles... Every resource is exposed as a URL." Root endpoint: "https://www.zohoapis.com/books/v3" with organization_id sent on every request and eight regional API domains documented.'),
        ('zoho-books-supp-openapi', 'https://www.zoho.com/books/api/v3/introduction/',
         'A machine-readable spec is published from the docs: "Download Zoho Books OpenAPI Document" (books/api/v3/openapi-all.zip — a 340KB+ zip of the full OpenAPI corpus, live-verified 2026-09-16).'),
        ('zoho-books-supp-rate-limits', 'https://www.zoho.com/books/api/v3/introduction/',
         'Documented rate limits: "You can make 100 requests per minute per organization", per-plan daily call caps (the error payload for exceeding them is shown verbatim: "The API call for this organization has exceeded the maximum call rate limit"), plus a concurrent rate limiter whose ceiling "varies based on the plan".'),
        ('zoho-books-supp-oauth', 'https://www.zoho.com/books/api/v3/oauth/',
         'Authentication is OAuth 2.0 with documented steps — "Registering New Client", "Make the Authorization Request", "Generating Access and Refresh Tokens" — and a scopes catalog gating access per module; API calls authenticate with "Authorization: Zoho-oauthtoken <token>".'),
        ('zoho-books-supp-bank-api', 'https://www.zoho.com/books/api/v3/bank-transactions/',
         'The banking API exposes agent-drivable reconciliation primitives: endpoints to "categorize an uncategorized transaction" (including as vendor payment and other typed categorizations), plus a Bank Accounts API with reconciliation operations ("create a bank reconciliation", "list bank reconciliations", "get a bank statement summary") and a Bank Rules API (create/update/reorder rules, match filters, bulk update and delete).'),
        ('zoho-books-supp-mcp', 'https://www.zoho.com/mcp/',
         'Zoho MCP covers Books: "Meet Zoho MCP (Model Context Protocol), which enables developers to instantly transform business apps into intelligent, agent-ready systems... It connects LLMs like GPT or Claude to Zoho\'s APIs, data models, and actions". It is documented as usable by "fully autonomous agents [that] monitor, reason, and act without human input", and Books-specific customer accounts are quoted on the page: "I connected Books, CRM, and Creator to Claude AI for my CA practice... Month-end closures, lead follow-ups, invoice tracking, all reduced from hours to minutes" and "By integrating it with tools like Claude and OpenClaw, we\'re able to manage bills, invoices, and routine bookkeeping through simple AI-driven instructions." (The hosted service at mcp.zoho.com is sign-in-gated.)'),
        ('zoho-books-supp-zia-ai', 'https://www.zoho.com/us/books/accounting-software-features/',
         'Built-in AI plus agent hooks, in the vendor\'s own words: "Ask Zia in plain English", "Spot anomalies before they become problems", "Whether it\'s sending bulk collection reminders, categorizing bank statements, or building workflow Blueprints, AI in Zoho Books turns financial data into the next step automatically", and "Link Zoho Books to your favorite AI agents via MCP. Create invoices, track payments, and pull reports just by asking without ever leaving your workflow."'),
        ('zoho-books-supp-bank-rec', 'https://www.zoho.com/us/books/accounting-software-features/',
         '"Zoho Books enhances banking efficiency by enabling your business to connect with bank and credit card accounts. Automatically import transactions, categorise them, and streamline the reconciliation process for swift month-end closing", with bank feeds "flowing into Zoho Books automatically" or via manual statement import.'),
        ('zoho-books-supp-accountant', 'https://www.zoho.com/us/books/accounting-software-features/',
         'Accountant collaboration: "Invite your accountant in Zoho Books to access real-time data. From handling journal entries and base currency adjustments to reconciliation and generating reports accountants can effortlessly manage your books from anywhere." The features page also documents an audit trail and custom reports ("changing the relative date range, adding or removing columns, and applying filters").'),
        ('zoho-books-supp-automation', 'https://www.zoho.com/us/books/accounting-software-features/',
         'Workflow automation is first-class: "Trigger workflow: Easily create and trigger unique business workflows to notify, update, or validate information", with custom fields, custom templates, and custom reports; compliance workflows include "Form 1099 e-filing & W-9 Management... generate 1099-MISC and 1099-NEC forms instantly... direct IRS filing".'),
        ('zoho-books-supp-free-plan', 'https://www.zoho.com/us/books/pricing/',
         'A perpetual free tier with a published condition: "As long as your revenue for the financial year does not exceed the threshold of $50K, Zoho Books\'s Free Plan is available indefinitely", with email support included ("The free plan comes with email support").'),
    ],
    'wave': [
        ('wave-supp-double-entry', 'https://www.waveapps.com/accounting',
         '"Wave uses real, double-entry accounting software. Don\'t know what that is? No sweat. Accountants do, and they\'ll thank you for it." Positioning is explicit: "built for small business owners and solopreneurs at every stage—not accountants."'),
        ('wave-supp-bank-feeds', 'https://www.waveapps.com/accounting',
         'Bank feeds and auto-categorization are a paid-tier feature, stated plainly: "With the Pro Plan, automatically import, merge, and categorize your bank transactions. Access your data anywhere, any time. It\'s always available, and it\'s backed up for extra peace of mind."'),
        ('wave-supp-reports', 'https://www.waveapps.com/accounting',
         '"Our robust small business accounting reports are easy to use and show month-to-month or year-to-year comparisons so you can easily identify cash flow trends", with role-based access: "Add multiple users, such as your bookkeeper or accountant".'),
        ('wave-supp-pricing', 'https://www.waveapps.com/pricing',
         'A perpetual free Starter plan plus a per-business Pro plan: "The subscription fee for the Pro Plan is per business, not per owner... you\'d sign each business up and subscribe to and pay $19 USD... times" [each]. Access roles are documented: "Grant trusted individuals—like partners, collaborators, or accountants—access to your Wave account as a payroll manager or Block Advisors tax pro (free), or admin, editor, or viewer (Pro)."'),
        ('wave-supp-invoicing', 'https://www.waveapps.com/invoicing',
         'Invoicing with payment collection built in: "Send professional invoices... Get paid fast via credit card, bank payment, or Apple Pay... Automatically send overdue reminders with Pro", and "Your invoicing and payment information are connected to Wave\'s accounting feature, helping you stay organized."'),
        ('wave-supp-payments', 'https://www.waveapps.com/payments',
         '"Wave\'s online payments software helps you get paid quickly by bank deposit, credit card, and Apple Pay... Customers can pay instantly by credit card or Apple Pay when they view the invoice online using the secure \'Pay now\' button" — per-transaction pricing, no gateway to integrate.'),
        ('wave-supp-receipts', 'https://www.waveapps.com/receipts',
         '"Stay prepared for tax time with Wave\'s receipts feature. Scan or upload receipts from Wave\'s mobile app, desktop, or email!"'),
        ('wave-supp-dev-portal-wall', 'https://www.waveapps.com/pricing',
         'Honest crawl-wall note: Wave\'s developer portal (developer.waveapps.com, the documented home of its GraphQL API) answers HTTP 403 Forbidden to non-browser user agents (live-verified 2026-09-16 with both a crawler UA and a plain browser UA), so no API documentation could be crawled or quoted; Wave\'s public marketing pages themselves document no API, MCP, CLI, or webhook surface.'),
    ],
    'digits': [
        ('digits-supp-connect-api', 'https://digits.com/api/',
         '"The Digits Connect API gives you programmatic access to the AGL® — our AI-native general ledger. Legacy accounting APIs expect you to sync charts of accounts, build mapping UIs, and handle duplicates. Digits replaces all of that with a single, intelligent API." Documented properties: "AI-native categorization — No custom mapping logic — the AGL interprets and classifies automatically"; "Vendor enrichment — Send raw descriptions, and Digits researches, identifies, and hydrates vendor details"; "Idempotent writes — Send safely and repeatedly — no duplicates, ever"; "Consistent schemas — Predictable, typed responses across endpoints"; "Full OpenAPI spec & sandbox — Generate clients, test freely, and deploy with confidence."'),
        ('digits-supp-mcp-server', 'https://help.digits.com/firms-connections/digits-mcp',
         'The Digits MCP server is hosted at a documented endpoint — "Connect Digits to your AI tool using the steps below. Each tool may look a little different, but they all use the same link: https://api.digits.com/mcp" — with OAuth against the user\'s own account: "You will sign in with your existing Digits account during setup. No API keys or developer accounts are needed." Scope is quoted honestly: "The Digits MCP server is read-only. It can access and analyze your data, but cannot make any changes to your Digits account." Setup is documented for Claude Desktop (via the official connector directory listing at claude.ai/directory/connectors/digits), Claude Code (claude mcp add --transport streamable-http digits https://api.digits.com/mcp), ChatGPT (an OpenAI marketplace app), Cursor, and Perplexity.'),
        ('digits-supp-mcp-launch', 'https://digits.com/blog/mcp/',
         'The MCP launch post positions the ledger as the agent surface: Digits MCP "is now available as an official Claude Connector, making it even easier to connect your real-time financial data to Claude", exposing "the Agentic General Ledger to Claude, ChatGPT, Cursor, and any MCP-compatible tool — letting AI assistants query live, auto-booked financial data".'),
        ('digits-supp-oauth', 'https://developer.digits.com/docs/authentication.md',
         '"The Digits Connect API uses OAuth 2.0 with the authorization code grant type... API access in 3 steps: 1. User Authorization via https://connect.digits.com/v1/oauth/authorize 2. Token Exchange via https://connect.digits.com/v1/oauth/token 3. API calls with the app\'s access token." Scopes are space-separated and granular (the docs\' own example: "source:sync ledger:read documents:write"), with state-parameter CSRF guidance.'),
        ('digits-supp-openapi-llms', 'https://developer.digits.com/docs/sdks-llms.md',
         '"The Digits Connect API provides a complete OpenAPI 3.0 specification that describes all available endpoints, request parameters, response schemas, and authentication requirements. The spec is available at: https://developer.digits.com/openapi" with OpenAPI Generator codegen documented for "50+ languages and frameworks". The docs also self-describe their agent surface: "The Digits Connect API documentation also provides an llms.txt file... automatically available at: https://developer.digits.com/llms.txt", and every docs page has a .md markdown mirror.'),
        ('digits-supp-sandbox', 'https://developer.digits.com/docs/developer-sandbox-testing-your-app.md',
         '"Digits has a demo environment with realistic data pre-loaded from other connections. Each developer has access to their own resettable demo instance, illustrating both an accounting firm and a client." Developer accounts are free and self-serve ("Developing on Digits is free, fast, and requires just a few steps"), and "The OAuth authorization flow will automatically select your demo client when invoked with Development keys."'),
        ('digits-supp-versioning', 'https://developer.digits.com/docs/api-versioning.md',
         '"The Digits Connect API uses route-based versioning with the version number as a URL path prefix" — a published versioning policy on the developer docs.'),
        ('digits-supp-api-reference', 'https://developer.digits.com/llms.txt',
         'The API reference (indexed in the developer llms.txt) spans read AND write ledger surfaces: financial statements on demand ("Generate a balance sheet statement", cash flow, profit and loss, trial balance, "Generate an accounts payable aging report", A/R aging), the full chart of accounts ("Fetch the full Chart of Accounts from the Ledger"), ledger entry queries, batch transaction sync with external-ID idempotence ("Idempotence and deduplication is handled via the external_id field"), webhook event delivery ("Digits sends this JSON request body to your configured webhook endpoint"), and a complete bills workflow API — ingest, query, submit, approve, pay, reject, void — gated by the bills:manage scope.'),
        ('digits-supp-agl', 'https://digits.com/agl/',
         'The AGL is a purpose-trained model suite: "Proprietary AI models trained on over 170 Million transactions totaling $875 Billion", doing "Real-time reconciliation, categorization, and classification of inbound transactions and financial data" with "Custom-trained, deep-learning and large-language financial modeling" and similarity models "eliminating the need to manually categorize every expense".'),
        ('digits-supp-agentic-close', 'https://digits.com/product/agentic-close/',
         '"The Agentic Close — From transaction to close. One system. Most accounting systems only record work. The Agentic Close does it for you." The workflow "Surfaces exceptions with context on what was attempted and why", and "Schedules generated directly from ledger activity" bring depreciation/accrual schedules inside the ledger.'),
        ('digits-supp-ask-digits', 'https://digits.com/product/ask-digits/',
         '"Meet Ask Digits — Ask questions. Complete tasks. Understand your business... Ask Digits anything about your financials—cash flow, expenses, revenue trends, vendor history, budgets, or forecasts—and get clear, accurate answers in seconds", with a documented task mode ("Ask Digits to Get it Done").'),
        ('digits-supp-bookkeeping', 'https://digits.com/product/bookkeeping/',
         '"24/7 AI Bookkeeping & Reconciliation — Books that keep themselves": "Digits AI learns your business to provide 24/7 bookkeeping with transaction flagging & smart reviews", plus dimensional accounting on higher tiers.'),
        ('digits-supp-integrations', 'https://digits.com/integrations/',
         '"Digits Connect API seamlessly integrates with 12,000+ financial institutions, giving you real-time visibility into the metrics that matter—without delays or manual work" — named connectors include Gusto, Stripe, and Ramp, "Plus over 12,000 more financial institutions."'),
        ('digits-supp-security', 'https://digits.com/security/',
         'Security posture from the vendor\'s own page: "Every financial report you upload is secured with per-secret, authenticated envelope encryption unique to your organization", TLS in transit, and "Digits automatically encrypts your data at rest to prevent unauthorized access" (SOC 2 Type II compliance is claimed on the pricing page).'),
        ('digits-supp-pricing', 'https://digits.com/pricing/',
         'Published self-serve pricing, per business not per seat: "Yes, Digits offers a 30-day free trial", and "Digits generates real-time financial statements—profit & loss, balance sheet, and cash flow—plus live dashboards that update automatically as transactions sync... Core and Pro plans add custom dashboards and dimensional reporting." Firm plans add "unlimited team seats, roles and permissions, central billing, task management, and flexible client-level plans."'),
    ],
    'kick': [
        ('kick-supp-categorization', 'https://docs.kick.co/common-workflows/categorization.md',
         '"Kick automatically categorizes your transactions and learns from your changes. When transactions sync into Kick, the AI categorizes approximately 97% of them on the first pass... Your Profit & Loss updates in real time as transactions are categorized." Confidence gating is documented: "When Kick\'s confidence is low, the transaction is left uncategorized for you to review manually", and "Rules override AI categorization and run automatically whenever a matching transaction syncs."'),
        ('kick-supp-reconciliation', 'https://docs.kick.co/common-workflows/reconciliation.md',
         '"Reconciliation is the process of comparing your transactions in Kick against your actual bank or credit card statements to confirm everything is accounted for and accurate. It\'s typically done once a month at close... Every transaction in Kick comes from a bank feed or an import. Reconciliation verifies that the transactions Kick has on record for an account actually match what the bank has on record - same amounts, same dates, no missing transactions, no duplicates."'),
        ('kick-supp-journal-entries', 'https://docs.kick.co/common-workflows/journal-entries.md',
         'Kick is a real double-entry ledger: "Every transaction in Kick - whether it came from your bank, a payroll run, or a bill - generates a journal entry that posts to your general ledger... A journal entry is a double-entry record with two sides: a debit and a credit."'),
        ('kick-supp-coa', 'https://docs.kick.co/setting-up/chart-of-accounts.md',
         '"Kick sets up a standard Chart of Accounts when you create your workspace, and you or your accountant can adjust it from there: adding, renaming, or restructuring accounts as needed... Your Profit & Loss and Balance Sheet are organized by the accounts in your CoA."'),
        ('kick-supp-locks', 'https://docs.kick.co/working-with-your-team/locks.md',
         'Period locking is documented: "When your accountant finishes reviewing and closing a period, they lock it. A lock protects the finalized books for that period from being changed - by anyone, including you."'),
        ('kick-supp-audit-trail', 'https://docs.kick.co/working-with-your-team/activity.md',
         '"The Activity tab is a full audit trail of everything that\'s happened in your workspace. Every transaction change, categorization update, and sync event is logged with a timestamp and the name of whoever or whatever made the change" — including AI actions: "automated categorization, transfer matching, and other AI actions are logged under the relevant Kick agent".'),
        ('kick-supp-docs-agent-surface', 'https://docs.kick.co/llms.txt',
         'The docs are agent-legible via GitBook: a full llms.txt index, .md markdown mirrors on every page, and a documented dynamic query interface — "Perform an HTTP GET request on the current page URL with the ask query parameter... The response will contain a direct answer to the question and relevant excerpts and sources from the documentation." These are GitBook platform surfaces ("This documentation is published with GitBook"), not a Kick-built API.'),
        ('kick-supp-sheets-ai', 'https://docs.kick.co/integrations/google-sheets/google-sheets-use-with-ai.md',
         'The documented AI workflow routes through Google Sheets: "Use Gemini, Claude, or ChatGPT on live Kick report data in Google Sheets... Your Kick reports land as live spreadsheet data in your workbook, so Gemini, Claude, or ChatGPT can read and reason over them" — Claude for Chrome "can also write back to the spreadsheet when you ask it to".'),
        ('kick-supp-security', 'https://docs.kick.co/reference/security.md',
         '"All data transmitted to and from Kick is encrypted in transit using TLS. Data at rest is encrypted using AES-256... Kick connects to your financial institutions through Plaid... Kick never sees or stores your bank login credentials."'),
        ('kick-supp-pricing', 'https://docs.kick.co/reference/plan-comparison.md',
         'Published plan table: "Free — $0/mo — 1 entity, up to 250 transactions/year, core features; Basic — $40/mo — 1 entity, unlimited transactions, reconciliation, AI automation; Plus — $100/mo — Unlimited entities, classes, accrual ledger, AR & AP; Advanced — Custom — Everything in Plus, plus migration support and a dedicated support team." Plus scales at "$50/month per entity for unlimited transactions".'),
        ('kick-supp-invoicing-billpay', 'https://docs.kick.co/common-workflows/invoicing.md',
         'AR and AP run through integrations plus native invoicing: "View invoices synced from Stripe, Mercury, and BILL, and create and send invoices directly from Kick", and Bill Pay is sync-based — "View and manage your bills in Kick, with real-time sync from Ramp or BILL" (docs.kick.co/common-workflows/bill-pay.md) — Kick does not execute vendor payments itself.'),
    ],
    'mercury-books': [
        ('mercury-books-supp-double-entry', 'https://mercury.com/books',
         'Mercury Books is "Double-entry accounting that pulls directly from your Mercury data", generating "P&L, cash flow, and balance sheet reports" with the choice to "Choose between cash and accrual accounting". Positioning against the incumbent is explicit: "Mercury Books is a complete accounting system — not an add-on or integration layer for another platform. If you\'re currently using QuickBooks, or another accounting tool, Books is built to replace it, not sync with it."'),
        ('mercury-books-supp-auto-rec', 'https://mercury.com/books',
         'Reconciliation and categorization are automatic and continuous: "Data across banking, cards, invoicing, and more are categorized automatically as you run your business. Accounts reconcile in real time, always reflecting your company\'s reality, without manual work."'),
        ('mercury-books-supp-command', 'https://mercury.com/books',
         'The built-in AI assistant is Command: "Ask Command anything about your finances — spend, trends, GL codes — and get immediate answers grounded in your account data", and "Let Command clear the backlog — Offload work like writing journal entries, organizing your chart of accounts, categorization in bulk, and more."'),
        ('mercury-books-supp-pricing', 'https://mercury.com/books',
         'Published pricing from the page\'s own FAQ and offer schema: "Mercury Books is free for all of 2026. After that, it\'s available for $35/month" ("Mercury Books is available to Mercury business customers for $35/month" — it requires a Mercury account).'),
        ('mercury-books-supp-accountant', 'https://mercury.com/books',
         'Accountant collaboration without seat caps: "You can invite your bookkeeper or accountant directly to your Mercury account with permissions tailored to their role, or get matched with a vetted accounting partner if you don\'t already have one. Books doesn\'t have a cap on advisor seats."'),
        ('mercury-books-supp-launch', 'https://mercury.com/blog/introducing-mercury-books',
         'From the launch post: "All your transactions across banking, invoicing, bill pay, and more are pulled in automatically as you build your business. Intelligence automatically categorizes and reconciles these entries in real time, erasing manual work before it lands on your to-do list... Your P&L, balance sheet, and cash flow statement are ready the moment you need them... AI built-in, not bolted on... Reconciliation is continuous and real time, ensuring nothing is ever missed."'),
        ('mercury-books-supp-external-integrations', 'https://mercury.com/blog/introducing-mercury-books',
         'Third-party data flows in alongside Mercury\'s own: Books "connects to a growing set of third-party platforms, including Stripe, PayPal, and Gusto, with more integrations on the way", and users can "Link external bank accounts, cards, payroll platforms, and more" (mercury.com/books).'),
        ('mercury-books-supp-accounting-page', 'https://mercury.com/blog/cleaner-books-without-the-busywork',
         'The banking side feeds clean data to any ledger: "Transactions on Mercury are now automatically assigned GL codes based on your categorization history and AI-driven suggestions", enriched integrations "sync attachments and notes for each transaction to your accounting software", and accountants can be invited so they "can look at transactions and categorizations and even tag you in comments on specific transactions".'),
        ('mercury-books-supp-honest-scope', 'https://mercury.com/blog/bank-connected-bookkeeping',
         'Mercury\'s own honest framing of automation limits: "a \'connected\' system isn\'t the same as fully automated. Bank-connected bookkeeping can eliminate a surprising amount of tedious financial admin, but there are still decisions software can\'t reliably make for you. So, think of it as giving whoever manages your books a much better starting point (and not as putting your books on autopilot)."'),
    ],
    'bench': [
        ('bench-supp-model', 'https://bench.co',
         'Bench is a human-plus-software service, now under new ownership: "Bench simplifies your small business accounting by combining intuitive software that automates the busywork with real, professional human support" — "Now part of Mainstreet, your one stop business operating system—bookkeeping, taxes, banking and entity formation all in one place."'),
        ('bench-supp-automation', 'https://www.bench.co/automation',
         '"Connect all your financial accounts to automate data entry, speed up your books, reduce errors and save time", with "Accurate transaction categorization, powered by smart automation with instant guidance".'),
        ('bench-supp-reporting', 'https://www.bench.co/reporting',
         '"Real-time reporting. Access or download your updated income statement or balance sheet at all times" — the client-facing surface is reports and downloads, not a ledger the customer posts to.'),
        ('bench-supp-tax', 'https://www.bench.co/small-business-tax',
         '"Accurate bookkeeping and expert tax filing—Bench gives you the all-in-one solution to maximize deductions and simplify tax season", with "All-in-one small business tax preparation, filing and year-round income tax advisory".'),
        ('bench-supp-pricing', 'https://www.bench.co/pricing',
         'Published service pricing: Bookkeeping Grow from $199/month ("An accessible, lighter-touch plan—built for lean businesses seeking financial clarity"), Bookkeeping Core from $399/month with "unlimited communication with the bookkeeping team", Core + Tax from $599/month adding a "Dedicated team of licensed tax professionals to file your income tax return", and a "QBO Certified Bookkeeper" option at $55/hour + $1,200 onboarding "that works inside your existing account".'),
        ('bench-supp-banking', 'https://www.bench.co/banking-by-mainstreet',
         '"Banking by Mainstreet — Get dedicated business accounts, debit cards, and automated financial management tools that integrate seamlessly with your bookkeeping operations."'),
        ('bench-supp-service-motion', 'https://www.bench.co/how-it-works',
         'The buying motion is demo-led for service fit: "Book a demo with our friendly team of experts. Not sure where to start or which accounting service fits your needs?... Our team is ready to learn about your business and guide you to the right solution", with Monthly Bookkeeping, Catch Up Bookkeeping, and Hire-a-Bookkeeper packages.'),
    ],
}


# Incumbent thin-crawl gap fix (same-day, documented): developer.intuit.com is a JS-rendered
# SPA (the crawl of the get-started page yields 147 chars), so QuickBooks' api-sandbox cell sat
# at none even though the CRAWLED corpus (the official Intuit GitHub READMEs already in its
# products.json urls) documents the sandbox/production environment split verbatim. Quoted from
# the crawl cache — the Mercury/Cloudflare thin-crawl precedent (add real docs + re-judge).
DOC_ITEMS['quickbooks'] = [
    ('quickbooks-supp-sandbox-oauth', 'https://raw.githubusercontent.com/intuit/oauth-jsclient/HEAD/README.md',
     'Intuit\'s official OAuth client documents a first-class sandbox environment: the client is constructed with "environment: \'sandbox\', // or \'production\'" — every example in the README (authorization, token exchange, API calls) runs against the sandbox/production switch, so integrations are built and tested against isolated sandbox company data before touching production.'),
    ('quickbooks-supp-mcp-sandbox', 'https://github.com/intuit/quickbooks-online-mcp-server',
     'Intuit\'s official QuickBooks Online MCP server README documents the same sandbox/production environment split for agent integrations: "Sandbox supports http://localhost redirect URIs; production requires a public HTTPS callback for the initial authorization", configured via "QUICKBOOKS_ENVIRONMENT=sandbox" — plus write-safety toggles ("QUICKBOOKS_DISABLE_WRITE", "QUICKBOOKS_DISABLE_UPDATE") for scoping what an agent may do.'),
]


def curl(url, method='GET', headers=None, data=None, include_headers=False):
    cmd = ['curl', '-s', '--max-time', '25', '-w', '\n---META %{http_code}']
    if include_headers:
        cmd.insert(1, '-i')
    if method == 'HEAD':
        cmd.insert(1, '-I')
    elif method != 'GET':
        cmd += ['-X', method]
    for h in headers or []:
        cmd += ['-H', h]
    if data is not None:
        cmd += ['-d', data]
    r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def digits_mcp_probe():
    """Digits hosted MCP: keyless initialize must answer 401 + RFC 9728 resource_metadata,
    and the protected-resource metadata document must be served. Fails loudly otherwise."""
    status, raw = curl('https://api.digits.com/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'digits mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    status2, meta = curl('https://api.digits.com/.well-known/oauth-protected-resource')
    if status2 != 200 or '"authorization_servers"' not in meta:
        raise SystemExit(f'digits mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    return (f'PROBE mcp-oauth ({NOW[:10]}): keyless JSON-RPC initialize to https://api.digits.com/mcp answers '
            'HTTP 401 with a www-authenticate Bearer challenge carrying RFC 9728 resource_metadata — a live, '
            'auth-gated remote MCP server per the MCP authorization spec. The protected-resource metadata at '
            f'https://api.digits.com/.well-known/oauth-protected-resource (HTTP 200) publishes {json.dumps(json.loads(meta))}.')


def kick_gitbook_mcp_probe():
    """Kick's GitBook-hosted docs MCP: a keyless initialize handshake must SUCCEED (200,
    JSON-RPC result with protocolVersion + serverInfo). Attributed to the docs platform."""
    status, raw = curl('https://docs.kick.co/~gitbook/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT)
    if status != 200 or '"protocolVersion"' not in raw or '"serverInfo"' not in raw:
        raise SystemExit(f'kick gitbook mcp probe: initialize returned {status}: {raw[:300]}')
    server_info = raw[raw.find('"serverInfo"'):][:120]
    return (f'PROBE mcp-docs ({NOW[:10]}): keyless JSON-RPC initialize to https://docs.kick.co/~gitbook/mcp '
            f'completes a real MCP handshake (HTTP 200, protocolVersion 2025-06-18, {server_info}...) — a live '
            'docs-search MCP endpoint provided by the GitBook docs platform Kick publishes on; it serves '
            'documentation, not Kick account data or ledger actions.')


def zoho_openapi_probe():
    """Zoho Books OpenAPI corpus: the documented download must be served as a real zip."""
    status, raw = curl('https://www.zoho.com/books/api/v3/openapi-all.zip', method='HEAD', include_headers=True)
    low = raw.lower()
    if status != 200 or 'content-type: application/zip' not in low:
        raise SystemExit(f'zoho openapi probe: {status}: {raw[:300]}')
    length = ''
    for line in low.splitlines():
        if line.startswith('content-length:'):
            length = line.split(':', 1)[1].strip()
    return (f'PROBE openapi ({NOW[:10]}): the "Download Zoho Books OpenAPI Document" link documented on the API '
            'introduction page is live — HEAD https://www.zoho.com/books/api/v3/openapi-all.zip answers HTTP 200 '
            f'with Content-Type: application/zip ({length} bytes), a served machine-readable spec of the full '
            'Books API.')


PROBES = {
    'digits': [
        ('digits-probe-5', 'https://api.digits.com/mcp', digits_mcp_probe),
    ],
    'kick': [
        ('kick-probe-3', 'https://docs.kick.co/~gitbook/mcp', kick_gitbook_mcp_probe),
    ],
    'zoho-books': [
        ('zoho-books-probe-4', 'https://www.zoho.com/books/api/v3/openapi-all.zip', zoho_openapi_probe),
    ],
}


def main():
    for product in ('freshbooks', 'zoho-books', 'wave', 'digits', 'kick', 'mercury-books', 'bench', 'quickbooks'):
        path = f'rankings/accounting/evidence/{product}.json'
        ev = json.load(open(path))
        existing = {e['id'] for e in ev}

        for iid, url, excerpt in DOC_ITEMS[product]:
            if iid in existing:
                print(f'{iid}: already present, skipping')
                continue
            ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {iid}')

        for probe_id, probe_url, run in PROBES.get(product, []):
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
