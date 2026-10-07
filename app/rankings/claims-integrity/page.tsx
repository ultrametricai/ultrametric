import type { Metadata } from 'next'
import Link from 'next/link'
import ClaimsIntegrityIndexTable from '@/components/ClaimsIntegrityIndexTable'
import RankingsNav from '@/components/RankingsNav'
import { loadAll } from '@/lib/data'

export function generateMetadata(): Metadata {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)
  return {
    title: `Claims vs reality ranking — all ${totalProducts} products — Ultrametric`,
    description: `Every product from every ranking, ranked by claims integrity — how well the vendor's own website claims survive independent verification. Verified claims count fully, contradicted claims count doubly against. Evidence-graded, no opinion.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Fourth global ranking,
// alongside /rankings/agentic, /rankings/ai-native and /rankings/init.
export const dynamic = 'force-static'

export default function ClaimsIntegrityRankingPage() {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Global ranking</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Claims vs reality — who delivers what their website promises</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {totalProducts} products from every ranking, ranked by claims integrity: each vendor&rsquo;s own
          capability claims, reconciled against our judge&rsquo;s independent verdicts. Verified claims count fully,
          unverified ones count for nothing, and each contradicted claim cancels two verified ones —{' '}
          <Link
            href="/methodology#claims-integrity"
            title="How claims integrity is computed — full definitions on /methodology"
            className="font-mono text-xs underline decoration-zinc-700 hover:text-emerald-300"
          >
            100 × max(0, verified − 2×contradicted) / testable
          </Link>
          . Products with no testable claims are unscored (null, never zero) and sort last.
        </p>
      </div>
      <ClaimsIntegrityIndexTable categories={categories} />
      <RankingsNav current="claims-integrity" />
    </div>
  )
}
