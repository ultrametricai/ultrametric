#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 10: the next twelve rows from the
# corrected staleness ranking on post-#644 main (49 gap rows; waves 1-9 = PRs #623,
# #627, #630, #632, #634, #639, #641, #643, #644). Roster: sevdesk, channel3,
# undermind, kling, luma, pika, aircall, quo, pomelo, gitea, alloy, hummingbird.
# iterm2 stays deferred (wave-2 ledger), foreloop stays excluded pending the maintainer
# ruling (wave-7 ledger), and the two kimi cells escalated in #644 ship as judged.
#
# Same fail-closed toolkit as waves 6-9. Excerpts carry scope caveats verbatim.
# curl runs with --http1.1 globally: tech.sevdesk.com fails HTTP/2 negotiation
# (curl exit 000) but serves normally over HTTP/1.1.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave10.json:
#   - sevdesk api-interactive-docs: Redoc standalone reference with no runner (the spec
#     recommends Postman/cURL); api-sandbox: the documented path is a separate trial
#     account, not a sandbox mode (tokens are production with infinite lifetime).
#   - channel3 api-sandbox: zero sandbox/test-key/staging text in the 380 KB corpus; the
#     keyless MCP free tier is production-catalog access.
#   - undermind: all four none - MCP-only developer surface (preserved context row);
#     openapi/docs/llms.txt all hard-404, docs subdomain unresolved.
#   - kling api-machine-spec: kling.ai/openapi.json serves the SPA shell (soft-200); the
#     docs render endpoints from bundled JS with no spec artifact. api-interactive-docs:
#     static samples only (the doc renderer has no try/run strings).
#     api-sandbox: quickstart is purchase-and-top-up against the production domain; none
#     of the 239 doc paths mention sandbox/trial/test. Kling rows cite the CDN content
#     chunks directly because the HTML routes are a soft-200 SPA shell; if a chunk hash
#     rotates, the fail-closed verify catches it and forces re-derivation.
#   - luma api-sandbox: explicit vendor denial ("There is no staging or sandbox
#     environment."), preserved counter row.
#   - pika api-sandbox and api-versioning-policy: explicit vendor framing ("no separate
#     test environment", "the closest thing to a sandbox" is the free catalog/quote
#     endpoints), preserved counter row; no changelog/docs (404s replayed).
#   - aircall api-interactive-docs: the real reference host serves a static single page
#     (zero try-it markup, two curl samples); the ReadMe portal carries guides only.
#     api-sandbox is partner-gated (trial developer account after Technology Partner
#     approval), carried with its gating.
#   - quo api-sandbox: zero sandbox/test-mode text anywhere including the 1.7 MB spec;
#     single production server; the webhook test-event endpoint is the closest facility.
#   - pomelo api-machine-spec: no downloadable artifact (reference embeds schema data in
#     the app payload; openapi/swagger/postman 404s replayed); api-interactive-docs:
#     tabbed static samples, zero Probar/Ejecutar/try-it; api-versioning-policy:
#     URL-versioned paths and a "(Deprecado)" group but no policy/changelog.
#   - gitea api-sandbox: try.gitea.io is NXDOMAIN and demo.gitea.com, while live, is not
#     documented as a test environment on any fetched vendor page;
#     api-versioning-policy: /api/v1 and per-release specs, but no deprecation or
#     back-compat statement anywhere checked.
#   - hummingbird: all four none publicly - the entire ReadMe docs project is
#     password-gated (preserved context row records the gate).
#
# Reachability notes: kling.ai and developers.aircall.io soft-200 unknown paths
# (content-verified); docs.klingai.com, docs.kling.ai, docs.pika.art, and the
# hummingbird apidocs/developers subdomains do not resolve; api.pika.art answers 403;
# the aircall Postman workspace serves an unverifiable JS shell (control fetch died with
# curl error 35 - documented, not circumvented); quo's spec is served from an S3 bucket
# that keeps the pre-rebrand openphone name. No other walls were hit.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> [--product <id>]
#   (ai-video, business-phone, and compliance-screening judge category-wide)
#   pnpm engine derive --category <arena>
# then the dependent generators, and the pre-audit over every upward flip (review-fix
# re-rolls included) BEFORE any push.
import datetime
import json
import os
import re
import subprocess
import time
from urllib.parse import urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

