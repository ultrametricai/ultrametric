![Ultrametric — the open startup repo](docs/assets/banner.svg)

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

## Map of the repo

The single structural overview: each functional area, what it is, and where it lives, in the
order a reader needs them. The **knowledge layer** is the product: plain JSON and markdown,
schema-validated in CI, usable without running any code.

**Processes** — the founder work, step by step. On the site:
[/processes](https://ultrametric.ai/processes) (every founder process with its Agentic %,
plus the chained playbooks), [/situations](https://ultrametric.ai/situations) (reactive,
trigger-driven work, hottest clock first), and
[/artifacts](https://ultrametric.ai/artifacts) (the documents and records the processes
produce and consume).

| Path | What lives there | Contract / gate |
| --- | --- | --- |
| [`processes/`](processes/) | `corpus.json` (the operational processes and the reactive situations: DAGs, routing, geo scope, time estimates; situations doctrine in [`SITUATIONS.md`](processes/SITUATIONS.md)), the per-step vendor registry, the artifact registry ([`artifacts.json`](processes/artifacts.json)), the company data fields the open modules consume ([`company-fields.json`](processes/company-fields.json)), and jurisdiction-scoped legal workflows (`equity/us-de/…`) | [`schemas/operational-process.schema.json`](schemas/) · [`schemas/process.schema.json`](schemas/) |
| [`journeys/`](journeys/) | `chains.json` — multi-process founder paths | corpus schema + loader tests |

