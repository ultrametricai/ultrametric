# Incident review: observed outcomes

Both arms completed useful local incident-analysis packages, and both analysis scripts reproduce their saved derived outputs in disposable copies. They preserve causal uncertainty, distinguish observed 100 connections from a verified capacity limit, normalize New York support times correctly, and leave customer scope, full recovery and production prevention unverified. This author-visible synthetic control-first case supports artifact-level observations; it supplies no aggregate quality estimate or blind evaluation.

## Findings

**The control overstates the immediate post-rollback behavior.** Its `incident-review/incident-review.md:9` says “The rollback did not coincide with immediate normalization,” based on the 13:25 row after the 13:23 rollback. Its final answer repeats that errors remained at 22.2% after rollback. The CSV does not define the row's measured interval: that row could include pre-rollback observations. Later row labels establish ordering of labels, not the boundaries of observed effects. Reporting the high row and the unknown interval would preserve the useful observation without inferring immediate response.

**UM's commentary has the same overstatement, but its final documents qualify it.** Commentary says “errors remained elevated and the queue kept growing after rollback.” The final postmortem timeline explicitly says the 13:25 window could overlap rollback, and the causal table retains unknown row windows and rollout completion. Its final answer does not repeat the immediate-effect claim. This is a meaningful qualification in the saved handoff, alongside an inconsistent earlier summary; it does not justify an overall factual-lift claim.

Both scripts produce correct within-row ratios: the peak supplied row is 220/525, approximately 41.90%. Control additionally reports 606/3,750 and 599/1,965 as descriptive sums of supplied rows, explicitly excluding incident-total interpretation. UM withholds aggregate totals and explicitly conditions row ratios on matching numerator and denominator scope. Both approaches retain their stated coverage limits. UM correctly labels the 40-second timeout-to-alert difference as event separation, not customer-impact detection delay.

UM adds a preserved six-file source snapshot, a normalized 18-row timeline with original timestamp/source locators, a separate runbook, an asynchronous-review record, and local workflow status. Control already supplies source hashes, derived metrics, a source-linked timeline, a runbook within its prevention plan, and substantive overload/retry acceptance criteria. More files or action items do not establish higher quality. UM's additional handoff detail also requires more review and upkeep.

Neither arm provides executable service remediation or a tested alert/deployment. Their Python scripts execute evidence processing; the cause experiments, load tests, idempotency checks and operational gates remain proposed. Their documents correctly state those boundaries. Numeric staging thresholds and role/date assignments are proposed rather than established service commitments. The scripts are tailored to this fixture; UM hardcodes the supplied support-chat date, so it is not a general incident-ingestion tool.

## MCP and completion

The control made no MCP calls. UM listed the catalog twice, retrieved `run-an-incident-postmortem` preview 3, read one synthetic company with no saved history, and opened a process in the local fixture. The independently extracted instruction hash is `ccf31bde820d62dcbca4399fb3cce963ab001e676697e47864bba65b535925ee`, matching the pinned candidate.

UM attempted `save_update`, which failed with the native error “MCP tool call requires approval, but approval policy is never.” The final response and local status accurately disclose failure. There is no successful save receipt and no demonstrated cross-agent memory benefit. Process opening occurred in a test fixture; production storage and marketplace installation were not tested.

Both native turns completed and the controller finished without stop reasons. Control used 250,023 gross tokens, 52,005 uncached input tokens and 341.305 seconds; UM used 408,062 gross tokens, 53,008 uncached input tokens and 513.139 seconds. Gross totals include cached input and are not dollar cost. The additional UM package took longer; these observations cannot isolate which differences the guide caused.

## Independent checks

The reviewer read both scripts before execution and ran them only in temporary copies. Control regenerated its two derived files byte-for-byte; UM regenerated its three derived files with the preserved snapshot/manifest intact. All original workspaces remained unchanged and matched the collected assessment. UM snapshot hashes, eight row calculations, three support-time conversions, 18 timeline rows, null unknown-impact fields and 20 local documentation links check out. The performer's own `verification.json` remains an authored artifact; independent checks are recorded separately.

The case used the same synthetic source packet, model (`gpt-6-astra`, `xhigh`, default tier), bounded runtime and tool authorization, with the local UM fixture added only to the second arm. Control was inspected before UM began. Actual questions differed: control asked for code, metric semantics and connection limit; UM asked for current health and code/stack. Both received the same source-bounded unknown reply. No new facts or approvals were supplied.

## Smallest guidance improvement

The tested `prod_010/n2` already asks for metric semantics before aggregation. The observed error concerns intervention comparison and propagation of uncertainty into summaries. Root added a focused clarification after this pair: establish measured interval boundaries before inferring immediate intervention effects, recognize that later timestamps may include earlier observations, and preserve that uncertainty in detailed analysis and summaries.

The reviewer checked the actual guidance diff and found no scope or approval blocker. It adds no fixture names, times or expected answers, and does not prevent drafting when facts remain unknown. This revision has **not** been performer-retested. All outputs here used public candidate `110ff2631ac0adf37f5325c123391af643a4a7c5`; later wording is not credited for these results.

Remaining limits: one synthetic case, no holdout or causal estimate, incomplete historical telemetry, no application source or live health, no accepted owners or human review, no customer communication, no implemented prevention and no successful shared update save. The reset-metadata tolerance and equal workload limits were applied prospectively to both arms; earlier pricing/migration interruptions are separate harness evidence and are not incident-content defects.
