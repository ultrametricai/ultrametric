// lib/dagLayers.ts — the Kahn layering behind the full vertical diagram
// (components/ProcessDag.tsx) and the shared-process graph.
import { describe, expect, it } from 'vitest'
import { layerNodes, type DagEdge } from '@/lib/dagLayers'

const n = (id: string) => ({ id })
const ids = (layers: Array<Array<{ id: string }>>) => layers.map((l) => l.map((x) => x.id))

describe('layerNodes', () => {
  it('no edges → no invented dependency', () => {
    expect(ids(layerNodes([n('a'), n('b'), n('c')]))).toEqual([['a', 'b', 'c']])
    expect(ids(layerNodes([n('a'), n('b')], []))).toEqual([['a', 'b']])
  })

  it('a diamond layers its parallel middle: [[a], [b, c], [d]]', () => {
    const edges: DagEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ]
    expect(ids(layerNodes([n('a'), n('b'), n('c'), n('d')], edges))).toEqual([['a'], ['b', 'c'], ['d']])
  })

  it('within a layer, nodes keep declaration order regardless of frontier order', () => {
    const edges: DagEdge[] = [
      { from: 'a', to: 'z' },
      { from: 'a', to: 'b' },
      { from: 'z', to: 'd' },
      { from: 'b', to: 'd' },
    ]
    // b is declared before z, so the parallel layer reads [b, z].
    expect(ids(layerNodes([n('a'), n('b'), n('z'), n('d')], edges))).toEqual([['a'], ['b', 'z'], ['d']])
  })

  it('edges naming unknown nodes are ignored', () => {
    const edges: DagEdge[] = [
      { from: 'a', to: 'ghost' },
      { from: 'ghost', to: 'b' },
      { from: 'a', to: 'b' },
    ]
    expect(ids(layerNodes([n('a'), n('b')], edges))).toEqual([['a'], ['b']])
  })

  it('nodes a cycle would strand are appended as their own layers — nothing is ever dropped', () => {
    const edges: DagEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'b' },
    ]
    const layers = layerNodes([n('a'), n('b'), n('c')], edges)
    expect(layers.flat().map((x) => x.id).sort()).toEqual(['a', 'b', 'c'])
    expect(ids(layers)[0]).toEqual(['a'])
    // The cycle members come back as single-node layers after the reachable prefix.
    expect(ids(layers).slice(1)).toEqual([['b'], ['c']])
  })

  it('total node count is preserved through layering', () => {
    const nodes = [n('a'), n('b'), n('c'), n('d'), n('e')]
    const edges: DagEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'c', to: 'e' },
    ]
    expect(layerNodes(nodes, edges).flat()).toHaveLength(nodes.length)
  })
})
