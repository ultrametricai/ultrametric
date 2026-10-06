import type { GraphScope } from './graph'

export interface StepBox { id: string; left: number; top: number; width: number; height: number }

export function stepFlowNeedsGutter(graph: GraphScope) {
  const order = new Map(graph.nodes.map((node, index) => [node.id, index]))
  return graph.edges.some(edge => order.get(edge.to)! !== order.get(edge.from)! + 1)
}

// Card placement never supplies an edge: route only the canonical graph's links.
export function stepFlowPaths(graph: GraphScope, boxes: StepBox[]) {
  const byId = new Map(boxes.map((box, index) => [box.id, { ...box, index }]))
  return graph.edges.flatMap((edge, index) => {
    const from = byId.get(`${graph.id}:${edge.from}`), to = byId.get(`${graph.id}:${edge.to}`)
    if (!from || !to) return []
    const consecutive = to.index === from.index + 1
    const x = from.left + from.width / 2
    const path = consecutive
      ? `M ${x} ${from.top + from.height + 2} L ${to.left + to.width / 2} ${to.top - 4}`
      : `M ${from.left - 2} ${from.top + from.height - 16} H ${4 + index % 3 * 5} V ${to.top + 16} H ${to.left - 4}`
    return [{ ...edge, fromScope: from.id, toScope: to.id, path }]
  })
}
