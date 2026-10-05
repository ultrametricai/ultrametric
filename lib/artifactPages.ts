import { arenaVendorBlocks, type ArenaVendors } from './arenaLeaders'
import { coveringArenaId } from './processRankings'
import { loadArtifacts, loadProcesses, processSlug, VENDOR_ARENA, type Artifact, type ProcessTask } from './processes'
import { areaOfTask, AREA_ORDER, type Area } from './processRows'

// /artifacts page family (founder 2026-10-05): one site page per registry artifact
// (processes/artifacts.json) — what it is (the registry's committed description), who produces
// it (the canonical producer plus the documented alsoProducedBy exceptions), and who needs it
// (every process whose `requires` carries it — the same edges lib/processDeps.ts builds the
// cross-process dependency graph from). The vendor section is DERIVED, never curated: the
// corpus pins where each artifact comes into existence at node level (producesArtifact), and
// those producing steps' covering arenas (the function-mapping resolution, coveringArenaId)
// plus their curated vendorOptions' arenas name the markets; each arena then contributes its
// committed leaderboard leaders (lib/arenaLeaders.ts). Consumption carries no node-level tag —
// `requires` is task-level corpus truth — so consuming processes appear as links, never as a
// vendor-derivation source. Artifacts whose producing steps have no populated covering arena
// (state filings, signature acts) keep an honest empty state.
//
// Checked and deliberately absent (founder ask 2026-10-05): the artifact registry has NO
// mapping field onto open-documents/registry.json entries (artifact records carry only
// id/label/description/producedBy/alsoProducedBy/terminal), so no "registered document" link
// renders — inventing one would be a fabricated mapping. Candidate follow-up: add an optional
// `documents` field to processes/artifacts.json with corpus-tested referential integrity, then
// render it here.

export interface ArtifactProcessLink {
  id: string
  title: string
  href: string
  area: Area
}

export interface ArtifactPageData {
  artifact: Artifact
  producer: ArtifactProcessLink
  // Documented exception producers (registry alsoProducedBy), corpus-tested upstream.
  exceptionProducers: ArtifactProcessLink[]
  // Every process whose `requires` carries this artifact, in corpus order — exactly the
  // consumer side of lib/processDeps.ts processDepEdges for this artifact id.
  neededBy: ArtifactProcessLink[]
  // The display grouping axis: the canonical producer's area.
  producingArea: Area
  arenas: ArenaVendors[]
}

function processLink(task: ProcessTask): ArtifactProcessLink {
  return {
    id: task.id,
    title: task.title,
    href: `/processes/${processSlug(task.title)}`,
    area: areaOfTask(task),
  }
}

// The covering arenas of the artifact's producing steps, in first-seen order: every node
// (across the canonical producer and the documented exception producers) tagged
// `producesArtifact: <id>`, contributing its function-mapped covering arena and the arenas of
// its curated vendorOptions.
function producingStepArenaIds(artifact: Artifact, byId: Map<string, ProcessTask>): string[] {
  const arenaIds: string[] = []
  for (const pid of [artifact.producedBy, ...(artifact.alsoProducedBy ?? [])]) {
    const task = byId.get(pid)
    if (!task) throw new Error(`artifact ${artifact.id}: unknown producer process ${pid}`)
    for (const node of task.dag.nodes) {
      if (node.producesArtifact !== artifact.id) continue
      for (const arenaId of [
        coveringArenaId(node),
        ...(node.vendorOptions ?? []).map((v) => VENDOR_ARENA[v]),
      ]) {
        if (arenaId && !arenaIds.includes(arenaId)) arenaIds.push(arenaId)
      }
    }
  }
  return arenaIds
}

export function loadArtifactPages(dir?: string): ArtifactPageData[] {
  const tasks = loadProcesses(dir)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  return loadArtifacts().map((artifact) => {
    const producerTask = byId.get(artifact.producedBy)
    if (!producerTask) throw new Error(`artifact ${artifact.id}: unknown producer ${artifact.producedBy}`)
    const producer = processLink(producerTask)
    return {
      artifact,
      producer,
      exceptionProducers: (artifact.alsoProducedBy ?? []).map((pid) => {
        const t = byId.get(pid)
        if (!t) throw new Error(`artifact ${artifact.id}: unknown exception producer ${pid}`)
        return processLink(t)
      }),
      neededBy: tasks.filter((t) => t.requires.includes(artifact.id)).map(processLink),
      producingArea: producer.area,
      arenas: arenaVendorBlocks(producingStepArenaIds(artifact, byId), dir),
    }
  })
}

export function findArtifactPage(id: string, dir?: string): ArtifactPageData | null {
  return loadArtifactPages(dir).find((a) => a.artifact.id === id) ?? null
}

// The index grouping: artifacts by their canonical producer's area, in the founder-lifecycle
// AREA_ORDER, registry order within each group.
export function artifactsByProducingArea(dir?: string): Array<{ area: Area; artifacts: ArtifactPageData[] }> {
  const pages = loadArtifactPages(dir)
  return AREA_ORDER
    .map((area) => ({ area, artifacts: pages.filter((p) => p.producingArea === area) }))
    .filter((g) => g.artifacts.length > 0)
}
