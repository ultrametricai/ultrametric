# Templates

Blank, schema-valid starting points to copy when contributing a new workflow or
vendor review, so nobody reverse-engineers an existing record.

`canonical-process.json` starts a canonical process definition
(`open-processes/<slug>.json`, the authoring surface behind the corpus and chain
projections — see CONTRIBUTING.md §5), with the step-level `geoResolutions` field shown;
`process.json` starts a jurisdiction-scoped workflow; `vendor-review.json` starts a
hands-on vendor review. Copy one, narrow the applicability, cite a source for every legal
assertion, and (for workflows) include a fictional fixture (`open-processes/fixtures/`).

Contribute here:

- **Keep the blanks valid** — when a schema in `schemas/` gains a field, the matching
  template gains it too, still blank and still valid.
- **A new template** — when a record type gets a contribution path, add its blank here.

Gates: `pnpm test __tests__/founder-ops.test.ts __tests__/corpus-schemas.test.ts` (the
canonical blank is schema-pinned there).
