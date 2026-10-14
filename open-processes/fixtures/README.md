# Fixtures

Wholly fictional companies and events that exercise the workflow planner, so the
gates run on realistic inputs without ever touching real company data.

Every fixture asserts `synthetic: true` and carries full scenario dimensions; the planner
tests read this directory (`lib/founderOps.ts`). Invented names only, no real people, no
PII (`SECURITY.md`, "Data hygiene").

Contribute here:

- **A fixture for every new workflow** — land each jurisdiction-scoped workflow with a
  fictional scenario that exercises it.
- **Planner edge cases** — fixtures that should match nothing (like `unsupported-gb.json`)
  pin the planner's refusal behavior and are as valuable as ones that match.

Gate: `npx vitest run __tests__/founder-ops.test.ts`.
