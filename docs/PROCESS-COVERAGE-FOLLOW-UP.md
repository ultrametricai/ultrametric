# Process coverage — schema and content follow-up

**Status:** agreed direction; implementation plan, not a schema change. Written 2026-10-02.
Finish the current card UI iteration separately from the longer research, migration, and
content-update run. Public processes remain open; managed execution and company-specific
instructions add capabilities without gating the public source.

## Starting point

This plan inspects local `codex/process-header-v2` based on `5b8af800`. Newer main was reported
at `49a37495`; reconcile its judge, roster, and icon changes before implementation. Preview
scores are snapshot results, not fresh research or assertions about current vendor capability.

Today, canonical parts/options name candidate vendors or products. `processes/vendor-registry.json`
resolves vendor aliases to arena/product IDs. Separately, `data/process-step-stories.json`
links legacy task/node IDs to arena stories; product/story verdicts and evidence produce step
scores and process rollups. The preview joins these through an explicit C-Corp adapter.
Legacy `route` metadata is independent of that evidence. It must not become an assessed
execution method merely because it says `agent`.

## Target model

These are relationships and semantics to design, not final field names or JSON contracts.

| Record or relationship | Required meaning |
| --- | --- |
| Canonical step/option → coverage stories | Stable process, part, nested-option scope and story identity; explain relevance and applicability. Support several stories per activity and reuse without flattening alternatives. |
| Vendor → product | Normalize vendor/company identity separately from evaluated product identity. Preserve aliases and arena-qualified product IDs; support multiple products per vendor. Candidate eligibility and judged coverage are separate relationships. |
| Product + story + execution method assessment | Record supported Who/How/Where combinations, verdict, quality/confidence, evidence, conditions, and provenance. A product-wide interface link is not proof of step coverage. |
| Applicability | Explicit geography, entity type, prerequisites and relevant account/product constraints at the scope where they apply. Unknown applicability must not silently become global or default-US. |
| Evidence and freshness | Source URL/locator, excerpt or observation, source/fetch/check dates, assessor/method/version, and review history. Distinguish documentation claims from tested execution and retained legacy annotations. |

Execution taxonomy:

- **Who:** Agent or Human. Represent handoffs/mixed work explicitly rather than forcing a
  whole step into one actor.
- **How:** Agent-native, Computer use, or Manual. Agent-native subinterfaces are plugin,
  MCP, API, and CLI; multiple supported interfaces may coexist.
- **Where:** Online or In person. Preserve applicable combinations and geographic limits.

Story persona is the beneficiary/user, not automatically Who performs the work. Neither a
vendor's API availability nor a story mentioning an API establishes that the step can run
through it. Each claimed product/story/method combination needs evidence.

Keep **unknown/unassessed**, **evidenced unsupported**, **unavailable in this context**, and
**not applicable** distinct. Missing evidence is not a negative verdict; a genuine scored zero
is not missing. Hide unanswered UI metrics, but retain coverage gaps in the authoring audit.

## Scores and scope

Reuse the reviewed scoring implementation after reconciling main; do not introduce a new
formula in the UI. Expose contributing stories, weights, judgments and source evidence.
A capability score is not an automation probability.

Show the aggregation denominator: rated applicable steps versus all applicable steps. Never
combine mutually exclusive alternatives or count unassessed work as covered. Until a path is
resolved, identify the default or scoped slice explicitly. Preserve the current preview's
honest limitation: three rated steps among twelve top-level C-Corp parts, not full coverage.

The filing mapping currently belongs to `form_001:n4:default`, not its India/UK/Germany/France
alternatives. The name-check step points to Delaware but lacks an authored applicability
condition; it also lacks coverage stories. Resolve both gaps through content research.

## Longer-run delivery

1. Reconcile current main and inventory canonical scopes, aliases, existing story bindings,
   unmapped steps, and ambiguous geography. Record a versioned baseline and migration report.
2. Design and validate the relationships above with small fixtures: a simple step, a default
   plus geographic alternative, a vendor choice, a human handoff, and a referenced process.
3. Migrate reviewed legacy bindings to exact canonical scopes. Preserve IDs and provenance;
   do not automatically inherit parent/default assessments into alternatives. Keep old readers
   working during the additive transition.
4. Research missing coverage stories and product assessments in bounded batches. Prefer
   primary sources; record method-specific evidence and applicability. Review uncertain or
   consequential claims before treating them as executable guidance.
5. Keep legacy pseudocalls such as `GET /api/name-availability?...` audit-only until a named
   provider, documented endpoint/tool binding, authorization contract and evidence exist.
   Never restore them merely because a manifest labels them `api`.
