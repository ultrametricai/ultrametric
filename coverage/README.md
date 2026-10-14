# Coverage

The map of what the founder-ops layer intends to cover and what it covers today,
at what maturity, with the gaps stated.

`domains.json` is the full founder-journey map (formation through exit), including domains
with no playbook yet; `coverage.json` records which scenarios have workflows, at what
maturity, with known gaps. `lib/founderOps.ts` checks both in CI. No country is called
covered because a few playbooks exist (`governance/REVIEW_POLICY.md`).

How it maps onto the rest of the repo: the rankings (`open-rankings/`, live at `/arenas`) are the
vendor-evaluation cut of the same territory; the process library
(`open-processes/corpus.json`, live at `/processes`) covers the operating work; the
jurisdiction-scoped workflows (`open-processes/<domain>/<jurisdiction>/`) are the source-cited
legal layer, and `coverage.json` tracks only that layer. The rule cards themselves are
mapped by domain in `open-law/map.json`, which grades each legal domain mapped, partial,
or unmapped and lists the gaps.

Contribute here:

- **A coverage entry** — when a jurisdiction-scoped workflow lands, record it at `draft`
  or `demonstration` maturity (`reviewed` requires a named domain expert); the known-gaps
  field is part of the record.
- **Missing domains** — a domain or lifecycle stage missing from `domains.json`, with the
  founder scenario that exposes it; domains without playbooks keep gaps visible.

Gate: `npx vitest run __tests__/founder-ops.test.ts`.

## Source-library audit

`node scripts/content-audit.mjs /path/to/content-audit.json` exports a source-library
audit of the committed records (processes, vendor stories and verdicts, documents,
modules, jurisdictions, law, sources, resources, artifacts), resolving declared
references and reporting missing outcomes, incomplete verdict evidence, and unresolved
links without changing records. Keep exports outside the public data tree; the private
[ultrametric-api repository](https://github.com/ultrametricai/ultrametric-api) stores
validated exports for its staff dashboard. The report carries the source commit,
dirty-state flag, input hash, and generation time; counts measure the committed inventory,
not domain coverage, and recorded review dates do not establish expert approval or URL
liveness. Required inputs must resolve or generation fails rather than emitting a partial
report. Checks: `node --test scripts/content-audit.test.mjs`; no model, remote probe, or
external effect runs during generation.
