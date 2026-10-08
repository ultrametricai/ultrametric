# 100 functional improvements

Sourced two ways, per the founder brief: a Playwright crawl of the built site (31 route types ×
desktop 1440px + mobile 375px — status codes, horizontal-overflow checks, console/hydration
errors, unlabeled-control counts, screenshots) and a full read of the component inventory
(`components/*`) plus every `app/` route. Rules of the exercise: functional, not features; no
redesigns, no new pages; each item ≤ ~30 lines of diff; house rules apply (tooltips on every
glyph, 375px no page-scroll, N/100 pills with dimmed `/100`, honest empty states, external links
`target=_blank rel=noopener noreferrer` + title).

`[done]` = implemented in this pass. `[open]` = verified in source, not yet implemented.

## Bugs & correctness

1. `[done]` components/ProductLogoView.tsx — no-logo fallback was a `<div>` rendered inside `<p>`/`<a>` call sites (e.g. /missing "Current leader" line): invalid HTML that caused a real React #418 hydration failure on /missing (caught by the crawl). Now a `<span>` with identical flex styling.
2. `[done]` app/proofs/page.tsx — hardcoded `ultrametricai/ultrametric` GitHub URL replaced with the `REPO` constant from lib/site; the one link site-wide that would silently go stale on a repo rename.
3. `[open]` public/badges — the crawl found ~30 badge SVG 404s (bugsnag, expensify, grok, notebooklm, navan…): products added after the last badge generation have no `<id>-agent-ready.svg`/`<id>-score.svg`. Regenerate via the badge script (asset regen, not a code diff).
4. `[open]` app/arena/[category]/page.tsx + app/my-stack — crawl shows h1 textContent duplicated ("AI Coding Agents arenaAI Coding Agents", "My Stack — recommendations…My Stack"): sr-only + visible copy read twice by screen readers; verify the sr-only span is genuinely needed or mark the visible twin `aria-hidden`.

## External-link hygiene (target/rel/title)

