import type { StartTarget } from './process-start'
import { loadProcesses } from './processes'
import { coveringArenaId } from './processRankings'
import { findSharedRecord, readSharedCatalog } from './shared-processes/reader'
import { processStartTarget } from './shared-processes/start'
import { processesForVendor } from './vendorProcesses'

// 'Install via Ultrametric' grounding (founder 2026-10-08): the product page's copyable install
// prompt hands an agent the COMMITTED start contract (lib/process-start.ts,
// api.ultrametric.ai/start?process=<id>) for the process that sets this product up. The
// vendor→process mapping is the same reverse index the page's Processes section renders
// (lib/vendorProcesses.ts) — a product only maps to a process it actually serves — narrowed to
// setup-flavored processes by their corpus titles ("Set up …", "Open bank account", "Connect a
// payment processor", "Stand up a data warehouse & BI") whose setup target is this product's
// arena (setupTargetArena below). Products with no mapped setup process
// get NO prompt: the committed start contract is process-scoped only (there is no
// product-scoped start mechanism to fall back to), and a prompt target is never invented.

// Setup verbs as they appear in the committed corpus titles. Deliberately tight: "Set up X" /
// "Open X" / "Connect X" / "Stand up X" are product-acquisition processes; verbs like "File",
// "Hire", or "Send" name work the product serves, not its setup.
const SETUP_TITLE = /^(set up|open|connect|stand up)\b/i

// The shared catalog is fs-backed; memoize for the sweep callers (tests, counts) that resolve
// every product in one pass.
let catalog: ReturnType<typeof readSharedCatalog> | null = null
function sharedCatalog() {
  catalog ??= readSharedCatalog()
  return catalog
}

// taskId → the arena the process SETS UP. A setup-titled process opens by standing up its
// target: the first DAG step with a covering arena (optionsArenaId, else the canonical
// vendor's arena — the same coveringArenaId the process pages rank with) names the market the
// title is about ("Set up error tracking" → error-tracking on n1). Later steps call OTHER
// arenas as tools (team chat for alerts, a coding agent for the SDK install), and the reverse
// index surfaces their vendors too — so appearing in the process is not being its target
// (greptile #221: Cursor serves an SDK-install step of prod_004 and must not inherit its
// prompt). Null when no step carries a covering arena; those processes install nothing.
let targetArenas: Map<string, string | null> | null = null
function setupTargetArena(taskId: string): string | null {
  targetArenas ??= new Map(
    loadProcesses().map((t) => [
      t.id,
      t.dag.nodes.map((n) => coveringArenaId(n)).find((a) => a !== null) ?? null,
    ]),
  )
  return targetArenas.get(taskId) ?? null
}

export interface InstallProcess {
  target: StartTarget
  title: string
  slug: string
}

// The process that installs/sets up this product, or null. Candidates are the product's
// judged-SERVING appearances (computer-use-only "could attempt it" evidence is not serving)
// with a setup-flavored title whose setup TARGET is this product's arena — serving a step of
// someone else's setup process is not being set up by it. The best fit wins — highest judged
// bestStepScore, then leaderboard rank, then title.
export function installProcessForVendor(arenaId: string, productId: string): InstallProcess | null {
  const best = processesForVendor(arenaId, productId)
    .filter((a) => !(a.kinds.length === 1 && a.kinds[0] === 'computer-use'))
    .filter((a) => SETUP_TITLE.test(a.title))
    .filter((a) => setupTargetArena(a.taskId) === arenaId)
    .sort(
      (x, y) =>
        (y.bestStepScore ?? -1) - (x.bestStepScore ?? -1) ||
        (x.leaderboardRank ?? Number.MAX_SAFE_INTEGER) - (y.leaderboardRank ?? Number.MAX_SAFE_INTEGER) ||
        x.title.localeCompare(y.title),
    )[0]
  if (!best) return null
  // The start target comes from the process's shared record (regions ride along) — the same
  // resolution the canonical process page's run CTA uses.
  const record = findSharedRecord(sharedCatalog(), best.taskId)
  if (!record || record.kind !== 'process') return null
  return { target: processStartTarget(record), title: best.title, slug: best.slug }
}
