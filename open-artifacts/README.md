# Open artifacts

The business objects founder processes produce and consume: the certificate of
incorporation, the EIN letter, the cap table, the 409A report.

Two registries live here:

- `registry.json` — the artifact registry: every canonical business artifact, its one
  producer process, and its per-country analogs.
- `fields.json` — the field standards: the typed company-level data values those artifacts
  establish (the EIN, the incorporation date, the file number), each with its format,
  defining authority, and geo dimension.

Both moved here from `open-processes/`; the process side of the contract (`produces` /
`requires` on each process, node-level `producesArtifact`) stays in the corpus, documented in
[`open-processes/README.md`](../open-processes/README.md) ("The artifact layer"). Rendered
live at [ultrametric.ai/artifacts](https://ultrametric.ai/artifacts) and
[ultrametric.ai/fields](https://ultrametric.ai/fields).

## The artifact registry

Each `registry.json` entry: `id`, `label`, `description`, `producedBy` (the one canonical
producer process), optional `alsoProducedBy` (documented exception producers), optional
`terminal: true` (nothing downstream consumes it), optional `documents` (registered
open-documents templates that genuinely are the artifact's form), and optional `geo`
(per-country analogs derived from the committed process geoNotes). The registry is sized from
the corpus itself: an artifact exists because a committed process step brings it into
existence and another committed process consumes it. `lib/processes.ts` (`loadArtifacts`)
reads it back, `lib/processDeps.ts` builds the cross-process dependency graph from it, and
the integrity rules (totality, one producer, consumed-or-terminal, geo URL reuse) are tested
in `lib/__tests__/processArtifacts.test.ts`. Published schema:
`schemas/process-artifacts.schema.json`. The qualification rules and the how-to-add recipe
stay with the process-side contract in `open-processes/README.md`.

## The field standards

A field exists in `fields.json` only because a committed registry artifact establishes it
(`producedBy`) and committed code or a committed corpus process consumes it: either a
`lib/openstartup` exported function takes it (`consumedBy`), or the establishing artifact
rides real corpus `requires` edges. Each field carries its `spec` (format sentence, regex
`pattern` where the authority's format is strict, the authority's own `example` where one
exists, the assigning authority, where the value appears, and fetch-verified source URLs).
`lib/companyFields.ts` reads it back; the gates live in
`lib/__tests__/companyFields.test.ts`; published schema:
`schemas/company-fields.schema.json`.

### The geo dimension

Each field's `geo` records where the value is defined. Company-record values (the bank
balance, the ledger run rate, the cap-table counts) carry `scope: "universal"`: the field is
the same everywhere. Jurisdiction-bound values carry a base US instance plus one entry per
covered country (UK, IN, DE, FR, PT, CA), each either a government-defined equivalent
(label, authority, `pattern` only where the authority documents the format, authority-page
sources) or a recorded absence: `no-equivalent` where the concept does not exist there
(CBCA shares carry no par value), `unverified` where the authority's page could not be
fetch-verified when curated (mca.gov.in and incometaxindia.gov.in are bot-walled). Sources
are the authority's own pages, fetched when curated, or committed corpus geoNote URLs
reused.

| Field | Defined by | Geo variants |
| --- | --- | --- |
| Date of incorporation | Delaware Division of Corporations | UK Companies House certificate; IN SPICe+ certificate; DE Handelsregister entry; FR RCS (Kbis); PT Registo comercial; CA CBCA certificate |
| Fiscal year end | Internal Revenue Service | UK accounting reference date; IN financial year (April to March); DE Wirtschaftsjahr; FR unverified; PT unverified; CA tax year (first T2) |
| Founder stock transfer date | Internal Revenue Service | UK date of acquisition (section 431 window); IN, DE, FR, PT, CA none |
| Authorized shares | Delaware Division of Corporations | UK none (statement of capital instead); DE none (fixed Stammkapital); IN, FR, PT, CA unverified |
| Par value per share | Delaware Division of Corporations | UK nominal value; DE Nennbetrag; CA none (CBCA section 24(1)); IN, FR, PT unverified |
| Issued shares | Company records | Universal |
| Total gross assets | Delaware Division of Corporations / IRS | None in the covered countries |
| Fully diluted shares | Company records | Universal |
| Unissued option pool | Company records | Universal |
| Cash on hand | Company records | Universal |
| Monthly revenue | Company records | Universal |
| Monthly operating expenses | Company records | Universal |
| Revenue growth (% MoM) | Company records | Universal |
| Common share FMV (409A) | Internal Revenue Service | UK EMI valuation (HMRC); IN Rule 11UA registered-valuer FMV; DE, FR, PT, CA none |
| 409A valuation date | Internal Revenue Service | UK EMI valuation agreement date; IN registered-valuer report date; DE, FR, PT, CA none |
| Runs payroll | Internal Revenue Service | UK PAYE registration; IN EPF/ESI registration; DE Betriebsnummer; FR DPAE + DSN; PT Seguranca Social registration; CA RP program account |
| Employer Identification Number (EIN) | Internal Revenue Service | UK UTR; IN PAN; DE Steuernummer; FR SIREN; PT NIPC; CA business number |
| State file number | Delaware Division of Corporations | UK CRN; DE Handelsregisternummer; FR SIREN (RCS); PT NIPC; CA corporation number; IN unverified |

The table is a reading aid; `fields.json` is canonical and carries the summaries, patterns,
and source URLs the table omits.

## Extending

Add an artifact by following the recipe in `open-processes/README.md` (registry entry,
producer `produces` + `producesArtifact`, a consumer's `requires` or a `terminal` reason).
Add a field only on the committed derivation rule above, with a fetch-verified spec. Add a
geo equivalent only against the government authority's own page, fetched; record the honest
absence otherwise. Schema changes start in the zod sources (`lib/processes.ts`,
`lib/companyFields.ts`) and regenerate with `npx tsx scripts/generate-corpus-schemas.ts`.
Run `pnpm test` before opening the PR.
