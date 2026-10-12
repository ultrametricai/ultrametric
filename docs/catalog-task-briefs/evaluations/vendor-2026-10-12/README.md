# CRM selection interrupted-run evidence

The revised control left three useful partial artifacts. The standalone UM diagnostic retrieved the guide and researched constraints but saved no deliverable. Both were interrupted at the gross-token threshold, before a final answer. This is a bounded artifact comparison, not a completed matched pair. See the [independent outcome review](independent-outcome-review.md).

The initial prompt was `help me choose a CRM for our sales team`. This author-visible synthetic case ran on 2026-10-12 with the same source packet, model and limits in separate workspaces. The UM diagnostic followed inspection of interrupted control. Actual factual questions and research paths differed; no blind scores or aggregate estimates were produced.

## What was preserved

| Evidence | Interrupted control02 | Interrupted UM03 |
|---|---|---|
| Source context | [Company](arms/without-um/company/company.json), [workflow](arms/without-um/sales/current-workflow.txt), [constraints](arms/without-um/sales/purchase-constraints.txt) | [Company](arms/with-um/company/company.json), [workflow](arms/with-um/sales/current-workflow.txt), [constraints](arms/with-um/sales/purchase-constraints.txt) |
| Actual messages | [Transcript](transcripts/without-um.json) | [Transcript](transcripts/with-um.json) |
| Saved output | [Recommendation](arms/without-um/sales/crm-evaluation/recommendation.md), [fixture](arms/without-um/sales/crm-evaluation/pilot-fixture.json), [checklist](arms/without-um/sales/crm-evaluation/pilot-checklist.csv) | No created artifact |

All original fictional inputs and actual saved outputs are byte-identical. The [manifest](artifact-manifest.json) records roles, lengths and SHA-256 hashes for every file except itself; shared parent configuration is outside its scope. The [metadata](metadata.json) records model/runtime identity, source/candidate hashes, limits, exact factual follow-ups and MCP calls. [Research navigation](research-navigation.json) preserves public web action metadata without private native logs or full third-party page copies.

## Observed usefulness and gaps

Control's relationship fixture matches the source identifiers, stages, owners and historical dates. Its quote hash is correct, and it marks the fixture's TXT quote as insufficient to establish real PDF recovery. The checklist contains eight unrun acceptance checks. The recommendation favors a pilot and retains uncertainty about costs, import behavior, complete exports and intended assistant access. It is partial work without a final completion claim. See [control checks](independent-control-checks.json).

UM read `vendor-011` preview 2, matching instruction SHA-256 `1c62d7d11ab80eddf28c1cede92a318baa7dba37f33c97cecf4878a943253c2f`. It also read context and public UM evidence. Commentary identified relevant relationship, plan and export concerns, but no comparison table, test fixture or recommendation artifact was saved. No guide-wide failure or aggregate value conclusion follows from this one bounded interruption.

Both runs leave actual import/export, relationship reconstruction, attachment-byte recovery, permissions, assistant updates, vendor usability and full cost verification unresolved. No vendor account was created, email connected, data uploaded or purchase made. [Independent source checks](independent-primary-source-checks.json) document the official pages reviewed and the limits of documentary evidence, including the old update date on the control's Zoho pricing source.

| Observed resource | Interrupted control02 | Interrupted UM03 |
|---|---:|---:|
| Gross input + output tokens | 801,521 | 809,324 |
| Uncached input tokens | 68,507 | 82,378 |
| Output tokens | 8,534 | 6,050 |
| Native start-to-interrupt receipt interval | About 348 seconds | About 259 seconds |
| Saved performer artifacts | 3 | 0 |

Both had thresholds of 800,000 gross tokens and 20,000 output tokens, with 600 seconds allowed. Reactive monitoring permits threshold overshoot. Gross totals include cached input; these are not monetary cost or quality scores. Elapsed intervals come from native event receipts, since the collector's completed-turn timer excludes interrupted turns.

## Protocol and later guide boundary

The [attempt history](prior-attempts.json) retains an earlier browser/public-search policy interruption separately. Fresh v2 allowed equal authorized public research for both arms. Control02 was then interrupted at its cap; UM03 ran as a standalone diagnostic against the preserved control and was also interrupted. Neither is relabeled complete. Prospective cap changes for other cases do not rewrite these limits or supply a missing CRM completion.

The tested guide remained at public revision `110ff2631ac0adf37f5325c123391af643a4a7c5`. A later working-tree change makes `vendor_011` save a compact buying brief and unknown-marked requirement matrix before broad research, update it incrementally, and bound unproductive searches while retaining unresolved requirements. [Static review](guide-change-review.json) found no blocking scope or sequence issue. This wording has not been performer-retested and carries no demonstrated improvement claim.

UM created no process run and saved no update; context contained no saved runs, records or updates. This case does not validate company-memory reuse, marketplace installation or production visibility.

Raw native logs, personal instructions/configuration, account identifiers, numeric credit balances, credentials and private endpoints are excluded. The transcripts omit internal item IDs; source and output files required no redaction. Metadata is curated, and the full private performer runtime is not reproduced. No new performer call or original-output edit was made for this review.
