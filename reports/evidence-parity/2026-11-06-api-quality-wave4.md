# API-quality gap repairs, wave 4 (2026-11-06)

Per-cell check of the next twelve products from the post-v6-migration staleness ranking
(waves 1-3 = PRs #623, #627, #630; iterm2 stays deferred per the wave-2 ledger).

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave4.py` appends 36
live-verified rows (fail-closed marker checks plus #502-convention probe negatives); 18
cells stay absent after checking. Every ledger row carries `publishedVerdict` beside its
evidence-check disposition once judged, and the pre-audit over every upward flip runs
before the first push.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| buzz | team-chat | 4 | 2 | 2 |
| bolna | voice-agents | 4 | 4 | 1 |
| orb | billing-subscriptions | 4 | 4 | 1 |
| stripe-billing | billing-subscriptions | 4 | 5 | 1 |
| rive | design-tools | 4 | 3 | 2 |
| spline | design-tools | 4 | 1 | 3 |
| morph | inference-providers | 4 | 4 | 1 |
| working-copy | mobile-dev | 4 | 1 | 3 |
| puzzle | accounting | 4 | 4 | 0 |
| google-adk | agent-frameworks | 4 | 4 | 0 |
| maritime | agent-sandboxes | 4 | 3 | 1 |
| poke | ai-assistants | 4 | 1 | 3 |

Wave-4 specifics:

- Three preserved probe counter-checks: bolna's declared-but-404 OpenAPI (the llms.txt
  lists a spec whose file answers 404, enforced fail-closed via the #502 negative
  checks), orb's disabled Mintlify runner (`"display":"simple"`), and rive's decoy spec
  (the llms.txt-listed OpenAPI is Mintlify's "Plant Store" starter-kit sample, not a
  Rive API).
- Honest negatives ship for the products without API surfaces: buzz (Nostr relay whose
  protocol lives in NIP markdown drafts), spline (JS runtime library, no REST API),
  working-copy (prose x-callback-url scheme), poke (one endpoint, no spec/runner/
  sandbox).
- Scope caveats ride in the excerpts: Stripe's spec and policies are platform-wide (no
  Billing-only spec); Orb's Test Mode is tutorial-documented; puzzle's sandbox is a
  manually provisioned staging host on a non-puzzle.io domain and its stability
  commitment is two sentences of prose; google-adk's spec, Swagger UI, and test harness
  all describe the local dev server; maritime's spec is the raw FastAPI document and its
  product (ephemeral sandboxes) is distinguished from an account test mode; morph's
  models feed is cited as a model/pricing catalog, not a spec.
- Reachability: developers.puzzle.io and docs.puzzle.io are NXDOMAIN (the real docs are
  puzzle-api.readme.io, linked from puzzle.io/llms.txt); no bot walls were hit.

Scoped re-judges run under the ratified v6 rubric, then `derive` per touched arena and
the dependent generators. Engine output is accepted as-is; honest negatives ship, and
checked-absent cells that publish as engine partials on adjacent evidence are recorded
with both readings.

Row-level output: `2026-11-06-api-quality-wave4.json`.
