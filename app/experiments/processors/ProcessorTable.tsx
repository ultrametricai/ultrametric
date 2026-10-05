'use client'

// EXPERIMENT — self-contained sortable spec table for the /experiments/processors prototype.
// Deliberately does NOT reuse components/ArenaTable.tsx or lib/arenaTableSort.ts: this page is
// an unlinked spike (static vendor specs, no verdicts/evidence), so it copies the minimal
// visual pattern locally instead of coupling the shared arena components to experiment data.

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import raw from '@/data/experiments/processors.json'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

type Chip = {
  id: string
  name: string
  vendor: string
  segment: string
  cores: string
  coresTotal: number
  maxClockGhz: number | null
  clockNote?: string
  npuTops: number | null
  npuNote?: string
  tdpW: number | null
  tdpNote?: string
  memBwGBs: number
  memBwNote?: string
  maxMemGB: number | null
  process: string | null
  released: string
  priceUsd?: number
  priceNote?: string
  sourceUrl: string
  sourceNote?: string
}

const CHIPS = raw.chips as Chip[]

type SortKey =
  | 'default'
  | 'name'
  | 'coresTotal'
  | 'maxClockGhz'
  | 'npuTops'
  | 'tdpW'
  | 'memBwGBs'
  | 'maxMemGB'
  | 'topsPerW'
  | 'bwPerCore'
type SortDirection = 'asc' | 'desc'

// Derived, honestly: only computed where the vendor publishes both inputs (see tooltips).
function topsPerW(c: Chip): number | null {
  return c.npuTops !== null && c.tdpW !== null ? c.npuTops / c.tdpW : null
}
function bwPerCore(c: Chip): number {
  return c.memBwGBs / c.coresTotal
}

function sortValue(c: Chip, key: SortKey, defaultIndex: Map<string, number>): number | string | null {
  switch (key) {
    case 'default':
      return defaultIndex.get(c.id) ?? 0
    case 'name':
      return c.name.toLowerCase()
    case 'topsPerW':
      return topsPerW(c)
    case 'bwPerCore':
      return bwPerCore(c)
    default:
      return c[key]
  }
}

