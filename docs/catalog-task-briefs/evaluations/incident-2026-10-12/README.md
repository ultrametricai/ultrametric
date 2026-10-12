# Incident analysis evaluation evidence

Both arms completed useful local reviews of the fictional outage, and their analysis scripts reproduce the saved calculations. UM added a preserved evidence snapshot and separate review/workflow handoff documents. Both arms overstated post-rollback behavior in commentary; UM's final postmortem explicitly qualified the measurement overlap. Its attempted shared update save failed. See the [independent review](independent-outcome-review.md) and [checks](independent-checks.json).

This is one author-visible synthetic case, run control first on 2026-10-12 with the prompt `help us understand this outage and stop it happening again`. The operator inspected control before starting UM; the independent reviewer could see the case and guide. There are no scalar scores, holdout results or aggregate quality estimates.

## Inspect the artifacts

| Material | Control | UM-enabled |
|---|---|---|
| Incident account | [Incident review](arms/without-um/incident-review/incident-review.md) | [Postmortem](arms/with-um/incident-review/postmortem.md) |
| Proposed prevention | [Plan and runbook](arms/without-um/incident-review/prevention-plan.md) | [Plan](arms/with-um/incident-review/prevention-plan.md), [runbook](arms/with-um/incident-review/runbook.md) |
| Analysis code, inert copy | [analyze.py.txt](arms/without-um/incident-review/analyze.py.txt) | [analyze_evidence.py.txt](arms/with-um/incident-review/analyze_evidence.py.txt) |
| Derived evidence | [Metrics](arms/without-um/incident-review/derived-metrics.csv), [summary](arms/without-um/incident-review/evidence-summary.json) | [Timeline](arms/with-um/incident-review/derived/timeline.csv), [metrics](arms/with-um/incident-review/derived/metrics.csv), [analysis](arms/with-um/incident-review/derived/analysis.json) |
| Review state | Included in incident review | [Review record](arms/with-um/incident-review/review-record.md), [workflow status](arms/with-um/incident-review/workflow-status.json) |
| Independent replay | [Control output](independent-control-replay.txt) | [UM output](independent-um-replay.txt) |

Each arm contains the same six original fictional source files, including [metrics](arms/without-um/incident/service-metrics.csv), [events](arms/without-um/incident/events.jsonl), [support chat](arms/without-um/incident/support-chat.txt) and [monitoring configuration](arms/without-um/incident/monitoring-config.txt). UM's [snapshot manifest](arms/with-um/incident-review/evidence-manifest.json) preserves another local copy of those sources. It does not establish export of unavailable production logs.

The [curated transcript](transcript.json) retains actual messages and factual follow-ups. Both arms received `That information is not available.` when asking about facts absent from the frozen packet. The [metadata](metadata.json) records model, candidate, guide hash, MCP outcomes, limits and resource use. The [artifact manifest](artifact-manifest.json) records original and public hashes, byte lengths, roles and reconstruction paths.

## What was established

Both packages correctly normalize New York times, calculate the supplied within-row ratios, retain competing causes, distinguish observed connection counts from capacity, and leave full impact/recovery unknown. Control labels sums as descriptive row sums rather than incident totals. UM withholds aggregate totals, preserves original timestamp/source locators and distinguishes 40 seconds between two recorded events from customer-impact detection delay.

Control's final response and review infer that errors remained elevated after rollback from a later row label. The measurement interval could include pre-rollback observations. UM's earlier commentary makes a similar inference, while its final postmortem explicitly identifies possible overlap. A focused interval-boundary clarification was subsequently added to `prod_010/n2`; it has not been performer-retested. These artifacts used candidate `110ff2631ac0adf37f5325c123391af643a4a7c5`, not the later wording.

The UM arm retrieved `run-an-incident-postmortem` preview 3 and opened a process in the local fixture. Its `save_update` attempt was denied because the native session's approval policy was `never`; both its final response and saved status disclose the failure. No successful memory save or cross-agent reuse was demonstrated.

| Observed resource | Control | UM-enabled |
|---|---:|---:|
| Gross input + output tokens | 250,023 | 408,062 |
| Uncached input tokens | 52,005 | 53,008 |
| Native turn duration | 341.305 seconds | 513.139 seconds |

Gross totals include cached input and do not establish monetary cost. Additional files and proposed tests are not quality scores. Neither arm implemented a production fix, tested a service safeguard, established live recovery, obtained owner acceptance or sent a communication.

## Reconstruct a disposable copy

Python source bytes are preserved under `.py.txt` names so the public repository does not treat them as its executable code. The manifest maps original filenames. Two UM outputs replace only an ephemeral fixture run identifier: the review record and workflow status. Their original hashes and redacted public hashes are recorded separately; all other fictional source/output files are byte-identical. No native account/configuration logs are included.

From this bundle directory, this standard-library snippet verifies public hashes and reconstructs disposable arm workspaces without executing their code:

```python
from pathlib import Path
import hashlib, json, tempfile
bundle = Path.cwd()
manifest = json.loads((bundle / "artifact-manifest.json").read_text())
copy_root = Path(tempfile.mkdtemp(prefix="um-incident-evidence-"))
for entry in manifest["artifacts"]:
    if "reconstructionRoot" not in entry:
        continue
    data = (bundle / entry["path"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == entry["sha256"]
    target = copy_root / entry["reconstructionRoot"] / entry["reconstructionPath"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
print(copy_root)
```

Read the reconstructed scripts before execution. From the control copy run `python3 incident-review/analyze.py`; from the UM copy run `python3 incident-review/analyze_evidence.py`. They write only local evidence outputs and need no network or third-party packages. [Reconstruction checks](reconstruction-checks.json) confirm that both bundled copies reproduce their derived files. Production acceptance tests remain proposed prose.

This tests a local candidate MCP fixture, not marketplace installation or production availability. Both arms used `gpt-6-astra`, `xhigh`, default tier, and the same prospectively revised guard. The one-second reset metadata tolerance preserved raw values and a fixed original identity; earlier pricing/migration interruptions remain separate harness evidence. Account observation gaps and reactive monitoring limit billing attribution. Personal configuration, credentials, runtime identifiers and numeric credit balances are excluded.
