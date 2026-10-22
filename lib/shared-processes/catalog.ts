import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { sharedRecordSchema, validateCatalog, type SharedRecord } from './schema'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(value => value !== 'v1')
const identifier = sharedRecordSchema.shape.id
export const processDefinitionSchema = z.union([
  sharedRecordSchema.omit({ taskIds: true }).extend({
    entrySteps: z.array(identifier).min(1),
  }),
  sharedRecordSchema.extend({
    entrySteps: z.array(identifier).length(0),
    taskIds: z.array(identifier).min(1),
    links: sharedRecordSchema.shape.links.length(0),
  }),
])
export type CatalogProcess = { slug: string; entrySteps: string[]; taskIds?: string[]; record: SharedRecord }

function json(file: string) {
  if (!lstatSync(file).isFile()) throw new Error(`Expected a regular file: ${file}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function validateFlow(ids: string[], links: { from: string; to: string }[], entries: string[]) {
  const known = new Set(ids)
  if (known.size !== ids.length || new Set(entries).size !== entries.length) throw new Error('Duplicate flow ID')
  if (!entries.length || entries.some(id => !known.has(id))) throw new Error('Invalid flow entry')
  if (links.some(link => !known.has(link.from) || !known.has(link.to))) throw new Error('Unknown flow target')
  const incoming = new Set(links.map(link => link.to))
  if (entries.some(id => incoming.has(id))) throw new Error('Flow entry has an incoming connection')
  const outgoing = new Map(ids.map(id => [id, [] as string[]]))
  for (const link of links) outgoing.get(link.from)!.push(link.to)
  const active = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string) {
    if (active.has(id)) throw new Error('Flow cycle')
    if (visited.has(id)) return
    active.add(id)
    for (const target of outgoing.get(id)!) visit(target)
    active.delete(id)
    visited.add(id)
  }
  entries.forEach(visit)
  if (visited.size !== known.size) throw new Error('Every step must be reachable from an explicit entry')
}

export function loadProcessCatalog(selection?: { processes: string[] }, root = process.cwd()) {
  const directory = path.join(root, 'open-processes')
  const names = z.array(slug).min(1).parse(selection?.processes ?? json(path.join(directory, 'catalog.json')).processes)
  if (new Set(names).size !== names.length) throw new Error('Duplicate process selection')
  if (!selection) for (const file of readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const value = json(path.join(directory, file))
    if (value?.schemaVersion === 1 && Array.isArray(value.parts) && !names.includes(file.slice(0, -5))) {
      throw new Error(`Canonical definition missing from catalog: ${file}`)
    }
  }
  const selected = new Map<string, CatalogProcess>()
  function read(name: string) {
    const definition: SharedRecord & { entrySteps: string[] } = processDefinitionSchema.parse(json(path.join(directory, `${name}.json`)))
    const { entrySteps, taskIds, ...record } = definition
    if (taskIds) {
      if (entrySteps.length || record.links.length || JSON.stringify(record.parts.map(part => part.kind === 'reference' ? part.ref : null)) !== JSON.stringify(taskIds)) {
        throw new Error(`${record.id}: chain taskIds must match reference parts in order, with no dependency graph`)
      }
    } else validateFlow(record.parts.map(part => part.id), record.links, entrySteps)
    return { slug: name, entrySteps, ...(taskIds ? { taskIds } : {}), record }
  }
  for (const name of selection ? names.sort() : names) selected.set(name, read(name))
  // A pinned selection includes its complete reference closure. References resolve by
  // stable record ID; filenames and labels are never used as an identity fallback.
  function references(parts: SharedRecord['parts']): string[] {
    return parts.flatMap(part => [...(part.ref ? [part.ref] : []), ...part.options.flatMap(option => references(option.parts))])
  }
  for (const item of selected.values()) for (const id of references(item.record.parts)) {
    if ([...selected.values()].some(process => process.record.id === id)) continue
    const matches = readdirSync(directory).filter(name => name.endsWith('.json')).filter(name => json(path.join(directory, name))?.id === id)
    if (matches.length !== 1) throw new Error(`Unresolved or ambiguous process reference: ${id}`)
    const name = matches[0].slice(0, -5)
    slug.parse(name)
    selected.set(name, read(name))
  }
  const processes = [...selected.values()]
  validateCatalog(processes.map(process => process.record))
  return { processes }
}

/** Authoring gate; older imports remain valid additive-schema consumers. */
export function validateExecutionCoverage(records: SharedRecord[]) {
  function assess(parts: SharedRecord['parts'], scope: string) {
    for (const part of parts) {
      const key = `${scope}/${part.id}`
      const hasDefault = part.options.some(option => option.id === 'default')
      if (part.kind !== 'reference' && !hasDefault && part.metadata.execution === undefined) {
        throw new Error(`${key}: missing execution assessment`)
      }
      for (const option of part.options) {
        if (option.metadata.execution === undefined) throw new Error(`${key}/${option.id}: missing execution assessment`)
        assess(option.parts, `${key}/${option.id}`)
      }
    }
  }
  for (const record of records) assess(record.parts, record.id)
}
