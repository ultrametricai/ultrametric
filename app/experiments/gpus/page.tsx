import type { Metadata } from 'next'
import Link from 'next/link'
import GpuTable from './GpuTable'
import raw from '@/data/experiments/gpus.json'

// Formerly an unlinked experiment; graduated 2026-09 into the evidence-judged GPUs & AI
// Accelerators arena (/arena/gpus — same curated roster, judged on user stories with
// citations). This page stays live as the arena's raw vendor-spec annex: the numbers vendors
// publish, side by side, with per-cell sourcing. Linked from the arena header
// ("Raw spec table →"); the arena link below is the way back.
export const metadata: Metadata = {
  title: 'GPU spec table — Ultrametric',
  description:
    'Raw vendor-spec annex of the GPUs & AI Accelerators ranking: current consumer and datacenter GPU specs side by side, curated from vendor spec sheets with per-cell sourcing.',
}

export default function GpusSpecsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          <Link href="/arena/gpus" title="Back to the evidence-judged GPUs & AI Accelerators ranking" className="transition hover:text-emerald-300">
            GPUs &amp; AI Accelerators ranking
          </Link>
          {' '}· specs annex
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold leading-[1.1] tracking-tight">GPU comparison</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Current GPUs side by side — GeForce RTX 50-series and Radeon RDNA 4 on the consumer end, RTX PRO for
          workstations, and H200 / B200 / Instinct MI355X in the datacenter — on the raw numbers vendors publish.
          For the evidence-judged leaderboard over the same roster (user stories, citations, verdicts), see the{' '}
          <Link href="/arena/gpus" className="text-emerald-300 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-200">
            GPUs &amp; AI Accelerators ranking
          </Link>
          .
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Curated {raw.curatedAt} · {raw.gpus.length} GPUs · every source URL checked reachable · hover any header or
          value for what it means and where it came from
        </p>
      </div>
      <GpuTable />
      <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
        Honesty notes: the AI-perf column is <em>not</em> apples-to-apples — NVIDIA quotes consumer cards in FP4
        &ldquo;AI TOPS&rdquo; with sparsity, AMD quotes FP16 matrix TFLOPS for Radeon, and datacenter parts are shown
        as dense FP8 TFLOPS; the unit is printed on every cell and sorting mixes them. Cells marked{' '}
        <span className="font-mono">drv</span> are derived from published system totals or memory specs (formula in
        the tooltip). <span className="text-zinc-400">n/a</span> means unpublished, not zero. MSRPs are launch list
        prices where announced — street prices have varied widely.
      </p>
    </div>
  )
}
