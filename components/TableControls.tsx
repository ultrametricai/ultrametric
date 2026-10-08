'use client'

import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { IconGlyph } from '@/components/IconChip'

// Shared control strip for the ranking tables (homepage MegaTable + per-arena ArenaTable) —
// one component so "rank by" presets, the scope <select>, the text filter, and the live
// "Ranked by …" line look and behave identically everywhere a leaderboard renders.
export interface TableControlsPreset<C extends string> {
  col: C
  label: string
  // Optional HOUSE icon token (`pi:<glyph>:<hue>`, lib/processIcons.ts), shown in the dropdown
  // variant via IconGlyph (founder 2026-10-08: the house icon sweep — the rank-by dropdown wore
  // raw emoji). Any non-token string still renders as text through IconGlyph's fallback.
  icon?: string
  // Optional text-only stand-in for the mobile native <select> option label — native options
  // can't render SVG, so the legacy emoji remains the only decoration there (the phaseEmoji
  // precedent).
  emoji?: string
}

function presetButtonClass(active: boolean): string {
  // focus-visible ring so keyboard users can see which preset pill has focus (the inputs in
  // this same strip already carry focus styles).
  const base = 'rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60'
  return active
    ? `${base} border-emerald-400/60 bg-emerald-400/10 text-emerald-300`
    : `${base} border-zinc-800 text-zinc-400 hover:border-emerald-400/40 hover:text-emerald-300`
}

export default function TableControls<C extends string>({
  presets,
  activeColumn,
  presetActive,
  onPreset,
  scope,
  query,
  onQuery,
  after,
  presetsAsDropdown = false,
}: {
  presets: Array<TableControlsPreset<C>>
  activeColumn: C
  // Whether the active column counts as "the preset is on" (e.g. only when direction is desc).
  presetActive: boolean
  onPreset: (col: C) => void
  // Optional scope control (the mega-table's "All rankings / <arena>" filter, the processes
  // table's area filter). Options may carry a house icon token (`icon`) — when any option does,
  // desktop renders the house listbox with the custom SVG glyphs (founder 2026-10-08: the
  // /processes area dropdown joins the custom set) and the native <select> survives below sm
  // with the text-only `emoji` stand-ins; icon-less callers keep the plain native select.
  scope?: {
    value: string
    onChange: (value: string) => void
    ariaLabel: string
    options: Array<{ value: string; label: string; icon?: string; emoji?: string }>
  }
  query: string
  onQuery: (value: string) => void
  // Extra inline content at the end of the controls row (e.g. the arena table's legend link).
  after?: ReactNode
  // Render the desktop presets as ONE house-listbox dropdown instead of the pill row
  // (founder 2026-09-30, /processes) — mobile keeps its select either way.
  presetsAsDropdown?: boolean
}) {
  // Founder 2026-09-23: one line — rank-by presets left, scope + filter pushed right; narrow
  // viewports wrap naturally. Founder 2026-09-24 (mobile): below sm the preset pills collapse
  // into one "Rank by" <select> so the controls fit a phone width.
  const activePreset = presets.find((p) => p.col === activeColumn && presetActive)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden text-xs uppercase tracking-widest text-zinc-500 sm:inline">Rank by</span>
      <span className="relative inline-flex sm:hidden">
        <select
          value={activePreset?.col ?? ''}
          onChange={(e) => e.target.value !== '' && onPreset(e.target.value as C)}
          aria-label="Rank by"
          className="max-w-[10rem] appearance-none rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-2.5 pr-7 text-sm text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
        >
          {/* The empty option shows when the reader column-sorted into a non-preset view. */}
          {activePreset === undefined && <option value="">Rank by…</option>}
          {presets.map((p) => (
            <option key={p.col} value={p.col}>
              {/* Text-only surface: the emoji stand-in, never the house token string. */}
              {p.emoji ? `${p.emoji} ${p.label}` : p.label}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-400">▾</span>
      </span>
      {presetsAsDropdown ? (
        <span className="hidden sm:inline-flex">
          <PresetDropdown presets={presets} active={activePreset?.col ?? null} onPreset={onPreset} />
        </span>
      ) : (
        presets.map((p) => (
          <button
            key={p.col}
            type="button"
            onClick={() => onPreset(p.col)}
            className={`hidden sm:inline-block ${presetButtonClass(activeColumn === p.col && presetActive)}`}
          >
            {p.label}
          </button>
        ))
      )}
      {/* Founder 2026-09-24 (mobile): the rank select and the arena scope share ONE line; the
          rank control keeps the width priority and the filter stays narrow, expanding on focus
          (a phone reader taps it before typing anyway). */}
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 sm:ml-auto sm:flex-none">
        {scope && (() => {
          // House-listbox desktop variant whenever the options carry house icons (founder
          // 2026-10-08) — the native select stays as the below-sm control AND as the stable
          // programmatic/test surface (it keeps the aria-label either way).
          const hasIcons = scope.options.some((o) => o.icon !== undefined && o.icon !== '')
          return (
            <>
              <span className={`relative inline-flex min-w-0 shrink ${hasIcons ? 'sm:hidden' : ''}`}>
                <select
                  value={scope.value}
                  onChange={(e) => scope.onChange(e.target.value)}
                  aria-label={scope.ariaLabel}
                  className="w-full max-w-[11rem] appearance-none rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-2.5 pr-7 text-sm text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
                >
                  {scope.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {/* Text-only surface: the emoji stand-in, never the house token string. */}
                      {o.emoji ? `${o.emoji} ${o.label}` : o.label}
                    </option>
                  ))}
                </select>
                {/* native select arrows are near-invisible on dark backgrounds — draw our own */}
                <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-400">▾</span>
              </span>
              {hasIcons && (
                <span className="hidden sm:inline-flex">
                  <ScopeDropdown scope={scope} />
                </span>
              )}
            </>
          )
        })()}
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter…"
          aria-label="Filter products by name or vendor"
          className="ml-auto w-20 min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 transition-[width] duration-150 placeholder:text-zinc-500 focus:w-40 focus:border-emerald-400/60 focus:outline-none sm:w-48 sm:focus:w-48"
        />
        {after && <span className="hidden text-xs text-zinc-400 sm:inline">{after}</span>}
        {/* Founder 2026-09-15: no "?" beside the filter — the methodology link in the footer and
            the column tooltips carry the definitions; the chip was visual noise. */}
      </div>
    </div>
  )
}


