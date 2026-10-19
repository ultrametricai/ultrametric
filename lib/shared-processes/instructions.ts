import { z } from 'zod'
import type { CatalogProcess } from './catalog'
import type { Note, Option, Part, SharedRecord } from './schema'

const strings = z.array(z.string())
const object = z.record(z.string(), z.unknown())

// Only these authored fields become instructions. Operational metadata, tool
// discovery hints, scores and estimated timing are never dumped into the guide.
function instructionalNotes(metadata: Record<string, unknown>): Note[] {
  const notes: Note[] = []
  const add = (text: string, url?: unknown) => notes.push({ text,
    ...(typeof url === 'string' ? { references: [{ kind: 'url' as const, url, title: null, description: null, role: 'source' }] } : {}),
  })
  if (metadata.verify) {
    const value = z.object({ how: z.string(), url: z.string().optional() }).parse(metadata.verify)
    add(`Verification: ${value.how}`, value.url)
  }
  if (metadata.failureModes) for (const item of z.array(z.object({ what: z.string(), then: z.string(), source: z.string() })).parse(metadata.failureModes)) {
    add(`If ${item.what}\nRecovery: ${item.then}`, item.source)
  }
  if (metadata.previewBriefs) for (const item of z.array(z.object({ vendor: z.string(), guidance: z.string() })).parse(metadata.previewBriefs)) {
    add(`For ${item.vendor}: ${item.guidance}`)
  }
  if (metadata.previewContext) {
    const value = z.object({ decision: z.string(), option: z.string() }).parse(metadata.previewContext)
    add(`Applies when decision ${value.decision} uses option ${value.option}.`)
  }
  if (metadata.geoNotes) for (const item of z.array(z.object({ country: z.string(), kind: z.string(), summary: z.string() }).passthrough()).parse(metadata.geoNotes)) {
    add(`${item.country} (${item.kind}): ${item.summary}`, item.actionUrl)
  }
  if (metadata.geoResolutions) for (const item of z.array(z.object({ country: z.string(), kind: z.string(), label: z.string(), guidance: z.string().optional() }).passthrough()).parse(metadata.geoResolutions)) {
    add(`${item.country} resolution (${item.kind}): ${item.label}${item.guidance ? ` — ${item.guidance}` : ''}`, item.actionUrl)
  }
  if (metadata.contextNeeded) for (const item of z.array(z.object({ query: z.string().optional(), required: z.boolean() })).parse(metadata.contextNeeded)) {
    if (item.query) add(`${item.required ? 'Required' : 'Optional'} context: ${item.query}`)
  }
  if (metadata.context) {
    const value = object.parse(metadata.context)
    if (value.kind === 'geo' && value.countries) add(`Applies in: ${strings.parse(value.countries).join(', ')}`)
  }
  if (metadata.jurisdictions) add(`Applies in jurisdictions: ${strings.parse(metadata.jurisdictions).join(', ')}`)
  if (typeof metadata.producesArtifact === 'string') add(`Produced artifact: ${metadata.producesArtifact}`)
  if (metadata.applicability) {
    const value = object.parse(metadata.applicability)
    for (const key of ['entity_jurisdiction', 'tax_jurisdiction', 'entity_type', 'event_type']) {
      if (typeof value[key] === 'string') add(`Applicability ${key}: ${value[key]}`)
    }
    if (value.exclusions) for (const exclusion of strings.parse(value.exclusions)) add(`Excluded from this workflow: ${exclusion}`)
  }
  if (metadata.decisions) for (const item of z.array(z.object({ id: z.string(), question: z.string(), owner: z.string() })).parse(metadata.decisions)) {
    add(`Review question ${item.id} (owner: ${item.owner}): ${item.question}`)
  }
  if (metadata.stop_conditions) for (const condition of strings.parse(metadata.stop_conditions)) add(`Stop condition: ${condition}`)
  if (typeof metadata.automation_boundary === 'string') add(metadata.automation_boundary)
  if (typeof metadata.trigger === 'string') add(`Trigger: ${metadata.trigger}`)
  for (const [key, label] of [['requires', 'Required artifacts'], ['produces', 'Produced artifacts'], ['inputs', 'Inputs'], ['evidence', 'Evidence to retain']] as const) {
    if (metadata[key] && strings.parse(metadata[key]).length) add(`${label}: ${strings.parse(metadata[key]).join(', ')}`)
  }
  if (metadata.legalSignature === true) add('This step requires a human legal signature or attestation.')
  if (metadata.approvalRequired === true) add('Obtain human approval before performing this step.')
  if (typeof metadata.mode === 'string') add(`Action mode: ${metadata.mode}`)
  if (typeof metadata.owner === 'string') add(`Owner: ${metadata.owner}`)
  if (metadata.approval) {
    const approval = z.object({ role: z.string(), scope: z.string() }).parse(metadata.approval)
    add(`Required approval from ${approval.role}; scope: ${approval.scope}`)
  }
  return notes
}

export function recordForInstructions(record: SharedRecord): SharedRecord {
  const option = (value: Option): Option => ({ ...value, notes: [...value.notes, ...instructionalNotes(value.metadata)], parts: value.parts.map(part) })
  const part = (value: Part): Part => ({ ...value, notes: [...value.notes, ...instructionalNotes(value.metadata)], options: value.options.map(option) })
  return { ...record, notes: [...record.notes, ...instructionalNotes(record.metadata)], parts: record.parts.map(part) }
}

export function recordForExport(process: CatalogProcess): SharedRecord {
  const record = recordForInstructions(process.record)
  // API47 requires nonempty entries for a DAG. Chains have composition order,
  // not DAG entries; preserve that order as taskIds and explicit instructions.
  if (process.taskIds) return { ...record, taskIds: process.taskIds,
    notes: [...record.notes, { text: `Compose the referenced processes in taskIds order: ${process.taskIds.join(' → ')}. Each referenced process retains its own dependency graph.` }],
  }
  return { ...record, entrySteps: process.entrySteps }
}
