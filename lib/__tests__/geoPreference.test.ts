import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GEO_COUNTRIES,
  GEO_GLOBAL,
  GEO_NOTE_KINDS,
  GEO_PREF_META,
  GEO_SCOPE_GLYPH,
  getGeoChoice,
  getGeoSelection,
  hiddenInCountryView,
  parseGeo,
  parseGeoChoice,
  serializeGeo,
  serializeGeoChoice,
  setGeoChoice,
  setGeoSelection,
  subscribeGeoSelection,
  usFlagGlyph,
  type GeoNotesByCountry,
} from '@/lib/geoPreference'

// The geo preference's client-safe half (founder GEO ask 2026-09-28): the ?geo=/pa-geo codec —
// tolerant on read, canonical on write, the US default never serialized — and the per-tab store
// every geo-aware component shares.

afterEach(() => setGeoSelection(null))

describe('?geo= codec', () => {
  it('parses tolerantly: case-insensitive, whitespace ignored, every non-US country accepted', () => {
    expect(parseGeo('uk')).toBe('UK')
    expect(parseGeo('UK')).toBe('UK')
    expect(parseGeo(' de ')).toBe('DE')
    expect(parseGeo('in')).toBe('IN')
    expect(parseGeo('fr')).toBe('FR')
    expect(parseGeo('pt')).toBe('PT')
    expect(parseGeo('ca')).toBe('CA')
  })

  it('collapses the default and junk to null — never a crash, never an invalid country', () => {
    // 'us' is the default, not a selection — it never round-trips through URL or storage.
    expect(parseGeo('us')).toBeNull()
    expect(parseGeo(null)).toBeNull()
    expect(parseGeo('')).toBeNull()
    expect(parseGeo('narnia')).toBeNull()
    expect(parseGeo('uk,de')).toBeNull() // single-valued — a list is not a selection
  })

  it('serializes canonically: lowercase country, null for the US default (param deleted)', () => {
    expect(serializeGeo('UK')).toBe('uk')
    expect(serializeGeo('FR')).toBe('fr')
    expect(serializeGeo(null)).toBeNull()
    // Round trip: everything serializable parses back to itself.
    for (const c of ['UK', 'IN', 'DE', 'FR', 'PT', 'CA'] as const) {
      expect(parseGeo(serializeGeo(c))).toBe(c)
    }
  })
})

// The 'global' token (Virtual Startup batch 2026-09-29) — ADDITIVE: parseGeo/serializeGeo above
// are untouched (a stray ?geo=global on a process page still collapses to the null default,
// which is exactly what geo-neutral means there), and only the choice-level codec knows it.
describe('the GeoChoice codec (countries + the explicit 🌐 Global)', () => {
  it('parses every country exactly like parseGeo, plus the global token (case-insensitive)', () => {
    expect(parseGeoChoice('uk')).toBe('UK')
    expect(parseGeoChoice(' de ')).toBe('DE')
    expect(parseGeoChoice('global')).toBe(GEO_GLOBAL)
    expect(parseGeoChoice('GLOBAL')).toBe(GEO_GLOBAL)
    // The default and junk still collapse to null — never an invalid choice in state.
    expect(parseGeoChoice('us')).toBeNull()
    expect(parseGeoChoice(null)).toBeNull()
    expect(parseGeoChoice('narnia')).toBeNull()
  })

  it('serializes canonically and round-trips; the base parseGeo NEVER learns the token', () => {
    expect(serializeGeoChoice(GEO_GLOBAL)).toBe('global')
    expect(serializeGeoChoice('UK')).toBe('uk')
    expect(serializeGeoChoice(null)).toBeNull()
    for (const c of ['UK', 'IN', 'DE', 'FR', 'PT', 'CA', GEO_GLOBAL] as const) {
      expect(parseGeoChoice(serializeGeoChoice(c))).toBe(c)
    }
    // Default byte-identical guarantee for existing consumers: a stored/URL 'global' is the
    // null default to every parseGeo call site (banner, marks, annotations render nothing).
    expect(parseGeo('global')).toBeNull()
  })
})

