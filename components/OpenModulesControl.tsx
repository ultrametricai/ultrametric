'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { OpenModuleChip } from '@/lib/businessLogicMap'

// The process header's open-modules affordance, inline with the geo control (founder
// 2026-10-06: the 'Open modules ↓' link sat on its own line above the geo dropdown, and the
// earlier disclosure "expanded in that lame way"). One module renders as plain inline text —
// 'Open module: Cap table' — linking the module's on-site /open-modules page (founder
// 2026-10-07: the module page is the hub; it carries the GitHub deep link, and the per-step
// compute chips keep their function-level README deep links). Several modules become a small
// dropdown at the geo control's visual weight, on the house menu contract (DocsMenu/ArenaMenu:
// aria-haspopup/aria-expanded trigger, outside-pointerdown and Escape close with focus restore,
// arrow-key movement). The bottom 'Open modules' receipts table stays as-is — this control
// links the module pages, the table carries the per-step wiring.

export default function OpenModulesControl({ modules }: { modules: OpenModuleChip[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (modules.length === 0) return null

  const title =
    'Open-source lib/openstartup/ modules whose cited, tested math serves this process — opens the module’s page'

  if (modules.length === 1) {
    const m = modules[0]
    return (
      <Link
        href={m.href}
        title={title}
        className="inline-flex items-center gap-1 text-xs text-zinc-400 transition hover:text-emerald-300"
      >
        Open module: {m.label}
      </Link>
    )
  }

  function focusItem(index: number) {
    const n = modules.length
    itemRefs.current[((index % n) + n) % n]?.focus()
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(current + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem(current - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusItem(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusItem(modules.length - 1)
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => focusItem(0))
    }
  }

  return (
    // Shrink-to-fit anchor + left-aligned menu — the GeoDropdown detail-page idiom (this
    // control sits beside it at the content's left, so the menu hugs the trigger's left edge).
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        title={title}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
      >
        Open modules
        <span aria-hidden className="text-[10px] text-zinc-500">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Open modules"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-2xl"
        >
          {modules.map((m, i) => (
            <Link
              key={m.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              role="menuitem"
              href={m.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-emerald-300"
            >
              {m.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
