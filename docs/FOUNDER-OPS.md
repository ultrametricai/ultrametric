# The founder-ops corpus lift: executed record

One-page record of the 2026-09 corpus lift, compressed 2026-10-19 (the
`docs/REPO-SPLIT-PLAN.md` treatment for executed plans). The full architecture and lift
plan this file previously held, the tree table, the stage sketches, and the
service-boundary notes, is in this file's git history.

## What the lift did

Ingested the founder-ops-open starter (2026-09-28) and lifted Ultrametric from a
vendor-evidence layer into an open operating layer for starting and running a company:
index → scenario match → source-backed process → private execution record. The public repo
stores reusable knowledge, schemas, fictional fixtures, and vendor evidence; a company's
facts, decisions, documents, and audit log belong in its private workspace.

## Stages, as executed

- **Stage 1, done 2026-09-28.** Tree scaffolded; starter records ingested verbatim (US-FED
  and US-DE rule cards, the 409A and 83(b) demonstration workflows, sources, registries,
  fixtures, templates, schemas); the validator and planner ported from Python into
  `lib/founderOps.ts` so the corpus gates run inside vitest; governance merged with the
  repo's evidence doctrine.
- **Stage 2, done 2026-09-28.** Byte-identical moves behind the loaders: the operational
  process corpus and chains into `open-processes/`, vendor availability into
  `jurisdictions/vendor-geo.json`. Published the corpus contract as
  `schemas/operational-process.schema.json`, generated from the zod source by
  `scripts/generate-corpus-schemas.ts` with a byte-identical drift gate
  (`__tests__/corpus-schemas.test.ts`), and generated the vendor-review interchange layer
  (`open-rankings/reviews/generated/`, `rankings-engine/scripts/generate-vendor-reviews.ts`).
- **Stage 3, retired 2026-09-29.** The planned `apps/` workspace move was moot: the MCP and
  CLI packages moved to their own dedicated repo, and the site and the Cloudflare edge
  worker later moved to the private site repo in the 2026-10 repo split
  ([REPO-SPLIT-PLAN.md](./REPO-SPLIT-PLAN.md)). Nothing about the corpus contract depended
  on it.

## What stays binding

The record semantics the lift ingested are live rules, maintained in AGENTS.md ("Legal and
founder-ops layer") and `policies/`: stable process IDs with versioned substantive edits,
rule cards resolving to primary sources with exact locators, editorial review dates that
are never legal effective dates, a named scoped human approval on every
externally-effectful step, and a matcher that rejects unknown jurisdiction combinations
rather than guessing. The validator (`lib/founderOps.ts`, gated by
`__tests__/founder-ops.test.ts`) enforces the structural half of those rules.
