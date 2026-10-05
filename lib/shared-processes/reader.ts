import { loadSharedProcesses } from './load'
import type { SharedRecord } from './schema'
import { buildProcessRouteRegistry } from './routes'

// Kept as an API alias while reader consumers adopt the canonical route name.
export function buildPreviewRoutes(records: SharedRecord[]) {
  return buildProcessRouteRegistry(records).slugs
}

export function findSharedRecord(records: SharedRecord[], key: string) {
  return buildProcessRouteRegistry(records).byKey.get(key)
}

export function readSharedCatalog(root = process.cwd()) {
  return loadSharedProcesses(root)
}

export function sharedProcessHref(id: string, records: SharedRecord[] = readSharedCatalog()) {
  const slug = buildProcessRouteRegistry(records).slugs.get(id)
  if (!slug) throw new Error(`Unknown shared process ${id}`)
  return `/processes/${encodeURIComponent(slug)}`
}

/** @deprecated Reader links now always use the regular canonical route. */
export const sharedPreviewHref = sharedProcessHref
