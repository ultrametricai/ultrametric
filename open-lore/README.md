# Startup lore

The heuristics founders actually trade, the schools of thought they come from, the
library of works that ground them, and the episodes of startup history behind both
live here. Everything is recorded as a sourced claim: a named author, a citable work, and, where
schools disagree, the conflict mapped on both sides.

These files carry it:

| File | What it holds | Gate |
| --- | --- | --- |
| [`registry.json`](./registry.json) | Heuristics: one actionable sentence per claim, with school, topic, source, tensions, and cross-links. | `pnpm test __tests__/lore-registry.test.ts --maxWorkers=2` |
| [`schools.json`](./schools.json) | The schools of thought: who they are and their core position. | `pnpm test __tests__/lore-schools.test.ts --maxWorkers=2` |
| [`library.json`](./library.json) | The curated reading list, in sections that double as the topic set. | `pnpm test __tests__/lore-library.test.ts --maxWorkers=2` |
| [`citations.json`](./citations.json) | Citation-only works the distilled laws cite that are not library-worthy. | `pnpm test __tests__/lore-citations.test.ts --maxWorkers=2` |
| [`rules.json`](./rules.json) | Uncontested mechanics: sourced rules with no published opposing view. | `pnpm test __tests__/lore-rules.test.ts --maxWorkers=2` |
| [`LORE.md`](./LORE.md) | Episodes: the war stories of startup history, graded for veracity. | `pnpm test __tests__/lore.test.ts --maxWorkers=2` |

`lib/lore.ts` loads and validates the episodes and the citation-only registry, and
`lib/laws.ts` consumes `library.json` and `citations.json` to resolve the distilled laws'
citations in [`open-law/LAWS.md`](../open-law/LAWS.md); the gates in the table hold each
file to its contract.

## Schools

Each registry heuristic belongs to a school. `schools.json` names them, states the
position the school's registry entries argue, and lists the figures who author those
entries. The registry takes no side: tensions are recorded between schools, on both
sides, and the tests enforce that every tension crosses school lines.

| School | Position |
| --- | --- |
| Y Combinator | Launch fast, talk to users, and make something people want; weekly growth is the compass, and the founder stays engaged in the details as the company scales. |
| Lean startup | A startup is a search for a working business model: treat every plan as a hypothesis and test it on real customers before scaling anything. |
| Blitzscaling | In winner-take-most markets, speed to scale beats efficiency: accept risk, waste, fires left to burn, and stage-fit hires to reach dominant scale first. |
| Bootstrapper | A profitable, independent company at a sustainable pace is complete success: fund with revenue, keep the team small, charge real prices, and define the outcome yourself. |
| Effectuation | Expert entrepreneurs start from their means (who they are, what they know, whom they know) and commit only what they can afford to lose, co-creating markets rather than predicting them. |
| Contrarian | The valuable truths are the ones the consensus rejects: escape competition into monopoly, commit to a definite plan, and engineer distribution deliberately. |
| Classical | The market, management, and venture canon that predates the current playbooks: market size decides outcomes, dominate a beachhead before expanding, watch for disruption from below, and build the professional systems a scaled company runs on. |
| Craft | Product quality is the strategy: pick the few attributes that make the product great, get them exactly right for a narrow set of users, and hold off scaling until the market pulls. |

## Topics

The library's sections double as the registry's topic set: every heuristic carries a
`topic` and every library entry a `section`, drawn from the same list. The coverage of
any topic and school pair is computable from the data; an empty cell is a place to
contribute.

| Topic | Covers |
| --- | --- |
| Deciding to start | Whether to start a startup at all: the case for building, the cost of the bargain, and the mindset that survives it. |
| Ideas and markets | Finding an idea worth working on, judging the market it lives in, and choosing the scale of ambition. |
| Starting up | The first months of a company: the condensed playbooks, the accelerator application, and the mistakes that kill early startups. |
| Co-founders and founding decisions | Picking co-founders, splitting equity, naming, and the setup decisions made once: incorporation, banking, cap table, visas, and where to build. The readings are US-centric. This section also cross-links the arenas and processes that cover the tools involved. |
| Finding product-market fit | Talking to users, shipping a minimum product, and measuring whether the market pulls. |
| Building the product | Scoping the MVP, product design and UX, and the engineers who ship it. |
| Fundraising | Raising seed and priced rounds: instruments, term sheets, pitching, investor emails, and runway math. The instruments and norms described are US-centric. |
| Hiring and culture | Recruiting, interviewing, compensation, and the cultures teams are built on. |
| Operating | Running the company: management systems, founder time, prioritization, and pace. |
| Growth and distribution | First users, growth loops, channel decay, and when to scale spend and headcount. |
| Pricing and sales | Setting and raising prices, founder-led selling, and building the first sales team. |
| Exits and acquisitions | Deciding whether to sell, running an acquisition process, and life after the deal. |

## Registry

