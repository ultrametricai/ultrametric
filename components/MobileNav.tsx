'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import HeaderGeoControl from '@/components/HeaderGeoControl'
import { IconGlyph } from '@/components/IconChip'
import { MOBILE_NAV_ICONS } from '@/lib/arenaIcons'

// Mobile hamburger (founder 2026-09-24: "the mobile top bar goes off the page — we need a
// hamburger menu"). Below sm the header shows only logo · ☰ · search · account; every other
// destination lives here, and so does the sitewide country control (founder 2026-10-07 — the
// desktop header mount is hidden below sm). Desktop never renders this (sm:hidden) — the full
// button row and the Rankings/Explore dropdowns stay the desktop IA. Icons: house glyph tokens
// (lib/arenaIcons.ts, founder 2026-10-01 — the custom set replaces the emoji in the top-bar
// menus).
const ITEMS: Array<{ href: string; label: string; icon: string }> = [
  // "Rankings" is the renamed Arenas label (founder 2026-10-07); the route stays /arenas.
  { href: '/arenas', label: 'Rankings', icon: MOBILE_NAV_ICONS['/arenas'] },
  { href: '/processes', label: 'Processes', icon: MOBILE_NAV_ICONS['/processes'] },
  { href: '/situations', label: 'Situations', icon: MOBILE_NAV_ICONS['/situations'] },
  { href: '/technologies', label: 'Technologies', icon: MOBILE_NAV_ICONS['/technologies'] },
  { href: '/startup-sim', label: 'Open Startup Sim', icon: MOBILE_NAV_ICONS['/startup-sim'] },
  { href: '/stacks', label: 'Stacks', icon: MOBILE_NAV_ICONS['/stacks'] },
  { href: '/compare', label: 'Compare', icon: MOBILE_NAV_ICONS['/compare'] },
  // "Capability adoption" matches /global's Explore-menu entry and page title — a "Global
  // rankings" label next to the renamed Rankings entry read as the same destination.
  { href: '/global', label: 'Capability adoption', icon: MOBILE_NAV_ICONS['/global'] },
  { href: '/methodology', label: 'Methodology', icon: MOBILE_NAV_ICONS['/methodology'] },
]

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside tap / Escape — same lightweight pattern as the header dropdowns.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Menu"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 transition hover:border-emerald-400/60"
      >
        <span aria-hidden className="text-base leading-none">☰</span>
      </button>
      {open && (
        /* Viewport-pinned panel (founder bug 2026-10-08: the panel rendered off-screen — while
           the crowded header wrapped, the ☰ landed at the LEFT of the wrapped line, and this
           panel was `absolute right-0`, anchored to the button, so its 224px width ran past the
           viewport's left edge). `fixed` positions against the viewport, not the button: right-3
           matches the header's px-3 gutter, top-14 clears the py-3 + h-8 header row, and the
           max-h/overflow pair keeps every row reachable when the panel is taller than the
           viewport (it gained a Country row 2026-10-07). Outside-tap close still works — the
           panel stays inside rootRef in the DOM. */
        <div className="fixed right-3 top-14 z-50 max-h-[calc(100dvh-4.5rem)] w-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-2xl shadow-black/50">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-emerald-300"
            >
              <span aria-hidden className="inline-flex w-5 justify-center">
                <IconGlyph icon={item.icon} />
              </span>
              {item.label}
            </Link>
          ))}
          {/* The sitewide country control (founder 2026-10-07) — below sm the desktop header
              mount is hidden, so the ☰ panel carries it: same component, same ?geo=/pa-geo
              preference, 🌐 Global default. */}
          <div className="mt-1 flex items-center justify-between border-t border-zinc-800 px-3 pb-1 pt-2 text-sm text-zinc-500">
            Country
            <HeaderGeoControl />
          </div>
        </div>
      )}
    </div>
  )
}
