#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-05 wave 1: the post-v6-migration staleness scan
# (rankings-engine/scripts/staleness-scan.ts, re-run offline against main on 2026-11-05)
# ranks 144 products carrying the api-quality gap signature (`agentic-public-api`
# full/partial while all four api-quality stories are zero-evidence none). This wave
# repairs the twelve worst-stale of them. Same precedent chain as
# append-api-quality-docs-evidence.py (the 54-product audit),
# append-api-quality-gap-evidence-2026-10-21.py, and the fail-closed verification of
# append-claude-parity-evidence-2026-11-03.py: every item is verified live before it is
# appended (HTTP 200 plus every marker present in the raw body or the tag-stripped,
# whitespace-normalized page text); any mismatch aborts the run, so a changed page can
# never append a stale excerpt.
#
# Verified-honest counterparts (NO items added, on purpose — the figma/databricks
# precedent). Per-cell detail, including every checked URL, lives in
# reports/evidence-parity/2026-11-05-api-quality-wave1.json:
#   - browserbase api-sandbox: no API sandbox, test mode, or non-production environment is
#     documented (docs.browserbase.com/llms-full.txt scanned; every "sandbox" hit is an
#     agent-execution sandbox, and the one "test mode" hit is Stripe Link's).
#   - browserbase api-versioning-policy: endpoints live under /v1 and the OpenAPI document
#     declares "version: v1", but no versioning, stability, or deprecation policy page
#     exists (llms-full.txt, reference overview, and changelog checked).
#   - lm-studio api-machine-spec: no OpenAPI/Swagger document is published
#     (lmstudio.ai/openapi.{json,yaml} serve the SPA fallback; docs paths 404; a GitHub
#     code search across the lmstudio-ai org finds no spec).
#   - lm-studio api-interactive-docs: the REST docs are static pages with copyable
#     snippets; no "Try it" runner or documented built-in explorer.
#   - lm-studio api-sandbox: no sandbox or test mode documented anywhere in the docs
#     corpus (lmstudio.ai/llms.txt scanned).
#   - ollama api-interactive-docs: the Mintlify endpoint pages configure the playground as
#     "display":"simple" — copyable examples with the interactive runner disabled — and no
#     page documents a built-in explorer for the local server.
#   - ollama api-sandbox: no test mode or sandbox for ollama.com cloud or the local API
#     (docs.ollama.com/llms-full.txt scanned; "sandbox" hits are third-party integration
#     contexts).
#   - vllm api-sandbox: self-hosted server with no documented test environment (full
#     mkdocs search index scanned; closest is a LoRA dynamic-loading warning that it
#     "should ONLY be used for local development!").
#   - langsmith api-sandbox: "LangSmith Sandboxes" are managed code-execution sandboxes
#     for agents, a product feature, not a test mode for the LangSmith API; no API test
#     environment is documented.
#   - semgrep api-sandbox: no sandbox or test environment in the API docs; the Semgrep
#     "Playground" is a rule-writing tool, and API tokens operate on real deployment data.
#   - discord api-interactive-docs: the developer docs are markdown-driven with static
#     examples and endpoint tables, no in-page runner; the vendor's Postman collection is
#     external tooling.
#   - zulip api-interactive-docs: endpoint pages show static tabbed usage examples
#     (Python/JavaScript/curl/zulip-send); nothing runnable in-page.
#   - zulip api-sandbox: no API sandbox or test mode documented; chat.zulip.org is the
#     project's community server (its "#test here" channel is an etiquette convention,
#     not an isolated test environment).
#   - wandb-weave api-sandbox: no sandbox or test mode under products/wandb/weave on
#     docs.coreweave.com (full sitemap scanned; the closest page is the in-UI LLM prompt
#     Playground, which operates on production project data).
#   - wandb-weave api-versioning-policy: no versioning or deprecation policy specific to
#     the trace.wandb.ai HTTP API is documented, and the spec carries no version headers
#     (service-api reference and release-notes section checked). The W&B Server release
#     policy covers a different surface (server release operations); it was initially
#     appended here and removed after the PR #623 review (see REMOVALS).
#
# Reachability notes: W&B docs (weave-docs.wandb.ai) now redirect to docs.coreweave.com,
# and developer.mixpanel.com now redirects to docs.mixpanel.com (Mintlify-hosted; the old
# ReadMe "Try It!" consoles are gone). docs.coreweave.com/llms.txt lists a Weave OpenAPI
# spec at /products/wandb/weave/reference/service-api/openapi.json that answers 404; the
# working machine spec is https://trace.wandb.ai/openapi.json. LiteLLM's former public
# demo proxy (litellm-api.up.railway.app) answers 404; its spec and Swagger UI are served
# by every user-deployed proxy, per the docs cited below. No bot walls were hit anywhere
# in this wave.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> --product <id>
#   pnpm engine derive --category <arena>
# and regenerate the dependent generators (vendor reviews, step rankings, story graph,
# confidence intervals, badges).
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
    ('web-scraping', 'browserbase'): [
        ('browserbase-openapi-spec-20261105', 'claimed-docs',
         'https://docs.browserbase.com/reference/api/openapi.v1.yaml',
         ['openapi: 3.0.0', 'title: Browserbase API',
          'description: Browserbase API for 3rd party developers'],
         'docs.browserbase.com publishes a downloadable OpenAPI 3.0.0 document whose info block reads "title: Browserbase API" and "description: Browserbase API for 3rd party developers", version v1, server url https://api.browserbase.com. The docs llms.txt lists it under an "## OpenAPI Specs" heading as "[openapi.v1](/reference/api/openapi.v1.yaml)".'),
        ('browserbase-api-playground-20261105', 'claimed-docs',
         'https://docs.browserbase.com/reference/api/create-a-session',
         ['Create a Session', 'Try it'],
         'The "Create a Session" API reference page renders a live "Try it" API playground (the Mintlify api.playground runtime) with a runnable request to https://api.browserbase.com/v1/sessions. The same "Try it" control appears across the /reference/api endpoint pages, which are generated from the published OpenAPI document.'),
    ],
    ('local-llm-runtimes', 'lm-studio'): [
        ('lm-studio-api-versioning-20261105', 'claimed-docs',
         'https://lmstudio.ai/docs/developer/rest.md',
         ['With LM Studio 0.4.0, we have officially released our native v1 REST API at `/api/v1/*` endpoints and recommend using it.',
          'Previously, there was a [v0 REST API](/docs/developer/rest/endpoints).'],
         'The REST API overview documents URL-path versioning: "Previously, there was a v0 REST API. With LM Studio 0.4.0, we have officially released our native v1 REST API at `/api/v1/*` endpoints and recommend using it." The v0 API stays documented alongside v1. No explicit deprecation or sunset policy is published; the versioned path scheme and the API changelog are the documented surface.'),
        ('lm-studio-api-changelog-20261105', 'claimed-docs',
         'https://lmstudio.ai/docs/developer/api-changelog.md',
         ["Official release of LM Studio's native v1 REST API at `/api/v1/*` endpoints.",
          'LM Studio 0.4.0'],
         'A dedicated API Changelog page ("Updates and changes to the LM Studio API") tracks per-release API changes, e.g. the "Official release of LM Studio\'s native v1 REST API at `/api/v1/*` endpoints." under LM Studio 0.4.0 and the Anthropic-compatible POST /v1/messages endpoint under 0.4.1.'),
    ],
    ('local-llm-runtimes', 'ollama'): [
        ('ollama-openapi-spec-20261105', 'claimed-docs',
         'https://docs.ollama.com/openapi.yaml',
         ['openapi: 3.1.0', 'title: Ollama API',
          'OpenAPI specification for the Ollama HTTP API'],
         'docs.ollama.com serves a downloadable OpenAPI 3.1.0 document titled "Ollama API" whose description reads "OpenAPI specification for the Ollama HTTP API", with server url http://localhost:11434. The docs llms.txt lists it under "## OpenAPI Specs" as "[openapi](/openapi.yaml)".'),
        # PR #623 review (P1): the api-interactive-docs judge gave partial credit to
        # copy-and-run curl guidance while its own rationale said no interactive explorer
        # exists. The pack lacked the counter-signal; this recorded check carries it (the
        # append-ultrametric-audit-counterchecks precedent). preserve: a scheduled probe
        # refresh must not clobber a hand-recorded counter-check.
        ('ollama-playground-disabled-20261105', 'probe',
         'https://docs.ollama.com/api/chat',
         ['"playground":{"display":"simple"}'],
         'PROBE docs playground check (recorded 2026-11-05, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-05.py): the endpoint reference pages on docs.ollama.com (e.g. /api/chat) configure the Mintlify API playground as "playground":{"display":"simple"} with "examples":{"languages":["curl"]} — copyable curl examples with the interactive in-page runner disabled. No "Try it" control renders on any endpoint page, and no vendor page documents a built-in interactive explorer for the local server.'),
        ('ollama-api-versioning-20261105', 'claimed-docs',
         'https://docs.ollama.com/api/introduction.md',
         ["Ollama's API isn't strictly versioned, but the API is expected to be stable and backwards compatible",
          'Deprecations are rare and will be announced in the [release notes](https://github.com/ollama/ollama/releases)'],
         'The API introduction carries a "Versioning" section: "Ollama\'s API isn\'t strictly versioned, but the API is expected to be stable and backwards compatible. Deprecations are rare and will be announced in the release notes." An explicit vendor stability-and-deprecation commitment, though without a formal version-header or sunset scheme.'),
    ],
    ('local-llm-runtimes', 'vllm'): [
        ('vllm-openapi-endpoint-20261105', 'claimed-docs',
         'https://docs.vllm.ai/en/stable/cli/serve/',
         ["Disable FastAPI's OpenAPI schema, Swagger UI, and ReDoc endpoint."],
         'The vllm serve CLI reference documents the flag pair --disable-fastapi-docs / --enable-fastapi-docs, described as "Disable FastAPI\'s OpenAPI schema, Swagger UI, and ReDoc endpoint. Default: False": every running server publishes a machine-readable FastAPI OpenAPI schema by default. There is no downloadable static spec file; the schema is generated and served by the running instance, and the docs do not spell out the literal /openapi.json path.'),
        ('vllm-interactive-docs-20261105', 'claimed-docs',
         'https://docs.vllm.ai/en/stable/serving/online_serving/',
         ['Offline API Documentation',
          'The FastAPI /docs endpoint requires an internet connection by default.',
          'To enable offline access in air-gapped environments, use the --enable-offline-docs flag'],
         'The OpenAI-compatible server page has an "Offline API Documentation" section: "The FastAPI /docs endpoint requires an internet connection by default. To enable offline access in air-gapped environments, use the --enable-offline-docs flag". The vendor documents the built-in interactive /docs explorer (FastAPI Swagger UI, plus ReDoc per the CLI reference) on every served endpoint, including an air-gapped mode with vendored static assets.'),
        ('vllm-deprecation-policy-20261105', 'claimed-docs',
         'https://docs.vllm.ai/en/stable/contributing/deprecation_policy/',
         ['This document outlines the official policy and process for deprecating features in the vLLM project.',
          'Deprecations are tied to our minor (Y) releases following semantic versioning (X.Y.Z)',
          'APIs in the OpenAI-compatible API server'],
         'vLLM publishes a formal Deprecation Policy: "This document outlines the official policy and process for deprecating features in the vLLM project." It explicitly covers "APIs in the OpenAI-compatible API server" (plus CLI flags, environment variables, configuration, and public Python APIs) and defines a three-stage pipeline (deprecated on-by-default, then off-by-default behind an escape hatch, then removed) with "Deprecations are tied to our minor (Y) releases following semantic versioning (X.Y.Z)" and no removals in patch releases.'),
    ],
    ('agent-frameworks', 'langgraph'): [
        ('langgraph-agent-server-openapi-20261105', 'claimed-docs',
         'https://docs.langchain.com/langsmith/agent-server-openapi.json',
         ['"openapi": "3.1.0"', '"title": "LangSmith Deployment"',
          'An assistant is a configured instance of a graph.'],
         'docs.langchain.com publishes the Agent Server (LangGraph Platform runtime) OpenAPI 3.1 document, info title "LangSmith Deployment", covering Assistants ("An assistant is a configured instance of a graph."), Threads, Thread Runs, Stateless Runs, Crons, Store, A2A, MCP, and System endpoints. The docs llms.txt lists it under "## OpenAPI Specs" as "[agent-server-openapi](/langsmith/agent-server-openapi.json)"; the deployment control plane serves its own spec at https://api.host.langchain.com/openapi.json.'),
        ('langgraph-api-playground-20261105', 'claimed-docs',
         'https://docs.langchain.com/langsmith/server-api-ref.md',
         ['The Agent Server API reference is available within each',
          'at the `/docs` endpoint (e.g. `http://localhost:8124/docs`).'],
         'The Agent Server API reference states the reference "is available within each deployment at the `/docs` endpoint (e.g. `http://localhost:8124/docs`)": every deployed or locally run Agent Server ships a built-in interactive API docs endpoint. The hosted reference pages on docs.langchain.com additionally render a live "Try it" API playground per endpoint (the Mintlify api.playground runtime).'),
        ('langgraph-local-dev-testing-20261105', 'claimed-docs',
         'https://docs.langchain.com/langsmith/local-dev-testing.md',
         ['A production-like testing environment for validation.',
          'A lightweight development server for rapid iteration.'],
         'The "Local development & testing" page documents two isolated test environments for Agent Server applications: "`langgraph dev`: A lightweight development server for rapid iteration" (in-memory state, no Docker) and "`langgraph up`: A production-like testing environment for validation" (local Docker stack with PostgreSQL/Redis). The documented workflow runs develop, test locally, validate, then deploy, with production deployment as a separate later step.'),
        ('langgraph-api-versioning-20261105', 'claimed-docs',
         'https://docs.langchain.com/langsmith/api-ref-control-plane.md',
         ['## Versioning',
          'Each endpoint path is prefixed with a version (e.g. `v1`, `v2`).'],
         'The deployment control plane API reference carries a dedicated "Versioning" section: "Each endpoint path is prefixed with a version (e.g. `v1`, `v2`)", and the endpoint groups are version-labelled (Integrations v1, Deployments v2, Listeners v2). This is path-versioning documentation; no standalone deprecation or sunset policy page exists for the Agent Server data-plane API.'),
    ],
    ('llm-evals-observability', 'langsmith'): [
        ('langsmith-openapi-spec-20261105', 'claimed-docs',
         'https://api.smith.langchain.com/openapi.json',
         ['"title":"LangSmith"',
          'The LangSmith API is used to programmatically create and manage LangSmith resources.'],
         'The production API host serves its full machine-readable spec at the well-known path: an OpenAPI 3.1 document with info title "LangSmith" and description "The LangSmith API is used to programmatically create and manage LangSmith resources", paths under /api/v1/. The same spec is published on the docs site (docs.langchain.com/langsmith/langsmith-platform-openapi.json, listed in the docs llms.txt under "## OpenAPI Specs").'),
        ('langsmith-swagger-ui-20261105', 'claimed-docs',
         'https://api.smith.langchain.com/docs',
         ['LangSmith - Swagger UI'],
         'The API host itself serves an interactive Swagger UI (page title "LangSmith - Swagger UI", loading /openapi.json), with ReDoc live at /redoc. The hosted REST reference on docs.langchain.com additionally renders a runnable "Try it" playground per endpoint (e.g. GET /api/v1/info/health).'),
        ('langsmith-api-deprecations-20261105', 'claimed-docs',
         'https://docs.langchain.com/langsmith/changelog.md',
         ['The `POST /api/v1/runs/group` endpoint is now deprecated and will be sunset on January 31, 2027.'],
         'The LangSmith Cloud changelog tracks API deprecations with explicit sunset dates: "The `POST /api/v1/runs/group` endpoint is now deprecated and will be sunset on January 31, 2027. Use `POST /api/v2/threads/query` to query threads instead. The endpoint continues to work until then." The API is path-versioned (/api/v1, /api/v2), and the self-hosted release policy page documents release channels with "Breaking changes only land in a new major version".'),
    ],
    ('security-scanners', 'semgrep'): [
        ('semgrep-openapi-spec-20261105', 'claimed-docs',
         'https://semgrep.dev/api/v1/docs',
         ['This API is documented in the OpenAPI format',
          'Download OpenAPI specification:'],
         'The API docs landing page states "This API is documented in the OpenAPI format. Download OpenAPI specification: Download", linking https://semgrep.dev/api/v1/public_v1.openapi.yaml, which serves the OpenAPI 3.0.3 document (info title "Semgrep Web App") covering the /api/v1 endpoints.'),
        ('semgrep-api-playground-20261105', 'claimed-docs',
         'https://docs.semgrep.dev/api-reference/v1/findingsservice/list-code-supply-chain-or-ai-powered-detection-findings',
         ['Try it', 'List code, supply chain, or AI-powered detection findings'],
         'The OpenAPI-driven API reference renders a live "Try it" API playground per endpoint (the Mintlify api.playground runtime), e.g. "List code, supply chain, or AI-powered detection findings" (GET /api/v1/deployments/{deploymentSlug}/findings) with generated cURL examples and an in-page runner.'),
        ('semgrep-deprecation-policy-20261105', 'claimed-docs',
         'https://docs.semgrep.dev/api-reference/v1/Deprecation-Policy',
         ['stable endpoints receive at least 180 days’ notice before a breaking change or a removal',
          'the endpoint returns 410 Gone'],
         'A dedicated API Deprecation Policy page: "stable endpoints receive at least 180 days’ notice before a breaking change or a removal", after which "the endpoint returns 410 Gone" and points at its replacement. It defines what counts as a breaking change, urgent-change exceptions, and how deprecated endpoints are identified; the API is path-versioned (/api/v1, with v2 endpoints tagged Experimental) with an API Changelog page alongside.'),
    ],
    ('team-chat', 'discord'): [
        ('discord-openapi-spec-20261105', 'github',
         'https://raw.githubusercontent.com/discord/discord-api-spec/main/specs/openapi.json',
         ['"openapi": "3.1.0"', '"title": "Discord HTTP API (Preview)"'],
         'The official discord/discord-api-spec repository publishes a machine-readable OpenAPI 3.1.0 document, info title "Discord HTTP API (Preview)", API version 10, covering 150+ paths of the stable public API (a separate openapi_preview.json carries experimental features). The repo README marks the publication itself as a public preview "subject to breaking changes without advance notice", not recommended for production use yet.'),
        ('discord-test-entitlements-20261105', 'claimed-docs',
         'https://discord.com/developers/docs/monetization/implementing-app-subscriptions',
         ['Using Test Entitlements',
          'You can test your implementation by creating and deleting test entitlements'],
         'Discord documents developer test modes for its monetization APIs: "You can test your implementation by creating and deleting test entitlements. These entitlements will allow you to test your premium offering in both a subscribed and unsubscribed state" via dedicated create/delete test-entitlement endpoints, and an Application Test Mode for one-time purchases "without any credit card charges". These test modes are scoped to billing flows; no sandbox environment is documented for the API as a whole.'),
        ('discord-api-versioning-20261105', 'claimed-docs',
         'https://discord.com/developers/docs/reference',
         ['API Versioning', 'Discord exposes different versions of our API'],
         'The API Reference\'s "API Versioning" section: "Discord exposes different versions of our API. You should specify which version to use by including it in the request path like https://discord.com/api/v{version_number}", with a version-status table (v10 and v9 Available, v8 and below Deprecated or Discontinued; discontinued versions return 400 Bad Request) and a linked API change log.'),
    ],
    ('llm-evals-observability', 'wandb-weave'): [
        ('wandb-weave-openapi-spec-20261105', 'claimed-docs',
         'https://trace.wandb.ai/openapi.json',
         ['"openapi":"3.1.0"', '"/call/start"', '"/calls/stream_query"'],
         'The Weave trace API host serves a complete machine-readable OpenAPI 3.1.0 document at the well-known path, covering the full service surface (117 paths, including /call/start and /calls/stream_query). The vendor Service API reference documents this host as the base URL for W&B Multi-tenant and Dedicated Cloud.'),
        ('wandb-weave-service-api-docs-20261105', 'claimed-docs',
         'https://docs.coreweave.com/products/wandb/weave/reference/service-api.md',
         ['REST endpoints for programmatic access to Weave functionality',
          'https://trace.wandb.ai'],
         'The Service API overview: "Use the Weave Service API, which provides REST endpoints for programmatic access to Weave functionality", with base URL https://trace.wandb.ai and API-key bearer auth. (The docs llms.txt also lists a spec at /products/wandb/weave/reference/service-api/openapi.json, which answers 404; the working spec download is trace.wandb.ai/openapi.json.)'),
        ('wandb-weave-swagger-ui-20261105', 'claimed-docs',
         'https://trace.wandb.ai/docs',
         ['Swagger UI'],
         'The trace API hosts a live Swagger UI that loads /openapi.json, a runnable in-page console against the production API; a ReDoc view answers at /redoc. The hosted endpoint reference pages on docs.coreweave.com additionally render a "Try it" API playground per endpoint (the Mintlify api.playground runtime).'),
        # PR #623 review (P1): wandb-weave-release-policy-20261105 (the W&B Server release
        # policy, docs.coreweave.com/release-notes/release-policies.md) was initially
        # appended against api-versioning-policy and earned partial credit despite its own
        # text disclaiming any trace-API versioning or deprecation coverage. It documents a
        # different surface (server release operations), so it is removed via REMOVALS
        # below and the cell is re-judged on the remaining pack; the absence is recorded in
        # the verified-honest list above.
    ],
    ('model-gateways', 'litellm'): [
        ('litellm-api-stability-policy-20261105', 'claimed-docs',
         'https://docs.litellm.ai/docs/api_stability_policy.md',
         ["Every endpoint that appears in the proxy's OpenAPI spec is public",
          'The spec is served at `/openapi.json` and rendered as Swagger UI at `/` by default'],
         'LiteLLM publishes a formal API Stability Policy: "Every endpoint that appears in the proxy\'s OpenAPI spec is public"; "Any endpoint not in the OpenAPI spec is private". "The spec is served at `/openapi.json` and rendered as Swagger UI at `/` by default" and "is generated from the running proxy, so it reflects exactly the version you deploy". Breaking changes are called out in a dedicated section of the release notes. There is no vendor-hosted public spec download; every deployed proxy serves its own.'),
        ('litellm-openapi-settings-20261105', 'claimed-docs',
         'https://docs.litellm.ai/docs/proxy/config_settings.md',
         ['OPENAPI_URL', 'The path to the OpenAPI JSON endpoint'],
         'The proxy settings reference documents OPENAPI_URL ("The path to the OpenAPI JSON endpoint", default /openapi.json), DOCS_URL ("The path to the Swagger API documentation", default /), and the NO_DOCS and NO_OPENAPI flags to disable the Swagger UI and the /openapi.json endpoint: the machine spec and interactive docs are first-class, configurable surfaces of every proxy deployment.'),
        ('litellm-swagger-ui-20261105', 'claimed-docs',
         'https://docs.litellm.ai/docs/proxy/ui.md',
         ['Your Proxy Swagger is available on the root of the Proxy'],
         'The proxy UI docs state "Your Proxy Swagger is available on the root of the Proxy: e.g.: `http://localhost:4000/`": every deployed proxy serves an interactive Swagger UI console at its root. There is no vendor-hosted public demo instance today (the former litellm-api.up.railway.app answers 404); the interactive docs exist on any user-deployed proxy.'),
        ('litellm-mock-requests-20261105', 'claimed-docs',
         'https://docs.litellm.ai/docs/completion/mock_requests.md',
         ['you can use `completion()` with `mock_response` to mock calling the completion endpoint',
          'without calling the LLM APIs'],
         'LiteLLM documents a mock/test mode: "For testing purposes, you can use `completion()` with `mock_response` to mock calling the completion endpoint", returning a synthetic response "without calling the LLM APIs", streaming included. This is a request-level mock mode for saving testing costs, not a hosted sandbox environment; no separate sandbox deployment is documented.'),
        # PR #623 review (P2): every claim in the excerpt is marker-checked, not only the
        # pin recommendation, so a changed cadence or compatibility policy fails closed.
        ('litellm-release-cycle-20261105', 'claimed-docs',
         'https://docs.litellm.ai/docs/proxy/release_cycle.md',
         ['In production, we recommend pinning to the latest stable `1.x.x` release',
          'weekly scheduled releases bump the **MINOR** component, and **PATCH** is reserved for hotfixes',
          "'major' bumps: break backward compatibility (`1.x.x` → `2.x.x`)."],
         'The Release Cycle page documents dev, release-candidate, and stable tiers with semantic versioning: "weekly scheduled releases bump the **MINOR** component, and **PATCH** is reserved for hotfixes", "\'major\' bumps: break backward compatibility (`1.x.x` → `2.x.x`)", with the production recommendation to pin "to the latest stable `1.x.x` release". Together with the API Stability Policy this is the documented versioning-and-deprecation contract.'),
    ],
    ('product-analytics', 'mixpanel'): [
        ('mixpanel-openapi-specs-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/docs/docs-for-ai-agents.md',
         ['Every Mixpanel API is described by an OpenAPI specification',
          'https://docs.mixpanel.com/openapi/ingestion.openapi.yaml'],
         'The "Docs for AI Agents" page: "Every Mixpanel API is described by an OpenAPI specification. Use these to generate client code, validate requests", tabling thirteen downloadable specs (Ingestion, Query, Raw Data Export, Identity, Service Accounts, Lexicon Schemas, Annotations, GDPR & CCPA, Feature Flags, Experiments, Data Pipelines, Warehouse Connectors) under docs.mixpanel.com/openapi/. The same list appears under "## OpenAPI Specs" in the docs llms.txt.'),
        ('mixpanel-ingestion-spec-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/openapi/ingestion.openapi.yaml',
         ['openapi: 3.0.2', 'title: Ingestion API'],
         'The Ingestion API spec file itself downloads as an OpenAPI 3.0.2 YAML document, info title "Ingestion API", describing "APIs allowing for event-based tracking and user profile handling".'),
        ('mixpanel-api-playground-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/reference/import-events',
         ['Try it', 'Use this API to send batches of events from your servers to Mixpanel'],
         'The API reference renders a live "Try it" API playground per endpoint (the Mintlify api.playground runtime), e.g. "Import Events" (POST /import, "Use this API to send batches of events from your servers to Mixpanel") with generated multi-language request examples. developer.mixpanel.com now redirects here; the old ReadMe consoles are retired.'),
        ('mixpanel-dev-environments-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/docs/tracking-best-practices/developer-environments.md',
         ['Keep development data out of production by using separate Mixpanel projects and switching tokens per environment',
          'We recommend that you set up a separate project for your development environment'],
         'The Developer Environments page documents the vendor-recommended isolation pattern: "Keep development data out of production by using separate Mixpanel projects and switching tokens per environment", with per-environment token-switching code so "your testing data does not contaminate your production environment". Isolation is via separate projects and tokens; there is no API-level test-mode parameter.'),
        ('mixpanel-sandbox-account-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/docs/cohort-sync/build-an-integration.md',
         ['which you can use as a sandbox when building and testing your integration'],
         'The partner-integration guide has a "Setting up a Sandbox" section: "Sign up for a free Mixpanel account, which you can use as a sandbox when building and testing your integration." The sandbox is a separate free account/project rather than a dedicated test mode.'),
        ('mixpanel-auth-deprecation-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/reference/project-secret.md',
         ['This authentication method has been deprecated and will be fully retired on',
          'March 3, 2027'],
         'The Project Secret auth reference is a dated deprecation with a hard retirement date and migration path: "This authentication method has been deprecated and will be fully retired on March 3, 2027", directing users to migrate to Service Accounts as "the recommended authentication mechanism going forward".'),
        ('mixpanel-api-sunsets-20261105', 'claimed-docs',
         'https://docs.mixpanel.com/changelogs.md',
         ['we will be fully retiring the `/decide` endpoint'],
         'The changelog tracks API deprecations and sunsets with dates, e.g. "Starting April 2026, we will be fully retiring the `/decide` endpoint, which was used in older versions of Mixpanel SDKs", plus TLS 1.0/1.1 and legacy data-forwarding sunsets. Mixpanel documents deprecations per feature with sunset dates rather than a single numbered-API-version policy; there are no version headers.'),
    ],
    ('team-chat', 'zulip'): [
        ('zulip-openapi-spec-20261105', 'github',
         'https://raw.githubusercontent.com/zulip/zulip/main/zerver/openapi/zulip.yaml',
         ['openapi: 3.0.1', 'title: Zulip REST API'],
         'The zulip/zulip repository ships a complete OpenAPI 3.0.1 description of the API, info title "Zulip REST API", at zerver/openapi/zulip.yaml. Zulip\'s documentation docs state "The primary source of our API documentation is the Zulip server’s OpenAPI description at zerver/openapi/zulip.yaml": the published API docs at zulip.com/api are generated from this machine-readable spec.'),
        ('zulip-api-feature-levels-20261105', 'claimed-docs',
         'https://zulip.com/api/changelog',
         ['The API feature levels system used in this changelog is designed to make it possible to write API clients'],
         'Zulip publishes a full API changelog built on its API feature levels system: "The API feature levels system used in this changelog is designed to make it possible to write API clients... that work with a wide range of server versions". Every API change is logged under a numbered feature level (e.g. "Feature level 513" for Zulip 13.0), which clients read from server responses to determine the API format in use.'),
    ],
}


# Rows removed after review, (arena, product) -> evidence ids. Removal is the
# audit-correction path: an explicit dated script, never a refresh.
REMOVALS = {
    ('llm-evals-observability', 'wandb-weave'): ['wandb-weave-release-policy-20261105'],
}

# Hand-recorded counter-check rows that a scheduled refresh must not clobber.
PRESERVE_IDS = {'ollama-playground-disabled-20261105'}

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


def main() -> None:
    for (arena, pid) in sorted(set(ITEMS) | set(REMOVALS)):
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
            if iid in have:
                print(f'{iid}: already present, skipping')
                continue
            verify(url, markers)
            row = {'id': iid, 'tier': tier, 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW}
            if iid in PRESERVE_IDS:
                row['preserve'] = True
            ev.append(row)
            added += 1
        if added or removed:
            with open(ef, 'w') as f:
                f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{arena}/{pid}: +{added} / -{removed} evidence items ({len(ev)} total)')


if __name__ == '__main__':
    main()
