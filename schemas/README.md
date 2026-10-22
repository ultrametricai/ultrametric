# Schemas

These are the published JSON Schema contracts that the process, citation,
law-map, company-field, artifact, and vendor-review records validate against in CI. The rankings
data (`open-rankings/`) has its contracts in zod (`lib/schemas.ts`).

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

Law rules (`open-law/<CODE>/*.json`) validate against the in-code contract
(`RuleCardSchema` in `lib/founderOps.ts`) rather than a published schema file; the
validator also runs the semantic checks a schema cannot (sources resolve to primary
authorities, jurisdictions registered, review dates ordered).

Other contracts:

- `citation.schema.json` — the citation registry's two record roles, authority and reading.
- `vendor-review.schema.json` — the vendor reviews in `open-rankings/reviews/`.
- `law-map.schema.json` — the domain map over the law rules (`open-law/map.json`).
- `coverage-index.schema.json` — the cross-area coverage rollup (`coverage/index.json`).
- `process-vendor-registry.schema.json` — the vendor facts beside the corpus
  (`open-processes/vendor-registry.json`).
- `process-artifacts.schema.json` — the artifact registry (`open-artifacts/registry.json`).
- `company-fields.schema.json` — the typed company-field standards
  (`open-artifacts/fields.json`).

`scripts/generate-corpus-schemas.ts` generates `process.schema.json`,
`operational-process.schema.json`, `process-vendor-registry.schema.json`,
`process-artifacts.schema.json`, and `company-fields.schema.json` from their zod sources
(`lib/shared-processes/catalog.ts`, `lib/processes.ts`, `lib/companyFields.ts`), drift-gated
byte-identical; change the zod schema and regenerate, never the files.

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

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
