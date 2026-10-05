import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { EXPLORE_SECTION_ICONS } from '@/lib/arenaIcons'
import RankingsNav from '@/components/RankingsNav'
import { buildProcessRows } from '@/lib/processRows'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// 🔁 PROCESS ranking (founder 2026-09-21). Ranks processes by the corpus's curated `risk`
// ordering (processes/corpus.json, 1–5: the cost of getting it wrong — legal / tax / security
// exposure). Ties break on how much of the process still runs through forms or people (the
// exposure usually lives in the human steps), then title. Rows come straight from
// buildProcessRows — the same derivation /processes renders.

function buildRows() {
  const { rows } = buildProcessRows()
  return [...rows].sort(
    (a, b) =>
      b.risk - a.risk ||
      (b.totalSteps - b.agentSteps) - (a.totalSteps - a.agentSteps) ||
      a.title.localeCompare(b.title),
  )
}

export function generateMetadata(): Metadata {
  const rows = buildRows()
  return {
    title: `Riskiest processes — all ${rows.length} ranked by cost of getting it wrong — Ultrametric`,
    description:
      'Every founder process ranked by curated risk (1–5: legal, tax, and security exposure), with the human and form steps that carry most of that exposure counted per process.',
  }
}

// Static page — no dynamic segments, all data bundled at build time.
export const dynamic = 'force-static'

export default function RiskiestProcessesPage() {
  const rows = buildRows()

  return (
    <div className="space-y-4">
      <div>
        {/* seed "riskiest": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-sky-400">
          <GeoMark seed="riskiest" title="Riskiest — process ranking" size={16} className="text-zinc-500" />
          {/* The house loop glyph (lib/arenaIcons.ts) — same icon the Explore menu's
              Process-rankings group wears; the eyebrow text names the concept. */}
          <span aria-hidden className="inline-flex"><IconGlyph icon={EXPLORE_SECTION_ICONS.processRankings} /></span>
          Process ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Riskiest — the highest cost of getting it wrong
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          This ranks <strong className="font-semibold text-zinc-200">processes, not companies</strong>: all {rows.length} founder
          processes ordered by the corpus&rsquo;s curated risk score (processes/corpus.json `risk`, 1–5 — legal / tax / security
          exposure; the DE franchise tax and the federal return sit at 5, naming a brand at 1). Ties break on the number of
          steps still done by forms or people — where the exposure usually lives — then title.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Process</th>
              <th className="px-3 py-2 font-normal" title="Curated cost of getting it wrong: 1 (shrug) to 5 (legal/tax/security exposure)">
                Risk
              </th>
              <th className="px-3 py-2 font-normal" title="Steps still routed through forms or people (total steps minus agent-runnable steps)">
                Human/manual steps
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
                  <span className="font-mono tabular-nums text-rose-300">{r.risk}</span>
                  <span className="text-zinc-500">/5</span>
                  <span aria-hidden className="ml-2 tracking-tighter text-rose-400/70">{'▮'.repeat(r.risk)}</span>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                  {r.totalSteps - r.agentSteps}
                  <span className="text-zinc-500">/{r.totalSteps}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="riskiest" />
    </div>
  )
}