// Close-on-outside-pointer + Escape for the house listboxes below (one behavior, shared).
function useDismiss(open: boolean, close: () => void, rootRef: RefObject<HTMLSpanElement | null>) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close, rootRef])
}

// One option row of a house listbox — the icon renders through IconGlyph, so a `pi:` token
// shows the designed duotone SVG (founder 2026-10-08: the house icon sweep; emoji never
// render in these listboxes anymore).
function ListboxOption({
  icon, label, isActive, onPick,
}: {
  icon?: string
  label: string
  isActive: boolean
  onPick: () => void
}) {
  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onClick={onPick}
        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition ${
          isActive ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-800 hover:text-emerald-300'
        }`}
      >
        {icon !== undefined && icon !== '' && (
          <span aria-hidden className="shrink-0 text-sm leading-none">
            <IconGlyph icon={icon} />
          </span>
        )}
        {label}
        {isActive && <span aria-hidden className="ml-auto">✓</span>}
      </button>
    </li>
  )
}

// The single rank-by dropdown (house listbox — GeoDropdown/SimRolePicker family, never a
// native select on desktop). Closed button shows the active preset (house glyph + label) or
// 'Rank by'.
function PresetDropdown<C extends string>({
  presets,
  active,
  onPreset,
}: {
  presets: Array<TableControlsPreset<C>>
  active: C | null
  onPreset: (col: C) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  useDismiss(open, () => setOpen(false), rootRef)
  const current = presets.find((p) => p.col === active) ?? null
  return (
    <span ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 ${presetButtonClass(current !== null)}`}
      >
        {current?.icon !== undefined && current.icon !== '' && (
          <span aria-hidden className="shrink-0 text-sm leading-none">
            <IconGlyph icon={current.icon} />
          </span>
        )}
        {current ? current.label : 'Rank by'}
        <span aria-hidden className="text-[10px] text-zinc-500">▾</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Rank by" className="absolute left-0 z-40 mt-1 w-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
          {presets.map((p) => (
            <ListboxOption
              key={p.col}
              icon={p.icon}
              label={p.label}
              isActive={p.col === active}
              onPick={() => {
                onPreset(p.col)
                setOpen(false)
              }}
            />
          ))}
        </ul>
      )}
    </span>
  )
}

// The scope filter as a house listbox (desktop, icon-carrying callers only — founder
// 2026-10-08: the /processes area dropdown wore the native select's emoji; functional category
// icons are house glyphs). Select-look trigger so the control reads exactly where the native
// select stood; the list scrolls past ~10 entries (the mega-table's arena roster).
function ScopeDropdown({
  scope,
}: {
  scope: {
    value: string
    onChange: (value: string) => void
    ariaLabel: string
    options: Array<{ value: string; label: string; icon?: string; emoji?: string }>
  }
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  useDismiss(open, () => setOpen(false), rootRef)
  const current = scope.options.find((o) => o.value === scope.value) ?? null
  return (
    <span ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[13rem] items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-2.5 pr-2 text-sm text-zinc-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 hover:border-emerald-400/40"
      >
        {current?.icon !== undefined && current.icon !== '' && (
          <span aria-hidden className="shrink-0 leading-none">
            <IconGlyph icon={current.icon} />
          </span>
        )}
        <span className="truncate">{current?.label ?? scope.value}</span>
        <span aria-hidden className="text-xs text-emerald-400">▾</span>
      </button>
      {open && (
        <ul role="listbox" aria-label={scope.ariaLabel} className="absolute right-0 z-40 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
          {scope.options.map((o) => (
            <ListboxOption
              key={o.value}
              icon={o.icon}
              label={o.label}
              isActive={o.value === scope.value}
              onPick={() => {
                scope.onChange(o.value)
                setOpen(false)
              }}
            />
          ))}
        </ul>
      )}
    </span>
  )
}
