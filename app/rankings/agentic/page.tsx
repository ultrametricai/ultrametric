import type { Metadata } from 'next'
import Link from 'next/link'
import AgenticIndexTable from '@/components/AgenticIndexTable'
import RankingsNav from '@/components/RankingsNav'
import { loadAll } from '@/lib/data'

export function generateMetadata(): Metadata {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)
  return {
    title: `Full agentic ranking — all ${totalProducts} products — Ultrametric`,
    description: `Every product from every ranking, ranked by AGENT-READY — can an agent reach it at all (API/CLI/MCP/webhooks/SDKs/docs)? Evidence-graded, no opinion.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Full companion to the
// homepage's top-12 preview table (see app/page.tsx's "Global rankings" section).
export const dynamic = 'force-static'

export default function AgenticRankingPage() {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Global ranking</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Most agent-ready — best for AI agents</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {totalProducts} products from every ranking, ranked by AGENT-READY: can an agent reach the product
          at all (API/CLI/MCP/webhooks/SDKs/docs)? Ties break on API quality, then Overall score.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          This is the deep-linkable form of the homepage table&rsquo;s &ldquo;Most agent-ready&rdquo; preset —{' '}
          <Link href="/" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            sort and filter it live there →
          </Link>
        </p>
      </div>
      <AgenticIndexTable categories={categories} />
      <RankingsNav current="agentic" />
    </div>
  )
}
