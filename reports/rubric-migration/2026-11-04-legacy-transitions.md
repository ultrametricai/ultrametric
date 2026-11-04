# Legacy same-source transitions: published-corpus audit (2026-11-04)

docs/ACCURACY.md (landed with the v6 prompt bump, c5194785a8, merged a405c3afd3) asks for two
reviews before scheduled judge runs resume: the rubric migration itself, measured in
`2026-11-04-v6-preview.md`, and a review of legacy same-source transitions, which this report
delivers. The question it answers: across every verdict the corpus has ever published, which
judgment changes were driven by new evidence, which by a labeled rubric or judge wave, and
which by neither, and how many published verdicts currently rest on that last class.

Companion data: `2026-11-04-legacy-transitions.json` in this directory carries every
unsupported-churn, rubric-rollout, and settlement row with its commit, step baseline, and
per-cell v5 cache currency. The generator is committed at
`rankings-engine/scripts/legacy-transitions-audit.ts`; the full transition set (labeled and
evidence-driven rows included) regenerates with its `--full` flag.

## Method

- Lineage: for each of the 105 arenas, the audit walks the first-parent history of HEAD
  (bc778d69b9) for `verdicts.json`, through the `data/` to `rankings/` to `open-rankings/`
  renames, and diffs consecutive published states per cell. Changes that never reached main
  (churn settled inside its own PR before merge) never published and are out of scope.
- Evidence support: each verdict flip is tested with the same functions the CI stability gate
  uses (`rankings-engine/evidence-source.mjs`): a flip is evidence-driven when it cites an
  evidence id new to the pack with `newSourceSupport`, or is a downgrade after cited support
  disappeared. Today's rules are applied to yesterday's transitions, so digest-less
  same-source re-excerpts fail closed, exactly the "legacy same-source records without
  digests require review" posture in docs/ACCURACY.md.
- Labeled waves: matched on the underlying commit subjects of each first-parent step and
  cross-checked against `score-history.jsonl` note labels and each wave's own published
  counts (below).
- Rubric rollout: for unlabeled no-new-support flips from 2026-10-19 on, the committed judge
  cache at both step commits is validated against `cellHash` per prompt version. A cell whose
  cache moved from non-v5 to v5 at the step is a first-v5-touch flip, the designed rollout
  that PR #388 states ("remaining arenas keep their prior-version grades until their next
  natural judge touch"). The v2 cache key and prompt v5 landed the same day (1e129d0f1a,
  214d5d3489), and the hash payload has been byte-identical since, so the window where this
  check matters is fully covered.
- Wave reconfirmation: labeled waves re-judge every cell and rewrite every rationale
  (verified on the 2026-09-30 wave: zero byte-identical rows). A standing churn cell whose
  verdict a later labeled wave re-judged and kept is therefore corroborated by that wave's
  judge and is reported separately from the actionable standing set.
- A standing transition may still be individually correct: some flips were reviewed and kept
  in their PRs, and review approval is not machine-readable. The class means "verifiable by
  neither new evidence nor a labeled wave", the set that needs review or a re-judge, not a
  list of known-wrong verdicts.

## Results

17,910 published verdict transitions and 18,035 quality-only moves across 105 arenas since
the corpus began (2026-08-27).

| class | transitions | notes |
|---|---|---|
| labeled-migration: judge 2026-09-30 | 8,272 | matches docs/JUDGE-MIGRATION-2026-09-30.md exactly |
| labeled-migration: prompt-v3 fleet + pilot | 1,850 | d30d98754d (2026-09-04), 4ebaa82d47 pilot |
| labeled-migration: v5 five-arena re-grade | 337 | PR #388 (5a6a9df920); matches its own flip table |
| labeled-migration: v5 settlement wave 1 | 212 | PR #456 (54c2c5da0f) |
| labeled-migration: gpus + agent-sandboxes v5 | 88 | f6cce632a7, PR #395; labeled in score-history notes |
| evidence-driven: new cited support | 2,850 | |
| evidence-driven: downgrade after support loss | 323 | |
| rubric-rollout: unlabeled first v5 touch | 1,140 | 1,098 standing, 39 settled, 3 superseded |
| settlement-restore | 295 | the settle/revert scripts' restoring half |
| unsupported churn, settled | 1,048 | shipped, then returned to baseline (1,011 pre-October) |
| unsupported churn, superseded | 198 | shipped, later re-judged to a third value |
| unsupported churn, standing but wave-reconfirmed | 1,126 | verdict kept by a later labeled wave's judge |
| **unsupported churn, standing** | **171** | **the published verdict today is this flip's result** |

### The unlabeled v5 rollout (1,098 standing cells)

