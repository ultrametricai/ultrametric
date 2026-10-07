import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildContentAudit } from './content-audit.mjs'

const metadata = { sourceRevision: 'a'.repeat(40), sourceDirty: false, generatedAt: '2026-10-02T12:00:00Z' }
function fixture() {
  const data = {
    'content/processes/records/start.json': { schemaVersion: 1, id: 'start', kind: 'process', title: 'Start', summary: 'Prepare a result', outcomes: ['A result'], parts: [{ kind: 'step', guidance: 'Prepare it', metadata: { documents: ['form'], produces: ['result'] }, references: [{ kind: 'vendor', id: 'tool', role: 'uses' }] }], metadata: { kind: 'situation' } },
    'processes/vendor-registry.json': { vendors: { tool: { arenaId: 'arena' } } },
    'data/categories.json': [{ id: 'arena', name: 'An arena' }],
    'data/arena-roadmap.json': [{ id: 'arena' }, { id: 'planned' }],
    'data/arena/products.json': [{ id: 'tool', name: 'Tool' }],
    'data/arena/stories.json': [{ id: 'story' }],
    'data/arena/verdicts.json': [{ productId: 'tool', storyId: 'story', verdict: 'none', evidenceIds: ['proof'] }],
    'data/arena/evidence/tool.json': [{ id: 'proof', tier: 'probe' }],
    'vendors/reviews/generated/arena--tool.json': { tested_on: '2026-10-01', recheck_due: '2027-01-01', status: 'tested', reviewer: 'Automated pipeline' },
    'open-documents/registry.json': { review_window_days: 120, documents: [{ id: 'form', name: 'Form', license_note: 'Review terms', publisher: 'Example', url: 'https://example.test/form', checked_on: '2026-10-01', jurisdiction: 'Worldwide', use_case: 'formation' }] },
    'sources/registry.json': { sources: [{ id: 'statute', title: 'Statute', url: 'https://example.test/law', locator: '§ 1', checked_on: '2026-10-01', jurisdiction: 'US-DE' }] },
    'resources/registry.json': { resources: [] },
    'jurisdictions/registry.json': { jurisdictions: [{ code: 'US-DE', name: 'Delaware', coverage: 'partial-example', scope: 'One example' }] },
    'rules/US-DE/rule.json': { id: 'rule', statement: 'A rule', source_ids: ['statute'], jurisdiction: 'US-DE', status: 'demonstration', reviewed_on: '2026-10-01', review_due: '2027-01-01' },
    'processes/artifacts.json': { artifacts: [{ id: 'result', label: 'Result', description: 'Prepared result', producedBy: 'start' }] },
    'processes/business-logic-map.json': { modules: { module: { label: 'Module', file: 'lib/openstartup/module.ts', processes: ['start'] } } },
    'catalog/coverage.json': { coverage_claim: 'One demonstration only.', uncovered: ['Other scenarios'], coverage: [] },
  }
  const files = new Map(Object.entries(data).map(([file, value]) => [file, JSON.stringify(value)]))
  files.set('lib/openstartup/module.ts', 'export const value = 1')
  files.set('lib/openstartup/__tests__/module.test.ts', 'test source')
  return files
}
function change(files, file, edit) { const value = JSON.parse(files.get(file)); edit(value); files.set(file, JSON.stringify(value)) }
const record = (report, key) => report.records.find(item => item.key === key)

test('separates declared situation markers, resolves cross-collection links, and counts negative verdicts', () => {
  const report = buildContentAudit(fixture(), metadata)
  const situation = record(report, 'situations:start')
  assert.equal(situation.checks.find(item => item.label === 'Situation classification').state, 'needs_review')
  assert.ok(situation.links.some(item => item.target === 'documents:form' && item.state === 'resolved'))
  assert.ok(situation.links.some(item => item.target === 'vendors:arena/tool' && item.state === 'resolved'))
  assert.ok(record(report, 'modules:module').links.some(item => item.target === 'situations:start' && item.state === 'resolved'))
  assert.equal(record(report, 'documents:form').inbound, 1)
  assert.deepEqual(report.metrics[0], { label: 'Vendor story verdicts', covered: 1, total: 1, meaning: 'Unique product/story cells in the current ranking taxonomies, including negative verdicts.' })
  assert.equal(record(report, 'documents:form').links[0].state, 'external')
  assert.equal(report.declaredCoverage.claim, 'One demonstration only.')
})

test('reports unresolved links and unavailable evidence without deleting records', () => {
  const files = fixture()
  change(files, 'content/processes/records/start.json', value => value.parts[0].metadata.documents = ['missing-form'])
  change(files, 'data/arena/verdicts.json', value => value[0].evidenceIds = ['missing-proof'])
  const report = buildContentAudit(files, metadata)
  assert.equal(record(report, 'situations:start').links.find(item => item.target === 'documents:missing-form').state, 'unresolved')
  assert.equal(record(report, 'vendors:arena/tool').checks.find(item => item.label === 'Verdict evidence').state, 'missing')
})

