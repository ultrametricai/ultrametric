# Situations — the event-triggered records in the process corpus

A **situation** is a canonical `open-processes/<slug>.json` record with `kind: 'situation'`: an
unplanned event routed into the same process machinery. A lawsuit is served, a breach is live,
a tax notice arrives: nobody plans these into a timeline, so situations carry **no `timeOrder`
slot** and never appear on the founder-timeline orderings. Structurally a situation is both an
entry condition and a process graph. The `trigger` is the entry condition (the concrete event
that starts the work, where a process has a timeline slot), and from there the record runs the
ordinary step DAG: steps with execution assessments, judged vendor options per step,
open-module compute chips, jurisdiction notes. Their detail pages render at
`/processes/<slug>` (URL stability); their index is
[`/situations`](https://ultrametric.ai/situations), which moved them out of the `/processes`
table (founder 2026-10-02: that table is processes only now).

## The trigger / urgency model

Two fields carry the reactive classification, both required on every situation and forbidden on
plain processes (schema-enforced in `lib/processes.ts`, kind-conditionally):

- **`trigger`** — the concrete event that puts a founder here, written as the event, not the
  task ("A process server hands you a summons and complaint", not "handle lawsuits"). It
  renders as the row subtitle on `/situations` and leads the prose on the detail page.
- **`urgency`** — the clock tier once the trigger lands: `hours` (a breach, a frozen
  operating account, a live DDoS), `days` (served papers, a cease-and-desist), or `weeks` (a
  tax notice, an office action, a franchise-tax delinquency). Tier definitions live in
  `lib/processSim.ts` (`URGENCY_META`) and render as the urgency chip
  (`components/UrgencyChip.tsx`). The `/situations` index sorts by urgency, then title — the
  hotter clock reads first. Deadlines inside a situation are the NOTICE's own printed deadline
  or the statute's, cited on the steps; the tier is a reading aid, never a legal clock.

Everything else is the ordinary corpus machinery: a DAG of steps with execution assessments, curated `risk`/`annoyance` scores (situations interleave with processes on those
orderings), `geoScope`, and jurisdiction notes.

## The agentic share, and raising it

Situations route steps by what runs today, like any process. Today more of their steps sit
with humans than on the planned timeline: reading a legal demand, the counsel/CPA judgment
call, a response signed under penalty of perjury (several steps are signature acts,
`legalSignature`), and the counterparty's processing clock. The mechanical core already routes
`agent` (preserve the evidence file, pull the period's records, recompute the asserted
mismatch, pull the cited marks from TSDR), and raising that share is a goal of the corpus: as
vendor surfaces and recorded evidence improve, steps move from `person` to `agent` here the
same way they do on any process. Two step classes stay put by nature rather than by evidence:
signature acts stay with the signer, and third-party clocks (the IRS processing a response,
the examiner's next action) are modeled as async waits rather than promised away. Educational
guidance, not legal advice; every situation's description says so.

## The situations

<!-- situations:table:start (generated — scripts/generate-situations-md.ts) -->

The 33 situations, hottest clock first (urgency, then title — the /situations order):

| id | Situation | Trigger | Urgency | Geo |
| --- | --- | --- | --- | --- |
| `sit_025` | [Handle a press crisis](pages/handle-a-press-crisis.md) | A negative story is live and spreading: press coverage, a viral thread, or a review pile-on names your company. | hours | global |
| `sit_018` | [Recover a hijacked domain or social account](pages/recover-a-hijacked-domain-or-social-account.md) | Your domain, DNS, or a company social/email account is taken over: logins fail, records change, or posts you didn't write appear. | hours | global |
| `sit_005` | [Recover from a frozen bank account or bank failure](pages/recover-from-a-frozen-bank-account-or-bank-failure.md) | Your operating account is frozen by the bank's compliance review, or the bank itself fails. | hours | global |
| `sit_021` | [Report and manage a workplace injury](pages/report-and-manage-a-workplace-injury.md) | Someone is hurt at work: an injury on the job just happened and reporting deadlines may already be running. | hours | global |
| `sit_003` | [Respond to a data breach](pages/respond-to-a-data-breach.md) | You discover unauthorized access to customer or company data: a breach is live or just happened. | hours | global |
| `sit_011` | [Survive a DDoS attack or major outage](pages/survive-a-ddos-attack-or-major-outage.md) | Traffic spikes take the product down: a DDoS attack is live, or a major outage looks like one. | hours | global |
| `sit_020` | [Absorb a pulled term sheet](pages/absorb-a-pulled-term-sheet.md) | The lead pulls the term sheet, by call or by silence, and the round you planned around is gone. | days | global |
| `sit_023` | [Absorb the loss of your biggest customer](pages/absorb-the-loss-of-your-biggest-customer.md) | Your biggest customer gives notice: non-renewal, termination for convenience, or an acquisition that ends the account your revenue leans on. | days | global |
| `sit_028` | [Avert a missed payroll](pages/avert-a-missed-payroll.md) | The cash forecast says the next payroll will not clear: you are weeks from out of cash, or the provider's funding debit just failed. | days | global |
| `sit_006` | [Contain a chargeback or fraud spike](pages/contain-a-chargeback-or-fraud-spike.md) | Your dispute rate jumps: a chargeback wave or a card-testing/fraud spike is hitting your payments. | days | global |
| `sit_026` | [Cure a venture-debt covenant default](pages/cure-a-venture-debt-covenant-default.md) | Your venture-debt lender flags a covenant breach, or your own numbers show one: a financial covenant missed, a MAC clause in play, or a milestone default. | days | global |
| `sit_007` | [Handle a co-founder departure](pages/handle-a-co-founder-departure.md) | A co-founder is leaving (resignation or a split) and the vesting, IP, and access mechanics start now. | days | global |
| `sit_019` | [Handle a key employee's resignation](pages/handle-a-key-employee-s-resignation.md) | A key employee resigns: notice is in hand and the transition starts now. | days | global |
| `sit_014` | [Handle a security-vulnerability report](pages/handle-a-security-vulnerability-report.md) | A security researcher (or a customer, or a stranger) reports a vulnerability in your product, responsibly so far. | days | global |
| `sit_017` | [Recover a suspended ad or platform account](pages/recover-a-suspended-ad-or-platform-account.md) | Google Ads, Meta, or another ad/platform account is suspended: campaigns stop and a policy email names the violation. | days | global |
| `sit_013` | [Recover from a payment-processor account termination](pages/recover-from-a-payment-processor-account-termination.md) | Your payment processor emails that your account is terminated or restricted; payouts pause and a final processing date is set. | days | global |
| `sit_016` | [Recover from an app-store rejection or removal](pages/recover-from-an-app-store-rejection-or-removal.md) | Your app is rejected in review, or pulled from the App Store or Google Play with a policy notice. | days | global |
| `sit_001` | [Respond to a cease-and-desist](pages/respond-to-a-cease-and-desist.md) | A cease-and-desist letter claiming trademark or IP infringement arrives by mail or email. | days | global |
| `sit_033` | [Respond to a government subpoena or data request](pages/respond-to-a-government-subpoena-or-data-request.md) | A government subpoena, court order, or warrant arrives demanding user data or company records, sometimes with a nondisclosure order attached. | days | global |
| `sit_022` | [Respond to a harassment complaint](pages/respond-to-a-harassment-complaint.md) | An employee reports harassment: by complaint, by email, or in a conversation that just became one. | days | global |
| `sit_008` | [Respond to a lawsuit](pages/respond-to-a-lawsuit.md) | You've been served: a process server hands you a summons and complaint naming the company. | days | global |
| `sit_024` | [Respond to a patent demand letter](pages/respond-to-a-patent-demand-letter.md) | A letter arrives asserting a patent against your product and demanding a license fee, often from a non-practicing entity (NPE). | days | global |
| `sit_032` | [Respond to an acquisition approach](pages/respond-to-an-acquisition-approach.md) | An acquirer reaches out: a corp-dev email, a partner-meeting invitation, or a direct offer to buy the company. | days | global |
| `sit_027` | [Respond to an employee work-authorization refusal or evidence request](pages/handle-an-employee-s-visa-denial-or-rfe.md) | An RFE or a denial lands on an employee's work-visa petition, and their authorization to keep working now has a clock on it. | days | global |
| `sit_029` | [Run a reduction in force](pages/run-a-reduction-in-force.md) | The decision is made: the plan no longer supports the team, and a reduction in force is how the company survives. | days | global |
| `sit_002` | [Unstick a delayed US visa](pages/unstick-a-delayed-us-visa.md) | Your US visa is stuck (221(g) administrative processing after the interview, or a petition sitting past posted times) while the company needs you in Silicon Valley. | days | us |
| `sit_015` | [Answer a data-subject access request](pages/answer-a-data-subject-access-request.md) | Someone exercises their data rights: a GDPR subject access request or CCPA request to know/delete lands in any inbox. | weeks | global |
| `sit_004` | [Answer a tax-authority notice](pages/answer-an-irs-or-state-tax-notice.md) | A tax-authority notice arrives claiming a discrepancy, a balance due, or a missing filing. | weeks | global |
| `sit_010` | [Cure a Delaware franchise tax delinquency](pages/cure-a-delaware-franchise-tax-delinquency.md) | A Delaware delinquency notice arrives: the March 1 annual report/franchise tax was missed and good standing is gone or going. | weeks | us-state |
| `sit_012` | [Migrate off a shutting-down vendor](pages/migrate-off-a-shutting-down-vendor.md) | A vendor you depend on announces a shutdown or sunsets the product you're built on. | weeks | global |
| `sit_031` | [Recover from a missed 83(b) deadline](pages/recover-from-a-missed-83-b-deadline.md) | You discover the 83(b) election was never filed, and the 30-day window from the stock purchase has passed. | weeks | us |
| `sit_009` | [Respond to a trademark office action](pages/respond-to-a-trademark-office-action.md) | The trademark examiner issues an office action against your application: refusals or requirements with a response deadline. | weeks | global |
| `sit_030` | [Take a down round or recap](pages/take-a-down-round-or-recap.md) | The only real term sheet prices the company below the last round, or the insiders propose a recapitalization as the condition of new money. | weeks | global |

<!-- situations:table:end -->

## How to add one

1. Add an `open-processes/<slug>.json` definition to `catalog.json` with `kind: 'situation'`.
   Set `metadata.kind` to the same value, `metadata.trigger` to the event, and
   `metadata.urgency` to the tier the clock actually sets. Omit `metadata.timeOrder`; retain
   explicit `entrySteps`, parts, links, scores and geography. Legal claims in descriptions cite dated law rules in `open-law/` by id;
   deadlines cite the notice or statute, curl-verified like every corpus URL.
2. Assess each step and method using [execution authoring](execution.md): Agent Native,
   Agent Computer Use, Human Online or Human Offline, with cited evidence for the actual
   work. Keep unknown mechanisms unresolved and review-gated. Preserve signatures,
   approvals, jurisdictions and third-party dependencies as separate properties.
3. Regenerate this file's table: `pnpm exec tsx scripts/generate-situations-md.ts`.
4. Run the gates — the drift test (`__tests__/situations.test.ts`) fails if this list and the
   corpus disagree, the schema tests enforce the kind-conditional fields, and
   `pnpm shared:check` validates the canonical catalog and jurisdiction projections.
