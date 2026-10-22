import path from 'node:path'
import { GOVERNMENT_ARENA_ID, loadProcesses, processSlug, VENDOR_ARENA, vendorProductId } from './processes'
import { processIcon } from './processIcons'
import { computerUseOptions, crossArenaStepRankings, processLeaderboard } from './processRankings'
import { loadStepVendorCalls } from './stepVendorCalls'

// The reverse of lib/processRankings.ts: instead of "which vendors come up in this process?",
// this answers "which processes does this vendor come up in?" — the founder ask (2026-09-21):
// company/product pages get a section for the processes they interact with and serve, with a
// table clicking through to the process pages. Built by iterating every task × node ONCE over
// the SAME derivation functions the process pages render from (processLeaderboard,
// crossArenaStepRankings, computerUseOptions, the canonical vendor mapping, the grounded
// step-vendor-calls file), so the two surfaces can never disagree. Display-only, never feeds
// scoring — same contract as lib/processRankings.ts.

// How a vendor "comes up" in a process:
//   'step-ranked'  — it has a judged step score on at least one step's PRIMARY (function-kind)
//                    ranking, i.e. it is an entry of the process leaderboard.
//   'cross-arena'  — it surfaces on a step via crossArenaStepRankings (extra-arena evidence).
//   'computer-use' — it surfaces as a "could attempt this manual step today" computer-use
//                    option. Counted separately: NEVER inflates stepsServed.
//   'canonical'    — a DAG node names it as the canonical call target
//                    (node.vendor → VENDOR_ARENA / vendorProductId).
//   'api-calls'    — it has grounded per-step API calls in open-rankings/step-vendor-calls.json.
export const VENDOR_PROCESS_KINDS = [
  'step-ranked', 'cross-arena', 'computer-use', 'canonical', 'api-calls',
] as const

export type VendorProcessKind = (typeof VENDOR_PROCESS_KINDS)[number]

export interface VendorProcessAppearance {
  taskId: string
  slug: string
  title: string
  icon: string
  phase: string
  kinds: Array<'step-ranked' | 'cross-arena' | 'computer-use' | 'canonical' | 'api-calls'>
  // Steps where the vendor has a judged step score (function or extra kind). Computer-use
  // appearances deliberately do NOT count — "could attempt it" is not "serves it".
  stepsServed: number
  // The task's rankable step count (processLeaderboard's rankableSteps), the honest denominator.
  rankableSteps: number
  // Its best judged story-derived step score in this process, across every score-bearing
  // appearance (function, extra, computer-use) — null for canonical/api-calls-only appearances.
  bestStepScore: number | null
  /** The receipts (founder 2026-09-23: "add evidence… see why it came up"): the exact steps
   *  this vendor serves with a judged score, best first — node id (for the process page's
   *  #step-<taskId>-<nodeId> anchor), label, story-derived score, and the mapped-story count
   *  behind it. Function + cross-arena appearances only (never computer-use). Uncapped since the
   *  founder's 2026-10-02 depth ask: every judged served step, deduped per node (max score). */
  servedSteps: Array<{ nodeId: string; label: string; score: number; storyCount: number }>
  // From processLeaderboard(task) when the vendor is an entry there: 1-based rank + the
  // coverage × step-quality process score. Null for vendors that only surface otherwise.
  leaderboardRank: number | null
  processScore: number | null
}

interface Acc {
  kinds: Set<VendorProcessKind>
  functionStepsServed: number
  extraNodeIds: Set<string>
  servedSteps: Array<{ nodeId: string; label: string; score: number; storyCount: number }>
  bestStepScore: number | null
  leaderboardRank: number | null
  processScore: number | null
}

// Best-first, one entry per step node: a vendor can surface on the same node through more than
// one derivation — keep the highest judged score so the receipt list never double-counts a step.
function dedupeServedSteps(
  steps: Array<{ nodeId: string; label: string; score: number; storyCount: number }>,
): Array<{ nodeId: string; label: string; score: number; storyCount: number }> {
  const sorted = [...steps].sort((x, y) => y.score - x.score)
  const seen = new Set<string>()
  return sorted.filter((s) => {
    if (seen.has(s.nodeId)) return false
    seen.add(s.nodeId)
    return true
  })
}

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

// The whole reverse index — vendor key `${arenaId}:${productId}` → sorted appearances — built
// in ONE pass over the corpus on first call and cached module-level per data dir. The product
// pages are statically generated for ~518 products; a per-product corpus scan would multiply
// build time by the roster, so the index is the only shape that stays cheap.
const indexCache = new Map<string, Map<string, VendorProcessAppearance[]>>()

