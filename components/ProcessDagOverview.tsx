'use client'
import { Fragment, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { layerNodes, type DagEdge } from '@/lib/dagLayers'
import type { DagNode } from '@/lib/processes'
import type { GraphEdge, GraphNode, GraphScope } from '@/lib/shared-processes/graph'
import { overviewEdge, overviewInitialHeights, overviewLayout } from '@/lib/shared-processes/overview-layout'

// The flow overview above the Process breakdown — since 2026-10-08 the ACTUAL v2 reader
// diagram (components/shared-processes/ProcessViews.tsx ScopeGraph: node cards, SVG
// dependency edges with arrowheads, the serpentine Kahn fold), mounted on the canonical
// page. The content is the same DAG: the shared records' parts mirror the corpus nodes by
// id (lib/__tests__/shared-canonical-identity.test.ts, process-anchor-contract.test.ts),
// so rendering the corpus nodes/edges through the reader's layout engine
// (lib/shared-processes/overview-layout.ts) IS the v2 diagram over identical content.
// Adapted at the boundary, per the canonical page's contracts:
//   - clicking a node navigates to its #step-<taskId>-<nodeId> block below (one plain
//     anchor per card — no score links, no nested interactives, no reader-only
//     interactions like option scoping or subprocess sections);
//   - the measured layout is client-side (ResizeObserver), so the 10-07 chip strip stays
//     as the SSR/no-JS fallback inside the reader's reserved-height idiom and is replaced
//     by the diagram on mount — real anchors without JS, no hydration mismatch, and the
//     folded height is reserved so the swap does not jump the page;
//   - the 'Flow overview — click a step to jump to it' caption is gone (founder
//     2026-10-08), card text sits a readable tier up (text-base), and arrows touch the
//     card borders (overviewEdge endpoints land on the borders).
// A task without recorded edges is linear by node order (lib/dagLayers.ts corpus
// semantics, same as ProcessDag below) — the diagram draws that sequence rather than the
// reader's unordered-grid idiom for edgeless shared scopes.

// The serialization boundary stays slim: this is a client component, so its props land in
// every process page's payload — the page maps the corpus nodes down to these four fields
// instead of shipping each node's methods, costs, and prompts to the browser.
export type OverviewNode = Pick<DagNode, 'id' | 'label' | 'route' | 'legalSignature'>

const ROUTE_MARK: Record<DagNode['route'], { symbol: string; label: string; cls: string }> = {
  agent: { symbol: '✦', label: 'agent', cls: 'text-emerald-300' },
  form: { symbol: '▤', label: 'manual form', cls: 'text-amber-300' },
  person: { symbol: '♙', label: 'human or computer use', cls: 'text-sky-300' },
}

const SIGNATURE_MARK = { symbol: '✎', label: 'signature — legally human', cls: 'text-violet-300' }

const markFor = (node: OverviewNode) => (node.legalSignature ? SIGNATURE_MARK : ROUTE_MARK[node.route])

// The corpus DAG as the reader layout's GraphScope shape. scope keys double as the
// height-measurement keys and the per-card anchors.
function toGraph(nodes: OverviewNode[], edges: DagEdge[] | undefined, taskId: string): GraphScope {
  const graphNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    title: n.label,
    metadata: { route: n.route, legalSignature: n.legalSignature },
    when: null,
    scope: `step-${taskId}-${n.id}`,
  }))
  const ids = new Set(graphNodes.map((n) => n.id))
  const recorded = (edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to))
  const sequence: DagEdge[] = recorded.length
    ? recorded
    : nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }))
  const titles = new Map(graphNodes.map((n) => [n.id, n.title]))
  const graphEdges: GraphEdge[] = sequence.map((e) => ({
    from: e.from,
    to: e.to,
    conditional: false,
    description: `${titles.get(e.from)} → ${titles.get(e.to)}`,
  }))
  return {
    id: taskId,
    title: taskId,
    nodes: graphNodes,
    edges: graphEdges,
    layers: layerNodes(graphNodes, graphEdges),
    unlinked: [],
    unresolved: 0,
  }
}

function OverviewChip({ node, taskId }: { node: OverviewNode; taskId: string }) {
  const mark = markFor(node)
  return (
    <a
      href={`#step-${taskId}-${node.id}`}
      title={`${node.label} — ${mark.label}; jump to this step below`}
      className="inline-flex max-w-60 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-sm text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
    >
      <span aria-hidden className={`shrink-0 ${mark.cls}`}>{mark.symbol}</span>
      <span className="truncate">{node.label}</span>
    </a>
  )
}

