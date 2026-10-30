import type { SharedRecord } from './schema'

export type ProcessCountry = 'GLOBAL' | NonNullable<SharedRecord['countryViews']>[number]['country']
export interface ProcessCountryEntry { country: ProcessCountry; title: string; slug: string; summary?: string }

/** Only explicitly authored entries participate in the staged rollout. */
export function processCountryEntries(record: SharedRecord, sourceSlug: string): ProcessCountryEntry[] {
  if (!record.countryViews?.length) return []
  const entries: ProcessCountryEntry[] = [
    { country: 'GLOBAL', title: record.title, slug: record.globalSlug ?? sourceSlug },
    ...record.countryViews,
  ]
  if (new Set(entries.map(entry => entry.country)).size !== entries.length) throw new Error(`${record.id}: duplicate country view`)
  if (new Set(entries.map(entry => entry.slug)).size !== entries.length) throw new Error(`${record.id}: duplicate country route`)
  return entries
}
