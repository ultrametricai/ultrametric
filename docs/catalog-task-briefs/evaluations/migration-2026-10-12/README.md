# Support migration: interrupted control and standalone UM evidence

This bundle preserves the October 12, 2026 case prompted by **“our support tool is shutting down. help us move”**. Control `sit_012-02` was interrupted by an accounting-telemetry guard. After read-only reconciliation, fresh standalone UM `sit_012-03` completed with the same inputs and caps. This is not a completed matched pair. The earlier `sit_012-01` stopped before runtime startup because its output directory already held source-review files.

Both delivered working local archives from the same incomplete synthetic export. Control's HTML archive, audit and staging preserve the available source bytes; UM's SQLite archive additionally exercises backup/re-export and per-record recovery checks. Independent replay verifies these narrower local results. The missing screenshot stays missing, destination permission/email behavior remains untested, and no real support migration or cancellation occurred. The interrupted control is not treated as a guide or quality failure.

Read [the independent review](independent-outcome-review.md), [metadata](metadata.json), [actual messages](transcript.json), [deterministic checks](independent-checks.json), and [source inventory](independent-source-checks.json).

- [Inputs](inputs/) retain the seven original synthetic files.
- [Interrupted control workspace](arms/without-um/) retains every final source/output file.
- [Completed standalone UM workspace](arms/with-um/) retains every final source/output file, including both SQLite databases.
- [Manifest](artifact-manifest.json) covers every file except itself and provides original reconstruction paths. Python/HTML filenames gain `.txt` for inert storage; their bytes are unchanged.

UM naturally discovered and opened the unpublished `sit-012` preview version 2 from candidate revision `110ff2631ac0adf37f5325c123391af643a4a7c5`. The local 71-mapping catalog includes seven newly exposed standalone mappings and is not an exact production-visibility test. Marketplace installation and production publication were not exercised.

Its `save_update` failed with `MCP tool call requires approval, but approval policy is never`. This is a harness denial before persistence. No successful save/readback, company-memory improvement or cross-agent reuse is claimed. Approval settings remained unchanged for these attempts.

The prospective limits were 1,600,000 gross tokens, 20,000 output tokens, 600 seconds and four factual continuations per arm. The case was author-visible, control first and operator-inspected before UM. It was not blind or randomized; no scalar quality score or causal improvement claim is assigned. Vendor prices remain provisional performer documentation claims, not independently revalidated quotes.

For artifact replay, reconstruct each arm into a disposable workspace using the manifest's `reconstructionRoot` and `reconstructionPath`, restoring inert filenames. Run `python3 migration/prepare_archive.py --source export --output migration/replay-new` for control or `python3 migration/audit_export.py --output migration/replay-new` for UM. Both require a new output directory. UM's two JSON reports contain fresh generation timestamps; all other generated content reproduced in independent checks. Its read-only `search_archive.py` searches internal content, including private notes.

The data are fictional. Both archives include the synthetic private note; collapsed HTML and filtered SQL views do not enforce user permissions. Public reconstruction preserves file bytes, not the original filesystem access mode. One non-secret local fixture run UUID remains inside UM's unchanged original README; transcript and metadata identifiers are curated. No personal account/configuration, credentials or numeric account telemetry is included.
