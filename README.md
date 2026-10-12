![Ultrametric](docs/assets/banner.svg)

**Everything a founder (or their agent) needs to start and run a company: every
[process](#processes) step by step, the [vendors](#vendors) ranked, and the
[open modules](#open-modules) underneath.**

- **Use it:** [ultrametric.ai](https://ultrametric.ai) has [the processes](https://ultrametric.ai/processes) · [the rankings](https://ultrametric.ai/overall) · [the simulator](https://ultrametric.ai/startup-sim)
- **Improve it:** the open startup repo, [CONTRIBUTING.md](./CONTRIBUTING.md). Contest a verdict, add your country, add a module.
- **For agents:** open data, no keys. `curl https://ultrametric.ai/data/categories.json` ([use it from an agent](#use-it-from-an-agent))

**Contribution guides:** [Add your vendor](CONTRIBUTING.md#add-your-vendor) · [Add a process](CONTRIBUTING.md#add-a-process) · [Add a jurisdiction](CONTRIBUTING.md#add-a-jurisdiction) · [Add an open module](CONTRIBUTING.md#add-an-open-module)

**Talk:** [Discord](https://discord.com/invite/3aHky836qP) — founders and contributors

<!-- Legacy anchor: external links to #start-here predate the merge into this map. -->
<a id="start-here"></a>

## The open startup repo

This repo holds the processes, rankings, rules, and calculations a startup runs on, as
plain JSON and markdown that any founder or agent can read, verify, and correct by pull
request; the site at [ultrametric.ai](https://ultrametric.ai) renders it unchanged.

[CONTRIBUTING.md](./CONTRIBUTING.md) · [DATA-LICENSE](./DATA-LICENSE)

## Video demo

A pass through the live site: home, the overall rankings, one market's leaderboard, one
process, and the startup simulator.

![A pass through ultrametric.ai: home, the overall rankings, the AI Coding Agents leaderboard, the Incorporate C-Corp process, and the startup simulator](docs/assets/readme/demo.gif)

<a id="vendors"></a>

## Open vendor rankings

Head-to-head rankings of the tools startups run on, judged story by story against hands-on
probes, code, docs, and community reports, with every verdict contestable.

<!-- arenas:start -->
**96 rankings** today, 657 products judged head to head — the full index is [ultrametric.ai/arenas](https://ultrametric.ai/arenas), and each ranking's records live under [`data/`](data/).
<!-- arenas:end -->

[ultrametric.ai/overall](https://ultrametric.ai/overall)

![The overall rankings on ultrametric.ai: companies ranked by agent readiness, with per-market leaderboards behind each row](docs/assets/readme/rankings-overall.png)

<a id="processes"></a>

## Open processes

Every founder process as a step-by-step graph: each step routed agent, form, or human,
timed, graded for reversibility, and wired to the ranked vendors that can run it.

[ultrametric.ai/processes](https://ultrametric.ai/processes) · [`processes/`](processes/)

![The founder processes on ultrametric.ai, each with its phase, agentic share, step count, and vendors](docs/assets/readme/processes-index.png)

## Examples

Three processes end to end:

- [Validate the idea](https://ultrametric.ai/processes/validate-the-idea) — picking the startup to work on
- [Generate a company name](https://ultrametric.ai/processes/generate-a-company-name) — picking a brand name
- [Apply to Y Combinator](https://ultrametric.ai/processes/apply-to-y-combinator) — the YC application, step by step

![The Validate the idea process: the step diagram, each step routed agent or human, with ranked vendor options per step](docs/assets/readme/process-page.png)

<!-- Legacy anchor: external links to #business-logic predate the open-modules/ rename. -->
<a id="business-logic"></a>

## Open modules

The startup calculations as code in [`lib/openstartup/`](lib/openstartup/): every formula
cites its source and replays the published worked examples in tests.

| Module | What it computes | Source it cites |
| --- | --- | --- |
| [Cap table](open-modules/README.md#cap-table) | Issuance, option pools, SAFE conversion, priced-round price per share, dilution | YC Post-Money Safe User Guide |
| [Vesting](open-modules/README.md#vesting-mechanics) | Cliff and periodic schedules, back-loaded tranches, acceleration, departures | Cooley GO; Amazon's published schedule; FAST grid |
| [83(b) election](open-modules/README.md#83b-election-math) | Tax at grant vs tax at vesting, forfeiture cost | Rev. Proc. 2012-29 |
| [QSBS (§ 1202)](open-modules/README.md#qsbs--1202) | Eligibility conditions, holding clock, exclusion percentages, per-issuer cap | IRC § 1202 |
| [Deadlines](open-modules/README.md#deadline-calendar) | The founder compliance calendar, each date citing a rule card | Dated rule cards in `rules/` |
| [Convertible notes](open-modules/README.md#convertible-notes) | Interest accrual, cap/discount conversion, maturity paths | Cooley GO convertible-debt primers |
| [Sale waterfall](open-modules/README.md#liquidity-event-waterfall) | Per-holder proceeds at a sale price | YC User Guide; Cooley GO |
| [Anti-dilution](open-modules/README.md#anti-dilution) | Weighted-average and full-ratchet adjustments | NVCA model documents |
| [Priced round](open-modules/README.md#priced-round-mechanics) | Pro rata, pool sizing from a hiring plan, down rounds, secondaries | YC User Guide; Index Rewarding Talent |
| [Round composer](open-modules/README.md#priced-round-composer) | A priced round end to end, term sheet to post-close table | YC User Guide, replayed end to end |
| [409A sanity](open-modules/README.md#409a-grant-sanity) | Strike floor, valuation staleness, presumption timing | Treas. Reg. § 1.409A rule cards |
| [Equity comp](open-modules/README.md#offer--equity-comp-scenarios) | Offer grant percentage, option spread, exit scenarios | Holloway Guide; Index Rewarding Talent |
| [Option tax](open-modules/README.md#iso--nso-exercise-tax) | NSO income at exercise, ISO/AMT outcomes, the $100,000 limit, sale outcomes | IRS Pub 525; Treas. Reg. § 1.422 |
| [Payroll tax](open-modules/README.md#employer-payroll-tax) | Employer FICA/FUTA load, per-employee annual cost | IRS Pub 15 |
| [Delaware franchise tax](open-modules/README.md#delaware-franchise-tax) | Both published methods, the cheaper-method comparison | 8 Del. C. § 503; Division worked examples |
| [R&D tax](open-modules/README.md#rd-tax-mechanics) | § 174 amortization, § 41(h) payroll-offset mechanics | IRC §§ 174, 41; Form 8974 instructions |
| [Runway](open-modules/README.md#runway--burn) | Default-alive trajectories, hiring impact | Paul Graham, "Default Alive or Default Dead?" |
| [Unit economics](open-modules/README.md#unit-economics) | LTV/CAC, burn multiple, Rule of 40, magic number | Skok; Sacks; Feld |
| [Deferred revenue](open-modules/README.md#deferred-revenue-subscriptions) | Subscription revenue recognition, plan-change proration | Stripe revenue-recognition examples |

[`open-modules/README.md`](open-modules/README.md) has each module's contract, worked
examples, and boundaries.

### Shared data fields

The modules and processes read one typed set of company fields (incorporation date,
authorized shares, par value, cash on hand, common-share FMV), registered in
[`processes/company-fields.json`](processes/company-fields.json) so the same value feeds
every module and vendor integration that needs it; every record shape is published as a
JSON Schema in [`schemas/`](schemas/).

## Open artifacts

The documents and records that processes produce and consume (certificate of
incorporation, EIN letter, cap table), registered so every process declares what it makes
and what it needs.

[ultrametric.ai/artifacts](https://ultrametric.ai/artifacts) · [`processes/artifacts.json`](processes/artifacts.json)

![The artifacts view on ultrametric.ai: the documents and records founder processes produce and consume](docs/assets/readme/artifacts.png)

<!-- Legacy anchor: inbound links to #open-docs predate the fold under Open artifacts. -->
<a id="open-docs"></a>

### Open docs

The openly published startup legal documents, as dated links to their publishers, grouped
by what they are for; known gaps are recorded in the catalog.

| Category | Example documents | Gaps |
| --- | --- | --- |
| Formation | Cooley GO Delaware incorporation package, IRS Form SS-4 | — |
| Fundraising | YC post-money SAFEs, SAFE User Guide, pro rata side letter | — |
| Governance | Delaware incorporation toolkit (charter, bylaws, consents), cap table template | — |
| Hiring | Offer letters, CIIAA/PIIA, Balanced Employee IP Agreement | No openly published option plan or grant template exists |
| Commercial | Common Paper cloud service agreement, terms of service, SLA | — |
| Privacy | DPA, BAA, AI addendum (Common Paper and Bonterms) | — |
| Open-source | Apache ICLA/CCLA, Developer Certificate of Origin | — |

[`open-documents/`](open-documents/) · [ultrametric.ai/open-documents](https://ultrametric.ai/open-documents)

## Situations

Trigger-driven guides for reactive work (a breach is live, a summons lands, a tax notice
arrives), each with a named trigger and an urgency clock of hours, days, or weeks.

[ultrametric.ai/situations](https://ultrametric.ai/situations) · [`processes/SITUATIONS.md`](processes/SITUATIONS.md)

![The situations index on ultrametric.ai, reactive work sorted hottest clock first](docs/assets/readme/situations.png)

<a id="add-your-country-or-state"></a>

### Example: Founder country switch

Processes and vendor availability adapt to where you operate: the US is the baseline, with
country analogs and official filing links for the UK, India, Germany, France, Portugal,
and Canada, and adding your country is a schema-gated pull request.

[`jurisdictions/`](jurisdictions/) · [Add a jurisdiction](CONTRIBUTING.md#add-a-jurisdiction)

## Open lore

The heuristics founders trade and the episodes behind them, as sourced records: every rule
of thumb names its school and author, every episode carries a veracity grade, and
conflicts between schools are recorded on both entries.

[`lore/`](lore/) · [`resources/`](resources/)

### Example: Getting acquired

The acquisition episodes are recorded lore (WhatsApp, Twitch, MySpace in
`resources/LORE.md`, each with its lesson and veracity grade), the sale math is live (the
waterfall module computes who gets what at any price), and the acquisition playbook itself
is a mapped, open gap in `coverage/`.

[Sale waterfall](open-modules/README.md#liquidity-event-waterfall) · [`coverage/`](coverage/)

## Open law

Dated legal rule cards, one proposition each, every card citing a primary authority with
an exact locator; a provider blog cannot establish law.

[`rules/`](rules/) · [`sources/`](sources/)

## Open startup simulator

A simulated company runs the whole process library end to end, every step routed agent,
form, or human, and everything it generates visibly marked simulated.

[ultrametric.ai/startup-sim](https://ultrametric.ai/startup-sim)

![The Open Startup simulator mid-run: a simulated company executing the founder processes](docs/assets/readme/startup-sim.png)

## Open skills for startups

`ultrametric init` installs the bundled agent skill, so a coding agent can retrieve a
process, run the agent-routed steps, and save progress from inside your repo.

[docs.ultrametric.ai/cli/install](https://docs.ultrametric.ai/cli/install) · [Agent Skills ranking](https://ultrametric.ai/arena/agent-skills)

![The Agent Skills ranking on ultrametric.ai, skill collections and plugin catalogs judged head to head](docs/assets/readme/agent-skills.png)

<a id="for-ai-agents"></a>
<a id="use-it-from-an-agent"></a>

## Install Ultrametric

One npm package ships the CLI and MCP server; the data itself needs no install and no
keys.

```bash
npm install -g ultrametric@latest                   # CLI + MCP server + agent skill
curl https://ultrametric.ai/data/categories.json    # every ranking, raw JSON
curl https://ultrametric.ai/llms.txt                # the index for agents
```

[ultrametric.ai/get-started](https://ultrametric.ai/get-started) · [docs.ultrametric.ai](https://docs.ultrametric.ai)

## Methodology

Every score is computed from dated, cited evidence: unknown stays null, negative results
stay published, re-scores without new evidence are reverted, and the founders' own
products are disclosed and bias-audited.

[METHODOLOGY.md](./METHODOLOGY.md) · [ultrametric.ai/methodology](https://ultrametric.ai/methodology)

[![CI](https://github.com/ultrametricai/ultrametric/actions/workflows/ci.yml/badge.svg)](https://github.com/ultrametricai/ultrametric/actions/workflows/ci.yml)
<!-- stat-badges:start -->
[![rankings](https://img.shields.io/badge/rankings-96-34d399)](https://ultrametric.ai)
[![products](https://img.shields.io/badge/products-657-34d399)](https://ultrametric.ai/everything)
[![judged verdicts](https://img.shields.io/badge/judged_verdicts-37159-34d399)](https://ultrametric.ai/methodology)
<!-- stat-badges:end -->

<!-- stats:start -->
As of the last full pipeline run: **96 rankings, 657 products, 37,159 judged verdicts.**
<!-- stats:end -->

## Upcoming

Finer-grained rankings, recorded probe sessions published on product pages, runtime
conformance testing behind the agent-readiness scores, and continuous re-judging as
evidence lands.

[`data/arena-roadmap.json`](data/arena-roadmap.json) · [`docs/COVERAGE-STRATEGY.md`](docs/COVERAGE-STRATEGY.md)

## License

Code is Apache-2.0 ([LICENSE](./LICENSE)); the data is viewable and quotable with
attribution, and bulk reuse needs written permission ([DATA-LICENSE](./DATA-LICENSE)).
