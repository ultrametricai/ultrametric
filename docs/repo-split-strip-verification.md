# Repo-split strip verification

Record of the pre-deletion check run on 2026-10-12 for the strip PR, the final step of the
repo-split cutover (docs/repo-split-plan.md; the full cutover sequence is in that file's git
history). Every path marked `closed` in `open-manifest.json` was byte-compared against
the private site repo (`ultrametricai/ultrametric-app-private`, local clone at its
`open.lock` pin `36772dcd`, plus its post-split commits) before any deletion here.

## Method

1. Expand every `closed` manifest entry to the git-tracked files it covers: 909 files.
2. Byte-compare each against the private working tree.
3. For files that differ, compare the private copy against this repo's pinned base
   (`36772dcd`, the SHA the private repo imported and currently pins): a private copy that
   matches the pin diverges only because this repo's Phase A re-export shims moved after the
   pin, so no content is at risk.
4. For files where the private copy differs from the pin too, require that this repo's copy
   is unchanged since the pin, so the private lineage strictly supersedes (it has been serving
   production since the cutover).

## Results

| Class | Count |
| --- | --- |
| Byte-identical | 856 |
| Identical at the pin (public side changed only by Phase A re-export shims) | 5 |
| Diverged, private lineage newer (supersedes) | 46 |
| Diverged on both sides, reconciled (see below) | 1 |
| Deleted deliberately in the private lineage (see below) | 1 |
| Missing from the private repo without explanation | 0 |

Phase A shim files (private matches the pin): `lib/humanStepsUi.ts`, `lib/icons.ts`,
`lib/myStack.ts`, `lib/processLens.ts`, `lib/stackBuilder.ts`.

Diverged with the private copy newer (its post-split commits: mobile header batches, step
display removals, docs-navigation merges, the deploy-prod repoint):

- `app/__tests__/header-single-line.test.tsx`
- `app/__tests__/layout-footer.test.ts`
- `app/arena/[category]/product/[id]/page.tsx`
- `app/layout.tsx`
- `app/processes/[slug]/page.tsx`
- `app/processes/__tests__/detailBottomTables.test.tsx`
- `app/rankings/rising/page.tsx`
- `app/situations/page.tsx`
- `components/AccountMenu.tsx`
- `components/AgenticIndexTable.tsx`
- `components/AiNativeIndexTable.tsx`
- `components/ArenaTable.tsx`
- `components/BattleView.tsx`
- `components/ClaimsSection.tsx`
- `components/CommandPalette.tsx`
- `components/EverythingCatalog.tsx`
- `components/GeoDropdown.tsx`
- `components/ImUsing.tsx`
- `components/InitIndexTable.tsx`
- `components/MegaTable.tsx`
- `components/MobileNav.tsx`
- `components/ProcessDag.tsx`
- `components/ProcessDagOverview.tsx`
- `components/ProcessProducesTable.tsx`
- `components/ProcessYourVendor.tsx`
- `components/ScoreMiniTable.tsx`
- `components/SituationsTable.tsx`
- `components/StacksSection.tsx`
- `components/StepVerifyCost.tsx`
- `components/VsJourneyDag.tsx`
- `components/WatchButton.tsx`
- `components/__tests__/HeaderGeoControl.test.tsx`
- `components/__tests__/ImUsing.test.tsx`
- `components/__tests__/MobileNav.test.tsx`
- `components/__tests__/ObjectsNav.test.tsx`
- `components/__tests__/ScoreMiniTable.test.tsx`
- `components/__tests__/StepApiCalls.test.tsx`
- `components/__tests__/StepGuidance.test.tsx`
- `components/__tests__/StepVendorRow.test.tsx`
- `components/__tests__/StepVerifyCost.test.tsx`
- `components/__tests__/VsJourneyDag.test.tsx`
- `components/__tests__/WatchButton.test.tsx`
- `components/__tests__/contrastSweep.test.ts`
- `components/fx/LogoWordmark.tsx`
- `components/useMyStackMap.ts`
- `scripts/deploy-prod.sh`

