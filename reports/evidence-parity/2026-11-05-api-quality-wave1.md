# API-quality gap repairs, wave 1 (2026-11-05)

Per-cell check of the twelve worst-stale products carrying the api-quality gap signature
in the post-v6-migration staleness scan (`rankings-engine/scripts/staleness-scan.ts`,
re-run offline against main on 2026-11-05; 144 products carry the signature, superseding
the 74 in issue #601). The signature: `agentic-public-api` full/partial while all four
api-quality stories (`api-machine-spec`, `api-interactive-docs`, `api-sandbox`,
`api-versioning-policy`) are zero-evidence none.

Each of the 48 flagged cells was checked against the vendor's current authoritative
pages. Where the absence no longer holds,
`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-05.py` appended
live-verified evidence (verbatim excerpts, fail-closed marker checks; any mismatch aborts
the run). Where it still holds, the check is recorded in the row-level JSON. The judge
grades each story against the product's whole pack, so a cell whose targeted check found
nothing can still earn credit from adjacent evidence; every row in the JSON therefore
carries the `publishedVerdict` beside its evidence-check disposition, and the two are
reported separately.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| browserbase | web-scraping | 4 | 2 | 2 |
| lm-studio | local-llm-runtimes | 4 | 2 | 3 |
| ollama | local-llm-runtimes | 4 | 3 | 1 |
| vllm | local-llm-runtimes | 4 | 3 | 1 |
| langgraph | agent-frameworks | 4 | 4 | 0 |
| langsmith | llm-evals-observability | 4 | 3 | 1 |
| wandb-weave | llm-evals-observability | 4 | 3 | 1 |
| litellm | model-gateways | 4 | 5 | 0 |
| mixpanel | product-analytics | 4 | 7 | 0 |
| semgrep | security-scanners | 4 | 3 | 1 |
| discord | team-chat | 4 | 3 | 1 |
| zulip | team-chat | 4 | 2 | 2 |

Scoped re-judges run in this wave under the ratified v6 rubric: `pnpm engine judge
--batch --category <arena> --product <id>` per touched pair, then `derive` per touched
arena and the dependent generators. Engine output is accepted as-is; unfavorable and
lateral verdicts publish as judged.

Scope caveats are carried into the appended excerpts themselves (the PR #595 review
convention), among them: Discord's test modes cover monetization flows only and its
OpenAPI publication is marked a preview; vLLM's and LiteLLM's machine specs and
interactive docs are served by each deployed instance rather than a hosted endpoint;
Mixpanel's sandbox isolation is separate projects and tokens, not an API test mode.

## Review round (PR #623)

The Greptile review on the first revision flagged two over-credited cells and two report
defects; the fixes went through the inputs, never the verdicts:

- ollama `api-interactive-docs` had earned partial on copy-and-run curl guidance while
  the rationale itself said no interactive explorer exists. A preserved probe
  counter-check row now records the disabled playground
  (`"playground":{"display":"simple"}`); re-judged to none q0.
- wandb-weave `api-versioning-policy` had earned partial from the W&B Server release
  policy, whose own text disclaims trace-API coverage. The row documents a different
  surface and is removed via the script's `REMOVALS` path; re-judged to none q0.
- browserbase `api-versioning-policy` publishes as partial q4: the judge credits the
  /v1-versioned OpenAPI document (appended for `api-machine-spec`) as documented path
  versioning while noting the missing deprecation policy. The inputs are honest, so the
  graded verdict stands; the JSON records the checked absence and the published verdict
  separately.
- The litellm release-cycle marker set now verifies the cadence, hotfix, and
  backward-compatibility claims fail-closed, not only the pin recommendation.

No bot walls were hit in this wave. Row-level output: `2026-11-05-api-quality-wave1.json`.
