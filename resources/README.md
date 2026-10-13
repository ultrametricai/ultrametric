# Resources

The canonical, openly readable startup reading, as dated records, with the
recurring principles distilled in `LAWS.md` and the famous episodes recorded in `LORE.md`.

Every entry in `registry.json` is a dated record: `id`, `title`/`author` (as published),
`url` (HTTPS, verified live on `checked_on`), `kind`, `topics`, `note` (why it is canon,
with caveats), `published_on`, and `checked_on`. The inclusion bar: openly readable (no
login, no purchase), primary where possible, and canonical, what the community actually
cites. Candidates that fail live verification are left out rather than linked hopefully.

- **`LAWS.md`** distills the registry into recurring, near-universal principles grouped by
  lifecycle stage; every law cites its source records by id, aphorisms are attributed to
  their actual origin, and the only literal laws (filing deadlines) also carry rule cards
  in `law/`.
- **`LORE.md`** records the episodes of startup history as sourced entries: a tight
  factual retelling, era, companies and people, a one-sentence lesson, at least one source
  with a what-it-supports note, and a veracity grade on every entry (`first-person` /
  `documented` / `reported` / `legend`). Disputed tellings keep the dispute in the text;
  cross-links to laws and processes must resolve.

Gates: `__tests__/resources.test.ts` and `__tests__/lore.test.ts` (via `lib/resources.ts`
and `lib/lore.ts`): ids, HTTPS URLs, dates, citations that resolve, veracity grades, and
entry-count bounds. URL liveness is a human editorial check; the suites stay offline.
