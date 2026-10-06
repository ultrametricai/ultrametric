'use client'

import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { processGraphs, type GraphScope } from '@/lib/shared-processes/graph'
import type { SharedRecord } from '@/lib/shared-processes/schema'
import { stepFlowNeedsGutter, stepFlowPaths, type StepBox } from '@/lib/shared-processes/step-flow'
import { useRegionalVariant } from './RegionalVariant'

const Graphs = createContext<GraphScope[]>([])

export function StepFlowProvider({ record, records, children }: { record: SharedRecord; records: SharedRecord[]; children: ReactNode }) {
  const region = useRegionalVariant()
  const graphs = useMemo(() => processGraphs(record, records, region?.selected), [record, records, region?.selected])
  return <Graphs.Provider value={graphs}>{children}</Graphs.Provider>
}

export default function StepFlow({ scope, children }: { scope: string; children: ReactNode }) {
  const graph = useContext(Graphs).find(graph => graph.id === scope)
  const container = useRef<HTMLDivElement>(null)
  const marker = useId().replaceAll(':', '')
  const [boxes, setBoxes] = useState<StepBox[]>([])
  const gutter = graph && stepFlowNeedsGutter(graph)
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    function measure() {
      const origin = element!.getBoundingClientRect()
      const next = [...element!.children].flatMap(child => {
        if (child.tagName !== 'ARTICLE' || !child.getClientRects().length) return []
        observer?.observe(child)
        const rect = child.getBoundingClientRect()
        return [{ id: child.id, left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height }]
      })
      setBoxes(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    observer?.observe(element)
    const mutations = new MutationObserver(measure)
    mutations.observe(element, { childList: true, subtree: true })
    measure()
    return () => { observer?.disconnect(); mutations.disconnect() }
  }, [graph, gutter])
  const paths = graph ? stepFlowPaths(graph, boxes) : []
  return <div className="relative min-w-0" data-step-flow={scope}>
    <div ref={container} className={`space-y-6 ${gutter ? 'pl-6' : ''}`}>{children}</div>
    {paths.length > 0 && <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={`Recorded step dependencies: ${graph!.title}`}>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" /></marker></defs>
      {paths.map((edge, index) => <path key={index} data-step-edge-from={edge.fromScope} data-step-edge-to={edge.toScope} d={edge.path} fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray={edge.conditional ? '4 3' : undefined} markerEnd={`url(#${marker})`}><title>{edge.description}</title></path>)}
    </svg>}
  </div>
}
