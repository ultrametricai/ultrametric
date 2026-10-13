# Situations — the reactive records in the process corpus

A **situation** is a corpus record with `kind: 'situation'` (`processes/corpus.json`): reactive,
trigger-driven work that interrupts the founder journey instead of sitting on it. A lawsuit is
served, a breach is live, a tax notice arrives — nobody plans these into a timeline, so
situations deliberately carry **no `timeOrder` slot** and never appear on the founder-timeline
orderings. Their detail pages render at `/processes/<slug>` (URL stability); their index is
[`/situations`](https://ultrametric.ai/situations), which moved them out of the `/processes`
table (founder 2026-10-02 — that table is processes only now).

## The trigger / urgency model

Two fields carry the reactive classification, both required on every situation and forbidden on
plain processes (schema-enforced in `lib/processes.ts`, kind-conditionally):

- **`trigger`** — the concrete event that puts a founder here, written as the event, not the
  task ("A process server hands you a summons and complaint", not "handle lawsuits"). It
  renders as the row subtitle on `/situations` and leads the prose on the detail page.
- **`urgency`** — the honest clock tier once the trigger lands: `hours` (a breach, a frozen
  operating account, a live DDoS), `days` (served papers, a cease-and-desist), or `weeks` (a
  tax notice, an office action, a franchise-tax delinquency). Tier definitions live in
  `lib/processSim.ts` (`URGENCY_META`) and render as the urgency chip
  (`components/UrgencyChip.tsx`). The `/situations` index sorts by urgency, then title — the
  hotter clock reads first. Deadlines inside a situation are the NOTICE's own printed deadline
  or the statute's, cited on the steps; the tier is a reading aid, never a legal clock.

Everything else is the ordinary corpus machinery: a DAG of steps routed agent / manual form /
human, curated `risk`/`annoyance` scores (situations interleave honestly on those orderings),
`geoScope`, and jurisdiction notes.

## The honest low-ceiling posture

Situations have a deliberately LOW Agentic %, and that is the point, not a gap to engineer
away: reading a legal demand, the counsel/CPA judgment call, the response signed under penalty
of perjury, and the counterparty's processing clock are human by nature (several are
legally-human signature acts, `legalSignature`). What an agent honestly does is the mechanical
core — preserve the evidence file, pull the period's records, recompute the asserted mismatch,
pull the cited marks from TSDR — and the corpus routes exactly those steps `agent`, nothing
more. Async waits (the IRS processing the response, the examiner's next action) are modeled as
waits, never promised away. Educational guidance, not legal advice — every situation's
description says so.

## The 22 situations

<!-- situations:table:start (generated — scripts/generate-situations-md.ts) -->

The 22 situations, hottest clock first (urgency, then title — the /situations order):

| id | Situation | Trigger | Urgency | Geo |
| --- | --- | --- | --- | --- |
| `sit_018` | Recover a hijacked domain or social account | Your domain, DNS, or a company social/email account is taken over: logins fail, records change, or posts you didn't write appear. | hours | global |
| `sit_005` | Recover from a frozen bank account or bank failure | Your operating account is frozen by the bank's compliance review, or the bank itself fails. | hours | global |
| `sit_021` | Report and manage a workplace injury | Someone is hurt at work: an injury on the job just happened and reporting deadlines may already be running. | hours | us-state |
| `sit_003` | Respond to a data breach | You discover unauthorized access to customer or company data: a breach is live or just happened. | hours | us-state |
| `sit_011` | Survive a DDoS attack or major outage | Traffic spikes take the product down: a DDoS attack is live, or a major outage looks like one. | hours | global |
| `sit_020` | Absorb a pulled term sheet | The lead pulls the term sheet, by call or by silence, and the round you planned around is gone. | days | global |
| `sit_006` | Contain a chargeback or fraud spike | Your dispute rate jumps: a chargeback wave or a card-testing/fraud spike is hitting your payments. | days | global |
| `sit_007` | Handle a co-founder departure | A co-founder is leaving (resignation or a split) and the vesting, IP, and access mechanics start now. | days | us |
| `sit_019` | Handle a key employee's resignation | A key employee resigns: notice is in hand and the transition starts now. | days | us |
| `sit_014` | Handle a security-vulnerability report | A security researcher (or a customer, or a stranger) reports a vulnerability in your product, responsibly so far. | days | global |
| `sit_017` | Recover a suspended ad or platform account | Google Ads, Meta, or another ad/platform account is suspended: campaigns stop and a policy email names the violation. | days | global |
| `sit_013` | Recover from a payment-processor account termination | Your payment processor emails that your account is terminated or restricted; payouts pause and a final processing date is set. | days | global |
| `sit_016` | Recover from an app-store rejection or removal | Your app is rejected in review, or pulled from the App Store or Google Play with a policy notice. | days | global |
| `sit_001` | Respond to a cease-and-desist | A cease-and-desist letter claiming trademark or IP infringement arrives by mail or email. | days | us |
| `sit_022` | Respond to a harassment complaint | An employee reports harassment: by complaint, by email, or in a conversation that just became one. | days | us |
| `sit_008` | Respond to a lawsuit | You've been served: a process server hands you a summons and complaint naming the company. | days | us |
| `sit_002` | Unstick a delayed US visa | Your US visa is stuck (221(g) administrative processing after the interview, or a petition sitting past posted times) while the company needs you in Silicon Valley. | days | us |
| `sit_015` | Answer a data-subject access request | Someone exercises their data rights: a GDPR subject access request or CCPA request to know/delete lands in any inbox. | weeks | global |
| `sit_004` | Answer an IRS or state tax notice | An IRS or state tax notice arrives claiming a discrepancy, a balance due, or a missing filing. | weeks | us |
| `sit_010` | Cure a Delaware franchise tax delinquency | A Delaware delinquency notice arrives: the March 1 annual report/franchise tax was missed and good standing is gone or going. | weeks | us-state |
| `sit_012` | Migrate off a shutting-down vendor | A vendor you depend on announces a shutdown or sunsets the product you're built on. | weeks | global |
| `sit_009` | Respond to a trademark office action | The USPTO examiner issues an office action against your trademark application: refusals or requirements with a response deadline. | weeks | us |

<!-- situations:table:end -->

## How to add one

1. Add the record to `processes/corpus.json` with `kind: 'situation'`, a `trigger` written as
   the event, an honest `urgency` tier, **no `timeOrder`**, and the usual DAG/scores/geoScope.
   Legal claims in descriptions cite dated rule cards in `rules/` by id; deadlines cite the
   notice or statute, curl-verified like every corpus URL.
2. Route steps honestly: `agent` only for the mechanical core; signatures under penalty of
   perjury get `legalSignature`; third-party clocks are `person` waits.
3. Regenerate this file's table: `pnpm exec tsx scripts/generate-situations-md.ts`.
4. Run the gates — the drift test (`__tests__/situations.test.ts`) fails if this list and the
   corpus disagree, the schema tests enforce the kind-conditional fields, and
   `pnpm shared:check` re-imports the shared record.
