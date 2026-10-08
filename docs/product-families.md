# Product families — spike findings and decision log

**Date:** 2026-09-11. **Scope:** break multi-product vendors down product by product
(`data/product-families.json`, rendered at `/family/[id]` — see `lib/families.ts` for the data
contract), judge sub-products into existing arenas where one genuinely fits, and stay honest
everywhere else. No new arenas were created for this work.

## How the Stripe surface was mapped

We crawled docs.stripe.com (products index, per-line docs pages, `llms.txt`), stripe.com/pricing,
and stripe.com in September 2026. Every line below is active and sold today; none of the lines we
checked (Identity, Sigma, Atlas, Treasury, Financial Connections, Data Pipeline, Issuing, Capital,
Climate) is deprecated. New since our payments bring-up: **Managed Payments** (merchant of record)
and the **Agentic Commerce** suite (shared payment tokens, UCP/ACP protocol support, machine
payments — several pieces still in preview).

## Stripe decision table

| Product line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Payments (incl. Checkout, Payment Links, Elements, Link) | payments | **judged** (existing `stripe` entry) | This IS the parent entry; the checkout/links/elements stories are its story rows. |
| Terminal | mobile-payments | **judged** (existing `stripe-terminal`) | Already brought up before this spike — the precedent this work generalizes. |
| Atlas | legal-ops | **judged — NEW bring-up (`stripe-atlas`)** | legal-ops already ranks incorporation services (Clerky, Firstbase, LegalZoom); its incorporation / compliance / equity-paperwork themes are exactly Atlas's job. Full pipeline run 2026-09-11. |
| Billing | none / payments | page-only | No subscriptions/billing arena. The payments arena has a billing-invoicing theme, but those stories are already judged inside the parent `stripe` entry from the same docs.stripe.com/billing evidence — a standalone `stripe-billing` row would share ~90% of its evidence with the parent and double-list the same rails in one arena. |
| Invoicing | none | page-only | Sub-feature of Billing; `send-hosted-invoices` already judged under the parent. |
| Connect | none | page-only | No platform-payments arena; `marketplace-split-payments` judged under the parent. |
| Radar | none | page-only | No fraud-prevention arena (per instruction: don't create one); `fraud-screening-rules` judged under the parent. |
| Tax | none | page-only | No tax-compliance arena; `automatic-tax-calculation` judged under the parent. |
| Identity | auth-platforms? **No.** | page-only | Identity is KYC document/selfie verification. auth-platforms (Auth0, Clerk, WorkOS, Keycloak, Better Auth) is developer *login* infrastructure — none of its stories genuinely apply. Forcing it in would be the kind of vendor favor we don't do. |
| Treasury | startup-banking? **No.** | page-only | Treasury is an embedded-finance API for platforms; you cannot open a Treasury account as a startup. startup-banking ranks banks you sign up for (Mercury, Brex, Ramp, Wise, Relay). |
| Issuing | none | page-only | No card-issuing arena. |
| Capital | none | page-only | No merchant-financing arena. |
| Financial Connections | none | page-only | No bank-data-aggregation (Plaid-like) arena. |
| Revenue Recognition | accounting? **No.** | page-only | A revenue subledger over Stripe transactions, not general accounting (QuickBooks/Xero/Puzzle/Pilot's job). |
| Sigma | data-warehouses? **No.** | page-only | SQL over your own Stripe data only — not a warehouse. |
| Data Pipeline | data-pipelines? **No.** | page-only | Single-source export of Stripe's own data; that arena ranks general ELT platforms. |
| Managed Payments | payments | page-only | A merchant-of-record *configuration* of Payments, judged inside the parent entry. |
| Crypto / Stablecoins | none | page-only | No stablecoin-rails arena; several pieces in preview. |
| Agentic Commerce | none | page-only | No agentic-commerce arena yet; Stripe's agent surface (MCP server, agents.md) already scores inside the parent's agenticness stories. Watchlist: if an agentic-commerce arena ever exists, this is the first bring-up. |
| Climate | none | page-only | Carbon-removal purchasing — not a software category we rank. |
| Clerky | legal-ops | **judged** (existing `clerky`) | Already in legal-ops; per its vendor field it is a Stripe company, so it appears on the family page as an acquired line — which makes Atlas vs Clerky an all-Stripe battle. |

**Outcome of the "no cap" re-audit:** removing the 3-bring-up cap changed nothing — the honest
audit still yields exactly one new judged product (Atlas). Every other line either has no arena,
or forcing it into a near-miss arena (Identity→auth-platforms, Treasury→startup-banking,
Sigma→data-warehouses, Data Pipeline→data-pipelines, RevRec→accounting) would misrepresent what
the product is. Billing is the closest call and is documented above.

**Atlas result (same stories, no special treatment):** rank #4 of 6 in legal-ops, Overall score 11.3,
20/54 stories applicable (it na's out of e-signature and contract-lifecycle themes exactly like
the other incorporation specialists). It **loses its head-to-head with Clerky 4–5 (11 draws)** —
Stripe's own acquired company beats Stripe's product in our arena. That neutrality is the product.

## Fleet family sweep (data-only — no non-Stripe bring-ups)

Every family below maps sub-experiences to already-judged products where they exist, and honest
page-only cards (with a `note` explaining why) where they don't. Page-only lines were verified
against the vendor's own product pages/nav in September 2026 (all `docsUrl`s fetched HTTP 200).

| Family | Judged refs | Page-only lines (why) |
| --- | --- | --- |
| stripe | payments/stripe, mobile-payments/stripe-terminal, legal-ops/stripe-atlas, legal-ops/clerky | 17 lines — see table above |
| adyen | payments/adyen, mobile-payments/adyen-pos | Platforms, Risk Management, Issuing (no fitting arenas; platform/fraud stories judged under parent) |
| block | payments/square, mobile-payments/square, team-chat/buzz | Cash App, Afterpay (consumer/BNPL — no arenas) |
| mercury | startup-banking/mercury | IO Card, Treasury, Invoicing, Bill Pay, Personal Banking, Venture Debt, Command (mostly scored inside the banking entry's own stories; consumer/lending lines have no arena). Mercury Raise excluded — discontinued Sept 2025. |
| notion | project-management/notion | Calendar (a client, not booking infra — scheduling arena is a different job), AI & Agents (features of the judged workspace). **Notion Mail excluded — shutting down 2026-09-22.** |
| atlassian | project-management/jira, code-hosting/bitbucket | Confluence (no wiki arena), Trello (genuine PM competitor — bring-up candidate, out of this sweep's scope), Jira Service Management (no ITSM arena), Rovo (cross-product AI layer) |
| intercom | ai-support-agents/intercom-fin | Helpdesk, Proactive Support (human-agent tooling — no arenas) |
| shopify | ecommerce-platforms/shopify | POS (genuine mobile-payments competitor — bring-up candidate, out of scope here), Payments (not sold standalone), Shop app (consumer) |
| google | 6 refs: gemini, gemini-cli, google-adk, firebase, angular, jules | — |
| microsoft | 4 refs: copilot, windows, ms-teams, autogen | VS Code (no code-editor arena) |
| github | 3 refs: github, github-copilot, github-mobile | Actions (CI judged inside the code-hosting entry) |
| openai | 4 refs: chatgpt, codex, openai-agents, codex-plugins | API Platform (model APIs aren't an arena). **Sora excluded — consumer app shut down April 2026, API sunset Sept 2026.** |
| anthropic | 4 refs: claude, claude-code, claude-agent-sdk, anthropic-skills | Claude Developer Platform (same reason as OpenAI's) |
| vercel | 5 refs: vercel, v0, vercel-sandbox, vercel-ai-gateway, skills-cli | — |
| cloudflare | 3 refs: cloudflare, cloudflare-sandbox, cloudflare-ai-gateway | — |
| langchain | langgraph, langsmith | — |
| browserbase | browserbase, stagehand | — |
| pipedream | pipedream, pipedream-mcp | — |
| cursor | cursor, cursor-bugbot | — |
| perplexity | perplexity, perplexity-sonar | Comet (a consumer browser — browser-agents ranks automation frameworks) |

**Deliberately NOT families:** Devin (ai-coding + software-factory), Temporal (durable-workflows +
workflow-automation), and cubic (ai-code-review + ai-coding) are the *same product* judged in two
arenas, not separate experiences — a family page would fabricate a distinction the vendor doesn't
sell. Conglomerate-by-acquisition trees (Salesforce owning Slack + Intercom + Salesforce CRM;
Microsoft owning GitHub) are also not merged into one family: families follow product-line
branding, not cap tables — GitHub and Microsoft stay separate families, and Intercom is its own
family with its Salesforce ownership stated in the vendor field.

## Wave 2 (2026-09-14): Kong, Postman, Linear mapped; Mercury audited

Same rules as the Stripe spike: every vendor's REAL 2026 product nav/docs crawled first (all
`docsUrl`s fetch-verified), no forced sub-products, acquisitions flagged with `acquired`, and any
judged bring-up runs the full pipeline on the same stories as everyone else. Two new judged
products came out of this wave (`model-gateways/kong-ai-gateway`, `api-platforms/insomnia`) plus
one honest re-scope of an existing entry (see the Kong table).

### Kong decision table

Kong's `api-platforms` entry had been built as "Kong Inc., the whole company": 20 of its extra
doc URLs and 30 of its 71 evidence items were Insomnia's, and 35 of its 57 verdicts cited them.
Bringing Insomnia up as its own judged product while the parent kept claiming Insomnia's
collections/mocking/testing capabilities would double-list one product's evidence in one arena —
exactly what the Stripe Billing precedent forbids. So the bring-up came with a **re-scope**: the
`kong` entry is now Kong Gateway + Konnect (insomnia/inso evidence pruned, Konnect platform docs
added, all affected cells re-judged), and Insomnia competes as itself. Kong's client-side stories
now na/none out the way Bruno's gateway stories always have — the arena reads gateway vs clients
honestly instead of one row wearing both hats.

| Product line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Kong Gateway + Konnect | api-platforms | **judged** (re-scoped `kong` entry) | The gateway/platform IS the parent entry; gateway-traffic, catalog, portal, and CLI stories are its rows. |
| AI Gateway | model-gateways | **judged — NEW bring-up (`kong-ai-gateway`)** | 2.0 went GA 2026-09-01 as a dedicated runtime: OpenAI-compatible API over 15+ providers, semantic routing/fallbacks, token rate limits + pricing catalog, semantic caching, prompt guards, MCP/A2A proxying. A genuine LiteLLM/OpenRouter/Portkey competitor; the arena's stories fit line by line. |
| Insomnia | api-platforms | **judged — NEW bring-up (`insomnia`)** | Alive and actively sold (13.2.0 Aug 2026, Apache-2.0, own pricing tiers) — the 2024-25 deprioritization rumors don't hold. Competes with Postman/Bruno/Hoppscotch on the client half of the arena. Acquired 2019 — flagged. |
| Kong Mesh | none | page-only | No service-mesh arena. |
| Event Gateway | none | page-only | Kafka-native proxy; no event-streaming arena. |
| Ingress Controller & Operator | api-platforms? No. | page-only | A Kubernetes deployment form of the gateway, judged inside the parent — not a separate competitor. |
| Dev Portal / Service Catalog / Kong Identity | none | page-only | Konnect platform services; portal/catalog stories judged inside the parent. Identity is auth for Kong-managed traffic, not developer login infra (same reasoning as Stripe Identity ≠ auth-platforms). |
| decK & kongctl | none | page-only | Platform tooling, judged inside the parent's CLI/headless/declarative-config stories. |
| Metering & Billing (OpenMeter, acq. 2025) | none | page-only | No API-monetization arena. Acquisition flagged. |
| Volcano SDK | agent-frameworks? Not yet. | page-only | Real OSS TypeScript agent SDK (Oct 2025) but a young entrant; watchlist bring-up candidate, out of this wave's cap. |
| Context Mesh, KAi Agent, MCP Registry | none | not lines | Tech-preview/embedded Konnect features, not sold product lines — listing them would inflate the surface. |

**Results (same stories, no special treatment):** kong-ai-gateway debuts **#6 of 7** in
model-gateways (Overall score 19.3, just behind Cloudflare AI Gateway at 19.4) — the arena's OSS
incumbents keep their lead. Insomnia debuts **#2 of 5** in api-platforms (Overall score 34.3),
0.1 ahead of its own parent. The re-scoped kong entry moved **#1 → #3** (39.4 → 34.2): the old
#1 was partly built on Insomnia's docs, which is exactly what the re-scope existed to stop.
One churn audit was needed: adding Insomnia's Apache-2.0 LICENSE evidence (a contest-precedent
fix — the judge had weighed a 2016 "not open source" comment) re-rolled 8 cells of which only 2
cited the new evidence; the other 6 no-new-citation flips were reverted via cache-edit per the
standing churn policy.

### Postman decision table

| Product line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| API Client & Collections (incl. Spec Hub, Vault, VS Code, Interceptor) | api-platforms | **judged** (existing `postman` entry) | This IS the parent entry. |
| Fern | docs-platforms | **judged** (existing `fern` entry, now flagged acquired) | Acquired Jan 2026, kept as its own brand and product — already #2 in docs-platforms. The Clerky pattern: vendor field updated, `acquired` chip on the family page, zero judging changes. |
| Flows | workflow-automation? **No.** | page-only | Honest verdict: a real deployed automation runtime (webhooks, schedules, MCP-tool deploys, TS blocks) but with **7 app connectors total** vs Zapier's thousands, not sold standalone, credits-metered. It competes on the developer-HTTP slice; judging it in workflow-automation would misrepresent the category's job. Watchlist if a developer-automation arena ever splits out. |
| AI Agent Builder | agent-frameworks? **No — it no longer exists.** | not a line | The 2025 brand was quietly absorbed: its docs URL now 301s to a generic AI-features page; capabilities live on in Flows AI blocks and Agent Mode. Never was a LangGraph-style framework. |
| Agent Mode (Postbot's successor) | none | page-only | Built-in assistant, judged inside the parent's built-in-assistant/NL-command stories. Postbot docs redirect here — Postbot retired as a brand. |
| Mock Servers / Monitors / CLI+newman / API Network & MCP Catalog / API Catalog & Governance | none | page-only | All judged inside the parent entry's own stories (mock-servers-from-examples, scheduled-api-monitors, run-tests-in-ci, internal-api-catalog, lint-specs). newman is legacy with an official migration path. |
| Insights (Akita, acq. 2023) | observability? **No.** | page-only | Agent-based API-endpoint discovery, Enterprise-only — not general observability (metrics/logs/traces). Forcing it in would be a vendor favor. |
| SDK Generator (liblab, acq. 2025) | none | page-only | No SDK-generation arena. |
| AI Engineer | software-factory? **No.** | page-only | Early access (June 2026); an API-scoped autonomous engineer, not a software builder — and too early to judge either way. |
| Fabric Gateway | model-gateways? **Not yet.** | page-only | Real self-hosted AI/MCP/API gateway but early access, onboarding-gated, absent from pricing. Watchlist bring-up candidate once GA. |
| Passport | none | page-only | Beta credential-brokering proxy; no secrets-management arena. |
| Astro AI | none | not a line | Announcement-stage "agent OS" with no public docs depth — listing it would launder marketing into a product line. |

### Linear decision table

The honest finding: **one app, one data model, one pricing ladder.** Most named surfaces
(Insights, Dashboards, Customer Requests, Triage Intelligence, Priority Inbox, Documents,
Loops) are plan-gated features, so the family is deliberately small: the judged core plus the
three genuinely separable adoption surfaces. No judged bring-ups.

| Surface | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Linear (core app) | project-management | **judged** (existing `linear` entry) | The parent entry. |
| Asks | none | page-only | Genuinely separately adopted (non-Linear-users file tickets from Slack/email/forms) but no internal-ticketing/ITSM arena exists, and its output is ordinary Linear issues. |
| Linear for Agents (+ MCP server, Agent Sessions API) | none | page-only | Real platform surface (agents as assignable teammates; mcp.linear.app verified live) — but it's the same workspace's agent-facing half, already judged inside the parent's agenticness stories. |
| Coding Sessions | ai-coding? **No.** | page-only | Runs Claude Code/Codex in sandboxes from an issue — it orchestrates the ai-coding arena's contestants rather than competing with them; judging it there would double-count its engines. Economically distinct (AI credits), so it earns a family card, not a ranking. |
| Insights / Dashboards / Customer Requests / Triage Intelligence / Mobile / Loops | — | not lines | Plan-gated features or companion clients of the one app ("Product Intelligence" is literally a 307 redirect to Triage Intelligence now). Forcing them into cards would fabricate a product surface Linear doesn't sell. |

### Mercury re-audit (family existed; 8 → 13 lines)

Every prior line re-verified against mercury.com's September 2026 nav. Fixes: Business Banking's
docsUrl pointed at docs.mercury.com (which 302s to the **API reference**, not the banking page) —
now mercury.com/business-banking; Personal Banking's blurb now reflects the single $240/yr plan
(free with any business plan). IO card (1.5% cashback) and Treasury ($250k minimum) claims
re-verified current. Mercury Raise stays excluded (confirmed shut down Sept 2025; /raise now
redirects to the homepage).

| New line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Spend Management (Aug 2026) | none | page-only | Free-with-banking expense management; card/spend stories judged inside the parent. No expense-management arena. |
| Insights (Mar 2026) | none | page-only | AI analytics feature of the banking product. |
| SAFEs | legal-ops? **No.** | page-only | Only the SAFE-issuance slice of that arena's job — it would na out of nearly all 54 stories (incorporation, compliance, contracts); a 2-story contestant is noise, not signal. |
| Working Capital Loans | none | page-only | Ecommerce lending; no financing arena. |
| Central — Payroll & HR (acq. Apr 2026) | payroll? **Not yet.** | page-only, acquired-flagged | A payroll arena exists (Gusto, Rippling, Deel, Justworks) and Central genuinely does the job — but its public surface is a JS-rendered Framer site with no crawlable docs, and thin-crawl bias is our #1 recurring failure mode. Watchlist: bring up when a real docs surface exists. |
| Accounting (Teal, acq. 2024) | accounting? **No.** | not a line | No standalone bookkeeping product shipped — it's in-app automations + accounting *integrations* (QuickBooks/Xero/NetSuite). Revisit if "Mercury Accounting" ever ships. |

## Wave 3 (2026-09-14): the LLM labs, capability-centric

Founder brief: map each frontier lab's product surface completely, judged on **user stories, not
model benchmarks** — "what can a person actually do with this product." Every line below was
live-verified against the vendor's own pages on 2026-09-14 (all docsUrls fetch 200; discontinued
products confirmed against the vendor's own deprecations pages). Four judged bring-ups came out
of the honest audit: `design-tools/claude-design`, `ai-coding/antigravity`,
`ai-research-agents/notebooklm`, and `ai-assistants/grok` (new `xai` family). Blurbs on
`/family/anthropic|openai|google|xai` are written as user capabilities ("ship a PR end-to-end
from a terminal", "generate and edit images in conversation") — never benchmark language.

### Anthropic decision table (zero home-team treatment — the neutrality is the product)

| Line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Claude (app) | ai-assistants | **judged** (existing) | The parent entry — web/desktop/mobile are one product. |
| Claude Code | ai-coding | **judged** (existing) | — |
| Claude Design | design-tools | **judged — NEW bring-up (`claude-design`)** | Real product (claude.com/product/design, Anthropic Labs beta, broadly available on Pro/Max/Team): brief→prototypes/decks/collateral, design-system application, Claude Code handoff. Judged on the same 53 stories as Figma/Canva; it na/nones out of vector craft and multiplayer exactly as honesty demands. |
| Claude Cowork | none | page-only | A surface of the Claude app subscription (the Claude Code harness for non-coders); its delegate-work capabilities score inside the claude entry — a second row would double-list. |
| Claude in Chrome | browsers? **No.** | page-only | Browsers arena is planned, not live; browser-agents ranks developer automation frameworks (Comet precedent). |
| @Claude (Slack & Teams) | team-chat? **No.** | page-only | A bot inside team-chat products, not a chat platform — wrong axis. |
| Claude for Microsoft 365 | none | page-only | Integration surface of the subscription; no office-suite arena. |
| Claude Science | ai-research-agents? **No.** | page-only | Beta compute-and-analysis workbench; the arena ranks literature-review agents — neighboring but different job. |
| Claude Security | security-scanners? **Not yet.** | page-only | Enterprise public beta; that arena ranks GA scanners anyone can adopt. Watchlist. |
| Managed Agents / Developer Platform | none | page-only | Proprietary model platform surfaces (roadmap: frontier-model-apis). |
| Agent SDK, Skills | agent-frameworks / agent-skills | **judged** (existing) | — |

### OpenAI decision table

| Line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| ChatGPT | ai-assistants | **judged** (existing) | One consolidated app (Chat/Work/Codex modes) since the March 2026 desktop merge. |
| ChatGPT Work | none | page-only | The mode that replaced agent mode (July 2026); judged inside the chatgpt entry's long-running-work stories. |
| Image generation (GPT-Image-2.5 Sunburst/Flare) | image-generation? **Not live.** | page-only | The founder's "ChatGPT image 2.5" — verified current naming. A capability of ChatGPT + the API; no image-generation arena yet (roadmap updated with 2026 candidates). |
| Codex (+ Remote, SDK, App Server) | ai-coding | **judged** (existing) | — |
| Codex Security | security-scanners? **Not yet.** | page-only | Launched Sept 2026 — no record beyond launch week. Watchlist alongside Claude Security. |
| Agents SDK | agent-frameworks | **judged** (existing) | Agent Builder is deprecated (dies Nov 2026); the SDK is the live framework track. |
| Plugins (skills+MCP+UI directory) | agent-skills | **judged** (existing `codex-plugins`) | Renamed line — now runs in both ChatGPT and Codex; family card renamed to "Plugins". |
| ChatKit / Agents API / API Platform | none | page-only | Developer components and the proprietary platform (roadmap: frontier-model-apis). |
| **Sora** | — | **excluded** | Re-verified: app closed 2026-04-26; Videos API removed 2026-09-24. OpenAI currently has NO video product. |
| **ChatGPT Atlas** | — | **excluded** | Shut down 2026-08-09; capabilities folded into the ChatGPT desktop app. Removed from the browsers roadmap candidates. |
| Operator / ChatGPT agent / GPT Store / Ads platform | — | not lines | Twice-replaced (→Work), legacy channel, and a B2B ad surface with no arena, respectively. |

### Google decision table

| Line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Gemini app | ai-assistants | **judged** (existing) | Blurb now carries the capability set (Nano Banana image gen, Deep Research, Canvas, scheduled actions, Windows app). |
| Antigravity (2.0 / IDE / CLI / SDK) | ai-coding | **judged — NEW bring-up (`antigravity`)** | GA, free-tier, no waitlist; absorbed consumer Gemini CLI + Code Assist individual tiers in June 2026. Google's flagship dev surface belongs in the flagship arena. Rich llms.txt + .md docs recorded as probes. |
| Gemini CLI | ai-coding | **judged** (existing) | Still real for API-key/Code Assist users (npm ships nightly); blurb states the June 2026 consumer-tier transition honestly. |
| Gemini Notebook (NotebookLM) | ai-research-agents | **judged — NEW bring-up (`notebooklm`)** | Verified rename (notebook.google). NOT notes-knowledge: that arena is local-first personal knowledge graphs — a source-grounded research notebook there would na/none out of ~everything (Mercury-SAFEs precedent). In ai-research-agents its own-corpus grounding, inline citations, Deep Research, and report outputs are the arena's job. |
| Jules / ADK / Firebase / Angular | software-factory / agent-frameworks / baas / frontend | **judged** (existing) | ADK docsUrl moved to adk.dev. |
| AI Studio | vibe-coding? **Not yet.** | page-only | Build surface sits behind login; watchlist. |
| Flow (absorbed Whisk + ImageFX) | image/video-generation? **Not live.** | page-only | Roadmap candidates updated. |
| Gemini in Chrome | browsers? **Not live.** | page-only | Paid-tier feature of Chrome, and the arena is planned. |
| Gemini Code Assist | ai-coding? **No.** | page-only | Individual tiers ended June 2026; the enterprise remnant duplicates capability already judged via Antigravity/Gemini CLI. |

### xAI decision table (NEW family — founder: "work out grok's stories eg grok bot etc")

| Line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Grok (grok.com, iOS/Android, in X) | ai-assistants | **judged — NEW bring-up (`grok`)** | A major general assistant with the arena's whole story surface: files analysis, connectors (Gmail/Drive/Teams/Salesforce/custom MCP), voice, image+video via Imagine, org management. Vendor self-brands "SpaceXAI" in docs — recorded as-is. |
| Grok in X | none | page-only | The same assistant distributed inside X (X Premium): thread/reply summarization, real-time X context, image gen in the feed. Judged inside the grok entry where the arena's research stories apply. |
| Grok Build | ai-coding? **Deferred.** | page-only | A real Claude-Code-class terminal agent (beta May 2026, curl-installed, skills/plugins/worktrees/MCP). First-priority next-wave bring-up — deferred to keep this wave's judged additions at four, not excluded on the merits. |
| Grok Bot | none | page-only | GA Aug 2026 persistent AI teammates on cloud computers, bundled with Cursor plans — a computer-use-teammate category with no arena; judging it in browser-agents or software-factory would misstate the job. |
| Grok Imagine | image-generation? **Not live.** | page-only | Capability of Grok + API (mandatory watermark); roadmap candidate. |
| Grokipedia | none | page-only | Content destination, not a tool with rankable user stories. |
| xAI API | none | page-only | Roadmap: frontier-model-apis. |

### Meta and Mistral: no families this wave (both close calls, documented)

- **Mistral**: Le Chat is now **"Mistral Vibe"** (rebrand verified via mistral.ai redirects);
  Vibe for Code (ex-Mistral Code) is a real coding agent (PyPI `mistral-vibe`), Studio/La
  Plateforme the platform. A family needs a judged anchor; `vibe → ai-assistants` is the obvious
  next-wave bring-up (docs.mistral.ai llms.txt + api.mistral.ai clean 401 already probe-ready).
- **Meta**: Muse (personal agent, launched 2026-09-08) + Muse Code (terminal coding agent) +
  Meta AI app. The previous wave deferred Muse as too fresh; a founder directive ("go deep on
  muse.ai", 2026-09-14) brought Muse up in ai-assistants on its launch-week surface — the
  verdicts are honest about the thinness (#8/9, mostly none/na: login-walled product, no public
  API/docs/llms.txt — /pricing, /api, /docs, /llms.txt all 307 to the auth wall, verified). The
  muse.ai DOMAIN history is documented in data/arena-roadmap.json (video-hosting entry): the
  original muse.ai video startup rebranded to Skiv (skiv.com, March 2026) and the domain now
  serves Meta's agent. Still no Meta family — one judged product plus page-only candidates
  doesn't clear the bar; revisit with Muse Code. api.meta.ai answers keyless 401 — probe
  surface exists for Meta AI's developer edge, but that is not Muse's API, so Muse honestly
  records no probes (same call as ChatGPT/Claude/Gemini/Copilot).
- Cross-lab observation for the ai-coding roadmap: xAI (Grok Build), Meta (Muse Code), and
  Mistral (Vibe for Code) all now ship curl-installed terminal coding agents — three honest
  bring-up candidates queued for one wave.

## Wave 4 (2026-09-29): Ultrametric — the owner-product family (founder ask: "try to include Ultrametric into our rankings, for the official CLI/MCP we are building over at /v2")

The maximum-scrutiny case: this is the maintainers' OWN company (governance/REVIEW_POLICY.md
owner-product rules — affiliation disclosure on every surface, favorable outcomes need
over-justification). Everything below was crawl-verified on 2026-09-29; no capability is taken
from our own roadmap language. **Honest verdict: no judged bring-up.** The product the founder
asked about does not publicly exist yet, and the surfaces that DO exist have no arena where they
honestly compete. New `ultrametric` family (`/family/ultrametric`, tagline carries the disclosure);
Foreloop and AFK stamped `familyId`.

What exists publicly today (every URL fetched, statuses recorded):

- npm `ultrametric-cli` and `ultrametric-mcp`: **registry 404 — unpublished.** The packages moved
  to a dedicated private repo (github.com/ultrametricai/ultrametric-cli and …/ultrametric-mcp both
  404 keyless); FOUNDER-ASKS already records the move as "publishes happen from there".
- The retired first-party MCP: `POST https://ultrametric.ai/mcp` → **410**
  `{"error":"gone","message":"The ProductArena MCP server is retired… A first-party Ultrametric
  MCP is coming."}` (worker handler from the 2026-09-23 retirement); GET /mcp 307s home. A
  recorded honest negative, not a capability.
- The data API is real and live: `/data/categories.json` 200 (50,894 B), `/openapi.json` 200
  ("Ultrametric Data API", read-only static JSON, keyless), `/llms.txt` 200 (34,314 B).
- npm `ultrametric` 0.4.1 (published 2026-09-24) is live — but it is the **company-records CLI**
  ("company setup guidance and reusable company records for your active AI agent"), a different
  product from the /v2 rankings CLI/MCP despite sharing the npm scope. Not conflated. (Its
  npmjs.com page 403s keyless — the platform bot-block convention from assistant-plugins.json;
  the registry API is the verified source.)

| Line | Arena fit | Decision | Why |
| --- | --- | --- | --- |
| Foreloop | software-factory (+ product-feedback) | **judged** (existing, #7/10 and #4/4) | Already judged with affiliation disclosure and the 2026-09-21 adversarial bias audit (14 cells corrected). One family line, software-factory ref — same product judged in two arenas is one line (Devin precedent). |
| AFK | workflow-automation | **judged** (existing, #11/11) | Honest pre-launch last place stands. |
| Ultrametric Rankings & Data API | mcp-infrastructure? ai-search-apis? api-platforms? search-infra? **No, all.** | page-only | mcp-infrastructure needs a live MCP surface (ours 410s); ai-search-apis is web search for agents; api-platforms ranks API clients/gateways; search-infra ranks search engines. What's live is a read-only single-source export of this site's own rankings — the Stripe Sigma / Data Pipeline precedent — and any verdict on our own platform would be self-refereeing. |
| Ultrametric CLI & MCP (the /v2 product) | mcp-infrastructure? **Not yet.** | page-only | Nothing to judge: npm 404 × 2, repo private, endpoint 410. Listing it as judged would be fabricated capability on our own product — the exact thing the owner-product policy exists to prevent. Watchlist: first-priority bring-up into mcp-infrastructure when a live endpoint + published package exist, with the mandatory adversarial bias audit (foreloop/afk flip-reversion precedent). |
| Ultrametric (company-records CLI, npm `ultrametric`) | legal-ops? agent-skills? **No.** | page-only | Shipped and real, but legal-ops ranks incorporation/filing platforms — guidance + records would na out of nearly every story (Mercury SAFEs precedent) — and agent-skills ranks skill collections/catalogs, not one vendor-scoped setup tool. Also out of the founder ask's scope; kept distinct per its own npm description. |

Stale-evidence note for the next AFK spike: `data/spike-queue.json`'s AFK entry records "no
llms.txt on https://ultrametric.ai (recorded absence)" from 2026-09-25 — `/llms.txt` now serves
200. Left untouched here (recorded evidence is never rewritten); the next spike pass should
re-probe and supersede it.

## Mechanics (for the next person)

- `lib/schemas.ts`: `Product.familyId` (optional, display-only, never in the judge's cellHash —
  stamping it busts no caches). `lib/__tests__/families.test.ts` keeps stamps and family
  structure in sync both directions and every ref resolving.
- `/family/[id]` pulls rank + Overall score live from each ref's `rankings.json` at build time and
  links each judged line's arena battle pages; page-only lines render their honest `note`, never a
  score. `components/FamilySection.tsx` renders the "Product lines" block on every member
  product's page (generic — no vendor special-casing). Both are in the sitemap via
  `loadFamilies()`.
- Stripe Atlas bring-up: keyless recorded probes live in `pipeline/probes/legal-ops.ts`
  (EXPECTED_TOTAL_PROBES 413 → 415); evidence is 12 claimed-docs + 20 community + 3 probe items;
  confidence intervals recomputed for legal-ops.
- Wave 2 bring-ups: keyless recorded probes in `pipeline/probes/api-platforms.ts` (insomnia) and
  `pipeline/probes/model-gateways.ts` (kong-ai-gateway) — EXPECTED_TOTAL_PROBES 415 → 419;
  confidence intervals recomputed for both arenas. The kong re-scope precedent: when a family
  bring-up splits a product out of a parent entry judged in the SAME arena, the parent's evidence
  must be pruned to its own scope and its cells re-judged — one product's docs never back two rows
  in one arena.
- Wave 3 bring-ups: recorded probes in `pipeline/probes/ai-coding.ts` (antigravity),
  `pipeline/probes/design-tools.ts` (claude-design), and two NEW arena modules
  `pipeline/probes/ai-assistants.ts` (grok) and `pipeline/probes/ai-research-agents.ts`
  (notebooklm) — EXPECTED_TOTAL_PROBES 428 → 437; confidence intervals recomputed for all four
  arenas. Gotcha: antigravity.google serves compressed bytes even without Accept-Encoding — probe
  curls there need `--compressed`.

## 2026-10-08 family-judgement wave (founder GO)

Founder GO 2026-10-08: run the judgement on the registries' "not yet judged" members. Every
page-only line was re-mapped against the arenas live TODAY (several notes predated arenas that
now exist); six members judged in under the standard pipeline, incumbents byte-identical via the
judge cellHash cache.

| Member | Arena | Result | Why now |
| --- | --- | --- | --- |
| Grok Build (xAI) | ai-coding | #3/15, aiEra 47.9 | Its own note queued it first-priority; client open-sourced (xai-org/grok-build, Apache-2.0, 27.3k stars). Recorded keyless probe: docs-md mirror (EXPECTED_TOTAL_PROBES 1029 → 1030). |
| Trello (Atlassian) | project-management | #7/7, aiEra 18.0 | Note already called it "a genuine project-management competitor", deferred only because the prior sweep was Stripe-scoped. Honest low: thin agent surface next to Linear/Asana. |
| Shopify POS | mobile-payments | #5/5, aiEra 18.7 | Same deferral note. help.shopify.com HTML is bot-walled but serves full `.md` mirrors — corpus built from those plus shopify.dev. |
| Adyen Risk Management | fraud-prevention | #2/6, aiEra 28.0 | Old note said "no fraud-prevention arena yet" — stale: the arena is live (stripe-radar, sift, signifyd, forter, riskified). |
| Adyen Agentic | agentic-commerce | #8/8, aiEra 21.8 | Old note said "no separate agentic-commerce arena" — stale: the arena is live with the Stripe/Shopify/PayPal agentic lines. Honest low: ACP/UCP integration docs, no judged runtime surface of its own yet. |
| Stripe Invoicing | billing-subscriptions | #4/8, aiEra 32.6 | Founder-directed mapping. Separately priced per paid invoice (0.4%/0.5%) and usable without subscriptions — the TaxJar/Stripe Tax same-vendor precedent, corpus scoped to invoicing docs only. |

na-harmonization audit: zero flips applied. Every new-product `na` shares the na with incumbent
peers (grok-build's `agentic-mcp-server` na sits beside 8 incumbent na's — the judge prompt's own
agent-role boundary; trello's 6 na cells each have incumbent na peers on the same story), so the
ByteAsk "left as judged" precedent governs. The product-scoped audit tool is
`pipeline/scripts/na-harmonize-product.ts`; the arena-wide dry run also surfaced 21 pre-existing
incumbent na/none splits in project-management, left for a dedicated harmonization lane.

Still page-only after this wave, with the arena that WOULD fit (arena-roadmap candidates, not
invented here): xAI API, OpenAI API Platform/Agents API, Claude Developer Platform/Managed
Agents → frontier-model-apis (planned); Grok Imagine, OpenAI Images, Google Flow →
image-generation / video-generation (planned); Claude in Chrome, Gemini in Chrome, Comet →
browsers (planned); VS Code → code-editors (planned); Confluence → docs-workspaces (planned);
Intercom Helpdesk → helpdesk (planned); Jira Service Management, Linear Asks → itsm (planned);
Braintree → payments-infra (planned); Kong Mesh → service-mesh (no roadmap entry); Postman SDK
Generator → sdk-generators (planned); Grokipedia, Cash App, Venmo, Shop, Afterpay, Stripe
Capital/Climate, Mercury lending lines → no honest arena or roadmap slot today. Next-tranche
judge candidates (existing arenas, gated on their own notes): Codex Security and Claude Security
→ security-scanners (young record / enterprise beta), Volcano SDK → agent-frameworks, Google AI
Studio → vibe-coding (login-walled Build mode), Postman Fabric Gateway → model-gateways (early
access), Mercury Central → payroll (crawl-gap spike first).
