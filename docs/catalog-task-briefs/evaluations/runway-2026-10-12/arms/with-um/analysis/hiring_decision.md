# Engineer hiring decision — October 12, 2026

**Recommendation: defer the proposed November 1 hire.** Under the supplied plan, it breaches management's $75,000 unrestricted-cash buffer in March 2027 even if forecast receipts hold. A January start narrowly meets that buffer in the base case, but is not robust to the identified customer risk. Revisit the hire when collections, costs, or committed funding provide sufficient headroom.

This is a provisional analysis of the **synthetic Rivet Desk records**, not verified live finances. Cash is measured at September 30, 2026; the forecast runs October 2026 through March 2027. The user confirmed that newer cash figures and the large customer's renewal status are unavailable. All amounts are USD.

## Cash available and reconciliation

The September 30 operating balance is $170,800 and reserve balance is $70,000, totaling $240,800. Exclude $25,000 of refundable customer deposits: **available operating cash is $215,800**. The reserve's remaining $45,000 is included as available under the bookkeeper's account scope. The $75,000 management buffer is a separate minimum, leaving $140,800 available to spend before reaching that threshold.

Both accounts reconcile exactly from July 1 opening balances through the supplied transactions, with no unexplained difference. July's $30,000 and August's $20,000 transfers each have offsetting entries and do not affect consolidated receipts or burn. There are no duplicate source rows. The bookkeeper states that these are the only cash accounts and that no overdraft is available. See the [account reconciliation and historical cash table](calculated_results.md).

Historical operating net burn was $25,000 in July, $16,200 in August, and $18,000 in September (average $19,733/month). These figures include irregular operating payments, but exclude the $60,000 August financing receipt and internal transfers. September's $6,000 legal invoice is explicitly one-off. The travel reimbursement and customer refund remain in actual operating outflows; their recurrence is not established. The forward model uses the dated commitments rather than the historical average.

## Forward assumptions

The operating plan specifies $74,500/month of existing cash uses: $57,000 payroll including employer costs, $3,000 rent, $7,000 hosting, $2,500 subscriptions, $2,000 marketing, and $3,000 tax reserve. Forecast receipts are $62,000/month, giving **$12,500/month net burn before a hire**. The additional $12,000 insurance invoice is included in December.

The proposed engineer costs $14,000/month fully loaded from November, plus an $8,000 recruiter invoice in October. That adds **$78,000 through March** ($70,000 recurring cost plus $8,000 recruiter fee), increasing recurring net burn to $26,500/month. There is no assumed revenue benefit from the hire and no future financing is committed.

The downside assumes the at-risk customer represents exactly 25% of planned receipts ($15,500/month) and stops paying from November onward. Receipts then fall to $46,500/month; costs remain unchanged. The memo says “about one quarter” and gives a November termination option, not the exact final payment date. This is a conservative timing assumption, not a prediction of churn. No probability is assigned.

The January-start comparison keeps the $8,000 recruiter payment in October and adds three months of engineer cost ($42,000). Recruiter payment timing if approval is also deferred is unknown. Moving the payment within the forecast would affect intermediate cash but not March's total.

The $3,000 monthly tax reserve is treated as unavailable cash whether it is paid out or set aside, avoiding an overstatement of hiring capacity. Thus projected usable cash may differ from total future bank balances.

## Six-month outcomes

| Decision | March cash: receipts hold | First month below $75,000 | March cash: customer lost from November | First month below $75,000 |
|---|---:|---|---:|---|
| No hire | $128,800 | None through March | $51,300 | March |
| November 1 start | $50,800 | March | **−$26,700** | January |
| January 1 start | $78,800 | None through March | $1,300 | February |

A negative forecast balance represents a funding gap, not an assumed overdraft. With the November hire and customer loss, usable cash becomes nonpositive in March. Base-case cash remains positive throughout the horizon, but the November hire still fails the management buffer test. January's base-case headroom is only $3,800.

| Month end | Base: no hire | Base: November hire | Base: January hire | Customer loss: no hire | Customer loss: November hire | Customer loss: January hire |
|---|---:|---:|---:|---:|---:|---:|
| October 2026 | $203,300 | $195,300 | $195,300 | $203,300 | $195,300 | $195,300 |
| November 2026 | $190,800 | $168,800 | $182,800 | $175,300 | $153,300 | $167,300 |
| December 2026 | $166,300 | $130,300 | $158,300 | $135,300 | $99,300 | $127,300 |
| January 2027 | $153,800 | $103,800 | $131,800 | $107,300 | $57,300 | $85,300 |
| February 2027 | $141,300 | $77,300 | $105,300 | $79,300 | $15,300 | $43,300 |
| March 2027 | $128,800 | $50,800 | $78,800 | $51,300 | −$26,700 | $1,300 |

