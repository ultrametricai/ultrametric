# Rivet Desk pricing rollout — prepared only

Prepared 2026-10-12; synthetic company snapshot 2026-10-10; model revision `18df04d0aa4d`. No live billing account is connected (user confirmed). No notice date is available. Prices, customer notices, launch and migration policy remain proposed. No live or test catalog was created, no subscriptions changed, no notices sent and no site published.

The prepared package covers all six source subscriptions exactly once. The currently authorized execution batch is empty. Four active subscriptions are modeled for future renewal changes; one delinquent account is held and one pending cancellation is excluded. All six execution rows are marked not executed; no observed billing result is claimed.

## Proposed pricing

| Plan | Monthly list price | Annual proposed price | Annual monthly equivalent |
|---|---:|---:|---:|
| Team | $99 → $129 (+30.30%) | $1,290 billed yearly | $107.50 |
| Business | $249 → $299 (+20.08%) | $2,990 billed yearly | $249.17 |

USD throughout. Annual proposal equals ten monthly payments. Business’s existing annual record is $2,490; Team’s existing annual catalog price is not supplied. New-buyer target is November 1, 2026, subject to a decision on pricing and launch timezone. Existing customers move only at individually eligible renewals. There is no supplied willingness-to-pay or conversion evidence supporting an optimum price; this is an impact preview of the founder’s proposal.

## Impact and definitions

Baseline active-only net MRR = $99 + $2,490/12 + $99×80% + $99 = **$484.70**. This management metric excludes $249 of past-due normalized amount and $99 from the pending cancellation. Across all six listed rows, normalized net amounts total $832.70; that is not our active baseline and does not imply collections. Pending cancellation may still have current-term access/revenue; excluding it is a forward-looking metric convention.

Eventual active-cohort MRR, if all four customers renew at proposed pricing, is **$610.37**, an increase of **$125.67/month (25.93%)**. Uplift by account is $30 Elm + $24 Canal + $30 Maple + $500/12 Willow. Annualized run-rate uplift is $1508.00; it is not cash or a first-year revenue forecast.

Current source prices are treated as BEFORE discount, so Canal pays $79.20 now and $103.20 after the increase. Verify this before use. If its $99 export amount is already net, active baseline would instead be $504.50 and uplift $105.87; that reading conflicts with the stated old Team list price and needs invoice confirmation. This file’s primary model uses the pre-discount interpretation.

## Customer transition preview

**All dates below are illustrative, assuming valid notice on 2026-10-12. Actual effective dates remain blank in the ledger.** Renewal dates use 30 calendar days, existing billing anchors and the supplied commitments. Exact notice/acceptance rules and timestamps remain to be checked against the actual agreements.

| Subscription | Treatment | Current → proposed net charge | Illustrative first increase |
|---|---|---:|---|
| S-001 Example Elm | standard_notice_dependent | $99.00 → $129.00/month | 2026-12-03 |
| S-002 Example Willow | annual_term_protected | $2490.00 → $2990.00/year | 2027-03-01 |
| S-003 Example Canal | recurring_discount_protected | $79.20 → $103.20/month | 2026-12-10 |
| S-004 Example Cedar | past_due_hold | $249.00 → held / excluded/month | None |
| S-005 Example Harbor | cancellation_excluded | $99.00 → held / excluded/month | None |
| S-006 Example Maple | fixed_rate_protected | $99.00 → $129.00/month | 2027-02-05 |

For the default October 12 notice example, the 30-day threshold is November 11. Elm’s November 3 and Canal’s November 10 renewals retain old prices. The annual term and Maple’s fixed-price protection are preserved. A later notice can postpone the first increase by a whole renewal period, including a full year for the annual plan. No notice can be backdated.

## Scenario sensitivity

Values are month-end active-cohort MRR, not monthly recognized revenue, invoices or cash. No new sales, expansion, usage, taxes, refunds or payment success are forecast. The proposed scenario is not approved. Downside assumes Elm cancels exactly at its first proposed increase; this is one of four active customers, not a forecast churn rate. Delayed scenario assumes valid notice on 2026-11-15.

| Month end | No change | Proposed, retained | Downside: lose Elm | Delayed notice |
|---|---:|---:|---:|---:|
| 2026-11-30 | $484.70 | $484.70 | $484.70 | $484.70 |
| 2026-12-31 | $484.70 | $538.70 | $409.70 | $484.70 |
| 2027-01-31 | $484.70 | $538.70 | $409.70 | $538.70 |
| 2027-02-28 | $484.70 | $568.70 | $439.70 | $568.70 |
| 2027-03-31 | $484.70 | $610.37 | $481.37 | $610.37 |

Losing Elm erases the eventual aggregate uplift: eventual MRR becomes $481.37, $3.33 below the starting active baseline. For homogeneous cohorts, list-price break-even retained revenue is 99/129 = 76.74% for Team and 249/299 = 83.28% for Business. These are algebraic sensitivities, not estimated cancellation probabilities; the six-account ledger is too small to infer demand.

## Files and next decision

- `transition_ledger.csv`: all six subscriptions, modeled terms, holds, date examples and blank actual approvals/identifiers.
- `invoice_simulations.csv`: ten account-level rows covering next listed renewal and first modeled increase where relevant; no provider invoice previews.
- `revenue_scenarios.csv`: reference, retained, one-account-loss and delayed-notice scenarios for November 2026 through March 2027.
- `customer_notices.md`: four personalized drafts and treatment of the two held/excluded accounts; unresolved dates/contacts remain placeholders.
- `execution_ledger.csv`: six rows, all not executed, with empty receipt/readback fields.
- `model_summary.json`: assumptions, source hashes and explicit execution status.
- `../pricing_copy.md`: proposed website/help copy.
- `../billing_handoff.md`: decisions, release sequence, provider trial cases and reconciliation procedure.
- `../sources.md`: local evidence and documentation checks.

The founder can review the exact pricing matrix, cohort policy and downside now. Later release requires the actual notice date, assigned owners, verified recipient mapping, provider environment and previews, plus authorization of the exact messages and billing batch. Those facts are absent; this package remains prepared only. See `../billing_handoff.md` for the concrete checks and acceptance criteria.

## Reproduce

From workspace root, run `python3 pricing-rollout/model.py`. Default output is `pricing-rollout/generated/`. To compare a different hypothetical notice date without replacing the default, run `python3 pricing-rollout/model.py --illustrative-notice-date 2026-11-15 --output pricing-rollout/scenarios/notice-nov-15`.

The argument is always a simulation input; it does not record delivery or authorize execution. Dates before this analysis date are rejected. Changing source prices, commitments, or cohorts also requires reviewing the policy constants and all handoff/copy files before using a new revision. Run `python3 pricing-rollout/verify_model.py` for the material model checks.

Ultrametric progress persistence was blocked because the tool requires approval and session approval policy is never. No successful save receipt exists. Local artifacts are the handoff record.
