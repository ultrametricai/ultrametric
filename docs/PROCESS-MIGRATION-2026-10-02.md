# Legacy process migration reconciliation — 2026-10-02

The current canonical catalog already contains the legacy additions. The authorized
local import was executed twice and made no record changes. All 162 records pass
an exact field-and-scope comparison with fresh importer output after allowing the
documented formation chooser amendment. The four supplied screenshots identify
presentation gaps in the canonical preview reader, not lost source data.

One migration safety defect was repaired: the latest receipt had blessed the
authored `form_001` record as generated. Its `generatedHash` now describes actual
generated content, so later legacy changes stop for reconciliation instead of
overwriting the chooser's guidance and option scope. No canonical record,
legacy source, schema, renderer, score, workflow, security or dependency was changed.

## Exact source range

This audit uses Git history and import receipts, not a UTC day cutoff.

| Boundary | Commit | Meaning |
| --- | --- | --- |
| Previous user-approved migration source | `06fa7b8a7989cf0a1f9afd0912a0887c3e4be6a8` | PR96 incorporation depth, recorded in `default-options-audit.json` |
| Previous compatibility reconciliation | `a63288b1d24572ab7dcdc2cd2618738f0a786628` | Preserved PR96 fields and approved 38 defaults |
| Latest source imported on current main | `8d448bd91e50d517bc6688a8cb738b81514dcf68` | Geo-filter merge; the 45 refreshed records carry this provenance |
| Latest import/reconciliation commit | `a23056a0a12f5343a13e3f2930e48a74da18ba2a` | Updated geo metadata and import manifest |
| Current source audited | `ff3ee5464ae3463cdf7c39f02a097810bb4650ab` | Remote `refs/heads/main` verified at checkout creation |

Across the previous user migration source → current source range (`06fa7b8a..ff3ee5464`),
45 corpus records gained 156 `geoNotes[].kind` values: 143 `analog`, 10 `absorbed`,
and three `not-applicable`. The additions originated in `f65768511` and were already
reconciled by `a23056a0a`. There are **zero added/deleted records, parts, options or
edges**, and no changed node/method/edge values in that range. Chains, equity workflows,
artifact/vendor/document registries and the step-to-story map are unchanged.

Across the latest imported source → current source range (`8d448bd91..ff3ee5464`),
there are **zero corpus, chain or equity-workflow changes**. The new source is
`processes/business-logic-map.json`, added by `e5d7e6aeb`: 16 modules, 45 associations,
24 existing canonical process IDs. It remains the authoritative external registry;
its `processes[]` keys already resolve unchanged to canonical IDs. Duplicating its
labels or treating module associations as execution dependencies would add semantics
the source does not provide. The canonical preview does not yet show its chips.

The [machine-readable inventory](PROCESS-MIGRATION-2026-10-02.json) lists all 156
field mappings, all 45 affected records, every audited source file's Git blob and
byte hash, provenance, metadata counts, and import/idempotence receipts.

## Field mapping and preservation

| Legacy source | Canonical schema v1 destination | Policy / evidence |
| --- | --- | --- |
| Corpus `id`, `title`, `description` | `id`, `title`, `summary` | Exact values; 136 operational records |
| `dag.nodes[].id`, `label` | `parts[].id`, `title` | Stable IDs; 792 original nodes |
| `dag.edges[].from/to` | `links[].from/to`, `when: null` | All 607 edges retained; no inferred dependency/condition |
| `processRef` | `part.ref`, reference kind | Existing slug/alias resolution to stable record IDs |
| `methods[].id/label/summary` | `options[].id/title/summary` | All 98 methods retained; includes the Clerky addition |
| `methods[].context.when` | `option.when` | Verbatim applicability prose |
| Remaining method `context` | `option.metadata.context` | Exact kind/countries; no country propagation |
| `methods[].subSteps` | `option.parts` | Recursive original IDs and field scopes; no new links |
| Node vendor, candidate, category, product, rule IDs | Typed `references` with original roles | Associations stay distinct from citations and endorsements |
| `actionUrl`, `actionLabel`, `signupUrl` | URL references, preserved title/role | Unknown description remains null |
| Base node fields on the 38 repaired decisions | `options[default].metadata/references` | 36 records; all 97 alternatives and original links retained |
| `form_001:n1` base fields | Chooser `metadata/references`; Clerky under its own option | Approved exception retained exactly, including guidance and six candidates |
| `verify` | Owning part/default/method `metadata.verify` | All 65 objects, including `how` and optional URL |
| `cost` | Owning part/default/method `metadata.cost` | All 26 objects; exact `usd`, `kind`, `source`, `asOf`, `note` |
| `failureModes` | Owning part/default `metadata.failureModes` | Four arrays; exact `what`, `then`, optional `source` |
| `documents` | Owning part/default `metadata.documents` | Four arrays, references into unchanged document registry |
| Record `requires/produces` | `record.metadata.requires/produces` | Both arrays present for 136 corpus records, including honest empty arrays |
| Node `producesArtifact` | Owning part/default `metadata.producesArtifact` | 91 tags; 81 artifact definitions remain in `processes/artifacts.json` |
| `geoScope`, `geoNotes[].kind`, region/jurisdictions | Same-scope `metadata` | 136 geoScope values, 45 geoNotes arrays, all new classifications |
| `kind/trigger/urgency` on reactive situations | Record `metadata` | All 12 retained; no new top-level kind or execution interpretation |
| Route, timing, approval, risk, signature and other annotations | Same-scope `metadata` | Exact raw values; no timing or Who/How/Where inference |
| Chain `name/tagline/taskIds` | `title/summary/parts[].ref` | 24 chains; original order and IDs; no list-order dependency edges |
| Equity workflow `outputs/steps/rule_ids` | `outcomes/parts/references` | Two workflows; six unplaced decisions stay in metadata |
| `toolCall`, `functionCalls` | `legacy-audit.json` only | All raw claims retained in quarantine; not candidate instructions |
| Unmapped fields | Same-scope `metadata`, with audit trace | Lossless transition data; not automatically included in API instructions |
| Original source identity | `source.path/id/revision/sha256` | Every historical source revision and hash verified against Git |
| `data/process-step-stories.json` and judged scores | Existing external maps / comparison adapters | 1,079 mappings untouched; default scope never assigned to alternatives |
| New business-logic registry | Existing external registry keyed by canonical record ID | 16 modules/45 associations preserved in place, with no duplicated graph meaning |