Each scenario's opening balance, receipts, individual cash-use components, closing balance and buffer headroom are in [monthly_forecast.csv](monthly_forecast.csv).

## What changes the decision

- **November start, base case:** requires at least $24,200 of additional collected cash, cash savings, or committed financing available by the point it is needed to preserve the March buffer. That is approximately $4,840/month from November through March, with no other changes. This only meets the stated floor; it provides no additional cushion.
- **Lower recurring cost:** with the October recruiter fee unchanged, the base-case maximum recurring hire cost for five months is $9,160/month, versus the proposed $14,000. Calculation: ($128,800 − $75,000 − $8,000) / 5.
- **Delay:** January is the earliest full-month start that preserves the buffer under the base plan. A December start would leave $64,800; January leaves $78,800. Do not interpret that narrow base-case pass as a firm approval given the missing cash update and customer uncertainty.
- **Customer-loss resilience:** the November hire needs $101,700 of cumulative improvement by March relative to the modeled downside; improvements must arrive early enough to avoid the January buffer breach. Even no hire needs $23,700 of improvement to preserve the March buffer in this downside.
- **Loss begins in December instead:** March cash would be $66,800 with no hire, −$11,200 with a November hire, and $16,800 with a January hire. The recommendation to defer the November hire is unchanged.

Minimum review triggers are the next actual bank and collection update, the customer's November decision or a missed payment, a changed hire start date or recruiter obligation, and any confirmed cost reduction or financing. Reforecast before incurring the recruiter fee or making an offer. This analysis does not approve a hire, move funds, contact anyone, or establish monitoring.

## Sources and unresolved facts

| Source | Date or coverage | Used for |
|---|---|---|
| [Account balances](../finance/account-balances.csv) | September 30, 2026 | $170,800 operating and $70,000 reserve |
| [Transactions](../finance/transactions.csv) | July–September 2026 | Reconciliation, transfers, operating receipts and outflows, financing |
| [Bookkeeper notes](../finance/bookkeeper-notes.txt) | October 2, 2026 | July 1 opening balances, restricted deposits, complete account scope, no overdraft, one-off legal cost |
| [Forward commitments](../finance/forward-commitments.txt) | October 3, 2026 | Current spending, tax reserve, December insurance, receipt forecast, customer concentration, cash floor, no committed funding |
| [Hiring proposal](../people/hiring-proposal.txt) | October 4, 2026 | Start date, fully loaded cost, recruiter fee, six-month horizon and deferral option |
| [Company record](../company/company.json) | October 10, 2026 snapshot | Company identity and explicit synthetic status |

Receipt forecasts are not signed revenue. Updated cash and customer retention information were requested and are unavailable. Unknowns include the actual October cash movements; exact collection dates; the concentrated customer's last payment and share of receipts; recruiter terms under deferral; and any unlisted incremental hiring costs or liabilities. The model assumes the supplied fully loaded engineer cost and operating commitments cover the intended expenses.

The six-month horizon matches the hiring note and receipt forecast. Cash-depletion dates beyond March are not asserted because subsequent receipts and commitments are not supplied. Monthly data cannot establish intramonth liquidity or an exact day of depletion. No external verification was performed: the requested built-in browser was unavailable. The retrieved Track runway v5 process guide was used as a read-only checklist; no remote company records or process runs were created or updated.

## Reproduce or update

Edit [hiring_assumptions.json](hiring_assumptions.json), then run from the workspace root:

```sh
python3 analysis/recalculate_hiring.py
```

The script uses only Python's standard library and writes local files. It rebuilds [monthly_forecast.csv](monthly_forecast.csv), [transaction_classification.csv](transaction_classification.csv), and [calculated_results.md](calculated_results.md). Source CSV row identifiers are preserved in the classification schedule. It reconciles both accounts, checks transfer pairs and duplicates, reopens the saved forecast, recalculates every monthly cash identity, and checks threshold/depletion periods for all six scenarios.

**Validation completed:** both account differences are zero, all 30 transaction rows are classified, and all 36 saved forecast rows recalculate successfully. This narrative is the October 12 decision snapshot; revise it alongside the generated results if assumptions change. No earlier saved company assumptions existed to supersede.