function buildIndex(dir: string): Map<string, VendorProcessAppearance[]> {
  const t0 = Date.now()
  const tasks = loadProcesses(dir)
  // (vendorKey → taskId → accumulator), flattened to appearances at the end.
  const acc = new Map<string, Map<string, Acc>>()
  const rankableOf = new Map<string, number>()

  const cell = (arenaId: string, productId: string, taskId: string): Acc => {
    const vendorKey = `${arenaId}:${productId}`
    const byTask = acc.get(vendorKey) ?? new Map<string, Acc>()
    if (!acc.has(vendorKey)) acc.set(vendorKey, byTask)
    const hit = byTask.get(taskId)
    if (hit) return hit
    const fresh: Acc = {
      kinds: new Set(),
      functionStepsServed: 0,
      extraNodeIds: new Set(),
      servedSteps: [],
      bestStepScore: null,
      leaderboardRank: null,
      processScore: null,
    }
    byTask.set(taskId, fresh)
    return fresh
  }

  const seeScore = (a: Acc, score: number) => {
    a.bestStepScore = a.bestStepScore === null ? score : Math.max(a.bestStepScore, score)
  }

  for (const task of tasks) {
    // The process leaderboard IS the primary-ranking membership: every entry has judged
    // function-kind step scores, in the exact rank/score the process page shows.
    const lb = processLeaderboard(task, dir)
    rankableOf.set(task.id, lb.rankableSteps)
    lb.entries.forEach((e, i) => {
      // Same eligibility rule as processLeaderboard's entry filter (government agencies are
      // not competing vendors), enforced here too so the vendor listings never regress if a
      // future leaderboard variant feeds this index unfiltered.
      if (e.arenaId === GOVERNMENT_ARENA_ID) return
      const a = cell(e.arenaId, e.productId, task.id)
      a.kinds.add('step-ranked')
      a.functionStepsServed = e.stepsServed
      a.leaderboardRank = i + 1
      a.processScore = e.processScore
      for (const s of e.steps) {
        seeScore(a, s.score)
        a.servedSteps.push({ nodeId: s.nodeId, label: s.label, score: s.score, storyCount: s.storyCount })
      }
    })

    for (const node of task.dag.nodes) {
      // Cross-arena evidence-gated options (the "generate a website → ChatGPT/Framer" surface).
      for (const ranking of crossArenaStepRankings(task.id, node, dir)) {
        for (const v of ranking.vendors) {
          const a = cell(ranking.arenaId, v.productId, task.id)
          a.kinds.add('cross-arena')
          a.extraNodeIds.add(node.id)
          seeScore(a, v.score)
          a.servedSteps.push({ nodeId: node.id, label: node.label, score: v.score, storyCount: ranking.stories.length })
        }
      }
      // "Could attempt this manual step today" — a separate appearance kind, never coverage.
      for (const o of computerUseOptions(task.id, node.id, dir)) {
        const a = cell(o.arenaId, o.productId, task.id)
        a.kinds.add('computer-use')
        seeScore(a, o.score)
      }
      // The DAG's canonical call target.
      if (node.vendor) {
        const arenaId = VENDOR_ARENA[node.vendor]
        if (arenaId) cell(arenaId, vendorProductId(node.vendor), task.id).kinds.add('canonical')
      }
    }
  }

  // Grounded per-(step, vendor) API calls — committed file, already keyed by arena/product.
  for (const e of loadStepVendorCalls(dir)) {
    cell(e.arenaId, e.productId, e.taskId).kinds.add('api-calls')
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const index = new Map<string, VendorProcessAppearance[]>()
  let appearances = 0
  for (const [vendorKey, byTask] of acc) {
    const rows: VendorProcessAppearance[] = []
    for (const [taskId, a] of byTask) {
      const task = taskById.get(taskId)
      if (!task) continue // api-calls rows for a task no longer in the corpus: honest omission
      rows.push({
        taskId,
        slug: processSlug(task.title),
        title: task.title,
        icon: processIcon(taskId),
        phase: task.phase,
        kinds: VENDOR_PROCESS_KINDS.filter((k) => a.kinds.has(k)),
        stepsServed: a.functionStepsServed + a.extraNodeIds.size,
        rankableSteps: rankableOf.get(taskId) ?? 0,
        bestStepScore: a.bestStepScore,
        servedSteps: dedupeServedSteps(a.servedSteps),
        leaderboardRank: a.leaderboardRank,
        processScore: a.processScore,
      })
    }
    rows.sort(
      (a, b) =>
        (a.leaderboardRank ?? Number.MAX_SAFE_INTEGER) - (b.leaderboardRank ?? Number.MAX_SAFE_INTEGER) ||
        (b.processScore ?? -1) - (a.processScore ?? -1) ||
        b.stepsServed - a.stepsServed ||
        a.title.localeCompare(b.title),
    )
    index.set(vendorKey, rows)
    appearances += rows.length
  }

  // Perf watchdog (founder gate: the ~518 statically generated product pages all read this one
  // index, so its one-time cost must stay in single-digit seconds — see the build log).
  console.log(
    `[vendorProcesses] reverse index built in ${Date.now() - t0}ms — `
    + `${index.size} vendors, ${appearances} (vendor, process) appearances across ${tasks.length} processes`,
  )
  return index
}

function vendorIndex(dir: string): Map<string, VendorProcessAppearance[]> {
  const hit = indexCache.get(dir)
  if (hit) return hit
  const built = buildIndex(dir)
  indexCache.set(dir, built)
  return built
}

// Every process one judged product comes up in, best placement first (leaderboard rank asc,
// nulls last → process score desc → steps served desc → title). Unknown products — and the
// many products no process ever surfaces — return [] and render nothing.
export function processesForVendor(
  arenaId: string,
  productId: string,
  dir: string = DEFAULT_DIR(),
): VendorProcessAppearance[] {
  return vendorIndex(dir).get(`${arenaId}:${productId}`) ?? []
}
