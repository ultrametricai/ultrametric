# The Accuracy Engine

How Ultrametric keeps 65 rankings / ~350 products from silently rotting: four scheduled loops,
each catching a different failure mode, feeding one work queue, with humans at exactly the
points where a score could change. This doc is the map; the workflows and scripts it names are
the source of truth.

## The loops

| Loop | Schedule (UTC) | Keys | What it does | What it catches |
|------|----------------|------|--------------|-----------------|
| **story-runner** (`.github/workflows/story-runner.yml`) | every 6h at :17 | `ANTHROPIC_API_KEY` | Full pipeline (crawl → extract → collect-community → probe → judge → claims → popularity → derive) for ONE ranking per run, plus score intervals, predictions, and the keyless SLO check. Ranking pick: **worst-stale first** from `data/staleness-report.json` when one stands (one ranking per 6h slot since the report's `generatedAt`), falling back to run-number rotation. | Stale evidence, changed vendor docs, verdicts due a re-judge — the only loop that can move a score. |
| **daily-snapshot** (`daily-snapshot.yml`) | daily 05:43 | none | Fleet-wide keyless SLO check + popularity refresh. | Agent-surface outages (llms.txt / remote MCP / openapi down), momentum drift. |
| **cert-sweep** (`cert-sweep.yml`) | Mondays 07:29 | none | Re-verifies every standing certification (45-day renew window) + certifies the top 15 queued candidates (`cert-candidates.ts`). | Certified surfaces that regressed; products that newly qualify. |
| **accuracy-engine** (`accuracy-engine.yml`) | Wednesdays 06:41 | none | Fleet staleness scan (`pipeline/scripts/staleness-scan.ts`), commits `data/staleness-report.json`, opens the ranked **work-queue issue** (label `story-runner`). | Everything below — the detector for what story-runner's keyed runs should chew through next. |

Plus the event-driven lane: **contest-check** (issue-labeled `contest`) re-judges a contested
cell with the contester's evidence added, and **ci.yml** gates every PR on
`pnpm test` + `pnpm build` + `recompute-check.ts` (scores must be a deterministic function of
committed data — always).

## The staleness scan (`pipeline/scripts/staleness-scan.ts`)

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

Output: `data/staleness-report.json` — products and rankings ranked worst-first, plus
`arenasRanked` (what story-runner's pick step consumes) — and the work-queue issue body.
Run it yourself: `pnpm tsx pipeline/scripts/staleness-scan.ts [--offline] [--category <id>]`.

## Honesty rules in the UI

Two failure modes the display layer guards against — both are **display-only**: no rule here
ever changes a verdict, a quality, or a score.

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
  untested 0) — the columns beside it are honest, the tooltip is next.
- Per-theme scores on the ranking page / `themeScores` in exports (`lib/markdown.ts` llms.md,
  `/compare`, battle pages) render numeric values without the untested distinction.
- `lib/scoreIntervals.ts`'s internal `isUntested` omits `na` (inconsistent with the canonical
  rule; affects only interval width, not display).

## Human review points

1. **story-runner PRs** — every refresh lands as a PR. Apply the re-judge stability policy
   before merging: a verdict flip citing NO evidence id new to the pack is re-roll noise —
   revert it (`pipeline/scripts/revert-churn.ts` pattern, METHODOLOGY.md). Exception: a
   labeled judge-model migration wave (e.g. 2026-09-30, sonnet-5 → opus-5-5) is exempt — under
   a judge change every flip cites no new evidence by construction, so the wave is labeled in
   score-history/docs instead of reverted (README §7). Post-migration baselines: compare flips
   against opus-5-5 verdicts, not sonnet-era ones, and expect far lower `na`/`disputed` rates
   than the sonnet-era documentation of those frequencies.
2. **accuracy-engine report PR** — merging it is what switches story-runner onto the new
   worst-stale ordering. Skim the flips section: anything shocking is worth a manual look
   before the keyed runs get there.
3. **The work-queue issue** (label `story-runner`, Wednesdays) — the ranked to-do list. Close
   it once the listed rankings have been through keyed runs; flips that survive a re-judge
   become verdict changes with new citations, which is the only way a flip may move a score.
4. **Contest / vendor-response issues** — external correction channels; vendor responses enter
   the evidence pool but never change a verdict by themselves.

## Invariants

- Keyless loops never touch verdicts. Only the keyed judge (story-runner, contest-check) can.
- Every score recomputes deterministically from committed data (`recompute-check.ts`, CI-gated).
- Display honesty layers (⚿, *untested*) are derived at render time from the same committed
  evidence — no new stored state, nothing for the pipeline to keep in sync.
