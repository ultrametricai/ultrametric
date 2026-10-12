# No-send validation

Validation date: October 12, 2026. Run with `python3 sales/first-conversations/checks/dry_run.py` from the workspace root.

**RESULT: PASS — 25 checks.** Eight ledger rows reconcile to zero eligible, zero duplicate, one suppressed, one existing conversation, and six held. The original four source rows and historical statuses match the ledger.

The event replay is a local model of the proposed handling rules. Every event in `simulated-events.csv` uses a SIM recipient and a fictitious provider identifier. Simulated delivery, replies and attendance are not real-world outcomes. No sender, CRM, inbox, booking service, scheduler, authentication, or provider integration was tested. The script contains no network or sending function.

All real ledger rows remain unapproved and ineligible. A preview result inside a synthetic scenario cannot override those values or the evaluation's no-send instruction. Scheduling intervals and recipient timezones are documented proposals, not tested scheduling integrations. An unresolved timeout requires human/provider reconciliation; the model deliberately does not clear that hold on a later event alone.

| Check | Result |
| --- | --- |
| Eight unique stable recipient IDs | PASS |
| One candidate per account; no duplicate nonempty normalized email | PASS |
| Every row has source, date, reason and next action | PASS |
| Every actual row is ineligible and unapproved | PASS |
| Disposition reconciliation: six held, one suppressed, one existing conversation | PASS |
| All four original addresses and historical statuses preserved | PASS |
| Birch remains suppressed | PASS |
| Canal remains a separate existing conversation | PASS |
| Dune remains held after uncertain send | PASS |
| AMP has no guessed email | PASS |
| Synthetic delivery permits only a no-send follow-up preview | PASS |
| Missing required personalization blocks the preview | PASS |
| Substantive reply pauses follow-ups | PASS |
| Late delivery does not restart a replied conversation | PASS |
| Duplicate provider/event ID is processed once | PASS |
| An offered time is only a proposal | PASS |
| Incomplete booking evidence cannot establish acceptance | PASS |
| Explicit slot and method acceptance records accepted, not attended | PASS |
| Attendance is a separate event | PASS |
| Queued follow-up stops on bounce and late events cannot reopen it | PASS |
| Queued follow-up stops on optout and late events cannot reopen it | PASS |
| Queued follow-up stops on decline and late events cannot reopen it | PASS |
| Uncertain delivery stays held pending reconciliation; no automatic retry | PASS |
| Automated reply pauses for review without establishing interest | PASS |
| Closed no-reply sequence cannot restart on late delivery | PASS |

Local review: personalized claims link to primary sources; unknown building counts remain unknown; required sender fields remain visibly unresolved; the Canal draft answers its existing request; Birch and Dune have no outreach/retry drafts. Live execution and real conversations remain unperformed.
