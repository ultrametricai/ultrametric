import { loadArtifacts, loadProcesses, processSlug, type Artifact, type ProcessTask } from './processes'

// The cross-process dependency graph (founder depth wave part 2, 2026-10-01: "typed
// inputs/outputs between steps, and the cross-process dependency graph"). Built entirely from
// the committed typed layer — each task's `produces`/`requires` artifact ids against the
// registry (processes/artifacts.json) — never from prose. Edges run canonical producer →
// consumer: a task that requires `ein` depends on the registry's canonical producer of `ein`
// (form_002), even where a documented exception producer (the LLC route) could also satisfy it
// — one producer per artifact is what keeps this a company-level DAG instead of a market graph.
//
// The graph's invariants live as TESTS (lib/__tests__/processDeps.test.ts): acyclicity, every
// `requires` id has a producer, every artifact's producer process exists, no self-requires.
// The derived topological ordering is compared against the curated `timeOrder` founder
// timeline: timelineInversions() reports (never auto-fixes) every place the curated timeline
// orders a consumer before its producer — that list IS the founder's renumbering worklist,
// committed as docs/TIMELINE-INVERSIONS.md (scripts/generate-timeline-inversions.ts,
// drift-tested so it can't go stale silently).
//
// SIMULATOR SEAM (design note only — lib/virtualStartup composition is deliberately untouched
// this round): the open startup simulator currently composes its run from the curated phase
// buckets. Once this graph is trusted, the sim's phase composition could DERIVE instead:
// (1) seed the run with the processes whose `requires` is empty (or already satisfied by the
// founder's declared starting artifacts — "I already have an LLC" marks the form_011 produces
// set as held); (2) unlock each process the moment its full `requires` set is produced,
// topologicalOrder() giving the deterministic tie-break; (3) let a vendor swap or a skipped
// process propagate honestly — skipping "Set up payroll" visibly blocks every payroll-account
// consumer rather than silently reordering. That derivation needs nothing beyond this module's
// exports (processDepEdges, topologicalOrder, artifactsById) plus a "held artifacts" seed set,
// which is why the seam is documented here and not wired yet.

export interface ProcessDepEdge {
  // Canonical producer task id.
  from: string
  // Consumer task id (carries the artifact in `requires`).
  to: string
  artifactId: string
}

export interface TimelineInversion {
  artifactId: string
  artifactLabel: string
  consumerId: string
  consumerTitle: string
  consumerTimeOrder: number
  producerId: string
  producerTitle: string
  producerTimeOrder: number
}

export function artifactsById(): Map<string, Artifact> {
  return new Map(loadArtifacts().map((a) => [a.id, a]))
}

// Every producer→consumer edge in the corpus, one per (artifact, consumer) pair, in corpus
// order. Self-edges never exist (no self-requires — corpus-tested), so this is the raw
// adjacency of the company-level DAG.
export function processDepEdges(dir?: string): ProcessDepEdge[] {
  const byId = artifactsById()
  const edges: ProcessDepEdge[] = []
  for (const t of loadProcesses(dir)) {
    for (const artifactId of t.requires) {
      const artifact = byId.get(artifactId)
      if (!artifact) throw new Error(`${t.id} requires unknown artifact ${artifactId}`)
      edges.push({ from: artifact.producedBy, to: t.id, artifactId })
    }
  }
  return edges
}

