# Coverage — domains, lifecycle, and coverage map

The coverage map of the founder-ops corpus: `domains.json` records what the corpus *intends*
to cover, `coverage.json` records what it honestly covers *today*. `domains.json` is the full
founder-journey taxonomy (formation → governance → finance → tax → equity → fundraising →
people → product → revenue → trust → operations → international → exit), including domains
that have no playbook yet. `coverage.json` is the machine-readable coverage registry: which
scenarios have workflows, at what maturity, with what known gaps — consumed by
`lib/founderOps.ts`'s coverage checks in CI and by contributors deciding where to land work.
No one may claim a country is covered because a few playbooks exist — see
`governance/REVIEW_POLICY.md`.

## How this maps onto the rest of the repo

- **Arenas** (`data/categories.json`, rendered at `/arenas`) are the vendor-evaluation cut of
  the same territory: each domain's tooling questions become head-to-head, evidence-judged
  product rankings.
- **Operational processes** (`processes/corpus.json`, rendered at `/processes`) are grouped into
  nine operating areas (`lib/processRows.ts` `AREA_ORDER`) that crosswalk onto these domains:
  Starting up → start/formation, Fundraising & investors → fundraising, Money & finance →
  finance, Team & payroll → people, Legal → governance, Ongoing compliance & tax → tax,
  Running operations → operations/trust, Building & shipping → product, Growth & sales →
  revenue.
- **Jurisdiction-scoped workflows** (`processes/<domain>/<jurisdiction>/` in this tree) are the
  legal-rigor layer: source-cited, dated, with explicit applicability and human-approval gates.

Coverage in `coverage.json` tracks only the jurisdiction-scoped workflow layer. The operational
corpus and the arenas publish their own coverage honestly on their own pages.

## What you can contribute here

- **An honest coverage entry** — when you land a jurisdiction-scoped workflow, record it in
  `coverage/coverage.json` at `draft` or `demonstration` maturity (`reviewed` requires a named
  domain expert; see `governance/REVIEW_POLICY.md`). Never mark a country covered because one
  workflow exists — the known-gaps field is part of the record.
- **Taxonomy gaps** — a missing domain or lifecycle stage in `domains.json`, with the founder
  scenario that exposes it. Domains without playbooks are welcome; they are how gaps stay
  visible.

Gate for both: `npx vitest run __tests__/founder-ops.test.ts` (`lib/founderOps.ts` coverage
checks).

## Source-library audit

`node scripts/content-audit.mjs /path/to/content-audit.json` exports a source-library audit. Keep exports outside the public data tree. From a checkout of the private [ultrametric-api repository](https://github.com/ultrametricai/ultrametric-api), the operator command `node scripts/publish-content-audit.ts --file <report.json>` validates and stores a committed-source export in its private database. Only the API's authenticated staff dashboard serves the stored report. Exporting does not publish or deploy anything.

The audit inventories shared processes and legacy situation markers, vendors and arena stories, documents, module source files, registered jurisdictions, rules, sources, resources, and business artifacts. It resolves explicit IDs, module-to-process mappings, and declared document and artifact links. It reports missing outcomes or guidance, incomplete verdict evidence, missing review metadata, and unresolved references without changing records. Vendor products use arena-qualified IDs. A shared record with `metadata.kind: situation` stays identifiable as a legacy situation marker when its shared `kind` is still `process`.

The report includes the source commit, dirty-state flag, input hash, and generation time. Counts measure the committed inventory, not complete domain coverage. Review dates and test-file presence are recorded evidence; they do not establish expert approval, URL liveness, passing tests, or API publication. No aggregate quality score is calculated. Existing narrow jurisdiction coverage claims are retained. Source lookups must succeed; malformed or missing required input fails generation instead of producing an empty or partial report.

Run `node --test scripts/content-audit.test.mjs` for the report's checks. No model, remote probe, or external effect runs during report generation.
