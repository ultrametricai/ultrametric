// The reader's country preference (founder GEO ask 2026-09-28: "make GEO a top-level process
// driver at the top of a particular process page or a vendor, so we know how it works across
// the globe"). One preference, one country list — the original five are the set the vendor-geo
// spike judged (lib/vendorGeo.ts); the process geo notes (lib/processes.ts GeoNoteSchema) cover
// every listed country, PT and CA included (founder new-countries wave 2026-10-03). Vendor geo
// stays evidence-gated per country: products the spike has not judged are absent, never guessed.
//
// This module is the CLIENT-SAFE half (no node:fs — the lib/jurisdictions.ts split convention):
// the country list, labels/flags, the ?geo= URL/localStorage codec, and a tiny per-tab store so
// every geo-aware component on a page (the switcher, the process banner, step markers, vendor
// annotations) shares ONE selection without a context provider re-plumbing the server pages.
//
// URL/localStorage contract (lib/urlState.ts conventions, the JurisdictionToggle precedent):
// the default — 🇺🇸 US — NEVER appears in the URL; ?geo=uk / ?geo=in / ?geo=de / ?geo=fr /
// ?geo=pt / ?geo=ca is the shareable non-default state, mirrored to localStorage under `pa-geo`. Components read it on
// MOUNT ONLY, so the static HTML always renders the US default byte-identically and hydrates
// with zero mismatches — geo-conditional UI appears only after the reader (or their stored
// preference) opts in, and no judged number ever moves.

export const GEO_COUNTRIES = ['US', 'UK', 'IN', 'DE', 'FR', 'PT', 'CA'] as const
export type GeoCountry = (typeof GEO_COUNTRIES)[number]

/** The non-default selections — everything a ?geo= param can carry. */
export type GeoSelection = Exclude<GeoCountry, 'US'>

// `prose` is the in-sentence form ("the same steps apply in the United Kingdom") — the bare
// label reads wrong inside prose for the two "the" countries.
export const GEO_PREF_META: Record<GeoCountry, { label: string; flag: string; prose: string }> = {
  US: { label: 'United States', flag: '🇺🇸', prose: 'the United States' },
  UK: { label: 'United Kingdom', flag: '🇬🇧', prose: 'the United Kingdom' },
  IN: { label: 'India', flag: '🇮🇳', prose: 'India' },
  DE: { label: 'Germany', flag: '🇩🇪', prose: 'Germany' },
  FR: { label: 'France', flag: '🇫🇷', prose: 'France' },
  PT: { label: 'Portugal', flag: '🇵🇹', prose: 'Portugal' },
  CA: { label: 'Canada', flag: '🇨🇦', prose: 'Canada' },
}

export const GEO_PARAM = 'geo'
export const GEO_STORAGE_KEY = 'pa-geo'

// ---------------------------------------------------------------------------------------------
// The explicit geo-neutral choice (founder Virtual-Startup batch 2026-09-29: the in-sim Geo row
// offers 🌐 Global alongside the five countries). ADDITIVE ONLY: nothing above changes —
// GeoSelection, parseGeo, serializeGeo and every existing consumer keep their exact semantics,
// so the default view stays byte-identical everywhere. 'global' is a real ?geo=/pa-geo token
// (shareable, stored), but the SHARED store still only carries countries: a global choice maps
// to the null store state, which is exactly what geo-neutral means to every existing consumer
// (process banner/marks/annotations render nothing) — no invented sixth country anywhere.

export const GEO_GLOBAL = 'GLOBAL' as const
/** A Geo-row choice: a non-default country, or the explicit geo-neutral 'GLOBAL'. */
export type GeoChoice = GeoSelection | typeof GEO_GLOBAL

export const GEO_GLOBAL_META = { label: 'Global', flag: '🌐', prose: 'a geo-neutral view' } as const

// The /processes INDEX default framing (founder 2026-09-30: "default /processes onto a global
// view — you can include the US specific ones in the first view"): with nothing chosen (no
// ?geo=, no pa-geo) the index PRESENTS as 🌐 Global — server-rendered, not a mount flash — while
// the row set stays complete (only a COUNTRY selection filters — hiddenInCountryView below; the
// always-on scope glyphs keep saying which rows are US-specific). DISPLAY FRAMING ONLY: the
// store stays null,
// the param/storage codec is untouched, and an explicit choice (param, stored pref, dropdown)
// wins exactly as before. SEAM (closed, founder batch 2026-10-05): process DETAIL pages render
// the SAME dropdown (components/GeoDropdown.tsx, defaultChoice=GEO_GLOBAL as trigger framing
// only) over the SAME ?geo=/pa-geo preference and per-tab store — pick the UK on a process page
// and the /processes index opens in the UK view, and vice versa (pinned in
// components/__tests__/ProcessGeoSync.test.tsx). Their US-default SSR stays byte-identical:
// the framing prop is server-rendered, the stored choice lands mount-only.
export const PROCESSES_INDEX_DEFAULT_GEO: typeof GEO_GLOBAL = GEO_GLOBAL

