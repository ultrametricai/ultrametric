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

Score-interval bands during the migration rest on the committed pre-v6 re-roll
measurements (the `uncertainty.json` noise model), the same interim treatment the
2026-09-30 wave used before its ~100-cell re-roll sample re-measured the noise under the
new judge. A post-migration v6 re-roll sample is queued for after the final wave; until
it lands, interval widths describe pre-v6 judge noise around v6 point scores.

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
| 3 | ai-coding, applicant-tracking, crm, email-marketing, expense-management, incident-management, inference-providers, speech-to-text, sso-identity, terminals, vibe-coding | 4,775 | merged (PR #615) |
| 4 | ai-support-agents, browser-agents, data-pipelines, desktop-os, device-agents, domain-registrars, equity-management, error-tracking, game-engines, infra-as-code, local-llm-runtimes, mcp-infrastructure, robotics-platforms | 4,943 | merged (PR #616) |
| 5 | agent-frameworks, agent-skills, ai-search-apis, ai-video, compliance-automation, data-warehouses, design-tools, identity-verification, marketplace-payments, mobile-payments, notes-knowledge, startup-law-firms | 4,774 | merged (PR #618) |
| 6 | ai-memory, billing-subscriptions, cloud-storage, compliance-screening, durable-workflows, ecommerce-platforms, email-apis, fp-a, gpus, payments, self-hosted-assistants, stablecoin-payments, voice-agents | 4,941 | merged (PR #619) |
| 7 | agent-sandboxes, banking-as-a-service, banking-data-apis, llm-evals-observability, meeting-ai, product-feedback, screen-sharing, security-keys, security-scanners, serverless-databases, software-factory, tax-automation | 4,778 | merged (PR #620) |
| 8 | ai-research-agents, auth-platforms, authenticator-apps, code-hosting, document-extraction, email, mobile-dev, observability, project-management, search-infra, vector-databases, virtual-mailboxes, workflow-automation | 4,911 | merged (PR #621) |
| 9 | accounting, agentic-commerce, ai-code-review, api-platforms, backend-as-a-service, business-phone, feature-flags, file-converters, package-managers, processors, product-analytics, startup-immigration, team-chat | 4,913 | this PR |

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
96% of flips are demotions. Notable rank moves, all pure-rubric: codex #7 → #10 in
ai-coding (the top three, cursor, opencode, and grok-build, hold), fireworks-ai #2 → #1 over
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

## Wave 4 (2026-11-05)

4,943 cells re-judged across the thirteen arenas. 885 verdict flips: 828 down, 9 up, 48
lateral relabels, plus 542 quality-only moves (net -346). Fleet transition profile:

`full→partial` 448 · `partial→none` 378 · `na→none` 40 · `none→partial` 7 ·
`none→na` 6 · `partial→disputed` 2 · `partial→full` 2 · other 2

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| ai-support-agents | 318 | 81 | 81 / 0 / 0 | 48 (-35) |
| browser-agents | 364 | 52 | 51 / 0 / 1 | 40 (-30) |
| data-pipelines | 265 | 77 | 76 / 0 / 1 | 45 (-38) |
| desktop-os | 390 | 60 | 54 / 0 / 6 | 33 (-22) |
| device-agents | 200 | 19 | 18 / 0 / 1 | 19 (-15) |
| domain-registrars | 294 | 76 | 71 / 0 / 5 | 33 (-20) |
| equity-management | 504 | 52 | 47 / 1 / 4 | 37 (-19) |
| error-tracking | 330 | 52 | 48 / 1 / 3 | 49 (-28) |
| game-engines | 456 | 85 | 75 / 2 / 8 | 41 (-18) |
| infra-as-code | 216 | 59 | 57 / 0 / 2 | 25 (-21) |
| local-llm-runtimes | 920 | 110 | 99 / 2 / 9 | 82 (-45) |
| mcp-infrastructure | 416 | 98 | 98 / 0 / 0 | 58 (-43) |
| robotics-platforms | 270 | 64 | 53 / 3 / 8 | 32 (-12) |

No arena in this wave carries an owner, affiliated, or self-submitted row (the
cloudflare-registrar affiliation field is a scope note, not an ownership disclosure), so
no favorable-flip audit applies. Notable rank moves, all pure-rubric: babylonjs #5 → #1
in game-engines (phaser #1 → #2, playcanvas #2 → #4, unreal #6 → #8), localai #2 → #1 and
cactus-compute #1 → #3 in local-llm-runtimes, parahelp #2 ↔ intercom-fin #3 in
ai-support-agents, rollbar #3 → #2 over bugsnag in error-tracking, windows #3 → #5 in
desktop-os.

Legacy-audit closure: error-tracking/glitchtip:openness-open-license, the top standing
unsupported-churn upgrade in `2026-11-04-legacy-transitions.md` (none q0 to full q7 at
eaed1da46e with no machine-verifiable new support), was re-judged from scratch under v6
and the fresh judge independently reached full q7 on the quoted first-party open-source
claim. The cell's published verdict now rests on this labeled wave instead of the
unsupported flip. glitchtip itself moved #5 to #4 in the arena while its aiEra fell with
the fleet-wide tightening.

Spend: about $62 batched plus correction rounds (one to three resume runs per arena).
Wave total about $75; cumulative about $305.

## Wave 5 (2026-11-05)

4,774 cells re-judged across the twelve arenas. 992 verdict flips: 892 down, 27 up, 73
lateral relabels, plus 571 quality-only moves (net -288). Fleet transition profile:

`full→partial` 485 · `partial→none` 404 · `na→none` 53 · `none→na` 18 ·
`none→partial` 17 · `partial→full` 7 · other 8

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| agent-frameworks | 459 | 168 | 161 / 2 / 5 | 67 (-43) |
| agent-skills | 520 | 104 | 79 / 4 / 21 | 56 (-38) |
| ai-search-apis | 250 | 57 | 55 / 1 / 1 | 23 (-6) |
| ai-video | 408 | 56 | 44 / 10 / 2 | 45 (-2) |
| compliance-automation | 324 | 71 | 71 / 0 / 0 | 56 (-44) |
| data-warehouses | 270 | 52 | 48 / 4 / 0 | 53 (0) |
| design-tools | 424 | 87 | 85 / 1 / 1 | 66 (-48) |
| identity-verification | 371 | 70 | 66 / 2 / 2 | 39 (-31) |
| marketplace-payments | 318 | 63 | 63 / 0 / 0 | 46 (-26) |
| mobile-payments | 260 | 54 | 54 / 0 / 0 | 37 (-27) |
| notes-knowledge | 330 | 46 | 44 / 2 / 0 | 37 (-17) |
| startup-law-firms | 840 | 164 | 122 / 1 / 41 | 46 (-6) |

Notable rank moves, all pure-rubric: identity-verification re-ordered (complyadvantage
#3 → #1, sumsub #1 → #4), mattpocock-skills #3 → #1 in agent-skills while
logo-design-skill fell #2 → #8, canva #4 → #2 and penpot #2 → #4 in design-tools,
runway #2 → #1 over heygen in ai-video, bird-bird #5 → #3 and fenwick #3 → #5 in
startup-law-firms.

Own-vendor and disclosed-row audits (convention item 5), all document-only, none changed
a verdict:

- **claude-agent-sdk (agent-frameworks, Anthropic row)**: 3 favorable moves re-read
  (an llms.txt probe-backed quality bump, and two none-to-partial q3 credits whose
  rationales state what is missing), 22 unfavorable kept, rank unchanged at #1 while its
  absolute score fell with the fleet.
- **anthropic-skills (agent-skills, Anthropic row)**: 1 favorable move (per-skill-
  documentation disputed q5 to partial q6, quoting the spec's required description
  field), 16 unfavorable kept, and the row lost #1 to mattpocock-skills under its own
  vendor's judge.
- **claude-design (design-tools, Anthropic row)**: 2 favorable moves (nl-design-
  generation quality bump on first-party plus hands-on quotes; vector-editing-craft none
  to partial q2 crediting only the documented alignment controls), 10 unfavorable kept,
  rank unchanged at #8.
- **ultrametric (agent-skills, Ultrametric's own row)**: zero favorable moves, 12
  unfavorable, and its #6 to #3 rise is purely relative: the rows above it fell harder.
- **yylo-skills (agent-skills, disclosed self-submission)**: 1 favorable quality bump
  with the gap stated, 16 unfavorable kept, rank unchanged at #10.

Spend: about $61 batched plus correction rounds (design-tools needed seven resume runs).
Wave total about $75; cumulative about $380.

## Wave 6 (2026-11-05)

4,941 cells re-judged across the thirteen arenas. 963 verdict flips: 923 down, 11 up, 29
lateral relabels, plus 627 quality-only moves (net -423). Fleet transition profile:

`full→partial` 493 · `partial→none` 430 · `na→none` 21 · `none→partial` 7 ·
`none→na` 5 · `partial→full` 4 · other 3

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| ai-memory | 399 | 105 | 100 / 0 / 5 | 57 (-39) |
| billing-subscriptions | 424 | 94 | 92 / 0 / 2 | 66 (-49) |
| cloud-storage | 196 | 23 | 21 / 2 / 0 | 25 (-11) |
| compliance-screening | 366 | 42 | 42 / 0 / 0 | 40 (-24) |
| durable-workflows | 318 | 84 | 84 / 0 / 0 | 60 (-45) |
| ecommerce-platforms | 270 | 63 | 61 / 1 / 1 | 34 (-31) |
| email-apis | 260 | 60 | 60 / 0 / 0 | 44 (-32) |
| fp-a | 216 | 24 | 23 / 1 / 0 | 26 (-11) |
| gpus | 473 | 60 | 40 / 1 / 19 | 37 (-30) |
| payments | 810 | 98 | 96 / 2 / 0 | 97 (-62) |
| self-hosted-assistants | 342 | 99 | 96 / 2 / 1 | 46 (-34) |
| stablecoin-payments | 318 | 65 | 63 / 1 / 1 | 31 (-21) |
| voice-agents | 549 | 146 | 145 / 1 / 0 | 64 (-34) |

Disclosed-row audit (convention item 5): ai-memory includes honcho, a disclosed vendor
self-submission (issue #480). Its v6 re-judge produced zero favorable moves and 10
unfavorable ones, and its #4 to #3 rise is purely relative: the rows above it fell
harder. No other owner, affiliated, or self-submitted rows sit in this wave. Notable
rank moves, all pure-rubric: gpus re-ordered hard (amd-rx-9070-xt
#1 → #5, amd-mi355x #2 → #1, nvidia-b200 #7 → #3), letta #2 → #1 over mem0 in ai-memory,
complyadvantage #2 → #1 over flagright in compliance-screening, shopify #3 → #2 over
medusa in ecommerce-platforms, revenuecat #3 → #5 in billing-subscriptions.

Spend: about $63 batched plus correction rounds (one to four resume runs per arena).
Wave total about $75; cumulative about $455.

## Wave 7 (2026-11-06)

4,778 cells re-judged across the twelve arenas. 960 verdict flips: 926 down, 7 up, 27
lateral relabels, plus 572 quality-only moves (net -419). Fleet transition profile:

`full→partial` 473 · `partial→none` 453 · `na→none` 15 · `none→na` 6 ·
`none→partial` 4 · `partial→na` 4 · `partial→full` 3 · `full→na` 2

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| agent-sandboxes | 459 | 71 | 69 / 0 / 2 | 66 (-37) |
| banking-as-a-service | 371 | 36 | 35 / 0 / 1 | 30 (-22) |
| banking-data-apis | 424 | 57 | 52 / 2 / 3 | 37 (-19) |
| llm-evals-observability | 572 | 152 | 150 / 2 / 0 | 79 (-75) |
| meeting-ai | 270 | 39 | 39 / 0 / 0 | 29 (-15) |
| product-feedback | 260 | 56 | 56 / 0 / 0 | 32 (-30) |
| screen-sharing | 255 | 27 | 24 / 2 / 1 | 19 (-7) |
| security-keys | 324 | 65 | 54 / 0 / 11 | 27 (-21) |
| security-scanners | 330 | 70 | 65 / 0 / 5 | 45 (-28) |
| serverless-databases | 392 | 99 | 98 / 0 / 1 | 58 (-42) |
| software-factory | 803 | 219 | 217 / 1 / 1 | 116 (-100) |
| tax-automation | 318 | 69 | 67 / 0 / 2 | 34 (-23) |

Notable rank moves, all pure-rubric: maritime #3 → #1 over daytona and e2b in
agent-sandboxes, fathom #3 → #1 over fireflies in meeting-ai, stark-bank #2 → #1 over
column in banking-as-a-service, truelayer #6 → #3 in banking-data-apis, nitrokey #3 → #1
and solokeys #2 → #4 in security-keys, jules #7 → #9 in software-factory.

### Protected hand-adjudicated cells (the 09-30 worklist convention)

product-feedback carries the 16 committed human adjudications from the 2026-09-21/24
Foreloop bias audits, protected by docs/JUDGE-MIGRATION-2026-09-30-worklist.json, whose
rule is that human adjudications outrank any model. The wave followed the worklist's
documented mechanics exactly, via the committed
`rankings-engine/scripts/reapply-protected-adjudications.ts` (the 09-30 driver's
finalizeArena step): the v6 judge ran every cell, the worklist's preservedVerdict was
re-applied verbatim to the cache and verdicts.json, and the worklist now records what the
fresh v6 judge said per cell. The fresh judge independently reached the adjudicated
verdict and quality on 9 of 16. The 7 overrides cut both ways on the house's own product:
on four cells the fresh judge proposed HIGHER grades that the adjudications hold down
(agentic-mcp-server fresh partial q3, preserved none q0 on the probe-gated bar;
agentic-headless, agentic-official-cli, and embed-feedback-widget fresh q9, preserved
q7), and on two cells the adjudications hold grades ABOVE the fresh judge
(agentic-nl-commands preserved partial q4 over a fresh none q0; agentic-public-api
preserved partial q5 over a fresh none q0), with one quality-only difference
(agentic-builtin-assistant preserved q4 over fresh q5). These two upward preservations
are the only cells in the migration so far where a published verdict sits above the v6
judgment; they rest on the dated bracketed human adjudications in their rationales, and
re-adjudicating them is a maintainer call outside this wave's convention.

### Own-row audits (foreloop, both arenas; document-only)

- **product-feedback/foreloop**: zero favorable migration moves survive (the preserved
  adjudications override the fresh judge in both directions, as above); 8 unfavorable
  moves on unprotected cells kept; its #4 to #3 rise is relative, from rows above falling
  harder.
- **software-factory/foreloop**: 3 favorable moves re-read against their citations
  (official-cli and approve-plan-before-execution quality bumps on quoted first-party
  docs; ai-issue-triage none to partial q3 with the "limited form" scoping stated), 19
  unfavorable kept, and its #9 to #7 rise is relative: jules fell past it.

Spend: about $62 batched plus correction rounds (software-factory needed 23 resume runs
across two retry rounds; its stubborn cells repeatedly failed the verbatim-quote rule
before converging). Wave total about $82; cumulative about $537.

## Wave 8 (2026-11-06)

4,911 cells re-judged across the thirteen arenas. 960 verdict flips: 897 down, 22 up, 41
lateral relabels, plus 587 quality-only moves (net -319). Fleet transition profile:

`full→partial` 464 · `partial→none` 431 · `na→none` 28 · `none→partial` 14 ·
`none→na` 12 · `partial→full` 7 · `full→none` 2 · other 2

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| ai-research-agents | 258 | 30 | 27 / 0 / 3 | 24 (-5) |
| auth-platforms | 280 | 80 | 77 / 2 / 1 | 44 (-21) |
| authenticator-apps | 440 | 89 | 80 / 2 / 7 | 32 (-10) |
| code-hosting | 360 | 52 | 50 / 2 / 0 | 33 (-14) |
| document-extraction | 318 | 101 | 99 / 0 / 2 | 55 (-33) |
| email | 378 | 75 | 66 / 9 / 0 | 54 (-30) |
| mobile-dev | 414 | 44 | 23 / 0 / 21 | 39 (-18) |
| observability | 324 | 96 | 95 / 1 / 0 | 51 (-45) |
| project-management | 581 | 67 | 63 / 2 / 2 | 57 (-35) |
| search-infra | 265 | 69 | 66 / 2 / 1 | 36 (-18) |
| vector-databases | 477 | 84 | 82 / 1 / 1 | 66 (-33) |
| virtual-mailboxes | 200 | 18 | 14 / 1 / 3 | 15 (-9) |
| workflow-automation | 616 | 155 | 155 / 0 / 0 | 81 (-48) |

Protected cells: workflow-automation carries the two AFK human adjudications from the
09-30 worklist. The same re-application mechanic ran
(`reapply-protected-adjudications.ts`), and the fresh v6 judge independently reached both
adjudicated grades exactly (agentic-mcp-client none q0, agentic-nl-commands partial q5),
so the preservation changed nothing; the worklist records the agreement.

Own-row audit (afk, workflow-automation, Ultrametric's own product; document-only): zero
favorable moves, 8 unfavorable kept, rank unchanged at #11 of 11, last in its arena.

Notable rank moves, all pure-rubric: tailscale #4 → #1 in mobile-dev (working-copy
#1 → #2), sentry #2 → #1 over grafana in observability, helixdb #2 → #1 in
vector-databases (qdrant #5 → #3, lancedb #4 → #6), auth0 #5 → #3 in auth-platforms,
temporal #7 → #5 and n8n #6 → #8 in workflow-automation.

Spend: about $63 batched plus correction rounds (workflow-automation needed nine resume
runs). Wave total about $77; cumulative about $614.

## Wave 9 (2026-11-06)

4,913 cells re-judged across the thirteen arenas (feature-flags'
flagsmith:openfeature-compatibility was already v6-current from a contest re-judge and
skipped cleanly). 816 verdict flips: 708 down, 18 up, 90 lateral relabels, plus 509
quality-only moves (net -172). Fleet transition profile:

`full→partial` 428 · `partial→none` 280 · `na→none` 44 · `none→na` 35 ·
`partial→full` 9 · `none→partial` 9 · `partial→na` 6 · `full→na` 4 · `na→partial` 1

| arena | cells | flips | down / up / lateral | quality-only (net) |
|---|---|---|---|---|
| accounting | 583 | 135 | 131 / 1 / 3 | 62 (-35) |
| agentic-commerce | 504 | 64 | 61 / 1 / 2 | 50 (-20) |
| ai-code-review | 318 | 51 | 51 / 0 / 0 | 35 (-20) |
| api-platforms | 285 | 53 | 47 / 2 / 4 | 30 (-15) |
| backend-as-a-service | 204 | 46 | 45 / 0 / 1 | 34 (-7) |
| business-phone | 385 | 26 | 25 / 1 / 0 | 38 (-25) |
| feature-flags | 270 | 87 | 82 / 4 / 1 | 50 (+10) |
| file-converters | 416 | 58 | 46 / 0 / 12 | 31 (-11) |
| package-managers | 324 | 84 | 58 / 5 / 21 | 45 (+12) |
| processors | 352 | 35 | 26 / 0 / 9 | 21 (-7) |
| product-analytics | 424 | 59 | 55 / 3 / 1 | 36 (-10) |
| startup-immigration | 594 | 92 | 55 / 1 / 36 | 37 (-23) |
| team-chat | 255 | 26 | 26 / 0 / 0 | 40 (-21) |

No owner, affiliated, or self-submitted rows in this wave. Notable rank moves, all
pure-rubric: intel-core-ultra-9-285k #6 → #1 in processors (amd-ryzen-ai-max-plus-395
#1 → #3), coinbase-x402 #4 → #8 in agentic-commerce, xero #4 → #3 over quickbooks in
accounting, pandoc #6 → #4 in file-converters, google-analytics #3 → #5 in
product-analytics; startup-immigration shuffles mostly inside its zero-score band, with
36 lateral none-to-na relabels.

Spend: about $63 batched plus correction rounds. Wave total about $75; cumulative about
$689.

## Migration closeout

All nine waves are published. Fleet totals across the waves, computed per arena against
each wave's pre-merge baseline:

| metric | value |
|---|---|
| arenas migrated | 104 (every arena except registered-agents, already v6 via PR #564) |
| cells re-judged | 43,737 |
| verdict flips | 7,986 (7,285 down, 268 up, 433 lateral relabels) |
| quality-only moves | 4,884 (net -2,667) |
| spend | about $689 (batch transport plus interactive correction rounds) |

The preview projected roughly 6,800 flips at least 96% downward from two pilot arenas;
the fleet came in at 7,986 flips, 91% downward counting lateral relabels against the
denominator (96% of directional flips are demotions). Every judge cache in the corpus is
v6-current: the inventory scanner reports 0 stale cells of 44,147. Two cells were already
v6-current before their wave from contest re-judges and were skipped rather than re-paid:
terminals/wezterm:automation-rules-engine and
feature-flags/flagsmith:openfeature-compatibility. registered-agents (408 cells) kept its
PR #564 v6 verdicts.

Queued follow-ups, each a maintainer call:

1. **v6 noise re-measurement**: a ~100-cell re-roll sample under v6, then rebuild
   `uncertainty.json` and every score-intervals file (the 2026-09-30 precedent's §5.5
   treatment, about $9 interactive). Until it lands, interval bands describe pre-v6 judge
   noise around v6 point scores, as disclosed above.
2. **The two above-v6 foreloop adjudication cells** (product-feedback
   agentic-nl-commands partial q4 and agentic-public-api partial q5, preserved over fresh
   none q0 per the worklist): re-adjudicate or reaffirm.
3. **Worklist history**: reapply-protected-adjudications.ts overwrites freshJudgeSaid
   per wave; the 09-30 values live in git history. Optional: per-wave history in the
   file.
