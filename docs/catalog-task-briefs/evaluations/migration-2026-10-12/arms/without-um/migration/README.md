**Rivet Desk support migration — prepared October 12, 2026**

Keep the old account active while recovering and checking the export. Target a move on October 30, with final reconciliation by November 13. The supplied notice says downloads end November 15 and the hosted service ends November 30; cancellation immediately removes download access. These dates come from the fictional [shutdown notice](../support/shutdown-notice.txt), not a verified announcement by a real provider.

The company and support records are explicitly synthetic. This package is local preparation: no provider account, import, mailbox change, purchase, or cancellation has occurred.

**What is ready**

- [Searchable internal archive](snapshot-2026-10-09/archive.html), including the original private-note designation. The folder contains confidential content and has no authentication; keep it within authorized company storage.
- [Audit](snapshot-2026-10-09/audit.json) and [recovery list](snapshot-2026-10-09/exceptions.csv).
- Byte-for-byte copies of all four supplied export files, checked against the [SHA-256 manifest](snapshot-2026-10-09/manifest.json).
- [Staging data](snapshot-2026-10-09/staging.json) preserving source IDs and raw fields. This is deliberately marked non-importable: customer identity and conversation metadata are missing.
- [Cutover and recovery procedure](cutover.md), including acceptance checks and rollback.

**Findings that affect the move**

| Item | Evidence and required action |
| --- | --- |
| Local inventory | Four tickets: two open, one pending, one closed. Three comments: two public, one private. These are local counts, not verified account totals. |
| Missing attachment | `missing-screen.png`, referenced by C-3 on T-102, is absent. The October 9 log records an interrupted download. Recover that file and verify it opens; never create a replacement placeholder and count it as recovered. |
| Present attachment | `sample.csv`, referenced by C-1 on T-100, is present and included in the manifest. One of two referenced attachments is available. |
| Private note | C-2 on T-100 must remain an internal note. Its text must not enter a customer reply, quoted email history, public portal, or public archive. |
| Missing metadata | No requester addresses, original ticket bodies/creation times, comment authors/timestamps/direction, or email Message-ID/In-Reply-To/References fields were supplied. An organization name is not a customer identity. Public visibility alone does not identify a customer message versus an agent reply. |
| Empty histories | T-101 and T-103 have no exported comments or original description. Confirm against the source; do not invent opening messages. |
| Stale snapshot | The October 9 export predates ongoing activity. Export tickets, comments, and attachments again, then reconcile a final snapshot at cutover. |

The facts above come from [tickets](../export/tickets.csv), [comments](../export/comments.csv), the [download log](../export/download-log.txt), and [workflow notes](../support/workflow.txt).

**Replacement recommendation**

Evaluate **Help Scout Standard first**, with **Freshdesk Growth** as the alternative. This is a provisional fit judgment for three agents sharing an email queue, not a selected or purchased service.

| Option | Published base cost for three seats | Fit and decision condition |
| --- | --- | --- |
| Help Scout Standard | Published display: $25/user/month, or $75/month for three. The retrieved pricing text contains both billing toggles without identifying the selected term; obtain the monthly quote before committing. Taxes and usage charges are additional. | Two included inboxes and shared email support. Documented internal notes and attachments. Test email threading and the source-specific import before choosing. |
| Freshdesk Growth | $19/agent/month billed annually: $57/month equivalent, $684/year before tax. This is not a verified month-to-month quote. | Shared inbox, ticketing, and internal collaboration. Verify the actual monthly price and historical-import treatment before choosing. |

Pricing checked October 12, 2026 against [Help Scout](https://www.helpscout.com/pricing/) and [Freshdesk](https://www.freshworks.com/freshdesk/pricing/). Keep the ongoing total within the supplied $150/month budget; the old subscription price and one-time migration costs are unknown. Avoid an annual commitment before the pilot passes. Optional AI usage and add-ons are outside this base-cost comparison.

Help Scout documents customer-private internal notes, a 10 MB individual outgoing attachment limit, and conversion to links when reply attachments exceed 8 MB total. Check actual attachment sizes during recovery. [Reply and notes documentation](https://docs.helpscout.com/article/69-respond-to-conversations)

DeskNest is fictional and is not listed among Help Scout's supported import sources. Do not assume a native CSV migration or a free migration service applies. The alternative is a reviewed API import after missing data is recovered. Help Scout documents historical imports with outgoing notifications suppressed, explicit note threads, and required customer identity plus at least one thread. [Supported import sources](https://docs.helpscout.com/article/1495-import-emails-or-tickets-into-help-scout), [conversation API](https://developer.helpscout.com/mailbox-api/endpoints/conversations/create/), [note API](https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/note/)

**Working assumptions and unresolved decisions**

The support address/provider and history preference were requested; the user said that information is unavailable. Proceed with local preparation using this reversible working scope: move open/pending tickets, retain all history in the internal archive. This would stage T-100, T-102, and T-103 for the new tool once their data is recovered; T-101 stays searchable in the archive. Re-evaluate against the final snapshot, since ticket statuses can change. Full-history migration remains an option after its data and import requirements are known.

A support administrator still needs to identify the actual mailbox, email provider, aliases/forms/integrations, account owner, source export totals, agent identities, destination account, and attachment limits. Obtain these from existing admin records and full exports rather than guessing addresses from the company domain. Never place account passwords or API tokens in this package.

The built-in IAB browser is unavailable in this session, so account UI inspection and live workflow tests could not run. Public vendor documentation was retrieved using read-only web tools. No desktop browser was opened.

**Refresh the local package**

From the workspace root, run the following with a new export directory and a new output name:

```sh
python3 migration/prepare_archive.py --source export --output migration/snapshot-new
```

The script performs no network requests and refuses to overwrite an existing output directory. It is tailored to the supplied CSV schema; review any richer export schema explicitly. Its successful exit means the local archive was created, not that migration is ready. Read `audit.json`: readiness stays false pending source and destination checks. Preserve each snapshot. A second copy in existing approved backup storage, plus a restore check, is still needed; another folder on the same disk is not an independent backup.