/** parseGeo plus the 'global' token — everything else (incl. 'us') behaves exactly as parseGeo. */
export function parseGeoChoice(raw: string | null): GeoChoice | null {
  if (raw && raw.trim().toUpperCase() === GEO_GLOBAL) return GEO_GLOBAL
  return parseGeo(raw)
}

/** serializeGeo plus 'global' — null for the US default (param deleted, storage cleared). */
export function serializeGeoChoice(choice: GeoChoice | null): string | null {
  if (choice === GEO_GLOBAL) return 'global'
  return serializeGeo(choice)
}

// The /processes-index scope glyphs (only visible while a non-US country is selected): every
// corpus process carries a required geoScope (lib/processes.ts) — 🌐 the work is the same
// everywhere, 🇺🇸 written around US federal law/agencies, 🏛 a US state is the counterparty.
export const GEO_SCOPE_GLYPH: Record<'global' | 'us' | 'us-state', { glyph: string; label: string }> = {
  global: { glyph: '🌐', label: 'Global process — the same steps apply everywhere' },
  us: { glyph: '🇺🇸', label: 'US-centric process — written around US federal law and agencies' },
  'us-state': { glyph: '🏛', label: 'US state-level process — a US state is the counterparty' },
}

// The one title-trailing scope glyph (founder batch 2026-10-02): the 🇺🇸 flag, keyed STRICTLY
// on geoScope — 'us' AND 'us-state' wear it (the label still tells federal from state work);
// 'global' (and the shared-catalog null) wears no scope glyph at all. The 🌐 globe and 🏛
// state glyphs no longer follow titles — they read as duplicate icons next to the row's own
// icon ('Set up registered agent 🏛'). A geoScope-'global' record can never render the flag.
export function usFlagGlyph(
  scope: 'global' | 'us' | 'us-state' | null,
): { glyph: string; label: string } | null {
  if (scope !== 'us' && scope !== 'us-state') return null
  return { glyph: GEO_PREF_META.US.flag, label: GEO_SCOPE_GLYPH[scope].label }
}

// What a committed geo note SAYS about the need behind a US-scoped process in its country
// (founder ask 2026-10-02: "changing the country should hide the processes that are not used in
// that country — e.g. an EIN number for India doesn't make sense"). Required on every committed
// note (lib/processes.ts GeoNoteSchema imports this enum), curated from the note's own summary:
//   'analog'         — the need exists there as its own doable process (UK incorporation via
//                      Companies House, India's TDS instead of 1099s).
//   'absorbed'       — the need is handled automatically inside another process there (EIN →
//                      India: PAN/TAN arrive with the SPICe+ incorporation filing; the
//                      registered office is declared at formation everywhere).
//   'not-applicable' — the need genuinely doesn't exist there (the UK has no 1099 regime).
// Since the founder override 2026-10-05 the kinds no longer drive the /processes country-view
// FILTER (every US-scoped row hides — hiddenInCountryView below); they still drive what the
// hidden-rows disclosure and the detail-page banner SAY about each note.
export const GEO_NOTE_KINDS = ['analog', 'absorbed', 'not-applicable'] as const
export type GeoNoteKind = (typeof GEO_NOTE_KINDS)[number]

// One curated per-country analog of a US-scoped process (the client-safe shape of
// lib/processes.ts GeoNote — same fields, so the server page passes task.geoNotes straight
// through to components/ProcessGeoBanner.tsx without the client bundle touching node:fs).
// `kind` rides along since the wrong-country-flow guard (founder 2026-10-02): the banner's
// copy branches on what the committed note SAYS — an analog is promoted as the local answer,
// an absorbed/not-applicable need is stated plainly.
export interface GeoAnalogNote {
  country: GeoSelection
  kind: GeoNoteKind
  summary: string
  actionUrl: string
  actionLabel: string
}

// The per-row slice of the committed geo notes an index row carries for the country-view
// filter: kind + the honest one-liner (the note's own committed summary — what the hidden-rows
// disclosure renders). Serialized server-side (lib/processRows.ts) for us/us-state rows only —
// global rows never filter, so they carry none.
export type GeoNotesByCountry = Partial<Record<GeoSelection, { kind: GeoNoteKind; summary: string }>>

