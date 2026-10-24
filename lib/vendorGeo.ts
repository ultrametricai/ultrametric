import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { GEO_COUNTRIES, type GeoSelection, type VendorGeoLookup } from './geoPreference'

// Vendor region-availability EVIDENCE (founder GEO ask 2026-09-28: "do spikes into India, UK,
// European countries … whether the vendors are tuned for those regions or work globally").
// jurisdictions/vendor-geo.json holds one row per (product, country) for the top vendors of the most
// geo-sensitive arenas — startup-banking, payroll, legal-ops, tax-automation, payments,
// accounting — each grounded in the vendor's OWN pages (help center, docs, availability
// tables), crawl-verified live, honest negatives recorded (Mercury/Brex/Ramp/Gusto really are
// US-entity-only; Square really has no Germany or India). See
// rankings-engine/scripts/build-vendor-geo.py for the crawl method and per-source notes (a couple of
// Zendesk help centers serve 403 to non-browser clients; their content was verified through
// the same host's public help-center JSON API).
//
// This is DOCUMENTATION, deliberately not a score: no judged number reads this file, and no
// "geo score" is derived from it. Display-only — the compact "Geos supported" line on product
// pages (components/WhereItWorks.tsx), rendered only when rows exist. Missing file = no lines
// anywhere (honest degrade, never an error).

// The LatAm countries (BR…PE) joined in the 2026-10-23 LatAm vendor-geo wave (maintainer ask:
// map vendor availability for Latin American geographies). They are vendor-geo-only countries:
// rows exist and render on product pages, but the geo switcher (lib/geoPreference.ts
// GEO_COUNTRIES) does not offer them, because no process geo notes cover them yet — so
// vendorGeoLookup below ships switcher countries only.
export const VENDOR_GEO_COUNTRIES = ['US', 'UK', 'IN', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'] as const
export type VendorGeoCountry = (typeof VENDOR_GEO_COUNTRIES)[number]

export const VENDOR_GEO_COUNTRY_META: Record<VendorGeoCountry, { label: string; flag: string }> = {
  US: { label: 'United States', flag: '🇺🇸' },
  UK: { label: 'United Kingdom', flag: '🇬🇧' },
  IN: { label: 'India', flag: '🇮🇳' },
  DE: { label: 'Germany', flag: '🇩🇪' },
  FR: { label: 'France', flag: '🇫🇷' },
  BR: { label: 'Brazil', flag: '🇧🇷' },
  MX: { label: 'Mexico', flag: '🇲🇽' },
  AR: { label: 'Argentina', flag: '🇦🇷' },
  CO: { label: 'Colombia', flag: '🇨🇴' },
  CL: { label: 'Chile', flag: '🇨🇱' },
  PE: { label: 'Peru', flag: '🇵🇪' },
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

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

const cache = new Map<string, VendorGeoEntry[]>()

// `dir` is the arena-data directory; jurisdiction evidence resolves from its sibling.
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
// many products the spike hasn't covered (the component renders nothing for them). Rows are
// judged against ONE arena's offering (the row's arenaId); pass `arenaId` to scope the result
// to rows judged for that arena, so a cross-rostered product (gusto in payroll AND legal-ops)
// never inherits another offering's availability reasoning.
export function vendorGeoFor(productId: string, dir?: string, arenaId?: string): VendorGeoEntry[] {
  return loadVendorGeo(dir)
    .filter((e) => e.productId === productId && (!arenaId || e.arenaId === arenaId))
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
    // Only switcher countries annotate: a selection can only ever BE one of GEO_COUNTRIES, so
    // vendor-geo-only countries (the LatAm set) would ship bytes no component can read.
    if (!isGeoSelection(e.country)) continue
    const byCountry = (lookup[e.productId] ??= {})
    byCountry[e.country] = { status: e.status, note: e.note, sourceUrl: e.sourceUrl }
  }
  return lookup
}

function isGeoSelection(country: VendorGeoCountry): country is VendorGeoCountry & GeoSelection {
  return country !== 'US' && (GEO_COUNTRIES as readonly string[]).includes(country)
}
