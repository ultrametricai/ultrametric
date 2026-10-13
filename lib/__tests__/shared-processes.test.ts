import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadSharedProcesses } from '../shared-processes/load'
import { collectDecisions, validateCatalog, type SharedRecord, type Part } from '../shared-processes/schema'

function part(id: string, overrides: Partial<Part> = {}): Part {
  return { id, kind: 'step', title: id, guidance: null, when: null, ref: null, options: [], references: [], notes: [], metadata: {}, ...overrides }
}
function record(id: string, overrides: Partial<SharedRecord> = {}): SharedRecord {
  return { schemaVersion: 1, id, kind: 'process', title: id, summary: '', outcomes: [], guidance: null, parts: [], links: [], references: [], notes: [], metadata: {}, ...overrides }
}
function fixture() {
  const choice = part('method', { kind: 'decision', options: ['self', 'contractor'].map(id => ({ id, title: id, summary: '', when: null, parts: [], references: [], notes: [], metadata: {} })) })
  return [record('build', { parts: [choice, part('self'), part('hire', { kind: 'reference', ref: 'contracting' }), part('review')], links: [
    { from: 'method', option: 'self', to: 'self' }, { from: 'method', option: 'contractor', to: 'hire' },
    { from: 'self', to: 'review' }, { from: 'hire', to: 'review' },
  ] }), record('contracting')]
}

describe('shared process definitions', () => {
  it('validates the staging example separately from the real catalog', () => {
    const records = validateCatalog(JSON.parse(readFileSync('content/processes/examples/staging.json', 'utf8')))
    expect(records).toHaveLength(2)
    expect(records.every(record => record.metadata.synthetic === true && record.guidance && record.outcomes.length)).toBe(true)
    expect(collectDecisions(records, 'shared-schema-staging-check')).toHaveLength(1)
    expect(loadSharedProcesses().some(record => record.id.startsWith('shared-schema-staging'))).toBe(false)
  })
  it('validates the authored catalog and accounts for the imported inventory', () => {
    const all = loadSharedProcesses()
    const imported = JSON.parse(readFileSync('content/processes/import-manifest.json', 'utf8'))
    expect(all.map(record => record.id)).toEqual(expect.arrayContaining(Object.keys(imported.records)))
  })
  it('supports option branches, shared joins, nesting, and new records without import history', () => {
    const records = validateCatalog(fixture())
    expect(collectDecisions(records, 'build').map(d => [d.recordId, d.part.id])).toEqual([['build', 'method']])
    expect(records[0].links[2].option).toBeUndefined()
  })
  it.each([
    ['blank identity', (r: SharedRecord[]) => { r[0].id = ' ' }],
    ['missing target', (r: SharedRecord[]) => { r[0].links[0].to = 'missing' }],
    ['wrong option', (r: SharedRecord[]) => { r[0].links[0].option = 'missing' }],
    ['option on an ordinary step', (r: SharedRecord[]) => { r[0].links[2].option = 'self' }],
    ['duplicate option', (r: SharedRecord[]) => { r[0].parts[0].options.push(r[0].parts[0].options[0]) }],
    ['duplicate part', (r: SharedRecord[]) => { r[0].parts.push(r[0].parts[1]) }],
    ['empty decision', (r: SharedRecord[]) => { r[0].parts[0].options = [] }],
    ['null reference', (r: SharedRecord[]) => { r[0].parts[2].ref = null }],
    ['graph cycle', (r: SharedRecord[]) => { r[0].links.push({ from: 'review', to: 'method' }) }],
    ['nesting cycle', (r: SharedRecord[]) => { r[1].parts = [part('back', { kind: 'reference', ref: 'build' })] }],
    ['invalid URL', (r: SharedRecord[]) => { r[0].references = [{ kind: 'url', url: 'javascript:alert(1)', title: 'Bad', description: null, role: 'source' }] }],
    ['legacy tool label in metadata', (r: SharedRecord[]) => { r[0].metadata.toolCall = 'invented-operation' }],
    ['legacy operations nested inside option metadata', (r: SharedRecord[]) => { r[0].parts[0].options[0].metadata.legacy = [{ functionCalls: [{ method: 'invented-operation' }] }] }],
  ])('rejects %s', (_, mutate) => {
    const records = fixture()
    mutate(records)
    expect(() => validateCatalog(records)).toThrow()
  })
  it('keeps notes open and source unknowns explicit', () => {
    const records = fixture()
    records[0].notes = [{ text: 'A contextual recommendation.', references: [{ kind: 'url', url: 'https://example.com/docs', title: null, description: null, role: 'source' }] }]
    records[0].guidance = 'Authored guidance.'
    records[0].outcomes = ['An authored outcome.']
    expect(validateCatalog(records)[0].notes[0].text).toBe('A contextual recommendation.')
  })
})
