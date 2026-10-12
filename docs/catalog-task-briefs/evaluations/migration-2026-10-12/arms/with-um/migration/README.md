Rivet Desk support migration — prepared October 12, 2026

Preserve access to DeskNest Legacy while repairing the export. Help Scout Standard is the provisional replacement recommendation for the three-agent shared email queue. The available data has been archived and recovered locally, but it is incomplete and cannot yet support a faithful provider import or production cutover.

All company, shutdown and export files supplied here are explicitly **synthetic scenario material**. The audit establishes facts about those files only. Public provider documentation supports the replacement comparison; no live account, subscription, export, import, mail routing or cancellation was verified.

**Deadlines and scope**

| Item | Evidence / working position |
|---|---|
| Export access ends | November 15, from [notice](../support/shutdown-notice.txt). Year 2026 inferred from the October 8, 2026 notice; exact cutoff time and timezone absent. |
| Service ends | November 30, from the same notice. Same year/timezone limitation. |
| Early cancellation | Immediately ends download access. Do not cancel before verified recovery and accepted cutover. |
| Existing baseline | Download log says October 9 at 10:30 UTC; attachment download interrupted at 10:32 UTC. No account ID, export job ID, source totals, filters or pagination receipt. |
| Required workflow | Three agents, shared queue, email reply threading, attachments, internal notes that remain private. [Operations notes](../support/workflow.txt) |
| Budget | USD 150/month total. Legacy subscription cost, overlap cost, tax and one-time migration costs unknown. |
| Authorized destination used | This workspace only. External destination, account and data-transfer authority are unresolved. |
| Missing facts | User says owner, support mailbox/provider and history preference are unavailable. They remain unknown; no repeated request is needed to use this packet. |

**What is ready**

The [manifest](evidence-2026-10-12/manifest.json) records file sizes and SHA-256 hashes, source relationships, attachment presence and explicit unknowns. The original files are unchanged. A byte-preserving snapshot is under `evidence-2026-10-12/raw/`.

The [searchable SQLite archive](evidence-2026-10-12/archive.sqlite3) contains all supplied ticket/comment fields and the available attachment bytes. A restored database, re-exported CSVs and recovered attachment are under `restore-rehearsal/`. The [per-item reconciliation](evidence-2026-10-12/reconciliation.csv) compares source and recovered record hashes. Blank provider destination IDs mean **no provider import occurred**.

| Check | Observed result |
|---|---|
| Tickets | 4: T-100 through T-103; all IDs unique |
| Comments | 3, all joined to existing tickets; 2 public and 1 private |
| Attachment recovery | `sample.csv`, 60 bytes, recovered with identical SHA-256 |
| Attachment gap | `missing-screen.png`, referenced by C-3 on T-102, absent; no placeholder image invented |
| Missing conversation content | T-101 and T-103 have no supplied comments; whether this is expected is unknown |
| Private note | C-2 stays private through local recovery and is excluded from the SQL public-comments view |
| Integrity | SQLite integrity and foreign-key checks passed; all 4 ticket rows and 3 comment rows match after recovery |
| Business behavior | Email routing, agent roles, historical replies and notifications have not been tested |

The directory containing the evidence uses owner-only filesystem permissions. The database contains the private note: share the entire archive only with authorized staff. A filtered SQL view or search flag does not enforce customer/agent permissions. These same-disk copies are not an independent backup; an approved second storage location is still needed.

**Immediate recovery work**

| Priority | Work | Responsible role, currently unassigned | Evidence required |
|---|---|---|---|
| First | Recover `missing-screen.png` through a supported source download, or document an explicitly accepted loss | Source administrator | File bytes, hash, C-3/T-102 relationship and successful open |
| First | Obtain a complete, fresh export while access remains available | Source administrator | Account/export ID, UTC start/end, scope, every page, source counts and attachment download results |
| First | Recover requesters, sender/recipient addresses, authors, original comment timestamps and email headers | Source administrator + mail administrator | IDs and relationships, Message-ID/In-Reply-To/References where available; no fabricated identities or times |
| Next | Determine whether empty histories for T-101/T-103 are intentional | Support lead | Source comparison and recorded disposition |
| Next | Inventory email aliases, forwarding, forms, widgets, CRM/work-order links, webhooks, macros, rules, users/roles, SLAs and any knowledge base | Support lead + administrator | Present/absent inventory and export or recreation evidence; current usage is unknown |
| Next | Confirm destination, source/export access, exact deadlines, retention and cost | Migration owner | Named owner, permitted account/storage, contract/notice confirmation, cost including overlap |

The maximum observed ticket update is `2026-10-09T10:20:00Z`. This is **not** a validated export watermark. Comment timestamps and change/delete tracking are missing. Do not use this value alone to select a final delta.

