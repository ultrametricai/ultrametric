import type { CatalogProcess } from './catalog'
import type { Option, Part, Reference } from './schema'

// Compatibility is a projection, never a second authoring source. Operational
// bindings are deliberately absent; private consumers join their pinned evidence.
export function referenceFields(references: Reference[]) {
  const result: Record<string, unknown> = {}
  const rules = [
    ['vendors', 'vendor', 'involves', true], ['vendor', 'vendor', 'stated-vendor', false],
    ['vendorOptions', 'vendor', 'candidate', true], ['optionsArenaId', 'category', 'rankings', false],
    ['extraOptionArenas', 'category', 'additional-rankings', true], ['rule_ids', 'rule', 'evidence', true],
  ] as const
  for (const [field, kind, role, many] of rules) {
    const ids = references.flatMap(ref => ref.kind === kind && ref.role === role && 'id' in ref ? [ref.id] : [])
    if (ids.length) result[field] = many ? ids : ids[0]
  }
  const products = references.flatMap(ref => ref.kind === 'product' && ref.role === 'additional-candidate' ? [ref.id] : [])
  if (products.length) result.extraOptionRefs = products.map(id => { const [arenaId, productId] = id.split('/'); return { arenaId, productId } })
  for (const ref of references) if (ref.kind === 'url') {
    if (ref.role === 'legacy-action-link') { result.actionUrl = ref.url; if (ref.title) result.actionLabel = ref.title }
    if (ref.role === 'legacy-signup-link') result.signupUrl = ref.url
  }
  return result
}

function method(option: Option): Record<string, unknown> {
  const { context, ...metadata } = option.metadata
  return { ...metadata, ...referenceFields(option.references), id: option.id, label: option.title, summary: option.summary,
    ...(context && typeof context === 'object' ? { context: { ...context, when: option.when } } : {}),
    ...(option.parts.length ? { subSteps: option.parts.map(part => node(part)) } : {}),
  }
}

function node(part: Part, workflow = false): Record<string, unknown> {
  const base = part.options.find(option => option.id === 'default')
  const alternatives = part.options.filter(option => option.id !== 'default')
  const us = Array.isArray(part.metadata.geoResolutions) ? part.metadata.geoResolutions.find((row: { country?: string }) => row.country === 'US') : undefined
  const referenceMechanics = us && typeof us === 'object' ? { ...(us.verify ? { verify: us.verify } : {}), ...(us.cost ? { cost: us.cost } : {}) } : {}
  return { ...part.metadata, ...referenceMechanics, ...base?.metadata, ...referenceFields([...part.references, ...(base?.references ?? [])]),
    id: part.id, [workflow ? 'action' : 'label']: part.title,
    ...(part.ref ? { processRef: part.ref } : {}),
    ...(alternatives.length ? { methods: alternatives.map(method) } : {}),
  }
}

export function projectOperational(process: CatalogProcess, catalog: CatalogProcess[]) {
  const { record } = process
  if (!('phase' in record.metadata) || process.taskIds) return null
  const nodes = record.parts.map(part => node(part))
  for (const part of nodes) if (typeof part.processRef === 'string') {
    const target = catalog.find(item => item.record.id === part.processRef)
    if (!target) throw new Error(`${record.id}: unresolved reference ${part.processRef}`)
    part.processRef = target.slug
  }
  const metadata = { ...record.metadata }
  if (nodes.some(part => !part.jurisdictions && typeof part.estimatedMinutes !== 'number')) {
    delete metadata.activeMinutes
    delete metadata.totalEstimatedMinutes
  }
  return { ...metadata, vendors: [], ...referenceFields(record.references), id: record.id, title: record.title,
    description: record.summary, dag: { nodes, edges: record.links },
  }
}

export function projectChain(process: CatalogProcess) {
  if (!process.taskIds) return null
  const { record } = process
  return { ...record.metadata, id: record.id, name: record.title, tagline: record.summary, taskIds: process.taskIds }
}

export function projectJurisdiction(process: CatalogProcess) {
  const { record } = process
  if (!('applicability' in record.metadata)) return null
  return { ...record.metadata, ...referenceFields(record.references), id: record.id, title: record.title, summary: record.summary,
    outputs: record.outcomes, steps: record.parts.map(part => node(part, true)),
  }
}
