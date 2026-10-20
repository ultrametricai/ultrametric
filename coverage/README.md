# Coverage

This directory is the cross-area answer to what this repo covers and what is missing. `index.json` carries
one entry per top-level content area: a maturity grade, a short summary, the headline
gaps, and pointers to the file where that area tracks its own gaps in detail. The detail
stays with its area (the law map keeps its grades, the arena roadmap keeps its tiers, the
modules audit keeps its verdicts); this directory is the rollup.

`__tests__/coverage.test.ts` keeps the index aligned with reality: the area list must
match the directories the README layout tree names (each a real tracked directory),
every pointer must resolve to a committed file, and the index must validate against
`schemas/coverage-index.schema.json`.

## Where each area tracks its own gaps

- `open-processes` — chain membership in definitions selected by `open-processes/catalog.json`; jurisdiction-scoped
  workflow coverage in `open-law/workflow-coverage.json`; authored outcomes and guidance
  in the definitions selected by `open-processes/catalog.json`. Historical import findings
  remain in the [original audit](https://github.com/ultrametricai/ultrametric/blob/c156feeb4de636e5d2854ddf14b13955c2da85ac/content/processes/legacy-audit.json).
- `open-rankings` — `open-rankings/arena-roadmap.json`: every arena tiered by priority and
  marked live or planned.
- `open-modules` — `docs/OPEN-MODULES-GAPS.md`: the corpus-wide candidate table with BUILT,
  SKIP, and DEFER verdicts.
- `open-startup-sim` — `open-startup-sim/README.md`: the simulator's scope and its
  disclosed assumptions and multipliers.
- `open-law` — `open-law/map.json`: maturity grades per domain and sub-area, with the
  missing rules listed.
- `open-lore` — `open-lore/registry.json` with `open-lore/schools.json`: the
  topic-by-school matrix and its thin cells.
- `open-documents` — `open-documents/README.md`: exclusions, dead-link corrections, and the
  use cases with no openly published document.
- `open-artifacts` — its `index.json` entry here carries the headline gaps (bot-walled
  authority pages, unverified country equivalents); `open-artifacts/fields.json` records the
  detail per field, where each country entry is either a sourced government equivalent or a
  `status` of `unverified` / `no-equivalent`.
- `rankings-engine` — `open-rankings/staleness-report.json`: evidence age per arena and
  product against the freshness windows.
- `lib` — `lib/README.md` for the layer map; `docs/repo-split-census.json` for the test
  suites that gate it.
- `jurisdictions` — `jurisdictions/registry.json`: per-jurisdiction scope and coverage
  grade per layer.
- `coverage` — `index.json` itself; this directory is purely the rollup.
- `schemas` — `schemas/README.md`: which contracts exist and which are generated.
- `policies` — `policies/REVIEW_POLICY.md` and `policies/AGENT_POLICY.md`: the maturity
  ladder and the agent ground rules.

## Founder-journey files

The founder-journey taxonomy (`open-law/workflow-domains.json`) and the
jurisdiction-scoped workflow coverage (`open-law/workflow-coverage.json`) live with the
law layer that grades them; [`open-law/README.md`](../open-law/README.md) documents both.

## Contribute here

- **An index update** — when an area's coverage moves (an arena goes live, a legal domain
  gets mapped, a module lands), update that area's entry in `index.json`. The drift test
  fails when a new top-level content area lands without an entry.
- **A coverage entry** — when a jurisdiction-scoped workflow lands, record it in
  `open-law/workflow-coverage.json` at `draft` or `demonstration` maturity (`reviewed`
  requires a named domain expert); the known-gaps field is part of the record.
- **Missing domains** — a domain or lifecycle stage missing from `open-law/workflow-domains.json`, with the
  founder scenario that exposes it; domains without playbooks keep gaps visible.

Gates: `pnpm test __tests__/coverage.test.ts __tests__/founder-ops.test.ts`.

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
