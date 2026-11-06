#!/usr/bin/env python3
# API-quality crawl-gap repairs, 2026-11-06 wave 9: the next twelve rows from the
# corrected staleness ranking on post-#643 main (61 gap rows; waves 1-8 = PRs #623,
# #627, #630, #632, #634, #639, #641, #643). Roster: signifyd, earth-class-mail,
# raygun, galileo, a-shell, anythingllm, virtualpostmail, scrapingbee, runanywhere,
# kimi, irs, moneybird. iterm2 stays deferred (wave-2 ledger) and foreloop stays
# excluded pending the maintainer ruling (wave-7 ledger).
#
# Same fail-closed toolkit as waves 6-8 (marker verify with curl-exit hardening,
# REMOVALS, UPDATES, PRESERVE_IDS, NEGATIVE_CHECKS with status sets, POST_CHECKS,
# TLS_MISMATCH_CHECKS, per-host courtesy pacing). Excerpts carry scope caveats verbatim.
#
# Verified-honest counterparts (NO items added for the story). Per-cell detail with every
# checked URL lives in reports/evidence-parity/2026-11-06-api-quality-wave9.json:
#   - signifyd api-sandbox is scoped, not absent (test teams); its changelog absence is
#     replayed (/main/changelog 404).
#   - earth-class-mail (now "Virtual Mail", LegalZoom): interactive none (static Astro
#     Starlight; vendor interactivity is importing the YAML into Postman/Swagger UI);
#     sandbox none (zero sandbox/test-mode in the 263 KB llms-full corpus; single
#     production server; "Your API key is tied to your user account"); versioning
#     none-grade (v1 base and two deprecated request fields, no policy or changelog).
#   - virtualpostmail has NO public developer docs at all: api.virtualpostmail.com
#     answers 401 on /, /docs, and /swagger (replayed as negative checks), the docs
#     subdomains do not resolve, and the help center says API access is
#     contact-to-request. All four cells are honest nones grounded in two context rows.
#   - raygun api-sandbox: zero sandbox text in the API guide and spec; PAT auth against
#     production only.
#   - galileo api-sandbox: "Playgrounds" are in-console experiment runners; marketing
#     pages redirect to splunk.com post-acquisition, docs stay on docs.galileo.ai.
#   - a-shell is a local iOS terminal with no cloud API: all four cells are honest nones
#     grounded in one context row (optional local relay server and Apple Shortcuts are
#     the only programmatic surfaces; a-shell.app does not resolve; the only GitHub
#     release/tag is a 2022 cpython binary drop).
#   - anythingllm api-sandbox: keys are live-instance credentials; no test environment
#     in the full docs nav (hard-404 host).
#   - scrapingbee api-interactive-docs: the docs are static copy-paste tabs; the
#     dashboard Request Builder is login-walled (app.scrapingbee.com answers 401,
#     replayed). api-sandbox: free usage is 1,000 production trial credits.
#   - runanywhere api-sandbox: key entitlement has per-environment semantics but no
#     isolated test environment, test keys, or mock mode is documented; the console
#     playground runs on production and retains conversations.
#   - kimi api-sandbox: paid-tier framing only; the login-gated console playground runs
#     against production endpoints and billing.
#   - irs api-machine-spec/api-interactive-docs: the MeF XSDs and WSDLs are real but
#     registration-gated (e-Services portal / email request); the developer surface is
#     PDF publications. developer.irs.gov and api.irs.gov do not resolve (DNS).
#
# Reachability notes: raygun.com soft-200s (nonsense paths 301 to a 200 /404 page) and
# platform.kimi.ai soft-200s (nonsense docs paths redirect to a default page) - rows on
# those hosts are content-verified. earthclassmail.com marketing 301s every path to a
# LegalZoom page; the live docs host is reference.earthclassmail.com (hard 404s).
# developers./docs. earthclassmail.com and docs./developer(s). virtualpostmail.com and
# developer.irs.gov / api.irs.gov do not resolve. No bot walls were hit this wave.
#
# Run, then per touched (arena, product):
#   pnpm engine judge --batch --category <arena> [--product <id>]
#   (virtual-mailboxes judges category-wide: two touched products)
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
    ('fraud-prevention', 'signifyd'): [
        ('signifyd-openapi-spec-20261106', 'claimed-docs',
         'https://developer.signifyd.com/main/openapi/signifyd-api.json',
         ['{"openapi":"3.0.3","info":{"title":"Signifyd API","version":"3.0"',
          '"servers":[{"url":"https://api.signifyd.com/v3'],
         'Signifyd publishes a downloadable OpenAPI 3.0.3 document ("Signifyd API", version 3.0, servers https://api.signifyd.com/v3), linked in prose from the reference introduction ("An OpenAPI specification is available at this link"). Caveat: the ReadMe UI download button is disabled ("showOpenAPIDownload":false); the spec is reached through the prose link. The docs also serve llms.txt and per-page .md mirrors.'),
        ('signifyd-tryit-20261106', 'claimed-docs',
         'https://developer.signifyd.com/main/reference/getdecision',
         ['"tryItPunctuated":"Try It!"'],
         'The ReadMe-hosted API reference runs the "Try It!" request panel on endpoint pages ("Click Try It! to start a request and see the response here"). Auth is HTTP Basic with a per-team API key, so execution needs real credentials. Caveat: "If you are a Signifyd customer and would like to access Enterprise API documentation, please log in... and navigate to the Resource Center within Developer Tools" (some docs are gated behind the app).'),
        ('signifyd-test-teams-20261106', 'claimed-docs',
         'https://developer.signifyd.com/main/docs/testing.md',
         ['we can update your newly created Signifyd production team to a test team',
          'Signifyd test teams are slightly different to production teams as the orders created are not used in model learning'],
         'Signifyd documents test teams as its isolation mechanism: "we can update your newly created Signifyd production team to a test team", where "orders created are not used in model learning", and "it is strongly recommended to never send test orders to your production teams. Any test data added to a production environment can pollute the model with false data." API keys are per-team, so a test team is a test tenant with its own key. Caveats: no separate sandbox base URL or self-serve test mode; converting a team requires contacting the Implementation Manager or Signifyd support.'),
        ('signifyd-versioning-20261106', 'claimed-docs',
         'https://developer.signifyd.com/main/reference/introduction.md',
         ['We only update the version of our API when a non-backward-compatible change is made.',
          '**Signifyd considers the following changes to be backward-compatible:**'],
         'Signifyd publishes a back-compat policy: "We only update the version of our API when a non-backward-compatible change is made", with an explicit list of changes it considers backward-compatible (new optional parameters, new enum values, new response fields, field reorder, new resources, new webhook events, UUID length changes, error-message wording). The API is major-path-versioned (v3 servers; webhook tooling addresses "a specific API version - V2, V3 or ALL"). Caveats: no published changelog (/main/changelog answers 404) and no deprecation notice window.'),
    ],
    ('virtual-mailboxes', 'earth-class-mail'): [
        ('earth-class-mail-openapi-20261106', 'claimed-docs',
         'https://reference.earthclassmail.com/rest-api-v1.yaml',
         ['openapi: 3.1.0',
          'title: Virtual Mail Public API',
          '- url: https://api.earthclassmail.com/v1'],
         'The service (now "Virtual Mail", the current name for the service formerly known as Earth Class Mail, under LegalZoom) publishes a downloadable OpenAPI 3.1 YAML ("Virtual Mail Public API", server https://api.earthclassmail.com/v1): "The OpenAPI 3.1 specification is available as a YAML file for import into tools like Postman, Swagger UI, or code generators." A second machine surface is the MCP tool catalog (row earth-class-mail-mcp-catalog-20261106). The old developers./docs.earthclassmail.com hosts no longer resolve; reference.earthclassmail.com is the live successor.'),
        ('earth-class-mail-mcp-catalog-20261106', 'claimed-docs',
         'https://api.earthclassmail.com/v2/mcp_catalog.json',
         ['"schemaVersion": "1.0"'],
         'A machine-readable MCP tool catalog is served live at the API origin under /v2/.'),
        # Pre-audit grounding: the research pass found the catalog JSON but missed the
        # documented MCP server itself; this row carries the vendor's own text.
        ('earth-class-mail-mcp-server-20261106', 'claimed-docs',
         'https://reference.earthclassmail.com/_llms_txt/v2/mcp.md',
         ['Connect your AI assistant to Virtual Mail and manage your virtual mailbox just',
          'Instead of logging in and clicking',
          'find the letter from the IRS and'],
         'Virtual Mail documents an official MCP server with natural-language operation: "Connect your AI assistant to Virtual Mail and manage your virtual mailbox just by asking - find mail, organize your inbox, scan or shred items, and more - directly from Claude, Cursor, and other MCP-compatible apps." "Instead of logging in and clicking through the app, you just ask", e.g. "find the letter from the IRS and tell me what it says", and it can "take real actions on your behalf: scan or shred a piece of mail, apply tags or move it to a different folder", scoped to "your own Virtual Mail account and permissions". A full per-tool reference is published alongside.'),
        ('earth-class-mail-api-scope-20261106', 'claimed-docs',
         'https://reference.earthclassmail.com/_llms_txt/v1/rest-api.md',
         ['Your API key is tied to your user account, so it can reach every mailbox you have access to.',
          'All endpoints are relative to:'],
         'Scope of the API surface: a single static key against the production account ("Your API key is tied to your user account, so it can reach every mailbox you have access to."), a single versioned base ("All endpoints are relative to: https://api.earthclassmail.com/v1"), and forward-compat guidance only ("Responses may include additional fields; clients should ignore fields they don\'t recognize."). The docs corpus carries no sandbox, test mode, changelog, or deprecation-policy text; the YAML flags two request fields deprecated.'),
    ],
    ('virtual-mailboxes', 'virtualpostmail'): [
        ('virtualpostmail-developers-20261106', 'claimed-docs',
         'https://www.virtualpostmail.com/developers/',
         ['use our API directly to take full control of your workflow.'],
         'VirtualPostMail\'s developers page confirms an API exists ("use our API directly to take full control of your workflow") but publishes no documentation: the page is marketing linking pricing, help, community, and status, with Zapier as the showcased integration path ("With Zapier, you can connect your mail to 5000+ apps."). api.virtualpostmail.com answers 401 on /, /docs, and /swagger, and the docs/developer subdomains do not resolve.'),
        ('virtualpostmail-api-gated-20261106', 'claimed-docs',
         'https://help.virtualpostmail.com/article/167-api-integrations',
         ['we do offer an API that you can use. API access is currently available to those who may know how to program or code software.'],
         'The help center states the access model: "we do offer an API that you can use. API access is currently available to those who may know how to program or code software. You can contact us to request for developer information on how to access the API." API documentation is contact-to-request; no public spec, reference, sandbox, or versioning documentation exists.'),
    ],
    ('error-tracking', 'raygun'): [
        ('raygun-openapi-spec-20261106', 'claimed-docs',
         'https://api.raygun.com/v3/raygun-openapi-spec.json',
         ['"openapi": "3.0.3",', '"title": "Raygun API",'],
         'Raygun publishes a downloadable OpenAPI 3.0.3 document ("Raygun API", 46 paths, servers https://api.raygun.com/v3) at the API origin, linked from the docs ("Following the OpenAPI standard, you can see the full specification here"). The API "allows you to access your Raygun data so that you can display, manipulate and process it in other tools, scripts and applications."'),
        ('raygun-swagger-ui-20261106', 'claimed-docs',
         'https://api.raygun.com/v3/swagger/index.js',
         ['{"urls":[{"url":"/v3/raygun-openapi-spec.json","name":"v3"}]',
          '"supportedSubmitMethods":["get","put","post","delete","options","head","patch","trace"]'],
         'Raygun hosts Swagger UI over its spec at https://api.raygun.com/v3/swagger/index.html; the served configuration loads the v3 spec and enables all submit methods, so the per-operation "Try it out" runner is available (the tryItOutEnabled:false flag only means panels are not pre-expanded). Caveats: the runner is client-rendered and executes against the production API with a Personal Access Token.'),
        ('raygun-api-guide-20261106', 'claimed-docs',
         'https://raygun.com/documentation/product-guides/raygun-api/',
         ['This is version 3 of Raygun', 'While we transition'],
         'The API guide documents path versioning and an in-flight transition: "This is version 3 of Raygun\'s API. While we transition, the RUM API will remain available". raygun.com soft-200s unknown paths (nonsense routes 301 to a 200 /404 page), so these claims are content-verified.'),
        ('raygun-migration-20261106', 'claimed-docs',
         'https://raygun.com/documentation/product-guides/deployment-tracking/migration-guide/',
         ['migrate from the legacy deployments API to the new Raygun API',
          'You may still use'],
         'Raygun documents a legacy-to-new API migration with backward-compatible field deprecation: "createdAt has been deprecated and deployedAt should be used instead. You may still use createdAt. If both properties are specified deployedAt will be preferred." Caveats: no standalone deprecation/versioning policy page exists, the public changelog carries SDK-level deprecations only, and the OpenAPI spec flags no operations deprecated.'),
    ],
    ('llm-evals-observability', 'galileo'): [
        ('galileo-openapi-spec-20261106', 'claimed-docs',
         'https://api.galileo.ai/public/v2/openapi.json',
         ['"openapi":', '"/v2/healthcheck"'],
         'Galileo publishes a downloadable OpenAPI 3.1.0 document at its API origin (202 paths, all under /v2/), advertised in the docs llms.txt under "OpenAPI Specs". Caveats: the spec\'s info block carries framework defaults (title "FastAPI", version "0.1.0"), and galileo.ai marketing pages now redirect to splunk.com post-acquisition while the docs remain at docs.galileo.ai.'),
        ('galileo-tryit-20261106', 'claimed-docs',
         'https://docs.galileo.ai/api-reference/auth/get-token',
         ['aria-label="Try it" class="tryit-button'],
         'The Mintlify-hosted API reference (generated from the OpenAPI document) runs the "Try it" playground per endpoint, with .md mirrors of every page. The runner mounts client-side and executes against the production API with a real token.'),
        ('galileo-deprecations-20261106', 'claimed-docs',
         'https://docs.galileo.ai/release-notes.md',
         ['### Removal of deprecated models',
          'These changes improve the API design while maintaining backward compatibility during the transition period.'],
         'Versioning is practiced: the API is /v2 path-versioned, release notes record removals and method deprecations with migration guidance ("These changes improve the API design while maintaining backward compatibility during the transition period"), and deprecated features carry dated banners (Protect: "deprecated as of June 2026"). Caveat: no standalone versioning or deprecation-policy document exists.'),
    ],
    ('web-scraping', 'scrapingbee'): [
        ('scrapingbee-postman-20261106', 'claimed-docs',
         'https://www.scrapingbee.com/documentation/',
         ["You can also discover this API using our Postman collection covering every ScrapingBee's features."],
         'ScrapingBee\'s machine-readable surface is a Postman collection: "You can also discover this API using our Postman collection covering every ScrapingBee\'s features" (embedded Run-in-Postman fork button, collection 19660521-faef6818-896f-4127-821a-868fadcbe053). No OpenAPI document exists (openapi.json answers 404 at both the site root and /documentation/, replayed fail-closed; zero openapi/swagger mentions in the docs corpus).'),
        ('scrapingbee-builder-20261106', 'claimed-docs',
         'https://www.scrapingbee.com/blog/cli-interactive-mode/',
         ['and configure the request visually'],
         'The documentation itself is static copy-paste code tabs with no runner. A visual Request Builder exists only inside the authenticated dashboard ("In the dashboard, go to Request builders > HTML and configure the request visually"); app.scrapingbee.com answers 401 to unauthenticated clients (replayed fail-closed).'),
        ('scrapingbee-deprecation-20261106', 'claimed-docs',
         'https://www.scrapingbee.com/llms/html-api.txt',
         ['- The `api_key` query parameter remains supported for backward compatibility but is deprecated for new integrations.'],
         'The API is path-versioned (base https://app.scrapingbee.com/api/v1) with a documented, backward-compatible deprecation: the docs carry a "Deprecation notice:" blockquote for query-string API keys, and the llms corpus states "The `api_key` query parameter remains supported for backward compatibility but is deprecated for new integrations." Caveats: no changelog (/changelog/ answers 404, replayed) and no standalone versioning or deprecation-policy page.'),
    ],
    ('mobile-dev', 'a-shell'): [
        ('a-shell-relay-20261106', 'github',
         'https://raw.githubusercontent.com/holzschu/a-shell/master/README.md',
         ['## Run commands remotely with relay',
          'a-Shell is compatible with Apple Shortcuts, giving users full control of the Shell.'],
         'a-Shell is a local iOS terminal whose only programmatic surfaces are local: Apple Shortcuts actions ("a-Shell is compatible with Apple Shortcuts, giving users full control of the Shell." - Execute Command, Put File, Get File) and an optional built-in relay server ("relay is an optional HTTPS server built into the app. It is off by default."; "POST /run takes a UTF-8 command line as its body and requires Content-Length and X-Token"; "relay is intended for trusted networks"). There is no cloud API, no OpenAPI document (the relay endpoint is specified in README prose), no interactive reference, no test environment ("In-app commands share the app\'s sandbox and can read its credential files; file permissions do not isolate commands from one another."), and no API versioning or changelog (the app ships via the App Store; the only GitHub release is a 2022 precompiled-cpython drop; a-shell.app does not resolve).'),
    ],
    ('self-hosted-assistants', 'anythingllm'): [
        ('anythingllm-openapi-20261106', 'github',
         'https://raw.githubusercontent.com/Mintplex-Labs/anything-llm/master/server/swagger/openapi.json',
         ['"title": "AnythingLLM Developer API",', '"/v1/auth": {'],
         'AnythingLLM publishes its Developer API as an OpenAPI 3.0.0 document in the official repository (67 paths, all under /v1/): "API endpoints that enable programmatic reading, writing, and updating of your AnythingLLM instance. UI supplied by Swagger.io." Scope caveat: the spec is generated into every self-hosted/desktop instance and served relative to it (servers url "/api"); there is no vendor-cloud API.'),
        ('anythingllm-api-docs-20261106', 'claimed-docs',
         'https://docs.anythingllm.com/features/api',
         ['You can find the API documentation for available endpoints on your instance at ',
          'AnythingLLM supports a full developer API that you can use to manage, update, embed, and even chat with your workspaces.'],
         '"AnythingLLM supports a full developer API that you can use to manage, update, embed, and even chat with your workspaces", with interactive Swagger UI docs served by the user\'s own instance: "You can find the API documentation for available endpoints on your instance at /api/docs". Scope caveats: the runner is a self-hosted built-in (no vendor-hosted or public demo instance), and keys are live credentials ("anyone with the API key can use the AnythingLLM API, so do not share or publish this key anywhere").'),
        ('anythingllm-changelog-20261106', 'claimed-docs',
         'https://docs.anythingllm.com/changelog/overview',
         ['Desktop Changelog Overview'],
         'The API is /v1 path-versioned and the vendor maintains dated per-version changelogs (v1.6.0 through v1.19.0 in the docs nav, matching GitHub releases). Caveats: these are app-release changelogs rather than API-contract changelogs, and no deprecation or backwards-compatibility policy is published.'),
        # Review round (PR #644 P1): grounds the agent surface in the vendor's own agent
        # documentation instead of workspace-settings credit.
        ('anythingllm-agent-directive-20261106', 'claimed-docs',
         'https://docs.anythingllm.com/agent/overview',
         ['@agent directive at the start of your chat to start an agentic chat session'],
         'AnythingLLM documents an in-product agent: "you can still choose to use the @agent directive at the start of your chat to start an agentic chat session", with setup, tool-selection, and usage guides. Scope: one agent surface per chat session; no multiple-named-agents feature is documented.'),
        ('anythingllm-agent-flows-20261106', 'claimed-docs',
         'https://docs.anythingllm.com/agent-flows/overview',
         ['Agent Flows are a no-code way to build agentic skills'],
         'Agents are user-configurable through two documented paths: "Agent Flows are a no-code way to build agentic skills. Using a visual interface, you can build \\"flows\\" that can be used in your agents", and "Agent skills: Code way to build agentic skills. Built for power users and developers." Scope: flows and skills customize what the agent can do; the docs do not describe running multiple separately configured, named agents.'),
    ],
    ('local-llm-runtimes', 'runanywhere'): [
        ('runanywhere-openapi-20261106', 'claimed-docs',
         'https://docs.runanywhere.ai/api-reference/openapi.json',
         ['"title": "RunAnywhere Wally Public Inference API",', '"openapi": "3.1.0",'],
         'RunAnywhere publishes a downloadable OpenAPI 3.1.0 document for its hosted inference API ("RunAnywhere Wally Public Inference API", server https://inference.runanywhere.ai/v1), advertised in the docs llms.txt under "OpenAPI Specs", with an x-runanywhere-contract block pinning the source JSON Schemas by sha256. Scope caveat: the spec covers the hosted Wally cloud API only; the on-device SDKs have no HTTP surface to describe.'),
        ('runanywhere-tryit-20261106', 'claimed-docs',
         'https://docs.runanywhere.ai/api-reference/create-a-chat-completion',
         ['data-testid="try-it-button"'],
         'The Mintlify API reference runs the "Try it" playground on the endpoint pages, generated from the OpenAPI document. Executing requires the caller\'s own key and runs against the production gateway.'),
        ('runanywhere-contract-20261106', 'claimed-docs',
         'https://docs.runanywhere.ai/wally-cloud/api.md',
         ['https://inference.runanywhere.ai/v1',
          'The service may reject fields outside the current contract.'],
         'The API base is versioned (https://inference.runanywhere.ai/v1) with a pinned contract ("The service may reject fields outside the current contract."). Key entitlement has per-environment semantics ("Entitlement is per environment, so a key that works in development can get a `403` in production for the same model id.") but no isolated test environment, test keys, or mock mode is documented, and the console playground runs on production and "keeps your recent conversations". No deprecation policy or changelog exists in the docs corpus.'),
    ],
    ('ai-assistants', 'kimi'): [
        ('kimi-openapi-spec-20261106', 'claimed-docs',
         'https://platform.kimi.ai/docs/openapi.json',
         ['"title": "Moonshot AI API"', '"url": "https://api.moonshot.ai"'],
         'The Kimi API Platform (platform.kimi.ai, the international developer platform for Moonshot AI\'s Kimi) publishes a downloadable OpenAPI 3.1.0 document ("Moonshot AI API", "API for Moonshot AI / Kimi large language model services", server https://api.moonshot.ai; /v1 chat completions, responses, Anthropic-compatible messages, batches, files, tool search, and models), referenced from the docs pages, plus a separate dated Admin API spec (row kimi-admin-openapi-20261106). Both download unauthenticated.'),
        ('kimi-admin-openapi-20261106', 'claimed-docs',
         'https://platform.kimi.ai/docs/admin-api/openapi.yaml',
         ['title: Kimi Admin API', 'version: 2026-10-20-beta'],
         '"The Kimi Admin API lets organization administrators manage members, invitations, projects, and inference API keys programmatically, and query billing, usage, and audit logs" - a second OpenAPI document (3.0.3) carrying a date-based version (2026-10-20-beta).'),
        ('kimi-tryit-20261106', 'claimed-docs',
         'https://platform.kimi.ai/docs/api/chat',
         ['data-testid="try-it-button"'],
         'The Mintlify-hosted API reference runs the "Try it" playground per endpoint (docs and runner load without login; executing needs an API key against the production endpoint). A separate login-gated console playground exists ("Compare models, tune parameters, test tool calls, and turn successful experiments into API requests with Kimi Playground.").'),
        ('kimi-deprecations-20261106', 'claimed-docs',
         'https://platform.kimi.ai/docs/models.md',
         ['## Deprecated Models', 'Deprecation expected in late December 2026.'],
         'The API is /v1 path-versioned (OpenAI- and Anthropic-compatible bases) and the platform publishes a dated model deprecation table with migration guidance covering API model IDs ("## Deprecated Models"; e.g. "No longer available to newly registered users; users registered before November 1 can continue using it. Deprecation expected in late December 2026."), and the Admin API spec itself is date-versioned. Caveats: no API changelog page and no standalone deprecation-policy document (the platform docs host also soft-200s unknown paths, so these absences are grounded in the full llms.txt index).'),
        # Review round (PR #644 P1s): direct evidence for the file-upload flow and the
        # key hierarchy's actual restriction mechanisms.
        ('kimi-file-qa-20261106', 'claimed-docs',
         'https://platform.kimi.ai/docs/guide/use-kimi-api-for-file-based-qa.md',
         ['The Kimi intelligent assistant can upload files and answer questions based on those files. The Kimi API offers the same functionality.'],
         '"The Kimi intelligent assistant can upload files and answer questions based on those files. The Kimi API offers the same functionality." The guide walks through uploading files, extracting their contents, and adding them to conversations for single-file or multi-file question answering, and the files API uploads "for text content extraction, image understanding, or video understanding" (pdf, doc, txt and more).'),
        ('kimi-key-hierarchy-20261106', 'claimed-docs',
         'https://platform.kimi.ai/docs/guide/org-best-practice.md',
         ['You can create multiple projects in an organization and multiple API keys in each project',
          'set project budgets and rate limits, manage members, configure an IP whitelist'],
         'Kimi documents key isolation and restriction at the project level: "You can create multiple projects in an organization and multiple API keys in each project", with the console used to "set project budgets and rate limits, manage members, configure an IP whitelist, and review organization and project consumption"; "API usage is tracked separately for each project, so you can monitor and manage spending by project", and each member creates their own key per project. Scope caveat: restrictions attach to projects (budgets, rate limits, IP whitelist, membership), not per-key permission scopes.'),
        # Review counter-check (PR #644 second round): the assistant app at kimi.com is
        # a distinct surface from the API platform; cells about assistant capabilities
        # must not inherit platform evidence.
        ('kimi-assistant-surface-20261106', 'claimed-docs',
         'https://www.kimi.com/llms.txt',
         ['name="kimi-release-version"'],
         'Scope of the kimi.com assistant surface: kimi.com serves its client-rendered app shell for every path including llms.txt (soft-200; the body is the JS application with a release-version meta tag, no agent-oriented docs file). The real llms.txt at platform.kimi.ai/docs/llms.txt belongs to the separate Kimi API Open Platform. The only assistant capability the citable vendor text documents is file upload with question answering ("The Kimi intelligent assistant can upload files and answer questions based on those files."); image and video understanding are documented for the API surface (the files API and the vision-model guide), not for the assistant app.'),
    ],
    ('government-services', 'irs'): [
        ('irs-ats-20261106', 'claimed-docs',
         'https://www.irs.gov/e-file-providers/modernized-e-file-mef-assurance-testing-system-ats',
         ['Modernized e-File (MeF) Assurance Testing System (ATS)',
          'scenarios and known issues are listed in the table below'],
         'The IRS documents a dedicated test environment for its Modernized e-File system: the Assurance Testing System (ATS), with per-form test scenarios and known-issues tables published per processing year, ATS-specific guidelines (Publication 1436) and test packages (Publication 5078), and separate ATS vs Production SSL certificate bundles. Caveats: using ATS requires IRS e-file application enrollment and e-Services sign-in, and ATS opens on dated seasonal windows per filing season.'),
        ('irs-mef-status-20261106', 'claimed-docs',
         'https://www.irs.gov/e-file-providers/modernized-e-file-mef-status',
         ['implemented in the MeF Assurance Testing System (ATS)',
          'complete any necessary changes in ATS prior to the Production deployment'],
         'The MeF status page distinguishes ATS from Production explicitly: changes are "implemented in the MeF Assurance Testing System (ATS)" ahead of Production, and "Transmitters, software developers, and state agencies are encouraged to review their implementations and complete any necessary changes in ATS prior to the Production deployment to avoid service disruptions."'),
        ('irs-mef-schemas-20261106', 'claimed-docs',
         'https://www.irs.gov/e-file-providers/modernized-e-file-mef-schemas-and-business-rules',
         ['Federal returns must conform to valid schema versions.',
          'Schemas and business rules are now available through the registered user portal and your e-services mailbox.'],
         'MeF interfaces are versioned via per-tax-year XML schema packages and business-rule releases ("Federal returns must conform to valid schema versions."), with Publication 4164 as the versioned developer guide. Distribution is registration-gated: "Schemas and business rules are now available through the registered user portal and your e-services mailbox", and the SOAP A2A toolkit (containing the WSDLs) is provided on email request. So the machine-readable interface definitions exist but are not publicly downloadable, the developer surface is PDF publications (no interactive reference), and version lifecycle detail lives behind the e-Services portal with no public deprecation-policy document. developer.irs.gov and api.irs.gov do not resolve.'),
    ],
    ('accounting', 'moneybird'): [
        ('moneybird-openapi-20261106', 'github',
         'https://raw.githubusercontent.com/moneybird/openapi/refs/heads/main/openapi.yml',
         ['openapi: 3.1.0', 'title: Moneybird API'],
         'Moneybird publishes a downloadable OpenAPI 3.1 document in its vendor GitHub organization (moneybird/openapi; "The Moneybird API allows you to interact with a Moneybird account in a RESTful manner.", servers https://moneybird.com/api/v2), linked from the reference pages via a "Download OpenAPI Specification" control. The spec carries dated versions (v2-<date>-<hash>) matching the published API changelog.'),
        ('moneybird-reference-20261106', 'claimed-docs',
         'https://developer.moneybird.com/api/contacts',
         ['title="Download OpenAPI Specification"'],
         'The developer reference is generated from the OpenAPI document (per-resource operation pages, a schema browser, request-body schema toggles, and copyable examples). Caveat: there is no runnable try-it console ("We will use curl in the examples in the documentation."); the examples are static.'),
        ('moneybird-sandbox-20261106', 'claimed-docs',
         'https://developer.moneybird.com/introduction.md',
         ['We offer special sandbox administrations to test your API integration',
          'https://moneybird.com/administrations/sandboxes/new'],
         'Moneybird documents self-serve sandboxes: "We offer special sandbox administrations to test your API integration. These administrations grant full access to all our features without the need to subscribe to our services. Sandbox accounts have limitations for production use: for example, invoices have watermarks." Creation is self-serve at the documented sandbox-creation URL behind a free Moneybird login ("make sure you have a Moneybird user account by registering on our website").'),
        ('moneybird-versioning-20261106', 'claimed-docs',
         'https://developer.moneybird.com/introduction.md',
         ['At this moment version',
          'always can expect equal behaviour from our API'],
         'The API is path-versioned with an explicit stability commitment: "The :version part of the path indicates the version of the API you want to use. At this moment version v2 is the only available version. By pointing to a specific version, we can make sure you always can expect equal behaviour from our API."'),
        ('moneybird-changelog-20261106', 'claimed-docs',
         'https://developer.moneybird.com/changelog/2026-11-06',
         ['API Changelog v2-'],
         'Moneybird maintains a dated, spec-diff API changelog (entries from 2014 through the present; each entry diffs two dated spec versions with per-endpoint changes such as "endpoint added" and added response properties). Caveat: no standalone deprecation-policy document; the policy surface is the versioned path, the equal-behaviour commitment, and the continuous changelog.'),
    ],
}

