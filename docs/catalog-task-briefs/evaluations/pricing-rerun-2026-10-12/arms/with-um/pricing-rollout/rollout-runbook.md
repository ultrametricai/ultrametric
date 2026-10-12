# Rivet Desk pricing — prepared rollout runbook

**Status: local preparation complete; rollout not executed.** There is no connected live billing account. Owner roles below are proposed and unassigned. Dates are planning targets, not scheduled jobs. This runbook contains no executable billing requests.

## Release scope and decisions

Use the [decision brief](decision-brief.md), [pricing matrix](pricing-matrix.csv) and [complete customer ledger](customer-transition-ledger.csv) together. The pricing owner must decide the four proposed prices, new-buyer release date/time and customer-level treatment. The commercial owner must verify actual commitments, recipient mappings, notice and any acceptance terms. The billing owner must establish provider/account/environment, existing product/price/item identifiers, quantities, cadence, discounts, credits, tax settings and scheduled changes.

These are unresolved prerequisites from the supplied records. There is no decision receipt or live-action authority. Do not infer the company's provider from the generic process guide's Stripe examples. Treat every ledger row as held from execution until its own prerequisites are evidenced. Canal additionally remains held on the unavailable current-amount basis; Cedar remains held on delinquency treatment; Harbor remains excluded to preserve its cancellation.

## Proposed work sequence and owners

| Timing | Proposed owner, not assigned | Deliverable / release condition |
|---|---|---|
| Before any release | Pricing owner / founder | Recorded pricing decision, exact scope and customer treatment; approved factual explanation if one is wanted |
| Before notice or test setup | Billing + commercial owners | Verified customer terms and current billing state; resolved identifiers/amounts or explicit account holds |
| Before November 1 | Billing + website owners | Test catalog and purchase-flow results for all four prices; matching pricing/help copy |
| By each ledger notice deadline | Commercial owner | Approved individual message, verified recipient/sender/support route, effective delivery and required acceptance evidence |
| November 1, proposed | Website + billing owners | Exact authorized new-buyer release at an agreed time/time zone; live prices and purchase links checked |
| December 3 / December 10, conditional | Billing owner | Elm / Canal eligible-renewal changes only if every condition is met; Canal requires amount resolution |
| February 5 / March 1, conditional | Billing owner | Maple / Willow changes after protected terms and valid notice |
| Each event and following renewal | Billing + support owners | Invoice and lifecycle reconciliation, payment status and customer-response review |

## Catalog and checkout verification

Prepare new price entries using the local mapping keys; record test identifiers separately from live identifiers. Preserve existing price references for protected subscriptions. Do not reinterpret a monthly price as annual or move a customer to another interval. Verify supported currencies, billing units, quantities, product entitlements and tax wording from actual configuration before releasing any checkout.

