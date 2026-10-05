import type { GraphScope } from './graph'

export interface OverviewPosition { x: number; y: number; height: number; row: number; rowBottom: number }
// Presentation only: never derives, joins, or changes canonical dependencies.
export function overviewLayout(graph: GraphScope, available: number, heights: Record<string, number>) {
  const gapX = 32, gapY = 24, padding = 16
  const chain = graph.edges.length > 0 && graph.layers.every(layer => layer.length === 1)
    && graph.edges.length === graph.layers.length - 1
    && graph.layers.every((layer, index) => index === 0 || graph.edges.some(edge => edge.from === graph.layers[index - 1][0].id && edge.to === layer[0].id))
  const grid = chain || !graph.edges.length
  const columns = Math.max(1, Math.min(5, Math.floor((available - padding * 2 + gapX) / (200 + gapX))))
  const nodeWidth = grid ? Math.min(240, (available - padding * 2 - gapX * (columns - 1)) / columns) : 200
  const nodes = graph.layers.flat()
  const rows = grid ? Array.from({ length: Math.ceil(nodes.length / columns) }, (_, index) => nodes.slice(index * columns, (index + 1) * columns)) : graph.layers
  const width = Math.max(available, Math.max(...rows.map(row => row.length), 1) * (nodeWidth + gapX) - gapX + padding * 2)
  const positions = new Map<string, OverviewPosition>()
  let y = padding
  rows.forEach((row, rowIndex) => {
    const height = Math.max(...row.map(node => heights[node.scope] ?? 54))
    row.forEach((node, column) => {
      const x = grid ? padding + (chain && rowIndex % 2 ? columns - 1 - column : column) * (nodeWidth + gapX)
        : (width - (row.length * (nodeWidth + gapX) - gapX)) / 2 + column * (nodeWidth + gapX)
      positions.set(node.id, { x, y, height: heights[node.scope] ?? 54, row: rowIndex, rowBottom: y + height })
    })
    y += height + gapY
  })
  return { positions, width, height: y - gapY + padding, nodeWidth, chain }
}

export function overviewEdge(from: OverviewPosition, to: OverviewPosition, nodeWidth: number, chain: boolean, index: number) {
  if (chain && from.row === to.row) {
    const forward = to.x > from.x
    const x1 = from.x + (forward ? nodeWidth + 2 : -2), x2 = to.x + (forward ? -4 : nodeWidth + 4)
    const y1 = from.y + from.height / 2, y2 = to.y + to.height / 2
    return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`
  }
  const x1 = from.x + nodeWidth / 2, y1 = from.y + from.height + 2, x2 = to.x + nodeWidth / 2, y2 = to.y - 4
  if (to.row - from.row > 1) {
    const lane = 4 + (index % 3) * 4
    return `M ${x1} ${y1} V ${from.rowBottom + 10} H ${lane} V ${y2 - 8} H ${x2} V ${y2}`
  }
  return `M ${x1} ${y1} V ${from.rowBottom + 8} C ${x1} ${from.rowBottom + 12}, ${x2} ${y2 - 8}, ${x2} ${y2}`
}
