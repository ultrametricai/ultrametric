# Example Maple — cancellation handling package

Prepared October 12, 2026. All supplied company, account and correspondence records are synthetic. This is a local preparation package, not evidence of a live billing change, sent email, export or CRM update. Source files have not been changed.

## Recommended handling

Honor the customer's firm request to stop renewal at the end of the paid term. Do not require a sales call, retention offer, usage review or completed export before handling cancellation. Prepare the data handoff alongside the billing work.

The supplied account snapshot says cancellation has **not** been applied. No billing provider is identified in the account files, and no live billing or messaging connection is available here. An authorized operator must make the change and verify the result before anyone confirms cancellation to the customer. The user confirmed that billing/export owner details and documented CSV/archive instructions are unavailable; those gaps remain unresolved.

## Known facts and limits

| Item | Evidence / status |
| --- | --- |
| Customer and subscription | Example Maple; `fixture-S-88` |
| Plan | Team; USD 99/month |
| Customer choice | October 9: moving away; cancel renewal at month-end; no further sales call; wants records before access ends |
| Reported problem | September 18: recurring work-order export needed; manual exports take too much time |
| Prior support statement | September 19: scheduled export is on the backlog, with no committed date |
| Paid access | Through October 31, 2026; exact cutoff time and timezone are not supplied |
| Next renewal | November 1, 2026 |
| Cancellation status | `cancellationAlreadyApplied: false` in the supplied snapshot; no live readback |
| Open balance | USD 0 in the snapshot; current invoice state is unverified |
| Records | Standard CSV export is supported; precise field coverage and download steps are unknown |
| Attached files | Require a separate archive; archive creation/download method and completeness are unverified |
| Support | Weekdays only; individual owner and capacity are unconfirmed |
| Retention | Deletion begins 30 days after the paid term ends; no deletion has occurred in the supplied record. Retention does not extend download access. |
| Concessions | No scheduled-export delivery date, free migration service or refund exception has been approved |

## Draft acknowledgement — not sent

Subject: Your cancellation request and records

Hi Example Maple,

I'm sorry manual exports have taken so much of your time. I understand you've decided to move and want renewal stopped at the end of October. We respect your decision; no sales call is needed.

Your request has been received, but cancellation is not yet confirmed. Your current paid access runs through October 31, 2026.

To take your records with you, you'll need a CSV export and a separate archive of attached files. Please save and check both before access ends. I don't yet have confirmed download instructions for both formats.

Thank you for explaining what wasn't working for you.

Rivet Desk

Use the final confirmation below instead if billing and export checks have already been completed. This acknowledgement makes no delivery-date, refund, migration or feature commitment.

## Billing handoff — pending execution

Suggested owner role: an authorized billing operator. Named owner: unassigned.

1. Match Example Maple and subscription `fixture-S-88` to the intended account. These are fixture identifiers; do not use them to target an unrelated live subscription. Confirm the customer's contact and the October 9 request in the actual case if this package is adapted for live use.
2. Read the current subscription and invoices. Confirm the paid-through date, renewal date, balance, exact access cutoff/timezone and whether cancellation is already scheduled.
3. Apply the requested operation once: stop renewal at the end of the current paid term, preserving paid access through October 31 and preventing the November 1 renewal. Use the provider's appropriate end-of-term operation after verifying it. Do not immediately terminate access, delete data or issue a refund as part of this change.
4. Capture the operation/request identifier and time, then read back the subscription and invoice state. Verify that renewal is disabled or end-of-term cancellation is scheduled, the effective date matches the paid term, access is preserved, and no unexpected renewal invoice or charge is pending. Resolve discrepancies before confirming the result.
5. If the operation result is uncertain, inspect the current state before retrying. A request receipt alone is not proof of completion.

Execute promptly; the customer's required boundary is before the November 1 renewal. Export progress is not a prerequisite. The recorded USD 0 balance is not a live guarantee about all future charges.

