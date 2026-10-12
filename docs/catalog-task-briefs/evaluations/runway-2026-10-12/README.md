# Hiring-affordability process evidence

This bundle records a completed control-first comparison on one author-visible fictional company case. Both arms received “can we afford to hire another engineer?” and the same dated source files. Both reached the correct provisional recommendation to defer the November hire. The UM arm also produced an executable forecast that an independent reviewer reproduced and updated in a copy. That supports a specific artifact-usability observation for this case. Aggregate quality lift, a causal effect and company-memory benefits remain unestablished.

The evaluated process was **Track runway**, shared record `qs_050`, served as `track-runway` preview version 5 from public candidate `110ff2631ac0adf37f5325c123391af643a4a7c5`. The performer was `gpt-6-astra`, `xhigh`, with the native runtime's `default` service tier. It used a local candidate MCP fixture. This did not test a marketplace installation, production publication or a live financial account. Exact versions, hashes, tool calls, limits and factual followups are in [metadata.json](metadata.json).

## Review the evidence

- [Control assessment](arms/without-um/analysis/engineer-hiring-assessment.md) and [static forecast](arms/without-um/analysis/engineer-hiring-cashflow.csv).
- [UM decision snapshot](arms/with-um/analysis/hiring_decision.md), [assumptions](arms/with-um/analysis/hiring_assumptions.json), [recalculation script](arms/with-um/analysis/recalculate_hiring.py), [forecast](arms/with-um/analysis/monthly_forecast.csv), [transaction classifications](arms/with-um/analysis/transaction_classification.csv) and [generated results](arms/with-um/analysis/calculated_results.md).
- Each arm retains its raw fictional inputs under `company/`, `finance/` and `people/` alongside `analysis/`. Their matching hashes are recorded in [artifact-manifest.json](artifact-manifest.json).
- [Actual conversation, curated](transcript.json), including the same factual reply to each arm: “That information is not available.”
- [Independent review](independent-outcome-review.md) and [copy-only recalculation evidence](independent-recalculation-check.json).
- [Earlier attempts](prior-attempts.json), including the confirmed monitor interruption and the UM gross-token-cap interruption. Those attempts have no quality scores and remain part of the evidence.

Both forecasts start with $215,800 available cash, exclude refundable deposits, separate financing and internal transfers, and include the recruiter fee and December insurance. The proposed hire leaves $50,800 in March against a $75,000 minimum buffer. Updated cash and customer retention remained unavailable, so both recommendations are provisional. See the actual decision notes for the assumptions and downside cases.

The UM script reproduced its generated files byte-for-byte. Increasing monthly engineer cost from $14,000 to $15,000 reduced March cash by $5,000 for November starts and $3,000 for January starts, while no-hire scenarios stayed unchanged. This demonstrates a usable update path beyond a static CSV.

## Recalculate on a copy

Read the [script](arms/with-um/analysis/recalculate_hiring.py) first. It uses the Python standard library and writes generated files in its own `analysis/` directory. From this bundle directory, copy the UM workspace before running it:

```sh
task_copy="$(mktemp -d)"
cp -R arms/with-um "$task_copy/workspace"
python3 "$task_copy/workspace/analysis/recalculate_hiring.py"
```

Edit `engineer_monthly_loaded_cost` in the copy's `analysis/hiring_assumptions.json` and rerun to reproduce the sensitivity check. Preserve the committed evidence files. The narrative decision note is a dated manual snapshot and must be reviewed after inputs change. The script's date/horizon labels and validation are scoped to this source period; arbitrary rolling-horizon changes require further review.

## Limits and provenance

UM used more time and tokens in this completed pair: approximately 373 seconds and 316,140 gross tokens, compared with 287 seconds and 188,412 for control. Gross tokens include cached input and do not establish monetary cost. Control supplied additional static scenarios; file count alone is not the usability finding.

This is one familiar synthetic case, with a fixed control-first order, visible earlier attempts and a revised token cap. The independent reviewer saw the case and guides. It provides no blind-holdout result, aggregate estimate or proof that the guide caused the observed difference. UM read empty context twice but created no process run or stored update, so cross-agent memory and reduced re-explanation were not exercised.

Raw fictional sources and performer output artifacts are byte-identical copies. Curated conversation output links replace absolute user paths with bundle-relative paths; internal IDs are omitted. Metadata and reports exclude full native logs, personal configuration/instructions, account and organization identifiers, numeric credit balances, credentials and private endpoints. The independent check's temporary copy path is redacted, report links are rebased, and private account-usage percentages are omitted. These changes are recorded in the metadata. They do not alter the source files, performer artifacts, arithmetic or measured resource totals.
