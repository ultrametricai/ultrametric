'use client'

import Link from 'next/link'
import { IconGlyph } from '@/components/IconChip'
import { useEffect, useMemo, useState } from 'react'
import {
  isSurfaceRankId,
  sortSurfaces,
  SURFACE_RANKS,
  type SurfaceRankId,
  type SurfaceRow,
} from '@/lib/controlSurfaces'
import { readParam, setParams } from '@/lib/urlState'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The /technologies ranking table: canonical control surfaces re-ranked client-side by the
// toggle pills, each row expandable to its editorial pros/cons + the computed fleet stats +
// example top products. All numbers arrive precomputed and serialized from the server
// (lib/controlSurfaces.ts over loadAll()) — this component only sorts and renders.
//
// Shareable-view URL state (lib/urlState.ts): ?rank=<id> with the 'adoption' default elided;
// read once on mount so the static HTML always renders the default ranking (zero hydration
// mismatch — the HomeModes/ProcessesTable contract).

function fmt(n: number | null): string {
  if (n === null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function fmtLift(n: number | null): string {
  if (n === null) return '—'
  return `${n > 0 ? '+' : ''}${fmt(n)}`
}

const VERDICT_MARK: Record<string, { char: string; className: string }> = {
  full: { char: '✓', className: 'text-emerald-400' },
  partial: { char: '~', className: 'text-amber-300' },
}

function AdoptionMeter({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-zinc-300">{fmt(pct)}%</span>
    </div>
  )
}

function SurfaceDetails({ row }: { row: SurfaceRow }) {
  return (
    <div className="space-y-3 px-3 pb-4 pt-1 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-emerald-400">Pros</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">
            {row.pros.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-red-400">Cons</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">
            {row.cons.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      {/* The fleet statistics backing the editorial text above — every number recomputable from
          the committed verdicts (see lib/controlSurfaces.ts). */}
      <p className="text-xs text-zinc-400">
        Fleet evidence: shipped by{' '}
        <span className="tabular-nums text-zinc-200">
          {row.shipped}/{row.judged}
        </span>{' '}
        judged products ({fmt(row.shipRate)}% — {row.fullCount} full, {row.partialCount} partial verdicts), present in{' '}
        <span className="tabular-nums text-zinc-200">
          {row.arenasWithShipper}/{row.arenasJudged}
        </span>{' '}
        judged rankings.
        {row.readinessLift !== null && row.avgReadyWith !== null && row.avgReadyWithout !== null && (
          <>
            {' '}
            Products shipping it average <span className="tabular-nums text-zinc-200">{fmt(row.avgReadyWith)}</span> AGENT-READY vs{' '}
            <span className="tabular-nums text-zinc-200">{fmt(row.avgReadyWithout)}</span> without ({fmtLift(row.readinessLift)} lift —
            correlation, not causation).
          </>
        )}
      </p>
      {row.topProducts.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Strongest judged examples</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {row.topProducts.map((p) => {
              const mark = VERDICT_MARK[p.verdict]
              return (
                <li key={`${p.categoryId}:${p.productId}`} className="flex items-center gap-1.5">
                  {mark && (
                    <span aria-hidden className={`font-mono ${mark.className}`}>
                      {mark.char}
                    </span>
                  )}
                  <Link
                    href={`/arena/${p.categoryId}/product/${p.productId}`}
                    className="text-zinc-200 underline decoration-zinc-700 transition hover:text-emerald-300"
                  >
                    {p.productName}
                  </Link>
                  <span className="text-zinc-500">
                    in{' '}
                    <Link href={`/arena/${p.categoryId}`} className="transition hover:text-emerald-300">
                      {p.categoryName}
                    </Link>
                    {p.agentReady !== null && <> · agent-ready {fmt(p.agentReady)}</>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function ControlSurfacesTable({ surfaces, emerging }: { surfaces: SurfaceRow[]; emerging: SurfaceRow[] }) {
  const [rank, setRank] = useState<SurfaceRankId>('adoption')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     (external system). The static HTML must render the default ranking, so this cannot be a
     useState initializer (hydration mismatch); it runs once and renders at most one extra pass. */
  useEffect(() => {
    const r = readParam('rank')
    if (isSurfaceRankId(r) && r !== 'adoption') setRank(r)
    // Mount-only: the URL is the INITIAL view.
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  function pick(id: SurfaceRankId) {
    setRank(id)
    setParams({ rank: id === 'adoption' ? null : id })
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sorted = useMemo(() => sortSurfaces(surfaces, rank), [surfaces, rank])

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-zinc-800 p-1">
        {SURFACE_RANKS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => pick(r.id)}
            title={r.title}
            aria-pressed={rank === r.id}
            className={`rounded-full px-3.5 py-1 text-sm transition ${
              rank === r.id ? 'bg-emerald-400/15 font-medium text-emerald-300 ring-1 ring-emerald-400/50' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th scope="col" className="px-3 py-2 font-normal">#</th>
              <th scope="col" className="px-3 py-2 font-normal">
                <span title="An abstract way of controlling software — not a vendor. Click a row for pros, cons and the evidence behind the numbers">Surface</span>
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                <span title="Share of all judged products shipping the surface (full or partial verdict)">Adoption</span>
              </th>
              <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">
                <span title="Share of judged products with a FULL verdict only">Full</span>
              </th>
              <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                <span title="Mean AGENT-READY of products shipping the surface minus those without — correlation, not causation">Readiness lift</span>
              </th>
              <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                <span title="Rankings with at least one shipper / rankings where the surface was judged">Rankings</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {sorted.map((row, i) => (
              <SurfaceRows key={row.id} row={row} index={i + 1} expanded={expanded.has(row.id)} onToggle={() => toggle(row.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {emerging.length > 0 && (
        <section aria-label="surfaces without fleet-wide judged coverage" className="space-y-2">
          <h2 className="font-display leading-[1.1] text-lg font-semibold">Below the line: thin judged coverage</h2>
          <p className="max-w-2xl text-xs text-zinc-500">
            These surfaces are judged only through stories authored inside a handful of individual rankings, so ranking them against the
            canonical surfaces would be dishonest. Counts below are real but cover only the rankings that judge them; the
            readiness-lift stat is withheld on small samples.
          </p>
          <div className={TABLE_SHELL}>
            <table className="w-full border-collapse text-sm">
              <tbody className="divide-y divide-zinc-800/70">
                {emerging.map((row) => (
                  <SurfaceRows key={row.id} row={row} index={null} expanded={expanded.has(row.id)} onToggle={() => toggle(row.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function SurfaceRows({
  row,
  index,
  expanded,
  onToggle,
}: {
  row: SurfaceRow
  index: number | null
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr className="cursor-pointer transition hover:bg-zinc-900/50" onClick={onToggle}>
        <td className="w-12 px-3 py-2 font-mono tabular-nums text-zinc-500">{index !== null ? ordinal(index) : '·'}</td>
        <td className="max-w-[420px] px-3 py-2">
          <button
            type="button"
            aria-expanded={expanded}
            className="text-left font-medium text-zinc-100 transition hover:text-emerald-300"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            <span aria-hidden className="mr-1.5 inline-block text-zinc-500">
              {expanded ? '▾' : '▸'}
            </span>
            {/* The surface's house glyph (CONTROL_SURFACE_ICONS `pi:` token — founder
                2026-10-08 sweep); the visible name beside it carries the concept. */}
            <span aria-hidden className="mr-1.5">
              <IconGlyph icon={row.icon} />
            </span>
            {row.name}
          </button>
          <p className="mt-0.5 text-xs text-zinc-500">{row.blurb}</p>
        </td>
        <td className="px-3 py-2">
          <AdoptionMeter pct={row.shipRate} />
          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-zinc-500">
            {row.shipped}/{row.judged}
          </p>
        </td>
        <td className="hidden px-3 py-2 font-mono text-xs tabular-nums text-zinc-400 sm:table-cell">{fmt(row.fullRate)}%</td>
        <td className="hidden px-3 py-2 font-mono text-xs tabular-nums text-zinc-400 md:table-cell">{fmtLift(row.readinessLift)}</td>
        <td className="hidden px-3 py-2 font-mono text-xs tabular-nums text-zinc-400 md:table-cell">
          {row.arenasWithShipper}/{row.arenasJudged}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-zinc-900/30">
          <td />
          <td colSpan={5}>
            <SurfaceDetails row={row} />
          </td>
        </tr>
      )}
    </>
  )
}
