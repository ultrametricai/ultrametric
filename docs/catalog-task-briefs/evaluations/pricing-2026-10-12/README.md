# Pricing rollout: completed control and interrupted UM evidence

This bundle preserves the October 12, 2026 `growth_014-01` trial prompted by **“help me roll out our new pricing.”** Control completed; UM found and opened the intended unpublished candidate guide, then was interrupted by an accounting-telemetry guard. It is not a completed paired result.

Both arms created reproducible local pricing models from the same synthetic inputs. Control handles both gross/net amount interpretations across its ledger and includes a runbook. UM's partial artifact set adds a recalculable one-customer-loss scenario and month-by-month progression, but references four files that were never created. Independent copy-only checks passed the delivered arithmetic and lifecycle treatment. Artifact volume is not treated as improvement, and no scalar score is assigned.

Read [the independent review](independent-outcome-review.md) for supported differences and exact limits, [metadata](metadata.json) for candidate/runtime/resource provenance, and [actual messages](transcript.json) for the curated transcript. The [checks](independent-checks.json) include replay results and the [source checks](independent-source-checks.json) establish the frozen input facts.

- [Original synthetic inputs](inputs/) preserve the four starting files.
- [Control workspace](arms/without-um/) preserves its final source and seven outputs.
- [Interrupted UM workspace](arms/with-um/) preserves its final source, generator and seven generated outputs.
- [Manifest](artifact-manifest.json) hashes every file in this subtree except itself and provides reconstruction paths. Executable files gain `.txt`; their original bytes are unchanged.

The guide binding is unpublished repository revision `110ff2631ac0adf37f5325c123391af643a4a7c5`, `roll-out-a-pricing-change` preview version 3. This does not demonstrate production publication or marketplace delivery.

UM's `save_update` was denied by native approval policy before fixture persistence: `MCP tool call requires approval, but approval policy is never`. No save receipt/readback or company-memory benefit is claimed. Approval settings stayed unchanged. The UM interruption and four missing referenced files remain visible. No billing account/provider previews, customer messages, live price changes or website release occurred.

Both arms had the same prospective remaining-case limits: 1,600,000 gross tokens, 20,000 output tokens, 600 seconds and four factual continuations. These limits were raised equally before this case after earlier CRM interruptions; those partial cases remain recorded separately. The trial was author-visible, control first and operator-inspected before the match. It was not blind or randomized, and shared private workflow preferences are omitted from public evidence.

To replay, reconstruct a disposable workspace using each manifest entry's `reconstructionRoot` and `reconstructionPath`, restoring inert filenames. Run `python3 pricing-rollout/build_preview.py` for control or `python3 pricing-rollout/model.py` for UM. These reproduce local reports; they do not execute a billing rollout. Review the scripts and snapshot-specific assumptions before running them with changed inputs.
