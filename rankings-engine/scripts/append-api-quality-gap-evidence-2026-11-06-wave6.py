#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 6: the top twelve rows from the
# corrected staleness ranking (the PR #636 signature fix landed; 97 gap rows on
# post-#636 main; waves 1-5 = PRs #623, #627, #630, #632, #634). Roster: pylon,
# better-auth, canny, formant, wise, airbyte, fivetran, datalab, ledgy, navan,
# meilisearch, elicit. iterm2 stays deferred (wave-2 ledger).
#
# Same fail-closed toolkit as the wave-5 script: marker verify, REMOVALS, UPDATES,
# PRESERVE_IDS, NEGATIVE_CHECKS (exact-status sets), POST_CHECKS, TLS_MISMATCH_CHECKS.
# Excerpts carry scope caveats verbatim.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave6.json:
#   - pylon api-sandbox: zero sandbox/test-mode hits across the docs index; the OpenAPI
#     servers array lists only the US and EU production hosts, and the docs' "Test it"
#     console targets them. api-versioning-policy: unversioned paths, spec version
#     1.0.0, no API changelog (the product changelog announces API additions without a
#     scheme or commitments).
#   - better-auth api-sandbox: the Test Utils plugin is vendor-documented local test
#     tooling for a test-only auth instance ("designed for test environments only") — a
#     self-hosted library's test setup, not a hosted sandbox.
#   - canny api-machine-spec / api-interactive-docs: the developer reference is a
#     hand-written single page with static curl examples (zero OpenAPI/Swagger/Postman
#     and zero runner occurrences). api-versioning-policy: in-situ v1 paths with a few
#     v2 list endpoints and exactly one "(deprecated)" alias; no scheme, changelog, or
#     commitments (the reference's "Changelog Entries" section is the API for Canny's
#     product-changelog feature, a false friend).
#   - formant api-sandbox: no sandbox/demo/staging surface anywhere in the docs index;
#     the Try It console runs against the live org API. api-versioning-policy: the only
#     versioning text covers the npm SDK packages; the HTTP API has /v1 paths and an
#     internal OAS version with no lifecycle policy.
#   - wise api-interactive-docs: the reference is static (zero runner occurrences; the
#     raw "interactive" hits are CSS variables); testing is directed to the Sandbox
#     environment and Simulation API instead of an in-docs runner.
#   - airbyte api-sandbox: no hosted sandbox or test tenant; the Try It console hits the
#     live Cloud API and self-hosted OSS is a deployment path, not a vendor test
#     environment.
#   - fivetran api-interactive-docs: the reference is static with copyable snippets and
#     explicitly defers request-trying to the downloadable Postman collections.
#     api-sandbox: the 14-day free trial is a trial; the single unauthenticated metadata
#     endpoint is not a sandbox; every "sandbox" hit in the docs index is a third-party
#     connector name.
#   - datalab api-sandbox: the free tier is a production usage allowance and
#     datalab.to/playground is a browser demo.
#   - ledgy api-machine-spec / api-interactive-docs / api-sandbox /
#     api-versioning-policy: the GraphQL API is real and documented (context row below)
#     but publishes no schema artifact or introspection guidance, no console, no test
#     company, and no versioning page; the closest lifecycle text is the legacy-API-key
#     deprecation note.
#   - navan api-interactive-docs / api-sandbox: the hand-rolled portal is static
#     curl/Node examples; production base URL only, partner-gated access, and the llms.txt
#     itself notes the MCP endpoint has "no local sandbox".
#   - meilisearch api-interactive-docs: the Mintlify reference runs the disabled
#     playground (preserved counter-check below); the Postman import page is external
#     tooling. api-sandbox: the Cloud 14-day trial is a production trial, the "Search
#     Playground" is a vendor demo, and a local instance is a deployment path.
#   - elicit api-sandbox: the spec's servers list only production; keys are
#     Pro-plan-gated and experimentation happens on metered production credits (the
#     spec's one "sandbox" mention is internal agent paths).
#
# Reachability notes: developer.navan.com serves its landing page with HTTP 200 for
# unknown paths (soft-200 shell), so every navan URL is content-verified;
# api-docs.usepylon.com and api./developers.ledgy.com do not resolve;
# specs.meilisearch.com is dead (the live spec is the docs-hosted asset); Formant's and
# Airbyte's ReadMe OAS downloads are admin-gated ("show_openapi_download":"disabled") —
# Formant's spec is published per-endpoint in the .md mirrors and Airbyte's canonical
# spec lives in the airbytehq GitHub org. Wise's old sandbox hosts
# (sandbox.transferwise.tech) are Sandbox V1, deprecated 2026-06-30 per the migration
# guide; the V2 hosts (wise-sandbox.com) are cited. No bot walls were hit.
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
    ('ai-support-agents', 'pylon'): [
        ('pylon-openapi-spec-20261106', 'claimed-docs',
         'https://api.usepylon.com/openapi.json',
         ['"openapi":"3.0.3"', '"title":"Pylon API."'],
         'Pylon publishes a complete OpenAPI 3.0.3 document at its API origin (info title "Pylon API.", 119 paths, US and EU server entries), downloadable as plain JSON with no auth wall. The GitBook docs render every endpoint page from this spec URL and embed the per-endpoint OpenAPI JSON in their markdown mirrors.'),
        ('pylon-api-test-it-20261106', 'claimed-docs',
         'https://docs.usepylon.com/pylon-docs/developer/api/api-reference/issues',
         ['Test it'],
         'The API reference renders GitBook\'s in-page "Test it" runner per endpoint, driven by the published spec. The runner requires the caller\'s own bearer token and the spec\'s only servers are the US/EU production APIs, so requests execute against production.'),
    ],
    ('auth-platforms', 'better-auth'): [
        ('better-auth-openapi-plugin-20261106', 'claimed-docs',
         'https://better-auth.com/docs/plugins/open-api.md',
         ['The Open API reference is generated using the [OpenAPI 3.1.1](https://swagger.io/specification/) specification',
          'auth.api.generateOpenAPISchema()'],
         'Better Auth\'s openAPI() plugin generates an OpenAPI 3.1.1 schema covering core and plugin endpoints, retrievable as JSON via auth.api.generateOpenAPISchema() or the /api/auth/open-api/generate-schema endpoint. The schema is produced by the integrator\'s own deployment (Better Auth is a self-hosted framework), not downloaded from the vendor, and the vendor marks the plugin "still in the early stages of development".'),
        ('better-auth-scalar-reference-20261106', 'claimed-docs',
         'https://better-auth.com/docs/plugins/open-api.md',
         ['Navigate to `/api/auth/reference` to view the Open API reference',
          'Try it out'],
         'The plugin serves a Scalar-rendered reference at /api/auth/reference where "You can test the endpoints by clicking on the `Try it out` button and providing the required parameters." This built-in interactive reference runs on the integrator\'s own server against their own auth instance; Better Auth hosts no public console.'),
        ('better-auth-release-changelog-20261106', 'claimed-docs',
         'https://www.better-auth.com/changelog',
         ['Every release shipped to Better Auth, straight from GitHub.'],
         'Better Auth maintains a vendor-hosted release changelog ("All changes, fixes, and updates. Every release shipped to Better Auth, straight from GitHub."), semver-tagged with "Action required" callouts on breaking entries, plus minor-version upgrade guides (e.g. 1.6 to 1.7, where "Most Better Auth 1.7 changes are additive").'),
        ('better-auth-versioned-docs-20261106', 'claimed-docs',
         'https://www.better-auth.com/llms.txt',
         ['Use the documentation version that matches the Better Auth version installed in the project.'],
         'The documentation is versioned per release line (v1.6, v1.7 latest, v1.8 beta), with the directive "Use the documentation version that matches the Better Auth version installed in the project." This is release and changelog discipline for a self-hosted framework; no standalone deprecation-window or support-policy document exists.'),
    ],
    ('product-feedback', 'canny'): [
        ('canny-staging-workspace-20261106', 'claimed-docs',
         'https://help.canny.io/en/articles/3889195-adding-a-workspace',
         ['we offer a free workspace for staging/sandbox purposes',
          'Each workspace is a completely separate instance of Canny.'],
         'Canny documents a staging environment: "For accounts on the Business plan, we offer a free workspace for staging/sandbox purposes", where "Each workspace is a completely separate instance of Canny" (own subdomain, boards, changelog, admin team). It is a general staging workspace rather than an API-specific test mode or test keys, plan-gated, and provisioned by contacting support ("You will have to reach out to Canny support in order to set that up"); the developer docs themselves carry no sandbox mention.'),
    ],
    ('robotics-platforms', 'formant'): [
        ('formant-endpoint-openapi-20261106', 'claimed-docs',
         'https://docs.formant.io/reference/devicecontrollergetupdatedagentversion.md',
         ['"openapi": "3.0.0"', '"title": "Formant admin-api"'],
         'Formant\'s ReadMe-hosted reference publishes machine-readable OpenAPI 3.0.0 definitions per endpoint: every endpoint page\'s markdown mirror embeds that operation\'s full OpenAPI JSON (info title "Formant admin-api", internal version 1.357.8, bearer-JWT security). The complete spec is not downloadable: the ReadMe OAS download is admin-gated and api.formant.io serves no spec paths, so the machine-readable surface exists endpoint-by-endpoint through the mirrors.'),
        ('formant-api-try-it-20261106', 'claimed-docs',
         'https://docs.formant.io/reference/devicecontrollergetupdatedagentversion',
         ['Try It!'],
         'The ReadMe reference ships the live "Try It!" console per endpoint ("Click Try It! to start a request and see the response here!") with multi-language snippets and a bearer-JWT credential field. The runner executes against the production api.formant.io host; no test environment exists to point it at.'),
    ],
    ('startup-banking', 'wise'): [
        ('wise-webhook-openapi-20261106', 'claimed-docs',
         'https://docs.wise.com/api-reference/legacy/webhook/tmp/generated/openapi.md',
         ['## Download OpenAPI description'],
         'Wise publishes a downloadable OpenAPI 3.1.0 document ("## Download OpenAPI description") for its Webhook Sender API (the legacy webhook subscription surface). It is the only published spec: the main Wise Platform API reference is generated from an internal schema with no public spec file, and the docs llms.txt carries exactly this one OpenAPI entry.'),
        ('wise-sandbox-environment-20261106', 'claimed-docs',
         'https://docs.wise.com/guides/developer/environments.md',
         ['Sandbox is the testing environment that developers can use to build and test the application',
          'Do not include real data in sandbox when building your integration'],
         'Wise documents a dedicated sandbox: "Sandbox is the testing environment that developers can use to build and test the application. This environment allows developers to make API requests without affecting the production environment", hosted at api.wise-sandbox.com (with an mTLS variant and a sandbox UI), paired with a Simulation API for driving money-movement and webhook test flows. "Sandbox is a test environment. Therefore, only test data should be included... Do not include real data in sandbox", and it "does not support real money transfers". The older sandbox.transferwise.tech hosts are Sandbox V1, deprecated 2026-06-30 per the migration guide.'),
        ('wise-calver-versioning-20261106', 'claimed-docs',
         'https://docs.wise.com/guides/developer/global-versioning.md',
         ['global, calendar-based versioning (CalVer)',
          'released on a quarterly basis',
          'Deprecation and sunset policy'],
         'Wise publishes a formal versioning policy: "Wise Platform uses global, calendar-based versioning (CalVer)", URL-based version selection (e.g. /2026Q3/...), versions "released on a quarterly basis", version types Latest/Active/Preview/Legacy, a dedicated deprecation-and-sunset section, and breaking vs non-breaking change definitions. The policy "does not currently apply to webhooks or sensitive card details endpoints", and the older v1/v2/v3 path-versioned endpoints are the still-supported Legacy type.'),
        ('wise-api-changelogs-20261106', 'claimed-docs',
         'https://docs.wise.com/changelog/changelog-2025.md',
         ['Changelog'],
         'Wise maintains yearly API changelogs (2023/2024/2025) with dated detail pages for specific changes, complementing the CalVer policy.'),
    ],
    ('data-pipelines', 'airbyte'): [
        ('airbyte-openapi-spec-20261106', 'github',
         'https://raw.githubusercontent.com/airbytehq/airbyte-platform/main/airbyte-api/server-api/src/main/openapi/api.yaml',
         ['title: airbyte-api',
          'Programmatically control Airbyte Cloud, OSS & Enterprise.'],
         'Airbyte\'s canonical public-API spec lives in the official airbytehq org (info title "airbyte-api": "Programmatically control Airbyte Cloud, OSS & Enterprise.", server https://api.airbyte.com/v1). The ReadMe reference\'s own OAS download is admin-gated, so the GitHub document is the published machine-readable spec; the newer Agent API separately self-serves its own OpenAPI document at its origin.'),
        ('airbyte-api-try-it-20261106', 'claimed-docs',
         'https://reference.airbyte.com/reference/listsources',
         ['Try It!'],
         'The ReadMe-hosted API reference ships the live "Try It!" console per endpoint ("Click Try It! to start a request and see the response here!") with multi-language snippets and a bearer credential field. The runner executes against the live api.airbyte.com with a real access token.'),
        ('airbyte-migration-guides-20261106', 'claimed-docs',
         'https://reference.airbyte.com/reference/migration-guides.md',
         ['Airbyte publishes migration guides to assist with any breaking changes to our API users.'],
         'Airbyte commits to migration guidance for API breaking changes: "Airbyte publishes migration guides to assist with any breaking changes to our API users." The API is URL-versioned at /v1.'),
        ('airbyte-deprecation-notice-20261106', 'claimed-docs',
         'https://reference.airbyte.com/reference/standalone-server-deprecation-and-migration-to-airbyte-server.md',
         ['We\u2019re deprecating the standalone Airbyte API server'],
         'Dated deprecation notices accompany the migration guides (e.g. "Published May 2, 2024": "We\'re deprecating the standalone Airbyte API server and moving the routes into the Airbyte server", live "as of v0.63.9"). There is no formal version-lifecycle or sunset-policy document; deprecations are announced per change.'),
    ],
    ('data-pipelines', 'fivetran'): [
        ('fivetran-openapi-page-20261106', 'claimed-docs',
         'https://fivetran.com/docs/developer-resources/rest-api/api-reference/open-api-definition.md',
         ['# OpenAPI Definition (V1)',
          'Download OpenAPI specification:'],
         'Fivetran publishes a dedicated "OpenAPI Definition (V1)" page with direct JSON and YAML downloads of the full REST API specification, from which the API reference is auto-generated. Only a V1 spec exists; there is no v2 document.'),
        ('fivetran-openapi-file-20261106', 'claimed-docs',
         'https://fivetran.com/assets-docs/openapi/file_v1.json',
         ['"openapi": "3.0.1"'],
         'The spec file itself downloads as OpenAPI 3.0.1 (info version "v1"), covering the /v1 REST API.'),
        ('fivetran-release-notes-20261106', 'claimed-docs',
         'https://fivetran.com/docs/developer-resources/rest-api/changelog.md',
         ['# Release Notes',
          'will no longer be supported as of May 1, 2025'],
         'The REST API publishes dated release notes recording changes and deprecations with sunset dates (e.g. "Using the raw format for certificate and fingerprint hashes in the request path-params is deprecated and will no longer be supported as of May 1, 2025"). The API is URL-path versioned under /v1; no standalone versioning or breaking-change policy page exists.'),
    ],
    ('document-extraction', 'datalab'): [
        ('datalab-openapi-spec-20261106', 'claimed-docs',
         'https://www.datalab.to/openapi.json',
         ['"openapi":"3.1.0"', '"title":"Datalab API"'],
         'Datalab serves its OpenAPI 3.1.0 document (info title "Datalab API") from its main domain, advertised in the docs llms.txt under an "## OpenAPI Specs" heading, with markdown mirrors of every reference page.'),
        ('datalab-api-playground-20261106', 'claimed-docs',
         'https://documentation.datalab.to/api-reference/extraction_schemas/list-extraction-schemas',
         ['"playground":{"display":"interactive"}', 'Try it'],
         'The Mintlify API reference runs the interactive playground ("playground":{"display":"interactive"}) with a "Try it" runner per endpoint. The playground is client-rendered and targets the live API with the user\'s key.'),
        ('datalab-version-policies-20261106', 'claimed-docs',
         'https://documentation.datalab.to/platform/versioning.md',
         ['# Version Policies',
          'we will not introduce breaking changes for top-level versions',
          'For any given API version, we will preserve'],
         'Datalab publishes a dedicated Version Policies page with explicit backwards-compatibility guarantees: "we will not introduce breaking changes for top-level versions" and "For any given API version, we will preserve: Existing input parameters, Existing output parameters", covering API, SDK, and on-prem container versioning with a linked changelog. Model-output changes are exempt, and version pinning is enterprise-only.'),
    ],
    ('equity-management', 'ledgy'): [
        ('ledgy-graphql-reference-20261106', 'claimed-docs',
         'https://docs.ledgy.com/',
         ['Ledgy\u2019s GraphQL API Reference',
          'https://app.ledgy.com/graphql'],
         'Ledgy documents a public GraphQL API ("Ledgy\'s GraphQL API Reference", endpoint https://app.ledgy.com/graphql, OAuth 2.0 service-account tokens) as a SpectaQL-generated static reference with inline curl examples. No schema artifact, SDL download, or introspection guidance is published; there is no console, no test company, and no versioning page — the closest lifecycle text is the legacy-API-key deprecation note ("Existing keys keep working").'),
    ],
    ('expense-management', 'navan'): [
        ('navan-developer-portal-20261106', 'claimed-docs',
         'https://developer.navan.com/llms.txt',
         ['# Navan Developer Portal', '**Navan Expense API**'],
         'Navan\'s developer portal publishes an llms.txt indexing its two surfaces: the "Navan Expense API — OAuth 2.0 client-credentials REST API for high-volume and scheduled partner integrations" and the Navan MCP server (mcp.navan.com/mcp, with a full markdown guide mirror). No OpenAPI or Swagger document exists (the spec-style paths serve the portal\'s landing shell), the reference is static curl/Node examples with production as the only base URL, and access is partner-gated.'),
        ('navan-api-versioning-20261106', 'claimed-docs',
         'https://developer.navan.com/api/',
         ['The API uses URL path versioning. The current version is',
          'Breaking changes will introduce a new API version.'],
         'The Expense API documents its versioning posture: "The API uses URL path versioning. The current version is v1", "Breaking changes will introduce a new API version. Non-breaking updates (new optional fields, filters, or endpoints) can be added to current versions", with dated release notes that include a concrete field deprecation and replacement. No sunset timelines or formal deprecation windows are stated.'),
    ],
    ('search-infra', 'meilisearch'): [
        ('meilisearch-openapi-spec-20261106', 'claimed-docs',
         'https://www.meilisearch.com/docs/assets/release-assets/meilisearch-openapi.json',
         ['"openapi": "3.1.0"', '"title": "meilisearch"'],
         'Meilisearch publishes its engine\'s OpenAPI 3.1.0 document on the docs site (listed under "## OpenAPI Specs" in the docs llms.txt, with a Mintlify variant), versioned with the engine release. The spec targets the engine\'s REST API wherever it runs (default server entry is a local instance), and a docs page covers importing it into Postman.'),
        # Counter-check (preserved): the reference ships the disabled runner.
        ('meilisearch-playground-disabled-20261106', 'probe',
         'https://www.meilisearch.com/docs/reference/api/documents',
         ['"playground":{"display":"simple"'],
         'PROBE docs playground check (recorded 2026-11-06, rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave6.py): the Meilisearch API reference pages configure the Mintlify playground as "playground":{"display":"simple"} — multi-language static code samples with the interactive in-page runner disabled; no "Try it" control renders. The Postman-import page is external tooling.'),
        ('meilisearch-versioning-policy-20261106', 'claimed-docs',
         'https://www.meilisearch.com/docs/resources/help/versioning.md',
         ['# Versioning policy',
          'Semantic Versioning 2.0.0',
          'Meilisearch only maintains the latest engine release. Currently, there are no EOL (End of Life) or LTS (Long-Term Support) policies.'],
         'Meilisearch publishes a dedicated versioning policy: SemVer 2.0.0 on the engine release line (4-6 minor releases a year), with the explicit statement "Meilisearch only maintains the latest engine release. Currently, there are no EOL (End of Life) or LTS (Long-Term Support) policies." SDK versions are decoupled from engine versions and the docs track the latest release only.'),
        ('meilisearch-experimental-pathway-20261106', 'claimed-docs',
         'https://www.meilisearch.com/docs/resources/help/experimental_features_overview.md',
         ["An experimental feature's API can change significantly and become incompatible between releases."],
         'The experimental-features process documents the stability pathway into the stable API: "An experimental feature\'s API can change significantly and become incompatible between releases", with activation via --experimental launch flags or the /experimental-features route before features graduate.'),
    ],
    ('ai-research-agents', 'elicit'): [
        ('elicit-openapi-spec-20261106', 'claimed-docs',
         'https://docs.elicit.com/openapi.json',
         ['"openapi":"3.1.0"', '"title":"Elicit API"'],
         'Elicit serves a full OpenAPI 3.1.0 document (info title "Elicit API", version 2.0.0; 46 paths across Search, Sessions, Reports, Systematic Reviews, Research Agent and more; server https://elicit.com/api/v2) as the backing document of its hosted reference. It is reachable at the docs root rather than advertised as a separate download link; API access requires a Pro plan or above.'),
        ('elicit-scalar-reference-20261106', 'claimed-docs',
         'https://docs.elicit.com',
         ['Elicit API Reference'],
         'Elicit vendor-hosts a Scalar API reference ("Elicit API Reference — Complete API reference for the Elicit research automation platform") embedding the spec. The page mounts client-side (Scalar\'s in-page test console renders in-browser rather than in the served HTML) and targets the production server only.'),
        ('elicit-v2-versioning-20261106', 'claimed-docs',
         'https://docs.elicit.com/openapi.json',
         ['This reference documents **v2**',
          'The older v1 API uses different paths and response envelopes; do not mix v1 examples with this reference.'],
         'The spec\'s introduction establishes URL-path versioning: "This reference documents **v2**, with production base URL https://elicit.com/api/v2", warning that "The older v1 API uses different paths and response envelopes; do not mix v1 examples with this reference." That is the entire published policy: no deprecation or sunset timeline for v1, no deprecated flags in the spec, and no API changelog.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none at wave start).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace; none at wave start).
UPDATES: dict = {}

# Hand-recorded counter-check/probe rows a scheduled refresh must not clobber.
PRESERVE_IDS = {'meilisearch-playground-disabled-20261106'}

# Fail-closed probe negatives (the #502 convention): URLs expected to answer exactly 404,
# or (url, {statuses}) for asserted non-404 states.
NEGATIVE_CHECKS = {
    # The excerpt asserts the complete Formant spec is not downloadable from the API host.
    'formant-endpoint-openapi-20261106': [
        'https://api.formant.io/openapi.json',
    ],
    # The excerpt asserts only a V1 spec exists.
    'fivetran-openapi-page-20261106': [
        'https://fivetran.com/assets-docs/openapi/file_v2.json',
    ],
}

# Fail-closed recorded POST probes (none this wave).
POST_CHECKS: dict = {}

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
    # A non-zero curl exit (partial transfer 18, timeout 28, ...) can still deliver an
    # HTTP 200 and the marker bytes from a truncated body; that must not pass
    # verification. Only a clean transfer counts; everything else surfaces as status 0
    # so verify()/verify_absent() exit inconclusive instead of trusting a torn read.
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
                f'{url} answered {status}, expected one of {sorted(expected)}; the asserted state '
                'no longer holds - inconclusive, nothing written. Re-derive the counter-check.')


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
        raise SystemExit(f'POST {url}: curl exit {r.returncode} (incomplete transfer) - inconclusive, nothing written.')
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
