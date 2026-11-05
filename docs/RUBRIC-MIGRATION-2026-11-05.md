# Rubric migration — 2026-11-05 — judge prompt v5 → v6 (opus-5-5)

Fleet re-judge under judge PROMPT_VERSION v6, which landed 2026-11-03 (c5194785a8) with the
policy that the bump "does not rewrite the published corpus or authorize a bulk re-judge"
and that legacy same-source transitions and the rubric migration be reviewed before
scheduled judge runs resume (docs/ACCURACY.md). Both reviews are published:

- `reports/rubric-migration/2026-11-04-v6-preview.md` (PR #597): the non-publishing
  two-arena pilot measuring what v6 does to published verdicts.
- `reports/rubric-migration/2026-11-04-legacy-transitions.md` (PR #605): the
  published-corpus audit of every verdict transition since the corpus began.

The maintainer ratified the v6 rubric migration after the two-part review (the audit's
Option A). This document records the migration convention, the inventory, and the wave
plan; per-wave results are appended as each wave lands. Precedents: the 2026-09-30
judge-model migration (docs/JUDGE-MIGRATION-2026-09-30.md) and the v5 settlement wave 1
(PR #456).

**Every verdict flip and score move in these waves reflects the rubric change, not product
changes.** Rank moves must be read as rubric-scale moves.

## Migration convention

Per the labeled-migration treatment the two precedents established:

1. **Engine output is accepted as-is.** The re-judge runs `pnpm engine judge --batch
   --category <id>` (Message Batches transport, interactive correction rounds for cells
   whose first verdict violates the v6 response contract), then `derive` and the dependent
   generators. No hand-set verdicts or scores; rubric-driven flips, including unfavorable
   ones, publish as judged.
2. **The churn policy's no-new-evidence revert rule is not applied inside a wave.** Under
   a rubric change every flip cites no new evidence by construction (ACCURACY.md, Human
   review points §1). The CI refresh-stability gate binds `story-runner/*` refresh
   branches and is untouched; migration waves land on `lane/v6-migration-wave-*` branches
   and carry the wave label instead, exactly as the 2026-09-30 wave and PR #456 did.
3. **Score-history rows are labeled.** Each wave's appended rows carry
   `"note": "v6-rubric-migration-2026-11-05: first prompt-v6 judge of the arena (opus-5-5)"`
   via `rankings-engine/scripts/label-score-history-note.ts`, so the time series shows a
   labeled discontinuity instead of a silent evidence-looking move.
4. **Derived data regenerates through generators only**: `derive --category`,
   `compute-confidence-intervals`, `generate-vendor-reviews`, `generate-story-graph`,
   `generate-step-rankings`, `generate-badges.mjs`.
5. **Affiliated and own-vendor rows get a favorable-flip audit.** The judge is an
   Anthropic model; on rows for Anthropic products and founder-affiliated products, every
   favorable flip in a wave is adversarially re-read against its cited evidence and the
   reading is documented in the wave PR (the 2026-09-30 own-product audit pattern).
   Unfavorable and lateral moves are kept as-is.

The audit's residual-risk note stands: v6 re-rolls are still re-rolls, and the
post-migration baseline gets the same settlement treatment the registered-agents pilot
got on its next refresh.

## Inventory at the wave-1 baseline

Computed against main (2891f5d9e8) with the committed cellHash (key v2, prompt v6,
claude-opus-5-5): 43,737 of 44,147 cells across 104 arenas are not v6-current.
registered-agents (408 cells) already publishes v6 verdicts (PR #564) and is excluded.
The two remaining v6-current cells are single contested cells in terminals and
feature-flags.

## Wave plan

Waves chunk the 104 arenas into reviewable PRs of roughly 4,700 to 5,000 cells each.
Wave 1 takes the five parity-repair arenas whose appended evidence left nine scoped
re-judges parked (`reports/evidence-parity/2026-11-03-wave1-repairs.json`, rejudgeQueue:
the gusto, vercel, vue, claude, and gemini rows), so the migration itself satisfies that
queue, plus the two pilot arenas, whose preview data lets reviewers cross-check flips
against `2026-11-04-v6-preview.json`.

| wave | arenas | cells | status |
|---|---|---|---|
| 1 | ai-assistants, cloud-platforms, edge-platforms, frontend-frameworks, frontier-models, legal-ops, payroll, startup-banking, web-scraping | 4,936 | merged (PR #612) |
| 2 | card-issuing, customer-data-platforms, docs-platforms, fraud-prevention, government-services, gpu-clouds, model-gateways, scheduling | 4,766 | merged (PR #614) |
| 3 | ai-coding, applicant-tracking, crm, email-marketing, expense-management, incident-management, inference-providers, speech-to-text, sso-identity, terminals, vibe-coding | 4,775 | this PR |
| 4 | ai-support-agents, browser-agents, data-pipelines, desktop-os, device-agents, domain-registrars, equity-management, error-tracking, game-engines, infra-as-code, local-llm-runtimes, mcp-infrastructure, robotics-platforms | 4,943 | queued |
| 5 | agent-frameworks, agent-skills, ai-search-apis, ai-video, compliance-automation, data-warehouses, design-tools, identity-verification, marketplace-payments, mobile-payments, notes-knowledge, startup-law-firms | 4,774 | queued |
| 6 | ai-memory, billing-subscriptions, cloud-storage, compliance-screening, durable-workflows, ecommerce-platforms, email-apis, fp-a, gpus, payments, self-hosted-assistants, stablecoin-payments, voice-agents | 4,941 | queued |
| 7 | agent-sandboxes, banking-as-a-service, banking-data-apis, llm-evals-observability, meeting-ai, product-feedback, screen-sharing, security-keys, security-scanners, serverless-databases, software-factory, tax-automation | 4,778 | queued |
| 8 | ai-research-agents, auth-platforms, authenticator-apps, code-hosting, document-extraction, email, mobile-dev, observability, project-management, search-infra, vector-databases, virtual-mailboxes, workflow-automation | 4,911 | queued |
| 9 | accounting, agentic-commerce, ai-code-review, api-platforms, backend-as-a-service, business-phone, feature-flags, file-converters, package-managers, processors, product-analytics, startup-immigration, team-chat | 4,913 | queued |

Later waves may be re-chunked as evidence packs grow; each wave PR states its final arena
list. Arenas with affiliated or own-vendor rows (product-feedback, software-factory,
workflow-automation, ai-coding, agent-frameworks, agent-skills, design-tools, and the
claude rows in wave 1) get the favorable-flip audit in their wave PR.

The pilot-based budget for the full migration is about $620 batched plus about $70 of
interactive correction rounds; each wave PR reports its cells judged and approximate
spend.

## Wave 1 (2026-11-05)

4,936 cells re-judged across the nine arenas. 883 verdict flips: 720 down, 125 up, 38
lateral relabels, plus 498 quality-only moves (net -198). Fleet transition profile:

`full→partial` 382 · `partial→none` 335 · `none→partial` 69 · `none→full` 43 ·
`na→none` 26 · `partial→full` 13 · `none→na` 9 · `partial→disputed` 2 · other 4

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| ai-assistants | 780 | 107 | 85 / 19 / 3 | 79 (-16) |
| cloud-platforms | 196 | 25 | 24 / 1 / 0 | 20 (-11) |
| edge-platforms | 576 | 153 | 129 / 24 / 0 | 71 (-23) |
| frontend-frameworks | 510 | 91 | 48 / 25 / 18 | 48 (-18) |
| frontier-models | 488 | 151 | 118 / 28 / 5 | 61 (-10) |
| legal-ops | 432 | 42 | 25 / 14 / 3 | 26 (-10) |
| payroll | 594 | 64 | 62 / 1 / 1 | 42 (-25) |
| startup-banking | 592 | 69 | 51 / 13 / 5 | 65 (-45) |
| web-scraping | 768 | 181 | 178 / 0 / 3 | 86 (-40) |

Pilot cross-check: cloud-platforms published 25 flips against the preview's 24 (the one
extra is a cell the pilot could not score because its single-request rule forbade
correction rounds). web-scraping published 181 against the preview's 134; the preview had
51 unresolved pilot failures in this arena, and production correction rounds resolved
them, mostly to demotions, which accounts for the gap's direction.

Two effects overlay in this wave's upward flips. Pure-rubric upgrades are rare (the
pilot's pattern of packs that already held verbatim direct support). The concentration of
upgrades sits on the five parity-repair rows whose appended evidence (PR #595) had not
yet been judged: the wave satisfies all nine parked re-judges from
`reports/evidence-parity/2026-11-03-wave1-repairs.json`. The large rank moves follow from
exactly those rows: gemini #13 → #2 in ai-assistants, gusto #7 → #1 in legal-ops and
#8 → #4 in startup-banking, claude #2 → #1 in ai-assistants and frontier-models, vercel
#2 → #1 in edge-platforms. Other notable moves are pure-rubric: web-scraping re-ordered
(context-dev #3 → #1, firecrawl #1 → #3, crawl4ai #2 → #6), grok #1 → #2 in
frontier-models, cloudflare #1 → #2 in edge-platforms.

Own-vendor favorable-flip audit (convention item 5): the claude rows in ai-assistants and
frontier-models moved to #1 under their own vendor's judge, so all 34 favorable moves on
those rows were adversarially re-read against their cited evidence. Every one cites the
2026-11-03 parity-appended first-party pages verbatim and on-story; adjacent features
(MCP client vs server, code-execution sandbox vs API test environment) are explicitly
scoped out of credit in the rationales, and the two weakest credits
(open-weights-access partial q3, spend-controls-budgets partial q3) are low-quality
partials whose rationales state the gap. Counter-signals: claude also took 19 unfavorable
moves across the two arenas, kept as-is, and gemini, a non-affiliated row with the same
parity treatment, received more favorable moves than claude in both arenas (15 vs 14 and
22 vs 20) and the larger rank move. No verdicts were changed by the audit.

Downstream honest exclusions: the v6 demotion of
ai-assistants/gemini:create-edit-documents to none removed the judged support behind five
additional-candidate process references (hire-intl-contractor, prepare-a-board-meeting,
publish-privacy-policy-dpa, run-outbound-sales-sequences,
ship-a-feature-spec-to-deploy). The references were pruned per the cross-arena evidence
gate; the none verdict stays published, and the refs can return if evidence lands.

Spend: about $62 batched (pilot batch rate over 4,936 cells) plus interactive correction
rounds for first-attempt contract violations (several per-arena resume runs after cells
exhausted their three correction rounds; the re-runs reuse cached cells and retained
batch results, so no cell was paid for twice at batch price). Wave total about $75.

## Wave 2 (2026-11-05)

4,766 cells re-judged across the eight arenas. 651 verdict flips: 549 down, 31 up, 71
lateral relabels, plus 398 quality-only moves (net -190). Fleet transition profile:

`full→partial` 283 · `partial→none` 265 · `none→na` 46 · `na→none` 24 ·
`none→partial` 21 · `partial→full` 7 · `none→full` 3 · other 2

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| card-issuing | 318 | 42 | 40 / 2 / 0 | 41 (-24) |
| customer-data-platforms | 255 | 48 | 47 / 0 / 1 | 31 (-25) |
| docs-platforms | 265 | 83 | 79 / 1 / 3 | 40 (-26) |
| fraud-prevention | 378 | 64 | 60 / 0 / 4 | 54 (-48) |
| government-services | 2,601 | 184 | 119 / 8 / 57 | 103 (-52) |
| gpu-clouds | 324 | 75 | 65 / 9 / 1 | 49 (-6) |
| model-gateways | 350 | 91 | 87 / 0 / 4 | 40 (-24) |
| scheduling | 275 | 64 | 52 / 11 / 1 | 40 (+15) |

government-services carries most of the wave's lateral moves: 46 `none→na` relabels, the
v6 judge marking agency-inapplicable stories not applicable instead of absent. Its many
small rank moves sit in the near-zero score band where fractional aiEra differences
re-order agencies. Notable top-of-table moves elsewhere, all pure-rubric:
hightouch #2 → #1 over jitsu in customer-data-platforms, runpod #2 → #1 over vast-ai in
gpu-clouds, marqeta #3 → #2 and stripe-issuing #2 → #4 in card-issuing.

Disclosed-row audit: gpu-clouds includes lium, a disclosed vendor self-submission whose
evidence was first judged under v5 days before this wave, so its v6 deltas are
pure-rubric. Its one favorable move (serverless-gpu-endpoints none to partial q3) cites
documented SDK behavior with the limitation stated in the rationale; its other eight
moves are unfavorable, kept as-is, and its rank is unchanged at #3. No verdicts were
changed by the audit.

Spend: about $60 batched plus correction rounds (five resume runs for
government-services, one to three for the others). Wave total about $75; cumulative about
$150 of the roughly $690 full-migration budget.

## Wave 3 (2026-11-05)

4,775 cells re-judged across the eleven arenas (terminals already held one v6-current
contested cell, which the judge skipped). 876 verdict flips: 842 down, 18 up, 16 lateral,
plus 580 quality-only moves (net -312). Fleet transition profile:

`full→partial` 449 · `partial→none` 392 · `na→none` 11 · `none→partial` 11 ·
`partial→full` 4 · `disputed→partial` 3 · `none→na` 3 · other 3

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| ai-coding | 1,332 | 315 | 311 / 3 / 1 | 187 (-128) |
| applicant-tracking | 260 | 54 | 54 / 0 / 0 | 34 (-21) |
| crm | 408 | 57 | 57 / 0 / 0 | 51 (-32) |
| email-marketing | 348 | 53 | 53 / 0 / 0 | 41 (-19) |
| expense-management | 371 | 55 | 54 / 0 / 1 | 44 (-13) |
| incident-management | 270 | 47 | 47 / 0 / 0 | 32 (-19) |
| inference-providers | 424 | 54 | 53 / 0 / 1 | 43 (-26) |
| speech-to-text | 477 | 63 | 54 / 3 / 6 | 53 (-26) |
| sso-identity | 250 | 30 | 27 / 2 / 1 | 17 (-16) |
| terminals | 324 | 78 | 62 / 10 / 6 | 38 (+2) |
| vibe-coding | 312 | 70 | 70 / 0 / 0 | 40 (-14) |

This is the purest rubric wave so far: no arena carried unjudged appended evidence, and
98% of flips are demotions. Notable rank moves, all pure-rubric: codex #7 → #10 in
ai-coding (the top three, cursor, opencode, and cline, hold), fireworks-ai #2 → #1 over
together-ai in inference-providers, replit #4 → #2 and floot #2 → #4 in vibe-coding,
whisper #4 → #7 and gladia #7 → #4 in speech-to-text, zoho-crm #5 → #3 in crm.

Own-vendor and disclosed-row audits (convention item 5), both document-only:

- **claude-code (ai-coding, Anthropic row)**: 3 favorable moves re-read against their
  citations, 18 unfavorable kept, rank unchanged at #4. The one favorable verdict flip,
  desktop-visual-diff-review partial to full at q6, quotes first-party lines covering both
  story elements ("Review diffs visually, run multiple sessions side by side"); the
  rationale itself flags the thin support and holds quality at q6. It is the weakest
  favorable credit in the wave and is named here for the record.
- **speech-is-cheap (speech-to-text, disclosed founder self-submission)**: entered the
  wave already at #1 from its pre-wave evidence-parity repair. This wave: 3 favorable
  moves (agentic-scoped-keys none to partial q4 citing documented per-agent key creation
  and revocation; two single-point quality bumps on already-credited cells), 11
  unfavorable moves kept, rank unchanged at #1. Each favorable rationale states what is
  still missing.

Spend: about $62 batched plus correction rounds (ai-coding needed nine resume runs; its
stubborn cells repeatedly failed the verbatim-quote rule before converging). Wave total
about $80; cumulative about $230.
