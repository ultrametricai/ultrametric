import { lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { sharedRecordSchema, validateCatalog, type SharedRecord } from './schema'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(value => value !== 'v1')
const identifier = sharedRecordSchema.shape.id
export const processDefinitionSchema = sharedRecordSchema.extend({
  entrySteps: z.array(identifier).min(1),
})
export type CatalogProcess = { slug: string; entrySteps: string[]; record: SharedRecord }

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
  const active = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string) {
    if (active.has(id)) throw new Error('Flow cycle')
    if (visited.has(id)) return
    active.add(id)
    for (const link of links.filter(link => link.from === id)) visit(link.to)
    active.delete(id)
    visited.add(id)
  }
  entries.forEach(visit)
  if (visited.size !== known.size) throw new Error('Every step must be reachable from an explicit entry')
}

export function loadProcessCatalog(selection: { processes: string[] }, root = process.cwd()) {
  const names = z.array(slug).min(1).parse(selection.processes)
  if (new Set(names).size !== names.length) throw new Error('Duplicate process selection')
  const processes: CatalogProcess[] = names.sort().map(name => {
    const { entrySteps, ...record } = processDefinitionSchema.parse(json(path.join(root, 'processes', `${name}.json`)))
    validateFlow(record.parts.map(part => part.id), record.links, entrySteps)
    return { slug: name, entrySteps, record }
  })
  validateCatalog(processes.map(process => process.record))
  return { processes }
}
