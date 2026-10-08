import { Fragment } from 'react'
import { layerNodes, type DagEdge } from '@/lib/dagLayers'
import type { DagNode } from '@/lib/processes'

// The flow overview above the Process breakdown — back to the original strip (founder
// revert, 2026-10-08): the canonical page returns to the compact SSR chip strip of
// route-marked step anchors, server-rendered from the corpus DAG. The same-day v2
// diagram mount (the reader's ScopeGraph idiom: client-measured node cards + SVG edges,
// ResizeObserver, the reserved-height fallback swap) is retired from this page; the v2
// reader pages keep their diagram, including the overviewEdge on-border endpoint fix in
// lib/shared-processes/overview-layout.ts, which stays.
//
// What the revert keeps from the diagram round:
//   - no caption line (the 'Flow overview — click a step to jump to it' heading stays
//     gone);
//   - the bumped chip text (text-sm — founder wants the bigger text tier generally);
//   - no enclosing box: the strip and the Process breakdown region below both lost
//     their border/rounded wrapper chrome (founder 2026-10-08).
// Unchanged from the original: the shared Kahn layering (lib/dagLayers.ts layerNodes,
// the same call ProcessDag makes) orders the chips, so the static HTML is the final HTML
// (no hydration, no flash); each chip is ONE plain anchor to the step's
// #step-<taskId>-<nodeId> block (no nesting, no score links); parallel layers group
// behind the diagram's dashed idiom; the v2 route symbols (✦ ▤ ♙ ✎) wear ProcessDag's
// route hues.

const ROUTE_MARK: Record<DagNode['route'], { symbol: string; label: string; cls: string }> = {
  agent: { symbol: '✦', label: 'agent', cls: 'text-emerald-300' },
  form: { symbol: '▤', label: 'manual form', cls: 'text-amber-300' },
  person: { symbol: '♙', label: 'human or computer use', cls: 'text-sky-300' },
}

const SIGNATURE_MARK = { symbol: '✎', label: 'signature — legally human', cls: 'text-violet-300' }

function OverviewChip({ node, taskId }: { node: DagNode; taskId: string }) {
  const mark = node.legalSignature ? SIGNATURE_MARK : ROUTE_MARK[node.route]
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
  nodes: DagNode[]
  edges?: DagEdge[]
  taskId: string
}) {
  // The same topological layers as the diagram below (lib/dagLayers.ts) — the two views can
  // never disagree on order or parallelism.
  const layers = layerNodes(nodes, edges)
  if (layers.length === 0) return null
  return (
    <nav aria-label="Process flow overview">
      <div className="flex flex-wrap items-center gap-y-1.5">
        {layers.map((layer, li) => (
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
    </nav>
  )
}
