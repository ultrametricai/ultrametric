# Security questionnaire review notes

Prepared 2026-10-12 for Rivet Desk's maintenance work-order software. The [completed draft](questionnaire-draft.csv) preserves all 10 questions and the original six columns. All answer fields are populated, but unknowns remain explicit. It is ready for internal review, not an approved customer representation.

The company record and supporting files identify themselves as synthetic pilot material. These answers describe that supplied scenario; they do not establish controls at a real company or constitute an audit. Source snapshot: 2026-10-10. Operational statements rely on the individual source dates below, not a live inspection.

The user confirmed that newer evidence and customer contract details are unavailable. Customer identity and deadline are unspecified. The working scope is the supplied Rivet Desk service and CSV. No customer submission, portal save, external message, or evidence attachment disclosure has occurred. Review owners below are proposed roles, not confirmed assignments or approvals.

## Answer and evidence map

| ID | Draft answer / status | Evidence and date | Proposed reviewer and unresolved point |
| --- | --- | --- | --- |
| Q01 | **Partial — qualified.** Reviewed engineering and contractor accounts enforce MFA; support/helpdesk MFA is optional. | [Access review](../security/access-review.csv), 2026-09-30; [draft policy v0.4](../security/security-policy.txt), 2026-08-12. | Engineering lead and Operations lead: establish coverage of every staff account. The draft all-staff target is not implemented evidence. |
| Q02 | **No — supported by supplied record.** No SOC 2 audit has occurred. | [Operations record](../security/operations-evidence.txt), 2026-10-02. | No additional factual gap identified. Do not imply a report exists or is in progress. |
| Q03 | **Partial — qualified; remaining coverage unknown.** Encrypted database backups and TLS at the load balancer are recorded. | [Operations record](../security/operations-evidence.txt), 2026-10-02. | Engineering lead: verify production database and attachment encryption at rest, backup coverage, and all customer-data transit paths. Missing evidence does not prove plaintext storage or transmission. |
| Q04 | **2026-05-14 — qualified.** Last recorded completed restore exercise: 87 minutes, database only. | [Operations record](../security/operations-evidence.txt), 2026-10-02, describing the 2026-05-14 exercise. | Engineering lead: confirm success criteria and that no newer successful test exists. Attachments were not tested; underlying results were not provided. If the customer requires a full-service restoration date, the supported answer is **Unknown**. |
| Q05 | **No — supported for a universal commitment.** Notification follows contract-specific clauses. | [Operations record](../security/operations-evidence.txt), 2026-10-02. | Counsel or contract owner: determine the actual customer clause before inserting a deadline. This answer does not deny any existing contract obligation. |
| Q06 | **Listed providers — qualified.** Example Hosting (synthetic): customer records for application/database hosting. Example Mail (synthetic): addresses and message content for transactional mail. | [Subprocessor register](../security/subprocessors.csv), provider reviews 2026-08-20 and 2026-06-05 respectively. | Operations lead or privacy owner: confirm completeness and current applicability to the service. No locations or additional providers are inferred. |
| Q07 | **Unknown committed period.** Proposed 30 days is unsigned; database deletion exists, but attachment deletion is manual and its runbook unfinished. | [Draft policy v0.4](../security/security-policy.txt), 2026-08-12; [SEC-18](../security/deletion-ticket.txt), open 2026-09-25. | Engineering lead plus privacy or contract owner: establish database, attachment and backup deletion timing, and contract alignment. Backup purge timing is unknown. |
| Q08 | **No — supported by supplied record.** Support is weekdays 09:00–17:00 Eastern time. | [Operations record](../security/operations-evidence.txt), 2026-10-02. | No additional factual gap identified. No after-hours or 24/7 incident-response coverage is inferred. |
| Q09 | **Engineering lead for reviewed cloud administrator access — qualified.** General privileged-access approval policy is unsigned. | [Access review](../security/access-review.csv), 2026-09-30; [draft policy v0.4](../security/security-policy.txt), 2026-08-12. | Engineering lead and Operations lead: confirm the approved process and system coverage. Support approval by Operations lead does not establish whether that role is privileged. |
| Q10 | **Unknown approved remediation SLA.** Draft proposes triage within two working days only. | [Draft policy v0.4](../security/security-policy.txt), 2026-08-12. | Engineering lead plus contract owner: establish approved remediation deadlines and any applicable customer commitments. Triage is not remediation. |

Eight rows have review actions (Q01, Q03–Q07, Q09–Q10). Q02 and Q08 have no additional factual gap in the supplied records. No row has been classified as out of scope. Draft policy targets and observed operations are kept distinct; neither a proposed control nor missing evidence is treated as an implemented control.

## Handling the draft

The CSV `answer` column uses the exact allowed choices for constrained questions. The `evidence` column contains the qualifications necessary to interpret those choices; `review_needed` identifies proposed owners and specific issues. Preserve these qualifications in any customer response. If a portal cannot carry them, the affected answer remains unresolved for that format rather than becoming an unqualified assurance. In particular, do not present Q03 as evidence of complete encryption coverage or Q04 as a complete service restoration test.

All source links are for internal review. Permission to read these files for drafting does not establish permission to send the underlying access review, policy, operational notes, internal ticket, or subprocessor register to a customer. Attachment disclosure permission is unconfirmed for every source. No attachment is approved or included for external delivery. Provider names are explicitly synthetic and must not be presented as real vendors.

The proposed 30-day deletion period, universal incident notification deadline, general access-approval policy and two-working-day triage target are not new commitments made by this draft. Unknown answers can remain honestly disclosed if the customer accepts them; no missing fact has been filled with an assumed control or deadline.

## Validation

The exported CSV was reopened and checked against the source: same six columns, same 10 identifiers in the same order, unchanged question text and allowed-response values, no blank answer/evidence/review fields, and valid constrained choices and date format. This checks the local file only; no portal rendering, customer acceptance, reviewer approval or control operation has been verified.
