# Process UI release candidate

Integrated local branch: `codex/process-ui-integration` in sibling `ui-integration`.
Pinned base: public main `06fa7b8a7989cf0a1f9afd0912a0887c3e4be6a8`, verified on the remote
at integration start. All 162 incoming shared records are retained. Prototype checkpoint
`7c5fdccfd` on `codex/process-ui-release` preserves the earlier verified 150-record version;
its port-3220 working preview also receives the approved small presentation refinements.
The integrated preview runs on port 3221. No push, published PR, public-main merge or deployment.
The original Mac repository and task-2 checkout remain untouched.

## Approved boundary

Additive preview routes first. Existing public process routes remain. Preview metadata
stays noindex; only preview ID/alias URLs redirect to their readable preview slug.

- `/processes/v2`: existing index presentation over the shared catalog; `/processes/preview` redirects here.
- `/processes/[readable-slug]/v2`: shared detail and graph; old `/processes/preview/[slug-or-ID]` links redirect here with their query and fragment.
- `/processes/incorporate-c-corp/v2`: original incorporation experiment remains available.

No new schema fields, dependencies, lockfile edits, legacy source-data or ranking-formula changes. The existing equal-step coverage calculation
is extracted into a shared helper without changing the overall leaderboard.
The previously approved explicit-default migration covers 38 decisions in 36 records,
including its importer/audits/preservation checks and formation chooser guidance.
Current-main YC content and all 12 reactive situations are preserved.

## Included UI

- Incorporation hero: existing gallery asset displayed at 256px on desktop, separate
  64px asset on mobile. Typography and controls follow the restrained preview treatment.
- Reused index layout, filters, search and sorting. 123 exact 24px gallery icons copied
  read-only with explicit mapping; YC and chains retain their existing icons. The two
  equity records without legacy assessments have blank metric cells, not invented data.
- Incoming situation kind/trigger/urgency, grouping and timeline behavior remain on the
  existing index. Preview-specific absent equity metrics stay blank and sort last, including
  descending Timeline. Existing Global persistence files are unchanged from pinned main.
- Readable, collision-safe routes for all 162 records; internal preview and related links
  use them. Original IDs and canonical authored titles are unchanged.
- One bound regional selector where the source supports it (18 records). It changes only
  the owning decision and option content. Other steps are explicitly not region-adapted.
  Selected geographic titles replace that card's heading. Non-geographic options stay.
- Supported positive default-path Agent counts and presentation-only “using AI” suffix.
  Conditional alternatives are excluded; unsupported counts remain absent. Contractor
  onboarding has two Agent classifications, not three. Form_001 n3 remains unverified.
  Approval badges use strict explicit true/false; missing means unknown. Current catalog
  has no agent step with explicit false, so Automatic has only synthetic regression coverage.
  Agent-step approvals are not a prediction of runtime interruptions. Exact irreversible
  metadata is displayed independently, without inferring it from high risk.
- Referenced subprocesses render their actual canonical steps inline, with collapsible
  sections, preserved guidance and links, and independently namespaced comparison scopes.
  Get paid restores accounting, payments and banking choices across its four subprocesses.
  Subprocess headings themselves are links; the redundant Open row is removed, while the
  independent Steps disclosure remains. Its compact default-scope summary is 22 steps, 18 Agent classifications, seven agent-step
  approvals, three human/computer-use and one manual form. Conditional additions/alternative
  paths are excluded. Canonical references resolve recursively with cycle guards; each
  occurrence keeps unique IDs. Root Get paid has no canonical dependency links, so its
  subprocess graphs remain separate without invented cross-subprocess arrows.
- Formation chooser retains all six vendors, independent left selection and internal
  profile links, and only the default-filing score. Current Clerky score 47.1 rounds to 47.
- Other process provider groups use actual comparison arena IDs, independently by type.
  For Set up a 401(k), payroll maps only to n4, team chat only to n5; n1 retirement-provider
  choice remains separate. Group scores use the existing equal-step coverage formula over
  that category’s exact rated comparison scopes; no mixing categories or story-count weighting.
  Provider and step tables share one compact row component, independent selection/profile/evidence
  controls and an integrated More row. Expansions list every scoped step, assessed count and
  denominator, preserving missing assessments versus zero. Scores are labeled default-scope;
  selecting another region explicitly states that these scores do not assess that variant.
  Get paid: payments 12 steps / Stripe 68.8; accounting 5 / Digits 54.4; banking 1 / Ramp 70.4.
