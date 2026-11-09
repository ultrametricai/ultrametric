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
