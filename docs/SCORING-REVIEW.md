# Scoring review: is the PA Score calculation sophisticated enough?

Written 2026-09-14, prompted by a founder question: *"why is Asana's PA Score higher than
Linear's given all the rest of the metrics for Linear seem better? Is the overall calculation
sophisticated enough given how far we are?"* This document answers with the case data, then
gives an honest assessment of where the formula is crude and what to do about it.

## 1. The Asana-vs-Linear case: coverage asymmetry, not formula error

Before the fix (project-management, 2026-09-10 rankings):

| | PA Score | agentReady | apiQuality | agenticApp | openness | automation |
|---|---|---|---|---|---|---|
| asana | **42.9** | 44.5 | 64.4 | 51.5 | 20.6 | 32.3 |
| linear | 36.9 | 51.2 | **0** | 70.7 | 12.6 | 56.0 |

Linear beat Asana on four of five blend components and lost anyway. The culprit was the fifth:
`apiQuality = 0` at weight 0.2 — a flat 0 for a product that ships an introspectable GraphQL
API, a public Apollo Studio explorer, a published schema SDL, exact per-auth rate-limit tables,
and a documented deprecation policy (and had just earned Certified Agent-Ready, with a live
official MCP server at mcp.linear.app).

That 0 was not a judgment; it was a **crawl gap**. All four scored api-quality stories were
`none`/q0 because the evidence pack simply never contained Linear's rate-limiting, deprecations,
or schema pages — the crawl only sees `urls.*`, and those pages weren't listed. Asana had the
*identical* defect (apiQuality 0 despite a real OpenAPI repo and sandbox) until the 2026-09-10
crawl-gap wave fixed it; Linear was on the same 54-offender audit list and never got the fix.

After giving Linear the same treatment (add the missing developer-docs URLs to `urls.extra`,
re-crawl, re-extract, append verbatim supplemental docs evidence, re-judge, churn-revert,
derive — commit this file ships with):

| | PA Score | apiQuality | rank |
|---|---|---|---|
| linear | **48.6** | 45.5 | **#1** |
| asana | 42.9 | 64.4 | #2 |

So the founder's intuition was right and the formula was not the problem: **fed symmetric
inputs, the blend ranks Linear first**. The blend arithmetic (`lib/scoring.ts`) did exactly what
it says on the tin both times. The failure was upstream — asymmetric evidence coverage — and
the same class of failure has now bitten twice (Databricks wave, then Linear). That repetition
is the real finding.

Verified honest residuals: Linear's apiQuality (45.5) is still *below* Asana's (64.4), and
that's correct on the current evidence — Linear has no versioned API (GraphQL, deprecation
policy only → partial q5), no documented developer sandbox (`na`, same ruling as Figma), and no
OpenAPI-style downloadable spec (introspection + SDL → partial q6), where Asana ships a real
OpenAPI repo, an in-context explorer, and a sandbox. Linear wins the overall PA Score on the
other four components, which is the blend working as designed.

## 2. Where the formula IS crude

Honestly, in descending order of how much each one distorts outcomes today:

