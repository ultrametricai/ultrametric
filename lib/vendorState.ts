import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// Vendor US-state availability EVIDENCE (per-state vendors workstream, 2026-10-22): the
// state-level sibling of jurisdictions/vendor-geo.json. One row per (product, state, service)
// for the vendors of the state-sensitive arenas — legal-ops (registered agents, formation),
// payroll, tax-automation — each grounded in the vendor's OWN state page or availability
// table, verified reachable before listing, negatives recorded (Stripe Atlas really forms
// Delaware entities only). `state` is an ISO 3166-2 code that must resolve in
// jurisdictions/registry.json (corpus-tested in lib/__tests__/vendorState.test.ts); unknown
// coverage means no row, so nothing renders for it.
//
// This is DOCUMENTATION, deliberately not a score: no judged number reads this file, and no
// "state score" is derived from it. Display/annotation only — per-state vendor annotations on
// process and product surfaces, rendered only when rows exist. Missing file = no rows
// anywhere (honest degrade, never an error).

export const VENDOR_STATE_SERVICES = [
  'registered-agent',
  'formation',
  'foreign-qualification',
  'annual-report-filing',
  'payroll-tax-registration',
  'sales-tax-registration',
] as const
export type VendorStateService = (typeof VENDOR_STATE_SERVICES)[number]

// US state codes only for now — the registry test (not this regex) is what ties each code to a
// committed jurisdictions/registry.json entry, so a new state needs its registry row first.
const STATE_CODE = /^US-[A-Z]{2}$/

export const VendorStatePriceSchema = z.object({
  usd: z.number().nonnegative(),
  per: z.enum(['one-time', 'month', 'year']),
  // The date the vendor's own pricing page showed this number.
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'asOf must be YYYY-MM-DD'),
})

export const VendorStateEntrySchema = z.object({
  productId: z.string().min(1),
  // The arena the product is judged in — integrity-tested (the product must really exist
  // there); rendering keys off productId alone, matching lib/vendorGeo.ts.
  arenaId: z.string().min(1),
  // ISO 3166-2 US state code, e.g. "US-DE"; must resolve in jurisdictions/registry.json.
  state: z.string().regex(STATE_CODE, 'state must be an ISO 3166-2 US code like "US-DE"'),
  service: z.enum(VENDOR_STATE_SERVICES),
  status: z.enum(['available', 'unavailable', 'partial']),
  // Optional, and only ever taken from the vendor's own pricing page.
  price: VendorStatePriceSchema.optional(),
  // The vendor's own state page or availability table this row rests on — verified reachable
  // before listing.
  sourceUrl: z.string().url(),
  // What the source says, quoted or closely paraphrased.
  note: z.string().min(1),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkedAt must be YYYY-MM-DD'),
})

export type VendorStateEntry = z.infer<typeof VendorStateEntrySchema>
export type VendorStateStatus = VendorStateEntry['status']

/** One client-safe availability cell for a (product, state, service). */
export interface VendorStateCell {
  status: VendorStateStatus
  note: string
  sourceUrl: string
  price?: z.infer<typeof VendorStatePriceSchema>
}

/** productId -> service -> cell, for the one state a page is looking at. */
export type VendorStateLookup = Record<string, Partial<Record<VendorStateService, VendorStateCell>>>

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

const cache = new Map<string, VendorStateEntry[]>()

// `dir` is the arena-data directory; jurisdiction evidence resolves from its sibling
// (the lib/vendorGeo.ts convention).
const stateFile = (dir: string) => path.join(dir, '..', 'jurisdictions', 'vendor-state.json')

export function loadVendorState(dir: string = DEFAULT_DIR()): VendorStateEntry[] {
  const hit = cache.get(dir)
  if (hit) return hit
  const file = stateFile(dir)
  const entries = fs.existsSync(file)
    ? VendorStateEntrySchema.array().parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    : []
  cache.set(dir, entries)
  return entries
}

const serviceRank = (s: VendorStateService) =>
  (VENDOR_STATE_SERVICES as readonly string[]).indexOf(s)

// Every judged state row for one product, ordered by state code then canonical service order —
// [] for the many products no row covers (callers render nothing for them).
export function vendorStateFor(productId: string, dir?: string): VendorStateEntry[] {
  return loadVendorState(dir)
    .filter((e) => e.productId === productId)
    .sort((a, b) => a.state.localeCompare(b.state) || serviceRank(a.service) - serviceRank(b.service))
}

// The client-annotation lookup for a page's vendors under one state selection, mirroring
// lib/vendorGeo.ts vendorGeoLookup: keyed by productId, restricted to the products actually on
// the page so nothing extra ships to the client. Products without rows for the state are
// absent, and the annotations render nothing for them (evidence-only, never guessed). Still
// annotation-only: no judged score or rank reads this.
export function vendorStateLookup(
  productIds: Iterable<string>,
  state: string,
  dir?: string,
): VendorStateLookup {
  const wanted = new Set(productIds)
  const lookup: VendorStateLookup = {}
  for (const e of loadVendorState(dir)) {
    if (e.state !== state || !wanted.has(e.productId)) continue
    const byService = (lookup[e.productId] ??= {})
    byService[e.service] = {
      status: e.status,
      note: e.note,
      sourceUrl: e.sourceUrl,
      ...(e.price ? { price: e.price } : {}),
    }
  }
  return lookup
}
