'use client'

import { useEffect, useRef, useState } from 'react'

// One "Docs" dropdown (founder 2026-10-05): the product header's API/CLI/MCP docs chips
// collapse into this single accessible menu. Same interaction contract as the header's
// ArenaMenu: trigger button with aria-haspopup/aria-expanded, outside-pointerdown and Escape
// close (Escape restores focus to the trigger), and arrow-key movement between entries. Every
// entry keeps its external-link mark and destination (target=_blank, rel=noopener).
export interface DocsMenuEntry {
  label: string
  href: string
}

export default function DocsMenu({ entries }: { entries: DocsMenuEntry[] }) {
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

  function focusItem(index: number) {
    const n = entries.length
    if (n === 0) return
    itemRefs.current[((index % n) + n) % n]?.focus()
  }

  // Keyboard navigation inside the open menu: ArrowDown/ArrowUp cycle, Home/End jump.
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
      focusItem(entries.length - 1)
    }
  }

  // ArrowDown on the closed trigger opens and moves focus to the first entry (menu-button
  // pattern); plain click just toggles.
  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => focusItem(0))
    }
  }

  if (entries.length === 0) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-400 hover:text-emerald-300"
      >
        Docs
        <span aria-hidden className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Vendor docs"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 z-40 mt-1.5 w-44 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl shadow-black/40"
        >
          {entries.map((entry, i) => (
            <a
              key={entry.href}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              role="menuitem"
              href={entry.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-emerald-300"
            >
              {entry.label}
              <span aria-hidden className="text-zinc-500">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
