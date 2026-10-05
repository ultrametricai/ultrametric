import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { EXPLORE_SECTION_ICONS } from '@/lib/arenaIcons'
import RankingsNav from '@/components/RankingsNav'
import { buildProcessRows } from '@/lib/processRows'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// 🔁 PROCESS ranking (founder 2026-09-21). Ranks processes by the corpus's curated `annoyance`
// ordering (processes/corpus.json, 1–5: how much of a toil the process is by hand). Ties break
// on cadence, most frequent first — regularity × annoyance is the pain story: a 5/5 chore you
// hit monthly hurts more than one you hit once. Rows come straight from buildProcessRows.

function buildRows() {
  const { rows } = buildProcessRows()
  return [...rows].sort(
    (a, b) => b.annoyance - a.annoyance || a.cadenceRank - b.cadenceRank || a.title.localeCompare(b.title),
  )
}

export function generateMetadata(): Metadata {
  const rows = buildRows()
  return {
    title: `Most annoying processes — all ${rows.length} ranked by drudgery — Ultrametric`,
    description:
      'Every founder process ranked by curated annoyance (1–5 drudgery by hand), with its real operating cadence — because a monthly 5/5 chore hurts more than a one-time one.',
  }
}

// Static page — no dynamic segments, all data bundled at build time.
export const dynamic = 'force-static'

export default function MostAnnoyingProcessesPage() {
  const rows = buildRows()

  return (
    <div className="space-y-4">
      <div>
        {/* seed "most-annoying": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-sky-400">
          <GeoMark seed="most-annoying" title="Most annoying — process ranking" size={16} className="text-zinc-500" />
          {/* The house loop glyph (lib/arenaIcons.ts) — same icon the Explore menu's
              Process-rankings group wears; the eyebrow text names the concept. */}
          <span aria-hidden className="inline-flex"><IconGlyph icon={EXPLORE_SECTION_ICONS.processRankings} /></span>
          Process ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Most annoying — the biggest drudgery, on repeat
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          This ranks <strong className="font-semibold text-zinc-200">processes, not companies</strong>: all {rows.length} founder
          processes ordered by the corpus&rsquo;s curated annoyance score (processes/corpus.json `annoyance`, 1–5 — how much of a
          toil it is by hand). Ties break on cadence, most frequent first: regularity × annoyance is the real pain story, so a
          monthly 5/5 outranks a once-ever 5/5.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Process</th>
              <th className="px-3 py-2 font-normal" title="Curated drudgery score: 1 (painless) to 5 (pure toil by hand)">
                Annoyance
              </th>
              <th className="px-3 py-2 font-normal" title="How often this process actually recurs in a running company (the operating-rhythm axis)">
                Cadence
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
                  <span className="mt-0.5 block text-xs text-zinc-500">{r.phase}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono tabular-nums text-amber-300">{r.annoyance}</span>
                  <span className="text-zinc-500">/5</span>
                  <span aria-hidden className="ml-2 tracking-tighter text-amber-400/70">{'▮'.repeat(r.annoyance)}</span>
                </td>
                <td className="px-3 py-2 text-zinc-300">{r.cadenceLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="most-annoying" />
    </div>
  )
}
