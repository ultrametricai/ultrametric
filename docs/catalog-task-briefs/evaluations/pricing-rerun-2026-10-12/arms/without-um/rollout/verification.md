# Verification record

Local checks completed October 12, 2026. Nine groups of assertions passed against the generated files and calendar calculations. These validate the synthetic model only. No billing provider, invoice, checkout, notice delivery, public website, or live account was accessed or tested.

## Local model checks — passed

1. Coverage: six input subscriptions appear exactly once in each of two alternative scenarios, for twelve impact rows; seven month ends per scenario produce fourteen forecast rows.
2. Notice and treatment: all four active candidates satisfy the modeled 30-day interval. Expected dates are December 3, December 10, February 5, and March 1. Past-due and cancelling accounts have blank migration dates.
3. Discount: S-003's two possible current net prices are $79.20 and $99.00. Both produce a proposed $103.20 net amount with the recurring 20% percentage preserved.
4. Aggregate arithmetic: retained baseline MRR of $484.70 or $504.50 reaches $610.37. Monthly uplift is $125.67 or $105.87; annualized uplift calculated before display rounding is $1,508.00 or $1,270.40.
5. Forecast bridge: expected month-end retained totals and migration IDs reconcile. The cancelling $99 drops out after its assumed November 20 end; past-due nominal value remains $249. The resulting fully migrated all-row nominal value is $859.37, with collectibility unverified.
6. Boundary dates: moving notice from October 4 to October 5 defers S-001 from November 3 to December 3; January 6 to January 7 defers S-006 from February 5 to March 5; January 30 to January 31 defers S-002 from March 1, 2027 to March 1, 2028. These are calendar-date calculations, not evidence of delivery or contractual compliance.
7. Calendar helper: a January 31 monthly anchor advances to February 28 and then March 31 without drifting permanently to the 28th.
8. Regeneration: a November 1 hypothetical notice changes S-004's first date-eligible renewal to December 28 while preserving its hold and S-005's exclusion. The temporary alternative output was removed; the delivered files retain the October 12 assumption.
9. File integrity: both CSVs parse successfully and the written JSON matches the calculated summary.

The arithmetic uses decimal values and rounds displayed currency to cents. Annual run rate is normalized before rounding; multiplying a rounded MRR display by twelve can differ from the correctly calculated annualized amount.

## Provider acceptance cases — not run

These are expected outcomes to verify in a future authorized provider test environment, not operation receipts. Expected amounts below are modeled subscription amounts; taxes, fees, invoice adjustments, and actual provider rounding must be checked separately.

| Case | Required observable result | Status |
|---|---|---|
| New Team monthly and annual purchases | Approved USD amounts of $129/month and $1,290/year; correct cadence and matching checkout display | Not run |
| New Business monthly and annual purchases | Approved USD amounts of $299/month and $2,990/year; correct cadence and matching checkout display | Not run |
| S-001 renewal scheduling | $99 at November 3 and $129 at December 3 under the hypothetical valid notice; no immediate invoice or changed anchor | Not run |
| S-003 discounted renewal | Resolve current amount first; retain 20% recurring percentage with no expiry; $103.20 at eligible December 10 renewal | Not run; current amount unresolved |
| S-002 annual preservation | No midterm charge or restarted term; $2,990 at eligible March 1 annual renewal | Not run |
| S-006 fixed-rate protection | $99 through commitment; first changed renewal February 5 at $129, subject to valid notice | Not run |
| S-004 past-due hold | No migration; previously issued invoices and collections schedule unchanged by this rollout | Not run |
| S-005 cancellation | Cancellation remains in place; no reactivation, migration, or renewal after the verified cancellation end | Not run |
| Proration and immediate billing | Scheduling creates no unintended charge, credit, invoice, anchor reset, or changed collection date; inspect before/after invoices | Not run |
| Notice timing and failed delivery | Verify actual delivery rule, timestamps, timezones, and eligible renewal; defer when insufficient or unresolved | Not run |
| Repeated operation | Repeating or retrying a scheduling operation creates no duplicate changes or charges | Not run |
| Recovery | Can pause remaining changes, restore a valid pending schedule, and handle an already-issued incorrect invoice via a verified correction process | Not run |

Record provider, environment, timestamp, subscription/price identifiers, preview or invoice identifiers, actual amounts, pass/fail, and reviewer for each real trial. Empty evidence fields must remain unverified. There is no connected live account in this synthetic exercise, so the completed deliverable is the preview and draft rollout package.
