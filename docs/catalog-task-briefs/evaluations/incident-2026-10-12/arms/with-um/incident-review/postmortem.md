# Rivet Desk — October 9, 2026 work-order outage

Prepared October 12, 2026. **Draft for review; root cause unconfirmed; production fixes unimplemented.** All supplied evidence is explicitly synthetic. This analysis describes that evidence, not a verified incident in a live service. Current service health, repository and stack information are unavailable, as confirmed by the user.

## What the evidence says

Customers reported work orders timing out during an import that began shortly after a deployment of request retry middleware. The strongest working explanation is database/resource contention during overlapping import and web activity, potentially amplified by retries. Active connections plateaued at 100 in three rows while the queue grew. That is consistent with pressure, but neither the actual connection limit nor resource sharing is established.

The deploy is a plausible contributor, not a demonstrated cause. Rollback at 13:23 UTC was followed by a still-elevated error row and a larger queue at 13:25. A pool restart at 13:27 and import pause at 13:28 preceded a much lower error row at 13:30. The clustered interventions and sparse observations prevent attribution to any one action. Full customer recovery is unverified.

The highest supplied row has **220 / 525 = 41.90% HTTP 5xx**. Support recorded reports from three organizations, then two callers reporting pages loading again. Neither number establishes total affected customers or total recovery. [S3, S5, S6]

Deliverables: [corrective actions and replay plan](prevention-plan.md), [operational runbook](runbook.md), [review and communication draft](review-record.md), [normalized timeline](derived/timeline.csv), [row calculations](derived/metrics.csv), [machine-readable findings](derived/analysis.json), and [source checksums](evidence-manifest.json).

## Sources and preservation

| ID | Source | Coverage and limits |
|---|---|---|
| S1 | [Company record](evidence-snapshot/company/company.json) | Snapshot dated October 10; fictional pilot company; no real provider receipts. |
| S2 | [Operator notes](evidence-snapshot/incident/operator-notes.txt) | Dated October 10; describes the prior morning; explicitly unsure which mitigation mattered. |
| S3 | [Event log](evidence-snapshot/incident/events.jsonl) | Seven events, 13:03–13:28 UTC; line numbers retained as source locators. |
| S4 | [Monitoring configuration](evidence-snapshot/incident/monitoring-config.txt) | Five consecutive minutes above 10% 5xx; no independent worker-pool saturation alert; seven-day retention; impact unreconciled. Effective configuration at incident time not independently verified. |
| S5 | [Support chat](evidence-snapshot/incident/support-chat.txt) | America/New_York; three messages at minute precision. October 9 date inferred from S2. |
| S6 | [Service metrics](evidence-snapshot/incident/service-metrics.csv) | Eight rows labeled every five minutes from 13:00–13:35 UTC; window, type, overlap and endpoint coverage unspecified. |

The six supplied files have been copied byte-for-byte into `evidence-snapshot/` with SHA-256 hashes and a local capture timestamp. This preserves only the provided fixture; it is not an export of production logs. The deterministic analysis script reads these copies and refuses to overwrite a changed snapshot.

**Urgent evidence gap:** under the supplied seven-day retention policy, October 9 logs may expire around October 16, potentially beginning at the corresponding UTC times. Exact deletion rules are unknown. Proposed action A1 specifies the export window, fields and evidence needed; no production evidence export has occurred.

## Normalized timeline

All normalized times below are October 9 UTC. New York was UTC−04:00 on this date: chat 09:12 → 13:12, 09:18 → 13:18, 09:31 → 13:31. No clock drift correction has been demonstrated. Simultaneous minute labels do not establish event ordering within the minute.

| UTC | Observation | Evidence and qualification |
|---|---|---|
| 13:00 | 1/420 5xx; 48 active connections; queue 5 | S6 line 2; first supplied row, not an incident start. |
| 13:03 | Deploy `fixture-rev-b`: request retry middleware; pool size unchanged | S3 line 1; proximity alone does not establish causation. |
| 13:05 | 2/435 5xx; 56 connections; queue 7 | S6 line 3; low row ratio, not proof every customer was healthy. |
| 13:07 | `month-end-import` starts, 52,000 rows | S3 line 2. |
| 13:09:20 | DB timeout for `fixture-request-101` | S3 line 3; first recorded timeout, not proven first customer failure. |
| 13:10 | Alert: “error threshold exceeded”; metric row 95/510 5xx, 100 connections, queue 45 | S3 line 4 and S6 line 4; alert delivery and acknowledgment absent. |
| 13:12 | Three organizations report work orders timing out | S5 line 2, original 09:12 America/New_York; reports may lag impact. |
| 13:15 | 220/525 5xx; 100 connections; queue 140 | S6 line 5; maximum supplied row error ratio. |
| 13:18 | Engineering reports import/web overlap and possible retry amplification | S5 line 3, original 09:18; responder hypothesis. |
| 13:20 | 184/480 5xx; 100 connections; queue 202 | S6 line 6. |
| 13:23 | Rollback to `fixture-rev-a` | S3 line 5; event timestamp does not show completion on every instance. |
| 13:25 | 100/450 5xx; 98 connections; queue 218 | S6 line 7; maximum supplied queue depth; window could overlap rollback. |
| 13:27 | Pool restart | S3 line 6; target and completion details absent. |
| 13:28 | Import paused | S3 line 7; pause/checkpoint details absent. |
| 13:30 | 3/470 5xx; 52 connections; queue 84 | S6 line 8; improvement with residual backlog. |
| 13:31 | Two callers report pages loading again; not every customer checked | S5 line 4, original 09:31; partial recovery report. |
| 13:35 | 1/460 5xx; 44 connections; queue 12 | S6 line 9; near early observed values, with no later coverage. |

