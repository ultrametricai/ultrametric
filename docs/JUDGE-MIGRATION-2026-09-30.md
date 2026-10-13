# Judge-model migration — 2026-09-30 — sonnet-5 → claude-opus-5-5 (prompt v4)

Fleet re-judge under the new default judge, per the adopted docs/OPUS-5-5-JUDGE-PILOT.md
recommendation. **Every verdict flip and score move in this wave reflects the judge change,
not product changes.** The churn policy's no-new-evidence revert rule was deliberately not
applied (memo §5.4); instead each arena's score-history.jsonl entries from the wave carry
`"note": "judge-migration-2026-09-30: sonnet-5 → opus-5-5 (prompt v4)"`. Rank moves below
are judge-scale/judge-reasoning moves and must be read as such.

## Fleet summary

| Metric | Value |
|---|---|
| Arenas re-judged | 94 |
| Cells re-judged | 33,789 (33,789 comparable to a sonnet-5 baseline cell) |
| Exact verdict agreement vs sonnet-5 | 75.5% |
| Verdict flips (labeled 'judge model migration') | 8,272 |
| Batch API requests / interactive fallback calls | 32,753 / 18 |
| Measured migration spend (usage metadata) | $570.84 |

Top flip transitions fleet-wide (the Opus fingerprint — na/disputed collapse, none→partial workaround credit):

`none→partial` 2548 · `na→none` 1990 · `partial→full` 1718 · `full→partial` 811 · `partial→none` 331 · `disputed→partial` 291 · `na→partial` 204 · `disputed→full` 135 · `none→na` 117 · `disputed→none` 39 · `none→full` 26 · `partial→na` 25

## Biggest movers (judge-scale explanation)

These are the products whose Overall score (aiEra) or rank moved most at the migration
boundary. The shifts follow directly from the three systematic judge behaviors the pilot
characterized: (1) Opus almost never reaches `na`, growing the score denominator for
narrow products; (2) it reserves `disputed` (0.3x credit) for hard contradictions, so
products that carried anecdotal disputes recover credit; (3) it grants `partial` for
documented workaround-level delivery, shifting the whole scale up a few points.

| Arena / product | aiEra | rank |
|---|---|---|
| startup-law-firms / lowenstein-sandler | 53.3 → 9.2 (-44.1) | #1 → #2 |
| processors / intel-core-ultra-7-258v | 57.2 → 24 (-33.2) | #1 → #2 |
| gpus / nvidia-rtx-pro-6000 | 41.8 → 13.3 (-28.5) | #1 → #8 |
| frontend-frameworks / react | 52.5 → 33.1 (-19.4) | #1 → #1 |
| startup-law-firms / trilegal | 46.7 → 28 (-18.7) | #2 → #1 |
| gpus / amd-rx-9070-xt | 32.9 → 16 (-16.9) | #3 → #4 |
| local-llm-runtimes / vllm | 39.7 → 25.1 (-14.6) | #1 → #5 |
| processors / apple-m4-max | 5.3 → 19.7 (+14.4) | #7 → #3 |
| mobile-dev / blink-shell | 21.5 → 7.2 (-14.3) | #1 → #6 |
| gpus / nvidia-rtx-5070-ti | 27.4 → 14.2 (-13.2) | #6 → #6 |
| frontend-frameworks / svelte | 44.4 → 31.9 (-12.5) | #2 → #2 |
| startup-banking / wise | 31.2 → 18.9 (-12.3) | #4 → #6 |
| gpus / nvidia-b200 | 28.3 → 16.2 (-12.1) | #4 → #3 |
| game-engines / bevy | 15.7 → 27.2 (+11.5) | #8 → #7 |
| inference-providers / fireworks-ai | 26.4 → 15.4 (-11) | #3 → #6 |

Largest rank moves:

| Arena / product | rank | aiEra |
|---|---|---|
| gpus / nvidia-rtx-pro-6000 | #1 → #8 (-7) | 41.8 → 13.3 |
| payments / airwallex | #2 → #8 (-6) | 43.4 → 37.2 |
| agent-frameworks / mastra | #7 → #2 (+5) | 32.8 → 37.7 |
| mobile-dev / blink-shell | #1 → #6 (-5) | 21.5 → 7.2 |
| agent-frameworks / google-adk | #2 → #6 (-4) | 36.7 → 31 |
| agent-frameworks / openai-agents | #4 → #8 (-4) | 36 → 28.5 |
| agentic-commerce / shopify-ucp | #6 → #2 (+4) | 27.5 → 33 |
| agentic-commerce / visa-intelligent-commerce | #2 → #6 (-4) | 33.4 → 23.9 |
| banking-data-apis / truelayer | #2 → #6 (-4) | 26.2 → 24.8 |
| design-tools / spline | #1 → #5 (-4) | 32.3 → 25.8 |
| design-tools / rive | #2 → #6 (-4) | 31 → 25.4 |
| durable-workflows / temporal | #1 → #5 (-4) | 42.7 → 34 |
| email / gmail | #6 → #2 (+4) | 18.8 → 29.7 |
| local-llm-runtimes / vllm | #1 → #5 (-4) | 39.7 → 25.1 |
| processors / apple-m4-max | #7 → #3 (+4) | 5.3 → 19.7 |

