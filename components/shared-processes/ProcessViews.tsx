'use client'

import Link from 'next/link'
import GraphTypeTooltip from './GraphTypeTooltip'
import { useId, useState, useLayoutEffect, useRef } from 'react'
import type { SharedRecord } from '@/lib/shared-processes/schema'
import { graphExecutionType, processGraphs, type GraphNode, type GraphScope } from '@/lib/shared-processes/graph'
import { overviewLayout, overviewEdge } from '@/lib/shared-processes/overview-layout'
import { useRegionalVariant } from './RegionalVariant'

function TypeIcon({ node }: { node: GraphNode }) {
  if (!['agent', 'form', 'person'].includes(String(node.metadata.route)) && node.metadata.legalSignature !== true) return null
  const type = graphExecutionType(node)
  const agent = node.metadata.route === 'agent' && node.metadata.legalSignature !== true
  return <GraphTypeTooltip label={agent ? 'Agent' : type.label} symbol={type.symbol} color={agent ? 'text-emerald-300' : type.color} />
}
function ScopeGraph({ graph, open, href, titleHidden = false }: { titleHidden?: boolean; href?: string; graph: GraphScope; open: (scope: string) => void }) {
  const marker = useId().replaceAll(':', '')
  const container = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(320)
  const elements = useRef(new Map<string, HTMLDivElement>())
  const [heights, setHeights] = useState<Record<string, number>>({})
  useLayoutEffect(() => {
    function measure() {
      if (container.current?.clientWidth) setAvailable(container.current.clientWidth)
      const next = Object.fromEntries([...elements.current].map(([scope, element]) => [scope, Math.ceil(element.getBoundingClientRect().height) || 54]))
      setHeights(previous => Object.keys(next).length === Object.keys(previous).length && Object.entries(next).every(([key, value]) => previous[key] === value) ? previous : next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    if (container.current) observer.observe(container.current)
    for (const element of elements.current.values()) observer.observe(element)
    return () => observer.disconnect()
  }, [graph.nodes])
  const { width, height, positions, nodeWidth, chain } = overviewLayout(graph, available, heights)
  return <section aria-label={graph.title} aria-describedby={graph.annotation ? `${marker}-scope` : undefined} className="min-w-0 space-y-3">
    {graph.annotation && <span id={`${marker}-scope`} className="sr-only">{graph.annotation}</span>}
    {!graph.edges.length && <span id={`${marker}-order`} className="sr-only">No dependencies recorded in this scope. Placement does not establish execution order or independence.</span>}
    <h3 className={titleHidden ? "sr-only" : "break-words text-sm font-medium leading-snug text-zinc-100"}>{href ? <Link href={href} className="rounded-sm hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{graph.title}</Link> : graph.title}</h3>
    <div ref={container} tabIndex={0} role="region" aria-label={`Scrollable dependency graph: ${graph.title}`} aria-describedby={!graph.edges.length ? `${marker}-order` : undefined} className="max-h-80 max-w-full overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/30 focus-visible:outline-2 focus-visible:outline-emerald-300">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg width={width} height={height} className="absolute inset-0 overflow-visible" role="img" aria-label="Recorded directional dependency edges">
          <defs><marker id={marker} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" /></marker></defs>
          {graph.edges.map((edge, index) => {
            const from = positions.get(edge.from)!, to = positions.get(edge.to)!
            const path = overviewEdge(from, to, nodeWidth, chain, index)
            return <path key={index} data-edge-from={`${graph.id}:${edge.from}`} data-edge-to={`${graph.id}:${edge.to}`} d={path} fill="none" stroke="#a1a1aa" strokeWidth="2" strokeDasharray={edge.conditional ? '5 4' : undefined} markerEnd={`url(#${marker})`}><title>{edge.description}</title></path>
          })}
        </svg>
        {graph.nodes.filter(node => positions.has(node.id)).map(node => { const pos = positions.get(node.id)!; return <div key={node.id} ref={element => { if (element) elements.current.set(node.scope, element); else elements.current.delete(node.scope) }} data-graph-node={node.scope} className="absolute flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1" style={{ left: pos.x, top: pos.y, width: nodeWidth }}>
          <TypeIcon node={node} />
          <button type="button" onClick={() => open(node.scope)} title={node.when ? `Applies when: ${node.when}` : undefined} className="min-h-11 min-w-0 flex-1 self-stretch break-words text-left text-xs font-medium leading-snug text-zinc-100 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{node.title}<span className="sr-only"> — open step details{node.when ? `; applies when: ${node.when}` : ''}</span></button>
        </div> })}
      </div>
    </div>
    {graph.unlinked.length > 0 && <div className="space-y-3">
      <p className="text-xs text-zinc-400">Other actions</p>
      <div className="flex max-w-full gap-4 overflow-x-auto pb-3">{graph.unlinked.map(node => <div key={node.id} data-graph-node={node.scope} className="relative flex w-60 shrink-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1">
        <TypeIcon node={node} />
        <button type="button" onClick={() => open(node.scope)} title={node.when ? `Applies when: ${node.when}` : undefined} className="min-h-11 min-w-0 flex-1 self-stretch break-words text-left text-xs font-medium leading-snug text-zinc-100 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{node.title}<span className="sr-only"> — open step details{node.when ? `; applies when: ${node.when}` : ''}</span></button>
      </div>)}</div>
    </div>}
  </section>
}
export function ProcessOverview({ record, records, processHrefs = {} }: { record: SharedRecord; records: SharedRecord[]; processHrefs?: Record<string, string> }) {
  const region = useRegionalVariant()
  const graphs = processGraphs(record, records, region?.selected)
  const [expanded, setExpanded] = useState(false)
  function open(scope: string) {
    const element = document.getElementById(scope)
    for (let parent = element?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true
    if (element instanceof HTMLDetailsElement) element.open = true
    element?.setAttribute('tabindex', '-1')
    element?.focus({ preventScroll: true })
    element?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  return <section aria-label="Process overview graph" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-medium text-zinc-100">The process</h2></div>
    {graphs[0] && <ScopeGraph graph={graphs[0]} open={open} titleHidden />}
    {graphs.length > 1 && <details onToggle={event => setExpanded(event.currentTarget.open)} className="text-xs text-zinc-400">
      <summary className="cursor-pointer py-1">Subprocesses and option scopes ({graphs.length - 1})</summary>
      {expanded && <div className="mt-3 space-y-5">{graphs.slice(1).map(graph => <ScopeGraph key={graph.id} graph={graph} href={graph.sourceRecordId ? processHrefs[graph.sourceRecordId] : undefined} open={open} />)}</div>}
    </details>}
  </section>
}
