import { layerNodes } from '../dagLayers'
import type { Connection, Part, SharedRecord } from './schema'
import { regionalDecision } from './regions'
import { previewContext } from './preview-context'

export interface GraphNode { id: string; title: string; metadata: Record<string, unknown>; when: string | null; scope: string; sourceScope?: string }
export interface GraphEdge extends Connection { conditional: boolean; description: string }
export interface GraphScope { sourceRecordId?: string; annotation?: string; id: string; title: string; nodes: GraphNode[]; edges: GraphEdge[]; layers: GraphNode[][]; unlinked: GraphNode[]; unresolved: number }

// Keep each option's graph separate: containment is not a dependency edge.
export function processGraphs(record: SharedRecord, records: SharedRecord[], selected = 'default'): GraphScope[] {
  const result: GraphScope[] = []
  const regional = regionalDecision(record)
  function visit(parts: Part[], links: Connection[], scope: string, title: string, ancestors = new Set([record.id]), sourceId = record.id, sourceRecordId: string | undefined = record.id, annotation?: string) {
    const visibleParts = parts.filter(part => { const context = previewContext(part.metadata); return !context || regional?.scope !== `${scope}:${context.decision}` || selected === context.option })
    const nodes = visibleParts.map(part => {
      const bound = regional?.scope === `${scope}:${part.id}`
      const option = bound ? part.options.find(option => option.id === selected) : undefined
      return { id: part.id, scope: `${scope}:${part.id}`, sourceScope: `${sourceId}:${part.id}`, title: bound && selected !== 'default' ? option?.title ?? part.title ?? part.id : part.title ?? records.find(record => record.id === part.ref)?.title ?? part.id,
        metadata: option ? option.metadata : part.kind === 'decision' ? part.options.find(option => option.id === 'default')?.metadata ?? part.metadata : part.metadata, when: part.when }
    })
    const ids = new Set(nodes.map(node => node.id))
    let unresolved = 0
    const edges: GraphEdge[] = []
    for (const link of links) {
      if (!ids.has(link.from) || !ids.has(link.to)) { if (!parts.some(part => part.id === link.from) || !parts.some(part => part.id === link.to)) unresolved++; continue }
      const source = parts.find(part => part.id === link.from)!
      const bound = regional?.scope === `${scope}:${source.id}`
      if (bound && link.option && regional.options.some(option => option.id === link.option) && link.option !== selected) continue
      const option = source.options.find(option => option.id === link.option)
      const condition = [link.when, link.option && (!bound || link.option !== selected) ? `Option: ${option?.title ?? link.option}` : null].filter(Boolean).join('; ')
      edges.push({ ...link, conditional: !!condition, description: `${nodes.find(node => node.id === link.from)!.title} → ${nodes.find(node => node.id === link.to)!.title}${condition ? ` (${condition})` : ''}` })
    }
    // Legacy layout deliberately makes edgeless lists sequential. Bypass that
    // fallback: no recorded dependency must remain no recorded dependency.
    const linkedIds = new Set(edges.flatMap(edge => [edge.from, edge.to]))
    const unlinked = edges.length ? nodes.filter(node => !linkedIds.has(node.id)) : []
    if (nodes.length) result.push({ id: scope, title, sourceRecordId, annotation, nodes, edges, layers: edges.length ? layerNodes(nodes.filter(node => linkedIds.has(node.id)), edges) : [nodes], unlinked, unresolved })
    for (const part of visibleParts) {
      const referenced = records.find(record => record.id === part.ref)
      if (referenced && !ancestors.has(referenced.id)) visit(referenced.parts, referenced.links, `${scope}:${part.id}:ref`, part.title ?? referenced.title, new Set(ancestors).add(referenced.id), referenced.id, referenced.id, "Subprocess")
    }
    for (const part of visibleParts) for (const option of part.options) {
      const bound = regional?.scope === `${scope}:${part.id}` && regional.options.some(candidate => candidate.id === option.id)
      if (bound && option.id !== selected) continue
      visit(option.parts, option.links ?? [], `${scope}:${part.id}:${option.id}`, `${part.title ?? part.id} / ${option.title}`, ancestors, sourceId, undefined, `${option.when ? `${option.when} · ` : ''}${bound ? 'Selected regional variant' : 'Option scope; applicability not selected'}`)
    }
  }
  visit(record.parts, record.links, record.id, record.title)
  return result
}

export function graphExecutionType(node: GraphNode) {
  if (node.metadata.legalSignature === true) return { label: 'Signature — legally human', symbol: '✎', color: 'text-violet-300' }
  if (node.metadata.route === 'agent') return { label: (node.sourceScope ?? node.scope) === 'form_001:n3' ? 'Agent · unverified; no verified API or tool binding' : 'Agent classification; execution integration not verified', symbol: '✦', color: (node.sourceScope ?? node.scope) === 'form_001:n3' ? 'text-zinc-400' : 'text-emerald-300' }
  if (node.metadata.route === 'form') return { label: 'Manual form', symbol: '▤', color: 'text-amber-300' }
  if (node.metadata.route === 'person') return { label: 'Human or computer use', symbol: '♙', color: 'text-sky-300' }
  return { label: 'Execution type not specified', symbol: '?', color: 'text-zinc-500' }
}
