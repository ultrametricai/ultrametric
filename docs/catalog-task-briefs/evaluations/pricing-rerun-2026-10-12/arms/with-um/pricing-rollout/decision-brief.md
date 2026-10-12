# Rivet Desk pricing rollout — decision packet

Prepared October 12, 2026. **Synthetic simulation; prepared only.** No pricing approval, customer notices, catalog creation, subscription changes or payments have occurred. The user confirmed there is no connected live billing account and the missing billing/discount information is unavailable.

**Proposed approach:** launch the proposed prices for new buyers on November 1; transition existing customers at eligible renewals after notice, retaining discounts and protected terms. Keep the delinquent account and pending cancellation out of the migration. Keep the discounted account held until its current amount is understood. The pricing decision remains open: this packet makes its impact reviewable.

## Pricing decision

All amounts are USD. Annual means one payment for a year; taxes are excluded from this model.

| Plan | Current monthly list price | Proposed monthly | Proposed annual | Monthly increase |
|---|---:|---:|---:|---:|
| Team | $99 | $129 | $1,290 | $30 / 30.30% |
| Business | $249 | $299 | $2,990 | $50 / 20.08% |

The supplied Business annual subscription moves from $2,490 to $2,990 at its eligible renewal, a $500 / 20.08% increase. No current Team annual price was supplied. Proposed annual pricing equals ten monthly payments; that saves $258 for Team or $598 for Business against twelve payments at the new monthly price. Features, limits, seats, usage rates and tax presentation were not supplied and must be checked before publishing purchase-ready copy.

## Revenue preview

The recurring-revenue baseline includes the four `active` subscriptions and annualizes the annual charge by dividing by twelve. It excludes the past-due account and the account already scheduled to cancel from the forward-looking active cohort. This is a stated planning convention, not the billing provider's MRR definition, recognized revenue or cash collection.

| Scenario | If Canal's $99 is before its 20% discount | If Canal's $99 is already after its discount |
|---|---:|---:|
| Current active MRR | $484.70 | $504.50 |
| March MRR if all four active accounts renew at proposed terms | $610.37 | $610.37 |
| Conditional increase | $125.67 / 25.93% | $105.87 / 20.98% |
| March MRR if Canal remains at its current rate pending review | $586.37 | $606.17 |
| March MRR if Elm cancels at its first increased renewal | $481.37 | $481.37 |
| That cancellation scenario versus current active MRR | −$3.33 | −$23.13 |

These are **unapproved scenarios**, not forecasts of customer behavior. Canal's target is $129 × 80% = $103.20/month with the 20% recurring discount retained. Its current net is either $79.20 or $99; that ambiguity changes the uplift by $19.80/month. No new sales, expansion, delinquency recovery, taxes, credits, fees or exchange-rate conversion are modeled. No customer value or willingness-to-pay evidence was supplied. The 30.30% Team increase deserves particular attention: losing one full-price Team subscriber eliminates this cohort's projected uplift.

Reconciliation of every supplied row: $484.70 active + $249 past due + $99 pending cancellation = $832.70 of listed monthly equivalents under the before-discount interpretation; the after-discount alternative totals $852.50. The extra $348 is not assumed collectible or renewable. Preserve Harbor's existing cancellation; it is not new price-change churn. All six accounts remain unexecuted. [Cohort totals](cohort-reconciliation.csv) reconcile to the [customer ledger](customer-transition-ledger.csv).

## Proposed customer treatment

Dates below are conditional on a notice effective October 12, 2026, thirty calendar days' notice, unchanged renewal dates and the supplied commitments. **No notices have actually been sent.** A notice effective October 12 clears the modeled thirty-day threshold on November 11. Verify exact timestamps, time zone, delivery rules and any acceptance conditions before a real migration; late or failed notice requires recalculating the eligible renewal.

| Subscription / customer | Treatment | Current → conditional net charge | First candidate increase | Latest modeled notice date for that renewal |
|---|---|---|---|---|
| S-001 / Elm | Migrate at eligible renewal | $99 → $129/month | Dec 3, 2026 | Nov 3, 2026 |
| S-002 / Willow | Retain annual term | $2,490 → $2,990/year | Mar 1, 2027 | Jan 30, 2027 |
| S-003 / Canal | Hold until discount basis resolved; retain 20% indefinitely | $79.20 or $99 → $103.20/month | Dec 10, 2026, conditional | Nov 10, 2026 |
| S-004 / Cedar | Hold for delinquency review | $249/month retained in model | Unset | Unset |
| S-005 / Harbor | Preserve pending cancellation | $99 through existing term; no new renewal modeled | No migration | Not applicable |
| S-006 / Maple | Honor fixed $99 through Feb 1, 2027 | $99 → $129/month | Feb 5, 2027 | Jan 6, 2027 |