- Comparison rows are tightened from 53px to 45px without changing the 32px selection or
  28px evidence controls. The shared “using AI” suffix is darker (#85858f), preserving readability.
- Each step can override or deselect its inherited process choice and return to it.
  Global zero coverage is not auto-assigned, but remains manually selectable. Positive
  selected coverage pins first; other rows retain rankings. Three initial rows, exact
  remaining count, Show fewer, independent evidence control, internal profile links.
  Selections are transient, isolated by record and regional context, and reset on reload.
- Real URL citations remain. Bare vendor associations are not citations. Explicit
  alternatives absent from comparisons remain visible as unscored options.
- Removed repeated “Story coverage, not complete-service equivalence.” copy and linkage
  accordions. One page-level score explanation remains. Bottom related-process links use
  only explicit incoming/outgoing subprocess references; executable reference cards stay.
- Details / Graph switch near the top, Details default. Graph nodes show title plus one
  small execution-type icon with distinct shapes and accessible hover/focus/tap meaning.
  Signature override and unknown types are preserved; Agent does not claim verified execution.
  Directional arrows use only canonical links. Real branches share a layer; no links are
  invented from list order. Edgeless scopes explicitly state that order/independence is
  unspecified. Unlinked nodes in otherwise linked graphs are separated from actual parallel
  branches. Option-local graphs remain separate and labeled with applicability;
  conditional edges are dashed with stated conditions. Unresolved links are counted and
  omitted. Long edges use an outside gutter so intermediate cards cannot hide them.
  Nodes now fit wrapped text (54px for single-line nodes, previously 112px); ResizeObserver
  measurements set layer heights and arrow anchors. Vertical gaps are 32px, previously 64px.
  Edges route below the tallest source-layer card before traversing a gap or outside gutter.
  Desktop/mobile graphs tested 36–45% shorter, without clipping, overlap or arrow/card crossings.
  Process graph headings match Details at 20px / medium / zinc-100; referenced titles link
  through explicit record identity to the same readable preview routes. Applicability labels
  remain separate. Root headings remain unlinked, and node dimensions stay compact.
  Title navigation targets retain at least 44px height. Graph regions scroll within the viewport. Keyboard or pointer activation of a title
  returns to Details, opens enclosing option details, and focuses the exact card. Switching
  views preserves mounted provider, override, evidence and regional selection state.
- Existing overall coverage leaderboard remains at bottom. The shared header is unchanged
  from the PR base; its responsive behavior is outside the preview change.

Scores measure weighted mapped-story coverage, including manual/API workflows. They are
not agent-only scores, automation probabilities, or complete-service equivalence.
Assessed zero means no credited coverage; not-applicable judgments are excluded.

## Verification

Integrated preview: `http://127.0.0.1:3221/processes/v2`.
Preserved prototype: `http://127.0.0.1:3220/processes/preview`.
Evidence is in sibling `../evidence/`, outside the repository:

- `pr96-tests.log`: 257 files, 2,793 tests passed after the pinned PR96 reconciliation.
- `integration-lint.log`, `integration-types.log`: lint has zero errors and 23 existing
  warnings; TypeScript passes. `integration-build.log` records the production build.
- `integration-preservation.json`: all 162 records deeply equal incoming main after reversing
  only 38 approved defaults and formation chooser guidance. Preserves 62 verification annotations,
  21 cost annotations, all requires/produces/producesArtifact values, source provenance and links.
- `pr96-import-preservation.log`: 16,441 source-value checks; import/schema checks
  validate 162 records and eight Python importer tests pass.
- `integration-rankings.log`: rankings determinism unchanged.
- `integration-browser.log`:320/390/1440px checks for Get paid, incorporation, contractor,
  type-specific provider groups, independent step overrides, regional state, graph keyboard
  navigation, readable/legacy routes, original routes and no viewport overflow or browser errors.
- `integration-main-browser.log`: incoming situations and original160-row public index at
 390/1440px; original artifact header; Global selection, reload and cross-page persistence.
- `integration-touch.log`: graph execution-type meaning, touch navigation and keyboard scrolling.
- `density-before.json`, `density-after.json`: both ports,390/1440px;53px→45px comparison
  rows with unchanged controls, linked subprocess titles and keyboard navigation.
- `graph-density-before.json`, `graph-density-after.json`: both ports,390/1440px, all three
  representative processes; measured height reductions, correct arrow anchors, no text
  clipping, no node overlaps, and no sampled edge/card intersections.
- `graph-density-after.png`, `density-after-3221-1440.png`: visual review captures.

The initial dependency symlink was replaced with a local dependency copy because Turbopack
rejects node_modules links outside the project root. Package and lockfile remain unchanged.
A separate read-only review found the descending-Timeline null ordering issue; it was fixed
and regression-tested without changing incoming situation semantics.

## Remaining decisions and deferred content

Publication workflow/branch/PR/merge ownership and production Vercel target remain to be
confirmed. No deployment configuration was changed or deployment script run. Additive
preview scope is already approved; replacing public routes is not part of this change.

See `PROCESS-COVERAGE-FOLLOW-UP.md` for deferred stock completion, conditional 83(b),
registered-agent wording, unmapped nested coverage and typed completion criteria.

## Completed integration

The 40overlapping paths and 17textual conflicts have been reconciled locally. Records were
updated by stable record/part/option IDs; no regenerated record set replaced authored data.
The import manifest retains current source hashes and uses the new default-aware generated
hashes; the provenance audit is regenerated against pinned main. All 97existing alternatives
and all 162 records survive. Source metadata is moved intact into explicit defaults where
appropriate, including newly added verification, cost and artifact fields.

The table retains upstream situation fields and ordering while adding preview links and
nullable assessments. Public route renderers, artifact registry, source corpus, ranking data,
Global persistence implementation, dependency declarations and schemas remain unchanged.
Verification/cost/artifact metadata display in the preview was not added to this UI scope.

The proposed removal of nested subprocess/option/vendor boxes is **not implemented**; it
awaits the user's design decision. The approved title-link and density refinements are included.

Final presentation evidence: `provider-final-browser.log`, `final-providers-390.png`,
`final-providers-1440.png`, `final-graph-headings-1440.png`, and `graph-density-final.log`.
Provider rows measure 44px plus their 1px divider. Both local previews pass at 320, 390,
and 1440px; graph geometry has no clipped labels, overlaps, misplaced anchors or edge/card crossings.
Broader nested-surface flattening remains a proposal and is not applied.

## Bounded PR96 compatibility reconciliation

Preserved pre-check snapshot: `2387a07f2dda59017e9f56e420522df11422f455` on
`codex/process-ui-before-pr96`. Merged only pinned main `06fa7b8a7989cf0a1f9afd0912a0887c3e4be6a8`.
Three conflicts were resolved in form_001, import-manifest and legacy-audit by stable IDs.
All 162 records deep-equal that incoming base after reversing only the 38 existing default
repairs and the approved n1 chooser guidance. The new Clerky method remains as authored;
its parent route metadata supplies the summary classification when no default option exists.
Incoming documents, failureModes, verify/cost and jurisdiction corrections are retained.
No new preview rendering or schema features were added. The incoming legacy renderers and
schema are preserved exactly from the pinned main commit.

Final compatibility evidence: `pr96-preservation.json`, `pr96-tests.log`, `pr96-lint.log`,
`pr96-types.log`, `pr96-build.log`, `pr96-import-preservation.log`, `pr96-schema.log`,
`pr96-rankings.log`, `pr96-browser.log`, and `pr96-main-browser.log` in sibling evidence.

## PR97 review follow-up

Non-geographic default options now open initially; alternatives remain collapsible and
closed initially. Manual collapse persists across Details/Graph switches. The supplementary
leaderboard has one concise default-scope label on processes with a bound regional decision;
selecting a nondefault region states that the selected variant is not assessed. Scores and
ordering are unchanged, and original public routes receive no new scope copy.

Validation: 2,796 tests across 258 files, TypeScript, lint (zero errors; 23 existing warnings),
production build, and targeted Chromium checks at 320/390/1440px. Logs and screenshots use
`review-fixes-*` in sibling evidence. No merge or deployment is included.

## Shared header held at base

The app/layout.tsx styling change was removed at the user's request. This file matches
pinned base 06fa7b8 exactly; no shared-header changes remain in PR97. Future header work
must keep one line at every width and belongs in a separate PR, which is not started here.
Narrow-screen verification distinguishes preview main-content bounds from inherited global
header overflow. Evidence uses `header-restore-*` in sibling evidence.

Header-restoration checks passed: 13 affected tests, TypeScript, layout lint, production
build, and nine browser cases across three routes at 320/390/1440px. At 320 and 390px the
unchanged header makes the page 463px wide; preview main content remains viewport-bounded.
This inherited header overflow is intentionally left for separate work.
