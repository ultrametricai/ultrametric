# Artifact object model — design review and next increments

Founder ask (2026-10-07): review the artifact data structure as committed and design the next
increments toward a full object model of the business. Everything specced here is grounded in
committed code and data; where a field would need facts or decisions the repo does not yet
hold, it is flagged as a founder decision rather than added.

## The model as committed

The artifact layer is a **type registry**, not an instance store. One record per canonical
business object (`processes/artifacts.json`, zod source `ArtifactSchema` in
`lib/processes.ts`):

| Field | What it is | Where it is enforced |
| --- | --- | --- |
| `id`, `label`, `description` | The object's identity and committed prose | schema + duplicate-id check |
| `producedBy` | The one canonical producer process | `lib/__tests__/processArtifacts.test.ts` (one-producer rule) |
| `alsoProducedBy` | Documented exception producers | same suite (every exception really tags the birth step) |
| `terminal` | Nothing downstream consumes it | consumed-or-terminal XOR test |
| `documents` | Registered open templates the object is executed on | referential integrity + sparseness band |
| `geo` | Per-country analog objects (label, kind, official URL) | geo band + actionUrl-reuse tests |

Joins outward from the registry:

- **Corpus**: every process carries typed `produces`/`requires` arrays and pins the exact
  birth step with node-level `producesArtifact`. `lib/processDeps.ts` builds the
  company-level dependency DAG from these edges, derives the topological ordering, reports
  curated-timeline inversions (`docs/TIMELINE-INVERSIONS.md`) and placement slack, and feeds
  the process pages' Produces table and the artifact pages' producer/consumer links.
- **Company fields**: `processes/company-fields.json` names the typed data values an
  artifact establishes (the charter sets the authorized shares and par value, the 409A
  report sets the common FMV and its as-of date) and the exact `lib/openstartup/` function
  parameter each value enters. Rendered both ways (`/artifacts/[id]`, `/open-modules/[id]`),
  totality-tested in `lib/__tests__/companyFields.test.ts`.
- **Documents**: `open-documents/registry.json` ids, resolved through `lib/documents.ts`;
  template families render as one object with variants.

The invariants live as tests, not prose: acyclicity, resolvable edges, no self-requires,
set-equality between a task's `produces` and its tagged nodes, and drift gates on every
derived report.

## What the model deliberately is not, yet

- It has **types, not instances**. No record says "Acme's 409A, as of this date". The site
  is static and the repo bans real company data (fixtures are fictional by gate), so
  instances cannot live here.
- It has **existence, not state**. An artifact is born at its pinned step and optionally
  terminal; nothing distinguishes drafted from executed from filed from expired.
- It has **no clocks**. `lib/openstartup/deadlines.ts` and `grant409aSanity.ts` compute
  windows and staleness, but no registry field says which artifact a clock attaches to; the
  only committed join is indirect, through company fields (`409a-valuation-date` →
  `fmvAgeCheck`).

## Increment 1 — lifecycle states

**Grounding.** The corpus already encodes the state transitions where they matter: the
reversibility doctrine (processes/README.md) distinguishes the signed-but-unfiled 83(b)
(reversible) from the filed one (irreversible), and separate draft / sign / file steps exist
in the incorporation and fundraising DAGs. The states are in the step graph; the registry
just does not name them.

**Design.** A lifecycle is a per-artifact, optional vocabulary whose every transition is
pinned to a committed corpus step, the same way the birth already is:

```jsonc
// processes/artifacts.json (proposed, optional)
"lifecycle": [
  { "state": "signed", "at": { "task": "form_001", "node": "n8a" } },
  { "state": "filed",  "at": { "task": "form_001", "node": "n8" } }
]
```

Rules: `producesArtifact` stays the birth (the first state); every `at` must resolve to a
real node of a producer process; a state with no committed step does not ship. The page
renders the chain as labeled anchors into the producer DAG.

**Founder decisions.** The state vocabulary itself (draft / executed / filed / expired /
superseded is a plausible core), and which artifacts deserve multi-state treatment at all.
Most SaaS-account artifacts have one state and should keep a bare registry record.

## Increment 2 — renewal and expiry clocks

**Grounding.** `deadlines.ts` already computes the recurring compliance clocks
(`deFranchiseTaxDue`, `form1120Due`, `form941Due`, `election83bWindow`,
`complianceCalendar`), each citing a dated rule card and flagging `needsReview` where the
true legal date can differ. `grant409aSanity.fmvAgeCheck` and `refreshTriggerChecklist`
compute the 409A staleness window from `fmvAsOf`. The company-fields join already carries
the inputs: `409a-valuation-date` is established by the `409a-valuation` artifact and
consumed by both functions.

**Design.** Reuse the company-fields join shape rather than inventing a parallel one:

```jsonc
// processes/artifacts.json (proposed, optional)
"clocks": [
  { "module": "grant409aSanity", "function": "fmvAgeCheck", "kind": "staleness" }
]
```

