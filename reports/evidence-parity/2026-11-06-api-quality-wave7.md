# API-quality gap repairs, wave 7 (2026-11-06)

Per-cell check of the next twelve rows from the corrected staleness ranking on post-#639
main (85 gap rows; waves 1-6 = PRs #623, #627, #630, #632, #634, #639, with the scan
signature fix in #636). iterm2 stays deferred (wave-2 ledger). foreloop is skipped by
instruction: it is Ultrametric's own product with two human-adjudicated cells awaiting a
maintainer ruling, and its repair lands after that ruling as its own disclosed,
bias-audited PR.

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave7.py` appends 37
live-verified rows (fail-closed; five markers re-derived against live wording: a curly
apostrophe, an HTML-entity apostrophe, a markdown-link split, a code-tag span, and
compact-JSON spacing) backing 33 appended api-quality cells (glama, appwrite, and unit
each carry a second row under one story) plus one pre-audit correction row (the homebrew
license statement); 15 cells stay absent after checking.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| activepieces | workflow-automation | 4 | 3 | 1 |
| open-webui | self-hosted-assistants | 4 | 3 | 1 |
| dynadot | domain-registrars | 4 | 2 | 2 |
| glama | mcp-infrastructure | 4 | 5 | 0 |
| requesty | model-gateways | 4 | 3 | 1 |
| homebrew | package-managers | 4 | 1 (+1 pre-audit) | 3 |
| google-workspace | sso-identity | 4 | 3 | 1 |
| microsoft-entra | sso-identity | 4 | 4 | 0 |
| floot | vibe-coding | 4 | 1 | 3 |
| appwrite | backend-as-a-service | 4 | 5 | 0 |
| unit | banking-as-a-service | 4 | 4 | 1 |
| lever | applicant-tracking | 4 | 2 | 2 |

Wave-7 specifics:

- One recorded POST probe: floot's MCP endpoint (its only programmatic surface) answers a
  params-less `initialize` with a JSON-RPC -32603 validation error over HTTP 200,
  grounding the manifest row's live-responder claim; the fail-closed check replays it.
  floot's other three cells are honest nones (floot.com/changelog soft-renders the home
  shell despite HTTP 200).
- Scoped appends carry their limits verbatim: open-webui's Swagger surface is a built-in
  on the integrator's own instance gated behind `ENV=dev` and declared experimental;
  glama's hosted MCP Inspector tests arbitrary third-party servers, not an isolated
  sandbox of its own directory API; homebrew's JSON data API has no formal
  API-description artifact; appwrite's Cloud environments live inside a project and the
  docs never say sandbox; microsoft-entra's spec, explorer, and 24-month deprecation
  window are Microsoft-Graph-wide with the Entra resources as a subset, and its developer
  sandbox tenant is eligibility-gated and Microsoft-365-wide; lever's sandbox is
  partner/integrator-gated and its compatibility commitment is a single sentence.
- Material counter-caveats carried in the excerpts for the judge to weigh: dynadot's
  RESTful docs are labeled Beta ("backward compatibility is not guaranteed") next to its
  SemVer statement; google-workspace's APIs Explorer "acts on real data", its
  deprecation-policy page is legacy-labeled naming no Workspace service, and the current
  terms reserve discontinuation rights.
- Reachability: api.dynadot.com and hire.lever.co are soft-200 hosts and
  appwrite.io/docs/*.md mirrors soft-200, so every row on those hosts is content-verified;
  github.com/appwrite/spec (singular) is 404 (the real repo is appwrite/specs); unit's
  live sandbox base is api.s.unit.sh (older references name api.s.unitapi.co). No bot
  walls were hit.

Scoped re-judges run under the ratified v6 rubric (sso-identity judged category-wide for
its two touched products), then `derive` per touched arena and the dependent generators.
Engine output is accepted as-is; honest negatives ship: floot's api-quality row is
all-none (the MCP manifest row grounds the absences), homebrew keeps three nones around
its data-API spec none, lever keeps two nones around its sandbox and versioning partials,
and dynadot keeps its spec none. Two checked-absent cells publish as engine partials on
adjacent evidence and carry both readings (dynadot api-interactive-docs partial q4 on the
sandbox row's parallel per-command examples; unit api-interactive-docs partial q4 on the
vendor-documented Postman trying path, the fivetran/jira class).

## Pre-audit (before the first push)

64 verdict-level up-moves vs merge-base b9083e5edc (32 target cells, 32 side-effect
flips), re-read against the v6 on-axis bar; review-fix re-rolls included. One
artifact-backed correction: homebrew openness-open-license had gone none to partial q3 on
off-axis quotes (analytics, a formula path) because the pack carried no license row.
Appending the Homebrew/brew README license statement (homebrew-license-20261106) and
re-judging grounds the cell, which now publishes full q9 on the verbatim BSD-2-clause
quote. Eight thin partials are conceded and documented in the ledger JSON; the
full-verdict ups are grounded in dedicated environments, live spec downloads, and
vendor-hosted runners with their scope caveats carried in the cited excerpts. One
side-effect flip to disputed ships as judged (open-webui knowledge-base-rag, conflicting
community rows), and honest downs ship.
