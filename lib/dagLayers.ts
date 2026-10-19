// Kahn layering for process DAGs — extracted from components/ProcessDag.tsx's layerNodes so
// every DAG rendering (the full vertical diagram, the shared-process graph) shares ONE
// layout truth (same approach as the ai-docs dashboard's layoutDAG): each topological layer is
// one row/column of the diagram; a layer with >1 node is genuine parallelism. Tasks without
// edges have no recorded dependency. Nodes an edge cycle would strand are appended as their own
// layers. Pure derivation — no data access, no React.

export interface DagEdge {
  from: string
  to: string
}

export function layerNodes<N extends { id: string }>(nodes: N[], edges?: DagEdge[]): N[][] {
  if (!nodes.length) return []
  if (!edges || edges.length === 0) return [nodes]
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const order = new Map(nodes.map((n, i) => [n.id, i]))
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const children = new Map<string, string[]>(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
    children.get(e.from)?.push(e.to)
  }
  const layers: N[][] = []
  const seen = new Set<string>()
  let frontier = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  while (frontier.length > 0) {
    const layer: string[] = []
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      layer.push(id)
      for (const child of children.get(id) ?? []) {
        const d = (inDegree.get(child) ?? 1) - 1
        inDegree.set(child, d)
        if (d <= 0) next.push(child)
      }
    }
    if (layer.length > 0) {
      layer.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      layers.push(layer.map((id) => byId.get(id)!))
    }
    frontier = next
  }
  for (const n of nodes) if (!seen.has(n.id)) layers.push([n])
  return layers
}
