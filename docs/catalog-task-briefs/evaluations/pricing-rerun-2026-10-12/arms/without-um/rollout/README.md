# Rivet Desk pricing rollout preview

Prepared October 12, 2026, using the October 10 synthetic company snapshot. This is a decision package for a fictional company. The user confirmed that no live billing account is connected and the missing billing details are unavailable. No notices were sent, prices published, or subscriptions changed.

The proposed rollout is new-buyer pricing on November 1, 2026, followed by existing-customer changes at eligible renewals. The founder's decision is still pending in the source files. Recommend reviewing this phased approach and the impact below before any real implementation.

## Proposed prices

All amounts are USD subscription prices. Annual amounts are billed annually, not monthly installments.

| Plan | Current monthly list | Proposed monthly list | Current annual price | Proposed annual list | Monthly increase |
|---|---:|---:|---:|---:|---:|
| Team | $99 | $129 | Not supplied | $1,290 | 30.3% |
| Business | $249 | $299 | $2,490 | $2,990 | 20.1% |

Business's $2,490 annual price is observed in S-002. The proposed annual pricing equals ten monthly payments, or 16.7% less than twelve proposed monthly payments. No feature or packaging changes are supplied.

## Financial impact

The four active subscriptions form the retained cohort: S-001, S-002, S-003, and S-006. The model excludes the past-due and cancelling subscriptions from both this baseline and its forecast. MRR means monthly normalized subscription run rate; annual payments are divided by twelve. It is not collected cash or recognized revenue.

| Interpretation of S-003's $99 CSV amount | Current retained MRR | Fully migrated retained MRR | Increase/month | Increase in annualized run rate |
|---|---:|---:|---:|---:|
| Before its recurring 20% discount | $484.70 | $610.37 | $125.67 / 25.93% | $1,508.00 |
| After its recurring 20% discount | $504.50 | $610.37 | $105.87 / 20.98% | $1,270.40 |

S-003's proposed net monthly price is $103.20 in both cases: $129 × 80%. Its current net price could be $79.20 or $99.00. The second interpretation implies a current pre-discount base of $123.75, inconsistent with the stated $99 Team list price; it is a sensitivity case requiring reconciliation, not an established billing fact. Its customer notice therefore remains unresolved.

The current normalized total across all six rows is $832.70 before-discount interpretation, or $852.50 after-discount interpretation. That total includes $249 from the past-due account and $99 from the cancelling account; it is not a reliable collections estimate. Under a separate hypothetical in which S-004 is retained, made current, and subsequently migrated, it would add $50/month of price uplift. That uplift is excluded from the retained forecast.

To reconcile the full starting portfolio, the scheduled cancellation removes $99/month. Holding the past-due account's nominal $249 unchanged, the fully migrated all-row total would be $859.37/month: a net increase of only $26.67 or $6.87 versus the respective all-row baselines. This bridge includes the recurring value of a past-due subscription with unknown collectibility, so it must not be described as collected revenue. It appears separately in the monthly CSV.

No customer growth or additional churn is modeled. Losing one retained Team subscription at its new $129 monthly price would bring the fully migrated retained total to $481.37, below either current baseline. This small sample cannot establish willingness to pay or predict retention.

## Illustrative timing

The following dates assume valid notices were sent October 12, 2026. They were not sent. Thirty calendar days later is November 11. Dates are provisional until actual delivery, contract terms, renewal anchors, and billing timestamps are verified. A later notice can push a change back one or more billing periods.

| Subscription | Treatment | Current → proposed net price | First modeled change |
|---|---|---|---|
| S-001 · Example Elm | Retain; wait for 30-day notice | $99 → $129/month | December 3, 2026; November 3 is too soon |
| S-002 · Example Willow | Keep annual term intact | $2,490 → $2,990/year | March 1, 2027 |
| S-003 · Example Canal | Preserve recurring 20% discount indefinitely | $79.20 or $99 → $103.20/month | December 10, 2026; November 10 is too soon |
| S-004 · Example Cedar | Hold for past-due review | $249 → $299/month only if later eligible | No change scheduled; November 28 is merely date-eligible under this notice assumption |
| S-005 · Example Harbor | Honor cancellation | $99/month until scheduled end | No migration; expected end November 20, 2026, subject to confirmation |
| S-006 · Example Maple | Preserve fixed $99 rate through commitment | $99 → $129/month | February 5, 2027, after lock ending February 1 |

The CSV's `first_date_eligible_renewal_if_retained` is a calendar calculation, not an instruction to migrate. `preview_change_date` is blank for the two excluded accounts. Even populated dates are hypothetical and require a decision, actual notice, and billing verification.

| Month end | Retained MRR: before-discount case | Retained MRR: after-discount case | New changes in the month |
|---|---:|---:|---|
| October 2026 | $484.70 | $504.50 | Baseline |
| November 2026 | $484.70 | $504.50 | None among the four active subscriptions |
| December 2026 | $538.70 | $538.70 | S-001 and S-003 |
| January 2027 | $538.70 | $538.70 | None |
| February 2027 | $568.70 | $568.70 | S-006 |
| March 2027 | $610.37 | $610.37 | S-002 |
| April 2027 | $610.37 | $610.37 | None |

These are month-end run rates, not full-month invoiced amounts. Annualized uplift is a steady-state measure, not cash expected over the next twelve months.

## Package and use

- [Rollout runbook](rollout-plan.md): proposed owners, launch sequence, verification gates, monitoring, and recovery.
- [Subscription impact](subscription-impact.csv): all six accounts under both amount interpretations, notice deadlines, commitments, and holds. The scenarios are alternatives; never sum them.
- [Monthly run-rate forecast](monthly-run-rate.csv) and [machine-readable summary](impact-summary.json).
- [Customer and website drafts](communications.md): proposed public pricing copy, individual renewal notices, and support answers.
- [Dry-run verification](verification.md): local arithmetic/date checks and the billing tests still unperformed.
- [Rebuild script](build_preview.py): reads the supplied subscriptions and writes the three data outputs locally; no network access or provider changes.

From the workspace root, regenerate with a different hypothetical notice date:

```sh
python3 rollout/build_preview.py --notice-date 2026-10-12
```

This command updates only the two CSVs and JSON. Revise this brief, the runbook, and notice drafts to match any changed dates, policy, or prices. The proposed prices and known commitment are explicit constants in the script; a changed proposal requires updating them too.

Source records: [company profile](../company/company.json), [pricing proposal](../billing/pricing-proposal.txt), [commitments](../billing/commitments.txt), and [subscriptions](../billing/subscriptions.csv). The 30-day rule comes from the supplied contract notes; this package does not establish jurisdiction-specific notice requirements.
