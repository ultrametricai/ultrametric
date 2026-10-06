import { loadSharedProcesses } from './load'
import { buildProcessRouteRegistry } from './routes'
import type { SharedRecord } from './schema'

export function buildPreviewRoutes(records: SharedRecord[]) {
  return buildProcessRouteRegistry(records).slugs
}

export function findSharedRecord(records: SharedRecord[], key: string) {
  return buildProcessRouteRegistry(records).byKey.get(key)
}

export function readSharedCatalog(root = process.cwd()) {
  return loadSharedProcesses(root)
}

export function sharedPreviewHref(id: string, records: SharedRecord[] = readSharedCatalog()) {
  const { byKey, slugs } = buildProcessRouteRegistry(records)
  const record = byKey.get(id)
  if (!record) throw new Error(`Unknown shared process route: ${id}`)
  return `/processes/${encodeURIComponent(slugs.get(record.id)!)}/v2`
}
