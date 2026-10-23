# Vendor radar

The radar scans public launch surfaces daily for candidates that fit existing arenas.
Approved candidates enter scoped runs of the rankings engine and land through reviewed PRs.

## Approval and the hard limits

Candidate approval follows the criteria in
`policies/AGENT_POLICY.md` ("Vendor-radar candidate approval"): existing-ranking fit, public
docs surface, shipped product, no founder affiliation, and a citable agentic surface.
`rankings-engine/scripts/radar-triage.ts` applies
them mechanically — the lexical arena classifier for ranking fit, a docs-surface fetch, the
waitlist/link-list/placeholder guards plus the popularity trip-wires for shipped-product (the
`STARS_PER_DAY_ANOMALY` sustained-velocity floor at any repo age, and for repos younger than
`YOUNG_REPO_MAX_AGE_DAYS` the `YOUNG_REPO_STARS_PER_DAY` sustained-rate floor and the
`YOUNG_REPO_STARS_PER_CONTRIBUTOR` stars-per-contributor ratio, the latter skipped fail-open
when the GitHub contributor count is unavailable; any trip routes to needs-human),
the affiliation guard, and the agentic-surface check (the fetched product/docs page or README
must name a public API, MCP server, or agent/automation docs, or `/llms.txt` on the product's
own origin must answer with plain text; the disposition records the fetched URL and a one-line
evidence note) — and records
every candidate's disposition (auto-approved, skipped with the failing criterion and its evidence,
or needs-human) on the day's scan PR body and in
`reports/vendor-radar/<date>-triage.json`; needs-human dispositions additionally file the day's
needs-human issue (labels `story-runner` + `founder-call`). Ranking-fit placement is lexical, so every
auto-approved disposition records the matched arena's `open-rankings/categories.json` definition in
its evidence and carries "placement: keyword-matched, confirm against arena definition at
review" in its reason; the bring-up PR body inherits both, and the reviewer confirms the arena
against its definition before merge.

Two limits hold in every case:

- **The radar never creates a new ranking.** A candidate whose only fit would be a new arena is
  skipped; new-ranking creation is a human decision.
- **The radar never touches a founder-affiliated product autonomously.** Affiliated candidates
  route to needs-human for disclosure and a bias audit.

Scores stay engine-computed: the bring-up on an auto-approved candidate is a scoped standard
engine run (`crawl → extract → collect-community → probe → judge --product → derive → logos`)
landing as a reviewed PR, with the skipped list in the PR body. Nothing merges to `main` without
that review.

## How it works

`rankings-engine/scripts/vendor-radar.ts`, run daily by `.github/workflows/vendor-radar.yml`
(cron `31 8 * * *`, offset from the other automation loops):

1. **Scan** four keyless public launch surfaces (a handful of HTTP requests total, polite UA,
   10s timeouts; a source that fails to answer degrades to zero items with a recorded `error`
   note in the report — never a fabricated item):
   - **Hacker News** via the Algolia search API (keyless by design): `Show HN` and `"Launch HN"`
     stories from the last `HN_LOOKBACK_DAYS`, plus front-page stories whose title is
     launch-shaped (`isLaunchTitle`). Hotness = points (`HN_MIN_POINTS`), with a velocity
     fast-path for very fresh stories (`HN_FAST_MIN_POINTS` at `HN_FAST_MIN_POINTS_PER_HOUR`).
   - **Product Hunt** public frontpage Atom feed (`producthunt.com/feed`, no key, one fetch —
     the feed PH publishes for exactly this consumption). Frontpage presence IS the hotness
     evidence; vote counts are not exposed keylessly and the report says so verbatim rather
     than inventing them.
   - **GitHub** repo search API (one request; keyless rate limits respected, `GH_TOKEN` used for
     the higher authenticated limit when present): repos created in the last
     `GITHUB_LOOKBACK_DAYS` with ≥ `GITHUB_MIN_STARS` stars, kept only when star velocity
     crosses `GITHUB_MIN_STARS_PER_DAY`.
   - **YC Launches** via `ycombinator.com/launches.json` (verified keyless 2026-10-21: plain
     JSON pages of 20 launches with title, tagline, posting date, vote count, and the company's
     site/batch/tags; `robots.txt` allows `/launches`; the `/launches/rss` and `/launches/feed`
     paths 404, so the JSON surface is the feed). Launches from the last `YC_LOOKBACK_DAYS` are
     kept; presence on YC's official launch feed within the window is the signal (the Product
     Hunt frontpage precedent) and the feed's own vote count rides in the evidence verbatim.
