# Proposed rollout runbook

Simulation only. No live billing platform is connected; no provider operations are possible or evidenced. All owners below are proposed roles, not assigned people. The new prices and November 1 launch remain a founder decision. Customer notice dates use an unexecuted October 12, 2026 assumption.

## Sequence and ownership

| When | Proposed owner | Work and completion evidence |
|---|---|---|
| Before deciding | Founder + finance | Review the two impact cases, annual prices, USD presentation, customer exclusions, and retention sensitivity. Record the chosen prices and rollout date. |
| Before notice preparation | Billing owner + support | Reconcile source amounts against invoices; confirm discount basis, contract commitments, current statuses, renewal timestamps, customer notice addresses, and notice delivery rules. Resolve exact cancellation and annual renewal behavior. |
| Before any real scheduling | Billing owner | Run the provider tests in verification.md in an available test environment. Record expected and actual invoice totals, currency, discount, billing anchor, and absence of unintended immediate charges. No test environment is available in this exercise. |
| On the chosen notice date | Support | Finalize notices with verified old/new net prices and dates; check the required 30 days. Send only within separately authorized live scope; record recipient, content version, timestamp, delivery outcome, and eligible renewal. Recalculate after failed delivery or later sending. |
| By October 30, if November 1 is retained | Product/website + billing owner | Prepare new monthly and annual price versions, matching website/checkout copy and support answers; complete end-to-end test purchases. Keep existing terms and discounts attached to existing subscriptions. Record the configured launch time and timezone. |
| November 1, at agreed time | Product/website + billing owner | Activate the new-buyer offer only after the decision and validation gates pass. Verify displayed and charged USD prices for Team and Business, monthly and annual. |
| December 3 and 10, if eligible | Billing owner + support | First active migration wave: S-001, then S-003. Recheck actual notice eligibility and inspect first invoices individually. S-003's 20% recurring discount must remain attached with no invented expiry. |
| February 5, 2027, if eligible | Billing owner | Move S-006 only after the fixed-rate commitment ends and notice is sufficient. Send a courtesy reminder in January if the October notice was actually sent and remains valid. |
| March 1, 2027, if eligible | Billing owner | Move S-002 at annual renewal, preserving its existing term. A January reminder can help; if it is the first valid notice, it must independently meet the required notice interval. |

If preparation misses the November 1 target, choose a new new-buyer date and update public copy. Existing-customer eligibility always follows the actual valid notice and renewal, independently of the new-buyer date. Avoid relying on a last-day notice deadline when timestamps or delivery rules are unknown.

## Subscription rules

1. Preserve existing price versions for subscriptions that have not reached an eligible renewal. Implement new price versions for new purchases; do not edit a shared price in a way that reprices existing subscriptions immediately.
2. Apply existing-customer changes at the first verified renewal on or after the actual notice interval and any price commitment. Preserve the renewal anchor. Confirm the provider's scheduling behavior; do not assume an immediate subscription edit will avoid proration.
3. Preserve the 20% recurring percentage discount for C-003. Do not replace it with a $19.80 fixed discount or reset its duration. Under the proposed new monthly list price, the net subscription amount is $103.20.
4. Preserve S-002's annual term at $2,490. Its next proposed annual charge is $2,990 on March 1, 2027, only if notice and renewal conditions are satisfied. Do not charge a midterm difference or restart its term.
5. Preserve S-006's $99 monthly rate through the commitment ending February 1, 2027. With the listed monthly anchor, February 5 is its first candidate renewal after the commitment.
6. Hold S-004 while past due. Do not rewrite existing invoices or treat price uplift as collectible revenue. If resolved and retained, refresh status, renewal, contract and notice evidence before placing it in a later cohort.
7. Exclude S-005. Preserve its cancellation; do not reactivate or add a post-cancellation renewal. The source's November 20 renewal date is used as its expected period-end date only, pending confirmation.
8. Refresh the entire cohort before each wave. If a customer cancels, changes plan, signs a new commitment, or has an unresolved notice, recalculate eligibility before proceeding.

## Website and communications preparation

- Use the pricing copy and notices in communications.md. Do not publish promises about features, service improvements, support levels, or why costs increased: the source does not establish those facts.
- Present monthly and annual totals clearly, with annual billing labeled. Confirm tax-inclusive versus tax-exclusive presentation and checkout treatment for US and Canadian buyers; the preview models neither tax nor currency conversion.
- Review pricing pages, checkout/payment links, in-product plan selection, signup emails, sales quotes, help content, and support replies for matching approved prices. Existing negotiated contracts and outstanding offers require their own review.
- Keep new-buyer messaging distinct from each existing customer's effective renewal date. Avoid a broad statement that every customer changes on November 1.
- Fill in real support and account-management routes, customer names, effective timestamps, and any required notice wording before sending. These synthetic names are not a recipient list.

## Readiness and monitoring

The local model is available for review. Live readiness remains unverified: no founder decision, sent-notice record, billing configuration, provider test result, or published-price evidence is available.

For a future authorized implementation, maintain one row per subscription with: source price/version, target price/version, term, currency, discounts, commitment, status, billing anchor/timezone, notice timestamp and delivery evidence, eligibility decision, scheduled change identifier, previewed invoice amount, actual invoice amount, and reviewer. Never label an account ready using only this preview's candidate date.

Inspect all new-buyer test paths before launch and all four retained subscriptions at their first changed invoice. During the first week after launch and each renewal wave, compare expected versus actual prices, invoices and collections daily. Review cancellation requests, failed payments, refund requests, and pricing support tickets weekly for the following month. Capture a baseline before launch; no baseline conversion or churn metrics are supplied here.

Any incorrect currency, price, discount, term, notice eligibility, unexpected immediate charge, or cancellation reactivation pauses further migrations. Investigate customer feedback and cancellations with the founder before expanding the wave. Use counts and account-level review for this small cohort rather than inventing statistically meaningful percentage thresholds.

## Recovery

If a mismatch is found before invoicing, pause remaining scheduled changes and restore the intended old price or schedule where the provider permits it without creating a charge. Re-preview before resuming. If a wrong invoice has already been issued, stop further changes, preserve the audit record, calculate the correction, and have the billing owner handle any credit/refund and customer communication through the actual provider workflow. Do not assume a price rollback reverses an invoice or that rolling back permits retroactive charges.

If public checkout pricing is inconsistent, pause the affected offer or revert it to a verified consistent configuration until corrected, and review purchases made during the mismatch. Only resume when the underlying defect and affected accounts are resolved and invoice previews match the approved policy.
