import type { SharedRecord } from './schema'

function functionalSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Published legacy names already travel with their canonical shared record. */
export function sharedRouteAliases(record: SharedRecord): string[] {
  const legacy = record.metadata.slugAliases
  return [...new Set([
    ...(record.aliases ?? []),
    ...(Array.isArray(legacy) ? legacy.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) {
        throw new Error(`${record.id}: invalid legacy slug alias`)
      }
      return value.slug
    }) : []),
  ])]
}

const INDEX_ROUTES = new Set(['preview', 'chains', 'operating-rhythm'])

/** One registry serves routes, redirects, discovery, and link generation. */
export function buildProcessRouteRegistry(records: SharedRecord[]) {
  const byKey = new Map<string, SharedRecord>()
  function reserve(key: string, record: SharedRecord) {
    if (INDEX_ROUTES.has(key)) throw new Error(`${record.id}: reserved process route ${key}`)
    const existing = byKey.get(key)
    if (existing && existing.id !== record.id) throw new Error(`Ambiguous process route ${key}: ${existing.id}, ${record.id}`)
    byKey.set(key, record)
  }
  for (const record of records) {
    if (byKey.get(record.id)?.id === record.id) throw new Error(`Duplicate process ID ${record.id}`)
    reserve(record.id, record)
    for (const alias of sharedRouteAliases(record)) reserve(alias, record)
  }
  const bases = new Map(records.map(record => [record.id,
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(record.id) ? record.id : functionalSlug(record.title) || record.id,
  ]))
  const counts = new Map<string, number>()
  for (const base of bases.values()) counts.set(base, (counts.get(base) ?? 0) + 1)
  const slugs = new Map<string, string>()
  const used = new Set<string>()
  for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = bases.get(record.id)!
    let slug = base
    if (counts.get(base)! > 1 || INDEX_ROUTES.has(base) || (byKey.has(base) && byKey.get(base)!.id !== record.id)) slug = `${base}-${functionalSlug(record.id)}`
    const stem = slug
    let suffix = 2
    while (used.has(slug) || INDEX_ROUTES.has(slug) || (byKey.has(slug) && byKey.get(slug)!.id !== record.id)) slug = `${stem}-${suffix++}`
    slugs.set(record.id, slug)
    used.add(slug)
    reserve(slug, record)
  }
  return { byKey, slugs }
}

export function processRouteRedirects(records: SharedRecord[]) {
  const { byKey, slugs } = buildProcessRouteRegistry(records)
  const redirects = [{ source: '/processes/preview', destination: '/processes', permanent: true }]
  for (const [key, record] of [...byKey].sort(([a], [b]) => a.localeCompare(b))) {
    const destination = `/processes/${slugs.get(record.id)!}`
    redirects.push({ source: `/processes/preview/${key}`, destination, permanent: true })
    if (key !== slugs.get(record.id)) redirects.push({ source: `/processes/${key}`, destination, permanent: true })
  }
  const incorporation = slugs.get('form_001')
  if (incorporation) redirects.push({ source: '/processes/incorporate-c-corp/v2', destination: `/processes/${incorporation}`, permanent: true })
  return redirects
}
