import { describe, expect, it } from 'vitest'
import { loadSharedProcesses } from '../shared-processes/load'
import { processGraphs } from '../shared-processes/graph'
import { overviewLayout } from '../shared-processes/overview-layout'
const records = loadSharedProcesses()

describe('compact overview layout', () => {
  it('snakes a real sequential path without connecting unlinked actions', () => {
    const graph = processGraphs(records.find(record => record.id === 'form_001')!, records)[0]
    const desktop = overviewLayout(graph, 1240, {})
    expect(desktop.chain).toBe(true)
    const sequence = graph.layers.flat()
    const first = desktop.positions.get(sequence[0].id)!
    const second = desktop.positions.get(sequence[1].id)!
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBe(first.y)
    const nextRow = sequence.filter(node => desktop.positions.get(node.id)!.row === 1)
    expect(desktop.positions.get(nextRow[1].id)!.x).toBeLessThan(desktop.positions.get(nextRow[0].id)!.x)
    for (const node of graph.unlinked) expect(desktop.positions.has(node.id)).toBe(false)
    const mobile = overviewLayout(graph, 350, {})
    expect(new Set([...mobile.positions.values()].map(position => position.x)).size).toBe(1)
  })
  it('never snakes a graph with parallel branches or invents edges for an unordered list', () => {
    const branch = processGraphs(records.find(record => record.id === 'fin_002')!, records)[0]
    const layout = overviewLayout(branch, 984, {})
    expect(layout.chain).toBe(false)
    for (const layer of branch.layers) expect(new Set(layer.map(node => layout.positions.get(node.id)!.y)).size).toBe(1)
    const unordered = processGraphs(records.find(record => record.id === 'get-paid')!, records)[0]
    expect(unordered.edges).toHaveLength(0)
    expect(overviewLayout(unordered, 1240, {}).chain).toBe(false)
  })
  it('keeps measured cards inside the canvas and non-overlapping across the catalog and viewports', () => {
    for (const record of records) for (const graph of processGraphs(record, records)) for (const width of [350, 984, 1240]) {
      const heights = Object.fromEntries(graph.nodes.map((node, index) => [node.scope, index % 2 ? 80 : 54]))
      const layout = overviewLayout(graph, width, heights)
      const positions = [...layout.positions.values()]
      for (const box of positions) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + layout.nodeWidth).toBeLessThanOrEqual(layout.width + 0.01)
        expect(box.y + box.height).toBeLessThanOrEqual(layout.height)
      }
      for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j]
        expect(a.x + layout.nodeWidth <= b.x || b.x + layout.nodeWidth <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true)
      }
    }
  })
})
