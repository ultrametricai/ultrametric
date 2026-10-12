# Calculated cash model

Generated from hiring_assumptions.json and source CSVs.
All figures USD. Source records are synthetic.

Cash as of 2026-09-30: gross 240,800.00; unrestricted 215,800.00; minimum buffer 75,000.00.

## Account reconciliation

| Account | July 1 opening | Net transactions | September 30 calculated | Reported | Difference |
|---|---:|---:|---:|---:|---:|
| operating | 180,000.00 | -9,200.00 | 170,800.00 | 170,800.00 | 0.00 |
| reserve | 60,000.00 | 10,000.00 | 70,000.00 | 70,000.00 | 0.00 |

## Historical operating cash

Internal transfers cancel and financing is excluded from operating receipts.

| Month | Customer receipts | Operating outflows, including irregular items | Net operating burn | Financing |
|---|---:|---:|---:|---:|
| 2026-07 | 50,000.00 | 75,000.00 | 25,000.00 | 0.00 |
| 2026-08 | 56,000.00 | 72,200.00 | 16,200.00 | 60,000.00 |
| 2026-09 | 61,000.00 | 79,000.00 | 18,000.00 | 0.00 |

## Forecast outcomes

| Scenario | March ending cash | Headroom above buffer | First month below buffer | First nonpositive cash month |
|---|---:|---:|---|---|
| base_no_hire | 128,800.00 | 53,800.00 | None in horizon | None in horizon |
| base_november_hire | 50,800.00 | -24,200.00 | 2027-03 | None in horizon |
| base_january_hire | 78,800.00 | 3,800.00 | None in horizon | None in horizon |
| downside_no_hire | 51,300.00 | -23,700.00 | 2027-03 | None in horizon |
| downside_november_hire | -26,700.00 | -101,700.00 | 2027-01 | 2027-03 |
| downside_january_hire | 1,300.00 | -73,700.00 | 2027-02 | None in horizon |

Negative closing cash represents a funding shortfall; no overdraft is assumed.

Verification: both accounts reconcile; transfer pairs cancel; source duplicate check passed; all saved forecast rows reopened and recalculated successfully.

Editing assumptions and rerunning updates this file and the CSVs. The narrative decision note records the original analysis and must be reviewed if assumptions change.
