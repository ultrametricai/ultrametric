import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { EXPLORE_SECTION_ICONS } from '@/lib/arenaIcons'
import ProductLogoView from '@/components/ProductLogoView'
import RankingsNav from '@/components/RankingsNav'
import { hasLogo } from '@/lib/logos'
import { processIcon } from '@/lib/processIcons'
import { loadProcesses, processSlug } from '@/lib/processes'
import { processLeaderboard, type ProcessLeaderboardEntry } from '@/lib/processRankings'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// 🔁 PROCESS ranking (founder 2026-09-21). Ranks processes by how well the market already
// serves them: each process's TOP processLeaderboard entry (lib/processRankings.ts) — the best
// single vendor's coverage × step-quality score, derived entirely from judged story verdicts.
// A high score means one vendor already runs most of the process well; a low or absent score
// means the market has no single good answer yet.

interface CoveredRow {
  slug: string
  title: string
  icon: string
  phase: string
  top: ProcessLeaderboardEntry | null
  rankableSteps: number
  totalSteps: number
}

function buildRows(): CoveredRow[] {
  const rows: CoveredRow[] = loadProcesses().map((t) => {
    const lb = processLeaderboard(t)
    return {
      slug: processSlug(t.title),
      title: t.title,
      icon: processIcon(t.id),
      phase: t.phase,
      top: lb.entries[0] ?? null,
      rankableSteps: lb.rankableSteps,
      totalSteps: lb.totalSteps,
    }
  })
  return rows.sort((a, b) => {
    if (a.top === null && b.top === null) return a.title.localeCompare(b.title)
    if (a.top === null) return 1
    if (b.top === null) return -1
    return b.top.processScore - a.top.processScore || a.title.localeCompare(b.title)
  })
}

export function generateMetadata(): Metadata {
  const rows = buildRows()
  const leader = rows[0]
  return {
    title: `Best-covered processes — all ${rows.length} ranked by market coverage — Ultrametric`,
    description: `Which founder processes does the software market already serve best? ${leader?.top ? `${leader.title} leads: ${leader.top.name} scores ${leader.top.processScore}/100 across its ranked steps.` : ''} Derived from judged story verdicts, never vibes.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time.
export const dynamic = 'force-static'

export default function BestCoveredProcessesPage() {
  const rows = buildRows()

  return (
    <div className="space-y-4">
      <div>
        {/* seed "best-covered": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-sky-400">
          <GeoMark seed="best-covered" title="Best covered by the market — process ranking" size={16} className="text-zinc-500" />
          {/* The house loop glyph (lib/arenaIcons.ts) — same icon the Explore menu's
              Process-rankings group wears; the eyebrow text names the concept. */}
          <span aria-hidden className="inline-flex"><IconGlyph icon={EXPLORE_SECTION_ICONS.processRankings} /></span>
          Process ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Best covered — where the market already serves you
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          This ranks <strong className="font-semibold text-zinc-200">processes, not companies</strong>: all {rows.length} founder
          processes ordered by their best single vendor&rsquo;s process score (lib/processRankings.ts processLeaderboard) —
          coverage × step quality over the process&rsquo;s rankable steps, computed from judged story verdicts. The chip is that
          #1 vendor; &ldquo;steps ranked&rdquo; says how much of the process the score can even see. Processes with no rankable
          step are unscored (never zero) and sort last.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Process</th>
              <th className="px-3 py-2 font-normal" title="The single vendor with the highest process score (coverage × judged step quality)">
                #1 vendor
              </th>
              <th className="px-3 py-2 font-normal" title="That vendor's process score: sum of its step scores over all rankable steps, 0–100">
                Process score
              </th>
              <th className="px-3 py-2 font-normal" title="Steps with a committed story mapping and judged verdicts / total steps">
                Steps ranked
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
                  {r.top ? (
                    <Link
                      href={`/arena/${r.top.arenaId}/product/${r.top.productId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
                    >
                      <ProductLogoView product={{ id: r.top.productId, name: r.top.name }} size={14} hasLogo={hasLogo(r.top.productId)} />
                      {r.top.name}
                    </Link>
                  ) : (
                    <span className="text-xs italic text-zinc-500" title="No step of this process has a committed story mapping with judged verdicts yet.">
                      no ranked vendor yet
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">
                  {r.top ? (
                    <>{r.top.processScore}<span className="text-zinc-500">/100</span></>
                  ) : (
                    <span className="font-sans text-xs italic text-zinc-500">unscored</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                  {r.rankableSteps}<span className="text-zinc-500">/{r.totalSteps}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="best-covered" />
    </div>
  )
}
