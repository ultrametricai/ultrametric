# Independent artifact review: fresh runway pair05

**A cautious N=1 artifact-usability benefit is supported.** Both arms delivered the same correct, provisional recommendation to defer the November engineer hire. UM additionally delivered a working, reusable calculation package whose outputs I independently reproduced and changed successfully in a copy. This is a concrete benefit for the next forecast update, not evidence of better baseline financial judgment, aggregate lift or a causal effect established by one pair.

This review used the actual artifacts, source files, contract and native events. The reviewer had seen this synthetic case and its guides; it was not blind. No performer/model trial was run. Original performer files were unchanged. The Python script was read before execution; it uses standard-library local reads and writes. Execution occurred only in a separate copied workspace.

## Verified outcomes

All six source-file hashes match the frozen contract in both arms. Both accounts reconcile: operating $170,800 and reserve $70,000, totaling $240,800. Excluding $25,000 of refundable deposits leaves $215,800 available. The $60,000 investor receipt is financing, transfers cancel, the December insurance bill is included, and the tax reserve reduces usable cash without an extra employer-cost multiplier.

Both correctly calculate base/no-hire March cash of $128,800, November hire $50,800 and January hire $78,800. The corresponding customer-loss outcomes are $51,300, −$26,700 and $1,300. The $75,000 buffer makes November hiring fail even in the base case; January leaves only $3,800 of headroom. No uncommitted funding or hiring-driven revenue is invented.

Control supplied a useful decision note and 48-row static CSV, including December-start and December-loss variants. I checked all 48 cash equations and buffer headrooms. UM supplied assumptions JSON, a standard-library recalculation script, 30 transaction classifications with original row locators, a 36-row forecast, generated results and a dated decision snapshot. More files are not themselves the benefit: the executable update path and retained audit trail are.

In the copy, the original UM script regenerated `monthly_forecast.csv`, `transaction_classification.csv` and `calculated_results.md` **byte-for-byte identically**. All 36 monthly cash equations and headrooms checked independently; all 30 classified transactions preserved their source fields and correct source-row identities.

Changing only `engineer_monthly_loaded_cost` from $14,000 to $15,000 produced the expected sensitivity:

| Scenario | Original March cash | Changed March cash | Change |
|---|---:|---:|---:|
| Base, no hire | $128,800 | $128,800 | $0 |
| Base, November hire | $50,800 | $45,800 | −$5,000 |
| Base, January hire | $78,800 | $75,800 | −$3,000 |
| Downside, no hire | $51,300 | $51,300 | $0 |
| Downside, November hire | −$26,700 | −$31,700 | −$5,000 |
| Downside, January hire | $1,300 | −$1,700 | −$3,000 |

The regenerated summary also correctly advances the base November-hire buffer breach from March to February, and identifies March as the newly nonpositive month for the downside January hire. See [deterministic check evidence](independent-recalculation-check.json), including a redacted copy-location marker and original-file hashes.

## Caveats and meaningful weaknesses

Both asked relevant questions about newer cash and customer retention; both received the same source-bounded “That information is not available” reply during the turn and preserved those uncertainties. Both recognize stale September balances, uncommitted receipts, uncertain customer-loss timing, no overdraft and the limits of monthly rather than daily liquidity. Neither makes a hiring commitment or takes a financial action.

- Control's static CSV has no retained regeneration tool. Its statement that the business can “pay the modeled bills through March,” and final-answer wording that cash is exhausted “during March,” overstate what month-end balances establish. The report later explains the limitation. Prefer “first negative month-end is March”; actual intramonth shortfalls remain unknown. This does not change the defer recommendation.
- UM's narrative is a **manual decision snapshot**, not regenerated with the model. The copy sensitivity leaves that narrative at the old figures, as its explicit warning says it will. The package supports recalculation, not an automatically synchronized decision/handoff pack; a user or agent must update the note afterward.
- UM's script is suitable for this fixed source period, not a general rolling forecast engine. It hard-codes July-opening/September-reconciliation and “March ending cash” labels, and does not validate unique chronological forecast months or reasonable assumption ranges. Ordinary cost edits work; changing the horizon needs code/label review and input validation. Those are the smallest useful robustness improvements, not blockers to the demonstrated cost sensitivity.

## Evidence limits and cost of the benefit

UM naturally retrieved `track-runway`, called `list_processes` twice and `get_context` twice. Both context reads returned no runs, records or updates; there were no `open_process` or `save_update` calls. This verifies discovery, guide use and empty-context handling, not persistent company memory, cross-agent reuse or reduced human re-explanation. The second identical context read supplied no new company facts.

| Actual resource observation | Control | UM |
|---|---:|---:|
| Gross input + output tokens | 188,412 | 316,140 |
| Cached input within that total | 154,240 | 244,096 |
| Uncached input | 26,013 | 60,930 |
| Output tokens | 8,159 | 11,114 |
| Turn start to completion | About 287 seconds | About 373 seconds |

Both finished within the revised 400k/20k/10-minute arm limits and the controller finished cleanly. The reusable UM package took more work in this run; these token counts are not a dollar-cost estimate. The account stayed within the separate trial's preregistered reserve policy. Private account-usage percentages are omitted; account consumption cannot be assigned entirely to this trial.

Pair05 used a revised cap and in-turn factual replies after earlier visible attempts. Its control-first order, single familiar case, author-visible fixture and stochastic performers prevent a broad or causal conclusion. Keep pilot04's interrupted UM outcome alongside this completed pair. A defensible statement is: **“On one synthetic hiring-affordability task, both answers were correct; the UM arm produced a forecast that an independent reviewer could reproduce and update without rebuilding its calculations.”**

Evidence: [curated protocol metadata](metadata.json), [transcript](transcript.json), [completion metadata](metadata.json), [control analysis](arms/without-um/analysis/engineer-hiring-assessment.md), [UM decision snapshot](arms/with-um/analysis/hiring_decision.md), [UM script](arms/with-um/analysis/recalculate_hiring.py).

Public curation: report links were rebased, the temporary copy path was redacted in the check evidence, and private account-usage percentages were omitted. Findings and deterministic verification results are unchanged.
