# Resources — the open startup-resources path

The curated registry of canonical, openly readable startup resources (`registry.json`), the
laws distilled from them (`LAWS.md`), and the lore behind them (`LORE.md`). This is the
reading-path layer of the founder-ops corpus: `open-documents/` holds the usable legal forms,
`rules/` holds the legal propositions, and this directory holds the knowledge those layers
assume.

## Record semantics

Every entry in `registry.json` is a dated record:

| Field | Meaning |
| --- | --- |
| `id` | Stable slug; `LAWS.md` citations and other corpus records reference it |
| `title` / `author` | As published; authorship attributed to the actual origin |
| `url` | HTTPS, curl-verified live on `checked_on` (registry policy: no dead links, no paywalls) |
| `kind` | `essay` \| `guide` \| `handbook` \| `library` \| `primary-source` \| `document-repository` |
| `topics` | Lowercase facet tags |
| `note` | Why it is canon, dated context, and honest caveats |
| `published_on` | Exact date when the source states one; otherwise `null` (month/year go in the note) |
| `checked_on` | The date a human last verified the link and description |

Inclusion bar: openly readable (no login, no purchase), primary where possible (government
sources are `primary-source` records), and canonical — the resource is what the community
actually cites, not a summary of it. Candidates that failed live verification on 2026-09-29
were left out rather than linked hopefully (`seriesseed.com` and `growth.tlb.org` were
unreachable; `sec.gov` and `dol.gov` block non-browser fetches).

## Startup laws

`LAWS.md` distills the registry into 25–40 recurring, near-universal principles, grouped by
lifecycle stage. Discipline: every law cites its source records by id; aphorisms are
attributed to their actual origin; the only literal laws (filing deadlines) also carry rule
cards in `rules/` with primary sources.

## Startup lore

`LORE.md` is the complement to the laws: the famous episodes and war stories of startup
history — the cereal boxes, the Collison installation, the pivots, the near-deaths, the
rejections, the cautionary collapses — curated as sourced records, 25–40 of them. Where a law
is a recurring principle, a lore entry is the episode that taught it.

It stays markdown-with-structure like `LAWS.md` (episodes are prose for reading; a JSON
registry would bury them) with a deliberately rigid grammar `lib/lore.ts` parses. Each entry
carries: a stable `Id`, the episode (a tight, factual 3–6 sentence retelling — no
embellishment), `Era` (approximate, honest), `Companies`/`People`, a one-sentence `Lesson`,
`Sources` (≥1, primary/first-person strongly preferred, each with a what-it-supports note),
and the honesty field that makes the corpus ours — `Veracity`:

| Grade | Meaning |
| --- | --- |
| `first-person` | A participant told it on the record (founder essay, memoir, recorded interview) |
| `documented` | Contemporaneous records (blog posts, press releases, filings, archived threads) |
| `reported` | Secondhand journalism — reputable, but no participant account or contemporaneous record |
| `legend` | Famous but unverifiable or known-embellished — recorded AS legend, never asserted as fact |

Disputed or debunked tellings keep the dispute in the episode text (the eBay Pez story is
recorded as the fabrication it was; the Apple garage carries Wozniak's own debunk). Cross-links:
`Related laws` cite law numbers from `LAWS.md`; `Related processes` cite ids verified against
`processes/corpus.json`; `Candidate processes` name ids expected from parallel corpus work that
do not resolve yet — validation fails the moment a candidate resolves, demanding promotion.

## Gates

`lib/resources.ts` loads and validates the registry and `LAWS.md`; `__tests__/resources.test.ts`
fails on duplicate or malformed ids, non-HTTPS URLs, future `checked_on` dates, unknown kinds,
laws without citations, citations that do not resolve to a registry id, and a law count outside
25–40. `lib/lore.ts` + `__tests__/lore.test.ts` gate `LORE.md` the same way: unique ids, a valid
veracity grade and non-empty lesson on every entry, ≥1 HTTPS source with a note, law and process
cross-links that resolve, numbering and entry count (25–40) intact. URL liveness is a human
editorial check — the test suites are deterministic and do not hit the network.
