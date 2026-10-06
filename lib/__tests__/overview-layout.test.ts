import { describe, expect, it } from 'vitest'
import { loadSharedProcesses } from '../shared-processes/load'
import { processGraphs } from '../shared-processes/graph'
import { overviewEdge, overviewLayout, overviewInitialHeights } from '../shared-processes/overview-layout'
const records = loadSharedProcesses()

// Sample the actual SVG paths, including bends, to catch arrows routed through
// unrelated cards or outside the canvas (not just correctly positioned boxes).
function pathPoints(path: string) {
  const tokens = path.match(/[MHVC]|-?\d+(?:\.\d+)?/g)!
  let x = 0, y = 0, i = 0
  const points: Array<{ x: number; y: number }> = []
  const number = () => Number(tokens[i++])
  while (i < tokens.length) {
    const command = tokens[i++]
    if (command === 'M') { x = number(); y = number(); points.push({ x, y }); continue }
    const startX = x, startY = y
    if (command === 'C') {
      const cx1 = number(), cy1 = number(), cx2 = number(), cy2 = number()
      x = number(); y = number()
      for (let step = 1; step <= 30; step++) {
        const t = step / 30, u = 1 - t
        points.push({ x: u ** 3 * startX + 3 * u ** 2 * t * cx1 + 3 * u * t ** 2 * cx2 + t ** 3 * x, y: u ** 3 * startY + 3 * u ** 2 * t * cy1 + 3 * u * t ** 2 * cy2 + t ** 3 * y })
      }
    } else {
      if (command === 'H') x = number()
      else if (command === 'V') y = number()
      else throw new Error(`Unexpected SVG command: ${command}`)
      for (let step = 1; step <= 30; step++) points.push({ x: startX + (x - startX) * step / 30, y: startY + (y - startY) * step / 30 })
    }
  }
  return points
}

describe('responsive overview layout', () => {
  it('reserves folded row heights at the actual container-query column thresholds before measuring', () => {
    const graph = processGraphs(records.find(record => record.id === 'form_001')!, records)[0]
    expect(overviewInitialHeights(graph)).toEqual([1108, 558, 448, 338, 228])
    for (const width of [264, 512, 760, 1008, 1256]) {
      expect(overviewInitialHeights(graph)[overviewLayout(graph, width, {}).columns - 1]).toBe(overviewLayout(graph, width, {}).height)
    }
  })
  it('folds the actual LLC branching graph in alternating rows without sequencing siblings', () => {
    const graph = processGraphs(records.find(record => record.id === 'form_011')!, records)[0]
    const layout = overviewLayout(graph, 1240, {})
    const sequence = graph.layers.map(layer => layout.positions.get(layer[0].id)!)
    expect(sequence[1].x).toBeGreaterThan(sequence[0].x)
    const returnRow = sequence.filter(position => position.row === 1)
    expect(returnRow.length).toBeGreaterThan(1)
    expect(returnRow[1].x).toBeLessThan(returnRow[0].x)
    expect(graph.layers.some(layer => layer.length > 1)).toBe(true)
    for (const layer of graph.layers) {
      expect(new Set(layer.map(node => layout.positions.get(node.id)!.x)).size).toBe(1)
      for (const a of layer) for (const b of layer) expect(graph.edges.some(edge => edge.from === a.id && edge.to === b.id)).toBe(false)
    }
    for (const node of graph.unlinked) expect(layout.positions.has(node.id)).toBe(false)
  })

  it('keeps edgeless scopes unordered and handles empty scopes', () => {
    const unordered = processGraphs(records.find(record => record.id === 'get-paid')!, records)[0]
    expect(unordered.edges).toHaveLength(0)
    expect(overviewLayout(unordered, 256, {}).positions.size).toBe(unordered.nodes.length)
    const empty = overviewLayout({ ...unordered, nodes: [], layers: [] }, 256, {})
    expect(empty.height).toBe(0)
  })

  it('fits cards and recorded edges without collisions across the catalog and narrow viewports', () => {
    for (const record of records) for (const graph of processGraphs(record, records)) for (const width of [256, 326, 984, 1240]) {
      const before = JSON.stringify(graph)
      const heights = Object.fromEntries(graph.nodes.map((node, index) => [node.scope, index % 3 ? 80 : 180]))
      const layout = overviewLayout(graph, width, heights)
      const positions = [...layout.positions.values()]
      expect(layout.width).toBe(width)
      for (const box of positions) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + layout.nodeWidth).toBeLessThanOrEqual(width + 0.01)
        expect(box.y + box.height).toBeLessThanOrEqual(layout.height)
      }
      for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j]
        expect(a.x + layout.nodeWidth <= b.x || b.x + layout.nodeWidth <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true)
      }
      graph.edges.forEach((edge, index) => {
        const from = layout.positions.get(edge.from)!, to = layout.positions.get(edge.to)!
        const points = pathPoints(overviewEdge(from, to, layout, index))
        for (const point of points) {
          expect(point.x, `${graph.id}: ${edge.from} → ${edge.to}`).toBeGreaterThanOrEqual(0)
          expect(point.x).toBeLessThanOrEqual(width)
          expect(point.y).toBeGreaterThanOrEqual(0)
          expect(point.y).toBeLessThanOrEqual(layout.height)
          expect(positions.some(box => point.x > box.x && point.x < box.x + layout.nodeWidth && point.y > box.y && point.y < box.y + box.height), `${graph.id}: edge intersects card`).toBe(false)
        }
        const end = points.at(-1)!, previous = points.at(-2)!
        // The arrowhead points into the destination, including right-to-left rows.
        if (end.y < to.y) expect(end.y).toBeGreaterThan(previous.y)
        else if (end.x < to.x) expect(end.x).toBeGreaterThan(previous.x)
        else expect(end.x).toBeLessThan(previous.x)
      })
      expect(JSON.stringify(graph)).toBe(before)
    }
  })
})