## Own-product bias audit (every favorable flip on owner/affiliated rows)

The judge is an Anthropic model and the fleet contains Anthropic products (claude-code,
claude-agent-sdk, anthropic-skills, claude in ai-assistants and frontier-models,
claude-design) and Ultrametric products (Foreloop in product-feedback and software-factory,
AFK in workflow-automation). Every FAVORABLE migration flip on those rows was adversarially
re-read against its cited evidence; unfavorable/lateral moves were kept as-is. Corrections
carry dated bracketed audit notes in their rationales (committed to verdicts.json AND the
judge cache, so future re-judges preserve them). Full per-cell reasoning is in the per-arena
commit messages.

| Row (arena) | favorable flips | kept | corrected | net aiEra / rank |
|---|---|---|---|---|
| claude-code (ai-coding) | 16 | 10 | 6 (4 reverted, 2 quality-trimmed) | 40.4 → 43.5, #3 = |
| foreloop (product-feedback) | 8 | 1 | 7 reverted | 16.1 → 14.4, #4 = |
| afk (workflow-automation) | 6 | 1 | 5 reverted | #11 of 11 = |
| claude-agent-sdk (agent-frameworks) | 16 | 13 | 3 reverted | 42.3 → 43.9, #1 = |
| claude-design (design-tools) | 15 | 9 | 6 (5 reverted, 1 quality-trimmed) | 18.4 → 14.5, #8 = |
| claude (frontier-models) | 11 | 8 | 3 reverted | 40.8 → 36.7, **#1 → #2 (grok takes #1)** |
| foreloop (software-factory) | 17 | 11 | 6 reverted | 23.8 → 22.4, #7 → #9 |
| anthropic-skills (agent-skills) | 16 | 13 | 3 corrected | 30.6 → 28.0, #1 = |
| claude (ai-assistants) | 9 | 6 | 3 reverted | 28.6 → 29.0, **#2 → #4** |
| **Total** | **114** | **72 kept** | **42 corrected** | — |

Reversion standard: a favorable flip on an owner row was reverted when the Opus rationale
itself conceded the story's core element or qualifier was absent (workaround / in-principle /
adjacency credit — the pilot memo's flip-read-1 failure mode), when a probe result was
affirmative counter-evidence, or when the preserved human-adjudication precedent set a
stricter bar (AFK's marketing-only cap; Foreloop's probe-grade MCP bar). Kept flips rest on
direct, on-story, first-party (often probe-tier or corroborated) evidence, or match
adjudications in the adopted pilot memo (spot-reads 2, 5, 10). Counter-signals, stated
plainly: the owner rows' NET movement under their own vendor's judge was mostly DOWN or flat —
claude lost #1 in frontier-models to grok and fell #2 → #4 in ai-assistants, claude-design and
anthropic-skills and both Foreloop rows fell, and across the nine rows unfavorable/lateral
moves (kept untouched) outnumbered favorable ones.

## Protected hand-adjudicated cells

The 18 committed human adjudications (16 Foreloop product-feedback bias-audit corrections of
2026-09-21/24, 2 AFK workflow-automation governance notes) were extracted into
docs/JUDGE-MIGRATION-2026-09-30-worklist.json BEFORE the re-judge and re-applied verbatim
after each arena's ingest — human adjudications outrank any model. The worklist records what
the fresh opus-5-5 judge said on every protected cell: it independently reached the
adjudicated verdict on 9 of 18 (including every Foreloop na→none reclassification and AFK's
agentic-mcp-client none), and was overridden on the other 9 (it wanted upgrades on
agentic-ai-insights/headless/official-cli/embed-feedback-widget, partial q3 on the
probe-gated agentic-mcp-server cell, and full q7 on AFK's agentic-nl-commands). The memo's
'ai-coding: 23' and ai-code-review counts were verified to be /audit/i keyword matches on
ordinary product language ('audit logs'), not adjudication markers — recorded in the
worklist's extraction notes; the superseded README §9 ai-coding adjudications fell under this
wave's own-product audit instead (and its live-app-debugging and copilot-MCP precedents were
re-applied there where Opus repeated the old errors).

## Noise machinery re-measured under the new judge (memo §5.5)

