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
`reports/vendor-radar/runs/<run-id>-triage.json`; needs-human dispositions additionally file the day's
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

## Automatic checks and publication identity

Both `vendor-radar/` scan PRs and `vendor-radar-bringup/` PRs use the generated-PR CI
and review recovery controllers. The Content App used by the private site's content-update
workflow is a separate publication identity; it does not run the rankings engine or repair
radar data.

The radar can use that App after a maintainer configures its installation for this public
repository, the `CONTENT_BOT_APP_ID` and `CONTENT_BOT_PRIVATE_KEY` repository secrets,
and the exact `CONTENT_BOT_LOGIN` repository variable (for example,
`ultrametric-content-bot[bot]`). Installation and credential setup are separate maintainer
operations. The workflows request only repository-scoped contents and pull-request write
permissions. They validate the minted App slug against the configured login before publishing.
The App pushes and opens both radar PR families, so ordinary PR CI starts without the
approval-required run created by `GITHUB_TOKEN`. Recovery also uses that App when a required
freshness rule calls for updating an App-authored radar branch.

Without the App credentials, radar publishes as `github-actions[bot]` and explicitly dispatches
`ci.yml`. That dispatched run supplies the required validation checks even when GitHub shows
a separate approval-required PR run. An unapproved PR run can expire as a failure with no
jobs; inspect the dispatched run on the same commit. See
[GitHub's token-trigger rules](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs).
The optional PAT publication override is retired because its author could fall outside the
recovery allowlist. Existing PAT-authored PRs need maintainer attention.

Recovery accepts the configured App bot only on these same-repository radar branches.
Drafts, removed auto-merge opt-in, and unrelated authors remain excluded. A malformed App
login disables App recovery and review requests while preserving the Actions-bot path. Missing CI keeps
the existing per-head retry budget; reviews retain exact-suite checks and durable request
reservations. Auto-merge opt-in is recorded before fallback CI dispatch so a dispatch failure
remains recoverable. Engine repair stays scoped to story-runner; radar extraction, judging,
and review findings still require their own evidence-backed correction. No workflow here
changes App installation, credentials, branch rules, or the paused state of another workflow.

The [internal refresh merge policy](ACCURACY.md#internal-refresh-merge-policy) adds
canonical workflow receipts, current-head content scope checks and manual stops to the
existing native auto-merge path. App setup is optional; required CI and review remain
mandatory for both scan and bring-up PRs.

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
3. **Dedupe** nominations against:
   - every tracked product (`open-rankings/<arena>/products.json`) by normalized site domain
     (`rankings-engine/yc-shared.ts` `normalizeDomain`) and by normalized name/id,
   - the vendor registry (`open-rankings/reviews/generated/`) by product id,
   - the legacy `rankings-engine/radar-seen.json` and immutable records in
     `rankings-engine/radar-discoveries/`, keyed by product domain (or `github:owner/repo` /
     normalized name when no product domain is public). The reader unions keys and sorted
     source URLs, retaining the earliest `firstSeen`; ties use the lexically first name.
4. **Report**: `reports/vendor-radar/runs/<run-id>.json` (schema-validated) + `<run-id>.md`,
   committed with the discovery record. Actions IDs include the run and attempt; local IDs
   include a UUID. Records contain the report path and SHA-256, and the reader verifies that
   the report contains every referenced candidate key before suppressing nominations.
   Normal runs leave the global legacy ledger unchanged.
5. **Triage + bring-up**: `radar-triage.ts` applies the auto-approval criteria to the day's new
   candidates and writes `reports/vendor-radar/runs/<run-id>-triage.json`. When the triage routed
   candidates to a human, the workflow rebuilds the cumulative **`vendor-radar: unresolved
   review queue`** issue (labels `story-runner` + `founder-call`) from retained reports,
   including imported branch history. It also rebuilds on days with no new candidates.
   Automated skips, approvals and new daily reports do not clear earlier human-review calls.
   Legacy issues and their comments remain intact; date-based automatic closure is disabled.
   Scan PRs remain additive. When the `ANTHROPIC_API_KEY` repo secret is present, `radar-bringup.ts`
   adds up to 3 auto-approved passers per run to their existing arenas and the workflow runs the
   scoped engine run on each, opening a **bring-up PR** with the full disposition table (including
   the skipped list) in the body. Without the key, passers stay approved-pending in the triage
   report. This step currently reads only the current run's triage; see the pending lifecycle below.

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
  candidates enter discovery history).
- A wrongly skipped candidate needs an explicit, reviewed re-triage using its original report.
  Preserve discovery history; deleting a legacy ledger row no longer resets the union.

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
arenas the vendor is not rostered in. Seeding covers the high-change arenas: a rostered product
there carries `urls.news` wherever its vendor publishes a verifiable changelog, blog, or
newsroom on its own domain, and bot-walled vendors stay unseeded.

Candidates are keyed `launch:<productId>:<arena>` in discovery history. A needs-human pair
is recorded when reported, so later launches into the same pair add their source URLs without
repeating the nomination. The existing auto-approved behavior is preserved: only selected
roster entries add suppression records, leaving capped or key-skipped entries available to a
later scan. `roster-selection` records retain the original triage and expressly carry no
processing or merge status. A downstream failure can still strand a selected entry; the
pending lifecycle below is required to resolve that limitation. Dispositions are written
in the radar-triage report shape (`reports/launch-watch/runs/<run-id>-triage.json`): needs-human rows
flow through `needs-human-issue.ts --generator launch-watch` into a labeled issue, and
auto-approved rows (`LW_AUTO_APPROVE_HITS`+ distinct keyword hits; founder-affiliated products
are always needs-human) ride the scan PR itself — `launch-watch --apply` copies the existing
product identity into the target arena's roster with a scoped-entry disclosure, and the scoped
standard engine run on the same branch produces the debut scores. Thresholds are named
constants echoed into each report's `thresholds` block, like the radar's.
`rankings-engine/__tests__/launch-watch.test.ts` tests the pure units over inline HTML
fixtures, no network.

## Branch reconciliation and historical reports

Both workflows fetch the `vendor-radar/*` and `launch-watch/*` branch families before a scan.
`reconcile-radar-state.ts` copies immutable discoveries with their reports, triage, and prior
import provenance. It reads pinned commit IDs and fails on fetch/read errors, conflicting
immutable bytes, missing referenced reports, or hash mismatches.

Legacy ledgers are retained byte-for-byte under `rankings-engine/radar-discoveries/legacy/`,
named by SHA-256. Legacy date-only reports that differ from or are missing on main are retained
under `reports/radar-imports/files/<sha256>/<original-path>`. Import manifests map the source
commit and original path to each retained file and its hash. This preserves conflicting
same-day versions without overwriting main. Reports are checked independently of ledger keys:
keys already on main do not establish that an older report or its triage has been retained.
Existing dated reports and the global legacy ledger remain in place.

The manual `--merge-seen` option still accepts legacy files and retains snapshots, but callers
must retain their original reports separately. Workflows use the report-preserving reconciler.

## Pending processing lifecycle

This storage change preserves discovery and approval evidence. It does not implement a durable
processing queue. Vendor bring-up still reads only the current run's triage; launch watch still
suppresses selected pairs before downstream work succeeds. A cap, absent key, stage failure,
open PR, or unmerged roster entry must not be interpreted as completed work. Legacy seen keys
also carry no completion evidence. The workflows do not currently query equivalent open PRs
before expensive processing.

A follow-up needs a separate lifecycle keyed by candidate and target arena, with equivalent
product identity resolved using the bring-up dedupe rules. It must:

1. Reconstruct approved pending entries across original and imported report/triage pairs,
   preserving candidate provenance and later human decisions. Legacy keys lacking reports or
   existing roster entries lacking success evidence require reconciliation, with no blanket
   reset or automatic rescoring.
2. Record attempts separately from approvals. Caps, missing keys, and failed stages leave
   approval pending; failures need bounded backoff and stage evidence for resumption.
3. Check current open PRs, including older PRs without receipts, for equivalent products in
   the target arena before spending. Serialize or claim concurrent attempts across producers;
   an open PR blocks repeat work but does not complete it. Abandoned branches and closed,
   unmerged PRs need an explicit retry/reuse policy.
4. Write success receipts only after the required scoped stages and validation succeed,
   linking the candidate, report, evidence, and head commit. Confirm merge into main separately
   before marking completion. Roster insertion alone is insufficient.
5. Drain bounded pending approvals across dates even when the new scan yields no candidates,
   then test cap/failure recovery, missing-key recovery, equivalent open PR suppression, merge
   completion, and concurrent claims together before enabling that drain.

## Testing

`rankings-engine/__tests__/vendor-radar.test.ts` — pure units only, no network: fake HN/PH/GitHub
fixtures → arena matches, hotness thresholds, dedupe against tracked products and the
seen-ledger, same-key cross-source merging, and the report/issue shape (schema round-trip, the
criteria-triage line, the no-new-rankings statement). `rankings-engine/__tests__/radar-triage.test.ts`
covers the criteria checks the same way: injected fetch results, no network. The committed
inaugural run under `reports/vendor-radar/` is the end-to-end integration evidence.

`rankings-engine/__tests__/radar-state.test.ts` covers immutable writes, disjoint branch merges,
legacy compatibility, deterministic unions, same-day identities, report provenance failures,
and retention of historical reports whose ledger keys already reached main. These are storage
checks; they do not establish the pending lifecycle guarantees above.

## Human review queue

`rankings-engine/vendor-review-ledger.json` records explicit cited human decisions and
source-backed placement corrections. `vendor-review-queue.ts` combines that ledger with
retained triage reports. The reports and ledger are the durable record; the standing GitHub
issue is a view with chronological queue snapshots in comments. Updates leave maintainer
annotations and previous comments intact. Closing the issue does not resolve its candidates.

The initial migration starts with the reports behind issues #713 and #722. Earlier issues
may contain human decisions not yet represented in structured data; preserve those issues
and migrate their cited decisions before widening `reportsFrom`. The earlier automatically
closed issue #713 is superseded only as a view: its three pending candidates are restored.

To resolve a candidate, add its canonical key, `approved` or `rejected` outcome, reason,
source URL(s), deciding human and timestamp to `decisions` through a reviewed PR. A
`deferred` decision stays pending. Later scans cannot overwrite these decisions. An approval
here does not enqueue bring-up or publish rankings; that remains a separate reviewed action.
A later automatic approval for a previously reviewed key is withheld from automatic bring-up,
including when popularity falls below the tripwire. This preserves human vetoes and placement
corrections in execution as well as in the queue.
Placement corrections retain the original review requirement and cannot approve a product.

Rebuild the issue body locally with:

```bash
pnpm tsx rankings-engine/scripts/vendor-review-queue.ts --out /tmp/vendor-review.md
```