These flips cite no new support but their judge caches show the arena moving onto prompt v5
at that step: rubric-driven by construction, like the labeled waves, but carrying no
score-history note. Their direction profile (162 up, 866 down, 70 lateral) matches the
labeled five-arena re-grade (31 up, 291 down), which supports the rubric-driven reading.
Largest concentrations: government-services (113), project-management (107),
agentic-commerce (65), payments (64), banking-data-apis (58), startup-banking (57). The cheap fix is
retroactive labeling: a score-history note per arena naming the first-v5-touch commit, the
same treatment the 2026-09-30 wave got, at zero model cost. A ratified v6 migration
supersedes them instead.

### Wave-reconfirmed churn (1,126 cells)

1,087 of these are v3-era re-roll flips (September evidence waves under sonnet-5; 782 of the
full set are upgrades) whose verdicts the 2026-09-30 opus-5-5 wave re-judged and kept,
including 218 na↔none relabels the wave's judge ratified. Their published verdicts rest on
the labeled wave's judgment, not on the original churn. Two worked examples of what this
class looks like before reconfirmation:

- **Same source, deeper excerpt, no digest.** processors/apple-m4-pro:memory-spec-bandwidth
  went none(q0) to full(q9) on 2026-09-24 (6e8a8936ae) citing one new row whose excerpt
  quotes the exact bandwidth figure from the same apple.com newsroom URL that five earlier
  rows excerpted differently. With no source digest on either side the rules cannot
  distinguish a changed source from a re-extraction of an unchanged one, so it fails closed.
- **Same pack, new reading.** edge-platforms/vercel:custom-domains went from a zero-evidence
  none(q0) to full(q8) on 2026-09-16 (3082d5c177) citing only a row that was already in the
  pack when the none was published. No crawl, no new row, a re-roll of the same inputs.

Both verdicts were subsequently kept by the migration wave's judge, which is why they sit in
this class rather than the actionable one.

### Standing unsupported churn (171 cells)

The review's payoff class: published verdicts whose current value was set by a flip citing
nothing new to the pack, outside any labeled or cache-verified rubric wave, with no later
wave corroboration.

| slice | count |
|---|---|
| upgrades | 127 |
| downgrades | 36 |
| lateral (na→none 7, none→na 1) | 8 |
| v3-era, sonnet-5 judge (before 2026-09-30) | 11 |
| v4-era (2026-10-01 to 10-18) | 28 |
| v5-era, before the CI stability gate (10-19 to 10-29) | 83 |
| after the stability gate (10-30 on) | 49 |
| cell currently v5-cache-current | 121 |
| cell currently v5-stale | 50 |

The class is concentrated in a handful of merges. For every post-2026-10-19 row the cache
check confirms a same-rubric v5→v5 re-roll (first-v5-touch rollout is ruled out per cell):