# Rows removed after review, (arena, product) -> evidence ids (none at wave start).
REMOVALS: dict = {}

# Excerpt updates (verify-then-replace, ef4d42d8 precedent). Pre-audit correction: the
# a-shell re-roll credited automation-rules-engine on the .profile startup hook alone;
# the context row now scopes that mechanism explicitly (the fellow-webhooks class).
UPDATES = {
    ('mobile-dev', 'a-shell'): [
        ('a-shell-relay-20261106',
         'https://raw.githubusercontent.com/holzschu/a-shell/master/README.md',
         ['## Run commands remotely with relay',
          'a-Shell is compatible with Apple Shortcuts, giving users full control of the Shell.',
          'a-Shell executes the file `.profile` if it exists'],
         'a-Shell is a local iOS terminal whose only programmatic surfaces are local: Apple Shortcuts actions ("a-Shell is compatible with Apple Shortcuts, giving users full control of the Shell." - Execute Command, Put File, Get File) and an optional built-in relay server ("relay is an optional HTTPS server built into the app. It is off by default."; "POST /run takes a UTF-8 command line as its body and requires Content-Length and X-Token"; "relay is intended for trusted networks"). There is no cloud API, no OpenAPI document (the relay endpoint is specified in README prose), no interactive reference, no test environment ("In-app commands share the app\'s sandbox and can read its credential files; file permissions do not isolate commands from one another."), and no API versioning or changelog (the app ships via the App Store; the only GitHub release is a 2022 precompiled-cpython drop; a-shell.app does not resolve). The only in-app automation hook is the `.profile` startup script ("When opening a new window, a-Shell executes the file `.profile` if it exists" - a customization mechanism where the user supplies all logic); no trigger-action rules surface exists.'),
    ],
}

