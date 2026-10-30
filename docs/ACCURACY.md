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

1. **story-runner PRs** — every refresh lands as a PR and explicitly dispatches CI on its
   branch. The metadata-only refresh-auto-merge recovery workflow updates generated branches
   and dispatches missing CI on main pushes, twice hourly, or by manual dispatch. Auto-merge waits for validation, ci, Greptile Review, a current main base, and
   resolved Greptile review threads via the metadata-only `review-findings` gate.
   Foreloop checks and threads are outside the merge requirements. The CI stability
   gate rejects upgrades without a cited evidence ID new to that product pack. A verified
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
   flips that survive a re-judge become verdict changes with new citations, which is the only way
   a flip may move a score.
4. **Contest / vendor-response issues** — external correction channels; vendor responses enter
   the evidence pool but never change a verdict by themselves.

## Repair and recheck

The recovery controller dispatches `refresh-repair.yml` for failing generated story-runner
PRs, unresolved Greptile findings on verdict cells, and merge conflicts. CI completion also
wakes recovery. Foreloop remains outside this loop.

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

Unsupported grade churn restores the previously published judgment when its cited content
is unchanged and its rules remain valid. Changed or missing source content requires a verified current-input judgment, or a
scoped re-judge within the worker's cell budget. Such source loss may lower full/partial
credit toward none with no quality increase, and cannot justify an upgrade or applicability
change. Failed-worker budgets are scoped to the deployed repair policy version, so a
policy correction can retry heads that exhausted an older worker implementation. Reviewed cells may use the configured judge to reconsider the evidence and audit
the reported concern. Review text is diagnostic context, never evidence. Missing evidence,
unknown citations, rubric violations, and affiliated-product review needs stay blocked.

Every repair runs the repository gates before a non-force push, launches CI and a fresh
Greptile review, and checks the new head again. An old thread may close only for an audited
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