2. **Match** each hot item's text (title / tagline / description / topics) against the arena
   taxonomy: `DOMAIN_VOCAB` (`rankings-engine/scripts/tag-story-scopes.ts` — the same per-arena nouns
   `yc-coverage-queue.ts` matches with), extended per arena with its `open-rankings/categories.json`
   name tokens and its `open-rankings/arena-sections.json` section-name tokens. `MIN_ARENA_HITS`
   distinct keyword hits are required — a hot launch that speaks no arena's language is not our
   vendor. Lexical matching is a NOMINATION signal, never a verdict input.
3. **Dedupe**, so each candidate surfaces exactly once, ever:
   - every tracked product (`open-rankings/<arena>/products.json`) by normalized site domain
     (`rankings-engine/yc-shared.ts` `normalizeDomain`) and by normalized name/id,
   - the vendor registry (`open-rankings/reviews/generated/`) by product id,
   - the committed seen-ledger **`rankings-engine/radar-seen.json`**: every candidate ever reported,
     keyed by product domain (or `github:owner/repo` / normalized name when no product domain is
     public). `firstSeen` is the date of the run that first reported it — never backdated.
4. **Report**: `reports/vendor-radar/<date>.json` (schema-validated) + `<date>.md`, committed via
   the usual PR-or-issue flow with the candidates list and the full triage disposition table on
   the scan PR's body.
5. **Triage + bring-up**: `radar-triage.ts` applies the auto-approval criteria to the day's new
   candidates and writes `reports/vendor-radar/<date>-triage.json`. When the triage routed
   candidates to a human, the workflow files (or, on a same-day re-run, comments on) a
   **`vendor-radar: needs-human candidates YYYY-MM-DD`** issue (labels `story-runner` +
   `founder-call`) listing just those rows, then closes the generator's previous still-open
   candidates issues with a comment naming the successor; auto-approved and skipped rows file no
   issue. Scan PRs are never auto-closed as superseded, because the seen-ledger makes each dated
   report additive. When the `ANTHROPIC_API_KEY` repo secret is present, `radar-bringup.ts`
   adds up to 3 auto-approved passers per run to their existing arenas and the workflow runs the
   scoped engine run on each, opening a **bring-up PR** with the full disposition table (including
   the skipped list) in the body. Without the key, passers stay approved-pending in the triage
   report.

## Tuning keywords and thresholds

- **Thresholds** are named constants at the top of `rankings-engine/scripts/vendor-radar.ts`
  (`HN_MIN_POINTS`, `GITHUB_MIN_STARS_PER_DAY`, `MIN_ARENA_HITS`, `MAX_REPORT_CANDIDATES`, …) and
  are echoed into every report's `thresholds` block, so a threshold change is visible in the
  report diff that follows it.
