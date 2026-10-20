# Shared process history

Canonical definitions are authored in [`open-processes/`](../../open-processes/README.md).
The import manifest here records the historical migration and its original source
receipts. It is not a runtime input or an editable copy of the canonical definitions.
The synthetic examples remain available for schema tests and `shared:export --example`.

Use `pnpm shared:check` to validate the canonical catalog and its generated projections.
Private execution bindings remain outside canonical records and are pinned by consumers.
The historical CI commands `test_import.py` and `check-import.py` now run canonical
ownership/export regressions and projection drift checks. They do not import or author content.
