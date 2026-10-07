'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  GEO_GLOBAL,
  GEO_GLOBAL_META,
  GEO_COUNTRIES,
  GEO_PARAM,
  GEO_PREF_META,
  GEO_STORAGE_KEY,
  parseGeoChoice,
  serializeGeoChoice,
  setGeoChoice,
  type GeoChoice,
} from '@/lib/geoPreference'
import { readParam, setParams } from '@/lib/urlState'

// The Virtual Startup's in-sim Geo control (founder batch 2026-09-29, round 4, item 3): a
// DROPDOWN, not toggle pills — the house listbox pattern (components/VsDecisionSelect.tsx /
// SimRolePicker.tsx, never a native <select>). Closed, the trigger shows the CURRENT country
// (flag + name, default 🇺🇸 USA); open, the list is 🌐 Global · 🇺🇸 USA · 🇬🇧 UK · 🇮🇳 India ·
// 🇩🇪 Germany · 🇫🇷 France · 🇵🇹 Portugal · 🇨🇦 Canada. The STATE CONTRACT is exactly the pill
// row's (the shared geo doctrine):
// the ?geo= param + the pa-geo localStorage copy, read on MOUNT ONLY so the static HTML stays
// byte-identical, plus the 'global' token (lib/geoPreference.ts GEO_GLOBAL, additive). Interop
// is deliberate: a UK pick here is the same ?geo=uk / pa-geo=uk the process and product pages
// read, and the control seeds the shared per-tab store (countries only — 'global' maps to the
// null store state, which is exactly what geo-neutral means to every existing consumer).
//
// Honesty (the shared geo doctrine, verbatim): switching countries never re-ranks or recomputes
// a judged number — every in-sim geo annotation is derived from committed evidence (process
// geoNotes, jurisdictions/vendor-geo.json), and unsupported countries are said to be unmapped,
// never guessed.

interface GeoOption {
  choice: GeoChoice | null
  code: string // testid suffix + compact trigger text
  name: string // the visible list label
  flag: string
  // The honesty line — rendered as the option SUBLABEL inside the open list (the title= tooltips
  // left the setup-band dropdowns 2026-09-30, item 3: they overlapped the open listboxes).
  title: string
}

// List order: Global first, then the canonical US→UK→IN→DE→FR country set.
const OPTIONS: GeoOption[] = [
  {
    choice: GEO_GLOBAL,
    code: 'Global',
    name: 'Global',
    flag: GEO_GLOBAL_META.flag,
    title: 'Global — a geo-neutral run: no country marks, no analogs; judged data unchanged',
  },
  ...GEO_COUNTRIES.map((c) => ({
    choice: c === 'US' ? null : c,
    code: c === 'US' ? 'USA' : c,
    name: c === 'US' ? 'USA' : c === 'UK' ? 'UK' : GEO_PREF_META[c].label,
    flag: GEO_PREF_META[c].flag,
    title:
      c === 'US'
        ? `${GEO_PREF_META[c].label} — the default every page renders and every number is judged in`
        : `${GEO_PREF_META[c].label} — annotate the run with the committed ${c} evidence (never re-ranked, never guessed)`,
  })),
]

export default function VsGeoSelector({
  value,
  onChange,
}: {
  value: GeoChoice | null
  onChange: (next: GeoChoice | null) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeOptionRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  // One-time post-hydration sync FROM the URL and the stored preference (external systems), the
  // shared geo-control contract: the static HTML must render the US default, so this cannot be an
  // initializer (hydration mismatch); it runs once. (The setter is the parent's state setter,
  // passed down as onChange — which is also why the lint rule doesn't need disabling here.)
  useEffect(() => {
    const fromUrl = readParam(GEO_PARAM)
    const initial =
      fromUrl !== null
        ? parseGeoChoice(fromUrl)
        : parseGeoChoice(window.localStorage.getItem(GEO_STORAGE_KEY))
    if (initial === null) return
    // Seed the shared store with the FULL choice (Global included — founder bug 2026-10-01: the
    // old countries-only seed dropped an explicit Global pick to null, so it never stuck).
    setGeoChoice(initial)
    onChange(initial)
    // Mount-only: the URL (else the stored copy) is the INITIAL view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close on any click/tap outside while open (SimRolePicker contract).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keyboard flow: Enter on the trigger opens, focus lands on the current state, Enter picks.
  useEffect(() => {
    if (open) activeOptionRef.current?.focus()
  }, [open])

  function close(refocus: boolean) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const apply = (next: GeoChoice | null) => {
    setGeoChoice(next)
    const serialized = serializeGeoChoice(next)
    setParams({ [GEO_PARAM]: serialized })
    if (serialized === null) window.localStorage.removeItem(GEO_STORAGE_KEY)
    else window.localStorage.setItem(GEO_STORAGE_KEY, serialized)
    onChange(next)
    close(true)
  }

  const current = OPTIONS.find((o) => o.choice === value) ?? OPTIONS.find((o) => o.choice === null)!

  return (
    <div
      ref={rootRef}
      data-testid="vs-geo-row"
      role="group"
      aria-label="Country view"
      className="relative flex shrink-0 items-center"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          close(true)
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="vs-geo-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs transition ${
          open
            ? 'border-emerald-400/60 bg-emerald-400/5 text-zinc-100'
            : 'border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'
        }`}
      >
        <span aria-hidden>{current.flag}</span>
        {current.name}
        <span aria-hidden className="text-[9px] text-zinc-500">
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          id={listboxId}
          aria-label="Country view options"
          className="absolute left-0 top-full z-30 mt-1 w-[280px] rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-2xl"
        >
          {OPTIONS.map((o) => {
            const active = value === o.choice
            return (
              <li key={o.code} role="presentation">
                <button
                  ref={active ? activeOptionRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  aria-label={o.name}
                  data-testid={`vs-geo-${o.code.toLowerCase()}`}
                  onClick={() => apply(o.choice)}
                  className={`flex w-full items-start gap-2 border-l-2 px-2.5 py-1.5 text-left text-xs transition ${
                    active
                      ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-300'
                      : 'border-transparent text-zinc-300 hover:bg-emerald-400/10 hover:text-emerald-300'
                  }`}
                >
                  <span aria-hidden>{o.flag}</span>
                  <span className="min-w-0 flex-1">
                    {o.name}
                    {/* Sublabel (item 3, 2026-09-30): the honesty line the removed tooltip carried. */}
                    <span data-testid="vs-geo-detail" className="mt-0.5 block text-[10px] leading-snug text-zinc-400">
                      {o.title}
                    </span>
                  </span>
                  {active && (
                    <span aria-hidden className="shrink-0 text-emerald-300">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
