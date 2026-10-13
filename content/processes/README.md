# Shared process source

These records are the additive successor to the operational corpus, chains, and jurisdiction workflows. Existing pages and manifests keep their current loaders. `lib/shared-processes/load.ts` is the opt-in reader.

Edit one JSON file per record under `records/`. Guidance and notes support Markdown. A record can be a situation or a process; the importer does not infer that a legacy chain is a situation. Outcomes describe useful results. `when` is optional prose applicability, interpreted by the agent. User selections and company context stay in API memory.

Parts have stable IDs and contain a step, a reference to another record, or a decision with options. A connection uses `from`, `to`, and optionally `option` and `when`. `option` must belong to its source decision. Later branch connections can rejoin ordinary parts. A referenced process supplies its own graph. Options can also contain local parts and connections. The validator rejects unresolved process references, duplicate identities, invalid option connections, and graph/nesting cycles. It does not evaluate conditions or execute work.

Notes use `{ "text": "...", "references": [] }`; references are optional. They can explain evidence, uncertainty, exceptions, or UM opinions. URLs use `url`, `title`, and `description`, with a retained reference role. Null means a migration value is unknown. Favicons are generated presentation data. Review-status and runtime-state fields are excluded.

`metadata` preserves temporary legacy annotations. It is not included in API instructions. Unverified operation strings are retained only in `legacy-audit.json`. Six standalone legal decisions remain in metadata because the source does not specify their graph position. No decisions, outcomes, vendor claims, or instructions are invented during import. Source provenance is optional for new records. It identifies copied content, not factual support.

The manifest’s `generatedHash` records generated output. Authored records retain that baseline so the importer can detect conflicting source changes. The reconciliation audit is retained in [the migration report](../../docs/PROCESS-MIGRATION-2026-10-02.md).

## Commands

- `pnpm shared:import` imports new or unedited generated records from committed legacy sources. Commit legacy edits first: unstaged, staged-but-uncommitted, and untracked source files are rejected. The importer reads the pinned Git tree so the recorded revision and values agree. It preserves authored edits; if their legacy source changes, it reports conflicts before writing any file. Removed source records also require reconciliation.
- `pnpm shared:check` validates the catalog, schema, and legacy source drift.
- `python3 scripts/shared-processes/check-import.py` checks full value preservation against a fresh migration in a temporary directory. CI runs this check without modifying or comparing authored catalog records to the legacy baseline. Authored guidance, outcomes, notes, and graph changes remain allowed. The catalog validator separately rejects legacy `toolCall` and `functionCalls` fields, including inside metadata.
- `pnpm exec tsx scripts/shared-processes/check.ts --write-schema` updates the JSON Schema generated from the TypeScript source.
- `pnpm shared:export --output /path/to/catalog.json` exports a committed, validated catalog with its Git revision, JSON Schema, and content hash. It also rejects a committed JSON Schema that differs from the TypeScript definition, using the same consistency check as `shared:check`.
- Add `--example` to export only the two synthetic staging records in `content/processes/examples/staging.json`. They demonstrate option branches, a nested process, and a shared downstream step. They are excluded from the real catalog and current site.

The initial mapping contained 149 records, 694 operational nodes and 522 original connections;
the catalog holds 162 records as of 2026-10-01 (the 12 reactive situations included). The audit lists missing outcomes, guidance, vendor keys, and placement questions. A valid mapped record is not automatically a useful published guide.

Private UM additions live in the API database. They refer to these record/part IDs and exact target content hashes. API publication assembles public guidance and specific private versions without an LLM rewrite. The public export contains no private additions. Production promotes the exact prepared artifact after staging validation.

## Preview explicit defaults

The additive process preview makes 38 legacy base methods explicit default options in
36 records, preserving their 97 alternatives, links and all incoming metadata. Integration
uses stable record/part IDs; it retains all 162 records including reactive situations.
The approved formation chooser guidance is an authored amendment. See
`default-options-audit.json` and `../../docs/PROCESS-UI-RELEASE.md`.