5. `[done]` app/layout.tsx — the header's `ultrametric` link (on every page) had no `target`/`rel`, unlike the GitHub link beside it.
6. `[done]` app/methodology/page.tsx — CONTRIBUTING.md link gained `target`/`rel`/`title`; every sibling GitHub link on the page already had them.
7. `[done]` app/terms/page.tsx — DATA-LICENSE link (the page's first external link) gained `target`/`rel`/`title`.
8. `[done]` components/SimpleMarkdown.tsx — markdown links in weekly reports had no `target`/`rel`/`title` at all; external (`http(s)`) links now open in a new tab with rel + title, internal ones unchanged.
9. `[done]` components/BattleView.tsx — evidence citation `[T]`-tier links and the `proof ↗` link had no `title`; now name what they open.
10. `[done]` components/StoryVerdictsTable.tsx — same three gaps as BattleView (`[tier]`, `proof ↗`, vendor `full statement ↗`) titled.
11. `[done]` components/BusinessModel.tsx — `pricing ↗` link titled ("Open the vendor's pricing page").
12. `[done]` components/ClaimsSection.tsx — unmapped-claim `source ↗` and the "Suggest a story for these →" GitHub-issue link titled.
13. `[done]` components/PricingSignals.tsx — the "unclear" branch's `page checked ↗` link titled; the facts branch's `source ↗` already was (same file, inconsistent).
14. `[done]` components/ProductActions.tsx — `⚑ Flag a verdict` titled ("Opens a prefilled GitHub issue…").
15. `[open]` components/SubmitScan.tsx — both GitHub-issue submission links ("submit it for evaluation", "Submit for full arena evaluation →") lack titles saying they open a prefilled issue.
16. `[open]` components/ProofsSection.tsx — the external "Prove-It protocol" link lacks a title.
17. `[open]` components/TryIt/TryItSection.tsx — the `docs/TRY-IT.md` external link lacks a title.
18. `[open]` components/TryIt/Microterminal.tsx — the "vendor's MCP docs →" link lacks a title.
19. `[open]` components/ProductShowcase.tsx — the screenshot's wrapping external `<a>` has no title, and both figures use the identical link text "view live ↗" for different destinations (same accessible name).
20. `[open]` components/CertificationChip.tsx — the inner "report" anchor inherits the whole-chip tooltip; give the link its own title ("Open the machine-verifiable cert report (JSON)").
21. `[open]` components/ProofBlock.tsx — StoryChips renders internal product-page anchors as plain `<a>` (full page reload from /proofs); careful `next/link` conversion (hrefBase is already withBase-prefixed, so strip before converting).
22. `[open]` app/submit/page.tsx — "CONTRIBUTING.md § Add your product" reads as a same-page jump; add the site's `↗` outbound suffix.
23. `[open]` app/mcp/page.tsx — external doc links skip the `{hostname} ↗` outbound glyph convention used on product/family pages; align the visual language.
24. `[open]` app/certified/page.tsx — "submit the report" external link lacks the `↗` outbound hint.

## Tooltips & information scent

25. `[done]` components/CompareBuilder.tsx — Access-row tooltip omitted the `!` disputed glyph that ArenaTable/MegaTable's identical column explains; vocabulary now matches.
26. `[done]` components/MegaTable.tsx — GitHub ★ header tooltip promised "Click a count to open the repo" unconditionally; only rows with a known repo link out. Copy now says "when the repo is known".
27. `[done]` components/EverythingCatalog.tsx — the OSS and "has MCP" facet toggles had no title while the neighboring `conf ≥ B` toggle did; both explained now.
28. `[done]` components/ProductLinkChips.tsx — the letter-variant chips (bare "A"/"API"/"CLI"/"MCP") carried no tooltip; titles now carry the functional labels.
29. `[done]` components/MomentumChip.tsx — "no public signals" was bare prose; tooltip now says what was checked (GitHub/npm/PyPI) and that absence is not a judgment.
30. `[done]` app/predictions/page.tsx — "current gap N" stat gains a title (|scoreA − scoreB|, the margin to close); nearly every other numeric stat already has one.
31. `[done]` app/global/[story]/page.tsx — the headline adoption `%` gains a title; every table column on the page had one but the biggest number didn't.
32. `[done]` components/ProcessesTable.tsx — the `+N` overflow chip now lists the hidden vendor names in its title.
33. `[done]` components/StackBattle.tsx — the `×` remove chip had aria-label but no title for mouse users.
34. `[done]` components/PrintButton.tsx — "Download PDF" actually opens the print dialog; title now tells the reader to choose "Save as PDF".
35. `[open]` components/ProcessVerdict.tsx — inline `⏸` and `⚡` glyphs are untitled, unlike ProcessDag's identical `⏸ approval gate` chip.
36. `[open]` components/SubmitScan.tsx — CheckRow's `✓`/`—` glyph is aria-hidden with no title.
37. `[open]` components/ProcessSimulator.tsx — the "(canonical)" suffix in the vendor `<select>` is undefined jargon for a first-time reader.
38. `[open]` components/EverythingCatalog.tsx — the per-row M/C/A access glyphs share one container title; AgentAccessGlyphs gives each surface its own (per-glyph convention drift).
39. `[open]` app/rankings/rising/page.tsx — the per-row Sparkline lacks a local title reiterating "plots every recorded point, not just the 30-day window" (stated only in the intro).
40. `[open]` app/family/[id]/page.tsx — the "acquired" pill's free-prose tooltip should align with the OssPill/YcBadge short-definition format.
41. `[open]` app/page.tsx — the homepage states neither total product count nor an "as of" freshness line; every arena/rankings page leads with exactly that.
42. `[open]` app/integrations/page.tsx — no up-front "{N} verified edges across {M} products" summary line, unlike /global's stat sentence.
43. `[open]` app/icp/page.tsx — index cards say "{N} products in scope" without the arena count the detail page states ("across {M} arenas").

## Empty states & honesty

44. `[done]` components/IntegrationChips.tsx — empty list no longer vanishes silently; renders the heading + "No integration evidence found in our corpus… never that it doesn't integrate."
45. `[done]` components/ProcessesTable.tsx — empty state now echoes the active query and phase filter ("No processes match "x" in the build phase."), matching the product tables.
46. `[done]` components/CommandPalette.tsx — "No matches" now echoes the query ("No matches for "x""), matching MegaTable/ArenaTable phrasing.
47. `[open]` components/CoverageMapSection.tsx — `surfaces.length === 0` returns null; render an honest "no cited evidence surfaces found yet" line instead.
48. `[open]` components/FamilySection.tsx — the "found a family but <2 judged siblings" case renders nothing; a one-line explanation beats silent absence.
49. `[open]` app/gifts/page.tsx — when `gifts.length === 0` the "0 candidates · 0 sent · …" counts line still renders next to the empty-state paragraph; collapse to one message.
50. `[open]` app/rankings/most-connected/page.tsx — verify an explicit "no verified integrations yet" fallback exists (it shares loadIntegrationGraph with /integrations, which has one).
51. `[open]` components/AiEraBadge.tsx — add an `untested` variant mirroring AgenticBadge so an all-untested null PA Score doesn't read identically to a genuine n/a.
52. `[open]` lib (shared) — "unscored, not zero" copy exists in ≥3 near-identical phrasings (ClaimsChip, AgenticBadge, table cells); centralize the sentence in one exported string.

## N/100 pill & score-format conventions

53. `[done]` components/ScoreBar.tsx — bare `54.3` now renders `54.3/100` with the dimmed `/100` (house convention; it sits beside AiEraBadge pills in StacksSection).
54. `[done]` components/WatchlistClient.tsx — ScoreCell now renders `N/100` with dimmed suffix and italic n/a, matching StackBattle's identical metrics.
55. `[done]` app/missing/page.tsx — the opportunity chip's `/100` is now dimmed like the ICP page's identical-looking chip.
56. `[done]` app/arena/[category]/product/[id]/page.tsx — story coverage "34.0/100" now renders integers without the trailing ".0" (decimals only when they carry signal).
57. `[done]` components/CompareBuilder.tsx — ScoreCell's `n/a` is now italic like every other n/a/untested rendering site-wide.
58. `[done]` components/AiEraBadge.tsx — n/a badge color `text-zinc-400` → `text-zinc-500`, matching ClaimsChip/AgenticBadge/table untested cells.
59. `[open]` components/ProcessDag.tsx — VendorChip and "or:" alternatives show bare agent-ready numbers with `/100` only in the title, while ProcessSimulator's select shows `/100` visibly in the same feature.

## Sort/filter ergonomics

60. `[done]` lib/megaTableSort.ts + components/MegaTable.tsx — OSS column is now sortable (desc = open-source first), with tests. (Founder fix #1.)
61. `[done]` lib/arenaTableSort.ts + components/ArenaTable.tsx — `oss` sort column added (required `oss` field built from `product.type`); the inline Open source pill doubles as the sort affordance, with tests. (Founder fix #1.)
62. `[done]` components/StoryVerdictsTable.tsx — scope `<select>` rendered raw values ("global"/"category"/"product"); options now humanized ("Global stories" …).
63. `[open]` components/StoryVerdictsTable.tsx — default sort is `importance` but no header sorts by it; after sorting by another column there is no way back without a reload. Add an importance control (or make the "Sorted by" strip a reset).
64. `[open]` components/ProcessesTable.tsx — no `aria-live` "Sorted by …" strip, unlike StoryVerdictsTable's; add for parity.
65. `[open]` components/StoryVerdictsTable.tsx — bespoke theme/scope/query filter row duplicates TableControls' job; reuse the shared strip so the site ships one filter bar.
66. `[open]` app/rankings/popular/page.tsx — the three sections (stars / installs / curated) have no anchor ids; `#by-installs` etc. would make them deep-linkable.
67. `[open]` app/badges/page.tsx — product rows carry `id={product.id}` but arena sections have no ids; inconsistent anchor granularity on one page.
68. `[open]` app/arena/[category]/checklist/page.tsx — theme sections lack ids; deep-linking "the automation section of the payments checklist" is impossible.
69. `[open]` app/arena/[category]/report/page.tsx — same theme-anchor gap as the checklist (the page already uses print-break CSS hooks; ids are free).
70. `[done]` app/rankings/rising/page.tsx — `#rising` / `#falling` section anchors added so other pages can link straight to the drops.

## Affordance clarity

71. `[done]` components/MegaTable.tsx — the `+⇆` compare affordance moved from beside the product name (layout shifted with name width) to a fixed slim end-of-row cell after Access; always occupies the same space, verified stable under hover. (Founder fix #2.)
72. `[done]` components/YcBadge.tsx — YC pill now wears YC brand orange `#f26522` with white text (was muted orange-950/orange-300), so it reads as the recognizable YC mark; size and tooltip unchanged. No `/yc/<batch>` route exists yet, so it stays non-clickable. (Founder fix #3.)
73. `[open]` components/ArenaTable.tsx — the OSS-pill-as-sort-button (item 61) could carry a hover ring/underline cue so the pill doesn't look purely decorative.
74. `[open]` app/arena/[category]/product/[id]/page.tsx — "By theme" cards' `evidence →` cue is opacity-0 until hover; invisible on touch. Show at low opacity always.
75. `[open]` app/family/[id]/page.tsx — "Not yet judged" cards are structurally identical to clickable judged cards; a subtler border/opacity would make the inert state read faster.
76. `[open]` components/MegaTable.tsx — "# / Product" header sorts by name only; the `#` in the label implies rank is a sort key. Clarify label or tooltip.
77. `[open]` components/DoViaAfk.tsx — "may not be live yet" caveat lives only in the tooltip; surface "(admin preview)" caveat inline since tooltips aren't reliably seen.
78. `[open]` components/ConfidenceChip.tsx — grades B and C share the same ring color; only the 10px letter differs. Differentiate the ring at the B/C boundary.
79. `[open]` components/BattleView.tsx — round outcomes ("round to X" / "round drawn" / "not comparable") are prose-only; a tiny ✓/=/– glyph with Legend vocabulary would aid scanning.
80. `[open]` components/EverythingCatalog.tsx — no compare affordance on its dense rows while MegaTable's parallel rows have `+⇆`; same data, missing action.

## Keyboard navigation & accessibility

81. `[done]` components/CommandPalette.tsx — the `role="dialog"` modal now has an `aria-label` naming its purpose.
82. `[done]` components/CopyButton.tsx — "Copied ✓" confirmation wrapped in `aria-live="polite"` so it's announced, not just shown.
83. `[done]` components/InstallCommands.tsx — copy button's hover title now matches its specific aria-label ("Copy npm command") instead of a bare "Copy".
84. `[done]` components/TableControls.tsx — "Rank by" preset pills gain a focus-visible ring (the inputs beside them already had focus styles).
85. `[done]` components/CompareBuilder.tsx — the comparison table's empty first `<th>` gains an sr-only "Metric" label.
86. `[open]` components/InstantTooltip.tsx — while shown, the target has neither its (removed) native title nor `aria-describedby` pointing at the tooltip div; associate them.
87. `[open]` components/InstallCommands.tsx — `role="tablist"` package-manager tabs lack the ARIA pattern's arrow-key roving tabindex.
88. `[open]` components/StoryViewToggle.tsx — same tablist arrow-key gap.
89. `[open]` components/CompareBuilder.tsx + MyStackBuilder.tsx — "add a product" dropdowns have no ArrowUp/Down cycling, unlike CommandPalette's near-identical list.
90. `[open]` components/ProcessesTable.tsx + StoryVerdictsTable.tsx — their duplicated SortableTh buttons have no focus-visible style (MegaTable/ArenaTable's share the gap; one shared class fixes four tables).
91. `[open]` components/StackBuilder.tsx + StackBattle.tsx — "Copy share link → Copied ✓" swaps are not announced (`aria-live`), and both hand-roll the clipboard logic CopyButton already implements.
92. `[open]` components/SubmitScan.tsx — the scan-result panel appears with no `aria-live` region; completion is invisible to screen readers.
93. `[open]` components/AgenticBadge.tsx — with `showLabel={false}`, the untested/n-a branches drop the sr-only metric name that the numeric branch keeps; a table cell reads as a bare "untested".
94. `[open]` app/arena/[category]/page.tsx — add a focusable "Jump to story matrix" link (the `#story-matrix` id already exists) so keyboard users can skip the long header block.

## Copy precision & cross-page consistency

95. `[done]` app/not-found.tsx — "Global Arena ranking" renamed "Highest PA Score ranking" to match the destination page's h1 and the nav label (stale pre-rename terminology).
96. `[done]` app/arena/[category]/product/[id]/page.tsx — page `<title>` now ends "— Ultrametric" like every other page on the site.
97. `[done]` app/everything/page.tsx — gains `robots: { index: false, follow: false }` like the other three deliberately unlisted pages (/gifts, /experiments/*).
98. `[done]` app/arena/[category]/page.tsx — the "Arena" eyebrow now links back up (its own children's eyebrows already link back to the arena; same pattern one level higher).
99. `[open]` app/rankings/init vs product page vs report — the same coverage number is labeled "story coverage", "Coverage score", and "raw coverage score"; standardize one casing/label.
100. `[open]` site-wide vocabulary — "runner-up" (/stacks) vs "challenger" (/predictions) vs "#2" (/missing, report) for second place; and `★` means watch-toggle, GitHub stars, and emphasis in different places; pick one term per concept (one-line glossary note on /methodology).
