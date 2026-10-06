export type ProcessSearchParams = Record<string, string | string[] | undefined>

/** Fallback redirects retain repeated and unknown queries. Hashes stay in the browser. */
export function withProcessSearchParams(href: string, values: ProcessSearchParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
  }
  return query.size ? `${href}?${query}` : href
}
