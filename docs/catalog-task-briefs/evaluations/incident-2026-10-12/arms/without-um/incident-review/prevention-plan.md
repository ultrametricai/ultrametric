# Rivet Desk — prevention and response plan

Status: proposed, not deployed. Based on the [incident review](incident-review.md). The repository, database engine, monitoring backend, metric definitions and production access are unavailable. This document specifies behavior and verification; it is not executable production configuration. Thresholds below are starting points for staging, not established service limits or promises.

## 1. Limit background work before adding capacity

Give import work a concurrency budget that is enforced across every worker replica, including deployment overlap. Reserve connections for interactive traffic and operations. Separate web/import pools can enforce allocation, but both still consume the same database's finite resources.

Define `D` as the verified safe database connection budget, `W` as peak web allocation across replicas, `B` as total import allocation, `O` as other clients, and `H` as operational headroom. Require `W + B + O + H <= D`, including autoscaling and rolling deployment peaks. Also test CPU, I/O and lock contention: staying within a connection count alone does not prove capacity. The observed value 100 is not a valid substitute for `D`.

For imports, set bounded concurrent transactions, small checkpointed chunks and a bounded pending-work queue. Record oldest pending age and processing progress. Stop admitting new chunks when interactive requests show pool wait or timeout pressure. Resume gradually only after health remains stable. Pausing must preserve committed progress and allow in-flight transactions to finish or explicitly roll back; a resume must not repeat committed writes.

Moving the import off peak is interim risk reduction. It does not replace enforced limits. Increasing pool sizes without measuring database capacity may simply move the bottleneck.

## 2. Put a hard ceiling on retry amplification

