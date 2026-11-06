# API-quality gap repairs, wave 9 (2026-11-06)

Per-cell check of the next twelve rows from the corrected staleness ranking on post-#643
main (61 gap rows; waves 1-8 = PRs #623, #627, #630, #632, #634, #639, #641, #643, with
the scan signature fix in #636). iterm2 stays deferred (wave-2 ledger) and foreloop stays
excluded pending the maintainer ruling (wave-7 ledger).

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave9.py` appends 38
live-verified rows fail-closed (all markers verified on the first run), backing 28
appended cells; 20 cells stay absent after checking. Eight fail-closed negative checks
replay the asserted dead or gated URLs, including two 401 status-set checks (#502
convention), and the two virtualpostmail context rows are preserved against refresh
clobbering.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| signifyd | fraud-prevention | 4 | 4 | 0 |
| earth-class-mail | virtual-mailboxes | 4 | 3 | 3 |
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
output is accepted as-is; honest negatives ship.
