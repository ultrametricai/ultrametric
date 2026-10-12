# Pricing rollout runbook

This is a proposed operating sequence for a future implementation. All provider checks are **unrun**: the company is synthetic and has no connected billing account. Owner titles below are suggested roles, not assigned people. November 1, 2026 is the proposal's target for new buyers, not a confirmed deployment.

## 1. Settle the decision and reconcile the records

Founder: review the two revenue scenarios and decide whether to adopt $129/$299 monthly and $1,290/$2,990 annual prices. Record the decision, currency, approved launch date/time/timezone, and owner.

Billing owner: reconcile subscription IDs to current price records, invoice amounts, recurring discounts, current term boundaries, renewal anchors, cancellation state, and customer notice terms. Resolve Canal's amount ambiguity. Recheck the October 10 snapshot immediately before any later action.

Customer operations: choose notice dates, confirm recipients and valid notice mechanics, and finalize the customer drafts. The provider, support contact, billing-management links, and account contacts are currently unknown.

## 2. Prepare new-buyer pricing

Billing engineer: in an available test environment, prepare distinct prices for each approved plan/period/currency combination using the provider's supported approach. Preserve price records needed by existing subscriptions, renewals, and invoice history. Keep a mapping of old and proposed prices and an export of existing settings.

Web/product owner: align pricing-page copy, monthly/annual selection, checkout, payment links, order summaries, receipts, and sales materials. Display full annual charges clearly. The supplied source contains no application repository, so there are no code changes to deploy from this workspace.

Test owner: run the acceptance cases below before allowing new buyers onto the new prices. On launch, reconcile the displayed price, charged price, plan, billing period, and currency for the first transactions. Old public checkout links should follow the approved new-buyer policy without breaking protected existing renewals.

## 3. Build the existing-customer migration ledger

Use one row per subscription with these fields:

`subscription_id, status_checked_at, old_price_id, new_price_id, current_recurring_amount, discount_terms, term_end, commitment_end, notice_version, actual_valid_notice_at, notice_evidence, billing_timezone, eligible_renewal_at, preview_invoice_id, expected_recurring_subtotal, approved_by, scheduled_change_id, execution_state, resulting_invoice_id, reconciliation_result`

Leave unknown values blank and mark the row held. The local CSV is an impact worksheet; it is not an executable migration manifest.

For each eligible account:

1. Confirm a current active subscription and resolve any pending cancellation, contract exception, or payment issue.
2. Calculate the first natural renewal after the actual valid notice interval and applicable commitment. Keep annual prices through their current term. Preserve the renewal anchor unless a separately agreed change calls for otherwise.
3. Finalize the individual notice using the verified current amount, new amount, and proposed eligible date. Record valid delivery evidence. If notice is late or fails, defer the change and issue corrected timing as needed; do not use the planned send date as evidence.
4. Produce a provider invoice preview for that renewal, including discounts, taxes, credits, and any proration lines. A local calculation cannot establish provider behavior.
5. Schedule only when the preview matches the approved treatment. Prefer a provider-supported renewal-time change with no immediate price-difference charge. Confirm its actual behavior in the chosen provider.
6. Re-read the subscription and scheduled action. Record IDs and expected state so a retry cannot create duplicate schedules or charges.

Recommended initial sequence is Elm's first eligible renewal, then Canal's, Maple's, and Willow's according to their actual notice dates. Do not move any renewal solely to create a batch. Hold Cedar until payment status is resolved and eligibility is re-evaluated. Exclude Harbor while its cancellation is scheduled.

## 4. Required billing acceptance cases

All amounts below are recurring subscription subtotals in USD before any separately calculated taxes or adjustments. These are expected outcomes, not observed provider results.

| Case | Expected behavior | Evidence to retain |
| --- | --- | --- |
| New Team monthly / annual | $129 per month / $1,290 once per year; correct frequency and currency | Checkout, first invoice, renewal preview |
| New Business monthly / annual | $299 per month / $2,990 once per year | Checkout, first invoice, renewal preview |
| Elm, notice October 12 scenario | November 3 stays $99; December 3 becomes $129 | Both renewal previews and scheduled-change record |
| Canal, notice October 12 scenario | Resolve current bill first; November 10 stays at verified current bill; December 10 becomes $103.20; 20% recurring discount persists without a new expiry | Invoice reconciliation, coupon/discount terms, two renewal previews |
| Maple, notice October 12 scenario | $99 at November 5, December 5, January 5; no February 1 charge; $129 at February 5 | Commitment, schedule, invoice previews |
| Willow, timely notice scenario | Existing term remains $2,490; March 1, 2027 renewal is $2,990; no immediate $500 adjustment | Current term and next annual invoice preview |
| Late notice | November 4 notice shifts Elm to January 3, 2027; November 11 shifts Canal to January 10; notice after January 30 shifts Willow to a later eligible annual renewal | Boundary-date calculations plus provider schedule |
| Missing/failed notice | No price change scheduled until valid notice and eligible date are established | Delivery record and held ledger state |
| Past-due Cedar | No price migration or old-invoice repricing while held; payment retries follow existing policy | Subscription, outstanding invoice, retry configuration |
| Canceling Harbor | Cancellation retained; no new paid period or price migration | Cancellation state and absence of migration action |
| Proration and repeated runs | No unintended immediate invoice, credit, duplicate schedule, reset term, or duplicate charge | Invoice previews, schedule IDs, repeat-run check |
| Currency/tax/credit interactions | Approved USD subtotal and actual account-specific total reconcile; no silent currency conversion or lost credits | Representative US/Canadian checkout and invoice previews where applicable |

If a provider preview fails an expected outcome, hold the affected migration. Do not infer correct invoicing from a successful API response alone.

## 5. Observe each release and renewal

Customer operations monitors notice delivery and pricing questions after dispatch. Billing monitors the first new-buyer transactions on launch day and the next day, then each changed renewal as it invoices. Review daily for the first week after each small cohort, and weekly until the annual cohort has renewed or been deferred.

Track changes against the prelaunch baseline: new-buyer checkout conversion by plan/period, account cancellations, pricing-related support contacts, notice delivery failures, invoice mismatches, payment failures, and actual normalized recurring revenue from retained subscriptions. Record numerator and denominator; this six-account snapshot is too small to infer a reliable conversion or churn trend.

Suggested release rule: any premature charge, lost discount, overridden cancellation, broken commitment, or unexplained invoice mismatch pauses the affected path immediately. Founder and billing owner should set business performance thresholds after reviewing a real baseline; none are available here. Track payment collection separately from contracted MRR.

## 6. Recovery

Before a changed invoice is issued, remove or correct the future scheduled change using the provider's supported procedure, then verify the subscription and next invoice preview. Keep already communicated customer commitments in view; issue a corrected notice when timing or amounts change.

For a checkout defect, restore the last verified checkout configuration or pause the affected checkout path while reconciling transactions. Avoid deleting price records used by subscriptions or invoice history.

After an incorrect invoice or charge, preserve the original record, identify affected customers, and have the billing owner determine and authorize the correction, credit, or refund through the provider. Reverting a price configuration alone does not repair an issued invoice. Confirm the resulting invoice and customer balance and send an accurate correction communication through the approved channel.

## Local verification versus launch evidence

The local model can check calendar arithmetic, scenario totals, discount math, and excluded-account treatment. It cannot verify contact delivery, contract execution, taxes, provider proration, checkout behavior, or real invoice results. Complete the ledger and retain provider evidence before treating any future rollout as executed.