# Hand-recorded counter-check/context rows a scheduled refresh must not clobber.
PRESERVE_IDS: set = {
    'virtualpostmail-developers-20261106',
    'virtualpostmail-api-gated-20261106',
    'kimi-assistant-surface-20261106',
}

# Fail-closed probe negatives (#502 convention): excerpts that assert dead or gated URLs
# must replay them on every run. Entries are either a URL (expects 404) or
# (url, {statuses}).
NEGATIVE_CHECKS = {
    'signifyd-versioning-20261106': [
        'https://developer.signifyd.com/main/changelog',
    ],
    'scrapingbee-postman-20261106': [
        'https://www.scrapingbee.com/openapi.json',
        'https://www.scrapingbee.com/documentation/openapi.json',
    ],
    'scrapingbee-builder-20261106': [
        ('https://app.scrapingbee.com/', {401}),
    ],
    'scrapingbee-deprecation-20261106': [
        'https://www.scrapingbee.com/changelog/',
    ],
    'virtualpostmail-developers-20261106': [
        ('https://api.virtualpostmail.com/', {401}),
        ('https://api.virtualpostmail.com/docs', {401}),
        ('https://api.virtualpostmail.com/swagger', {401}),
    ],
}

# Fail-closed recorded POST probes (none this wave).
POST_CHECKS: dict = {}

# Fail-closed TLS-mismatch checks (none this wave).
TLS_MISMATCH_CHECKS: dict = {}

_fetch_cache: dict = {}

# Courtesy pacing for hosts known to rate-limit bursts (the wave-8 fellow lesson).
HOST_DELAYS: dict = {}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    delay = HOST_DELAYS.get(urlparse(url).netloc)
    if delay:
        time.sleep(delay)
    r = subprocess.run(
        ['curl', '-sL', '--max-time', '60', '-A', UA, '-w', '\n---META %{http_code}', url],
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
