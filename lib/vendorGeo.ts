import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { VendorGeoLookup } from './geoPreference'

// Vendor region-availability EVIDENCE (founder GEO ask 2026-09-28: "do spikes into India, UK,
// European countries … whether the vendors are tuned for those regions or work globally").
// jurisdictions/vendor-geo.json holds one row per (product, country) for the top vendors of the most
// geo-sensitive arenas — startup-banking, payroll, legal-ops, tax-automation, payments,
// accounting — each grounded in the vendor's OWN pages (help center, docs, availability
// tables), crawl-verified live, honest negatives recorded (Mercury/Brex/Ramp/Gusto really are
// US-entity-only; Square really has no Germany or India). See
// pipeline/scripts/build-vendor-geo.py for the crawl method and per-source notes (a couple of
// Zendesk help centers serve 403 to non-browser clients; their content was verified through
// the same host's public help-center JSON API).
//
// This is DOCUMENTATION, deliberately not a score: no judged number reads this file, and no
// "geo score" is derived from it. Display-only — the compact "Geos supported" line on product
// pages (components/WhereItWorks.tsx), rendered only when rows exist. Missing file = no lines
// anywhere (honest degrade, never an error).

export const VENDOR_GEO_COUNTRIES = ['US', 'UK', 'IN', 'DE', 'FR'] as const
export type VendorGeoCountry = (typeof VENDOR_GEO_COUNTRIES)[number]

export const VENDOR_GEO_COUNTRY_META: Record<VendorGeoCountry, { label: string; flag: string }> = {
  US: { label: 'United States', flag: '🇺🇸' },
  UK: { label: 'United Kingdom', flag: '🇬🇧' },
  IN: { label: 'India', flag: '🇮🇳' },
  DE: { label: 'Germany', flag: '🇩🇪' },
  FR: { label: 'France', flag: '🇫🇷' },
}

export const VENDOR_GEO_STATUS_META: Record<VendorGeoStatus, { glyph: string; label: string }> = {
  available: { glyph: '✓', label: 'available' },
  partial: { glyph: '◐', label: 'partial' },
  unavailable: { glyph: '✕', label: 'not available' },
}

export const VendorGeoEntrySchema = z.object({
  productId: z.string().min(1),
  // The arena the spike judged this vendor in — integrity-tested (the product must really
  // exist there); rendering keys off productId alone so multi-arena products carry their line
  // on every product page.
  arenaId: z.string().min(1),
  country: z.enum(VENDOR_GEO_COUNTRIES),
  status: z.enum(['available', 'unavailable', 'partial']),
  // The vendor's own page this row rests on — verified reachable before listing.
  sourceUrl: z.string().url(),
  note: z.string().min(1),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkedAt must be YYYY-MM-DD'),
})

export type VendorGeoEntry = z.infer<typeof VendorGeoEntrySchema>
export type VendorGeoStatus = VendorGeoEntry['status']

const DEFAULT_DIR = () => path.join(process.cwd(), 'data')

const cache = new Map<string, VendorGeoEntry[]>()

// Stage 2 of the corpus lift (docs/FOUNDER-OPS.md): the geo evidence moved out of data/ into
// jurisdictions/. `dir` stays the arena-data dir (same convention as lib/processes.ts); the
// evidence file resolves as a sibling of it, so every call site keeps working unchanged.
const geoFile = (dir: string) => path.join(dir, '..', 'jurisdictions', 'vendor-geo.json')

export function loadVendorGeo(dir: string = DEFAULT_DIR()): VendorGeoEntry[] {
  const hit = cache.get(dir)
  if (hit) return hit
  const file = geoFile(dir)
  const entries = fs.existsSync(file)
    ? VendorGeoEntrySchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    : []
  cache.set(dir, entries)
  return entries
}

const countryRank = (c: VendorGeoCountry) => (VENDOR_GEO_COUNTRIES as readonly string[]).indexOf(c)

// Every judged country row for one product, in canonical US→UK→IN→DE→FR order — [] for the
// many products the spike hasn't covered (the component renders nothing for them).
export function vendorGeoFor(productId: string, dir?: string): VendorGeoEntry[] {
  return loadVendorGeo(dir)
    .filter((e) => e.productId === productId)
    .sort((a, b) => countryRank(a.country) - countryRank(b.country))
}

// The client-annotation lookup for a page's vendors (founder GEO ask 2026-09-28: annotate the
// process page's vendor chips/leaderboard rows under a non-US selection): non-US cells only —
// the US default never annotates — keyed by productId, restricted to the products actually on
// the page so nothing extra ships to the client. Products without rows are absent, and the
// annotations render nothing for them (evidence-only, never guessed). Still annotation-only:
// no judged score or rank reads this.
export function vendorGeoLookup(productIds: Iterable<string>, dir?: string): VendorGeoLookup {
  const wanted = new Set(productIds)
  const lookup: VendorGeoLookup = {}
  for (const e of loadVendorGeo(dir)) {
    if (e.country === 'US' || !wanted.has(e.productId)) continue
    const byCountry = (lookup[e.productId] ??= {})
    byCountry[e.country] = { status: e.status, note: e.note, sourceUrl: e.sourceUrl }
  }
  return lookup
}
