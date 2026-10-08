import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const collectionNames = {
  processes: 'Processes', situations: 'Situations', vendors: 'Vendor entries', arenas: 'Rankings',
  documents: 'Open documents', modules: 'Module source files', jurisdictions: 'Jurisdictions',
  rules: 'Rules', sources: 'Sources', resources: 'Resources', artifacts: 'Business artifacts',
}

const roots = ['content/processes/records', 'data', 'open-documents', 'lib/openstartup', 'processes', 'jurisdictions', 'rules', 'sources', 'resources', 'vendors/reviews/generated', 'coverage']
const recordKey = (collection, id) => `${collection}:${id}`
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

export function buildContentAudit(files, metadata) {
  const inputs = new Map()
  const read = file => {
    if (!files.has(file)) throw new Error(`Missing required audit input: ${file}`)
    const value = files.get(file)
    inputs.set(file, createHash('sha256').update(value).digest('hex'))
    return value
  }
  const json = file => JSON.parse(read(file))
  const array = (value, label) => {
    if (!Array.isArray(value)) throw new Error(`Expected an array: ${label}`)
    return value
  }
  const records = []
  const add = (collection, id, name, file, tags = []) => {
    if (!nonempty(id) || !nonempty(name)) throw new Error(`Missing identity: ${file}`)
    const record = { key: recordKey(collection, id), collection, id, name, path: file,
      tags: tags.filter(nonempty), checks: [], links: [], inbound: 0, checkedOn: null, reviewDue: null }
    records.push(record)
    return record
  }
  const check = (record, label, state, detail) => record.checks.push({ label, state, detail })
  const presence = (record, label, value, detail = '') => check(record, label, value ? 'present' : 'missing', detail)
  const link = (record, target, relation, state = 'pending') => {
    if (!record.links.some(item => item.target === target && item.relation === relation))
      record.links.push({ target, relation, state })
  }
  const date = (record, value, due) => {
    record.checkedOn = isoDate(value) ? value : null
    record.reviewDue = isoDate(due) ? due : null
    check(record, 'Recorded review date', record.checkedOn ? 'present' : 'unknown', record.checkedOn ?? 'No dated review recorded.')
    if (due && !record.reviewDue) check(record, 'Review due date', 'needs_review', 'The recorded date is invalid.')
    if (record.checkedOn && record.checkedOn > metadata.generatedAt.slice(0, 10)) check(record, 'Recorded review date', 'needs_review', 'The review date is in the future.')
    if (record.reviewDue && record.checkedOn && record.reviewDue < record.checkedOn) check(record, 'Review due date', 'needs_review', 'The due date precedes the recorded review.')
    if (record.reviewDue && record.reviewDue < metadata.generatedAt.slice(0, 10)) check(record, 'Review overdue', 'needs_review', `The recorded review was due ${record.reviewDue}.`)
  }
  const walk = (value, visit) => {
    if (Array.isArray(value)) value.forEach(item => walk(item, visit))
    else if (value && typeof value === 'object') {
      visit(value)
      Object.values(value).forEach(item => walk(item, visit))
    }
  }
  const shared = [...files.keys()].filter(file => /^content\/processes\/records\/[^/]+\.json$/.test(file)).sort()
  if (!shared.length) throw new Error('The shared process catalog is missing.')
  const processKeys = new Map()
  const processRows = shared.map(file => {
    const value = json(file)
    if (value.schemaVersion !== 1) throw new Error(`Unsupported shared schema version: ${file}`)
    if (!['process', 'situation'].includes(value.kind)) throw new Error(`Unknown shared record kind: ${file}`)
    const situation = value.kind === 'situation' || value.metadata?.kind === 'situation'
    const record = add(situation ? 'situations' : 'processes', value.id, value.title, file, [value.metadata?.phase, value.metadata?.supportLevel])
    if (processKeys.has(value.id)) throw new Error(`Duplicate shared process identity: ${value.id}`)
    processKeys.set(value.id, record.key)
    for (const alias of value.aliases ?? []) {
      if (processKeys.has(alias)) throw new Error(`Duplicate process alias: ${alias}`)
      processKeys.set(alias, record.key)
    }
    if (situation && value.kind !== 'situation') check(record, 'Situation classification', 'needs_review', 'Legacy metadata declares a situation; the shared kind is process.')
    date(record, value.metadata?.reviewed_on, value.metadata?.review_due)
    presence(record, 'Summary', nonempty(value.summary))
    presence(record, 'Outcomes', Array.isArray(value.outcomes) && value.outcomes.length > 0)
    return { record, value }
  })
  const processTarget = id => processKeys.get(id) ?? recordKey('processes', id)
  const registry = json('processes/vendor-registry.json').vendors
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new Error('Invalid vendor registry.')
  const vendorTarget = id => {
    const entry = registry[id]
    if (!entry) return { target: `vendor-registry:${id}`, state: 'unresolved' }
    if (!entry.arenaId) return { target: `vendor-registry:${id}`, state: 'unmapped' }
    return { target: recordKey('vendors', `${entry.arenaId}/${entry.productId ?? id.replaceAll('_', '-')}`), state: 'pending' }
  }
  const categories = array(json('data/categories.json'), 'categories')
  const metrics = []
  let expectedCells = 0
  let presentCells = 0
  for (const category of categories) {
    if (!nonempty(category.id)) throw new Error('A category ID is missing.')
    const base = `data/${category.id}`
    const products = array(json(`${base}/products.json`), `${base}/products`)
    const stories = array(json(`${base}/stories.json`), `${base}/stories`)
    const verdicts = array(json(`${base}/verdicts.json`), `${base}/verdicts`)
    const arena = add('arenas', category.id, category.name, 'data/categories.json')
    if (stories.some(story => !nonempty(story.id)) || products.some(product => !nonempty(product.id))) throw new Error(`Missing product or story identity: ${base}`)
    const storyIds = new Set(stories.map(story => story.id))
    const productIds = new Set(products.map(product => product.id))
    presence(arena, 'Products', products.length > 0, `${products.length} product entries.`)
    presence(arena, 'Story taxonomy', stories.length > 0, `${stories.length} stories.`)
    if (storyIds.size !== stories.length) check(arena, 'Story identities', 'needs_review', 'Duplicate story IDs.')
    const unknown = verdicts.filter(item => !storyIds.has(item.storyId) || !productIds.has(item.productId))
    if (unknown.length) check(arena, 'Verdict targets', 'needs_review', `${unknown.length} verdicts reference an unknown product or story.`)
    for (const product of products) {
      const vendor = add('vendors', `${category.id}/${product.id}`, product.name, `${base}/products.json`, [category.id])
      link(vendor, arena.key, 'judged in')
      const evidenceFile = `${base}/evidence/${product.id}.json`
      const evidence = files.has(evidenceFile) ? array(json(evidenceFile), evidenceFile) : []
      const evidenceIds = new Set(evidence.map(item => item.id))
      if (evidenceIds.size !== evidence.length) check(vendor, 'Evidence identities', 'needs_review', 'Duplicate evidence IDs.')
      const cells = verdicts.filter(item => item.productId === product.id)
      const covered = new Set(cells.filter(item => storyIds.has(item.storyId)).map(item => item.storyId))
      expectedCells += stories.length
      presentCells += covered.size
      check(vendor, 'Story verdict coverage', covered.size === stories.length && stories.length > 0 ? 'present' : 'missing', `${covered.size} / ${stories.length} expected story verdicts. Negative verdicts count as coverage.`)
      if (new Set(cells.map(item => item.storyId)).size !== cells.length) check(vendor, 'Verdict identities', 'needs_review', 'Duplicate product/story verdicts.')
      const dangling = cells.flatMap(item => item.evidenceIds ?? []).filter(id => !evidenceIds.has(id)).length
      const uncited = cells.filter(item => !['none', 'na'].includes(item.verdict) && (!Array.isArray(item.evidenceIds) || !item.evidenceIds.length)).length
      check(vendor, 'Verdict evidence', cells.length && !dangling && !uncited ? 'present' : 'missing', `${dangling} unresolved evidence references; ${uncited} positive or disputed verdicts without required citations.`)
      presence(vendor, 'Evidence records', evidence.length > 0, `${evidence.length} evidence items; ${evidence.filter(item => item.tier === 'probe').length} recorded as probe tier.`)
      const reviewFile = `vendors/reviews/generated/${category.id}--${product.id}.json`
      if (files.has(reviewFile)) {
        const review = json(reviewFile)
        date(vendor, review.tested_on, review.recheck_due)
        check(vendor, 'Review record', 'present', `${review.status ?? 'Unknown status'}; ${review.reviewer ?? 'reviewer not recorded'}.`)
      } else check(vendor, 'Review record', 'unknown', 'No generated review record.')
    }
  }
  metrics.push({ label: 'Vendor story verdicts', covered: presentCells, total: expectedCells, meaning: 'Unique product/story cells in the current ranking taxonomies, including negative verdicts.' })
  const roadmap = array(json('data/arena-roadmap.json'), 'arena roadmap')
  metrics.push({ label: 'Rankings in the declared roadmap', covered: roadmap.filter(item => categories.some(category => category.id === item.id)).length, total: roadmap.length, meaning: 'Presence in the category registry; does not establish complete vendor coverage.' })

  const documents = json('open-documents/registry.json')
  if (!Number.isInteger(documents.review_window_days) || documents.review_window_days <= 0) throw new Error('Documents require a positive review_window_days.')
  for (const value of array(documents.documents, 'documents')) {
    const record = add('documents', value.id, value.name, 'open-documents/registry.json', [value.use_case, value.jurisdiction])
    presence(record, 'License or terms note', nonempty(value.license_note))
    presence(record, 'Publisher', nonempty(value.publisher))
    link(record, value.url, 'publisher document', 'external')
    const due = isoDate(value.checked_on) && Number.isInteger(documents.review_window_days) && documents.review_window_days > 0
      ? new Date(Date.parse(`${value.checked_on}T00:00:00Z`) + documents.review_window_days * 86400000).toISOString().slice(0, 10) : null
    date(record, value.checked_on, due)
  }
  for (const [collection, file, field] of [
    ['jurisdictions', 'jurisdictions/registry.json', 'jurisdictions'], ['sources', 'sources/registry.json', 'sources'], ['resources', 'resources/registry.json', 'resources'],
  ]) {
    for (const value of array(json(file)[field], file)) {
      const record = add(collection, value.id ?? value.code, value.name ?? value.title, file, [value.jurisdiction, value.kind])
      if (value.url) link(record, value.url, 'source URL', 'external')
      if (collection === 'jurisdictions') {
        check(record, 'Declared coverage', 'unknown', `${value.coverage ?? 'Not recorded'}: ${value.scope ?? 'scope not recorded'}`)
        if (value.parent) link(record, recordKey('jurisdictions', value.parent), 'parent jurisdiction')
      } else {
        date(record, value.checked_on)
        if (collection === 'sources') {
          presence(record, 'Exact provision locator', nonempty(value.locator))
          if (value.jurisdiction) link(record, recordKey('jurisdictions', value.jurisdiction), 'jurisdiction')
        }
      }
    }
  }
  for (const file of [...files.keys()].filter(file => /^rules\/.+\.json$/.test(file)).sort()) {
    const value = json(file)
    const record = add('rules', value.id, value.id, file, [value.jurisdiction, value.status])
    presence(record, 'Rule statement', nonempty(value.statement))
    presence(record, 'Source citations', Array.isArray(value.source_ids) && value.source_ids.length > 0)
    date(record, value.reviewed_on, value.review_due)
    check(record, 'Recorded maturity', value.status === 'reviewed' ? 'present' : 'unknown', `${value.status ?? 'Unknown'}; ${value.reviewer ?? 'reviewer not recorded'}.`)
    for (const id of value.source_ids ?? []) link(record, recordKey('sources', id), 'cites')
    link(record, recordKey('jurisdictions', value.jurisdiction), 'jurisdiction')
  }
  for (const value of array(json('processes/artifacts.json').artifacts, 'artifacts')) {
    const record = add('artifacts', value.id, value.label, 'processes/artifacts.json')
    presence(record, 'Description', nonempty(value.description))
    link(record, processTarget(value.producedBy), 'produced by')
    for (const id of value.alsoProducedBy ?? []) link(record, processTarget(id), 'also produced by')
    for (const id of value.documents ?? []) link(record, recordKey('documents', id), 'registered template')
    if (value.terminal) check(record, 'Terminal artifact', 'present', 'No downstream consumer is required by the source.')
  }
  const modules = json('processes/business-logic-map.json').modules
  if (!modules || typeof modules !== 'object') throw new Error('Invalid business logic map.')
  const moduleFiles = [...files.keys()].filter(file => /^lib\/openstartup\/[^/]+\.ts$/.test(file)).sort()
  for (const file of moduleFiles) {
    read(file)
    const id = path.basename(file, '.ts')
    const mapping = modules[id]
    const record = add('modules', id, mapping?.label ?? id, file)
    const testFile = `lib/openstartup/__tests__/${id}.test.ts`
    if (files.has(testFile)) read(testFile)
    presence(record, 'Matching test file', files.has(testFile), 'File presence only; test execution is reported separately by CI.')
    check(record, 'Process mapping', mapping ? 'present' : 'unknown', mapping ? 'Explicit business-logic map entry.' : 'No explicit mapping; this may be a support module.')
    for (const target of mapping?.processes ?? []) link(record, processTarget(target), 'supports')
  }
  for (const [id, mapping] of Object.entries(modules)) {
    if (!moduleFiles.includes(mapping.file)) {
      const record = add('modules', id, mapping.label ?? id, 'processes/business-logic-map.json')
      check(record, 'Module source', 'missing', `Mapped file not found: ${mapping.file}`)
    }
  }
  for (const { record, value } of processRows) {
    let steps = 0
    let guided = 0
    walk(value, item => {
      if (item.kind === 'step') { steps++; if (nonempty(item.guidance)) guided++ }
      if (item.kind === 'reference' && item.ref) link(record, processTarget(item.ref), 'uses process')
      for (const ref of item.references ?? []) {
        if (ref.kind === 'url') link(record, ref.url, ref.role, 'external')
        else if (ref.kind === 'vendor') { const target = vendorTarget(ref.id); link(record, target.target, ref.role, target.state) }
        else {
          const collection = { category: 'arenas', product: 'vendors', rule: 'rules', source: 'sources', guidance: 'resources' }[ref.kind]
          if (collection) link(record, recordKey(collection, ref.id), ref.role)
        }
      }
      for (const id of item.documents ?? []) link(record, recordKey('documents', id), 'document')
      for (const [field, relation] of [['requires', 'requires artifact'], ['produces', 'produces artifact']])
        if (Array.isArray(item[field])) for (const id of item[field]) if (typeof id === 'string') link(record, recordKey('artifacts', id), relation)
    })
    check(record, 'Step guidance coverage', !steps ? 'unknown' : guided === steps ? 'present' : 'missing', `${guided} / ${steps} local steps have guidance; referenced processes are evaluated separately.`)
    check(record, 'External citations', record.links.some(item => item.state === 'external') ? 'present' : 'unknown', 'Declared URL references only; this audit does not verify source truth or live URLs.')
  }
  const byKey = new Map()
  for (const record of records) {
    if (byKey.has(record.key)) throw new Error(`Duplicate audit identity: ${record.key}`)
    byKey.set(record.key, record)
  }
  for (const record of records) for (const ref of record.links) {
    if (ref.state === 'pending') ref.state = byKey.has(ref.target) ? 'resolved' : 'unresolved'
    if (ref.state === 'resolved') byKey.get(ref.target).inbound++
  }
  const findingCount = record => record.checks.filter(item => ['missing', 'needs_review'].includes(item.state)).length + record.links.filter(item => item.state === 'unresolved').length
  records.sort((a, b) => a.key.localeCompare(b.key, 'en'))
  const collections = Object.entries(collectionNames).map(([id, name]) => {
    const rows = records.filter(record => record.collection === id)
    return { id, name, records: rows.length, withFindings: rows.filter(record => findingCount(record) > 0).length,
      linked: rows.filter(record => record.inbound > 0 || record.links.some(ref => ref.state === 'resolved')).length,
      unresolved: rows.reduce((total, record) => total + record.links.filter(ref => ref.state === 'unresolved').length, 0) }
  })
  const coverage = json('coverage/coverage.json')
  const scopes = array(coverage.coverage, 'coverage scopes').map(value => ({
    scenario: value.scenario, processKey: processTarget(value.process_id), entityJurisdiction: value.entity_jurisdiction,
    taxJurisdiction: value.tax_jurisdiction, status: value.status, reviewedOn: value.reviewed_on,
    reviewDue: value.review_due, limits: array(value.limits, 'scope limits'),
  }))
  const declaredCoverage = { claim: coverage.coverage_claim, uncovered: array(coverage.uncovered, 'uncovered scopes'), scopes }
  const inputDigest = createHash('sha256').update(JSON.stringify([...inputs].sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex')
  const report = { schemaVersion: 1, repository: 'ultrametricai/ultrametric', ...metadata, inputDigest, inputFiles: inputs.size,
    collections, metrics, declaredCoverage, records }
  if (records.length > 5000 || Buffer.byteLength(JSON.stringify(report)) > 4 * 1024 * 1024) throw new Error('Content audit exceeds its size limit.')
  return report
}

export function readAuditFiles(root) {
  const files = new Map()
  const visit = relative => {
    const absolute = path.join(root, relative)
    for (const item of readdirSync(absolute, { withFileTypes: true })) {
      const file = `${relative}/${item.name}`
      if (item.isSymbolicLink()) throw new Error(`Audit source must not be a symlink: ${file}`)
      if (item.isDirectory()) visit(file)
      else if (/\.(json|ts)$/.test(item.name)) files.set(file, readFileSync(path.join(root, file), 'utf8'))
    }
  }
  for (const directory of roots) visit(directory)
  return files
}

export function writeContentAudit(root = process.cwd(), output) {
  if (!output) throw new Error('Use node scripts/content-audit.mjs <output.json>')
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...roots, 'scripts/content-audit.mjs'], { cwd: root, encoding: 'utf8' }).trim().length > 0
  const report = buildContentAudit(readAuditFiles(root), { sourceRevision: revision, sourceDirty: dirty, generatedAt: new Date().toISOString() })
  const target = path.resolve(root, output)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(report) + '\n')
  console.log(`Content audit: ${report.records.length} records from ${report.inputFiles} inputs.`)
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Use node scripts/content-audit.mjs <output.json>')
  writeContentAudit(process.cwd(), process.argv[2])
}
