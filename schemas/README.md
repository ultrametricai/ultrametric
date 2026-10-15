# Schemas

The published JSON Schema contracts every record in this repo validates against
in CI.

[`process.schema.json`](process.schema.json) publishes the canonical DAG process shape
at `#/$defs/canonical`: `schemaVersion: 1`, explicit `entrySteps`, `parts`, decision
`options`, and `links`. It is generated directly from `processDefinitionSchema` in
`lib/shared-processes/catalog.ts`. Outputs (`produces`, `producesArtifact`) and
classifications (`route`, `reversibility`) retain their existing locations within
open-ended `metadata`. Graph identity, reachability and cycle checks also run in
the catalog validators; JSON Schema describes the record structure.

The same URL continues accepting legacy process records through its
`#/$defs/legacy` alternative. Their original contract is preserved in
[`legacy-process.schema.json`](legacy-process.schema.json).
`operational-process.schema.json` describes the existing process corpus;
`shared-process.schema.json` describes the compatibility export.

Other contracts include `rule.schema.json`, `citation.schema.json` (the citation
registry's two record roles, authority and reading), and `vendor-review.schema.json`. `operational-process.schema.json` is generated from the zod
source by `scripts/generate-corpus-schemas.ts` and drift-gated byte-identical; change the
zod schema and regenerate, never the file.

Regenerate the process and corpus schemas with
`pnpm exec tsx scripts/generate-corpus-schemas.ts`. CI checks byte-identical output
and validates the canonical logo and existing legacy records.

Contribute here:

- **A field the records need** — change the zod source (for generated schemas) or the
  schema plus the validator (`lib/founderOps.ts`) together, with one real record and the
  matching blank in `templates/` in the same PR.
- **A schema for a new record type** — only alongside the contribution path that uses it:
  schema, template, validator wiring, and a first record in one PR.

Gates: `pnpm test __tests__/corpus-schemas.test.ts` and
`pnpm test __tests__/founder-ops.test.ts`.
