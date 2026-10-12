# Rivet Desk pricing rollout pack

Prepared October 12, 2026 from the supplied synthetic company records. **Status: decision materials prepared; execution unavailable.** There is no connected live billing account, no notices have been sent, and the notice date and CSV discount basis are unknown. These files contain scenarios and drafts, not provider receipts or scheduled changes.

Recommended approach: retain November 1 as the target for new buyers, subject to the founder's pricing decision and checkout validation. Transition existing customers individually at eligible renewals after valid notice. Preserve the recurring discount and all price commitments. Hold the past-due account for review and exclude the scheduled cancellation.

## Proposed prices

| Plan | Monthly | Annual, billed once per year |
| --- | ---: | ---: |
| Team | $129 USD, up from $99 | $1,290 USD |
| Business | $299 USD, up from $249 | $2,990 USD, up from the supplied $2,490 annual contract |

Annual pricing is proposed at ten times the monthly rate. No plan-feature changes or reason for the increase are documented; none have been invented in the customer copy.

## What the decision needs to account for

- Four active subscriptions have an eventual normalized MRR of **$610.37**, up **$105.87–$125.67 per month** depending on the CSV amount interpretation. This assumes retention and collection. It is not a first-year cash forecast.
- No existing subscription in this snapshot is ready for a November 1 increase. With no prior notices, Elm's November 3 and Canal's November 10 renewals cannot satisfy 30 days' notice.
- With valid notices by November 3 for Elm and November 10 for Canal, their modeled increases can start December 3 and December 10. Later notices defer those dates. Exact timestamps and contractual notice mechanics still need validation.
- Maple retains its $99 fixed rate until February 1, 2027; the next modeled renewal is February 5. Willow retains its annual price through its March 1, 2027 renewal.
- Canal keeps its 20% recurring discount. Its proposed bill is $103.20/month. Its current bill is unresolved: $79.20 if the CSV is before discount, or $99 if it is after discount. Verify the invoice before stating an increase amount to this customer.

## Reviewable materials

| File | Use |
| --- | --- |
| [Impact preview](impact-preview.md) | Revenue sensitivity, every customer, notice deadlines, and revenue progression |
| [Impact CSV](impact-preview.csv) | Six subscriptions under each of two mutually exclusive amount interpretations; do not sum both scenarios |
| [Notice scenarios](notice-scenarios.csv) | Four hypothetical send dates and their effect on eligible renewals |
| [Customer drafts](customer-drafts.md) | Pricing-page copy, individual notices, and support answers |
| [Rollout runbook](rollout-runbook.md) | Owners, sequence, invoice acceptance checks, monitoring, and recovery |
| [Preview builder](build_preview.py) | Local, repeatable scenario calculation; no billing API calls |

## Decisions and facts still open

| Item | Suggested owner, not yet assigned | Why it matters |
| --- | --- | --- |
| Approve proposed monthly and annual prices and new-buyer target date | Founder | The source proposal explicitly requests an impact preview before deciding |
| Choose actual notice date(s) and confirm valid delivery mechanics | Customer operations | Determines each eligible renewal; never substitute the scenario date for actual notice evidence |
| Reconcile CSV amounts, invoices, discounts, and renewal anchors | Billing owner | Resolves Canal's current bill and validates the revenue baseline |
| Identify provider and test invoice/proration behavior | Billing engineer | No connected account or provider behavior has been validated |
| Assign launch/support owners and verify customer links and contacts | Founder and customer operations | Drafts contain placeholders and cannot yet be sent |

These facts are unavailable in this exercise. The pack preserves the uncertainty rather than treating either interpretation or a notice date as selected. A new-buyer launch could proceed independently of existing-customer notices once its own pricing and checkout checks are satisfied.

## Suggested sequence

1. Review the impact preview and settle pricing and ownership before the November 1 target.
2. Validate four new-buyer price/period combinations in a test environment, then reconcile page, checkout, receipt, and invoice totals.
3. Publish approved prices for new buyers on the selected launch date. Existing subscriptions remain tied to their current terms until their own eligible renewals.
4. Resolve account-level facts, finalize each notice, record valid delivery, and recompute eligibility. Keep a notice buffer rather than relying on the last possible day.
5. Preview and schedule each eligible renewal; reconcile its resulting invoice and monitor customer response. Defer any account with unresolved eligibility or invoice differences.

Sources: [company](../company/company.json), [proposal](../billing/pricing-proposal.txt), [commitments](../billing/commitments.txt), and [subscriptions](../billing/subscriptions.csv), plus the user's clarification that no live account is connected and notice timing/amount basis are unavailable.