// Kahn's algorithm over the process-level graph. Deterministic: ready processes release in
// curated timeOrder (the founder timeline is the tie-break, so the derived ordering differs
// from the curated one ONLY where a dependency forces it). Throws naming the remainder on a
// cycle — the acyclicity test is exactly "this does not throw and covers every process".
export function topologicalOrder(dir?: string): string[] {
  const tasks = loadProcesses(dir)
  const indegree = new Map<string, number>(tasks.map((t) => [t.id, 0]))
  const out = new Map<string, Set<string>>()
  for (const e of processDepEdges(dir)) {
    const targets = out.get(e.from) ?? new Set<string>()
    if (!targets.has(e.to)) {
      targets.add(e.to)
      out.set(e.from, targets)
      indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
    }
  }
  const timeOrder = new Map(tasks.map((t) => [t.id, t.timeOrder]))
  const ready = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id)
  const order: string[] = []
  while (ready.length > 0) {
    ready.sort((a, b) => (timeOrder.get(a) ?? 0) - (timeOrder.get(b) ?? 0))
    const id = ready.shift()!
    order.push(id)
    for (const next of out.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1
      indegree.set(next, d)
      if (d === 0) ready.push(next)
    }
  }
  if (order.length !== tasks.length) {
    const stuck = tasks.filter((t) => !order.includes(t.id)).map((t) => t.id)
    throw new Error(`process dependency graph has a cycle through: ${stuck.join(', ')}`)
  }
  return order
}

// Every place the curated founder timeline orders a consumer BEFORE its artifact's canonical
// producer — the founder's renumbering worklist. Reported, never auto-fixed: some inversions
// are honest corpus findings (the first hire's option grant genuinely presupposes a 409A the
// timeline places later), and renumbering timeOrder is a curation act. Sorted by consumer
// position, then artifact id.
export function timelineInversions(dir?: string): TimelineInversion[] {
  const tasks = new Map(loadProcesses(dir).map((t) => [t.id, t]))
  const byId = artifactsById()
  const inversions: TimelineInversion[] = []
  for (const e of processDepEdges(dir)) {
    const producer = tasks.get(e.from)
    const consumer = tasks.get(e.to)
    if (!producer || !consumer) throw new Error(`edge ${e.from}→${e.to} names an unknown process`)
    // Situations carry no timeline slot (kind: 'situation', timeOrder absent) — they are real
    // graph participants but the inversion analysis is strictly about the curated timeline.
    if (producer.timeOrder === undefined || consumer.timeOrder === undefined) continue
    if (consumer.timeOrder < producer.timeOrder) {
      inversions.push({
        artifactId: e.artifactId,
        artifactLabel: byId.get(e.artifactId)!.label,
        consumerId: consumer.id,
        consumerTitle: consumer.title,
        consumerTimeOrder: consumer.timeOrder,
        producerId: producer.id,
        producerTitle: producer.title,
        producerTimeOrder: producer.timeOrder,
      })
    }
  }
  return inversions.sort(
    (a, b) => a.consumerTimeOrder - b.consumerTimeOrder || a.artifactId.localeCompare(b.artifactId),
  )
}

export interface PlacementSlack {
  id: string
  title: string
  curatedTimeOrder: number
  // The earliest timeline slot this process's typed dependencies allow: one past its latest
  // producer's curated position (1 for a process with no requires).
  earliestFeasible: number
  // curated − earliestFeasible: how much later the curated timeline places the process than its
  // dependencies force. Big slack is a placement QUESTION, not an error — "Apply to Y
  // Combinator" sits at the end of the curated timeline while its only typed need (the founder
  // agreement) exists by position 4.
  slack: number
}

// The complement of the inversion list: processes the curated timeline places far LATER than
// their typed dependencies require. Only positive slack ≥ `minSlack` is reported, largest
// first — the top of this list is the founder's "could this move earlier?" worklist (the
// fund_007 placement question falls out of it).
export function placementSlack(minSlack = 40, dir?: string): PlacementSlack[] {
  // Timeline processes only — situations have no slot to have slack against.
  const tasks = loadProcesses(dir).filter(
    (t): t is (typeof t & { timeOrder: number }) => t.timeOrder !== undefined,
  )
  const timeOrder = new Map(tasks.map((t) => [t.id, t.timeOrder]))
  const byId = artifactsById()
  const rows: PlacementSlack[] = []
  for (const t of tasks) {
    const producerOrders = t.requires.map((aid) => timeOrder.get(byId.get(aid)!.producedBy) ?? 0)
    const earliestFeasible = producerOrders.length === 0 ? 1 : Math.max(...producerOrders) + 1
    const slack = t.timeOrder - earliestFeasible
    if (slack >= minSlack) {
      rows.push({ id: t.id, title: t.title, curatedTimeOrder: t.timeOrder, earliestFeasible, slack })
    }
  }
  return rows.sort((a, b) => b.slack - a.slack || a.curatedTimeOrder - b.curatedTimeOrder)
}