// The /processes country-view filter rule (founder ask 2026-10-02; tightened by founder
// override 2026-10-05: "an explicit country view must not show US-only processes, full stop").
// Under a country selection C:
//   - global-scope rows always show (the work is the same everywhere);
//   - EVERY us/us-state row hides — an 'analog' C note no longer keeps the row in the table.
//     The hidden-rows disclosure under the table (components/ProcessesTable.tsx) is the
//     discoverability path: it lists each hidden row with its committed note summary (the
//     analog story included) and its process-page link.
// The no-selection default and the explicit 🌐 Global view never call this — they keep the full
// corpus (the geo dimension only FILTERS inside a country view; it still never re-ranks).
// `country` stays in the signature: it is the rule's vocabulary (a row hides IN a country view),
// and the disclosure reads the same per-country note slice this function used to branch on.
export function hiddenInCountryView(
  // geoScope null = a shared-catalog preview row (no geo dimension yet) — never hidden.
  row: { geoScope: 'global' | 'us' | 'us-state' | null; geoNotesByCountry: GeoNotesByCountry },
  country: GeoSelection,
): boolean {
  void country
  return row.geoScope === 'us' || row.geoScope === 'us-state'
}

// One (product, country) availability cell of jurisdictions/vendor-geo.json, pre-serialized
// server-side (lib/vendorGeo.ts vendorGeoLookup) so client annotations never touch node:fs.
// Only non-US countries appear — the US default view never annotates anything.
export interface VendorGeoCell {
  status: 'available' | 'partial' | 'unavailable'
  note: string
  sourceUrl: string
}
export type VendorGeoByCountry = Partial<Record<GeoSelection, VendorGeoCell>>
/** Keyed by productId; products the geo spike hasn't judged are simply absent (never guessed). */
export type VendorGeoLookup = Record<string, VendorGeoByCountry>

/** One full "Where it works" chip row (client-safe shape of lib/vendorGeo.ts entries). */
export interface VendorGeoStripRow extends VendorGeoCell {
  country: GeoCountry
  checkedAt: string
}

// Availability glyphs — the same visual language as lib/vendorGeo.ts VENDOR_GEO_STATUS_META,
// duplicated here because that module is server-only (node:fs).
export const GEO_STATUS_META: Record<VendorGeoCell['status'], { glyph: string; label: string }> = {
  available: { glyph: '✓', label: 'available' },
  partial: { glyph: '◐', label: 'partial' },
  unavailable: { glyph: '✕', label: 'not available' },
}

// Tolerant parse of a ?geo= value (or the stored copy): case-insensitive, unknown tokens (and
// 'us' — the default is never a stored/URL state) collapse to null. Never a crash, never an
// invalid country in state.
export function parseGeo(raw: string | null): GeoSelection | null {
  if (!raw) return null
  const token = raw.trim().toUpperCase()
  const hit = GEO_COUNTRIES.find((c) => c === token)
  return hit && hit !== 'US' ? hit : null
}

// Canonical serialization — null for the default US (the caller passes it straight to
// setParams, which deletes the param, and removes the localStorage copy).
export function serializeGeo(selection: GeoSelection | null): string | null {
  return selection === null ? null : selection.toLowerCase()
}

// ---------------------------------------------------------------------------------------------
// The per-tab store. Module-level state in the client bundle: every subscriber sees the same
// selection, GeoSwitcher/GeoDropdown are the only writers, and the server render never touches
// it (each consumer starts from the US default and syncs in its mount effect — the client-
// personalization contract).
//
// Since the founder's global-mode ask (2026-09-30: "add a Global option — the process in its
// country-agnostic form") the store carries the full GeoChoice: countries AND the explicit
// 'GLOBAL'. Back-compat is structural, not hopeful — getGeoSelection() maps GLOBAL to null, so
// every country-consumer (banner marks, vendor annotations, index glyphs, the step-method geo
// auto-preselect) sees exactly the geo-neutral state it always did; only the explicitly
// global-aware consumers (ProcessGeoBanner, ProcessGeoNotes, JurisdictionToggle) read the
// choice level via getGeoChoice().
type Listener = () => void
let choice: GeoChoice | null = null
const listeners = new Set<Listener>()

/** The country view of the store — GLOBAL reads as null (geo-neutral), the historic contract. */
export function getGeoSelection(): GeoSelection | null {
  return choice === GEO_GLOBAL ? null : choice
}

/** The full choice: a country, the explicit 'GLOBAL', or null (the US default). */
export function getGeoChoice(): GeoChoice | null {
  return choice
}

/** Set + notify. The switchers own the URL/localStorage writes; this is state fan-out only. */
export function setGeoChoice(next: GeoChoice | null): void {
  if (choice === next) return
  choice = next
  for (const l of listeners) l()
}

/** Country-only setter — kept for existing callers; identical semantics to setGeoChoice. */
export function setGeoSelection(next: GeoSelection | null): void {
  setGeoChoice(next)
}

export function subscribeGeoSelection(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
