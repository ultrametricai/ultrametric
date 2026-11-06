# API-quality gap repairs, wave 3 (2026-11-06)

Per-cell check of the next twelve products (thirteen arena rows; cubic sits in ai-coding
and ai-code-review) from the post-v6-migration staleness ranking. Waves 1-2 landed in
PRs #623 and #627; iterm2 stays deferred (settled unsupported-churn cell, wave-2 ledger).

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave3.py` appends 45
live-verified rows (fail-closed marker checks); 18 cells stay absent after checking.
Every ledger row carries `publishedVerdict` beside its evidence-check disposition once
judged, and the pre-audit over every upward flip runs before the first push (the wave-2
`preAudit` procedure).

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| make | workflow-automation | 4 | 3 | 1 |
| n8n | workflow-automation | 4 | 4 | 1 |
| pipedream | workflow-automation | 4 | 4 | 0 |
| zapier | workflow-automation | 4 | 5 | 0 |
| retell | voice-agents | 4 | 5 | 1 |
| penpot | design-tools | 4 | 3 | 2 |
| fastmail | email | 4 | 1 | 3 |
| zero | email | 4 | 1 | 3 |
| orama | search-infra | 4 | 1 | 3 |
| mparticle | customer-data-platforms | 4 | 5 | 1 |
| cubic | ai-coding | 4 | 4 | 1 |
| cubic | ai-code-review | 4 | 4 | 1 |
| jira | project-management | 4 | 5 | 1 |

Wave-3 specifics:

- One preserved probe counter-check records Retell's unpublished spec (the reference is
  generated from an internal "openapi-final" document; every public spec URL 404s).
- Orama's own docs state its Cloud REST APIs are private ("can only be accessed by
  authorized users"); that state row covers all four absences with a citation.
- Zero has no docs site and no public HTTP API; the repository's MCP.md prose is the
  appended context row.
- Fastmail's surface is JMAP: the appended row scopes the session/capability discovery
  model exactly (authenticated runtime discovery, IETF RFCs as the spec documents, no
  OpenAPI).
- Scope caveats ride in the excerpts: Make's spec is GitBook-hosted and unadvertised, and
  its runner targets production zones; n8n's playground warns "you can change or delete
  real data" inside the interactive-docs row; Zapier's ZPS is a partner-program
  workspace and its version lifecycle governs partner integrations, not the public REST
  APIs; Retell's test surfaces and staging tags live in the production workspace at
  production rates; Penpot's OpenAPI and Swagger UI are auto-generated, flag-gated
  surfaces; mParticle's isolation is a per-event environment flag; cubic's Members spec
  is published per endpoint; Jira's sandboxes are Premium/Enterprise product sandboxes
  plus free developer sites.
- Bot/auth walls: Atlassian's cloud-development-environment page sits behind a login
  wall; reachable vendor substitutes are cited. docs.mparticle.com's llms.txt and
  /changelog/ are soft 404s (the real changelog is changelog.mparticle.com).

Scoped re-judges run under the ratified v6 rubric, then `derive` per touched arena and
the dependent generators. Engine output is accepted as-is; honest negatives ship, and
checked-absent cells that publish as engine partials on adjacent evidence are recorded
with both readings.

Row-level output: `2026-11-06-api-quality-wave3.json`.
