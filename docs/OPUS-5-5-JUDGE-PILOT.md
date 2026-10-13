# Opus 5.5 judge pilot — decision memo

**Date:** 2026-09-30 · **Author:** pipeline lane (founder ask: "do the re-judge on Opus 5.5")
**Pilot:** full re-judge of the `ai-coding` flagship arena (14 products × 74 stories = 1,036
cells) with `PA_MODEL=claude-opus-5-5`, against the committed `claude-sonnet-5` baseline.
**Isolation:** run entirely into a scratch directory via `pipeline/scripts/rejudge-pilot.ts`
(committed with this memo, with `pipeline/scripts/rejudge-pilot-diff.ts`). Committed `data/`,
the judge cache under `pipeline/cache/judge/`, and `rankings.json` were never touched;
`recompute-check` on the real tree stayed **ALL DETERMINISTIC** throughout. The pilot used the
identical `SYSTEM` prompt, `judgePrompt`, validation rules, and correction loop exported by
`pipeline/stages/judge.ts` (prompt `v3`), so every difference below is the model, not the
prompt.

## Recommendation: ADOPT — staged per-arena via the Batch API, with the mechanics below

Short version: Opus 5.5 reads the v3 rubric more faithfully than Sonnet 5 (7 of 10 manually
adjudicated flips favored its reading, including one weight-3 cell where the Sonnet verdict
plainly violates the prompt's own MCP boundary example), it cites slightly more evidence per
verdict, and at $4/$20 per MTok it costs exactly 2.0x Sonnet 5 interactive — and **the same as
today's Sonnet interactive spend if the migration re-judge runs through the Batch API**
($2/$10). The full-fleet migration is a ~$570–1,300 one-time cost. "Adopt for new arenas only"
is the worst of the three options: it leaves documented Sonnet misjudgments published in the
oldest arenas and makes the cross-arena `/global/[story]` comparisons judge-inconsistent
indefinitely. The real cost of adoption is not dollars — it is the migration mechanics
(§ Migration mechanics), which are tractable but must be done deliberately.

---

## 1. Agreement statistics (1,036 cells)

| Metric | Value |
|---|---|
| Exact verdict agreement | **767 / 1,036 (74.0%)** |
| Credit-direction agreement (both credit-bearing or both zero) | **911 / 1,036 (87.9%)** |
| Verdict flips | 269 — 195 credit upgrades, 40 downgrades, 34 lateral (`na`↔`none`) |
| Mean quality delta where the tier matched | **−0.24** (mean abs 0.61) — Opus is slightly *stricter* on quality within an agreed tier |
| Mean cited evidence ids on credit verdicts | 5.06 (Sonnet) → **5.71 (Opus)** |
| Rule-violation correction rounds needed | 3 extra calls across 1,036 cells (0.3%); zero cells failed validation |

Context for the 26% disagreement: Sonnet 5 disagrees with **itself** on ~9% of cells on a
plain re-roll fleet-wide (README §7), and hit 25% on one measured wave (docs/SCORING-REVIEW.md
§2). So roughly a third to half of the observed cross-model disagreement is ordinary judge
re-roll noise; the rest is genuine model difference, characterized below.

### Distribution shifts (the model's fingerprint)

| Verdict | Sonnet 5 baseline | Opus 5.5 pilot |
|---|---|---|
| full | 286 | 348 |
| partial | 335 | 378 |
| none | 338 | 297 |
| **na** | **50** | **10** |
| **disputed** | **27** | **3** |

| Confidence | Sonnet 5 | Opus 5.5 |
|---|---|---|
| high | 348 | 123 |
| medium | 549 | 795 |
| low | 139 | 118 |

Top flip transitions: `none→partial` 93, `partial→full` 70, `na→none` 33, `full→partial` 18,
`partial→none` 18, `disputed→partial` 11, `disputed→full` 11, `na→partial` 9.

Three systematic behaviors:

1. **Opus applies the v3 `na`-vs-`none` decision procedure more literally.** It asks "is this
   a fair question for this KIND of product" at the category level and almost never reaches
   `na` (50 → 10). 42 of the 50 baseline `na` cells became `none`/`partial`. This *grows the
   score denominator* for narrow products (see aider, −1 rank despite higher scores).
2. **Opus reserves `disputed` for hard contradictions** (27 → 3). v3 says general skepticism
   must not create a dispute; Opus takes that further and treats most concrete-but-anecdotal
   failure reports as quality caveats rather than contradictions. Partly right by the rubric,
   partly a real loss (see flip reads 8 and 10).
3. **Opus grants `partial` for workaround-level evidence** (`none→partial` is the largest
   class). Usually grounded (documented adjacent capability, q3–q5, confidence low/medium),
   occasionally a stretch (read 1). Combined with `partial→full` upgrades, the arena's score
   scale shifts up ~+2–8 aiEra points per product — a judge-scale change, not a capability
   change.

## 2. Flip quality — 10 manual evidence spot-reads

I read the cited evidence for 10 flips spanning every major transition class and judged which
model read the evidence correctly. **Opus better: 7 · Sonnet better: 3.**

| # | Cell (weight) | Sonnet → Opus | My read |
|---|---|---|---|
| 1 | aider:live-app-debugging (w1) | none q0 → partial q3 | **Sonnet.** Evidence (`/run`, `/web` scraping, screenshots) is not about debugging a *live running* app; Opus's q3 credits off-story material the evidence-relevance rule says to ignore. |
| 2 | claude-code:automation-bulk-operations (w2) | disputed q6 → full q7 | **Opus (lean).** The one concrete failure (replace_all corrupting a constant) is a reliability caveat from a daily user, not evidence the capability "does not work as claimed"; v3 says fold that into quality/confidence, which Opus did (q7, conf medium, caveat named). |
| 3 | github-copilot:agentic-mcp-server (w3) | full q7 → na q0 | **Opus (clear).** All cited MCP evidence is client-side ("use the GitHub MCP server … *from Copilot Chat*"). The v3 boundary example says client-side evidence "must never be credited here" for a product that is itself an agent. The Sonnet `full` violates the prompt's own rule; the Opus call matches the direction of the earlier human adjudication precedent on this cell (README §9's partial→none downgrade for client-side-only MCP evidence, before the current evidence pack). Biggest single rank-mover (copilot #5→#8). |
| 4 | aider:automation-versioned-workflows (w1) | full q8 → partial q5 | **Opus.** The story is versioning *the automations*; the evidence shows git-versioning of the automation's *outputs*. Opus caught the referent distinction Sonnet glossed. |
| 5 | devin:openness-self-host (w3) | none q0 → partial q5 | **Opus (lean).** Outposts ("run Devin sessions inside infrastructure you control") is direct, on-topic first-party evidence of partial delivery; zero credit was too harsh. Opus correctly notes the control plane stays hosted. |
| 6 | devin:issue-to-pr-automation (w3) | partial q6 → full q7 | **Sonnet (lean).** Hands-on reports (extraneous breaking changes, 10–15-minute babysitting) are significant caveats on exactly this story; "clearly delivers" overstates it. |
| 7 | codex:cross-session-memory (w2) | partial q3 → none q0 | **Opus (lean).** The story requires *automatic* memory; `codex resume` is manual reopen/search. Sonnet credited a feature the story's qualifier excludes. |
| 8 | gemini-cli:enterprise-grade-auth (w2) | disputed q4 → partial q4 | **Sonnet (lean).** A hands-on report of auth *failing* for Workspace accounts is a concrete contradiction of an "enterprise features" claim — the disputed bar is met. One of the cases where Opus's disputed-aversion loses signal. |
| 9 | aider:privacy-data-residency (w2) | na q0 → partial q4 | **Opus (lean)** on applicability: residency is a fair buyer question for the category, so `na` was wrong under the v3 ordering; whether local-model support earns partial vs none is arguable. |
| 10 | devin:natural-language-feature-implementation (w3) | disputed q5 → full q7 | **Opus (lean).** The capability demonstrably works (same reporter "got real work done"); scope-creep is a caveat, not a contradiction. `partial` would have been ideal; `disputed` at 0.3x credit was the worse error. |

Also observed (not counted): aider:agentic-mcp-server `none→na`, where Opus matches the v3
boundary example exactly and the baseline does not.

**Pattern:** Opus tracks story qualifiers ("automatically", "my automations",
"JetBrains-specific", "live running") and the prompt's decision procedures more precisely, and
its rationales more often name the exact mechanism in the excerpt. Its two weaknesses are
generosity at the none/partial boundary for workaround evidence, and under-use of `disputed`
when concrete contradicting reports exist. Sonnet's characteristic errors are rule violations
(crediting client-side MCP evidence, `na` for applicable axes) and inference beyond evidence
("implicitly allows").

## 3. Rank preview if the Opus verdicts were adopted (ai-coding)

Scores rise almost everywhere (denominator/na effects + upgrade skew) — these moves are the
judge change, not product changes:

| # (move) | Product | aiEra | coverage score |
|---|---|---|---|
| 1 (=) | cursor | 52.1 → 59.8 | 56.6 → 61.0 |
| 2 (=) | opencode | 47.4 → 50.1 | 40.7 → 43.5 |
| 3 (=) | claude-code | 40.4 → 44.6 | 48.6 → 53.1 |
| 4 (=) | cline | 39.8 → 43.2 | 40.2 → 43.3 |
| 5 (+1) | antigravity | 36.8 → 39.1 | 36.8 → 41.7 |
| 6 (+1) | codex | 32.7 → 38.9 | 39.9 → 42.8 |
| 7 (+2) | devin | 30.2 → 36.5 | 37.7 → 41.3 |
| 8 (−3) | github-copilot | 37.4 → 36.4 | 45.5 → 43.2 |
| 9 (−1) | aider | 30.5 → 34.3 | 28.6 → 30.0 |
| 10 (=) | conductor | 29.8 → 29.4 | 32.8 → 31.0 |
| 11 (+1) | gemini-cli | 21.2 → 29.2 | 21.9 → 28.9 |
| 12 (−1) | cubic | 26.8 → 28.6 | 25.2 → 26.7 |
| 13 (=) | byteask | 20.4 → 27.4 | 22.8 → 26.4 |
| 14 (=) | random-labs | 15.5 → 16.4 | 19.5 → 18.9 |

Top 4 unchanged. The two big movers are both judge-reasoning stories, not evidence stories:
github-copilot −3 is dominated by the weight-3 `agentic-mcp-server` full→na (a correct call
per spot-read 3) plus `partial→none` downgrades where its evidence was client-side or generic;
gemini-cli +1 with the largest aiEra gain (+8.0) because the baseline had six `disputed`
verdicts on it (the most of any product) that Opus re-graded as partial/full with the failure
reports folded into quality.

**Bias-disclosure note (required if adopted):** claude-code had the second-fewest flips (13)
but 10 were upgrades, including all three of its `disputed` cells going to `full` — its
coverage score rises 48.6 → 53.1 (rank unchanged, #3). An Anthropic judge model re-grading
Anthropic's product upward must be stated plainly in README §9 and /methodology, alongside the
counter-signals: the pilot's largest beneficiary is gemini-cli, its largest loser is a
non-Anthropic product on a *correct* rule application, and Opus also downgraded claude-code
(`vulnerability-autofix` full→partial, `agentic-scoped-keys` partial→none).

## 4. Cost — pilot actuals and extrapolation

Actual token spend, summed from API response `usage` metadata across every call (including
retries and correction rounds; zero cache usage — the judge makes independent one-shot calls):

| | Calls | Input tokens | Output tokens | Cost @ Opus 5.5 $4/$20 per MTok |
|---|---|---|---|---|
| Smoke run (aider, 74 cells) | 74 | 534,260 | 32,407 | $2.79 |
| Full run (remaining 962 cells) | 965 | 7,344,471 | 447,177 | $38.32 |
| **Pilot total (1,036 cells)** | **1,039** | **7,878,731** | **479,584** | **$41.11** |

Per cell: ~7,600 input + ~460 output tokens ≈ **$0.040/cell** (Opus 5.5 interactive).
The same tokens on Sonnet 5 ($2/$10) would cost $20.55 — the multiplier is exactly **2.0x**.
Run at concurrency 8; zero failed cells, zero validation failures.

**Full fleet** (93 arenas, 32,949 cells; fleet evidence packs average ~17.7 KB/cell vs
ai-coding's 21.4 KB, so scale the input term by ~0.83):

| Scenario | Estimated cost |
|---|---|
| Full-fleet re-judge, Opus 5.5 interactive | **~$1,130** (upper bound $1,310 if every arena were ai-coding-sized) |
| Full-fleet re-judge, Opus 5.5 **Batch API** ($2/$10) | **~$570** — identical to what the same re-judge costs on Sonnet 5 interactive today |
| Reference: full fleet on Sonnet 5 interactive | ~$570 |

**Ongoing cadence:** story-runner refreshes one arena per 6 h (≈28 arena-runs/week) and the
cellHash cache means only evidence-changed cells re-judge. Marginal pricing is **$40 per 1,000
cells interactive / $20 per 1,000 via batch** — i.e. steady-state judge spend doubles versus
today, from a base that is already small (a *worst-case* week that fully re-judged every
refreshed arena ≈ 9,900 cells ≈ $395 interactive; realistic evidence-driven weeks re-judge a
small fraction of that). Calibration/uncertainty passes (which share `PA_MODEL` via
`pipeline/llm.ts`) double in cost on the same basis.

## 5. Migration mechanics (if adopted)

1. **The cache key does not know the model.** `cellHash` covers (storyId, title, evidence
   ids+excerpts, PROMPT_VERSION) — switching `PA_MODEL` alone would silently keep every cached
   Sonnet verdict "valid" and produce a mixed-judge fleet. The switch MUST ship with a cache
   invalidation: bump `PROMPT_VERSION` (e.g. `v3` → `v4` with release notes "v4 = v3 prompt,
   Opus 5.5 judge") — and better, fold the model id into the `cellHash` payload so future model
   changes are first-class invalidators. Update the hard-coded `PROMPT_VERSION = 'v3'` copy in
   `pipeline/scripts/restamp-judge-cache-intdir.ts`, and note that `normalize` stamps
   `origin.promptVersion`, so newly normalized stories will carry the new tag.
2. **Judge-cache invalidation = full re-judge = manual adjudications are wiped.** At least
   four arenas carry audit-annotated verdicts (ai-coding: 23 cells; product-feedback: the 14
   Foreloop bias-audit corrections; ai-code-review; workflow-automation). A fresh Opus pass
   overwrites them — the exact clobbering failure mode the
   probe-stage replacement gotcha documents for evidence. Before cutover, extract every cell
   whose rationale carries an audit marker into a re-adjudication worklist; after the re-judge,
   re-review those cells (many Sonnet-era corrections — e.g. the copilot MCP downgrade — Opus
   now gets right on its own, so this is a review, not a blind re-apply).
3. **Run the migration per-arena through the Batch API**, not as one interactive big bang:
   half price, no rate-limit contention with story-runner, and each arena's diff can be
   reviewed and landed atomically (verdicts.json + rankings.json + score-history in one
   commit). The two committed pilot scripts are the tooling: `rejudge-pilot.ts` produces the
   scratch verdicts, `rejudge-pilot-diff.ts` the per-arena flip/rank report for review.
4. **Churn-policy framing — do NOT apply the revert rule to the migration wave.** The
   re-judge stability policy reverts flips that cite no new evidence; under a judge change,
   *every* flip cites no new evidence by construction — applying the rule would revert the
   entire migration. Instead: label the wave explicitly ("judge model migration: sonnet-5 →
   opus-5-5, prompt v4"), publish per-arena kept-flip counts and the before/after leaderboards
   (this memo's §3 table is the template), and stamp `score-history.jsonl` entries from the
   wave so the score time series shows a labeled discontinuity, not a silent evidence-looking
   move. Rank moves at migration reflect the judge change and must be presented as such.
5. **Re-measure the noise machinery.** `data/*/uncertainty.json` transition matrices and the
   score-interval bands (README §8) were measured from *Sonnet* re-rolls; Opus has a different
   (likely narrower — conf distribution is tighter, medium-heavy) noise profile. Re-run the
   uncertainty pass on a sample under Opus before republishing bands; a 100-cell double
   re-roll costs ~$8 and should happen *before* fleet cutover as the go/no-go stability check.
6. **Docs to update in the same release:** README §7 (judge model name + new prompt version),
   README §9 and `app/methodology/page.tsx` (bias disclosure: judge is still an Anthropic
   model, Anthropic's products in ai-coding/frontier-models re-graded by it — include this
   pilot's claude-code numbers from §3 verbatim), ACCURACY.md review-point language, and the
   `na`-rate/`disputed`-rate expectations anywhere they're documented (both collapse under
   Opus — downstream consumers like the certification and interval code that key off
   `disputed`/`na` frequencies should be sanity-checked).

## 6. Why not the alternatives

- **Don't adopt:** leaves known rule-violating verdicts published (spot-read 3 is a weight-3
  cell that decides copilot's rank), keeps the over-generous `disputed` usage that penalizes
  products 0.3x on anecdotes, and passes up a judge that demonstrably follows the rubric we
  wrote. The 2x marginal cost is noise at current volumes.
- **Adopt for new arenas only:** permanently forks the fleet into two judge regimes. The
  `/global/[story]` cross-arena pages and the stacks machinery compare cells across arenas —
  a `partial` from Opus and a `partial` from Sonnet would no longer mean the same thing, and
  the fork never heals without doing the full migration anyway. Only defensible as a
  short transition state while the per-arena batch migration runs.

## 7. Caveats

- Single arena, single Opus pass: Opus's own re-roll variance is unmeasured (mechanics §5
  covers this before cutover). n=10 adjudicated flips is a directional signal, not a proof.
- ai-coding is evidence-deep and includes Anthropic's own product; a second pilot on one
  thin-evidence, no-conflict arena (~$5–15) would confirm the generosity shift generalizes
  before the fleet run — cheap insurance, not a blocker.
- The score-scale inflation (+2–8 aiEra) means published historical comparisons break at the
  migration boundary; the labeled-discontinuity mechanics in §5.4 are the mitigation, not a
  reason to stay.

## Appendix — reproduction

```bash
# pilot (scratch, never touches data/ or pipeline/cache/)
PA_MODEL=claude-opus-5-5 pnpm exec tsx pipeline/scripts/rejudge-pilot.ts \
  --category ai-coding --out /tmp/opus55-pilot --concurrency 8
# diff + rank preview + per-flip report
pnpm exec tsx pipeline/scripts/rejudge-pilot-diff.ts --category ai-coding --pilot /tmp/opus55-pilot
```

Pilot artifacts (scratch, uncommitted by design): `/tmp/opus55-pilot/ai-coding/{verdicts.json,usage.json,diff-report.json,cells/}`.
Model ids verified against the live models API on 2026-09-30; prices from
platform.claude.com/docs/en/about-claude/pricing (Opus 5.5 $4/$20, batch $2/$10, cache-hit
$0.20; Sonnet 5 $2/$10, batch $1/$5).
