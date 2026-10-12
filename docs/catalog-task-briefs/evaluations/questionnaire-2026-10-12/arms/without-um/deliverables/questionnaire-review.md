# Security questionnaire draft — Rivet Desk

Prepared 2026-10-12 from the supplied company snapshot dated 2026-10-10 and the records linked below. **The source records explicitly identify themselves as synthetic. This draft preserves that context and does not establish real-world compliance.** Nothing has been submitted to the customer.

The accompanying `questionnaire-completed.csv` preserves the original questionnaire columns and allowed answer formats. Read each answer together with its evidence: several answers have material scope limits. An unsigned draft policy is evidence of a proposal, not an implemented control or approved commitment.

## Suggested answers and supporting evidence

| ID | Answer | Explanation and source |
| --- | --- | --- |
| Q01 | **Partial** | MFA is enforced for the reviewed cloud-console engineering administrator and source-repository contractor accounts. It is optional for the reviewed support helpdesk account, so universal staff MFA enforcement cannot be claimed. [Access review, 2026-09-30](../security/access-review.csv). |
| Q02 | **No** | No SOC 2 audit has occurred, so a current independent SOC 2 report is not available in the supplied record. [Operations record, 2026-10-02](../security/operations-evidence.txt). |
| Q03 | **Partial** | Daily database backups are encrypted and TLS is enabled at the load balancer. Encryption of the live database, attachments, and all other storage and transit paths is not established by these records. No attachment encryption review is recorded. “Partial” describes the documented coverage; it does not establish that unverified components are unencrypted. [Operations record](../security/operations-evidence.txt). |
| Q04 | **2026-05-14** | This is the last recorded completed restoration exercise: 87 minutes, database only. Attachments were not tested; this is not evidence of a full-service restoration test or a contractual recovery-time commitment. [Operations record](../security/operations-evidence.txt). |
| Q05 | **No** | Incident notification follows the applicable contract-specific clause. A universal 24-hour notification commitment for every security incident has not been approved. [Operations record](../security/operations-evidence.txt). |
| Q06 | **Example Hosting (synthetic); Example Mail (synthetic)** | The supplied register lists Example Hosting for application/database hosting, receiving customer records (reviewed 2026-08-20), and Example Mail for transactional email, receiving addresses and message content (reviewed 2026-06-05). These are the documented recipients; register completeness requires confirmation. [Subprocessor register](../security/subprocessors.csv). |
| Q07 | **No approved deletion period is documented.** | An unsigned draft proposes deletion within 30 days after termination. Product database deletion exists, but attachment deletion is manual and its runbook is unfinished. The 30-day period must not be presented as an approved commitment, and deletion automation must not be described as complete. [Draft policy](../security/security-policy.txt); [open ticket SEC-18](../security/deletion-ticket.txt). |
| Q08 | **No** | Support is available weekdays, 09:00–17:00 Eastern time. [Operations record](../security/operations-evidence.txt). |
| Q09 | **Recorded approvals: Engineering lead for cloud-console administrator access and contractor source-repository access.** | The access review also records Operations lead approval for support helpdesk access; it does not establish whether that access is privileged. Engineering lead approval for privileged access is stated in the unsigned draft policy, but an approved rule covering all privileged systems is not documented. [Access review](../security/access-review.csv); [draft policy](../security/security-policy.txt). |
| Q10 | **No approved vulnerability remediation SLA is documented.** | The unsigned draft targets triage within two working days. Triage is not remediation, and the record contains no approved remediation deadlines by severity. [Draft policy](../security/security-policy.txt). |

## Facts to resolve before making stronger claims

The owner suggestions below are routing suggestions, not assignments or established approval authority.

| Questions | Missing fact | Suggested reviewer |
| --- | --- | --- |
| Q03 | Verify encryption at rest for the live database, attachments, and other customer-data stores; verify TLS coverage across all customer-data transit paths. | Engineering lead |
| Q06 | Confirm the register includes every subprocessor receiving customer data and that the purposes and data categories remain accurate. | Person maintaining the vendor register |
| Q07 | Confirm an approved post-termination deletion deadline and its coverage for databases, attachments, backups, and any retained copies or exceptions. Confirm how manual attachment deletion is completed and tracked. | Engineering lead and person authorized to approve retention commitments |
| Q09 | Confirm the approved approver for each privileged system, including whether helpdesk access is privileged. | Engineering lead and Operations lead |
| Q10 | Confirm approved remediation deadlines by severity and when each deadline starts. Keep any triage target separate. | Engineering lead and person authorized to approve security commitments |

For Q01, the supplied access review already supports “Partial”; any stronger answer needs evidence that MFA is enforced across all staff accounts. For Q04, retain the database-only qualification. For Q05, retain “No” unless an authorized reviewer approves a different commitment after reviewing the applicable contract. The records support the negative answers to Q02 and Q08 without an additional policy assumption.

The user confirmed that additional approved deletion and vulnerability remediation deadline information is unavailable. Q07 and Q10 therefore remain explicitly unconfirmed; the proposed 30-day deletion period and two-working-day triage target have not been promoted to commitments. No SOC 2 report, full encryption coverage, complete deletion automation, universal incident deadline, or 24/7 support has been inferred.