| merge | date | arena(s) | cells |
|---|---|---|---|
| eaed1da46e (PR #475, story-runner refresh) | 2026-10-26 | error-tracking | 35 |
| d8669160e3 (PR #509, story-runner refresh) | 2026-11-01 | frontend-frameworks | 31 |
| fbeb9997db (PR #469, story-runner refresh) | 2026-10-24 | notes-knowledge | 28 |
| 2959dd8986 (PR #301, automation-PR integration) | 2026-10-14 | document-extraction, search-infra, observability, compliance-automation | 22 |
| 2821ef613f (PR #513, story-runner refresh) | 2026-11-01 | expense-management | 14 |
| b4d0e1c804 (PR #412, dead-citation repair) | 2026-10-22 | inference-providers, browser-agents | 9 |
| fedc54f108 (Foreloop bias-audit corrections) | 2026-09-21 | product-feedback | 9 |

The fedc54f108 rows are adversarial bias-audit corrections in an affiliated product's arena,
a reviewed channel; they are listed because the audit classifies on cited evidence alone.

**49 cells shipped after the gate, before digests.** Story-runner refreshes merged 2026-11-01
(PR #509: 31 cells, PR #513: 14, PR #552: 4; 41 of 49 upgrades). The flips cite freshly
numbered rows that re-excerpt the same URLs already in the pack; the gate as deployed then
accepted a new row id as new support. The source digest rule that rejects exactly this landed
the next day (c5194785a8). Example: frontend-frameworks/angular:agentic-public-api,
partial(q5) to full(q7), whose seven newly cited row ids re-excerpt the
https://angular.dev/cli and /overview pages that twelve digest-less rows in the prior pack
already covered.

Worst standing cells (upgrades, by quality delta; full list in the companion JSON):

| cell | flip | date | commit |
|---|---|---|---|
| error-tracking/glitchtip:openness-open-license | none(q0) → full(q7) | 2026-10-26 | eaed1da46e |
| frontend-frameworks/solid:openness-self-host | na(q0) → full(q7) | 2026-11-01 | d8669160e3 |
| frontend-frameworks/svelte:interactive-browser-tutorial | none(q0) → full(q7) | 2026-11-01 | d8669160e3 |
| expense-management/expensify:auto-receipt-matching | none(q0) → partial(q6) | 2026-11-01 | 2821ef613f |
| error-tracking/glitchtip:error-grouping-dedup | none(q0) → partial(q5) | 2026-10-26 | eaed1da46e |
| error-tracking/glitchtip:quota-spend-controls | none(q0) → partial(q5) | 2026-10-26 | eaed1da46e |
| expense-management/navan:expense-audit-trail | none(q0) → partial(q5) | 2026-11-01 | 2821ef613f |
| frontend-frameworks/angular:privacy-telemetry-optout | none(q0) → partial(q5) | 2026-11-01 | d8669160e3 |
| frontend-frameworks/react:custom-renderer-targets | none(q0) → partial(q5) | 2026-11-01 | d8669160e3 |
| frontend-frameworks/svelte:agentic-sdks | na(q0) → partial(q5) | 2026-11-01 | d8669160e3 |
| frontend-frameworks/svelte:ide-autocompletion | none(q0) → partial(q5) | 2026-11-01 | d8669160e3 |
| frontend-frameworks/vue:prebuilt-component-library-ecosystem | none(q0) → partial(q5) | 2026-11-01 | d8669160e3 |

glitchtip:openness-open-license illustrates why this class needs review rather than a blind
revert: the full(q7) cites two fresh re-excerpts of glitchtip.com pages whose digest-less
same-source peers were already in the pack when the zero-evidence none was published. The
verdict is plausibly correct on the merits; what is missing is machine-verifiable support
for the change, which a digest-bearing re-crawl or a scoped re-judge would supply.

### Already-settled churn, for scale

2,543 unsupported flips shipped at some point; 1,048 were later settled back and 198
superseded. The committed `revert-churn-*` and `settle-*` scripts in
`rankings-engine/scripts/` and the 295 settlement-restore transitions are that machinery
working as designed. Standing churn is what it did not reach.

### The registered-agents v6 island

One arena already publishes under the unratified v6 rubric: registered-agents (PR #564,
merged c0beaa0e47) carries 36 flips against its v5 baseline (b13ddb3211): 31 downgrades and
3 lateral relabels from the stricter verbatim-support prompt, plus 2 upgrades kept on new
evidence after the settle script (2ace6d1cd1) reverted the two no-new-support upgrades. It
was reviewed and settled in its PR, and the arena landed as a single merge, so none of this
is published transition churn; it is listed here because a decision to stay on v5 (Option B)
would strand it on v6 verdicts unless it is re-settled to the b13ddb3211 baseline or
explicitly carved out.

## Correction estimates

Fleet cache currency at HEAD: 23,245 of 44,147 cells current under prompt v5, 20,902 stale
(the preview measured 23,408/20,277 of 43,685 at its one-day-older pin; the drift is new
cells).

**Option A, ratify v6 and migrate the fleet (about $620 batched, per the preview).** Every
cell re-judges under the ratified rubric with the current response contract (verbatim
quotations, structured support), superseding all 171 standing-churn cells, the 1,126
wave-reconfirmed cells, and the 1,098 unlabeled rollout cells in one labeled wave. The
preview's flip profile (96% of flips downward, inferred and adjacent credit removed) bears
directly on the 127 standing unsupported upgrades, which sit in exactly the inferred-credit
pattern v6 rejects. Residual risk: v6 re-rolls are still re-rolls; the post-migration
baseline needs the same settlement treatment the registered-agents pilot got.

**Option B, revert v6 and settle the v5 backlog (about $240 batched, per the preview).**
Re-judging the 20,902 stale cells against current published baselines corrects none of the
171 by itself: the stability policy settles unsupported flips back to the pre-roll baseline,
and the pre-roll baseline here is the churned value. Clearing the legacy debt under Option B
therefore needs a scripted settlement first, restoring each standing cell's pre-churn
verdict from this report's per-cell baselines at zero model cost (the settle-registered-agents
cache-patch mechanism): directly for the 121 v5-current cells, and before the backlog wave
for the 50 v5-stale cells so the wave settles against restored baselines. The
registered-agents island needs its own call either way.

Under both options the 49 post-gate cells and the 12 upgrade cells in the table above are
the first review candidates, and the 1,098 unlabeled rollout cells need either retroactive
score-history labels (Option B) or supersession by the labeled v6 wave (Option A).