The transition matrices in data/*/uncertainty.json and the score-interval bands were measured
from SONNET re-rolls and became invalid at the migration boundary (each entry's first
judgment is the cached verdict, which the migration replaced). Per the memo's prescription, a
~100-cell sample was double re-rolled under opus-5-5: 102 decisive cells across three
close-race arenas — accounting (15% any-disagreement), vector-databases (3%), meeting-ai (9%)
— mean ≈9%, the same ballpark as sonnet-5's documented ~9% fleet re-roll rate, so the judge
change does not add re-roll noise (go). The 18 remaining sonnet-era uncertainty.json files
were deleted rather than silently blended into the new noise model (tolerant-optional display:
those arenas render no agreement panel until the story-runner re-measures them under the new
judge), and every arena's score-intervals.json was rebuilt from the opus-measured model —
median aiEra band width 3.0 points (down from ~4.5 under sonnet, consistent with the memo's
narrower-profile prediction). Sample cost ≈$9 interactive, per the memo's ~$8 estimate.

## Per-arena top-5 before → after

Rank arrows show the pre-migration rank of the product now holding each slot; aiEra pairs
are pre → post migration. Full leaderboards live in each arena's committed rankings.json;
per-arena flip stats in the table.

| Arena | cells | flips | exact agr. | top 5 after (move · aiEra before→after) |
|---|---|---|---|---|
| **Accounting & Bookkeeping** (`accounting`) | 583 | 117 | 79.9% | digits (+1 · 39.4→38.8)<br>zoho-books (-1 · 40→38.3)<br>quickbooks (+1 · 27.7→31.7)<br>xero (-1 · 30.5→31)<br>puzzle (+1 · 24.5→26.1) |
| **Agent Frameworks & SDKs** (`agent-frameworks`) | 459 | 125 | 72.8% | claude-agent-sdk (= · 42.3→43.9)<br>mastra (+5 · 32.8→37.7)<br>pydantic-ai (+2 · 35.5→35.6)<br>crewai (+2 · 34.2→35)<br>smolagents (-2 · 36.5→33.8) |
| **Agent Sandboxes & Code Execution** (`agent-sandboxes`) | 408 | 107 | 73.8% | e2b (+1 · 34.1→36.3)<br>daytona (+1 · 33.4→36.1)<br>maritime (+2 · 28.7→33.7)<br>blaxel (-3 · 37→33.4)<br>vercel-sandbox (+1 · 24.9→27.3) |
| **Agent Skills & Extensions** (`agent-skills`) | 312 | 107 | 65.7% | anthropic-skills (= · 30.6→28)<br>mattpocock-skills (+1 · 21.6→24)<br>codex-plugins (+3 · 15.8→23)<br>gstack (+1 · 17→22.8)<br>superpowers (-3 · 25→20.7) |
| **Agentic Commerce** (`agentic-commerce`) | 392 | 136 | 65.3% | stripe-agentic-commerce (= · 37.3→35.3)<br>shopify-ucp (+4 · 27.5→33)<br>paypal-agent-commerce (+2 · 28.5→31.3)<br>coinbase-x402 (= · 31.4→27.7)<br>crossmint (-2 · 31.6→26.6) |
| **AI Assistants** (`ai-assistants`) | 520 | 108 | 79.2% | chatgpt (= · 38.3→37.5)<br>grok (+1 · 26.1→31.6)<br>perplexity (+2 · 25→30.8)<br>claude (-2 · 28.6→29)<br>jo (+1 · 22.7→28.6) |
| **AI Code Review** (`ai-code-review`) | 318 | 72 | 77.4% | coderabbit (= · 36.6→38.9)<br>greptile (+2 · 27.1→28.5)<br>cubic (= · 27.8→26.2)<br>qodo (-2 · 28.4→24.9)<br>graphite (= · 25.2→23.7) |
| **AI Coding Agents** (`ai-coding`) | 1036 | 265 | 74.4% | cursor (= · 52.1→59.8)<br>opencode (= · 47.4→50.1)<br>claude-code (= · 40.4→43.5)<br>cline (= · 39.8→43.2)<br>antigravity (+1 · 36.8→39.1) |
| **AI Memory Layers** (`ai-memory`) | 342 | 68 | 80.1% | mem0 (= · 46.8→45.1)<br>letta (+1 · 42.2→42)<br>airweave (-1 · 42.4→41.3)<br>cognee (= · 30.9→35.1)<br>supermemory (= · 29.4→32.4) |
| **AI Research Agents** (`ai-research-agents`) | 258 | 69 | 73.3% | elicit (= · 30.8→30.3)<br>futurehouse (= · 25.6→26.4)<br>consensus (= · 18.3→19.4)<br>undermind (= · 17.6→19.1)<br>notebooklm (+1 · 8.3→9.8) |
| **AI Search APIs** (`ai-search-apis`) | 250 | 64 | 74.4% | tavily (= · 38.5→34.9)<br>perplexity-sonar (= · 32.7→32.7)<br>exa (= · 31→29.8)<br>brave-search-api (= · 31→24.2)<br>serpapi (= · 22→23.6) |
| **AI Customer Support Agents** (`ai-support-agents`) | 318 | 65 | 79.6% | pylon (= · 36.8→36.7)<br>intercom-fin (+2 · 29.2→32.8)<br>parahelp (= · 31→28.4)<br>lorikeet (-2 · 31.2→25.1)<br>sierra (= · 14.9→18.7) |
| **API platforms** (`api-platforms`) | 285 | 82 | 71.2% | postman (+1 · 40.1→38.4)<br>kong (-1 · 43.2→37.1)<br>bruno (= · 34.1→36.2)<br>hoppscotch (+1 · 33.1→31)<br>insomnia (-1 · 33.7→30) |
| **Applicant Tracking** (`applicant-tracking`) | 260 | 51 | 80.4% | ashby (+1 · 28.7→29.5)<br>workable (-1 · 35.4→26.3)<br>recruitee (= · 22.5→18.8)<br>lever (+1 · 13.5→18.8)<br>greenhouse (-1 · 16.9→15.2) |
| **Auth & Identity** (`auth-platforms`) | 280 | 80 | 71.4% | clerk (= · 32.3→35.2)<br>workos (+2 · 23.1→32.3)<br>better-auth (-1 · 31.1→32.2)<br>auth0 (-1 · 29.5→29.1)<br>keycloak (= · 22.6→29) |
| **Authenticator Apps** (`authenticator-apps`) | 440 | 108 | 75.5% | bitwarden (= · 37.3→33.3)<br>1password (= · 28→27.9)<br>ente-auth (= · 17.8→16.7)<br>proton-pass (= · 16.1→14.9)<br>2fas (= · 12.7→10.8) |
| **Backend as a Service** (`backend-as-a-service`) | 204 | 39 | 80.9% | supabase (= · 56.3→62.4)<br>appwrite (= · 38.6→39.9)<br>convex (+1 · 30.7→31.5)<br>firebase (-1 · 35.4→31.2) |
| **Banking as a Service** (`banking-as-a-service`) | 318 | 96 | 69.8% | column (= · 33.9→30.4)<br>increase (= · 30→30)<br>synctera (= · 25.2→24.3)<br>treasury-prime (+1 · 20.8→22.1)<br>stripe-treasury (-1 · 21.4→21.4) |
| **Banking Data APIs** (`banking-data-apis`) | 371 | 87 | 76.5% | mx (= · 28.5→32.1)<br>yapily (+1 · 26→28.7)<br>mastercard-open-finance (+1 · 25.2→28.4)<br>plaid (+2 · 17.8→26.1)<br>stripe-financial-connections (= · 22.4→25.6) |
| **Billing & Subscriptions** (`billing-subscriptions`) | 371 | 64 | 82.7% | lago (= · 48.7→46.6)<br>chargebee (+1 · 33.9→36.1)<br>revenuecat (-1 · 36.7→35.1)<br>metronome (+1 · 24.9→30.2)<br>stripe-billing (-1 · 29.6→26.9) |
| **Browser Automation for Agents** (`browser-agents`) | 364 | 93 | 74.5% | steel (= · 41.1→37.1)<br>browser-use (+3 · 25.1→34.3)<br>skyvern (-1 · 30.8→34.2)<br>stagehand (= · 26.1→32.7)<br>notte (+1 · 24.4→29.9) |
| **Card Issuing Platforms** (`card-issuing`) | 265 | 71 | 73.2% | lithic (= · 35.4→32.7)<br>stripe-issuing (= · 34.6→26.7)<br>marqeta (+1 · 31.9→26.2)<br>highnote (-1 · 33.3→23)<br>adyen-issuing (= · 23.6→15) |
| **Cloud Platforms** (`cloud-platforms`) | 196 | 49 | 75% | aws (= · 32.6→28.8)<br>google-cloud (+2 · 23.5→26.5)<br>oracle-cloud (-1 · 27.3→25.4)<br>azure (-1 · 24→24.3) |
| **Cloud Storage** (`cloud-storage`) | 196 | 48 | 75.5% | box (= · 37→30.4)<br>google-drive (+1 · 19.6→22.5)<br>dropbox (-1 · 22.6→22)<br>onedrive (= · 14.3→15.1) |
| **Code Hosting** (`code-hosting`) | 288 | 64 | 77.8% | gitlab (= · 55.5→52.8)<br>github (= · 43.5→42.6)<br>gitea (= · 30.2→28.4)<br>bitbucket (= · 12.5→16.5) |
| **Compliance Automation** (`compliance-automation`) | 324 | 63 | 80.6% | vanta (= · 36.5→32.2)<br>secureframe (+1 · 20.7→21.8)<br>drata (-1 · 20.8→20.5)<br>thoropass (+1 · 17→17.1)<br>sprinto (-1 · 17.1→13.4) |
| **CRM** (`crm`) | 204 | 47 | 77% | twenty (= · 58.7→57.1)<br>hubspot (= · 41.4→46.1)<br>attio (= · 36.8→36.3)<br>salesforce (= · 33.6→31.6) |
| **Customer Data Platforms** (`customer-data-platforms`) | 255 | 57 | 77.6% | jitsu (= · 41.6→46.8)<br>hightouch (= · 30.6→35)<br>rudderstack (= · 29.5→31.1)<br>segment (= · 29.2→27.3)<br>mparticle (= · 18.1→15) |
| **Data Pipelines & ELT** (`data-pipelines`) | 265 | 59 | 77.7% | dlt (= · 47.3→44.9)<br>airbyte (+1 · 28.5→38.2)<br>dagster (-1 · 38.3→36.3)<br>fivetran (= · 26.9→30.7)<br>meltano (= · 20.9→26.4) |
| **Data Warehouses & Lakehouses** (`data-warehouses`) | 216 | 44 | 79.6% | databricks (= · 45.8→43.9)<br>snowflake (= · 43.3→40.6)<br>motherduck (= · 38.3→40)<br>bigquery (= · 37.6→32.6) |
| **Design & Prototyping** (`design-tools`) | 424 | 106 | 75% | figma (+2 · 29.8→36.3)<br>penpot (+2 · 29.5→28.4)<br>sketch (+3 · 22.4→27.8)<br>canva (+1 · 27.2→27.1)<br>spline (-4 · 32.3→25.8) |
| **Desktop OS** (`desktop-os`) | 390 | 104 | 73.3% | omarchy (= · 27.4→21.2)<br>macos (= · 9.9→14.7)<br>windows (= · 8.5→12)<br>ubuntu (+1 · 5.3→6.7)<br>fedora (-1 · 5.6→3.6) |
| **Developer Docs Platforms** (`docs-platforms`) | 265 | 68 | 74.3% | mintlify (+1 · 38.4→45)<br>fern (-1 · 43.1→38.7)<br>readme (+2 · 27.8→35.6)<br>gitbook (-1 · 31.6→32.9)<br>docusaurus (-1 · 30.2→27.4) |
| **Document Extraction APIs** (`document-extraction`) | 318 | 75 | 76.4% | reducto (= · 39.2→37.6)<br>llamaparse (+1 · 32.5→34.7)<br>extend (-1 · 33.1→31.8)<br>unstructured (+1 · 26.1→31.7)<br>datalab (-1 · 30.4→27.3) |
| **Domain Registrars** (`domain-registrars`) | 294 | 80 | 72.8% | porkbun (= · 38.5→38)<br>godaddy (+1 · 33.7→35.6)<br>name-com (-1 · 35.4→34.3)<br>dynadot (+1 · 21.1→21.9)<br>cloudflare-registrar (-1 · 23.5→21) |
| **Durable Execution Engines** (`durable-workflows`) | 318 | 68 | 78.6% | dbos (+1 · 40.5→46.5)<br>trigger-dev (+1 · 39.4→40.3)<br>inngest (+1 · 38.5→39)<br>restate (+2 · 33.4→37.7)<br>temporal (-4 · 42.7→34) |
| **E-commerce Platforms** (`ecommerce-platforms`) | 270 | 58 | 78.5% | woocommerce (= · 37.2→39.2)<br>medusa (+1 · 32→38.3)<br>shopify (-1 · 32.2→37.5)<br>bigcommerce (= · 25.6→26.5)<br>swell (= · 17.3→24.7) |
| **Edge & App Platforms** (`edge-platforms`) | 576 | 157 | 72.7% | cloudflare (= · 48.6→48.6)<br>vercel (= · 45.1→47.5)<br>render (= · 38.7→37.3)<br>railway (= · 28.1→28.3)<br>fly-io (+1 · 19.6→23.5) |
| **Email Clients & Email AI** (`email`) | 378 | 67 | 82.3% | agentmail (= · 38→37.7)<br>gmail (+4 · 18.8→29.7)<br>missive (= · 24.3→26.7)<br>zero (-2 · 27.8→25.6)<br>shortwave (= · 21.3→22.6) |
| **Transactional Email APIs** (`email-apis`) | 260 | 54 | 79.2% | resend (= · 38.7→42.2)<br>mailgun (= · 31.2→34.8)<br>postmark (= · 29.3→31.5)<br>amazon-ses (= · 25.5→24.1)<br>sendgrid (= · 21.7→21.9) |
| **Email Marketing** (`email-marketing`) | 348 | 66 | 81% | customer-io (= · 45.2→45.8)<br>loops (= · 38.5→38.5)<br>klaviyo (+1 · 34.8→37)<br>bento (-1 · 36.9→36.4)<br>kit (= · 29.2→28.8) |
| **Cap Table & Equity** (`equity-management`) | 336 | 82 | 75.6% | carta (= · 22.4→21.2)<br>cake-equity (= · 14.2→13)<br>ledgy (= · 11.6→7.1)<br>pulley (= · 5.6→5.1)<br>vestd (= · 3.9→3.6) |
| **Error Tracking** (`error-tracking`) | 330 | 74 | 77.6% | sentry (= · 35.7→41.1)<br>rollbar (+1 · 26.4→31.4)<br>honeybadger (-1 · 28.8→28.5)<br>bugsnag (+1 · 20.6→24.4)<br>glitchtip (-1 · 21.4→22.8) |
| **Expense Management** (`expense-management`) | 265 | 46 | 82.6% | ramp (= · 55.8→50.7)<br>brex (= · 38.4→34.5)<br>bill-spend-expense (= · 29.2→26)<br>navan (= · 25.2→24.7)<br>expensify (= · 13→19.6) |
| **Feature Flags & Experimentation** (`feature-flags`) | 270 | 57 | 78.9% | unleash (+1 · 33.7→37.6)<br>flagsmith (-1 · 40.7→35.9)<br>growthbook (+1 · 30.3→33)<br>statsig (-1 · 30.6→29.6)<br>launchdarkly (= · 27.5→28.7) |
| **Payment Fraud Prevention** (`fraud-prevention`) | 270 | 68 | 74.8% | forter (= · 27.5→29.7)<br>stripe-radar (= · 24.9→25.7)<br>riskified (+1 · 12.5→17.1)<br>sift (+1 · 10.9→16.5)<br>signifyd (-2 · 12.6→15.9) |
| **Frontend Frameworks** (`frontend-frameworks`) | 425 | 101 | 76.2% | react (= · 52.5→33.1)<br>svelte (= · 44.4→31.9)<br>vue (+1 · 32.7→29)<br>angular (-1 · 34.6→24.5)<br>solid (= · 22.9→15) |
| **Frontier Models** (`frontier-models`) | 488 | 94 | 80.7% | grok (+1 · 40.2→40.2)<br>claude (-1 · 40.8→36.7)<br>gpt (= · 31.3→33.4)<br>mistral (= · 30.2→28.9)<br>jev (+1 · 21.1→24.4) |
| **Game Engines** (`game-engines`) | 456 | 110 | 75.9% | babylonjs (+1 · 34.1→32.9)<br>phaser (-1 · 35.1→32.5)<br>playcanvas (+1 · 27.9→31.3)<br>threejs (+2 · 20.5→30)<br>unity (-2 · 32.9→29.3) |
| **GPU Clouds** (`gpu-clouds`) | 270 | 89 | 67% | vast-ai (= · 40.4→33.8)<br>runpod (= · 30→31.9)<br>coreweave (+1 · 19.1→22)<br>lambda-labs (-1 · 21.8→20.8)<br>paperspace (= · 16.1→16.5) |
| **GPUs & AI Accelerators** (`gpus`) | 344 | 106 | 69.2% | amd-mi355x (+1 · 33.1→26.7)<br>nvidia-h200-sxm (+3 · 28.1→24.4)<br>nvidia-b200 (+1 · 28.3→16.2)<br>amd-rx-9070-xt (-1 · 32.9→16)<br>nvidia-rtx-5090 (+2 · 25.8→15.4) |
| **Identity Verification & KYC** (`identity-verification`) | 318 | 83 | 73.9% | sumsub (= · 32.3→32.2)<br>persona (+1 · 29.3→29.9)<br>veriff (+2 · 24.3→27.7)<br>stripe-identity (-2 · 30.5→25.8)<br>entrust-onfido (-1 · 25.2→20.7) |
| **Incident Management & On-call** (`incident-management`) | 270 | 48 | 82.2% | incident-io (+1 · 32.7→37.6)<br>pagerduty (-1 · 39.1→37)<br>rootly (= · 29.4→32.4)<br>firehydrant (= · 28.7→31.8)<br>betterstack (= · 23→22) |
| **AI Inference Providers** (`inference-providers`) | 371 | 74 | 80.1% | groq (= · 34.9→25.9)<br>baseten (+2 · 23→23.9)<br>morph (+3 · 20→19.5)<br>together-ai (+1 · 20→19.4)<br>cerebras (-3 · 26.9→18.2) |
| **Infrastructure as Code** (`infra-as-code`) | 216 | 63 | 70.8% | pulumi (= · 35.1→41)<br>terraform (= · 26.8→31.4)<br>crossplane (= · 24.9→26.1)<br>opentofu (= · 23.4→25.7) |
| **Startup Legal & Incorporation** (`legal-ops`) | 378 | 153 | 59.5% | docusign (= · 27.2→28.8)<br>ironclad (= · 25.9→19.4)<br>beglaubigt (= · 21.4→18.6)<br>clerky (= · 14→13.1)<br>legalzoom (= · 11.9→4.1) |
| **LLM Evals & Observability** (`llm-evals-observability`) | 416 | 89 | 78.6% | braintrust (+2 · 38→40.5)<br>cekura (-1 · 42.6→37.8)<br>langfuse (-1 · 42.1→37.3)<br>arize-phoenix (+2 · 29.5→32.3)<br>langsmith (+2 · 27.8→32) |
| **Local LLM Runtimes** (`local-llm-runtimes`) | 736 | 196 | 73.4% | localai (+1 · 29.9→30.5)<br>lm-studio (+2 · 24.8→29.4)<br>ollama (+2 · 22.6→27.4)<br>jan (-1 · 27.4→26.5)<br>vllm (-4 · 39.7→25.1) |
| **Marketplace & Platform Payments** (`marketplace-payments`) | 318 | 86 | 73% | mangopay (= · 35→32)<br>rainforest (+1 · 29.3→25.2)<br>adyen-for-platforms (+1 · 24.1→24.2)<br>stripe-connect (-2 · 30.6→23.8)<br>finix (= · 20.7→21.8) |
| **MCP Infrastructure & Registries** (`mcp-infrastructure`) | 364 | 68 | 81.3% | metorial (+1 · 37→34.1)<br>composio (-1 · 37.5→32.3)<br>gram (+1 · 23.5→27)<br>manufact (+1 · 23.2→25.5)<br>pipedream-mcp (-2 · 26.7→24.3) |
| **Meeting AI & Notetakers** (`meeting-ai`) | 270 | 72 | 73.3% | granola (+3 · 26.2→27.7)<br>fireflies (= · 31.3→27.6)<br>fathom (-2 · 31.8→27.3)<br>fellow (-1 · 28.8→25.8)<br>otter (= · 24.5→19.4) |
| **Mobile AI Dev Tools** (`mobile-dev`) | 414 | 148 | 64.3% | working-copy (+2 · 14.5→22.3)<br>tailscale (= · 18.1→18.7)<br>a-shell (+2 · 12.3→14.4)<br>github-mobile (= · 14.2→13.2)<br>termius (+1 · 11.3→7.2) |
| **Mobile & In-Person Payments** (`mobile-payments`) | 208 | 50 | 76% | stripe-terminal (= · 32.3→34.3)<br>square (= · 31.5→27.4)<br>adyen-pos (+1 · 22.9→26)<br>sumup (-1 · 24.3→23.1) |
| **Model Gateways & Routers** (`model-gateways`) | 350 | 92 | 73.7% | litellm (= · 30→30.1)<br>kong-ai-gateway (+2 · 25.3→27.6)<br>openrouter (= · 27.3→25.5)<br>requesty (+3 · 18.6→19.4)<br>vercel-ai-gateway (-3 · 28.6→19.2) |
| **Notes & Knowledge Bases** (`notes-knowledge`) | 330 | 71 | 78.5% | anytype (= · 28.7→27.6)<br>capacities (+1 · 21.4→26.5)<br>poly (-1 · 25.4→25.7)<br>obsidian (+1 · 12.5→18.6)<br>reflect (+1 · 11.6→15.2) |
| **Observability & Monitoring** (`observability`) | 324 | 74 | 77.2% | grafana (= · 42.4→41.7)<br>sentry (= · 35→40.4)<br>new-relic (= · 31.4→36.2)<br>honeycomb (= · 28.9→33.9)<br>signoz (+1 · 22.5→27.7) |
| **Package & Toolchain Managers** (`package-managers`) | 324 | 102 | 68.5% | mise (+1 · 33.3→33.3)<br>pnpm (+3 · 26.8→26.7)<br>bun (-2 · 34.6→25.7)<br>uv (= · 27.3→24.8)<br>homebrew (-2 · 28.7→19.1) |
| **Online Payments** (`payments`) | 540 | 132 | 75.6% | stripe (= · 55.3→51.3)<br>polar (+2 · 41.4→43.1)<br>paddle (+3 · 40.6→42.5)<br>square (-1 · 43.1→40.4)<br>paypal (= · 40.9→39.4) |
| **Payroll & HR Ops** (`payroll`) | 216 | 47 | 78.2% | gusto (= · 42.8→39.5)<br>deel (= · 34.2→28.3)<br>rippling (= · 21.8→24.1)<br>justworks (= · 0→1.9) |
| **Processors** (`processors`) | 352 | 75 | 78.7% | amd-ryzen-ai-max-plus-395 (+1 · 33.2→26)<br>intel-core-ultra-7-258v (-1 · 57.2→24)<br>apple-m4-max (+4 · 5.3→19.7)<br>apple-m4-pro (+2 · 10.4→19.7)<br>apple-m5 (-1 · 15.7→19) |
| **Product Analytics** (`product-analytics`) | 212 | 52 | 75.5% | posthog (= · 51.4→62)<br>amplitude (= · 31.5→30.8)<br>mixpanel (= · 25.3→24)<br>plausible (= · 18.9→18.7) |
| **Product Feedback & Intent** (`product-feedback`) | 260 | 44 | 83.1% | productboard (= · 27→33.5)<br>featurebase (= · 23.2→24.1)<br>canny (= · 17.9→17.4)<br>foreloop (= · 16.1→14.4) |
| **Project Management** (`project-management`) | 498 | 133 | 73.3% | linear (+1 · 48.6→51.7)<br>asana (-1 · 50.1→46.2)<br>notion (= · 35.2→33.1)<br>monday (= · 34.9→32.2)<br>clickup (= · 31.1→28.3) |
| **Robotics Software Platforms** (`robotics-platforms`) | 270 | 86 | 68.1% | viam (+1 · 28.4→35.5)<br>ros2 (-1 · 29.7→27.1)<br>formant (+1 · 22.8→23.3)<br>nvidia-isaac (-1 · 23.4→23.1)<br>gazebo (= · 17.2→20.6) |
| **Scheduling & Calendar** (`scheduling`) | 275 | 60 | 78.2% | cal-com (= · 30→37)<br>calendly (= · 26.8→33.8)<br>motion (= · 19.7→19.9)<br>savvycal (+1 · 13.2→18.3)<br>reclaim (-1 · 13.3→16) |
| **Search Infrastructure** (`search-infra`) | 265 | 69 | 74% | meilisearch (+1 · 29.2→31.3)<br>typesense (+1 · 27.4→29)<br>algolia (-2 · 30.5→28)<br>orama (= · 26.8→24.8)<br>elastic (= · 17.4→18.3) |
| **Hardware Security Keys** (`security-keys`) | 324 | 107 | 67% | yubikey (= · 17.8→19.2)<br>solokeys (+2 · 6.4→15.6)<br>nitrokey (-1 · 17.4→15.4)<br>token2 (-1 · 9→14.6)<br>feitian (= · 4.2→3) |
| **Security Scanners** (`security-scanners`) | 330 | 93 | 71.8% | gecko-security (= · 34.6→37.7)<br>semgrep (= · 30.2→29.8)<br>snyk (+2 · 24.9→26.8)<br>trivy (= · 27→23.5)<br>trufflehog (+1 · 22.6→21.1) |
| **Self-Hosted AI Assistants** (`self-hosted-assistants`) | 342 | 82 | 76% | openclaw (= · 45.1→51.8)<br>open-webui (+2 · 33.9→42.7)<br>lobe-chat (-1 · 41.3→42.5)<br>librechat (-1 · 38.6→33.7)<br>khoj (= · 23.9→26.6) |
| **Serverless & Developer Databases** (`serverless-databases`) | 336 | 71 | 78.9% | neon (= · 56.1→53.2)<br>supabase (= · 50.1→50.8)<br>clickhouse (= · 40.5→40.3)<br>turso (+1 · 34.3→37.9)<br>planetscale (-1 · 37.6→37.1) |
| **Software Factory** (`software-factory`) | 730 | 197 | 73% | openhands (= · 50→55.1)<br>omnara (+1 · 42.4→46.4)<br>factory (+2 · 36.9→46.3)<br>superset (-2 · 42.4→45.9)<br>codegen (+1 · 34.5→36.7) |
| **SSO & Workforce Identity** (`sso-identity`) | 250 | 63 | 74.8% | rippling-it (= · 31.2→33.1)<br>jumpcloud (+1 · 20→23)<br>okta (-1 · 20.6→21.4)<br>microsoft-entra (+1 · 11→15.7)<br>google-workspace (-1 · 12.5→13.7) |
| **Stablecoin Payments** (`stablecoin-payments`) | 318 | 77 | 75.8% | coinbase-payments (= · 31.3→31.2)<br>circle (= · 30.1→30.7)<br>bvnk (+2 · 20.7→24.7)<br>paxos (= · 22.7→24.2)<br>moonpay (-2 · 24.5→22.6) |
| **Startup Banking** (`startup-banking`) | 518 | 128 | 75.3% | ramp (= · 54.9→49.4)<br>mercury (= · 50.1→46.7)<br>airwallex (= · 38→33.8)<br>brex (+1 · 28.8→27.6)<br>jeeves (+1 · 22.5→23.4) |
| **Startup Law Firms** (`startup-law-firms`) | 840 | 236 | 71.9% | trilegal (+1 · 46.7→28)<br>lowenstein-sandler (-1 · 53.3→9.2)<br>fenwick (+2 · 1.7→4.6)<br>cooley (= · 1.8→2.1)<br>bird-bird (+1 · 1.6→2.1) |
| **Sales Tax Automation** (`tax-automation`) | 318 | 86 | 73% | avalara (= · 29.9→31)<br>kintsugi (+2 · 24.2→23.6)<br>numeral (-1 · 25.2→23.4)<br>stripe-tax (-1 · 24.6→21)<br>anrok (= · 20.9→20.7) |
| **Team Chat** (`team-chat`) | 255 | 71 | 72.2% | slack (= · 43.6→47.9)<br>buzz (= · 40.4→42.2)<br>zulip (+2 · 20.3→19.8)<br>discord (-1 · 23.4→18.6)<br>ms-teams (-1 · 21.3→18.5) |
| **Terminals** (`terminals`) | 324 | 106 | 67.3% | warp (= · 53→50.5)<br>iterm2 (= · 18.8→29.4)<br>wezterm (= · 17.5→22.5)<br>kitty (= · 13→21.6)<br>ghostty (+1 · 5.7→13.7) |
| **Vector Databases & Memory Stores** (`vector-databases`) | 371 | 77 | 79.2% | chroma (= · 41.1→39)<br>helixdb (+3 · 30.1→38.9)<br>milvus (-1 · 35.5→33.6)<br>lancedb (= · 30.7→32)<br>qdrant (-2 · 32.2→31.8) |
| **Vibe-Coding App Builders** (`vibe-coding`) | 312 | 68 | 78.2% | base44 (= · 36.1→34.3)<br>floot (+2 · 25.4→27.9)<br>v0 (+2 · 20.8→27)<br>replit (-1 · 26→26.4)<br>lovable (-3 · 27.1→25.4) |
| **Virtual Mailboxes** (`virtual-mailboxes`) | 200 | 53 | 73.5% | stable (= · 17.7→17.3)<br>virtualpostmail (= · 7.7→8.7)<br>earth-class-mail (= · 1→6.8)<br>anytime-mailbox (= · 0→0) |
| **Voice Agent Platforms** (`voice-agents`) | 549 | 94 | 82.9% | telli (+1 · 37.8→41.7)<br>retell (-1 · 37.9→40.3)<br>bland (+1 · 32→36.9)<br>bolna (+1 · 31.5→36.7)<br>pipecat (+2 · 28.8→32.9) |
| **Web Scraping APIs** (`web-scraping`) | 768 | 144 | 81.3% | firecrawl (+1 · 42.3→43.9)<br>crawl4ai (+3 · 34.1→40.5)<br>context-dev (= · 39.6→39.7)<br>apify (-3 · 44.1→37.6)<br>riveter (+1 · 32.7→36.8) |
| **Workflow Automation** (`workflow-automation`) | 616 | 117 | 81% | windmill (+1 · 41.7→47.3)<br>activepieces (-1 · 43.9→44.2)<br>trigger-dev (= · 39.5→42.3)<br>gumloop (+2 · 34.4→39.7)<br>pipedream (= · 38.1→36) |

