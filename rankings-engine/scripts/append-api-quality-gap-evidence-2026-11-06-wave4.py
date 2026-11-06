#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 4: the next twelve products from the
# post-v6-migration staleness ranking (waves 1-3 = PRs #623, #627, #630). Roster: buzz,
# bolna, orb, stripe-billing, rive, spline, morph, working-copy, puzzle, google-adk,
# maritime, poke. iterm2 stays deferred (settled unsupported-churn cell; wave-2 ledger).
#
# Same fail-closed verification and plumbing as the wave-3 script (HTTP 200 plus every
# marker in raw body or tag-stripped, whitespace-normalized text; mismatch aborts;
# REMOVALS / UPDATES / PRESERVE_IDS / NEGATIVE_CHECKS, the #502 probe-negative
# convention). Counter-check probe rows record disabled runners and decoy or unpublished
# specs up front; excerpts carry scope caveats verbatim.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave4.json:
#   - buzz api-machine-spec: no openapi/swagger path anywhere in the monorepo tree; the
#     protocol surface is RFC-style NIP markdown drafts ("`draft` `optional`" status
#     labels), appended as context.
#   - buzz api-interactive-docs: buzz.xyz is a splash page; docs are repo markdown; no
#     reference or runner exists.
#   - buzz api-sandbox: the staging relay images are maintainer-only pre-merge artifacts
#     ("must not be promoted to production", wired to Block's internal staging infra);
#     the dev relay quick start is self-hosted local development.
#   - bolna api-machine-spec: the docs llms.txt declares "## OpenAPI Specs" pointing at
#     /docs/api-reference/openapi.yml, but the file answers 404 (.yaml/.json variants
#     too) and the GitHub repo carries no spec; recorded as a preserved counter-check
#     with the 404 enforced fail-closed.
#   - bolna api-sandbox: no sandbox or test mode across the 345-page docs index; the
#     only test-adjacent surface is a live SIP carrier "test call".
#   - orb api-interactive-docs: the endpoint pages configure the Mintlify playground
#     "display":"simple" (runner disabled, zero "Try it"); preserved counter-check.
#   - orb api-versioning-policy: versioning/changelog docs pages 404; the AnnounceKit
#     changelog is a product what's-new feed; the only "deprecate" hits are the
#     usage-event deprecation data operation.
#   - stripe-billing api-interactive-docs: the API reference is copyable multi-language
#     examples; "Try it" and "playground" have zero occurrences, and personalization
#     ("Log in to see docs with your test key and data") sits behind login.
#   - rive api-machine-spec: the docs llms.txt lists an OpenAPI that turns out to be
#     Mintlify's starter-kit sample ("OpenAPI Plant Store", server sandbox.mintlify.com);
#     preserved counter-check records the decoy. Rive's developer surface is runtime
#     SDKs; no Rive API spec exists.
#   - rive api-interactive-docs: /docs/api-reference answers 404; no runner anywhere.
#   - rive api-sandbox: the only sandbox is Luau/AnimaScript script isolation inside
#     runtimes, a security boundary, not a test environment.
#   - spline, all four stories: no REST API (the "Code API" is a JS runtime library,
#     appended as context; the "Real-time API" is an editor feature for calling
#     third-party APIs); no reference, no runner; the editor's Response preview and the
#     auto-generated live webhook URL are dev conveniences without isolation; the
#     "Version History" page is design-file history. No API versioning surface.
#   - morph api-sandbox: every "sandbox" hit is the third-party Blaxel integration; the
#     CLI --dry-run is a client-side preview; the Try-it runner hits production.
#   - working-copy, all four stories: the automation surface is the x-callback-url
#     scheme documented as prose (appended as context); no machine schema, no runner
#     (the examples are working-copy:// deep links), no test mode (write/read commands
#     gated by an app-generated secret key), no versioning or deprecation statement.
#   - maritime api-sandbox: Maritime's PRODUCT is ephemeral sandboxes for customer
#     workloads; no account test mode, test keys, or staging environment exists (the
#     CLI documents a dry-run flag and new accounts get a $20-capped trial).
#   - poke api-machine-spec: a single documented endpoint with inline examples; no
#     openapi (poke.com/openapi.json 404).
#   - poke api-interactive-docs: static highlighted code blocks; no runner.
#   - poke api-sandbox: none documented; Recipe testing in Kitchen is recipe tooling.
#   - puzzle (none absent: spec, Try It! reference, sandbox server, and a stability
#     statement all exist, each scoped in its excerpt).
#   - google-adk (none absent: the spec, interactive /docs, local test harness, and
#     release/migration surfaces are all documented, each scoped to the local dev
#     server where applicable).
#
# Reachability notes: developers.puzzle.io and docs.puzzle.io are NXDOMAIN; the vendor
# docs live at puzzle-api.readme.io (linked from puzzle.io/llms.txt) and the spec at
# app.puzzle.io/rest/v0/openapi.yaml (the ReadMe sync source; the ReadMe download button
# is admin-gated). workingcopyapp.com/url-schemes needs the .html suffix. adk.dev is the
# canonical ADK docs host (google.github.io/adk-docs serves the same content). No bot
# walls were hit in this wave.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> --product <id>
#   pnpm engine derive --category <arena>
# then the dependent generators, and the pre-audit over every upward flip BEFORE the
# first push (the wave-2/3 procedure).
import datetime
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (arena, product) -> list of (id, tier, url, required live markers, excerpt)
ITEMS = {
    ('team-chat', 'buzz'): [
        ('buzz-nostr-protocol-20261106', 'github',
         'https://raw.githubusercontent.com/block/buzz/main/NOSTR.md',
         ['Buzz is a Nostr relay that speaks NIP-29 (relay-based groups) natively.'],
         'Buzz\'s programmatic surface is the Nostr protocol: "Buzz is a Nostr relay that speaks NIP-29 (relay-based groups) natively. Third-party Nostr clients connect directly to `buzz-relay` using NIP-29 and NIP-42 authentication." The protocol extensions are RFC-style markdown NIP drafts in the repository (status labels "`draft` `optional`"); no machine-readable API specification exists anywhere in the monorepo (zero openapi/swagger paths in the repo tree).'),
        ('buzz-release-lanes-20261106', 'github',
         'https://raw.githubusercontent.com/block/buzz/main/RELEASING.md',
         ['Buzz has three independent release lanes.'],
         '"Buzz has three independent release lanes" (desktop, relay, mobile), each versioned independently with release PRs and immutable tags, alongside a dated, PR-linked CHANGELOG. This is product release versioning; protocol stability is expressed only through NIP status labels, and no deprecation policy exists for the relay API surface.'),
    ],
    ('voice-agents', 'bolna'): [
        # Counter-check (preserved): the vendor declares an OpenAPI-backed reference but
        # the spec file answers 404 (enforced fail-closed via NEGATIVE_CHECKS).
        ('bolna-spec-declared-404-20261106', 'probe',
         'https://www.bolna.ai/docs/llms.txt',
         ['## OpenAPI Specs', '- [openapi](/docs/api-reference/openapi.yml)'],
         'PROBE spec-publication check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave4.py): the Bolna docs llms.txt declares "## OpenAPI Specs" pointing at /docs/api-reference/openapi.yml, and the reference pages bind to that document in their page config, but the file answers 404 (as do the .yaml and .json variants) and the bolna-ai/bolna repository carries no spec file. The reference is spec-driven but the machine-readable document is not published.'),
        ('bolna-api-playground-20261106', 'claimed-docs',
         'https://www.bolna.ai/docs/api-reference/agent/v2/create',
         ['Try it'],
         'The Mintlify API reference renders a live "Try it" runner per endpoint (e.g. Create voice AI agent, POST https://api.bolna.ai/v2/agent) with generated cURL and request samples; the disabled-playground config is absent, so the in-page runner is active.'),
        ('bolna-v2-api-overview-20261106', 'claimed-docs',
         'https://www.bolna.ai/docs/api-reference/agent/v2/overview.md',
         ['# Bolna voice AI agent APIs overview'],
         'The agent API surface is explicitly URL-versioned at /v2 (POST /v2/agent, GET /v2/agent/:agent_id and the rest of the v2 endpoint catalog).'),
        ('bolna-monthly-changelog-20261106', 'claimed-docs',
         'https://www.bolna.ai/docs/changelog/october-2026.md',
         ['# Bolna AI Updates for October, 2026'],
         'Bolna publishes dated monthly changelogs covering features and API updates (December 2024 through the current month). A versioning-and-support policy page exists but is scoped to the CLI\'s beta semantic-versioning plans; REST deprecations are documented ad hoc through migration guides (e.g. the legacy post-call extraction removal), with no stated commitment window for the API.'),
    ],
    ('billing-subscriptions', 'orb'): [
        # Pre-audit correction (before the first push): three agentic cells re-rolled to
        # partials by inferring an MCP server from a row quoted only for its test-mode
        # line. The MCP server page itself is the fetchable artifact; appended properly so
        # those cells rest on its text.
        ('orb-mcp-server-20261106', 'claimed-docs',
         'https://docs.withorb.com/api-reference/mcp-server.md',
         ['The Orb MCP server is a hosted [Model Context Protocol](https://modelcontextprotocol.io) server.',
          'It exposes 100+ Orb API operations as tools',
          'Each scope covers one area of Orb, such as customers and credits, subscriptions, invoices, plans or prices, and can be set to **none**, **read** or **write**.'],
         'Orb runs a hosted first-party MCP server (https://mcp.withorb.com/mcp, Streamable HTTP, bearer-key auth): "It exposes 100+ Orb API operations as tools, covering customers, subscriptions, plans and prices, billable metrics, invoices, credits, alerts, licenses, event search and price evaluation", so "You can ask an agent to look into a customer\'s bill, check why usage isn\'t showing up, model a price change, or make a subscription change". The server acts with the connected key\'s permissions, and keys are scope-controlled per area: "Each scope covers one area of Orb... and can be set to **none**, **read** or **write**", with out-of-scope tool calls failing with a permissions error.'),
        ('orb-openapi-spec-20261106', 'claimed-docs',
         'https://docs.withorb.com/api-reference/orb-openapi.json',
         ['"openapi": "3.1.0"',
          'You can download the latest OpenAPI spec'],
         'Orb publishes its full OpenAPI 3.1 document on the docs domain (listed under "## OpenAPI Specs" in the docs llms.txt), and the spec\'s own description points at the canonical vendor download: "You can download the latest OpenAPI spec [here](https://api.withorb.com/spec.json) - pass `?version=3.0` for an OpenAPI 3.0-compatible spec" (api.withorb.com/spec.json serves the same document, unauthenticated).'),
        # Counter-check (preserved): the reference ships copyable examples with the
        # interactive runner disabled.
        ('orb-playground-disabled-20261106', 'probe',
         'https://docs.withorb.com/api-reference/alert/create-customer-alert',
         ['"playground":{"display":"simple"'],
         'PROBE docs playground check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave4.py): the Orb API reference endpoint pages configure the Mintlify playground as "playground":{"display":"simple"} — request/response display with copyable code samples and the interactive in-page runner disabled; no "Try it" control renders.'),
        ('orb-test-mode-20261106', 'claimed-docs',
         'https://docs.withorb.com/tutorials/first-usage-event.md',
         ['Enable test mode',
          'In **Test Mode**, you can create test pricing plans, simulate different workflows, and send in dummy data.'],
         'Orb documents a Test Mode with mode-scoped API keys: "In **Test Mode**, you can create test pricing plans, simulate different workflows, and send in dummy data", with keys created to "interact with resources in **Test Mode**". The rate-limits reference carries separate live-mode and test-mode limit columns. Test Mode is documented through the tutorial and MCP pages rather than a dedicated concept page.'),
        ('orb-test-mode-isolation-20261106', 'claimed-docs',
         'https://docs.withorb.com/api-reference/mcp-server.md',
         ['To try things out without touching live billing data, create the key in **test mode**.'],
         'The MCP server docs state the isolation plainly: "To try things out without touching live billing data, create the key in **test mode**."'),
    ],
    ('billing-subscriptions', 'stripe-billing'): [
        ('stripe-openapi-repo-20261106', 'github',
         'https://raw.githubusercontent.com/stripe/openapi/master/README.md',
         ["# Stripe's OpenAPI Specification",
          "This repository contains [OpenAPI specifications][openapi] for Stripe's API."],
         'Stripe maintains its machine-readable API specification in the official stripe/openapi repository: "This repository contains OpenAPI specifications for Stripe\'s API", with a documented layout (latest GA release with v1 and v2 endpoints, preview specs, legacy v1-only specs) in JSON and YAML, public (spec3) and SDK variants. The spec is platform-wide and covers the Billing resources; no Billing-only spec exists.'),
        ('stripe-sandboxes-20261106', 'claimed-docs',
         'https://docs.stripe.com/sandboxes.md',
         ['A sandbox is an isolated test environment.',
          "experiment with new features without affecting your live integration"],
         '"A sandbox is an isolated test environment. You can use your sandbox to test Stripe functionality in your account, and experiment with new features without affecting your live integration. For example, when testing in a sandbox, the payments you create aren\'t processed by card networks or payment providers." Multiple sandboxes stay isolated from each other ("Changes made in one sandbox don\'t interfere with changes in another"), and general sandboxes supersede the legacy test-mode sandbox.'),
        ('stripe-testing-20261106', 'claimed-docs',
         'https://docs.stripe.com/testing.md',
         ['test Stripe functionality in your account without affecting your live integration'],
         'Stripe\'s testing docs: "test Stripe functionality in your account without affecting your live integration" by "simulating transactions with test values—these transactions don\'t move funds", with a dedicated Billing pointer ("Test your Billing integration") for subscription integrations.'),
        ('stripe-api-versioning-20261106', 'claimed-docs',
         'https://docs.stripe.com/api/versioning.md',
         ['we release new API versions monthly with no breaking changes',
          'Stripe-Version'],
         'Stripe documents dated API versions with a formal cadence: "we release new API versions monthly with no breaking changes. Twice a year, we issue a new major release... that starts with an API version containing breaking changes." Requests pin a version via the Stripe-Version header or SDK pinning; the current dated version is named on the page. The policy is platform-wide and applies to the Billing endpoints.'),
        ('stripe-upgrades-20261106', 'claimed-docs',
         'https://docs.stripe.com/upgrades.md',
         ['Stripe-Version'],
         'The upgrades guide documents the version-transition procedure ("To test a newer version for API calls, set the `Stripe-Version` header") and links the full dated API changelog.'),
    ],
    ('design-tools', 'rive'): [
        # Counter-check (preserved): the llms.txt-listed OpenAPI is Mintlify's sample.
        ('rive-sample-spec-decoy-20261106', 'probe',
         'https://rive.app/docs/api-reference/openapi.json',
         ['OpenAPI Plant Store',
          'A sample API that uses a plant store as an example'],
         'PROBE spec check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave4.py): the docs llms.txt lists an OpenAPI document, but the served file is Mintlify\'s starter-kit sample spec ("OpenAPI Plant Store": "A sample API that uses a plant store as an example", server sandbox.mintlify.com, paths /plants only) — not a Rive API. Rive\'s developer surface is its runtime SDKs; no machine-readable Rive API specification exists, and /docs/api-reference answers 404.'),
        ('rive-runtime-migrations-20261106', 'claimed-docs',
         'https://rive.app/docs/runtimes/web/migration-guides.md',
         ['Migrating between major versions',
          'The `@rive-app/webgl` package is deprecated and no longer receives updates after `v2.37.0`'],
         'Rive maintains per-runtime migration guides for major versions, including explicit deprecations with a stated last-updated version and replacement: "The `@rive-app/webgl` package is deprecated and no longer receives updates after `v2.37.0`" (replaced by @rive-app/webgl2), with parallel guides for React, React Native, Flutter, and Apple. This is SDK package versioning and deprecation; Rive has no versioned HTTP API.'),
        ('rive-feature-support-20261106', 'claimed-docs',
         'https://rive.app/docs/feature-support.md',
         ['When a feature requires API changes, migration notes will be included below'],
         'A feature-support matrix maps editor features to runtime versions per platform with the commitment "When a feature requires API changes, migration notes will be included below" and the recommendation to stay on the latest runtime version.'),
    ],
    ('design-tools', 'spline'): [
        ('spline-code-api-20261106', 'claimed-docs',
         'https://docs.spline.design/exporting-your-scene/web/code-api-for-web.md',
         ['The Code API is a set of tools for developers to add custom interactivity between Spline scenes and their custom code'],
         'Spline\'s developer surface is a JavaScript runtime library: "The Code API is a set of tools for developers to add custom interactivity between Spline scenes and their custom code", based on the Spline Runtime npm package. There is no REST API, no machine-readable spec, no hosted reference or runner; the editor\'s "Real-time API" feature calls third-party APIs from scenes, and its Response preview plus the auto-generated live webhook URL are in-editor conveniences without an isolated test environment.'),
    ],
    ('inference-providers', 'morph'): [
        ('morph-openapi-spec-20261106', 'claimed-docs',
         'https://docs.morphllm.com/api-reference/openapi.json',
         ['"openapi": "3.1.0"', '"title": "Morph API"'],
         'Morph publishes a downloadable OpenAPI 3.1.0 document (info title "Morph API") covering the public surface at api.morphllm.com: OpenAI- and Anthropic-compatible inference, Fast Apply, Compact, System One, model listing, dedicated endpoint management, credits and budgets (14 paths under /v1 and /api/v1). The docs llms.txt carries no spec section; the document serves from the api-reference path the reference pages are generated from.'),
        ('morph-models-feed-20261106', 'claimed-docs',
         'https://www.morphllm.com/api/models/json',
         ['"schema_version"'],
         'Morph also serves a machine-readable model catalog: per the docs llms.txt, "For machine-readable models, limits and these list prices, fetch https://www.morphllm.com/api/models/json?prices=list" (per-model ids, context limits, modalities, pricing; schema-versioned). It is a model and pricing feed, not an API specification.'),
        ('morph-api-playground-20261106', 'claimed-docs',
         'https://docs.morphllm.com/api-reference/endpoint/systemone',
         ['Try it'],
         'The Mintlify API reference renders a live "Try it" runner per endpoint (System One, Apply/chat completions, Compact, models, dedicated endpoints, credits), generated from the OpenAPI document; the disabled-playground config is absent. Runs execute against the production base URL api.morphllm.com with the user\'s bearer key.'),
        ('morph-router-deprecations-20261106', 'claimed-docs',
         'https://docs.morphllm.com/sdk/components/router.md',
         ['They remain **fully supported for backward compatibility**',
          'The provider endpoints will be removed in a future release'],
         'Morph documents endpoint-level deprecation with a backward-compatibility commitment: the legacy router endpoints "remain **fully supported for backward compatibility**, so existing integrations keep working with no changes, but new code should use the endpoints above. The provider endpoints will be removed in a future release", with a stated migration target. Paths are versioned (/v1, /api/v1) and models carry dated snapshots; no standalone versioning policy document or API changelog exists.'),
    ],
    ('mobile-dev', 'working-copy'): [
        ('working-copy-url-schemes-20261106', 'claimed-docs',
         'https://workingcopyapp.com/url-schemes.html',
         ['x-callback-url',
          'Commands that change data or read content out of Working Copy are protected by a secret key'],
         'Working Copy\'s automation surface is its x-callback-url scheme, documented as prose with inline example deep links (working-copy://x-callback-url/<command>/...). Write and read commands are gated by an app-generated secret: "Commands that change data or read content out of Working Copy are protected by a secret key". There is no machine-readable schema, no interactive reference (the examples are iOS deep links), no test mode, and no versioning or deprecation statement for the scheme.'),
    ],
    ('accounting', 'puzzle'): [
        # PR #632 review round 2 (P1 ar-aging-customer-balances): the fix-round re-roll
        # had credited receivables foundations from adjacent tools; the AR aging report
        # and per-customer balances are vendor-documented and appended so the cell rests
        # on that text.
        ('puzzle-ar-aging-20261106', 'claimed-docs',
         'https://help.puzzle.io/en/articles/17631957-ai-for-accounts-receivable-in-puzzle.md',
         ["it shows what's overdue by customer",
          'ask Claude, ChatGPT or another AI assistant through the Puzzle MCP',
          'grouped into **Current**, **1-30**, **31-60**, **61-90** and **91+** days'],
         'Puzzle documents an AR aging report with per-customer balances: "it shows what\'s overdue by customer, finds the payments that most likely pay your open invoices, and flags the receivables that need attention before you close the month. You can work in the app, run AI tasks, or ask Claude, ChatGPT or another AI assistant through the Puzzle MCP." Under Revenue → AR aging, "Each customer\'s unpaid invoices are grouped into Current, 1-30, 31-60, 61-90 and 91+ days" with unapplied payments; the FAQ adds the report "includes all of your outstanding invoices" wherever created.'),
        # PR #632 review (P1 agent-answers-affordability): the re-judged full cited
        # conversational MCP access plus runway metrics while its rationale noted the
        # missing tool coverage and affordability flow. Both are documented; appended so
        # the cell rests on the vendor's own text.
        ('puzzle-mcp-tools-20261106', 'claimed-docs',
         'https://help.puzzle.io/en/articles/15331316-how-to-setup-your-puzzle-mcp.md',
         ['With write access turned on (Beta), your assistant can also make changes',
          'Try asking things like'],
         'The Puzzle MCP setup guide documents the exposed ledger surface: tools covering trial balance, cash activity, transactions, journal entries, chart of accounts, invoices, bills, vendors, customers, payroll, revenue/expense/spending metrics and ledger accounts, connected at https://app.puzzle.io/mcp. "Once connected, open a new conversation and start exploring your financials. Try asking things like \'What does my income statement look like this quarter?\' or \'Show me my top vendors by spend.\'" "With write access turned on (Beta), your assistant can also make changes... It confirms each change with you before making it."'),
        ('puzzle-runway-forecast-20261106', 'claimed-docs',
         'https://help.puzzle.io/en/articles/17631956-cash-runway-and-cash-flow-forecasting-in-puzzle.md',
         ['Puzzle projects your cash from your live books',
          'ask Claude, ChatGPT or another AI assistant through the Puzzle MCP'],
         '"Puzzle projects your cash from your live books: how long your cash lasts at your current burn, the month you\'d run out, when to start raising, and a week-by-week cash flow forecast built from your open invoices, bills and payroll. You can see runway on the Dashboard, run a forecast as an AI task, or ask Claude, ChatGPT or another AI assistant through the Puzzle MCP." Affordability-style questions (runway, burn, cash-out timing) are answerable through the agent against the live ledger.'),
        ('puzzle-openapi-spec-20261106', 'claimed-docs',
         'https://app.puzzle.io/rest/v0/openapi.yaml',
         ['openapi: 3.0.3', 'title: Puzzle Api'],
         'Puzzle publishes a machine-readable OpenAPI 3.0.3 document (info title "Puzzle Api", server https://app.puzzle.io/rest/v0) on its app domain; it is the sync source for the vendor\'s ReadMe-hosted developer reference (puzzle-api.readme.io, linked from puzzle.io\'s llms.txt). The spec URL is not prose-linked on a docs page and the ReadMe download button is admin-gated; the document itself downloads unauthenticated.'),
        ('puzzle-api-tryit-20261106', 'claimed-docs',
         'https://puzzle-api.readme.io/reference/balances',
         ['Try It!'],
         'The ReadMe-hosted API reference ships the live "Try It!" console per endpoint ("Click Try It! to start a request and see the response here!") with generated language snippets. Executing requests needs the caller\'s own credentials; API access is request-gated (api@puzzle.io) per the getting-started page.'),
        ('puzzle-sandbox-server-20261106', 'claimed-docs',
         'https://puzzle-api.readme.io/docs/getting-started',
         ['Sandbox Server', 'https://staging.southparkdata.com', 'https://api.puzzle.io',
          'Request your sandbox credentials by emailing us at'],
         'Puzzle documents a sandbox separate from production: "Sandbox Server: https://staging.southparkdata.com / Production Server: https://api.puzzle.io", with sandbox credentials (client id/secret, connection key; cid_test_/sk_test_ examples) issued on request: "Request your sandbox credentials by emailing us at" api@puzzle.io. The sandbox host is a non-puzzle.io staging domain and credentials are manually provisioned rather than self-serve.'),
        ('puzzle-api-stability-20261106', 'claimed-docs',
         'https://puzzle-api.readme.io/docs/getting-started',
         ['what is currently documented here and released will remain stable for the indefinite future'],
         'The API is URL-versioned (base path /rest/v0) and the vendor states a stability commitment: "Our API is currently under development. We will be continually adding new features and endpoints", while "what is currently documented here and released will remain stable for the indefinite future. We will work with you on any potential changes to assure a smooth transition." No deprecation timelines, changelog, or formal policy page exist.'),
    ],
    ('agent-frameworks', 'google-adk'): [
        ('google-adk-openapi-spec-20261106', 'claimed-docs',
         'https://adk.dev/api-reference/rest/openapi.json',
         ['"openapi"', 'ADK REST API Reference'],
         'ADK publishes a downloadable OpenAPI 3.1 document (info title "ADK REST API Reference") for the ADK API server, extracted at docs build time from the FastAPI app and linked from the docs\' API Reference index. The spec describes the local dev server (`adk api_server`); the running server\'s own /openapi.json endpoint is not separately documented in prose.'),
        ('google-adk-swagger-docs-20261106', 'claimed-docs',
         'https://adk.dev/runtime/api-server/index.md',
         ['Swagger UI interactive documentation is served at `/docs`',
          'Try it out'],
         'ADK documents a built-in interactive reference: "Swagger UI interactive documentation is served at `/docs` by the Python and TypeScript ADK API servers only" (http://localhost:8000/docs), where "You can even click \\"Try it out\\" to send live requests to your running agents." The docs site additionally hosts a Swagger UI browsing the published spec. The Go API server exposes no /docs endpoint, and live execution targets the user\'s own local server.'),
        ('google-adk-local-testing-20261106', 'claimed-docs',
         'https://adk.dev/runtime/api-server/index.md',
         ['Use the API server in ADK to expose your agents through a REST API for programmatic testing'],
         'ADK documents a local pre-deployment test harness: "Before you deploy your agent, you should test it to ensure that it is working as intended", using `adk api_server` ("Use the API server in ADK to expose your agents through a REST API for programmatic testing") and the ADK Web dev UI, which is explicitly "not meant for use in production deployments". This is a local development/test surface on the user\'s machine, not a hosted sandbox, and it still calls real model APIs unless configured otherwise.'),
        ('google-adk-v2-migration-20261106', 'claimed-docs',
         'https://adk.dev/2.0/index.md',
         ['breaking changes',
          'Deprecated'],
         'ADK documents versioned releases with migration guidance: the 2.0 page enumerates per-language breaking changes and deprecations (e.g. deprecated workflow agent classes that log "a deprecation warning once per class, per process"), pinning guidance for staying on 1.x, and Go\'s major-version module path. Release notes live in each language repository, and docs pages carry per-feature version badges. Versioning practice is demonstrated rather than promised: no semver commitment or deprecation-window policy page exists.'),
    ],
    ('agent-sandboxes', 'maritime'): [
        ('maritime-openapi-spec-20261106', 'claimed-docs',
         'https://api.maritime.sh/openapi.json',
         ['"openapi":"3.1.0"', '"title":"Maritime API"'],
         'Maritime serves a live OpenAPI 3.1 document at the API origin (info title "Maritime API"), advertised in the vendor llms.txt as "The full REST API, bearer mk_ key". The document is the raw FastAPI-generated spec and includes internal host-events paths alongside the public surface.'),
        ('maritime-swagger-ui-20261106', 'claimed-docs',
         'https://api.maritime.sh/docs',
         ['Maritime API - Swagger UI'],
         'The API origin hosts Swagger UI over the live spec ("Maritime API - Swagger UI", loading /openapi.json), with in-page request execution against the real API using a bearer key; the vendor llms.txt advertises it ("Swagger UI at https://api.maritime.sh/docs"). The prose docs carry copyable curl examples rather than an embedded runner.'),
        ('maritime-changelog-20261106', 'claimed-docs',
         'https://maritime.sh/changelog',
         ['New features and improvements to Maritime, as they ship.'],
         'Maritime publishes a dated per-release changelog ("New features and improvements to Maritime, as they ship.", one entry page per release). There is no documented API versioning scheme, version header, or deprecation policy (the spec reports version 0.1.0); the only backward-compatibility surface found is a documented deprecated alias kept for old clients (`lifetimeMinutes` for `timeLimitMinutes` in the CLI docs).'),
    ],
    ('ai-assistants', 'poke'): [
        ('poke-api-deprecation-20261106', 'claimed-docs',
         'https://poke.com/docs/api',
         ['is deprecated',
          'requires a V2 API key created in Kitchen'],
         'Poke\'s API is a single documented endpoint on a versioned path (POST https://poke.com/api/v1/inbound/api-message, bearer auth) and the page documents a concrete deprecation with its migration: the legacy inbound-sms webhook endpoint "is deprecated", the replacement "requires a V2 API key created in Kitchen", and existing V1 pk_ keys do not work with it. No machine-readable spec (poke.com/openapi.json 404), no interactive reference (static highlighted examples), no sandbox, and no sunset dates or stability-commitment policy are published; dated product release notes exist at /docs/release-notes.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none in this wave).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace; none at wave start).
UPDATES: dict = {}

# Hand-recorded counter-check rows that a scheduled refresh must not clobber.
PRESERVE_IDS = {'bolna-spec-declared-404-20261106', 'orb-playground-disabled-20261106',
                'rive-sample-spec-decoy-20261106'}

# Fail-closed probe negatives (the #502 convention): every URL an excerpt asserts is
# absent must answer exactly 404 on each run; any other status exits inconclusive and
# nothing is written.
NEGATIVE_CHECKS = {
    'bolna-spec-declared-404-20261106': [
        'https://www.bolna.ai/docs/api-reference/openapi.yml',
        'https://www.bolna.ai/docs/api-reference/openapi.yaml',
        'https://www.bolna.ai/docs/api-reference/openapi.json',
    ],
    'poke-api-deprecation-20261106': [
        'https://poke.com/openapi.json',
    ],
}

_fetch_cache: dict = {}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    r = subprocess.run(
        ['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=45)
    body, _, meta = r.stdout.rpartition('\n---META ')
    _fetch_cache[url] = (int(meta.strip() or 0), body)
    return _fetch_cache[url]


def verify(url, markers):
    status, body = fetch(url)
    if status != 200:
        raise SystemExit(f'{url} returned {status}; refusing to append unverified evidence')
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))
    for marker in markers:
        if marker not in text and marker not in body:
            raise SystemExit(f'{url} no longer contains {marker!r}; the page changed - re-derive the excerpt')


def verify_absent(urls):
    for url in urls:
        status, _ = fetch(url)
        if status != 404:
            raise SystemExit(
                f'{url} answered {status}, not 404; the asserted absence no longer holds - '
                'inconclusive, nothing written. Re-derive the counter-check.')


def main() -> None:
    for (arena, pid) in sorted(set(ITEMS) | set(REMOVALS) | set(UPDATES)):
        items = ITEMS.get((arena, pid), [])
        ef = os.path.join(ROOT, 'open-rankings', arena, 'evidence', f'{pid}.json')
        with open(ef) as f:
            ev = json.load(f)
        removals = set(REMOVALS.get((arena, pid), []))
        removed = len([e for e in ev if e['id'] in removals])
        ev = [e for e in ev if e['id'] not in removals]
        have = {e['id'] for e in ev}
        added = 0
        for iid, tier, url, markers, excerpt in items:
            if iid in NEGATIVE_CHECKS:
                verify_absent(NEGATIVE_CHECKS[iid])
            if iid in have:
                print(f'{iid}: already present, skipping')
                continue
            verify(url, markers)
            row = {'id': iid, 'tier': tier, 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW}
            if iid in PRESERVE_IDS:
                row['preserve'] = True
            ev.append(row)
            added += 1
        updated = 0
        for iid, url, markers, excerpt in UPDATES.get((arena, pid), []):
            for e in ev:
                if e['id'] == iid and e['excerpt'] != excerpt:
                    verify(url, markers)
                    e['url'] = url
                    e['excerpt'] = excerpt
                    e['fetchedAt'] = NOW
                    updated += 1
        if added or removed or updated:
            with open(ef, 'w') as f:
                f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{arena}/{pid}: +{added} / -{removed} / ~{updated} evidence items ({len(ev)} total)')


if __name__ == '__main__':
    main()
