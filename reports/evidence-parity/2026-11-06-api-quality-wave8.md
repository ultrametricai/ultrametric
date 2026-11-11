# API-quality gap repairs, wave 8 (2026-11-06)

Per-cell check of the next twelve rows from the corrected staleness ranking on post-#641
main (73 gap rows; waves 1-7 = PRs #623, #627, #630, #632, #634, #639, #641, with the
scan signature fix in #636). iterm2 stays deferred (wave-2 ledger) and foreloop stays
excluded pending the maintainer ruling (wave-7 ledger).

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave8.py` appends 46
live-verified rows fail-closed at wave start, plus three in the PR #643 review round (49
total), backing 34 appended cells (several products carry scoping or counter rows beyond
their cited cell rows); 14 cells stay absent after checking. Eleven fail-closed negative
checks replay the asserted 404s (#502 convention). Five counter rows are preserved
against refresh clobbering: workable's disabled spec download, granola's explicit
no-sandbox FAQ answer, obsidian's separate-dev-vault guidance, Azure's retired Learn
sandbox, and fellow's webhooks scope.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| workable | applicant-tracking | 4 | 3 | 3 |
| oneleet | compliance-automation | 4 | 4 | 1 |
| sprinto | compliance-automation | 4 | 2 | 3 |
| braintrust | llm-evals-observability | 4 | 3 | 1 |
| aws | cloud-platforms | 4 | 5 | 0 |
| azure | cloud-platforms | 4 | 6 | 0 |
| google-cloud | cloud-platforms | 4 | 6 | 0 |
| onedrive | cloud-storage | 4 | 5 | 0 |
| unity | game-engines | 4 | 3 | 1 |
| fellow | meeting-ai | 4 | 4 | 2 |
| granola | meeting-ai | 4 | 4 | 1 |
| obsidian | notes-knowledge | 4 | 4 | 2 |

Wave-8 specifics:

- The hyperscalers are scoped, not inflated: AWS's machine models are Smithy JSON AST
  (not OpenAPI, GitHub-hosted, "generated from other sources"); CloudShell is a
  pre-authenticated console shell, not a reference runner; the Free Tier is credits on a
  real account; DynamoDB local, Azurite, the Cosmos DB emulator, and the Firestore
  emulator are appended as vendor-owned but service-scoped local emulators. Azure's
  Microsoft Learn sandbox is retired ("Sandboxes are no longer available.", preserved
  counter row). Google's APIs Explorer "acts on real data" and its deprecation policy
  excludes pre-GA surfaces; the 12-month notice is contractual (Cloud terms 1.4(e)).
  Microsoft's 12-month Modern Lifecycle notice explicitly covers REST APIs.
- Explicit vendor negatives recorded verbatim: workable's served config disables the
  OpenAPI download ("show_openapi_download":"disabled"); granola answers the sandbox
  question "Not currently." in its API FAQ; obsidian's test guidance is a self-managed
  separate vault. sprinto's schema surface is key-gated GraphQL introspection with no
  downloadable artifact.
- Scope caveats ride in the excerpts: fellow's spec has no vendor-branded download path
  (ReadMe api-registry endpoint) and its API is paid-plan and workspace-admin gated;
  granola's keys are Business/Enterprise-gated;
  obsidian's machine spec is a typed in-process plugin API (no HTTP API exists; the
  community Local REST API plugin is third-party and not credited); unity's deprecation
  window (three months to a year, plus two months' shutdown notice) is materially
  shorter than the other cloud vendors' 12-24 months; onedrive's surfaces are Microsoft
  Graph with the files resources as a subset.
- Reachability: docs.obsidian.md and help.obsidian.md are Obsidian Publish soft-200
  hosts (rows cite the publish-01.obsidian.md content endpoints; absence grounded in the
  full 1347-page index); cloud.google.com soft-200s (content-verified);
  services.docs.unity.com is a redirect shell (live host docs.unity.com). Walls
  documented, not circumvented: *.sprinto.com/dev-api/explorer answers CloudFront 403 to
  non-browser clients, and developers.fellow.ai rate-limited the recording run with
  sustained, UA-independent HTTP 429 for over three hours, so the fellow cells first
  shipped citing the reachable surfaces only (the ReadMe api-registry spec document and
  the help-center article) with the observed Try It! runner withheld fail-closed. The
  limit cleared during the PR #643 review round: the Try It! and webhooks-scope rows
  were then appended fail-closed (with 20-second per-host courtesy pacing in the
  script), the spec excerpt was restored with replayable 404 negatives, and the
  verification-blocked cell closed as evidence-appended (partial q7).

Scoped re-judges run under the ratified v6 rubric (compliance-automation,
cloud-platforms, and meeting-ai judged category-wide), then `derive` per touched arena
and the dependent generators. Engine output is accepted as-is; honest negatives ship:
obsidian's api-quality row is all-none (the plugin-API and URI rows ground the absences
for a product with no HTTP API), workable and sprinto keep their spec-class nones or
thin partials, and granola's sandbox none rests on the vendor's own "Not currently."
Three checked-absent cells publish as engine partials on adjacent evidence and carry
both readings (braintrust api-sandbox q4, sprinto api-machine-spec q5, workable
api-versioning-policy q3 — the fivetran/dynadot class).

## Pre-audit (before the first push)

60 verdict-level up-moves vs merge-base 274a924094 (35 target cells, 25 side-effect
flips), re-read against the v6 on-axis bar. Zero artifact-backed corrections this wave;
seven thin partials conceded and documented in the ledger JSON. The full-verdict ups are
grounded in live spec downloads or canonical vendor model repositories, isolated test
environments, and committed deprecation windows, with format, hosting, gating, and
window-length caveats carried in the cited excerpts. Honest downs ship (21 verdict-level
downs across the re-rolled rows).

## Review round (PR #643)

One P1 covering two cells, fixed inputs-only. fellow automation-rules-engine had been
credited on webhook building-block quotes: the preserved webhooks-scope row records that
the integrator supplies the receiving endpoint and all action logic and no in-product
rules engine is documented, and the re-judged cell settles at none q0. workable
agentic-nl-commands had been credited on transferred MCP-access quotes: the appended row
quotes the vendor's own MCP documentation of conversational operation ("create or
approve leave requests conversationally", "without leaving your AI interface"), and the
cell publishes partial q6 citing that direct evidence. The developers.fellow.ai rate
limit cleared during the round, closing the verification-blocked cell (Try It! row
appended fail-closed; fellow api-interactive-docs partial q7) and restoring the spec
excerpt's replayable 404 negatives. The re-roll was pre-audited: fellow
automation-bulk-operations none to partial q3 is a conceded thin partial (Super Admin
API workspace-wide export plus recording-status monitoring), and honest downs ship.
