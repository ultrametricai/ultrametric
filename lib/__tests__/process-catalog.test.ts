import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadProcessCatalog, validateFlow } from '../shared-processes/catalog'

const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true })))
describe('process authoring catalog', () => {
  it('preserves every authored logo value through catalog loading', () => {
    const { processes } = loadProcessCatalog({ processes: ['generate-a-brand-logo'] })
    expect(processes).toHaveLength(1)
    expect(processes[0].slug).toBe('generate-a-brand-logo')
    expect(processes[0].record).toEqual(JSON.parse(readFileSync('content/processes/records/brand_002.json', 'utf8')))
  })
  it('requires explicit entries and connections without inferred order', () => {
    expect(() => validateFlow(['a', 'b'], [], ['a'])).toThrow('reachable')
    expect(() => validateFlow(['a', 'b'], [{ from: 'a', to: 'b' }], ['a'])).not.toThrow()
    expect(() => validateFlow(['a', 'b'], [], ['a', 'b'])).not.toThrow()
    expect(() => validateFlow(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], ['a'])).toThrow()
  })
  it('selects process files explicitly and rejects registries and unsafe paths', () => {
    expect(() => loadProcessCatalog({ processes: ['business-logic-map'] })).toThrow()
    expect(() => loadProcessCatalog({ processes: ['chains'] })).toThrow()
    expect(() => loadProcessCatalog({ processes: ['../secret'] })).toThrow()
    expect(() => loadProcessCatalog({ processes: ['v1'] })).toThrow()
    const root = mkdtempSync(path.join(os.tmpdir(), 'process-catalog-'))
    temporary.push(root)
    mkdirSync(path.join(root, 'processes'))
    const definition = JSON.parse(readFileSync('processes/generate-a-brand-logo.json', 'utf8'))
    writeFileSync(path.join(root, 'processes/example.json'), JSON.stringify({ ...definition, links: [] }))
    expect(() => loadProcessCatalog({ processes: ['example'] }, root)).toThrow('reachable')
  })
})
