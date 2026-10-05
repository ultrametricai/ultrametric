'use client'

import { useEffect, useRef, useState } from 'react'
import {
  GEO_COUNTRIES,
  GEO_GLOBAL,
  GEO_GLOBAL_META,
  GEO_PARAM,
  GEO_PREF_META,
  GEO_STORAGE_KEY,
  getGeoChoice,
  parseGeoChoice,
  serializeGeoChoice,
  setGeoChoice,
  subscribeGeoSelection,
  type GeoChoice,
  type GeoSelection,
} from '@/lib/geoPreference'
import { readParam, setParams } from '@/lib/urlState'

// The geo switcher as ONE compact dropdown (founder 2026-09-29: "make the geo switcher on
// /processes a single dropdown so the filter controls don't go to 2 lines") — the same shared
// store, URL param, and honesty contract as components/GeoSwitcher.tsx (the pill form, now only
// the WhereItWorks strip — process detail pages render THIS dropdown too, founder 2026-10-02).
// House listbox pattern (SimRolePicker/VsGeoSelector family), never a native <select>.
//
// `defaultChoice` is the SURFACE's no-selection framing (founder 2026-09-30: the /processes
// index defaults onto the global view — lib/geoPreference.ts PROCESSES_INDEX_DEFAULT_GEO): with
// nothing chosen the trigger reads 🌐 Global instead of 🇺🇸 USA, server-rendered (the prop, not a
// mount effect, so the static HTML IS the default view). Display framing only — the store stays
// null, no param/storage is written, and an explicit ?geo=/pa-geo/pick wins exactly as before.
// On a global-default surface the 🇺🇸 USA entry keeps its sitewide meaning — clear the param and
// the stored pref (the US default never appears in the URL) — so after picking it the trigger
// settles back on the surface's default framing; the index rows are identical either way (USA,
// Global and the pristine default all show the full corpus — only a COUNTRY view filters, per
// the committed note kinds, founder 2026-10-02), and detail pages return to their US default.

export default function GeoDropdown({ defaultChoice = null }: { defaultChoice?: typeof GEO_GLOBAL | null } = {}) {
  const [geo, setGeo] = useState<GeoChoice | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     and the stored preference, exactly the GeoSwitcher contract (static HTML renders the US
     default; the mount effect seeds the shared store). */
  useEffect(() => {
    const fromUrl = readParam(GEO_PARAM)
    const initial = fromUrl !== null ? parseGeoChoice(fromUrl) : parseGeoChoice(window.localStorage.getItem(GEO_STORAGE_KEY))
    setGeoChoice(initial)
    setGeo(getGeoChoice())
    return subscribeGeoSelection(() => setGeo(getGeoChoice()))
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const apply = (next: GeoChoice | null) => {
    setGeoChoice(next)
    const serialized = serializeGeoChoice(next)
    setParams({ [GEO_PARAM]: serialized })
    if (serialized === null) window.localStorage.removeItem(GEO_STORAGE_KEY)
    else window.localStorage.setItem(GEO_STORAGE_KEY, serialized)
    setOpen(false)
  }

  // No explicit choice reads as the surface default (null = the sitewide 🇺🇸 US default;
  // GEO_GLOBAL on the /processes index) — so with defaultChoice=GEO_GLOBAL the 🌐 Global entry
  // is the one marked active in the pristine state, and the trigger says so from the server
  // render on.
  const effective = geo ?? defaultChoice
  const current =
    effective === GEO_GLOBAL ? GEO_GLOBAL_META : effective ? GEO_PREF_META[effective] : null
  // 🌐 Global leads (the VsGeoSelector list order — the explicit geo-neutral choice, founder
  // 2026-09-30), then the canonical US-default → country set.
  const options: Array<{ value: GeoChoice | null; flag: string; name: string }> = [
    { value: GEO_GLOBAL, flag: GEO_GLOBAL_META.flag, name: GEO_GLOBAL_META.label },
    { value: null, flag: '🇺🇸', name: 'USA' },
    ...GEO_COUNTRIES.filter((c): c is GeoSelection => c !== 'US').map((c) => ({
      value: c as GeoChoice,
      flag: GEO_PREF_META[c].flag,
      name: GEO_PREF_META[c].label,
    })),
  ]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Where you operate — a country view keeps the global processes and lists the US-specific ones it hides (with their committed local analogs) below the table; never re-ranks"
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
      >
        <span aria-hidden>{current ? current.flag : '🇺🇸'}</span>
        <span className="hidden sm:inline">{current ? current.label : 'USA'}</span>
        <span aria-hidden className="text-[10px] text-zinc-500">▾</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Country" className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
          {options.map((o) => {
            const active = effective === o.value
            return (
              <li key={o.name} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => apply(o.value)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition ${
                    active ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-800 hover:text-emerald-300'
                  }`}
                >
                  <span aria-hidden>{o.flag}</span>
                  {o.name}
                  {active && <span aria-hidden className="ml-auto">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
