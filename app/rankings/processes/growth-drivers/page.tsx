import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { EXPLORE_SECTION_ICONS } from '@/lib/arenaIcons'
import RankingsNav from '@/components/RankingsNav'
import { buildProcessRows } from '@/lib/processRows'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// 🔁 PROCESS ranking (founder 2026-09-21). Ranks processes by the corpus's curated
// `growthImpact` ordering (processes/corpus.json, 1–5: how directly the process drives
// revenue/user growth — daily feature shipping and outbound at 5, compliance filings at 1).
// Ties break on title. Rows come straight from buildProcessRows.

function buildRows() {
  const { rows } = buildProcessRows()
  return [...rows].sort((a, b) => b.growthImpact - a.growthImpact || a.title.localeCompare(b.title))
}

export function generateMetadata(): Metadata {
  const rows = buildRows()
  return {
    title: `Growth-driver processes — all ${rows.length} ranked by growth impact — Ultrametric`,
    description:
      'Every founder process ranked by curated growth impact (1–5: how directly it drives revenue and user growth), with the company phase each one belongs to.',
  }
}

// Static page — no dynamic segments, all data bundled at build time.
export const dynamic = 'force-static'

export default function GrowthDriverProcessesPage() {
  const rows = buildRows()

  return (
    <div className="space-y-4">
      <div>
        {/* seed "growth-drivers": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-sky-400">
          <GeoMark seed="growth-drivers" title="Growth drivers — process ranking" size={16} className="text-zinc-500" />
          {/* The house loop glyph (lib/arenaIcons.ts) — same icon the Explore menu's
              Process-rankings group wears; the eyebrow text names the concept. */}
          <span aria-hidden className="inline-flex"><IconGlyph icon={EXPLORE_SECTION_ICONS.processRankings} /></span>
          Process ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Growth drivers — the processes that move revenue
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          This ranks <strong className="font-semibold text-zinc-200">processes, not companies</strong>: all {rows.length} founder
          processes ordered by the corpus&rsquo;s curated growth-impact score (processes/corpus.json `growthImpact`, 1–5 — how
          directly the process drives revenue/user growth; daily feature shipping and outbound sit at 5, compliance filings
          at 1). Ties break on title; the phase column says when in a company&rsquo;s life each one lands.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Process</th>
              <th className="px-3 py-2 font-normal" title="Curated growth impact: 1 (compliance) to 5 (directly drives revenue/user growth)">
                Growth impact
              </th>
              <th className="px-3 py-2 font-normal" title="The company phase this process belongs to (the founder timeline)">
                Phase
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((r, i) => (
              <tr key={r.slug} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{ordinal(i + 1)}</td>
                <td className="px-3 py-2">
                  <Link href={`/processes/${r.slug}`} className="flex items-center gap-2 font-medium hover:text-emerald-300">
                    <span aria-hidden className="w-4 shrink-0 text-center text-xs leading-none opacity-80"><IconGlyph icon={r.icon} /></span>
                    <span className="min-w-0 truncate">{r.title}</span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono tabular-nums text-emerald-300">{r.growthImpact}</span>
                  <span className="text-zinc-500">/5</span>
                  <span aria-hidden className="ml-2 tracking-tighter text-emerald-400/70">{'▮'.repeat(r.growthImpact)}</span>
                </td>
                <td className="px-3 py-2 text-zinc-300">{r.phase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="growth-drivers" />
    </div>
  )
}
