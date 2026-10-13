# Startup lore

The heuristics founders actually trade, recorded as sourced claims from named schools
of thought, with the disagreements between schools kept explicit, and the library of
essays, guides, books, and talks those claims come from.

## Registry

Every entry in `registry.json` is one school's belief about how to build a company, with a
named author and a citable work behind it. The registry takes no position on which school
is right; it records the conflicts between entries explicitly, on both sides. The episode
layer lives separately in
[`resources/LORE.md`](../resources/LORE.md) (veracity-graded startup history); this
registry records the rules of thumb the schools draw from it.

Each record carries: `id` (stable), `heuristic` (one actionable sentence, a faithful
paraphrase), `school` (`YC`, `lean`, `blitzscaling`, `bootstrapper`, `effectual`,
`contrarian`, `classical`, `craft`), `source` (author, work, URL), `stance` (always
`claim`), `tensions` (conflicting entry ids, symmetric and always across schools), and
`processIds` (the processes in [`processes/corpus.json`](../processes/corpus.json) it
bears on).

Contribute here:

1. A real, verifiable source is required: essay, book, or talk by the person the heuristic
   is attributed to, with a resolving URL (`source.note` documents hosts that refuse
   automated fetches, with a reachable alternative). A fabricated URL or invented quote is
   disqualifying.
2. Map the tensions: add the id on both sides, across schools.
3. One actionable sentence per heuristic; `stance` stays `claim`.
4. Every `processIds` entry must resolve.

Gate: `pnpm vitest run __tests__/lore-registry.test.ts --maxWorkers=2`.

## Library

`library.json` is the curated reading list: the canonical essays, guides, books, and talks
on building a company, organized into sections. Where the definitive version of a lesson
is a recorded talk, the entry is the video. Each entry carries `id`, `section`, `title`,
`author`, `year` (when the work itself or its publisher states one), `format` (`essay`,
`guide`, `book`, `video`), `url`, `teaches` (one functional sentence on what the work
argues or shows), `loreIds` (registry heuristics the work grounds), and `processIds`
(processes it bears on). Cross-links are recorded only where the connection is real; most
entries carry none.

| Section | What it teaches | Example entry |
| --- | --- | --- |
| Starting up and ideas | Deciding to start, finding an idea worth working on, and the first weeks of a company. | [How to Start a Startup](https://paulgraham.com/start.html) — Paul Graham |
| Finding product-market fit | Talking to users, shipping a minimum product, and measuring whether the market pulls. | [The Only Thing That Matters](https://pmarchive.com/guide_to_startups_part4.html) — Marc Andreessen |
| Fundraising | Raising seed and priced rounds: instruments, term sheets, pitching, and runway math. | [How to Raise Money](https://paulgraham.com/fr.html) — Paul Graham |
| Hiring and culture | Recruiting, interviewing, compensation, and the management systems that scale a team. | [How to Hire](https://blog.samaltman.com/how-to-hire) — Sam Altman |
| Growth and distribution | First users, growth loops, channel decay, and when to scale spend and headcount. | [Startup = Growth](https://paulgraham.com/growth.html) — Paul Graham |
| Pricing and sales | Setting and raising prices, founder-led selling, and building the first sales team. | [Why Your Customers Would Be Happier If You Charged More](https://www.kalzumeus.com/2012/09/21/ramit-sethi-and-patrick-mckenzie-on-why-your-customers-would-be-happier-if-you-charged-more/) — Patrick McKenzie with Ramit Sethi |
| Exits and acquisitions | Deciding whether to sell, running an acquisition process, and life after the deal. | [Notes on the Acquisition Process](https://cdixon.org/2012/09/10/notes-on-the-acquisition-process/) — Chris Dixon |

Contribute here:

1. Every URL is fetched and confirmed to resolve to the claimed work before it lands; a
   dead host or a page that no longer carries the work disqualifies the link (find the
   current home or leave the entry out). `note` documents host-level caveats.
2. `teaches` is one sentence on what the work actually argues or shows; titles stay as
   published.
3. Sections hold 8-15 entries; the bar is the best entries, not the most.
4. `loreIds` and `processIds` must resolve, and only record real connections.

Gate: `pnpm vitest run __tests__/lore-library.test.ts --maxWorkers=2` (shape and
references; URL liveness is checked at authoring time, the test performs no network I/O).
