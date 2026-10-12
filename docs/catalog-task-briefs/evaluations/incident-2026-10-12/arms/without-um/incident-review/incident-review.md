# Rivet Desk — October 9, 2026 incident review

Prepared October 12 from the supplied synthetic records. This is an evidence review and proposed response plan. No live service was inspected, no production configuration was changed, and recurrence prevention is not yet verified. Root cause remains provisional.

## Assessment

Customers experienced work-order timeouts during a period of high database connection counts and growing queues. The leading hypothesis is resource contention during the 52,000-row import, potentially amplified by the newly deployed request retries. Active database connections plateaued at 100 while errors rose; the actual connection limit and whether web and import traffic share a pool are unknown. This supports connection pressure, but does not prove pool exhaustion, a connection leak, or a retry storm.

The rollback did not coincide with immediate normalization: the 13:25 UTC row still shows 22.22% HTTP 5xx and the highest recorded queue depth. The next low-error row, at 13:30, follows **all three** interventions: rollback at 13:23, pool restart at 13:27, and import pause at 13:28. The data cannot isolate their effects or exclude a delayed rollback effect. Do not treat the deploy as the proven sole cause or the restart as a permanent fix.

## Evidence and timeline

Logs and metrics use UTC. Support chat uses America/New_York, which was EDT (UTC−04:00) on October 9. The chat's 09:12 is therefore 13:12 UTC, not a separate earlier incident.

| UTC | New York | Observation |
|---|---|---|
| 13:00 / 13:05 | 09:00 / 09:05 | Reference rows: 0.24% / 0.46% 5xx; 48 / 56 active DB connections; queue 5 / 7. |
| 13:03 | 09:03 | Revision `fixture-rev-b` deploys request retry middleware; pool size unchanged. |
| 13:07 | 09:07 | `month-end-import` starts with 52,000 rows. |
| 13:09:20 | 09:09:20 | First supplied explicit DB timeout, `fixture-request-101`. |
| 13:10 | 09:10 | Alert recorded; metric row has 18.63% 5xx, 100 active connections, queue 45. |
| 13:12 | 09:12 | Support reports three organizations unable to open work orders. |
| 13:15 | 09:15 | Highest observed error ratio: 220/525 = 41.90%; connections 100; queue 140. |
| 13:18 | 09:18 | Engineering suspects import/web overlap and retry amplification. This is a hypothesis. |
| 13:20 | 09:20 | 38.33% 5xx; connections 100; queue 202. |
| 13:23 | 09:23 | Rollback to `fixture-rev-a`. |
| 13:25 | 09:25 | Still 22.22% 5xx; connections 98; maximum recorded queue 218. |
| 13:27 / 13:28 | 09:27 / 09:28 | Pool restart, then import pause. |
| 13:30 | 09:30 | 0.64% 5xx; connections 52; queue 84, still above reference rows. |
| 13:31 | 09:31 | Two callers report pages loading again; universal recovery not checked. |
| 13:35 | 09:35 | 0.22% 5xx; connections 44; queue 12, nearer the reference level. |

Sources: [events](../incident/events.jsonl), [metrics](../incident/service-metrics.csv), [support chat](../incident/support-chat.txt), [operator notes](../incident/operator-notes.txt), [monitoring](../incident/monitoring-config.txt). [Company record](../company/company.json) establishes the synthetic scope.

## Impact and recovery limits

- **Known impact:** three organizations reported work-order timeouts. The peak supplied 5xx ratio is 41.90%, not evidence that every request or customer failed. Endpoint breakdown, latency, client timeouts, and affected-user totals are absent.
- **Counts:** the eight supplied rows sum to 606 5xx out of 3,750 requests (16.16%). The four rows at 13:10–13:25 sum to 599/1,965 (30.48%). These are descriptive sums of rows, **not established incident totals**: interval semantics, overlap, and retry counting are unavailable. Neither figure represents unique failed operations or customers.
- **Duration:** first supplied timeout is 13:09:20; sampled errors remain high through 13:25 and are low at 13:30. These observations do not establish exact onset, uninterrupted outage duration, or full recovery time. Two later callers are insufficient to close customer impact.
- **Integrity:** there is no supplied evidence of lost or duplicate work orders, but no reconciliation proving their absence. Import progress and write outcomes after retries/restart need checking.
- **Detection:** the configured page requires five consecutive minutes above 10% 5xx, with no independent worker saturation alert. Five-minute spaced rows with unknown aggregation cannot validate the 13:10 alert's firing logic. The config leaves resource pressure without its own warning; the records do not prove that an earlier alert would have prevented this incident.

