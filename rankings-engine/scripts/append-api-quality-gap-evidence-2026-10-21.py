#!/usr/bin/env python3
# API-quality crawl-gap fix, 2026-10-21 wave (issue #292, the GitHub PR #400 pattern applied
# fleet-wide): twelve products across five arenas whose apiQuality sat below 15 while their
# evidence showed a real public API (most carry the exact gap signature: `agentic-public-api`
# full/partial with ALL four api-quality stories zero-evidence none). Same precedent as
# append-api-quality-docs-evidence.py (the 54-product audit) and
# append-api-quality-gap-evidence-2026-10-08.py. Every URL below was live-checked on
# 2026-10-21 and every excerpt quotes the fetched page (or, for spec files, the live
# JSON/YAML document). The same URLs were added to each product's urls.extra and crawled;
# these rows carry the passages the extraction passes did not surface.
#
# Verified-honest counterparts (NO items added, on purpose — the figma/databricks precedent):
#   - pagerduty api-sandbox: no sandbox or test environment is documented in the developer docs.
#   - rootly api-sandbox: none documented (docs.rootly.com/api-reference/sandbox.md is a 404).
#     rootly machine spec: rootly.com/swagger/v1/swagger.json answers 403 to non-browser
#     clients; the reachable source is the API overview page that publishes the download link.
#   - betterstack api-machine-spec / api-versioning-policy: no OpenAPI/Swagger document and no
#     written versioning or deprecation policy page were found across the Uptime API reference.
#   - attio api-versioning-policy / api-sandbox: no policy page and no sandbox documented.
#   - fireworks-ai api-versioning-policy / api-sandbox: no API versioning/deprecation policy
#     page and no sandbox documented.
#   - together-ai api-sandbox: no API sandbox documented (the deprecations page is a model
#     lifecycle policy, cited as such).
#   - sentry api-sandbox: no API sandbox documented.
#   - bugsnag api-sandbox: none documented. The dedicated Versioning page
#     (developer.smartbear.com/bugsnag/docs/data-access-versioning) answers 302 session
#     bounces to plain HTTP clients; the portal page that lists it is the reachable source.
#   - skyvern api-sandbox: none documented.
#   - browser-use api-sandbox: none documented.
#   - rollbar api-versioning-policy / api-sandbox: no policy page and no sandbox documented
#     (the .NET "SDK versioning" page is about SDK releases, not the HTTP API).
#   - firehydrant api-versioning-policy / api-sandbox: the API reference documents only
#     "Current version: v1"; no deprecation policy page and no sandbox documented. The
#     ReadMe-hosted reference's own OpenAPI download is admin-gated; the public document is
#     the one in the official freshworks-oss/firehydrant-mcp repository.
import datetime
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    ('incident-management', 'pagerduty'): [
        ('pagerduty-supp-openapi-schemas', 'https://github.com/PagerDuty/api-schema',
         'Official PagerDuty/api-schema repository, "PagerDuty API Schemas": "This repository contains our OpenAPI defined public APIs." The OpenAPI references are "built by a bot from an internal repository" and published in this public repo.'),
        ('pagerduty-supp-api-reference', 'https://developer.pagerduty.com/api-reference/',
         'developer.pagerduty.com/api-reference is the hosted API reference: "Interactive OpenAPI reference for the PagerDuty REST API, Events API, SCIM, MCP server, and integration APIs."'),
    ],
    ('incident-management', 'rootly'): [
        ('rootly-supp-openapi-spec', 'https://docs.rootly.com/api-reference/overview',
         'API overview: "Download OpenAPI Specification" linking https://rootly.com/swagger/v1/swagger.json — "Download the OpenAPI/Swagger specification to explore the Rootly API endpoints or generate client libraries." (The swagger.json URL itself answers 403 to non-browser clients; this docs page is the reachable source.)'),
        ('rootly-supp-api-changelog', 'https://docs.rootly.com/api-reference/changelog',
         '"API Changelog: Track the latest changes, deprecations, and breaking updates to the Rootly API, including new endpoints, payload changes, and version release notes", with dated entries such as October 6, 2026: "breaking: POST /v1/incidents/{id}/status-page-events on a scheduled maintenance now returns 422 (Invalid status for scheduled) when status is omitted".'),
    ],
    ('incident-management', 'firehydrant'): [
        ('firehydrant-supp-openapi-spec', 'https://raw.githubusercontent.com/freshworks-oss/firehydrant-mcp/main/.speakeasy/openapi.output.yaml',
         'The official freshworks-oss/firehydrant-mcp repository publishes a FireHydrant OpenAPI document (.speakeasy/openapi.output.yaml): openapi "3.0.1", info.description "An MCP server for interacting with FireHydrant\'s API", servers https://api.firehydrant.io/, with operation tags across Call Routes, Permissions, Roles, Audit Events and the rest of the API surface.'),
    ],
    ('incident-management', 'betterstack'): [
        ('betterstack-supp-endpoint-reference', 'https://betterstack.com/docs/uptime/api/list-all-existing-monitors/',
         'Per-endpoint Uptime API reference ("List monitors") with copyable request examples per endpoint: curl --request GET --url "https://incidents.betterstack.com/api/v2/monitors" --header "Authorization: Bearer $TOKEN", including filter variants (by URL, by name) and paginated JSON responses.'),
    ],
    # The three *-supp-api-playground rows below answer PR #410's review finding: the
    # api-interactive-docs rationales for attio, fireworks-ai and skyvern cited no
    # interactivity evidence. Each vendor's endpoint pages render a live "Try it" API
    # playground (the Mintlify api.playground runtime); each page below was fetched on
    # 2026-10-21 and shows the visible "Try it" control.
    ('crm', 'attio'): [
        ('attio-supp-openapi-page', 'https://docs.attio.com/rest-api/endpoint-reference',
         '"OpenAPI — Access the OpenAPI specification for the Attio REST API": "Attio exposes a public OpenAPI specification for the Attio REST API. The specification is available" at https://api.attio.com/openapi/api.'),
        ('attio-supp-openapi-document', 'https://api.attio.com/openapi/api',
         'api.attio.com/openapi/api serves the machine-readable OpenAPI document: {"openapi":"3.1.0","info":{"title":"Attio API","version":"2.0.0"}}, describing the public REST endpoints (objects, records, lists, webhooks) with schemas.'),
        ('attio-supp-api-playground', 'https://docs.attio.com/rest-api/endpoint-reference/objects/list-objects',
         'Per-endpoint reference pages ("List objects: Lists all system-defined and user-defined objects in your workspace") render a live "Try it" API playground (the Mintlify api.playground runtime), so each documented endpoint can be exercised in-browser.'),
    ],
    ('inference-providers', 'fireworks-ai'): [
        ('fireworks-ai-supp-openapi-spec', 'https://docs.fireworks.ai/gateway.openapi.yaml',
         'Published OpenAPI document ("openapi: 3.1.0", info.title "Gateway REST API", version 5.10.0) covering /v1/accounts, deployment, model and training endpoints; docs.fireworks.ai/llms.txt lists it under "## OpenAPI Specs" together with anthropic-messages.openapi.json and gateway-extra.openapi.yaml.'),
        ('fireworks-ai-supp-api-reference', 'https://docs.fireworks.ai/api-reference/introduction',
         '"Fireworks AI REST API enables you to interact with various language, image and embedding models using an API Key. It also lets you automate management of models, deployments, datasets, and more", with per-endpoint reference pages (e.g. "Create Chat Completion: Create a completion for the provided prompt and parameters").'),
        ('fireworks-ai-supp-api-playground', 'https://docs.fireworks.ai/api-reference/post-chatcompletions',
         'The "Create Chat Completion" reference page renders a live "Try it" API playground (the Mintlify api.playground runtime) alongside the request/response schema, so the documented endpoints are runnable in-browser.'),
    ],
    ('inference-providers', 'together-ai'): [
        ('together-ai-supp-openapi-spec', 'https://docs.together.ai/openapi.yaml',
         'Published OpenAPI document ("openapi: 3.1.0", info.title "Together APIs", description "The Together REST API. See https://docs.together.ai for more details", version 2.0.0), synced from the togethercomputer/openapi sources; docs.together.ai/llms.txt lists it under "## OpenAPI Specs".'),
        ('together-ai-supp-deprecations', 'https://docs.together.ai/docs/deprecations',
         '"Deprecations: Together AI\'s model lifecycle policy, including upgrades, redirects, and deprecation schedules" — "Together AI follows a structured approach to introducing new models, upgrading existing models, and deprecating older versions, so you can rely on predictable behavior."'),
        ('together-ai-supp-api-reference', 'https://docs.together.ai/reference/chat-completions-1',
         'Per-endpoint API reference generated from the OpenAPI document ("## OpenAPI — yaml openapi.yaml POST /v1/chat/completions"), e.g. "Create chat completion: Generate a model response for a given chat conversation. Supports single queries and multi-turn conversations with system, user, and assistant messages."'),
    ],
    ('error-tracking', 'sentry'): [
        ('sentry-supp-openapi-schema', 'https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json',
         'The official getsentry/sentry-api-schema repository publishes the machine-readable spec openapi-derefed.json: {"openapi": "3.0.3", "info": {"title": "API Reference", "version": "v0", "description": "Sentry Public API"}}.'),
        ('sentry-supp-api-versioning', 'https://docs.sentry.io/api/',
         'API docs, "Versioning": "The current version of the Sentry\'s web API is considered v0. Our public endpoints are generally stable, but beta endpoints are subject to change."'),
    ],
    ('error-tracking', 'bugsnag'): [
        ('bugsnag-supp-openapi-spec', 'https://api.swaggerhub.com/apis/smartbear-public/bugsnag-data-access-api/2/swagger.json',
         'SwaggerHub-published OpenAPI 3.0.3 document: info.title "BugSnag - Data Access API", description "Allows you to access information about your BugSnag errors, projects, organization and more to build custom integrations using your data."'),
        ('bugsnag-supp-data-access-docs', 'https://developer.smartbear.com/bugsnag/docs/data-access',
         '"Allows you to access information about your BugSnag errors, projects, organization and more to build custom integrations using your data" — the portal\'s "Data Access API" reference is generated from the SwaggerHub OpenAPI document ("apiSpec": "openapi-3.0.3") and lists "Pagination", "Rate Limiting", "Authentication" and "Versioning" pages (docs/data-access-versioning).'),
    ],
    ('error-tracking', 'rollbar'): [
        ('rollbar-supp-openapi-spec', 'https://docs.rollbar.com/openapi/62de9e1b6316c304034d006a',
         'docs.rollbar.com/openapi ("All OpenAPI Files") links this downloadable machine-readable document: {"openapi":"3.1.0","servers":[{"url":"https://api.rollbar.com"}],"tags":[{"name":"Item"},{"name":"Occurrence"},{"name":"Metrics"},{"name":"Deploy"}]}, covering the documented Rollbar API resources.'),
    ],
    ('browser-agents', 'skyvern'): [
        ('skyvern-supp-openapi-document', 'https://api.skyvern.com/openapi.json',
         'api.skyvern.com/openapi.json serves the machine-readable OpenAPI document: {"openapi":"3.1.0","info":{"title":"Skyvern API","description":"API for Skyvern","version":"1.0.0"}}, with run endpoints such as POST /v1/run/tasks.'),
        ('skyvern-supp-api-reference', 'https://www.skyvern.com/docs/api-reference/runs/run-an-agent',
         'Per-endpoint API reference generated from the OpenAPI specification ("## OpenAPI — yaml /api-reference/openapi.json post /v1/run/agents"), covering agents, runs, browser sessions and credentials.'),
        ('skyvern-supp-api-playground', 'https://www.skyvern.com/docs/api-reference/runs/run-an-agent',
         'The "Run an agent" reference page renders a live "Try it" API playground (the Mintlify api.playground runtime) for its OpenAPI operation (post /v1/run/agents), so the documented endpoints are runnable in-browser.'),
        ('skyvern-supp-deprecation-policy', 'https://www.skyvern.com/docs/developers/api/versioning-and-deprecation',
         '"Deprecation and sunset policy — When we do deprecate part of the API, this is what you can count on: At least 6 months notice. That is the minimum time between the deprecation announcement and the sunset date on which the endpoint stops serving traffic. Removing an entire major version gets at least 12 months", with "Machine-readable response headers on every response from a deprecated endpoint, following RFC 9745 (Deprecation) and RFC 8594 (Sunset)" and "deprecated: true in the OpenAPI specification".'),
    ],
    ('browser-agents', 'browser-use'): [
        ('browser-use-supp-openapi-spec', 'https://docs.browser-use.com/cloud/openapi/v4.json',
         'Published OpenAPI document: {"openapi": "3.1.0", "info": {"title": "Browser Use Public API v4", "summary": "Browser Use agent runs API (v4)", "version": "4.0.0"}}, servers https://api.browser-use.com/api/v4; docs.browser-use.com/llms.txt lists "## OpenAPI Specs" with /cloud/openapi/v2.json, v3.json and v4.json.'),
    ],
}


def main() -> None:
    for (arena, pid), items in ITEMS.items():
        ef = os.path.join(ROOT, 'open-rankings', arena, 'evidence', f'{pid}.json')
        ev = json.load(open(ef))
        have = {e['id'] for e in ev}
        added = 0
        for iid, url, excerpt in items:
            if iid in have:
                continue
            ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            added += 1
        if added:
            with open(ef, 'w') as f:
                f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{arena}/{pid}: +{added} evidence items ({len(ev)} total)')


if __name__ == '__main__':
    main()
