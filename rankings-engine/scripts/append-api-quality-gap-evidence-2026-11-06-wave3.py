#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 3: the next twelve products (thirteen
# arena rows; cubic sits in ai-coding and ai-code-review) from the post-v6-migration
# staleness ranking. Waves 1-2 landed in PRs #623 and #627. Roster: make, n8n, pipedream,
# zapier, retell, penpot, fastmail, zero, orama, mparticle, cubic, jira. iterm2 stays
# deferred (settled unsupported-churn cell; see the wave-2 ledger).
#
# Same fail-closed verification as the wave-1/2 scripts (HTTP 200 plus every marker in
# the raw body or tag-stripped, whitespace-normalized text; mismatch aborts), with the
# same REMOVALS / UPDATES / PRESERVE_IDS plumbing. Counter-check probe rows record
# unpublished or disabled surfaces up front, and excerpts carry their scope caveats
# verbatim (the PR #595/#623/#627 conventions).
#
# Verified-honest counterparts (NO items added for the story, on purpose). Per-cell
# detail, including every checked URL, lives in
# reports/evidence-parity/2026-11-06-api-quality-wave3.json:
#   - make api-sandbox: no sandbox or test environment in the developer docs index; the
#     interactive runner's allowed origins are all production zones, and the closest
#     surfaces (test HTTP calls, app version staging) belong to custom-app development.
#   - n8n api-sandbox: the vendor's own playground docs warn "you have access to your
#     live data" and "Be aware you can change or delete real data", and its guidance is
#     to stand up a separate test workflow or test instance; no test mode exists (the
#     warnings ride in the appended playground excerpt).
#   - retell api-machine-spec: the reference is generated from an internal OpenAPI
#     document ("openapi-final") that is not served at any public URL (all candidate
#     spec paths 404; the Stainless-generated SDKs ship no spec file); recorded as a
#     preserved counter-check.
#   - penpot api-sandbox: the technical guide covers self-hosting, configuration, and a
#     contributor dev environment; no sandbox or test mode for a hosted account (the
#     nearest flag, enable-cors, is "designed only for dev purposes right now").
#   - penpot api-versioning-policy: "The system is relatively simple for now, but expect
#     more functions in the future" and "we do not have any specific documentation for
#     the webhooks yet"; the generated /api/_doc carries auto-generated per-method change
#     annotations, not a policy; the OpenAPI version is the product release.
#   - fastmail api-interactive-docs: www.fastmail.com/dev/ is static prose pointing at
#     GitHub samples and the jmap.io crash course; no explorer, no "Try it".
#   - fastmail api-sandbox: API tokens operate on the user's real account ("For testing
#     purposes, or building an app for just yourself, you can generate an API token");
#     no isolated test environment.
#   - fastmail api-versioning-policy: zero versioning/deprecation hits on /dev/; JMAP
#     capability URNs are extension negotiation, not a vendor policy.
#   - zero, all four stories: no docs site exists (0.email serves its SPA shell on every
#     path; docs subdomains do not resolve); the only API-adjacent surface is the
#     repository's MCP.md prose, appended as context.
#   - orama, all four stories: the vendor states "the REST APIs are private and can only
#     be accessed by authorized users" (appended as the state row); zero hits for
#     openapi/swagger, Try it/playground, sandbox/staging, and versioning/deprecation
#     across the 312 KB llms-full.txt corpus (api.askorama.ai/openapi.json is an HTML
#     SPA shell, a soft-200 false positive).
#   - mparticle api-interactive-docs: the Gatsby docs are static (no "Try it" on the
#     Events, Platform, or Profile API pages); closest is inline curl/JSON samples.
#   - cubic api-sandbox: only live personal (cbk_) and organization (cok_) keys against
#     the production base URL; no test keys or environment (the CLI's headless CI mode
#     is a local surface, not a sandbox).
#   - jira api-interactive-docs: the REST v3 reference is a static SSR reference whose
#     only runnable affordance is a generated Postman collection export; the hosted
#     explorer belongs to the Atlassian GraphQL gateway, a different API.
#
# Reachability notes: developer.atlassian.com/platform/tool/cloud-development-environment/
# answers HTTP 202 into an id.atlassian.com login wall; the reachable vendor substitutes
# (support.atlassian.com sandboxes page, Forge demo-site docs) are cited instead.
# docs.mparticle.com/llms.txt and /changelog/ are soft 404s; the real changelog is
# changelog.mparticle.com. Make's OpenAPI document is served from openapi.gitbook.com
# (GitBook's spec hosting for Make's docs org) and is the document the reference pages
# embed and render; Make's prose never links it directly. No other walls were hit.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> --product <id>
#   pnpm engine derive --category <arena>
# then the dependent generators, and run the pre-audit over every upward flip BEFORE the
# first push (the wave-2 ledger preAudit procedure).
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
    ('workflow-automation', 'make'): [
        ('make-openapi-spec-20261106', 'claimed-docs',
         'https://openapi.gitbook.com/o/8lUfdal5k5WEadMGCIer/spec/api-public-endpoints.json',
         ['"openapi":"3.0.0"', '"title":"Web API v2 - Public "'],
         'Make\'s public Web API v2 is described by a machine-readable OpenAPI 3.0.0 document ("title":"Web API v2 - Public ", "description":"Documentation of the public web API.", servers eu1.make.com/api/v2 and the other production zones). The document is hosted on GitBook\'s spec infrastructure for Make\'s docs org and is what every developers.make.com API Reference page embeds and renders from; Make\'s prose does not link it as a download.'),
        ('make-api-test-runner-20261106', 'claimed-docs',
         'https://developers.make.com/api-documentation/api-reference/users',
         ['Test it'],
         'The API Reference endpoint pages on developers.make.com render a live "Test it" runner per operation (GitBook OpenAPI blocks backed by a Scalar proxy whitelisted for Make\'s production zones eu1/eu2/us1/us2.make.com/api/v2). The runner executes against production zone URLs; no test server appears among the allowed origins.'),
        ('make-api-structure-20261106', 'claimed-docs',
         'https://developers.make.com/api-documentation/getting-started/api-structure.md',
         ['https://{zone_url}/api/{api_version}/{api_endpoint}',
          'The Make API is currently the second version'],
         'Make documents URL-path versioning: "The URL of the Make API consists of three parts: https://{zone_url}/api/{api_version}/{api_endpoint}" with "API version: The version of the API. The Make API is currently the second version." No stability guarantee, deprecation policy, breaking-change policy, or API changelog is published for the API.'),
    ],
    ('workflow-automation', 'n8n'): [
        ('n8n-openapi-spec-20261106', 'github',
         'https://raw.githubusercontent.com/n8n-io/n8n/master/packages/cli/src/public-api/v1/openapi.yml',
         ['openapi: 3.0.0', 'title: n8n Public API'],
         'The official n8n-io/n8n repository carries the n8n Public API\'s OpenAPI 3.0.0 specification (info title "n8n Public API", servers /api/v1), and the docs state the hosted endpoint reference is "generated from the OpenAPI specification". The file is the in-repo source rather than an advertised download.'),
        ('n8n-api-reference-20261106', 'claimed-docs',
         'https://docs.n8n.io/connect/n8n-api/api-reference.md',
         ["generated from the OpenAPI specification"],
         'The n8n API reference: "This section is the complete endpoint reference for n8n\'s public REST API, generated from the OpenAPI specification", with versioned base URLs for Cloud (https://<your-instance>.app.n8n.cloud/api/v1) and self-hosted instances.'),
        ('n8n-api-playground-20261106', 'claimed-docs',
         'https://docs.n8n.io/connect/n8n-api/use-an-api-playground.md',
         ['The n8n API comes with a built-in Swagger UI playground in self-hosted versions',
          'you have access to your live data'],
         'n8n documents two interactive runners: "You can test API calls from this site\'s endpoint reference" (the docs-site playground, powered by Scalar\'s platform and proxied through Scalar\'s servers) and "The n8n API comes with a built-in Swagger UI playground in self-hosted versions. This provides interactive documentation, where you can try out requests." The same page warns there is no test isolation: "you have access to your live data. Be aware you can change or delete real data"; the vendor\'s guidance for safety is a separate test workflow or test instance, and the built-in Swagger UI is self-hosted only.'),
        ('n8n-api-versioning-20261106', 'claimed-docs',
         'https://docs.n8n.io/connect/n8n-api/use-an-api-playground.md',
         ['The API version number is `1`. There may be multiple versions available in the future.'],
         'The API is URL-path versioned (base paths end /api/v1; the self-hosted playground lives at /api/v<api-version-number>/docs) and the docs state "The API version number is `1`. There may be multiple versions available in the future." No API-specific deprecation or stability policy and no public-API changelog exist; the product-level v2/v3 breaking-change pages carry no public-API entries.'),
    ],
    ('workflow-automation', 'pipedream'): [
        ('pipedream-openapi-spec-20261106', 'claimed-docs',
         'https://pipedream.com/docs/pipedream_openapi_swagger.json',
         ['"openapi": "3.0.4"', '"title": "Pipedream REST API"'],
         'Pipedream publishes its REST API as a machine-readable OpenAPI 3.0.4 document (info title "Pipedream REST API", version 2.0.0, server https://api.pipedream.com) on its own docs domain, and the docs llms.txt lists it under "## OpenAPI Specs" together with a second Conduit API spec.'),
        ('pipedream-api-playground-20261106', 'claimed-docs',
         'https://pipedream.com/docs/connect/api-reference/list-apps',
         ['"playground":{"display":"interactive"}', 'Try it'],
         'The Connect API reference pages run the Mintlify API playground in interactive mode ("playground":{"display":"interactive"}) with a "Try it" runner per endpoint, e.g. "List apps". The vendor changelog calls the reference "completely redesigned, interactive, AI-friendly documentation".'),
        ('pipedream-connect-environments-20261106', 'claimed-docs',
         'https://pipedream.com/docs/connect/managed-auth/environments.md',
         ['Pipedream Connect projects support two environments: `development` and `production`',
          'Connected accounts and credentials stored in one environment remain separate from the other'],
         'Pipedream documents environment isolation for Connect: "Pipedream Connect projects support two environments: `development` and `production`. Connected accounts and credentials stored in one environment remain separate from the other", selected per request via the x-pd-environment header or the SDK\'s projectEnvironment. Development mode is capped ("Maximum of 10 external users... Personal testing only") and the split covers the Connect surface, not the legacy workflows product.'),
        ('pipedream-sdk-lifecycle-20261106', 'claimed-docs',
         'https://pipedream.com/docs/changelog.md',
         ['there are no plans to deprecate the `1.x` TypeScript SDK'],
         'Pipedream maintains a dated product changelog and a dedicated SDK migration guide with an explicit non-deprecation commitment: "there are no plans to deprecate the `1.x` TypeScript SDK, so if you\'ve already implemented that version, make sure to read through the migration guide". The REST API base URL is versioned (/v1). The commitment quoted is SDK-level; no standalone API-wide versioning or deprecation policy page exists.'),
    ],
    ('workflow-automation', 'zapier'): [
        ('zapier-openapi-specs-20261106', 'claimed-docs',
         'https://docs.zapier.com/api-reference/overview.md',
         ['**OpenAPI specs** are served at `/api-reference/specs/<api-name>.yaml`',
          'https://zapier.com/.well-known/api-catalog'],
         'Zapier publishes machine-readable specs for each public API: "OpenAPI specs are served at /api-reference/specs/<api-name>.yaml", and an RFC 9727 "API catalog at https://zapier.com/.well-known/api-catalog" links the public APIs (Actions, Connections, Trigger Inbox, plus the MCP server card) to their machine-readable specs and docs.'),
        ('zapier-trigger-inbox-spec-20261106', 'claimed-docs',
         'https://docs.zapier.com/api-reference/specs/trigger-inbox.yaml',
         ['openapi: 3.1.0', 'title: Trigger Inbox API'],
         'The spec files themselves download as OpenAPI 3.1.0 YAML, e.g. the Trigger Inbox API ("Manage trigger inboxes and their messages", server https://api.zapier.com, production), with a parallel connections.yaml.'),
        ('zapier-api-playground-20261106', 'claimed-docs',
         'https://docs.zapier.com/api-reference/trigger-inbox/inboxes/list-all-inboxes',
         ['Try it'],
         'Each API reference page carries a live runner: per the overview, "Each API in the sidebar includes an interactive playground where you can make live requests. Select an endpoint, fill in the parameters, and run it directly from the browser" — e.g. "List all inboxes" (GET /trigger-inbox/v1/inboxes) renders a "Try it" console.'),
        ('zapier-partner-sandbox-20261106', 'claimed-docs',
         'https://docs.zapier.com/integrations/publish/zps.md',
         ['Zapier Partner Sandbox (ZPS) is a complimentary Partner Program benefit'],
         '"Zapier Partner Sandbox (ZPS) is a complimentary Partner Program benefit that gives your integration team access to a workspace with premium Zap features at no cost. It\'s designed to support the ongoing development and maintenance of your Zapier integration" (50 Zap workflows, 2,000 free tasks per month). ZPS is a separate free account workspace for partners with a beta or public integration, owned by Zapier; it is not an API test mode or isolated data environment for API consumers.'),
        ('zapier-version-lifecycle-20261106', 'claimed-docs',
         'https://docs.zapier.com/integrations/manage/version-lifecycle-states.md',
         ['private, promoted, available, legacy, deprecating, and deprecated'],
         'Zapier documents a full lifecycle for integration versions on its Developer Platform: "lifecycle states an integration version can go through, including private, promoted, available, legacy, deprecating, and deprecated", with companion pages for deprecating versions and migrating users. This lifecycle governs partner integration versions, not Zapier\'s own public REST APIs, which carry versioned paths (/trigger-inbox/v1, v1/v2 Workflow API endpoints) and no standalone stability or deprecation policy page.'),
    ],
    ('voice-agents', 'retell'): [
        # Counter-check recorded up front: the reference is spec-driven but the spec is
        # not published.
        ('retell-spec-unpublished-20261106', 'probe',
         'https://docs.retellai.com/api-references/create-phone-call',
         ['"openapi":"openapi-final'],
         'PROBE spec-publication check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave3.py): the Retell API reference pages are generated from an internal OpenAPI document named "openapi-final" (the page metadata binds each operation to it, e.g. "openapi":"openapi-final post /v2/create-phone-call"), but that document is not served at any public URL: docs.retellai.com/openapi.json, /api-references/openapi.json, /openapi-final.json, api.retellai.com/openapi.json all answer 404, the docs llms.txt lists no spec, and the Stainless-generated SDKs ship no spec file.'),
        ('retell-api-playground-20261106', 'claimed-docs',
         'https://docs.retellai.com/api-references/create-phone-call',
         ['"playground":{"display":"interactive"}', 'Try it'],
         'The Mintlify-hosted API reference runs the interactive playground ("playground":{"display":"interactive"}) with a "Try it" runner per endpoint, e.g. "Create a new outbound phone call" (POST /v2/create-phone-call), alongside per-language SDK examples.'),
        ('retell-test-surfaces-20261106', 'claimed-docs',
         'https://docs.retellai.com/test/test-overview.md',
         ['several ways to test an agent before it takes real calls'],
         'Retell documents "several ways to test an agent before it takes real calls, from a quick text chat to a full phone call": an LLM Playground with tool-call inspection, simulation/batch testing with graded test cases, browser web-call testing without a phone number, and phone-call testing. These test surfaces live inside the same production workspace and API key space (no isolated environment or separate test data store), and testing is billed at production rates.'),
        ('retell-staging-tags-20261106', 'claimed-docs',
         'https://docs.retellai.com/agent/version.md',
         ['Each agent starts with `prod` and `staging` tags',
          'A new version starts as a **draft**, which you can edit and test.'],
         'Agent versions carry environment tags: "Each agent starts with `prod` and `staging` tags" pointing at agent versions ("your production number could use the prod tag, assigned to V2. While it continues to use V2, you can test V3"), and "A new version starts as a draft, which you can edit and test". This is draft/staging version tagging within the same workspace, not a separate sandbox environment.'),
        ('retell-deprecation-notices-20261106', 'claimed-docs',
         'https://docs.retellai.com/deprecation-notice/overview.md',
         ['API deprecations take effect in the API itself'],
         'Retell publishes a dated deprecation-notices page tracking "Retell API, SDK, and billing deprecations and breaking changes" with RSS subscription, configurable workspace notification recipients, migration deadlines and impacted endpoints (e.g. removing GET /list-agents in favor of POST /v2/list-agents): "API deprecations take effect in the API itself, so staying on an older SDK version doesn\'t defer them." The API is path-versioned (/v2); no forward-looking minimum-notice commitment is stated as policy.'),
    ],
    ('design-tools', 'penpot'): [
        # Pre-audit correction (run before the first push, the wave-2 procedure): the
        # openness-open-license re-roll went full while its rationale noted the license
        # name was missing. The repository license is appended verbatim so the credit
        # rests on the license text (the PR #627 smithery-license precedent).
        ('penpot-mpl-license-20261106', 'github',
         'https://raw.githubusercontent.com/penpot/penpot/main/LICENSE',
         ['Mozilla Public License Version 2.0'],
         'The penpot/penpot repository is licensed under the Mozilla Public License Version 2.0 (the LICENSE file opens "Mozilla Public License Version 2.0"). The full platform source (frontend, backend, exporter) is public in the same repository.'),
        ('penpot-openapi-spec-20261106', 'claimed-docs',
         'https://design.penpot.app/api/main/doc/openapi.json',
         ['"openapi":"3.0.0"', 'MAIN API'],
         'Penpot\'s hosted SaaS instance serves a machine-readable OpenAPI 3.0.0 document for the backend RPC API (152 paths, server design.penpot.app/api/main/methods). The document is auto-generated from backend source ("generated automatically from source code", per the integration guide), its info.version tracks the product release (2.19), and on self-hosted instances the doc endpoints sit behind the enable-backend-api-doc flag.'),
        ('penpot-backend-api-docs-20261106', 'claimed-docs',
         'https://help.penpot.app/technical-guide/integration/',
         ['generated automatically from source code'],
         'The integration guide directs developers to "the backend API documentation, generated automatically from source code, as a guide" (the generated RPC reference listing every method with params and docstrings). The guide also notes the webhook system has no dedicated documentation yet.'),
        ('penpot-swagger-ui-20261106', 'claimed-docs',
         'https://design.penpot.app/api/openapi',
         ['SwaggerUI'],
         'The hosted instance serves a Swagger UI page ("MAIN API") that loads the live OpenAPI document from /api/main/doc/openapi.json. Live calls require instance authentication; the help docs link the static generated reference (/api/_doc) rather than this UI, and on self-hosted instances the endpoint depends on the backend doc flag.'),
    ],
    ('email', 'fastmail'): [
        ('fastmail-jmap-session-20261106', 'claimed-docs',
         'https://www.fastmail.com/dev/',
         ['The JMAP session resource can be found at https://api.fastmail.com/jmap/session',
          'The full API specification documents are linked above'],
         'Fastmail\'s developer page documents JMAP\'s machine-readable discovery model: "The JMAP session resource can be found at https://api.fastmail.com/jmap/session" (the session object advertises capabilities, accounts, and API URLs; /.well-known/jmap answers with the standard RFC 8620 redirect), with CORS-enabled APIs and API-token auth. "The full API specification documents" are the IETF RFCs (8620, 8621, 9610); this is authenticated per-account runtime discovery, not a downloadable OpenAPI-style spec file, and no OpenAPI exists on fastmail.com.'),
    ],
    ('email', 'zero'): [
        ('zero-mcp-prose-20261106', 'github',
         'https://raw.githubusercontent.com/Mail-0/Zero/main/MCP.md',
         ['Zero MCP provides the following capabilities'],
         'Zero (an open-source, self-hostable AI email app) documents no public HTTP API; the only API-adjacent surface is the repository\'s MCP.md, a prose capability list ("Zero MCP provides the following capabilities": get threads, list folders, create and send emails) authenticated by copying a browser session cookie, with no endpoint schema and OAuth marked coming soon. No docs site exists: 0.email serves its SPA shell on every path and the docs subdomains do not resolve.'),
    ],
    ('search-infra', 'orama'): [
        ('orama-rest-apis-private-20261106', 'claimed-docs',
         'https://docs.orama.com/docs/cloud/data-sources/rest-APIs/using-rest-apis',
         ['the REST APIs are private and can only be accessed by authorized users',
          'we are working on making them public and accessible to all users'],
         'Orama\'s own docs state the Cloud REST APIs\' availability: "At the time of writing, the REST APIs are private and can only be accessed by authorized users. However, we are working on making them public and accessible to all users", directing users to the official SDKs or an early-access contact. Accordingly no OpenAPI document, interactive reference, sandbox, or versioning policy is published for the REST surface (zero hits across the docs corpus).'),
    ],
    ('customer-data-platforms', 'mparticle'): [
        ('mparticle-events-openapi-20261106', 'claimed-docs',
         'https://docs.mparticle.com/developers/apis/http/',
         ['Use the Open API (previously known as Swagger) specification or similar tools to generate helper SDKs',
          'Events API Open API Spec'],
         'The Events API docs publish a downloadable machine-readable spec: "Use the Open API (previously known as Swagger) specification or similar tools to generate helper SDKs (using Swagger Codegen or OpenAPI Generator) for the Events API: Events API Open API Spec." The spec covers the Events API only; the Platform and Profile API pages carry no spec.'),
        ('mparticle-events-spec-file-20261106', 'claimed-docs',
         'https://docs.mparticle.com/downloads/mparticle.events.oas.yaml',
         ['openapi: 3.0.3', 'mParticle Event Server'],
         'The spec file itself downloads as OpenAPI 3.0.3 YAML ("This is the mParticle Event Server").'),
        ('mparticle-environment-flag-20261106', 'claimed-docs',
         'https://docs.mparticle.com/developers/apis/json-reference/',
         ['Must be either “production” or “development.”'],
         'Every Events API batch carries an environment field, "production" or "development" (default production; the client SDKs set it via isDevelopmentMode), which segregates development data from production data within the same account. This is a per-event environment flag, not a separate sandbox instance or test tenant; the word sandbox appears nowhere in the API docs.'),
        ('mparticle-dsr-v3-upgrade-20261106', 'claimed-docs',
         'https://docs.mparticle.com/developers/apis/dsr-api/v3/',
         ['upgrade from version 1 or version 2 to version 3'],
         'mParticle versions its APIs per surface with documented migrations, e.g. the Data Subject Request API v3 upgrade guide ("Follow the steps below to upgrade from version 1 or version 2 to version 3. Update to the v3 base URL https://opendsr.mparticle.com/v3"), alongside a Warehouse Sync API v2 migration. No policy page states notice periods or lifecycle guarantees.'),
        ('mparticle-changelog-20261106', 'claimed-docs',
         'https://changelog.mparticle.com',
         ['mParticle Changelog'],
         'The vendor maintains a dated changelog at changelog.mparticle.com ("What\'s new on Rokt mParticle"), linked from the docs navigation (docs.mparticle.com/changelog/ itself is a soft 404).'),
    ],
    ('ai-coding', 'cubic'): [
        ('cubic-analytics-openapi-20261106', 'claimed-docs',
         'https://docs.cubic.dev/openapi/analytics.json',
         ['"openapi": "3.1.0"', '"title": "cubic Analytics API"'],
         'cubic publishes a machine-readable OpenAPI 3.1.0 document for its Analytics API ("Export pull request analytics with a personal or organization API key. Access requires Pro or Max."). The Members API has no single downloadable file; its complete OpenAPI operations are published embedded per endpoint in the reference\'s markdown mirrors.'),
        ('cubic-members-api-ref-20261106', 'claimed-docs',
         'https://docs.cubic.dev/api-reference/members/list-organizations.md',
         ['openapi: 3.1.0', 'operationId: listOrganizations'],
         'Each Members API endpoint page\'s markdown mirror embeds the full OpenAPI 3.1.0 YAML for that operation (title "cubic API", paths, parameters, response schemas, rate-limit headers), e.g. listOrganizations (GET /api/v1/organizations).'),
        ('cubic-api-playground-20261106', 'claimed-docs',
         'https://docs.cubic.dev/api-reference/members/list-organizations',
         ['"playground":{"display":"interactive"}', 'Try it'],
         'The API reference runs the Mintlify interactive playground ("playground":{"display":"interactive"}) with a "Try it" runner per endpoint; the overview states "Each endpoint page includes an authenticated request playground, response schemas, and code examples."'),
        ('cubic-key-lifecycle-20261106', 'claimed-docs',
         'https://docs.cubic.dev/api-reference/overview.md',
         ['Analytics API keys that start with `cak_` keep working'],
         'The API is path-versioned (/api/v1/organizations, /api/analytics/v1/prs) with a dated changelog, and the overview documents a legacy-credential lifecycle commitment: "Analytics API keys that start with `cak_` keep working with the Analytics API, but cubic no longer creates them." No versioning or deprecation policy document exists.'),
    ],
    ('ai-code-review', 'cubic'): [
        ('cubic-analytics-openapi-20261106', 'claimed-docs',
         'https://docs.cubic.dev/openapi/analytics.json',
         ['"openapi": "3.1.0"', '"title": "cubic Analytics API"'],
         'cubic publishes a machine-readable OpenAPI 3.1.0 document for its Analytics API ("Export pull request analytics with a personal or organization API key. Access requires Pro or Max."). The Members API has no single downloadable file; its complete OpenAPI operations are published embedded per endpoint in the reference\'s markdown mirrors.'),
        ('cubic-members-api-ref-20261106', 'claimed-docs',
         'https://docs.cubic.dev/api-reference/members/list-organizations.md',
         ['openapi: 3.1.0', 'operationId: listOrganizations'],
         'Each Members API endpoint page\'s markdown mirror embeds the full OpenAPI 3.1.0 YAML for that operation (title "cubic API", paths, parameters, response schemas, rate-limit headers), e.g. listOrganizations (GET /api/v1/organizations).'),
        ('cubic-api-playground-20261106', 'claimed-docs',
         'https://docs.cubic.dev/api-reference/members/list-organizations',
         ['"playground":{"display":"interactive"}', 'Try it'],
         'The API reference runs the Mintlify interactive playground ("playground":{"display":"interactive"}) with a "Try it" runner per endpoint; the overview states "Each endpoint page includes an authenticated request playground, response schemas, and code examples."'),
        ('cubic-key-lifecycle-20261106', 'claimed-docs',
         'https://docs.cubic.dev/api-reference/overview.md',
         ['Analytics API keys that start with `cak_` keep working'],
         'The API is path-versioned (/api/v1/organizations, /api/analytics/v1/prs) with a dated changelog, and the overview documents a legacy-credential lifecycle commitment: "Analytics API keys that start with `cak_` keep working with the Analytics API, but cubic no longer creates them." No versioning or deprecation policy document exists.'),
    ],
    ('project-management', 'jira'): [
        ('jira-openapi-spec-20261106', 'claimed-docs',
         'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json',
         ['"openapi":"3.0.1"', 'The Jira Cloud platform REST API'],
         'Atlassian publishes the Jira Cloud platform REST API as a machine-readable OpenAPI 3.0.1 document (info title "The Jira Cloud platform REST API", 433 paths), linked from the REST v3 reference intro, alongside a vendor-generated Postman collection export.'),
        ('jira-rest-v3-intro-20261106', 'claimed-docs',
         'https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/',
         ['This documentation is for version 3 of the Jira Cloud platform REST API, which is the latest version',
          'Version 2 and version 3 of the API offer the same collection of operations'],
         'The REST API is explicitly versioned: "This documentation is for version 3 of the Jira Cloud platform REST API, which is the latest version. Version 2 and version 3 of the API offer the same collection of operations" (v3 adds Atlassian Document Format support). The reference itself is a static SSR reference; its runnable affordance is the generated Postman collection, not an in-page console.'),
        ('jira-product-sandboxes-20261106', 'claimed-docs',
         'https://support.atlassian.com/organization-administration/docs/what-are-sandboxes/',
         ['A sandbox is an isolated environment where you can experiment and test changes safely',
          'Premium or Enterprise plan'],
         'Atlassian documents product sandboxes: "A sandbox is an isolated environment where you can experiment and test changes safely before applying them in production. Every sandbox works like a replica of your production environment", available for Jira (and Confluence, JSM, JPD) on Premium or Enterprise plans. The page notes a sandbox "is not a production environment" and is not covered by the SLA.'),
        ('jira-dev-site-20261106', 'claimed-docs',
         'https://developer.atlassian.com/platform/forge/provision-a-demo-development-site/',
         ['demo development site'],
         'For developers, Atlassian provisions free development instances: "Forge can provision a demo development site when you need an Atlassian site for developing and testing an app" ("Demo sites are active for 90 days by default"), and the getting-started docs point to creating a traditional Atlassian cloud developer site. (The cloud-development-environment page itself sits behind an id.atlassian.com login; these reachable pages document the surface.)'),
        ('jira-rest-api-policy-20261106', 'claimed-docs',
         'https://developer.atlassian.com/platform/marketplace/atlassian-rest-api-policy/',
         ['Atlassian REST API policy', 'for at least 6 months'],
         'Atlassian publishes a formal REST API policy with a deprecation commitment: a deprecated REST API in the cloud environment must remain available in its original form "for at least 6 months" (with exceptions for critical security, reliability, or data-integrity fixes), deprecated endpoints should return RFC 9745 response headers, and a dedicated API-versioning section describes how versions are exposed.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none in this wave).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace; none at wave start).
UPDATES: dict = {}

# Hand-recorded counter-check rows that a scheduled refresh must not clobber.
PRESERVE_IDS = {'retell-spec-unpublished-20261106'}

# Fail-closed probe negatives (the #502 convention, applied after the PR #630 review):
# every URL an excerpt asserts is absent must answer exactly 404 on each run; any other
# status exits inconclusive and nothing is written. Checked whether the row is being
# appended or is already present, so a later spec publication fails the script instead of
# leaving a stale absence claim in the pack.
NEGATIVE_CHECKS = {
    'retell-spec-unpublished-20261106': [
        'https://docs.retellai.com/openapi.json',
        'https://docs.retellai.com/api-references/openapi.json',
        'https://docs.retellai.com/openapi-final.json',
        'https://api.retellai.com/openapi.json',
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
