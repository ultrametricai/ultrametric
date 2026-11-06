#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 5: the top twelve genuinely unrepaired
# products from the staleness ranking re-run against post-import main (113 gap-signature
# rows; waves 1-4 = PRs #623, #627, #630, #632). Roster: lovable, cline, sentry,
# 1password, bitwarden, stripe-identity, nitrokey, yubikey, windmill, kick, wave,
# consensus. Excluded from the top of the fresh ranking: iterm2 (still deferred, wave-2
# ledger) and orama/buzz/spline/working-copy, already repaired in waves 3-4 — their
# honest zero-citation nones still trip the scan's api-quality signature, a scan blind
# spot flagged to the maintainer in the wave ledger.
#
# Same fail-closed verification and plumbing as the wave-3/4 scripts, with two
# extensions: NEGATIVE_CHECKS entries may carry an expected-status set (a walled spec
# that answers 401 is asserted as exactly 401, not 404), and POST_CHECKS verify recorded
# POST probes (a GraphQL introspection response) fail-closed on every run.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave5.json:
#   - lovable api-sandbox: production base URL only; the Postman collection carries
#     canned example responses and the embed preview is a one-hour URL; per-key credit
#     limits and IP allowlists are controls on production calls, not a test environment.
#   - cline api-interactive-docs: the API pages are hand-written MDX with copyable curl
#     (no playground wiring at all); api-sandbox: Cloud Agents' per-session execution
#     sandbox is an agent-execution surface, not an API test environment, and the free
#     models tip is a cost lever; api-versioning-policy: only the /api/v1 path segment,
#     no commitments or changelog.
#   - sentry api-interactive-docs: endpoint pages are copyable curl plus response schema
#     ("Try it" zero occurrences).
#   - 1password api-sandbox: zero API-testing sandbox usage across the 2.6 MB docs
#     corpus (every "sandbox" hit is the OpenShell agent-sandboxing feature); the
#     self-hosted Connect server is deployment, not a vendor test environment.
#   - bitwarden api-sandbox: zero API-testing sandbox usage across the 2.8 MB help
#     corpus; the Vault Management API runs locally via `bw serve` and full self-hosting
#     exists, neither a vendor-provided test environment for the cloud Public API.
#   - stripe-identity api-interactive-docs: the API reference is copyable examples
#     ("Try it"/playground zero occurrences; Workbench lives in the Dashboard).
#   - yubikey api-machine-spec: the OTP validation protocol is a prose spec (appended as
#     context) with newline key-value responses; no OpenAPI anywhere
#     (developers.yubico.com/openapi.json 404; api.yubico.com/openapi.json 403);
#     api-interactive-docs: prose pages only (the live verify endpoint answers
#     status=MISSING_PARAMETER but no vendor runner exists).
#   - kick api-sandbox: the OpenAPI servers array carries only Production and tokens are
#     "like any other production credential"; the accountants' firm workspace is a
#     product workspace, not an API test environment; api-versioning-policy: /platform/v1
#     paths only, no changelog or commitments.
#   - wave api-interactive-docs / api-sandbox / api-versioning-policy: the entire
#     developer portal (developer.waveapps.com, a Zendesk help center) sits behind a
#     Cloudflare challenge (403 on every path, including the help-center JSON API);
#     www.waveapps.com carries no developer links and the GitHub org no schema repo.
#     Per the gusto bot-wall precedent, capabilities documented only on walled pages
#     stay unrepaired; the one verifiable artifact is the recorded GraphQL introspection
#     probe below.
#   - consensus api-interactive-docs / api-sandbox / api-versioning-policy:
#     docs.consensus.app is Cloudflare-walled throughout; the reachable llms-full.txt
#     (appended as context) documents the REST/MCP surface, "stable, versioned JSON
#     endpoints", and an anonymous MCP evaluation tier that is rate-limited production
#     access, not a test environment. The vendor-advertised OpenAPI link is dead
#     (counter-check below).
#
# Reachability notes: developer.waveapps.com and docs.consensus.app are bot-walled (the
# research pass did not circumvent either; one bundled retry with a browser UA was
# denied by the permission classifier and not retried). docs.kick.co serves soft-200
# "Page Not Found" bodies for missing paths, so every kick URL is verified by body
# markers. llmconsensus.io — linked from consensus.app's own llms.txt as the OpenAPI
# spec host — currently fails TLS with a certificate for an unrelated host
# (odoo18.cyberpol.org); recorded as a counter-check and flagged as a safety finding.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> --product <id>
#   pnpm engine derive --category <arena>
# then the dependent generators, and the pre-audit over every upward flip BEFORE the
# first push — review-fix re-rolls included (the wave-4 closing-pass rule).
import datetime
import json
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

