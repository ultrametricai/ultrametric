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
// the integrity rules — real products, one row per (arena, product, country), sources on every
// row — and the headline findings, so a silent data edit that flips a judged negative (Mercury
// banking a UK entity?) fails loudly. A row is judged against ONE arena's offering; since the
// 2026-10-27 cross-arena pass (the per-arena geo re-earn PR #449's review called for) a product
// can carry rows in more than one arena, so every pinned finding names the arena it pins.

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

  it('one row per (arena, product, country); cross-arena duplicates carry distinct checkedAt dates', () => {
    const triples = new Set<string>()
    const datesByPair = new Map<string, Set<string>>()
    for (const e of entries) {
      const key = `${e.arenaId}/${e.productId}/${e.country}`
      expect(triples.has(key), `duplicate ${key}`).toBe(false)
      triples.add(key)
      const pair = `${e.productId}/${e.country}`
      const dates = datesByPair.get(pair) ?? new Set<string>()
      // The unscoped display reads (vendorGeoFor without arenaId, vendorGeoLookup) pick the
      // freshest row per (product, country); two arenas sharing a checkedAt would leave that
      // pick to file order, so cross-arena re-earns must carry their own check date.
      expect(dates.has(e.checkedAt), `${pair} re-checked on ${e.checkedAt} in two arenas`).toBe(false)
      dates.add(e.checkedAt)
      datesByPair.set(pair, dates)
    }
  })

  it('records honest negatives and partials, not just availability marketing', () => {
    const byStatus = (s: string) => entries.filter((e) => e.status === s).length
    expect(byStatus('unavailable')).toBeGreaterThanOrEqual(10)
    expect(byStatus('partial')).toBeGreaterThanOrEqual(5)
    expect(byStatus('available')).toBeGreaterThan(0)
  })

  // Pinned-finding helper: the arena names which offering's judgment the pin protects.
  const status = (pid: string, c: (typeof VENDOR_GEO_COUNTRIES)[number], arena: string) =>
    entries.find((e) => e.productId === pid && e.country === c && e.arenaId === arena)?.status

  // The original six-arena spike judged each of these vendors in one arena.
  const SPIKE_ARENA: Record<string, string> = {
    mercury: 'startup-banking', brex: 'startup-banking', ramp: 'startup-banking',
    relay: 'startup-banking', jeeves: 'startup-banking', airwallex: 'startup-banking',
    gusto: 'payroll', deel: 'payroll', rippling: 'payroll', justworks: 'payroll',
    clerky: 'legal-ops', beglaubigt: 'legal-ops',
    taxjar: 'tax-automation', 'stripe-tax': 'tax-automation',
    square: 'payments', stripe: 'payments', mollie: 'payments', polar: 'payments',
    'zoho-books': 'accounting', quickbooks: 'accounting',
    belvo: 'banking-data-apis', 'stark-bank': 'banking-as-a-service',
  }
  const spikeStatus = (pid: string, c: (typeof VENDOR_GEO_COUNTRIES)[number]) =>
    status(pid, c, SPIKE_ARENA[pid])

  it('pins the headline findings: US-locked vendors stay locked, global vendors stay global', () => {
    // US-entity-only: the banking stack and Gusto payroll.
    for (const pid of ['mercury', 'brex', 'ramp', 'relay', 'gusto', 'clerky', 'taxjar']) {
      expect(spikeStatus(pid, 'US'), `${pid} US`).toBe('available')
      for (const c of ['UK', 'IN', 'DE', 'FR'] as const) {
        expect(spikeStatus(pid, c), `${pid} ${c} is a judged negative`).toBe('unavailable')
      }
    }
    // Genuinely global: Deel and Rippling payroll run in all four spike countries.
    for (const pid of ['deel', 'rippling']) {
      for (const c of VENDOR_GEO_COUNTRIES) expect(spikeStatus(pid, c), `${pid} ${c}`).toBe('available')
    }
    // The sharp per-country splits the spike surfaced.
    expect(spikeStatus('square', 'UK')).toBe('available')
    expect(spikeStatus('square', 'FR')).toBe('available')
    expect(spikeStatus('square', 'DE')).toBe('unavailable')
    expect(spikeStatus('square', 'IN')).toBe('unavailable')
    expect(spikeStatus('stripe', 'IN')).toBe('partial') // "Preview" on stripe.com/global
    expect(spikeStatus('stripe-tax', 'IN')).toBe('partial') // beta-flagged in the docs data
    // As checked 2026-09-28; the 2026-10-27 payments-arena re-check found India newly on the
    // eligible-countries list (pinned below), so this startup-banking row awaits its own
    // refresh pass.
    expect(spikeStatus('airwallex', 'IN')).toBe('unavailable')
    expect(spikeStatus('zoho-books', 'IN')).toBe('available') // the dedicated GST edition
    expect(spikeStatus('beglaubigt', 'DE')).toBe('available') // the reverse-locked case
    expect(spikeStatus('beglaubigt', 'US')).toBe('unavailable')
  })

  it('pins the LatAm wave findings (2026-10-23): US-locked stays locked, local players carry their home countries', () => {
    const LATAM = ['BR', 'MX', 'AR', 'CO', 'CL', 'PE'] as const
    // The US-entity-locked banking stack and Gusto payroll stay locked across all six.
    for (const pid of ['mercury', 'brex', 'ramp', 'relay', 'gusto']) {
      for (const c of LATAM) expect(spikeStatus(pid, c), `${pid} ${c} is a judged negative`).toBe('unavailable')
    }
    // Square and Mollie enumerate their supported countries; none are in LatAm.
    for (const pid of ['square', 'mollie']) {
      for (const c of LATAM) expect(spikeStatus(pid, c), `${pid} ${c}`).toBe('unavailable')
    }
    // The sharp splits the wave surfaced.
    expect(spikeStatus('stripe', 'BR')).toBe('available')
    expect(spikeStatus('stripe', 'MX')).toBe('available')
    expect(spikeStatus('stripe', 'AR')).toBe('unavailable')
    expect(spikeStatus('airwallex', 'BR')).toBe('available') // onboarded to the US Airwallex entity
    expect(spikeStatus('airwallex', 'AR')).toBe('unavailable')
    expect(spikeStatus('justworks', 'AR')).toBe('partial') // contractors only; no Argentina EOR
    expect(spikeStatus('justworks', 'BR')).toBe('available')
    expect(spikeStatus('quickbooks', 'BR')).toBe('unavailable') // Intuit's own withdrawal notice
    expect(spikeStatus('quickbooks', 'MX')).toBe('available')
    expect(spikeStatus('polar', 'BR')).toBe('unavailable')
    expect(spikeStatus('polar', 'MX')).toBe('available')
    // The LatAm-native entrants carry their home markets.
    for (const c of ['BR', 'MX', 'CO'] as const) expect(spikeStatus('jeeves', c), `jeeves ${c}`).toBe('available')
    expect(spikeStatus('belvo', 'BR')).toBe('available')
    expect(spikeStatus('belvo', 'MX')).toBe('available')
    expect(spikeStatus('belvo', 'CO')).toBe('unavailable')
    expect(spikeStatus('stark-bank', 'BR')).toBe('available')
    expect(spikeStatus('stark-bank', 'MX')).toBe('unavailable') // Brazil-only by design
  })

  it('pins the cross-arena re-earn findings (2026-10-27): the four PR #449 drops are re-judged in their own arenas', () => {
    const ALL = VENDOR_GEO_COUNTRIES
    // brex and ramp expense management is as US-entity-locked as their banking offerings.
    for (const pid of ['brex', 'ramp']) {
      expect(status(pid, 'US', 'expense-management'), `${pid} US`).toBe('available')
      for (const c of ALL.filter((x) => x !== 'US')) {
        expect(status(pid, c, 'expense-management'), `${pid} ${c} is a judged negative`).toBe('unavailable')
      }
    }
    // Square in-person acceptance carries the same eight-country gate as its payments arena.
    for (const c of ['US', 'UK', 'FR'] as const) {
      expect(status('square', c, 'mobile-payments'), `square ${c}`).toBe('available')
    }
    for (const c of ['IN', 'DE', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'] as const) {
      expect(status('square', c, 'mobile-payments'), `square ${c} is a judged negative`).toBe('unavailable')
    }
    // Airwallex payments: per-location product table for the local-entity locations; the
    // eligible-countries list now includes India (via the SINGAPORE entity, a change since the
    // 2026-09-28 startup-banking check), with product coverage undocumented — honest partial.
    for (const c of ['US', 'UK', 'DE', 'FR'] as const) {
      expect(status('airwallex', c, 'payments'), `airwallex ${c}`).toBe('available')
    }
    for (const c of ['IN', 'BR', 'MX'] as const) {
      expect(status('airwallex', c, 'payments'), `airwallex ${c} is onboarding-eligible only`).toBe('partial')
    }
    for (const c of ['AR', 'CO', 'CL', 'PE'] as const) {
      expect(status('airwallex', c, 'payments'), `airwallex ${c} is a judged negative`).toBe('unavailable')
    }
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
    // The 2026-10-27 cross-arena pass re-earned the four rows PR #449's scoping dropped.
    for (const [pid, arena] of [
      ['brex', 'expense-management'], ['ramp', 'expense-management'],
      ['square', 'mobile-payments'], ['airwallex', 'payments'],
    ] as const) {
      expect(vendorGeoFor(pid, DATA_DIR, arena), `${pid} in ${arena}`).toHaveLength(11)
    }
  })

  it('the unscoped read collapses a cross-arena product to its freshest row per country', () => {
    const rows = vendorGeoFor('brex', DATA_DIR)
    expect(rows.map((r) => r.country)).toEqual(['US', 'UK', 'IN', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'])
    // Both arenas carry brex rows; the strip shows the 2026-10-27 expense-management re-check.
    for (const r of rows) expect(r.arenaId, `brex ${r.country}`).toBe('expense-management')
    // Arena-scoped reads still see the startup-banking rows untouched.
    expect(vendorGeoFor('brex', DATA_DIR, 'startup-banking')).toHaveLength(11)
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
    // Vendor-geo-only countries (the LatAm wave) never ship either: no ?geo= selection can
    // carry them, so their cells would be unreadable client bytes.
    expect(Object.keys(mercury)).not.toContain('BR')
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

  it('a cross-arena product annotates with its freshest row per country', () => {
    const lookup = vendorGeoLookup(['airwallex'], DATA_DIR)
    // India: the 2026-09-28 startup-banking row said unavailable; the 2026-10-27 payments
    // re-check found it on the eligible-countries list with product coverage undocumented.
    expect(lookup.airwallex?.IN?.status).toBe('partial')
    expect(lookup.airwallex?.IN?.note).toMatch(/eligible-countries list/)
  })
})
