#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 7: the next twelve rows from the
# corrected staleness ranking on post-#639 main (85 gap rows; waves 1-6 = PRs #623,
# #627, #630, #632, #634, #639). Roster: activepieces, open-webui, dynadot, glama,
# requesty, homebrew, google-workspace, microsoft-entra, floot, appwrite, unit, lever
# (the named 18.1-18.6 tie band plus lever as the highest-ranked unpicked). iterm2 stays
# deferred (wave-2 ledger), and foreloop is skipped by instruction: it is Ultrametric's
# own product with human-adjudicated cells awaiting a maintainer ruling, and its repair
# lands as its own disclosed, bias-audited PR.
#
# Same fail-closed toolkit as waves 5-6 (marker verify with curl-exit hardening,
# REMOVALS, UPDATES, PRESERVE_IDS, NEGATIVE_CHECKS, POST_CHECKS, TLS_MISMATCH_CHECKS).
# Excerpts carry scope caveats verbatim.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave7.json:
#   - activepieces api-sandbox: the "sandboxing" pages cover flow-code execution
#     isolation on self-hosted deployments, not an API test environment; the API docs
#     document only the production cloud server.
#   - open-webui api-sandbox: every "sandbox" hit is Open Terminal code-execution
#     isolation or marketing copy; API keys come from the live instance.
#   - floot api-interactive-docs / api-sandbox / api-versioning-policy: no REST API
#     exists (the MCP manifest row is the only machine surface); zero
#     swagger/scalar/try-it anywhere; the live preview is the app being built;
#     floot.com/changelog soft-renders the home shell and no versioning text exists.
#   - dynadot api-machine-spec / api-interactive-docs: zero openapi/swagger/postman
#     across the RESTful and legacy docs; copyable XML/JSON request examples only.
#     api.dynadot.com is a soft-200 host (identical "Page Not Found" body on any path).
#   - glama api-sandbox (as an isolated vendor-API sandbox): the hosted MCP Inspector is
#     a test surface for arbitrary third-party MCP servers, appended with that exact
#     scope; the directory-API runner sends live requests.
#   - requesty api-sandbox: the in-app Playground sends real routed requests behind
#     login and free models are a 200-requests/day production tier; no sandbox base URL
#     or test keys.
#   - homebrew api-interactive-docs / api-sandbox / api-versioning-policy: static curl
#     examples (rubydoc is static YARD); the JSON API is public, read-only production
#     (HOMEBREW_API_DOMAIN mirroring is mirroring); no version segment and every
#     deprecation field in the schema governs formulae, not the API surface.
#   - google-workspace api-sandbox: the Developer Preview Program is early access
#     against the developer's own domain, and the APIs Explorer "acts on real data";
#     no test tenant exists for Workspace.
#   - unit api-interactive-docs: the Docusaurus reference is static; the vendor's
#     documented request-trying path is the hosted Postman collections (whose server_url
#     is "Initially set to the Unit Sandbox environment").
#   - lever api-machine-spec / api-interactive-docs: the Data API reference is a
#     custom-rendered static page (zero openapi/swagger/postman, zero runners); the
#     OAuth Postman template is auth-flow tooling. hire.lever.co is a soft-200 host, so
#     every lever URL is content-verified.
#
# Reachability notes: github.com/appwrite/spec (singular) is 404 — the real repo is
# appwrite/specs, and appwrite.io/docs/*.md mirrors soft-200 (content-verified);
# docs.unit.co redirects into unit.co/docs and the live sandbox base is api.s.unit.sh
# (older references name api.s.unitapi.co); dynadot's documented sandbox host is
# api-sandbox.dynadot.com. No bot walls were hit.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> --product <id>
#   pnpm engine derive --category <arena>
# then the dependent generators, and the pre-audit over every upward flip (review-fix
# re-rolls included) BEFORE any push.
import datetime
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