- **Keywords**: to make an arena match better, extend its `DOMAIN_VOCAB` entry in
  `rankings-engine/scripts/tag-story-scopes.ts` (tight, domain-strong nouns only — generic words swallow
  everything; see the vocabulary's own header comment). Arenas without a `DOMAIN_VOCAB` entry
  still match on their `categories.json` name tokens and section-name tokens via
  `buildArenaVocab`.
- **Noise control**: raising `MIN_ARENA_HITS` cuts false positives fleet-wide; the per-report cap
  `MAX_REPORT_CANDIDATES` keeps the scan PR body readable (overflow is counted in
  `skipped.overflow`, and uncapped candidates simply surface on a later run since only REPORTED
  candidates enter the seen-ledger).
- A candidate that was wrongly skipped can be re-surfaced by deleting its row from
  `rankings-engine/radar-seen.json` (a reviewed commit, like everything else).

## From candidate to judged product (the Instinct/dots precedent)

An auto-approved or human-approved radar candidate follows this flow:

1. **Research notes** — ignored `.pa-tmp/vendor-research/<vendor>.md`: what it is, which arena, capability map
   with per-claim source URLs, fetch dates, and evidence tiers (`claimed-docs` / `press` /
   `probe`). No judging, no rankings edits — raw material for the evidence pack.
2. **Roster PR** — add the product to `open-rankings/<arena>/products.json` (reviewed like any roster
   change; disclosure rules apply if owner-affiliated).
3. **The deep spike** — a keyed standard engine run on that product/arena:
   `crawl → extract → collect-community → probe → judge → claims → derive` (via
   `rankings-engine/cli.ts`, story-runner dispatch, or `rankings-engine/scripts/spike-engine.ts --process`),
   landing as a PR reviewed under the re-judge stability policy.
4. Record the final disposition and PR link on the candidate's needs-human issue when one
   exists; otherwise the committed triage report carries the disposition.

## Launch watch: rostered vendors entering new arenas

The radar's dedupe deliberately skips every tracked vendor, which left a blind spot the Gusto
formation/banking launch exposed (2026-10-22): a vendor we already rank ships a product that
belongs in another arena. `rankings-engine/scripts/launch-watch.ts` covers it. Weekly
(`.github/workflows/launch-watch.yml`, Mondays 09:19 UTC), it fetches each rostered product's
own launch surface — the opt-in `urls.news` field on `open-rankings/<arena>/products.json`,
seeded only where a keyless GET was verified — keeps the launch-shaped headlines, runs the same
`buildArenaVocab`/`matchArenas` fit over each one, and nominates `(product, arena)` pairs for
arenas the vendor is not rostered in.

Candidates are keyed `launch:<productId>:<arena>` in the shared seen-ledger
(`rankings-engine/radar-seen.json`): a needs-human pair is ledgered when reported (one human
call per pair, rather than a re-nomination on every later post naming the same arena), while an
auto-approved pair is ledgered only when a run actually applies it, so a row left behind by the
apply cap or a missing `ANTHROPIC_API_KEY` re-surfaces until it lands. A later launch into an
already-ledgered pair still merges its URL into the pair's entry (visible in the scan PR's
ledger diff), and deleting the ledger row re-surfaces the pair, the same escape hatch the radar
documents above. Dispositions are written
in the radar-triage report shape (`reports/launch-watch/<date>-triage.json`): needs-human rows
flow through `needs-human-issue.ts --generator launch-watch` into a labeled issue, and
auto-approved rows (`LW_AUTO_APPROVE_HITS`+ distinct keyword hits; founder-affiliated products
are always needs-human) ride the scan PR itself — `launch-watch --apply` copies the existing
product identity into the target arena's roster with a scoped-entry disclosure, and the scoped
standard engine run on the same branch produces the debut scores. Thresholds are named
constants echoed into each report's `thresholds` block, like the radar's.
`rankings-engine/__tests__/launch-watch.test.ts` tests the pure units over inline HTML
fixtures, no network.

## Testing

`rankings-engine/__tests__/vendor-radar.test.ts` — pure units only, no network: fake HN/PH/GitHub
fixtures → arena matches, hotness thresholds, dedupe against tracked products and the
seen-ledger, same-key cross-source merging, and the report/issue shape (schema round-trip, the
criteria-triage line, the no-new-rankings statement). `rankings-engine/__tests__/radar-triage.test.ts`
covers the criteria checks the same way: injected fetch results, no network. The committed
inaugural run under `reports/vendor-radar/` is the end-to-end integration evidence.
