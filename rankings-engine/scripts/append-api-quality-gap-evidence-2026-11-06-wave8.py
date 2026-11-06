#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 8: the next twelve rows from the
# corrected staleness ranking on post-#641 main (73 gap rows; waves 1-7 = PRs #623,
# #627, #630, #632, #634, #639, #641). Roster: workable, oneleet, sprinto, braintrust,
# aws, azure, google-cloud, onedrive, unity, fellow, granola, obsidian. iterm2 stays
# deferred (wave-2 ledger) and foreloop stays excluded pending the maintainer ruling
# (wave-7 ledger).
#
# Same fail-closed toolkit as waves 6-7 (marker verify with curl-exit hardening,
# REMOVALS, UPDATES, PRESERVE_IDS, NEGATIVE_CHECKS, POST_CHECKS, TLS_MISMATCH_CHECKS).
# Excerpts carry scope caveats verbatim.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave8.json:
#   - workable api-machine-spec: the ReadMe reference is OpenAPI-backed but the served
#     project config disables the spec download ("show_openapi_download":"disabled");
#     /openapi.json, /openapi, /swagger.json answer 404.
#   - workable api-sandbox / api-versioning-policy: docs direct you to test on your live
#     account subdomain; v3 appears in the base path only, /changelog is 404, zero
#     deprecation text in the llms.txt corpus.
#   - sprinto api-machine-spec: GraphQL with key-gated introspection ("supports
#     **introspection**"); no downloadable spec artifact (models.md embeds OpenAPI
#     fragments inside a docs page). api-sandbox: the Playground uses a real admin API
#     key against the live regional tenants. api-versioning-policy: /api/v1/ REST paths
#     and one in-prose parameter deprecation; GraphQL base unversioned, no changelog or
#     policy page. app/eu.sprinto.com/dev-api/explorer answers CloudFront 403 to curl
#     (bot wall, documented, not circumvented; playground claims grounded in docs text).
#   - braintrust api-sandbox: llms-full.txt (5.77 MB) sandbox hits are the in-app SQL
#     sandbox, the remote-eval code-execution runtime, and the custom-view iframe host;
#     the spec's servers block lists only api.braintrust.dev plus self-hosted.
#   - aws api-interactive-docs: the per-service API references are static; CloudShell is
#     appended with its scope (a pre-authenticated browser shell, not a reference
#     runner). api-sandbox: the Free Tier is credits on a real account; DynamoDB local is
#     appended as the vendor-owned, single-service emulator; LocalStack is third-party
#     and excluded.
#   - azure api-sandbox: the Microsoft Learn sandbox is retired ("Sandboxes are no longer
#     available."); vendor-owned per-service local emulators (Azurite, Cosmos DB) are
#     appended with that scope.
#   - google-cloud api-sandbox: the APIs Explorer "acts on real data"; the Firestore
#     emulator is appended as the vendor-owned, local, per-service test path.
#   - unity api-interactive-docs: the OpenAPI reference pages are static (renderer
#     string inventory has no try-it/execute keys; legacy services.docs.unity.com
#     redirects to the landing page).
#   - fellow api-sandbox: no test workspace or sandbox tier; docs call the live
#     `https://{subdomain}.fellow.app/api/v1/...` base. api-versioning-policy: /api/v1
#     paths and spec version 1.0.2 only; /changelog is 404.
#   - granola api-sandbox: explicit vendor denial, recorded as a preserved counter-check
#     row ("Not currently. We recommend testing with a small number of notes in a
#     dedicated test folder.").
#   - obsidian api-interactive-docs: Obsidian Publish renders a static generated
#     TypeScript reference; the full 1347-page docs index carries no runner surface.
#     api-sandbox: vendor guidance is a self-managed separate vault (counter row
#     appended). The community "Local REST API" plugin is third-party and is not
#     credited to the vendor.
#
# Reachability notes: docs.obsidian.md and help.obsidian.md are Obsidian Publish
# soft-200 hosts; their served content lives at publish-01.obsidian.md/access/<uid>/...
# .md, which is what the obsidian rows cite. cloud.google.com soft-200s (rows
# content-verified). services.docs.unity.com is a redirect shell; the live docs host is
# docs.unity.com (hard 404s, real llms.txt and .md mirrors). fellow's spec has no
# vendor-branded download path; the stable URL is the ReadMe api-registry endpoint.
# Bot wall hit and documented: *.sprinto.com/dev-api/explorer (CloudFront 403 to curl).
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> [--product <id>]
#   (compliance-automation, cloud-platforms, and meeting-ai judge category-wide: two or
#   three touched products each)
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
    ('applicant-tracking', 'workable'): [
        ('workable-tryit-20261106', 'claimed-docs',
         'https://workable.readme.io/reference/generate-an-access-token',
         ['"tryItPunctuated":"Try It!"',
          '"api_sdk_snippets":"enabled"',
          '"show_openapi_download":"disabled"'],
         'Workable\'s API reference is ReadMe-hosted with the "Try It!" request runner enabled (served project config: "api_sdk_snippets":"enabled", credentials enabled; prompt "Click Try It! to start a request and see the response here!"). The runner executes against the caller\'s real account with a Bearer access token. The same served config explicitly disables the OpenAPI spec download ("show_openapi_download":"disabled"), and /openapi.json, /openapi, and /swagger.json answer 404: the reference is spec-backed but no machine-readable description is published.'),
        ('workable-live-base-20261106', 'claimed-docs',
         'https://workable.readme.io/reference/generate-an-access-token.md',
         ['workable.com/spi/v3/jobs',
          'remember to replace the ‘account subdomain’'],
         'The docs direct integrators to test against their live account: the example call is "https://<account subdomain>.workable.com/spi/v3/jobs" and you can "test it on the spot just by typing the following command in your terminal window (remember to replace the ‘account subdomain’)". v3 appears in the base path only; no test base URL, test keys, test tenant, API changelog (/changelog is 404), or deprecation policy is documented.'),
    ],
    ('compliance-automation', 'oneleet'): [
        ('oneleet-openapi-spec-20261106', 'claimed-docs',
         'https://api.oneleet.com/api/v1/public/openapi.json',
         ['"title": "Oneleet Public API"', '"version": "1.0.0"'],
         'Oneleet serves a downloadable OpenAPI 3.0.3 document for its Public API (157 paths) at the API origin, plus a second document for the Auditor API (/api/v1/public/auditor/openapi.json, "Oneleet Auditor API", 25 paths). Scope caveat verbatim from the spec: "The same host also serves the routes behind the Oneleet web application. Those routes aren\'t part of the public API: they aren\'t listed here, they can change without notice, and they answer a service key or an OAuth access token with 401."'),
        ('oneleet-api-docs-20261106', 'claimed-docs',
         'https://docs.oneleet.com/api-and-mcp/service-keys-and-mcp/',
         ['OpenAPI specifications and interactive references:'],
         'The docs link the machine specs and consoles directly ("OpenAPI specifications and interactive references:") and note you can import the spec into Postman or use it to generate an API client; both APIs use https://api.oneleet.com as their base URL.'),
        ('oneleet-scalar-reference-20261106', 'claimed-docs',
         'https://api.oneleet.com/api/v1/public/api-reference',
         ['<title>Oneleet Public API</title>', 'data-url="./openapi.json"'],
         'Oneleet hosts Scalar-rendered API references for both APIs (the page loads the live OpenAPI document via data-url="./openapi.json"; the Auditor API has its own reference page). The docs call these "interactive references". Caveats: the page is a default Scalar bootstrap (the request client is the library default, not explicitly configured in the served HTML), and executing requests needs a real service key against the caller\'s own workspace data.'),
        ('oneleet-deprecations-20261106', 'claimed-docs',
         'https://api.oneleet.com/api/v1/public/openapi.json',
         ['Use riskAssessmentSummary going forward.'],
         'Versioning is practiced in the API surface: all routes are URI-versioned under /api/v1/, and the spec carries "deprecated": true members with migration guidance ("Deprecated. Overview of how the risk assessment was personalized, retained for backward compatibility with results generated before riskAssessmentSummary was introduced. Use riskAssessmentSummary going forward."). The spec contrasts the stable public API with internal routes that "can change without notice". No standalone versioning or deprecation-policy page exists (docs.oneleet.com/changelog/ answers 404) and no notice window is stated.'),
    ],
    ('compliance-automation', 'sprinto'): [
        ('sprinto-playground-20261106', 'claimed-docs',
         'https://docs.sprinto.com/api-reference/sprinto-api-playground/set-up-api-playground.md',
         ['The Sprinto API Playground is a browser-based GraphQL explorer that lets you interact with the Sprinto Developer API without installing any client libraries or GraphQL tools.'],
         '"The Sprinto API Playground is a browser-based GraphQL explorer that lets you interact with the Sprinto Developer API without installing any client libraries or GraphQL tools... You can use the playground to explore the API schema, test queries and mutations, and validate responses in real time." The explorer is hosted on the live regional apps (e.g. https://eu.sprinto.com/dev-api/explorer) and requires a Sprinto account with administrator privileges and a valid API key; requests run against the live tenant. The explorer endpoints answer a CloudFront 403 to non-browser clients, so runnability is grounded in the vendor docs text.'),
        ('sprinto-introspection-20261106', 'claimed-docs',
         'https://docs.sprinto.com/api-reference/getting-started/quick-start.md',
         ['supports **introspection**'],
         '"The Sprinto Developer API is built using GraphQL and supports **introspection**. Introspection allows the API to describe its schema, including available queries, mutations, and response types." Schema description is key-gated introspection rather than a downloadable artifact: no OpenAPI or Postman download exists in the docs corpus, and the models page embeds OpenAPI fragments inside the docs page for the custom-integration sync API only.'),
    ],
    ('llm-evals-observability', 'braintrust'): [
        ('braintrust-openapi-spec-20261106', 'claimed-docs',
         'https://docs.braintrust.dev/openapi.json',
         ['"openapi": "3.1.1"', '"title": "Braintrust API"'],
         'Braintrust publishes a downloadable OpenAPI 3.1.1 document on its docs host, maintained in the vendor\'s braintrustdata/braintrust-openapi repository ("This repository contains OpenAPI specifications for Braintrust\'s API", with JSON and YAML versions). The API reference states: "The API is defined by an OpenAPI 3.1.1 specification published at braintrust-openapi on GitHub." The spec is served from the docs host and GitHub; api.braintrust.dev/openapi.json answers 404.'),
        ('braintrust-api-playground-20261106', 'claimed-docs',
         'https://docs.braintrust.dev/api-reference/projects/list-projects',
         ['data-testid="try-it-button"', 'aria-label="Try it"'],
         'The Mintlify-hosted API reference carries a "Try it" playground on each endpoint page (try-it button and API playground containers in the served HTML; the runner mounts client-side) alongside .md mirrors of every page and llms.txt/llms-full.txt indexes.'),
        ('braintrust-feature-lifecycle-20261106', 'claimed-docs',
         'https://docs.braintrust.dev/feature-lifecycle.md',
         ['A feature is generally available unless its documentation marks it otherwise.'],
         'Braintrust publishes a feature-lifecycle stability policy ("A feature is generally available unless its documentation marks it otherwise."; public preview means "behavior, APIs, and configuration can still change", GA means "stable, documented, and priced"), the REST API is /v1 path-versioned, and dated changelogs label entries "**Breaking change**:" explicitly. No deprecation-notice window for the REST API is documented.'),
    ],
    ('cloud-platforms', 'aws'): [
        ('aws-api-models-20261106', 'github',
         'https://raw.githubusercontent.com/aws/api-models-aws/main/README.md',
         ['# AWS API Models',
          'At AWS, we use Smithy extensively to model our service APIs and provide the daily releases'],
         'AWS publishes machine-readable models for its entire API surface: the official aws/api-models-aws repository carries Smithy models in JSON AST form "for all public AWS API services" with per-service, per-version directories ("At AWS, we use Smithy extensively to model our service APIs and provide the daily releases of the AWS SDKs and CLIs"), and the vendor\'s botocore data files serve the same models per service version (e.g. ec2/2016-11-15/service-2.json, "apiVersion":"2016-11-15"). Caveats: the models are Smithy/botocore JSON rather than OpenAPI, live on GitHub rather than the docs host, and the repo notes it "is not closely monitored, and the files here are generated from other sources".'),
        ('aws-cloudshell-20261106', 'claimed-docs',
         'https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html',
         ['AWS CloudShell is a browser-based, pre-authenticated shell that you can launch directly from the AWS Management Console.'],
         '"AWS CloudShell is a browser-based, pre-authenticated shell that you can launch directly from the AWS Management Console" with the AWS CLI pre-installed and no credential setup. Scope: CloudShell is a console shell for running real API calls in the signed-in account; the per-service API reference pages themselves are static (request parameters and XML responses, no embedded try-it runner), and no platform-wide interactive API reference exists.'),
        ('aws-dynamodb-local-20261106', 'claimed-docs',
         'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.md',
         ['# Setting up DynamoDB local (downloadable version)',
          'you can develop and test applications without accessing the DynamoDB web service'],
         'AWS ships a vendor-owned local emulator for DynamoDB: "With the downloadable version of Amazon DynamoDB, you can develop and test applications without accessing the DynamoDB web service." Scope: single-service and local. Platform-wide, the AWS Free Tier is credits on a real account ("When you create a new AWS Free Tier account, you get $100 in credits immediately" to "build, break things, and experiment"), not an isolated test environment; LocalStack is third-party.'),
        ('aws-service-lifecycle-20261106', 'claimed-docs',
         'https://docs.aws.amazon.com/general/latest/gr/service-lifecycle.md',
         ['Sunset services have a sunset time line (typically 12 months). The sunset date is the date AWS will end operations and support of the service.'],
         'AWS publishes a service lifecycle policy with Maintenance, Sunset, and Full Shutdown stages: "When the availability of an AWS service or feature changes, we provide customers guidance on available alternatives and support for migration so that disruptions to customer operations are minimized", and "Sunset services have a sunset time line (typically 12 months)." Caveat: this is a service/feature lifecycle policy; AWS publishes no per-API-version deprecation-window commitment.'),
        ('aws-api-version-20261106', 'claimed-docs',
         'https://docs.aws.amazon.com/ec2/latest/devguide/Query-Requests.md',
         ['**Version**: The API version to use. For the Amazon EC2 API, the version is 2016-11-15.'],
         'AWS APIs are versioned with per-service date-stamped versions carried on every request: "**Version**: The API version to use. For the Amazon EC2 API, the version is 2016-11-15." The same date-stamped versions key the machine models (api-models-aws per-version directories, botocore apiVersion). Versioning is documented per service rather than in one platform-wide versioning document.'),
    ],
    ('cloud-platforms', 'azure'): [
        ('azure-rest-api-specs-20261106', 'github',
         'https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/README.md',
         ['This repository is the canonical source for REST API specifications for Microsoft Azure.'],
         '"This repository is the canonical source for REST API specifications for Microsoft Azure." The Azure/azure-rest-api-specs repository publishes downloadable per-service specification documents versioned in stable/ and preview/ folders named by api-version date (e.g. Microsoft.Resources .../stable/2025-04-01/resources.json, "swagger": "2.0", downloads live), with newer specs generated from TypeSpec sources in the same repository. Caveat: the documents are Swagger 2.0/TypeSpec-generated, and folder paths move as the layout evolves.'),
        ('azure-rest-try-it-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/rest/api/resources/resource-groups/list',
         ['enable_rest_try_it" content="true"',
          'resourcegroups?api-version='],
         'Azure REST API reference operation pages on Microsoft Learn carry a Try It console (the served page sets the enable_rest_try_it flag; the button itself is injected client-side). Executing Try It requires Microsoft sign-in and runs against the caller\'s real subscription at management.azure.com. The same pages document the api-version query-string convention every Azure REST request requires (e.g. resourcegroups?api-version=2021-04-01).'),
        ('azure-azurite-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite',
         ['The Azurite open-source emulator provides a free local environment for testing your Azure storage applications.'],
         'Azure ships vendor-owned local emulators per service: "The Azurite open-source emulator provides a free local environment for testing your Azure storage applications", and the Azure Cosmos DB emulator "provides a local environment that emulates the Azure Cosmos DB service" ("We do not recommend the use of the emulator for production workloads."). Scope: service-scoped local emulators; no platform-wide hosted API sandbox exists, and the free account is credits on production.'),
        ('azure-learn-sandbox-retired-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/training/support/faq?pivots=sandbox',
         ['Sandboxes are no longer available.'],
         'The Microsoft Learn training sandbox is retired: "The Microsoft Learn sandboxes were free environments used to explore Azure and other products through Microsoft Learn training modules... Sandboxes are no longer available. To complete exercises in training modules, you\'ll need access to an Azure subscription."'),
        ('azure-lifecycle-faq-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/lifecycle/faq/azure',
         ['Microsoft will provide notification 12 months before retiring an SDK',
          'compute &amp; storage emulators'],
         'Azure\'s lifecycle FAQ states the retirement commitment explicitly covers API surfaces: "The Microsoft Azure SDK policy covers Microsoft Azure SDK authoring tools, REST APIs, client libraries, command-line utilities, compute & storage emulators, and Azure Tools for Microsoft Visual Studio", with "notification 12 months before retiring an SDK". Generally-available Azure services follow the Modern Lifecycle Policy.'),
        ('azure-modern-lifecycle-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/lifecycle/policies/modern',
         ["Microsoft will provide a minimum of 12 months' notification prior to ending support if no successor product or service is offered—excluding free services or preview releases."],
         'The Modern Lifecycle Policy commits: "Microsoft will provide a minimum of 12 months\' notification prior to ending support if no successor product or service is offered—excluding free services or preview releases", with "a minimum 30 days\' notification when customers are required to take action" and up to three years\' notice for select Azure services. Caveats: the commitment is at service/SDK level and excludes free and preview surfaces; individual api-version retirements are announced per service.'),
    ],
    ('cloud-platforms', 'google-cloud'): [
        ('google-cloud-discovery-20261106', 'claimed-docs',
         'https://developers.google.com/discovery',
         ['a machine-readable "Discovery Document" for each API',
          'Use the Google API Discovery Service to build client libraries, IDE plugins, and other tools that interact with Google APIs.'],
         'Google publishes "a machine-readable \\"Discovery Document\\" for each API" through the API Discovery Service ("Use the Google API Discovery Service to build client libraries, IDE plugins, and other tools that interact with Google APIs"), with live per-API documents (e.g. https://compute.googleapis.com/$discovery/rest?version=v1 serves JSON unauthenticated) and a queryable directory (discovery#directoryList). Caveat: the Discovery format is Google-proprietary rather than OpenAPI.'),
        ('google-cloud-api-explorer-20261106', 'claimed-docs',
         'https://developers.google.com/explorer-help',
         ['lets you try Google API methods without writing code',
          'acts on real data, so use caution when trying methods that'],
         'The Google APIs Explorer is embedded on REST method reference pages ("lets you try Google API methods without writing code", appearing as a side panel with an Execute button). The vendor\'s own caveat: "The APIs Explorer acts on real data, so use caution when trying methods that create, modify, or delete data" — there is no sandboxed mode.'),
        ('google-cloud-firestore-emulator-20261106', 'claimed-docs',
         'https://cloud.google.com/firestore/docs/emulator',
         ['provides a local, in-memory emulator for',
          'Do not use the emulator for production'],
         'Google ships vendor-owned local emulators per service: "The Google Cloud CLI provides a local, in-memory emulator for Firestore that you can use to test your application... You should use the emulator only for local testing." Scope: local and in-memory ("Do not use the emulator for production deployments. Because the emulator stores data only in memory, it will not persist data across runs"), per-service, and "The emulator does not enforce all limits enforced in production"; it is not a hosted test tenant.'),
        ('google-cloud-versioning-20261106', 'claimed-docs',
         'https://cloud.google.com/apis/design/versioning',
         ['All Google API interfaces <strong>must</strong> provide a <em>major version number</em>'],
         'Google\'s API design guide (AIP-185, State: Approved) mandates versioning: "All Google API interfaces must provide a major version number, which is encoded at the end of the protobuf package, and included as the first part of the URI path for REST APIs", with channel-based, interface-based, release-based, and visibility-based versioning strategies.'),
        ('google-cloud-deprecation-terms-20261106', 'claimed-docs',
         'https://cloud.google.com/terms',
         ['Google will notify Customer at least 12 months before',
          'Customer-facing Google API in a backwards-incompatible manner'],
         'The Google Cloud terms commit to a deprecation window (Section 1.4(e), Discontinuation of Services): "Google will notify Customer at least 12 months before: (i) discontinuing any Service (or associated material functionality) unless Google replaces such discontinued Service or functionality with a materially similar Service or functionality; or (ii) significantly modifying a Customer-facing Google API in a backwards-incompatible manner."'),
        ('google-cloud-deprecation-scope-20261106', 'claimed-docs',
         'https://cloud.google.com/terms/deprecation',
         ['Current Google Cloud Platform Services Subject to the Deprecation Policy',
          'Any versions, features, or functionality of the Services that are pre-general availability are excluded from the Deprecation Policy.'],
         'The deprecation-policy list page enumerates the covered services and carries the scope caveat: "Any versions, features, or functionality of the Services that are pre-general availability are excluded from the Deprecation Policy."'),
    ],
    ('cloud-storage', 'onedrive'): [
        ('onedrive-graph-scope-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/api/resources/onedrive?view=graph-rest-1.0',
         ['You can use Microsoft Graph to create an app that connects with files across OneDrive, OneDrive for Business, and SharePoint document libraries.'],
         'OneDrive\'s API surface is Microsoft Graph: "You can use Microsoft Graph to create an app that connects with files across OneDrive, OneDrive for Business, and SharePoint document libraries" (the legacy onedrive/developer/rest-api path 301-redirects to this Graph page; /me/drive is the user\'s OneDrive).'),
        ('onedrive-graph-metadata-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/traverse-the-graph',
         ['The metadata document ($metadata) is published at the service root.'],
         '"The metadata document ($metadata) is published at the service root": the live CSDL at https://graph.microsoft.com/v1.0/$metadata (OData EDMX 4.0, served unauthenticated) is the machine-readable description of the whole Graph surface including the drives and driveItems resources. Caveat: CSDL/EDMX rather than OpenAPI, and Graph-wide with the files resources as a subset.'),
        ('onedrive-graph-explorer-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/graph-explorer/graph-explorer-overview',
         ['is a developer tool for exploring Microsoft Graph APIs. Use it to:',
          'Test APIs on a sample tenant and explore available resources.'],
         'Graph Explorer "is a developer tool for exploring Microsoft Graph APIs. Use it to: Test APIs on a sample tenant and explore available resources." "You can use Graph Explorer without signing in" (anonymous sample-tenant mode) or sign in to your own tenant; the page recommends "signing into your Microsoft 365 Developer sandbox tenant instead of your production tenant to avoid running operations that can affect your production data."'),
        ('onedrive-dev-sandbox-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/office/developer-program/microsoft-365-developer-program',
         ['request a Microsoft 365 E5 developer subscription to create a sandbox for developing solutions independent of their production environment'],
         'Eligible Microsoft 365 Developer Program members can "request a Microsoft 365 E5 developer subscription to create a sandbox for developing solutions independent of their production environment", a separate sandbox tenant that includes OneDrive. Gate caveat verbatim: "Having an enterprise or production subscription does not automatically create, replace, or qualify you for a Microsoft 365 E5 developer sandbox."'),
        ('onedrive-graph-versioning-20261106', 'claimed-docs',
         'https://learn.microsoft.com/en-us/graph/versioning-and-support',
         ['Microsoft declares a version as deprecated at least 24 months in advance of retiring it.'],
         'Microsoft Graph publishes a versioning and support policy covering the OneDrive file APIs: v1.0 vs beta endpoints, "Microsoft Graph follows the Microsoft Lifecycle Policy", and a committed window: "Microsoft declares a version as deprecated at least 24 months in advance of retiring it" (with the same notice for retiring individual GA APIs). Beta caveat: "Expect breaking changes and deprecation of APIs in the beta version from time to time."'),
    ],
    ('game-engines', 'unity'): [
        ('unity-openapi-specs-20261106', 'claimed-docs',
         'https://docs.unity.com/en-us/oas-cloud-save/1.0.0.md',
         ['"openapi": "3.0.0"', '"title": "Cloud Save API"'],
         'Unity publishes downloadable OpenAPI documents for its Services Web APIs: the docs catalog (docs.unity.com/llms.txt) lists ~50 per-service API-spec documents (oas-*), each spec page carrying a "Download OpenAPI specification" control and a raw markdown mirror embedding the full OpenAPI 3.0.0 JSON (e.g. the Cloud Save API: "This is the API specification for the Unity Cloud Save service that allows player or custom non-player state to be accessed and persisted from a game client."). Caveat: the raw .md wraps the JSON in doc frontmatter, and the one-click download is prepared client-side.'),
        ('unity-environments-20261106', 'claimed-docs',
         'https://docs.unity.com/en-us/services/service-environments.md',
         ['Environments are isolated. This means that if you change data in one environment, data in other environments is not affected.',
          'All projects start with a production environment. You can create up to 25 environments for a project.'],
         'Unity Gaming Services documents isolated environments for testing: "Environments are logical partitions for Unity Gaming Services that contain data associated with your project... Environments are isolated. This means that if you change data in one environment, data in other environments is not affected. All projects start with a production environment. You can create up to 25 environments for a project." Scope caveat: environments are logical partitions within the project ("Creating an environment doesn\'t provision resources"), organized "for testing, staging, and production workflows".'),
        ('unity-api-lifecycle-20261106', 'claimed-docs',
         'https://docs.unity.com/en-us/services-web-apis/api-lifecycle.md',
         ['Breaking changes are introduced only to new API versions.',
          'After three months to a year of continued support for a deprecated version,'],
         'Unity publishes an API lifecycle policy for the Services Web APIs: endpoints are path-versioned ("example: v1"), "The API may receive non-breaking changes without its version number being changed. Breaking changes are introduced only to new API versions.", and deprecation carries a window: "After three months to a year of continued support for a deprecated version, Unity may cease support or shutdown that version entirely. A version shutdown notice will be posted in this portal at least 2 months in advance." Caveat: the support window (three months to a year, plus two months\' shutdown notice) is materially shorter than the 12-24 month commitments of the other cloud vendors.'),
    ],
    ('meeting-ai', 'fellow'): [
        # developers.fellow.ai answered sustained HTTP 429 rate limits to unauthenticated
        # clients throughout the recording window (UA-independent, ~3 hours), so the rows
        # below cite the reachable surfaces only: the ReadMe registry document and the
        # vendor help-center article. Reference-site-only claims (the ReadMe "Try It!"
        # runner observed during research) are withheld fail-closed.
        ('fellow-openapi-spec-20261106', 'claimed-docs',
         'https://dash.readme.com/api/v1/api-registry/1lmra9xmsrt82wk',
         ['"openapi":"3.1.0"', '"title":"Fellow Developer API"'],
         'Fellow\'s Developer API is described by an OpenAPI 3.1 document ("Fellow Developer API", version 1.0.2, "Create custom integrations and workflows with Fellow\'s meeting data"; paths under /api/v1/), the ReadMe registry document behind the developers.fellow.ai reference. Caveats: the stable download URL is ReadMe\'s api-registry endpoint rather than a Fellow-branded path, and developers.fellow.ai itself was rate-limiting unauthenticated clients (sustained HTTP 429) when this was recorded, so reference-site claims are grounded in this document and the vendor help article only. The API carries path versioning only (/api/v1, spec version 1.0.2), with no published deprecation policy or API changelog.'),
        ('fellow-help-api-20261106', 'claimed-docs',
         'https://help.fellow.ai/en/articles/11817206-developer-api',
         ['The API Reference and Developer Guide is available at: https://developers.fellow.ai/',
          'can be enabled or disabled for all users from Workspace Settings'],
         'Fellow\'s help center documents the Developer API: "The API Reference and Developer Guide is available at: https://developers.fellow.ai/". Gating caveats verbatim: "The API is available on any Fellow workspace with a paid plan, and can be enabled or disabled for all users from Workspace Settings > Developer > API", with admin-visible User API keys and Workspace API keys, and disabling the setting "will prevent all existing API keys in the workspace from working". No sandbox or test workspace is mentioned anywhere in the article.'),
    ],
    ('meeting-ai', 'granola'): [
        ('granola-openapi-spec-20261106', 'claimed-docs',
         'https://docs.granola.ai/api-reference/openapi.json',
         ['"openapi": "3.1.0"', '"title": "Granola API"'],
         'Granola publishes a downloadable OpenAPI 3.1 document ("Granola API", server https://public-api.granola.ai; /v1 endpoints for notes, transcripts, folders, spaces, audit, webhook-endpoints, and legal holds), advertised in the docs llms.txt under "OpenAPI Specs". Gate caveat: "Any workspace member on a **Business** or **Enterprise** plan can create API keys."'),
        ('granola-playground-20261106', 'claimed-docs',
         'https://docs.granola.ai/api-reference/list-notes',
         ['data-testid="try-it-button"', 'public-api.granola.ai'],
         'The Mintlify-hosted API reference runs the interactive playground ("Try it" button sending live requests to https://public-api.granola.ai with a bearer key): "The Granola API provides programmatic access to your workspace\'s meeting notes and related data. This RESTful API enables you to integrate Granola with your existing tools, build custom workflows, and extract insights from your meeting documentation." Rate limits: "API keys are rate limited to 25 requests burst capacity with a sustained rate of 5 requests/second."'),
        ('granola-no-sandbox-20261106', 'claimed-docs',
         'https://docs.granola.ai/help-center/sharing/integrations/granola-api.md',
         ['Is there a sandbox or test environment?',
          'Not currently. We recommend testing with a small number of notes in a dedicated test folder.'],
         'Counter-check: Granola answers the sandbox question directly in its API FAQ: "Is there a sandbox or test environment?" — "Not currently. We recommend testing with a small number of notes in a dedicated test folder."'),
        ('granola-changelog-20261106', 'claimed-docs',
         'https://docs.granola.ai/api-reference/changelog.md',
         ['# Changelog', 'v1.6.0'],
         'The API is /v1 path-versioned with a dated, semantically versioned API changelog (v1.0.0 through v1.6.0, each entry listing endpoint and response changes, e.g. "**Get Note** now returns `413 TRANSCRIPT_TOO_LARGE` when a transcript cannot be returned inline."). No deprecation window or back-compat commitment is published (zero deprecation/backward-compatibility text in the docs corpus).'),
    ],
    ('notes-knowledge', 'obsidian'): [
        ('obsidian-plugin-api-20261106', 'github',
         'https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/README.md',
         ['Type definitions for the latest [Obsidian](https://obsidian.md) API.'],
         'Obsidian\'s machine-readable API description is its TypeScript declaration set: the official obsidianmd/obsidian-api repository ("Type definitions for the latest Obsidian API.") ships obsidian.d.ts (306 KB) plus publish.d.ts and canvas.d.ts, distributed via GitHub and npm, from which the reference docs at docs.obsidian.md are generated ("Do not edit this file. It is automatically generated by API Documenter."). Scope hard: this is a typed in-process plugin API; Obsidian has no HTTP/REST API to describe, and the community "Local REST API" plugin is third-party.'),
        ('obsidian-uri-20261106', 'claimed-docs',
         'https://publish-01.obsidian.md/access/f786db9fac45774fa4f0d8112e232d67/Extending%20Obsidian/Obsidian%20URI.md',
         ['Obsidian URI is a custom URI protocol supported by Obsidian that lets you trigger various actions, such as opening a note or creating a note.'],
         'The second official programmatic surface is the URI scheme: "Obsidian URI is a custom URI protocol supported by Obsidian that lets you trigger various actions, such as opening a note or creating a note" (obsidian://action?param1=value&param2=value). Cited from the Obsidian Publish content endpoint that serves help.obsidian.md\'s markdown (the human URL renders a JS shell).'),
        ('obsidian-api-changelog-20261106', 'github',
         'https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/CHANGELOG.md',
         ['This CHANGELOG details any breaking changes to the API or new additions that require additional context. The versions listed below correspond to the versions of the Obsidian app.'],
         'Plugin-API versioning is documented and practiced: "This CHANGELOG details any breaking changes to the API or new additions that require additional context. The versions listed below correspond to the versions of the Obsidian app." Plugins pin compatibility via versions.json/minAppVersion ("the key is the plugin version, and the value is the corresponding minAppVersion") and gate features at runtime with requireApiVersion ("Use this to limit functionality that require specific API versions to avoid crashing on older Obsidian builds"); obsidian.d.ts carries @deprecated annotations with migration guidance (e.g. "@deprecated Use the editor directly. Kept for compatibility with CodeMirror 5."). Caveat: plugin-API versioning with no formal deprecation-timeline commitment.'),
        ('obsidian-dev-vault-20261106', 'claimed-docs',
         'https://publish-01.obsidian.md/access/caa27d6312fe5c26ebc657cc609543be/Plugins/Getting%20started/Build%20a%20plugin.md',
         ['you should never develop plugins in your main vault. Always use a separate vault dedicated to plugin development.'],
         'Counter-check for the test-environment story: the vendor\'s guidance is a self-managed practice, not a provided environment: "When developing plugins, one mistake can lead to unintended changes to your vault. To prevent data loss, you should never develop plugins in your main vault. Always use a separate vault dedicated to plugin development." No hosted sandbox exists for the Plugin API, URI scheme, Sync, or Publish.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none at wave start).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace; none at wave start).
UPDATES: dict = {}

# Hand-recorded counter-check rows a scheduled refresh must not clobber.
PRESERVE_IDS: set = {
    'granola-no-sandbox-20261106',
    'workable-tryit-20261106',
    'obsidian-dev-vault-20261106',
    'azure-learn-sandbox-retired-20261106',
}

# Fail-closed probe negatives (#502 convention): excerpts that assert dead URLs must
# verify them on every run.
NEGATIVE_CHECKS = {
    'workable-tryit-20261106': [
        'https://workable.readme.io/openapi.json',
        'https://workable.readme.io/openapi',
        'https://workable.readme.io/swagger.json',
    ],
    'workable-live-base-20261106': [
        'https://workable.readme.io/changelog',
    ],
    'braintrust-openapi-spec-20261106': [
        'https://api.braintrust.dev/openapi.json',
    ],
    'oneleet-deprecations-20261106': [
        'https://docs.oneleet.com/changelog/',
    ],
    # fellow: the research run observed developers.fellow.ai/openapi.json and /changelog
    # answering 404, but the host then rate-limited (sustained 429), so those negatives
    # cannot be replayed fail-closed and the excerpt does not assert them.
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
