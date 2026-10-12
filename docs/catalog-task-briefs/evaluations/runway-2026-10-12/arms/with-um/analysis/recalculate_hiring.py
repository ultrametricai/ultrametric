"""Rebuild the local hiring cash model using only the Python standard library.

Edit hiring_assumptions.json, then run: python3 analysis/recalculate_hiring.py
Cash figures are USD. Source files remain unchanged. No network or external writes.
"""
import csv
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
D = Decimal


def read_csv(path):
    with path.open(newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(name, rows):
    with (HERE / name).open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def money(value):
    return f"{value:,.2f}"


def main():
    assumptions = json.loads((HERE / "hiring_assumptions.json").read_text(), parse_float=D)
    transactions = read_csv(ROOT / "finance/transactions.csv")
    balances = read_csv(ROOT / "finance/account-balances.csv")
    movements = defaultdict(D)
    transfers = defaultdict(list)
    historical = defaultdict(lambda: defaultdict(D))
    normalized = []
    for line, row in enumerate(transactions, 2):
        amount = D(row["amount"])
        assert row["currency"] == assumptions["currency"]
        assert "2026-07-01" <= row["date"] <= assumptions["cash_as_of"]
        movements[row["account"]] += amount
        category = row["bookkeeping_category"]
        month = row["date"][:7]
        if category == "transfer":
            assert row["transfer_reference"]
            transfers[row["transfer_reference"]].append(row)
            classification = "internal_transfer"
        elif category == "financing":
            historical[month]["financing"] += amount
            classification = "financing"
        elif category == "receipts":
            historical[month]["customer_receipts"] += amount
            classification = "operating_receipt"
        else:
            assert amount < 0
            historical[month]["operating_outflows"] -= amount
            classification = {
                "legal": "confirmed_one_off_legal",
                "travel": "irregular_travel_reimbursement",
                "refund": "customer_refund",
                "tax": "quarterly_tax_payment",
            }.get(category, "recurring_operating_outflow")
        normalized.append({"source_row": f"finance/transactions.csv:{line}", **row,
                           "analysis_classification": classification})

    for reference, legs in transfers.items():
        assert len(legs) == 2, reference
        assert len({row["account"] for row in legs}) == 2, reference
        assert sum(D(row["amount"]) for row in legs) == 0, reference
        assert len({row["date"] for row in legs}) == 1, reference
    assert len(transactions) == len({tuple(row.items()) for row in transactions}), "Duplicate source rows"
    account_names = {row["account"] for row in balances}
    assert len(account_names) == len(balances)
    assert account_names == set(assumptions["opening_account_balances_2026_07_01"]) == set(movements)
    reconciliation = []
    for row in balances:
        assert row["as_of"] == assumptions["cash_as_of"]
        assert row["currency"] == assumptions["currency"]
        opening = D(assumptions["opening_account_balances_2026_07_01"][row["account"]])
        actual = D(row["balance"])
        expected = opening + movements[row["account"]]
        assert expected == actual, f"Unresolved reconciliation: {row['account']}"
        reconciliation.append({"account": row["account"], "opening_balance": opening,
                               "net_transactions": movements[row["account"]],
                               "calculated_closing": expected, "reported_closing": actual,
                               "difference": actual - expected})
    gross_cash = sum(D(row["balance"]) for row in balances)
    available_cash = gross_cash - D(assumptions["restricted_customer_deposits"])
    threshold = D(assumptions["minimum_unrestricted_cash"])
    recurring = sum(D(v) for v in assumptions["monthly_costs"].values())
    rows = []
    summary = []
    for scenario in assumptions["scenarios"]:
        cash = available_cash
        first_below_buffer = None
        first_nonpositive = None
        for month in assumptions["forecast_months"]:
            opening = cash
            receipts = D(assumptions["monthly_receipts"])
            loss = D(0)
            if scenario["customer_loss"] and month >= assumptions["downside_first_loss_month"]:
                loss = receipts * D(assumptions["downside_receipts_loss_fraction"])
                receipts -= loss
            start = scenario["start_month"]
            hire = D(assumptions["engineer_monthly_loaded_cost"]) if start and month >= start else D(0)
            recruiter = (D(assumptions["recruiter_fee"])
                         if start and month == assumptions["recruiter_payment_month"] else D(0))
            additional = D(assumptions["additional_payments_by_month"].get(month, 0))
            total_outflows = recurring + hire + recruiter + additional
            cash = opening + receipts - total_outflows
            below = cash < threshold
            if below and first_below_buffer is None:
                first_below_buffer = month
            if cash <= 0 and first_nonpositive is None:
                first_nonpositive = month
            rows.append({"scenario": scenario["id"], "month": month, "opening_available_cash": opening,
                         "receipts": receipts, "receipts_lost": loss,
                         "existing_recurring_costs_including_tax_reserve": recurring,
                         "engineer_cost": hire, "recruiter_fee": recruiter,
                         "additional_payments": additional, "total_cash_uses": total_outflows,
                         "net_cash_use": total_outflows - receipts, "closing_available_cash": cash,
                         "minimum_buffer": threshold, "headroom_above_buffer": cash - threshold,
                         "below_buffer": below})
        summary.append({"scenario": scenario["id"], "ending_cash": cash,
                        "buffer_headroom": cash - threshold,
                        "first_month_below_buffer": first_below_buffer or "None in horizon",
                        "first_nonpositive_cash_month": first_nonpositive or "None in horizon"})

    write_csv("monthly_forecast.csv", rows)
    write_csv("transaction_classification.csv", normalized)
    # Reopen the saved forecast and independently verify cumulative totals,
    # each monthly cash identity, and the first threshold/depletion periods.
    reopened = read_csv(HERE / "monthly_forecast.csv")
    for result in summary:
        scenario_rows = [row for row in reopened if row["scenario"] == result["scenario"]]
        assert len(scenario_rows) == len(assumptions["forecast_months"])
        running = available_cash
        for row in scenario_rows:
            assert D(row["opening_available_cash"]) == running
            uses = sum(D(row[field]) for field in (
                "existing_recurring_costs_including_tax_reserve", "engineer_cost",
                "recruiter_fee", "additional_payments"))
            assert uses == D(row["total_cash_uses"])
            running += D(row["receipts"]) - uses
            assert running == D(row["closing_available_cash"])
        assert running == result["ending_cash"]
        for key, limit, inclusive in (("first_month_below_buffer", threshold, False),
                                      ("first_nonpositive_cash_month", D(0), True)):
            first = next((row["month"] for row in scenario_rows
                          if (D(row["closing_available_cash"]) <= limit if inclusive
                              else D(row["closing_available_cash"]) < limit)), "None in horizon")
            assert first == result[key]

    lines = ["# Calculated cash model", "", "Generated from hiring_assumptions.json and source CSVs.",
             "All figures USD. Source records are synthetic.", "",
             f"Cash as of {assumptions['cash_as_of']}: gross {money(gross_cash)}; "
             f"unrestricted {money(available_cash)}; minimum buffer {money(threshold)}.", "",
             "## Account reconciliation", "",
             "| Account | July 1 opening | Net transactions | September 30 calculated | Reported | Difference |",
             "|---|---:|---:|---:|---:|---:|"]
    for row in reconciliation:
        lines.append("| " + " | ".join([row["account"]] + [money(row[field]) for field in
                     ("opening_balance", "net_transactions", "calculated_closing", "reported_closing", "difference")]) + " |")
    lines += ["", "## Historical operating cash", "",
              "Internal transfers cancel and financing is excluded from operating receipts.", "",
              "| Month | Customer receipts | Operating outflows, including irregular items | Net operating burn | Financing |",
              "|---|---:|---:|---:|---:|"]
    for month, values in sorted(historical.items()):
        lines.append(f"| {month} | {money(values['customer_receipts'])} | {money(values['operating_outflows'])} | "
                     f"{money(values['operating_outflows'] - values['customer_receipts'])} | {money(values['financing'])} |")
    lines += ["", "## Forecast outcomes", "",
              "| Scenario | March ending cash | Headroom above buffer | First month below buffer | First nonpositive cash month |",
              "|---|---:|---:|---|---|"]
    for row in summary:
        lines.append(f"| {row['scenario']} | {money(row['ending_cash'])} | {money(row['buffer_headroom'])} | "
                     f"{row['first_month_below_buffer']} | {row['first_nonpositive_cash_month']} |")
    lines += ["", "Negative closing cash represents a funding shortfall; no overdraft is assumed.", "",
              "Verification: both accounts reconcile; transfer pairs cancel; source duplicate check passed; "
              "all saved forecast rows reopened and recalculated successfully.", "",
              "Editing assumptions and rerunning updates this file and the CSVs. The narrative decision note "
              "records the original analysis and must be reviewed if assumptions change.", ""]
    (HERE / "calculated_results.md").write_text("\n".join(lines))
    print("Reconciled both accounts and recalculated all saved forecast scenarios.")
    for result in summary:
        print(result["scenario"], "March cash:", money(result["ending_cash"]),
              "first below buffer:", result["first_month_below_buffer"])


if __name__ == "__main__":
    main()
