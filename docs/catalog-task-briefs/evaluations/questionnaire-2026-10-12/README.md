# Security questionnaire evaluation evidence

Both arms produced usable internal questionnaire drafts with supported answers and explicit unknowns. UM added proposed reviewer routing, evidence-disclosure boundaries and portal qualification handling. It also flagged more rows for review. This case supports no factual quality lift claim and identifies no substantive guide-correctness fix. See the [independent review](independent-outcome-review.md) and [checks](independent-checks.json).

This is one author-visible synthetic case, executed control first on 2026-10-12. The operator inspected the control before the UM match; the reviewer had access to the case and guide. The actual prompt was `help me answer this customer's security questionnaire`. The same model/runtime and source packet were used in separate workspaces, with the local UM candidate fixture available only to the UM arm. No scalar scores or aggregate estimates were produced.

## Inspect the evidence

| Material | Control | UM |
|---|---|---|
| Original form | [Questionnaire](arms/without-um/request/questionnaire.csv) | [Questionnaire](arms/with-um/request/questionnaire.csv) |
| Company facts | [Synthetic company](arms/without-um/company/company.json) | [Synthetic company](arms/with-um/company/company.json) |
| Answer artifact | [Completed CSV](arms/without-um/deliverables/questionnaire-completed.csv) | [Draft CSV](arms/with-um/deliverables/questionnaire-draft.csv) |
| Review artifact | [Evidence and review notes](arms/without-um/deliverables/questionnaire-review.md) | [Review notes and proposed owners](arms/with-um/deliverables/review-notes.md) |

The original `security/` files beside each arm's form supply the unsigned policy, operating evidence, access review, subprocessor register and deletion ticket. Every fictional input and performer output is preserved with its original bytes under `arms/`. The [artifact manifest](artifact-manifest.json) lists paths, roles, lengths and SHA-256 hashes. It covers this case subtree except itself; shared parent-directory configuration is outside that manifest.

The [curated transcript](transcript.json) includes the actual prompt, assistant messages and factual follow-ups in their recorded order. Each arm received `That information is not available.` in response to its actual question: approved deletion/remediation deadlines for control, newer approved evidence or customer-specific terms for UM. The [metadata](metadata.json) records the exact questions, model, runtime, candidate revision, retrieved guide hash, resource use and tool calls.

## Observed outcome

Both arms preserved all ten question IDs in order, the six original columns, question wording and response formats. Both filled answers, source references and review states. They retained the material limits on MFA, encryption, database-only restoration, contract-specific incident notice, deletion, access approval and vulnerability triage. Neither invented a SOC 2 report, approved deletion/remediation deadline or universal incident-notification commitment.

Control flagged five rows; UM flagged eight. The extra flags concern MFA coverage, restoration scope/currentness and the customer's incident-notification clause. The existing Partial MFA and No universal-notice answers already have supporting evidence, so these added flags do not demonstrate corrected factual errors. UM's proposed reviewers and disclosure/portal notes can help a handoff, while requiring more reviewer attention. Review flags are distinct from submission approval and from a claim that the company meets a control.

| Observed resource | Control | UM |
|---|---:|---:|
| Gross input + output tokens | 153,408 | 170,049 |
| Uncached input tokens | 21,995 | 29,239 |
| Native turn duration | About 182 seconds | About 187 seconds |

Gross totals include repeated cached input. They are not a dollar-cost estimate. Both arms completed within the recorded limits and the controller finished cleanly.

## Provenance and limits

The tested public candidate was `110ff2631ac0adf37f5325c123391af643a4a7c5`, record `comp_014`, retrieved through local MCP as `answer-a-security-questionnaire` preview version 3. The retrieved instructions matched the pinned candidate; their SHA-256 is `b612e31e5a0b7129ff2833c69987848a3431a2b011f12e19d4c1fb7cbf322a1a`. The model was `gpt-6-astra` at `xhigh`, standard/default service tier. This verifies local candidate retrieval, without testing marketplace installation or current production visibility.

UM called `list_processes`, `get_context` and `get_process`. Context contained the synthetic company and no saved runs, records or updates. It made no `open_process` or `save_update` call. This result does not validate cross-agent memory reuse.

Completion here means saved internal drafts suitable for review. No customer portal, final security/legal approval, permission to disclose source attachments, customer submission/acceptance or actual control operation was verified. Necessary qualifications sit partly in the evidence column; moving answers into another portal would require preserving those qualifications and checking the destination format.

Raw native logs, personal instructions/configuration, account identifiers, numeric credit balances, credentials and private endpoints are excluded. Metadata is explicitly curated; transcript internal IDs are omitted and output links are rebased to this bundle. Source/output files required no redaction. The full private runtime is not reproduced by this bundle. No new performer run, original-output edit or external action was undertaken for this review.
