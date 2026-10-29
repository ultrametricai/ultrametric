import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import importedIdentities from './fixtures/imported-process-identities.json'
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
    const records = validateCatalog(JSON.parse(readFileSync('scripts/shared-processes/examples/staging.json', 'utf8')))
    expect(records).toHaveLength(2)
    expect(records.every(record => record.metadata.synthetic === true && record.guidance && record.outcomes.length)).toBe(true)
    expect(collectDecisions(records, 'shared-schema-staging-check')).toHaveLength(1)
    expect(loadSharedProcesses().some(record => record.id.startsWith('shared-schema-staging'))).toBe(false)
  })
  it('validates the authored catalog and accounts for the imported inventory', () => {
    const all = loadSharedProcesses()
    expect(all.map(record => record.id)).toEqual(expect.arrayContaining(importedIdentities.ids))
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
  it.each([
    ['empty', []],
    ['duplicate', ['method', 'method']],
    ['unknown', ['missing']],
    ['incoming connection', ['self']],
  ])('rejects %s explicit entries', (_, entrySteps) => {
    const records = fixture()
    records[0].entrySteps = entrySteps
    expect(() => validateCatalog(records)).toThrow()
  })
  it('rejects steps unreachable from explicit entries', () => {
    const records = fixture()
    records[0].entrySteps = ['method']
    records[0].parts.push(part('unreachable'))
    expect(() => validateCatalog(records)).toThrow('unreachable')
  })
  it('accepts valid explicit entries and keeps unpinned legacy records valid', () => {
    const records = fixture()
    expect(validateCatalog(records)[0].entrySteps).toBeUndefined()
    records[0].entrySteps = ['method']
    expect(validateCatalog(records)[0].entrySteps).toEqual(['method'])
  })
  it('accepts multiple entries that cover disconnected top-level branches', () => {
    const records = fixture()
    records[0].parts.push(part('other-root'))
    records[0].entrySteps = ['method', 'other-root']
    expect(validateCatalog(records)[0].entrySteps).toEqual(['method', 'other-root'])
  })
  it('rejects nested option parts as top-level entries', () => {
    const records = fixture()
    records[0].parts[0].options[0].parts = [part('nested')]
    records[0].entrySteps = ['method', 'nested']
    expect(() => validateCatalog(records)).toThrow('invalid entry step')
  })
})

describe('country entry points', () => {
  function countrySources(record: SharedRecord) {
    const countries = new Set((record.metadata.geoNotes as Array<{ country: string }> | undefined)?.map(note => note.country))
    function visit(parts: Part[]) {
      for (const part of parts) {
        for (const row of (part.metadata.geoResolutions ?? []) as Array<{ country: string }>) countries.add(row.country)
        for (const option of part.options) visit(option.parts)
      }
    }
    visit(record.parts)
    return countries
  }
  it('covers every global operational process with authored country guidance and preserves stable IDs', async () => {
    const { processCountryEntries } = await import('../shared-processes/country-views')
    const records = loadSharedProcesses()
    const pilots = records.filter(record => record.countryViews?.length)
    const eligible = records.filter(record => record.metadata.phase && record.metadata.geoScope === 'global' && countrySources(record).size)
    expect(pilots.map(record => record.id).sort()).toEqual(eligible.map(record => record.id).sort())
    const slugs = new Set<string>()
    for (const record of pilots) {
      const views = processCountryEntries(record, record.id)
      expect(views[0].country).toBe('GLOBAL')
      expect(views.find(view => view.country === 'US')).toBeDefined()
      for (const view of views) {
        expect(slugs.has(view.slug), view.slug).toBe(false)
        slugs.add(view.slug)
        expect(view.title.trim().length).toBeGreaterThan(3)
        if (view.country !== 'US' && view.country !== 'GLOBAL') {
          expect(countrySources(record).has(view.country), `${record.id}/${view.country}`).toBe(true)
        }
      }
    }
    for (const id of ['sit_002', 'tax_001', 'fund_003', 'form_011', 'tax_003']) {
      expect(records.find(record => record.id === id)?.countryViews).toBeUndefined()
    }
    const ein = pilots.find(record => record.id === 'form_002')!
    expect(ein.countryViews?.find(view => view.country === 'US')).toEqual({ country: 'US', title: 'Get an EIN', slug: 'get-ein' })
    expect(ein.globalSlug).toBe('obtain-the-company-tax-identifiers')
  })

  it('keeps country-specific completion checks and fees out of shared metadata', () => {
    for (const record of loadSharedProcesses().filter(record => record.countryViews?.length)) {
      for (const part of record.parts.filter(part => !part.metadata.jurisdictions)) {
        const verification = part.metadata.verify as { how: string; url?: string } | undefined
        if (verification) expect(JSON.stringify(verification), `${record.id}/${part.id}`).not.toMatch(/IRS|XX-XXXXXXX|CP 575|Delaware|USPS/)
        expect(part.metadata.cost, `${record.id}/${part.id} fee stays in the US resolution`).toBeUndefined()
      }
    }
  })
})
