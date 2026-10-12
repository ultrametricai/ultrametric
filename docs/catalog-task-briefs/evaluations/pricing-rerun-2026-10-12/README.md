# Pricing rerun evidence

The two native performers completed local pricing packages with correct baseline calculations. The UM package adds invoice schedules, held-account scenarios and an execution ledger, while its model fails a changed-notice reuse check. Read the [independent review](independent-outcome-review.md) for the comparison and concrete defect.

This is a **completed-native output comparison with a post-completion controller timeout**. The UM native turn completed before the wall guard fired; the interrupt found no active turn. Original `completedMatchedPair: false` and controller `finished: false` flags remain unchanged. [Classification evidence](evidence-classification.json) records the ordering. Campaign reporting remains six clean matched cases plus this comparison, not a clean seventh harness pair.

## Evidence

- [Control package](arms/without-um/rollout/README.md) and [UM package](arms/with-um/pricing-rollout/decision-brief.md): actual frozen outputs, with preservation details below.
- [Metadata](metadata.json): exact prompt, model/runtime/source versions, guide hash, actual factual follow-ups, resources, tool activity and boundaries.
- [Curated transcript](transcript.json): actual user and assistant messages; local links rebased and internal message identifiers omitted.
- [Independent checks](independent-checks.json): baseline reproduction, notice sensitivity and the reproduced reuse failure. Check counts describe assertions, not quality scores.
- [Reconstruction checks](reconstruction-checks.json): replay of both models reconstructed from this public archive.
- [Artifact manifest](artifact-manifest.json): source/output hashes and exact filename reconstruction mappings.
- [Original pricing attempt](../pricing-2026-10-12/README.md): preserved separately, including its interrupted UM arm and limits.

The case is fictional and author-visible, with control first and operator inspection before the matched UM arm. The rerun used fresh equivalent workspaces, fresh empty synthetic organizations, the same short prompt and source files, and candidate revision `110ff2631ac0adf37f5325c123391af643a4a7c5`. No revised guide was supplied. Both arms received identical prospective workload limits and the repaired accounting monitor. No real rollout, billing operation, notice delivery, checkout verification or customer result was established.

UM naturally opened the pricing process; its returned version-3 instructions match the pinned candidate. Both progress-save attempts were denied by the native approval policy. Local outputs disclose that failure. This evidence does not demonstrate saved company memory, cross-agent benefit, marketplace installation or aggregate causal improvement.

## File preservation and reconstruction

The `inputs/` directory contains the four original fictional inputs. Each arm also contains its unchanged source files and delivered outputs. Python files have a `.txt` suffix to keep the archive inert. Their bytes are unchanged. The manifest gives `reconstructionRoot` and `reconstructionPath` for every archived source/output file.

One UM status document is a marked derivative: `arms/with-um/pricing-rollout/sources-and-status.md` replaces the ephemeral synthetic execution UUID with an explicit omission marker. The manifest records both original and public hashes. No other source/output content was changed. Curated metadata and transcript omit raw native logs, private configuration, account identifiers, numeric credit balances, account-usage telemetry, credentials and absolute user paths.

For deterministic replay, copy one arm into a temporary directory and restore the `.py.txt` filenames to the manifest's `.py` paths. Read the scripts first, then run from that copied workspace:

```sh
python3 rollout/build_preview.py --notice-date 2026-10-12
```

or, for UM:

```sh
python3 pricing-rollout/model.py
```

The control regenerates two CSVs and a JSON summary; UM regenerates seven CSVs and a JSON summary. Both baseline sets reproduce byte for byte. Relative links in the raw Markdown resolve against reconstructed filenames. The status-document redaction does not affect either model.

Control accepts alternate notice dates through its command-line option. UM embeds its date as a code constant and asserts the fixture's original dates. Changing that constant can write revised CSVs before failure, leaving a stale summary. Use a fresh disposable copy for such experiments; do not interpret failed or mixed-version output as verified. Both packages require manual policy and narrative refresh and have fixed forecast horizons.