function Th({
  children,
  col,
  current,
  direction,
  onSort,
  sortable = true,
  className = '',
}: {
  children: ReactNode
  col: SortKey
  current: SortKey
  direction: SortDirection
  onSort: (col: SortKey) => void
  sortable?: boolean
  className?: string
}) {
  if (!sortable) {
    return (
      <th scope="col" className={`sticky top-0 z-20 bg-zinc-950 px-3 py-2 font-normal ${className}`}>
        {children}
      </th>
    )
  }
  const isCurrent = col === current
  const ariaSort: 'ascending' | 'descending' | 'none' = !isCurrent ? 'none' : direction === 'asc' ? 'ascending' : 'descending'
  return (
    <th scope="col" aria-sort={ariaSort} className={`sticky top-0 z-20 bg-zinc-950 px-3 py-2 font-normal ${className}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 whitespace-nowrap hover:text-emerald-300 ${isCurrent ? 'text-emerald-300' : ''}`}
      >
        {children}
        {isCurrent && <span aria-hidden>{direction === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

function Na({ reason }: { reason?: string }) {
  return (
    <span className="text-zinc-500" title={reason ?? 'Not published by the vendor.'}>
      n/a
    </span>
  )
}

export default function ProcessorTable() {
  const [column, setColumn] = useState<SortKey>('default')
  const [direction, setDirection] = useState<SortDirection>('asc')

  // Curated file order is the identity order — "# " stays fixed while you re-sort, same
  // convention as the arena leaderboard's rank column.
  const defaultIndex = useMemo(() => new Map(CHIPS.map((c, i) => [c.id, i])), [])

  const sorted = useMemo(() => {
    const rows = [...CHIPS]
    rows.sort((a, b) => {
      const va = sortValue(a, column, defaultIndex)
      const vb = sortValue(b, column, defaultIndex)
      if (va === null && vb === null) return 0
      if (va === null) return 1 // nulls last regardless of direction
      if (vb === null) return -1
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return direction === 'asc' ? cmp : -cmp
    })
    return rows
  }, [column, direction, defaultIndex])

  function handleSort(col: SortKey) {
    if (col === column) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColumn(col)
      setDirection(col === 'name' || col === 'default' ? 'asc' : 'desc')
    }
  }

  return (
    <div className={TABLE_SHELL}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={TABLE_HEADER_ROW}>
            <Th col="default" current={column} direction={direction} onSort={handleSort} className="w-8">
              #
            </Th>
            <Th col="name" current={column} direction={direction} onSort={handleSort}>
              Chip
            </Th>
            <Th col="coresTotal" current={column} direction={direction} onSort={handleSort}>
              <span title="CPU core count and layout (P = performance, E = efficiency, LPE = low-power efficiency), as published by the vendor.">Cores</span>
            </Th>
            <Th col="maxClockGhz" current={column} direction={direction} onSort={handleSort} className="hidden sm:table-cell">
              <span title="Max boost / turbo clock (GHz), vendor-published. Apple does not publish clocks.">Max clock</span>
            </Th>
            <Th col="npuTops" current={column} direction={direction} onSort={handleSort}>
              <span title="Vendor-quoted NPU TOPS (typically Int8). Marketing numbers, not benchmarked — vendors measure differently.">NPU TOPS</span>
            </Th>
            <Th col="tdpW" current={column} direction={direction} onSort={handleSort} className="hidden sm:table-cell">
              <span title="Default / base TDP in watts, vendor-published. Hover a value for turbo/configurable ranges.">TDP</span>
            </Th>
            <Th col="memBwGBs" current={column} direction={direction} onSort={handleSort}>
              <span title="Peak memory bandwidth (GB/s). Where the vendor only publishes the memory spec (e.g. DDR5-6400 dual-channel), the GB/s is derived — hover the value for the formula.">Mem BW</span>
            </Th>
            <Th col="topsPerW" current={column} direction={direction} onSort={handleSort} className="hidden md:table-cell">
              <span title="Derived: NPU TOPS ÷ default TDP. Only computed where the vendor publishes both — n/a is honest, not zero.">TOPS/W</span>
            </Th>
            <Th col="bwPerCore" current={column} direction={direction} onSort={handleSort} className="hidden md:table-cell">
              <span title="Derived: peak memory bandwidth ÷ CPU core count (GB/s per core). A rough feeds-the-cores indicator, not a benchmark.">BW/core</span>
            </Th>
            <Th col="maxMemGB" current={column} direction={direction} onSort={handleSort} className="hidden lg:table-cell">
              <span title="Max supported memory (GB), vendor-published.">Max mem</span>
            </Th>
            <Th col="default" current={column} direction={direction} onSort={handleSort} sortable={false} className="hidden lg:table-cell">
              Released
            </Th>
            <Th col="default" current={column} direction={direction} onSort={handleSort} sortable={false}>
              <span title="Vendor spec sheet this row was curated from. Every URL was checked reachable on 2026-09-14.">Source</span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {sorted.map((c) => {
            const tw = topsPerW(c)
            return (
              <tr key={c.id} className="transition hover:bg-zinc-800/70">
                <td className="w-8 px-2 py-2 font-mono tabular-nums text-zinc-400">{(defaultIndex.get(c.id) ?? 0) + 1}</td>
                <td className="max-w-[220px] px-2 py-2">
                  <span className="font-medium">{c.name}</span>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {c.vendor} · {c.segment}
                    {c.process ? ` · ${c.process}` : ''}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-300">{c.cores}</td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 sm:table-cell">
                  {c.maxClockGhz === null ? (
                    <Na reason={c.clockNote} />
                  ) : (
                    <span title={c.clockNote}>
                      {c.maxClockGhz.toFixed(1)}
                      <span className="text-zinc-500"> GHz</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                  {c.npuTops === null ? <Na reason={c.npuNote} /> : <span title={c.npuNote}>{c.npuTops}</span>}
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 sm:table-cell">
                  {c.tdpW === null ? (
                    <Na reason={c.tdpNote} />
                  ) : (
                    <span title={c.tdpNote}>
                      {c.tdpW}
                      <span className="text-zinc-500"> W</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                  <span title={c.memBwNote}>
                    {c.memBwGBs.toLocaleString()}
                    <span className="text-zinc-500"> GB/s</span>
                    {c.memBwNote?.startsWith('Derived') && (
                      <span className="ml-1 font-sans text-[10px] text-zinc-500" title={c.memBwNote}>
                        drv
                      </span>
                    )}
                  </span>
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 md:table-cell">
                  {tw === null ? (
                    <Na reason="Needs both a vendor NPU TOPS figure and a vendor TDP — one of them isn't published for this chip." />
                  ) : (
                    <span title={`Derived: ${c.npuTops} TOPS ÷ ${c.tdpW} W default TDP.`}>{tw.toFixed(2)}</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 md:table-cell">
                  <span title={`Derived: ${c.memBwGBs.toLocaleString()} GB/s ÷ ${c.coresTotal} cores.`}>{bwPerCore(c).toFixed(1)}</span>
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 lg:table-cell">
                  {c.maxMemGB === null ? (
                    <Na reason="Max memory not published on the cited spec page." />
                  ) : (
                    <>
                      {c.maxMemGB}
                      <span className="text-zinc-500"> GB</span>
                    </>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-400 lg:table-cell">{c.released}</td>
                <td className="px-3 py-2 text-xs">
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={c.sourceNote}
                    className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 hover:text-emerald-300"
                  >
                    spec ↗
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
