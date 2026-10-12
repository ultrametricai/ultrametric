# Independent pricing artifact review

The control completed a working local pricing preview. UM discovered and opened the intended candidate guide and produced a working scenario model, but the harness interrupted it before delivery finished. Both models reproduce in disposable copies. This is evidence of distinct useful artifacts from a completed control and a partial UM arm, not a completed paired comparison or a measured UM improvement.

The natural prompt was “help me roll out our new pricing.” Both arms received the same four synthetic files and the same factual-answer policy. The unpublished candidate was `110ff2631ac0adf37f5325c123391af643a4a7c5`; the retrieved `roll-out-a-pricing-change` preview version was 3 with instruction SHA-256 `9738ba8eabba0625e2631454ce98eb463dce044c59ae285429fb0e726c138482`. Production publication and marketplace installation were not exercised.

## Arithmetic and lifecycle evidence

For the explicitly modeled four-active-subscription cohort, treating source amounts as before discount gives $484.70 current normalized monthly revenue and $610.37 eventual monthly revenue if all four customers renew at proposed prices. The $125.67 monthly uplift is a run-rate comparison, not cash collected or recognized revenue. Treating Canal's source $99 as already net instead gives $504.50 current and $105.87 uplift. Both alternatives are present in control's full ledger; UM uses the first throughout its ledger and customer drafts and records the alternative only as an aggregate sensitivity.

All six source subscriptions are accounted for. Both preserve the annual term, the continuing 20% discount, Maple's fixed $99 rate through February 1, 2027, Cedar's past-due hold and Harbor's pending cancellation. For an explicitly hypothetical October 12 notice, the first modeled increases are December 3 for Elm, March 1, 2027 for Willow, December 10 for Canal and February 5, 2027 for Maple. Neither model schedules Cedar or Harbor for an increase. Actual notice, provider and execution facts remain absent.

Independent source-based arithmetic checked control's twelve ledger rows across the two amount interpretations and sixteen notice-scenario rows. Its three generated reports reproduced byte for byte. UM's seven generated artifacts reproduced byte for byte; independent checks covered six transition rows, twenty month-end scenario rows, ten invoice-simulation rows and six unexecuted execution rows. Both reject backdated notice examples and move the annual renewal a full year when a January 31, 2027 notice misses its notice window. Original workspaces were hash-checked before and after the copy-only checks and were unchanged.

## Material differences

Control already supplies an executable standard-library generator, an impact ledger, notice sensitivity, customer drafts and a rollout runbook. Its full parallel amount interpretations are useful while the export's gross/net semantics remain unknown. It does not calculate customer-loss downside or a month-by-month cohort progression. Its generator rebuilds three reports; the README, customer drafts and runbook require manual reconciliation after scenario changes.

UM's model adds a five-month retained/delayed/one-customer-loss trajectory and explicit blank execution/readback fields. Under its stated pre-discount interpretation, losing Elm at the first increase produces eventual $481.37 monthly revenue, $3.33 below the starting $484.70. The loss therefore erases the proposed aggregate uplift in that scenario. This is an algebraic sensitivity with no estimated probability; it does not establish demand or a likely churn rate. The customer-loss result and lifecycle handling pass independent recalculation.

UM's primary customer drafts assume Canal currently pays $79.20. They say to verify the amount before use, and their effective dates/contacts remain placeholders. Its aggregate already-net sensitivity is not propagated through a second ledger, all scenario rows or revised notices. The preview says the already-net reading conflicts with the stated Team list price; the supplied files do not resolve how the subscription export encodes discounts, so this remains an unresolved source ambiguity.

Both scripts contain snapshot-specific policy constants and prose. Changing a pricing proposal or commitment file is not enough to update contractual logic safely. UM's source hashes record changes but do not turn prose commitments into executable policy. Neither script establishes provider behavior, proration, tax, invoice rounding beyond its own arithmetic, delivery sufficiency, recipient identity, or a real billing change.

## Interrupted and blocked work

The controller stopped UM on `telemetry_failure` when a weekly reset epoch shifted by one second. Subsequent read-only checks restored the original accounting identity; this package retains the original interruption. UM has no final delivered answer. Its generated preview references four absent artifacts: `pricing_copy.md`, `billing_handoff.md`, `sources.md` and `verify_model.py`. Those files must not be presented as delivered or verified. The interrupted output was not completed by the reviewer, and no guide change is inferred merely from this interruption.

UM's `open_process` succeeded. Its one `save_update` failed before reaching the synthetic persistence service with the exact native error: “MCP tool call requires approval, but approval policy is never”. This is a harness restriction on the authorized synthetic operation, not evidence that product persistence failed. No successful save or performer readback is established. The campaign left approval policy unchanged; an exact-tool session override was separately documented but not applied. Company memory, cross-agent explanation reuse and recovery after a persisted save remain untested.

All execution-ledger receipts are blank and marked not executed. No billing provider, test invoice, live price catalog, subscription mutation, delivered notice or published pricing page was exercised. The missing provider and actual notice date limit what meaningful local artifacts can establish; both arms appropriately retain those boundaries.

## Design and resource limits

This was an author-visible synthetic case, control first, with operator inspection before the UM match and a separate independent artifact reviewer. It was not blind or randomized. Both arms used `gpt-6-astra`, `xhigh`, default service tier. The prospective remaining-case addendum gave each arm 1,600,000 gross tokens, 20,000 output tokens, 600 seconds and four factual continuations before either began. Earlier CRM interruptions at a lower ceiling remain separate evidence. Public search was available, shell network and personal tools were restricted, and only UM had the isolated candidate MCP.

Observed token totals were 211,625 for control and 340,667 for interrupted UM, including repeated cached input. These are workload observations, not dollars or standardized efficiency scores. Control's recorded native turn time was 473.121 seconds. UM's local start-to-interruption event receipts span about 482.978 seconds; the collector omitted that incomplete turn from its native-duration field, so zero must not be interpreted as zero work. Outcome comparisons cannot separate guide effects from different tool paths, stochastic behavior or the interruption.

No scalar quality score, rank or artifact-count benefit is asserted. The preserved artifacts and deterministic checks support the narrower findings above.
