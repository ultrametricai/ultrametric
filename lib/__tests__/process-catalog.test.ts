import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadProcessCatalog, validateFlow, validateJourneys } from '../shared-processes/catalog'

const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true })))
describe('process authoring catalog', () => {
  it('preserves every authored logo value through step-file assembly', () => {
    const { processes, journeys } = loadProcessCatalog()
    expect(processes).toHaveLength(1)
    expect(processes[0].slug).toBe('generate-a-brand-logo')
    expect(processes[0].record).toEqual(JSON.parse(readFileSync('content/processes/records/brand_002.json', 'utf8')))
    expect(journeys).toEqual([])
  })
  it('composes a journey by process ID and rejects missing targets', () => {
    const records = loadProcessCatalog().processes.map(process => process.record)
    const journey = { schemaVersion: 1, id: 'company-branding', title: 'Company branding', summary: '',
      entrySteps: ['logo'], parts: [{ id: 'logo', process: 'brand_002', when: null }], links: [] }
    expect(validateJourneys([journey], records)[0].parts[0].process).toBe('brand_002')
    expect(() => validateJourneys([{ ...journey, parts: [{ id: 'logo', process: 'missing', when: null }] }], records)).toThrow('Unknown journey process')
  })
  it('requires explicit entries and connections without inferred order', () => {
    expect(() => validateFlow(['a', 'b'], [], ['a'])).toThrow('reachable')
    expect(() => validateFlow(['a', 'b'], [{ from: 'a', to: 'b' }], ['a'])).not.toThrow()
    expect(() => validateFlow(['a', 'b'], [], ['a', 'b'])).not.toThrow()
    expect(() => validateFlow(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], ['a'])).toThrow()
  })
  it('rejects path traversal and unlisted step files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'process-catalog-'))
    temporary.push(root)
    cpSync('processes/generate-a-brand-logo', path.join(root, 'processes/generate-a-brand-logo'), { recursive: true })
    const file = path.join(root, 'processes/generate-a-brand-logo/process.json')
    const definition = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...definition, steps: ['../secret.json'] }))
    expect(() => loadProcessCatalog(root)).toThrow()
    writeFileSync(file, JSON.stringify({ ...definition, steps: definition.steps.slice(1) }))
    expect(() => loadProcessCatalog(root)).toThrow('Unlisted or missing step file')
  })
})