Evidence to add after execution: named operator, provider/account, verified subscription ID, before/after state, effective timestamp and timezone, request ID, invoice readback and observation time. All remain missing.

## Data handoff — pending instructions and files

Suggested owner role: support or the person responsible for exports. Named owner: unassigned.

1. Confirm the actual CSV export steps or help link, required permissions, and which records/fields it includes. Check whether closed work orders, comments/history and related records needed by this customer are included; do not assume unsupported coverage.
2. Confirm how to create and obtain the separate attachment archive, any limits, and how files can be matched to their records. Do not describe the CSV as containing attachments.
3. Provide verified steps for both downloads, or prepare them only within existing authority. No records or attachment archive are available in this workspace to export now.
4. Check that the CSV opens, expected records are present, and the archive opens with expected attachments. Identify missing items explicitly and use an approved delivery route to the confirmed customer contact. Record whether delivery and customer download are confirmed or still unknown.
5. State the actual access cutoff and advise saving and checking both downloads before it. Deletion begins 30 days after the paid term ends; that is neither continued account access nor a promised post-cancellation download window.

Proposed internal target: finish the data handoff by Friday, October 30, while weekday support is available. October 31 is Saturday. This target is not an agreed customer deadline or delivery promise; confirm an owner and capacity before offering a date or update cadence. Do not promise free migration or later access.

## Final confirmation draft — hold until verified and completed

Do not send with placeholders or before the supporting billing readback. Insert verified instructions for both export types; if either remains unresolved, confirm only the verified cancellation separately and clearly identify the outstanding export work.

Subject: Renewal stopped and how to download your records

Hi Example Maple,

Your renewal has been turned off. Your Team subscription will end after your paid term on October 31, 2026, and it will not renew on November 1. Your paid access continues through October 31.

I'm sorry the manual export process didn't meet your needs. We respect your decision, and no sales call is needed.

To save your data before access ends:

1. **Records (CSV):** [Insert verified steps or help link, including any relevant scope limits.]
2. **Attached files (separate archive):** [Insert verified archive request/download steps or approved delivery details, including any known omissions.]

Please download and check both by [verified access cutoff, including timezone]. Our retention policy starts deletion 30 days after the paid term ends; this does not extend your access to downloads.

Thank you for using Rivet Desk.

Rivet Desk

## Local case note — ready to copy after review

Customer: Example Maple / `fixture-S-88`. Firm cancellation requested October 9, 2026, effective at the end of the October paid term. Customer declined further sales calls and requested their records before access ends. Reported product gap: recurring work-order exports; manual export workload. Scheduled exports have no committed delivery date. No retention offer made.

Outcome as of this preparation: cancellation package and unsent reply drafts prepared. Supplied snapshot shows renewal still active for November 1; live billing state is unknown. No cancellation applied, no message sent, no refund or discount issued, no export generated or delivered, no data deleted and no CRM record changed by this work. Do not label the customer retained, cancellation completed or data handoff delivered.

Remaining actions: assign billing and export owners; verify and apply end-of-term cancellation; capture readback; verify CSV and attachment instructions/scope; complete data handoff within paid access; send accurate confirmation through an authorized channel; record actual results. Cancellation and export statuses must be tracked separately. No customer update schedule has been promised.

## Sources

- [Customer correspondence](../account/customer-thread.txt): customer intent and export problem.
- [Subscription snapshot](../account/subscription.json): identifiers, plan, dates, balance and unapplied cancellation.
- [Terms and support](../account/terms-and-support.txt): cancellation/access terms, export formats, weekday support, retention and unapproved commitments.
- [Company record](../company/company.json): Rivet Desk and synthetic-data provenance; company snapshot date October 10, 2026.
- User clarification, October 12, 2026: billing/export owner details and documented export instructions are unavailable.
- Ultrametric `churn-save-attempt`, version 3, retrieved read-only October 12, 2026: procedural guidance only, not evidence of this account's provider, authority, live state or execution.
