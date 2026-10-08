// Server-side builder for "Check my process" (components/ProcessCheck.tsx): pre-serialize one
// process's step rankings into the lean rows the client filters against the reader's account
// stack — same contract as lib/myStackData.ts vs lib/myStack.ts and app/watchlist/page.tsx's
// pre-serialized WatchlistProduct rows. Kept separate from lib/processCheck.ts because this
// side reads the filesystem (lib/data.ts, the committed step→story mapping).
//
// Numbers: every vendor score is lib/processRankings.ts's stepVendorScore — weightedPercent of
// the vendor's judged verdicts over exactly the step's mapped stories — so the client-side
// check is a pure re-arrangement of what the process page already publishes (deterministic;
// asserted by lib/__tests__/processCheck.test.ts's recompute).
import { isPopulated, loadCategory } from './data'
import { hasLogo } from './logos'
import type { ProcessCheckStep } from './processCheck'
import { governmentStepEligibility, type ProcessTask } from './processes'
import { crossArenaStepRankings, functionMappingFor, stepVendorScore } from './processRankings'
import { isShutdown } from './shutdown'

export function buildProcessCheckSteps(task: ProcessTask, dir?: string): ProcessCheckStep[] {
  const steps: ProcessCheckStep[] = []
  for (const node of task.dag.nodes) {
    // Same rankable-step conditions as processLeaderboard: a committed non-empty function
    // mapping onto a populated arena, with at least one story still real and one vendor scored.
    const entry = functionMappingFor(task.id, node, dir)
    if (!entry || entry.storyIds.length === 0 || !isPopulated(entry.arenaId, dir)) continue
    const data = loadCategory(entry.arenaId, dir)
    const storyIds = entry.storyIds.filter((id) => data.stories.some((s) => s.id === id))
    if (storyIds.length === 0) continue

    // Every vendor of the covering arena, UNCAPPED (the process page's roster caps at
    // STEP_OPTIONS_CAP for legibility; here the reader's own pick must be findable wherever it
    // ranks). Ordering mirrors lib/processRankings.ts's rankVendors: score desc, leaderboard
    // order as the deterministic tie-break.
    const leaderboardRank = new Map(data.rankings.leaderboard.map((e, i) => [e.productId, i]))
    // Shutdown vendors STAY in this serialized list, marked (unlike every offer surface, which
    // filters them via lib/processRankings.ts's rankVendors): the reader's own pick must remain
    // findable wherever it ranks so the check can tell them to migrate. They are never `best`.
    // Government-covered steps keep only the step's applicable agencies (committed
    // country+area tags — lib/processes.ts governmentStepEligibility, same rule as the step
    // rankings): an agency outside the step's country or service area was never a candidate
    // for it, so it has no place in the check either. `eligible` is null for every other arena.
    const eligible = governmentStepEligibility(node, entry.arenaId, dir)
    const vendors = data.products
      .filter((p) => !eligible || eligible.has(p.id))
      .flatMap((p) => {
        const s = stepVendorScore(entry.arenaId, storyIds, p.id, dir)
        return s
          ? [{
              productId: s.productId,
              name: s.name,
              score: s.score,
              hasLogo: hasLogo(s.productId),
              ...(isShutdown(p) ? { shutdown: true as const } : {}),
            }]
          : []
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          (leaderboardRank.get(a.productId) ?? 0) - (leaderboardRank.get(b.productId) ?? 0),
      )
    const best = vendors.find((v) => !v.shutdown)
    if (!best) continue

    // Evidence-gated cross-arena markets, exactly as the process page shows them (committed
    // 'extra' mapping + full/partial verdict + node allowlist — see crossArenaStepRankings).
    const extras = crossArenaStepRankings(task.id, node, dir).map((r) => ({
      arenaId: r.arenaId,
      arenaName: r.arenaName,
      kind: 'extra' as const,
      vendors: r.vendors.map((v) => ({
        productId: v.productId,
        name: v.name,
        score: v.score,
        hasLogo: hasLogo(v.productId),
      })),
    }))

    steps.push({
      nodeId: node.id,
      label: node.label,
      storyCount: storyIds.length,
      arenas: [
        { arenaId: entry.arenaId, arenaName: data.category.name, kind: 'function', vendors },
        ...extras,
      ],
      // The best non-shutdown vendor — usually vendors[0]; never a shutdown pick.
      best: { productId: best.productId, name: best.name, score: best.score, arenaId: entry.arenaId },
    })
  }
  return steps
}