## What would settle the cause

| Hypothesis | Supporting evidence | Missing discriminator |
|---|---|---|
| Import competes with interactive work | Import precedes errors; connections and queue rise; pause precedes improvement. | Per-workload pool use, worker concurrency, DB wait/query timings, import progress. |
| New retries amplify pressure | Middleware deployed four minutes before import; engineer suspects amplification. | Diff and effective config; attempts per original request; retries at every client/worker layer. |
| Stuck/leaked connections or DB locks | Plateau and later restart are compatible with this. | Pool checkout/return traces, transaction ages, lock waits, cancellation/release behavior. Restart alone is not proof. |
| Independent DB/infrastructure degradation | Similar symptoms are possible. | DB CPU/I/O, slow queries, lock events, infrastructure events; none are supplied. |

Preserve one-minute or finer telemetry, deployment/rollback completion times and instance revisions, original-request/attempt IDs, pool limits by process, DB wait events, queue type/age, and import checkpoints. Seven-day retention puts October 9 logs at risk around **October 16**, depending on the retention policy; export them promptly to controlled incident storage. Local source hashes are recorded in [evidence-summary.json](evidence-summary.json); they do not preserve unavailable live logs.

## Actions and ownership

These are proposed assignments to roles, not accepted assignments. Targets run from adoption of this plan; all production actions remain open. A five-person team may combine roles.

| Priority / target | Suggested accountable role | Action | Completion evidence |
|---|---|---|---|
| P0 / today | Engineering incident lead | Preserve expiring evidence and effective configs. Verify current health and import state; keep large imports paused or at a demonstrated safe cap until guarded resume is tested. | Export location, UTC timestamps, configs, health observations, import checkpoint. |
| P0 / today | Support lead + engineer | Reconcile affected operations by organization and operation ID; check import writes for partial/duplicate outcomes. Confirm recovery with all three reporting organizations. | Reconciled counts with coverage gaps; checks on writes and customer confirmation. No messages have been sent. |
| P1 / 2 working days | Service engineer | Inspect retry behavior; implement one retry layer, deadlines, attempt limits and aggregate retry budget. Ensure safe handling of writes. | Reviewed change plus overload and duplicate-write tests in the prevention plan. |
| P1 / 2 working days | Service/import engineer | Cap import concurrency across replicas, reserve interactive capacity, bound queues and support checkpointed pause/resume. | Load test demonstrates bounded usage and correct resume without loss or duplication. |
| P1 / 2 working days | Monitoring owner | Add pool pressure, worker saturation, queue age and retry-attempt telemetry; page on customer symptoms as well as resource risk. | Alert replay, delivery check and linked runbook; thresholds calibrated with actual metrics. |
| P1 / before retry redeploy or large-import resume | Engineering lead | Run controlled old/new revision × import off/on tests; validate fixes under DB slowdown, cancellation and peak load. | Test results, canary limits and rollback plan recorded. |
| P2 / 1 week | Engineering lead | Review results and revise causal conclusion; rehearse runbook; verify protections remain enabled. | Named owners, change identifiers, drill evidence and closure decision. |

Detailed implementation contracts, alert proposals, mitigation steps and acceptance tests are in [prevention-plan.md](prevention-plan.md). No service repository, deployment configuration, actual connection limit or metric interval definition is available, so these controls cannot be implemented or proven effective in this workspace.

## Reproduce the analysis

From the workspace root run `python3 incident-review/analyze.py`. It reads the supplied sources, validates metric ordering/counts, converts event and metric timestamps to New York time, hashes sources, and writes [derived-metrics.csv](derived-metrics.csv) and [evidence-summary.json](evidence-summary.json). It performs no external actions and does not infer distinct customer counts or root cause.
