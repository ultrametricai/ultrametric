# Incorporation showcase content

The `form_001` record now contains actionable task briefs for its 12 top-level
parts, four existing German substeps and six existing options. The briefs cover
inputs, consequential checks and a concrete handoff while preserving the
distinction between preparation, signing, submission and acceptance. No new
steps, dependencies, vendors, timings or automation capabilities were inferred.

The exact copy, target identities, applicability and source URLs are in
`INCORPORATION-SHOWCASE-COPY.json`. Sources were checked on 2026-10-02. The content
is based on main `b58d847cc`, including its newer formation-document references.
Those references, all existing metadata, scores/associations, graph connections,
IDs and copied-source provenance are retained. The manifest's generated baseline
was recalculated for the newer legacy source before authoring; the authored
record was not re-blessed as generated.

## Preview integration

The UI integration owns the presentation contract:

- `part.metadata.previewContext: {decision: "n4", option: "default"}` binds the
  reviewed Delaware/US sequence to the explicitly selected Delaware option.
- `part.metadata.previewBriefs: [{vendor, guidance}]` selects the complete
  provider-specific brief by exact vendor reference ID. The authored `n8` variants
  use `stripe_atlas` and `clerky`; unmatched providers retain the neutral core.
- Foreign filing descriptions remain on their actual `n4` options; German
  substeps remain inside `germany-notary-gmbh`. No foreign option establishes a
  complete adapted downstream process.

Atlas's brief conditionally confirms service handling before tracking its proof
of filing. Clerky's brief describes its pre-filled form and filing instructions,
then establishes who submits. Neither a provider selection nor a signed election
means the IRS filing has happened. Both retain the transfer-date/deadline and
evidence checks. No self-mailing state is invented.

These bindings are **preview presentation metadata**, not a new typed canonical
API instruction contract. Metadata is excluded from API instructions. Explicit
API applicability and provider-instruction composition need a separate contract
before this preview behavior can be claimed for API execution. Hiding unadapted
steps indicates the scope of reviewed content, not legal inapplicability.

## Validation and integration limits

- Catalog/schema/reference check: 162 records passed; importer reports no drift.
- Shared-process tests: 17 passed with one worker.
- Python importer tests: 9 passed, including the authored-guidance conflict guard.
- Importer run twice against a temporary copy: all 166 catalog JSON files stayed
  byte-identical; no record changes.
- Field preservation check: 16 parts, six options and two provider variants;
  original references, graph, source provenance and all unrelated fields retained.
- `git diff --check` passed. Production build and visual/provider-selection checks
  belong to the UI integration worker; none were run here.

The obsolete migration acceptance command has been removed. The current catalog
validator, source-preservation check and importer regression tests validate
authored content and its import baseline.

Imported metadata is retained as requested and is not newly verified by this
authoring pass. Previously reported issues remain: the legacy general entity
search is not the dedicated availability checker or a good-standing check;
certificate-copy claims about every bank/investor are too broad; and the graph
does not capture the 83(b) eligibility decision or actual transfer date. The new
briefs use the checked sources and conditional language rather than repeat those
claims. Existing metadata must not be presented as newly verified guidance.

The 18 previously reported downstream geography findings remain unresolved by
country classification or this scoped presentation treatment.

## Integration corrections to visible verification metadata

On 2026-10-02, the preview integration corrected the exposed `verify` fields on
`n3`, `n4/default` and `n5`, and the overbroad replacement-copy claim in
`n5.failureModes`. The dedicated name-availability result is distinguished from
name reservation; filing acceptance uses the returned Filed endorsement; and
certified-copy/good-standing requirements depend on the recipient. The old
general entity-search link remains a source reference, not the verification test.
The legacy corpus, raw migration audit, record source provenance and generated
manifest baseline remain unchanged.

Checked primary sources:
- https://corp.delaware.gov/howtoform/ (name reservation, submission, recipient-specific copies)
- https://icis.corp.delaware.gov/Ecorp/NameReserv/NameReservation.aspx (dedicated availability service)
- https://corp.delaware.gov/onlinestatus/ (status checks do not issue a good-standing certificate)
- https://delcode.delaware.gov/title8/c001/sc01/index.html (filing endorsement and effectiveness)

These narrow corrections supersede the corresponding retained-metadata caveat
above. They do not re-verify every imported metadata field or add graph state for
83(b) eligibility, transfer date, or confirmed service handling.
