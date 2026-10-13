# Citations

One registry of every cited source. Each entry in `registry.json` is a dated record in
one of two roles, validated against `schemas/citation.schema.json`:

- **`authority`** — the primary authorities and dated practice sources the legal rule
  cards in `law/` cite: publisher, the exact section (`locator`), `issued_on` where
  known, `checked_on`, jurisdiction, and an HTTPS link. A legal rule card may only cite
  `primary-*` authorities; provider blogs can explain practice but cannot establish law
  (`kind: secondary-practice`).
- **`reading`** — the canonical, openly readable startup reading that the distilled laws
  (`law/LAWS.md`) and the lore (`lore/`) cite: `title`/`author` (as published), `url`
  (HTTPS, verified live on `checked_on`), `kind`, `topics`, `note` (why it is canon, with
  caveats), and `published_on`. The inclusion bar: openly readable (no login, no
  purchase), primary where possible, and canonical, what the community actually cites.
  Candidates that fail live verification are left out rather than linked hopefully.

The distillations that cite this registry live with their subjects: `law/LAWS.md` (the
recurring principles, every law citing its records by id) and `lore/LORE.md` (the
veracity-graded episodes). `lore/library.json` is a separate curated reading list; where
the same work appears in both, the library entry carries the reading-list role and the
entry here carries the citation-registry role.

Contribute here:

- **Primary authorities for new rule cards** — add `authority` entries alongside the
  `law/<CODE>/*.json` cards that cite them.
- **Canonical reading** — add `reading` entries for works the laws or lore cite, meeting
  the inclusion bar above.
- **Re-verification passes** — follow an existing link, confirm the provision or work
  still says what the citing record claims, and bump `checked_on` (note it if it moved).

Gates: `npx vitest run __tests__/founder-ops.test.ts` (schema validation of every entry;
every rule card resolves to a registered authority with an exact section) and
`npx vitest run __tests__/citations.test.ts` (reading-entry invariants plus `law/LAWS.md`
citation resolution). URL liveness is a human editorial check; the suites stay offline.
