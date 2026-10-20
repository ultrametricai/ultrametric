# Rankings engine

The rankings engine is the code that crawls vendor surfaces, extracts and normalizes
evidence, probes what vendors publish and ship, judges verdicts, and derives the
rankings published in [`open-rankings/`](../open-rankings). Run one stage at a time with
`pnpm engine <stage> --category <id> [--product <id>]` (the dispatcher is `cli.ts`);
`pnpm run pipeline` is a deprecated alias for the same entry point. Derived files are
regenerated, not hand-edited: to change a score, change the evidence or the code and
re-run `derive`.

## Stages

Each stage is one file in [`stages/`](stages), registered in `cli.ts`:

- `crawl.ts` — fetches each product's public pages into a local page cache: HTML is
  converted to markdown, while raw-text sources (`llms.txt`, docs `.md` mirrors, OpenAPI
  specs) are kept verbatim. Robots-walled front doors listed in a product's
  `crawlExclude` are skipped and recorded as dated probe evidence instead.
- `extract.ts` — LLM pass that distills crawled pages into structured, quoted evidence
  items.
- `normalize.ts` — builds a category's `stories.json` taxonomy around the canonical lens
  stories in `agentic-stories.ts`. The hand-curated counterpart is
  `scripts/assemble-manual-stories.ts` over `seeds/manual-stories/`.
- `collect-community.ts` — gathers community-tier evidence (what users report, as opposed
  to what vendors claim) starting from the seeded public threads in
  `seeds/community.json`.
- `probe.ts` — keyless network checks of what a vendor publishes: `llms.txt`, docs
  mirrors, OpenAPI, MCP endpoints. The fetcher is injectable so tests stay off the
  network.
- `probe-record.ts` — runs the local, keyless CLI and MCP probes registered in
  [`probes/`](probes) against what a vendor ships, capturing replayable terminal
  recordings as published proof.
- `judge.ts` — LLM judge: rules every (product, story) cell from the product's full
  evidence pack, through the committed cache described below.
- `claims.ts` — restates each vendor capability claim in plain words; the LLM only picks
  which evidence item backs a claim and how to phrase it, and the quote, URL, and tier
  are copied verbatim from the cited item.
- `derive.ts` — computes `rankings.json` and the rollups from `verdicts.json` via
  `lib/scoring`, attaches provenance, and appends score history on change.
- `logos.ts` — fetches product logos into `public/logos/`.
- `popularity.ts` — keyless momentum signal from GitHub repo activity and npm/PyPI
  download counts, with no LLM calls.
- `pricing.ts` — fetches pricing pages for covered arenas and LLM-extracts structured
  pricing facts into `pricing.json`.
- `integrations.ts` — extracts product-to-product integration facts from the existing
  evidence corpus (no new crawling) into `integrations.json`.
- `screenshots.ts` — captures vendor homepage and docs screenshots with a real browser
  into `public/screenshots/`.

The stages that call the LLM are `extract`, `normalize`, `collect-community`, `judge`,
`claims`, `pricing`, and `integrations` (everything that imports `llm.ts`).

## Probes

[`probes/`](probes) holds one module per arena (`probes/<arena-id>.ts`), registered
explicitly in `probes/index.ts` and executed by the `probe-record` stage. `types.ts`
defines the `LocalProbe` contract: the binary and argv to run, an optional JSON-RPC
stdin payload for MCP stdio handshakes, the regex the transcript must match for the
probe to pass, and a timeout. Every probe is cheap, keyless, and read-only; nothing
installs, mutates state, or needs credentials.

## Cache

The judge cache ([`cache/judge/`](cache/judge)) is committed to the repo. Each cell is
keyed by a hash of the story, the product's full evidence array, and the prompt and
judge-model version, so re-judging without new evidence reproduces the same verdicts
from cache with no LLM calls, and any evidence or model change invalidates exactly the
affected cells. After a contributed correction, the minimal flow is `judge --product`
then `derive`, with scope and cost described in CONTRIBUTING.md ("About the judge cache
and re-judge scope"). The sibling subdirectories hold other committed LLM outputs:
step-call, step-prompt, and step-story mappings, story-tier classifications, the
human-step audit, and depth-mining summaries. The raw `crawl/` and `extract/` page
caches are local only (gitignored).

## Seeds and golden cells

- `seeds/community.json` — per-arena lists of public community-thread URLs that
  `collect-community` reads as its starting points.
- `seeds/manual-stories/` — hand-curated story taxonomies, assembled into a category's
  `stories.json` by `scripts/assemble-manual-stories.ts`.
- `seeds/*-supp-evidence.json` — supplemental evidence packs: verbatim passages from
  crawled pages that the generic extraction pass misses (operating windows, statutory
  fees, identity-proofing language), appended by their matching scripts.
- `golden/golden-cells.json` — cells whose correct verdict is established and explained,
  read by `scripts/calibration-check.ts` to measure judge calibration.

## Depth harness

[`depth/`](depth) is the agentic-depth harness: `pnpm run depth <product>` runs the
runtime conformance suite and writes dated snapshots under
`open-rankings/experiments/depth/`. It lives outside `cli.ts` on purpose and touches no
evidence, verdicts, or rankings, so a slow or flaky depth run cannot destabilize the
evidence loop. The program design is in
[`docs/agentic-depth-program.md`](../docs/agentic-depth-program.md).

## Scripts

[`scripts/`](scripts) holds the operational tooling around the stages, grouped by job
(named examples, not an exhaustive list):

- Recompute and certification — `recompute-check.ts` re-derives every category from
  committed verdicts and fails on drift; `certify.ts` and `cert-sweep.ts` run the
  Agent-Ready conformance suite against vendor surfaces.
- Evidence appends — the `append-*` scripts write recorded runtime probes and docs
  excerpts into arena evidence files, one dated script per wave.
- Bias audits — the `bias-audit-*` scripts are the adversarial passes run whenever a
  founder-affiliated product's cells are judged or re-judged.
- Churn settlement — `revert-churn.ts`, its per-wave variants, and the `settle-*`
  scripts revert judge re-roll churn cell by cell, patching the judge cache so a later
  run does not resurrect it.
- YC pipeline — `yc-fetch.ts`, `yc-classify.ts`, `yc-cross-reference.ts`, and
  `yc-report.ts` map the YC public company directory onto arenas.
- Radar — `vendor-radar.ts` scans public launch surfaces for new products,
  `radar-triage.ts` records dispositions, and `radar-bringup.ts` appends approved
  candidates to their arena roster.
- Judge quality — `calibration-check.ts` scores the judge against the golden cells;
  `staleness-scan.ts` ranks products by evidence age for the accuracy engine.

## State files

- `radar-seen.json` — the vendor radar's seen ledger: every candidate the radar has ever
  reported, keyed by domain, repo, or normalized name. A listed key is not reported
  again, and `firstSeen` records the run that first surfaced it.
- `popularity-packages.json` — curated map from product id to its npm or PyPI package
  names, read by the `popularity` stage and verified against the public registries.

## API key

The LLM stages read `ANTHROPIC_API_KEY` from a local `.env`. That key is
local-engine-only: it must never be set on the Vercel project, and the deployed site
never calls the Anthropic API.

## Gates

`pnpm recompute-check` recomputes every category's rankings from the committed verdicts
and compares the result byte-for-byte against the persisted `rankings.json`; any drift
fails the gate. The engine's unit and integration tests live in `__tests__/` and
`depth/__tests__/` and run as part of `pnpm test` (the vitest config includes
`rankings-engine/**/__tests__/**/*.test.ts`).

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
