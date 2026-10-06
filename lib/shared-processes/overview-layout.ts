import type { GraphScope } from './graph'

export interface OverviewPosition {
  x: number; y: number; height: number
  row: number; rowTop: number; rowBottom: number
  layer: number; siblings: number; direction: number
}

// Match the column thresholds below and the CSS container queries in ProcessViews.
// This reserves the graph's folded row count before the browser can measure labels.
export function overviewInitialHeights(graph: GraphScope) {
  return [264, 512, 760, 1008, 1256].map(width => overviewLayout(graph, width, {}).height)
}

// Fold Kahn layers, not a flattened execution sequence. Parallel nodes share a
// column; their only connections are the recorded edges drawn by the caller.
export function overviewLayout(graph: GraphScope, available: number, heights: Record<string, number>) {
  const gapX = 48, gapY = 56, padding = 32, siblingGap = 16
  const width = Math.max(1, available)
  const columns = Math.max(1, Math.min(5, Math.floor((width - padding * 2 + gapX) / (200 + gapX))))
  const nodeWidth = Math.max(1, Math.min(240, (width - padding * 2 - gapX * (columns - 1)) / columns))
  // An edgeless scope is an unordered grid, without implied connections.
  const layers = graph.edges.length ? graph.layers : graph.layers.flat().map(node => [node])
  const inset = (width - columns * nodeWidth - (columns - 1) * gapX) / 2
  const positions = new Map<string, OverviewPosition>()
  const nodeHeight = (scope: string) => heights[scope] ?? 54
  let y = padding
  for (let offset = 0; offset < layers.length; offset += columns) {
    const row = offset / columns
    const band = layers.slice(offset, offset + columns)
    const columnHeights = band.map(layer => layer.reduce((total, node) => total + nodeHeight(node.scope), 0) + (layer.length - 1) * siblingGap)
    const bandHeight = Math.max(...columnHeights)
    const direction = graph.edges.length && row % 2 ? -1 : 1
    band.forEach((layer, column) => {
      const x = inset + (direction === 1 ? column : columns - 1 - column) * (nodeWidth + gapX)
      let nodeY = y + (bandHeight - columnHeights[column]) / 2
      for (const node of layer) {
        const height = nodeHeight(node.scope)
        positions.set(node.id, { x, y: nodeY, height, row, rowTop: y, rowBottom: y + bandHeight, layer: offset + column, siblings: layer.length, direction })
        nodeY += height + siblingGap
      }
    })
    y += bandHeight + gapY
  }
  return { positions, width, height: layers.length ? y - gapY + padding : 0, nodeWidth, columns }
}

export function overviewEdge(from: OverviewPosition, to: OverviewPosition, layout: { nodeWidth: number; width: number; columns: number }, index: number) {
  const { nodeWidth, width, columns } = layout
  // On a single-column screen an ordinary sequential edge points straight down.
  if (columns === 1 && from.siblings === 1 && to.siblings === 1 && to.layer === from.layer + 1) {
    const x = from.x + nodeWidth / 2
    return `M ${x} ${from.y + from.height + 2} V ${to.y - 4}`
  }
  const x1 = from.x + (from.direction === 1 ? nodeWidth + 2 : -2), y1 = from.y + from.height / 2
  const x2 = to.x + (to.direction === 1 ? -4 : nodeWidth + 4), y2 = to.y + to.height / 2
  if (from.row === to.row && to.layer === from.layer + 1) {
    const mid = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
  }
  // Gutters stay outside every card. Skip-layer edges use the band corridors;
  // a fold enters the next row from its new reading direction.
  const laneOffset = 12 + (index % 3) * 4
  const out = x1 + from.direction * laneOffset
  const into = x2 - to.direction * laneOffset
  if (from.row === to.row) {
    const above = from.rowTop - laneOffset
    return `M ${x1} ${y1} H ${out} V ${above} H ${into} V ${y2} H ${x2}`
  }
  if (to.layer === from.layer + 1) {
    const lane = from.direction === 1 ? width - laneOffset : laneOffset
    return `M ${x1} ${y1} H ${lane} V ${y2} H ${x2}`
  }
  const below = from.rowBottom + laneOffset, above = to.rowTop - laneOffset
  const lane = from.direction === 1 ? width - 8 : 8
  return `M ${x1} ${y1} H ${out} V ${below} H ${lane} V ${above} H ${into} V ${y2} H ${x2}`
}
