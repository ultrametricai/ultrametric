# Prevention plan and corrective-action drafts

Incident: [October 9 Rivet Desk work-order outage](postmortem.md). Prepared October 12, 2026 from synthetic evidence. **All work below is proposed unless explicitly marked completed locally.** No named owner, delivery date, production change, monitoring rule, tracker issue or test execution has been accepted or verified. Priorities are local planning priorities, not an inferred company severity scheme.

## Prioritized backlog

| ID | Priority | Proposed accountable role; target | Failure or gap addressed | Concrete deliverable and acceptance evidence | Status / dependency |
|---|---|---|---|---|---|
| A1 | P0 | Engineering lead; October 12, before retention expiry around October 16 | Seven-day retention and absent fine-grained telemetry threaten diagnosis | Export the evidence listed below with UTC query/window, capture time, original timezone, access controls and checksums; verify a reopened sample. Retain through review and remediation validation under company policy. | Local fixture preserved; live export blocked by unavailable access/data. |
| A2 | P0 | Engineering lead + support lead; October 12 | Recovery and customer impact are incompletely verified | Record current work-order success/latency, backlog age and pool waits; reconcile impacted organizations, logical failures vs attempts, eventual success, and import integrity. Record exact coverage and unknowns. | No live-health check or total-impact reconciliation possible from the bundle. |
| A3 | P1 | Import owner; before next import, suggested October 13 | Plausible batch/web contention and demonstrated queue growth | Bound total batch concurrency across replicas; checkpoint and pause admission under DB/pool pressure; reserve measured web capacity. Produce capacity budget and overlap replay results meeting gates G1–G3. | Code, topology, capacity and safe import replay unavailable. |
| A4 | P1 | API owner; before retry middleware is re-enabled/released, suggested October 14 | Plausible retry amplification after middleware deploy | One deliberate retry layer with total deadline, bounded attempts, jittered backoff and aggregate retry budget; exclude unsafe writes without idempotency. Measure attempts per logical operation. Pass G2–G4. | Needs middleware diff, configuration and representative failure harness. |
| A5 | P1 | On-call owner; suggested October 14 | No independent worker-pool saturation alert; ambiguous alert history | Instrument utilization against actual limits, waiters, pool acquisition latency, queue oldest age, worker saturation, retries and user-facing latency/errors. Route tested pressure and impact alerts to on-call with diagnostics. Pass G5. | Current rule engine, thresholds, SLO and notification access unknown. |
| A6 | P1 | Engineering lead; before resuming unrestricted import/retry release, suggested October 16 | Multiple mitigations make cause and recovery uncertain | Execute the controlled matrix below; retain results; select causal conclusion supported by experiments; canary the chosen fixes with rollback criteria and per-version telemetry. | Depends on A1, A3–A5 and a representative staging environment. |
| A7 | P2 | Engineering lead + support lead; suggested October 19 | No accepted owners, review or complete recovery record | Review findings asynchronously or in a short session; assign named owners and accepted dates; run the response drill; reconcile import records and customer impact; record deferred work with reason. | Review draft only. A1 preservation must precede this date. |

Five staff may cover multiple roles. These labels do not imply additional staffing. “Before next import” and “before release” are proposed gates, not controls already installed.

## A1: evidence collection specification

Requested initial window: **2026-10-09 12:45:00–14:00:00 UTC**. Expand earlier for baseline and later until customer and queue recovery are established. Preserve native granularity; retain original timestamps and series labels. Capture:

- HTTP/access traces: request/logical-operation ID, UTC time, endpoint class, status, duration, timeout phase, revision, instance, retry attempt and pseudonymous organization. Keep raw customer content and credentials out of the shared review.
- Web/worker/DB data: configured and effective limits per process and across replicas, connection ownership/state, pool acquisition waits, checkout duration, pending work, worker concurrency, DB CPU/I/O, query duration, locks and transaction lifetime. Identify what `queue_depth` measures and whether connection telemetry is capped or aggregated.
- Import state: actual start, concurrency, progress, retries, pause/checkpoint/commit behavior, completion or failure totals and reconciliation of the 52,000 input rows. Preserve representative query shapes without customer payloads.
- Change history: revision A/B diff, retry policy before/after, rollout and rollback start/completion per instance, exact pool restarted, configuration and instance-count changes. A “pool size unchanged” event does not establish aggregate capacity.
- Monitoring history: raw one-minute or finer values, effective rule/config history, evaluation state transitions, scrape failures, alert firing, delivery and acknowledgment. Establish counter vs interval/sample semantics, range alignment, resets, overlapping windows and population.
- Support evidence: original dated messages, report time vs impact time, recovery follow-up by affected organization; original timezone and any verified clock corrections.

Acceptance: export receipt and manifest identify what is preserved, missing and redacted; files can be reopened; query/window and source date are reproducible. The existing local manifest meets this only for the six supplied files.

## A3–A4: implementation requirements

**Protect web capacity.** Inventory the DB's sustainable capacity and every producer before setting concurrency. Budget connections across all web replicas, batch replicas and other clients, with a measured operational reserve; deployment overlap must fit too. Separate bounded web and batch admission/pool quotas where appropriate. Sharing one database still requires a total budget. Pause new batch work on sustained pressure and resume gradually with hysteresis. Use small checkpointed chunks, bounded queues and cancellation/deadlines so abandoned work stops consuming resources. Do not increase pool size as a default fix. This applies overload-control principles to the observed contention hypothesis. [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)

