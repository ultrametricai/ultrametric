# Templates

Blank, schema-valid starting points to copy when contributing a new workflow or
vendor review, so nobody reverse-engineers an existing record.

`process.json` starts a jurisdiction-scoped workflow; `vendor-review.json` starts a
hands-on vendor review. Copy one, narrow the applicability, cite a source for every legal
assertion, and include a fictional fixture (`open-processes/fixtures/`).

Contribute here:

- **Keep the blanks valid** — when a schema in `schemas/` gains a field, the matching
  template gains it too, still blank and still valid.
- **A new template** — when a record type gets a contribution path, add its blank here.

Gate: `npx vitest run __tests__/founder-ops.test.ts`.
