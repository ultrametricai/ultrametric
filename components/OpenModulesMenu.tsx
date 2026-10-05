'use client'

import { useState } from 'react'
import type { OpenModuleChip } from '@/lib/businessLogicMap'

// The process page's 'Open modules' line as a compact collapsible (founder 2026-10-05): the
// always-visible chip row read as page noise, so the same chips now live behind a small
// disclosure button — the house idiom (a real <button> with aria-expanded, the
// JurisdictionToggle family), never a bare clickable span. Collapsed by
// default on the server AND the first client render (plain useState, no mount effect, no stored
// state), so the static HTML is deterministic and hydrates mismatch-free. The chips themselves
// are unchanged: the committed registry's modules (processes/business-logic-map.json via
// lib/businessLogicMap.ts), each deep-linking to the module's section in open-modules/README.md
// on GitHub. Renders nothing for the many processes with no mapped modules.
export default function OpenModulesMenu({ modules }: { modules: OpenModuleChip[] }) {
  const [open, setOpen] = useState(false)
  if (modules.length === 0) return null
  return (
    <div className="mt-3 max-w-2xl text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="The open modules (open-source lib/openstartup/ code in the repo) whose cited, tested math serves this process — cap tables, deadlines, tax mechanics, and friends. Each chip opens the module's documentation."
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1 text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-300"
      >
        <span aria-hidden className="text-[10px]">☰</span>
        Open modules
        <span aria-hidden className="text-[10px] text-zinc-500">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          {modules.map((m) => (
            <a
              key={m.id}
              href={m.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-300"
            >
              {m.label} ↗
            </a>
          ))}
        </p>
      )}
    </div>
  )
}
