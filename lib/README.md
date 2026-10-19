# lib

The TypeScript layer behind the open data holds the loaders that read the committed
artifacts, the scoring that turns verdicts into ranked numbers, and the calculation and
simulator code whose catalogs live in the `open-` directories.

| Area | What it is |
| --- | --- |
| Loaders (`data.ts`, `processes.ts`, `proofs.ts`, and peers) | Read the committed artifacts (`open-rankings/`, `open-processes/`, `open-law/`) and validate them against `schemas.ts` |
| Founder-ops validator (`founderOps.ts`) | The legal-workflow validator and planner that `open-law/`, the jurisdiction-scoped workflows in `open-processes/`, `jurisdictions/`, and the coverage records route through; exposes the exact-dimension planner `planFounderOps` |
| Scoring (`scoring.ts`, `rollups.ts`, `provenance.ts`) | Verdicts to numbers: the leaderboard math that the engine's derive stage and `recompute-check` replay |
| [`openstartup/`](./openstartup/) | The calculation modules (code; docs and the worked-example index in [`open-modules/`](../open-modules/README.md)) |
| Simulator engine (`virtualStartup.ts`, `virtualStartupRun.ts`, `processSim.ts`) | The startup simulator's run layer (code; catalog and disclosed assumptions in [`open-startup-sim/`](../open-startup-sim/README.md)) |
| [`shared-processes/`](./shared-processes/) | The shared-record machinery: schema, loaders, and checks for canonical `open-processes/` definitions |

Tests live in `lib/__tests__/` and `lib/openstartup/__tests__/`; `pnpm test` runs them.

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
