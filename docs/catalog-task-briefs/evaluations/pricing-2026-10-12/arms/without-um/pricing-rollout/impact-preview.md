# Pricing impact preview

Synthetic Rivet Desk planning data. Source snapshot: October 10, 2026; planning as of October 12, 2026.

Base scenario assumes valid notice on **2026-10-12**. This is an illustration, not a selected notice date or proof of delivery. No customer notices have been sent. No live billing account is connected.

The two amount interpretations are mutually exclusive. Neither is confirmed. Proposed prices are USD, exclude unmodeled taxes/credits/fees, and retain recurring percentage discounts. Annual normalization divides contract value by 12; it is not cash revenue or an accounting revenue schedule.

## Proposed list prices

| Plan | Current monthly | Proposed monthly | Change | Proposed annual |
| --- | ---: | ---: | ---: | ---: |
| Team | $99 | $129 | +$30 / 30.30% | $1,290 |
| Business | $249 | $299 | +$50 / 20.08% | $2,990 |

Annual prices are proposed at 10× monthly. The existing Business annual subscription is $2,490, so its proposed renewal increase is $500 / 20.08%. No current Team annual contract is supplied.

## Four active subscriptions, excluding payment hold and cancellation

| CSV amount interpretation | Current normalized MRR | Fully transitioned MRR | Monthly uplift | Uplift % | Annualized uplift |
| --- | ---: | ---: | ---: | ---: | ---: |
| before discount | $484.70 | $610.37 | +$125.67 | 25.93% | +$1508.00 |
| after discount | $504.50 | $610.37 | +$105.87 | 20.98% | +$1270.40 |

This is a constant-cohort scenario with no churn, failed payments, plan changes, tax changes, or additional discounts. It does not forecast new-buyer volume. 'Annualized uplift' is the eventual run rate, not first-year cash collected.

## Customer-level preview

| Subscription | Treatment | Modeled current → proposed recurring bill | Effective renewal in base scenario | Latest notice date for that renewal |
| --- | --- | --- | --- | --- |
| S-001 — Example Elm | Standard monthly | $99.00 → $129.00 / month | 2026-12-03 | 2026-11-03 |
| S-002 — Example Willow | Honor full annual term | $2490.00 → $2990.00 / year | 2027-03-01 | 2027-01-30 |
| S-003 — Example Canal | Keep 20% recurring discount | $79.20 or $99.00 → $103.20 / month | 2026-12-10 | 2026-11-10 |
| S-004 — Example Cedar | Hold while past due (recommended policy) | $249.00 → $299.00 / month (potential only; excluded) | Unscheduled | — |
| S-005 — Example Harbor | Exclude scheduled cancellation | $99.00 → $129.00 / month (potential only; excluded) | Unscheduled | — |
| S-006 — Example Maple | Honor $99 fixed rate through commitment | $99.00 → $129.00 / month | 2027-02-05 | 2027-01-06 |

S-003 has a confirmed 20% recurring percentage discount with no fixed end date. If its CSV $99 is a list amount, the modeled current bill is $79.20 and the increase is $24.00. If $99 is already the discounted bill, the increase to $103.20 is $4.20. The latter interpretation conflicts with the stated $99 Team list price and needs invoice/price-record reconciliation. Do not apply the discount twice or use either current amount in a notice until verified.

S-004 is not counted as a collectible price increase while past due. S-005 remains canceled at its current period end. The proposed amounts for these two rows are reference values, not migration instructions.

## Timing sensitivity

| Hypothetical notice date | Elm (S-001) | Canal (S-003) | Maple (S-006) | Willow annual (S-002) |
| --- | --- | --- | --- | --- |
| 2026-10-12 | 2026-12-03 | 2026-12-10 | 2027-02-05 | 2027-03-01 |
| 2026-11-01 | 2026-12-03 | 2026-12-10 | 2027-02-05 | 2027-03-01 |
| 2026-11-04 | 2027-01-03 | 2026-12-10 | 2027-02-05 | 2027-03-01 |
| 2026-11-11 | 2027-01-03 | 2027-01-10 | 2027-02-05 | 2027-03-01 |

Rule: first natural renewal on or after valid notice + 30 calendar days, the proposed November 1 new-buyer launch, and any fixed-price commitment end. Annual subscriptions retain their price through the current term. The launch floor is a conservative planning choice. Renewal anchors are assumed unchanged. Exact notice timing, delivery requirements, provider timezone, renewal timestamps, and proration behavior remain unverified; send with a buffer and validate before scheduling.

With no notices before October 12, November 3 and November 10 are already too early for an increase. To retain December 3 for Elm, valid notice must occur by November 3; to retain December 10 for Canal, by November 10. Maple's fixed rate ends February 1, 2027; its next modeled natural renewal is February 5, with notice by January 6. Willow's annual renewal is March 1, with notice by January 30.

## Base-scenario MRR progression

| Date / event | If amounts are before discounts | If amounts are after discounts |
| --- | ---: | ---: |
| 2026-11-01 — new-buyer target launch | $484.70 | $504.50 |
| 2026-12-03 — eligible renewal(s) | $514.70 | $534.50 |
| 2026-12-10 — eligible renewal(s) | $538.70 | $538.70 |
| 2027-02-05 — eligible renewal(s) | $568.70 | $568.70 |
| 2027-03-01 — eligible renewal(s) | $610.37 | $610.37 |

The dates and progression above depend on the base notice scenario; changing the actual notice date can defer revenue. All calculations use unrounded Decimal values and round only for display.

Sources: [company record](../company/company.json), [proposal](../billing/pricing-proposal.txt), [commitments](../billing/commitments.txt), [subscription snapshot](../billing/subscriptions.csv).

Regenerate this report and both CSVs from the workspace root with `python3 pricing-rollout/build_preview.py --notice-date YYYY-MM-DD`. Recheck source records before adapting this snapshot-specific worksheet.