Use one deliberate retry layer. Apply a request deadline covering pool acquisition, work and backoff; propagate cancellation and release connections on every exit. Retry only classified transient failures, with capped exponential backoff and jitter. Do not retry local pool exhaustion or explicit cancellation. Start staging with at most **one additional attempt** per logical operation and an aggregate retry budget of **10% of initial attempts** in a rolling minute, enforced atomically at the chosen admission boundary. Reconcile any distributed allocation against that total; avoid hidden nested retries. A per-operation cap alone does not bound aggregate overload. These are proposed test settings, not values inferred from this incident. The principles follow [AWS retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) and [Google SRE's overload guidance](https://sre.google/sre-book/handling-overload/).

For writes, require durable idempotency keyed to the logical operation before enabling retries. Persist the key and outcome atomically with the mutation; reject reuse with different input. Test a committed write whose response is lost. A timeout does not prove a write failed. See [AWS guidance on idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/).

Export original operations, total attempts, retry reasons, budget-denied retries and deadline/cancellation outcomes separately. Define counters at consistent boundaries so successful retries do not hide the underlying failure rate.

## 3. Detect pressure and verify customer health

Measure each pool's checked-out, idle and waiting connections against its actual configured limit, plus aggregate database usage. Measure worker busy/available counts separately; active DB connections are not a worker utilization metric. Label metrics by workload and revision, using logs for request/organization identifiers rather than unbounded metric labels. Record metric windows and counter semantics.

| Signal | Proposed staging rule | Response / required verification |
|---|---|---|
| Interactive work-order failures | Retain the existing >10% 5xx for five minutes rule. Evaluate an additional >2% logical-operation failure ratio over five minutes once volume and normal behavior are known. Include timeouts without double-counting an operation. | Page the on-call role. Replay both rules; low traffic needs a synthetic work-order read or separate absolute-failure criterion. |
| Pool pressure | Warn when any interactive pool is >=80% used for two minutes. Page when >=90% for two minutes with waiting acquisitions or acquisition timeouts. | Inspect workload usage; throttle/pause imports. Denominator must be measured configuration, never the observed maximum. |
| Worker saturation / stale queue | Page when busy workers >=90% of capacity and oldest pending age exceeds the agreed job-start budget for two minutes. | Verify the worker pool and queue being measured; pause admission and inspect progress. Queue length alone cannot reveal staleness. |
| Excess retries | Alert when aggregate retries exceed the configured budget, or attempts per original operation exceed its cap. | Disable or tighten retry admission; inspect every retry layer. |
| Missing telemetry | Alert when expected samples or customer probes disappear for two minutes. | Investigate monitoring health; absence of samples is not a recovery signal. |

Choose an actual job-start budget and customer latency objective before enabling their dependent rules. Replay recorded healthy traffic and an overload exercise to tune durations, traffic floors and notification routing. Test notification delivery and link this runbook to each actionable alert. No rule is installed by this document.

## 4. Runbook for a recurrence

1. **Establish state.** Record the UTC start, incident lead, active revisions, import state, customer symptoms and recent changes. Preserve available DB/pool/queue snapshots and attempt-level logs without delaying urgent mitigation. Check work-order success and latency; HTTP status alone misses client timeouts.
2. **Reduce background demand.** Pause new import chunks or lower concurrency using a documented control, preserving the checkpoint. Record the change and its effective time. Verify interactive pool waits, failure ratios and oldest queue age begin improving.
3. **Constrain retries and assess rollback.** Use a tested retry kill switch or budget reduction if present. If the recent revision is implicated, roll back through the normal deployment path after checking schema/config compatibility; verify all serving replicas' revisions. An event saying “rollback” does not prove it completed everywhere.
4. **Inspect persistent DB pressure.** Check long transactions, locks, query latency and connection release. If a pool is demonstrably stuck, capture diagnostics and use a controlled drain/restart with transaction outcomes accounted for. A blanket restart is not the routine first response; it can erase evidence and interrupt work. Do not terminate sessions indiscriminately.
5. **Measure after each intervention.** Capture at least minute-level health before and after each step where feasible. User recovery takes priority over separating causes; if several actions are needed together, record that attribution remains uncertain. Escalate persistent DB symptoms to the database owner.
6. **Verify recovery and resume cautiously.** Require work-order reads and safe test writes to pass, failures and latency to meet the agreed healthy range for ten consecutive one-minute windows, pool waits/timeouts to settle, and queue age/depth to return to the normal range with progress continuing. Reconcile partial writes and import checkpoints. Confirm the three reporting organizations' recovery. Resume a small import chunk under observation, then raise concurrency only within the tested cap; pause again if symptoms recur.

The ten-minute hold is a proposed operational gate. It cannot be demonstrated from the supplied five-minute samples. The incident should remain “mitigated; verification pending” until customer and data checks are complete.

## 5. Verify the explanation and the safeguards

Use staging with synthetic data and matched database/resource limits. Do not reproduce overload on customers. Capture offered logical operations separately from completed requests: the CSV does not establish requests per second and is not sufficient to choose a replay rate.

First compare the four cases below at the same independently chosen web workload, database size, connection limits and initial queue state. Run through the entire import and recovery; repeat matched trials to account for warm-up/cache effects. Capture pool waits, DB waits, query times, attempts, queue age, revision and user-visible latency/errors.

| Revision | No import | 52,000-row import |
|---|---|---|
| `fixture-rev-a` | Reference behavior | Tests import pressure without the new middleware |
| `fixture-rev-b` | Tests revision effect without import | Tests the observed combination |

Both import cases failing would support a workload/capacity problem; only the new revision with import failing would support an interaction. If the new revision differs in other ways, repeat with only retries toggled to isolate them. Failure to reproduce does not disprove the incident; record workload and environment gaps.

Then run the fixed configuration through these acceptance tests:

| Test | Required observation |
|---|---|
| Web load plus full import, including replica/deploy surge | Global connection and import concurrency budgets hold; interactive work remains healthy; import makes progress. |
| Dependency slowdown, pool timeout and sustained overload | Retry budget and per-operation cap hold; pending work stays bounded; expired work releases resources; background admission slows. |
| Cancel during acquisition, execution and backoff | No new attempt after cancellation; acquired resources return to baseline; no abandoned transaction remains. |
| Commit succeeds but response is lost; duplicate delivery | Exactly one durable work-order mutation per idempotency key; stable returned result; conflicting input rejected. |
| Pause/resume and worker interruption mid-import | Committed records are neither lost nor duplicated; checkpoints are recoverable; remaining rows complete. |
| Alert replay and recovery | Pressure and customer-symptom alerts fire and route correctly; missing data does not clear them; recovery gates are observable. |

Until a service objective exists, use **provisional staging gates** of <=1% failed logical web operations per one-minute bucket, p95 web latency <=2× the matched healthy baseline, and queue age/depth returning to their pre-test range within ten minutes after reducing load. Measure failures even if they lack an HTTP response. These relative gates need an absolute latency objective before production rollout; they do not authorize changing an existing stricter objective.

Promote only after tests pass, with a limited canary and explicit stop conditions for failed gates, retry-budget breach or growing pool waits. Record the actual changes, effective configuration, rollout observations and rollback mechanism. Close prevention work only when deployed behavior and the response drill have been verified; completing this plan alone is not closure.
