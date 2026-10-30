# Open startup simulator

The simulator at [ultrametric.ai/startup-sim](https://ultrametric.ai/startup-sim) runs a
synthetic company through the committed process library. This folder is the catalog for
it, the way [`open-modules/`](../open-modules/) catalogs the startup calculations: what
the simulator simulates, the assumptions it discloses, and where the code lives. The code
itself stays in [`lib/`](../lib/).

## What it simulates

A simulated company is composed of real corpus processes
([canonical catalog](../open-processes/catalog.json)). The reader picks a
handful of starting decisions; each decision selects which committed chains make up the
journey, and the timeline replays their steps, with legacy agent/form/person routing retained for simulation.
The additive [execution assessment](../open-processes/execution.md) supplies current content
categories independently of those simulation fields. Vendor
picks come from the judged rankings (`lib/processRankings.ts` over
[`open-rankings/`](../open-rankings/)), resolved server-side; nothing in the simulator
re-judges a vendor or fabricates a score.

Every run is deterministic from (decision combo, preset, founder axes, seed): a seeded
PRNG, zero runtime LLM calls, every derived number recomputable from committed data. A
compact `?run=` permalink replays the exact run. Every synthetic artifact is born
labeled: the `simulated: true` flag is stamped centrally and the UI renders a visible
SIMULATED chip from it. Fake identifiers are constructed to be impossible-real: EIN
`00-0000000` (no real EIN starts 00), domains on the RFC 2606-reserved `.example` TLD,
all-zero file and routing numbers.

## Disclosed assumptions and multipliers

Judged data (access verdicts, rankings, corpus minutes, published pricing) is never
blended silently with simulation constants. Every constant below is exported from
[`lib/virtualStartupRun.ts`](../lib/virtualStartupRun.ts), named, and rendered in the UI
with the words "simulation assumption" (tests enforce the phrase). The committed values:

| Constant | Value | What it does |
| --- | --- | --- |
| `FOUNDER_HOURS_MULTIPLIER` | 3 | A step whose picked vendor has no judged MCP/CLI agent surface runs at founder-hours: ×3 the corpus estimate |
| `SECOND_TIMER_MULTIPLIER` | 0.5 | A repeat entrepreneur runs legal/finance steps at ×0.5, unless an agent already runs them |
| `PROCESSOR_REVIEW_WAIT_DAYS` | 5 | Days the payment-processor review event adds on its wait path |
| `TRADEMARK_RESPONSE_WAIT_DAYS` | 21 | Days the trademark-conflict event adds on its respond path |
| `COFOUNDER_NEGOTIATION_WAIT_DAYS` | 14 | Days the cofounder-departure event adds on its negotiate path |
| `OUTAGE_ROLLBACK_WAIT_DAYS` | 1 | Days the launch-day-outage event adds on its rollback path |

The founder axes carry the two persona assumptions:

- a non-technical founder runs engineering steps (the `ship-v1` / `launch-website`
  playbooks) at founder-hours (×3) unless an agent runs them;
- a repeat entrepreneur runs legal/finance steps (task-id prefixes `legal_`, `form_`,
  `fund_`, `fin_`, `tax_`, plus the founder agreement `startup_002`) at ×0.5. The two
  axis modifiers compose multiplicatively on a step that qualifies for both.

The outcome rules apply in order (`computeStackOutcome`): an agent-routed step whose
picked vendor has a full or partial MCP/CLI verdict keeps its corpus minutes; an
agent-routed step served by a role but lacking an agent surface runs at ×3
(founder-hours applies once; the axis modifiers never re-scale it); an agent-routed step
with no swappable role is unchanged; non-agent steps are unchanged, and then the axis
modifiers apply. The judged bar for "an agent can drive this vendor" is a full or
partial verdict on MCP or CLI; disputed, none, and n/a verdicts are not an agent surface
and are never upgraded.

Monthly burn is selection, not arithmetic over guesses: the sum covers vendors whose
extracted pricing facts are already stated per month (free tiers count $0); usage-priced
vendors are listed with their source citations and never blended into the monthly
figure; a vendor without published pricing reads "no published pricing".

## Scenario shapes

- Decisions (`DECISIONS` in `lib/virtualStartup.ts`): entity (Delaware C-Corp, LLC, and
  appended country analogs), team (solo / cofounders), funding (bootstrap / seed),
  business model (subscriptions, invoices, marketplace, usage, e-commerce), first hire
  (yes / no), compliance (SOC 2 now / later, HIPAA, ISO 27001, basics), ICP (developers,
  enterprises, SMBs, consumers), remote vs office, and launch venue (Product Hunt,
  Show HN, waitlist, X, stealth). Every composition is built from committed corpus
  chains; where no dedicated corpus steps exist (marketplace take rates, storefronts,
  venue-specific launches), the real spine runs with the model or venue named, and no
  steps are invented.
- Founder axes: Technical (technical / non-technical) × Experience (first-timer /
  repeat entrepreneur), two orthogonal axes whose modifiers compose.
- Example companies (one-tap presets): Typical software (Agentloop), Frontier hardware
  (Holofield), Biotech (Demovax). The hardware and biotech presets carry a visible
  disclosure that the journey is the same real software-company process corpus;
  domain-specific steps (regulatory, manufacturing, trials) are not modeled. Funding
  scenarios (VC backed / Bootstrapped) assert only their own decision keys, and a YC
  batch mode calibrates the same corpus journey to the publicly known batch shape.
- Seeded mid-run events, each grounded in a real corpus process and gated by
  plausibility (corpus risk scores plus the run's decisions), with deterministic
  branching choices: a SOC 2 demand from a prospect, a payment-processor review, a
  cofounder departure, a trademark conflict, a launch-day outage.

## Where the code lives

| File | What it holds |
| --- | --- |
| [`lib/virtualStartup.ts`](../lib/virtualStartup.ts) | Decisions, presets, scenarios, journey composition from the corpus, synthetic artifacts |
| [`lib/virtualStartupRun.ts`](../lib/virtualStartupRun.ts) | The run layer: named assumptions, founder axes, outcome math, seeded events, burn, the `?run=` codec |
| [`lib/virtualStartupData.ts`](../lib/virtualStartupData.ts) | Server-side resolution of judged access verdicts and pricing into serializable payloads |
| [`lib/processSim.ts`](../lib/processSim.ts) | The step-routing shapes the simulator shares with the process pages |

The replay tests live in `lib/__tests__/virtualStartup.test.ts`,
`virtualStartupRun.test.ts`, and `virtualStartupLinkage.test.ts`: journey composition
against the live corpus, the assumption phrasing, and the permalink codec.

## Contribute here

- **A correction to a disclosed assumption** — change the named constant in
  `lib/virtualStartupRun.ts` with the reasoning in the PR; the constant stays exported and
  named, and the UI keeps the words "simulation assumption" (tests enforce the phrase).
- **A new decision, preset, or seeded event** — compose it in `lib/virtualStartup.ts` from
  committed corpus processes and chains; steps are not invented and no vendor is re-judged.

Gate: `pnpm test lib/__tests__/virtualStartup.test.ts lib/__tests__/virtualStartupRun.test.ts lib/__tests__/virtualStartupLinkage.test.ts`.

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).

The yearly view includes common recurring controls from the startup task inventory. Conditional debt, grant, external-audit, intercompany-tax, indirect-tax-return and physical-stock work stays outside the simulated year until the profile carries the facts needed to activate it. The exclusion reasons are explicit in `YEAR_SWEEP_EXCLUSIONS` in `lib/virtualStartup.ts`.
