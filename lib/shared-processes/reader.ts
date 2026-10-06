import { loadSharedProcesses } from './load'
import type { SharedRecord } from './schema'

function functionalSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Human-authored readable IDs (notably chains) stay stable. Other routes use the
// functional title. IDs/aliases are reserved so new slugs cannot steal old links.
export function buildPreviewRoutes(records: SharedRecord[]) {
  const reserved = new Map<string, string>()
  for (const record of records) {
    for (const key of [record.id, ...(record.aliases ?? [])]) reserved.set(key, record.id)
  }
  const bases = new Map(records.map(record => [record.id,
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(record.id) ? record.id : functionalSlug(record.title) || record.id,
  ]))
  const counts = new Map<string, number>()
  for (const base of bases.values()) counts.set(base, (counts.get(base) ?? 0) + 1)
  const routes = new Map<string, string>()
  const used = new Set<string>()
  for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = bases.get(record.id)!
    let slug = base
    if (counts.get(base)! > 1 || (reserved.has(base) && reserved.get(base) !== record.id)) {
      slug = `${base}-${functionalSlug(record.id)}`
    }
    const stem = slug
    let suffix = 2
    while (used.has(slug) || (reserved.has(slug) && reserved.get(slug) !== record.id)) slug = `${stem}-${suffix++}`
    routes.set(record.id, slug)
    used.add(slug)
  }
  return routes
}

export function findSharedRecord(records: SharedRecord[], key: string) {
  const direct = records.find(record => record.id === key || record.aliases?.includes(key))
  if (direct) return direct
  const routes = buildPreviewRoutes(records)
  return records.find(record => routes.get(record.id) === key)
}

export function readSharedCatalog(root = process.cwd()) {
  return loadSharedProcesses(root)
}

export function sharedPreviewHref(id: string, records: SharedRecord[] = readSharedCatalog()) {
  return `/processes/${encodeURIComponent(buildPreviewRoutes(records).get(id) ?? id)}/v2`
}
