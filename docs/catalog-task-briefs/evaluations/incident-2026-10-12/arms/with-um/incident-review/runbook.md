# Work-order timeouts with import/database pressure

**Proposed operational runbook.** Derived from the October 9 synthetic evidence; no live commands, thresholds or recovery steps have been validated. The operator needs the actual service controls and authority. Current service health is unknown. Use the existing incident and escalation policy where one exists; severity cannot be assigned from this bundle alone.

## Recognize and assess

Trigger investigation when work orders time out or their error/latency signals degrade, especially with rising pool waits, worker pressure or queue age during import activity. Record UTC timestamps, revision and active jobs. Assign a response owner and a support contact; keep an intervention log with command/control used, start/completion, actor and observed effect.

Check work-order success from the customer-facing path, HTTP errors and client timeouts, pool acquisition wait, DB query/lock state, active connections against **verified** capacity, queue oldest age and worker concurrency. Compare web and batch ownership where instrumentation permits. A value of 100 connections is not a known capacity threshold. If dashboards disagree, preserve both and check scope/window/clock definitions.

## Contain

1. If batch activity overlaps with verified pressure, use the service's checkpoint-safe control to pause new import admission or reduce concurrency. Record the checkpoint and in-flight transactions. Avoid blindly killing a writer; pause/resume semantics and duplicate behavior must be known.
2. Check whether retry attempts are amplifying load. Use an established feature switch or a tested known-good revision to bound/disable the offending behavior when evidence supports it. Record rollout completion by instance, not just the initiation event. Ensure the selected path is compatible with schema and job state.
3. Reserve available capacity for user-facing work using verified admission controls. Do not simply enlarge the pool without DB headroom and an aggregate budget.
4. Consider a targeted pool recycle only if connection state indicates stuck resources and the restart/drain procedure is understood. Capture diagnostics first when that does not delay urgent recovery. It may interrupt active work and discard evidence; the historical restart alone is not proof this is the right intervention.
5. Observe each intervention with fine-grained customer, queue and DB signals. During an active outage, prioritize restoration; closely spaced interventions may be necessary. Record that causal attribution remains uncertain. Use isolated staging to separate effects afterward.

These are decision steps, not executable vendor commands. Add the actual safe controls and rollback references before adopting the runbook. Off-peak scheduling is an interim measure; the lasting controls are in [A3–A6](prevention-plan.md).

## Establish recovery and resume safely

Use a provisional minimum 15-minute observation window, extended to cover an import cycle and the service's actual recovery policy. Record all of:

- Work orders open successfully in synthetic checks and representative affected organizations; support follow-up has explicit coverage and remaining unknowns.
- Error and latency measures meet the agreed service targets, including client timeouts and deliberately rejected requests.
- Pool waits, worker pressure and queue age trend back to baseline; queues drain; telemetry is fresh. The October 9 queue was still 84 at the first lower-error row.
- Import checkpoint and committed-record totals reconcile; retrying/resuming does not duplicate effects. Unknown data integrity remains an open item, not a “no data loss” assurance.
- Resume at bounded concurrency with documented stop criteria; observe a complete cycle before unrestricted operation. If pressure returns, pause admission and reassess.

Record a recovery time only for the population and signals actually checked. In the supplied incident, 13:30 UTC is an improvement observation and 13:31 a partial customer report, not verified service-wide recovery.

## Preserve and learn

Capture the window and data listed in [A1](prevention-plan.md) before logs expire. Keep the original timezone and source locator for every event. Record unavailable evidence and expire sensitive exports according to company policy after the agreed retention period. Review the [causal hypotheses](postmortem.md), execute controlled reproduction, and track accepted actions through measured production outcomes.

Response log template:

| UTC start / completion | Observation or action | Scope / revision | Actor | Evidence link | Customer/queue result | Remaining uncertainty |
|---|---|---|---|---|---|---|
| Pending live use | | | | | | |