Every entry in `registry.json` is one school's belief about how to build a company.
Each record carries: `id` (stable), `heuristic` (one actionable sentence, a faithful
paraphrase), `school` (resolving against `schools.json`), `topic` (resolving against
the library's sections), `source` (author, work, URL; `note` documents hosts that
refuse automated fetches, with a reachable alternative), `stance` (always `claim`),
`tensions` (conflicting entry ids, symmetric and always across schools), `libraryIds`
(the library entries that ground the claim, symmetric with the library's `loreIds`),
and `processIds` (the processes in [`open-processes/catalog.json`](../open-processes/catalog.json)
it bears on). A real record:

```json
{
  "id": "pg-do-things-that-dont-scale",
  "heuristic": "Recruit your first users manually and give them unscalably good treatment; scalable channels come after the product works.",
  "school": "YC",
  "topic": "growth-distribution",
  "source": { "author": "Paul Graham", "work": "Do Things that Don't Scale", "url": "https://paulgraham.com/ds.html" },
  "stance": "claim",
  "tensions": ["hoffman-let-fires-burn"],
  "libraryIds": ["pg-do-things-that-dont-scale", "rachitsky-first-1000-users"],
  "processIds": ["growth_004", "growth_010"]
}
```

Contribute here:

1. A real, verifiable source is required: essay, book, or talk by the person the
   heuristic is attributed to, with a resolving URL. A fabricated URL or invented quote
   is disqualifying.
2. Map the tensions: add the id on both sides, across schools.
3. One actionable sentence per heuristic; `stance` stays `claim`.
4. Set the `topic`, and cross-link `libraryIds` on both sides where the grounding work
   is a library entry.
5. Every `processIds` entry must resolve.

## Rules

`rules.json` carries the uncontested mechanics the canon teaches: rules with no published
opposing view, so they cannot live in the registry (every registry entry must map a
cross-school tension). Each record carries `id`, `rule` (one actionable sentence), `topic`
(resolving against the library's sections), `source` (same contract as the registry,
including the archived-copy note for dead hosts), `libraryIds`, and `processIds`. Rule ids
stay disjoint from registry ids; if an opposing view is later published, the rule moves to
the registry with its tension mapped. Gate: `__tests__/lore-rules.test.ts`.

## Library

`library.json` is the curated reading list: the canonical essays, guides, books, and
talks on building a company. Where the definitive version of a lesson is a recorded
talk, the entry is the video. Each entry carries `id`, `section`, `title`, `author`,
`year` (when the work itself or its publisher states one), `format` (`essay`, `guide`,
`book`, `video`), `url`, `teaches` (one functional sentence on what the work argues or
shows), `note` (host-level caveats: bot walls, JavaScript-rendered pages, archived
copies), `loreIds` (registry heuristics the work grounds), and `processIds` (processes
it bears on). A work that is not publicly available (unpublished or withdrawn) carries
`availability: "not-public"` instead of `url`, may omit `format` (no published form to
cite), and must carry a `note` stating the unavailability and the evidence found at
recording time; its `teaches` attributes the topic from the citation and claims no
content the text cannot be checked for. Sections may carry `arenas` (arena ids resolving
against [`open-rankings/`](../open-rankings/)) and `processIds` of their own: the
co-founders section, for example, points at the incorporation, banking, cap-table,
payroll, domain, and immigration arenas whose vendors the readings assume.

Contribute here:

1. Every URL is fetched and confirmed to resolve to the claimed work before it lands; a
   dead host disqualifies the link (find the current home, an archived copy recorded in
   `note`, or leave the entry out).
2. `teaches` is one sentence on what the work actually argues or shows; titles stay as
   published. Founder-affiliated works get the same neutral treatment as every entry.
3. The bar is the best entries, not the most; the tests bound each section's size.
4. `loreIds` and `processIds` must resolve, and only record real connections.

## Citations

`citations.json` carries the works the distilled laws ([`open-law/LAWS.md`](../open-law/LAWS.md))
cite that are not library-worthy: resource registries (NVCA model documents, Cooley GO),
agency portals recorded as reading (IRS EIN, Delaware franchise tax, USPTO basics), and
umbrella sites (First Round Review, Steve Blank's corpus). Each entry carries `id`,
`title`/`author` (as published), `url` (HTTPS, verified live on `checked_on`), `kind`,
`topics`, `note` (why it is canon, with caveats), and `published_on`. The inclusion bar:
openly readable (no login, no purchase), primary where possible, and canonical, what the
community actually cites. Candidates that fail live verification are left out rather
than linked hopefully.

One place per work: a work curated into `library.json` lives there alone (the library
entry is canonical, and the gate rejects a `citations.json` entry duplicating a library
id or URL), and LAWS.md cites the library id directly. A `citations.json` entry that
later earns a library home moves there; repoint the LAWS.md citations in the same
change. Legal authorities with locators are a different record entirely:
`open-law/citations/registry.json`.

## Episodes

`LORE.md` records the episodes of startup history as sourced entries: a tight factual
retelling, era, companies and people, a one-sentence lesson, at least one source with a
what-it-supports note, and a veracity grade on every entry (`first-person` /
`documented` / `reported` / `legend`). Disputed tellings keep the dispute in the text;
cross-links to the laws (`open-law/LAWS.md`) and processes must resolve.

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
