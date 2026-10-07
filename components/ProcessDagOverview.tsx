import { Fragment } from 'react'
import { layerNodes, type DagEdge } from '@/lib/dagLayers'
import type { DagNode } from '@/lib/processes'

// The flow overview above the Process breakdown (founder 2026-10-07): the v2 reader's
// top-of-page "Process overview graph" mini-map (components/shared-processes/ProcessViews.tsx
// ProcessOverview — the always-visible strip of step cards wearing the route symbols, each
// opening its step), ported to the canonical page as a compact strip of the SAME corpus DAG
// the diagram below renders. Adapted, not lifted: the v2 strip positions nodes with
// lib/shared-processes/overview-layout.ts from client-side measurement (ResizeObserver +
// measured heights), which cannot be SSR-static — here the shared Kahn layering
// (lib/dagLayers.ts layerNodes, the same call ProcessDag makes) orders the chips and a
// wrapping row replaces the measured canvas, so the static HTML is the final HTML (no
// hydration, no flash). The v2 route symbols (✦ ▤ ♙ ✎) carry over with ProcessDag's route
// hues; each chip is ONE plain anchor to the step's #step-<taskId>-<nodeId> block — no
// nesting, no score links — and parallel layers group behind the diagram's dashed idiom.

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
      className="inline-flex max-w-60 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
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
    <nav
      aria-label="Process flow overview"
      className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5"
    >
      <p className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        Flow overview — click a step to jump to it
      </p>
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
