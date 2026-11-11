# API-quality gap repairs, wave 9 (2026-11-06)

Per-cell check of the next twelve rows from the corrected staleness ranking on post-#643
main (61 gap rows; waves 1-8 = PRs #623, #627, #630, #632, #634, #639, #641, #643, with
the scan signature fix in #636). iterm2 stays deferred (wave-2 ledger) and foreloop stays
excluded pending the maintainer ruling (wave-7 ledger).

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave9.py` appends 39
live-verified rows fail-closed (38 at wave start, all markers verified on the first run,
plus the pre-audit MCP-server row), backing 28 appended cells; 20 cells stay absent after
checking. Eight fail-closed negative checks replay the asserted dead or gated URLs,
including two 401 status-set checks (#502 convention), and the two virtualpostmail
context rows are preserved against refresh clobbering.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| signifyd | fraud-prevention | 4 | 4 | 0 |
| earth-class-mail | virtual-mailboxes | 4 | 4 | 3 |
| virtualpostmail | virtual-mailboxes | 4 | 2 | 4 |
| raygun | error-tracking | 4 | 4 | 1 |
| galileo | llm-evals-observability | 4 | 3 | 1 |
| a-shell | mobile-dev | 4 | 1 | 4 |
| anythingllm | self-hosted-assistants | 4 | 3 | 1 |
| scrapingbee | web-scraping | 4 | 3 | 2 |
| runanywhere | local-llm-runtimes | 4 | 3 | 1 |
| kimi | ai-assistants | 4 | 4 | 1 |
| irs | government-services | 4 | 3 | 2 |
| moneybird | accounting | 4 | 5 | 0 |

Wave-9 specifics:

- Two products are documented no-docs rows: virtualpostmail has no public developer
  documentation at all (the API host answers 401 even on /docs and /swagger, replayed
  fail-closed; the help center says access is contact-to-request) and a-shell is a local
  iOS terminal whose only programmatic surfaces are Apple Shortcuts and an off-by-default
  local relay server specified in README prose. Both ship all-none api-quality rows
  grounded in preserved or context rows.
- Rebrand and acquisition states recorded: Earth Class Mail is now "Virtual Mail" under
  LegalZoom (old docs hosts DNS-dead; reference.earthclassmail.com is the successor and
  states the rename); Galileo's marketing redirects to splunk.com while docs remain on
  docs.galileo.ai; Moonshot's developer platform is now the Kimi API Platform at
  platform.kimi.ai.
- The IRS row is scoped to its real developer surface: MeF schemas and WSDLs exist but
  are registration-gated (spec cell stays absent with the gating quoted), the developer
  docs are PDF publications, and the Assurance Testing System is a genuine
  production-separated test environment (enrollment-gated, seasonal windows; the
  dated seasonal opening line is deliberately not a verification marker).
- Strong sandboxes: moneybird's self-serve sandbox administrations (full feature access,
  watermarked invoices) and the IRS ATS; scoped ones: signifyd's support-mediated test
  teams. Honest sandbox nones: granola-style production-credit or paid-tier framing at
  scrapingbee, kimi, runanywhere, galileo, raygun, earth-class-mail, anythingllm.
- Machine specs: eight products publish live OpenAPI documents (signifyd, earth-class-mail,
  raygun, galileo, runanywhere, kimi with a second dated Admin spec, anythingllm
  instance-scoped, moneybird in its vendor GitHub org); scrapingbee's surface is a
  Postman collection (the unit-postman class).
- Reachability: raygun.com and platform.kimi.ai soft-200 unknown paths (content-verified);
  moneybird's spec version string changes daily and is deliberately not a marker. No bot
  walls were hit this wave.

Scoped re-judges run under the ratified v6 rubric (virtual-mailboxes judged
category-wide), then `derive` per touched arena and the dependent generators. Engine
output is accepted as-is; honest negatives ship. Two checked-absent cells publish as
engine partials on adjacent evidence and carry both readings (irs api-machine-spec q3 on
the gated schemas, scrapingbee api-interactive-docs q4 on the login-walled builder — the
dynadot/jira class).

## Pre-audit (before the first push)

60 verdict-level up-moves vs merge-base 13ef5d37e8 (31 target cells, 29 side-effect
flips), re-read against the v6 on-axis bar; the fix re-rolls were audited on top. Two
inputs-only corrections caught before push: earth-class-mail's agentic-nl-commands and
agentic-mcp-server had been credited on the MCP tool-catalog JSON alone (the PR #643
transferred-credit class) — the research pass had missed the vendor's documented MCP
server, so the appended server row quotes it verbatim ("manage your virtual mailbox just
by asking") and both cells now publish as fulls on direct vendor text; and a-shell's
automation-rules-engine had gone to partial on the .profile startup hook alone (the
fellow-webhooks building-block class) — the scoped context row settles it at none.
Eleven thin partials conceded and documented in the ledger JSON; honest downs ship.

## Review round (PR #644)

Three P1s on side-effect thin partials, all fixed inputs-only with direct vendor
evidence. kimi agentic-scoped-keys had been credited on key-creation quotes: the
appended org-hierarchy row documents the actual restriction mechanisms (per-project
budgets, rate limits, IP whitelist, membership, per-project usage tracking; the
project-level-not-per-key scope rides in the excerpt), and the cell publishes partial q5
citing them. kimi file-upload-analysis had been credited on a model-settings quote: the
appended guide row quotes the vendor directly ("The Kimi intelligent assistant can
upload files and answer questions based on those files. The Kimi API offers the same
functionality."), and the cell publishes partial q6. anythingllm multiple-named-agents
had combined workspace API access with general settings: the appended agent-surface rows
(@agent chat sessions; no-code Agent Flows and code skills) carry the caveat that no
multiple-named-agents feature is documented, and the re-judged cell settles at none q0.
The re-rolls were pre-audited: kimi agentic-ai-insights full q7 and image-understanding
partial q5 ground in the new file-QA row verbatim; honest laterals and downs ship.

A second review round flagged two side-effect kimi cells for crediting the separate API
platform's surfaces to the assistant. The preserved counter-check row
kimi-assistant-surface-20261106 records the distinction (kimi.com serves its app shell
for llms.txt; image/video understanding is documented for the API, not the assistant
app). Re-judged: agentic-agent-docs settles at none; image-understanding publishes
partial q4 with the counter row quoted in its own support — the engine weighed the
assistant's documented file upload, the API-side image support, and the explicit
counter, and held a reduced partial. Per the #546 convention that verdict stands, with
both readings carried here.

Reviewer follow-up accepted the inputs and the re-judge process; the one open question
(whether generic assistant file Q&A clears the image-understanding bar at partial q4,
given the counter row's API-only scoping) is escalated to a maintainer ruling and the
cell ships as judged pending it.

A second escalation joins it: kimi agentic-mcp-server flipped na to none in the
side-effect re-roll, with the rationale applying the axis because the umbrella product
"includes... a developer API platform" while the arena ranks the assistant (ten of the
fifteen arena products are na on this story). The pack is complete and the counter row
is acknowledged in the rationale, so the na-vs-none call is rubric applicability, the
penalty-direction twin of the image-understanding question; both ship as judged pending
the same maintainer ruling.
