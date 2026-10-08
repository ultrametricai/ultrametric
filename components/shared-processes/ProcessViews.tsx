'use client'
import { openProcessTarget } from '@/components/shared-processes/open-target'

import Link from 'next/link'
import GraphTypeTooltip from './GraphTypeTooltip'
import { useId, useState, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { SharedRecord } from '@/lib/shared-processes/schema'
import { graphExecutionType, processGraphs, type GraphNode, type GraphScope } from '@/lib/shared-processes/graph'
import { overviewLayout, overviewEdge, overviewInitialHeights } from '@/lib/shared-processes/overview-layout'
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
  const [measured, setMeasured] = useState(false)
  const elements = useRef(new Map<string, HTMLDivElement>())
  const [heights, setHeights] = useState<Record<string, number>>({})
  useLayoutEffect(() => {
    function measure() {
      if (!container.current?.clientWidth) return
      setAvailable(container.current.clientWidth)
      const next = Object.fromEntries([...elements.current].map(([scope, element]) => [scope, Math.ceil(element.getBoundingClientRect().height) || 54]))
      setHeights(previous => Object.keys(next).length === Object.keys(previous).length && Object.entries(next).every(([key, value]) => previous[key] === value) ? previous : next)
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
  const layout = overviewLayout(graph, available, heights)
  const { width, height, positions, nodeWidth } = layout
  const initialHeights = Object.fromEntries(overviewInitialHeights(graph).map((height, index) => [`--overview-height-${index + 1}`, `${height}px`])) as CSSProperties
  return <section aria-label={graph.title} aria-describedby={graph.annotation ? `${marker}-scope` : undefined} className="min-w-0 space-y-3">
    {graph.annotation && <span id={`${marker}-scope`} className="sr-only">{graph.annotation}</span>}
    {!graph.edges.length && <span id={`${marker}-order`} className="sr-only">No dependencies recorded in this scope. Placement does not establish execution order or independence.</span>}
    <h3 className={titleHidden ? "sr-only" : "break-words text-sm font-medium leading-snug text-zinc-100"}>{href ? <Link href={href} className="rounded-sm hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{graph.title}</Link> : graph.title}</h3>
    <div ref={container} role="region" aria-label={`Dependency graph: ${graph.title}`} aria-describedby={!graph.edges.length ? `${marker}-order` : undefined} className="@container/overview relative w-full min-w-0" style={initialHeights}>
      {/* The server cannot know the container width. Keep its narrow calculation
          out of the first paint; reserve responsive folded space instead. These
          real links and dependencies stay usable if hydration never runs. */}
      {!measured && <div data-overview-fallback className="min-h-[var(--overview-height-1)] @min-[512px]/overview:min-h-[var(--overview-height-2)] @min-[760px]/overview:min-h-[var(--overview-height-3)] @min-[1008px]/overview:min-h-[var(--overview-height-4)] @min-[1256px]/overview:min-h-[var(--overview-height-5)] space-y-3 py-8 text-sm text-zinc-400">
        <a href={`#${graph.nodes[0]?.scope}`} className="rounded-sm underline underline-offset-4 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-zinc-300">View process steps</a>
        <details><summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-zinc-300">Recorded dependencies</summary>
          <ul className="mt-3 space-y-2 [overflow-wrap:anywhere]">{graph.edges.length ? graph.edges.map((edge, index) => <li key={index}><a href={`#${graph.id}:${edge.from}`} className="underline underline-offset-4">{graph.nodes.find(node => node.id === edge.from)!.title}</a>{' → '}<a href={`#${graph.id}:${edge.to}`} className="underline underline-offset-4">{graph.nodes.find(node => node.id === edge.to)!.title}</a>{edge.conditional && <span> ({edge.description})</span>}</li>) : graph.nodes.map(node => <li key={node.scope}><a href={`#${node.scope}`} className="underline underline-offset-4">{node.title}</a></li>)}</ul>
        </details>
      </div>}
      <div className={measured ? 'relative mx-auto' : 'invisible absolute top-0 overflow-hidden'} aria-hidden={!measured || undefined} inert={!measured} data-overview-measured={measured} style={{ width, height: measured ? height : 0 }}>
        <svg width={width} height={height} className="absolute inset-0 overflow-visible" role="img" aria-label="Recorded directional dependency edges">
          <defs><marker id={marker} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" /></marker></defs>
          {graph.edges.map((edge, index) => {
            const from = positions.get(edge.from)!, to = positions.get(edge.to)!
            const path = overviewEdge(from, to, layout, index)
            return <path key={index} data-edge-from={`${graph.id}:${edge.from}`} data-edge-to={`${graph.id}:${edge.to}`} d={path} fill="none" stroke="#a1a1aa" strokeWidth="2" strokeDasharray={edge.conditional ? '5 4' : undefined} markerEnd={`url(#${marker})`}><title>{edge.description}</title></path>
          })}
        </svg>
        {graph.nodes.filter(node => positions.has(node.id)).map(node => { const pos = positions.get(node.id)!; return <div key={node.id} ref={element => { if (element) elements.current.set(node.scope, element); else elements.current.delete(node.scope) }} data-graph-node={node.scope} className="absolute flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1" style={{ left: pos.x, top: pos.y, width: nodeWidth }}>
          <TypeIcon node={node} />
          <button type="button" onClick={() => open(node.scope)} title={node.when ? `Applies when: ${node.when}` : undefined} className="min-h-11 min-w-0 flex-1 cursor-pointer self-stretch break-words [overflow-wrap:anywhere] text-left text-sm font-medium leading-snug text-zinc-100 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{node.title}<span className="sr-only"> — open step details{node.when ? `; applies when: ${node.when}` : ''}</span></button>
        </div> })}
      </div>
    </div>
    {graph.unlinked.length > 0 && <div className="space-y-3">
      <p className="text-sm text-zinc-400">Other actions</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">{graph.unlinked.map(node => <div key={node.id} data-graph-node={node.scope} className="relative flex min-w-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1">
        <TypeIcon node={node} />
        <button type="button" onClick={() => open(node.scope)} title={node.when ? `Applies when: ${node.when}` : undefined} className="min-h-11 min-w-0 flex-1 cursor-pointer self-stretch break-words [overflow-wrap:anywhere] text-left text-sm font-medium leading-snug text-zinc-100 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{node.title}<span className="sr-only"> — open step details{node.when ? `; applies when: ${node.when}` : ''}</span></button>
      </div>)}</div>
    </div>}
  </section>
}
export function ProcessOverview({ record, records, processHrefs = {} }: { record: SharedRecord; records: SharedRecord[]; processHrefs?: Record<string, string> }) {
  const region = useRegionalVariant()
  const graphs = processGraphs(record, records, region?.selected)
  const [expanded, setExpanded] = useState(false)
  return <section aria-label="Process overview graph" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-medium text-zinc-100">The process</h2></div>
    {graphs[0] && <ScopeGraph graph={graphs[0]} open={openProcessTarget} titleHidden />}
    {graphs.length > 1 && <details onToggle={event => setExpanded(event.currentTarget.open)} className="text-sm text-zinc-400">
      <summary className="cursor-pointer py-1">Subprocesses and option scopes ({graphs.length - 1})</summary>
      {expanded && <div className="mt-3 space-y-5">{graphs.slice(1).map(graph => <ScopeGraph key={graph.id} graph={graph} href={graph.sourceRecordId ? processHrefs[graph.sourceRecordId] : undefined} open={openProcessTarget} />)}</div>}
    </details>}
  </section>
}