export default function ProcessDagOverview({
  nodes,
  edges,
  taskId,
}: {
  nodes: OverviewNode[]
  edges?: DagEdge[]
  taskId: string
}) {
  const marker = useId().replaceAll(':', '')
  const container = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(320)
  const [measured, setMeasured] = useState(false)
  const elements = useRef(new Map<string, HTMLDivElement>())
  const [heights, setHeights] = useState<Record<string, number>>({})
  const graph = toGraph(nodes, edges, taskId)
  // The same topological layers as the diagram below (lib/dagLayers.ts) — the fallback
  // strip and the measured diagram can never disagree on order or parallelism.
  const chipLayers = layerNodes(nodes, edges)
  useLayoutEffect(() => {
    function measure() {
      if (!container.current?.clientWidth) return
      setAvailable(container.current.clientWidth)
      const next = Object.fromEntries(
        [...elements.current].map(([scope, element]) => [scope, Math.ceil(element.getBoundingClientRect().height) || 54]),
      )
      setHeights((previous) =>
        Object.keys(next).length === Object.keys(previous).length &&
        Object.entries(next).every(([key, value]) => previous[key] === value)
          ? previous
          : next,
      )
      // Measure once more after applying the real width, so wrapped labels and
      // connectors agree on the very first visible frame.
      if (available === container.current.clientWidth) setMeasured(true)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    if (container.current) observer.observe(container.current)
    for (const element of elements.current.values()) observer.observe(element)
    return () => observer.disconnect()
  }, [graph.nodes, available])
  if (chipLayers.length === 0) return null
  const layout = overviewLayout(graph, available, heights)
  const { width, height, positions, nodeWidth } = layout
  const initialHeights = Object.fromEntries(
    overviewInitialHeights(graph).map((h, index) => [`--overview-height-${index + 1}`, `${h}px`]),
  ) as CSSProperties
  return (
    <nav
      aria-label="Process flow overview"
      className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5"
    >
      <div ref={container} className="@container/overview relative w-full min-w-0" style={initialHeights}>
        {/* The server cannot know the container width. The chip strip is the complete
            no-JS overview (every node, every anchor); folded diagram space is reserved so
            the on-mount swap does not move the page. */}
        {!measured && (
          <div
            data-overview-fallback
            className="flex min-h-[var(--overview-height-1)] flex-wrap content-start items-center gap-y-1.5 py-1 @min-[512px]/overview:min-h-[var(--overview-height-2)] @min-[760px]/overview:min-h-[var(--overview-height-3)] @min-[1008px]/overview:min-h-[var(--overview-height-4)] @min-[1256px]/overview:min-h-[var(--overview-height-5)]"
          >
            {chipLayers.map((layer, li) => (
              <Fragment key={layer[0].id}>
                {li > 0 && (
                  <span aria-hidden className="mx-1.5 select-none text-zinc-600">
                    →
                  </span>
                )}
                {layer.length === 1 ? (
                  <OverviewChip node={layer[0]} taskId={taskId} />
                ) : (
                  <span
                    className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-dashed border-zinc-700/80 p-1"
                    title={`runs in parallel · ${layer.length}`}
                  >
                    {layer.map((n) => (
                      <OverviewChip key={n.id} node={n} taskId={taskId} />
                    ))}
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        )}
        <div
          className={measured ? 'relative mx-auto' : 'invisible absolute top-0 overflow-hidden'}
          aria-hidden={!measured || undefined}
          inert={!measured}
          data-overview-measured={measured}
          style={{ width, height: measured ? height : 0 }}
        >
          <svg
            width={width}
            height={height}
            className="absolute inset-0 overflow-visible"
            role="img"
            aria-label="Step order and dependency edges"
          >
            <defs>
              <marker id={marker} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" />
              </marker>
            </defs>
            {graph.edges.map((edge, index) => {
              const from = positions.get(edge.from)
              const to = positions.get(edge.to)
              if (!from || !to) return null
              return (
                <path
                  key={index}
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  d={overviewEdge(from, to, layout, index)}
                  fill="none"
                  stroke="#a1a1aa"
                  strokeWidth="2"
                  markerEnd={`url(#${marker})`}
                >
                  <title>{edge.description}</title>
                </path>
              )
            })}
          </svg>
          {nodes.filter((node) => positions.has(node.id)).map((node) => {
            const pos = positions.get(node.id)!
            const mark = markFor(node)
            const scope = `step-${taskId}-${node.id}`
            return (
              <div
                key={node.id}
                ref={(element) => {
                  if (element) elements.current.set(scope, element)
                  else elements.current.delete(scope)
                }}
                data-graph-node={scope}
                className="absolute flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1"
                style={{ left: pos.x, top: pos.y, width: nodeWidth }}
              >
                <span aria-hidden className={`shrink-0 text-lg ${mark.cls}`}>{mark.symbol}</span>
                <a
                  href={`#${scope}`}
                  title={`${node.label} — ${mark.label}; jump to this step below`}
                  className="flex min-h-11 min-w-0 flex-1 items-center break-words [overflow-wrap:anywhere] text-base font-medium leading-snug text-zinc-100 transition hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300"
                >
                  {node.label}
                  <span className="sr-only"> — {mark.label}; jump to this step below</span>
                </a>
              </div>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
