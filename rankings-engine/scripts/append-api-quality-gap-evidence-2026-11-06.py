#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 2: the next twelve products from the
# post-v6-migration staleness ranking (144 gap-signature products, recomputed 2026-11-05;
# wave 1 landed in PR #623). Roster: aider, zep, statsig, paperspace, cerebras, deepinfra,
# groq, localai, smithery, otter, pipecat, pinecone. iterm2 (terminals) ranks ahead of
# pipecat but is deferred: its command-aware-features cell is a settled unsupported-churn
# case (reports/rubric-migration/2026-11-04-legacy-transitions.json), and the
# evidence-keyed cache cannot re-judge a product while leaving one cell untouched, so it
# waits for a settlement-aware pass.
#
# Same precedent chain and fail-closed verification as
# append-api-quality-gap-evidence-2026-11-05.py: every item is verified live before it is
# appended (HTTP 200 plus every marker present in the raw body or the tag-stripped,
# whitespace-normalized page text); any mismatch aborts the run. Counter-check probe rows
# (preserved) record disabled interactive runners up front, the lesson of the PR #623
# ollama finding.
#
# Verified-honest counterparts (NO items added for the story, on purpose). Per-cell
# detail, including every checked URL, lives in
# reports/evidence-parity/2026-11-06-api-quality-wave2.json:
#   - aider, all four stories: aider is a CLI; its only programmatic surface is the Python
#     scripting interface, which the vendor explicitly marks "not officially supported or
#     documented" with no backwards-compatibility commitment (that disclaimer is appended
#     as context). No spec, no runner, no sandbox, no policy; --dry-run is a no-write file
#     flag, not a test environment.
#   - groq api-machine-spec: no published standalone spec (api/console openapi.json paths
#     404; no spec repo in the GitHub org; the Stainless-generated SDK cites none). The
#     API reference page embeds the full OpenAPI document in its page payload; that row is
#     appended with the embedded-not-published caveat and the judge weighs it.
#   - groq api-interactive-docs: the API reference is static (no in-page runner);
#     console.groq.com/playground is the separate console app, not the reference.
#   - groq api-sandbox: none documented (the only "sandbox" hit is the third-party E2B
#     code-interpreter integration).
#   - localai api-sandbox: self-hosted; "sandbox" hits are the agent code-execution
#     add-on, not an API test environment.
#   - localai api-versioning-policy: only per-flag CLI deprecation notes and release-note
#     blog posts; no API versioning or deprecation policy page.
#   - smithery, all four stories: Smithery was acquired by Arcade and shut down its API,
#     Connect, Toolbox, accounts/API keys, CLI and SDKs on October 31, 2026, remaining a
#     public non-proxied MCP registry (the shutdown page is appended as context). The docs
#     tree is removed (404s), the GitHub org exposes zero public repos, and
#     registry.smithery.ai answers JSON but is undocumented.
#   - otter, all four stories: Otter's Public API (Enterprise-only) is documented in a
#     single help-center article appended as context; no spec, no runner, no sandbox, no
#     version lifecycle (api.otter.ai/openapi.json 404, /v1/openapi.json 500).
#   - paperspace api-interactive-docs: the DigitalOcean-hosted reference is static
#     generated HTML with copyable cURL; api.paperspace.com/docs 404.
#   - paperspace api-sandbox: nothing in either llms.txt index; only production API keys
#     are documented.
#   - paperspace api-versioning-policy: the API is path-versioned (/v1, spec "version":
#     "1") but no stability, deprecation, or changelog page exists anywhere in the
#     Paperspace reference tree.
#   - cerebras api-sandbox: none documented; console Projects are org/cost isolation and
#     the console Playground is a prompt-iteration surface (appended with that scope).
#   - deepinfra api-sandbox: the "Sandboxes" product is isolated Linux microVMs for
#     running untrusted code (a compute product), not an API test mode; no test-mode or
#     staging page exists.
#   - pinecone api-interactive-docs: the reference pages configure the Mintlify playground
#     as "display":"simple" (no "Try it" runner); recorded as a preserved counter-check.
#   - zep api-sandbox: the v4 docs document graph.clone test copies (appended, scoped);
#     the per-environment Projects concept page exists only in the superseded v2 docs
#     version, so it is not cited.
#
# Reachability notes: deepinfra.com/llms.txt is bot-walled (a "Hold on" challenge page);
# the reachable vendor index is docs.deepinfra.com/llms.txt. help.otter.ai article HTML
# sits behind a Cloudflare challenge (403); the reachable vendor source is the same
# host's public help-center JSON endpoint, cited below (the gusto bot-wall precedent).
# api.statsig.com/openapi.json unversioned answers 403 RBAC; the public artifact is the
# versioned /openapi/20240601.json. No other walls were hit.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> --product <id>
#   pnpm engine derive --category <arena>
# and regenerate the dependent generators (confidence intervals, vendor reviews, story
# graph, step rankings, badges).
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
    ('ai-coding', 'aider'): [
        ('aider-scripting-unsupported-20261106', 'claimed-docs',
         'https://aider.chat/docs/scripting.html',
         ['You can also script aider from python:',
          'The python scripting API is not officially supported or documented, and could change in future releases without providing backwards compatibility.'],
         'Aider\'s only programmatic surface is the Python scripting interface ("You can also script aider from python"), and the vendor marks it: "The python scripting API is not officially supported or documented, and could change in future releases without providing backwards compatibility." There is no HTTP API, no machine-readable spec, no interactive reference, and no versioning commitment; the page documents the absence explicitly.'),
    ],
    ('ai-memory', 'zep'): [
        ('zep-openapi-spec-20261106', 'claimed-docs',
         'https://help.getzep.com/openapi/sdk-reference.json',
         ['"openapi":"3.1.0"', '"title":"SDK Reference"', 'https://api.getzep.com/api/v4'],
         'help.getzep.com serves a full OpenAPI 3.1 document (info title "SDK Reference", 148 paths, servers https://api.getzep.com/api/v4). The v4 docs llms.txt advertises it under an "## OpenAPI Specification" heading ("The raw OpenAPI 3.1 specification for this API is available at:"), and help.getzep.com/openapi.json is an index page linking the spec files per API version.'),
        ('zep-api-explorer-20261106', 'claimed-docs',
         'https://help.getzep.com/v4/sdk-reference/thread/create',
         ['Try it', 'Create thread'],
         'The Fern-rendered SDK Reference pages (about 150 endpoints under help.getzep.com/v4/sdk-reference) each carry a "Try it" in-page API explorer alongside per-language code samples, e.g. "Create thread" (POST /threads) with a runnable request and the documented 201 response.'),
        ('zep-graph-clone-testing-20261106', 'claimed-docs',
         'https://help.getzep.com/v4/cloning-graphs.md',
         ['The `graph.clone` method creates a complete copy of a graph with a new identifier.',
          'Clone a shared Context Graph to create an isolated test copy'],
         'Zep documents data-level test isolation: "The `graph.clone` method creates a complete copy of a graph with a new identifier", including "Clone a shared Context Graph to create an isolated test copy of an account, project, product, or business-domain graph". This is per-graph test copying inside an account, not a separate sandbox environment or account-level test mode.'),
        ('zep-deprecation-wave-20261106', 'claimed-docs',
         'https://help.getzep.com/v4/february-2026-deprecation-wave.md',
         ['This page covers four deprecation categories that take effect in February 2026.',
          'The V2 SDK is being deprecated in favor of the V3 SDK.'],
         'Zep publishes dated deprecation waves: "This page covers four deprecation categories that take effect in February 2026", enumerating removed methods with replacements (e.g. "The V2 SDK is being deprecated in favor of the V3 SDK"). The API is path-versioned (/api/v4 in the spec servers block) and the docs are version-switchable (v2/v3/v4).'),
        ('zep-migration-map-20261106', 'claimed-docs',
         'https://help.getzep.com/v4/migrating-from-v3.md',
         ['A method-by-method map from the Zep v3 SDK to v4, plus the behavior changes that need more than a rename.'],
         'A dedicated migration page: "A method-by-method map from the Zep v3 SDK to v4, plus the behavior changes that need more than a rename", covering Python, TypeScript, and Go. Together with the deprecation-wave page and the versioned API paths this is the documented version-transition surface.'),
    ],
    ('feature-flags', 'statsig'): [
        ('statsig-console-openapi-20261106', 'claimed-docs',
         'https://api.statsig.com/openapi/20240601.json',
         ['"openapi": "3.0.0"', '"title": "Console API"'],
         'api.statsig.com publishes the Console API\'s machine-readable OpenAPI 3.0.0 document at the versioned path /openapi/20240601.json ("The \\"Console API\\" is the CRUD API for performing the actions offered on console.statsig.com without needing to go through the web UI"). The unversioned /openapi.json answers 403; the versioned artifact is the public spec.'),
        ('statsig-openapi-reference-20261106', 'claimed-docs',
         'https://docs.statsig.com/api/content/console-api/introduction',
         ['Statsig keeps the [OpenAPI spec](https://api.statsig.com/openapi/20240601.json) for this API version up-to-date.'],
         'The Console API introduction links the spec and commits to its freshness: "Statsig keeps the OpenAPI spec for this API version up-to-date."'),
        ('statsig-api-tryit-20261106', 'claimed-docs',
         'https://docs.statsig.com/console-api/gates',
         ['Try it', 'Reference for the GET /console/v1/gates API endpoint.'],
         'The Console API reference renders an in-page live request runner per endpoint: the List Gates page ("Reference for the GET /console/v1/gates API endpoint.") carries a "Try it" control whose dialog is described in the page bundle as "Send a live request to the API endpoint shown on this page."'),
        ('statsig-environments-20261106', 'claimed-docs',
         'https://docs.statsig.com/api/content/guides/using-environments',
         ['evaluate feature gates, dynamic configs, and experiments differently in non-production environments like development or staging'],
         'Statsig documents environment-tier isolation: SDKs "evaluate feature gates, dynamic configs, and experiments differently in non-production environments like development or staging", with environment-specific SDK keys determining which rule sets download and separated development/staging/production data. Isolation is by environment tier and key, not a separate sandbox account.'),
        ('statsig-api-versioning-20261106', 'claimed-docs',
         'https://docs.statsig.com/api/content/console-api/introduction',
         ["Statsig versions the Console API. Statsig guarantees that each version won't break existing usage; each new version introduces breaking changes.",
          'Pass the version in the `STATSIG-API-VERSION` field in the header.'],
         'The Console API is explicitly versioned with a stability guarantee: "Statsig versions the Console API. Statsig guarantees that each version won\'t break existing usage; each new version introduces breaking changes. There is only one version: 20240601." Versions are selected per request: "Pass the version in the `STATSIG-API-VERSION` field in the header. This field is optional but becomes required in the future."'),
    ],
    ('gpu-clouds', 'paperspace'): [
        ('paperspace-openapi-spec-20261106', 'claimed-docs',
         'https://api.paperspace.com/v1/openapi.json',
         ['"openapi":"3.0.3"', '"title":"Paperspace OpenAPI"'],
         'The production API domain serves a machine-readable OpenAPI 3.0.3 document at /v1/openapi.json (info title "Paperspace OpenAPI", version "1", 61 paths; servers https://api.paperspace.com/v1). The DigitalOcean-hosted Paperspace API reference is generated from it. The path without /v1 answers 404; the versioned path is the artifact.'),
        ('paperspace-api-reference-20261106', 'claimed-docs',
         'https://docs.digitalocean.com/reference/paperspace/api-reference/index.html.md',
         ['Programmatically manage Paperspace resources using conventional HTTP requests'],
         'The Paperspace API Reference on docs.digitalocean.com: "Programmatically manage Paperspace resources using conventional HTTP requests", a static generated per-endpoint reference with copyable cURL examples (no in-page runner).'),
    ],
    ('inference-providers', 'cerebras'): [
        ('cerebras-openapi-spec-20261106', 'claimed-docs',
         'https://inference-docs.cerebras.ai/api-reference/openapi.yaml',
         ['openapi: 3.1.0', 'title: Cerebras Inference API'],
         'inference-docs.cerebras.ai publishes the Cerebras Inference API as a downloadable OpenAPI 3.1.0 document (server https://api.cerebras.ai, /v1/chat/completions and related endpoints), listed under "## OpenAPI Specs" in the docs llms.txt together with a second spec for the Dedicated Inference management API (api-reference/customer_management_api/openapi.yaml).'),
        # Counter-check recorded up front (the PR #623 ollama lesson): the reference pages
        # ship copyable examples with the interactive runner disabled.
        ('cerebras-playground-disabled-20261106', 'probe',
         'https://inference-docs.cerebras.ai/api-reference/chat-completions',
         ['"playground":{"display":"simple"}'],
         'PROBE docs playground check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06.py): the API reference pages on inference-docs.cerebras.ai configure the Mintlify playground as "playground":{"display":"simple"} — copyable Python/JavaScript/bash examples with the interactive in-page runner disabled; no "Try it" control renders on the endpoint pages.'),
        ('cerebras-console-playground-20261106', 'claimed-docs',
         'https://inference-docs.cerebras.ai/console/playground.md',
         ['The Playground lets you experiment with Cerebras models directly in the browser.'],
         'The Cerebras console ships a Playground: "The Playground lets you experiment with Cerebras models directly in the browser. Use it to evaluate models, iterate on prompts, test tool/function calling, and tune parameters, then export a working request to code when you\'re ready." This is the console\'s prompt-iteration surface, separate from the (non-interactive) API reference pages.'),
        ('cerebras-api-versions-20261106', 'claimed-docs',
         'https://inference-docs.cerebras.ai/api-reference/versions.md',
         ['Cerebras uses API versioning to manage breaking changes to request validation and response formats. Version 2 is now the default for API requests.',
          'X-Cerebras-Version-Patch',
          'Breaking changes only happen in new API versions, giving you time to test and migrate.'],
         'A dedicated API Versions page: "Cerebras uses API versioning to manage breaking changes to request validation and response formats. Version 2 is now the default for API requests." Versions are selected per request via the X-Cerebras-Version-Patch header, with a "What\'s Guaranteed" section ("Existing request parameters continue to work as documented; Existing response fields remain present with the same types") and "Breaking changes only happen in new API versions, giving you time to test and migrate."'),
        ('cerebras-deprecations-20261106', 'claimed-docs',
         'https://inference-docs.cerebras.ai/support/deprecation.md',
         ['A list of all deprecations, with the most recent announcements appearing first.'],
         'A dated deprecations log ("A list of all deprecations, with the most recent announcements appearing first.") covering models and API parameters with per-entry migration guidance and effective dates (e.g. a parameter "no longer be supported after July 21, 2026"), alongside an API changelog (support/change-log) and release-stage definitions.'),
    ],
    ('inference-providers', 'deepinfra'): [
        ('deepinfra-openapi-spec-20261106', 'claimed-docs',
         'https://api.deepinfra.com/openapi.json',
         ['"openapi":"3.1.0"', '"title":"DeepInfra API"'],
         'The production API domain serves a machine-readable OpenAPI 3.1.0 document (info title "DeepInfra API": "The DeepInfra API provides serverless AI inference, custom model deployments, and GPU rentals", 132 paths). The docs index cites it: docs.deepinfra.com/llms.txt ends with "## OpenAPI Specs" listing the same document. (deepinfra.com/llms.txt sits behind a bot challenge; docs.deepinfra.com is the reachable index.)'),
        ('deepinfra-swagger-ui-20261106', 'claimed-docs',
         'https://api.deepinfra.com/docs',
         ['SwaggerUIBundle'],
         'api.deepinfra.com/docs hosts a Swagger UI (SwaggerUIBundle over /openapi.json, swagger-ui-dist@5) — a vendor-hosted interactive explorer with runnable try-it-out requests against the live API. The Mintlify docs site carries an API reference section alongside it.'),
        ('deepinfra-model-deprecation-20261106', 'claimed-docs',
         'https://docs.deepinfra.com/models.md',
         ['## Model deprecation',
          '## Specifying model versions'],
         'DeepInfra documents a model lifecycle policy, cited as such: under "Model deprecation", "You\'ll receive at least 1 week\'s advance notice before the deprecation date" and "Your applications won\'t break — after deprecation, inference requests are automatically forwarded to a recommended replacement model"; under "Specifying model versions", requests can pin {"model": "MODEL_NAME:VERSION"}. This covers model deprecation and request-level model versioning; no endpoint/API-surface versioning or deprecation policy and no API changelog are documented (deprecations.md and changelog.md answer 404).'),
    ],
    ('model-gateways', '__unused__'): [],
    ('inference-providers', 'groq'): [
        ('groq-embedded-openapi-20261106', 'claimed-docs',
         'https://console.groq.com/docs/api-reference',
         ['An annotation that provides citations or references for content in a message.'],
         'The Groq API reference embeds the full OpenAPI document (components/schemas such as "Annotation": "An annotation that provides citations or references for content in a message.") inside the reference page\'s payload, from which the static per-endpoint reference is rendered. The spec is machine-readable in the page source but is not published as a standalone downloadable artifact: api.groq.com/openapi.json and console.groq.com/openapi.json answer 404, the docs llms.txt lists no spec, and the GitHub org carries no spec repo.'),
        ('groq-deprecations-20261106', 'claimed-docs',
         'https://console.groq.com/docs/deprecations',
         ['we will provide a shutdown date on which the model or endpoint will no longer be accessible',
          'All API deprecations along with recommended replacements are listed below'],
         'Groq publishes a deprecations policy covering models and endpoints: "When we announce that a model or endpoint is being deprecated, we will provide a shutdown date on which the model or endpoint will no longer be accessible", with "All API deprecations along with recommended replacements are listed below", production-vs-preview lifecycle stages, and migration support commitments. Versioning itself is the fixed /openai/v1 path; no header-based scheme is documented.'),
        ('groq-changelog-20261106', 'claimed-docs',
         'https://console.groq.com/docs/changelog',
         ['Changelog'],
         'A reverse-chronological API changelog with RSS and email subscription, plus a linked legacy changelog for entries prior to April 2025.'),
    ],
    ('local-llm-runtimes', 'localai'): [
        ('localai-swagger-spec-20261106', 'github',
         'https://raw.githubusercontent.com/mudler/LocalAI/master/swagger/swagger.json',
         ['"title": "LocalAI API"', '"description": "The LocalAI Rest API."'],
         'The official mudler/LocalAI repository ships a full Swagger 2.0 specification of the REST API (info title "LocalAI API", description "The LocalAI Rest API.") at swagger/swagger.json (with a YAML twin), covering the OpenAI-compatible /v1 endpoints and LocalAI-specific surfaces. The server advertises it at runtime: the documented /.well-known/localai.json discovery response lists "swagger": "/swagger/index.html".'),
        ('localai-swagger-ui-20261106', 'claimed-docs',
         'https://localai.io/docs/features/api-discovery/index.html',
         ['The full interactive API documentation is available without authentication at /swagger/index.html',
          'API Discovery & Instructions'],
         'LocalAI documents a built-in interactive explorer on every server: "Swagger UI — The full interactive API documentation is available without authentication at /swagger/index.html. Requests sent to protected endpoints from Swagger still require credentials." The same "API Discovery & Instructions" page documents the unauthenticated discovery endpoints (/.well-known/localai.json, /api/instructions, and the /swagger tree).'),
    ],
    ('mcp-infrastructure', 'smithery'): [
        # PR #627 review round 2 (P1 registry-programmatic-api): the live registry
        # endpoint answers JSON but is undocumented; recorded as a preserved counter-check
        # so the judge grades CLI-only discovery against the explicit absence of a
        # documented registry API.
        ('smithery-registry-undocumented-20261106', 'probe',
         'https://registry.smithery.ai/servers',
         ['"qualifiedName"'],
         'PROBE registry check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06.py): registry.smithery.ai/servers answers live JSON listing registry servers (entries carry "qualifiedName", "displayName", "description"), but the endpoint is undocumented: the registry root, /docs, and /openapi.json all answer 404, the smithery.ai docs tree is removed, and the documented Smithery API shut down on 2026-10-31. The maintained CLI commands are the only documented discovery surface against the public registry.'),
        # PR #627 review round 2 (P1 openness-open-license): the official CLI repository
        # carries an explicit open license; appended verbatim so the credit rests on the
        # license text instead of an unlicensed-public-repo inference.
        ('smithery-cli-agpl-license-20261106', 'github',
         'https://raw.githubusercontent.com/arcadeai-labs/smithery-cli/main/LICENSE',
         ['GNU AFFERO GENERAL PUBLIC LICENSE',
          'Version 3, 19 November 2007'],
         'The official Smithery CLI repository (arcadeai-labs/smithery-cli) is licensed under the GNU Affero General Public License v3.0: the LICENSE file opens "GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007", and GitHub\'s license metadata reads AGPL-3.0. The open license covers the CLI repository; the registry and hosted platform code are not public.'),
        ('smithery-api-shutdown-20261106', 'claimed-docs',
         'https://smithery.ai/future',
         ['Smithery will remain as a public (non-proxied) MCP registry.',
          'Smithery API, Connect, and Toolbox',
          'Smithery accounts and API keys'],
         'Smithery (acquired by Arcade) shut down its connection-management services on October 31, 2026: what stopped working includes "Smithery API, Connect, and Toolbox", "Smithery accounts and API keys", and "The Smithery CLI and SDKs", with current versions marked deprecated. "Smithery will remain as a public (non-proxied) MCP registry." The docs tree is removed and the GitHub org exposes no public repositories; there is no longer a documented API surface to specify, explore, sandbox, or version.'),
    ],
    ('meeting-ai', 'otter'): [
        ('otter-public-api-article-20261106', 'claimed-docs',
         'https://help.otter.ai/api/v2/help_center/en-us/articles/36130822688279.json',
         ["Otter's Public API is available for all Enterprise workspaces",
          'https://api.otter.ai/v1'],
         'Otter documents its Public API in a single help-center article ("Otter.ai Public API"): "Otter\'s Public API provides programmatic access to retrieve channels, conversations, transcripts, audio, action items, insights, outlines, and workspace details", "available for all Enterprise workspaces", base URL https://api.otter.ai/v1 with API-key auth. The article is prose with static examples: no machine-readable spec is published (api.otter.ai/openapi.json 404), no interactive reference, no sandbox, and no version lifecycle beyond the /v1 path. (The article HTML sits behind a Cloudflare challenge; this is the same host\'s public help-center JSON endpoint.)'),
    ],
    ('voice-agents', 'pipecat'): [
        ('pipecat-cloud-openapi-20261106', 'claimed-docs',
         'https://docs.pipecat.ai/api-reference/pipecat-cloud/rest-reference/openapi.json',
         ['"openapi": "3.0.0"', '"title": "Pipecat Cloud"'],
         'The Pipecat Cloud REST API publishes a machine-readable OpenAPI 3.0.0 document (info title "Pipecat Cloud"): "The public API (/v1/public, authenticated with a public API key) starts agent sessions and proxies requests to them. The private API (/v1...) manages agents, secrets, builds, regions, and organization settings."'),
        ('pipecat-spec-download-20261106', 'claimed-docs',
         'https://docs.pipecat.ai/api-reference/pipecat-cloud/rest-reference/overview.md',
         ['The Pipecat Cloud REST API is described by a single OpenAPI 3.0 specification',
          'Download the complete spec to generate clients, run mocks'],
         'The REST reference overview frames the spec as the downloadable artifact: "The Pipecat Cloud REST API is described by a single OpenAPI 3.0 specification... Download the complete spec to generate clients, run mocks, or feed to AI tools."'),
        ('pipecat-api-tryit-20261106', 'claimed-docs',
         'https://docs.pipecat.ai/api-reference/pipecat-cloud/rest-reference/endpoint/agent-create',
         ['Try it', 'Create an Agent'],
         'The Pipecat Cloud REST reference renders a live "Try it" API playground per endpoint (the Mintlify api.playground runtime), e.g. "Create an Agent" (POST /agents, https://api.pipecat.daily.co/v1/agents) with generated cURL examples and a runnable in-page request.'),
        ('pipecat-dev-runner-20261106', 'claimed-docs',
         'https://docs.pipecat.ai/pipecat/deployment/running-bots-locally.md',
         ['Pipecat ships a built-in development runner',
          'local development tool'],
         'Pipecat documents an isolated development environment: "Pipecat ships a built-in development runner (pipecat.runner.run) that handles the server-side glue most bots need during development", serving a prebuilt UI to talk to the bot locally. "The development runner is a local development tool — it isn\'t built or supported for production use": a documented develop-and-test surface separate from production deployment.'),
        ('pipecat-evals-20261106', 'claimed-docs',
         'https://docs.pipecat.ai/pipecat/evals/overview.md',
         ['built-in system for testing agent behavior'],
         'Pipecat Evals is "the framework\'s built-in system for testing agent behavior": described conversations run "against your real agent (the same pipeline, the same services, the same code)" as a test harness. No hosted Pipecat Cloud sandbox or test mode is documented; the testing surfaces are the local runner and the evals framework.'),
        ('pipecat-semver-changelog-20261106', 'github',
         'https://raw.githubusercontent.com/pipecat-ai/pipecat/main/CHANGELOG.md',
         ['this project adheres to [Semantic Versioning]',
          '### Deprecated'],
         'The official pipecat-ai/pipecat changelog: "this project adheres to Semantic Versioning", with explicit "### Deprecated" sections naming removal targets (e.g. deprecated APIs "will be removed in 2.0.0"). This is framework-level versioning discipline; the Cloud REST API versions only by URL path (/v1) with no documented deprecation window.'),
        ('pipecat-migration-1-0-20261106', 'claimed-docs',
         'https://docs.pipecat.ai/pipecat/migration/migration-1.0.md',
         ['Pipecat 1.0 removes many deprecated APIs from the 0.0.x series'],
         'A dedicated 1.0 migration guide: "Pipecat 1.0 removes many deprecated APIs from the 0.0.x series. If you were already using the non-deprecated replacements, most of these changes won\'t affect you." Deprecations are staged in the changelog before removal at the major version.'),
    ],
    ('vector-databases', 'pinecone'): [
        ('pinecone-openapi-specs-20261106', 'claimed-docs',
         'https://docs.pinecone.io/llms.txt',
         ['## OpenAPI Specs'],
         'docs.pinecone.io publishes an "## OpenAPI Specs" index listing dated machine-readable specs for every API surface (data plane, control plane, inference, admin, oauth), hosted in the official pinecone-io/pinecone-api repository across versions 2024-04 through 2026-07.'),
        ('pinecone-data-plane-spec-20261106', 'github',
         'https://raw.githubusercontent.com/pinecone-io/pinecone-api/refs/heads/main/2026-07/db_data_2026-07.oas.yaml',
         ['openapi: 3.0.3', 'title: Pinecone Data Plane API'],
         'The official pinecone-io/pinecone-api repository serves the dated specs themselves, e.g. the 2026-07 Data Plane spec (OpenAPI 3.0.3, info title "Pinecone Data Plane API", version 2026-07). Pinecone\'s own mock-the-api guide cites this repo as "Pinecone\'s public OpenAPI specs".'),
        # Counter-check recorded up front (the PR #623 ollama lesson).
        ('pinecone-playground-disabled-20261106', 'probe',
         'https://docs.pinecone.io/reference/api/2026-07/data-plane/upsert',
         ['"playground":{"display":"simple"}'],
         'PROBE docs playground check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06.py): the API reference pages on docs.pinecone.io (data-plane upsert and control-plane create_index checked) configure the Mintlify playground as "playground":{"display":"simple"} — per-language example requests with the interactive in-page runner disabled; no "Try it" control renders on the endpoint pages.'),
        ('pinecone-mock-the-api-20261106', 'claimed-docs',
         'https://docs.pinecone.io/guides/production/mock-the-api.md',
         ['Run a local mock of the Pinecone API from its OpenAPI specs',
          'without a Pinecone account or calls to Pinecone'],
         'Pinecone\'s documented testing environment is a local API mock: "You can run a local mock of the Pinecone API from Pinecone\'s public OpenAPI specs using Prism... Use it in unit tests and CI to confirm that your code builds valid requests and handles responses and errors, without a Pinecone account or calls to Pinecone." The page notes Pinecone Local (the in-memory emulator) reached end of life on October 7, 2026, that the mock does not cover write-then-read or real-search tests, and directs stateful tests to a separate project in the account.'),
        ('pinecone-api-versioning-20261106', 'claimed-docs',
         'https://docs.pinecone.io/reference/api/versioning.md',
         ['Versions are named by release date in the format',
          'Each stable version remains unchanged and supported for a minimum of 12 months',
          'X-Pinecone-Api-Version'],
         'A dedicated API versioning page: "Pinecone\'s APIs are versioned to ensure that your applications continue to work as expected as the platform evolves. Versions are named by release date in the format YYYY-MM". Quarterly stable releases with "Each stable version remains unchanged and supported for a minimum of 12 months", per-request selection via the X-Pinecone-Api-Version header, and an explicit breaking-changes list (removing operations, renaming parameters, adding required parameters).'),
    ],
}
del ITEMS[('model-gateways', '__unused__')]

