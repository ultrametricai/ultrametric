import path from 'node:path'
import { loadCategory } from './data'
import { crossArenaStepRankingsFull, stepRankingFull, type StepRanking } from './processRankings'
import type { DagNode } from './processes'
import { governmentStepEligibility, loadProcesses, STEP_OPTIONS_CAP, vendorProductId } from './processes'
import { StepRankingsFileSchema, type StepRankingMarket, type StepRankingsFile } from './schemas'

// The full per-step vendor rankings published as open-rankings/step-rankings.json. Pure
// projection of lib/processRankings.ts: each market is stepRankingFull (the step's covering
// arena) or crossArenaStepRankingsFull (its additional arenas), so the site's capped option
// chips (stepRanking / crossArenaStepRankings) are always the first optionsCap vendors here.
// Steps with neither ranking are omitted. No timestamps; tasks sort by id and steps keep DAG
// node order, so a rebuild over unchanged inputs is byte-identical. Written by
// rankings-engine/scripts/generate-step-rankings.ts; drift-gated by
// lib/__tests__/stepRankings.test.ts and pnpm recompute-check.

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

// The committed country+area tags a government-covered step's roster is restricted to, read
// off the same anchor product governmentStepEligibility uses. Null when the roster is whole.
function eligibilityTags(node: DagNode, arenaId: string, dir: string): StepRankingMarket['eligibility'] {
  if (!governmentStepEligibility(node, arenaId, dir)) return null
  const anchor = loadCategory(arenaId, dir).products.find((p) => p.id === vendorProductId(node.vendor!))
  return { country: anchor!.country!, area: anchor!.area! }
}

function toMarket(ranking: StepRanking, eligibility: StepRankingMarket['eligibility']): StepRankingMarket {
  return {
    arenaId: ranking.arenaId,
    arenaName: ranking.arenaName,
    stories: ranking.stories.map((s) => ({ id: s.id, title: s.title, weight: s.weight })),
    eligibility,
    vendors: ranking.vendors.map((v, i) => ({
      productId: v.productId,
      name: v.name,
      score: v.score,
      rank: i + 1,
      cites: v.cites.map((c) => ({ storyId: c.storyId, verdict: c.verdict, quality: c.quality, weight: c.weight })),
    })),
  }
}

export function buildStepRankings(dir: string = DEFAULT_DIR()): StepRankingsFile {
  const tasks = [...loadProcesses(dir)].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const steps: StepRankingsFile['steps'] = []
  for (const task of tasks) {
    for (const node of task.dag.nodes) {
      const primary = stepRankingFull(task.id, node, dir)
      const crossArena = crossArenaStepRankingsFull(task.id, node, dir)
      if (!primary && crossArena.length === 0) continue
      steps.push({
        taskId: task.id,
        nodeId: node.id,
        label: node.label,
        primary: primary ? toMarket(primary, eligibilityTags(node, primary.arenaId, dir)) : null,
        crossArena: crossArena.map((r) => toMarket(r, null)),
      })
    }
  }
  return StepRankingsFileSchema.parse({ schemaVersion: 1, optionsCap: STEP_OPTIONS_CAP, steps })
}

export function serializeStepRankings(file: StepRankingsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}