If Stripe is selected later, its documentation says to create a new price when the amount changes; it also explains how archiving affects future availability while existing subscriptions remain in place. This package has neither created nor archived prices. [Stripe: manage prices](https://docs.stripe.com/products-prices/manage-prices).

| Verification | Intended result | Actual evidence |
|---|---|---|
| Team monthly checkout | USD $129 per month, correct plan/unit | Not run |
| Team annual checkout | USD $1,290 per year, one annual charge | Not run |
| Business monthly checkout | USD $299 per month, correct plan/unit | Not run |
| Business annual checkout | USD $2,990 per year, one annual charge | Not run |
| All purchase links and billing toggle states | Correct environment, price and interval; no unintended old price for new buyers | Not run |
| Pricing page and help copy | Match released matrix and protected-customer policy; no placeholders | Draft only |
| Tax, customer currency, credits and discounts | Verified final invoice, including Canadian customer treatment where applicable | Unknown |

## Provider preview and account eligibility

The [invoice simulations](invoice-simulations.csv) test local policy arithmetic only. They do not establish provider behavior. The intended policy is renewal-only price replacement with zero immediate price-change charge, no mid-cycle prorations, unchanged cadence and preserved contractual discounts and scheduled intent. Preview these outcomes with the actual provider before scheduling or applying anything.

If Stripe is later chosen, its change-price documentation warns that omitting the existing subscription-item identifier can add another item, and changing a price can reset quantity unless explicitly preserved. It discusses schedules for end-of-period transitions and proration behavior. Validate the actual account configuration rather than treating these generic notes as a verified recipe. [Stripe: change subscription prices](https://docs.stripe.com/billing/subscriptions/change-price).

Stripe also documents an invoice-preview endpoint; a preview is separate from creating or paying an invoice. No such provider preview was run here. [Stripe: create invoice preview](https://docs.stripe.com/api/invoices/create_preview).

| Account / case | Required provider result before release |
|---|---|
| Elm | November 3 stays $99; first increased recurring subtotal $129 on December 3 after valid notice; no immediate charge |
| Willow | Current annual term unchanged; $2,990 recurring subtotal on March 1; no current-term catch-up or annual credit |
| Canal | Confirm actual current net; retain recurring 20% discount without expiry; conditional $103.20 subtotal on eligible renewal |
| Cedar | Excluded; price, unpaid invoices and collection state untouched by pricing migration |
| Harbor | Excluded; cancellation intent and scheduled end preserved; no unintended renewal or reactivation |
| Maple | $99 through protected period; first eligible changed subtotal $129 on February 5; no retroactive difference |
| All accounts | Verify exact period timestamps, currency, quantity, taxes, discounts, credits, payment settings and scheduled changes |
| Failed/late/disputed notice | Account remains held; compute the next eligible renewal from verified effective notice |

Before a future real batch, capture the exact subscription list, old/new provider price identifiers, effective timestamps, preview artifacts, preserved lifecycle state, decision reference and notice/acceptance evidence. An unresolved field excludes the row. Obtain authority for that concrete batch before applying it. No batch is authorized in this packet.

## Execution and reconciliation

Start with one eligible subscription as a limited rollout if the actual provider and authorized policy permit it. Compare its observed result with its preview before proceeding to more accounts. Re-read all candidates immediately before the change; new cancellations, delinquency, disputes or scheduled changes may invalidate an earlier plan.

For each released account, fill the [execution ledger](execution-ledger.csv) with the exact request scope, provider request/receipt references, authoritative state readback, actual invoice and payment state. Verify both amounts and lifecycle intent. Reconcile batch counts into **changed, unchanged, held, failed and unconfirmed**. An accepted request is not evidence of a correct invoice or collected payment.

Current reconciliation: six input subscriptions, six local ledger rows, zero authorized or attempted mutations, zero provider-verified changed or unchanged accounts, six held from execution, zero failed provider mutations and zero uncertain provider mutations. There are no notice delivery receipts or observed invoices. “Held” here describes release readiness; it does not assert a live billing-state change.

If a future request times out or only part of a batch succeeds, stop the affected batch, read authoritative state and reconcile each account before retrying. Use the provider's supported idempotency controls. Never resend solely because a receipt is missing.

## Stop and correction rules

Stop an account's transition for any unexpected amount, currency, discount, quantity, effective date, immediate charge, lifecycle change or missing notice evidence. Stop the broader batch if the mismatch reflects shared configuration. Route disputes to the commercial owner before billing the new price.

For a new-buyer checkout defect, the authorized website/billing owners should suspend the affected purchase flow or restore the last verified version according to an agreed release plan. For an existing customer already invoiced, reverting a catalog or subscription price does not itself undo that invoice or charge. Reconcile first and prepare the exact credit/refund/subscription correction for separate authority. Do not delete legacy price mappings or assume automatic reversal.

## Monitoring handoff — proposed, not scheduled

Track the four originally active subscriptions separately from the two lifecycle exclusions. Keep acquisition metrics separate: no new-buyer traffic, conversion or volume baseline was supplied, so no acquisition uplift is forecast. Record all cohort counts with results; one account is material in a cohort this small.

- At release and after each changed invoice: match intended and actual subtotal, taxes/credits, due date, payment result, discounts and scheduled state. Any mismatch triggers the correction path above.
- Weekly during transition: review notice delivery failures, disputes, support questions, cancellation requests, downgrades and observed MRR. Separate an existing planned cancellation from newly observed responses to pricing; do not infer causation from timing alone.
- At 7 and 30 days after each migration, and at its following renewal: record customer outcome, failed payments and retained net recurring revenue against the original cohort and both discount interpretations until resolved.
- After Willow's March 1 renewal and through April 1, 2027: assemble the transition reconciliation. Extend the window for any delayed account; no churn or collection conclusion can be claimed here before observations exist.

Owner names, calendar tasks, dashboards and thresholds beyond invoice correctness remain unset. A real handoff must name responsible people and establish the schedule; this document does not claim that has happened.
