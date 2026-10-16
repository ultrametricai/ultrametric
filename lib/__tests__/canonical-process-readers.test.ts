import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findProcessBySlug, jurisdictionNodes, jurisdictionStepViews, loadChains, loadProcesses,
  ProcessChainSchema, ProcessTaskSchema, processSlug,
} from '../processes'

const root = path.resolve(__dirname, '../..')
const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true })))

describe('canonical operational readers', () => {
  it('preserves every projected task, conditional node and ordered chain', () => {
    const raw = ProcessTaskSchema.array().parse(JSON.parse(readFileSync(path.join(root, 'open-processes/corpus.json'), 'utf8')))
    const expected = raw.map(task => {
      const conditional = task.dag.nodes.filter(node => node.jurisdictions?.length)
      expect(jurisdictionNodes(task.id)).toEqual(conditional)
      if (!conditional.length) return task
      const nodes = task.dag.nodes.filter(node => !conditional.includes(node))
      const ids = new Set(nodes.map(node => node.id))
      return { ...task, dag: { nodes, edges: task.dag.edges?.filter(edge => ids.has(edge.from) && ids.has(edge.to)) } }
    })
    expect(loadProcesses()).toEqual(expected)
    expect(loadChains()).toEqual(ProcessChainSchema.array().parse(JSON.parse(readFileSync(path.join(root, 'open-processes/chains.json'), 'utf8'))))
  })

  it('loads the same views and aliases from canonical files without compatibility files', () => {
    const fixture = mkdtempSync(path.join(os.tmpdir(), 'canonical-readers-'))
    temporary.push(fixture)
    const directory = path.join(fixture, 'open-processes')
    const data = path.join(fixture, 'open-rankings')
    mkdirSync(directory)
    const catalog = JSON.parse(readFileSync(path.join(root, 'open-processes/catalog.json'), 'utf8')) as { processes: string[] }
    for (const name of ['catalog', ...catalog.processes]) {
      cpSync(path.join(root, 'open-processes', `${name}.json`), path.join(directory, `${name}.json`))
    }
    expect(existsSync(path.join(directory, 'corpus.json'))).toBe(false)
    expect(existsSync(path.join(directory, 'chains.json'))).toBe(false)
    expect(existsSync(path.join(fixture, 'content/processes'))).toBe(false)
    const tasks = loadProcesses(data)
    expect(tasks).toEqual(loadProcesses())
    expect(loadChains(data)).toEqual(loadChains())
    expect(loadProcesses(data)).toBe(tasks)
    expect(loadChains(data)).toBe(loadChains(data))
    for (const task of tasks) {
      expect(jurisdictionNodes(task.id, data)).toEqual(jurisdictionNodes(task.id))
      expect(jurisdictionStepViews(task.id, data)).toEqual(jurisdictionStepViews(task.id))
      for (const slug of [processSlug(task.title), ...(task.slugAliases ?? []).map(alias => alias.slug)]) {
        expect(findProcessBySlug(slug, data)).toBe(task)
      }
    }
  })
})
