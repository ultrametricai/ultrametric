import type { Metadata } from 'next'
import Link from 'next/link'
import AiNativeIndexTable from '@/components/AiNativeIndexTable'
import RankingsNav from '@/components/RankingsNav'
import { loadAll } from '@/lib/data'

export function generateMetadata(): Metadata {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)
  return {
    title: `Full Built-in AI ranking — all ${totalProducts} products — Ultrametric`,
    description: `Every product from every ranking, ranked by BUILT-IN AI — does the product act agentically on its own behalf (built-in assistant, autonomous automation, natural-language commands)? Evidence-graded, no opinion.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Full companion to the
// homepage's top-12 preview table (see app/page.tsx's "Global rankings" section).
export const dynamic = 'force-static'

export default function AiNativeRankingPage() {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Global ranking</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Best built-in AI — best for humans working with AI</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {totalProducts} products from every ranking, ranked by BUILT-IN AI: does the product act agentically on
          its own behalf (built-in assistant, autonomous automation, natural-language commands)? Ties break on
          automation depth, then Overall score.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          This is the deep-linkable form of the homepage table&rsquo;s &ldquo;Best built-in AI&rdquo; preset —{' '}
          <Link href="/" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            sort and filter it live there →
          </Link>
        </p>
      </div>
      <AiNativeIndexTable categories={categories} />
      <RankingsNav current="ai-native" />
    </div>
  )
}