1. **Evidence-coverage sensitivity dominates everything else.** `none` scores identically to
   "verified can't do it," so one missing URL zeroed a whole component and moved Linear's PA
   Score by **11.7 points** (36.9 → 48.6). Compare that to the published 68% confidence band
   (±~2.3 around Linear's PA Score, from measured judge re-roll noise): the intervals we show
   capture *judge* noise but say nothing about *coverage* error, which is empirically ~5x
   larger when it strikes. Our current mitigation is manual audits (the 54-offender list) —
   reactive, and Linear sat un-fixed on that list for four days while ranked #2 on a broken 0.

2. **Judge re-roll noise is large and handled by fiat.** This wave re-judged Linear's 83 cells
   against an expanded pack: 21 cells (25%) flipped verdict or quality while citing **no new
   evidence** — pure re-roll noise, reverted per the established churn policy. The policy keeps
   published scores stable, but it is stabilization by rule, not low variance: a fresh judge
   run on unchanged evidence would disagree with itself on roughly a quarter of cells (mostly
   ±1 quality, but including verdict-tier flips like none↔partial).

3. **na-renormalization asymmetries.** Two related effects. (a) `computeAiEra` renormalizes
   weights over non-null components, so a product missing an entire axis is silently graded on
   a shorter exam. (b) `weightedPercent` drops `na` cells from the denominator, so products
   with more `na` cells are graded on fewer questions — Linear answers 81/83 applicable
   stories, Asana 76/83; every extra applicable story is an extra chance to lose points, which
   mildly punishes breadth. And the na/none boundary is itself judge-noisy (this wave's re-roll
   flipped Linear's api-sandbox na→none and time-tracking na↔none with no new evidence —
   caught and reverted, but the boundary is clearly soft).

4. **Fixed, unvalidated blend weights.** `AI_ERA_WEIGHTS` (0.3/0.2/0.2/0.15/0.15) are
   editorial. That's disclosed and deliberately contestable, which is fine — but we've never
   published a sensitivity analysis, so a reader can't tell which adjacent ranks are robust and
   which would flip under ±5 points of weight. Same at the story level: integer weights 1–3,
   assigned at story-authoring time, never revisited.

5. **Process coupling risks silent staleness.** Found while shipping this fix: the 2026-09-11
   integrations enrichment appended evidence to 35 products without re-judging, leaving every
   affected judge-cache cell stale (415 cells in project-management alone) — the next judge run
   in any touched arena would have failed its staleness gate. Scores didn't move, but the
   invariant "published verdicts correspond to the current evidence pack hash" was broken for
   three days with no alarm. (Reconciled for project-management by
   `pipeline/scripts/restamp-judge-cache-intdir.ts`, which encodes why restamping equals the
   churn-policy fixed point; other enriched arenas still carry the stale hashes.)

## 3. Improvement proposals (with tradeoffs)

Ranked by value-per-effort; 1–3 are worth doing now, 4–5 when the leaderboards start driving
real decisions.

1. **Automated coverage-contradiction audit as a pipeline gate.** Generalize the query that
   found the 54 offenders (component A strong + correlated component B all-zero, e.g.
   `agentic-public-api ≥ partial` but every api-quality story none/q0) into a standing script
   with a committed allowlist of verified-honest exceptions (Databricks' missing OpenAPI,
   Figma's missing sandbox). Cheap, catches the empirically-largest error class proactively.
   *Tradeoff:* pattern-based — it institutionalizes today's known correlations and will miss
   novel gap shapes; the allowlist needs maintenance or it rots into suppression.

2. **Expose per-component coverage, and a coverage-aware interval.** Alongside apiQuality
   et al., publish how much evidence each component's verdicts actually cite (e.g. "4/5
   stories have ≥1 evidence item in pack"), and widen the score interval for low-coverage
   components rather than presenting a crawl-gap 0 with the same confidence as a
   well-evidenced 64. *Tradeoff:* estimating P(artifact exists | we didn't find it) honestly is
   hard; a crude proxy (evidence count) is gameable by URL-stuffing and could reward verbosity
   over substance. Start with disclosure, not score adjustment.

3. **Shrinkage toward a category prior for thin-evidence components.** A component computed
   from ≤N applicable cells or ≤M cited items shrinks toward the category median instead of
   standing at a raw extreme (Bayesian small-sample treatment; the Monte Carlo machinery in
   `lib/scoreIntervals.ts` already has the plumbing). This would have softened Linear's 0 to
   "low, uncertain" rather than "confidently worst." *Tradeoff:* directly erodes the
   evidence-or-nothing brand promise — a product with a genuinely absent API gets pulled up
   toward the pack, and vendors will argue every low score is "thin evidence." Needs a visible
   "shrunk" marker if adopted, and probably shouldn't apply when the zeros come from *probes*
   (verified absence) rather than crawl silence.

4. **Publish weight-sensitivity on ranks.** For each arena, recompute rankings under
   perturbed blend weights (±33% per component, renormalized) and badge ranks that never flip
   as "weight-robust." Trivially cheap and deterministic. *Tradeoff:* adds a second-order
   concept to explain; close arenas will show lots of instability, which is honest but blunts
   the headline ranking (that's arguably the point).

5. **Judge-noise reduction at the source, not just churn-revert.** Options: judge each cell
   k=3 times and take the median (3x cost — the measured 25% re-roll disagreement says k=1 is
   under-sampled for cells near tier boundaries); or restrict re-judges to cells whose *cited*
   evidence changed (cheaper, but breaks the whole-pack honesty contract that lets new evidence
   reshape any verdict). The churn policy is the current compromise and it's defensible — but
   it should be reported (kept/reverted counts per wave) rather than silent. *Tradeoff:* cost,
   or contract erosion, respectively.

## 4. Bottom line

The blend is simple, disclosed, and behaved correctly in the exact case that prompted the
question — sophistication of the *formula* is not the binding constraint. The binding
constraints are (a) evidence coverage, which produces errors ~5x larger than the noise our
confidence intervals model, and (b) judge re-roll variance, currently managed by policy rather
than reduced. At this stage, instrumenting coverage (proposals 1–2) buys more score integrity
than any formula upgrade; shrinkage and weight-sensitivity (3–4) are the right next layer once
coverage is measured rather than assumed.
