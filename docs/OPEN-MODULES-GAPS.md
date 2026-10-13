# Open modules — gap analysis against the process corpus

Founder ask (2026-10-02): *"what open modules can we improve logic-wise? can we go deep
here and see how they connect to our processes?"* This is the corpus-wide walk: every
process family checked against the open modules (`lib/openstartup/`,
registry `open-modules/README.md`, wiring `processes/business-logic-map.json`) for steps
with **real computable math that no module served**. The house bar for a BUILD verdict is
fixed: a citation per formula, a published worked example replayed number-for-number (or an
honest hand-derived derivation where the canonical source publishes the formula without
numbers), explicit rounding, `needs_review` posture, educational-not-advice, pure and
client-safe. A candidate without a publishable worked example gets an honest SKIP, not a
hand-wave.

Outcome of this pass: **3 modules built** (priced-round composer, unit economics, deferred
revenue — see "Built" below), the rest assessed with verdicts.

## The candidate table

| # | Candidate | Process / steps it would serve | Citable worked-example source | Verdict |
|---|-----------|--------------------------------|-------------------------------|---------|
| 1 | **Round composer** — option-pool evolution + SAFE conversion + pricing + anti-dilution replayed end-to-end over fund_002's step sequence | fund_002 n1 (term sheet), n7 (wires + issuance), n9 (post-close table); fund_006 n4 (pro-forma review) | YC Post-Money Safe User Guide Appendix II Example 1 — the full pro-forma, already replayed function-by-function in `capTable.test.ts` | **BUILT** — `roundComposer.ts` |
| 2 | **Unit economics** — LTV/CAC, burn multiple, Rule of 40, magic number | qs_050, fin_003 n4, scale_005 n4 (previously served by NO module), growth_002 n3, growth_014 n7 | Skok's SaaS Metrics 2.0 detailed definitions (formulas + lifetime figures); Sacks "The Burn Multiple" 2020-04-23 ($2M/$1M=2x, $5M/$1M=5x); Feld Rule-of-40 2015-02-03 (20+20 / 40+0 / 50−10); O'Driscoll "Magic Number Math" 2010-04-20 (formula + bands; no numeric example — hand-derived, stated). All URLs verified 2026-10-02. | **BUILT** — `unitEconomics.ts`; benchmarks are inputs, never encoded |
| 3 | **Deferred-revenue recognition basics** | fin_002 n5 (P&L's subscription revenue split), growth_001 (task level), growth_014 n4 (migration proration) | Stripe Docs, Revenue Recognition subscription examples (verified 2026-10-02): $31 → 17/14; $365 annual → 31/28/31 with deferred 334/306/275; upgrade −30/+40 (April $100) and downgrade −30/+10 (April $70) | **BUILT** — `deferredRevenue.ts`; ASC 606 judgment stays with the accountant, `needsReview` everywhere |
| 4 | Milestone / performance vesting | fund_004 n4, hr_010 n7 (exec grants often carry performance tranches) | None at the bar. The computable part is trivial bookkeeping (tranche vests when the board certifies the milestone — a boolean the plan documents own); no published worked arithmetic beyond that. Cooley GO / Holloway describe the concept, not a formula. | **SKIP** — no real math to encode; `vesting.ts`'s tranche schedules already carry everything date-shaped |
| 5 | NSO supplemental-withholding completeness (add FICA-on-spread, state layer) | hr_005 n2, fund_004 | Partially exists: `optionTax.supplementalWithholdingIllustration` already does the published 22%/37% federal rates (rule `us-fed.supplemental-wage-withholding-2026`). Completing it means FICA on the spread (Pub 15/15-B — citable) **plus the state layer, which needs dated state rule cards first**. | **DEFER** — a small extension of `optionTax.ts` once state cards exist; not a new module |
| 6 | State payroll boundary (CA EDD SUI/ETT/SDI etc.) | qs_063, hr_001, hr_002 — `payrollTax.ts` states the boundary on every result today | EDD publishes current CA rates and wage bases (citable), as do other states — but the house rule is right: **dated rule cards in `rules/US-CA/` first**, then the module extension. Rates churn annually; without cards the module would rot silently. | **DEFER** — rules-cards-first work, explicitly anticipated by the payroll module's "Still planned" note |
| 7 | Invoice / AR aging math | fin_001 n1 (outstanding bills), sales_002 n4 (track payment status) | None at the bar. Aging buckets (0–30/31–60/61–90/90+) are a reporting convention with no canonical published worked example — vendor help pages describe screens, not arithmetic worth citing. The "math" is date bucketing `deadlines.ts` patterns already cover. | **SKIP** — would be decoration, not computation |
| 8 | Budget vs actuals variance | fin_010, fin_002 n7 (flag anomalies), scale_005 | Variance = actual − budget (and %) is arithmetic beneath the bar; the decision content (which variances matter, thresholds) is benchmark-shaped and the house posture says benchmarks are inputs. No canonical citable worked example. | **SKIP** — `runway.hiringImpact` + `unitEconomics.compareToBenchmark` already cover the computable parts honestly |
| 9 | SAFE side-letter mechanics | fund_001, fund_006 | Already served: the pro rata side letter IS implemented (capTable pro rata per User Guide §E, Appendix II replayed; `round.proRataShares` / `maintainOwnership`). The other common side letters (information rights, MFN-on-terms) have no computable math. | **DONE / SKIP** — nothing honest left to build |
| 10 | Convertible-note MFN | fund_001, fund_006 | The YC MFN mechanics are SAFE-specific and already in `capTable.ts` (Appendix I §3, no cherry-picking). Note MFN clauses are bespoke contract text with no published standard mechanics or worked example. | **SKIP** — contract text, not computable convention |
| 11 | Equity refresh benchmarks (input-taking only) | hr_001, hr_010, scale_001 | `vesting.portfolioVestedAsOf` already composes refresh grants additively (the Rewarding Talent practice, cited); the grids themselves are the book's published tables — and the house posture (benchmarks are inputs) is now executable via `unitEconomics.compareToBenchmark`'s pattern. | **DONE in posture** — no new module; per-role grid values stay in the book, supplied as inputs |
| 12 | VC fund back-office math (capital calls, management fees) | vc_003 n1/n4 (capital call notice, management fee) | Real computable math (commitment × fee %, pro-rata call allocation) and ILPA publishes model documents — but no single canonical worked example at the bar, and fund accounting conventions (fee step-downs, recycling, waterfalls) are LPA text. | **CANDIDATE (next)** — buildable if someone pins an ILPA/model-LPA worked example; honest scope would be call allocation + flat fee arithmetic only |
| 13 | FDIC insurance exposure check | sit_005 n2 ("size the exposure against the $250,000 limit") | FDIC publishes the limit and worked coverage examples (EDIE). The math is `min(balance, limit)` per depositor/bank/ownership category — category determination is the judgment. | **SKIP as module** — better served as a dated rule card + one flag; noted for a future deadlines/rules-style pass |
| 14 | Final paycheck + PTO payout | hr_005 n2 | State-law dependent (payout-on-termination rules and deadlines vary by state); federal law mandates neither. Needs state rule cards first, same posture as #6. | **DEFER** — rules-cards-first |

## Built this pass

1. **`lib/openstartup/roundComposer.ts`** — the end-to-end priced-round replay the founder
   named: ONE narrative composition over capTable + round + antiDilution + waterfall whose
   output maps stage-by-stage onto fund_002's DAG (`termSheetEconomics` → n1,
   `replayPricedRound` → n7 closing wires/issuance and n9 post-close table,
   `postCloseLiquidityCheck` and `downRoundPreview` as the post-close sanity reads). The
   YC Appendix II Example 1 pro-forma replays end-to-end in its tests, with
   composition-equality assertions proving the composer invents no arithmetic of its own.
   Step map extended: fund_002 n1/n7/n9, fund_006 n4.
