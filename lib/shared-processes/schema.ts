import { z } from 'zod'
import { executionSchema, validateExecution } from '../execution'

const text = z.string().min(1).regex(/\S/)
const id = z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
const webUrl = z.string().url().regex(/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/)
const reference = z.union([
  z.strictObject({ kind: z.enum(['vendor', 'category', 'product', 'rule', 'source', 'guidance']), id: text, role: text }),
  z.strictObject({ kind: z.literal('url'), url: webUrl, title: text.nullable(), description: text.nullable(), role: text }),
])
const stepMetadata = z.object({ execution: executionSchema.optional() }).catchall(z.json())
const note = z.strictObject({ text, references: z.array(reference).optional() })
export const connectionSchema = z.strictObject({ from: id, to: id, option: id.optional(), when: text.nullable().optional() })
export type Reference = z.infer<typeof reference>
export type Note = z.infer<typeof note>
export type Connection = z.infer<typeof connectionSchema>
export interface Option {
  id: string
  title: string
  summary: string
  when: string | null
  parts: Part[]
  links?: Connection[]
  references: Reference[]
  notes: Note[]
  metadata: Record<string, unknown>
}
export interface Part {
  id: string
  kind: 'step' | 'reference' | 'decision'
  title: string | null
  guidance: string | null
  when: string | null
  ref: string | null
  options: Option[]
  references: Reference[]
  notes: Note[]
  metadata: Record<string, unknown>
}
const optionSchema: z.ZodType<Option> = z.lazy(() => z.strictObject({
  id, title: text, summary: z.string(), when: text.nullable(), parts: z.array(partSchema),
  links: z.array(connectionSchema).optional(), references: z.array(reference), notes: z.array(note), metadata: stepMetadata,
}))
const partSchema: z.ZodType<Part> = z.lazy(() => z.strictObject({
  id, kind: z.enum(['step', 'reference', 'decision']), title: text.nullable(), guidance: text.nullable(),
  when: text.nullable(), ref: id.nullable(), options: z.array(optionSchema), references: z.array(reference),
  notes: z.array(note), metadata: stepMetadata,
}))
export const sharedRecordSchema = z.strictObject({
  schemaVersion: z.literal(1), id, kind: z.enum(['situation', 'process']), title: text, summary: z.string(),
  outcomes: z.array(text), guidance: text.nullable(), when: text.nullable().optional(), aliases: z.array(id).optional(),
  entrySteps: z.array(id).min(1).optional(), taskIds: z.array(id).min(1).optional(),
  parts: z.array(partSchema), links: z.array(connectionSchema), references: z.array(reference),
  notes: z.array(note), metadata: stepMetadata,
  source: z.strictObject({ path: text, id: text, revision: z.string().regex(/^[a-f0-9]{40}$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
})
export type SharedRecord = z.infer<typeof sharedRecordSchema>

function rejectLegacyOperations(value: unknown, location: string) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectLegacyOperations(item, `${location}[${index}]`))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'toolCall' || key === 'functionCalls') {
        throw new Error(`${location}.${key}: legacy operations belong in the migration audit`)
      }
      rejectLegacyOperations(item, `${location}.${key}`)
    }
  }
}

function acyclic(graph: Map<string, string[]>, label: string) {
  const active = new Set<string>()
  const done = new Set<string>()
  function visit(id: string) {
    if (active.has(id)) throw new Error(`${label}: cycle at ${id}`)
    if (done.has(id)) return
    active.add(id)
    for (const child of graph.get(id) ?? []) visit(child)
    active.delete(id)
    done.add(id)
  }
  for (const id of graph.keys()) visit(id)
}

