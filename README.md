![Ultrametric](assets/banner.svg)

[![Discord](https://img.shields.io/badge/Discord-Join_the_community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/3aHky836qP)

**The open repo for the whole startup journey in the agentic era.**

Navigate all business processes, compare and select AI native vendors, inform yourself on startup lore, run open modules to become vendor free, save money using open documentation. Help future founders by making PRs to the open artifacts, gaps in open documents or improve the open module logic. Let's make it easy to start and run a startup around the world.

<pre>
ultrametric/
├── <a href="#open-processes">open-processes</a>/     each founder process as routed, timed steps
├── <a href="#open-vendor-rankings">open-rankings</a>/      per-market products, stories, evidence, verdicts
├── <a href="#open-modules">open-modules</a>/       worked guides to each startup calculation
├── <a href="#open-startup-simulator">open-startup-sim</a>/   what the simulator runs and assumes
├── <a href="#open-law">open-law</a>/           startup legal rules by jurisdiction
├── <a href="#open-lore">open-lore</a>/          founder advice, who said it, the reading library
├── <a href="#open-docs">open-documents</a>/     openly published legal documents, by use case
├── rankings-engine/    the code that crawls, probes, judges, scores
├── lib/                loaders, scoring, and the calculation code
├── jurisdictions/      country and state data, vendor availability
├── coverage/           what is mapped and what is a known gap
├── schemas/            the JSON shape each data file validates against
└── policies/           how records are reviewed and what agents may do here
</pre>

<!-- Legacy anchor: external links to #start-here predate the merge into this map. -->
<a id="start-here"></a>

Supporting founders globally: 🌐 🇺🇸 🇬🇧 🇮🇳 🇩🇪 🇫🇷 🇵🇹 🇨🇦

[![A tour of ultrametric.ai at 4x: the simulator founding a company, a process page, a vendor page, a situation, the overall rankings, government services, and open documents](assets/readme/demo.gif)](https://ultrametric.ai)

<a id="vendors"></a>

## Open vendor rankings

The tools startups run on, examined through an agentic lens: can an agent actually drive
each one, is it testable, and do the vendor's claims match what we found hands-on. The
rankings order products by how automatable they are, and any verdict can be contested.

<!-- arenas:start -->
**96 rankings** today, 672 products judged head to head — the full index is [ultrametric.ai/arenas](https://ultrametric.ai/arenas), and each ranking's data lives under [`open-rankings/`](open-rankings/).
<!-- arenas:end -->

[![The overall rankings on ultrametric.ai: companies ranked by agent readiness, scored on agent access and built-in AI](assets/readme/rankings-overall.png)](https://ultrametric.ai/overall)

[Add your vendor](CONTRIBUTING.md#add-your-vendor)

<a id="processes"></a>

## Open processes

The founder [processes](open-processes/), step by step. Each step is routed agent, form, or
human, timed, and marked by how hard it is to undo. The vendors that can run a step are
listed on it, with their judged scores. See it live at
[ultrametric.ai/processes](https://ultrametric.ai/processes).

[![The founder processes on ultrametric.ai, ranked on the founder timeline, with area and agentic share](assets/readme/processes-index.png)](https://ultrametric.ai/processes)

### Examples

- [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp) — set up a Delaware C-corp, filing to signed 83(b)
- [Get a 409A valuation](https://ultrametric.ai/processes/get-a-409a-valuation) — establish the fair market value for stock options
- [Set up mailing address](https://ultrametric.ai/processes/set-up-mailing-address) — a business mailing address for legal and banking purposes

[![The Incorporate C-Corp process: the step diagram, each step routed agent, form, or human, with ranked vendor options per step](assets/readme/process-page.png)](https://ultrametric.ai/processes/incorporate-c-corp)

[Add a process](CONTRIBUTING.md#add-a-process)

<!-- Legacy anchor: external links to #business-logic predate the open-modules/ rename. -->
<a id="business-logic"></a>

## Open modules

The standard startup calculations, ready to run: cap table math, SAFE conversion,
dilution, sale waterfalls, runway, vesting, option tax, and filing deadlines. The code
lives in [`lib/openstartup/`](lib/openstartup/), and you can run and check it. Formulas
cite their sources and replay the published worked examples in tests.

| Module | What it computes |
| --- | --- |
| [Cap table](open-modules/README.md#cap-table) | Issuance, option pools, SAFE conversion, priced-round price per share, dilution |
| [Vesting](open-modules/README.md#vesting-mechanics) | Cliff and periodic schedules, back-loaded tranches, acceleration, departures |
| [83(b) election](open-modules/README.md#83b-election-math) | Tax at grant vs tax at vesting, forfeiture cost |
| [QSBS (§ 1202)](open-modules/README.md#qsbs--1202) | Eligibility conditions, holding clock, exclusion percentages, per-issuer cap |
| [Deadlines](open-modules/README.md#deadline-calendar) | The founder compliance calendar, each date citing a rule card |
| [Convertible notes](open-modules/README.md#convertible-notes) | Interest accrual, cap/discount conversion, maturity paths |
| [Sale waterfall](open-modules/README.md#liquidity-event-waterfall) | Per-holder proceeds at a sale price |
| [Anti-dilution](open-modules/README.md#anti-dilution) | Weighted-average and full-ratchet adjustments |
| [Priced round](open-modules/README.md#priced-round-mechanics) | Pro rata, pool sizing from a hiring plan, down rounds, secondaries |
| [Round composer](open-modules/README.md#priced-round-composer) | A priced round end to end, term sheet to post-close table |
| [409A](open-modules/README.md#409a-grant-sanity) | Strike floor, valuation staleness, presumption timing |
| [Equity comp](open-modules/README.md#offer--equity-comp-scenarios) | Offer grant percentage, option spread, exit scenarios |
| [Option tax](open-modules/README.md#iso--nso-exercise-tax) | NSO income at exercise, ISO/AMT outcomes, the $100,000 limit, sale outcomes |
| [Payroll tax](open-modules/README.md#employer-payroll-tax) | Employer FICA/FUTA load, per-employee annual cost |
| [Delaware franchise tax](open-modules/README.md#delaware-franchise-tax) | Both published methods, the cheaper-method comparison |
| [R&D tax](open-modules/README.md#rd-tax-mechanics) | § 174 amortization, § 41(h) payroll-offset mechanics |
| [Runway](open-modules/README.md#runway--burn) | Default-alive trajectories, hiring impact |
| [Unit economics](open-modules/README.md#unit-economics) | LTV/CAC, burn multiple, Rule of 40, magic number |
| [Deferred revenue](open-modules/README.md#deferred-revenue-subscriptions) | Subscription revenue recognition, plan-change proration |

[`open-modules/README.md`](open-modules/README.md) has each module's contract, worked
examples, and boundaries.

### Shared data fields

The modules and processes read one shared set of company fields: incorporation date,
authorized shares, par value, cash on hand, the common-share FMV. Each field is
registered in [`open-processes/company-fields.json`](open-processes/company-fields.json), so the
same value feeds the modules that need it. The data shapes are published as JSON
Schemas in [`schemas/`](schemas/).

[Add an open module](CONTRIBUTING.md#add-an-open-module)

## Open artifacts

The documents and files that processes produce and consume: the certificate of
incorporation, the EIN letter, the cap table. Each is registered in
[`open-processes/artifacts.json`](open-processes/artifacts.json), so the processes declare what
they make and what they need. See it live at
[ultrametric.ai/artifacts](https://ultrametric.ai/artifacts).

[![The artifacts view on ultrametric.ai: the documents and files founder processes produce and consume](assets/readme/artifacts.png)](https://ultrametric.ai/artifacts)

<!-- Legacy anchor: inbound links to #open-docs predate the fold under Open artifacts. -->
<a id="open-docs"></a>

### Open docs

The openly published startup legal [documents](open-documents/), grouped by what they
are for. Each entry links the publisher's live page and carries the date it was last
checked. Known gaps are recorded too. See it live at
[ultrametric.ai/open-documents](https://ultrametric.ai/open-documents).

| Category | Example documents |
| --- | --- |
| Formation | [Cooley GO Delaware incorporation package](https://www.cooleygo.com/documents/incorporation-package-delaware/), [IRS Form SS-4](https://www.irs.gov/pub/irs-pdf/fss4.pdf) |
| Fundraising | [YC post-money SAFEs, User Guide, and pro rata side letter](https://www.ycombinator.com/documents) |
| Governance | [Orrick Delaware incorporation toolkit](https://www.orrick.com/en/tech-studio/forms/Incorporation-Toolkit), [cap table template](https://www.orrick.com/en/tech-studio/forms/Capitalization-Table) |
| Hiring | [Offer letter](https://www.cooleygo.com/documents/form-employee-offer-letter/), [CIIAA/PIIA](https://www.cooleygo.com/documents/form-employee-confidential-information-inventions-assignment-agreement/), [Balanced Employee IP Agreement](https://github.com/github/balanced-employee-ip-agreement) |
| Commercial | [Cloud service agreement](https://commonpaper.com/standards/cloud-service-agreement/), [terms of service](https://commonpaper.com/standards/terms-of-service/), [SLA](https://commonpaper.com/standards/service-level-agreement/) |
| Privacy | [DPA](https://commonpaper.com/standards/data-processing-agreement/), [BAA](https://commonpaper.com/standards/business-associate-agreement/), [AI addendum](https://commonpaper.com/standards/ai-addendum/) |
| Open-source | [Apache ICLA](https://www.apache.org/licenses/icla.pdf), [Developer Certificate of Origin](https://developercertificate.org/) |

<!-- Legacy anchor: inbound links to #situations predate the open- family rename. -->
<a id="situations"></a>

## Open situations

[Guides](open-processes/SITUATIONS.md) for reactive work: a breach is live, a summons lands,
a tax notice arrives. Each names its trigger and an urgency clock of hours, days, or
weeks. See it live at [ultrametric.ai/situations](https://ultrametric.ai/situations).

[![The situations index on ultrametric.ai, reactive work sorted hottest clock first](assets/readme/situations.png)](https://ultrametric.ai/situations)

<a id="add-your-country-or-state"></a>

### Example: Founder country switch

Processes and vendor availability adapt to where you operate. The US is the baseline;
the UK, India, Germany, France, Portugal, and Canada have country analogs with official
filing links. Adding your country is a pull request that the data checks validate
automatically.

- [Get EIN](https://ultrametric.ai/processes/get-ein) — in the UK, France, Portugal, and Canada the tax ID arrives automatically with incorporation; in Germany it is its own filing with the tax office
- [Set up an LLC](https://ultrametric.ai/processes/set-up-an-llc) — the analog shifts by country (LLP in the UK and India, UG in Germany, SARL in France) and Canada has no LLC at all

## Open lore

The [advice](open-lore/) founders actually pass around, and the [stories](open-lore/LORE.md) behind
it: who said it, where it is written down, and how well documented it is. When the
schools disagree, both sides are recorded. The [library](open-lore/library.json) collects the
best essays, guides, books, and talks, organized from deciding to start through getting
acquired.

| Section | What it teaches | Example entry |
| --- | --- | --- |
| Deciding to start | Whether to start a startup at all: the case for building, the cost of the bargain, and the mindset that survives it. | [How to Make Wealth](https://paulgraham.com/wealth.html) — Paul Graham |
| Ideas and markets | Finding an idea worth working on, judging the market it lives in, and choosing the scale of ambition. | [How to Get Startup Ideas](https://paulgraham.com/startupideas.html) — Paul Graham |
| Starting up | The first months of a company: the condensed playbooks, the accelerator application, and the mistakes that kill early startups. | [How to Start a Startup](https://paulgraham.com/start.html) — Paul Graham |
| Co-founders and founding decisions | Picking co-founders, splitting equity, naming, and the setup decisions made once: incorporation, banking, cap table, visas, and where to build. The readings are US-centric. | [How to pick a co-founder](https://venturehacks.com/pick-cofounder) — Naval Ravikant |
| Finding product-market fit | Talking to users, shipping a minimum product, and measuring whether the market pulls. | [The Only Thing That Matters](https://pmarchive.com/guide_to_startups_part4.html) — Marc Andreessen |
| Building the product | Scoping the MVP, product design and UX, and the engineers who ship it. | [Getting Real](https://basecamp.com/gettingreal) — Jason Fried, David Heinemeier Hansson, and Matt Linderman |
| Fundraising | Raising seed and priced rounds: instruments, term sheets, pitching, investor emails, and runway math. The instruments and norms described are US-centric. | [How to Raise Money](https://paulgraham.com/fr.html) — Paul Graham |
| Hiring and culture | Recruiting, interviewing, compensation, and the cultures teams are built on. | [How to Hire](https://blog.samaltman.com/how-to-hire) — Sam Altman |
| Operating | Running the company: management systems, founder time, prioritization, and pace. | [High Output Management](https://www.penguinrandomhouse.com/books/72467/high-output-management-by-andrew-s-grove-former-chairman-and-ceo-of-intel/) — Andrew S. Grove |
| Growth and distribution | First users, growth loops, channel decay, and when to scale spend and headcount. | [Startup = Growth](https://paulgraham.com/growth.html) — Paul Graham |
| Pricing and sales | Setting and raising prices, founder-led selling, and building the first sales team. | [Why Your Customers Would Be Happier If You Charged More](https://www.kalzumeus.com/2012/09/21/ramit-sethi-and-patrick-mckenzie-on-why-your-customers-would-be-happier-if-you-charged-more/) — Patrick McKenzie with Ramit Sethi |
| Exits and acquisitions | Deciding whether to sell, running an acquisition process, and life after the deal. | [Notes on the Acquisition Process](https://cdixon.org/2012/09/10/notes-on-the-acquisition-process/) — Chris Dixon |

### Example: Getting acquired

The acquisition stories are written down: WhatsApp, Twitch, and MySpace are in
`open-lore/LORE.md`, each with its lesson and sources. The sale math is live; the
waterfall module computes who gets what at any price. The acquisition playbook itself is
a known, open gap.

## Open law

Map the [law](open-law/) that applies to startups, across jurisdictions, and connect it to
the calculations and the vendors that act on it. Each legal statement is one dated rule card
citing a primary [authority](open-law/citations/) (a statute, regulation, or agency page) with the
exact section. A blog post cannot establish law. The [domain map](open-law/README.md#the-map)
grades each area of US startup law as mapped, partial, or unmapped.

## Government services and startups

Government [agencies](open-rankings/government-services/) are judged like vendors: the IRS,
Companies House, HMRC, the Handelsregister. Per-country boards compare how well each
agency works for a founder or an agent. See it live at
[ultrametric.ai/arena/government-services](https://ultrametric.ai/arena/government-services).

[![The government services country board on ultrametric.ai: countries compared through their judged agencies, company registry to immigration](assets/readme/government-services.png)](https://ultrametric.ai/arena/government-services)

## Startup ecosystem

The service providers around a startup (law firms, immigration counsel, accountants,
banks) are ranked in their own markets and wired to the process steps they serve. See the
law firms live at
[ultrametric.ai/rankings/law-firms](https://ultrametric.ai/rankings/law-firms).

[![The startup law firms ranking on ultrametric.ai: firms scored on venture financing, formation, IP protection, and startup programs, with country availability](assets/readme/law-firms.png)](https://ultrametric.ai/rankings/law-firms)

## Open startup simulator

A simulated company runs the whole process library end to end, and everything it
generates is visibly marked simulated.

[![The Open Startup simulator mid-run: a simulated company executing the founder processes](assets/readme/startup-sim.png)](https://ultrametric.ai/startup-sim)

<a id="for-ai-agents"></a>
<a id="use-it-from-an-agent"></a>

## Install Ultrametric

One npm package ships the CLI and MCP server; the data itself needs no install and no
keys.

```bash
npm install -g ultrametric@latest                   # CLI + MCP server + agent skill
curl https://ultrametric.ai/data/categories.json    # all rankings, raw JSON
curl https://ultrametric.ai/llms.txt                # the index for agents
```

[ultrametric.ai/get-started](https://ultrametric.ai/get-started) · [docs.ultrametric.ai](https://docs.ultrametric.ai)

## Methodology

Scores are computed from dated, cited evidence. An unknown is shown as unknown, not
zero. Negative results stay published, a score cannot move without new evidence, and the
founders' own products are disclosed and checked for bias. The full method is in
[METHODOLOGY.md](./METHODOLOGY.md); see it live at
[ultrametric.ai/methodology](https://ultrametric.ai/methodology).

## License

Code is Apache-2.0 ([LICENSE](./LICENSE)); the data is viewable and quotable with
attribution, and bulk reuse needs written permission ([DATA-LICENSE](./DATA-LICENSE)).