Reconciled two-sided divergence: `lib/arenaIcons.ts`. The private copy evolved (its mobile-menu
commit `4f01dba`); this repo's copy changed only by the Phase A move of `CONTROL_SURFACE_ICONS`
into `lib/controlSurfaces.ts` (open, overlaid at the next pin bump). No content exists only
here.

Deliberate private deletion: `public/ultrametric-mark.svg`. Private commit `67bbb5d`
("Restore the full wordmark on the mobile header") removed it as no longer referenced. The
asset exists in the private repo's history; its absence is a newer design decision, not a gap.

## Deleted alongside the closed set: tests of closed modules

These test files are listed `open` in the pre-strip census but exercise modules the strip
deletes, so they leave with their subjects. They exist only in this repo's history (the
private repo carried no copy): the private repo should adopt them into its UI suite from this
repo's pre-strip history (any commit up to the strip PR's parent).

- `lib/__tests__/arenaIcons.test.ts`
- `lib/__tests__/badge-redirect.test.ts` (asserts `next.config.ts` badge redirects)
- `lib/__tests__/dates.test.ts`
- `lib/__tests__/icons.test.ts`
- `lib/__tests__/megaTableSort.test.ts`
- `lib/__tests__/myStack.test.ts`
- `lib/__tests__/myStackAccount.test.ts`
- `lib/__tests__/ordinal.test.ts`
- `lib/__tests__/process-id-redirects.test.ts` (asserts `next.config.ts` process redirects)
- `lib/__tests__/process-manifest-aliases.test.ts` (asserts an `app/` route)
- `lib/__tests__/process-v2-urls.test.ts` (asserts `app/` pages and `next.config.ts`)
- `lib/__tests__/search-index.test.ts`
- `lib/__tests__/search-matching.test.ts`
- `lib/__tests__/session.test.ts`
- `lib/__tests__/sparkline.test.ts`
- `lib/__tests__/stackBuilder.test.ts` (its pairKey drift guard moved to
  `lib/__tests__/integrations.test.ts`)
- `lib/__tests__/urlState.test.ts`
- `lib/__tests__/watchlist.test.ts`

Surviving open tests trimmed of closed-side assertions (the removed blocks are likewise
private-suite candidates): `arenaSections.test.ts` (ArenaMenu filtering),
`processIcons.test.ts` (the designed-glyph cross-check against
`components/icons/ProcessIcon`), `shutdown.test.ts` (the My Stack recommendation describe),
`storyTiers.test.ts` (the `renderProductMarkdown` describe), `virtualStartup.test.ts` (the
`app/startup-sim` page-source describe and the search-entry wiring describe).

## Private-repo follow-ups (do at the next `open.lock` pin bump; not done here)

1. `scripts/check-census.mjs` (the private census gate) needs a matching update: the public
   census now lists open files only, and the cross-repo sum-to-total assertion retires.
2. `git rm` the private repo's tracked copies of `lib/processIcons.ts` and
   `lib/accessGlyphs.ts` before bumping: both are re-dispositioned open with `overlay: true`,
   so the sync collision gate will otherwise fail the build.
3. Adopt the orphaned closed-module tests and trimmed blocks listed above into the private
   suite.
4. Re-enable `components/shared-processes/__tests__/shared-default-options.test.tsx`: the
   `source_snapshot.py` working-tree fallback it needed ships at this pin.
5. The private copies of `icons.ts`, `myStack.ts`, `stackBuilder.ts`, `processLens.ts`,
   `arenaIcons.ts`, and `humanStepsUi.ts` can be refactored onto the new open modules
   (`themeLabels`, `stackShared`, `processLensCore`, the relocated `CONTROL_SURFACE_ICONS`
   and `showComputerUseChips`) to drop the duplicated definitions; until then the duplicates
   are inert.
