**Proposed cutover procedure — no steps below have been executed against a live service**

Roles are placeholders: support lead, source administrator, mail administrator, and migration operator. Name the owners before scheduling the switch. All dates below are proposed for 2026; the notice does not state the exact export-cutoff time or timezone, so finish recovery before November 15.

| Target | Owner | Deliverable / gate |
| --- | --- | --- |
| October 12–16 | Source administrator | Recover the missing screenshot; obtain a full export with identities, bodies, author/direction/timestamps, headers, and attachment inventory. Reconcile source totals. Preserve originals and verify an independent backup. Keep the subscription active. |
| October 19–23 | Support lead + migration operator | Evaluate the two shortlisted tools with the four representative tickets, using controlled test identities. Confirm price, attachment limits, import behavior, private notes, and reply threading. Record the chosen tool and history scope. |
| October 26–29 | Mail administrator + support lead | Inventory all incoming routes, document existing routing for rollback, prepare three agents and shared queue, record destination IDs, and train agents on replies versus notes. Complete acceptance checks before the switch. |
| October 30, during an agreed quiet period | Migration operator + mail administrator | Route new traffic to the tested destination, freeze old-agent replies, collect and reconcile final source changes, and validate live intake before resuming normal work. Exact time remains unset. |
| October 30–November 6 | Support lead | Check both queues and original mailbox daily for stragglers, duplicates, failed sends, or missing attachments. Reconcile every exception and delta. |
| By November 13 | Source administrator | Capture final available full archive and hashes, verify backup restoration and destination completeness, and document remaining gaps. Do not rely on export access after November 15. |
| Before November 30 | Account owner | Finish retirement only after the evidence below is complete and cancellation is explicitly authorized. |

**Source recovery**

Recover `missing-screen.png` from T-102/C-3 in the source, original mailbox, or an existing company backup. Confirm that it is the actual original file. Record byte size and SHA-256 and check that it opens. If recovery fails, retain a clearly recorded missing-file exception; do not call the archive complete. An accepted exception requires an accountable owner and an impact decision for the active ticket.

Request the source's full export, not only the ticket summary CSV. Include users/requesters, original descriptions, all public and private conversation entries, authors, message direction, timestamps, attachments and their stable identifiers, statuses, assignees, and email headers where available. Reconcile against source counts and inspect T-101/T-103. Saved replies, routing rules, integrations, knowledge-base content, and other channels are inventory questions; their existence is not established by the current files.

**Mapping to review if Help Scout is selected**

| Source | Proposed treatment |
| --- | --- |
| Ticket ID | Preserve unchanged in the internal migration ledger and archive; record returned destination conversation ID. Do not assume the new tool will accept the old ID as its own. |
| Organization | Preserve as source metadata; never use it as a substitute for requester identity. Check plan support before depending on a destination organization field. |
| Open / pending / closed | Proposed Help Scout statuses: `active` / `pending` / `closed`. Closed tickets remain archive-only under the working scope. Recheck the final status at cutover. |
| Subject | Preserve. Do not rely on subject alone for matching or deduplication. |
| Original body and comments | Import only after source completeness and direction are established. Preserve each message separately. Missing metadata stays explicitly unknown in the archive. |
| Public comment | Map to customer or agent-reply thread only with verified author/direction. |
| Private comment | Map to an internal `note`. Preserve visibility even if another field cannot be mapped. Unknown visibility is held for review. |
| `updated_at` | Keep as the source modification time. Do not pass it as a fabricated conversation/comment creation date. |
| Attachments | Associate with the original comment, preserve names and bytes, and compare downloaded destination hashes where bytes are preserved. Never silently drop failed files. |

