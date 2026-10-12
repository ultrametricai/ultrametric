# Example Maple: cancellation handling

Prepared October 12, 2026 from the supplied account records. These are synthetic records; this document is a local draft, not evidence of a billing operation or a sent message.

## Recommended handling

Honor the request to stop renewal at the end of the paid term. Keep communication by email and do not offer another sales call. The customer has decided to move after requesting recurring work-order exports; scheduled export is on the backlog with no committed date.

## Account facts

- Subscription: `fixture-S-88`, Team plan, USD 99/month.
- Paid through October 31, 2026; next renewal November 1, 2026.
- The supplied record says cancellation has **not** been applied. Open balance is USD 0.
- Access continues through the paid term after renewal is stopped.
- Standard records export as CSV. Attachments require a separate archive.
- Deletion begins 30 days after the paid term ends under the existing retention policy. No deletion has occurred. This does not extend account access.

Sources: [customer request](account/customer-thread.txt), [subscription](account/subscription.json), [terms and support](account/terms-and-support.txt). The [company record](company/company.json) is a snapshot dated October 10; verify live billing status before acting.

## Completion checklist for the account operator

1. Verify the live subscription is `fixture-S-88` for Example Maple and whether cancellation has already been processed since the snapshot.
2. If renewal remains active, disable renewal at the end of the paid term, October 31. Preserve access through that date.
3. Verify the saved billing state: renewal is off, there will be no November 1 renewal charge, and access remains available through October 31. Record the provider confirmation or operation receipt before telling the customer cancellation is complete.
4. Send the confirmation below after verifying billing. Do not delay stopping renewal while export instructions are being investigated.
5. Assign support to verify the actual CSV export steps and how the customer obtains the separate attachment archive. The user confirmed those instructions are unavailable, and the supplied files contain no archive turnaround time. Do not invent menu paths, help links, or delivery dates. If support must prepare the archive, confirm its timing before promising delivery. Support operates on weekdays only; October 31 is a Saturday, so arrange any support-dependent work beforehand.
6. Follow up by email with the verified instructions. Ask the customer to download and check both the records and attachments before access ends. Keep the export assistance open until the instructions and any required archive have been provided; do not treat the cancellation confirmation as completion of the data request.

Do not promise a scheduled-export release date, free migration, a refund exception, or archive delivery timing without approval. Do not initiate early deletion. No refund was requested and the supplied open balance is zero.

## Acknowledgment draft, if responding before cancellation is verified

Hi Example Maple,

Understood—you want renewal stopped at the end of October. There’s no need for another sales call.

Your current paid term runs through October 31. Standard records can be exported as CSV, and attachments require a separate archive. Please plan to save both before access ends.

I’ll confirm when renewal has been switched off and provide the steps for getting both your records and attachments.

Thanks,
Rivet Desk Support

## Confirmation draft — use only after billing is verified

Hi Example Maple,

Your renewal is now turned off. You won’t be charged for the November 1 renewal, and you’ll retain access through October 31, 2026. There’s no need for another sales call.

Your records can be exported as CSV, and attachments require a separate archive. I’ll follow up here with the instructions for both. Please plan to save and check both your records and attachments before access ends October 31.

Thanks,
Rivet Desk Support

## Status

No billing change, export, archive request, deletion, or customer message has been performed. No account-management connector is available in this session. The remaining work requires the account operator to verify and stop renewal and send the confirmation. Support must separately resolve the missing export instructions and fulfill any required archive request.
