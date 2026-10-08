# The founder-ops corpus — architecture and lift plan

Ingested from the founder-ops-open starter (founder, 2026-09-28) and adjusted to this repo:
Ultrametric is lifting from a vendor-evidence layer into an open operating system for starting
and running a company — **index → scenario match → source-backed process → private execution
record**. The public repo stores reusable knowledge, schemas, fictional fixtures, and vendor
evidence. A company's facts, decisions, documents, and audit log belong in its private
workspace, never here.

## The tree

| Path | Purpose |
| --- | --- |
| `coverage/` | Domain taxonomy, lifecycle navigation, machine-readable coverage and gaps |
| `journeys/` | Multi-process founder paths (chains; The Open Startup is the live surface) |
| `processes/` | Jurisdiction-scoped legal workflows + the operational corpus (two layers) |
| `rules/<jurisdiction>/` | Canonical, dated legal rule cards with stable IDs |
| `sources/` | Primary authorities: provision locators, issue dates, checked dates |
| `jurisdictions/` | Registry + overlays; exact-dimension matching, unknown = unsupported |
| `open-modules/` | The open modules — cited, deterministic calculations (cap table first) |
| `resources/` | Curated canonical startup resources + the distilled startup laws (cited) |
| `open-documents/` | The open-documents map: openly licensed legal forms, linked never redistributed |
| `vendors/` | The evidence layer + the scenario-scoped review interchange format |
| `templates/` | Contribution starting points |
| `schemas/` | JSON Schema contracts for processes, rules, sources, vendor reviews |
| `fixtures/` | Fictional companies and events only |
| `governance/` | Review policy, evidence doctrine, agent policy, security |

The surfaces over the corpus live beside it: the Next.js site at `app/` (+ `components/`,
`lib/`, `public/`) and the Cloudflare edge worker at `infra/cloudflare-proxy/` (zone routing,
auth, watchlist/stack APIs, live MCP probes). The Ultrametric MCP server and CLI packages moved
to their own dedicated repo (2026-09-29). Optional vendor/government integrations, if ever
added, follow the adapter rules in the service-boundary section below — behind scopes, vaults,
dry-run, idempotency, and a named human approval for any external effect; no connector may
become a default vendor route.

Record semantics (from the starter, binding): process IDs are stable and `version` changes on
substantive edits; `rule_ids` resolve to rule cards which resolve to primary sources with exact
locators; `reviewed_on`/`review_due` are editorial dates, never legal effective dates
(`valid_from`/`valid_until` stay null until verified); every `external_effect` step requires a
named, scoped human approval; the matcher rejects unknown jurisdiction combinations rather than
guessing. The validator (`lib/founderOps.ts`, gated by `__tests__/founder-ops.test.ts`) checks
structure and semantic invariants; it does not prove laws true or implement a calendar engine.

## Lift stages

- **Stage 1 — done 2026-09-28.** Tree scaffolded; starter records ingested verbatim (US-FED +
  US-DE rule cards, the 409A and 83(b) demonstration workflows, sources, registries, fixtures,
  templates, schemas); validator + planner ported from Python into `lib/founderOps.ts` so the
  corpus gates run inside vitest; governance merged with the repo's existing evidence doctrine;
  every directory README bridges to the live implementation. `data/processes.json`,
  `data/process-chains.json`, and the ranking data deliberately did not move (fingerprinted,
  loader-bound, and under active lanes).
- **Stage 2 — done 2026-09-28.** Consolidated, byte-identical moves behind the loaders:
  `data/processes.json` → `processes/corpus.json` and `data/process-chains.json` →
  `journeys/chains.json` (`lib/processes.ts` resolves both as siblings of the ranking-data dir;
  the founder-ops workflow walker skips `corpus.json`); `data/vendor-geo.json` →
  `jurisdictions/vendor-geo.json` (`lib/vendorGeo.ts`). Published the corpus contract as
  `schemas/operational-process.schema.json`, generated from the zod source of truth by
  `scripts/generate-corpus-schemas.ts` with a byte-identical drift gate
  (`__tests__/corpus-schemas.test.ts`). Generated the vendor-review interchange layer:
  `vendors/reviews/generated/<arena>--<productId>.json` for every judged product (578 records)
  via `pipeline/scripts/generate-vendor-reviews.ts` — deterministic projection of the committed
  rankings/evidence/pricing/geo data, owner disclosures always carried
  (`pipeline/__tests__/vendorReviews.test.ts`). Still open from the original stage-2 sketch:
  folding process geo-scope into `rules/`, and the on-site workflow-layer surface (a
  `/founder-ops` or per-process "legal layer" view).
- **Stage 3 — retired 2026-09-29.** The original plan (physically move the site/CLI/MCP/worker
  under `apps/` as workspace packages) is moot: the MCP/CLI packages moved to their own
  dedicated repo, and the site (`app/`) and edge worker (`infra/cloudflare-proxy/`) stay at
  their current paths. Nothing about the corpus contract ever depended on it.

## Suggested service boundary (unchanged from the starter)

1. Public catalog and source registry, versioned by Git. 2. Private company graph. 3. Rules and
planning service emitting plans with uncertainties. 4. Policy engine for human approvals.
5. Adapter layer with scopes, vaults, dry-run, idempotency. 6. Audit store with receipts and
post-action verification. The public repo carries no accounts, keys, or default vendor.