describe('the shared per-tab store', () => {
  it('starts at the US default, sets, notifies subscribers, and de-dupes identical sets', () => {
    expect(getGeoSelection()).toBeNull()
    const listener = vi.fn()
    const unsubscribe = subscribeGeoSelection(listener)
    setGeoSelection('UK')
    expect(getGeoSelection()).toBe('UK')
    expect(listener).toHaveBeenCalledTimes(1)
    setGeoSelection('UK') // no-op — no notification storm
    expect(listener).toHaveBeenCalledTimes(1)
    setGeoSelection(null)
    expect(getGeoSelection()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    setGeoSelection('DE')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  // The choice level (founder 2026-09-30 global mode): the store carries GLOBAL, but the
  // country view maps it to null — so every country-consumer stays geo-neutral for free.
  it('carries the explicit GLOBAL choice; getGeoSelection maps it to the geo-neutral null', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeGeoSelection(listener)
    setGeoChoice(GEO_GLOBAL)
    expect(getGeoChoice()).toBe(GEO_GLOBAL)
    expect(getGeoSelection()).toBeNull() // never an invented sixth country
    expect(listener).toHaveBeenCalledTimes(1)
    setGeoChoice(GEO_GLOBAL) // de-dupes at the choice level too
    expect(listener).toHaveBeenCalledTimes(1)
    // A country pick (manual wins) replaces the global lens; both views agree.
    setGeoChoice('UK')
    expect(getGeoChoice()).toBe('UK')
    expect(getGeoSelection()).toBe('UK')
    // The country-only setter keeps its exact semantics over the shared state.
    setGeoSelection(null)
    expect(getGeoChoice()).toBeNull()
    unsubscribe()
  })
})

describe('display metadata', () => {
  it('covers all seven countries and all three geo scopes', () => {
    expect(GEO_COUNTRIES).toEqual(['US', 'UK', 'IN', 'DE', 'FR', 'PT', 'CA'])
    for (const c of GEO_COUNTRIES) {
      expect(GEO_PREF_META[c].label).toBeTruthy()
      expect(GEO_PREF_META[c].flag).toBeTruthy()
    }
    for (const s of ['global', 'us', 'us-state'] as const) {
      expect(GEO_SCOPE_GLYPH[s].glyph).toBeTruthy()
      expect(GEO_SCOPE_GLYPH[s].label).toBeTruthy()
    }
  })

  // The title-trailing scope glyph rule (founder batch 2026-10-02): keys STRICTLY on geoScope.
  it('usFlagGlyph: 🇺🇸 for us AND us-state (labels telling them apart); NEVER for global or the shared-catalog null', () => {
    expect(usFlagGlyph('us')?.glyph).toBe('🇺🇸')
    expect(usFlagGlyph('us-state')?.glyph).toBe('🇺🇸')
    expect(usFlagGlyph('us')!.label).not.toBe(usFlagGlyph('us-state')!.label)
    // A geoScope-'global' record can never render the flag (the qs_023 audit).
    expect(usFlagGlyph('global')).toBeNull()
    expect(usFlagGlyph(null)).toBeNull()
  })
})

// The /processes country-view filter rule (founder ask 2026-10-02, tightened by founder
// override 2026-10-05: an explicit country view shows NO US-scoped row — 'analog' notes
// included; the hidden-rows disclosure is the analogs' discoverability path). Pure and pinned
// per kind here; the table's integration (row set + disclosure) lives in
// components/__tests__/ProcessesTable.test.tsx.
describe('hiddenInCountryView (the country-view filter rule)', () => {
  const row = (geoScope: 'global' | 'us' | 'us-state' | null, geoNotesByCountry: GeoNotesByCountry = {}) =>
    ({ geoScope, geoNotesByCountry })

  it('global rows never hide — with or without a note slice', () => {
    expect(hiddenInCountryView(row('global'), 'IN')).toBe(false)
    expect(hiddenInCountryView(row('global'), 'DE')).toBe(false)
  })

  it('null-scope rows (shared-catalog previews, no geo dimension yet) never hide', () => {
    expect(hiddenInCountryView(row(null), 'UK')).toBe(false)
    expect(hiddenInCountryView(row(null), 'IN')).toBe(false)
  })

  it("US-scoped rows hide even on an 'analog' note — the 2026-10-05 override of the 2026-10-02 rule", () => {
    const analog = { kind: 'analog' as const, summary: 'Register with Companies House.' }
    expect(hiddenInCountryView(row('us', { UK: analog }), 'UK')).toBe(true)
    expect(hiddenInCountryView(row('us-state', { UK: analog }), 'UK')).toBe(true)
    // And, as before, under a country the notes don't cover.
    expect(hiddenInCountryView(row('us', { UK: analog }), 'IN')).toBe(true)
  })

  it("'absorbed' and 'not-applicable' notes hide the row — the EIN-under-India semantics", () => {
    const absorbed = { kind: 'absorbed' as const, summary: 'PAN/TAN arrive with the SPICe+ filing.' }
    const na = { kind: 'not-applicable' as const, summary: 'No 1099 regime.' }
    expect(hiddenInCountryView(row('us', { IN: absorbed }), 'IN')).toBe(true)
    expect(hiddenInCountryView(row('us', { UK: na }), 'UK')).toBe(true)
  })

  it('a US-scoped row with no notes at all hides under every country view', () => {
    for (const c of ['IN', 'UK', 'DE', 'FR', 'PT', 'CA'] as const) {
      expect(hiddenInCountryView(row('us'), c)).toBe(true)
      expect(hiddenInCountryView(row('us-state'), c)).toBe(true)
    }
  })

  it('exposes the three curated kinds, totality-checked against the schema enum', () => {
    expect(GEO_NOTE_KINDS).toEqual(['analog', 'absorbed', 'not-applicable'])
  })
})