For Help Scout historical creation, explicitly use `imported: true` and `autoReply: false`; the documented import mode suppresses outgoing mail/notifications. Use the equivalent historical mode for appended notes/threads and verify with controlled recipients. These settings do not constitute an executed import. [Conversation API](https://developer.helpscout.com/mailbox-api/endpoints/conversations/create/), [note API](https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/note/)

**Final changes and duplicate prevention**

1. Record each export's start/end time and provider watermark if available. Prefer a new full export: the current files do not establish whether changing a comment also updates the parent ticket's timestamp.
2. Before cutover, maintain a ledger with source ticket/comment/attachment IDs, content hashes, destination IDs, disposition, import outcome, and verification evidence. The local staging file contains no destination receipts.
3. During the switch, pause agents in the old tool; preserve inbound mail in the original mailbox. Route every known intake path to the destination and disable old automatic replies to prevent duplicate customer responses.
4. Export again after routing settles. Compare all records and attachment manifests with the baseline, including existing-ticket changes and newly added notes/files. If only timestamp deltas are available, use an overlapping window and reconcile independently; do not rely on `updated_at` alone.
5. Upsert using stable source IDs and the ledger. On a timeout, check for the prior destination result before retrying creation. Rerunning the same batch must not create duplicates. Changed comment visibility requires an explicit correction, not a second public message.
6. Reconcile each source record to either a verified destination record, verified archive record, or named unresolved exception. Compare counts by status and visibility, plus attachment links/hashes. Closed records that reopen need review for movement into the active queue.
7. Capture stragglers until the old intake is confirmed quiet. Finish their exports by November 13. If any old provider address remains reachable after November 15, arrange and test routing before the cutoff; otherwise the no-go condition remains.

**Acceptance evidence required before live cutover**

| Check | Passing evidence |
| --- | --- |
| Data completeness | Source totals reconciled; ticket bodies and identities recovered; every discrepancy resolved or explicitly accepted by an owner. Current baseline is 4 tickets, 3 comments, and 2 referenced attachments; the final baseline must be recalculated. |
| Private content | C-2 appears only as an internal note to agents and is absent from customer messages/portal views, including quoted history. |
| Attachments | `sample.csv` opens after import and matches its source hash. The recovered screenshot opens on T-102/C-3. Test inbound and outbound attachments and actual size limits. |
| Historical import | No historical customer notifications or duplicate acknowledgments are sent. Original authors/dates remain accurate, or any unavoidable limitation is clearly documented. |
| Threading | Send a new test request, reply as an agent, and reply again as the customer: one correct conversation. Separately reply to a pre-migration email and verify its handling. Missing old headers mean legacy continuity is unproven. If exact continuity cannot be achieved, require an explicit handling decision and train agents to locate/link legacy history. |
| Routing | All aliases, forms and integrations reach the shared queue; outgoing From/Reply-To use the intended address; delivery checks and required domain authentication pass. No forwarding loops or double acknowledgments. |
| Three-agent workflow | Each agent can see the queue, take ownership, reply, add a private note, attach a file, and change status. |
| Repeatability | Replaying an already imported batch produces no duplicate records; new comments on old tickets still arrive. |
| Backup | An independent preserved export can be restored and searched with private-note and attachment associations intact. |

Freshdesk's documentation explains that email headers/identifiers affect threading; copying ticket text alone does not establish continuity. Test the selected tool with actual legacy email structure. [Freshdesk threading documentation](https://support.freshdesk.com/support/solutions/articles/50000011687-understand-threading-logic)

**Rollback and fallback**

Before the switch, save the exact existing routing/settings and the change time. If live mail is lost, duplicated, misthreaded, or exposes private notes, pause destination automation and outgoing replies, preserve received mail, and restore the last tested route. Use only one active replying system. Reconcile messages received by both tools during the overlap before agents resume. Preserve destination records and receipts; do not delete them to conceal a failed import.

Before November 15, returning to the old queue is possible only if the account remains accessible and source export access is preserved. After that date, treat return to the old tool as a last resort because new history may become unexportable. After November 30 it is unavailable. Prepare a tested company-controlled shared mailbox as the continuity fallback once the mailbox owner/provider is identified; the currently missing mail details prevent validating that fallback.

**Cancellation gate**

Cancel only after full and final-change exports are reconciled, attachments are verified or gaps explicitly accepted, private-note isolation and email tests pass, agents are operating in the new queue, rollback/continuity is documented, and an independent backup restores successfully. Obtain explicit cancellation authority at that point. Save the final invoice and cancellation receipt without deleting archives. A successful download or the November 30 shutdown date alone is insufficient evidence to cancel early.
