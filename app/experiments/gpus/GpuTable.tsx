'use client'

// EXPERIMENT — self-contained sortable spec table for the /experiments/gpus prototype.
// Copies the minimal ArenaTable visual pattern locally instead of touching shared components
// (this page is an unlinked spike over static vendor specs — no verdicts, no evidence).

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import raw from '@/data/experiments/gpus.json'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

type Gpu = {
  id: string
  name: string
  vendor: string
  segment: string
  vramGB: number
  vramType: string
  memBwGBs: number
  memBwNote?: string
  aiPerf: { value: number; unit: string; note: string }
  tdpW: number | null
  tdpNote?: string
  msrpUsd: number | null
  msrpNote?: string
  released: string
  sourceUrl: string
  sourceNote?: string
}

const GPUS = raw.gpus as Gpu[]

type SortKey = 'default' | 'name' | 'vramGB' | 'memBwGBs' | 'aiPerf' | 'tdpW' | 'msrpUsd' | 'perfPerDollar' | 'bwPerW'
type SortDirection = 'asc' | 'desc'

// Derived, honestly: only where the vendor publishes both inputs. Units carry through — a
// consumer card's "AI TOPS/$" (FP4 sparse) is NOT comparable to another vendor's FP16 TFLOPS/$.
function perfPerDollar(g: Gpu): number | null {
  return g.msrpUsd !== null ? g.aiPerf.value / g.msrpUsd : null
}
function bwPerW(g: Gpu): number | null {
  return g.tdpW !== null ? g.memBwGBs / g.tdpW : null
}

function sortValue(g: Gpu, key: SortKey, defaultIndex: Map<string, number>): number | string | null {
  switch (key) {
    case 'default':
      return defaultIndex.get(g.id) ?? 0
    case 'name':
      return g.name.toLowerCase()
    case 'aiPerf':
      return g.aiPerf.value
    case 'perfPerDollar':
      return perfPerDollar(g)
    case 'bwPerW':
      return bwPerW(g)
    default:
      return g[key]
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

function formatBw(gbs: number): ReactNode {
  if (gbs >= 1000) {
    return (
      <>
        {(gbs / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        <span className="text-zinc-500"> TB/s</span>
      </>
    )
  }
  return (
    <>
      {gbs.toLocaleString()}
      <span className="text-zinc-500"> GB/s</span>
    </>
  )
}

export default function GpuTable() {
  const [column, setColumn] = useState<SortKey>('default')
  const [direction, setDirection] = useState<SortDirection>('asc')

  const defaultIndex = useMemo(() => new Map(GPUS.map((g, i) => [g.id, i])), [])

  const sorted = useMemo(() => {
    const rows = [...GPUS]
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
              GPU
            </Th>
            <Th col="vramGB" current={column} direction={direction} onSort={handleSort}>
              <span title="On-board memory (GB) and type, vendor-published.">VRAM</span>
            </Th>
            <Th col="memBwGBs" current={column} direction={direction} onSort={handleSort}>
              <span title="Peak memory bandwidth, vendor-published (B200: derived from the 8-GPU DGX system total — see the row tooltip).">Mem BW</span>
            </Th>
            <Th col="aiPerf" current={column} direction={direction} onSort={handleSort}>
              <span title="Vendor-quoted AI compute. CAUTION: precisions differ per row (FP4 sparse 'AI TOPS' vs dense FP8/FP16 TFLOPS) — sorting mixes units; read the unit on each cell.">AI perf</span>
            </Th>
            <Th col="tdpW" current={column} direction={direction} onSort={handleSort} className="hidden sm:table-cell">
              <span title="Total graphics / board power in watts, vendor-published.">TDP</span>
            </Th>
            <Th col="msrpUsd" current={column} direction={direction} onSort={handleSort} className="hidden sm:table-cell">
              <span title="Launch MSRP where one was announced. Datacenter and pro parts sell via OEM/cloud with no public list price. Street prices vary.">MSRP</span>
            </Th>
            <Th col="perfPerDollar" current={column} direction={direction} onSort={handleSort} className="hidden md:table-cell">
              <span title="Derived: vendor AI-perf figure ÷ launch MSRP. Unit shown per cell — only meaningful between rows quoting the same precision. n/a where there's no public price.">Perf/$</span>
            </Th>
            <Th col="bwPerW" current={column} direction={direction} onSort={handleSort} className="hidden md:table-cell">
              <span title="Derived: peak memory bandwidth (GB/s) ÷ TDP (W). A bandwidth-efficiency hint, not a benchmark.">BW/W</span>
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
          {sorted.map((g) => {
            const ppd = perfPerDollar(g)
            const bpw = bwPerW(g)
            return (
              <tr key={g.id} className="transition hover:bg-zinc-800/70">
                <td className="w-8 px-2 py-2 font-mono tabular-nums text-zinc-400">{(defaultIndex.get(g.id) ?? 0) + 1}</td>
                <td className="max-w-[220px] px-2 py-2">
                  <span className="font-medium">{g.name}</span>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {g.vendor} · {g.segment}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300">
                  {g.vramGB}
                  <span className="text-zinc-500"> GB</span>
                  <span className="ml-1 font-sans text-[10px] text-zinc-500">{g.vramType}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300">
                  <span title={g.memBwNote}>{formatBw(g.memBwGBs)}</span>
                  {g.memBwNote?.startsWith('Derived') && (
                    <span className="ml-1 font-sans text-[10px] text-zinc-500" title={g.memBwNote}>
                      drv
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300">
                  <span title={g.aiPerf.note}>
                    {g.aiPerf.value.toLocaleString()}
                    <span className="ml-1 font-sans text-[10px] text-zinc-500">{g.aiPerf.unit}</span>
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300 sm:table-cell">
                  {g.tdpW === null ? (
                    <Na reason={g.tdpNote} />
                  ) : (
                    <span title={g.tdpNote}>
                      {g.tdpW.toLocaleString()}
                      <span className="text-zinc-500"> W</span>
                    </span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300 sm:table-cell">
                  {g.msrpUsd === null ? (
                    <Na reason={g.msrpNote} />
                  ) : (
                    <span title={g.msrpNote}>${g.msrpUsd.toLocaleString()}</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300 md:table-cell">
                  {ppd === null ? (
                    <Na reason="No public launch MSRP for this part, so a per-dollar figure would be invented." />
                  ) : (
                    <span title={`Derived: ${g.aiPerf.value.toLocaleString()} ${g.aiPerf.unit} ÷ $${g.msrpUsd?.toLocaleString()} launch MSRP. Only compare rows quoting the same precision.`}>
                      {ppd.toFixed(2)}
                      <span className="ml-1 font-sans text-[10px] text-zinc-500">{g.aiPerf.unit.split(' ')[0]}/$</span>
                    </span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300 md:table-cell">
                  {bpw === null ? (
                    <Na reason="Per-GPU TDP not published on the cited page." />
                  ) : (
                    <span title={`Derived: ${g.memBwGBs.toLocaleString()} GB/s ÷ ${g.tdpW?.toLocaleString()} W.`}>{bpw.toFixed(1)}</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-400 lg:table-cell">{g.released}</td>
                <td className="px-3 py-2 text-xs">
                  <a
                    href={g.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={g.sourceNote}
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