**Bound retries.** Retry at one chosen layer for eligible transient errors, within an overall request deadline. Cap attempts, use exponential backoff with jitter and an aggregate budget, and stop retrying when local admission/pool acquisition is already overloaded. Require idempotency for retried writes; a timeout does not prove the original operation failed. Log initial operations separately from retry attempts. These controls address amplification even if the middleware is not ultimately the incident trigger. [AWS: Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

Numeric settings below are **provisional staging acceptance targets**, not measured production capacity or approved service objectives. Revise them before rollout using the real baseline and product latency objective. If changed, record the rationale and preserve both test results.

## Controlled reproduction and regression plan

Use isolated staging with a comparable topology and anonymized or synthetic import data. Match the known 52,000-row size and investigate query shape and transaction size; row count alone is insufficient. Establish actual web request rates from raw telemetry if recoverable. The CSV does **not** establish requests per second or requests per five minutes. Without that data, perform a documented load sweep and describe results as mechanism testing, not an exact incident replay.

Keep data, instance counts, pool limits, traffic mix and load fixed for comparisons. Reset queue/pool state between runs; include warm-up and at least three repeats. Collect one-second or suitably fine telemetry and request-level traces.

| Run | Revision / retries | Import | Question |
|---|---|---|---|
| R1 | A, original policy | Off | Baseline behavior and capacity under web traffic. |
| R2 | B, changed middleware enabled | Off | Can the middleware cause pressure without the import? |
| R3 | A, original policy | On | Can the import alone reproduce contention? |
| R4 | B, changed middleware enabled | On | Does the combination worsen attempts, waits, errors and recovery? |
| R5 | B, changed middleware disabled | On | Does disabling only the middleware change the outcome? |
| R6 | Proposed import controls, baseline retry policy | On | Does bounded batch admission protect web capacity? |
| R7 | Proposed retry controls, baseline batch policy | On | Does bounded retry behavior reduce amplification? |
| R8 | Both controls | On, then DB slowdown/timeout injection | Do the combined safeguards hold during pressure and recover cleanly? |

For a reproducibly degraded baseline, start separate runs that apply **only** rollback, **only** pool restart, or **only** import pause. Include an untreated control with the same workload duration. Record convergence times and backlog drain; do not combine interventions when testing their effect. Stop a run at its safety limit and retain partial results. A staging reproduction supports a mechanism; incident-specific causation still requires matching the historical evidence.

Interpretation: R3 ≈ R4 weakens deploy-specific causation; R4 worse than R3 and R5 supports retry contribution; persistent saturation with retries disabled directs work toward batch concurrency, slow queries, locks or connection leaks. If none reproduce, keep root cause unconfirmed and compare topology, data shape and capacity against production.

## Observable gates

- **G1 — web protection:** with intended peak web load and the import running, maintain <1% web 5xx and proposed p95 latency ≤1.2× web-only baseline, while also meeting the product's agreed latency objective once available. Count load-shed responses and client timeouts as unsuccessful service; returning 429s must not make the test appear healthy. Validate at normal and maximum expected replica counts.
- **G2 — resource bound:** measured aggregate connection use never exceeds the approved budget; web has its reserved allocation; batch admission pauses at its documented pressure threshold. Queue age and pool wait remain within declared bounds. After pressure is removed, queues drain toward baseline within a provisional five-minute recovery target, with no immediate restart oscillation. Document the actual numeric budgets before running.
- **G3 — import integrity:** pause, resume, retry and crash at checkpoint boundaries; reconcile every one of 52,000 test rows as successfully applied once or explicitly failed with an auditable reason. Demonstrate no duplicate business effects, silent loss or skipped checkpoints. This is a test requirement, not a claim about historical data loss.
- **G4 — retry bound:** initial staging candidate: maximum two attempts per logical eligible operation, a retry budget ≤10% of original eligible operations over a documented rolling window with a bounded burst, and total elapsed time within the end-to-end deadline. Configure one retry layer. Inject lost responses after a write commit to test idempotency; zero unsafe duplicate side effects. Other layers must not multiply attempts. Record the chosen budget window, burst size and deadline before execution.
- **G5 — detection:** replay raw historical metric evaluations if preserved. Separately inject sustained pool waits/worker pressure and work-order failures. A provisional target is responder delivery within two minutes of the documented sustained trigger, with service, revision, queue/pool diagnostics and runbook links. Record firing, delivery and acknowledgment independently. Verify brief spikes do not cause unnecessary paging, alert resolution works, and missing telemetry generates a signal rather than a green state. The eight-row fixture cannot validate this gate.
- **G6 — release/recovery:** after staging passes, canary with representative load and version-tagged metrics; set abort criteria to the agreed web error/latency, resource and data-integrity gates. Observe a complete import and a provisional ≥15-minute stable recovery window before expansion. Exercise rollback and pause paths and record their receipts. One green row or two caller reports is insufficient for broad recovery.

For alert design, retain customer-impact coverage while adding pressure signals. Once the service SLO is agreed, use multiwindow error-budget burn alerts and a work-order synthetic check to cover low-traffic periods; do not invent a 99.9% commitment from this incident. Thresholds need workload validation. [Google SRE: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)

## Completion evidence

Each accepted action needs a named owner, accepted date, implementation/config revision, linked test result, observed rollout outcome and reviewer acceptance. Ticket creation alone does not prevent recurrence. Close the prevention work only after the selected causal explanation is supported or honestly left unresolved, safeguards pass the gates, customer/import impact is reconciled, and the operational owner accepts the runbook. None of those completion conditions is established by this local package.
