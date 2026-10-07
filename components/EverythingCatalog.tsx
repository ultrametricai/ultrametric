'use client'

import ProductLogoView from '@/components/ProductLogoView'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import TrendArrow from '@/components/TrendArrow'
import {
  DEFAULT_FACETS,
  filterEverythingRows,
  groupRowsByArena,
  sortRowsFlat,
  type EverythingFacets,
  type EverythingRow,
} from '@/lib/everythingFacets'

// The /everything power view's product catalog: the full cross-arena inventory as dense,
// striped one-line rows. This is the page's ONLY client component — everything below the
// catalog on /everything renders server-side. The rows arrive pre-serialized and lean (see
// lib/everything.ts); all this file adds is the facet bar and the grouped/flat rendering.
//
// Deliberately NOT the MegaTable: no sortable columns, no logos, no chips/badges — bare mono
// numbers ("42·77·23"), a grade letter, and tiny access glyphs, maximum rows per viewport.

// Glyph char -> color, mirroring lib/accessGlyphs.ts's server-side classes (chars cross the
// wire, classes don't).
const GLYPH_CLASS: Record<string, string> = {
  '✓': 'text-emerald-400',
  '~': 'text-emerald-400',
  '!': 'text-red-400',
  '—': 'text-zinc-600',
}

const GRADE_CLASS: Record<EverythingRow['grade'], string> = {
  A: 'text-emerald-300',
  B: 'text-emerald-400/80',
  C: 'text-zinc-400',
  D: 'text-zinc-500',
}

function fmt(v: number | null): string {
  return v === null ? '–' : v.toFixed(0)
}

function toggleClass(active: boolean): string {
  const base = 'rounded border px-2 py-1 text-[11px] leading-none transition'
  return active
    ? `${base} border-emerald-400/60 bg-emerald-400/10 text-emerald-300`
    : `${base} border-zinc-800 text-zinc-400 hover:border-emerald-400/40 hover:text-emerald-300`
}

