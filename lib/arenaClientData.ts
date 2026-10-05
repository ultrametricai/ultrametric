import type { CategoryData } from './data-helpers'

// The arena page's client-component payload. ArenaTable, StoryMatrix, PersonaStacksSection and
// StacksSection all take the arena's CategoryData as a prop, and client props are serialized
// into every prerender artifact of the page (html inline flight + .rsc + both whole-page
// segment files — docs/BUILD-SIZE.md problem 2). Two fields carried most of those bytes and
// none of those components (or anything they render) reads either:
//
// - verdict.rationale — the judge's prose. Rendered only by the server-rendered battle/vs
//   rounds (BattleView), the product page's rows (StoryVerdictsTable, which gets its own
//   purpose-built rows prop), and AiModeBadge (not on this page). StoryMatrix's cell tooltips
//   quote evidence excerpts, not rationale.
// - rankings.battles — every pairwise record with per-round results. The arena page links to
//   battles by slug; it never renders a battle record (the per-row "vs …" link left 2026-09-30).
//
// Emptying them (rather than narrowing the type) keeps the CategoryData shape every helper in
// the component tree is typed on. lib/__tests__/arenaClientData.test.ts pins both the strip and
// the "nothing on the arena page reads these" claim; if a future arena-page component needs
// rationale or battles, pass it what it needs explicitly instead of widening this again.
// Measured on ai-coding (2026-10-02): 1.66 MB → 0.68 MB of flight per artifact, ×4 artifacts
// per arena page.
export function arenaClientData(data: CategoryData): CategoryData {
  return {
    ...data,
    verdicts: data.verdicts.map((v) => ({ ...v, rationale: '' })),
    rankings: { ...data.rankings, battles: [] },
  }
}
