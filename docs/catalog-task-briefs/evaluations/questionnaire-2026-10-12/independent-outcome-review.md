# Independent questionnaire outcome review

**Both arms produced factually sound, usable internal drafts. This case does not demonstrate a factual quality lift or a substantive guide defect.** UM adds more explicit reviewer routing, attachment-disclosure boundaries and handling of portal qualifications. It also flags more rows for review, including answers whose present qualified wording is already supported. That is a tradeoff in handoff detail and review burden.

This is an independent inspection of actual outputs from one author-visible synthetic, control-first case. The reviewer had access to the case and guide. It is not a blind holdout, a new model judgment run or an aggregate causal comparison. No scalar scores were assigned. No performer call, original-output edit or external action was made for this review.

## Checks and factual coverage

Both source sets match the frozen source hashes. Both saved CSVs preserve the original six columns and all ten question IDs in order, with unchanged question text and allowed-response values. Every answer, evidence and review field is populated. All constrained Yes/No/Partial and date responses fit the permitted format, and the cited source-file references resolve. See [independent checks](independent-checks.json).

Both distinguish the same material facts:

- Optional helpdesk MFA prevents an all-staff enforcement claim. Draft policy intent does not establish implementation.
- No SOC 2 audit has occurred. Encryption evidence covers encrypted database backups and load-balancer TLS; other coverage remains unknown, without asserting that unverified components are unencrypted.
- The restoration date is qualified to the recorded database-only exercise. Neither claims attachment restoration was tested or treats 87 minutes as a recovery commitment.
- Notification follows contract-specific clauses; neither accepts a universal 24-hour incident promise. Weekday support is not converted into 24/7 support.
- The 30-day deletion proposal is unsigned; attachment deletion remains manual with an unfinished runbook. Neither invents an approved deadline or completed deletion automation.
- Recorded access approvals are distinguished from an approved general privileged-access rule. A proposed two-working-day triage target is not a remediation SLA.

Both list exactly the supplied synthetic subprocessors and retain register-completeness uncertainty. Each arm asked a relevant factual question and received the source-bounded reply “That information is not available.” Control asked about approved deletion/remediation deadlines; UM asked more broadly about newer evidence and customer-specific clauses. Neither filled those gaps with invented facts.

## Usability and review burden

Control provides a populated CSV and a readable evidence/review note. Its five review flags cover encryption, subprocessor completeness, deletion, privileged-access approval and remediation. Supported negative or qualified answers remain usable with their existing caveats.

UM provides the same core deliverables and eight review flags. Its notes identify proposed reviewer roles, distinguish drafting permission from permission to disclose underlying files, and say that a portal unable to carry necessary qualifications leaves the affected representation unresolved. These are useful handoff details; they are not verified customer approvals or portal tests.

The extra flags are Q01, Q04 and Q05. Q01 already supports “Partial” because helpdesk MFA is optional; complete account coverage is needed for a stronger assurance, not to establish the stated exception. Q05 already supports “No” to a universal commitment; reviewing the customer's clause is necessary before supplying a specific deadline or new promise. Q04's additional success/currentness and full-service-scope check is more plausibly decision-relevant: the source records a completed database exercise, without underlying test results. Both retain that limited scope beside the date.

Do not interpret eight versus five flags as eight versus five factual errors, or assume every proposed reviewer must clear a new blocker before an internally qualified draft can be useful. Neither package submits anything. The user still needs the appropriate final review before making customer representations. The source questionnaire's evidence column carries important qualifications; dropping it during later portal entry would require another format check.

## Guide conclusion

No substantive guide-correctness change is justified by this observed pair. The current guide's distinctions between intended controls, observed operation, approved commitments and permitted evidence disclosure appear in the UM output, but the control independently handled the core factual traps too. Additional review flags show possible review-burden ambiguity, not a demonstrated false assurance or failed completion. Retain that observation for later cases rather than adding a new compulsory gate from this result.

## Protocol and resource limits

| Observed resource | Control | UM |
|---|---:|---:|
| Gross input + output tokens | 153,408 | 170,049 |
| Cached input within total | 126,336 | 135,040 |
| Uncached input | 21,995 | 29,239 |
| Output tokens | 5,077 | 5,770 |
| Native turn duration | About 182 seconds | About 187 seconds |

Both completed and the controller finished cleanly. UM retrieved `answer-a-security-questionnaire` preview version 3 matching the pinned candidate, with `list_processes` and `get_context` also called. No `open_process` or `save_update` call occurred. This case tests local drafting and handoff; portal persistence, final approval, disclosure permissions, submission, customer acceptance, real control operation and memory reuse remain unverified. Gross tokens are not a dollar-cost estimate.

Evidence: [transcript](transcript.json), [assessment metadata](metadata.json), [control CSV](arms/without-um/deliverables/questionnaire-completed.csv), [control review note](arms/without-um/deliverables/questionnaire-review.md), [UM CSV](arms/with-um/deliverables/questionnaire-draft.csv), [UM review note](arms/with-um/deliverables/review-notes.md).

Public-bundle curation: source/output artifacts and independent checks retain their original bytes. Report links are rebased; the metadata and transcript omit private native/account identifiers and configuration as described in [metadata](metadata.json).