Elm's November 3 and Canal's November 10 renewals are too early for notice first effective October 12. Maple's protected period ends February 1, but its modeled first eligible billing date is February 5. Harbor's November 20 cancellation date is inferred from the renewal field, not verified against a provider record. Cedar's potential $299 catalog price is not an approved transition or modeled uplift.

## Timing: recurring revenue and invoices are different

This table uses the before-discount interpretation and assumes all four active accounts eventually migrate, including conditional resolution of Canal. The larger March invoice subtotal includes a full annual charge; the MRR column spreads that annual charge across twelve months. Invoice subtotals are simulations before taxes, credits and fees. Cash collection is unknown for every month.

| Month | End-of-month active MRR | Scheduled active-cohort invoice subtotals | Invoice subtotals if prices held |
|---|---:|---:|---:|
| Nov 2026 | $484.70 | $277.20 | $277.20 |
| Dec 2026 | $538.70 | $331.20 | $277.20 |
| Jan 2027 | $538.70 | $331.20 | $277.20 |
| Feb 2027 | $568.70 | $361.20 | $277.20 |
| Mar 2027 | $610.37 | $3,351.20 | $2,767.20 |

The active-cohort simulated invoice increase across November–March is $776 under this interpretation. This is neither collected cash nor a recurring monthly uplift. The complete [monthly scenarios](monthly-scenarios.csv) include the alternative discount basis, no-change case, unresolved-discount case and Elm-cancellation downside; [event dates](revenue-events.csv) show when MRR changes within each month.

## Proposed release sequence

1. **Before public release:** pricing owner decides the matrix and customer treatment above; billing owner resolves amounts, quantities, exact dates and provider behavior; commercial owner verifies notice terms and recipients. Owner names remain unassigned.
2. **Prepare the catalog and purchase flows:** test all four proposed prices and renewal-only transitions; record preview evidence. The [pricing matrix](pricing-matrix.csv) contains local mapping keys only—no provider identifiers have been created.
3. **November 1, if approved and verified:** release new-buyer catalog, checkout and pricing/help copy together. Existing subscriptions retain their terms until separately eligible.
4. **Existing accounts:** deliver each verified notice by its deadline, retain delivery/acceptance evidence, recheck lifecycle status, then release only the exact eligible batch. A missed condition keeps that account held.
5. **At every transition:** reconcile invoice, amount, currency, quantity, discount, dates and scheduled intent; inspect payment separately. Follow the [runbook](rollout-runbook.md), then monitor affected cohorts through their next renewal.

## Files and reproducibility

- [Customer transition ledger](customer-transition-ledger.csv): all six subscriptions exactly once, proposed groups, conditional dates, unknown identifiers and execution holds.
- [Draft customer notices, website copy and support guidance](communications-drafts.md): recipient-specific drafts with explicit missing fields.
- [Runbook](rollout-runbook.md): provider checks, release criteria, reconciliation, correction handling and proposed monitoring.
- [Invoice simulations](invoice-simulations.csv) and [execution ledger](execution-ledger.csv): modeled amounts kept separate from absent execution evidence.
- [Model summary](model-summary.json), [monthly scenarios](monthly-scenarios.csv), [cohort reconciliation](cohort-reconciliation.csv) and [event schedule](revenue-events.csv).
- [Model script](model.py): run `python3 pricing-rollout/model.py` from the workspace root; no dependencies or network access. Checks verify input coverage, notice eligibility, protected terms, discounts, cohort sums, scheduled billings and exclusion from execution. All passed.
- [Sources and workflow status](sources-and-status.md): provenance, assumptions, primary documentation and failed external-save status.

The source CSV has no separate snapshot timestamp; October 10, 2026 comes from the company record and is an explicit snapshot assumption. All originals remain unchanged. A later correction requires rerunning the model and updating this brief, drafts and runbook as one revision before use.

## Prepared handoff boundary

The local package is complete for this synthetic example. Actual rollout remains unperformed: there is no connected billing account, approved migration policy, delivery evidence or provider reconciliation. Missing facts are recorded instead of inferred as facts. This packet does not establish permission to publish, send notices or bill customers.
