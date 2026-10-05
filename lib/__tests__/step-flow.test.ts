import { describe, expect, it } from 'vitest'
import { loadSharedProcesses } from '../shared-processes/load'
import { processGraphs, type GraphScope } from '../shared-processes/graph'
import { stepFlowNeedsGutter, stepFlowPaths } from '../shared-processes/step-flow'

const records = loadSharedProcesses()
function boxes(graph: GraphScope) {
  return graph.nodes.map((node, index) => ({ id: node.scope, left: 24, top: index * 224, width: 240, height: 200 }))
}

describe('detailed step dependency connectors', () => {
  it('draws exactly the recorded edges in every scope, including branches and joins', () => {
    for (const record of records) for (const graph of processGraphs(record, records)) {
      const paths = stepFlowPaths(graph, boxes(graph))
      expect(paths.map(edge => [edge.from, edge.to])).toEqual(graph.edges.map(edge => [edge.from, edge.to]))
      expect(paths.every(edge => edge.fromScope.startsWith(`${graph.id}:`) && edge.toScope.startsWith(`${graph.id}:`))).toBe(true)
    }
    const branch = processGraphs(records.find(record => record.id === 'fin_002')!, records)[0]
    expect(stepFlowNeedsGutter(branch)).toBe(true)
    const paths = stepFlowPaths(branch, boxes(branch))
    const bypasses = paths.filter(edge => edge.path.includes(' H '))
    expect(bypasses.length).toBeGreaterThan(0)
    expect(bypasses.every(edge => !edge.path.includes('NaN'))).toBe(true)
  })

  it('does not connect adjacent unordered cards or invent a bridge over hidden cards', () => {
    const graph = processGraphs(records.find(record => record.id === 'form_001')!, records)[0]
    expect(stepFlowPaths({ ...graph, edges: [] }, boxes(graph))).toEqual([])
    const hidden = graph.edges[0].to
    const paths = stepFlowPaths(graph, boxes(graph).filter(box => box.id !== `${graph.id}:${hidden}`))
    expect(paths.map(edge => [edge.from, edge.to])).toEqual(graph.edges.filter(edge => edge.from !== hidden && edge.to !== hidden).map(edge => [edge.from, edge.to]))
    for (const node of graph.unlinked) expect(paths.some(edge => edge.from === node.id || edge.to === node.id)).toBe(false)
  })

  it('uses the selected regional graph and keeps nested subprocesses and options separate', () => {
    const record = records.find(record => record.id === 'form_001')!
    const graphs = processGraphs(record, records, 'germany-notary-gmbh')
    expect(graphs.some(graph => graph.id.includes('uk-companies-house'))).toBe(false)
    for (const graph of graphs) {
      const paths = stepFlowPaths(graph, boxes(graph))
      expect(paths.every(edge => graph.nodes.some(node => node.scope === edge.fromScope) && graph.nodes.some(node => node.scope === edge.toScope))).toBe(true)
    }
    const mailbox = processGraphs(records.find(record => record.id === 'qs_044')!, records)[0]
    expect(stepFlowNeedsGutter(mailbox)).toBe(false)
    expect(stepFlowPaths(mailbox, boxes(mailbox)).every(edge => edge.path.includes(' L '))).toBe(true)
  })
})
