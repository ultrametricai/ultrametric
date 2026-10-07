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
  setGeoChoice,
  subscribeGeoSelection,
  type GeoChoice,
  type GeoSelection,
} from '@/lib/geoPreference'
import { applyGeoChoice } from '@/components/useGeoSelection'
import { readParam } from '@/lib/urlState'

// The geo switcher as ONE compact dropdown (founder 2026-09-29: "make the geo switcher on
// /processes a single dropdown so the filter controls don't go to 2 lines") — house listbox
// pattern (SimRolePicker/VsGeoSelector family), never a native <select>. Since the founder
// top-bar move (2026-10-07: "move this into the top bar so the user can set their country or
// default to global, then we don't need it per page") this renders ONCE, in the site header
// (components/HeaderGeoControl.tsx) — the per-page mounts on /processes, the process detail
// pages, and /artifacts are gone; the pages keep every adaptive behavior through the same
// shared store, URL param, and honesty contract (lib/geoPreference.ts).
//
// `defaultChoice` is the SURFACE's no-selection framing (founder 2026-09-30, originally the
// /processes index; sitewide via the header control since 2026-10-07 — lib/geoPreference.ts
// PROCESSES_INDEX_DEFAULT_GEO documents the semantics): with nothing chosen the trigger reads
// 🌐 Global instead of 🇺🇸 USA, server-rendered (the prop, not a mount effect, so the static
// HTML IS the default view). Display framing only — the store stays null, no param/storage is
// written, and an explicit ?geo=/pa-geo/pick wins exactly as before. On a global-default
// surface the 🇺🇸 USA entry keeps its sitewide meaning — clear the param and the stored pref
// (the US default never appears in the URL) — so after picking it the trigger settles back on
// the surface's default framing; no selection and Global both mean the full corpus and the
// US-baseline flows (only a COUNTRY view filters/adapts, founder 2026-10-02). The 2026-10-06
// detail-page USA framing is superseded by the 2026-10-07 header default: one control, one
// 🌐 Global no-selection framing sitewide.
//
// `variant='nav'` is the header form (founder 2026-10-07): a compact flag-or-globe trigger at
// nav weight — no border chip, the country name in the tooltip/sr-only text only.

export default function GeoDropdown({
  defaultChoice = null,
  align = 'right',
  variant = 'chip',
}: {
  defaultChoice?: typeof GEO_GLOBAL | null
  align?: 'left' | 'right'
  variant?: 'chip' | 'nav'
} = {}) {
  const [geo, setGeo] = useState<GeoChoice | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     and the stored preference (the client-personalization contract: static HTML renders the
     surface default; the mount effect seeds the shared store). */
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

  // The shared switcher write path (components/useGeoSelection.ts applyGeoChoice) — the
  // "Outside the US" rows drive the same writes since founder 2026-10-07.
  const apply = (next: GeoChoice | null) => {
    applyGeoChoice(next)
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
    // Shrink-to-fit root (founder bug 2026-10-05: "the geo menu is disconnected from the
    // clickable 'Global' dropdown" — in a block container, a plain `relative` div spans the full
    // content width, so the right-0 popover rendered at the container's far edge, a page-width
    // away from the trigger). inline-flex sizes the anchor box to the trigger itself and
    // top-full pins the list under it — the VsGeoSelector idiom (PR #90). `align` picks which
    // trigger edge the menu hugs (founder bug 2026-10-06: the menu is wider than the trigger,
    // so the alignment must follow the trigger's position in its row): right for the /processes
    // index controls row (trigger at the row's right end), left for detail pages (trigger at
    // the content's left — a right-aligned menu juts off the column's left edge there).
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Where you operate — a country view adapts the processes, artifacts and availability marks to that country; never re-ranks"
        className={
          variant === 'nav'
            ? 'flex items-center gap-1 text-sm text-zinc-300 transition hover:text-emerald-300'
            : 'flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300'
        }
      >
        <span aria-hidden>{current ? current.flag : '🇺🇸'}</span>
        {/* Nav weight keeps the trigger a flag/globe only — the current choice's name stays
            for screen readers (and in the tooltip above). */}
        <span className={variant === 'nav' ? 'sr-only' : 'hidden sm:inline'}>
          {current ? current.label : 'USA'}
        </span>
        <span aria-hidden className="text-[10px] text-zinc-500">▾</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Country" className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-2xl`}>
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