export function validateCatalog(input: unknown): SharedRecord[] {
  const records = z.array(sharedRecordSchema).parse(input)
  const byId = new Map(records.map(record => [record.id, record]))
  if (byId.size !== records.length) throw new Error('Duplicate record ID')
  const aliases = new Set(byId.keys())
  const references = new Map<string, string[]>()
  for (const record of records) {
    rejectLegacyOperations(record, record.id)
    for (const alias of record.aliases ?? []) {
      if (aliases.has(alias)) throw new Error(`Duplicate alias: ${alias}`)
      aliases.add(alias)
    }
    const children: string[] = []
    references.set(record.id, children)
    const allParts = new Set<string>()
    function graph(parts: Part[], links: Connection[], scope: string) {
      const local = new Map(parts.map(part => [part.id, part]))
      if (local.size !== parts.length) throw new Error(`${scope}: duplicate part ID`)
      for (const part of parts) {
        if (allParts.has(part.id)) throw new Error(`${record.id}: duplicate nested part ID ${part.id}`)
        allParts.add(part.id)
        validateExecution(part.metadata, `${scope}/${part.id}`)
        for (const option of part.options) validateExecution(option.metadata, `${scope}/${part.id}/${option.id}`)
        if (part.kind === 'reference') {
          if (!part.ref || !byId.has(part.ref)) throw new Error(`${scope}/${part.id}: unresolved process reference`)
          children.push(part.ref)
        } else if (part.ref !== null) throw new Error(`${scope}/${part.id}: only reference parts have ref`)
        if (part.kind === 'decision' && (!part.title || part.options.length === 0)) throw new Error(`${scope}/${part.id}: decision needs a question and options`)
        if (new Set(part.options.map(option => option.id)).size !== part.options.length) throw new Error(`${scope}/${part.id}: duplicate option ID`)
        for (const option of part.options) graph(option.parts, option.links ?? [], `${scope}/${part.id}/${option.id}`)
      }
      const adjacency = new Map(parts.map(part => [part.id, [] as string[]]))
      const seen = new Set<string>()
      for (const link of links) {
        const from = local.get(link.from)
        if (!from || !local.has(link.to)) throw new Error(`${scope}: connection target is missing`)
        if (link.option && (from.kind !== 'decision' || !from.options.some(option => option.id === link.option))) throw new Error(`${scope}: connection option is not on its source decision`)
        const key = JSON.stringify([link.from, link.to, link.option ?? null, link.when ?? null])
        if (seen.has(key)) throw new Error(`${scope}: duplicate connection`)
        seen.add(key)
        adjacency.get(link.from)!.push(link.to)
      }
      acyclic(adjacency, scope)
      return adjacency
    }
    const adjacency = graph(record.parts, record.links, record.id)
    if (record.entrySteps) {
      const entries = record.entrySteps
      const ids = new Set(record.parts.map(part => part.id))
      const incoming = new Set(record.links.map(link => link.to))
      if (new Set(entries).size !== entries.length || entries.some(id => !ids.has(id) || incoming.has(id))) {
        throw new Error(`${record.id}: invalid entry step`)
      }
      const reached = new Set<string>()
      function reach(id: string) {
        if (reached.has(id)) return
        reached.add(id)
        for (const child of adjacency.get(id) ?? []) reach(child)
      }
      entries.forEach(reach)
      if (reached.size !== ids.size) throw new Error(`${record.id}: unreachable step`)
    }
  }
  acyclic(references, 'Process nesting')
  return records
}

export function collectDecisions(records: SharedRecord[], rootId: string) {
  const byId = new Map(records.map(record => [record.id, record]))
  const visited = new Set<string>()
  const result: { recordId: string; part: Part }[] = []
  function visit(recordId: string) {
    if (visited.has(recordId)) return
    const record = byId.get(recordId)
    if (!record) throw new Error(`Unknown record: ${recordId}`)
    visited.add(recordId)
    function parts(items: Part[]) {
      for (const part of items) {
        if (part.kind === 'decision') result.push({ recordId, part })
        if (part.ref) visit(part.ref)
        for (const option of part.options) parts(option.parts)
      }
    }
    parts(record.parts)
  }
  visit(rootId)
  return result
}