6. Add optional authored descriptions, activity types, and separate **Active**/**Wait** timing
   estimates with units, basis, conditions and checked date. Generic `estimatedMinutes` plus
   `async` does not prove an active/wait split; summed durations are not elapsed completion.
7. Establish a repeatable update/research workflow: identify changed sources or stale
   assessments, reassess affected cells, recompute impacted aggregates, review diffs, and
   validate before publishing. Choose cadence and ownership separately; no monitor is created
   by this plan.

## Bounded acceptance checks

- Every binding resolves stable product/story and canonical step/option identities.
- Default, geographic and nested scopes remain isolated; no silent vendor-driven DAG pruning.
- Fixtures cover unknown, unsupported, unavailable, not-applicable, genuine zero and stale data.
- Scores recompute from cited judgments; denominator and exclusions are visible and tested.
- No generic API inference, invented jurisdictions, restored pseudocalls, or fabricated timing.
- Catalog/schema checks, migration preservation checks, relevant tests and old-reader
  compatibility pass; desktop/mobile evidence demonstrates the intended rendering.

## Today's UI lane — separate approval and delivery

Keep the existing local selector, profile links, coverage expansion, responsive hero and card
styling. No schema/research expansion is needed to continue reviewing card presentation.

Current batch, **approved for local implementation**: inventory actual structural step, decision, and linked-process cards, then unify their
context, named links, vendor choices, options, nested content, and existing assessments. Use
C-Corp plus representative linked-process and nested-option records for review; waiting and
signing annotations do not establish new schema types.
Use existing data only: no new provider claims, timing splits, jurisdiction behavior or legal
assessments. Unsupported distinctions remain unresolved rather than invented for the mockup.

### Observed card inventory and batch scope

The 150-record snapshot contains 846 parts: 695 steps, 38 decisions and 113 linked-process
references. Overlapping content includes 164 parts with service candidates, 35 with URLs,
nine with explicit applicability annotations, and seven options containing nested parts.
There are 86 async and 33 signature annotations, but these are not independent card types.
Only the approved formation chooser currently has authored part guidance.

The local UI batch unifies named links, optional guidance/notes,
compact option rows, nested cards and linked-process navigation. It preserves the existing
selector and exact-scope assessments; the name-check card visibly qualifies its unverified
legacy Agent classification. Missing copy, coverage, jurisdiction conditions and timing remain
content-work gaps rather than generated UI filler.

Receipt semantics also need authoring review: receiving the incorporation certificate may be an
outcome/wait milestone required by later work; verifying or safely storing it is a separate
meaningful action. Do not relabel the existing node, invent storage integration, or alter its
dependencies merely to make a fuller card. Decide the intended milestone/action model and its
coverage stories during the longer content run.

## Outcome-based grouping direction for the next quality pass

Top-level cards should contain a meaningful unit of work and its completion evidence.
The proposed “Complete founder stock purchases” parent would contain preparation,
required approvals, signatures, applicable payment/consideration, and issuance/transfer
confirmation. Author and verify missing actions before changing the graph; do not simply
rename the current preparation or signature card and imply that the purchase is complete.

The current form_001 sequence is n7 preparation → n7b purchase-agreement signatures →
n8a election signature → n8 election filing. It has no explicit payment, receipt,
issuance/transfer confirmation, or stock-ledger completion node. The legacy n7 prompt
prepares drafts and stops before approval/finalization; n7b also describes preparing a
signature envelope rather than completed execution. startup_002 adds cap-table recording,
but is not referenced by these formation nodes and does not fill their payment gap.

“Complete the 83(b) election” is a proposed parent for the applicable, chosen election,
with preparation, signature, filing, proof, and required copies inside. Eligibility and
whether to elect remain explicit decisions. The existing demonstration record
`equity.us-de.83b-election` already distinguishes actual transfer evidence and consideration
paid from signature, then assessment, preparation, filing proof, and copies. It is not
linked from form_001 and its independent tax review is pending. Reconcile against official
sources before adoption; do not infer applicability from every stock purchase or signing
an agreement. This direction is recorded for authoring review only; no nodes, names,
edges, completion claims, or legal applicability have been changed in this UI pass.

## Open decisions

- Where should reusable stories and scoped coverage bindings live, and how are revisions pinned?
- Should execution variants attach to stories, product/story assessments, or both?
- How should mixed actors/methods and partially resolved geography affect aggregation?
- Which vendor identity authority resolves aliases across arenas and product families?
- Who reviews content, what freshness policy applies by claim type, and how are changes queued?