// ---------------------------------------------------------------------------
// Display: the 'Needs:' / 'Produces:' chip rows on /processes/[slug]
// ---------------------------------------------------------------------------

export interface ArtifactChip {
  id: string
  label: string
  description: string
  // The canonical producer — where the chip links. For a `produces` chip on the canonical
  // producer's own page this is the page itself (producedHere), rendered unlinked.
  producerId: string
  producerTitle: string
  producerHref: string
  producedHere: boolean
}

export interface ArtifactChipRows {
  needs: ArtifactChip[]
  produces: ArtifactChip[]
}

// Serializable chip rows for one task's header (components/ArtifactChips.tsx): `needs` chips
// link each required artifact to its canonical producer's process page; `produces` chips name
// what this process brings into existence (linking back to the canonical producer where this
// page is a documented exception — the LLC page's EIN chip points at Get EIN).
export function artifactChipRows(task: ProcessTask, dir?: string): ArtifactChipRows {
  const byId = artifactsById()
  const tasks = new Map(loadProcesses(dir).map((t) => [t.id, t]))
  const chip = (artifactId: string): ArtifactChip => {
    const artifact = byId.get(artifactId)
    if (!artifact) throw new Error(`${task.id}: unknown artifact ${artifactId}`)
    const producer = tasks.get(artifact.producedBy)
    if (!producer) throw new Error(`artifact ${artifactId}: unknown producer ${artifact.producedBy}`)
    return {
      id: artifact.id,
      label: artifact.label,
      description: artifact.description,
      producerId: producer.id,
      producerTitle: producer.title,
      producerHref: `/processes/${processSlug(producer.title)}`,
      producedHere: producer.id === task.id,
    }
  }
  return { needs: task.requires.map(chip), produces: task.produces.map(chip) }
}

// ---------------------------------------------------------------------------
// Display: the 'Artifacts it produces' table at the bottom of /processes/[slug]
// (founder 2026-10-05: the header 'Produces:' chip row became a table section
// beside the open-modules table — same typed layer, richer columns).
// ---------------------------------------------------------------------------

export interface ProducedArtifactRow {
  id: string
  label: string
  // The registry's committed description (processes/artifacts.json).
  description: string
  // The artifact's site page — /artifacts/{id}.
  href: string
  // The step on this page that brings the artifact into existence: the node tagged
  // producesArtifact (corpus-tested set-equal to the task's produces, never on a
  // jurisdiction-conditional node, so it always renders in the default view).
  bornAt: { nodeId: string; label: string; anchor: string }
  // The canonical producer when it is NOT this page (the LLC page's EIN) — the honest
  // pointer the old header chip carried.
  canonicalProducer: { title: string; href: string } | null
}

export function producedArtifactRows(task: ProcessTask, dir?: string): ProducedArtifactRow[] {
  const byId = artifactsById()
  const tasks = new Map(loadProcesses(dir).map((t) => [t.id, t]))
  return task.produces.map((artifactId) => {
    const artifact = byId.get(artifactId)
    if (!artifact) throw new Error(`${task.id}: unknown artifact ${artifactId}`)
    const node = task.dag.nodes.find((n) => n.producesArtifact === artifactId)
    if (!node) throw new Error(`${task.id}: no step tagged producesArtifact ${artifactId}`)
    const producer = tasks.get(artifact.producedBy)
    if (!producer) throw new Error(`artifact ${artifactId}: unknown producer ${artifact.producedBy}`)
    return {
      id: artifact.id,
      label: artifact.label,
      description: artifact.description,
      href: `/artifacts/${artifact.id}`,
      bornAt: { nodeId: node.id, label: node.label, anchor: `#step-${task.id}-${node.id}` },
      canonicalProducer:
        producer.id === task.id
          ? null
          : { title: producer.title, href: `/processes/${processSlug(producer.title)}` },
    }
  })
}