ITEMS = {
    ('vibe-coding', 'lovable'): [
        ('lovable-openapi-spec-20261106', 'claimed-docs',
         'https://api.lovable.dev/v1/openapi.yaml',
         ['title: Lovable API', 'openapi: 3.1.0'],
         'Lovable serves its full OpenAPI 3.1.0 document (info title "Lovable API") from the API host itself, including the Lovable-Version header parameter ("Stable API version to serve, as a YYYY-MM-DD date. Omit for the oldest supported stable version, currently 2026-09-11."). The docs reference pages render from the same spec.'),
        ('lovable-api-playground-20261106', 'claimed-docs',
         'https://docs.lovable.dev/api-reference/workspaces/list-workspaces',
         ['Try it'],
         'The Mintlify API reference runs the interactive playground: endpoint pages render a "Try it" runner (GET https://api.lovable.dev/v1/workspaces) with generated cURL samples carrying the Lovable-API-Key header. Executing requests needs a workspace API key, which requires a Business or Enterprise plan.'),
        ('lovable-api-versioning-20261106', 'claimed-docs',
         'https://docs.lovable.dev/api-reference/introduction.md',
         ['The stable API version to serve', '2026-09-11'],
         'The API is date-version pinned via the Lovable-Version header ("The stable API version to serve, as a YYYY-MM-DD date"), defaulting to the oldest supported stable version (currently 2026-09-11), with beta revisions enabled on top of a requested stable version and an explicit pin-to-control-upgrades rule. An API changelog page records the GA version.'),
        ('lovable-deprecation-policy-20261106', 'claimed-docs',
         'https://docs.lovable.dev/integrations/lovable-api.md',
         ['Lovable commits to a deprecation policy for the API, where deprecated endpoints keep working for a migration period and announce their sunset date.'],
         'The API FAQ states the stability contract: "The `/v1` surface is versioned and stable." and "Lovable commits to a deprecation policy for the API, where deprecated endpoints keep working for a migration period and announce their sunset date."'),
    ],
    ('ai-coding', 'cline'): [
        # Counter-check (preserved): the hosted gateway publishes no spec of its own; the
        # asserted statuses are enforced fail-closed (401s on the API host, 404 on docs).
        ('cline-spec-unpublished-20261106', 'probe',
         'https://docs.cline.bot/api/chat-completions.md',
         ['It follows the [OpenAI Chat Completions]'],
         'PROBE spec-publication check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave5.py): Cline\'s hosted gateway (api.cline.bot) documents its Chat Completions endpoint by reference to OpenAI\'s format ("It follows the [OpenAI Chat Completions] format") and publishes no machine-readable spec of its own: api.cline.bot/openapi.json and /api/v1/openapi.json answer 401 (unauthorized, no public spec served) and docs.cline.bot/openapi.json answers 404. The reference pages are hand-written MDX without playground wiring.'),
    ],
    ('observability', 'sentry'): [
        ('sentry-openapi-schema-20261106', 'github',
         'https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json',
         ['"openapi": "3.0.3"', 'Sentry Public API'],
         'The official getsentry/sentry-api-schema repository publishes the dereferenced OpenAPI 3.0.3 document for the "Sentry Public API" (info title "API Reference", version v0), covering the full /api/0/ surface.'),
        ('sentry-sandbox-demo-20261106', 'claimed-docs',
         'https://sandbox.sentry.io/',
         ['Sentry Sandbox'],
         'Sentry hosts a public sandbox at sandbox.sentry.io ("Interactive Sandbox... kick our proverbial tires"), an email-gated demo environment pre-populated with sample issue data and isolated from any customer\'s production data. It is a product-UI demo showroom; nothing documents it as an environment for testing API calls.'),
        ('sentry-api-versioning-20261106', 'claimed-docs',
         'https://docs.sentry.io/api/',
         ["The current version of the Sentry"],
         'The API docs\' Versioning section: "The current version of the Sentry\'s web API is considered v0. Our public endpoints are generally stable, but beta endpoints are subject to change."'),
        ('sentry-deprecation-policy-20261106', 'claimed-docs',
         'https://develop.sentry.dev/backend/api/deprecation-policy/',
         ['API Deprecation Policy'],
         'Sentry publishes a dedicated API Deprecation Policy on its developer-documentation site (develop.sentry.dev, getsentry-owned), governing how public endpoints are deprecated. The page is engineering-facing documentation of the policy rather than a customer-facing contract page, and the public docs add that the v0 API "is still under development".'),
    ],
    ('authenticator-apps', '1password'): [
        ('1password-events-openapi-20261106', 'claimed-docs',
         'https://i.1password.com/media/1password-events-reporting/1password-events-api_1.4.1.yaml',
         ['openapi: 3.0.0', 'title: Events API'],
         '1Password publishes the Events API as a downloadable OpenAPI 3.0.0 document (semver 1.4.1), linked from the Events API reference ("This API reference documents the latest version of the 1Password Events API specifications (1.4.1)"), which renders from it.'),
        ('1password-connect-openapi-20261106', 'claimed-docs',
         'https://i.1password.com/media/1password-connect/1password-connect-api_1.8.1.yaml',
         ['title: 1Password Connect'],
         'The 1Password Connect Server API likewise ships a downloadable OpenAPI document (3.0.2, version 1.8.1), linked from the Connect API reference as the specification file. The specs cover the Events and Connect surfaces; the Service Accounts/CLI/SDK surfaces are CLI/SDK-native without specs.'),
        ('1password-api-playground-20261106', 'claimed-docs',
         'https://developer.1password.com/docs/events-api/reference/audit-events/',
         ['Try it'],
         'The Events API and Connect API references run the Mintlify interactive playground ("Try it" renders next to the endpoint, e.g. POST /api/v2/auditevents, with generated cURL samples). The CLI/SDK docs are prose and code only.'),
        ('1password-events-versioning-20261106', 'claimed-docs',
         'https://www.1password.dev/events-api/endpoints.md',
         ['V1 endpoints remain fully supported for existing integrations'],
         'The Events API documents URL-path versioning with a continued-support commitment: "The Events API supports both V1 and V2 endpoints... V1 endpoints remain fully supported for existing integrations that don\'t require the additional MSP account and user type information", alongside a dedicated Events API changelog and a semver\'d spec. This is an Events-API-specific policy; no account-wide or Connect-API deprecation policy page exists.'),
    ],
    ('authenticator-apps', 'bitwarden'): [
        ('bitwarden-public-api-oas-20261106', 'claimed-docs',
         'https://bitwarden.com/help/public-api.md',
         ['The Public API is compatible with the OpenAPI Specification (OAS3) and publishes a compliant',
          'Explore the OpenAPI Specification using the Swagger UI:'],
         'Bitwarden\'s Public (Organization) API "is compatible with the OpenAPI Specification (OAS3) and publishes a compliant swagger.json definition file", with the vendor directive "Explore the OpenAPI Specification using the Swagger UI:" listing the cloud URL (bitwarden.com/help/api/) and the self-hosted URL (your.domain.com/api/docs/). The Vault Management API page embeds its own OpenAPI document for the CLI\'s `bw serve` local server.'),
        ('bitwarden-swagger-ui-20261106', 'claimed-docs',
         'https://bitwarden.com/help/api/',
         ['"component":"help-swagger-api"', 'Bitwarden Public API'],
         'bitwarden.com/help/api/ vendor-hosts Swagger UI over the Public API\'s embedded OpenAPI 3.0.4 document (info title "Bitwarden Public API"); the Vault Management API page hosts a parallel Swagger UI. The UI mounts client-side, so the runnable console renders in-browser rather than in the served HTML; the former standalone host api.bitwarden.com/docs is retired (404).'),
        ('bitwarden-api-compat-policy-20261106', 'claimed-docs',
         'https://bitwarden.com/help/bitwarden-software-release-support.md',
         ['we aim to provide backwards compatibility to the API indefinitely through semantic versioning'],
         'The Software Release Support page carries an explicit Bitwarden API policy: "As a practice, we aim to provide backwards compatibility to the API indefinitely through semantic versioning. However, if we add enhancements that make it difficult or impossible to maintain backwards compatibility to all prior versions, we will indicate that by incrementing the major version number." There is no per-request version pinning (no version header or URL version); the policy is release-cycle level.'),
    ],
    ('identity-verification', 'stripe-identity'): [
        ('stripe-identity-openapi-repo-20261106', 'github',
         'https://raw.githubusercontent.com/stripe/openapi/master/README.md',
         ["# Stripe's OpenAPI Specification",
          "This repository contains [OpenAPI specifications][openapi] for Stripe's API."],
         'Stripe publishes its machine-readable API specification in the official stripe/openapi repository (latest GA plus preview variants, JSON and YAML). The platform-wide spec covers the Identity surface; there is no Identity-only spec file.'),
        ('stripe-identity-spec-resources-20261106', 'github',
         'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
         ['identity.verification_session'],
         'The published spec3.json itself carries the Identity resources (identity.verification_session and related schemas), so the Identity API is machine-readable through the platform spec.'),
        ('stripe-identity-sandboxes-20261106', 'claimed-docs',
         'https://docs.stripe.com/sandboxes.md',
         ['A sandbox is an isolated test environment.'],
         '"A sandbox is an isolated test environment. You can use your sandbox to test Stripe functionality in your account, and experiment with new features without affecting your live integration", with sandbox-to-sandbox isolation ("Changes made in one sandbox don’t interfere with changes in another"). The platform sandbox covers Identity like other products.'),
        ('stripe-identity-test-flow-20261106', 'claimed-docs',
         'https://docs.stripe.com/identity/verify-identity-documents.md?platform=web&type=modal',
         ['Submit the session by selecting a predefined test case.'],
         'Identity documents its own test-mode flow: in testing, "Submit the session by selecting a predefined test case" (including failure cases such as declining consent or refusing camera permissions), with results reviewable at dashboard.stripe.com/test/identity/verification-sessions. There is no standalone Identity testing page; the flows live inside the integration guide.'),
        ('stripe-identity-versioning-20261106', 'claimed-docs',
         'https://docs.stripe.com/api/versioning.md',
         ['we release new API versions monthly with no breaking changes', 'Stripe-Version'],
         'Stripe\'s dated API versioning governs Identity endpoints like the rest of the platform: "we release new API versions monthly with no breaking changes. Twice a year, we issue a new major release", with per-request pinning via the Stripe-Version header and an upgrade guide plus dated changelog.'),
    ],
    ('security-keys', 'nitrokey'): [
        ('nitrokey-nethsm-openapi-20261106', 'claimed-docs',
         'https://nethsmdemo.nitrokey.com/api_docs/nethsm-api.yaml',
         ['openapi: 3.0.0', 'title: NetHSM'],
         'Nitrokey\'s NetHSM exposes a REST API described by a downloadable OpenAPI 3.0.0 document (info title "NetHSM", URL-versioned servers /api/v1), served from the vendor\'s public demo instance. This is the NetHSM appliance API; the Nitrokey USB keys have local protocols and no REST API.'),
        ('nitrokey-nethsm-swagger-20261106', 'claimed-docs',
         'https://nethsmdemo.nitrokey.com/api_docs/index.html',
         ['Swagger UI'],
         'The NetHSM demo instance vendor-hosts Swagger UI over the live spec, and docs.nitrokey.com deep-links individual operations into it as "API documentation" (e.g. from the operation guide). Scope: NetHSM only.'),
        ('nitrokey-nethsm-test-image-20261106', 'claimed-docs',
         'https://docs.nitrokey.com/nethsm/container/test-image.html',
         ['The test image is designed for testing and development purposes.',
          'Do not use the test image under any circumstances for production data and use cases.'],
         'NetHSM documents a dedicated test path: "The test image is designed for testing and development purposes" (docker.io/nitrokey/nethsm:testing) with the hard rule "Do not use the test image under any circumstances for production data and use cases." A public demo instance (nethsmdemo.nitrokey.com) also answers the API live; no demo credentials are published in the docs.'),
        ('nitrokey-nethsm-releases-20261106', 'github',
         'https://raw.githubusercontent.com/Nitrokey/nethsm/main/CHANGES.md',
         ['# 5.1 (2026-10-23)'],
         'The NetHSM API is URL-versioned (servers /api/{version}, pinned to v1) and the official Nitrokey/nethsm repository publishes dated release notes per firmware version. There is no prose versioning or deprecation policy document.'),
    ],
    ('security-keys', 'yubikey'): [
        ('yubikey-otp-protocol-20261106', 'claimed-docs',
         'https://developers.yubico.com/OTP/Specifications/OTP_validation_protocol.html',
         ['Validation Protocol Version 2.0', 'All requests are HTTP GET requests.'],
         'Yubico documents the YubiCloud OTP validation API as a prose protocol specification ("Validation Protocol Version 2.0... All requests are HTTP GET requests", endpoint https://api.yubico.com/wsapi/2.0/verify, newline-delimited key-value responses). No machine-readable spec exists for any Yubico API (openapi paths 404/403), and the reference pages carry no runner.'),
        ('yubikey-webauthn-demo-20261106', 'claimed-docs',
         'https://developers.yubico.com/WebAuthn/WebAuthn_Walk-Through.html',
         ['https://demo.yubico.com'],
         'Yubico\'s WebAuthn walk-through directs developers to its hosted demo site ("If you are new to WebAuthn, we recommend you check out https://demo.yubico.com/webauthn-technical/registration") and documents a local development environment setup. demo.yubico.com is a browser demo for registering and testing keys, not an API sandbox with test credentials; YubiCloud OTP offers only free production Client IDs.'),
        ('yubikey-otp-version-history-20261106', 'claimed-docs',
         'https://developers.yubico.com/OTP/Specifications/OTP_validation_protocol.html',
         ['Changes since version 1.1',
          'version 2.0 is not backwards compatible with version 1.1 or version 1.0'],
         'The OTP validation protocol is URL-versioned (/wsapi/2.0/verify) and its spec carries an explicit version changelog: "version 2.0 is not backwards compatible with version 1.1 or version 1.0. However, because version 2.0 use a different URL than version 1.x, the server may support both version 1.x and version 2.0 clients at the same time." A per-protocol version history with a coexistence statement; no portal-wide versioning or deprecation policy exists.'),
    ],
    ('workflow-automation', 'windmill'): [
        ('windmill-openapi-cloud-20261106', 'claimed-docs',
         'https://app.windmill.dev/api/openapi.json',
         ['"title": "Windmill API"'],
         'Windmill\'s cloud instance serves its OpenAPI 3.0.3 document live at /api/openapi.json (info title "Windmill API"), and the vendor llms.txt names the hosted reference canonical. The deployed copy can trail the source spec by some releases.'),
        ('windmill-openapi-source-20261106', 'github',
         'https://raw.githubusercontent.com/windmill-labs/windmill/main/backend/windmill-api/openapi.yaml',
         ['title: Windmill API'],
         'The source-of-truth spec lives in the official windmill-labs/windmill repository (backend/windmill-api/openapi.yaml), versioned with each release.'),
        ('windmill-scalar-reference-20261106', 'claimed-docs',
         'https://app.windmill.dev/openapi.html',
         ['api-reference'],
         'Windmill vendor-hosts a Scalar API Reference at app.windmill.dev/openapi.html rendering the live spec (Scalar ships a built-in request client; the page mounts client-side). The vendor llms.txt points to it: "OpenAPI: https://app.windmill.dev/openapi.html".'),
        ('windmill-selfhost-dev-20261106', 'claimed-docs',
         'https://www.windmill.dev/docs/advanced/self_host.md',
         ['Self-host Windmill on your own infrastructure.'],
         'Windmill is open-source and self-hostable ("Self-host Windmill on your own infrastructure", single-instance Docker Compose documented), and local development against self-hosted or cloud workspaces is documented. There is no separate hosted sandbox environment; the self-hosted/local instance fills that role.'),
        ('windmill-release-lifecycle-20261106', 'claimed-docs',
         'https://www.windmill.dev/docs/enterprise/release_lifecycle.md',
         ['Windmill follows semantic versioning on one `v1.x` line.',
          'Every release is backward compatible and contains no breaking changes.',
          'Windmill gives 12 months of advance notice before any end of life.'],
         'Windmill publishes an explicit release lifecycle: "Windmill follows semantic versioning on one `v1.x` line. Every release is backward compatible and contains no breaking changes", with 24-month major-version support and "12 months of advance notice before any end of life", plus a dated changelog. The OpenAPI spec version tracks the release version, so the policy covers the API.'),
    ],
    ('accounting', 'kick'): [
        ('kick-platform-api-spec-20261106', 'claimed-docs',
         'https://docs.kick.co/api/api-reference/workspaces.md',
         ['{"openapi":"3.0.2","info":{"title":"Kick Platform API","version":"v1"}'],
         'Kick documents a Platform API whose reference pages embed complete per-operation OpenAPI 3.0.2 documents (info title "Kick Platform API", server https://use.kick.co/api, operations like workspaces.list). The spec is published as per-operation fragments inside the GitBook pages rather than one downloadable file, and the API is access-gated: "The Platform API is not yet publicly available. Access is enabled per organization by the Kick team."'),
        ('kick-api-test-it-20261106', 'claimed-docs',
         'https://docs.kick.co/api/api-reference/workspaces',
         ['Test it'],
         'The API reference renders GitBook\'s OpenAPI explorer with a "Test it" runner per operation (Bearer-token requests against use.kick.co). Running real calls requires an organization token, and the API is gated to enabled organizations.'),
    ],
    ('accounting', 'wave'): [
        # Recorded POST probe (preserved): the developer portal is Cloudflare-walled
        # throughout, so the live GraphQL endpoint is the one verifiable artifact.
        # POST_CHECKS re-runs the introspection query fail-closed on every script run.
        ('wave-graphql-introspection-20261106', 'probe',
         'https://gql.waveapps.com/graphql/public',
         [],
         'PROBE GraphQL endpoint check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave5.py): POST {"query":"{ __schema { queryType { name } } }"} to https://gql.waveapps.com/graphql/public answers HTTP 200 {"data":{"__schema":{"queryType":{"name":"Query"}}}} unauthenticated — a live Apollo GraphQL server with introspection enabled (GET answers the Apollo CSRF-prevention 400 naming apollo-require-preflight). Scope: one introspection query; no full SDL was pulled, and no vendor framing can be cited because the entire developer portal (developer.waveapps.com) sits behind a Cloudflare challenge (403 on every path, including the help-center JSON API); www.waveapps.com carries no developer links. Documentation-dependent capabilities stay unrepaired per the bot-wall precedent.'),
    ],
    ('ai-research-agents', 'consensus'): [
        ('consensus-agent-surface-20261106', 'claimed-docs',
         'https://consensus.app/llms-full.txt',
         ['REST API and an MCP server expose the same retrieval and synthesis surface that powers the web app',
          'stable, versioned JSON endpoints'],
         'Consensus documents an agent/developer surface in its machine-readable corpus: a "REST API and an MCP server expose the same retrieval and synthesis surface that powers the web app" (MCP endpoint mcp.consensus.app/mcp; API keys via subscription), exposing "search, paper detail, synthesis, and the Consensus Meter as stable, versioned JSON endpoints with bearer-token authentication". An "Anonymous Tier" of the MCP server is "Intended for trying the MCP server before signing up, not for production traffic" — rate-limited production access, not a test environment. The developer docs site (docs.consensus.app) is Cloudflare-walled throughout.'),
        # Counter-check (preserved): the vendor-advertised OpenAPI link is dead; the
        # not-200 state is enforced fail-closed (TLS failure today, status 0).
        ('consensus-spec-link-dead-20261106', 'probe',
         'https://consensus.app/llms.txt',
         ['[OpenAPI spec](https://llmconsensus.io/openapi.json)'],
         'PROBE spec-link check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave5.py): consensus.app\'s own llms.txt advertises "[OpenAPI spec](https://llmconsensus.io/openapi.json): machine-readable API contract", but the linked host fails TLS with a certificate for an unrelated host (subjectAltName odoo18.cyberpol.org) — a lapsed or misrouted domain still linked from the vendor\'s machine-readable index. No reachable machine-readable API contract exists (consensus.app/openapi.json 403; docs.consensus.app walled).'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none at wave start).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace; none at wave start).
UPDATES: dict = {}

# Hand-recorded counter-check/probe rows a scheduled refresh must not clobber.
PRESERVE_IDS = {'cline-spec-unpublished-20261106', 'wave-graphql-introspection-20261106',
                'consensus-spec-link-dead-20261106'}

# Fail-closed probe negatives (the #502 convention). Entries are URLs expected to answer
# exactly 404, or (url, {expected statuses}) for asserted non-404 walls; any other
# status exits inconclusive and nothing is written.
NEGATIVE_CHECKS = {
    'cline-spec-unpublished-20261106': [
        ('https://api.cline.bot/openapi.json', {401}),
        ('https://api.cline.bot/api/v1/openapi.json', {401}),
        'https://docs.cline.bot/openapi.json',
    ],
    # llmconsensus.io must NOT serve a spec: today it fails TLS entirely (status 0); any
    # 200 means the link came back to life and the counter-check must be re-derived.
    'consensus-spec-link-dead-20261106': [
        ('https://llmconsensus.io/openapi.json', {0, 403, 404, 421, 526}),
    ],
}

# Fail-closed recorded POST probes: id -> (url, json payload, expected status, response
# markers). Re-run on every script invocation; any drift aborts with nothing written.
POST_CHECKS = {
    'wave-graphql-introspection-20261106': (
        'https://gql.waveapps.com/graphql/public',
        '{"query":"{ __schema { queryType { name } } }"}',
        200,
        ['"queryType":{"name":"Query"}'],
    ),
}

_fetch_cache: dict = {}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    r = subprocess.run(
        ['curl', '-sL', '--max-time', '45', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=90)
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


def verify_absent(checks):
    for entry in checks:
        url, expected = (entry, {404}) if isinstance(entry, str) else (entry[0], set(entry[1]))
        status, _ = fetch(url)
        if status not in expected:
            raise SystemExit(
                f'{url} answered {status}, expected one of {sorted(expected)}; the asserted state '
                'no longer holds - inconclusive, nothing written. Re-derive the counter-check.')


def verify_post(url, payload, expected_status, markers):
    r = subprocess.run(
        ['curl', '-s', '--max-time', '45', '-A', UA, '-X', 'POST',
         '-H', 'Content-Type: application/json', '-d', payload,
         '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=90)
    body, _, meta = r.stdout.rpartition('\n---META ')
    status = int(meta.strip() or 0)
    if status != expected_status:
        raise SystemExit(f'POST {url} answered {status}, expected {expected_status}; recorded probe '
                         'no longer reproduces - inconclusive, nothing written.')
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