test('distinguishes registered untracked vendors from invalid registry keys', () => {
  const files = fixture()
  change(files, 'processes/vendor-registry.json', value => value.vendors.tool = {})
  assert.ok(record(buildContentAudit(files, metadata), 'situations:start').links.some(item => item.state === 'unmapped'))
  change(files, 'processes/vendor-registry.json', value => delete value.vendors.tool)
  assert.ok(record(buildContentAudit(files, metadata), 'situations:start').links.some(item => item.state === 'unresolved'))
})

test('reports missing module tests and invalid review dates without claiming execution', () => {
  const files = fixture()
  files.delete('lib/openstartup/__tests__/module.test.ts')
  change(files, 'open-documents/registry.json', value => value.documents[0].checked_on = '2026-99-99')
  const report = buildContentAudit(files, metadata)
  assert.equal(record(report, 'modules:module').checks[0].state, 'missing')
  assert.equal(record(report, 'documents:form').checkedOn, null)
})

test('fails on missing required inputs and duplicate identities', () => {
  const files = fixture()
  files.delete('data/arena/verdicts.json')
  assert.throws(() => buildContentAudit(files, metadata), /Missing required/)
  const duplicate = fixture()
  duplicate.set('content/processes/records/duplicate.json', duplicate.get('content/processes/records/start.json'))
  assert.throws(() => buildContentAudit(duplicate, metadata), /Duplicate shared/)
})

test('keeps vendor identities local to their arena and hashes inputs deterministically', () => {
  const files = fixture()
  change(files, 'data/categories.json', value => value.push({ id: 'second', name: 'Second' }))
  for (const name of ['products', 'stories', 'verdicts']) files.set(`data/second/${name}.json`, files.get(`data/arena/${name}.json`))
  files.set('data/second/evidence/tool.json', files.get('data/arena/evidence/tool.json'))
  const report = buildContentAudit(files, metadata)
  assert.equal(report.collections.find(item => item.id === 'vendors').records, 2)
  assert.equal(report.inputDigest, buildContentAudit(new Map([...files].reverse()), metadata).inputDigest)
  files.set('lib/openstartup/module.ts', 'export const value = 2')
  assert.notEqual(report.inputDigest, buildContentAudit(files, metadata).inputDigest)
})


test('does not treat uncited negative or inapplicable verdicts as invalid evidence', () => {
  const files = fixture()
  change(files, 'data/arena/verdicts.json', value => { value[0].verdict = 'none'; value[0].evidenceIds = [] })
  assert.equal(record(buildContentAudit(files, metadata), 'vendors:arena/tool').checks.find(item => item.label === 'Verdict evidence').state, 'present')
  change(files, 'data/arena/verdicts.json', value => { value[0].verdict = 'full' })
  assert.equal(record(buildContentAudit(files, metadata), 'vendors:arena/tool').checks.find(item => item.label === 'Verdict evidence').state, 'missing')
})


test('rejects a changed shared schema rather than misreading it as the old format', () => {
  const files = fixture()
  change(files, 'content/processes/records/start.json', value => value.schemaVersion = 2)
  assert.throws(() => buildContentAudit(files, metadata), /Unsupported shared schema/)
})


test('preserves process review dates and flags overdue or reversed schedules', () => {
  const files = fixture()
  change(files, 'content/processes/records/start.json', value => {
    value.metadata.reviewed_on = '2026-09-30'
    value.metadata.review_due = '2026-09-29'
  })
  const item = record(buildContentAudit(files, metadata), 'situations:start')
  assert.equal(item.checkedOn, '2026-09-30')
  assert.equal(item.reviewDue, '2026-09-29')
  assert.ok(item.checks.some(check => check.label === 'Review overdue' && check.state === 'needs_review'))
  assert.ok(item.checks.some(check => check.detail.includes('precedes')))
})

test('rejects missing or invalid document review windows', () => {
  for (const window of [undefined, 0, -1, '120']) {
    const files = fixture()
    change(files, 'open-documents/registry.json', value => value.review_window_days = window)
    assert.throws(() => buildContentAudit(files, metadata), /positive review_window_days/)
  }
})

test('preserves each narrow coverage claim and its limits', () => {
  const files = fixture()
  change(files, 'catalog/coverage.json', value => value.coverage.push({
    scenario: 'One event', process_id: 'start', entity_jurisdiction: 'US-DE', tax_jurisdiction: 'US-FED',
    status: 'example', reviewed_on: '2026-09-30', review_due: '2026-12-30', limits: ['One example only'],
  }))
  assert.deepEqual(buildContentAudit(files, metadata).declaredCoverage.scopes, [{
    scenario: 'One event', processKey: 'situations:start', entityJurisdiction: 'US-DE', taxJurisdiction: 'US-FED',
    status: 'example', reviewedOn: '2026-09-30', reviewDue: '2026-12-30', limits: ['One example only'],
  }])
})
