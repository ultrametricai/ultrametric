# Scripts

The repo's gate and generator tooling. The rankings engine's own scripts live in
`rankings-engine/scripts/`; this directory holds what gates and regenerates the repo
itself.

## Gates and sync

- `sync-open.mjs` — validates `open-manifest.json` against the tracked tree
  (`pnpm manifest:check`) and materializes the overlay paths into the private site repo at
  its pinned commit.
- `update-readme-stats.mjs` — `pnpm stats`: fails if a generated count block reappears in
  the README or its prose carries a count.
- `content-audit.mjs` (+ `content-audit.test.mjs`, run under `node --test`) — exports a
  source-library audit of the committed records without changing them
  (`coverage/README.md`, "Source-library audit").

## Generators (outputs are drift-gated; edit the source, never the output)

- `generate-corpus-schemas.ts` — the published JSON Schema contracts in `schemas/` from
  their zod sources.
- `generate-badges.mjs` — the score-badge SVGs in `public/badges/`.
- `generate-business-logic-serves.ts` — the Serves lines in `open-modules/README.md`.
- `generate-process-arena-coverage.ts` — `docs/PROCESS-ARENA-COVERAGE.md`.
- `generate-process-diagram.mjs` — the step-graph SVG in the `open-processes/` README.
- `generate-situations-md.ts` — the table block in `open-processes/SITUATIONS.md`.
- `generate-timeline-inversions.ts` — `docs/TIMELINE-INVERSIONS.md`.

## Shared-process projection

`shared-processes/` carries the canonical-definition tooling: `check.ts` + `project.ts`
(`pnpm shared:check`, `pnpm shared:project` — the corpus/chains/equity projections from
`open-processes/<slug>.json`), `export.ts` and `export-candidate.ts` (the export bundles),
and the Python import receipts from the shared-corpus migration.

## Toolchain config

`config/` holds the eslint and vitest configs the package scripts point at;
`pnpmfile.cjs` carries the dependency-resolution policy hooks.
