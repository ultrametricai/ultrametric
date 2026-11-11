# API-quality gap repairs, wave 10 (2026-11-09)

Per-cell check of the next twelve rows from the corrected staleness ranking (roster
picked on post-#644 main, 49 gap rows; waves 1-9 = PRs #623, #627, #630, #632, #634,
#639, #641, #643, #644, with the scan signature fix in #636). The recording run was
interrupted by a network outage on 2026-11-06 after the evidence append completed; on
resume (2026-11-09) current main was merged in, the scan re-confirmed all twelve roster
rows still unrepaired, and every marker and negative check was replayed live with zero
drift. iterm2 stays deferred, foreloop stays excluded pending its ruling, and the two
kimi cells escalated in PR #644 ship as judged and are not reworked here.

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave10.py` appends 34
live-verified rows fail-closed, backing 24 appended cells; 24 cells stay absent after
checking. Eleven fail-closed negative checks replay the asserted dead URLs, four
counter/context rows are preserved against refresh clobbering (undermind's MCP-only
surface, luma's and pika's explicit no-sandbox statements, hummingbird's password gate),
and curl runs with --http1.1 globally (tech.sevdesk.com fails HTTP/2 negotiation but
serves HTTP/1.1 normally).

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| sevdesk | accounting | 4 | 4 | 2 |
| channel3 | agentic-commerce | 4 | 3 | 1 |
| undermind | ai-research-agents | 4 | 1 | 4 |
| kling | ai-video | 4 | 2 | 3 |
| luma | ai-video | 4 | 4 | 1 |
| pika | ai-video | 4 | 3 | 2 |
| aircall | business-phone | 4 | 3 | 1 |
| quo | business-phone | 4 | 3 | 1 |
| pomelo | card-issuing | 4 | 3 | 2 |
| gitea | code-hosting | 4 | 3 | 2 |
| alloy | compliance-screening | 4 | 4 | 0 |
| hummingbird | compliance-screening | 4 | 1 | 4 |

Wave-10 specifics:

- Two no-public-docs rows ship all-none: undermind (MCP-only surface, user-scoped OAuth;
  spec/docs hosts 404 or unresolved) and hummingbird (the entire ReadMe docs project is
  password-gated; the gate page is the only public content).
- Explicit vendor sandbox denials recorded verbatim and preserved: luma ("There is no
  staging or sandbox environment.") and pika ("no separate test environment. Every
  generation runs against production...", with the free catalog/quote reads framed by
  the vendor as "the closest thing to a sandbox").
- Alloy's Sandbox mode lands with the vendor's own isolation caveat carried verbatim:
  the modes "are *not* two separate environments... Alloy does not enforce a data
  boundary" (single shared data store) — the judge weighs that against the
  isolated-from-production bar. Pomelo's test environment is a dedicated Stage (separate
  api-stage/private/mTLS hosts plus a Stage-only transaction simulator); the vendor term
  is Stage, not sandbox, and access is integration-provisioned.
- Strong versioning finds: quo's date-based policy (required Quo-Api-Version header,
  frozen versions, "No version disappears quietly" retirement commitment) and sevdesk's
  X-Version resource versioning with a Deprecation response header and a dated API News
  changelog. kling's changelog carries dated discontinuation notices and a continuation
  commitment, cited from the CDN content chunks because kling.ai's HTML routes are a
  soft-200 SPA shell (a rotated chunk hash fails the replay and forces re-derivation).
- Identity and rebrand states recorded: quo is formerly OpenPhone (openphone.com
  301-redirects; the spec's S3 bucket keeps the old name); pika's vendor platform is an
  aggregator API ("Generate video, image, and audio with hosted models." across
  multiple providers), carried as scope.
- Gitea's spec and Swagger UI are instance built-ins live-verified on the vendor-run
  gitea.com; its sandbox cell stays absent (try.gitea.io is NXDOMAIN and demo.gitea.com
  is undocumented as a demo).
- Reachability: kling.ai and developers.aircall.io soft-200 unknown paths
  (content-verified); docs.klingai.com/docs.kling.ai/docs.pika.art and the hummingbird
  developer subdomains do not resolve; api.pika.art answers 403; the aircall Postman
  workspace serves an unverifiable JS shell (control fetch curl error 35 — documented,
  not circumvented).

Scoped re-judges run under the ratified v6 rubric (ai-video, business-phone, and
compliance-screening judged category-wide), then `derive` per touched arena and the
dependent generators. Engine output is accepted as-is; honest negatives ship.

Four checked-absent cells publish as engine partials on adjacent evidence and carry both
readings (aircall api-interactive-docs q3; pika, pomelo, and gitea api-versioning-policy
on versioned paths without policy pages — the jira/dynadot classes).

## Pre-audit (before the first push)

54 verdict-level up-moves vs merge-base a35dff5507 (28 target cells, 26 side-effect
flips), re-read against the v6 on-axis bar. Zero inputs corrections this wave; eleven
thin or adjacent partials conceded and documented in the ledger JSON. The full-verdict
ups ground in live spec downloads, vendor-hosted or instance-built-in runners, a
dedicated Stage environment, and committed versioning policies, with gating, isolation,
and aggregator-scope caveats carried in the cited excerpts (alloy's sandbox publishes as
partial q4 with the vendor's own no-data-boundary caveat quoted in the verdict's
support). Honest downs ship (21).

## Review round (PR #691)

One P2, script-class: reruns skipped marker verification for already-saved rows, so the
promised rotated-chunk replay never ran on reruns. The fix moves verification before the
existing-ID skip, and the hardened replay immediately proved its worth by catching live
drift: luma's FAQ dropped its committed deprecation-window sentence between 2026-11-06
and 2026-11-10 while a dated changelog page appeared. The versioning row was re-derived
to the current wording (changelog pre-announcement, X-API-Version reports-not-selects,
migration-guide notice periods, with the removal carried as a caveat) and ai-video was
re-judged: luma api-versioning-policy honestly downgrades to partial q6, and the one
re-roll up (video-inpaint-restyle full q7) grounds in verbatim vendor quotes.
developer.aircall.io rate-limited the repeated replays and now carries the same
20-second courtesy pacing as developers.fellow.ai.

A second-round P1 flagged luma video-inpaint-restyle at full q7 while its own rationale
listed untouched-area preservation as missing. The appended scoping row records Modify
Video's actual semantics (global adherence modes with motion and performance
preservation; no masking, region selection, or untouched-area guarantee documented), and
the re-judged cell settles at partial q5 citing it.

A third round flagged two side-effect fulls whose rationales named a missing
requirement. Both had direct evidence available: the Gitea machine spec's Milestone
model carries due_on (appended as its own row; the cell now publishes full q9 citing
it), and Quo documents per-call summaries by call ID with a dedicated call-summary
webhook and a business/scale plan gate (full q7 citing it). Re-rolls pre-audited; honest
downs ship.
