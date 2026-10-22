# Open modules

The startup calculations are here as code (cap tables, rounds, waterfalls, runway, tax
mechanics): every module is pure, deterministic, and validated against published worked
examples.

Part of [the open startup repo](../README.md#open-modules), separate from law (`open-law/`)
and the vendor evidence layer (`open-rankings/`). The modules live in
`lib/openstartup/` and are indexed in the table below
(`pnpm test lib/openstartup/__tests__/` runs their gates). Repo-first by design: use
them from tests, scripts, or your own agent.

The bar is fixed for every module: a contract, explicit assumptions, a citation on every
formula's doc comment (a published guide, form, or primary source — never "everyone
knows"), explicit rounding, worked examples reproduced number-for-number from the cited
sources, deterministic tests, and explicit jurisdiction dependencies. An open module may
PROPOSE a result; it must never silently authorize a tax election, equity grant, bank
transfer, contract, or vendor disclosure. A module that leans on a legal threshold must
reference a dated law rule in `open-law/` and return `needs_review` when the applicable
locale or date is unknown. Status, module by module: worked-example-verified and
property-tested — **not** independently expert-certified, and the module docs say so.

## Module index

The catalog is organized into groups, committed per module in
`open-processes/business-logic-map.json` (`group`). The Serves column names the processes
each module computes for, written from the same map by
`scripts/generate-business-logic-serves.ts` and drift-gated like the per-module Serves
lines; edit the map, rerun the script.

### Formation & equity

| Module | What it computes | Serves | Worked-example source | Status |
| --- | --- | --- | --- | --- |
| [Cap table](#cap-table) | Issuance, pools, SAFE conversion, priced-round PPS, dilution waterfall | Incorporate C-Corp · Sign the founder agreement & split equity · Set up cap table · Update cap table · Audit cap table · Raise pre-seed (SAFEs) · Close a priced equity round · Issue stock options · Convert SAFEs at the priced round · Handle a co-founder departure | YC Post-Money Safe User Guide (Appendix II) | verified + property-tested |
| [Vesting mechanics](#vesting-mechanics) | Cliff/periodic/back-loaded schedules, acceleration, departures | Incorporate C-Corp · Sign the founder agreement & split equity · Issue stock options · Hire first employee · Hire an executive · Handle a co-founder departure | Cooley GO; Amazon 5/15/40/40; FAST grid | verified + property-tested |
| [83(b) election math](#83b-election-math) | Tax-at-grant vs tax-at-vesting, forfeiture cost | Incorporate C-Corp · Sign the founder agreement & split equity · Convert an LLC to a C-Corp | Rev. Proc. 2012-29 (all six examples) | verified |
| [QSBS (§ 1202)](#qsbs--1202) | Eligibility checklist, holding clock, exclusion %, per-issuer cap | Incorporate C-Corp · Convert an LLC to a C-Corp | IRC § 1202 (re-derived caps) | verified, checklist-shaped |
| [Offer / equity-comp scenarios](#offer--equity-comp-scenarios) | Grant %, spread, exit scenarios | Issue stock options · Hire first employee · Hire an executive | Holloway equity guide; Rewarding Talent | verified, pre-tax by design |
| [ISO / NSO exercise tax](#iso--nso-exercise-tax) | NSO income, ISO/AMT outcomes, § 422(d) $100k, dispositions | Issue stock options · Offboard employee | Pub 525; Treas. Reg. § 1.422-4(d) Ex. 1–3; Rev. Proc. 2024-40/2025-32 | verified; AMT is illustration-only |
| [409A grant sanity](#409a-grant-sanity) | Strike floor, staleness, presumptions, refresh triggers, penalty illustration | Close a priced equity round · Get a 409A valuation · Issue stock options | Treas. Reg. § 1.409A law rules | sanity model — never a valuation |

### Fundraising & exits

| Module | What it computes | Serves | Worked-example source | Status |
| --- | --- | --- | --- | --- |
| [Convertible notes](#convertible-notes) | Interest, cap/discount conversion, maturity paths, pricing with notes | Raise pre-seed (SAFEs) · Convert SAFEs at the priced round | Cooley GO convertible-debt primers | verified |
| [Priced-round mechanics](#priced-round-mechanics) | Pro rata, pool-from-hiring-plan, down-round model, secondaries | Close a priced equity round · Convert SAFEs at the priced round | YC User Guide §E; Rewarding Talent; Springmeyer; Cooley GO | verified |
| [Priced-round composer](#priced-round-composer) | The round end-to-end: term sheet → wires/issuance → post-close | Close a priced equity round · Convert SAFEs at the priced round | YC Appendix II Ex. 1, replayed end-to-end | verified by composition-equality |
| [Anti-dilution](#anti-dilution) | NVCA weighted-average / full-ratchet conversion-price adjustments | Close a priced equity round | NVCA model COD; Springmeyer worked example | verified + property-tested |
| [Liquidity-event waterfall](#liquidity-event-waterfall) | Per-holder proceeds at a sale price | Raise pre-seed (SAFEs) · Close a priced equity round | YC User Guide Appendix II Ex. 1 Q3/Q4; Cooley GO glossary | verified + property-tested |

### Tax & compliance

| Module | What it computes | Serves | Worked-example source | Status |
| --- | --- | --- | --- | --- |
| [Deadline calendar](#deadline-calendar) | Law-rule-backed due dates and recurring clocks | Incorporate C-Corp · Sign the founder agreement & split equity · Convert an LLC to a C-Corp · File DE franchise tax · File federal tax return · Cure a Delaware franchise tax delinquency | Dated law rules in `open-law/` | verified, always `needsReview` where dates can move |
| [Employer payroll tax](#employer-payroll-tax) | FICA/FUTA employer load, per-employee cost | Set up payroll · Hire first employee · Run payroll | IRS Pub 15 / instructions (pinned maxima) | verified, FEDERAL ONLY |
| [Delaware franchise tax](#delaware-franchise-tax) | Both published methods, exactly; the March comparison | File DE franchise tax · Cure a Delaware franchise tax delinquency | 8 Del. C. § 503 + Division worked examples | verified |
| [R&D tax mechanics](#rd-tax-mechanics) | § 174 amortization patterns, § 41(h) offset caps, Form 8974 application | Claim the R&D tax credit | IRC § 174/41; Form 8974 instructions | explanation + arithmetic — never a credit computation |

### Finance & runway

| Module | What it computes | Serves | Worked-example source | Status |
| --- | --- | --- | --- | --- |
| [Runway & burn](#runway--burn) | Default-alive trajectories, hiring impact | Track runway · Send the board financial report · Set the annual budget & get board approval | paulgraham.com/aord.html (model) | verified, hand-derived arithmetic |
| [Unit economics](#unit-economics) | LTV/CAC, MRR movement, burn multiple, Rule of 40, magic number | Track runway · Send the board financial report · Prepare a board meeting · Save a churning customer · Roll out a pricing change | Skok; Sacks; Feld; O'Driscoll (all verified 2026-10-14) | verified; benchmarks are inputs |
| [Deferred revenue (subscriptions)](#deferred-revenue-subscriptions) | Straight-line day-count recognition, plan-change proration | Bookkeeping close · Set up subscription billing · Roll out a pricing change | Stripe revenue-recognition subscription examples | verified; ASC 606 judgment excluded |

## Modules

Each module entry follows one template: the module file and what it computes in a
sentence, a function table (inputs and returns in plain words), one **Worked example**
traced from the golden-test fixtures with the arithmetic shown, the machine-owned
**Serves** line, the module's **Honesty boundaries**, and its **Sources**. The Serves
line names the corpus processes wired to the module in
`open-processes/business-logic-map.json`, with `nodeId function` pairs wherever a specific
function genuinely computes a specific step's math (those steps also wear a
`compute: <module>.<function>` chip on the live process page). It is generated by
`scripts/generate-business-logic-serves.ts` and drift-gated by
`lib/__tests__/businessLogicServes.test.ts` — edit the map, rerun the script; never
hand-edit the lines.

### Cap table

`lib/openstartup/capTable.ts` — computes the cap table as a fold over events (founding,
pools, grants, SAFEs, priced rounds), with post-money SAFE conversion and priced-round
pricing per the YC Post-Money Safe User Guide; `capTableCodec.ts` carries the same event
list in a shareable `?ct=` permalink token.

| Function | Inputs | Returns |
| --- | --- | --- |
| `buildCapTable` | the event list | one ownership snapshot per event, the priced-round breakdown, and any error with earlier snapshots preserved |
| `vestedShares` | total shares, cliff and total months, months elapsed | whole shares vested |
| `safeOwnershipPct` / `safeProRataAllocationPct` / `maxSafesPctWithProRata` / `estimateRoundDilution` | SAFE amounts, caps, and round percentages | the Quick Start dilution arithmetic, in percent |
| `poolIncreaseForTarget` / `poolIncreaseForRoundTarget` | fully diluted, unissued pool, target percent (plus pre and post money inside a round) | smallest whole-share pool increase meeting the target |
| `reportToCsv` / `reportToMarkdown` | a cap-table report | CSV of the final snapshot; markdown of every snapshot |
| `encodeCapTableState` / `decodeCapTableState` (`capTableCodec.ts`) | the event list; a `?ct=` token | an unpadded base64url token; the events, or null on any malformation |

**Worked example.** YC User Guide Appendix II Example 1, pinned in
`lib/openstartup/__tests__/capTable.test.ts`. ABC, Inc. holds 10,000,000 fully diluted
shares (9,250,000 founders, 650,000 options outstanding and promised, 100,000 unissued
pool) plus a $200,000 SAFE at a $4M post-money cap (5%) and an $800,000 SAFE at an $8M
cap (10%, pro rata). Series A raises $5,000,000 at $15,000,000 pre with a 1,695,000-share
pool increase. Company Capitalization = 10,000,000 ÷ (1 − 0.15) = 11,764,705; the SAFEs
convert into 5% × 11,764,705 = 588,235 and 10% × 11,764,705 = 1,176,470 shares.
PPS = 15,000,000 ÷ (11,764,705 + 1,695,000) = $1.1144; new shares =
floor(5,000,000 ÷ 1.1144) = 4,486,719; Investor B's pro rata = 4,486,719 × 10% = 448,671.
Final fully diluted: 17,946,424, with founders at 51.54% and the pool at 10.00%.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n7 `buildCapTable`) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n4 `buildCapTable`) · [Set up cap table](https://ultrametric.ai/processes/set-up-cap-table) (n2 `buildCapTable`, n3 `safeOwnershipPct`) · [Update cap table](https://ultrametric.ai/processes/update-cap-table) (n2 `buildCapTable`) · [Audit cap table](https://ultrametric.ai/processes/audit-cap-table) (n2 `buildCapTable`) · [Raise pre-seed (SAFEs)](https://ultrametric.ai/processes/raise-pre-seed-safes) (n6 `safeOwnershipPct`, n8 `buildCapTable`) · [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n7 `buildCapTable`) · [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n2 `buildCapTable`) · [Handle a co-founder departure](https://ultrametric.ai/processes/handle-a-co-founder-departure) (n7 `buildCapTable`)

**Honesty boundaries.** The module records what documents say and decides no terms.
Shares floor and prices round to 4 decimals (the guide's convention), so sub-cent prices
lose precision; SAFEs selling 100% or more are refused, and so are uncapped/discount SAFE
claims that reach the pre-money (no conversion price exists there). Educational model, no
legal advice.

**Sources.** YC Post-Money Safe User Guide, Feb 2023 (PDF linked from
https://www.ycombinator.com/documents) — Quick Start, Q&A §B–§E, Appendices I–II · Cooley
GO, "Founder's Stock, Vesting and Founder Departures"
(https://www.cooleygo.com/founder-basics-founders-stock/).

### Vesting mechanics

`lib/openstartup/vesting.ts` — computes vesting dates and share counts for time-based
grants: cliff plus periodic schedules, back-loaded tranches, departures, acceleration,
portfolios of grants, and FAST advisor grants.

| Function | Inputs | Returns |
| --- | --- | --- |
| `vestingEvents` | grant (shares, commencement date, schedule) | every vesting date with shares vested and cumulative totals |
| `vestedAsOf` | grant, measurement date, optional termination date | vested and unvested counts, next vesting date |
| `cliffVesting` | grant | the first vesting event and whether it is a cliff |
| `departureSummary` | grant, termination date | vested/unvested split and the repurchasable share count |
| `applyAcceleration` | grant, trigger policy, sale and termination dates | shares accelerated and unvested remainder |
| `portfolioVestedAsOf` | list of grants, measurement date | per-grant and total vested/unvested counts |
| `fastAdvisorGrant` | stage, level, fully diluted shares, start date | an advisor grant sized from the FAST grid |
| `addMonthsClamped` | ISO date, months | the monthly anniversary, clamped to short months |

**Worked example.** The Cooley GO founder convention, replayed in
`lib/openstartup/__tests__/vesting.test.ts`: 4,800,000 shares commencing 2026-01-15 on
the standard 48-month schedule with a 12-month cliff. Through 2027-01-14 nothing is
vested. On the cliff date 2027-01-15, floor(4,800,000 × 12/48) = 1,200,000 shares vest,
exactly 25%. One month later, cumulative vesting is floor(4,800,000 × 13/48) = 1,300,000,
an increment of 100,000. At month 24 (2028-01-15) the cumulative total is 2,400,000, and
the final event on 2030-01-15 reaches 4,800,000 exactly. A founder departing 2027-07-15
keeps 1,800,000 vested shares (18/48) and 3,000,000 remain subject to the company's
repurchase right.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n1 `vestingEvents`) · [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) (n4 `vestingEvents`) · [Hire first employee](https://ultrametric.ai/processes/hire-first-employee) (n10 `vestingEvents`) · [Hire an executive](https://ultrametric.ai/processes/hire-an-executive) (n5 `applyAcceleration`) · [Handle a co-founder departure](https://ultrametric.ai/processes/handle-a-co-founder-departure) (n2 `vestedAsOf`, n4 `departureSummary`)

**Honesty boundaries.** Anniversary clamping and cumulative-floor rounding are stated
conventions; the plan documents control, so every position carries `needsReview`.
Repurchase price and windows, "without cause" determinations, and milestone or
performance vesting are contract questions the module names but does not decide. Tax math
and the 30-day 83(b) window belong to the tax and deadlines modules.

**Sources.** Cooley GO, "Founder's Stock, Vesting and Founder Departures"
(https://www.cooleygo.com/founder-basics-founders-stock/) · Cooley GO, "Pulling the
Trigger(s)"
(https://www.cooleygo.com/what-are-single-and-double-trigger-acceleration-and-how-do-they-work/)
· Founder Institute FAST Agreement, Version 3 (https://fi.co/fast) · Bruce Brumberg,
Forbes, 2022-02-08
(https://www.forbes.com/sites/brucebrumberg/2022/02/08/amazon-apple-google-restricted-stock-grants-evolve-to-retain-top-talent/)
· Index Ventures, Rewarding Talent (https://www.indexventures.com/rewarding-talent/) ·
law rule `us-fed.83b-filing-period`.

### 83(b) election math

`lib/openstartup/election83b.ts` — computes the dollar consequences of filing or skipping
a § 83(b) election from explicit share, price, FMV, and rate inputs.

| Function | Inputs | Returns |
| --- | --- | --- |
| `compare83bScenario` | shares, price paid, FMV at transfer, vesting-event FMVs | income, basis, and holding-period start with and without the election |
| `scenarioTax83b` | the same facts plus a sale price and hypothetical rates | total tax on each path and the election savings |
| `forfeitureAfterElection` | shares, price paid, FMV at transfer, repurchase price | gain or capped loss and the unrecovered inclusion |
| `earlyExercise83b` | early-exercise flag, shares, strike, FMV at exercise | the NSO income or ISO AMT inclusion the election locks in |

**Worked example.** Rev. Proc. 2012-29's own fact pattern (§ 5, Examples 1 and 2),
replayed in `lib/openstartup/__tests__/election83b.test.ts`: 25,000 substantially
nonvested shares, $1.00 paid per share equal to the $1.00 transfer FMV. With the
election, income at transfer is 25,000 × ($1.00 − $1.00) = $0 and basis is $25,000.
Without it, vesting at $1.60 produces 25,000 × ($1.60 − $1.00) = $15,000 of compensation
and a $40,000 basis. Selling at $2.40 ($60,000 total) yields a $35,000 capital gain with
the election versus $20,000 without. At the test's hypothetical 37% ordinary and 20%
capital-gains rates: with = 0.20 × 35,000 = $7,000; without = 0.37 × 15,000 +
0.20 × 20,000 = $9,550; savings $2,550.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n8a `compare83bScenario`) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n4b `compare83bScenario`) · [Convert an LLC to a C-Corp](https://ultrametric.ai/processes/convert-an-llc-to-a-c-corp) (n8a `compare83bScenario`)

**Honesty boundaries.** Rates and FMV trajectories are inputs; the module predicts no
value, applies no current rate table, and authorizes no filing (the election is
irrevocable without IRS consent). The 30-day window lives in the deadlines module. Every
result carries the cited forfeiture risk: elect, forfeit, and the inclusion is never
recovered.

**Sources.** Rev. Proc. 2012-29 (https://www.irs.gov/pub/irs-drop/rp-12-29.pdf) · law
rules `us-fed.83b-scenario-arithmetic`, `us-fed.83b-election-effect`,
`us-fed.83b-filing-period`, `us-fed.83b-revocation`,
`us-fed.restricted-property-holding-period`.

### QSBS (§ 1202)

`lib/openstartup/qsbs.ts` — computes the § 1202 mechanics: eligibility conditions, the
holding clock, the exclusion percentage, and the per-issuer cap.

| Function | Inputs | Returns |
| --- | --- | --- |
| `qsbsEligibilityChecklist` | issuance date and known facts | cited conditions, an overall not-met or needs_review, and the applicable gross-asset ceiling |
| `qsbsHoldingClock` | acquisition date, vesting and 83(b) facts | the clock start and the 5-year or 3/4/5-year milestone dates |
| `qsbsExclusionPercentage` | acquisition and disposition dates | 0, 50, 75, or 100 with regime and boundary flags |
| `qsbsPerIssuerCap` | acquisition date, basis disposed, prior-year gain, filing status | the greater-of cap with both limbs labeled |
| `qsbsExclusionIllustration` | gain, dates, basis | eligible, excluded, and taxable gain |
| `SECTION_1045_ROLLOVER` | none | the cited rollover summary, `computed: false` |

**Worked example.** The § 1202(b)(1) cap arithmetic re-derived in
`lib/openstartup/__tests__/qsbs.test.ts`: a $30,000,000 gain on stock acquired
2019-06-01, sold 2026-01-15, with $2,000,000 of basis disposed. The cap is the greater of
$10,000,000 and 10 × $2,000,000 = $20,000,000, so $20,000,000 governs. The stock sits in
the 100% regime (acquired after 2010-09-27, on or before the 2025-07-04 applicable date)
and was held more than 5 years, so the percentage is 100. Eligible gain:
min($30,000,000, $20,000,000) = $20,000,000. Excluded: $20,000,000. Taxable: $10,000,000.
Stock acquired after the applicable date instead earns 50/75/100 at 3/4/5 years against a
$15,000,000 base, also pinned in the tests.

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n7 `qsbsEligibilityChecklist`, n7b `qsbsHoldingClock`) · [Convert an LLC to a C-Corp](https://ultrametric.ai/processes/convert-an-llc-to-a-c-corp) (n7 `qsbsEligibilityChecklist`, n7b `qsbsHoldingClock`)

**Honesty boundaries.** The active-business test always returns needs_review, so the
checklist is never a QSBS opinion. The post-2026 inflation adjustments and the
$15,000,000 limb's same-year interaction with pre-applicable-date dispositions are
flagged, not computed. The § 1045 rollover is explained and cited, never calculated.

**Sources.** 26 U.S.C. § 1202 (https://www.law.cornell.edu/uscode/text/26/1202) · 26
U.S.C. § 1045 · IRS Publication 525 (restricted property holding period) · law rules
`us-fed.qsbs-eligibility`, `us-fed.qsbs-exclusion-percentage`,
`us-fed.qsbs-per-issuer-cap`, `us-fed.qsbs-1045-rollover`,
`us-fed.restricted-property-holding-period`.

### Deadline calendar

`lib/openstartup/deadlines.ts` — computes nominal compliance due dates from dated law
rules in `open-law/` and lays them out as a recurring calendar.

| Function | Inputs | Returns |
| --- | --- | --- |
| `deFranchiseTaxDue` | tax year | March 1 of the following year, with the rule id and review flag |
| `form1120Due` | tax-year end date | 15th day of the 4th month (3rd for June 30 year ends through 2026-06-30, per the Pub. L. 114-41 sunset), with weekend and exception flags |
| `form941Due` | year, quarter | last day of the month after the quarter |
| `election83bWindow` | transfer date | nominal day 30, always flagged for review |
| `complianceCalendar` | date range, payroll option | sorted entries due inside the range |

**Worked example.** From `lib/openstartup/__tests__/deadlines.test.ts`, where the
arithmetic is re-derived against the law rules (the rules cite the IRS instructions and
8 Del. C. §§ 502(a)/504(a)). An 83(b) election for a 2026-01-15 transfer: rule
`us-fed.83b-filing-period` counts the transfer date plus 30 calendar days, so 16
remaining January days plus 14 February days lands on 2026-02-14. That date is a
Saturday, so the result carries `needsReview: true` and a note pointing at the
instructions' next-business-day postmark rule. The 2026 calendar for a payroll-running
Delaware C corporation sorts six entries: Form 941 for 2025 Q4 (2026-01-31), franchise
tax for 2025 (2026-03-01), Form 1120 for 2025 (2026-04-15), then the 941s for Q1 through
Q3 (2026-04-30, 2026-07-31, 2026-10-31).

**Serves:** [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) (n8 `election83bWindow`) · [Sign the founder agreement & split equity](https://ultrametric.ai/processes/sign-the-founder-agreement-split-equity) (n5 `election83bWindow`) · [Convert an LLC to a C-Corp](https://ultrametric.ai/processes/convert-an-llc-to-a-c-corp) (n8 `election83bWindow`) · [File DE franchise tax](https://ultrametric.ai/processes/file-de-franchise-tax) (n3 `deFranchiseTaxDue`) · [File federal tax return](https://ultrametric.ai/processes/file-federal-tax-return) (n6 `form1120Due`) · [Cure a Delaware franchise tax delinquency](https://ultrametric.ai/processes/cure-a-delaware-franchise-tax-delinquency) (n5 `deFranchiseTaxDue`)

**Honesty boundaries.** Legal holidays are out of scope: weekend landings flag, holiday
landings do not. The module computes nominal dates and does not extend or legally
determine a deadline; the 83(b) transfer date is a legal determination, so that window is
always flagged.

**Sources.** Law rules `us-de.franchise-tax-annual-report`,
`us-fed.1120-filing-deadline`, `us-fed.941-quarterly-deadline`,
`us-fed.83b-filing-period` · IRS Instructions for Form 1120, "When To File"
(https://www.irs.gov/instructions/i1120) · Pub. L. 114-41 § 2006(a)(3) (the June 30
sunset; https://www.congress.gov/114/plaws/publ41/PLAW-114publ41.htm).

### Convertible notes

`lib/openstartup/convertibleNote.ts` — computes note interest, conversion pricing,
maturity status, and series pricing when notes convert.

| Function | Inputs | Returns |
| --- | --- | --- |
| `accruedSimpleInterest` / `noteBalance` | principal, rate, dates, day basis | simple interest and total |
| `noteConversionPrice` | round price, discount, cap with the note's share count | the lowest price and which term set it |
| `convertNote` | note, event date, terms | shares, amount converted, interest repaid |
| `capImpliedDiscountPct` | cap, pre-money valuation | the discount the cap implies |
| `maturityStatus` | note, as-of date | matured flag, balance due, the three published paths |
| `seriesPricingWithNotes` | pre-money, new money, note balance, discount, share count | the three methods' prices and ownership |
| `daysBetween` | two dates | whole days |

**Worked example.** Cooley GO's "Calculating Share Price With Outstanding Convertible
Notes or Safes" (Derek Colla), replayed in
`lib/openstartup/__tests__/convertibleNote.test.ts`: $8,000,000 pre-money, $2,000,000 new
money, $1,000,000 of notes at a 30% discount, 1,000,000 fully diluted shares.
Percentage-ownership method: gross up the note balance to $1,000,000 / 0.70 =
$1,428,571.43; price per share = ($8,000,000 − $1,428,571.43) / 1,000,000 = $6.5714;
conversion price = $6.5714 × 0.70 = $4.60; note shares = floor($1,000,000 / $4.60) =
217,391. Ownership lands on the article's 65.71% existing / 14.29% notes / 20% new money,
the method's defining property (new investors hold exactly $2m of a $10m post-money). The
pre-money method ($8.00 / $5.60, 70% / 12.5% / 17.5%) and the dollars-invested method
($7.5714 / $5.30, 68.83% / 12.99% / 18.18%) replay the same way.

**Serves:** [Raise pre-seed (SAFEs)](https://ultrametric.ai/processes/raise-pre-seed-safes) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n2 `seriesPricingWithNotes`)

**Honesty boundaries.** Simple interest on an actual-day count only; compounding, 30/360
conventions, and default interest belong to the note's text. The cap denominator is
contract-specific, so a cap conversion requires the share count the note's own
"capitalization" definition produces. Maturity outcomes are surfaced as the three
published paths and left to the parties.

**Sources.** Cooley GO, "Primer on Convertible Debt" (Peter Werner) —
https://www.cooleygo.com/convertible-debt/ · Cooley GO, "Understanding the Valuation Cap"
— https://www.cooleygo.com/troublesome-convertible-note-cap/ · Cooley GO, "Calculating
Share Price With Outstanding Convertible Notes or Safes" (Derek Colla) —
https://www.cooleygo.com/calculating-share-price-outstanding-convertible-notes-or-safes/
· YC Post-Money Safe User Guide (note-vs-SAFE lines) — PDF linked from
https://www.ycombinator.com/documents.

### Liquidity-event waterfall

`lib/openstartup/waterfall.ts` — computes per-holder proceeds at a sale price, including
each SAFE's cash-out-or-convert decision and one preferred series' preference-or-convert
choice.

| Function | Inputs | Returns |
| --- | --- | --- |
| `liquidityWaterfall` | holders, preferred, safes, pool, sale price | per-holder proceeds report |
| `safeLiquidityShares` | safes, outstanding shares | each safe's conversion shares and Liquidity Price |
| `conversionIndifferencePrice` | series, other shares | the sale price where preference and conversion pay the same |
| `allocateCents` | total dollars, weights | proportional whole-cent split that sums exactly |

**Worked example.** YC Post-Money Safe User Guide, Appendix II Example 1 Q3 (Feb 2023
edition), replayed in `lib/openstartup/__tests__/waterfall.test.ts`. Outstanding equity:
9,250,000 founder shares plus 300,000 outstanding options = 9,550,000 (the 450,000-share
unissued pool is excluded per §C.1). Safe ownerships: $200,000 / $4,000,000 = 5% and
$800,000 / $8,000,000 = 10%, so the Liquidity Capitalization is 9,550,000 / 85% and the
Conversion Amounts are 561,764 and 1,123,529 shares. At a $10,000,000 acquisition the
per-share consideration is $10,000,000 / 11,235,293 = $0.8901; the guide's comparison
figures, 561,764 × $0.8901 = $500,026 and 1,123,529 × $0.8901 = $1,000,053, both exceed
the Purchase Amounts, so both safes convert. The report's rows then allocate the actual
$10,000,000 in exact cents (the display-rounded price would over-distribute by about
$534). At $3,000,000 the figures are $0.2670, $149,991, and $299,982; both safes cash out
and the remaining $2,000,000 goes pro rata to the 9,550,000 outstanding shares.

**Serves:** [Raise pre-seed (SAFEs)](https://ultrametric.ai/processes/raise-pre-seed-safes) (n6 `liquidityWaterfall`) · [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round)

**Honesty boundaries.** The sale price must be net of debt; creditors and convertible
notes rank senior and are not modeled. Capped participation, stacked seniority, accruing
dividends, escrows, and option strike netting are out of scope, and uncapped safes are
rejected because their treatment needs an FMV input. In a mixed outcome, Conversion
Amounts stay fixed from the all-safes-included solve (the guide's Appendix II Q4
convention); a strict §C.1 recomputation excluding cashed-out safes is not performed.

**Sources.** YC Post-Money Safe User Guide §A.3, §A.5–A.6, §C.1, Appendix II Example 1 —
PDF linked from https://www.ycombinator.com/documents · Cooley GO glossary, "Preferred
Stock" — https://www.cooleygo.com/glossary/preferred-stock/ · Brad Feld, "Term Sheet:
Liquidation Preference" — https://feld.com/archives/2005/01/term-sheet-liquidation-preference/.

### Anti-dilution

`lib/openstartup/antiDilution.ts` — computes conversion-price adjustments for dilutive
issuances on the broad-based, narrow-based, and full-ratchet bases, with the conversion
mechanics that turn an adjusted price into shares.

| Function | Inputs | Returns |
| --- | --- | --- |
| `weightedAverageConversionPrice` | the prior conversion price, the base share count, the issuance | CP2 = CP1 × (A + B) ÷ (A + C); unchanged for at-or-above-price issuances |
| `fullRatchetConversionPrice` | the prior conversion price, the issuance | the new round's price per share when dilutive |
| `broadBase` | common, preferred as-converted, options as-exercised | the broad base ("A") |
| `applyAntiDilution` | a series, an issuance, a basis, the broad base when needed | before/after conversion prices, ratios, as-converted counts, the extra common issued |
| `conversionRatio` / `asConvertedShares` | original issue price, conversion price, preferred shares | OIP ÷ CP; floor(preferred × OIP ÷ CP) |
| `payToPlayConsequence` | participated flag, mechanism | an explanation of the contractual consequence, never a payout |
| `toWaterfallSeries` | a series and its adjustment | the post-adjustment series shaped for the waterfall module |

**Worked example.** The Springmeyer narrow-based adjustment, pinned in
`lib/openstartup/__tests__/antiDilution.test.ts`. Series A: 4,000,000 preferred at
OIP = CP = $2.00 ($8M invested); the down round sells 5,000,000 shares for $5,000,000.
Narrow base = the series' own as-converted 4,000,000; B = 5,000,000 ÷ 2.00 = 2,500,000;
CP2 = 2.00 × (4,000,000 + 2,500,000) ÷ (4,000,000 + 5,000,000) = 2.00 × 6.5 ÷ 9 =
$1.4444. As-converted = floor(8,000,000 ÷ 1.4444) = 5,538,631 shares, the article's
"5.54 million". The same tests pin broad-based $1.7059 → 4,689,606 and full ratchet
$1.00 → 8,000,000, and property-test the ordering ratchet ≤ narrow ≤ broad ≤ CP1.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n1 `weightedAverageConversionPrice`)

**Honesty boundaries.** Price-based adjustments only: exempt-issuance carve-outs are the
charter's list, applied by the caller first, and pay-to-play consequences are explained
rather than computed into dollars. Adjusted prices round to 4 decimals (a barely-dilutive
issuance can round back to CP1); the charter's own price precision controls, so every
result is `needsReview`.

**Sources.** NVCA Model Certificate of Incorporation
(https://nvca.org/model-legal-documents/; the COD is a document download, and the same
formula is printed by Cooley GO) · Cooley GO, "What You Need to Know About Down Round
Financings" (https://www.cooleygo.com/down-round-financings/) · Bryan Springmeyer,
"Anti-Dilution Provisions in Venture Capital Transactions"
(https://www.calstartuplawfirm.com/business-lawyer-blog/anti-dilution-provisions.php) ·
Fenwick & West, "What is a 'Pay-to-Play' Financing?"
(https://www.fenwick.com/insights/publications/what-is-a-pay-to-play-financing) ·
Holloway Guide to Raising Venture Capital, "Pay-to-Play Provisions"
(https://www.holloway.com/g/venture-capital/sections/pay-to-play-provisions).

### Priced-round mechanics

`lib/openstartup/round.ts` — computes the negotiation arithmetic around a priced round:
pro rata purchases, bottom-up option-pool sizing from a hiring plan, down-round modeling,
and secondary sales.

| Function | Inputs | Returns |
| --- | --- | --- |
| `proRataShares` / `maintainOwnership` | round shares, holder's stake, fully diluted, price | the pro rata purchase; shares and dollars needed to hold a percentage, with the exercised and declined outcomes |
| `poolTargetFromHiringPlan` / `hiringPlanPoolIncrease` / `hiringPlanPoolTopUp` | planned per-hire grant percentages (from a published grid) and a buffer | the pool target, and the share increase inside or outside a round via the cap-table pool algebra |
| `downRoundModel` | snapshot rows, protected-series specs, the dilutive issuance | adjusted conversion prices, per-holder before/after shares and percentages, who absorbs the dilution |
| `founderSecondary` | rows, seller, buyer, shares, optional price | the post-transfer table, seller proceeds, unchanged fully diluted |

**Worked example.** The Springmeyer down round, pinned in
`lib/openstartup/__tests__/round.test.ts`. Before: 8,000,000 founder and pool shares plus
4,000,000 Series A preferred at OIP = CP = $2.00. The dilutive round sells 5,000,000
shares for $5,000,000 ($1.00). Broad base = 8,000,000 + 4,000,000 = 12,000,000;
CP2 = 2.00 × (12,000,000 + 5,000,000 ÷ 2.00) ÷ (12,000,000 + 5,000,000) =
2.00 × 14,500,000 ÷ 17,000,000 = $1.7059. Series A then converts into
floor(8,000,000 ÷ 1.7059) = 4,689,606 shares, 689,606 more than before. Fully diluted
after = 8,000,000 + 4,689,606 + 5,000,000 = 17,689,606: founders fall from 66.67% to
45.22%, protected Series A holds 26.51%, and the new investor takes 28.27%.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n1 `maintainOwnership`) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n2 `proRataShares`)

**Honesty boundaries.** Per-role grant benchmarks stay in the published grids and arrive
as inputs. The computed broad base counts each row at its row share count (the 1:1-before
case; pass as-converted rows for pre-adjusted series). Transfer restrictions, ROFRs,
exempt-issuance carve-outs, and the 409A implications of a secondary price are deal and
valuation questions; every report carries `needsReview`.

**Sources.** YC Post-Money Safe User Guide §E and Appendix II
(https://www.ycombinator.com/documents) · Index Ventures, Rewarding Talent
(https://www.indexventures.com/rewarding-talent/) · Bryan Springmeyer, "Anti-Dilution
Provisions in Venture Capital Transactions"
(https://www.calstartuplawfirm.com/business-lawyer-blog/anti-dilution-provisions.php) ·
Cooley GO glossary, "Secondary Sale" (https://www.cooleygo.com/glossary/secondary-sale/).

### Priced-round composer

`lib/openstartup/roundComposer.ts` — replays a priced equity round end to end by
sequencing the cap-table, round-mechanics, anti-dilution, and waterfall modules into the
closing process's stages.

| Function | Inputs | Returns |
| --- | --- | --- |
| `termSheetEconomics` | pre-money, new money, optional SAFE percentages and pool increase | post-money, the percentage the new money buys, the Quick Start §3 dilution estimate |
| `replayPricedRound` | the company's event history plus the round terms | the term-sheet stage, the closing stage (conversions and the wires to verify), the post-close table with at-close conversion terms, and every engine snapshot |
| `postCloseLiquidityCheck` | a replay and a sale price | the liquidity waterfall over the signed table, the preference basis, the conversion-indifference price |
| `downRoundPreview` | a replay, a future dilutive issuance, a basis | the anti-dilution clause quantified on the post-close table via `downRoundModel` |

**Worked example.** The YC Appendix II Example 1 pro-forma through the composer, pinned
in `lib/openstartup/__tests__/roundComposer.test.ts`. Term sheet: $5,000,000 at
$15,000,000 pre makes $20,000,000 post, selling 5 ÷ 20 = 25%. Closing: PPS $1.1144; the
SAFEs convert at their caps into 588,235 and 1,176,470 shares and wire nothing; the wires
to verify are 4,038,048 new-investor shares × $1.1144 = $4,500,000.69 plus Investor B's
pro rata 448,671 × $1.1144 = $499,998.96, totalling $4,999,999.65 (a hair under
$5,000,000 because share counts floor; the guide prints $499,998.97). Post-close: fully
diluted 17,946,424; new preferred = 4,486,719 + 588,235 + 1,176,470 = 6,251,424;
conversion price at close $1.1144 at ratio 1.0. Composition-equality assertions prove the
replay equals the cap-table engine's own fold.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n1 `termSheetEconomics`, n7 `replayPricedRound`, n9 `replayPricedRound`) · [Convert SAFEs at the priced round](https://ultrametric.ai/processes/convert-safes-at-the-priced-round) (n4 `replayPricedRound`)

**Honesty boundaries.** The liquidity check collapses all round preferred into one pari
passu 1x non-participating series; per-sub-series preference choices are charter text.
SAFE sub-series are protected in a down-round preview only via `extraProtected` at their
own effective prices. Counsel's closing mechanics, consents, and filings control; every
stage reports `needsReview`.

**Sources.** YC Post-Money Safe User Guide, Quick Start §2–§3, §B/§C/§E, Appendix II
Example 1 (https://www.ycombinator.com/documents) · NVCA model Certificate of
Incorporation via the anti-dilution module (https://nvca.org/model-legal-documents/) ·
Cooley GO definitions via the round and waterfall modules (https://www.cooleygo.com/).

### 409A grant sanity

`lib/openstartup/grant409aSanity.ts` — runs grant-timing and strike-floor checks against
dated 409A law rules, taking the 409A fair market value as an input it cannot produce.

| Function | Inputs | Returns |
| --- | --- | --- |
| `strikeFloorCheck` | strike and FMV per share | pass or fail against the stock-right exception |
| `fmvAgeCheck` | FMV date, grant date, event flags | pass/flag/fail plus the stale-after date |
| `appraisalPresumptionCheck` | appraisal date, grant date | 12-month window pass or fail |
| `preferredCommonRatioIllustration` | preferred price, common FMV | labeled ratio, no valuation |
| `grantSanityReport` | one grant's inputs | all findings plus the worst level |
| `PRESUMPTION_METHODS` / `checkMethodEligibility` | explicit presumption-route inputs | per-method findings; judgments flag |
| `refreshTriggerChecklist` | FMV date, grant date, events | refresh recommendation |
| `penaltyIllustration409a` | hypothetical includible amount, underpayment rows | the 20% line plus a simple-interest line |

**Worked example.** The penalty illustration from
`lib/openstartup/__tests__/grant409aSanity.test.ts`, replaying the percentages of IRC
§ 409A(a)(1)(B) via rule `us-fed.409a-penalty-additions` (the statute's own figures,
hand-derived in the test; no published appraisal example exists for a module that
declines to value companies). A hypothetical $100,000 required inclusion: the
additional-tax line is 20% × $100,000 = $20,000. A stated hypothetical underpayment of
$50,000 at a 7% underpayment rate outstanding 2 years: the premium-interest line is
$50,000 × (7 + 1)% × 2 = $8,000, labeled a simple-interest illustration because the
Code's actual interest computation runs year by year. Both outputs carry
`producesValuation: false` and `needsReview: true`.

**Serves:** [Close a priced equity round](https://ultrametric.ai/processes/close-a-priced-equity-round) (n9 `refreshTriggerChecklist`) · [Get a 409A valuation](https://ultrametric.ai/processes/get-a-409a-valuation) · [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) (n1 `fmvAgeCheck`, n4 `strikeFloorCheck`)

**Honesty boundaries.** OPM, backsolve, and every other appraisal method are out of
scope; the module cannot produce an FMV. Qualification under a presumption (appraiser,
written-report substance, materiality) is counsel's question, so judgment inputs flag
rather than pass.

**Sources.** Treas. Reg. § 1.409A-1(b)(5) via law rules
`us-fed.409a-stock-right-exception`, `us-fed.reasonable-method`, `us-fed.staleness`,
`us-fed.independent-appraisal-presumption`, `us-fed.illiquid-startup-presumption`,
`us-fed.binding-formula-presumption` · IRC § 409A(a)(1)(B) via
`us-fed.409a-penalty-additions` · YC Post-Money Safe User Guide §B.6 (term-sheet
convention) — PDF linked from https://www.ycombinator.com/documents.

### Offer / equity-comp scenarios

`lib/openstartup/equityComp.ts` — computes what an offer's option grant is worth under
explicit exit and dilution scenarios, pre-tax.

| Function | Inputs | Returns |
| --- | --- | --- |
| `grantOwnershipPct` | option shares, fully diluted shares | the grant as a percentage of fully diluted |
| `commonSharePriceAtExit` | exit valuation, fully diluted at exit | a common-share price proxy |
| `optionSpread` | shares, strike, share price | intrinsic value, floored at zero |
| `grantExitOutcome` / `offerScenarioTable` | grant, exit scenarios | share price, ownership, gross, exercise cost, net pre-tax per scenario |
| `vestedExitOutcome` | grant, scenario, months elapsed | the vested slice of the outcome |

**Worked example.** The hand-derived offer in
`lib/openstartup/__tests__/equityComp.test.ts`: 50,000 options at a $0.40 strike on a
10,000,000-share fully diluted table, 0.50% of the company. At a $100,000,000 exit with
20% further dilution, fully diluted at exit is 10,000,000 / 0.8 = 12,500,000 shares, the
price proxy is 100,000,000 / 12,500,000 = $8.00, and ownership falls to 0.40%. Gross
value is 50,000 × $8.00 = $400,000, exercise cost 50,000 × $0.40 = $20,000, net $380,000
pre-tax. At month 24 of the standard 48/12 schedule, 25,000 vested options are worth
25,000 × ($8.00 − $0.40) = $190,000. A $3,000,000 exit prices the share at $0.30, under
the strike, so the net is $0.

**Serves:** [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) · [Hire first employee](https://ultrametric.ai/processes/hire-first-employee) (n1 `grantOwnershipPct`) · [Hire an executive](https://ultrametric.ai/processes/hire-an-executive) (n5 `offerScenarioTable`)

**Honesty boundaries.** The share price at exit is a common-stock proxy that ignores
liquidation preferences, participation, and carve-outs, so below the preference stack it
overstates value; every outcome carries `needsReview`. Everything is pre-tax, and the
409A FMV and strike are inputs the module never invents.

**Sources.** The Holloway Guide to Equity Compensation
(https://www.holloway.com/g/equity-compensation) · Index Ventures, Rewarding Talent
(https://www.indexventures.com/rewarding-talent/) · law rule
`us-fed.409a-stock-right-exception` (Treas. Reg. § 1.409A-1(b)(5)).

### ISO / NSO exercise tax

`lib/openstartup/optionTax.ts` — computes the federal tax mechanics of option exercises
and dispositions from explicit inputs: NSO ordinary income and withholding, the ISO AMT
inclusion, the $100,000 limit, holding periods, and an AMT exposure illustration.

| Function | Inputs | Returns |
| --- | --- | --- |
| `nsoExerciseIncome` | shares, strike, FMV at exercise | ordinary income, exercise cost, basis |
| `supplementalWithholdingIllustration` | payment, year-to-date supplemental wages | withholding at the published 22%/37% rates |
| `isoExerciseOutcome` | shares, strike, FMV, vested-at-exercise flag | zero regular income, the AMT adjustment, dual basis |
| `iso100kAttribution` | grants with per-year first-exercisable counts | ISO/NSO split per grant per year |
| `isoDisposition` | grant, exercise, and sale dates, strike, FMV, amount realized | qualifying or disqualifying result with ordinary and capital pieces |
| `amtExposureIllustration` | hypothetical AMTI, ISO spread, filing status | tentative minimum tax, labeled an illustration |

**Worked example.** Treas. Reg. § 1.422-4(d) Example 3, replayed in
`lib/openstartup/__tests__/optionTax.test.ts`: three 2004 grants at a $10 grant-date FMV,
all first exercisable in 2004 after an acceleration. Option 1 (April 1, 6,000 shares,
$60,000) fits inside the $100,000 budget, leaving $40,000. Option 2 (May 1, 5,000 shares,
$50,000) bifurcates: 4,000 ISO shares ($40,000) and 1,000 nonstatutory shares ($10,000).
Option 3 (June 1, 4,000 shares, $40,000) is entirely nonstatutory, and the year's
remaining budget is $0. The AMT phaseout arithmetic is checked against both revenue
procedures: each published complete-phaseout amount equals threshold + exemption ÷ rate
(2025, Rev. Proc. 2024-40 § 2.11 at 25 cents — single: 626,350 + 88,100 ÷ 0.25 = 978,750;
2026, Rev. Proc. 2025-32 § 2.10 at 50 cents — single: 500,000 + 90,100 ÷ 0.50 = 680,200).

**Serves:** [Issue stock options](https://ultrametric.ai/processes/issue-stock-options) (n4 `iso100kAttribution`) · [Offboard employee](https://ultrametric.ai/processes/offboard-employee)

**Honesty boundaries.** The AMT exposure is a labeled illustration,
`producesFilingComputation: false`; Form 6251 capital-gain rates, credits, and state tax
are outside it. Year-indexed amounts are asOf-dated parameter objects: the defaults are
the 2026 figures (P.L. 119-21 reset the phaseout thresholds and doubled the rate), with
the 2025 object retained for 2025 exercises. FMVs and per-year exercisability are inputs,
and exact anniversary day-counting is flagged for counsel.

**Sources.** Treas. Reg. § 1.422-4 (https://www.law.cornell.edu/cfr/text/26/1.422-4) ·
Rev. Proc. 2024-40 § 2.11 (https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) · Rev. Proc.
2025-32 § 2.10 (https://www.irs.gov/pub/irs-drop/rp-25-32.pdf) · IRS Publication 15
(2026) (https://www.irs.gov/publications/p15) · IRS Publication 525 · law rules
`us-fed.nso-spread-ordinary-income`, `us-fed.supplemental-wage-withholding-2026`,
`us-fed.iso-exercise-no-regular-income`, `us-fed.iso-holding-periods-disqualifying`,
`us-fed.iso-100k-limit`, `us-fed.iso-amt-adjustment`, `us-fed.amt-exemption-2025`,
`us-fed.amt-exemption-2026`.

### Employer payroll tax

`lib/openstartup/payrollTax.ts` — computes the employer-side federal payroll tax load on
one employee's annual wages.

| Function | Inputs | Returns |
| --- | --- | --- |
| `employerFicaAnnual` | annual wages, optional 2026 parameter object | employer social security and Medicare shares, their total, and the employee-only Additional Medicare withholding |
| `futaAnnual` | annual wages, optional state credit rate | FUTA wages, gross 6.0% tax, credit applied, net FUTA |
| `employerPayrollCostAnnual` | annual wages, optional credit and parameter overrides | wages plus employer FICA plus net FUTA, with the federal-only load factor |

**Worked example.** A $120,000 salary, replaying the Publication 15 (2026) and Form 940
(2025) figures pinned in `lib/openstartup/__tests__/payrollTax.test.ts`. Employer social
security: 6.2% × $120,000 = $7,440. Employer Medicare: 1.45% × $120,000 = $1,740.
Employer FICA total: $9,180. FUTA: wages capped at the $7,000 base, gross 6.0% = $420,
full 5.4% credit = $378, net $42. Federal employer total: $120,000 + $9,180 + $42 =
$129,222, a load factor of 0.0769. The same tests pin the published maxima: 6.2% × the
$184,500 wage base = $11,439 employer social security, and $42 full-credit FUTA per
employee.

**Serves:** [Set up payroll](https://ultrametric.ai/processes/set-up-payroll) · [Hire first employee](https://ultrametric.ai/processes/hire-first-employee) (n1 `employerPayrollCostAnnual`) · [Run payroll](https://ultrametric.ai/processes/run-payroll) (n3 `employerFicaAnnual`)

**Honesty boundaries.** Federal only: state unemployment insurance, state disability and
paid-leave programs, local payroll taxes, and workers' compensation are out of scope and
can be material. The full 5.4% credit assumes timely state payments in a
non-credit-reduction state, a yearly Schedule A determination. Deposit schedules and Form
941/940 filings are separate obligations.

**Sources.** IRS Publication 15 (2026) — https://www.irs.gov/publications/p15 ·
Instructions for Form 940 (2025) — https://www.irs.gov/instructions/i940 · SSA
contribution and benefit base — https://www.ssa.gov/oact/cola/cbb.html · law rules
`us-fed.fica-rates-2026`, `us-fed.futa-2025`.

### Delaware franchise tax

`lib/openstartup/deFranchiseTax.ts` — computes the Delaware corporation franchise tax
under both published methods and reports which one is cheaper.

| Function | Inputs | Returns |
| --- | --- | --- |
| `authorizedSharesMethodTax` | total authorized shares | the tiered tax ($175 minimum, $200,000 maximum) with the quarterly-installment flag |
| `assumedParValueCapitalTax` | gross assets, issued shares, authorized classes with par values | assumed par, assumed par value capital, and the $400-per-million tax |
| `largeCorporateFilerTax` | none | the fixed $250,000 amount, qualification unverified |
| `compareFranchiseTaxMethods` | the assumed-par inputs | both taxes, the cheaper method, and the saving |

**Worked example.** The Division of Corporations' published example, replayed in
`lib/openstartup/__tests__/deFranchiseTax.test.ts`: gross assets $1,000,000, 485,000
issued shares, authorized 1,000,000 shares of $1.00 par and 250,000 shares of $5.00 par.
Step 1: $1,000,000 / 485,000 = 2.06185567…, carried to 6 decimal places, $2.061856.
Step 2: the $1.00 par is below the assumed par, so 1,000,000 × 2.061856 = $2,061,856.
Step 3: the $5.00 par is above it, so 250,000 × $5.00 = $1,250,000. Step 4: assumed par
value capital $3,311,856. Step 5: over $1,000,000 rounds up to 4 million, 4 × $400 =
$1,600. The default authorized-shares bill on the same 1,250,000 shares is
$250 + $85 × 124 = $10,790, so the comparison reports a $9,190 saving.

**Serves:** [File DE franchise tax](https://ultrametric.ai/processes/file-de-franchise-tax) (n1 `compareFranchiseTaxMethods`) · [Cure a Delaware franchise tax delinquency](https://ultrametric.ai/processes/cure-a-delaware-franchise-tax-delinquency) (n2 `assumedParValueCapitalTax`)

**Honesty boundaries.** No-par stock is refused for the assumed-par method; Large
Corporate Filer qualification is surfaced as an amount only. The annual report fee,
penalties, interest, and installment scheduling are separate, and every result carries an
asOf date with needsReview set.

**Sources.** Delaware Division of Corporations, "How to Calculate Franchise Taxes" —
https://corp.delaware.gov/frtaxcalc/ · Annual report and tax instructions —
https://corp.delaware.gov/paytaxes/ · 8 Del. C. § 503 · law rules
`us-de.franchise-tax-authorized-shares-method`, `us-de.franchise-tax-assumed-par-method`,
`us-de.franchise-tax-annual-report`.

### R&D tax mechanics

`lib/openstartup/rdCredit.ts` — computes § 174/§ 174A amortization schedules and the
§ 41(h) payroll-offset election mechanics from explicit inputs.

| Function | Inputs | Returns |
| --- | --- | --- |
| `midpointAmortizationSchedule` | amount, period in years | a year-by-year schedule with half-year first and last entries |
| `domesticSre5YearSchedule` / `foreignSre15YearSchedule` | amount | the 5-year (domestic, 2022-2024 years) or 15-year (foreign) midpoint schedule |
| `domesticSre2025Treatment` | amount, optional election of 60 or more months | the current deduction, or the monthly election amount |
| `qsbPayrollOffsetEligibility` | gross receipts, receipts history, prior election years | cited conditions with an overall not-met or needs_review |
| `payrollOffsetElectionCap` | whether the tax year begins after 2022 | $250,000 or $500,000 |
| `quarterlyOffsetApplication` | elected amount, election year, quarterly liabilities | per-quarter application to social security then Medicare, with carryforward |

**Worked example.** $100,000 of domestic research from a taxable year beginning in
2022-2024, replayed in `lib/openstartup/__tests__/rdCredit.test.ts` from the § 174 text
("ratably over the 5-year period beginning with the midpoint of the taxable year"). The
ratable year is $100,000 / 5 = $20,000; the midpoint gives half of that in year one.
Year 1: $10,000. Years 2-5: $20,000 each. Year 6: the remaining $10,000. The schedule
sums to $100,000 exactly, the published 10/20/20/20/20/10 pattern. The same test file
hand-derives the Form 8974 ordering: a $500,000 election splits into a $250,000
social-security-only pool and a $250,000 Medicare pool, applied quarter by quarter with
carryforward.

**Serves:** [Claim the R&D tax credit](https://ultrametric.ai/processes/claim-the-r-d-tax-credit) (n1 `qsbPayrollOffsetEligibility`, n6 `payrollOffsetElectionCap`, n6 `quarterlyOffsetApplication`)

**Honesty boundaries.** Whether expenditures are qualified research (§ 41(d)) and the
credit amount itself (Form 6765) are never computed, so eligibility is at most
needs_review. Transition treatment of unamortized pre-2025 amounts, § 280C interactions,
and state R&D credits are out of scope.

**Sources.** 26 U.S.C. § 174 and § 174A —
https://www.law.cornell.edu/uscode/text/26/174A · 26 U.S.C. § 41(h) · Instructions for
Form 8974 — https://www.irs.gov/instructions/i8974 · law rules
`us-fed.research-expenditure-amortization`, `us-fed.rd-payroll-offset`.

### Runway & burn

`lib/openstartup/runway.ts` — projects cash month by month on Paul Graham's default-alive
model and measures what a hiring plan does to the outcome.

| Function | Inputs | Returns |
| --- | --- | --- |
| `simpleRunwayMonths` | cash on hand, net monthly burn | months of runway at constant burn (Infinity once profitable) |
| `defaultAliveReport` | cash, monthly revenue and expenses, revenue growth % per month, optional expense growth and horizon | status (default-alive, default-dead, indeterminate), months to profitability, months to zero cash, the cash trough, and the month-by-month trajectory |
| `growthAdjustedRunwayMonths` | the same inputs | the month cash runs out once compounding revenue is credited, or null if it never does |
| `hiringImpact` | the same inputs plus a hiring plan (monthly cost, start month, count) | base and with-hires reports, the runway delta, and whether the plan flips the company to default dead |

**Worked example.** The running fixture in `lib/openstartup/__tests__/runway.test.ts`:
$200,000 cash, $10,000 monthly revenue growing 10% per month, $30,000 flat expenses.
Revenue crosses expenses when 1.1^m ≥ 3: 1.1^11 = 2.853 gives $28,531, 1.1^12 = 3.138
gives $31,384.28, so profitability lands in month 12. Cumulative net burn through
month 11 is 11 × 30,000 − 10,000 × 20.384284 = 330,000 − 203,842.84 = $126,157.16, so the
cash trough is 200,000 − 126,157.16 = $73,842.84 and the status is default-alive. The
same company on $100,000 runs out in month 7 (cumulative burn $105,641.12): default-dead.
The model replays the projection described in "Default Alive or Default Dead?"; the essay
publishes no numeric example, so the arithmetic is hand-derived in the test comments.

**Serves:** [Track runway](https://ultrametric.ai/processes/track-runway) (n3 `simpleRunwayMonths`, n3 `defaultAliveReport`) · [Send the board financial report](https://ultrametric.ai/processes/send-the-board-financial-report) (n4 `defaultAliveReport`) · [Set the annual budget & get board approval](https://ultrametric.ai/processes/set-the-annual-budget-get-board-approval) (n2 `hiringImpact`)

**Honesty boundaries.** Growth rates are inputs rather than predictions, and the
projection answers only the essay's question: whether profitability arrives before zero
cash. The module is educational and does not give financial advice.

**Sources.** Paul Graham, "Default Alive or Default Dead?" (October 2015) —
https://paulgraham.com/aord.html (verified 2026-10-14).

### Unit economics

`lib/openstartup/unitEconomics.ts` — computes the SaaS efficiency ratios (LTV/CAC, MRR
movement, burn multiple, Rule of 40, magic number) from the caller's own numbers.

| Function | Inputs | Returns |
| --- | --- | --- |
| `customerLifetimePeriods` | churn rate % | average customer lifetime, in the churn rate's own period |
| `ltvSimple` / `ltv` | ARPA, churn %, gross margin % (for `ltv`) | lifetime revenue, or lifetime gross-margin dollars |
| `cac` | sales & marketing spend, new customers | cost to acquire a customer |
| `ltvToCacRatio` / `cacPaybackMonths` | LTV, CAC, monthly ARPA, gross margin % | the ratio; months to recover CAC |
| `netNewMrr` / `netMrrChurnRatePct` / `annualizedNetChurnPct` | MRR movements, beginning MRR, monthly net churn % | net new MRR, net churn %, the compounded annual rate |
| `burnMultiple` | net burn and net new ARR over the same period | the multiple, or a stated not-computable report when net new ARR is zero or negative |
| `ruleOf40` | growth %, profit margin % | the sum and whether it reaches 40 |
| `magicNumber` | two quarters' subscription revenue, the prior quarter's S&M spend | the annualized ratio |
| `compareToBenchmark` | a computed value plus a sourced benchmark band | a meets/misses comparison, always `needsReview` |

**Worked example.** The LTV-to-payback chain in
`lib/openstartup/__tests__/unitEconomics.test.ts`, instantiating David Skok's SaaS
Metrics 2.0 formulas: at 2% monthly churn the lifetime is 100 ÷ 2 = 50 months; $500 ARPA
at 80% gross margin gives LTV = 500 × 0.80 × 50 = $20,000; $120,000 of sales and
marketing spend for 30 new customers gives CAC = $4,000; the ratio is 20,000 ÷ 4,000 =
5.0; payback is 4,000 ÷ (500 × 0.80) = 10 months. The tests also replay the sources' own
figures: Skok's 3% monthly → 33-month lifetime and "about 22%" annualization of 2%
monthly churn (exactly 21.53%), Sacks' $2M/$1M = 2x and $5M/$1M = 5x, Feld's 20+20 /
40+0 / 50−10, O'Driscoll's prior-quarter denominator.

**Serves:** [Track runway](https://ultrametric.ai/processes/track-runway) · [Send the board financial report](https://ultrametric.ai/processes/send-the-board-financial-report) (n4 `burnMultiple`) · [Prepare a board meeting](https://ultrametric.ai/processes/prepare-a-board-meeting) (n4 `burnMultiple`, n4 `ruleOf40`) · [Save a churning customer](https://ultrametric.ai/processes/save-a-churning-customer) (n3 `ltv`) · [Roll out a pricing change](https://ultrametric.ai/processes/roll-out-a-pricing-change) (n7 `netMrrChurnRatePct`)

**Honesty boundaries.** Benchmark bands are caller-supplied inputs with a required
source; the module ships no benchmark tables and every comparison is `needsReview`. ARPA,
churn, margins, burn, and spend are explicit inputs from the company's own books.
Educational, not financial advice.

**Sources.** David Skok, "SaaS Metrics 2.0 – Detailed Definitions" —
https://www.forentrepreneurs.com/saas-metrics-2-definitions/ · David Skok, "SaaS Metrics
2.0" (the 2%-monthly ≈ 22%-annual churn line) —
https://www.forentrepreneurs.com/saas-metrics-2/ · David Sacks, "The Burn Multiple"
(2020-04-23) — https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200 · Brad Feld,
"The Rule of 40% For a Healthy SaaS Company" (2015-02-03) —
https://feld.com/archives/2015/02/rule-40-healthy-saas-company/ · Rory O'Driscoll, "Magic
Number Math" (2010-04-20) — https://www.scalevp.com/blog/magic-number-math (all verified
2026-10-14).

### Deferred revenue (subscriptions)

`lib/openstartup/deferredRevenue.ts` — spreads time-based subscription invoice lines
across calendar months by whole days and prorates mid-period plan changes.

| Function | Inputs | Returns |
| --- | --- | --- |
| `serviceDays` | inclusive start and end dates | the whole-day count of the service period |
| `recognitionSchedule` | one invoice line (amount, service period, billed date) | per-month days and recognized dollars, summing to the line exactly |
| `recognitionReport` | a set of invoice lines | month-by-month billed, recognized, and deferred balance, with totals and `needsReview` |
| `prorationOnPlanChange` | billing period, change date, old and new plan amounts | the unused-time credit, remaining-time charge, net due, and both items as revenue lines ready to fold into a report |

**Worked example.** Stripe's $31 monthly subscription, replayed in
`lib/openstartup/__tests__/deferredRevenue.test.ts`: the invoice covers January 15
through February 14, 2026, which is 31 inclusive service days, 17 of them in January and
14 in February. Recognition is 31 × 17/31 = $17.00 in January and 31 × 14/31 = $14.00 in
February, so the January close shows billed $31, recognized $17, deferred $14; February
recognizes the remaining $14 and the deferred balance returns to zero. The same tests
replay Stripe's $365 annual example (deferred 334 → 306 → 275 across Q1) and the April
upgrade and downgrade prorations (−$30/+$40 and −$30/+$10, April recognizing $100 and
$70).

**Serves:** [Bookkeeping close](https://ultrametric.ai/processes/bookkeeping-close) (n5 `recognitionReport`) · [Set up subscription billing](https://ultrametric.ai/processes/set-up-subscription-billing) · [Roll out a pricing change](https://ultrametric.ai/processes/roll-out-a-pricing-change) (n4 `prorationOnPlanChange`)

**Honesty boundaries.** Performance obligations, standalone selling prices, usage
pricing, refunds, FX, and collectibility are the accountant's calls under ASC 606 /
IFRS 15 and stay out of scope; every report is `needsReview` and the bookkeeping close's
accountant-review step owns the books. Educational, not accounting advice.

**Sources.** Stripe Docs, "Revenue Recognition — Subscription examples" —
https://docs.stripe.com/revenue-recognition/examples/subscriptions · Stripe Docs,
"Revenue Recognition examples" — https://docs.stripe.com/revenue-recognition/examples
(verified 2026-10-14).

## How the modules connect to the processes

`open-processes/business-logic-map.json` is the wiring: task-level (which modules
serve which processes — the "Open modules" line on live process pages) and
step-level (which exported FUNCTION computes which step's math — the per-step
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

## Coverage limits

State payroll, complete option withholding, and final-paycheck calculations remain outside
the current federal examples. Extensions require dated jurisdiction law rules and cited
worked examples before implementation. VC fund capital-call allocation and management-fee
math remain candidates pending a citable worked example; bespoke fund terms remain inputs.

The module admission requirements below apply to each extension. A workflow step without
supported arithmetic stays in the process or law-rule layer. Judgment, legal interpretation,
and authorization remain with the responsible human.

## What you can contribute here

- **A new open module** — pure TypeScript under `lib/openstartup/` plus an index-table row
  and a templated section in this README (the one-sentence what-it-computes line, the
  function table, a Worked example traced from the golden tests, Serves, Honesty
  boundaries, Sources). The bar is fixed: pure functions, a citation on every formula's
  doc comment, explicit rounding, worked examples reproduced number-for-number from the
  cited source, and property tests. See the [coverage limits](#coverage-limits) for the
  prerequisites of remaining candidates. Gate:
  `pnpm test lib/openstartup/__tests__/` (and `pnpm test`).
- **Harden an existing module** — a missed edge case from a cited worked example, a new
  property test, or a correction with the source that proves it (e.g. the YC Post-Money
  Safe User Guide for `capTable.ts`).
- **Legal thresholds** — a module that leans on one must reference a dated law
  rule in `open-law/` and return `needs_review` when locale or date is unknown; results are
  decision support, never authorization. The conservative workflow planner lives in
  `lib/founderOps.ts` and is gated by `__tests__/founder-ops.test.ts`.

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
