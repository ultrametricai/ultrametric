# Ultrametric Methodology

The full methodology writeup — evidence tiers, judging, scoring, the claims-integrity index,
the Agenticness Index, the Overall score, confidence grades, score intervals, story provenance,
re-judge stability, and bias disclosure. The on-site
[/methodology](https://ultrametric.ai/methodology) page is a tight one-screen summary of this
document, and the [README](./README.md#methodology) carries a short summary; this file is the
source of truth. See also [README.md](./README.md) for the ranking list, data layout, and
pipeline workflow, and [CONTRIBUTING.md](./CONTRIBUTING.md) for how to contest a verdict.

New to the site and just want plain-language answers ("what does `na` mean," "why does this
score look low," "how do I disagree")? See **[docs/SCORING.md](./docs/SCORING.md)** — a
one-page, jargon-free companion to this technical writeup. For a critical self-assessment of
the scoring formula's limits (coverage sensitivity, judge noise, blend-weight choices) and the
improvement roadmap, see [docs/SCORING-REVIEW.md](./docs/SCORING-REVIEW.md).

## Evidence tiers

Every claim about a product is backed by an **evidence** item with one of four tiers, ranked
strongest first:

**`probe` (tested) > `github` (code) > `community` (independent) > `claimed-docs` (vendor claim)**

| Tier | What it is |
|---|---|
| `probe` | direct, hands-on observation of the product (tested) |
| `github` | README/repo content (code) |
| `community` | independent forums/reviews/social posts (independent) |
| `claimed-docs` | vendor site/docs/changelog copy (vendor claim) |

Evidence is stored per product at `data/{category}/evidence/{product}.json`, each item with a
stable id, tier, source URL, verbatim excerpt, and fetch timestamp (`fetchedAt`).

A direct, hands-on probe of the product (see "Probe harness" below) outranks a GitHub README,
which outranks independent community commentary, which outranks the vendor simply describing
its own product. `lib/verification.ts`'s `strongestEvidence()` walks a verdict's cited
evidence down this ladder and returns the single best-supported item — that's the source
behind every "proof ↗" link on the site (product page verdict rows, story matrix cells, and
battle round cards). It's a different, finer-grained ranking than the coarser
`verificationLevel` badge (`tested`/`corroborated`/`vendor-claim`/`disputed`), which groups
`github` in with `claimed-docs` for display purposes; `strongestEvidence` keeps them distinct
so the proof link always points at the most credible single source, not just the highest
badge tier.

### Probe harness

`pnpm pipeline probe` runs a small set of keyless, hands-on checks per product and turns each
*definitive* result — positive or negative — into a `probe`-tier evidence item (ambiguous
results, e.g. a 403 from a WAF, produce no item rather than a guess): whether `/llms.txt`
resolves, whether the docs URL serves a `.md` variant, whether a conventional OpenAPI spec
path resolves, and whether the curated `links.mcp`/`links.cli` URLs are live. See
`pipeline/stages/probe.ts` (`runProbeChecks`) for the exact rules and
`pipeline/__tests__/probe.test.ts` for coverage with a mocked fetcher (no live network calls
in tests). Like `collect-community`, re-running `probe` for a product replaces only its prior
`probe`-tier items — other tiers are untouched.

## Judging

For every (product, story) pair, an LLM judge reads only that product's evidence pack for that
story and returns a **verdict**:

| Verdict | Meaning |
|---|---|
| `full` | Clearly delivers the story |
| `partial` | Delivers, with significant caveats or extra tooling required |
| `disputed` | Vendor claims it, but community/hands-on evidence contradicts — must cite both sides |
| `none` | No evidence it delivers (never used for capabilities that don't apply — see `na`) |
| `na` | The story's axis doesn't apply to this product at all (wrong-axis, e.g. an OS-install story for a SaaS API) |

Each verdict also carries a `quality` score (0–10, how *well* it delivers — 0 for `none`/`na`), a
`confidence` level, a short rationale, and the specific `evidenceIds` the judge relied on. The
judge is instructed to use **only** the evidence pack, never outside/training knowledge —
absence of evidence for a well-known capability still yields `none`, not a guess.

Verdicts are cached and keyed on a hash of `(storyId, story title, evidence ids+excerpts, prompt
version, judge model id)`, so re-running `judge` is a no-op unless the story, the evidence,
the prompt version, or the judge model actually changed.

### Judge model & prompt version

The judge is an Anthropic model — `claude-opus-5-5` by default since 2026-09-30 (previously
`claude-sonnet-5`), overridable via the `UM_JUDGE_MODEL` env var (`pipeline/llm.ts`; the pre-rename `PA_MODEL` spelling still works as a deprecated fallback) — driven by a
versioned system prompt in `pipeline/stages/judge.ts` (`PROMPT_VERSION`, currently **`v4`**;
the v4 bump marks the judge-model migration — the prompt text is unchanged from v3). Because
the prompt version AND the judge model id are part of every cell's cache key, changing either
deliberately invalidates all cached verdicts, so a prompt or model change is always followed
by a full re-judge rather than silently mixing verdicts from different judge generations.

What each version added:

- `v2` — evidence-only judging (no training knowledge), `na` wrong-axis tier, disputed
  requires citations from two distinct evidence tiers.
- `v3` — three calibration fixes, each traceable to an audited defect:
  1. **`na` vs `none` decision procedure** with few-shot boundary examples (applicability is
     decided *before* looking at evidence; lack of evidence for an applicable axis is always
     `none`).
  2. **Explicit 0–10 quality rubric**, plus a hard requirement that any quality below 10
     names its gap in the rationale (`"missing for 10: …"`) — mechanically enforced by
     `validateVerdictRules`, which rejects sub-10 `full`/`partial` verdicts missing the
     clause.
  3. **Evidence-relevance rule**: a citation may only support or undermine a verdict if its
     content is *about the story's subject* — off-topic negative sentiment (e.g. unrelated
     security news) must not move a verdict or appear in the rationale.

Calibration is gated by `pnpm calibrate` (`pipeline/scripts/calibration-check.ts`), which
re-runs the live judge against a hand-verified golden-cell set
(`pipeline/golden/golden-cells.json`) and fails on more than 2 tier mismatches.

## Scoring formula

A cell's score is `story.weight × quality × verdictFactor`, where the verdict factor is
`full=1.0, partial=0.6, disputed=0.3, none=0, na=excluded`. A product's overall score (and each
per-theme score) is the weighted percentage across all **applicable** (non-`na`) cells:

```
score = 100 × Σ(cellScore) / Σ(story.weight × 10)   — over non-na cells only
```

`na` cells are excluded from both numerator and denominator entirely — they neither help nor
hurt a product's score. Head-to-head battles use the same per-cell scores: each story is a
"round" won by whichever product scores higher on it (ties are draws, `na` rounds are excluded),
and the overall battle winner is whoever wins more story-weight.

**Important:** scores measure **evidenced story coverage**, not absolute product quality. A
product with a thin crawl (fewer/weaker evidence items) will score lower even if it's
objectively excellent — the judge can only score what's in the evidence pack. Conversely, a
wrong-axis story is marked `na` and excluded rather than counted against a product.

### Claims vs reality — the claims-integrity index

Every product's vendor claims (extracted from its own docs/GitHub materials by
`pipeline/stages/claims.ts`) are reconciled against our judge's independent verdicts
(`lib/claims.ts`). Each claim that maps onto a story lands in one of three **testable**
buckets: *verified* (full/partial verdict backed by corroborated/tested evidence),
*unverified* (full/partial verdict, but only the vendor's own claim backs it), or
*contradicted* (verdict disputed/none/na). Claims mapping onto no story are **untestable**
(a taxonomy gap, not a mark against the product) and are excluded entirely.

The claims-integrity score (`lib/claimsIntegrity.ts`) rewards claims we independently
verified and actively penalizes ones the evidence contradicts:

```
testable  = verified + unverified + contradicted        — untestable claims excluded
integrity = 100 × max(0, verified − 2 × contradicted) / testable
```

Verified claims count fully, unverified claims count for nothing (they only inflate the
denominator), and each contradicted claim cancels **two** verified ones — overpromising is
worse than staying silent — with the score clamped at 0.

**Null, never zero:** a product with no claims data (or no testable claims) gets `null`,
not a fabricated `0` — same rule as every other index here: "we don't know" is not "the
worst", and nulls sort last. The full cross-market ranking lives at
[/rankings/claims-integrity](https://ultrametric.ai/rankings/claims-integrity),
and each product page's "Claims vs evidence" section opens with its integrity summary.

## The Agenticness Index

Every ranking includes the same 9 canonical "agenticness" stories, injected verbatim (never
LLM-authored) so agent-readiness is comparable across categories. Defined in
`pipeline/agentic-stories.ts`:

| Story id | Story | Weight |
|---|---|---|
| `agentic-public-api` | I can drive the product through a documented public API | 3 |
| `agentic-official-cli` | I can use an official CLI | 2 |
| `agentic-mcp-server` | I can connect an agent via an official MCP server | 3 |
| `agentic-mcp-client` | I can plug MCP servers into this product so it can use their tools | 3 |
| `agentic-webhooks` | I can subscribe to events via webhooks | 2 |
| `agentic-sdks` | I can build against official SDKs | 2 |
| `agentic-agent-docs` | I can point an agent at llms.txt or agent-oriented docs | 2 |
| `agentic-scoped-keys` | I can issue scoped/least-privilege API credentials for an agent | 2 |
| `agentic-headless` | I can run the product headlessly / in CI for automation | 2 |

`agentic-mcp-server` and `agentic-mcp-client` are two ends of the same protocol, deliberately
split into separate axes: `-server` asks whether the product *ships* an MCP server for other
agents to connect to, `-client` asks whether the product itself *consumes* MCP servers. For
agent products (e.g. a coding-agent CLI), the serving axis is often the wrong question — the
product IS the agent — while the consuming axis is exactly the right one.

A product's "agenticness" score on the leaderboard is its weighted percentage across just
these 9 cells (theme `agenticness`, group `agent-access`).

Two sibling group-scoped indexes live under the same `agenticness` theme: `agentic-features`
("does the product act agentically itself" — `agenticApp` on the leaderboard) and, since v2.4,
`api-quality` (see below).

## The Overall score (formerly Arena Score / AI-Era Index)

v2.4 added a sixth canonical group, **API quality** (theme `agenticness`, group `api-quality`),
alongside `agent-access`. Where `agent-access` asks "can an agent reach the product at all,"
`api-quality` asks "how good is that surface once an agent is there":

| Story id | Story | Weight |
|---|---|---|
| `api-interactive-docs` | I can explore an interactive API reference with runnable examples | 2 |
| `api-machine-spec` | I can download a machine-readable API spec (OpenAPI or equivalent) | 2 |
| `api-versioning-policy` | I can rely on versioned APIs with a documented deprecation policy | 2 |
| `api-sandbox` | I can test against a sandbox environment without touching production data | 1 |

On top of that, every leaderboard entry carries an **Overall score** (`aiEra` internally, displayed
on-site as a bare "{n}/100" badge under an "Overall score" label — this score used to be called the
"Arena Score" and before that the "AI-Era Index," same formula, new name) — a single number
meant to answer "how ready is this product for a world where agents, not just humans, are the
primary users?" It's a weighted blend of five existing leaderboard components:

| Component | Weight | What it measures |
|---|---|---|
| `agentReady` | 0.30 | can an agent reach the product (API/CLI/MCP/webhooks/SDKs/docs) |
| `apiQuality` | 0.20 | how good is that API surface (docs, spec, versioning, sandbox) |
| `openness` | 0.20 | can you self-host, export your data, and read the source |
| `agenticApp` | 0.15 | does the product act agentically on its own behalf |
| `automation` | 0.15 | how deep are its rules/scheduling/bulk/versioned-automation primitives |

```
aiEra = Σ(component × weight) / Σ(weight)   — over non-null components only
```

Weights are renormalized over whichever components are non-null for a given product, so a
product missing one axis (e.g. no `openness` theme applies to its category) isn't penalized
twice — once for the missing axis, once for a shrunken blend. `aiEra` is `null` only when every
component is null. The exact weights live in `AI_ERA_WEIGHTS` in `lib/scoring.ts`.

**Why lead with this instead of the coverage score.** The coverage score measures evidenced
story coverage across a product's whole category — useful, but it treats "has a nice settings
UI" the same as "has an MCP server." As of v2.4, leaderboards sort primarily by `aiEra` (nulls
last, ties broken by coverage score) because we think products in the AI era should be ranked
first by how well agents and automation can actually work with them — the coverage score is
still shown, just demoted to a secondary line.

**These weights are a starting position, not a verdict.** We picked them because agent-access
and API quality are the most direct proxies for "can an agent use this at all," while
openness/agenticApp/automation matter but are one step removed. If you think the weighting is
wrong, [contest it via an issue](./CONTRIBUTING.md) — like every verdict on this site, the
formula is open to challenge.

## Score confidence grades (A–D)

Scores never pretend: untested cells can't score, and the confidence grade says how much of a
score is backed by probes. Every Overall score badge carries a small A–D chip
(`lib/confidence.ts`) derived from two fractions over the product's applicable (non-`na`)
cells:

| Signal | Meaning |
|---|---|
| **coverage** | fraction of applicable cells whose verdict cites *any* evidence — the complement is "we found nothing either way," which already scores 0 but is unknown, not failed |
| **testedShare** | fraction whose *strongest* cited evidence is a tested tier (`probe` or `github` — hands-on runs or inspectable source), per `lib/verification.ts`'s evidence ladder |

Grades: **A** = coverage ≥ 0.85 and testedShare ≥ 0.40 · **B** = coverage ≥ 0.70 and
testedShare ≥ 0.25 · **C** = coverage ≥ 0.55 · **D** = below that. The grade never changes any
published score — two products can post the same 60 while one earned it from probes and the
other from vendor docs, and the chip is where that difference shows. Thresholds are calibrated
against the live dataset so the letters actually discriminate (see
`CONFIDENCE_THRESHOLDS` in `lib/confidence.ts`), and, like the Overall score weights, they're open
to challenge. In words:

| Grade | Meaning |
|---|---|
| A | broad story coverage and a high share of probe/tested verdicts |
| B | solid coverage, mostly tested — a few cells still rest on vendor docs alone |
| C | meaningful gaps: thin coverage or verdicts leaning on claimed docs |
| D | treat the score as provisional — little tested evidence behind it yet |

Grades are display-only — they never move a score or a ranking — and they improve as hands-on
probes land, so the fastest way to raise one is to submit reproducible evidence.

## Story provenance

Every story in `data/{category}/stories.json` optionally carries an `origin` field
(`lib/schemas.ts`'s `StoryOriginSchema`) recording where it came from and when:

| `origin.kind` | Meaning |
|---|---|
| `canonical` | one of the 29 fixed agenticness/openness/automation-depth/privacy-posture stories (`pipeline/agentic-stories.ts`), injected verbatim into every category by `normalize.ts`'s `assembleTaxonomy` — never LLM-authored |
| `normalized` | assembled into the category's taxonomy by the LLM-driven `normalize` stage; carries the judge `promptVersion` in force at the time |
| `contest` | added or adjusted via a contest issue (not yet exercised — `contest-check.ts` only appends evidence today, never stories) |
| `manual` | hand-edited |

`origin` is additive and never participates in `cellHash` (`pipeline/stages/judge.ts`) —
stamping or backfilling it can never invalidate the judge cache or change a verdict. Hover a
story title or matrix cell on any product page to see its origin in the tooltip (e.g.
"canonical" or "normalized · v2").

## Re-judge stability policy

Verdicts are cached on a hash of (story id, story title, evidence ids+excerpts, prompt version,
judge model id) — re-running `judge` is a no-op unless the story, the evidence, the prompt
version, or the judge model actually changed. LLM judging still
has measurable re-roll variance (~9% of cells can change verdict or quality on a re-judge with
no relevant evidence change). To keep rankings evidence-driven rather than noise-driven, large
re-judge waves are reviewed against the prior state and pure churn is reverted under audited
rules: applicability (`na`↔`none`) never flips without new evidence, verdicts that cite nothing
new don't move close races, and negative mechanical probe results only affect the story axis
they actually test. Every revert is recorded in the commit that applies it. A future prompt
version will pass the prior verdict as an anchor to reduce this variance at the source.

**2026-09-30 judge-model migration.** The fleet was re-judged sonnet-5 → opus-5-5 on
2026-09-30 after a full pilot (docs/OPUS-5-5-JUDGE-PILOT.md: 74% exact verdict agreement on
the pilot ranking; 7 of 10 manually adjudicated disagreements favored Opus 5.5's reading of the
rubric). The prompt text did not change (v4 = v3 text). Every verdict flip and score move in
that wave reflects the judge change, not product changes — the wave is labeled as such in
each ranking's `score-history.jsonl` (`note` field) and summarized with before/after
leaderboards in docs/JUDGE-MIGRATION-2026-09-30.md. The stability policy's
no-new-evidence revert rule was deliberately NOT applied to the migration wave (under a judge
change every flip cites no new evidence by construction — applying the rule would revert the
migration itself). Two behavioral shifts to know when comparing to pre-migration data: Opus
5.5 reaches `na` and `disputed` far less often (it applies the na-vs-none decision procedure
and the concrete-contradiction bar more literally), and scores shifted up a few points
fleet-wide — a judge-scale change, not a capability change.

## Score intervals — the ± band on every Overall score

Every Overall score carries a **68% confidence band** ("42 ±3 /100" on product pages; the exact
low–high band in the score badge's tooltip, including on the homepage mega-table). The band is
an honest statement of how much the published number could move under the judge noise we have
actually **measured** — it is *analytic v1*: computed from existing data with **no new judging**.

How it's built (`pipeline/scripts/compute-confidence-intervals.ts`, math in
`lib/scoreIntervals.ts`):

- **Per-cell noise comes from measured re-roll statistics, never invented rates.** The
  multi-judge uncertainty pass (`data/*/uncertainty.json`, see the re-judge stability policy
  above) re-judged 650+ decisive cells twice more against unchanged evidence; ~20% showed some
  disagreement. From those samples we build a cached-tier → re-rolled-tier transition matrix
  (e.g. a `full` cell re-rolls to `partial` ~7% of the time), and every evidenced
  `full`/`partial`/`disputed`/`none` cell resamples its verdict from its measured row.
- **Untested cells carry wider, epistemic uncertainty.** A `none` verdict citing zero evidence
  means "we found nothing either way", not "it failed" — it scores 0 today but could plausibly
  be a `partial` on new evidence. Each such cell flips to `partial` with probability equal to
  the measured any-disagreement rate (~0.20), with quality bounded to the plausible [3, 7]
  range. Products whose score rests on many untested cells therefore get honestly wider bands.
- **Applicability is pinned.** `na` cells never resample — the re-judge stability policy
  reverts `na`↔`none` churn that cites no new evidence, so published applicability is
  policy-stable and modeling it as noise would overstate the band.
- **Propagation is exact.** Each of 500 Monte Carlo draws per product resamples every relevant
  cell and recomputes the score through the *same* `weightedPercent` + `computeAiEra` code that
  produces the published number (roundings included). The band is the 16th–84th percentile of
  the resulting distribution; agent-readiness gets its own band the same way. The PRNG is
  seeded (mulberry32, keyed per product) — builds are byte-reproducible, no `Math.random`.

Results land in `data/{category}/score-intervals.json` (committed, re-run post-derive by the
story-runner). Display is tolerant-optional (`lib/scoreIntervals.ts`): no interval data ⇒ no
band is ever rendered — never a fabricated one. Fleet-wide as of the first pass the median band
width is ~4.5 Overall score points.

**What the band is not (yet):** it reflects propagated judge-*sampling* noise plus
untested-cell ignorance, **not** model-family disagreement — the same evidence judged by a
non-Anthropic model could move scores in ways this band doesn't capture. Adding a second judge
model and folding cross-model disagreement into the interval is listed as future work.

## Popularity — a signal, not a score

Product pages, the ranking table, and the global rankings pages show a **popularity/momentum
chip** — GitHub stars, stars/year, and npm/PyPI weekly downloads, sourced entirely from public
registries (`api.github.com`, `api.npmjs.org`, `pypistats.org`), no API key required. It answers
a different question than everything else on this site: not "is this AI-ready" but "will this
project still be alive tomorrow" — a reader-requested survival/support signal.

It is **deliberately not part of the Overall score** and never affects rankings, leaderboard
position, or any battle outcome (`pnpm pipeline popularity` makes no LLM calls and its output,
`data/{category}/popularity.json`, isn't read by `lib/scoring.ts`). Popularity measures
*adoption* — how many people already use something — which is a lagging, momentum-driven
signal unrelated to whether a product is well-built for AI agents today. A ten-year-old
framework with a huge install base and a brand-new, better-designed API for agents should not
outrank each other because of stars; keeping popularity out of the score preserves what the
score actually means. Coverage is necessarily partial: only products with a `urls.github` or a
curated npm/PyPI package (`pipeline/popularity-packages.json`) have any numbers at all, and a
missing chip means "no public signal available," not "unpopular."

## Pricing tiers — an annotation, not a score

Every (product, story) cell the judge ruled **full/partial** carries a pricing-tier annotation
(`data/{category}/story-tiers.json`, produced by `pipeline/scripts/classify-story-tiers.ts`):
**free**, **paid**, **enterprise**, or **unknown** — which plan a buyer needs for that delivered
capability. It answers the "what can I actually do without paying?" question the verdicts alone
don't.

The honesty rules mirror judging:

- The classifier sees ONLY the verdict's cited evidence excerpts plus the product's own pricing
  evidence (extracted `pricing.json` facts and pricing-page evidence items). No outside
  knowledge, ever.
- **`unknown` is the default.** A tier is assigned only when the evidence states or directly
  implies the gating — a commercial vendor's capability is not "paid" by reputation, and
  silence is never rendered as "free."
- Every non-unknown tier must cite the specific evidence item that implies it
  (`tierEvidenceId`) and carry a one-liner quoting that gating evidence (`tierNote`, e.g.
  "SSO on Enterprise plan only"). Entries failing this are rejected and re-asked, like verdict
  rule violations.
- It is **display-only**: story-tiers.json is never read by `lib/scoring.ts`, never part of the
  judge's cache hash, and can be regenerated or deleted without moving a single verdict,
  quality point, or ranking.

On the site it renders as an outline chip on classified story rows (product pages and
`/compare`), a tier filter on the story table, a "What's free" summary line per product, and a
`Pricing tier` field on classified story lines in each product's `llms.md`.

## Bias disclosure — the judge is an Anthropic model

**Owner-product disclosure:** the Product Feedback & Intent ranking includes Foreloop, built by
Ultrametric Inc — the company that operates Ultrametric. Foreloop is judged by the identical evidence
rules as every other product (it placed third of four in its own ranking as of this writing), its
product page carries an affiliation banner, and every one of its verdicts is contestable like
any other. An adversarial bias audit of Foreloop's verdicts (2026-09-21) found and corrected 14
overcalls in Foreloop's favor — four quality/tier downgrades on the `agentic-*` cells (including
`agentic-public-api` `full` 8 → `partial` 5, applying the same "documented public REST/HTTP API"
bar used for its competitors, per the claude-code precedent below) and ten `na` → `none`
reclassifications where the wrong-axis call had improperly shrunk Foreloop's score denominator
relative to peers graded `none` on the same stories. Each corrected verdict carries a dated
audit note in its rationale, applied in the committed judge cache so re-judges preserve it; the
corrections moved Foreloop from second to third of four.

**Read this before trusting the `ai-coding` ranking's numbers.** The judge model
(`claude-opus-5-5` since the 2026-09-30 migration; `claude-sonnet-5` before it) is made by
Anthropic, and the `ai-coding` ranking includes Anthropic's own
product, Claude Code, which leads that ranking's **Overall score** (29.5) as of v2.4 — though on
raw coverage score it now sits second (34.6) behind GitHub Copilot (35.0), a lead that flipped
when the v2.4 `api-quality` cells were added (Claude Code's own coverage score was 35.2 as of
the last full audit below, before those cells existed). This is a real conflict of interest and
we want it visible, not buried.

What we did about it:

- **We ran an adversarial bias audit** of every `claude-code` verdict scored `full` in the
  `ai-coding` ranking (14 cells), checking each cited evidence excerpt against the claim it
  was used to support, and separately compared every `agentic-*` cell head-to-head against
  `codex`.
- **One cell was downgraded** as a result: `live-app-debugging` went from `full` (quality 6)
  to `partial` (quality 5) after adjudication. The sole citation was a bare, title-only doc
  fragment ("Debug live web applications | Chrome") with no scope or mechanism detail, while
  every competing product's comparable-or-better evidence for the same story capped at
  `partial`/`none`. The verdict's rationale in `data/ai-coding/verdicts.json` documents the
  downgrade and the shared-vendor conflict explicitly. This changed Claude Code's overall
  score from 35.5 to 35.2 (it remained the category leader).
- **A second adversarial review pass, run for v2.4, audited the new api-quality/agent-access
  cells** and applied two cross-vendor corrections, stated plainly in both directions:
  one **against** Claude Code's favor (`agentic-public-api` downgraded `full`→`partial`,
  quality 8→5 — the Agent SDK/CLI don't clear the same "documented public REST/HTTP API" bar
  applied to competitors), and one **in** Claude Code's favor, applied to a competitor
  (GitHub Copilot's `agentic-mcp-server` downgraded `partial`→`none`, quality 5→0 — its cited
  evidence showed MCP *client* administration, not an official MCP server offered by the
  product). Both corrections are recorded in `data/ai-coding/verdicts.json` with rationale
  suffixes citing the review.
- **The audit's calibration samples also found the judge was *harsher* on claude-code in
  several cells**, not just lenient. The clearest example: on
  `natural-language-feature-implementation`, Claude Code's own marketing describing its core
  workflow was judged `disputed` (because cited community complaints contradicted it),
  while Codex was judged `full` on the same story from its evidence pack. A biased judge that
  favored its own vendor would not do this.
- **Two additional cells carry documented caveats** (left as computed, not adjusted,
  per the audit's own rule of "flag, don't silently override" except where adjudicated
  above):
  - `persistent-project-instructions` — `full`, quality 9. The cited community evidence
    partly complains about the feature's practical downsides (config sprawl, some output
    degradation), which the verdict's rationale doesn't fully surface. The verdict *tier*
    (`full`) is considered correct — the feature (CLAUDE.md) unambiguously exists and is used
    — but the quality score is generous given the mixed community signal.
  - `background-cloud-tasks` — both `claude-code` and `codex` scored `full`, quality 8. The
    story specifies an "isolated cloud environment"; Codex's cited evidence explicitly says
    "isolated cloud environments," while Claude Code's cited evidence confirms background/
    cloud execution but never uses the word "isolated." Both were scored `full`, but only one
    product's evidence actually supports that specific qualifier.
- **Every verdict cites evidence ids** resolvable in `data/{category}/evidence/`, so anyone
  can independently check any verdict against its source. If you disagree with a call, see
  [CONTRIBUTING.md](./CONTRIBUTING.md) — contesting a verdict is a first-class, expected
  workflow, not a one-off.

**2026-09-30 judge-model migration and own-product audit.** On 2026-09-30 the judge migrated
from `claude-sonnet-5` to `claude-opus-5-5` (same vendor — the conflict above is unchanged)
and the whole fleet was re-judged; docs/JUDGE-MIGRATION-2026-09-30.md carries the per-ranking
before/after leaderboards. In the pilot, an Anthropic judge model re-graded Anthropic's own
product upward: claude-code had the second-fewest flips (13) but 10 were upgrades, including
all three of its `disputed` cells going to `full`. Counter-signals, stated plainly: the
pilot's largest beneficiary was gemini-cli (+8.0 aiEra, the largest gain of any product), its
largest loser was a non-Anthropic product on a correct rule application (github-copilot's
weight-3 MCP-server cell, matching this section's earlier human-adjudication precedent), and
Opus also downgraded claude-code (`vulnerability-autofix` full→partial, `agentic-scoped-keys`
partial→none, plus 17 other unfavorable/lateral moves in the final wave). Because of the
conflict, every favorable migration flip on an owner/affiliated product (claude-code,
Foreloop, AFK, the Claude rows in other rankings) was adversarially re-read against its cited
evidence: on claude-code, 10 of 16 favorable flips were kept and 6 were corrected with dated
audit notes in their rationales (four reverted to the sonnet-5 baseline where a story
qualifier or the evidence-relevance rule was not clearly satisfied, two quality-trimmed);
claude-code's rank did not change (#3). The 2026-09-21/24 Foreloop and AFK human
adjudications were preserved verbatim through the migration — human adjudications outrank any
model (docs/JUDGE-MIGRATION-2026-09-30-worklist.json records what the fresh judge said on
each protected cell). The audit calls for every other owner/affiliated row are recorded in
docs/JUDGE-MIGRATION-2026-09-30.md.

We think shipping this disclosure — including the fact that the audit itself was run by the
same vendor's model — is more honest than pretending the conflict doesn't exist. Judge for
yourself using the cited evidence.

---

© 2026 Ultrametric Inc — source-available, see [LICENSE](./LICENSE).
