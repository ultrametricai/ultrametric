# API-quality gap repairs, wave 6 (2026-11-06)

Per-cell check of the top twelve rows from the corrected staleness ranking (the PR #636
signature fix landed; 97 gap rows on post-#636 main; waves 1-5 = PRs #623, #627, #630,
#632, #634). iterm2 stays deferred (wave-2 ledger).

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave6.py` appends 33
live-verified rows (fail-closed; three markers re-derived against live wording: two curly
apostrophes and Wise's quarterly phrasing); 20 cells stay absent after checking.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| pylon | ai-support-agents | 4 | 2 | 2 |
| better-auth | auth-platforms | 4 | 4 | 1 |
| canny | product-feedback | 4 | 1 | 3 |
| formant | robotics-platforms | 4 | 2 | 2 |
| wise | startup-banking | 4 | 4 | 1 |
| airbyte | data-pipelines | 4 | 4 | 1 |
| fivetran | data-pipelines | 4 | 3 | 2 |
| datalab | document-extraction | 4 | 3 | 1 |
| ledgy | equity-management | 4 | 1 | 3 |
| navan | expense-management | 4 | 2 | 2 |
| meilisearch | search-infra | 4 | 4 | 1 |
| elicit | ai-research-agents | 4 | 3 | 1 |

Wave-6 specifics:

- One preserved probe counter-check: meilisearch's disabled Mintlify runner
  (`"display":"simple"`). Two fail-closed probe negatives: Formant's complete spec is not
  downloadable from the API host (the ReadMe OAS download is admin-gated; the
  machine-readable surface is per-endpoint in the .md mirrors), and Fivetran publishes a
  V1 spec only (the v2 file must keep answering 404).
- Wise's sandbox row cites the current V2 hosts (api.wise-sandbox.com) — the old
  sandbox.transferwise.tech hosts are Sandbox V1, deprecated 2026-06-30 per the vendor's
  migration guide. Its CalVer versioning policy (quarterly URL-based versions with a
  deprecation-and-sunset section) is the strongest in this wave.
- Honest scoping throughout: better-auth's spec and Scalar reference are generated and
  served by the integrator's own deployment (self-hosted framework); canny's sandbox is a
  plan-gated, support-provisioned staging workspace; ledgy's GraphQL API is documented in
  a static SpectaQL reference with no schema artifact, console, test company, or
  versioning page; navan's hand-rolled portal is static, partner-gated, production-only;
  elicit's Scalar reference mounts client-side against production.
- Reachability: developer.navan.com serves soft-200 shells for unknown paths (every navan
  URL content-verified); api-docs.usepylon.com and api./developers.ledgy.com do not
  resolve; specs.meilisearch.com is dead (the live spec is the docs-hosted asset). No bot
  walls were hit.

Scoped re-judges run under the ratified v6 rubric, then `derive` per touched arena and
the dependent generators. Engine output is accepted as-is; honest negatives ship: ledgy's
api-quality row is all-none (the GraphQL context row grounds the absences), canny keeps
three nones around its staging-workspace partial, navan keeps three nones around its
versioning partial, and the meilisearch counter-check held interactive-docs at none. One
checked-absent cell publishes as an engine partial on adjacent evidence (fivetran
api-interactive-docs, partial q3 on the Postman-collection affordance — the jira class)
and carries both readings. Honest dips ship (ledgy 10.2 → 9.3, navan 17.7 → 17.2).

## Pre-audit (before the first push)

86 up-moves vs merge-base, 40 verdict-level (26 target cells, 14 side-effect flips),
re-read against the v6 on-axis bar. Zero artifact-backed corrections — the counter-check
and scoped-excerpt discipline held every targeted cell. Three conceded-thin partials
stand with their limits inside the published rationales (named in the ledger `preAudit`);
all other verdict-level ups rest on on-axis evidence.

Row-level output: `2026-11-06-api-quality-wave6.json`.
