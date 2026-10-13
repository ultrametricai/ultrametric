# Schemas

The published JSON Schema contracts every record in this repo validates against
in CI.

`process.schema.json` (jurisdiction-scoped workflows), `operational-process.schema.json`
(the process library), `rule.schema.json`, `citation.schema.json` (the citation
registry's two record roles, authority and reading), and `vendor-review.schema.json`. `operational-process.schema.json` is generated from the zod
source by `scripts/generate-corpus-schemas.ts` and drift-gated byte-identical; change the
zod schema and regenerate, never the file.

Contribute here:

- **A field the records need** — change the zod source (for generated schemas) or the
  schema plus the validator (`lib/founderOps.ts`) together, with one real record and the
  matching blank in `templates/` in the same PR.
- **A schema for a new record type** — only alongside the contribution path that uses it:
  schema, template, validator wiring, and a first record in one PR.

Gates: `npx vitest run __tests__/corpus-schemas.test.ts` and
`npx vitest run __tests__/founder-ops.test.ts`.
