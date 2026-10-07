// Founder round 2026-10-07 — the sim's corpus linkage against the LIVE corpus and registry
// (lib/virtualStartupData.ts vsTaskLinkage, serialized by app/startup-sim/page.tsx):
//   item 2 — the node ids behind the terminal's step deep links are exactly the task's committed
//            dag node ids in order, so every /processes/{slug}#step-{taskId}-{nodeId} the sim
//            renders is an anchor the pinned contract already resolves
//            (lib/__tests__/process-anchor-contract.test.ts covers every corpus node);
//   item 3 — the produces entries mirror the corpus producesArtifact tags exactly (same steps,
//            same ids, nothing invented) and every id resolves in processes/artifacts.json with
//            its committed label;
//   item 6 — the fork summary names a real divergence: the forking step's label and its direct
//            successors' labels from the committed dag.edges, with fin_002 (the get-paid spine's
//            close — in EVERY journey) pinned as a corpus case that actually forks, and a
//            linear-DAG task pinned to carry none.
import { describe, expect, it } from 'vitest'
import { loadChains, loadProcesses } from '../processes'
import { unionTaskIds, VS_CHAIN_IDS } from '../virtualStartup'
import { vsArtifactLabels, vsTaskLinkage } from '../virtualStartupData'

const chains = VS_CHAIN_IDS.map((id) => {
  const chain = loadChains().find((c) => c.id === id)!
  return { id: chain.id, name: chain.name, taskIds: chain.taskIds }
})
const byId = new Map(loadProcesses().map((t) => [t.id, t]))
const unionTasks = unionTaskIds(chains).map((id) => byId.get(id)!)
const labels = vsArtifactLabels()

describe('vsTaskLinkage against the live corpus (every task any decision combo can reach)', () => {
  it('node ids are the committed dag node ids in step order — every sim step anchor resolves under the pinned anchor contract', () => {
    for (const task of unionTasks) {
      expect(task, 'union task missing from the corpus').toBeDefined()
      const { nodeIds } = vsTaskLinkage(task, labels)
      expect(nodeIds, task.id).toEqual(task.dag.nodes.map((n) => n.id))
      // Same length as the flattened steps — the parallel-array contract the terminal links by.
      expect(nodeIds.length, task.id).toBe(task.dag.nodes.length)
    }
  })

  it('produces mirrors the corpus producesArtifact tags exactly, every id resolving in the registry with its committed label', () => {
    let tagged = 0
    for (const task of unionTasks) {
      const { produces } = vsTaskLinkage(task, labels)
      expect(produces.length, task.id).toBe(task.dag.nodes.length)
      task.dag.nodes.forEach((node, i) => {
        if (node.producesArtifact) {
          tagged++
          expect(produces[i], `${task.id}/${node.id}`).toEqual({
            id: node.producesArtifact,
            label: labels.get(node.producesArtifact),
          })
          expect(labels.has(node.producesArtifact), `${task.id}/${node.id} → ${node.producesArtifact}`).toBe(true)
        } else {
          expect(produces[i], `${task.id}/${node.id}`).toBeNull()
        }
      })
    }
    // The journey union genuinely carries producesArtifact steps — the document panel has data.
    expect(tagged).toBeGreaterThan(0)
  })

  it('an unknown producesArtifact id fails loudly instead of inventing a document', () => {
    const task = unionTasks.find((t) => t.dag.nodes.some((n) => n.producesArtifact))!
    expect(() => vsTaskLinkage(task, new Map())).toThrow(/unknown artifact/)
  })

  it('fork names a real committed divergence — fin_002 (in every journey) forks; a linear DAG carries none', () => {
    const fin = byId.get('fin_002')!
    const { fork } = vsTaskLinkage(fin, labels)
    expect(fork).toBeDefined()
    // The summary is the committed structure verbatim: the forking node's label and its direct
    // successors' labels, straight from dag.edges.
    const edges = fin.dag.edges ?? []
    const forkNode = fin.dag.nodes.find((n) => edges.filter((e) => e.from === n.id).length > 1)!
    expect(fork!.at).toBe(forkNode.label)
    expect(fork!.branches).toEqual(
      edges.filter((e) => e.from === forkNode.id).map((e) => fin.dag.nodes.find((n) => n.id === e.to)!.label),
    )
    expect(fork!.branches.length).toBeGreaterThan(1)
    // A task whose committed edges never diverge gets no fork treatment — only where the DAG forks.
    const linear = unionTasks.find((t) => {
      const es = t.dag.edges ?? []
      return t.dag.nodes.every((n) => es.filter((e) => e.from === n.id).length <= 1)
    })!
    expect(vsTaskLinkage(linear, labels).fork).toBeUndefined()
  })
})
