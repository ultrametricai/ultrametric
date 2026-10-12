# Cancellation handling evaluation evidence

Both arms prepared factually supported cancellation packages that honor the customer's decision, preserve paid access and separate cancellation from the CSV and attachment handoff. UM adds more specific operational checks; control already provides a usable concise handoff. No substantive guide defect was found. See the [independent review](independent-outcome-review.md) and [checks](independent-checks.json).

This is one author-visible synthetic case, run control first on 2026-10-12 with the prompt `this customer wants to cancel. help me handle it`. The operator inspected control before the UM match; the reviewer had access to the case and guide. Both arms completed without interruption. There are no scalar scores, holdout results or aggregate estimates.

## Inspect the evidence

| Material | Control | UM-enabled |
|---|---|---|
| Handling package | [Checklist and reply drafts](arms/without-um/cancellation-handling.md) | [Cancellation package](arms/with-um/deliverables/example-maple-cancellation.md) |
| Customer request | [Correspondence](arms/without-um/account/customer-thread.txt) | [Identical correspondence](arms/with-um/account/customer-thread.txt) |
| Account state | [Subscription](arms/without-um/account/subscription.json) | [Identical subscription](arms/with-um/account/subscription.json) |
| Export/access terms | [Terms](arms/without-um/account/terms-and-support.txt) | [Identical terms](arms/with-um/account/terms-and-support.txt) |

All ten source/output files in `arms/` retain their original bytes. The [manifest](artifact-manifest.json) records hashes, roles, byte lengths and original workspace paths. The [transcript](transcript.json) preserves actual questions and replies with internal identifiers omitted and artifact links rebased. The [metadata](metadata.json) records model, candidate revision, guide hash, tool calls, limits and observed resource use.

Control asked for export steps/help links; UM also asked for billing/export owners. Both received the frozen-source reply `That information is not available.` No new procedure, account fact, approval or provider connection was supplied.

## Observed outcome

Both outputs stop retention efforts after the firm cancellation request and refusal of another sales call. Their checklists require billing verification before confirming completion and specify preserving access through October 31 while stopping the November 1 renewal. Export assistance remains separate from cancellation. Both distinguish record CSV from a separate attachment archive, preserve unknown procedures/timing and avoid unsupported feature, refund or migration promises. Retention does not extend download access.

UM additionally specifies invoice readback, reconciliation before retrying an uncertain operation, exact cutoff/timezone gaps, export field coverage, attachment mapping and delivery-completeness checks. Its proposed October 30 internal target is explicitly unaccepted and capacity-dependent. Control's shorter package already includes source links, billing readback, weekday support timing and separate acknowledgment/confirmation drafts.

| Observed resource | Control | UM-enabled |
|---|---:|---:|
| Gross input + output tokens | 97,565 | 170,585 |
| Uncached input tokens | 20,009 | 27,972 |
| Native turn duration | 138.399 seconds | 199.497 seconds |
| Handling-document bytes | 4,453 | 10,024 |

Gross totals include cached input and do not establish monetary cost. The longer UM handoff contains more checks and requires more reading; length and checklist count are not quality scores. These observations do not establish a general factual or quality lift.

UM retrieved `churn-save-attempt` preview 3 from the local candidate fixture and read one synthetic company with no saved history. It did not open a process or save an update. The guide hash matched public candidate `110ff2631ac0adf37f5325c123391af643a4a7c5`. No guide change is proposed from this case.

## Completion and limits

Completion means local preparation. Neither arm changed billing, created an export/archive, delivered data, sent a message, changed a CRM record or deleted anything. No real operator followed the documents. Provider behavior, exact access cutoff, final invoices, export coverage and customer comprehension remain untested. No code replay applies to these document-only outputs; independent hash, source, calendar and local-link checks pass.

The model was `gpt-6-astra`, `xhigh`, default tier. Both arms used the same prospectively revised controller and reserve policy. No interruption occurred in this pair. Local MCP availability does not demonstrate marketplace installation or production operation, and empty-history context reads do not demonstrate cross-agent memory benefit.

Full native logs, private configuration, runtime/account identifiers, credentials and numeric credit balances are excluded. Curated metadata documents reactive monitoring and observation gaps without claiming complete billing attribution. Original fictional files are preserved unchanged.