Validation mirrors `companyFields.test.ts`: the function must be a real export, and every
input it needs must be a committed company field this artifact (or its producer chain)
establishes. The artifact page then renders "goes stale: computed by
`grant409aSanity.fmvAgeCheck`" with the module link, display-only.

**Groundable today**: the 409A staleness clock, and the 83(b) filing window
(`election83bWindow` from `stock-transfer-date`). **Founder decisions**: insurance renewal,
registered-agent renewal, SOC 2 period lapse — each needs a dated rule card or a published
source first; the repo's posture is `needs_review` over a guessed date.

## Increment 3 — versioning (the 409A goes stale; the module knows)

**Grounding.** The corpus already treats refresh as process reality: `fund_003` (409A) sits
in the follow-on chain, `qs_052`/`qs_053` update and audit the cap table, and
`refreshTriggerChecklist` encodes the events that end a 409A's presumption early. The
`provenRuns` field established the repo's pattern for instance-shaped data: schema-ready,
shipped empty, no fabricated records.

**Design.** Keep the registry as the type layer; publish an **instance record** schema for
consumers (the sim, the CLI's saved records, the private UM API database):

```jsonc
// schema only — no instances in public git
{ "artifactId": "409a-valuation", "asOf": "YYYY-MM-DD",
  "supersedes": "<prior instance id>", "fields": { "common-share-fmv": 12.34,
  "409a-valuation-date": "YYYY-MM-DD" } }
```

Versioning is the `supersedes` chain; staleness is never stored, always recomputed by the
module that owns it from the instance's field values. Field keys are
`processes/company-fields.json` ids, so an instance is exactly "the values this artifact
establishes, as held by one company at one time". Public git owns the schema and the type
layer; instances stay in the API database per the shared-content split.

## Increment 4 — per-country object variants

**Grounding.** `ArtifactGeoNoteSchema` landed with `label` naming the analog object (the
EIN's UK analog is the UTR), `kind` read at the artifact level, and every `actionUrl`
reused from a committed corpus geoNote. The cross-link audit found the limit: non-US
templates are registered (`uk-model-articles`, `seedlegals-seedfast`, `bsa-air`,
`100x-isafe`, the Cooley UK/SG packages) but cannot be mapped without muddying the US
artifact's Document section, so they stay unmapped.

**Design.** Two additive moves make the variants first-class without new ids:

1. optional `documents` on the geo entry itself (per-country template ids, validated
   against the open-documents registry like the top-level field);
2. country filtering of the Document section on `/artifacts/[id]`, the same one-store geo
   idiom the page already uses for the "Outside the US" block.

**Founder decision.** Whether analogs ever become their own artifact ids (a `utr` record).
Under the one-producer rule that requires a committed non-US producer process first; until
a country's process corpus is deep enough to produce them, the label-on-entry model is the
right size.

## Increment 5 — what the sim and the CLI need from the model

**Grounding.** The simulator seam is already documented in `lib/processDeps.ts`: derive the
run from the dependency graph — seed with processes whose `requires` is satisfied, unlock
each process when its full `requires` set is produced, let a skipped process visibly block
its consumers. The missing input it names is a **held-artifacts seed set** ("I already have
an LLC"). The CLI's posture (docs/SIM-UM-CLI.md) is guide-plus-saved-records; it executes
nothing.

**Design, in dependency order:**

1. **Held-artifacts seed**: a plain `Set<artifactId>` input to the sim composition — no
   schema change, unblocks the documented seam.
2. **Instance records** (increment 3) as the CLI's saved-record shape, so "mark the EIN as
   obtained" writes a typed instance instead of free text.
3. **Completion writes fields**: finishing a process yields the company-field values its
   artifacts establish; `runway.ts`, `deadlines.ts`, and `grant409aSanity.ts` then compute
   from the company state with zero new math.

All of it stays propose/display-only under `governance/AGENT_POLICY.md`: the model orders
and checks work; it authorizes nothing.

## Adjacent seams from the cross-link audit (smaller, independently shippable)

- Process pages render the Produces table but not a Needs surface;
  `components/ArtifactChips.tsx` computes and deliberately drops the `needs` row — whether
  to show it is a founder call on page weight.
- `/open-documents` has no back-link to the artifact a template is the form of, or to the
  citing steps; the join exists in data both ways.
- `open-modules/README.md` and the `/open-modules` index carry no generated "company data"
  line beside the Serves line; the generator pattern
  (`scripts/generate-business-logic-serves.ts`) extends directly.
- Several mapped modules (`election83b`, `vesting`, `optionTax`, the round/waterfall
  family, `payrollTax`, `convertibleNote`) consume values their signatures name but no
  committed company field carries yet (the option grant's strike price is the clearest);
  each addition is a curation call under the existing field-count band, honest-derivation
  rule unchanged.
- The Series A term sheet template is step-cited (`fund_002/n1`) but no term-sheet artifact
  exists; it becomes one only if a committed process genuinely consumes it (the pulled-term-
  sheet situation reacts to it, but reacting is not a typed `requires`).
