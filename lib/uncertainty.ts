// Pure helpers for the multi-judge uncertainty pass (see pipeline/scripts/uncertainty-pass.ts,
// which collects the raw judgments and writes open-rankings/{cat}/uncertainty.json, and lib/schemas.ts's
// UncertaintyEntrySchema for the shape this feeds). Kept free of node:fs/network so it's usable
// from both the pipeline (Node) and the app (product page "±" marker) and is trivially
// unit-testable.
import type { UncertaintyEntry, Verdict } from './schemas'

export type Agreement = UncertaintyEntry['agreement']

// How many of 3 independently-sampled verdict tiers for the SAME cell agree with the plurality
// tier. All 3 agreeing -> '3/3' (the judge is stable here); a 2-1 split -> '2/3'; a 3-way split
// (rare with only 5 possible tiers, but possible under real LLM sampling variance) -> '1/3'.
export function agreementOf(
  judgments: readonly [Verdict['verdict'], Verdict['verdict'], Verdict['verdict']],
): Agreement {
  const counts = new Map<string, number>()
  for (const t of judgments) counts.set(t, (counts.get(t) ?? 0) + 1)
  const max = Math.max(...counts.values())
  return `${max}/3` as Agreement
}

// Whether the #1 and #2 leaderboard products in an arena are close enough that the ordering
// itself is worth double-checking with extra judge samples — see uncertainty-pass.ts's
// CLOSE_RACE_THRESHOLD. Null aiEra (no agentic/apiQuality/openness signal at all for one of the
// two) can never be "close" — there's nothing to compare.
export function isCloseRace(aiEraTop1: number | null, aiEraTop2: number | null, threshold = 3.0): boolean {
  if (aiEraTop1 === null || aiEraTop2 === null) return false
  return Math.abs(aiEraTop1 - aiEraTop2) <= threshold
}

// Display predicate for the product-page "±" marker: only surface disagreement, never
// affirm agreement (an absent/undefined entry — the common case, since uncertainty.json only
// covers decisive cells in close-race arenas — renders exactly like a confident '3/3').
export function isUncertain(agreement: Agreement | undefined): boolean {
  return agreement !== undefined && agreement !== '3/3'
}