**Vendors** — the judged tool rankings behind every process step. On the site:
[/overall](https://ultrametric.ai/overall), the per-arena leaderboards at
[/arenas](https://ultrametric.ai/arenas), head-to-heads at
[/compare](https://ultrametric.ai/compare), proven toolchains at
[/stacks](https://ultrametric.ai/stacks), and
[government services](https://ultrametric.ai/arena/government-services) with per-country
agency boards.

| Path | What lives there | Contract / gate |
| --- | --- | --- |
| `data/` | The arena evidence layer: per-arena products, stories, verdicts, evidence packs, fingerprinted rankings | `recompute-check` (bit-identical determinism) |
| [`vendors/`](vendors/) | The evidence doctrine + `reviews/generated/` — one interchange record per judged product | `schemas/vendor-review.schema.json`, deterministic regeneration |
| `pipeline/` | crawl → extract → probe → judge → derive; all scores computed from verdicts | churn policy, judge caches, recompute gate |

**Open modules** — the rules and calculations a startup runs on. On the site:
[/open-documents](https://ultrametric.ai/open-documents), and the geo views: the geo switcher
on process/product pages and the per-country process views (US · UK · IN · DE · FR · PT · CA).

| Path | What lives there | Contract / gate |
| --- | --- | --- |
| [`rules/`](rules/) | Dated, source-locked legal rule cards with stable IDs, one dir per jurisdiction (`US-FED/`, `US-DE/`) | `schemas/rule.schema.json` + validator |
| [`sources/`](sources/) | Primary authorities: publisher, exact provision locator, issued/checked dates | `schemas/source.schema.json` |
| [`open-modules/`](open-modules/) | The open-modules index: the cap-table, runway, deadline, equity, and tax math as source-cited code in [`lib/openstartup/`](lib/openstartup/), the contribution bar, each module's Honesty boundaries | worked-example + property tests |
| [`jurisdictions/`](jurisdictions/) | Jurisdiction registry + `vendor-geo.json` (dated per-country vendor availability, source-cited; feeds the geo views above) | exact-dimension matching; unknown maps to `unsupported` |
| [`open-documents/`](open-documents/) | The canonical startup legal documents as dated, link-only records | `lib/documents.ts` + registry/README sync test |
| [`resources/`](resources/) | The canonical startup resources + `LAWS.md` (cited distilled principles) + `LORE.md` (veracity-graded startup history) | `lib/resources.ts` / `lib/lore.ts` + invariant tests |
| [`lore/`](lore/) | The startup-lore registry ([`registry.json`](lore/registry.json)): schooled heuristics as sourced claims, with the cross-school tensions mapped on both sides | `__tests__/lore-registry.test.ts` schema + referential invariants |

**Contracts & infrastructure** — the layer everything above validates against, plus the site
that renders it. Three directories confuse newcomers, so to be explicit: **`schemas/`** holds the JSON
contracts every record validates against; **`coverage/`** is the coverage map
(`domains.json` = what the corpus intends to cover, `coverage.json` = what it covers
today, at what maturity); **`rules/`** is cited law the open-modules layer consumes; its
rows are in the Open modules group above.

| Path | What lives there | Contract / gate |
| --- | --- | --- |
| [`schemas/`](schemas/) | JSON Schema contracts for processes, rules, sources, vendor reviews | drift-gated against the zod source |
| [`coverage/`](coverage/) | Domain taxonomy, lifecycle map, machine-readable coverage with its maturity stated | `lib/founderOps.ts` coverage checks |
| [`templates/`](templates/) | Blank, schema-valid starting points for contributions | — |
| [`fixtures/`](fixtures/) | Wholly fictional companies/events that exercise the planner | `synthetic: true` enforced |
| [`governance/`](governance/) | Review policy + maturity ladder, evidence doctrine, agent policy, security | — |
| `infra/` | Cloudflare edge worker (routing, auth, live MCP probes) | worker tests |
| `docs/` | Architecture ([FOUNDER-OPS.md](docs/FOUNDER-OPS.md)), scoring companions, program docs | — |
| `reports/` | Committed weekly arena reports (markdown, rendered at `/reports`) | generated by the pipeline |
| `scripts/` | Repo utilities: stats, badges, data mirroring, schema generation | — |
| `app/`, `components/`, `lib/` | The Next.js static site over the corpus, including the simulator at [/startup-sim](https://ultrametric.ai/startup-sim) | typecheck, lint, vitest |
| `public/`, `__tests__/` | Static assets (committed badges, logos) and the repo-level test suites | — |

**Agent access** — the `ultrametric` npm package ships the CLI and MCP server;
[/get-started](https://ultrametric.ai/get-started) is the install page. The data itself
needs no install and no auth:

```bash
curl https://ultrametric.ai/data/categories.json           # every arena
curl https://ultrametric.ai/data/ai-coding/rankings.json   # any arena, machine-readable
curl https://ultrametric.ai/arena/ai-coding/llms.md        # same arena, markdown for agents
curl https://ultrametric.ai/llms.txt                       # the index for agents
```

Every shape is published as a JSON Schema in [`schemas/`](schemas/), the endpoints are
described by [/openapi.json](https://ultrametric.ai/openapi.json), and the ground rules are in
[governance/AGENT_POLICY.md](governance/AGENT_POLICY.md). More surfaces (the docs site, process
manifests, the search index, the RSS feed) in [Use it from an agent](#use-it-from-an-agent) below.

Record semantics that bind everything (from [docs/FOUNDER-OPS.md](docs/FOUNDER-OPS.md)):
stable IDs with versioned edits; every legal statement resolves to a primary source with an
exact locator; `reviewed_on`/`review_due` are editorial dates, not legal effective dates;
every externally-effectful workflow step requires a named, scoped human approval; the planner
answers `unsupported` rather than guessing; and no jurisdiction is called covered because a
few playbooks exist ([maturity ladder](governance/REVIEW_POLICY.md)).

## Processes

![The founder processes on ultrametric.ai — each process with its phase, Agentic %, step count, timeline position, and vendors](docs/assets/processes.png)

*[ultrametric.ai/processes](https://ultrametric.ai/processes): the comprehensive founder processes from an agentic lens.*

The operational corpus: step-by-step founder processes, each a DAG whose
every step is routed agent / manual form / human, with per-step reversibility
(reversible / painful / irreversible), vendor options drawn from the judged rankings, time
estimates, and, where routes differ, named method variants (e.g. the per-country
filing routes). Every process carries an **Agentic %**, the share of steps an agent can
run today (`full` / `partial` / `manual_guide`), with per-country geo notes (UK, India,
Germany, France; the US is the baseline). Playbooks chain processes into founder paths
(incorporate → launch, the VC raise, the agent-run back office).

One slice of [Incorporate C-Corp](https://ultrametric.ai/processes/incorporate-c-corp)
(record `form_001` in [`processes/corpus.json`](processes/corpus.json)): the opening step
"Choose formation service" carries the ranked vendor options, and the later step "Receive
Certificate of Incorporation" produces the `certificate-of-incorporation` artifact that the
EIN, banking, and state-registration processes consume
([`processes/artifacts.json`](processes/artifacts.json)):

```json
{ "id": "n1", "label": "Choose formation service", "route": "person",
  "vendorOptions": ["clerky", "stripe_atlas", "firstbase", "legalzoom", "northwest", "doola"] }
{ "id": "n5", "label": "Receive Certificate of Incorporation", "route": "person",
  "producesArtifact": "certificate-of-incorporation" }
```

The corpus also carries **situations**, the reactive layer: trigger-driven records for the
work nobody schedules (a breach is live, a summons lands, a tax notice arrives). Each
situation names its **trigger** (the event, not the task) and an **urgency** tier
(`hours` / `days` / `weeks`), holds no slot on the founder timeline, and routes only the
mechanical core to agents; the counsel/CPA judgment calls and signature acts stay human.
The index is [/situations](https://ultrametric.ai/situations), sorted hottest clock first,
and the doctrine is [`processes/SITUATIONS.md`](processes/SITUATIONS.md).

One situation end to end:
[Respond to a cease-and-desist](https://ultrametric.ai/processes/respond-to-a-cease-and-desist)
(record `sit_001` in [`processes/corpus.json`](processes/corpus.json)) names its trigger and
clock, and routes the response to counsel:

```json
{ "trigger": "A cease-and-desist letter claiming trademark or IP infringement arrives by mail or email.",
  "urgency": "days" }
{ "id": "n4", "label": "Choose counsel for the response (IP/trademark litigation)",
  "route": "person", "optionsArenaId": "startup-law-firms" }
```

The data lives in [`processes/`](processes/) (`corpus.json` + the jurisdiction-scoped legal
workflows), [`journeys/`](journeys/) (`chains.json`), and
[`processes/vendor-registry.json`](processes/) (every vendor fact the process pages render).
On the site: [/processes](https://ultrametric.ai/processes) (each process at `/processes/<id>`),
and [The Open Startup](https://ultrametric.ai/startup-sim), a simulator that replays the
whole corpus as a simulated company, end to end:

![The Open Startup simulator mid-run — a simulated company executing the process corpus, each step routed agent / manual form / human](docs/assets/virtual-startup.png)

To contribute: add a `geoNotes` country analog, a new process from
[`templates/`](templates/), or a chain. All are schema-gated by `pnpm test`. Start at
[`processes/README.md`](processes/README.md) and [`journeys/README.md`](journeys/README.md).

## Vendors

The evidence layer: head-to-head, agent-tested rankings of the tools
startups run on, arena by arena (current counts under
[Data releases & freshness](#data-releases--freshness)). Every verdict cites dated evidence (vendor docs, GitHub,
community sources, hands-on probes), rankings recompute bit-identically and carry HMAC
`_provenance`, honest negatives count as much as positives, and owner-affiliated products are
disclosed and adversarially bias-audited
([evidence doctrine](governance/REVIEW_POLICY.md) · [METHODOLOGY.md](./METHODOLOGY.md)).

One judged cell: in [Online Payments](https://ultrametric.ai/arena/payments), Stripe's verdict
on the story "As a founder, I can accept an online card payment within a day of signing up"
([`data/payments/stories.json`](data/payments/stories.json)) is `full`, and its rationale leans
on a hands-on community report, "up and running and accepting recurring payments in less than
an hour" (evidence `stripe-comm-9` in
[`data/payments/evidence/stripe.json`](data/payments/evidence/stripe.json)). The cell renders on
[the Stripe product page](https://ultrametric.ai/arena/payments/product/stripe) from
[`data/payments/verdicts.json`](data/payments/verdicts.json):

```json
{ "productId": "stripe", "storyId": "accept-card-payment-online",
  "verdict": "full", "quality": 8, "confidence": "medium" }
```

The data lives in [`data/`](data/) (per-arena products, stories, evidence, verdicts,
rankings), [`vendors/`](vendors/) (the doctrine + `reviews/generated/`, one dated interchange
record per judged product), and
[`processes/vendor-registry.json`](processes/) (the bridge that links process steps to judged
arenas). On the site: [/overall](https://ultrametric.ai/overall) and every arena at
`/arena/<id>` (index at [/arenas](https://ultrametric.ai/arenas)).

To contribute: contest a verdict, add evidence, prove a story, or submit a product (see
[Contributing](#contributing--how-the-community-can-help)). Start at
[`vendors/README.md`](vendors/README.md).

<!-- Legacy anchor: external links to #business-logic predate the open-modules/ rename. -->
<a id="business-logic"></a>

## Open modules

The open modules and the rule cards beneath them: the rules and calculations
a startup runs on, as open, source-cited, exhaustively tested records and code:

- **Rule cards** — [`rules/`](rules/): dated legal propositions (US federal and Delaware to
  start), one stable ID each, every `kind: legal` card citing a primary authority in
  [`sources/`](sources/) with an exact provision locator. Status is `demonstration`, the
  current maturity level, stated on each card.
- **Open modules** — [`lib/openstartup/`](lib/openstartup/), indexed in
  [`open-modules/README.md`](open-modules/README.md) — pure, deterministic functions, each
  tested against published worked examples:
  - [`capTable.ts`](open-modules/README.md#cap-table) (+ `capTableCodec.ts`) — founder issuance and vesting, option pools and the
    in-round pool shuffle, post-money SAFE conversion per the YC Post-Money Safe User Guide
    (Appendix II examples reproduced number-for-number), priced-round PPS solving, dilution
    waterfalls. The module is repo-only.
  - [`runway.ts`](open-modules/README.md#runway--burn) — Paul Graham's default-alive test as code (constant expenses, compounding
    revenue, month-by-month trajectory), plus growth-adjusted runway and hiring impact.
  - [`deadlines.ts`](open-modules/README.md#deadline-calendar) — the founder compliance clock (DE franchise tax, Form 1120, Form 941,
    the 83(b) 30-day window); every deadline cites a dated rule card by ID and flags
    `needsReview` whenever the true legal date can differ.
  - [`equityComp.ts`](open-modules/README.md#offer--equity-comp-scenarios) — offer and equity-comp scenarios (grant % of fully diluted, option
    spread, exit outcomes under future dilution), cited to the Holloway Guide and Index
    Ventures' Rewarding Talent; it takes the 409A FMV as input rather than inventing one.
    All outputs are pre-tax.
  - [`convertibleNote.ts`](open-modules/README.md#convertible-notes) — convertible promissory notes: simple-interest accrual, best-of
    cap/discount conversion (the cap denominator comes from the note's own capitalization
    definition, not a guessed convention), maturity surfaced rather than decided, the three
    Cooley GO series-pricing methods, and the note-vs-SAFE differences stated plainly.
  - [`waterfall.ts`](open-modules/README.md#liquidity-event-waterfall) — liquidity-event waterfalls: the SAFE cash-out-vs-convert choice per
    the YC User Guide, one preferred series (non-participating vs participating), a pari
    passu preference tier, proceeds that sum to the sale price exactly, and the
    conversion-indifference point.
  - [`grant409aSanity.ts`](open-modules/README.md#409a-grant-sanity) — 409A grant sanity checks (strike floor, FMV staleness,
    appraisal-presumption timing), every check citing a dated rule card; a sanity model
    that takes the FMV as input and does not itself value a company. It now includes the three §409A
    valuation presumptions as structured cited data, method-eligibility checks over
    explicit inputs, a refresh-trigger checklist, and the penalty mechanics as a labeled
    arithmetic illustration.
  - [`vesting.ts`](open-modules/README.md#vesting-mechanics) — vesting schedules and mechanics with real date math: cliff + periodic
    schedules per the Cooley GO convention, back-loaded tranches (Amazon's published
    5/15/40/40), departure and unvested-repurchase summaries, single- and double-trigger
    acceleration outcomes, refresh grants as additive composition, the FAST advisor grid,
    and an early-exercise interface that hands the 83(b) and tax questions to the modules
    that own them.
  - [`antiDilution.ts`](open-modules/README.md#anti-dilution) — round-protection mechanics: the NVCA model weighted-average
    formula (broad- and narrow-based, the denominator difference stated), full ratchet,
    conversion-price-to-ratio mechanics, pay-to-play as explanation, and a stated interface
    into the waterfall module; published worked examples are replayed number-for-number.
  - [`round.ts`](open-modules/README.md#priced-round-mechanics) — priced-round mechanics on top of the cap table: pro rata math (maintaining
    ownership is buying your pro rata, shown by algebra), option-pool sizing bottom-up from
    a hiring plan, down-round modeling that composes the anti-dilution adjustments, and
    founder secondaries (which dilute no one; the shares change hands, none are issued).
  - [`optionTax.ts`](open-modules/README.md#iso--nso-exercise-tax) — ISO vs NSO exercise mechanics: NSO spread-at-exercise income and the
    published supplemental-withholding rates, ISO no-regular-tax-at-exercise with the AMT
    adjustment, the $100,000 ISO limit replaying the regulation's own examples,
    qualifying/disqualifying disposition math with the loss cap, and a clearly-labeled AMT
    exposure illustration with asOf-dated parameters.
  - [`election83b.ts`](open-modules/README.md#83b-election-math) — the 83(b) money math (the deadline clock stays in `deadlines.ts`):
    tax-at-grant vs tax-at-vesting scenarios from explicit inputs, the zero-spread founder
    case, forfeiture outcomes with the cited no-refund risk, and the early-exercise
    interplay; all six of the IRS revenue procedure's examples are replayed.
  - [`qsbs.ts`](open-modules/README.md#qsbs--1202) — § 1202 mechanics: eligibility as cited conditions (needs review wherever
    facts decide), the holding clock with the 83(b)/vesting interplay, exclusion
    percentages by acquisition date across both statutory regimes, the per-issuer cap
    (greater of the dollar cap or 10× basis), and the § 1045 rollover explained and cited
    but not computed.
  - [`deFranchiseTax.ts`](open-modules/README.md#delaware-franchise-tax) — both published Delaware franchise-tax methods computed exactly
    (the Division of Corporations' worked examples replayed number-for-number), the
    which-method-is-cheaper comparator for the annual March recalculation, and the Large
    Corporate Filer amount surfaced.
  - [`rdCredit.ts`](open-modules/README.md#rd-tax-mechanics) — R&D tax mechanics at a stated, narrow scope: § 174/§ 174A
    capitalization/amortization arithmetic with the midpoint convention, and the § 41
    payroll-tax-offset election mechanics (eligibility conditions, the cap, quarterly
    application); computation is over explicit inputs and eligibility always needs review.
  - [`payrollTax.ts`](open-modules/README.md#employer-payroll-tax) — employer-side federal payroll mechanics: FICA with the asOf-dated
    wage base, Additional Medicare labeled employee-only, FUTA with the bounded state
    credit, and per-employee annual cost with a stated state-tax out-of-scope boundary.
  - [`roundComposer.ts`](open-modules/README.md#priced-round-composer) — a priced round replayed end to end (term-sheet economics →
    conversions and pro rata → the post-close table), composing the cap-table, round,
    anti-dilution, and waterfall modules with zero parallel arithmetic.
  - [`unitEconomics.ts`](open-modules/README.md#unit-economics) — LTV/CAC and payback, the burn multiple, Rule of 40, and the magic
    number, each cited to its canonical formulation; benchmarks are inputs, not encoded
    constants.
  - [`deferredRevenue.ts`](open-modules/README.md#deferred-revenue-subscriptions) — subscription revenue recognition and plan-change proration,
    cents-exact, replaying the published worked examples.
- **Open documents** — [`open-documents/`](open-documents/): the canonical, openly licensed startup legal
  documents (SAFEs, board consents, offer letters, …) as dated records that link rather than
  redistribute; every URL is verified on its `checked_on` date.
- **Resources** — [`resources/`](resources/): the canonical startup resources plus
  [`LAWS.md`](resources/LAWS.md), the recurring principles distilled from them, every law
  citing its sources, and [`LORE.md`](resources/LORE.md), notable episodes of startup
  history as sourced records, every episode graded for veracity (first-person / documented /
  reported / legend).

An open module may propose a result; it does not silently authorize a filing, grant, or
transfer, and anything leaning on a legal threshold references a dated rule card and returns
`needs_review` when the locale or date is unknown. Educational, not legal advice.

The data lives in [`rules/`](rules/), [`sources/`](sources/), [`lib/openstartup/`](lib/openstartup/),
[`open-documents/`](open-documents/), [`resources/`](resources/), and [`jurisdictions/`](jurisdictions/).
The modules are repo-first: pure libraries usable from tests, scripts, or your own agent, and
the processes and site consume the same rule cards and jurisdiction data.

To contribute, start at [`open-modules/README.md`](open-modules/README.md): the module
index, the contribution bar, and each module's Honesty boundaries.

## How it works

The startup processes are the center of the repo; everything else feeds them:

- **Vendor rankings feed the steps.** The pipeline (`pipeline/`) crawls vendor docs, GitHub,
  and community sources into dated evidence (`data/<arena>/evidence/`), an LLM judge turns
  each (product, story) pair into a cited verdict (`verdicts.json`), and `derive` computes
  the rankings (`rankings.json`). Scores are computed, never hand-set, and `recompute-check`
  proves it bit-identically. `processes/vendor-registry.json` links each process step's
  vendor options to the arena that judges them, so every "use this tool for this step" is a
  ranked, cited claim.
- **Open modules compute what the steps need.** The `lib/openstartup/` modules (cap
  table, runway, deadlines, equity comp, notes, waterfalls, 409A sanity) are the calculations
  behind the processes, each formula cited.
- **The law anchors both.** Rule cards (`rules/`, backed by primary sources in `sources/`)
  drive the deadline math, the jurisdiction-scoped workflows, and the geo notes
  (`jurisdictions/`). A process step that leans on a legal threshold cites a dated card.

The processes themselves live in `processes/corpus.json` (playbooks in
`journeys/chains.json`), render at [/processes](https://ultrametric.ai/processes), and replay
end to end in [the simulator](https://ultrametric.ai/startup-sim). Everything is also served
raw: the `/data` JSON API and the agent endpoints (`/llms.txt`, per-arena `llms.md`).

## Rankings index — every market we rank

<!-- arenas:start -->
| Ranking | Products |
|---|---|
| Desktop OS (`desktop-os`) | macos, omarchy, ubuntu, fedora, windows |
| Startup Banking (`startup-banking`) | mercury, brex, ramp, wise, relay, jeeves, airwallex |
| Project Management (`project-management`) | linear, asana, clickup, notion, monday, jira, trello |
| Web Scraping APIs (`web-scraping`) | firecrawl, crawl4ai, jina-reader, apify, scrapingbee, browserbase, riveter, context-dev |
| Mobile AI Dev Tools (`mobile-dev`) | termius, tailscale, blink-shell, a-shell, working-copy, github-mobile |
| Code Hosting (`code-hosting`) | github, gitlab, bitbucket, gitea |
| AI Coding Agents (`ai-coding`) | codex, claude-code, cursor, github-copilot, gemini-cli, opencode, devin, aider, cline, cubic, antigravity, random-labs, conductor, byteask, grok-build |
| Edge & App Platforms (`edge-platforms`) | cloudflare, vercel, netlify, fly-io, railway, render |
| Frontend Frameworks (`frontend-frameworks`) | react, vue, svelte, angular, solid |
| Local LLM Runtimes (`local-llm-runtimes`) | ollama, llama-cpp, vllm, lm-studio, jan, localai, llamafile, runanywhere |
| Payroll & HR Ops (`payroll`) | gusto, rippling, deel, justworks |
| Product Feedback & Intent (`product-feedback`) | canny, featurebase, productboard, foreloop |
| Software Factory (`software-factory`) | foreloop, factory, devin, openhands, codegen, jules, omnara, yylo, humanlayer, superset |
| Mobile & In-Person Payments (`mobile-payments`) | stripe-terminal, square, sumup, adyen-pos, shopify-pos |
| API platforms (`api-platforms`) | postman, kong, bruno, hoppscotch, insomnia |
| Team Chat (`team-chat`) | slack, discord, ms-teams, zulip, buzz |
| Backend as a Service (`backend-as-a-service`) | supabase, firebase, convex, appwrite |
| Online Payments (`payments`) | stripe, adyen, paypal, square, autumn, checkout-com, mollie, airwallex, paddle, polar |
| Accounting & Bookkeeping (`accounting`) | quickbooks, xero, puzzle, pilot, freshbooks, zoho-books, wave, digits, kick, mercury-books, bench |
| Security Scanners (`security-scanners`) | trufflehog, semgrep, snyk, gitleaks, trivy, gecko-security |
| Infrastructure as Code (`infra-as-code`) | terraform, pulumi, opentofu, crossplane |
| Vibe-Coding App Builders (`vibe-coding`) | lovable, bolt, v0, replit, base44, floot |
| Model Gateways & Routers (`model-gateways`) | openrouter, litellm, portkey, vercel-ai-gateway, cloudflare-ai-gateway, requesty, kong-ai-gateway |
| LLM Evals & Observability (`llm-evals-observability`) | langfuse, langsmith, braintrust, arize-phoenix, wandb-weave, helicone, galileo, cekura |
| AI Search APIs (`ai-search-apis`) | exa, tavily, perplexity-sonar, brave-search-api, serpapi |
| Agent Frameworks & SDKs (`agent-frameworks`) | langgraph, openai-agents, claude-agent-sdk, crewai, pydantic-ai, mastra, google-adk, autogen, smolagents |
| Agent Sandboxes & Code Execution (`agent-sandboxes`) | e2b, daytona, modal, cloudflare-sandbox, vercel-sandbox, runloop, blaxel, maritime |
| Product Analytics (`product-analytics`) | posthog, amplitude, mixpanel, plausible |
| CRM (`crm`) | hubspot, attio, salesforce, twenty |
| Startup Legal & Incorporation (`legal-ops`) | stripe-atlas, clerky, docusign, firstbase, ironclad, beglaubigt, legalzoom |
| Robotics Software Platforms (`robotics-platforms`) | formant, gazebo, nvidia-isaac, ros2, viam |
| Terminals (`terminals`) | warp, ghostty, iterm2, alacritty, wezterm, kitty |
| AI Assistants (`ai-assistants`) | chatgpt, claude, gemini, perplexity, copilot, grok, muse, poke, martin, jo, dots, grok-bot, kimi, perplexity-computer, instinct |
| AI Research Agents (`ai-research-agents`) | elicit, consensus, futurehouse, undermind, sakana-marlin, notebooklm |
| Package & Toolchain Managers (`package-managers`) | homebrew, nix, pnpm, uv, bun, mise |
| Vector Databases & Memory Stores (`vector-databases`) | pinecone, weaviate, qdrant, chroma, milvus, helixdb, lancedb |
| Auth & Identity (`auth-platforms`) | auth0, clerk, workos, keycloak, better-auth |
| AI Inference Providers (`inference-providers`) | groq, together-ai, fireworks-ai, cerebras, deepinfra, baseten, morph |
| Workflow Automation (`workflow-automation`) | n8n, zapier, make, temporal, pipedream, windmill, afk, gumloop, lindy, activepieces, trigger-dev |
| Observability & Monitoring (`observability`) | datadog, grafana, sentry, new-relic, honeycomb, signoz |
| MCP Infrastructure & Registries (`mcp-infrastructure`) | composio, smithery, glama, pipedream-mcp, gram, manufact, metorial |
| Browser Automation for Agents (`browser-agents`) | browser-use, stagehand, skyvern, hyperbrowser, steel, notte, smooth |
| AI Memory Layers (`ai-memory`) | mem0, zep, letta, supermemory, cognee, airweave |
| Voice Agent Platforms (`voice-agents`) | vapi, retell, elevenlabs-agents, bland, livekit-agents, pipecat, bolna, telli, deepgram |
| Notes & Knowledge Bases (`notes-knowledge`) | obsidian, logseq, anytype, capacities, reflect, poly |
| Meeting AI & Notetakers (`meeting-ai`) | granola, fireflies, otter, fathom, fellow |
| GPU Clouds (`gpu-clouds`) | runpod, lambda-labs, coreweave, vast-ai, paperspace |
| Feature Flags & Experimentation (`feature-flags`) | launchdarkly, statsig, growthbook, flagsmith, unleash |
| Serverless & Developer Databases (`serverless-databases`) | neon, turso, planetscale, clickhouse, cockroachdb, supabase |
| Agent Skills & Extensions (`agent-skills`) | superpowers, anthropic-skills, mattpocock-skills, skills-cli, codex-plugins, gstack, ultrametric |
| Data Warehouses & Lakehouses (`data-warehouses`) | snowflake, databricks, bigquery, motherduck |
| Search Infrastructure (`search-infra`) | algolia, meilisearch, typesense, elastic, orama |
| Scheduling & Calendar (`scheduling`) | cal-com, calendly, motion, reclaim, savvycal |
| Design & Prototyping (`design-tools`) | figma, penpot, framer, sketch, canva, claude-design, spline, rive |
| Email Clients & Email AI (`email`) | superhuman, shortwave, missive, zero, fastmail, agentmail, gmail |
| Incident Management & On-call (`incident-management`) | pagerduty, incident-io, firehydrant, rootly, betterstack |
| Developer Docs Platforms (`docs-platforms`) | mintlify, gitbook, readme, docusaurus, fern |
| Data Pipelines & ELT (`data-pipelines`) | airbyte, fivetran, dagster, dlt, meltano |
| E-commerce Platforms (`ecommerce-platforms`) | shopify, medusa, woocommerce, bigcommerce, swell |
| Customer Data Platforms (`customer-data-platforms`) | segment, rudderstack, mparticle, jitsu, hightouch |
| Durable Execution Engines (`durable-workflows`) | temporal, inngest, trigger-dev, restate, hatchet, dbos |
| AI Customer Support Agents (`ai-support-agents`) | intercom-fin, decagon, sierra, pylon, lorikeet, parahelp |
| AI Code Review (`ai-code-review`) | coderabbit, greptile, graphite, qodo, cursor-bugbot, cubic |
| Document Extraction APIs (`document-extraction`) | reducto, llamaparse, extend, datalab, unstructured, mistral-document-ai |
| Cap Table & Equity (`equity-management`) | carta, pulley, cake-equity, fidelity-private-shares, ledgy, vestd |
| Error Tracking (`error-tracking`) | sentry, bugsnag, rollbar, honeybadger, glitchtip, raygun |
| Expense Management (`expense-management`) | ramp, brex, expensify, navan, bill-spend-expense |
| Billing & Subscriptions (`billing-subscriptions`) | stripe-billing, chargebee, recurly, lago, orb, metronome, revenuecat, stripe-invoicing |
| Payment Fraud Prevention (`fraud-prevention`) | stripe-radar, sift, signifyd, forter, riskified, adyen-risk |
| Agentic Commerce (`agentic-commerce`) | stripe-agentic-commerce, shopify-ucp, paypal-agent-commerce, coinbase-x402, crossmint, visa-intelligent-commerce, skyfire, adyen-agentic |
| Card Issuing Platforms (`card-issuing`) | stripe-issuing, lithic, marqeta, highnote, adyen-issuing |
| Sales Tax Automation (`tax-automation`) | stripe-tax, avalara, anrok, taxjar, numeral, kintsugi |
| Marketplace & Platform Payments (`marketplace-payments`) | stripe-connect, adyen-for-platforms, finix, mangopay, rainforest, tilled |
| Banking as a Service (`banking-as-a-service`) | stripe-treasury, unit, increase, column, synctera, treasury-prime |
| Processors (`processors`) | apple-m5, apple-m4-max, apple-m4-pro, qualcomm-snapdragon-x2-elite-extreme, amd-ryzen-ai-max-plus-395, amd-ryzen-9-9950x3d, intel-core-ultra-9-285k, intel-core-ultra-7-258v |
| GPUs & AI Accelerators (`gpus`) | nvidia-rtx-5090, nvidia-rtx-5080, nvidia-rtx-5070-ti, amd-rx-9070-xt, nvidia-rtx-pro-6000, nvidia-h200-sxm, nvidia-b200, amd-mi355x |
| Hardware Security Keys (`security-keys`) | yubikey, google-titan, nitrokey, solokeys, feitian, token2 |
| Authenticator Apps (`authenticator-apps`) | google-authenticator, microsoft-authenticator, authy, 1password, bitwarden, proton-pass, ente-auth, 2fas |
| Game Engines (`game-engines`) | unity, unreal, godot, threejs, babylonjs, bevy, playcanvas, phaser |
| Identity Verification & KYC (`identity-verification`) | stripe-identity, persona, entrust-onfido, sumsub, veriff, plaid-idv |
| Banking Data APIs (`banking-data-apis`) | stripe-financial-connections, plaid, mx, mastercard-open-finance, teller, truelayer, yapily |
| Stablecoin Payments (`stablecoin-payments`) | stripe-crypto, circle, bvnk, coinbase-payments, moonpay, paxos |
| Email Marketing (`email-marketing`) | loops, customer-io, klaviyo, mailchimp, kit, bento |
| Self-Hosted AI Assistants (`self-hosted-assistants`) | openclaw, open-webui, librechat, anythingllm, khoj, lobe-chat |
| Frontier Models (`frontier-models`) | jev, claude, gpt, gemini, llama, deepseek, mistral, grok |
| Compliance Automation (`compliance-automation`) | vanta, drata, secureframe, oneleet, sprinto, thoropass |
| Applicant Tracking (`applicant-tracking`) | greenhouse, lever, ashby, workable, recruitee |
| Domain Registrars (`domain-registrars`) | porkbun, name-com, cloudflare-registrar, godaddy, dynadot, namecheap |
| SSO & Workforce Identity (`sso-identity`) | okta, microsoft-entra, google-workspace, jumpcloud, rippling-it |
| Cloud Storage (`cloud-storage`) | dropbox, google-drive, box, onedrive |
| Cloud Platforms (`cloud-platforms`) | aws, google-cloud, azure, oracle-cloud |
| Transactional Email APIs (`email-apis`) | sendgrid, resend, postmark, mailgun, amazon-ses |
| Virtual Mailboxes (`virtual-mailboxes`) | stable, virtualpostmail, earth-class-mail, anytime-mailbox |
| Startup Law Firms (`startup-law-firms`) | cooley, gunderson-dettmer, fenwick, orrick, goodwin, latham-watkins, vlp-law-group, lowenstein-sandler, bird-bird, osborne-clarke, ypog, gide, cyril-amarchand, induslaw, trilegal |
| Startup Immigration (`startup-immigration`) | alma, lighthouse, founder-law, deel-immigration, plymouth-street, casium, legalos, siskind-susser, ellis-porter, daryanani-law, green-and-spiegel |
| Government Services (`government-services`) | irs, eftps, uscis, uspto, sam-gov, delaware-doc, california-sos, new-york-dos, texas-sos, companies-house, hmrc, uk-ipo, uk-visas-immigration, mca-india, gst-india, ip-india, efrro-india, handelsregister, elster, dpma, bamf, inpi-guichet-unique, dgfip-impots, inpi-ip-operations, anef-france, irn-portugal, at-financas, inpi-portugal, aima-portugal, corporations-canada, cra, cipo, ircc, colorado-sos, florida-dos, washington-sos, new-jersey-dor, ohio-sos, minnesota-sos, virginia-scc |
<!-- arenas:end -->

Regenerated by `pnpm stats`; do not hand-edit. The live site has the current set as it grows.

See `data/categories.json` for each arena's full description, personas, and themes.

## Data releases & freshness

<!-- stat-badges:start -->
[![rankings](https://img.shields.io/badge/rankings-96-34d399)](https://ultrametric.ai)
[![products](https://img.shields.io/badge/products-656-34d399)](https://ultrametric.ai/everything)
[![judged verdicts](https://img.shields.io/badge/judged_verdicts-37107-34d399)](https://ultrametric.ai/methodology)
<!-- stat-badges:end -->

<!-- stats:start -->
As of the last full pipeline run: **96 rankings, 656 products, 37,107 judged verdicts.**
<!-- stats:end -->

These counts (and the badges) are regenerated from `data/` by `pnpm stats`, not maintained
by hand. Everything on this page that changes is generated from the committed data, so the
numbers stay current with the repo itself:

- **[/reports](https://ultrametric.ai/reports)** — generated weekly arena reports (biggest
  movers, rank flips, new arenas, close races), committed as markdown in `reports/`.
- **[GitHub releases](https://github.com/ultrametricai/ultrametric/releases)** — point-in-time
  dataset snapshots (e.g. `data-YYYY-MM-DD`) with the full `data/` tree attached, if you want
  a stable dataset to build against instead of tracking `main`.
- **Score history** — every arena's rank and score movements are committed alongside the data
  (`data/<arena>/score-history.jsonl`), so any flip is reconstructible from the repo alone.

## Methodology

The full technical writeup lives in **[METHODOLOGY.md](./METHODOLOGY.md)**; this is the short
version. For plain-language answers ("what does `na` mean," "how do I disagree"), see
[docs/SCORING.md](./docs/SCORING.md); for a critical self-assessment of the formula's limits,
[docs/SCORING-REVIEW.md](./docs/SCORING-REVIEW.md).

- **Evidence tiers.** Every claim is backed by a dated evidence item, ranked
  `probe` (tested) > `github` (code) > `community` (independent) > `claimed-docs` (vendor
  claim). A keyless probe harness turns hands-on checks into probe-tier evidence, negative
  results included.
- **Judged cells.** For every (product, story) pair, an LLM judge reads only that product's
  evidence pack and returns `full` / `partial` / `disputed` / `none` / `na` with a 0–10
  quality, a rationale, and the evidence ids it relied on. No training knowledge allowed;
  verdicts are cache-keyed on their evidence, so nothing re-judges without a reason.
- **Scores.** A product's score is its weighted percentage across applicable cells:
  evidenced story coverage, not absolute quality. `na` cells are excluded entirely.
- **The Overall score** blends five agent-readiness components (agent access 0.30, API quality
  0.20, openness 0.20, agentic app 0.15, automation depth 0.15); 9 canonical agenticness
  stories are injected verbatim into every arena so the index is comparable across categories.
- **Honesty mechanics.** Unknown is `null`, never 0; every Overall score carries an A–D confidence
  grade (how much of it is probe-backed) and a measured ±band (68% interval from re-roll
  statistics; see [METHODOLOGY.md](./METHODOLOGY.md)); re-judge churn that cites no new
  evidence is reverted under audited rules; claims vendors make are reconciled against our
  verdicts in a claims-integrity index.
- **Bias disclosure.** The judge is an Anthropic model and the `ai-coding` arena includes
  Anthropic's Claude Code; the Product Feedback arena includes Foreloop, built by Ultrametric
  Inc. Both conflicts are disclosed on-site, adversarially bias-audited with corrections
  applied in both directions, and documented cell-by-cell in
  [METHODOLOGY.md § Bias disclosure](./METHODOLOGY.md#bias-disclosure--the-judge-is-an-anthropic-model).

## Pipeline refresh workflow

The pipeline is local-only (not run on Vercel). Each stage accepts `--category <id>` to
scope a run, and most accept `--product <id>` to scope further to one product:

```bash
pnpm pipeline crawl             --category <id> [--product <id>]   # fetch site/docs/github pages
pnpm pipeline extract           --category <id> [--product <id>]   # LLM: pull candidate stories from crawled pages
pnpm pipeline normalize         --category <id>                    # LLM: assemble the category's story taxonomy
pnpm pipeline collect-community --category <id> [--product <id>]   # gather community evidence
pnpm pipeline probe             --category <id> [--product <id>]   # keyless hands-on checks (llms.txt, openapi, etc.) → probe-tier evidence
pnpm pipeline judge             --category <id> [--product <id>]   # LLM: judge every (product, story) cell
pnpm pipeline derive            --category <id>                    # compute rankings.json (scores + battles) from verdicts
pnpm pipeline logos             --category <id> [--product <id>]   # fetch product logos into public/logos/
pnpm pipeline popularity         --category <id> [--product <id>]   # keyless GitHub/npm/PyPI momentum signal (display-only, no LLM, not scored)
```

To refresh a single product's data after editing its evidence (e.g. after a contributed
correction), you don't need to re-run the whole category; see
[CONTRIBUTING.md](./CONTRIBUTING.md) for the minimal `judge --product` + `derive` flow.

After any re-judge/`derive` that changes rankings, re-run `node scripts/generate-badges.mjs`
and commit the `public/badges/` diff. The embeddable score badges (see `/badges` on the site)
are committed static SVGs rather than build output, so consumers who
hotlink them pick up the new scores on the next deploy.

Requires `ANTHROPIC_API_KEY` in a local `.env` (see `.env.example`) for the LLM-driven stages
(`extract`, `normalize`, `collect-community`, `judge`).

**`ANTHROPIC_API_KEY` is local-pipeline-only. It must never be set as an environment variable
on the Vercel project.** The deployed site only serves pre-computed static data from `data/`
and does not call the Anthropic API at build or request time.

### Arena Notes (editorial drafts, not auto-published)

`pnpm tsx pipeline/scripts/generate-arena-notes.ts` drafts a short signed-POV essay (5
paragraphs max: the week's rank flip that matters, an unfilled gap in the arena, the vendor
move to watch, one self-critique of our own data, a closing line) into
`drafts/arena-notes/YYYY-MM-DD.md`. It is LLM-drafted but citation-gated in code: the model only
sees a fact sheet derived from the committed changelog/report/uncertainty/gap-closers data, and
every paragraph must cite its site source inline (`(source: /changelog)`, `(source:
/arena/...)`) from that fact sheet; violations fail schema validation and are retried.

Publishing is a human decision. Every generated file carries
`status: draft — requires founder sign-off before publishing` in its frontmatter, and the
[/notes](https://ultrametric.ai/notes) page (see `lib/notes.ts`) renders **only**
files whose frontmatter a human has edited to exactly `status: published`. Review the draft,
edit the frontmatter, commit. Unreviewed drafts do not render.

## Data layout

```
data/
  categories.json          # arena metadata: id, name, description, personas, themes
  {category}/
    products.json           # product metadata (id, name, vendor, type, urls, logo)
    stories.json             # the category's story taxonomy (incl. the 29 canonical stories, each with an optional `origin`)
    evidence/
      {product}.json          # evidence items for one product: id, tier, url, excerpt, fetchedAt
    verdicts.json            # one verdict per (productId, storyId) cell
    rankings.json            # derived: leaderboard + battles (generated by `pipeline derive`)
    popularity.json           # optional: keyless GitHub/npm/PyPI momentum signal, keyed by productId (generated by `pipeline popularity`)
    popularity-history.jsonl  # optional: one snapshot line per product per popularity run, for future velocity tracking
```

`popularity.json`/`popularity-history.jsonl` are display-only. See "Popularity — a signal, not
a score" in [METHODOLOGY.md](./METHODOLOGY.md). Neither file is read by the scoring pipeline
(`pipeline derive`) or `lib/scoring.ts`, and `loadCategory` tolerates their absence entirely.

`rankings.json` is derived data. Do not hand-edit it; regenerate it with
`pnpm pipeline derive --category <id>` after any verdict change.

`pnpm run build`/`pnpm run dev` mirror all of `data/` verbatim to `public/data/` (a gitignored
build artifact, via `scripts/copy-data.mjs`) so it's served at stable URLs (see "Use it
from an agent" below).

**Dataset releases.** Point-in-time snapshots of `data/` are periodically tagged and published
as [GitHub releases](https://github.com/ultrametricai/ultrametric/releases) (e.g.
`data-YYYY-MM-DD`), each with a zip of the full `data/` tree attached and release notes listing
arena/product/verdict counts at that snapshot; useful if you want a stable dataset to build
against instead of tracking `main`.

<a id="for-ai-agents"></a>

## Use it from an agent

Ultrametric is built to be read by agents as much as by humans. Every surface here is live
today, no keys, no install:

- **[/llms.txt](https://ultrametric.ai/llms.txt)**: the top-level index per the
  [llms.txt convention](https://llmstxt.org): site purpose, methodology one-liner, and links to
  every arena's markdown endpoint, the data API, and `/openapi.json`.
- **Markdown endpoints**: every arena has a full-content markdown rendering at
  `/arena/{category}/llms.md` (leaderboard, business models, grouped story matrix with proof
  URLs), and every product has a deep-dive at `/arena/{category}/product/{productId}/llms.md`
  (every verdict, rationale, and proof URL). These are the pages an agent should read first.
- **Process manifests**: every process page declares a machine-readable manifest as its
  metadata alternate: `/processes/{slug}/manifest.json` (chains at
  `/processes/chains/{chain}/manifest.json`), the published corpus reshaped into the executor
  handoff contract ([docs/AFK-HANDOFF.md](docs/AFK-HANDOFF.md)): per-step routing, tool
  calls, vendor options with their MCP endpoints, approval gates, and time estimates. Example:
  [/processes/incorporate-c-corp/manifest.json](https://ultrametric.ai/processes/incorporate-c-corp/manifest.json).
- **Data API**: the same JSON the site renders from is mirrored verbatim to stable URLs at
  build time (`scripts/copy-data.mjs`, a `prebuild` step): `/data/categories.json`,
  `/data/{category}/{products,stories,verdicts,rankings}.json`,
  `/data/{category}/evidence/{productId}.json`. `public/data/` is a build artifact
  (gitignored); it doesn't exist until `pnpm run build` or `pnpm run dev` regenerates it.
- **Raw committed data**: the same records straight from the repo, no site in between:
  [`data/`](data/) (arenas), [`processes/corpus.json`](processes/corpus.json) and
  [`journeys/chains.json`](journeys/chains.json) (processes, situations, chains),
  [`rules/`](rules/) and [`sources/`](sources/) (cited law), each validating against
  [`schemas/`](schemas/).
- **[/openapi.json](https://ultrametric.ai/openapi.json)**: an OpenAPI 3.1 document
  describing every data endpoint above, with hand-written JSON Schema summaries of each shape
  (mirrors `lib/schemas.ts`).
- **[/search-index.json](https://ultrametric.ai/search-index.json)**: the site's complete
  search index as one JSON fetch (every arena, product, stack, process, chain, and tool page
  with its href), the same file the on-site palette loads.
- **[/feed.xml](https://ultrametric.ai/feed.xml)**: RSS over the derived changelog
  (overtakes, score moves, launches), re-derived from committed history on each build.
- **[/methodology](https://ultrametric.ai/methodology)**: a tight, on-site summary of
  [METHODOLOGY.md](./METHODOLOGY.md) (evidence tiers, judging, scoring, Overall score weights,
  story provenance, re-judge stability, bias disclosure), linked from the header next to
  Rankings and from `/llms.txt`.
- **MCP / CLI**: the `ultrametric` package on npm ships the CLI and MCP server —
  [/get-started](https://ultrametric.ai/get-started) is the install page, and
  [`lib/ultrametricCli.ts`](lib/ultrametricCli.ts) maps the corpus steps it can drive. The
  simulator's MCP calls remain labeled demos.
- **The docs site**: [docs.ultrametric.ai](https://docs.ultrametric.ai) documents the CLI,
  MCP server, and HTTP API, and is itself agent-readable:
  [docs.ultrametric.ai/llms.txt](https://docs.ultrametric.ai/llms.txt) indexes every page,
  and each page is served as markdown at its own path with `.md` appended (e.g.
  [quickstart.md](https://docs.ultrametric.ai/quickstart.md)).
- **schema.org**: arena pages embed an `ItemList` of `SoftwareApplication` entries and product
  pages embed a `SoftwareApplication`, both with `additionalProperty` entries for our own
  metrics (`aiEra`, `score`, etc). No `aggregateRating`: we don't have star ratings and won't
  fabricate one.
- **sitemap.xml / robots.txt**: `app/sitemap.ts` lists every route including the `llms.md`
  endpoints; `public/robots.txt` explicitly allows `GPTBot`, `ClaudeBot`, `Claude-Web`,
  `PerplexityBot`, `Googlebot`, and `Bingbot`, with a `Sitemap:` pointer.

## Status & roadmap

Ultrametric is live at **[ultrametric.ai](https://ultrametric.ai)** and under active expansion. In flight:

- **Finer-grained arenas**: splitting broad categories (e.g. project management, edge
  platforms) into narrower slices as products diverge enough to need it.
- **New arenas incoming**: the full build queue lives in
  [`data/arena-roadmap.json`](./data/arena-roadmap.json) (170+ planned arenas in priority
  tiers; see [`docs/COVERAGE-STRATEGY.md`](./docs/COVERAGE-STRATEGY.md)); founder-ops
  next steps are specced in [`docs/FOUNDER-OPS-ROADMAP.md`](./docs/FOUNDER-OPS-ROADMAP.md)
  and classic head-to-heads in [`docs/CLASSIC-BATTLES.md`](./docs/CLASSIC-BATTLES.md).
- **Recorded proofs**: CLI/MCP probe sessions are now captured as sanitized, replayable
  transcripts (and pilot browser video) published on product pages; the
  [`docs/PROVE-IT.md`](./docs/PROVE-IT.md) protocol lets vendors submit reproducible proof
  specs our runner executes and publishes, pass or fail.
- **The Agentic Depth Program**: a deeper, runtime-conformance-tested successor to the
  current agenticness/API-quality cells (MCP handshake checks, API probe suites, CLI
  conformance, agent task trials, and a monthly agentic-velocity leaderboard). See
  [`docs/AGENTIC-DEPTH-PROGRAM.md`](./docs/AGENTIC-DEPTH-PROGRAM.md) for the full plan.
- **The contest flow**: every verdict is contestable today (see
  [Contributing](#contributing--how-the-community-can-help) below);
  `.github/workflows/contest-check.yml` can automate the add-evidence → re-judge → PR loop
  once a maintainer wires up the `ANTHROPIC_API_KEY` secret.
- **Continuous runners**: `.github/workflows/story-runner.yml` re-runs one arena's full
  pipeline every 6 hours on rotation and opens a reviewable PR (idle until the
  `ANTHROPIC_API_KEY` secret is set); an arena-builder runner that works through the
  roadmap automatically is designed in `docs/COVERAGE-STRATEGY.md`.

Counts on this page (arenas/products/verdicts) are generated by `pnpm stats` (see
`scripts/update-readme-stats.mjs`) and will keep moving as arenas and products are added.
They reflect the data at the last pipeline run.

## Contributing — how the community can help

Every score on the site is only as good as its evidence, so contributing evidence is the
most valuable help. (And if the repo is useful to you,
[a star](https://github.com/ultrametricai/ultrametric) is how other founders find it.)

The quick index:

| You want to | Where |
| --- | --- |
| Contest a verdict | the "⚑ contest" link next to any verdict on the site → [prefilled issue](https://github.com/ultrametricai/ultrametric/issues/new?template=contest-verdict.yml); flow in [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Add evidence or prove a story hands-on | [CONTRIBUTING.md](./CONTRIBUTING.md) · [`docs/PROVE-IT.md`](./docs/PROVE-IT.md) |
| Add your product to an arena | [/submit](https://ultrametric.ai/submit) or [CONTRIBUTING.md § Add your product](./CONTRIBUTING.md#3-add-your-product) |
| Add your country or state | [Add your country or state](#add-your-country-or-state) below; four PR shapes, smallest first |
| Add an open module | [`open-modules/README.md`](open-modules/README.md): the bar is pure functions, a citation on every formula, tests that double as documentation |
| Submit a stack | the [Submit a stack](https://github.com/ultrametricai/ultrametric/issues/new?template=submit-stack.yml) issue form (linked from [/stacks](https://ultrametric.ai/stacks)). Stacks stay curated committed data; submissions feed review and are not auto-published |
| Understand the review bar | [governance/REVIEW_POLICY.md](governance/REVIEW_POLICY.md) |

[![CI](https://github.com/ultrametricai/ultrametric/actions/workflows/ci.yml/badge.svg)](https://github.com/ultrametricai/ultrametric/actions/workflows/ci.yml)

Working on the repo itself: setup, the test gate, and style rules live in
[CONTRIBUTING.md § Local setup](./CONTRIBUTING.md#local-setup).

Ways to contribute:

- **Contest a verdict**: every verdict has a "⚑ contest" link that opens a prefilled
  issue. Bring a citation that contradicts (or supports) the ruling.
- **Prove a story**: submit a reproducible proof spec (setup + commands + expected
  result) via the *Prove a story* issue form; our runner executes and records it, and the
  recording is published as probe-tier evidence, pass or fail. See
  [`docs/PROVE-IT.md`](./docs/PROVE-IT.md).
- **Respond as a vendor**: put an official, verified statement on the record next to a
  verdict about your product (CVE-style) via the *Vendor response* issue form. Published
  verbatim. The statement does not change a verdict by itself, but feeds the next re-judge. See
  [`docs/VENDOR-RESPONSES.md`](./docs/VENDOR-RESPONSES.md).
- **Add evidence by PR**: new doc pages, changelogs, or community sources for any
  product; the pipeline re-judges only the cells whose evidence changed.
- **Submit a product or arena**: the *Submit a product* issue form (prefilled from the
  [/submit](https://ultrametric.ai/submit) quick scan), or open a PR adding your
  `data/<arena>/products.json` entry. The exact entry shape, which URLs to include and why,
  and how to make your product probe well are all in
  [CONTRIBUTING.md § Add your product](./CONTRIBUTING.md#3-add-your-product).
- **Add your country or state**: the most valuable contribution for founders outside the
  US; see [the subsection below](#add-your-country-or-state).
- **Add an open module**: pure, source-cited TypeScript under `lib/openstartup/`;
  the bar and candidate modules are in [`open-modules/README.md`](open-modules/README.md).
- **Make a prediction**: `/predictions` auto-generates yes/no questions from live close
  races ("will the #2 overtake the #1 within 30 days?") and settles them mechanically from
  the committed rank-flip history. The "Predict" link opens a prefilled issue
  (`.github/ISSUE_TEMPLATE/prediction.yml`); v1 records predictions as submitted issues, and
  an accuracy leaderboard comes once enough questions have settled.
- **Report an inaccuracy**: wrong metadata, broken link, stale evidence, missing logo.
- **Adopt an arena**: become the standing reviewer for one arena's story taxonomy,
  evidence freshness, and contest triage.
- **Run probes locally**: `pnpm pipeline probe --category <id>` needs no API key;
  publishing discrepancies you find is exactly the point.
- **Cite the data**: verdicts, scores, and evidence excerpts may be quoted with
  attribution (see DATA-LICENSE); bulk reuse needs written permission from Ultrametric.
- **Spread the Weekly Arena Report**: `pnpm tsx pipeline/scripts/generate-weekly-report.ts`
  renders the last 7 days (biggest movers, rank flips, new arenas, close races) into
  committed markdown at `reports/YYYY-MM-DD.md`, listed on the site at `/reports`. The
  markdown is copy-paste ready for a newsletter or community digest, with links, attribution,
  and empty states handled.

Found a verdict you think is wrong, or evidence we missed? See
[CONTRIBUTING.md](./CONTRIBUTING.md). Contesting a verdict and adding evidence are both
first-class, expected contribution paths: a maintainer (or, in the future, a GitHub Action)
does the deeper check, adding evidence and then running
`pnpm pipeline judge --category <category> --product <product>` followed
by `pnpm pipeline derive --category <category>`, before any verdict changes.

### Add your country or state

The goal is the **complete global repo for startup founders**: processes, rules, and vendor
reality for every jurisdiction, contributed by founders who operate there and verified against
primary sources. The US slice (federal + Delaware, CA/multi-state overlays) is the starting
template; UK, India, Germany, and France already have first process analogs and vendor
rows. Four PR shapes, smallest first. Each is schema-validated, so `pnpm test` tells you
immediately whether your records hold up:

1. **Vendor availability in your country** — add rows to
   [`jurisdictions/vendor-geo.json`](jurisdictions/): `{productId, country, status:
   available|unavailable|partial, sourceUrl, note}`. The source must be the vendor's own page
   (or an official register) stating the fact; honest negatives ("US entities only") are as
   valuable as positives. These rows drive the geo switcher and "Geos supported" on the site.
2. **A country analog for a process** — add a `geoNotes` entry to the process in
   [`processes/corpus.json`](processes/): `{country, summary, actionUrl, actionLabel}` with a
   live, official actionUrl (Companies House, MCA/NSWS, Handelsregister, INPI…). This is what
   renders in the top-of-page geo banner and the "Outside the US" block.
3. **Rule cards for your jurisdiction** — register the jurisdiction in
   [`jurisdictions/registry.json`](jurisdictions/) with a narrow, accurate scope, then add
   `rules/<CODE>/*.json` rule cards citing primary sources in
   [`sources/registry.json`](sources/) (statute, regulation, agency guidance; a provider blog
   cannot establish law). One proposition per stable ID.
4. **A full jurisdiction-scoped workflow** — copy
   [`templates/process.json`](templates/process.json), narrow the applicability dimensions,
   reference your rule cards, gate every external effect on a human approval, add a fictional
   fixture, and record the maturity level in [`coverage/coverage.json`](coverage/) (`draft` or
   `demonstration` to start; `reviewed` requires a named domain expert, see the
   [review policy](governance/REVIEW_POLICY.md)).

Do not copy US rules into another jurisdiction, do not mark a country covered because one
workflow exists, and do not commit real company data (fixtures are fictional by gate). The
validator (`lib/founderOps.ts`, run by `npx vitest run __tests__/founder-ops.test.ts`) enforces
source resolution, jurisdiction matching, approval gates, and accurate coverage reporting on
every PR.

## Citing Ultrametric

Quoting a ranking, verdict, or evidence excerpt (with attribution, per DATA-LICENSE) in a
paper, post, or dataset card:

> Ultrametric — agent tested software rankings for the agent economy. Ultrametric Inc,
> 2026. https://ultrametric.ai

```bibtex
@misc{ultrametric,
  title        = {Ultrametric: agent tested software rankings for the agent economy},
  author       = {{Ultrametric Inc}},
  year         = {2026},
  howpublished = {\url{https://ultrametric.ai}},
  note         = {Methodology: \url{https://ultrametric.ai/methodology}}
}
```

Rankings move as evidence lands, so cite the dataset release tag (e.g. `data-YYYY-MM-DD`) when
you need a pinned snapshot.

## License

[![license](https://img.shields.io/badge/license-source--available-555555)](./LICENSE)
[![data license](https://img.shields.io/badge/data-quotable_with_attribution-555555)](./DATA-LICENSE)

Code: © 2026 Ultrametric Inc, all rights reserved (source-available, see LICENSE).
Data (`data/`): © 2026 Ultrametric Inc, all rights reserved (see DATA-LICENSE): viewable
and quotable with attribution; bulk reuse requires written permission.
Rankings are research outputs provided "as is", with no responsibility for decisions made in
reliance on them (see [/terms](https://ultrametric.ai/terms)); published
`rankings.json` files carry a `_provenance` watermark, verifiable with
`pnpm tsx pipeline/scripts/verify-provenance.ts <file>`.
