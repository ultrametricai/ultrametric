import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import {
  loadVendorGeo, VENDOR_GEO_COUNTRIES, VENDOR_GEO_COUNTRY_META, VENDOR_GEO_STATUS_META,
  vendorGeoFor, vendorGeoLookup,
} from '@/lib/vendorGeo'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

// The vendor-geo spike (founder 2026-09-28): region-availability EVIDENCE for the top vendors
// of the geo-sensitive arenas, committed at jurisdictions/vendor-geo.json since stage 2 of the
// corpus lift (loadVendorGeo resolves it as a sibling of the arena-data dir). These tests pin
// the integrity rules — real products, one row per (product, country), sources on every row —
// and the headline findings, so a silent data edit that flips a judged negative (Mercury
// banking a UK entity?) fails loudly.

describe('vendor-geo corpus', () => {
  const entries = loadVendorGeo(DATA_DIR)

  it('loads, is non-trivial, and every row is fully sourced', () => {
    expect(entries.length).toBeGreaterThanOrEqual(80)
    for (const e of entries) {
      expect(e.sourceUrl).toMatch(/^https:\/\//)
      expect(e.note.length, `${e.productId}/${e.country} note`).toBeGreaterThan(15)
    }
  })

  it('every (arenaId, productId) resolves to a real judged product in that arena', () => {
    const seen = new Map<string, Set<string>>()
    for (const e of entries) {
      let ids = seen.get(e.arenaId)
      if (!ids) {
        ids = new Set(loadCategory(e.arenaId, DATA_DIR).products.map((p) => p.id))
        seen.set(e.arenaId, ids)
      }
      expect(ids.has(e.productId), `${e.productId} must exist in ${e.arenaId}`).toBe(true)
    }
    // The founder's six geo-sensitive arenas are all represented.
    for (const arena of ['startup-banking', 'payroll', 'legal-ops', 'tax-automation', 'payments', 'accounting']) {
      expect([...seen.keys()], `spike covers ${arena}`).toContain(arena)
    }
  })

  it('one row per (product, country); a product never spans two arenas here', () => {
    const pairs = new Set<string>()
    const arenaOf = new Map<string, string>()
    for (const e of entries) {
      const key = `${e.productId}/${e.country}`
      expect(pairs.has(key), `duplicate ${key}`).toBe(false)
      pairs.add(key)
      const prev = arenaOf.get(e.productId)
      if (prev) expect(prev, `${e.productId} arena consistency`).toBe(e.arenaId)
      arenaOf.set(e.productId, e.arenaId)
    }
  })

  it('records honest negatives and partials, not just availability marketing', () => {
    const byStatus = (s: string) => entries.filter((e) => e.status === s).length
    expect(byStatus('unavailable')).toBeGreaterThanOrEqual(10)
    expect(byStatus('partial')).toBeGreaterThanOrEqual(5)
    expect(byStatus('available')).toBeGreaterThan(0)
  })

  it('pins the headline findings: US-locked vendors stay locked, global vendors stay global', () => {
    const status = (pid: string, c: (typeof VENDOR_GEO_COUNTRIES)[number]) =>
      entries.find((e) => e.productId === pid && e.country === c)?.status
    // US-entity-only: the banking stack and Gusto payroll.
    for (const pid of ['mercury', 'brex', 'ramp', 'relay', 'gusto', 'clerky', 'taxjar']) {
      expect(status(pid, 'US'), `${pid} US`).toBe('available')
      for (const c of ['UK', 'IN', 'DE', 'FR'] as const) {
        expect(status(pid, c), `${pid} ${c} is a judged negative`).toBe('unavailable')
      }
    }
    // Genuinely global: Deel and Rippling payroll run in all four spike countries.
    for (const pid of ['deel', 'rippling']) {
      for (const c of VENDOR_GEO_COUNTRIES) expect(status(pid, c), `${pid} ${c}`).toBe('available')
    }
    // The sharp per-country splits the spike surfaced.
    expect(status('square', 'UK')).toBe('available')
    expect(status('square', 'FR')).toBe('available')
    expect(status('square', 'DE')).toBe('unavailable')
    expect(status('square', 'IN')).toBe('unavailable')
    expect(status('stripe', 'IN')).toBe('partial') // "Preview" on stripe.com/global
    expect(status('stripe-tax', 'IN')).toBe('partial') // beta-flagged in the docs data
    expect(status('airwallex', 'IN')).toBe('unavailable')
    expect(status('zoho-books', 'IN')).toBe('available') // the dedicated GST edition
    expect(status('beglaubigt', 'DE')).toBe('available') // the reverse-locked case
    expect(status('beglaubigt', 'US')).toBe('unavailable')
  })

  it('pins the LatAm wave findings (2026-10-23): US-locked stays locked, local players carry their home countries', () => {
    const status = (pid: string, c: (typeof VENDOR_GEO_COUNTRIES)[number]) =>
      entries.find((e) => e.productId === pid && e.country === c)?.status
    const LATAM = ['BR', 'MX', 'AR', 'CO', 'CL', 'PE'] as const
    // The US-entity-locked banking stack and Gusto payroll stay locked across all six.
    for (const pid of ['mercury', 'brex', 'ramp', 'relay', 'gusto']) {
      for (const c of LATAM) expect(status(pid, c), `${pid} ${c} is a judged negative`).toBe('unavailable')
    }
    // Square and Mollie enumerate their supported countries; none are in LatAm.
    for (const pid of ['square', 'mollie']) {
      for (const c of LATAM) expect(status(pid, c), `${pid} ${c}`).toBe('unavailable')
    }
    // The sharp splits the wave surfaced.
    expect(status('stripe', 'BR')).toBe('available')
    expect(status('stripe', 'MX')).toBe('available')
    expect(status('stripe', 'AR')).toBe('unavailable')
    expect(status('airwallex', 'BR')).toBe('available') // onboarded to the US Airwallex entity
    expect(status('airwallex', 'AR')).toBe('unavailable')
    expect(status('justworks', 'AR')).toBe('partial') // contractors only; no Argentina EOR
    expect(status('justworks', 'BR')).toBe('available')
    expect(status('quickbooks', 'BR')).toBe('unavailable') // Intuit's own withdrawal notice
    expect(status('quickbooks', 'MX')).toBe('available')
    expect(status('polar', 'BR')).toBe('unavailable')
    expect(status('polar', 'MX')).toBe('available')
    // The LatAm-native entrants carry their home markets.
    for (const c of ['BR', 'MX', 'CO'] as const) expect(status('jeeves', c), `jeeves ${c}`).toBe('available')
    expect(status('belvo', 'BR')).toBe('available')
    expect(status('belvo', 'MX')).toBe('available')
    expect(status('belvo', 'CO')).toBe('unavailable')
    expect(status('stark-bank', 'BR')).toBe('available')
    expect(status('stark-bank', 'MX')).toBe('unavailable') // Brazil-only by design
  })
})

describe('vendorGeoFor', () => {
  it('returns rows in canonical US→UK→IN→DE→FR→LatAm order and [] for unspiked products', () => {
    const rows = vendorGeoFor('mercury', DATA_DIR)
    expect(rows.map((r) => r.country)).toEqual(['US', 'UK', 'IN', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'])
    expect(vendorGeoFor('linear', DATA_DIR)).toEqual([])
    expect(vendorGeoFor('does-not-exist', DATA_DIR)).toEqual([])
  })

  it('scopes rows to the arena they were judged in when arenaId is given', () => {
    // gusto's committed rows were judged against the payroll offering; the cross-rostered
    // legal-ops/startup-banking entries must not inherit that reasoning (PR #449 review).
    expect(vendorGeoFor('gusto', DATA_DIR, 'payroll').length).toBeGreaterThan(0)
    expect(vendorGeoFor('gusto', DATA_DIR, 'legal-ops')).toEqual([])
    expect(vendorGeoFor('mercury', DATA_DIR, 'startup-banking').map((r) => r.country)).toEqual(['US', 'UK', 'IN', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'])
  })

  it('missing file degrades to no rows, never an error', () => {
    expect(loadVendorGeo(path.resolve(__dirname))).toEqual([])
  })

  it('display metadata covers every country and status', () => {
    for (const c of VENDOR_GEO_COUNTRIES) {
      expect(VENDOR_GEO_COUNTRY_META[c].label).toBeTruthy()
      expect(VENDOR_GEO_COUNTRY_META[c].flag).toBeTruthy()
    }
    for (const s of ['available', 'partial', 'unavailable'] as const) {
      expect(VENDOR_GEO_STATUS_META[s].glyph).toBeTruthy()
      expect(VENDOR_GEO_STATUS_META[s].label).toBeTruthy()
    }
  })
})

// The client-annotation lookup (founder GEO ask 2026-09-28: annotate vendor chips/leaderboard
// rows under a non-US selection) — evidence-only and page-scoped, never guessed.
describe('vendorGeoLookup', () => {
  it('keys by productId, restricted to the requested products, non-US cells only', () => {
    const lookup = vendorGeoLookup(['mercury', 'linear', 'does-not-exist'], DATA_DIR)
    expect(Object.keys(lookup)).toEqual(['mercury'])
    const mercury = lookup.mercury
    // US never ships to the client — the default view annotates nothing.
    expect(Object.keys(mercury)).not.toContain('US')
    // Brazil can now be selected; its previously judged negative is exposed unchanged.
    expect(mercury.BR?.status).toBe('unavailable')
    // Mexico remains outside the process country selector.
    expect(Object.keys(mercury)).not.toContain('MX')
    // The pinned negative: Mercury really does NOT bank a UK entity.
    expect(mercury.UK?.status).toBe('unavailable')
    expect(mercury.UK?.note).toMatch(/United States|US/)
    expect(mercury.UK?.sourceUrl).toMatch(/^https:\/\//)
  })

  it('unspiked products are simply absent — annotations never invent a row', () => {
    expect(vendorGeoLookup(['linear'], DATA_DIR)).toEqual({})
    expect(vendorGeoLookup([], DATA_DIR)).toEqual({})
  })
})