function CatalogRow({ row }: { row: EverythingRow }) {
  const triplet = `${fmt(row.score)}·${fmt(row.agentReady)}·${fmt(row.agenticApp)}`
  const [mcp, cli, api] = [...row.access]
  return (
    <li className="flex items-center gap-2 px-2 py-[9px] text-[13px] leading-none odd:bg-zinc-900/40 sm:gap-3">
      <Link
        href={`/arena/${row.arenaId}/product/${row.productId}`}
        className="flex min-w-0 flex-1 items-center gap-2 truncate font-medium hover:text-emerald-300"
      >
        <ProductLogoView product={{ id: row.productId, name: row.name }} size={16} hasLogo={row.hasLogo} />
        <span className="min-w-0 truncate">{row.name}</span>
      </Link>
      <Link
        href={`/arena/${row.arenaId}`}
        className="hidden w-32 shrink-0 truncate text-[11px] text-zinc-500 hover:text-emerald-300 md:block"
      >
        {row.arenaName}
      </Link>
      <Link
        href="/methodology#arena-score"
        className="w-[4.5rem] shrink-0 text-right font-mono text-xs tabular-nums text-zinc-300 transition hover:text-emerald-300"
        title={`Overall score ${fmt(row.score)} · Agent-ready ${fmt(row.agentReady)} · Agentic ${fmt(row.agenticApp)} (each /100) — how they're computed, on /methodology`}
      >
        {triplet}
      </Link>
      <Link
        href="/methodology#confidence"
        className={`w-3 shrink-0 text-center font-mono text-[11px] transition hover:brightness-125 ${GRADE_CLASS[row.grade]}`}
        title={`Score confidence ${row.grade} — how much of the score rests on tested vs claimed evidence (A strongest, D thinnest). What the grades mean, on /methodology`}
      >
        {row.grade}
      </Link>
      <span
        className="flex w-[4.25rem] shrink-0 font-mono text-[11px]"
        title={`Agent access — MCP ${mcp} · CLI ${cli} · API ${api} (✓ full, ~ partial, ! disputed, — none)`}
      >
        {[
          ['M', mcp],
          ['C', cli],
          ['A', api],
        ].map(([label, char]) => (
          <span key={label} className="flex-1">
            <span className="text-zinc-500">{label}</span>
            <span className={GLYPH_CLASS[char] ?? 'text-zinc-600'}>{char}</span>
          </span>
        ))}
      </span>
      <span
        aria-hidden={!row.oss}
        title={row.oss ? 'Open source' : undefined}
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.oss ? 'bg-emerald-400' : 'bg-transparent'}`}
      >
        {row.oss && <span className="sr-only">open source</span>}
      </span>
      <span className="w-3 shrink-0 text-center">
        <TrendArrow delta={row.trend} />
      </span>
    </li>
  )
}

export default function EverythingCatalog({
  rows,
  arenas,
}: {
  rows: EverythingRow[]
  arenas: Array<{ id: string; name: string }>
}) {
  const [facets, setFacets] = useState<EverythingFacets>(DEFAULT_FACETS)
  const [flat, setFlat] = useState(false)

  const visible = useMemo(() => filterEverythingRows(rows, facets), [rows, facets])
  const groups = useMemo(() => (flat ? null : groupRowsByArena(rows, visible)), [rows, visible, flat])
  const flatRows = useMemo(() => (flat ? sortRowsFlat(visible) : null), [visible, flat])

  const set = (patch: Partial<EverythingFacets>) => setFacets((f) => ({ ...f, ...patch }))

  return (
    <div className="space-y-2">
      {/* Facet bar — one horizontal strip: count, arena select, three toggles, view toggle, text filter. */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-1 text-xs tabular-nums text-zinc-400" aria-live="polite">
          {visible.length} of {rows.length} products
        </p>
        <span className="relative inline-flex">
          <select
            value={facets.arenaId}
            onChange={(e) => set({ arenaId: e.target.value })}
            aria-label="Filter by ranking"
            className="max-w-[10rem] appearance-none rounded border border-zinc-800 bg-zinc-900 py-1 pl-2 pr-6 text-[11px] text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
          >
            <option value="all">All rankings</option>
            {arenas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400">▾</span>
        </span>
        <button type="button" onClick={() => set({ ossOnly: !facets.ossOnly })} className={toggleClass(facets.ossOnly)} aria-pressed={facets.ossOnly} title="Only open-source products">
          OSS
        </button>
        <button type="button" onClick={() => set({ mcpOnly: !facets.mcpOnly })} className={toggleClass(facets.mcpOnly)} aria-pressed={facets.mcpOnly} title="Only products with a judged full or partial MCP server">
          has MCP
        </button>
        <button
          type="button"
          onClick={() => set({ confBPlus: !facets.confBPlus })}
          className={toggleClass(facets.confBPlus)}
          aria-pressed={facets.confBPlus}
          title="Only products whose score-confidence grade is A or B"
        >
          conf ≥ B
        </button>
        <span className="inline-flex overflow-hidden rounded border border-zinc-800" role="group" aria-label="Group rows">
          <button type="button" onClick={() => setFlat(false)} aria-pressed={!flat} className={`px-2 py-1 text-[11px] leading-none transition ${!flat ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-400 hover:text-emerald-300'}`}>
            By ranking
          </button>
          <button type="button" onClick={() => setFlat(true)} aria-pressed={flat} className={`border-l border-zinc-800 px-2 py-1 text-[11px] leading-none transition ${flat ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-400 hover:text-emerald-300'}`}>
            Flat
          </button>
        </span>
        <input
          type="search"
          value={facets.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Filter…"
          aria-label="Filter products by name, vendor, or ranking"
          className="ml-auto min-w-0 flex-1 basis-20 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none sm:max-w-[11rem] sm:flex-none sm:basis-auto sm:w-40"
        />
      </div>

      <div className="rounded-lg border border-zinc-800">
        {flatRows && (
          <ul>
            {flatRows.map((row) => (
              <CatalogRow key={`${row.arenaId}:${row.productId}`} row={row} />
            ))}
          </ul>
        )}
        {groups &&
          groups.map((g) => (
            <section key={g.arenaId}>
              <header className="sticky top-0 z-10 flex items-baseline gap-2 border-y border-zinc-800 bg-zinc-950/95 px-2 py-1.5 backdrop-blur first:border-t-0">
                <Link href={`/arena/${g.arenaId}`} className="truncate text-xs font-medium text-zinc-200 hover:text-emerald-300">
                  {g.arenaName}
                </Link>
                <span className="text-[10px] tabular-nums text-zinc-500">{g.rows.length}</span>
                <span className="min-w-0 truncate text-[10px] text-zinc-500">
                  leader <span className="text-zinc-400">{g.leaderName}</span>
                </span>
              </header>
              <ul>
                {g.rows.map((row) => (
                  <CatalogRow key={`${row.arenaId}:${row.productId}`} row={row} />
                ))}
              </ul>
            </section>
          ))}
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">No products match these filters.</p>
        )}
      </div>
    </div>
  )
}
