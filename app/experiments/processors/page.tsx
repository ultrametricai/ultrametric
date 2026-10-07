import type { Metadata } from 'next'
import Link from 'next/link'
import ProcessorTable from './ProcessorTable'
import raw from '@/data/experiments/processors.json'

// Formerly an unlinked experiment; graduated 2026-09 into the evidence-judged Processors arena
// (/arena/processors — same curated roster, judged on user stories with citations). This page
// stays live as the arena's raw vendor-spec annex: the numbers vendors publish, side by side,
// with per-cell sourcing. Linked from the arena header ("Raw spec table →"); the arena link
// below is the way back.
export const metadata: Metadata = {
  title: 'Processor spec table — Ultrametric',
  description:
    'Raw vendor-spec annex of the Processors ranking: current CPU/SoC specs side by side, curated from vendor spec sheets with per-cell sourcing.',
}

export default function ProcessorsSpecsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          <Link href="/arena/processors" title="Back to the evidence-judged Processors ranking" className="transition hover:text-emerald-300">
            Processors ranking
          </Link>
          {' '}· specs annex
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold leading-[1.1] tracking-tight">Processor comparison</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Current desktop and laptop silicon side by side — Apple M-series, AMD Zen 5 / Strix Halo, Intel Arrow
          and Lunar Lake, and Qualcomm&rsquo;s Snapdragon X2 — on the raw numbers vendors actually publish. For the
          evidence-judged leaderboard over the same roster (user stories, citations, verdicts), see the{' '}
          <Link href="/arena/processors" className="text-emerald-300 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-200">
            Processors ranking
          </Link>
          .
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Curated {raw.curatedAt} · {raw.chips.length} chips · every source URL checked reachable · hover any header
          or value for what it means and where it came from
        </p>
      </div>
      <ProcessorTable />
      <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
        Honesty notes: vendor TOPS figures use different precisions and test conditions and are not benchmark
        results. Cells marked <span className="font-mono">drv</span> are derived from the vendor&rsquo;s published
        memory spec (formula in the tooltip), because the vendor doesn&rsquo;t state a GB/s number.{' '}
        <span className="text-zinc-400">n/a</span> means the vendor doesn&rsquo;t publish the figure — unpublished,
        not zero. Prices are omitted: most of these chips ship inside devices and have no standalone list price.
      </p>
    </div>
  )
}