ITEMS = {
    ('accounting', 'sevdesk'): [
        ('sevdesk-openapi-20261106', 'claimed-docs',
         'https://api.sevdesk.de/openapi.yaml',
         ['openapi: 3.0.0', 'title: sevdesk API'],
         'sevdesk publishes its full OpenAPI 3.0.0 document (671 KB YAML, base https://my.sevdesk.de/api/v1) as a downloadable file that is also the source its Redoc reference at api.sevdesk.de renders directly.'),
        ('sevdesk-trial-testing-20261106', 'claimed-docs',
         'https://api.sevdesk.de/openapi.yaml',
         ['For testing our API, we would always recommend to create a trial account for sevdesk to prevent unwanted changes to your main account.',
          'To start testing we would recommend one of the following tools:'],
         'Scope of the testing surface: "For testing our API, we would always recommend to create a trial account for sevdesk to prevent unwanted changes to your main account" ("A trial account will be in the highest tariff (materials management), so every sevdesk function can be tested!") - a separate real account rather than a sandbox mode, with production tokens ("The api tokens have an infinite lifetime"). The reference is Redoc standalone with no request runner; the spec recommends external tools ("To start testing we would recommend one of the following tools:" Postman, cURL).'),
        ('sevdesk-versioning-20261106', 'claimed-docs',
         'https://api.sevdesk.de/openapi.yaml',
         ['We use resource versioning to handle breaking changes for our endpoints, these are rarely used and will be communicated before we remove older versions.',
          'X-Version: Used for resource versioning see information below'],
         'sevdesk documents per-resource versioning: "We use resource versioning to handle breaking changes for our endpoints, these are rarely used and will be communicated before we remove older versions", selected per request via the X-Version header (default, 1.0 through 1.9; unknown versions error with the available list), with a Deprecation response header ("If a resource is deprecated we return true or a timestamp since when") and a documented account-level sevdesk-Update 2.0 transition. Caveat: header-based resource versions over a fixed /api/v1 base, and no single notice-window policy page.'),
        ('sevdesk-api-news-20261106', 'claimed-docs',
         'https://tech.sevdesk.com/api_news/',
         ['API News | sevDesk Tech Blog',
          'Breaking change: new API pagination limits'],
         'sevdesk maintains a dated API changelog on its tech blog ("API News"; "Endpoints and data streams. Integration and expansion. You and our API.") with breaking-change announcements carrying dated notice ("Breaking change: new API pagination limits": "By 30.05.2025, we will introduce a restriction on our pagination limits for API calls that retrieve data.") and release posts such as "Breaking Changes Q1 2026" and the sevdesk-Update 2.0 changes post.'),
    ],
    ('agentic-commerce', 'channel3'): [
        ('channel3-openapi-20261106', 'claimed-docs',
         'https://channel3.ai/docs/openapi/openapi.json',
         ['"openapi": "3.1.0"', '"url": "https://api.trychannel3.com"'],
         'Channel3 publishes a downloadable OpenAPI 3.1.0 document (48 paths plus 5 webhooks, production server https://api.trychannel3.com), advertised in the docs llms.txt under "OpenAPI Specs". Caveat: the info block carries framework defaults (title "FastAPI", version "0.1.0"); product versioning lives in the changelog.'),
        ('channel3-tryit-20261106', 'claimed-docs',
         'https://channel3.ai/docs/api-reference/v1/search',
         ['aria-label="Try it"', 'tryit-button'],
         'The Mintlify-hosted API reference runs the "Try it" playground per endpoint, with llms.txt, llms-full.txt, and .md mirrors of every page. The runner mounts client-side and executes against the production API with a real key.'),
        ('channel3-changelog-20261106', 'claimed-docs',
         'https://channel3.mintlify.dev/docs/changelog/v4-2-0.md',
         ['# v4.2.0 — October 2026', 'Every change is additive.'],
         'The API is /v1 path-versioned (announced with explicit breaking-change migration instructions: "Announcing the /v1 Search API & SDK 3.0.0" / "What we removed (breaking changes) + migration instructions") and carries a dated semver changelog (v2.0.0 through v4.2.0) with per-release compatibility statements ("Every change is additive.") and in-docs deprecation practice ("`categories` on the Product response is now deprecated."). Caveat: no standalone versioning or notice-window policy page.'),
    ],
    ('ai-research-agents', 'undermind'): [
        ('undermind-mcp-reference-20261106', 'claimed-docs',
         'https://www.undermind.ai/mcp/reference',
         ['There is no separate API-key or service-account',
          'Access tokens expire after one hour.'],
         'Undermind\'s only developer surface is its MCP server (https://mcp.undermind.ai/mcp, Streamable HTTP, OAuth authorization code flow with PKCE; "Access tokens expire after one hour.", "Connections expire after 90 days without a successful token refresh."). The vendor states the access model directly: "There is no separate API-key or service-account access model for MCP" and connections are user-scoped ("Every request runs as a specific Undermind user"). There is no REST API, no OpenAPI document, no API reference or runner, no test environment, and no versioning or changelog surface (openapi.json, /docs, /api, /developers all answer 404; docs.undermind.ai does not resolve; the sitemap lists seven pages, none developer docs).'),
    ],
    ('ai-video', 'kling'): [
        # kling.ai HTML routes are a soft-200 SPA shell; the served doc content lives in
        # CDN JS chunks, which these rows cite directly. A rotated chunk hash fails the
        # verify and forces re-derivation (fail-closed by construction).
        ('kling-api-updates-20261106', 'claimed-docs',
         'https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/en-Ce9pS80e.js',
         ['API Updates',
          'The legacy API will continue to be available with no current plans for deprecation.'],
         'Kling\'s developer docs (rendered at kling.ai/document-api/updates/api; content served from this CDN chunk because the HTML routes are an SPA shell) carry a dated API changelog with a continuation commitment ("The legacy API will continue to be available with no current plans for deprecation."), dated discontinuation notices ("Notice: magic_match_tree will be discontinued on July 3rd, 2026"), and model-version parameters ("Add model_name parameter to distinguish model versions, default kling-v2-6") over /v1 endpoint paths. Caveat: changelog practice with one continuation sentence; no standalone versioning or deprecation-policy document.'),
        ('kling-api-guide-20261106', 'claimed-docs',
         'https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/en-BQh_F0Fs.js',
         ['Resource Package Purchase', 'api-singapore.klingai.com'],
         'The API quickstart runs purchase-first against production: "Step 2: Resource Package Purchase & Balance Top-Up" then "Call the API Service" at the production "API Domain: https://api-singapore.klingai.com". None of the 239 documented pages mention a sandbox, trial, or test environment; the reference renders endpoints from bundled JS with static Bash/Python/Java samples (the doc renderer contains no try/run strings) and publishes no OpenAPI artifact (kling.ai/openapi.json serves the application shell).'),
    ],
    ('ai-video', 'luma'): [
        ('luma-openapi-md-20261106', 'claimed-docs',
         'https://docs.lumalabs.ai/reference/creategeneration.md',
         ['# OpenAPI definition', '"title": "Dream Machine API",'],
         'Luma\'s legacy Dream Machine API reference publishes per-endpoint OpenAPI 3.1.0 definitions in the markdown mirror of every reference page (each .md carries an "# OpenAPI definition" block with the operation\'s full JSON), indexed by the docs llms.txt ("# Luma APIs Documentation"). Caveats: no standalone downloadable spec file exists on either docs generation (openapi.json and openapi.yaml answer 404 on both hosts, replayed fail-closed), and the vendor banners this generation as legacy: "For current API guides and reference, visit the Luma Agents API documentation."'),
        ('luma-tryit-20261106', 'claimed-docs',
         'https://docs.lumalabs.ai/reference/creategeneration',
         ['"tryIt":"Try It"', '"url":"https://api.lumalabs.ai/dream-machine/v1"'],
         'The legacy ReadMe-hosted reference runs the "Try It!" request panel against https://api.lumalabs.ai/dream-machine/v1. Caveat: the current Luma Agents API docs (docs.agents.lumalabs.ai) are a static Starlight reference with code samples, "Copy Markdown", and assistant-open links but no runner; the only runnable try-it is on the legacy-generation docs.'),
        # Review scoping row (PR #691 second round): what Modify Video actually is.
        ('luma-modify-video-20261106', 'claimed-docs',
         'https://docs.lumalabs.ai/docs/modify-video.md',
         ['The output adheres very closely to the source video. This is ideal for subtle enhancements, minor retexturing, or applying a light stylistic filter without drastically altering the original content.',
          'Preserve full-body motion and facial performance, including choreography, lip sync, and nuanced expression'],
         'Scope of Modify Video: edits are controlled by global adherence modes rather than region selection - "Adhere - The output adheres very closely to the source video. This is ideal for subtle enhancements, minor retexturing, or applying a light stylistic filter without drastically altering the original content.", "Flex - ... maintaining recognizable elements", "Reimagine - ... adheres much more loosely", and the feature can "Preserve full-body motion and facial performance, including choreography, lip sync, and nuanced expression". No masking, region selection, or guarantee that untouched areas stay intact is documented.'),
        ('luma-no-sandbox-20261106', 'claimed-docs',
         'https://docs.agents.lumalabs.ai/guides/faq/index.md',
         ['There is no staging or sandbox environment. Use a test key and small generations to experiment.'],
         'Counter-check: the current API FAQ answers the sandbox question directly: "There is no staging or sandbox environment. Use a test key and small generations to experiment." - where a "test key" is a named production key (keys can be named "e.g. `production`, `staging`" and "Multiple keys belonging to the same client share quota") and "Is there a free tier?" is answered "No. The API is Pay-as-you-go from the first image, with no minimum spend or contract."'),
        # Re-derived 2026-11-10 after live drift (see UPDATES below): the FAQ dropped
        # the committed-window sentence and a dated changelog page appeared.
        ('luma-versioning-20261106', 'claimed-docs',
         'https://docs.agents.lumalabs.ai/guides/changelog/index.md',
         ['Breaking changes are announced here before they ship.',
          'It reports the version that answered; you cannot send it to choose a version'],
         'The Luma Agents API publishes a dated API changelog ("Changes to the `/v1` API that you can see as a caller, newest first... Breaking changes are announced here before they ship.", entries through 2026-11-09) over the versioned /v1 base, with every response carrying an X-API-Version header (currently 2026-04-01; "It reports the version that answered; you cannot send it to choose a version"). The legacy-model migration guide keeps per-account notice periods ("If you received a deprecation notice, use the retirement date in that message as the cutoff for your account. Legacy requests will continue to work during the notice period."). Caveat: the FAQ\'s earlier committed-deprecation-window sentence ("the previous version remains available during a deprecation window") was removed between 2026-11-06 and 2026-11-10; the current commitment is pre-announcement in the changelog plus the migration-guide notice periods.'),
    ],
    ('ai-video', 'pika'): [
        ('pika-openapi-20261106', 'claimed-docs',
         'https://dev.pika.art/openapi.json',
         ['{"openapi":"3.1.0","info":{"title":"Pika API"',
          '"servers":[{"url":"https://api.dev.pika.art"'],
         'Pika\'s vendor-owned developer platform (dev.pika.art; pika.art/api redirects there) publishes a downloadable OpenAPI 3.1.0 document ("Pika API", server https://api.dev.pika.art), linked as rel="service-desc", plus llms.txt, per-operation machine-readable spec pages (/llms/{vendor}/{model}/{function}), and a keyless live catalog endpoint (192 operations). Scope caveat verbatim: the API is an aggregator - "Generate video, image, and audio with hosted models." - with 173 /v1/media/{vendor}/{model}/{function} paths across multiple providers, not a Pika-model-only API.'),
        ('pika-playgrounds-20261106', 'claimed-docs',
         'https://dev.pika.art/models/bytedance/seedance-2.0-fast/image-to-video/playground',
         ['Seedance 2.0 Fast Playground | Pika API'],
         'The platform hosts per-model playgrounds (826 playground links from the model catalog; "Browse the human-readable model catalog and playgrounds."). Caveats: the playgrounds run the model with the caller\'s own key against production at catalog prices, and the written reference pages are static markdown; there is no try-it console attached to an endpoint reference.'),
        ('pika-no-sandbox-20261106', 'claimed-docs',
         'https://dev.pika.art/llms.txt',
         ['There is no free generation tier and no separate test environment. Every generation runs against production at the price the catalog quotes, so price a request before running it.',
          'the closest thing to a sandbox'],
         'Counter-check: the vendor states it directly: "There is no free generation tier and no separate test environment. Every generation runs against production at the price the catalog quotes, so price a request before running it." What is "Free to call, and the closest thing to a sandbox" is the keyless public catalog plus never-charged quote/balance/spend reads. The corpus also carries no versioning, deprecation, or changelog text (operation pages carry a "Status: stable" lifecycle field; /changelog and /docs answer 404, replayed fail-closed; the spec flags zero operations deprecated).'),
    ],
    ('business-phone', 'aircall'): [
        ('aircall-postman-20261106', 'claimed-docs',
         'https://developer.aircall.io/',
         ['"link_url":"https://www.postman.com/aircall-tech-partnerships-team/aircall-api/overview"'],
         'Aircall\'s machine-readable surface is its vendor-linked Postman collection (the developer portal links https://www.postman.com/aircall-tech-partnerships-team/aircall-api/overview from its homepage button and a dedicated Postman Collection docs page). No OpenAPI is published: the portal config disables the spec download ("show_openapi_download":"disabled", OpenAPI privacy "admin") and /openapi.json answers 404 (replayed fail-closed). Caveat: the Postman workspace page itself serves a JS shell whose content cannot be body-verified (a control fetch of a nonsense workspace failed with curl error 35), so the claim rests on the vendor\'s own live link - the unit-postman class.'),
        ('aircall-api-reference-20261106', 'claimed-docs',
         'https://developers.aircall.io/api-references',
         ['Aircall APIs and Webhooks are versioned to allow for continuous evolution and improvement while maintaining backward compatibility for existing integrations.'],
         'The API reference (a vendor-hosted static single page; zero try-it markup, two curl samples) documents URL-based versioning: "Aircall APIs and Webhooks are versioned to allow for continuous evolution and improvement while maintaining backward compatibility for existing integrations. API versions are indicated in the URL path." (v1 and v2 endpoints; webhook event names suffixed "v2"), with an Announcements table carrying a Deprecation/Last Change Date column ("Please refer to this section for announcements related to deprecation or changes") and a dated changelog section recording removed endpoints. Caveats: developers.aircall.io soft-200s unknown paths (this row is content-verified) and no committed notice window is stated.'),
        ('aircall-trial-account-20261106', 'claimed-docs',
         'https://developer.aircall.io/docs/launch-process.md',
         ["We'll create a trial developer account for you to build and test your integration against. A few things to know:",
          'The account is valid for 4 months and can be extended as needed as long as you remain in the program'],
         'Aircall provisions test access for approved partners: "We\'ll create a trial developer account for you to build and test your integration against", valid for four months and extendable in the program, with two OAuth applications ("one for production and one for development"). Gating verbatim: "Make sure you\'ve been approved as an Aircall Technology Partner before moving forward." The partner marketing promises "dedicated support, developer sandboxes, and co-marketing opportunities". Caveats: vendor-provisioned and partner-gated, with no test base URL or test-key documentation (zero sandbox text in the API reference and docs index).'),
    ],
    ('business-phone', 'quo'): [
        ('quo-openapi-20261106', 'claimed-docs',
         'https://openphone-public-api-prod.s3.us-west-2.amazonaws.com/public/openphone-public-api-2026-03-30-prod.json',
         ['"openapi": "3.1.0"', '"title": "Quo Public API"'],
         'Quo (formerly OpenPhone; openphone.com 301-redirects to quo.com) publishes downloadable OpenAPI 3.1.0 documents for its Public API ("API for connecting with Quo.", production server https://api.quo.com): this dated-version document (2026-03-30) is linked from the served docs pages, a v1 document is linked from the docs llms.txt ("View the raw OpenAPI specification for API version v1"). Caveat: the files are served from an S3 bucket that keeps the pre-rebrand openphone name.'),
        ('quo-tryit-20261106', 'claimed-docs',
         'https://www.quo.com/docs/2026-03-30/calls/list-calls',
         ['data-testid="try-it-button"', 'aria-label="Try it"'],
         'The Mintlify-hosted API reference runs the "Try it" playground per endpoint, with llms.txt and .md mirrors of every page; the runner executes against the production API with a real key.'),
        # Review grounding row (PR #691 third round): summaries attach to the call
        # record itself.
        ('quo-call-summaries-20261106', 'claimed-docs',
         'https://www.quo.com/docs/mdx/api-reference/calls/get-a-summary-for-a-call.md',
         ['Retrieve a detailed summary of a specific call identified by its unique call ID'],
         'Quo attaches AI summaries to the call record: "Retrieve a detailed summary of a specific call identified by its unique call ID. This endpoint supports summaries for both regular calls and calls handled by Sona." A dedicated webhook triggers on call-summary events. Gate caveat verbatim: "Call summaries are only available on business and scale plans."'),
        ('quo-versioning-20261106', 'claimed-docs',
         'https://www.quo.com/docs/2026-03-30/versioning.md',
         ['Every version is a date. Every request declares which date it was built for:',
          'The header is **required on every request**, and there is no default version.',
          'No version disappears quietly.'],
         'Quo publishes an explicit date-based versioning policy: "Every version is a date. Every request declares which date it was built for" (Quo-Api-Version header, "required on every request, and there is no default version"), "A version is frozen the day it ships." with an enumerated breaking-change list, and a retirement commitment: "No version disappears quietly. If a version is ever scheduled for retirement, we\'ll announce it in the changelog with a migration window and a precise list of what changed." The previous URL-versioned v1 API "remains fully supported and is not going anywhere without the notice described above", and the dated changelog carries current entries.'),
    ],
    ('card-issuing', 'pomelo'): [
        ('pomelo-stage-20261106', 'claimed-docs',
         'https://developers.pomelo.la/api-reference/get-started/connection-methods',
         ['Nuestros dominios:', 'https://api-stage.pomelo.la'],
         'Pomelo documents a dedicated Stage environment alongside production: "Nuestros dominios: Stage: https://api-stage.pomelo.la / Produccion: https://api.pomelo.la", with parallel Stage hosts for private links (private-api-stage.pomelo.la) and mTLS (mtls-stage-api.pomelo.la) and separate IP tables. Caveats: the vendor\'s term is Stage (the word sandbox appears nowhere in the fetched docs) and access is provisioned through Pomelo\'s integration process rather than self-serve ("Prepararemos el ambiente de pruebas." in the homologation guide).'),
        ('pomelo-simulator-20261106', 'claimed-docs',
         'https://developers.pomelo.la/guides/solutions/processing/transacciones/transaction-simulator',
         ['Prueba casos de simulación sobre tarjetas reales sin afectar tu ambiente productivo.'],
         'The transaction simulator runs entirely in Stage: "Prueba casos de simulación sobre tarjetas reales sin afectar tu ambiente productivo." and "Las simulaciones NO impactan tu ambiente productivo ni generan movimientos reales en las cuentas de tus usuarios. Todas las ejecuciones ocurren en nuestro ambiente de Stage." (simulator UI at dashboard-stage.pomelo.la). Gating: available to all customers with "Al menos una tarjeta activa. Un endpoint de autorización configurado con nuestro equipo de integradores."'),
        ('pomelo-reference-20261106', 'claimed-docs',
         'https://developers.pomelo.la/api-reference',
         ['Push Provisioning (Deprecado)'],
         'Pomelo hosts a Spanish-first API reference (custom renderer) with language-tabbed static samples (cURL/JavaScript; zero Probar/Ejecutar/try-it controls), URL-versioned endpoint paths (/cards/v1, users v2, core-credit-v2) and a deprecated endpoint group labeled "Push Provisioning (Deprecado)". Caveats: no downloadable spec artifact exists (openapi.json and swagger.json answer 404, replayed fail-closed; schema data is embedded in the app payload; an MCP page exists) and no versioning policy, deprecation window, or changelog page is published.'),
    ],
    ('code-hosting', 'gitea'): [
        ('gitea-openapi-20261106', 'claimed-docs',
         'https://gitea.com/swagger.v1.json',
         ['"swagger": "2.0"', '"title": "Gitea API"', '"basePath": "/api/v1"'],
         'Gitea publishes machine-readable API descriptions built into every instance and live-verified on the vendor-run gitea.com: the Swagger 2.0 document at /swagger.v1.json (342 paths, basePath /api/v1) and an OpenAPI 3.0.3 document at /openapi3.v1.json. The docs state: "The OpenAPI document is at: https://gitea.your.host/swagger.v1.json".'),
        # Review grounding row (PR #691 third round): milestone due dates are a schema
        # fact in the already-cited machine spec.
        ('gitea-milestone-schema-20261106', 'claimed-docs',
         'https://gitea.com/swagger.v1.json',
         ['"Milestone": {', '"due_on"'],
         'The Gitea API\'s Milestone model carries a due date directly on the milestone: the spec\'s Milestone definition includes a due_on date-time property alongside title, description, state, and open/closed issue counts (and the milestone endpoints accept it on create and edit).'),
        ('gitea-swagger-ui-20261106', 'claimed-docs',
         'https://gitea.com/api/swagger',
         ['<title>Gitea API</title>',
          '<div id="swagger-ui" data-source="/openapi3.v1.json"></div>'],
         'Every Gitea instance ships an interactive Swagger UI reference at /api/swagger (mounted against the instance\'s own OpenAPI document, so try-it executes against the live instance API), enabled by default ("By default, ENABLE_SWAGGER is true") and live-verified on the vendor-run gitea.com.'),
        ('gitea-api-usage-20261106', 'claimed-docs',
         'https://docs.gitea.com/development/api-usage/',
         ['auto-generated by swagger and available on'],
         'The API usage guide documents the built-in reference ("API Reference guide is auto-generated by swagger and available on: https://gitea.your.host/api/swagger"), authentication, and pagination, with every example against the versioned /api/v1 base, and the docs site keeps per-release versions (29-dev back through 1.22). Caveats: no deprecation or backward-compatibility statement exists in the guide, the FAQ, or the per-release docs, and no vendor page documents a hosted test instance (try.gitea.io no longer resolves; demo.gitea.com is live but undocumented as a demo).'),
    ],
    ('compliance-screening', 'alloy'): [
        ('alloy-openapi-20261106', 'claimed-docs',
         'https://developer.alloy.com/public/openapi/alloy.yaml',
         ['{"openapi":"3.0.0","info":{"title":"Alloy API"',
          '"servers":[{"url":"https://sandbox.alloy.co/v1","description":"Sandbox endpoint"'],
         'Alloy serves its complete OpenAPI 3.0.0 document at the docs origin (servers sandbox.alloy.co/v1 and api.alloy.co/v1). Caveats: the file is publicly served but not UI-linked (project config disables the download button while keeping OpenAPI visibility public); the advertised machine-readable surface is the docs llms.txt ("For AI agents: the docs index is at https://developer.alloy.com/public/llms.txt") plus per-page .md mirrors carrying per-endpoint OpenAPI fragments.'),
        ('alloy-tryit-20261106', 'claimed-docs',
         'https://developer.alloy.com/public/reference/get_entities-entity-token-2',
         ['Try It!'],
         'The ReadMe-hosted API reference (134 endpoint pages, publicly browsable) runs the "Try It!" request panel with SDK snippets enabled; execution uses the caller\'s own keys against the live sandbox/production bases.'),
        ('alloy-sandbox-mode-20261106', 'claimed-docs',
         'https://developer.alloy.com/public/docs/sandbox-vs-production.md',
         ["Alloy's API offers two modes", 'alloy-sandbox: true'],
         'Alloy documents a Sandbox mode: "Alloy\'s API offers two modes: **Production (Live)** and **Sandbox**... Sandbox makes no vendor calls, so you can test your integration without incurring additional charges", selected by base URL (https://sandbox.alloy.co) or the alloy-sandbox: true header, with the same keys in both modes. Vendor caveat carried verbatim: "**It\'s important to understand that Alloy\'s Sandbox and Production API modes are *not* two separate environments.** They are per-request processing modes only - Alloy does not enforce a data boundary. Most records in Alloy, including Entities, live in a single shared data store for your account, regardless of the mode used to create or update them." Access is customer-gated (an Alloy account and keys).'),
        ('alloy-deprecations-20261106', 'claimed-docs',
         'https://developer.alloy.com/public/reference/llms.txt',
         ['This endpoint is deprecated in favor of the Events API using an event of type "bank_account_created".'],
         'Versioning is practiced: the servers pin /v1 and deprecated endpoints carry inline warning callouts with migration targets ("This endpoint is deprecated in favor of the Events API..."; "These endpoints are deprecated in favor of using Investigations."). Caveats: no standalone versioning or deprecation-policy page and no API changelog (/public/changelog answers 404, replayed fail-closed; the only changelog is the Web SDK\'s).'),
    ],
    ('compliance-screening', 'hummingbird'): [
        ('hummingbird-gated-docs-20261106', 'claimed-docs',
         'https://docs.hummingbird.co/password?redirect=%2F',
         ['This page is password-protected.', '<title>Hummingbird API</title>'],
         'Hummingbird\'s developer documentation exists as a ReadMe project titled "Hummingbird API" at docs.hummingbird.co, but the entire site is password-gated: every path, including the docs root, llms.txt, /reference, and /changelog, redirects to the password page ("This page is password-protected."), and the hummingbird-api.readme.io origin lands on the same gate. The marketing site links no developer docs (www.hummingbird.co/developers and /api answer 404, replayed fail-closed; the sitemap carries no api/developer URLs) and the apidocs/developers subdomains do not resolve. The only public versioning signal is the gate page\'s date-named docs version meta (2026-02-05). No public spec, reference, sandbox, or versioning documentation exists.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none at wave start).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace, ef4d42d8 precedent). The hardened rerun replay
# (PR #691 P2 fix) caught live drift in luma's FAQ: between 2026-11-06 and 2026-11-10
# the committed deprecation-window sentence was removed and a dated changelog page
# appeared. The row is re-derived to the current wording.
UPDATES = {
    ('ai-video', 'luma'): [
        ('luma-versioning-20261106',
         'https://docs.agents.lumalabs.ai/guides/changelog/index.md',
         ['Breaking changes are announced here before they ship.',
          'It reports the version that answered; you cannot send it to choose a version'],
         'The Luma Agents API publishes a dated API changelog ("Changes to the `/v1` API that you can see as a caller, newest first... Breaking changes are announced here before they ship.", entries through 2026-11-09) over the versioned /v1 base, with every response carrying an X-API-Version header (currently 2026-04-01; "It reports the version that answered; you cannot send it to choose a version"). The legacy-model migration guide keeps per-account notice periods ("If you received a deprecation notice, use the retirement date in that message as the cutoff for your account. Legacy requests will continue to work during the notice period."). Caveat: the FAQ\'s earlier committed-deprecation-window sentence ("the previous version remains available during a deprecation window") was removed between 2026-11-06 and 2026-11-10; the current commitment is pre-announcement in the changelog plus the migration-guide notice periods.'),
    ],
}

# Hand-recorded counter-check/context rows a scheduled refresh must not clobber.
PRESERVE_IDS: set = {
    'undermind-mcp-reference-20261106',
    'luma-no-sandbox-20261106',
    'pika-no-sandbox-20261106',
    'hummingbird-gated-docs-20261106',
}

# Fail-closed probe negatives (#502 convention).
NEGATIVE_CHECKS = {
    'luma-openapi-md-20261106': [
        'https://docs.lumalabs.ai/openapi.json',
        'https://docs.lumalabs.ai/openapi.yaml',
        'https://docs.agents.lumalabs.ai/openapi.json',
        'https://docs.agents.lumalabs.ai/openapi.yaml',
    ],
    'pika-no-sandbox-20261106': [
        'https://dev.pika.art/changelog',
        'https://dev.pika.art/docs',
    ],
    'aircall-postman-20261106': [
        'https://developer.aircall.io/openapi.json',
    ],
    'pomelo-reference-20261106': [
        'https://developers.pomelo.la/openapi.json',
        'https://developers.pomelo.la/swagger.json',
    ],
    'alloy-deprecations-20261106': [
        'https://developer.alloy.com/public/changelog',
    ],
    'hummingbird-gated-docs-20261106': [
        'https://www.hummingbird.co/developers',
        'https://www.hummingbird.co/api',
    ],
}

# Fail-closed recorded POST probes (none this wave).
POST_CHECKS: dict = {}

# Fail-closed TLS-mismatch checks (none this wave).
TLS_MISMATCH_CHECKS: dict = {}

_fetch_cache: dict = {}

# Courtesy pacing for hosts known to rate-limit bursts (the wave-8 fellow lesson;
# developer.aircall.io, another ReadMe host, rate-limited repeated replay runs on
# 2026-11-10).
HOST_DELAYS = {'developer.aircall.io': 20}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    delay = HOST_DELAYS.get(urlparse(url).netloc)
    if delay:
        time.sleep(delay)
    # --http1.1: tech.sevdesk.com fails HTTP/2 negotiation but serves HTTP/1.1 fine.
    r = subprocess.run(
        ['curl', '-sL', '--http1.1', '--max-time', '60', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=120)
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
        ['curl', '-s', '--http1.1', '--max-time', '45', '-A', UA, '-X', 'POST',
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
            # Markers replay on every run, including for rows already appended, so a
            # rerun re-verifies saved sources (rotated kling CDN chunks included) and
            # fails closed on drift rather than skipping silently.
            if markers:
                verify(url, markers)
            if iid in have:
                print(f'{iid}: already present, markers re-verified')
                continue
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