No new field needs a schema redesign for lossless storage. Metadata is the existing
transition mechanism. Promoting selected annotations into API instructions is a
separate explicit mapping decision; this audit does not silently promote them.

## Screenshot acceptance matrix

All four supplied PNGs were downloaded to this task's local `examples/` directory,
verified readable, and inspected as pixels before identifying their content.

| Supplied example | Exact source → canonical mapping | Current preview reader |
| --- | --- | --- |
| `image(20261002-191138).png`: “Known government fees: $164.55” | Derived from default-view `form_001` costs: `n4.options[default].metadata.cost.usd` 109 + `n5.metadata.cost.usd` 50 + `n8.metadata.cost.usd` 5.55 | **Missing presentation**; no total is stored or newly invented |
| `image(20261002-191139).png`: Needs / Produces | `form_001.metadata.requires`: company-name, registered-agent; `.produces`: certificate-of-incorporation, bylaws, founder-stock-issuance, 83b-election. Labels/producer IDs resolve in the artifact registry | **Missing presentation**; all six IDs and registry records preserved |
| `image(20261002-191141).png`: lost stamped certificate / recovery | `form_001.parts[n5].metadata.failureModes[0]`, including exact recovery text and Delaware fee-schedule URL | **Missing presentation**; old `StepFailureModes` renders this object |
| `image(20261002-191301).png`: n5 “$50 government fee · as of 2026-10-01” | `form_001.parts[n5].metadata.cost`: usd 50, government-fee, original source/date/note | **Missing presentation**; old `StepCostChip` renders this object |

`components/shared-processes/SharedProcessReader.tsx` currently reads route, approval,
risk, reversibility and jurisdiction annotations, but does not render cost, verification,
failure modes, documents or artifact I/O. The legacy renderer uses
`components/StepVerifyCost.tsx`; legacy header fees use `knownCostUsd()` in
`lib/processes.ts`, after default-view filtering. No renderer edits are included here.

Cost scope matters: the $50 certificate object says the certified copy is optional,
plus $2/page, while the plain stamped copy is included. The $5.55 USPS annotation has
postage/receipt caveats. These notes are preserved, not flattened into a complete
budget. The $500 Atlas bundle and $427 Clerky method are vendor prices and do not
enter the legacy government-fee headline; the $819 package remains authored prose.
The conditional CA $100 fee stays at `jca1`, outside the default-view total. UK GBP
fees and variable German notary fees retain `usd: null` and their exact notes; no
exchange rate, currency/range schema, current-price claim or fabricated total was added.

## Executed changes and validation

- Restored only `import-manifest.json.records.form_001.generatedHash` from
  `8ee4e3ea…fad49` to `fb912e86…62540`. The generated baseline uses the record's retained
  source revision `8d448bd91`; the source hash and canonical authored bytes are unchanged.
- Added an importer regression using the real committed receipt and formation record.
  A subsequent legacy description change must produce a conflict and leave every
  catalog file untouched. The regression was also run against the original receipt:
  it failed because the importer allowed an overwrite; the repaired receipt passes.
- The original reconciliation used a bounded comparison with generated source. That
  historical acceptance command was removed after subsequent authored content made
  the comparison obsolete. Current validation uses `pnpm shared:check`,
  `check-import.py`, and the importer preservation tests.
- `pnpm shared:import` equivalent (`python3 .../import.py --write`) executed twice:
  no pending source changes; all 166 catalog/audit/manifest JSON files byte-identical.
- Two independent fresh generations from the pinned source are byte-identical.
- `pnpm shared:check`: 162 records, schema/catalog/graph references valid.
- `check-import.py`: 16,441 source-value checks; negative changed-value check passes.
- Python importer suite: nine tests pass, including authored-conflict/no-partial-write safety.
- Full `pnpm test`: **265 files, 2,875 tests pass**, including artifact/document/business-logic
  registry references, graph, shared preview and ranking checks.
- `pnpm build`: succeeds; 7,117 static pages generated. TypeScript succeeds.
- `pnpm lint`: zero errors, 16 existing warnings. `git diff --check` passes.

Raw logs and preservation receipts are in the sibling `../evidence/` directory.
No UI was changed, so screenshots are acceptance inputs, not claims of new visual behavior.

## Remaining gaps and delivery boundary

The **18 downstream geographic applicability findings remain unresolved**. Country
classification does not author option-specific downstream applicability. The source
still provides no basis to add those connections or apply another region to all steps.
Six standalone legal decisions still lack graph placement. Neither gap was guessed away.

The next presentation task can consume the already-preserved same-scope metadata and
external registries to address the screenshot examples. It must preserve source dates,
conditional/default/method boundaries, optional-fee caveats and external registry identity.
Documents have no legacy default display either; source preservation does not imply UI parity.

Local branch: `codex/legacy-process-migration-2026-10-02` in this task's isolated
`migration/` checkout, based on verified `ff3ee5464`. Existing UI/production repair
worktrees were not modified. No push, PR, merge or deployment was performed.