ITEMS = {
    ('workflow-automation', 'activepieces'): [
        ('activepieces-openapi-spec-20261106', 'claimed-docs',
         'https://www.activepieces.com/docs/openapi.json',
         ['"openapi":"3.1.0"', '"url":"https://cloud.activepieces.com/api"'],
         'Activepieces publishes a downloadable OpenAPI 3.1.0 document (84 paths, server https://cloud.activepieces.com/api) backing its Mintlify API reference, with per-operation OpenAPI embedded in every endpoint page\'s markdown mirror. API keys are Platform/Enterprise-only ("API keys are generated under the platform dashboard... only available in the Platform and Enterprise editions").'),
        ('activepieces-api-playground-20261106', 'claimed-docs',
         'https://www.activepieces.com/docs/endpoints/projects/list',
         ['Try it'],
         'The API reference renders the Mintlify "Try it" playground per endpoint (the disabled-playground config is absent). The runner targets the production cloud server and executing requests needs a Platform/Enterprise API key.'),
        ('activepieces-breaking-changes-20261106', 'claimed-docs',
         'https://www.activepieces.com/docs/install/reference/breaking-changes.md',
         ['This list shows all versions that include breaking changes and how to upgrade.'],
         'Activepieces maintains a per-release breaking-changes register covering API surface changes (e.g. a release removing GET /v1/ai-providers/:provider/config, "it now returns `404`", with upgrade guidance), alongside a dated product changelog and an SDK changelog. The API is path-versioned (/v1); no deprecation-window or support-horizon commitment is published.'),
    ],
    ('self-hosted-assistants', 'open-webui'): [
        ('open-webui-swagger-dev-20261106', 'claimed-docs',
         'https://docs.openwebui.com/reference/api-endpoints.md',
         ['Make sure to set the `ENV` environment variable to `dev` in order to access the Swagger documentation'],
         'Open WebUI documents a built-in FastAPI Swagger surface on a running self-hosted instance, gated behind dev mode: "Make sure to set the `ENV` environment variable to `dev` in order to access the Swagger documentation" at /docs. This is a self-hosted built-in rather than a vendor-hosted downloadable spec, and the page opens by noting it "is an experimental setup and may undergo future updates".'),
        ('open-webui-swagger-links-20261106', 'claimed-docs',
         'https://docs.openwebui.com/reference/api-endpoints.md',
         ['Swagger Documentation Links',
          'Access detailed API documentation for different services provided by Open WebUI'],
         'The same reference lists "Swagger Documentation Links" per service ("Access detailed API documentation for different services provided by Open WebUI", Main at /docs): the built-in interactive Swagger UI on the integrator\'s own instance, available only with ENV=dev ("Without this configuration, the documentation will not be available"). No vendor-hosted runnable playground exists on the docs site.'),
        ('open-webui-changelog-20261106', 'github',
         'https://raw.githubusercontent.com/open-webui/open-webui/main/CHANGELOG.md',
         ['All notable changes to this project will be documented in this file.',
          'this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)'],
         'Open WebUI keeps a Keep-a-Changelog repository changelog with a SemVer commitment ("this project adheres to Semantic Versioning") and publishes per-version plugin-API migration guides for breaking releases. The REST API reference itself is declared experimental, no REST-specific deprecation window is promised, and the docs warn the :main container tag "can include breaking changes without warning".'),
    ],
    ('vibe-coding', 'floot'): [
        ('floot-mcp-manifest-20261106', 'claimed-docs',
         'https://floot.com/.well-known/mcp.json',
         ['"endpoint": "https://mcp.floot.com/mcp"'],
         'Floot\'s only programmatic surface is its remote MCP server, published as a machine-readable discovery manifest at /.well-known/mcp.json (endpoint https://mcp.floot.com/mcp, "transport": "streamable-http", authentication "type": "oauth2"; registered at registry.modelcontextprotocol.io) and referenced from the vendor\'s own llms.txt. The endpoint is a live MCP JSON-RPC responder (a recorded probe POSTing an initialize without required params returned a JSON-RPC -32603 validation error over HTTP 200). There is no OpenAPI document, no documented REST API, no interactive reference, no sandbox, and no versioning or changelog surface (floot.com/changelog soft-renders the home shell).'),
    ],
    ('domain-registrars', 'dynadot'): [
        ('dynadot-api-sandbox-20261106', 'claimed-docs',
         'https://www.dynadot.com/domain/api-document',
         ['The Dynadot API Sandbox environment allows you to safely test your API integrations without affecting your live account or real funds.',
          'pre-funded with a balance of 10,000 in all supported currencies'],
         'Dynadot documents a dedicated API Sandbox: "The Dynadot API Sandbox environment allows you to safely test your API integrations without affecting your live account or real funds", on its own host (https://api-sandbox.dynadot.com) with separate sandbox keys and an account "pre-funded with a balance of 10,000 in all supported currencies for testing purposes". The sandbox also covers the legacy v3 API with parallel per-command examples. Vendor caveats: some commands are unavailable or differ in the sandbox (per-command "Support API Sandbox" labels).'),
        ('dynadot-api-versioning-20261106', 'claimed-docs',
         'https://www.dynadot.com/domain/api-document',
         ['They follow the Semantic Versioning (SemVer) format',
          'we will maintain backward compatibility for older versions for a period of time'],
         'The RESTful API documents URL-based major versioning (/restful/v2/..., "The current version of the API is v2.0.0"), SemVer ("They follow the Semantic Versioning (SemVer) format"), a back-compat statement ("we will maintain backward compatibility for older versions for a period of time"), and a Change Log History section covering "updates, bug fixes, deprecations, and enhancements introduced in each version". Material vendor caveat on the same page: "Beta Notice: This API documentation is Beta. Endpoints, fields, error codes, and behaviors may change without notice and backward compatibility is not guaranteed."'),
    ],
    ('mcp-infrastructure', 'glama'): [
        ('glama-openapi-spec-20261106', 'claimed-docs',
         'https://glama.ai/api/mcp/openapi.json',
         ['"openapi":"3.0.3"', '"title":"Glama MCP API"'],
         'Glama publishes an OpenAPI 3.0.3 document for its MCP directory API (info title "Glama MCP API", /v1 paths for servers, connectors, instances, usage), advertised from its llms.txt "for generating a client" and discoverable through an RFC 9727 API catalog at /.well-known/api-catalog whose service-desc points at the spec. The spec covers the directory API; the Gateway is an MCP-protocol proxy without a separate REST spec, and the spec\'s license block requires attribution for data use.'),
        ('glama-api-catalog-20261106', 'claimed-docs',
         'https://glama.ai/.well-known/api-catalog',
         ['linkset'],
         'The RFC 9727 API catalog (application/linkset+json) links the machine spec (service-desc) and the hosted reference (service-doc), completing a fully machine-discoverable chain from the well-known path.'),
        ('glama-api-try-it-20261106', 'claimed-docs',
         'https://glama.ai/mcp/reference/list-mcp-servers',
         ['Try it',
          'Requests are sent directly from this browser. Credentials are never stored.'],
         'The vendor-hosted API reference carries a per-endpoint "Try it" panel ("Requests are sent directly from this browser. Credentials are never stored.") alongside cURL/JavaScript/Python/PHP samples and full schemas. The runner is client-side ("Enable JavaScript to send an interactive request.") and exercises the production API with a real bearer key.'),
        ('glama-mcp-inspector-20261106', 'claimed-docs',
         'https://glama.ai/mcp/inspector',
         ["connects to remote Streamable HTTP and SSE endpoints so you can inspect available capabilities and test requests interactively"],
         'Glama hosts a no-login MCP Inspector: "Glama\'s hosted inspector connects to remote Streamable HTTP and SSE endpoints so you can inspect available capabilities and test requests interactively", with OAuth/bearer/custom-header auth, tool execution, and a protocol log of every JSON-RPC message. Scope: it tests arbitrary third-party MCP servers through Glama; it is not an isolated sandbox of Glama\'s own directory API, and no test keys or isolation framing exist for that API.'),
        ('glama-endpoint-deprecation-20261106', 'claimed-docs',
         'https://glama.ai/mcp/reference/get-mcp-server-by-id',
         ['This endpoint is deprecated. Please use'],
         'Versioning is practiced and machine-readable: /v1 path versioning, a deprecation banner on the endpoint page ("This endpoint is deprecated. Please use GET /v1/servers/:namespace/:slug instead."), the matching "deprecated": true flag in the OpenAPI document, and deprecatedAt fields in the data model. No standalone versioning or changelog policy page exists (glama.ai/changelog answers 404).'),
    ],
    ('model-gateways', 'requesty'): [
        ('requesty-openapi-spec-20261106', 'claimed-docs',
         'https://docs.requesty.ai/api-reference/openapi.json',
         ['"openapi": "3.0.3"', '"title": "Requesty API"'],
         'Requesty publishes an OpenAPI 3.0.3 document (info title "Requesty API") covering both the OpenAI/Anthropic-compatible inference router and the management API (servers router.requesty.ai and api-v2.requesty.ai), advertised verbatim in the docs llms.txt ("OpenAPI Spec: https://docs.requesty.ai/api-reference/openapi.json") with markdown mirrors of every docs page.'),
        ('requesty-api-playground-20261106', 'claimed-docs',
         'https://docs.requesty.ai/api-reference/endpoint/chat-completions-create',
         ['Try it'],
         'The Mintlify API reference runs the default interactive playground with a "Try it" runner per endpoint (the disabled-playground config is absent) plus generated cURL/Python/TypeScript samples. The runner mounts client-side and executes against the production router with a real key.'),
        ('requesty-changelog-20261106', 'claimed-docs',
         'https://docs.requesty.ai/changelog.md',
         ['# Changelog',
          '`monthly_limit` is deprecated and will soon be migrated to `monthly_budget`'],
         'Requesty maintains a long dated changelog covering API-affecting changes (request-size limits with new error semantics, new management-endpoint parameters) including explicit field deprecations with migration paths ("`monthly_limit` is deprecated and will soon be migrated to `monthly_budget`"). The API is /v1 path-versioned; no standalone versioning policy or back-compat window is stated.'),
    ],
    ('package-managers', 'homebrew'): [
        # Pre-audit correction: the side-effect re-roll credited openness-open-license on
        # off-axis quotes (analytics, a formula path) because the pack carried no license
        # row; this grounds the cell in the repository's own license statement.
        ('homebrew-license-20261106', 'github',
         'https://raw.githubusercontent.com/Homebrew/brew/HEAD/README.md',
         ['Code is under the [BSD 2-clause "Simplified" License](LICENSE.txt).',
          'Documentation is under the [Creative Commons Attribution license]'],
         'The Homebrew/brew repository README states the licensing: "Code is under the BSD 2-clause \'Simplified\' License. Documentation is under the Creative Commons Attribution license."'),
        ('homebrew-json-api-20261106', 'claimed-docs',
         'https://formulae.brew.sh/docs/api/',
         ['Homebrew Formulae JSON API Documentation'],
         'Homebrew documents an unauthenticated JSON data API over its package metadata ("Homebrew Formulae JSON API Documentation": /api/formula.json, /api/cask.json, per-package and analytics endpoints) with curl examples and a full example response schema, and the manpage designates formulae.brew.sh/api as the JSON API download mirror. It is a machine-readable data API; no formal API-description artifact (OpenAPI or equivalent) exists, the endpoints carry no version segment, there is no runner (static examples), and the schema\'s deprecation fields govern formulae lifecycles, not the API surface.'),
    ],
    ('sso-identity', 'google-workspace'): [
        ('google-workspace-discovery-20261106', 'claimed-docs',
         'https://developers.google.com/workspace/admin/directory/reference/rest',
         ['A Discovery Document is a machine-readable specification for describing and consuming REST APIs',
          'https://admin.googleapis.com/$discovery/rest?version=directory_v1'],
         'The Workspace Admin SDK Directory API reference publishes its machine-readable description: "A Discovery Document is a machine-readable specification for describing and consuming REST APIs... used to build client libraries, IDE plugins, and other tools", with the live per-API document at https://admin.googleapis.com/$discovery/rest?version=directory_v1 (serving JSON unauthenticated). Discovery is a Google-wide mechanism adopted by the Workspace reference pages.'),
        ('google-workspace-api-explorer-20261106', 'claimed-docs',
         'https://developers.google.com/explorer-help',
         ['The Google APIs Explorer is a tool available on most REST API method documentation pages that lets you try Google API methods without writing code',
          'The APIs Explorer acts on real data'],
         'Google documents the APIs Explorer as an embedded console on REST method reference pages ("lets you try Google API methods without writing code", appearing "as a side panel by default" with parameters, credentials, code samples, and execution). The panel mounts client-side on the Workspace method pages, and the vendor states plainly: "The APIs Explorer acts on real data, so use caution when trying methods that create, modify, or delete data" — there is no sandboxed mode.'),
        ('google-workspace-deprecations-20261106', 'claimed-docs',
         'https://developers.google.com/workspace/release-notes',
         ['Google Sheets API v3'],
         'Workspace APIs are endpoint-versioned (directory_v1, Sheets v4) and the Workspace release notes record dated deprecations and turndowns with migration guides (e.g. "Google Sheets API v3 is turned down", and sunset dates for deprecated APIs). This is practiced deprecation, not a committed window: the standalone deprecation-policy page is labeled "Legacy... for Certain Services" and names no Workspace service, and the current Google APIs terms reserve the right to discontinue APIs "for any reason and at any time without liability".'),
    ],
    ('sso-identity', 'microsoft-entra'): [
        ('microsoft-entra-graph-metadata-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/traverse-the-graph',
         ['The metadata document ($metadata) is published at the service root'],
         'Microsoft Entra\'s API surface is Microsoft Graph, whose machine-readable description is published live: "The metadata document ($metadata) is published at the service root" (https://graph.microsoft.com/v1.0/$metadata and /beta/$metadata, OData CSDL served unauthenticated; the first schema namespace is microsoft.graph.identityGovernance). The vendor-owned microsoftgraph/msgraph-metadata repository additionally publishes "OpenAPI format descriptions of the Microsoft Graph". Scope: Graph-wide metadata with the Entra identity resources as a subset.'),
        ('microsoft-entra-graph-explorer-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/graph-explorer/graph-explorer-overview',
         ['Graph Explorer is a developer tool for exploring Microsoft Graph APIs'],
         '"Graph Explorer is a developer tool for exploring Microsoft Graph APIs": a vendor-hosted interactive console where you can "Test APIs on a sample tenant" without signing in (anonymous access to Entra-shaped demo data) or "Sign in to your own tenant for prototyping app scenarios", with required-permission discovery and code snippets. The console app itself is client-rendered; this overview page documents it in served text.'),
        ('microsoft-entra-dev-sandbox-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/office/developer-program/microsoft-365-developer-program',
         ['sandbox for developing solutions independent of their production environment'],
         'Microsoft documents a developer sandbox tenant: eligible Microsoft 365 Developer Program members can "request a Microsoft 365 E5 developer subscription to create a sandbox for developing solutions independent of their production environment", and "A Microsoft 365 enterprise or production subscription and a Microsoft 365 Developer Program sandbox are separate subscriptions and environments." The sandbox tenant includes an Entra ID directory; access is eligibility-gated (qualification paths include Visual Studio subscriptions) and the sandbox is Microsoft-365-wide rather than Entra-specific.'),
        ('microsoft-entra-graph-versioning-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/versioning-and-support',
         ['The current version of Microsoft Graph is v1.0',
          'Microsoft declares a version as deprecated at least 24 months in advance of retiring it'],
         'Microsoft Graph publishes an explicit versioning and support policy covering the Entra identity APIs: v1.0 (generally available) vs beta endpoints ("Expect breaking changes and deprecation of APIs in the beta version... not supported" for production), with a committed window: "Microsoft declares a version as deprecated at least 24 months in advance of retiring it" (and the same notice for retiring a GA API), excepting service security or reliability issues.'),
    ],
    ('backend-as-a-service', 'appwrite'): [
        ('appwrite-specs-repo-20261106', 'github',
         'https://raw.githubusercontent.com/appwrite/specs/main/README.md',
         ['This repository contains the official',
          'API specifications and SDK code examples for all supported versions',
          'open-api3-{version}.json'],
         'Appwrite publishes its machine-readable API specifications in the official appwrite/specs repository (repo description "Appwrite\'s official API specifications in Swagger 2.0 and OpenAPI 3.x formats"; README: "This repository contains the official Appwrite API specifications and SDK code examples for all supported versions", with per-version open-api3-{version}.json and swagger2 documents). specs/latest/open-api3-latest.json downloads live, and the specs also ship as the @appwrite.io/specs npm package.'),
        ('appwrite-api-explorer-20261106', 'claimed-docs',
         'https://appwrite.io/docs/references',
         ['Open in explorer', 'OpenAPI spec'],
         'Appwrite\'s API reference pages carry a per-service "OpenAPI spec" download and an "Open in explorer" console: a vendor-built client-side API explorer that loads the OpenAPI document, builds request forms, and executes real requests (guest mode, user-JWT impersonation, or API keys) with cURL export. The explorer mounts client-side and requests run against the user\'s own Appwrite Cloud project endpoint.'),
        ('appwrite-environments-20261106', 'claimed-docs',
         'https://appwrite.io/docs/sdks',
         ['a project can have environments, such as',
          'each with its own resources and users',
          'X-Appwrite-Environment'],
         'Appwrite Cloud documents project environments: "On Appwrite Cloud, a project can have environments, such as `staging`, each with its own resources and users", selected per request via setEnvironment ("The client sends the environment\'s ID in the `X-Appwrite-Environment` header with every request"). Environments live inside a project ("An environment has no project ID of its own") rather than being a separate test tenancy, and the docs do not use the word sandbox; self-hosting a full local instance is the other documented test path.'),
        ('appwrite-response-format-20261106', 'claimed-docs',
         'https://appwrite.io/docs/apis/rest',
         ['X-Appwrite-Response-Format'],
         'Appwrite documents per-request compatibility versioning: the X-Appwrite-Response-Format header is a "Version number used for backward compatibility. The response will be formatted to be compatible with the provided version number."'),
        ('appwrite-release-policy-20261106', 'claimed-docs',
         'https://appwrite.io/docs/apis/release-policy',
         ['we follow industry-standard versioning protocols'],
         'Appwrite publishes a release policy ("we follow industry-standard versioning protocols") with quarterly minor releases and a two-phase continued-support table (Support: "Receive continued bug fixes and security updates"; Extended security support: "Receives only security updates").'),
    ],
    ('banking-as-a-service', 'unit'): [
        ('unit-openapi-link-20261106', 'claimed-docs',
         'https://www.unit.co/docs/api/using-the-api/',
         ['An OpenAPI 3.0 specification for the Unit API is available'],
         'Unit documents its machine-readable spec: "An OpenAPI 3.0 specification for the Unit API is available here", linking the official unit-finance/openapi-unit-sdk repository. The vendor also hosts Postman collections on unit.co ("You can interact immediately with the Unit API via Postman", with the collection\'s server_url "Initially set to the Unit Sandbox environment").'),
        ('unit-postman-collection-20261106', 'claimed-docs',
         'https://www.unit.co/docs/UnitAPI.postman_collection.json',
         ['"name": "Unit API"'],
         'The hosted Postman v2.1 collection ("Unit API") is the vendor\'s documented request-trying surface; the API reference itself is a static Docusaurus render with example requests and no in-page runner.'),
        ('unit-sandbox-20261106', 'claimed-docs',
         'https://www.unit.co/docs/api/sandbox/',
         ['Sandbox environment is a full replica of the production environment',
          'Sandbox exposes a set of simulation-specific endpoints'],
         'Unit documents a strong sandbox: "Unit\'s Sandbox environment is a full replica of the production environment — all standard API endpoints work exactly the same way. Use it to build and test your integration end-to-end before going live." Beyond the standard endpoints, "Sandbox exposes a set of simulation-specific endpoints" (payment clearing, wire receipt, card settlement, statement generation) on the same sandbox base URL (api.s.unit.sh) with the same auth scheme, plus per-resource simulation pages.'),
        ('unit-deprecation-policy-20261106', 'claimed-docs',
         'https://www.unit.co/docs/api/using-the-api/',
         ['subject to a minimum of a six month notice period'],
         'Unit publishes a deprecation commitment: deprecated endpoints "may be retired at a later point in time - subject to a minimum of a six month notice period, like all breaking changes on Unit, unless they follow an urgent security or compliance change." The API is JSON:API REST with unversioned paths and no URL- or header-based version scheme.'),
    ],
    ('applicant-tracking', 'lever'): [
        ('lever-sandbox-20261106', 'claimed-docs',
         'https://hire.lever.co/developer/oauth',
         ['you will use your Lever Integrator Sandbox account',
          'https://api.sandbox.lever.co/v1'],
         'Lever documents a sandbox environment for integrators: "While you are building you will use your Lever Integrator Sandbox account", with its own API base ("make sure you are using both the Sandbox API https://api.sandbox.lever.co/v1"), its own auth server, and per-environment app isolation ("Callback URLs can be unique to sandbox and production. You will have two separate app\'s, one for each environment"). A full sandbox mirror of the API docs is served at hire.sandbox.lever.co. Access is partner/integrator-gated rather than self-serve.'),
        ('lever-compat-commitment-20261106', 'claimed-docs',
         'https://hire.lever.co/developer/documentation',
         ['we won’t rename or remove fields without a version bump'],
         'The Data API (base https://api.lever.co/v1) states a compatibility commitment: "Rest assured, we won’t rename or remove fields without a version bump, but we may decide to add additional fields to the API in the future", and the reference carries dated per-endpoint deprecation notes kept "for backwards compatibility". No standalone versioning or deprecation-policy page exists and no notice period is stated; the commitment is one sentence in the API overview.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none at wave start).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace; none at wave start).
UPDATES: dict = {}

# Hand-recorded counter-check/probe rows a scheduled refresh must not clobber.
PRESERVE_IDS: set = set()

# Fail-closed probe negatives (none this wave).
NEGATIVE_CHECKS: dict = {}

# Fail-closed recorded POST probes: the floot MCP endpoint must stay a live JSON-RPC
# responder (HTTP 200 with the recorded -32603 validation error on a params-less
# initialize), as its excerpt asserts.
POST_CHECKS = {
    'floot-mcp-manifest-20261106': (
        'https://mcp.floot.com/mcp',
        '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}',
        200,
        ['"jsonrpc":"2.0"', '-32603'],
    ),
}

# Fail-closed TLS-mismatch checks (none this wave).
TLS_MISMATCH_CHECKS: dict = {}

_fetch_cache: dict = {}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    r = subprocess.run(
        ['curl', '-sL', '--max-time', '45', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=90)
    body, _, meta = r.stdout.rpartition('\n---META ')
    status = int(meta.strip() or 0)
    # Non-zero curl exits (partial transfer, timeout) must not pass as clean reads.
    if r.returncode != 0:
        status = 0
    _fetch_cache[url] = (status, body)
    return _fetch_cache[url]


def verify(url, markers):
    status, body = fetch(url)
    if status != 200:
        raise SystemExit(f'{url} returned {status}; refusing to append unverified evidence')
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))
    for marker in markers:
        if marker not in text and marker not in body:
            raise SystemExit(f'{url} no longer contains {marker!r}; the page changed - re-derive the excerpt')


def verify_absent(checks):
    for entry in checks:
        url, expected = (entry, {404}) if isinstance(entry, str) else (entry[0], set(entry[1]))
        status, _ = fetch(url)
        if status not in expected:
            raise SystemExit(
                f'{url} answered {status}, expected one of {sorted(expected)}; inconclusive, nothing written.')


def verify_tls_mismatch(host, url, recorded_wrong_name):
    r = subprocess.run(['curl', '-s', '--max-time', '30', '-A', UA, url, '-o', '/dev/null'],
                       capture_output=True, text=True, timeout=60)
    if r.returncode not in (51, 60):
        raise SystemExit(f'{url}: curl exit {r.returncode}, expected a TLS verification failure - inconclusive.')
    s = subprocess.run(f'echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null '
                       '| openssl x509 -noout -subject -ext subjectAltName 2>/dev/null',
                       shell=True, capture_output=True, text=True, timeout=60)
    cert = s.stdout
    if not cert.strip() or host in cert or recorded_wrong_name not in cert:
        raise SystemExit(f'{host}: certificate state drifted - re-derive the counter-check.')


def verify_post(url, payload, expected_status, markers):
    r = subprocess.run(
        ['curl', '-s', '--max-time', '45', '-A', UA, '-X', 'POST',
         '-H', 'Content-Type: application/json', '-d', payload,
         '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=90)
    body, _, meta = r.stdout.rpartition('\n---META ')
    status = int(meta.strip() or 0)
    if r.returncode != 0:
        raise SystemExit(f'POST {url}: curl exit {r.returncode} (incomplete transfer) - inconclusive.')
    if status != expected_status:
        raise SystemExit(f'POST {url} answered {status}, expected {expected_status} - inconclusive.')
    for marker in markers:
        if marker not in body:
            raise SystemExit(f'POST {url} response no longer contains {marker!r}; re-derive the probe.')


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
            if iid in POST_CHECKS:
                verify_post(*POST_CHECKS[iid])
            if iid in TLS_MISMATCH_CHECKS:
                verify_tls_mismatch(*TLS_MISMATCH_CHECKS[iid])
            if iid in have:
                print(f'{iid}: already present, skipping')
                continue
            if markers:
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
