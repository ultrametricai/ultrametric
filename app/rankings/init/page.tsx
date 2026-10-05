import type { Metadata } from 'next'
import Link from 'next/link'
import InitIndexTable, { buildInitIndex } from '@/components/InitIndexTable'
import RankingsNav from '@/components/RankingsNav'
import { loadAll } from '@/lib/data'

export function generateMetadata(): Metadata {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)
  return {
    title: `Full Overall score ranking — all ${totalProducts} products — Ultrametric`,
    description: `Every product across every arena ranked by the blended Overall score (agent-ready, API quality, openness, agentic app, automation). Evidence-graded, no opinion.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Third global ranking,
// alongside /rankings/agentic and /rankings/ai-native.
export const dynamic = 'force-static'

export default function InitRankingPage() {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)
  const rows = buildInitIndex(categories)
  const maxScore = rows.reduce((max, row) => (row.entry.aiEra !== null && row.entry.aiEra > max ? row.entry.aiEra : max), 0)
  const leader = rows.find((r) => r.entry.aiEra === maxScore)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Global ranking</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Highest Overall score</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {totalProducts} products across every arena, ranked by the blended Overall score — agent-ready, API
          quality, openness, agentic app, and automation, all agent tested. Ties break on the raw coverage score.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          This is the deep-linkable form of the homepage table&rsquo;s &ldquo;Highest Overall score&rdquo; preset —{' '}
          <Link href="/" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            sort and filter it live there →
          </Link>
        </p>
      </div>
      <div className="rounded-xl border border-emerald-800/60 bg-emerald-400/5 p-4">
        <p className="text-xs uppercase tracking-widest text-emerald-400">Highest score found</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
          {maxScore.toFixed(0)}/100
          {leader && <span className="ml-2 text-sm font-normal text-zinc-400">— {leader.product.name}</span>}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          {maxScore > 50
            ? `At least one product has broken 50/100 — the agent-tested ceiling is climbing.`
            : `No product scores above 50/100 yet — the AI-ready era is young.`}
        </p>
      </div>
      <InitIndexTable categories={categories} />
      <RankingsNav current="init" />
    </div>
  )
}