# Rows removed after review, (arena, product) -> evidence ids (none in this wave).
REMOVALS: dict = {}

# Excerpt updates after the PR #627 review (the ef4d42d8 carry-limits-into-excerpts
# precedent): each entry re-verifies live markers fail-closed, then replaces the row's
# excerpt and refreshes fetchedAt. (arena, product) -> (id, url, markers, new excerpt).
#
# - pipecat api-sandbox (P1): the dev-runner and evals rows are narrowed so the cited
#   rows themselves state that neither surface is a sandbox isolated from production
#   data.
# - smithery agentic-official-cli (P1): the review read the CLI as defunct per the
#   /future shutdown notice, but the official CLI repo (now under the acquirer's
#   arcadeai-labs org) is live and maintained (npm `smithery@latest`, active command
#   set, a Skills registry). The two CLI rows and the shutdown row now carry both
#   lifecycle facts verbatim so the judge grades the full picture, not a silent
#   fragment of it.
UPDATES = {
    ('voice-agents', 'pipecat'): [
        # PR #627 review round 2 (P1 openness-full-export): the portability sentence is
        # scoped so bot-code portability cannot read as a data-export surface.
        ('pipecat-docs-32',
         'https://docs.pipecat.ai/pipecat/deployment/running-bots-locally.md',
         ['the same bot file portable across the development runner'],
         'The deployment docs state the property "that makes the same bot file portable across the development runner, Pipecat Cloud, and most production self-hosting setups." This is portability of the user\'s own bot code file across runtimes; it is not an export of Pipecat Cloud-held data (agents, secrets, builds, session or organization data), for which no export surface is documented.'),
        ('pipecat-dev-runner-20261106',
         'https://docs.pipecat.ai/pipecat/deployment/running-bots-locally.md',
         ['Pipecat ships a built-in development runner',
          'local development tool'],
         'Pipecat documents a local development runner: "Pipecat ships a built-in development runner (pipecat.runner.run) that handles the server-side glue most bots need during development", serving a prebuilt UI to talk to the bot. "The development runner is a local development tool — it isn\'t built or supported for production use." The runner executes the agent on the developer\'s own machine; it is not a sandbox, and no hosted Pipecat Cloud sandbox or test environment isolated from production data is documented.'),
        ('pipecat-evals-20261106',
         'https://docs.pipecat.ai/pipecat/evals/overview.md',
         ['built-in system for testing agent behavior'],
         'Pipecat Evals is "the framework\'s built-in system for testing agent behavior": described conversations run "against your real agent (the same pipeline, the same services, the same code)". Evals exercise the real agent and its real services, so they provide no isolation from production data; no hosted sandbox or test mode is documented for Pipecat Cloud.'),
    ],
    ('mcp-infrastructure', 'smithery'): [
        ('smithery-gh-1',
         'https://raw.githubusercontent.com/arcadeai-labs/smithery-cli/main/README.md',
         ['Smithery CLI connects your agents to thousands of skills and MCP servers directly from the command line.',
          'smithery mcp search [term]',
          'npm install -g smithery@latest'],
         'The official Smithery CLI (repository now under the acquirer\'s arcadeai-labs org; installed via npm install -g smithery@latest): "Smithery CLI connects your agents to thousands of skills and MCP servers directly from the command line." Registry commands: smithery mcp search [term], smithery mcp add <url>, smithery mcp list, smithery mcp remove. The repository and npm package are live and maintained after the 2026-10-31 shutdown of Smithery\'s hosted connection services (see the shutdown row for what stopped working).'),
        ('smithery-gh-2',
         'https://raw.githubusercontent.com/arcadeai-labs/smithery-cli/main/README.md',
         ['smithery tool find [query]',
          'smithery tool call <connection> <tool> [args]'],
         'The maintained Smithery CLI\'s tool commands: smithery tool list [connection], smithery tool find [query], smithery tool get <connection> <tool>, smithery tool call <connection> <tool> [args], plus a Skills surface ("npx skills add <skill>") against the Smithery Skills Registry. These command tables are the live README\'s current documentation, published under the acquirer\'s arcadeai-labs org after the 2026-10-31 service shutdown.'),
        ('smithery-api-shutdown-20261106',
         'https://smithery.ai/future',
         ['Smithery will remain as a public (non-proxied) MCP registry.',
          'Smithery API, Connect, and Toolbox',
          'Smithery accounts and API keys'],
         'Smithery (acquired by Arcade) shut down its connection-management services on October 31, 2026: what stopped working includes "Smithery API, Connect, and Toolbox", "Smithery accounts and API keys", and "The Smithery CLI and SDKs", with then-current versions marked deprecated. "Smithery will remain as a public (non-proxied) MCP registry." The docs tree is removed and there is no longer a documented API surface to specify, explore, sandbox, or version. The CLI itself continues under the acquirer\'s org (github.com/arcadeai-labs/smithery-cli, npm smithery@latest) against the public registry; the shutdown covers the hosted services and the service-tied versions.'),
    ],
}

# Hand-recorded counter-check rows that a scheduled refresh must not clobber.
PRESERVE_IDS = {'cerebras-playground-disabled-20261106', 'pinecone-playground-disabled-20261106',
                'smithery-registry-undocumented-20261106'}

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
