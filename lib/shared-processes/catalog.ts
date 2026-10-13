import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { sharedRecordSchema, validateCatalog, type SharedRecord } from './schema'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(value => value !== 'v1')
const identifier = sharedRecordSchema.shape.id
const definition = sharedRecordSchema.omit({ parts: true }).extend({
  steps: z.array(z.string().regex(/^steps\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/)).min(1),
  entrySteps: z.array(identifier).min(1),
})
const journeySchema = z.strictObject({
  schemaVersion: z.literal(1), id: identifier, title: z.string().min(1), summary: z.string(),
  parts: z.array(z.strictObject({ id: identifier, process: identifier, when: z.string().min(1).nullable() })).min(1),
  links: z.array(z.strictObject({ from: identifier, to: identifier, when: z.string().min(1).nullable().optional() })),
  entrySteps: z.array(identifier).min(1),
})
export type CatalogProcess = { slug: string; entrySteps: string[]; record: SharedRecord }
export type Journey = z.infer<typeof journeySchema>

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

export function validateJourneys(input: unknown[], records: SharedRecord[]) {
  const journeys = input.map(value => journeySchema.parse(value))
  const ids = new Set(records.map(record => record.id))
  const names = new Set<string>()
  for (const journey of journeys) {
    if (names.has(journey.id) || ids.has(journey.id)) throw new Error('Duplicate journey ID')
    names.add(journey.id)
    if (journey.parts.some(part => !ids.has(part.process))) throw new Error('Unknown journey process')
    validateFlow(journey.parts.map(part => part.id), journey.links, journey.entrySteps)
  }
  return journeys
}

export function loadProcessCatalog(root = process.cwd()) {
  const processes: CatalogProcess[] = []
  const directory = path.join(root, 'processes')
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const files = readdirSync(path.join(directory, entry.name))
    if (!files.includes('process.json')) continue
    slug.parse(entry.name)
    const folder = path.join(directory, entry.name)
    const { steps, entrySteps, ...record } = definition.parse(json(path.join(folder, 'process.json')))
    if (new Set(steps).size !== steps.length) throw new Error('Duplicate step file')
    if (!lstatSync(path.join(folder, 'steps')).isDirectory()) throw new Error('Expected a steps directory')
    const actual = readdirSync(path.join(folder, 'steps')).map(file => `steps/${file}`).sort()
    if (JSON.stringify(actual) !== JSON.stringify([...steps].sort())) throw new Error('Unlisted or missing step file')
    const assembled = sharedRecordSchema.parse({ ...record, parts: steps.map(file => json(path.join(folder, file))) })
    validateFlow(assembled.parts.map(part => part.id), assembled.links, entrySteps)
    processes.push({ slug: entry.name, entrySteps, record: assembled })
  }
  validateCatalog(processes.map(process => process.record))
  const journeyDirectory = path.join(root, 'journeys')
  const journeyFiles = readdirSync(root).includes('journeys')
    ? readdirSync(journeyDirectory).filter(file => file.endsWith('.json')).sort() : []
  const journeys = validateJourneys(journeyFiles.map(file => json(path.join(journeyDirectory, file))), processes.map(process => process.record))
  return { processes, journeys }
}
