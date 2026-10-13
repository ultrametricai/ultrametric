# Sources

The primary authorities every legal rule cites, each with a publisher, the exact
section, and the date a human last verified it.

`registry.json` holds the records: publisher, exact section, `issued_on` where known,
`checked_on`, and an HTTPS link. A legal rule card may only cite `primary-*` sources;
provider blogs can explain practice but cannot establish law (`kind:
secondary-practice`).

Contribute here:

- **Primary sources for new rule cards** — add entries alongside the `law/<CODE>/*.json`
  cards that cite them.
- **Re-verification passes** — follow an existing link, confirm the provision still says
  what the card claims, and bump `checked_on` (note it if the provision moved).

Gate: `npx vitest run __tests__/founder-ops.test.ts` (every card must resolve to a
registered source with an exact section).