2. **`lib/openstartup/unitEconomics.ts`** — LTV/CAC/payback/MRR movement (Skok), burn
   multiple (Sacks, examples replayed, net-new-ARR ≤ 0 caveat honored), Rule of 40 (Feld,
   all three published scenarios), magic number (O'Driscoll). Benchmarks are inputs —
   `compareToBenchmark` refuses an unsourced band. Step map: fin_003 n4, scale_005 n4
   (scale_005 was previously served by no module at all), growth_002 n3, growth_014 n7;
   task-level qs_050.
3. **`lib/openstartup/deferredRevenue.ts`** — straight-line whole-day recognition +
   plan-change proration, Stripe's published subscription examples replayed
   number-for-number, cents conserved via `waterfall.allocateCents`. Step map: fin_002 n5,
   growth_014 n4; task-level growth_001.

## The corpus walk (where the remaining math is, family by family)

- **form/startup/legal/qs-setup/ops/prod/sw/brand/domain/site/team/vendor** — vendor
  workflow steps (accounts, configs, filings, signatures). No unserved computable math
  beyond what `deadlines.ts`/`deFranchiseTax.ts` already carry; brand_003's WCAG contrast
  check is real math but belongs to the UI lane's tooling, not a founder-logic module.
- **fund_001–fund_007** — now densely served (capTable, round, roundComposer,
  convertibleNote, waterfall, grant409aSanity, antiDilution). Remaining honest gap: none at
  the bar. fund_003's valuation itself stays deliberately out (`producesValuation: false`).
- **tax_001/002/003/010/011** — served (deFranchiseTax, deadlines, rdCredit). tax_003's
  $600 1099-NEC threshold and tax_011's state nexus thresholds are rule-card material, not
  modules (thresholds churn; cards date them).
- **fin_001/002/003/010, qs_050, scale_005** — the finance spine: now served by runway +
  unitEconomics + deferredRevenue. Remaining gaps are #7/#8 above (skipped honestly).
- **hr/scale people processes** — payrollTax/vesting/equityComp/optionTax serve the
  computable steps; the open items are the state-layer defers (#5, #6, #14).
- **growth/sales** — growth_002/growth_014 now carry unit-econ and proration math;
  growth_013 (referral) and growth_015 (win-back) have CAC-per-channel flavor but no
  citable formulation beyond what `unitEconomics.cac` already provides as an input-taking
  function — mapping them would be decoration.
- **vc_001–003** — the one family with real unserved math left (#12). Next-best candidate
  if a citable worked example is pinned.
- **sit_*** — situation playbooks; sit_005's FDIC check (#13) is the only computable gap,
  rule-card shaped. sit_007/sit_010 already served (vesting, deFranchiseTax).
- **shutdown_001** — the franchise-tax true-up step could honestly reuse
  `deFranchiseTax.compareFranchiseTaxMethods` at task level; left to the coordinator as a
  map-only extension (no new math).

## Notes for the coordinator (out of this lane's scope)

- **Root `README.md`**: add bullets for the three new modules under the open-modules
  section (priced-round composer; unit economics; deferred revenue).
- **`resources/registry.json`**: consider entries for the four new citations (Skok
  definitions page, Sacks burn-multiple post, Feld Rule-of-40 post, O'Driscoll magic-number
  post) so modules can cite resource ids like `index-rewarding-talent` does.
- **Map-only extensions worth considering**: deFranchiseTax → shutdown_001 (true-up step);
  runway → scale_005 n4 alongside the new unitEconomics entries.
- **UI**: the new step chips (fund_002 n1/n7/n9, fund_006 n4, fin_003 n4, scale_005 n4,
  growth_002 n3, growth_014 n4/n7, fin_002 n5) render through the existing
  `businessLogicMap` loaders — no page work was done in this lane.
