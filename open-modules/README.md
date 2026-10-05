# Open modules — decision support, calculations, calendars, comparisons

Part of [the open startup repo](../README.md#open-modules): the open modules — reusable
decision support, calculations, calendars, and comparisons — separate from law (`rules/`)
and the vendor evidence layer (`vendors/`, `data/`). The modules live in `lib/openstartup/`
and are indexed in the table below; every one is pure, client-safe, deterministic, and
validated by worked-example and property tests (`npx vitest run lib/openstartup/__tests__/`).
Repo-first by design: use the modules from tests, scripts, or your own agent.

The bar, fixed for every module: a contract, explicit assumptions, a citation on every
formula's doc comment (a published guide, form, or primary source — never "everyone
knows"), explicit rounding, worked examples reproduced number-for-number from the cited
sources, deterministic tests, and explicit jurisdiction dependencies. An open module may
PROPOSE a result; it must never silently authorize a tax election, equity grant, bank
transfer, contract, or vendor disclosure. A module that leans on a legal threshold must
reference a dated rule card in `rules/` and return `needs_review` when the applicable
locale or date is unknown. Status, module by module: worked-example-verified and
property-tested — **not** independently expert-certified, and the module docs say so.

## Module index

| Module | What it computes | Serves | Worked-example source | Status |
| --- | --- | --- | --- | --- |
| [Cap table](#cap-table) | Issuance, pools, SAFE conversion, priced-round PPS, dilution waterfall | Formation + fundraising + cap-table ops | YC Post-Money Safe User Guide (Appendix II) | verified + property-tested |
| [Vesting mechanics](#vesting-mechanics) | Cliff/periodic/back-loaded schedules, acceleration, departures | Founder stock, grants, departures | Cooley GO; Amazon 5/15/40/40; FAST grid | verified + property-tested |
| [83(b) election math](#83b-election-math) | Tax-at-grant vs tax-at-vesting, forfeiture cost | Formation + LLC conversion | Rev. Proc. 2012-29 (all six examples) | verified |
| [QSBS (§ 1202)](#qsbs--1202) | Eligibility checklist, holding clock, exclusion %, per-issuer cap | Formation + LLC conversion | IRC § 1202 (re-derived caps) | verified, checklist-shaped |
| [Deadline calendar](#deadline-calendar) | Rule-card-backed due dates and recurring clocks | Tax filings, 83(b) windows | Dated rule cards in `rules/` | verified, always `needsReview` where dates can move |
| [Convertible notes](#convertible-notes) | Interest, cap/discount conversion, maturity paths, pricing with notes | Pre-seed + SAFE/note conversion | Cooley GO convertible-debt primers | verified |
| [Liquidity-event waterfall](#liquidity-event-waterfall) | Per-holder proceeds at a sale price | Fundraising exits sanity | YC User Guide Appendix II Ex. 1 Q3/Q4; Cooley GO glossary | verified + property-tested |
| [Anti-dilution](#anti-dilution) | NVCA weighted-average / full-ratchet conversion-price adjustments | Priced rounds (down rounds) | NVCA model COD; Springmeyer worked example | verified + property-tested |
| [Priced-round mechanics](#priced-round-mechanics) | Pro rata, pool-from-hiring-plan, down-round model, secondaries | Priced rounds + SAFE conversion | YC User Guide §E; Rewarding Talent; Springmeyer; Cooley GO | verified |
| [Priced-round composer](#priced-round-composer) | The round end-to-end: term sheet → wires/issuance → post-close | Priced rounds, pro-forma review | YC Appendix II Ex. 1, replayed end-to-end | verified by composition-equality |
| [409A grant sanity](#409a-grant-sanity) | Strike floor, staleness, presumptions, refresh triggers, penalty illustration | 409A + option grants | Treas. Reg. § 1.409A rule cards | sanity model — never a valuation |
| [Offer / equity-comp scenarios](#offer--equity-comp-scenarios) | Grant %, spread, exit scenarios | Offers and exec hires | Holloway equity guide; Rewarding Talent | verified, pre-tax by design |
| [ISO / NSO exercise tax](#iso--nso-exercise-tax) | NSO income, ISO/AMT outcomes, § 422(d) $100k, dispositions | Option grants + offboarding | Pub 525; Treas. Reg. § 1.422-4(d) Ex. 1–3; Rev. Proc. 2024-40 | verified; AMT is illustration-only |
| [Employer payroll tax](#employer-payroll-tax) | FICA/FUTA employer load, per-employee cost | Payroll setup + runs + hiring | IRS Pub 15 / instructions (pinned maxima) | verified, FEDERAL ONLY |
| [Delaware franchise tax](#delaware-franchise-tax) | Both published methods, exactly; the March comparison | DE franchise tax + delinquency cure | 8 Del. C. § 503 + Division worked examples | verified |
| [R&D tax mechanics](#rd-tax-mechanics) | § 174 amortization patterns, § 41(h) offset caps, Form 8974 application | R&D credit claim | IRC § 174/41; Form 8974 instructions | explanation + arithmetic — never a credit computation |
| [Runway & burn](#runway--burn) | Default-alive trajectories, hiring impact | Runway, board reports, budgets | paulgraham.com/aord.html (model) | verified, hand-derived arithmetic |
| [Unit economics](#unit-economics) | LTV/CAC, MRR movement, burn multiple, Rule of 40, magic number | Runway KPIs, board decks, churn saves, pricing changes | Skok; Sacks; Feld; O'Driscoll (all verified 2026-10-02) | verified; benchmarks are inputs |
| [Deferred revenue (subscriptions)](#deferred-revenue-subscriptions) | Straight-line day-count recognition, plan-change proration | Bookkeeping close, billing, pricing migrations | Stripe revenue-recognition subscription examples | verified; ASC 606 judgment excluded |

## Modules

Each module section follows one template — **What it computes**, **Contract**, **Worked
examples replayed**, the machine-owned **Serves** line, **Honesty boundaries**, and
**Extend it**. The Serves line names the corpus processes wired to the module in
`processes/business-logic-map.json`, with `nodeId function` pairs wherever a specific
function genuinely computes a specific step's math (those steps also wear a
`compute: <module>.<function>` chip on the live process page). It is generated by
`scripts/generate-business-logic-serves.ts` and drift-gated by
`lib/__tests__/businessLogicServes.test.ts` — edit the map, rerun the script; never
hand-edit the lines.

### Cap table

`lib/openstartup/capTable.ts` (+ `capTableCodec.ts`) — repo-only library by design, no
site page.

**What it computes.** The cap table as a fold over events: founder issuance with vesting
(the Cooley GO 4-year/1-year-cliff convention), option pools including the in-round pool
shuffle, post-money SAFE conversion per the YC Post-Money Safe User Guide
(cap/discount/MFN/pro rata, mixed-mode conversion solved as a fixed point), priced-round
PPS solving, and the dilution waterfall of snapshots after every event.

**Contract.** `buildCapTable(events) → CapTableReport` (the fold; invalid events stop it
and report `error` with snapshots preserved) · `vestedShares(total, schedule, months)` ·
`safeOwnershipPct(amount, cap)` · `safeProRataAllocationPct` / `maxSafesPctWithProRata` /
`estimateRoundDilution` (the Quick Start §3 arithmetic) · `poolIncreaseForTarget` /
`poolIncreaseForRoundTarget` (pool algebra, outside/inside a round) · `reportToCsv` /
`reportToMarkdown` · codec: `encodeCapTableState` / `decodeCapTableState`. Rounding is
stated at the top of the module: whole shares floor (`floorShares`), prices to 4 decimals
(`roundPrice`) — exactly what reproduces the guide's Appendix II figures.

**Worked examples replayed.** YC Post-Money Safe User Guide (PDF at
ycombinator.com/documents): Quick Start §1–3, Appendix I (discount/MFN/cap-and-discount),
Appendix II Example 1 end-to-end — $1.1144 PPS, 588,235/1,176,470 conversion shares,
448,671 pro rata, 17,946,424 fully diluted — and the Example 1 Q5 low-valuation mixed
conversion ($0.6577, 1,216,360 at PPS, 590,334 at cap). Tests:
`lib/openstartup/__tests__/capTable.test.ts`, written to read like a textbook.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n7 `buildCapTable`) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n4 `buildCapTable`) · [Set up cap table](https://ultrametric.ai/processes/set-up-cap-table) (n2 `buildCapTable`, n3 `safeOwnershipPct`) · [Update cap table](https://ultrametric.ai/processes/update-cap-table) (n2 `buildCapTable`) · [Audit cap table](https://ultrametric.ai/processes/audit-cap-table) (n2 `buildCapTable`) · [Raise pre-seed (SAFEs)](https://ultrametric.ai/processes/raise-pre-seed-safes) (n6 `safeOwnershipPct`, n8 `buildCapTable`) · [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n7 `buildCapTable`) · [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n2 `buildCapTable`) · [Handle a co-founder departure](https://ultrametric.ai/processes/handle-a-co-founder-departure) (n7 `buildCapTable`)

**Honesty boundaries.** Ownership must sum to 100% and shares can't go negative
(property-tested); SAFEs selling ≥ 100% are refused with the guide's own warning. The
module records what documents say — it never decides terms, and it is not
expert-certified.

**Extend it.** Another published pro-forma replayed number-for-number, or a missed edge
from the guide (e.g. additional MFN interactions). Waterfall-at-exit math belongs to the
waterfall module; round narration to the composer.

### Vesting mechanics

`lib/openstartup/vesting.ts` — pure, client-safe; real date math (UTC ISO, anniversaries
CLAMPED to short months — the stated convention; plan documents control).

**What it computes.** Time-based vesting in all its published shapes: cliff +
monthly/quarterly/annual schedules, back-loaded tranches, acceleration, departures, grant
portfolios, and the advisor grid.

**Contract.** `vestingEvents(grant) → VestingEvent[]` / `vestedAsOf(grant, asOf,
terminationOn?)` (nothing before the cliff, exactly the cliff fraction AT it,
cumulative-floor rounding with the remainder on the final date) · `cliffVesting` ·
`departureSummary(grant, terminationOn)` (unvested-repurchase mechanics; terms stay with
the plan documents) · `applyAcceleration(grant, policy, event)` (single- and double-trigger
per the Cooley GO definitions; full / %-of-unvested / months-of-service; the double trigger
requires termination to follow the sale) · `portfolioVestedAsOf` (refresh/evergreen grants
as additive composition — the Rewarding Talent practice) · `fastAdvisorGrant` (the
published FAST agreement grid, encoded and gate-tested) · `earlyExerciseSnapshot` ·
`addMonthsClamped`.

**Worked examples replayed.** The Cooley GO founder-stock convention; Amazon's published
5/15/40/40 back-loaded schedule number-for-number from the cited Forbes coverage; the FAST
grid. Tests: `lib/openstartup/__tests__/vesting.test.ts`.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n1 `vestingEvents`) · [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) (n4 `vestingEvents`) · [Hire first employee](https://ultrametric.ai/processes/hire-first-employee) (n10 `vestingEvents`) · [Hire an executive](https://ultrametric.ai/processes/hire-an-executive) (n5 `applyAcceleration`) · [Handle a co-founder departure](https://ultrametric.ai/processes/handle-a-co-founder-departure) (n2 `vestedAsOf`, n4 `departureSummary`)

**Honesty boundaries.** The 83(b) interface is STATED, not computed here: restricted-share
counts only — the election window belongs to the deadlines module (rule
`us-fed.83b-filing-period`), and all ISO/NSO/AMT/83(b) tax math belongs to the tax
modules. Milestone/performance vesting is deliberately out: the computable part is a
board-certified boolean the plan documents own (see `docs/OPEN-MODULES-GAPS.md`).

**Extend it.** A published schedule shape with a citable worked example (and only then).

### 83(b) election math

`lib/openstartup/election83b.ts` — pure, client-safe; the MONEY only (`deadlines.ts` owns
the 30-day clock).

**What it computes.** Tax-at-grant vs tax-at-vesting from explicit FMV-trajectory and rate
inputs, and what a forfeiture after an election really costs.

**Contract.** `compare83bScenario` / `scenarioTax83b` (the zero-spread founder case flagged
— $0 income now) · `forfeitureAfterElection` (no deduction; loss capped at paid −
realized; the inclusion never recovered — the cited risk statement rides on every result)
· `earlyExercise83b` (consumes the equity lane's early-exercise flag; locks NSO income /
ISO AMT inclusion at the exercise spread).

**Worked examples replayed.** All six of Rev. Proc. 2012-29's published examples,
number-for-number (rule `us-fed.83b-scenario-arithmetic`). Tests:
`lib/openstartup/__tests__/election83b.test.ts`.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n8a `compare83bScenario`) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n4b `compare83bScenario`) · [Convert an LLC to a C-Corp](https://ultrametric.ai/processes/convert-an-llc-to-a-c-corp) (n8a `compare83bScenario`)

**Honesty boundaries.** Rates and FMV trajectories are INPUTS — the module never predicts
value or picks a rate, and it never files anything; the 30-day deadline lives in the
deadlines module so there is exactly one clock.

**Extend it.** State-tax layers need dated rule cards first.

### QSBS (§ 1202)

`lib/openstartup/qsbs.ts` — pure, client-safe.

**What it computes.** The § 1202 scaffolding a founder can check: eligibility conditions,
the holding clock, the exclusion percentage by acquisition date, and the per-issuer cap.

**Contract.** `qsbsEligibilityChecklist(facts)` (C corp, original issuance, the
gross-assets test routed by issuance date, active business ALWAYS needs_review, excluded
fields — each a cited condition, rule `us-fed.qsbs-eligibility`) ·
`qsbsHoldingClock` (the 5-year — or post-applicable-date 3/4/5-year — clock with the
83(b)/vesting start per rule `us-fed.restricted-property-holding-period`) ·
`qsbsExclusionPercentage(acquisition, disposition)` (50/75/100 incl. the tiered post-2025
regime, boundaries pinned) · `qsbsPerIssuerCap` (greater of the dollar cap or 10× basis) ·
`qsbsExclusionIllustration` · `SECTION_1045_ROLLOVER` (explained, cited, never computed).

**Worked examples replayed.** The standard $2M-basis → $20M-cap example re-derived from
§ 1202(b)(1); boundary dates pinned in
`lib/openstartup/__tests__/qsbs.test.ts`.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n7 `qsbsEligibilityChecklist`, n7b `qsbsHoldingClock`) · [Convert an LLC to a C-Corp](https://ultrametric.ai/processes/convert-an-llc-to-a-c-corp) (n7 `qsbsEligibilityChecklist`, n7b `qsbsHoldingClock`)

**Honesty boundaries.** "Active business" is ALWAYS needs_review — no pure function can
certify it; § 1045 rollovers are explained, never computed; nothing here is tax advice.

**Extend it.** New statutory tiers get a dated rule-card update before a code change.

### Deadline calendar

`lib/openstartup/deadlines.ts` — pure, client-safe; UTC ISO-date arithmetic only.

**What it computes.** Rule-card-backed due dates and the recurring compliance clock.

**Contract.** `deFranchiseTaxDue(taxYear)` (March 1 — rule
`us-de.franchise-tax-annual-report`) · `form1120Due(taxYearEnd)` (15th day of the 4th
month, June-30 exception — rule `us-fed.1120-filing-deadline`) · `form941Due(year,
quarter)` (last day of the month after the quarter — rule `us-fed.941-quarterly-deadline`)
· `election83bWindow(transferDate)` (day 30 — rule `us-fed.83b-filing-period`, ALWAYS
`needsReview`) · `complianceCalendar(from, to, …)`.

**Worked examples replayed.** Every deadline references a dated rule card by id — no
hardcoded day count without a primary-sourced card — and the gate
(`lib/openstartup/__tests__/deadlines.test.ts`) fails if a referenced card is missing or
jurisdiction-mismatched.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n8 `election83bWindow`) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n5 `election83bWindow`) · [Convert an LLC to a C-Corp](https://ultrametric.ai/processes/convert-an-llc-to-a-c-corp) (n8 `election83bWindow`) · [File DE franchise tax](https://ultrametric.ai/processes/file-de-franchise-tax) (n3 `deFranchiseTaxDue`) · [File federal tax return](https://ultrametric.ai/processes/file-federal-tax-return) (n6 `form1120Due`) · [Cure a Delaware franchise tax delinquency](https://ultrametric.ai/processes/cure-a-delaware-franchise-tax-delinquency) (n5 `deFranchiseTaxDue`)

**Honesty boundaries.** `needsReview: true` marks dates that can move (weekend landings,
statutory exceptions, event-date questions); legal holidays are declared out of scope, and
the module never extends or legally determines a deadline.

**Extend it.** A new deadline = a new dated rule card first, then the function that cites
it.

### Convertible notes

`lib/openstartup/convertibleNote.ts` — pure, client-safe.

**What it computes.** Note interest, conversion pricing, maturity paths, and series
pricing when notes/SAFEs are outstanding.

**Contract.** `accruedSimpleInterest` / `noteBalance` (simple interest only, actual-day
count over an explicit basis; compounding, 30/360, and default interest are the note's own
text, flagged) · `noteConversionPrice` / `convertNote` (cap and discount "in the
alternative" at the lowest price — Cooley GO's convertible-debt primer; the cap
denominator must be supplied from the note's own capitalization definition — never
invented here) · `capImpliedDiscountPct` · `maturityStatus` (the three published maturity
paths — repay, extend, convert — surfaced, never decided) ·
`seriesPricingWithNotes(input)` (the pre-money / percentage-ownership / dollars-invested
methods) · `NOTE_VS_SAFE` (structural differences, each line cited) · `daysBetween`.

**Worked examples replayed.** Cooley GO "Understanding the Valuation Cap" ($3M cap on
$10M = 70% implied discount) and Cooley GO "Calculating Share Price With Outstanding
Convertible Notes or Safes" (its worked example, number-for-number across all three
methods). Tests: `lib/openstartup/__tests__/convertibleNote.test.ts`.

**Serves:** [Raise pre-seed (SAFEs)](https://ultrametric.ai/processes/raise-pre-seed-safes) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n2 `seriesPricingWithNotes`)

**Honesty boundaries.** The capitalization definition is contract-specific and always
supplied, never assumed; maturity is surfaced as the three published paths, never chosen.
Note MFN clauses are bespoke contract text — assessed and skipped in
`docs/OPEN-MODULES-GAPS.md`.

**Extend it.** A fourth published pricing method with a worked example would slot into
`seriesPricingWithNotes`.

### Liquidity-event waterfall

`lib/openstartup/waterfall.ts` — pure, client-safe.

**What it computes.** Per-holder proceeds at a sale price: the SAFE cash-out-vs-convert
choice, one preferred series at 1x or a stated multiple, non-participating vs
participating, and exact-cents allocation so proceeds sum to the price.

**Contract.** `liquidityWaterfall(inputs, price) → WaterfallReport` ·
`safeLiquidityShares(safes, outstandingShares)` (the §C.1 simultaneous solve) ·
`conversionIndifferencePrice(preferred, otherShares)` ·
`allocateCents(totalDollars, weights)` (largest remainder — proceeds sum exactly).

**Worked examples replayed.** YC Post-Money Safe User Guide §A.3/§C.1 with Appendix II
Example 1 Q3/Q4 number-for-number ($0.8901/$0.2670 per-share decision figures, the
$500,026/$149,991 comparisons); participation definitions per the Cooley GO "Preferred
Stock" glossary; pari passu per §A.5–A.6. Property-tested: proceeds sum to the price
exactly, no payout negative, non-participating holders take the greater of preference and
as-converted value. Tests: `lib/openstartup/__tests__/waterfall.test.ts`.

**Serves:** [Raise pre-seed (SAFEs)](https://ultrametric.ai/processes/raise-pre-seed-safes) (n6 `conversionIndifferencePrice`) · [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round)

**Honesty boundaries.** Deliberately out of scope (no citable worked example at this bar):
capped participation, stacked seniority, accruing dividends, debt, escrows — the price
must be net of debt, and every report carries `needsReview: true`. Uncapped SAFEs need an
FMV input the module refuses to invent.

**Extend it.** Capped participation or stacked seniority ship only with a citable worked
example each.

### Anti-dilution

`lib/openstartup/antiDilution.ts` — pure, client-safe.

**What it computes.** Conversion-price adjustments for dilutive issuances, on every
published basis.

**Contract.** `weightedAverageConversionPrice(cp1, baseShares, issuance)` (the NVCA model
COD formula CP2 = CP1 × (A + B) ÷ (A + C), also printed by Cooley GO's down-round
explainer) · `broadBase(breakdown)` (common + preferred as-converted + options
as-exercised; narrow base = the subject series' own as-converted common — the denominator
difference stated) · `fullRatchetConversionPrice` · `applyAntiDilution(series, issuance,
basis, base?)` · `conversionRatio` / `asConvertedShares` · `payToPlayConsequence`
(flag/explanation per Fenwick and the Holloway VC guide — never a computed payout) ·
`toWaterfallSeries` (the stated waterfall interface).

**Worked examples replayed.** The Springmeyer down round, number-for-number for all three
bases: $2.00 → $1.7059 broad / $1.4444 narrow / $1.00 ratchet. Ordering invariants
property-tested (ratchet ≤ narrow ≤ broad ≤ CP1) in
`lib/openstartup/__tests__/antiDilution.test.ts`.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n1 `weightedAverageConversionPrice`)

**Honesty boundaries.** Only dilutive issuances adjust; exempt-issuance carve-outs are
charter text the caller resolves first; pay-to-play consequences are explained, never
computed into dollars.

**Extend it.** A charter variant (e.g. pool-inclusive base) only with the charter language
pattern and a published example.

### Priced-round mechanics

`lib/openstartup/round.ts` — pure, client-safe; reuses the cap-table module's types and
pool algebra and composes the anti-dilution module (no parallel cap-table representation).

**What it computes.** The negotiation-side arithmetic around a round: pro rata, bottom-up
pool sizing, down-round modeling, and secondaries.

**Contract.** `proRataShares(roundShares, ownershipPct)` / `maintainOwnership(input)`
(the algebra showing "maintain my %" IS "buy my pro rata of the issuance") ·
`poolTargetFromHiringPlan(hires, bufferPct)` with `hiringPlanPoolIncrease` /
`hiringPlanPoolTopUp` (per-role sizes stay in Rewarding Talent's published grant grids,
supplied as inputs) · `downRoundModel(rows, protectedSeries, issuance)` (composes
per-series anti-dilution adjustments over snapshot rows, including who absorbs the
dilution) · `founderSecondary(rows, seller, buyer, shares, pps?)` (a secondary transfers
outstanding shares, issues nothing, dilutes no one — proceeds go to the seller, never the
company; Cooley GO glossary).

**Worked examples replayed.** YC User Guide §E / Appendix II pro rata (4,486,719 × 10% =
448,671); the Springmeyer down round end-to-end. Tests:
`lib/openstartup/__tests__/round.test.ts`.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n1 `maintainOwnership`) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n2 `proRataShares`)

**Honesty boundaries.** Benchmarks (per-role grant sizes) are the book's, supplied as
inputs; transfer restrictions, ROFRs, and the 409A implications of a secondary price are
deal and valuation questions — `needsReview`.

**Extend it.** More round mechanics belong here only when they aren't already a
composition — end-to-end narration belongs to the composer.

### Priced-round composer

`lib/openstartup/roundComposer.ts` — pure, client-safe.

**What it computes.** The round END TO END, as one narrative composition over capTable +
round + antiDilution + waterfall, read back as the closing process's own stages — no
parallel arithmetic (composition-equality tested).

**Contract.** `termSheetEconomics(input)` (post-money, the % the new money buys per YC
Quick Start §2, the §3 dilution estimate via `capTable.estimateRoundDilution`) ·
`replayPricedRound(history, round) → PricedRoundReplay` (the history + round folded
through `capTable.buildCapTable`, narrated: the closing wires to verify — new cash +
exercised pro rata; SAFE conversions wire nothing — and the post-close table with the new
series' at-close conversion terms, ratio 1.0 via `antiDilution.conversionRatio`) ·
`postCloseLiquidityCheck(replay, salePrice)` (the signed table through
`waterfall.liquidityWaterfall`: all round preferred as one pari passu 1x series whose
preference basis is the dollars actually paid, plus the conversion-indifference price) ·
`downRoundPreview(replay, issuance, basis)` (the anti-dilution clause quantified:
`round.downRoundModel` with the new series protected at its at-close conversion price).

**Worked examples replayed.** The YC Appendix II Example 1 pro-forma END TO END — the
same numbers `capTable.test.ts` re-derives function by function — in
`lib/openstartup/__tests__/roundComposer.test.ts`, plus composition-equality assertions
proving the composer invents nothing.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n1 `termSheetEconomics`, n7 `replayPricedRound`, n9 `replayPricedRound`) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n4 `replayPricedRound`)

**Honesty boundaries.** Per-sub-series preference choices are charter text (the liquidity
check collapses the round preferred to the waterfall module's one-series contract,
stated); counsel's closing mechanics, consents, and filings control. Every report
`needsReview: true`.

**Extend it.** New stages only as compositions over cited modules — if a stage needs new
arithmetic, that arithmetic belongs in (and gets cited by) the underlying module first.

### 409A grant sanity

`lib/openstartup/grant409aSanity.ts` — a sanity model, NOT a valuation: it takes the 409A
FMV as input and never invents one (`producesValuation: false` by construction — a
credible valuation needs appraisal judgment a pure function cannot honestly package).

**What it computes.** Grant-time sanity checks, the § 409A presumption routes as
structured cited data, refresh triggers, and the penalty arithmetic as a labeled
illustration.

**Contract.** `strikeFloorCheck(strike, fmv)` (rule `us-fed.409a-stock-right-exception`) ·
`fmvAgeCheck(fmvAsOf, grantOn)` (rule `us-fed.staleness`: the 12-month window plus
term-sheet and material-change flags — the term-sheet convention cited to YC User Guide
§B.6) · `appraisalPresumptionCheck` (rule `us-fed.independent-appraisal-presumption`,
timing only) · `preferredCommonRatioIllustration` (leaning on rule
`us-fed.reasonable-method`'s caveat that a preferred price is not common FMV) ·
`grantSanityReport` · `PRESUMPTION_METHODS` + `checkMethodEligibility` (the three § 409A
valuation presumptions with their actual regulatory conditions — rules
`us-fed.binding-formula-presumption`, `us-fed.illiquid-startup-presumption`) ·
`refreshTriggerChecklist` · `penaltyIllustration409a` (rule
`us-fed.409a-penalty-additions`, IRC § 409A(a)(1)(B): the 20% additional tax plus a
labeled simple-interest illustration) · `addUtcMonths`.

**Worked examples replayed.** Every check cites a committed rule card by id — the gate
(`lib/openstartup/__tests__/grant409aSanity.test.ts`) fails if a card is missing or
jurisdiction-mismatched.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n9 `refreshTriggerChecklist`) · [Get a 409A valuation](https://ultrametric.ai/processes/get-a-409a-valuation) · [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) (n1 `fmvAgeCheck`, n4 `strikeFloorCheck`)

**Honesty boundaries.** OPM, backsolve, and every other appraisal method are deliberately
OUT — `producesValuation` stays false everywhere; qualification under a presumption is
counsel's question; every finding is `needsReview: true`.

**Extend it.** New triggers or presumption conditions arrive as rule cards first.

### Offer / equity-comp scenarios

`lib/openstartup/equityComp.ts` — pure, client-safe.

**What it computes.** What an offer's equity line means under explicit scenarios.

**Contract.** `grantOwnershipPct(shares, fullyDiluted)` (the Rewarding Talent sizing
convention) · `commonSharePriceAtExit(exit, fdAtExit)` (a common-stock proxy that ignores
liquidation preferences and says so) · `optionSpread(shares, strike, price)` ·
`grantExitOutcome` / `offerScenarioTable(grant, scenarios)` (strike, future-dilution, and
exit-value scenarios; every outcome carries `needsReview: true`) · `vestedExitOutcome`
(reuses the cap-table module's Cooley GO vesting).

**Worked examples replayed.** Cited to the Holloway Guide to Equity Compensation and
Index Ventures' Rewarding Talent (resource ids `holloway-equity-guide`,
`index-rewarding-talent`); the strike-price floor references rule
`us-fed.409a-stock-right-exception`. Tests:
`lib/openstartup/__tests__/equityComp.test.ts`.

**Serves:** [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) · [Hire first employee](https://ultrametric.ai/processes/hire-first-employee) (n1 `grantOwnershipPct`) · [Hire an executive](https://ultrametric.ai/processes/hire-an-executive) (n5 `offerScenarioTable`)

**Honesty boundaries.** The module takes the 409A FMV as input — it never invents one.
Everything is pre-tax by design (ISO/NSO, AMT, QSBS, and 83(b) interactions are out of
scope and flagged as such — they live in the tax modules).

**Extend it.** Benchmark grant grids stay in the books — only input-taking scenario shapes
belong here.

### ISO / NSO exercise tax

`lib/openstartup/optionTax.ts` — pure, client-safe.

**What it computes.** The federal tax mechanics of option exercises and dispositions, from
explicit inputs.

**Contract.** `nsoExerciseIncome` (spread-at-exercise ordinary income per Pub 525, rule
`us-fed.nso-spread-ordinary-income`) · `supplementalWithholdingIllustration` (the
published 22%/37% supplemental rates, asOf-dated — rule
`us-fed.supplemental-wage-withholding-2026`) · `isoExerciseOutcome` (§ 421(a) no regular
income + the § 56(b)(3) AMT inclusion with dual basis; the early-exercise flag defers the
inclusion under § 83 timing) · `iso100kAttribution(grants)` (§ 422(d): grant-date FMV,
order-granted, NSO spillover and bifurcation) · `isoDisposition` (2y/1y holding periods,
§ 421(b) disqualifying income, the § 422(c)(2) loss cap, flagged anniversary boundaries) ·
`amtExposureIllustration` (a clearly-labeled ILLUSTRATION;
`producesFilingComputation: false` by construction).

**Worked examples replayed.** Treas. Reg. § 1.422-4(d) Examples 1–3 number-for-number;
Rev. Proc. 2024-40's complete-phaseout amounts, every published figure. Tests:
`lib/openstartup/__tests__/optionTax.test.ts`.

**Serves:** [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) (n4 `iso100kAttribution`) · [Offboard employee](https://ultrametric.ai/processes/offboard-employee)

**Honesty boundaries.** Vesting-year attribution and FMVs are inputs — never derived; the
AMT illustration is labeled and never a filing computation; state withholding needs dated
state rule cards before it ships (assessed in `docs/OPEN-MODULES-GAPS.md`).

**Extend it.** FICA-on-NSO-spread completeness is the next honest slice, cited to Pub 15.

### Employer payroll tax

`lib/openstartup/payrollTax.ts` — pure, client-safe; FEDERAL ONLY with the state-tax
boundary stated on every result.

**What it computes.** The employer-side federal payroll load.

**Contract.** `employerFicaAnnual(wages, params)` (6.2% on the asOf-dated wage base, 1.45%
Medicare, the 0.9% Additional Medicare computed but labeled employee-only withholding —
rule `us-fed.fica-rates-2026`) · `futaAnnual` (6.0% on the first $7,000 with the bounded
state credit — rule `us-fed.futa-2025`) · `employerPayrollCostAnnual` (per-employee annual
arithmetic + federal-only load factor).

**Worked examples replayed.** The published maxima are pinned in the tests from the cited
figures. Tests: `lib/openstartup/__tests__/payrollTax.test.ts`.

**Serves:** [Set up payroll](https://ultrametric.ai/processes/set-up-payroll) · [Hire first employee](https://ultrametric.ai/processes/hire-first-employee) (n1 `employerPayrollCostAnnual`) · [Run payroll](https://ultrametric.ai/processes/run-payroll) (n3 `employerFicaAnnual`)

**Honesty boundaries.** State payroll taxes (SUI/ETT/SDI and friends) are a stated
boundary — they need dated state rule cards first; benefits load factors likewise.

**Extend it.** `rules/US-CA/` cards for EDD rates, then the state layer — the module's
long-planned next slice.

### Delaware franchise tax

`lib/openstartup/deFranchiseTax.ts` — pure, client-safe.

**What it computes.** Both published franchise-tax methods, exactly, and the comparison
that defuses the scary March number.

**Contract.** `authorizedSharesMethodTax(authorizedShares)` ·
`assumedParValueCapitalTax(inputs)` (explicit rounding: 6-decimal half-up assumed par,
round-up-to-next-million) · `compareFranchiseTaxMethods(inputs)` (which method is cheaper)
· `largeCorporateFilerTax()` (fixed amount surfaced, qualification unverified) · the
$5,000 quarterly-installment flag.

**Worked examples replayed.** 8 Del. C. § 503 and the Division of Corporations' own
calculation page: 10,005 shares → $335; 100,000 → $1,015; the $2.061856 assumed-par
example → $1,600 — number-for-number. Rules
`us-de.franchise-tax-authorized-shares-method` /
`us-de.franchise-tax-assumed-par-method`; tests:
`lib/openstartup/__tests__/deFranchiseTax.test.ts`.

**Serves:** [File DE franchise tax](https://ultrametric.ai/processes/file-de-franchise-tax) (n1 `compareFranchiseTaxMethods`) · [Cure a Delaware franchise tax delinquency](https://ultrametric.ai/processes/cure-a-delaware-franchise-tax-delinquency) (n2 `assumedParValueCapitalTax`)

**Honesty boundaries.** No-par stock refused as out of scope; Large Corporate Filer
qualification is not verified here.

**Extend it.** Rate changes land as rule-card updates with the Division's new worked
examples.

### R&D tax mechanics

`lib/openstartup/rdCredit.ts` — honest scope: cited explanation + straight-line
arithmetic, never a credit computation.

**What it computes.** § 174 amortization patterns, the § 41(h) payroll-offset gate and
caps, and the Form 8974 quarterly application.

**Contract.** `midpointAmortizationSchedule(amount, years)` /
`domesticSre5YearSchedule` / `foreignSre15YearSchedule` (the statutory midpoint convention
— the 10/20/20/20/20/10 domestic pattern, cents-exact) · `domesticSre2025Treatment`
(§ 174A current deduction or the ≥60-month election; law-in-flux recorded on the card,
never editorialized) · `qsbPayrollOffsetEligibility` (§ 41(h)(3) conditions, always
needs_review overall) · `payrollOffsetElectionCap` · `quarterlyOffsetApplication`
(Form 8974: SS-first-then-Medicare, per-quarter cap, carryforward, conservation-tested).

**Worked examples replayed.** The statutory midpoint pattern; Form 8974's ordering rules.
Rules `us-fed.research-expenditure-amortization` / `us-fed.rd-payroll-offset`; tests:
`lib/openstartup/__tests__/rdCredit.test.ts`.

**Serves:** [Claim the R&D tax credit](https://ultrametric.ai/processes/claim-the-r-d-tax-credit) (n1 `qsbPayrollOffsetEligibility`, n6 `payrollOffsetElectionCap`, n6 `quarterlyOffsetApplication`)

**Honesty boundaries.** The credit itself (QRE qualification, § 41 computation) belongs to
the study provider and the CPA — this module never computes it.

**Extend it.** Only arithmetic the statute or form instructions print.

### Runway & burn

`lib/openstartup/runway.ts` — pure, client-safe.

**What it computes.** Cash trajectories on Paul Graham's default-alive model.

**Contract.** `simpleRunwayMonths(cash, netBurn)` (the naive baseline) ·
`defaultAliveReport(inputs)` (constant expenses by default, compounding revenue,
month-by-month trajectory with profitability/zero-cash months and the cash trough) ·
`growthAdjustedRunwayMonths` · `hiringImpact(inputs, hires)` (the plan replayed with each
hire layered in — the alive→dead flip the essay warns about).

**Worked examples replayed.** The model is cited to https://paulgraham.com/aord.html
(which publishes no numeric example); the arithmetic is hand-derived in
`lib/openstartup/__tests__/runway.test.ts` and property-tested (cash identity,
status/event consistency, determinism). Assumptions explicit in the module header: month 0
is now, net burn = expenses − revenue, hire costs flat from their start month.

**Serves:** [Track runway](https://ultrametric.ai/processes/track-runway) (n3 `simpleRunwayMonths`, n3 `defaultAliveReport`) · [Send the board financial report](https://ultrametric.ai/processes/send-the-board-financial-report) (n4 `defaultAliveReport`) · [Set the annual budget & get board approval](https://ultrametric.ai/processes/set-the-annual-budget-get-board-approval) (n2 `hiringImpact`)

**Honesty boundaries.** Educational model, not financial advice; growth rates are inputs,
never predictions. Efficiency RATIOS live next door in unit economics.

**Extend it.** Scenario shapes (e.g. step-function expenses) only with stated assumptions.

### Unit economics

`lib/openstartup/unitEconomics.ts` — pure, client-safe; the efficiency ratios over
explicit inputs (the runway module owns the cash trajectories).

**What it computes.** LTV/CAC and payback, MRR movement, burn multiple, Rule of 40, magic
number — pure arithmetic over the caller's own numbers.

**Contract.** `customerLifetimePeriods(churnPct)` · `ltvSimple(arpa, churnPct)` /
`ltv({arpa, grossMarginPct, churnRatePct})` · `cac(smSpend, newCustomers)` ·
`ltvToCacRatio` · `cacPaybackMonths({cac, monthlyArpa, grossMarginPct})` ·
`netNewMrr({new, expansion, churned})` · `netMrrChurnRatePct` · `annualizedNetChurnPct` ·
`burnMultiple({netBurn, netNewArr})` (not computable when net new ARR ≤ 0 — the source's
own caveat, honored) · `ruleOf40({revenueGrowthPct, profitMarginPct})` ·
`magicNumber({currentQuarterRevenue, priorQuarterRevenue, priorQuarterSalesMarketingSpend})`
· `compareToBenchmark(value, benchmark)` (refuses an unsourced band).

**Worked examples replayed.** David Skok's SaaS Metrics 2.0 detailed definitions
(lifetime figures and the "2%/month ≈ 22%/year" arithmetic); David Sacks, "The Burn
Multiple" (2020-04-23: $2M/$1M = 2x, $5M/$1M = 5x); Brad Feld's Rule of 40 (2015-02-03:
20+20, 40+0, 50−10); Rory O'Driscoll, "Magic Number Math" (2010-04-20: the formula and
bands; its example arithmetic hand-derived, stated). All URLs verified 2026-10-02. Tests:
`lib/openstartup/__tests__/unitEconomics.test.ts`.

**Serves:** [Track runway](https://ultrametric.ai/processes/track-runway) · [Send the board financial report](https://ultrametric.ai/processes/send-the-board-financial-report) (n4 `burnMultiple`) · [Prepare a board meeting](https://ultrametric.ai/processes/prepare-a-board-meeting) (n4 `burnMultiple`, n4 `ruleOf40`) · [Save a churning customer](https://ultrametric.ai/processes/save-a-churning-customer) (n3 `ltv`) · [Roll out a pricing change](https://ultrametric.ai/processes/roll-out-a-pricing-change) (n7 `netMrrChurnRatePct`)

**Honesty boundaries.** Benchmarks are INPUTS, never encoded — no benchmark tables ship in
code; every comparison is `needsReview` because a band published for one stage, motion, or
year does not transfer automatically. ARPA, churn, margins, burn, and spend are explicit
inputs — nothing is derived from books this module cannot see. Educational, not financial
advice.

**Extend it.** A new ratio needs a canonical published formulation at a stable URL.

### Deferred revenue (subscriptions)

`lib/openstartup/deferredRevenue.ts` — pure, client-safe; UTC ISO-date arithmetic,
cents-exact via the waterfall module's largest-remainder allocation (no parallel rounding
scheme).

**What it computes.** Straight-line, whole-day recognition of TIME-BASED subscription
invoice lines, and mid-period plan-change proration.

**Contract.** `serviceDays(start, end)` (inclusive whole days) ·
`recognitionSchedule(line)` (one line split across calendar months; months sum to the line
exactly) · `recognitionReport(lines)` (billed vs recognized vs deferred by month; negative
deferred = unbilled receivable, stated) · `prorationOnPlanChange(input)` (unused-time
credit + remaining-time charge by whole days, returned as ready-to-fold revenue lines).

**Worked examples replayed.** Stripe Docs' Revenue Recognition subscription examples
(docs.stripe.com/revenue-recognition/examples/subscriptions, verified 2026-10-02),
number-for-number: the $31 monthly 17/14 split; the $365 annual year with deferred
334 → 306 → 275; the $90→$120 upgrade (−30/+40, April recognizing $100) and $90→$30
downgrade (−30/+10, April $70). Conservation property-tested (total recognized = total
billed, to the cent). Tests: `lib/openstartup/__tests__/deferredRevenue.test.ts`.

**Serves:** [Bookkeeping close](https://ultrametric.ai/processes/bookkeeping-close) (n5 `recognitionReport`) · [Set up subscription billing](https://ultrametric.ai/processes/set-up-subscription-billing) · [Roll out a pricing change](https://ultrametric.ai/processes/roll-out-a-pricing-change) (n4 `prorationOnPlanChange`)

**Honesty boundaries.** Nothing judgment-shaped: performance obligations, SSP allocation,
usage pricing, refunds/credit notes, FX, and collectibility are the accountant's ASC 606 /
IFRS 15 calls — out of scope and flagged; the close's accountant-review step owns the
books. Educational, not accounting advice.

**Extend it.** Other amortization granularities (by-second, by-month) only with the
published convention cited.

## How the modules connect to the processes

`processes/business-logic-map.json` is the wiring: task-level (which modules honestly
serve which corpus processes — the "Open modules" line on live process pages) and
step-level (which exported FUNCTION computes which DAG step's math — the per-step
`compute:` chips). The map is curated from both sides and totality-tested both ways in
`lib/__tests__/businessLogicMap.test.ts` + `businessLogicServes.test.ts`: files, process
ids, node ids, exported functions, anchors, and the Serves lines can never point at
nothing. Three walk-throughs show what the function-level wiring means:

**A priced round, end to end (fund_002).** Negotiating the term sheet (n1) is
`roundComposer.termSheetEconomics` — post-money, the % the new money buys, the dilution
estimate over the outstanding SAFEs — alongside `round.maintainOwnership` (the pro rata
algebra investors negotiate with) and `antiDilution.weightedAverageConversionPrice` (the
clause going onto the table). Verifying the wires and issuing the shares (n7) is
`capTable.buildCapTable` narrated by `roundComposer.replayPricedRound`: on the YC
Appendix II Example 1 inputs that stage prints PPS $1.1144, the 588,235/1,176,470 SAFE
conversions, 4,486,719 new shares, and the exact wires (the new investors' cash plus
Investor B's 448,671-share pro rata — the SAFEs wire nothing). Updating the cap table
(n9) must reproduce the replay's post-close stage — 17,946,424 fully diluted, founders at
51.54%, the pool at 10% — and the closed financing trips
`grant409aSanity.refreshTriggerChecklist`. The same replay is the pro-forma reviewed with
the lead investor in fund_006 (n4).

**Founder stock at formation (form_001).** The founder issuance step (n7) is
`capTable.buildCapTable` (rows summing to 100%) and `qsbs.qsbsEligibilityChecklist` (the
cited § 1202 conditions at original issuance), with `qsbs.qsbsHoldingClock` starting the
five-year clock at n7b. The 83(b) decision (n8a) is `election83b.compare83bScenario` —
tax-at-grant vs tax-at-vesting, the zero-spread founder case flagged — and the filing
window (n8) is `deadlines.election83bWindow`, day 30 on rule `us-fed.83b-filing-period`,
always `needsReview`.

**The finance spine (qs_050 → fin_003 → scale_005 → fin_002).** Tracking runway (qs_050
n3) is `runway.simpleRunwayMonths` and `runway.defaultAliveReport`; the board financial
report's burn step (fin_003 n4) adds `unitEconomics.burnMultiple` (net burn ÷ net new ARR,
not computable when net new ARR ≤ 0); the board-meeting KPI step (scale_005 n4) computes
`unitEconomics.burnMultiple` and `unitEconomics.ruleOf40`; and the bookkeeping close's P&L
step (fin_002 n5) gets its subscription revenue split from
`deferredRevenue.recognitionReport` — with the accountant-review step still owning the
books.

## What you can contribute here

- **A new open module** — pure TypeScript under `lib/openstartup/` plus an index-table row
  and a templated section in this README (What it computes / Contract / Worked examples
  replayed / Serves / Honesty boundaries / Extend it). The bar is fixed: pure functions, a
  citation on every formula's doc comment, explicit rounding, worked examples reproduced
  number-for-number from the cited source, and property tests. The assessed candidate
  backlog — with build/skip/defer verdicts and the citable sources that exist (or honestly
  don't) — lives in [`docs/OPEN-MODULES-GAPS.md`](../docs/OPEN-MODULES-GAPS.md). Gate:
  `npx vitest run lib/openstartup/__tests__/` (and `pnpm test`).
- **Harden an existing module** — a missed edge case from a cited worked example, a new
  property test, or a correction with the source that proves it (e.g. the YC Post-Money
  Safe User Guide for `capTable.ts`).
- **Honesty rules** — a module that leans on a legal threshold must reference a dated rule
  card in `rules/` and return `needs_review` when locale or date is unknown; results are
  decision support, never authorization. The conservative workflow planner lives in
  `lib/founderOps.ts` and is gated by `__tests__/founder-ops.test.ts`.
