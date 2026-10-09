# PR #171 extraction analysis

Founder question: how can we take the #171 DAG improvements through without changing
the design of the process pages, and are the structural improvements and the layout
changes all together in #171?

Short answer: they are shipped together by construction. The head commit of
`codex/process-route-cutover` replaces the body of `app/processes/[slug]/page.tsx`
(274 lines of the founder-curated DAG page down to a 39-line shared-reader mount), and
most of the structural work (anchor contract, selection restoration, redirects) exists
to make that replacement link-safe. The structural value is real and mechanically
separable: of the 39 changed files, 24 are the cutover and its ripples, 9 are
reader-internal improvements already reachable at the preview/v2 surface with no
canonical change, and 6 form a compatibility/data layer that can be rescoped or ported.

One finding ahead of the buckets: the cutover changes the canonical design while the
founder's design-pin suite keeps passing, because the pins
(`components/__tests__/ProcessDagVendorRows.test.tsx`,
`components/__tests__/StepVendorRow.test.tsx`) assert over `ProcessDag`, which the
gutted page no longer mounts. The reader's step blocks reinstate per-step score links
and expandable product rows (`components/shared-processes/ScoredProductRow.tsx`
`scoreHref`, `#story-<id>` links inside `StepComparisonTable`), which founder
2026-10-05 removed from step blocks ("process-level scores and the product pages keep
their receipts links"). Any port must add a page-level pin so this cannot recur
silently (see "Design-pin guards" below).

## 1. File classification

### Bucket (a) — cutover/layout: 24 files

The canonical-route replacement, the page gutting, the `sharedPreviewHref` →
`sharedProcessHref` rename and its ripples, and tests that exist to pin the cutover.
None of these merge if the process-page design stays.

| File | What the hunks do |
| --- | --- |
| `app/processes/[slug]/page.tsx` | The core cutover: generateStaticParams/metadata/page re-keyed on the shared route registry; the DAG page body (GeoDropdown, ProcessGeoBanner, ProcessLeaderboard, ProcessDag, JurisdictionToggle, ProcessGeoNotes, lens banner) replaced by `<SharedProcessPreview>`. |
| `app/processes/[slug]/manifest.json/route.ts` | Manifest params and lookup re-keyed on the registry so ID/alias slugs serve the canonical payload. The alias coverage itself is portable without the registry (see c-port plan). |
| `app/processes/__tests__/page.test.tsx` | Index tests moved from `buildProcessRows`/`buildPlaybookRows` to `buildCanonicalProcessIndex`. |
| `app/processes/incorporate-c-corp/v2/page.tsx` | The published v2 reader page becomes a 308 to the canonical route. A v2-only rescope reverts this hunk. |
| `app/processes/page.tsx` | `/processes` index rows swapped to shared-record rows. |
| `app/processes/preview/[id]/page.tsx` | Preview reader route becomes a 308 to canonical. A v2-only rescope reverts this hunk. |
| `app/processes/preview/page.tsx` | Preview index becomes a 308 to `/processes`. |
| `app/sitemap.ts` | Process URLs emitted from the shared catalog instead of `loadProcesses`. |
| `content/processes/README.md` | Posture flip: records go from "opt-in reader" to "supply the authored content for canonical pages". |
| `docs/PROCESS-ROUTE-CUTOVER.md` | New doc describing the cutover contract; shelved with the cutover. |
| `lib/__tests__/composed-preview.test.tsx` | Href rename ripple (`/processes/preview/x` → `/processes/x`). |
| `lib/__tests__/preview-index.test.tsx` | Href rename ripple; renders `ProcessIndex` directly since the preview page is now a redirect. |
| `lib/__tests__/preview-selection-related.test.tsx` | Href rename ripple. |
| `lib/__tests__/process-anchor-render.test.tsx` | Pins all 856 legacy `step-<task>-<node>` aliases mounted inside the reader's scopes. Exists to pin the cutover (legacy hashes only ever arrive at canonical URLs). |
| `lib/__tests__/process-route-cutover.test.ts` | Pins the route registry (376 keys, 56 aliases), redirect matcher, alias manifests, canonical metadata. Contains extractable identity pins that are portable (see c-port plan). |
| `lib/__tests__/provider-coverage.test.tsx` | Href rename ripple. |
| `lib/__tests__/shared-process-reader.test.tsx` | Href rename ripple. |
| `lib/shared-processes/index-rows.ts` | Preview index rows re-pointed at canonical hrefs; adds `buildCanonicalProcessIndex` (situations filtered) for the swapped `/processes` page. |
| `lib/shared-processes/reader.ts` | The rename: `sharedProcessHref` replaces `sharedPreviewHref` (kept as a deprecated alias); `findSharedRecord`/`buildPreviewRoutes` delegate to the registry. |
| `lib/shared-processes/redirect-query.ts` | `withProcessSearchParams`, consumed only by the redirect pages. Reusable as-is if redirects are ever ported. |
| `lib/shared-processes/routes.ts` | New route registry (slugs, ID/alias reservation, ambiguity rejection, `metadata.slugAliases` validation) plus `processRouteRedirects`. The registry hygiene is salvageable for the preview surface; the redirect derivation targets the cutover. |
| `next.config.ts` | Wires `processRouteRedirects` into the app redirects. |
| `scripts/check-preview-runtime.mjs` | Packaged-runtime gate retargeted: preview/v2 routes asserted as 308s, canonical reader pages asserted as static output. |
| `scripts/check-process-cutover.ts` | New bounded HTTP checker for the cutover (redirect chains, repeated query survival, alias manifests). |

### Bucket (b) — reader-internal: 9 files

Improvements to the shared-reader surface that work at `/processes/preview/<id>` and
`/processes/incorporate-c-corp/v2` exactly as they are on main today. These can merge
rescoped to the v2/preview surface with no canonical change.

| File | What the hunks do |
| --- | --- |
| `components/shared-processes/RegionalVariant.tsx` | Selection state gains a `revision` counter and a `restore` path that does not bump it; option boundaries get `data-process-scope` and hydration-commit marking (`markProcessScopeHydrated`) so deep links can wait for real hydration. |
| `components/shared-processes/SharedProcessPreview.tsx` | Composition root wires the anchor/selection contracts, the compatibility bridge slot, and canonical-parity affordances (`DoViaAfk`, leaderboard `mineHref`). Works at the v2 surface unchanged. |
| `components/shared-processes/SharedProcessReader.tsx` | New optional `stepAnchorAliases` and `compatibility` props, `AnchorAliases` spans inside articles/options, `id="steps"` on the parts section. One (a) hunk: the breadcrumb retarget `/processes/preview` → `/processes` (revert in a v2 rescope). |
| `components/shared-processes/StepComparisonTable.tsx` | Renders `additionalComparisons`: the restored cross-arena judged vendor groups in separate, arena-named tables with original scores/citations; the "Use process choice" reset stays confined to the function group. |
| `components/shared-processes/VendorSelection.tsx` | Selection state moves to a reducer with `restore`/`revision`; persistence stays opt-in through whatever bridge is mounted. |
| `lib/__tests__/process-target-hydration.test.tsx` | Tests the hydration-gated open-target behavior (no assumed animation-frame count, superseded-target cancellation). |
| `lib/__tests__/shared-reader-compatibility.test.tsx` | Tests the compatibility slot placement, `#steps`, and alias mounting/unmounting across regional options and referenced subprocesses. |
| `lib/shared-processes/open-target.ts` | `markProcessScopeHydrated`/`whenProcessTargetReady`: open a deep-linked option only after every enclosing option boundary has committed. |
| `lib/shared-processes/step-comparisons.ts` | Data for the cross-arena restore: `additionalComparisons` built from the existing `crossArenaStepRankings` (canonical lib, unchanged), `comparisonProduct` extraction, logo lookup via `lib/logos`. Function-arena aggregates keep reading only the function products. |

### Bucket (c) — portable structural: 6 files

Genuinely new, separable work: the compatibility/bridge layer and data-identity pins.
Strictness note: the bridge family restores legacy URL/storage state onto the reader
DOM, so it runs wherever the reader runs; what it ports to the canonical page is its
mappings (legacy lens ↔ shared selections, geo ↔ regional options), not its DOM code.

| File | What it contributes |
| --- | --- |
| `components/shared-processes/ProcessCompatibilityBridge.tsx` | Client bridge: restores `?geo=`/`pa-geo`, `?via=`/`pa-lens`/account stack, saved per-step overrides (`pa-shared-process-selection:<id>`), history-entry selections, and hash targets, with popstate/hashchange/same-hash handling. Writes back through the existing lens and geo stores only (no second URL encoding). |
| `lib/__tests__/process-selection-cutover.test.tsx` | Guards the selection mapping over the full corpus: all 2,476 positive legacy vendor associations restore, 168 zero-score associations stay ineligible, 93 extra-arena products keep original scores/citations, aggregates unchanged. |
| `lib/__tests__/process-state-cutover.test.tsx` | Guards the bridge: repeated/comma `via` values, unknown query survival, geo-vs-hash conflict (reached state is not claimed), Back/Forward restoration, same-page encoded hashes. |
| `lib/shared-processes/compatibility.ts` | `processAnchorContract` (legacy `step-<task>-<node>` → shared scope, with region requirements), `resolveProcessAnchor` (reachable/conflict/unknown), `regionForGeo` (country → declared regional option, GB→UK, same six-country set as `GEO_NOTE_COUNTRIES`), `decodeProcessHash`. The anchor contract serves the cutover; `regionForGeo` and the resolution shape are portable now. |
| `lib/shared-processes/page-compatibility.ts` | `processSelectionContract`: joins reader scopes to legacy check steps and arena groups (the scope ↔ `ProcessCheckStep` mapping both surfaces need). |
| `lib/shared-processes/selection-compatibility.ts` | `restoreLegacySelection`/`parseSavedSelection`: legacy lens/stack picks → reader picks and per-step overrides, reusing `resolveStepVendor` precedence and shutdown rules. This is the lens-unification keystone for the bigger port. |

Bucket counts: (a) 24, (b) 9, (c) 6.

## 2. Port plan for bucket (c)

Each piece lands against the existing canonical design, with the page body untouched.

1. **Stable-ID redirects.** `/processes/<task.id>` (e.g. `/processes/form_001`) 308s to
   `/processes/<processSlug(title)>`. Derive from `lib/processes.ts` (`loadProcesses`,
   `processSlug`) in `next.config.ts`; reuse `withProcessSearchParams` if a page-level
   fallback is wanted. The shared registry is not required. Alias slugs already
   prerender as alias pages and stay as they are.
2. **Alias/ID manifest coverage.** Extend
   `app/processes/[slug]/manifest.json/route.ts` `generateStaticParams` to
   `[titleSlug, task.id, ...slugAliases]` and resolve `GET` through
   `findProcessBySlug` plus an ID lookup; the payload stays
   `buildProcessManifest(task)` with canonical identity. Lift the alias-manifest
   equality pin from `lib/__tests__/process-route-cutover.test.ts` ("keeps all alias
   manifests on the existing canonical execution payload") into a standalone test.
3. **Corpus ↔ shared identity pins.** Extract from `process-route-cutover.test.ts`
   into `lib/__tests__/shared-canonical-identity.test.ts`: `buildStoryGraph()` equals
   `data/graph.json`; every chain and `VS_EVENTS.groundedIn` resolves in the shared
   catalog; `record.source.id === task.id`; `metadata.slugAliases` mirrors
   `task.slugAliases`; shared records contain no `toolCall`/`functionCalls` strings.
   These guard the additive transition regardless of routing.
4. **Geo bridge for the reader surface.** Land `regionForGeo`/`decodeProcessHash`
   (from `compatibility.ts`) and mount `ProcessCompatibilityBridge` (geo and lens
   effects; anchor restoration can come along inert) at the preview/v2 surface via
   `SharedProcessPreview`. A founder who sets a country or a `?via=` lens on a
   canonical page then sees the same state in the reader. Canonical files unchanged.
5. **Selection round-trip.** `selection-compatibility.ts` and
   `page-compatibility.ts` as committed, consumed by the bridge at the v2 surface,
   guarded by the two bucket-(c) tests retargeted at preview/v2 URLs.

### Design-pin guards

- `components/__tests__/ProcessDagVendorRows.test.tsx` and
  `components/__tests__/StepVendorRow.test.tsx` stay untouched; they keep covering the
  canonical page because the page keeps mounting `ProcessDag`.
- Add the missing page-level pin: render `app/processes/[slug]/page.tsx` output for a
  representative slug and assert it mounts `ProcessDag`, `ProcessLeaderboard`,
  `GeoDropdown`/`ProcessGeoBanner`/`ProcessGeoNotes`, and contains no
  `a[href$="/score"]` or nested interactives inside `#steps`. This is the test whose
  absence let #171 pass the suite while unmounting the pinned tree.
- Receipts tables: assert process-level score receipts links remain
  (`ProcessLeaderboard`) while step blocks stay plain-text.
- Geo layer: existing geo tests continue to run; the port adds nothing that writes the
  geo store outside `lib/geoPreference.ts`.

## 3. The bigger port: reader capabilities inside the existing canonical design

### (i) Decision parts in ProcessDag step blocks

**Value.** Shared records carry authored decision parts (`kind: 'decision'` with
options: the form_001 n4 filing routes, method choices) with per-option guidance,
references, and documents. The canonical page renders none of that authored option
depth today.

**Where it lands.** The canonical corpus already has the structural slot: method
variants (`StepMethodSchema`, contexts `situational`/`geo`/`vendor`) with
`StepMethodGeo`/`StepMethodDefault` panels inside the step block, geo variants
auto-resolved from the country choice, situational/vendor variants data-only since
founder 2026-10-05. The port joins a task node to its shared part (via
`record.source.id === task.id` and part id, the same join `processAnchorContract`
uses) and feeds the shared option content (title, summary, references) into
`lib/stepMethodData.ts` views, rendered through the existing panel idiom. Situational
decisions that deserve an affordance get a chip row in the step block using the
`StepVendorRow` idiom (single click target, `aria-pressed`).

**Lens unification.** No second selection system: vendor-backed options write the
existing `pa-lens`/`?via=` arena pick, using the exact reverse mapping the bridge
already implements (`picks[group.arenaId] = candidate` minus the arena prefix,
validated against `group.candidates`); geo options resolve from the existing geo store
through `regionForGeo`. The reader's `pa-shared-process-selection:<id>` key stays off
the canonical page; per-step overrides that have no legacy encoding stay a
reader-surface feature until the founder wants them canonically.

**Must not change.** Static HTML stays the default flow byte-identical (client-side
resolution only, the `StepMethodGeo` precedent); every judged number (ceiling,
rankings, simulator, manifest) keeps reading the default fields; no score links and no
nested interactives inside step blocks (option panels carry guidance and plain-text
vendor rows; receipts stay at process level); the manifest contract is untouched.

### (ii) Region-variant qualification

**Honest overlap.** The canonical page already owns the geo system: `GeoDropdown` with
the shared `?geo=`/`pa-geo` store, `ProcessGeoBanner`, `ProcessGeoNotes` (the same six
countries `regionForGeo` supports), `UsFlowLabel`, `JurisdictionToggle`, and per-step
geo method variants with sub-DAGs and sourced costs auto-resolved from the one country
choice. The reader adds no new countries and no new store.

**What the reader adds that canonical lacks.**

1. Decision-bound step applicability: parts bound to a regional decision are hidden or
   swapped as a set under one choice (`hiddenScopes`, `hasUnadaptedSteps` in
   `regions.ts`). Canonical geo methods resolve per node independently and
   non-applicable steps (an 83(b) election under a UK filing) stay visible.
2. Authored regional depth: multi-part option subtrees with their own guidance,
   references, and documents (the German notary flow), beyond the 2–5-node `subSteps`
   a corpus method carries.
3. Per-step score qualification: `RegionalStepAssessment`/`RegionalCoverageNote` label
   the default-scope assessment under a foreign selection without recomputing or
   hiding it. Canonical qualifies at page level only (`UsFlowLabel`, the geo banner).

**Where it lands.** (2) rides the decision-part port above: shared option content
becomes the geo panel body for the matching region. (3) is a small client-side
qualifier line per step under a non-US selection, the `UsFlowLabel` idiom (static HTML
renders nothing). (1) should be deferred or curated into the existing
jurisdiction/method layer rather than imported as a second hiding mechanism: hiding
judged steps changes the visible ceiling story and needs the `JurisdictionToggle`
style of explicitly relabelled recomputation before it ships.

**Must not change.** `GeoDropdown` stays the single geo control; the default static
view and all judged numbers; the `geoNotes` layer; `lib/geoPreference.ts` as the only
geo store writer.

### (iii) The bucket-(c) pieces

As specced in section 2: stable-ID redirects, alias/ID manifests, identity pins, the
geo/lens bridge at the reader surface, and the selection round-trip. Items 1–3 land
immediately; items 4–5 land with the reader surface and become the shared machinery
for (i).

## 4. Recommended disposition for PR #171

Do not merge #171 as it stands: its central change is the canonical-route takeover the
founder wants decoupled, and it swaps the step-block design (per-step score links and
expandable product rows return) while the design-pin suite silently stops covering the
page. Recommend commenting and closing it, with the branch kept as the reference
implementation, and replacing it with:

1. **PR-A (bucket b, v2-rescope).** The nine reader-internal files, minus the
   breadcrumb hunk in `SharedProcessReader.tsx` and minus the canonical-href test
   ripples. Cross-arena comparison groups, the selection reducer, and
   hydration-gated deep links ship at `/processes/preview/<id>` and the v2 page today.
2. **PR-B (bucket c, rescoped).** The bridge family mounted at the reader surface,
   plus the three canonical data/link improvements (stable-ID redirects, alias
   manifests, identity pins) and the missing canonical page-level design pin.
3. **PR-C (the bigger port).** Decision parts and regional qualification inside the
   existing `ProcessDag`/`StepMethodGeo` design per section 3, founder-reviewed.

If the founder prefers keeping #171 open, the minimum honest rescope is: revert
`app/processes/[slug]/page.tsx`, both preview pages, the v2 page, `app/processes/page.tsx`,
`app/sitemap.ts`, `next.config.ts`, `routes.ts`/`reader.ts` renames and the (a) test
ripples; retarget the bridge and its tests at the preview/v2 URLs. That is a different
PR in all but number, which is why closing and splitting is cleaner.
