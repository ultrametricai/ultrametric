# The Accuracy Engine

How Ultrametric keeps the published rankings from silently rotting: four scheduled loops,
each catching a different failure mode, feeding one work queue, with humans at exactly the
points where a score could change. This doc is the map; the workflows and scripts it names are
the source of truth.

## The loops

| Loop | Schedule (UTC) | Keys | What it does | What it catches |
|------|----------------|------|--------------|-----------------|
| **story-runner** (`.github/workflows/story-runner.yml`) | every 6h at :17 | `ANTHROPIC_API_KEY` | Full engine pass (crawl → extract → collect-community → probe → judge → claims → popularity → derive) for ONE ranking per run, plus score intervals, predictions, and the keyless SLO check. Ranking pick: **worst-stale first** from `open-rankings/staleness-report.json` when one stands (one ranking per 6h slot since the report's `generatedAt`), falling back to run-number rotation. | Stale evidence, changed vendor docs, verdicts due a re-judge — the only loop that can move a score. |
| **daily-snapshot** (`daily-snapshot.yml`) | daily 05:43 | none | Fleet-wide keyless SLO check + popularity refresh. | Agent-surface outages (llms.txt / remote MCP / openapi down), momentum drift. |
| **cert-sweep** (`cert-sweep.yml`) | Mondays 07:29 | none | Re-verifies every standing certification (45-day renew window) + certifies the top 15 queued candidates (`cert-candidates.ts`). | Certified surfaces that regressed; products that newly qualify. |
| **accuracy-engine** (`accuracy-engine.yml`) | Wednesdays 06:41 | none | Fleet staleness scan (`rankings-engine/scripts/staleness-scan.ts`), commits `open-rankings/staleness-report.json` as a PR carrying the full work-queue tables (each report PR supersedes the previous open one, closed with a comment naming the successor), and opens the ranked **work-queue issue** (labels `story-runner` + `founder-call`) only when the queue holds actionable rows (dead cited URLs, crawl-gap signatures, live flips). | Everything below — the detector for what story-runner's keyed runs should chew through next. |

Plus the event-driven lane: **contest-check** (issue-labeled `contest`) re-judges a contested
cell with the contester's evidence added, and **ci.yml** gates every PR on
`pnpm test` + `pnpm build` + `recompute-check.ts` (scores must be a deterministic function of
committed data — always).

## The staleness scan (`rankings-engine/scripts/staleness-scan.ts`)

Keyless by design — it detects and ranks, it never re-judges. Per product it scores:

1. **Evidence age** — `fetchedAt` median/oldest across the evidence pack. 0 pts under 30 days,
   linear to a 40-pt cap at 210 days; a pack with no evidence at all maxes the axis.
2. **Dead cited URLs** — live GET of the top-cited evidence URLs (citation-weighted, 2 per
   product, deduped fleet-wide, ≤4 concurrent, 8s timeout). Dead = 404/410 or no response at
   all (DNS gone — the pivoted-startup tripwire). Auth walls (401/403), 405/429 and 5xx are
   ALIVE. 15 pts each, cap 30.
3. **Crawl-gap signatures** (pure data, 15–20 pts):
   - *api-quality gap*: `agentic-public-api` full/partial while ALL api-quality stories are
     zero-evidence none — the signature of the 54-product fleet audit
     (`append-api-quality-docs-evidence.py`, the Mercury spike).
   - *agent-docs contradiction* (the cline case, commit `14e665a0`): a positive
     `PROBE llms.txt: HTTP 200` item sits in the pack while `agentic-agent-docs` is a
     zero-evidence none.
4. **Live flips** (20/15 pts): `agentic-agent-docs` none with no positive probe but `/llms.txt`
   answers 200 live right now; a documented remote MCP endpoint (`lib/mcpEndpoints.ts`
   allowlist) while `agentic-mcp-server` is still none.

Output: `open-rankings/staleness-report.json` — products and rankings ranked worst-first, plus
`arenasRanked` (what story-runner's pick step consumes) — and the work-queue issue body, written
only when the queue holds actionable rows (`actionableQueueRows`): a clean fleet files no issue,
and the ranked tables ride the report PR's body either way.
Run it yourself: `pnpm tsx rankings-engine/scripts/staleness-scan.ts [--offline] [--category <id>]`.

## Display rules in the UI

Two failure modes the display layer guards against — both are **display-only**: no rule here
ever changes a verdict, a quality, or a score. The `lib/` modules named below live in this
repo; the components that render them (and `infra/cloudflare-proxy/worker.js`) live in the
private site repo.

**Auth-gated ≠ absent** (`lib/verification.ts` `isAuthGatedEvidence` / `cellAuthGated` /
`authGatedProbeCount`). When a runtime probe reached a live endpoint and got an explicit
401/403 OAuth/API-key challenge, that's proof of life — usually proof of MORE agentic
capability behind the wall, not less. Surfaced as:
- the amber **⚿ marker** next to the verification badge in `StoryVerdictsTable` and
  `StoryMatrix` cells whose verdict cites an auth-wall probe;
- the **"N auth-gated probes" chip** on the product page (counts uncited walls too);
- the Legend's Proof row (`⚿ auth-gated — probe hit a live sign-in wall`);
- the **Try-it microterminal**: a live MCP probe that hits a 401 renders what the wall itself
  disclosed (RFC 9728 resource name / scopes / auth server, fetched by
  `infra/cloudflare-proxy/worker.js`) plus a copy-paste `mcpServers` client config and the
  vendor's MCP docs link — "verified reachable, auth-gated — untestable keylessly", never a
  dead end. Keyless handshakes additionally list the live tool catalog (`tools/list`).

**Untested ≠ zero** (`lib/data-helpers.ts` `isGroupUntested` / `isThemeUntested`). A component
score built entirely from zero-evidence none/na cells renders italic *untested*, never `0/100`:
- ArenaTable: agent-ready, Built-in AI, API-quality, openness, automation columns;
- MegaTable: agent-ready, Built-in AI, API-quality columns;
- product page: the AGENT-READY / BUILT-IN AI badges (`AgenticBadge untested` prop) and the
  per-story quality column (`isStoryUntested`);
- StoryMap quality cells.

**Known remaining gaps** (deliberate — report, don't boil the ocean):
- `AiEraBadge`'s component-breakdown tooltip still shows raw numbers (a 0 there can be an
  untested 0) — the columns beside it carry the untested distinction, the tooltip is next.
- Per-theme scores on the ranking page / `themeScores` in exports (`lib/markdown.ts` llms.md,
  private site repo; `/compare`, battle pages) render numeric values without the untested
  distinction.
- `lib/scoreIntervals.ts`'s internal `isUntested` omits `na` (inconsistent with the canonical
  rule; affects only interval width, not display).

## Human review points

1. **story-runner PRs** — every refresh passes the deterministic stability check locally
   before its branch is pushed or PR opened, then explicitly dispatches CI on its branch. The metadata-only refresh-auto-merge recovery workflow updates generated branches
   when an active ruleset requires a current base, and dispatches missing CI on main
   pushes, twice hourly, or by manual dispatch. Auto-merge waits for validation, ci, Greptile Review, and
   resolved Greptile review threads via the metadata-only `review-findings` gate.
   Foreloop checks and threads are outside the merge requirements. The CI stability
   gate rejects upgrades without verified new cited source support. A fresh row ID or
   model paraphrase alone does not establish new facts. A verified
   downgrade may instead follow changed or lost prior support; quality cannot increase and
   applicability cannot change through that path. Review semantic findings under the re-judge
   stability policy before merging: when prior cited support is unchanged, a verdict flip
   citing NO evidence id new to the pack is re-roll noise —
   revert it (`rankings-engine/scripts/revert-churn.ts` pattern, METHODOLOGY.md). Exception: a
   labeled judge-model migration wave (e.g. 2026-09-30, sonnet-5 → opus-5-5) is exempt — under
   a judge change every flip cites no new evidence by construction, so the wave is labeled in
   score-history/docs instead of reverted (README §7). Post-migration baselines: compare flips
   against opus-5-5 verdicts, not sonnet-era ones, and expect far lower `na`/`disputed` rates
   than the sonnet-era documentation of those frequencies.
2. **accuracy-engine report PR** — merging it is what switches story-runner onto the new
   worst-stale ordering. Skim the flips section: anything shocking is worth a manual look
   before the keyed runs get there.
3. **The work-queue issue** (labels `story-runner` + `founder-call`, Wednesdays, filed only when
   the queue is non-empty) — the ranked to-do list. Close it once the listed rankings have been
   through keyed runs (the next week's issue also closes it automatically, naming its successor);
   score changes require new supporting citations, or a verified non-upward judgment after
   previously cited support changes or disappears. Unchanged-support rerolls are reverted.
4. **Contest / vendor-response issues** — external correction channels; vendor responses enter
   the evidence pool but never change a verdict by themselves.

## Repair and recheck

The scheduled story producer pins its starting main commit. After judging, before claims
and derivation, `reconcile-refresh.ts` applies the existing stability policy to proposed
grades. An unsupported flip retains the complete baseline row only when its citations
still support it under the current rubric and its origin is proven by a matching model
cache in Git history. Changed support, missing provenance, incompatible catalogs or stale
rubrics stop the run for review. Legitimate new-source changes and verified downgrades
still pass through. Deliberate scoring migrations remain separate from this producer path.

Raw judge caches remain raw model output. Retained canonical decisions are recorded in
`rankings-engine/cache/refresh-retention/<arena>/decisions.json`, bound to the complete
current inputs and an ancestor model-backed decision. Repeat runs reverify that origin;
the sidecar alone never authorizes retaining a grade. The final committed-diff stability
guard still runs before any remote publication.

Product-scoped manual judging stops before model calls if it would overwrite an untouched
retained decision with raw cache output. Explicit whole-category rejudges and isolated
previews keep their existing behavior. Automated PR repair also stops before writes or
reviewer audits when the effective merged candidate contains retained decisions that differ
from raw caches; those cases need human review until repair supports retention provenance.
Deliberate migration and adjudication scripts are not retention-aware.

Failed keyed runs save bounded, allowlisted baseline and candidate JSON, raw judge caches
and the reconciliation report as `story-refresh-diagnostics-<run>-<attempt>`. These short-lived
artifacts exclude crawl bodies and environment files. They are for offline diagnosis only,
not the canonical `internal-refresh-*` receipts accepted by the merge controller.

The recovery controller dispatches `refresh-repair.yml` for failing generated story-runner
PRs, unresolved Greptile findings on verdict cells, and merge conflicts. CI completion also
wakes recovery. Drafts and PRs whose auto-merge opt-in was removed are skipped. Recovery
and repair retain existing opt-in and never re-enable it. Recovery waits for ordinary CI,
independent review, and resolved findings before advancing a stale base, and only updates
it when an active required-check ruleset demands a current base. With loose rules, a
conflict-free head keeps its existing checks and review. GitHub still enforces every merge
requirement; the controller reads applied rulesets without changing them. Unknown
mergeability or an unreadable freshness policy stops recovery for that PR. Real conflicts
remain visible and reach bounded repair once checks and findings permit changing the head.
Missing CI and reviews are recovered on the same head even while it conflicts. Active
CI runs keep their head, including runs whose checks have not appeared yet. Pending reviews
and repairs keep a stable head. Repair dispatch waits for every active Greptile review on
that head; the worker rechecks before model calls and before publishing, discarding its
unpublished candidate if a review started during repair. Foreloop remains outside this loop.

Story-runner publishes with `GITHUB_TOKEN`, matching the Actions-bot author accepted by
recovery, repair, and review. Its optional PAT publication override is retired. Existing
PRs created under a PAT account require maintainer attention; automation does not widen
its author allowlist to adopt them. Radar additionally accepts its explicitly configured
Content App bot on scan and bring-up branches; see [radar publication identity](VENDOR-RADAR.md#automatic-checks-and-publication-identity).
Its data-repair scope remains separate from story-runner.

## Internal refresh merge policy

Story-runner and vendor-radar use the existing native auto-merge path with the repository's
workflow token. An App is optional for radar publication, and the separate two-maintainer
Author automerge controller remains under its own configuration. Required `ci`, `validation`,
`Greptile Review`, and `review-findings` checks remain enforced. These workflows enroll only
the locally verified head, and recovery preserves a maintainer's removal of native auto-merge.

The producers run only from this repository's `main`. Before publication, the shared
`scripts/refresh_policy.py` checks the committed diff against each generator's content scope.
The required findings gate checks the complete current diff again, including Git file modes.
Executable files, symlinks, deletions, renames, workflow/code changes and taxonomy changes
stay outside this automatic path. Bring-up may update existing arena product rosters; scan
PRs may contain only radar reports, their reconciled source records and discovery records.

Internal identity requires GitHub's authenticated Actions account ID, login and Bot type,
or the explicitly configured radar App identity. A branch prefix or label grants no trust.
Each published head also needs a GitHub-hosted artifact whose name binds the PR, generator
family and exact commit. The gate verifies the artifact's canonical workflow ID/path,
repository, main-branch source and ancestry in protected main. Artifact contents are never
executed or downloaded. A manual replacement of an old generated branch, or a record from
an unrelated workflow, does not qualify. Existing heads without these records require a
fresh canonical generation or an ordinary maintainer PR; their provenance is not inferred.

Repair verifies the previous head's record before processing it, then records only the
locally computed, successfully pushed head. For a required base update, recovery creates an
immutable commit with the inspected GitHub merge tree and ordered previous-head/main parents.
It uploads a separate intent naming that exact commit before changing the branch. Application
rechecks eligibility, the previous head and current main, then uses an atomic expected-head
update with force disabled. A delayed response or failed receipt upload can be recovered on a
later sweep: the current head must exactly match the canonical intent, its previous head must
have an ordinary receipt, and its recorded main must remain in main history. Recovery restores
the ordinary receipt before dispatching checks. The findings gate accepts only ordinary
receipts; a different commit with the same tree and parents cannot replay an intent. Expired
or foreign intents remain blocked. These checks preserve the existing repair bounds and do
not grant radar any story-runner data-repair capability.
A scan remains valid when its later bring-up fails: its own publication must have completed
before its record is uploaded, and its required checks must independently pass.

The labels `automerge-hold`, `do-not-merge`, `hold` and `manual-merge`, draft state and reviewer
requests for changes block the required findings gate. Recovery, repair and review requests
also honor holds. Label events and a final metadata read revoke a previously green result.
GitHub does not atomically lock labels with a native merge: disable auto-merge or convert the
PR to draft for an immediate server-side stop. A removed native opt-in is never restored by
recovery. The trust boundary assumes repository administrators and privileged workflow code
remain trusted; a workflow with permission to forge required statuses is outside this gate's
ability to isolate without changing repository protections. Statuses are also scoped to a
commit rather than a PR: a privileged caller can reuse an already-green SHA on another PR
before its PR-specific provenance gate reevaluates. The gate rejects the missing PR receipt;
native merging cannot atomically prevent that privileged replay.

Bot merges suppress normal push-triggered workflows. The existing recovery sweep therefore
checks current main for a recorded internal merge and starts missing registered CI. It
confirms the observed SHA, retains failed runs, limits retries, and dispatches only `main`.
If main advances during dispatch, the next sweep evaluates its new tip; this does not promise
a separate run for every historical merge. No new credential, App installation, branch-rule
change or bypass is needed for native merging or this continuation.

GitHub marks `pull_request` runs created by `GITHUB_TOKEN` as `action_required` until a
maintainer approves them. Generated PRs explicitly dispatch the same CI workflow on their
head branch. Recovery treats an approval-required run with no dispatched result as missing
CI. It preserves active runs from either event and the latest success/failure result within
each event. Older completed runs cannot mask a newer cancelled run of the same event. It retries runs that
ended without a result up to three dispatches per head. Exhausting that budget reports an
error for human review. An approval-required run appearing after a successful dispatch
does not trigger another dispatch. See [GitHub's workflow-trigger rules](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs).

Recovery, repair routing, and review requests select the same usable result: the newest
success or failure among the latest runs per event. A newer cancelled dispatch cannot
hide an approved PR result. Validation and review still bind checks to that exact suite.

The worker executes the current main branch only. It fetches the proposed branch as data,
accepts changes only in its arena and declared generated projections, and rejects code,
workflow, symlink, and cross-arena source edits. Concurrent canonical source edits remain
blocked; generated rankings, graphs, reviews, intervals, predictions, and history are rebuilt
from merged inputs. Append-only uptime observations are combined without rewriting history.

Evidence content changes receive distinct deterministic IDs before future judgments;
repeated extraction of the same content retains the same identity. Timestamp-only updates
create no new evidence. Repairs reconcile older PRs that reused an ID for changed text and
remap their citations. A cache may migrate across label-only changes only after its original
payload hash and exact original judgment are verified.

Fetched first-party and community text carries a SHA-256 source digest computed before
model extraction. Same-source score changes require a changed digest as well as changed
cited content. Legacy same-source records without digests require review; the runner cannot
infer changed facts from a fresh label or paraphrase. Equivalent Hacker News API/discussion
URLs and whitespace-only changes do not establish new support or support loss. Real probe
observations can record changed behavior at the same endpoint. Runtime/audit probes and
preservation markers survive scheduled refreshes, and publication rejects their removal.
Community extraction appends dated observations and preserves prior reports when a model
omits them. An unchanged source digest cannot produce another community paraphrase row.

The current judge response requires structured support: the exact story subject, direct
versus adjacent relation, complete versus partial coverage, and verbatim cited quotations.
Full credit requires complete direct support; partial credit requires the named capability
itself. Questions cannot establish an affirmative claim. Extraction verifies its quotations
against the fetched source. These checks enforce the response contract, not semantic truth;
independent review still checks whether a quotation actually entails the named capability.
The new prompt version invalidates older judge caches on the next scoped judge run. This
source change does not rewrite the published corpus or authorize a bulk re-judge. The
review that gated scheduled runs is complete: the rubric-migration preview and the legacy
same-source transitions audit are published in `reports/rubric-migration/`, and the
maintainer ratified the v6 rubric migration after that two-part review. The published
corpus migrates to v6 in labeled waves per docs/RUBRIC-MIGRATION-2026-11-05.md; an arena
not yet migrated still carries its prior-version verdicts until its wave or its next
labeled judge touch.

### Scoped judge verification

`judge --product` publishes through the category matrix. Before any model call or cache
write, it checks that every untouched product already has current input/rubric caches.
A missing, old-format, stale, corrupt or mismatched untouched cache blocks that scoped
publication. This preserves the complete-matrix requirement during a rubric migration.

Use `judge-preview` for a separately approved, non-publishing live pilot:

```sh
pnpm engine judge-preview --category ai-video --product reelmimic --story api-sandbox
```

Run from an isolated checkout pinned to the reviewed source commit and capture stdout
outside that checkout. The stage requires one explicit category, product and story;
affiliated products follow the separate bias-audit process. It reads the existing evidence
pack, skips all caches and matrix assembly, and returns the proposed verdict with model,
prompt version and input/prompt hashes. It writes no caches, verdicts, rankings or projections.

The pilot permits one provider request, with SDK, parse and correction retries disabled,
a 60-second request timeout, at most 40,000 input bytes and 4,096 output tokens. An invalid,
truncated or unsupported result stops the pilot. A retry requires another explicit decision.
Normal scheduled judging retains its existing retry policy.

Before and after the pilot, compare the tracked evidence, verdict, ranking and cache files
and confirm the checkout remains clean. Review the returned quotations against the selected
evidence and exact story, including adjacent-feature boundaries, before accepting the result.
Keep all content workflows disabled throughout. This pilot checks judge behavior only;
it neither exercises publication/recovery nor authorizes an arena migration or restart.
Those require a separate reviewed rollout after the stack's checks and findings are cleared.

Unsupported grade churn restores the previously published judgment when its cited content
is unchanged and its rules remain valid. Changed or missing source content requires a verified current-input judgment, or a
scoped re-judge within the worker's cell budget. Such source loss may lower full/partial
credit toward none with no quality increase, and cannot justify an upgrade or applicability
change. Failed-worker budgets are scoped to the deployed repair policy version, so a
policy correction can retry heads that exhausted an older worker implementation. Reviewed cells may use the configured judge to reconsider the evidence and audit
the reported concern. Review text is diagnostic context, never evidence. Missing evidence,
unknown citations, rubric violations, and affiliated-product review needs stay blocked.

Unsupported findings (including claims, projections, unmappable lines, and affiliated
products) stop repair and name the blocker. Every finding must have a successful audit
before publication. A repair must change canonical verdict or evidence content compared
with the PR head; timestamps, reordered evidence, cache rewrites, and projection-only changes
do not establish progress. A no-op stops before projection regeneration or a commit.

Every repair runs the repository gates before a non-force push, launches CI, and checks
the new head again. Story-runner, recovery, and repair route review requests through
`refresh-review.yml`. Its per-PR concurrency group serializes callers and its trusted bot
comment reserves each attempt before sending the review mention. Exact-head CI must pass
first. An ambiguous send consumes the reservation; checks that have not appeared yet do
not cause an immediate retry. At most two requests are permitted per head, at least one
hour apart. A completed successful review never triggers another request on that head,
even if findings remain. Exhaustion and unmanaged failed reviews require human attention.
The request worker honors drafts, removed auto-merge opt-in, and paused recovery.
 An old thread may close only for an audited
cell after CI and independent review pass, with no new verdict-matrix findings. All other
threads remain open. A changed head discards the repair. Attempts are bounded to three
published repair commits, three failed-worker retries per head, and two concurrent workers. Pending checks resume
the saved audit for the same published head, without another judgment or repair commit.
Only artifacts from the trusted main repair workflow with matching PR, head, run, and base
bindings can resume. Audits are bound to the exact review discussion; edited findings or
new replies require another assessment. Foreloop replies are excluded from that context. Failed stages are appended to the retained report.
Reports are retained as workflow artifacts; exhausted or ambiguous repairs require review.

## Invariants

- Keyless loops never touch verdicts. Only the keyed judge (story-runner, contest-check) can.
- Every score recomputes deterministically from committed data (`recompute-check.ts`, CI-gated).
- The display layers (⚿, *untested*) are derived at render time from the same committed
  evidence — no new stored state, nothing for the engine to keep in sync.