## Impact and detection calculations

Each percentage below is `100 × http_5xx / requests` **within one supplied row**, assuming those columns share population and window. Row cadence does not establish interval length. These are descriptive ratios, not a validated availability SLI.

| Row time UTC | HTTP 5xx / requests | Row ratio | Active DB connections | Queue depth |
|---|---:|---:|---:|---:|
| 13:00 | 1 / 420 | 0.24% | 48 | 5 |
| 13:05 | 2 / 435 | 0.46% | 56 | 7 |
| 13:10 | 95 / 510 | 18.63% | 100 | 45 |
| 13:15 | 220 / 525 | 41.90% | 100 | 140 |
| 13:20 | 184 / 480 | 38.33% | 100 | 202 |
| 13:25 | 100 / 450 | 22.22% | 98 | 218 |
| 13:30 | 3 / 470 | 0.64% | 52 | 84 |
| 13:35 | 1 / 460 | 0.22% | 44 | 12 |

- **Affected function:** opening work orders/pages; support reports timeouts. Exact endpoints, regions, plan tiers and traffic population are absent.
- **Observed coverage:** DB timeout at 13:09:20; high error rows labeled 13:10–13:25; lower errors at 13:30 and partial customer recovery at 13:31. Exact onset, duration and full recovery are unknown. This does not justify a precise “20-minute outage” or service-wide MTTR.
- **Detection timing:** 13:10:00 minus 13:09:20 is **40 seconds** between the recorded alert and timeout. This is not time to detect from actual customer impact, nor time to acknowledge. Support's first message is two minutes after the alert; delivery and responder awareness remain unknown.
- **Alert reconciliation:** five-minute-spaced rows cannot establish five consecutive minutes above 10%. The 13:10 alert requires raw evaluations, metric windows and effective rule history. The low 13:05 row and first timeout at 13:09:20 warrant investigation but do not prove the alert was misconfigured or late.
- **Totals withheld:** no aggregate requests, failed attempts, affected users, eventual failures or revenue loss is calculated. Establish whether rows are samples, disjoint intervals, rolling windows or resettable counters before aggregation. Counts decrease, so they are not simply a monotonic counter series, but resets or series changes remain possible.
- **Reconciliation method when data exists:** select work-order requests for an explicit UTC window; establish count semantics and boundary handling; deduplicate logical request IDs separately from retry attempts; count distinct pseudonymous organizations and users; identify eventual success; include timeouts outside HTTP 5xx and missing telemetry. Report numerator, denominator, exclusions and coverage. Assess imported-record integrity separately.

## Causal analysis

| Claim | Confidence and support | Competing explanation / discriminating evidence |
|---|---|---|
| Errors, high connection activity and queue growth co-occurred | Directly observed in S6; DB timeout in S3 | Metric scopes and clock alignment still need verification. These observations describe symptoms. |
| Import and web traffic contended for DB resources | Leading hypothesis, moderate confidence: S3 import timing, S5 engineer report, S6 pressure | Need connection ownership, pool waits, worker concurrency, query duration/locks and import history. Slow queries, locks or another DB bottleneck can produce the same pattern. Reproduce with import on/off. |
| New middleware amplified load through retries | Plausible contributor, low-to-moderate confidence: S3 change and S5 suspicion | No retry counts or diff supplied. Compare revisions at the same load, and revision B with retries disabled; correlate logical requests to attempts. Revision A failing with import alone would weaken deploy-specific causation. |
| Pool capacity was exhausted at 100 | Unconfirmed: three rows equal 100 | Actual pool/DB limits, per-instance scope and metric clipping unknown. Verify capacity and waiters; do not equate 100 active connections with 100% utilization. |
| Rollback fixed the incident | Not established | 13:25 remained elevated and queue increased, though row window and rollout completion are unknown. Later restart and pause confound attribution. |
| Restart or import pause caused recovery | Plausible, unisolated | Only one minute separates interventions; workload reduction, drain, lock release or delayed rollback effects remain alternatives. Test interventions separately in staging. |

The causal chain to test is: import/web overlap → resource contention or long-held connections → DB timeouts → possible retry amplification → more contention and queue growth. The timing supports this investigation; it does not prove every arrow. No data-loss or security conclusion follows from this bundle.

Rollback was a reasonable response to a recent relevant change with incomplete information. The record does not justify attributing fault to an individual. Recovery signals include both lower error rows and customer reports; future response needs stronger verification across customers and backlog health.

## Decisions and next work

Prioritize evidence preservation and current-health verification, then import admission controls, bounded retry behavior and independent pressure alerts. Scheduling imports off-peak can reduce overlap but is insufficient protection by itself. Increasing pool size is not justified without DB capacity measurements.

The [prevention plan](prevention-plan.md) defines proposed accountable roles, dates, dependencies and observable acceptance tests. Owners have not accepted assignments; dates are planning targets. No application code or live monitoring configuration was available to change, no reproduction was executed, and no tracker issue or public communication was created. [Review record](review-record.md) keeps these states explicit.

Rebuild the evidence calculations from the workspace root:

```sh
python3 incident-review/analyze_evidence.py
```

The local run parsed seven events, eight metric rows and three chat messages; generated 18 normalized timeline entries; and preserved six source files. This verifies evidence processing only, not a production remediation.
