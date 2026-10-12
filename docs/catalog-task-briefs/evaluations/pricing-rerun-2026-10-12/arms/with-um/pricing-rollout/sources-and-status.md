# Sources, assumptions and workflow status

Prepared October 12, 2026. Local artifacts are the deliverable of record for this synthetic task.

## Company sources

| Source | Established facts | Limits |
|---|---|---|
| [Company record](../company/company.json) | Fictional Rivet Desk, maintenance work-order SaaS, US and Canadian customers, October 10 snapshot date | Explicitly synthetic; no real accounts, people, results or receipts |
| [Pricing proposal](../billing/pricing-proposal.txt) | October 1 proposal: Team $99→$129/month, Business $249→$299/month; November 1 new-buyer target; annual ten times monthly; founder wants impact preview | Proposal, not pricing approval; no prices or subscriptions changed |
| [Commitments](../billing/commitments.txt) | Existing increases require thirty days notice at eligible renewals; annual term protection; Canal 20% recurring discount without a fixed end; Maple fixed $99 until February 1, 2027; no notices sent | Contract notes, not complete signed terms; provider invoice/proration behavior untested |
| [Subscription export](../billing/subscriptions.csv) | Six identifiers, plans, periods, listed amounts, renewal dates, statuses, discounts and commitment references | No export timestamp, provider IDs, quantities, invoice history, tax details, contact mappings or documented amount semantics |
| User clarification in this conversation | No connected live billing account; missing requested provider/discount information unavailable | Does not resolve amount semantics or authorize a live action |

Original input files have not been modified. Their SHA-256 hashes are stored in [model-summary.json](model-summary.json).

## Explicit modeling choices

- Treat October 10 as the subscription snapshot date using the company record; the CSV itself has no as-of metadata.
- Use October 12 as a hypothetical effective notice date, with thirty calendar days and recurring day-of-month renewal dates. It is not an actual delivery record. Verify full notice duration and billing timestamps for a real account.
- Treat each row as one flat subscription with no usage or quantity changes. Actual billing units and quantities are unknown; execution is held until established.
- Model USD only, including Canadian customers; do not invent CAD pricing or exchange rates. Exclude tax, credits, fees and collection assumptions.
- Preserve the annual term and Maple's fixed-rate period; delay increases to eligible renewals after those protections. Do not change billing interval.
- Preserve Canal's 20% discount and model both interpretations of its listed amount: $79.20 net if $99 is pre-discount; $99 net if already discounted. Proposed net is $103.20 in either conditional scenario. Keep the account held pending verification.
- Count only the four `active` rows in forward-looking cohort MRR. Show past-due $249 and pending-cancel $99 separately so all six source rows reconcile. Keep Harbor canceled at period end; the exact end date is inferred, not verified.
- “Conditional all active migrate” assumes the four active accounts remain and all notice, approval and provider conditions are later met. “Discount review stays held” leaves Canal unchanged. “Elm cancels” assumes Elm leaves on December 3 and the other three active accounts migrate at their conditional dates. These are scenarios, not predictions or approvals.
- Simulated recurring invoice subtotals are separate from MRR and cash. Rounded display totals may differ from summing intermediate rounded annual equivalents; calculations aggregate Decimal values before rounding.

## External read-only sources

Retrieved October 12, 2026 through the public web retrieval tool. No browser UI was used or needed. Stripe is an illustrative provider reference, **not a confirmed Rivet Desk vendor**. These are documentation-level sources, not hands-on execution evidence.

- [Stripe: manage products and prices](https://docs.stripe.com/products-prices/manage-prices): catalog lifecycle guidance, used conditionally in the runbook.
- [Stripe: change subscription prices](https://docs.stripe.com/billing/subscriptions/change-price): item/quantity preservation, billing periods, schedules and proration considerations, used conditionally in the runbook.
- [Stripe: create invoice preview](https://docs.stripe.com/api/invoices/create_preview): supported preview reference; no endpoint was called against an account.

The Ultrametric “Roll out a pricing change” process, version 3, was retrieved as workflow guidance. Its vendor references do not establish a company integration, approval or tested billing result. No third-party pricing heuristic was used to justify the price increase.

## Verification and execution status

`python3 pricing-rollout/model.py` passed checks for six unique source IDs, one-to-one ledger coverage, first eligible dates, fixed/annual protection, current discount alternatives, target discount preservation, MRR/cohort reconciliation, scheduled invoice subtotals and exclusion of every row from execution. Outputs can be regenerated locally. No provider or checkout tests ran; no notice delivery or actual invoice reconciliation exists.

Local drafts are complete. Public launch, customer notices, billing catalog changes, subscription migration and follow-up monitoring remain unperformed. The user-facing handoff must describe preparation, not a completed rollout.

## External workflow save failure

The Ultrametric process opened with run ID `[synthetic execution identifier omitted]`. A progress-save attempt was rejected with: “MCP tool call requires approval, but approval policy is never.” The same exact input was retried once after the initial response could not be parsed, and the rejection was confirmed. No successful save receipt was returned, and the run was not marked completed. Further external writes were not attempted. This packet records progress locally without bypassing that restriction.