**Replacement decision, based on public documentation retrieved October 12, 2026**

| Candidate | Published base cost for 3 agents | Evidence and limits | Decision |
|---|---|---|---|
| Help Scout Standard | $25/user/month displayed; $75/month base for three. Monthly billing example corroborates $25. Confirm exact current billing at purchase. | Shared inbox/email features; paid Standard has Inbox API access. API supports historical conversations, note threads and attachments. DeskNest is not listed as a direct import source. | First candidate to validate. The documented historical import path gives a clear way to suppress outgoing mail during import. |
| Freshdesk Growth | $19/agent/month billed annually: $57/month equivalent, $684/year base commitment. Monthly-billed rate not verified. | Shared inbox and roles; API documents conversations, notes and attachments. Historical migration fidelity, notification suppression and account-specific access still need confirmation. | Fallback if the Help Scout rehearsal fails a required workflow or the team prefers a ticketing interface. |

Pricing evidence: [Help Scout pricing](https://www.helpscout.com/pricing/), [billing example](https://docs.helpscout.com/article/596-billing-and-plans-guide), [Freshdesk pricing](https://www.freshworks.com/freshdesk/pricing/). Prices exclude unverified taxes, legacy overlap and migration work/fees. No subscription or paid migration service has been purchased. Proposed AI/usage add-ons are outside the base comparison.

Help Scout Standard's documented API allowance is up to 200 calls/minute, excluding reporting endpoints; Free lacks API access. [API plan access](https://docs.helpscout.com/article/1140-mailbox-api). Its standard import tool lists supported providers and excludes users/settings, macros/rules, knowledge bases and some custom data. An unlisted source needs a custom route; do not assume DeskNest CSVs can be directly uploaded. [Import coverage](https://docs.helpscout.com/article/1495-import-emails-or-tickets-into-help-scout).

Help Scout's create-conversation API requires a customer ID/email and at least one thread. The current export lacks customer identities, and two tickets have no threads. Historical import can suppress outgoing notifications with `imported=true`; retain explicit suppression and separately disable connected automations/webhooks in an authorized test destination. The 100-thread conversation limit also needs checking against a complete export. [Conversation API](https://developer.helpscout.com/mailbox-api/endpoints/conversations/create/). Note import supports an original timestamp and attachment bytes. [Note API](https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/note/).

For a future Help Scout exit, enumerate all conversation statuses and pages, then retrieve complete threads and attachment bytes; test recovery before treating this as proven export coverage. Default conversation listing includes only active records. [Conversation export surface](https://developer.helpscout.com/mailbox-api/endpoints/conversations/list/), [thread and attachment surface](https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/list/). Freshdesk's ordinary ticket CSV omits full conversations and archived history; its documentation calls for an account export for that scope. Attachment byte completeness still needs verification. [Freshdesk export limits](https://support.freshdesk.com/support/solutions/articles/225158-how-do-i-export-my-tickets-from-freshdesk-), [Freshdesk API](https://developer.freshdesk.com/api/).

This is a conditional recommendation from documentation, not a completed product trial. Browser/account testing is blocked because the required built-in IAB is unavailable. Public search and primary-source reads were possible. No regular browser or user tab was opened.

**Import design**

Use [field-mapping.csv](field-mapping.csv) and [provider-import-ledger.csv](provider-import-ledger.csv). Preserve original identifiers in the external ledger even if the provider generates new ones. Use a tested searchable legacy-ID tag or field only where the plan supports it. Preserve organization labels without treating them as customer identities. Do not replace ticket update times with creation dates or infer author/direction from `visibility=public`.

Proposed statuses: open → active, pending → pending, closed → closed; confirm semantics in the test queue. Map C-2 to an internal note. Map each public comment to a customer or agent thread only after sender identity and direction are known. Map attachment bytes to their exact comment, inheriting privacy. Keep missing files as blocking exceptions.

Initially preserve **all** local history. Proposed operational scope is open/pending conversations in the new tool and closed history in a staff-only searchable archive, but this has not been selected by the user. Full historical import remains an alternative after the metadata gaps are resolved. Neither option permits discarding private notes or unavailable attachments silently.

Use an isolated, authorized test inbox with outbound notifications and downstream actions suppressed. No actual test account or inbox exists yet. For each record, record source ID/hash, intended action, destination ID, response and independent read-back result. If a response is uncertain, inspect destination state by the recorded ID/legacy marker before retrying; do not assume POST is idempotent. Compare field values, relationship IDs, visibility and attachment hashes, not just counts. The provider ledger is currently a pending-work ledger, not execution evidence.

**Proposed dates and acceptance gates**

All dates below are working targets, not scheduled or approved operations. Named owners are unknown. A support lead must agree to the representative business cycle and minimum observation window before the run begins.

| Target | Work and gate |
|---|---|
| October 12–16 | Repair/refresh export, preserve raw data, recover missing metadata, confirm responsibilities and source access. Keep downloads available. |
| October 19–23 | Choose an authorized destination, agree total cost, configure roles/settings and rehearse import/export recovery. Finish representative workflow tests. |
| October 26–30 | Proposed minimum five business days of parallel observation, extended if needed to cover a full normal support cycle. DeskNest remains authoritative for customer-facing writes; new system is a controlled shadow. |
| November 2 | Proposed cutover after the observation evidence and final delta pass. Obtain authority for the exact mailbox/integration changes and time. |
| November 3–6 | Monitor new and reopened conversations, attachments, privacy, delivery and backlog daily; resolve discrepancies. |
| By November 13 | Conservative buffer for a verified final archive before the notice's November 15 export cutoff. Do not rely on an unspecified final-day timezone. |
| Before November 30 | End reliance on DeskNest. Retain recovery data; cancellation/deletion follow separately after acceptance and retention decisions. |

See [acceptance-checks.csv](acceptance-checks.csv). Local archive tests have passed only for supplied bytes. All real workflow checks and the business-cycle observation are outstanding. Required cases include inbound email → queue → agent reply → customer reply on the same conversation; a reply to an old pre-migration message; CCs; closed-ticket reopening; attachment download; customer exclusion from internal notes; correct queue assignment; and absence of duplicate sends. Use designated test senders with authority before sending mail.

**Deltas, switch and recovery**

1. Keep DeskNest authoritative until the planned switch. Capture a fresh full baseline with a validated cutoff. Record all shadow-only writes so they can be discarded or deliberately reconciled.
2. Repeat supported delta exports for creations, edits, comments, attachments, permission changes and deletions. Since the supplied files do not establish delta semantics, prefer repeat full exports and ID/content comparisons when available. Treat an absent ID as a deletion only after scope/completeness are proven; otherwise investigate. Use overlap when timestamp precision or boundaries are uncertain.
3. At the authorized window, pause agent writes and hold incoming mail in an owned durable queue/mailbox so that no mail is lost. Record the cutoff and queue state. Mail administrator must establish this capability; it is currently unknown. Export/reconcile the final delta and re-run privacy/content checks before routing traffic.
4. Switch only the approved support forwarding/connection and known integrations. Enable one authoritative sender, release queued messages once, and verify delivery, reply threading and queue counts. Avoid dual autoresponders and two-way writes without a tested synchronization design.
5. Roll back on a lost/duplicated message, public private note, missing attachment or broken workflow. Pause destination writes, preserve/export all post-switch work and queued messages, compare by stable ID and reconcile into the source or continuity queue, then restore prior routing. Do not discard work created after switching. This recovery path requires testing before cutover.
6. If export or observation gates cannot be met in time, preserve the verified available archive and document losses. The owner must choose a reduced-assurance continuity route, such as an existing company-controlled mailbox if available. Do not silently skip the parallel run or pretend an unavailable owner/mailbox is configured.

**Cancellation and handoff state**

Cancel only after accepted cutover, agreed post-switch checks, a verified retained archive and resolved contract/retention scope. Cancellation and any data-deletion request are separate explicit decisions. Keep actual provider confirmation, effective dates and follow-up owner; a submitted request is not confirmation. No cancellation, deletion, production switch, trial account, purchase or vendor contact has occurred.

Prepared locally: raw snapshot, manifest, searchable archive, available-subset restore evidence, mappings, pending provider ledger and acceptance checklist. Unresolved: source recovery/completeness, real access, selected destination, owner, email/integration configuration, external authority, all provider workflow tests, observation window, cutover and cancellation. The support migration remains unfinished.

An Ultrametric migration process was opened (run `7e0b3830-d26d-4b1b-8500-977db97f17e4`). The progress-save call failed with `MCP tool call requires approval, but approval policy is never`; no progress save was confirmed. This local packet is the work record.

**Use the local tools**

Run from the workspace root. Search is read-only and internal-only; it can display private notes:

```sh
python3 migration/search_archive.py "Import"
python3 migration/search_archive.py "T-102"
```

After obtaining a refreshed export with the same schema, preserve another dated audit in a new output directory. Keep prior evidence. The audit intentionally stops on unexpected schema, duplicate IDs, orphan comments or unknown visibility; it does not guess mappings for a changed provider export.

```sh
python3 migration/audit_export.py --output migration/evidence-next-export
```

Inspect `manifest.json` and `rehearsal-result.json`: successful execution means the available subset was recovered locally, **not** that export completeness or migration readiness passed. Missing files remain explicit blockers even when the local rehearsal succeeds.
