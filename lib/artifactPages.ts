import { arenaVendorBlocks, type ArenaVendors } from './arenaLeaders'
import { openDocumentById, type OpenDocument } from './documents'
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
// The registered-document joint (founder 2026-10-06: classic document objects — the deliberate
// flip of the 2026-10-05 absence pin): artifact records may now carry a sparse `documents`
// field of open-documents/registry.json ids whose registered template genuinely IS the
// artifact's form (the filed 83(b)'s IRS Form 15620, the executed SAFE's YC forms). Resolution
// goes through lib/documents.ts openDocumentById — an unknown id fails the build loudly, and
// the referential integrity is corpus-tested in lib/__tests__/processArtifacts.test.ts. Links
// render to the canonical publisher URLs only (link, never redistribute); artifacts with no
// registered template keep the honest absence — no field, no section, never an invention.

export interface ArtifactProcessLink {
  id: string
  title: string
  href: string
  area: Area
}

export interface ArtifactPageData {
  artifact: Artifact
  producer: ArtifactProcessLink
  // The birth step on the canonical producer's page: the node tagged producesArtifact, as an
  // in-page #step anchor (the id ProcessDag renders) — the reverse direction of the process
  // page's "Artifacts it produces" Born-at column (lib/processDeps.ts producedArtifactRows).
  bornAt: { label: string; href: string }
  // Documented exception producers (registry alsoProducedBy), corpus-tested upstream.
  exceptionProducers: ArtifactProcessLink[]
  // Every process whose `requires` carries this artifact, in corpus order — exactly the
  // consumer side of lib/processDeps.ts processDepEdges for this artifact id.
  neededBy: ArtifactProcessLink[]
  // The display grouping axis: the canonical producer's area.
  producingArea: Area
  // The /artifacts country-view filter flag (founder 2026-10-07, the /processes country rule's
  // sibling): true when EVERY producing process (the canonical producer and the documented
  // alsoProducedBy exceptions) is geoScope us/us-state. Mixed producers stay false — the
  // artifact also comes into existence somewhere global, so a country view keeps it.
  usOnlyProducers: boolean
  arenas: ArenaVendors[]
  // The registered templates this artifact is executed on (registry `documents` ids resolved
  // into open-documents records), in committed mapping order — empty for the honest absence.
  documents: OpenDocument[]
  // Mapped documents sharing an open-documents `family`, in mapping order — the SAFE's
  // cap/discount/MFN/international forms read as one object with variants on the page. Only
  // genuine groups (two or more mapped members) count; a lone family member stays a plain row.
  documentFamilies: ArtifactDocumentFamily[]
}

export interface ArtifactDocumentFamily {
  family: string
  docs: OpenDocument[]
}

function documentFamilies(docs: OpenDocument[]): ArtifactDocumentFamily[] {
  const groups: ArtifactDocumentFamily[] = []
  for (const d of docs) {
    if (!d.family) continue
    const existing = groups.find((g) => g.family === d.family)
    if (existing) existing.docs.push(d)
    else groups.push({ family: d.family, docs: [d] })
  }
  return groups.filter((g) => g.docs.length > 1)
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
    const bornNode = producerTask.dag.nodes.find((n) => n.producesArtifact === artifact.id)
    if (!bornNode) throw new Error(`artifact ${artifact.id}: producer ${producerTask.id} has no tagged birth step`)
    const documents = (artifact.documents ?? []).map(openDocumentById)
    const producerTasks = [producerTask, ...(artifact.alsoProducedBy ?? []).map((pid) => {
      const t = byId.get(pid)
      if (!t) throw new Error(`artifact ${artifact.id}: unknown exception producer ${pid}`)
      return t
    })]
    return {
      artifact,
      producer,
      bornAt: {
        label: bornNode.label,
        href: `${producer.href}#step-${producerTask.id}-${bornNode.id}`,
      },
      exceptionProducers: producerTasks.slice(1).map(processLink),
      neededBy: tasks.filter((t) => t.requires.includes(artifact.id)).map(processLink),
      producingArea: producer.area,
      usOnlyProducers: producerTasks.every((t) => t.geoScope === 'us' || t.geoScope === 'us-state'),
      arenas: arenaVendorBlocks(producingStepArenaIds(artifact, byId), dir),
      documents,
      documentFamilies: documentFamilies(documents),
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
