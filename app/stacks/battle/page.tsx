import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import GeoMark from '@/components/GeoMark'
import StackBattle, { type BattlePreset } from '@/components/StackBattle'
import { resolveAllStacks } from '@/lib/aiStacks'
import { battleSlug, loadAll } from '@/lib/data'
import { loadIntegrationGraph, verifiedPairKeys } from '@/lib/integrations'
import { buildMyStackProducts } from '@/lib/myStackData'

export const metadata: Metadata = {
  title: 'Battle of the stacks — Ultrametric',
  description:
    'Put two stacks side by side — curated AI stacks or your own product lists — and compare their evidence aggregates: mean Overall score, agent-readiness, arena coverage, verified interconnects, and the weakest link. Aggregates of published scores, not a judged head-to-head.',
}

// Static shell, same contract as /compare: the matchup lives in `?a=…&b=…` (a curated stack id
// or a comma-separated product list per side), read client-side by StackBattle via a
// Suspense-wrapped useSearchParams. Presets are the curated ai-stacks resolved at build time to
// their current evidence-backed picks, so a preset side always fields today's slot winners.
export default function StackBattlePage() {
  const categories = loadAll()
  const products = buildMyStackProducts(categories)
  const verifiedPairs = verifiedPairKeys(loadIntegrationGraph(categories.map((d) => d.category.id)))
  // Curated presets → product-id lists (scored slots only; editorial slots have no product to
  // field). Ids can repeat across slots in theory — dedupe keeps the aggregates honest.
  const presets: BattlePreset[] = resolveAllStacks(categories).map((stack) => ({
    id: stack.id,
    name: stack.name,
    productIds: [...new Set(stack.slots.flatMap((s) => (s.productId ? [s.productId] : [])))],
  }))
  // Every live battle page as an `{arenaId}/{a}-vs-{b}` key, in the battles' stored order — so
  // slot rows only link to judged battle pages that actually exist in the static export.
  const battleSlugs = categories.flatMap((data) =>
    data.rankings.battles.map((b) => `${data.category.id}/${battleSlug(b.a, b.b)}`),
  )

  return (
    <div className="space-y-8">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="font-display leading-[1.1] mt-1 flex items-center justify-center gap-2.5 text-3xl font-bold tracking-tight">
          <GeoMark seed="stack-battle" title="Battle of the stacks — two stacks' evidence aggregates, side by side" size={22} className="text-zinc-500" />
          Battle of the stacks
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          Two stacks, side by side: curated{' '}
          <Link href="/stacks" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            AI stacks
          </Link>{' '}
          or your own product lists. We compare the aggregates the evidence supports — mean Overall
          score, agent-readiness, arena coverage, verified interconnects, weakest link — and
          where both sides field one product in the same arena, we link the real judged battle.
          Have a stack already? Start from{' '}
          <Link href="/my-stack" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            My Stack
          </Link>
          .
        </p>
      </section>

      <Suspense fallback={null}>
        <StackBattle products={products} presets={presets} verifiedPairs={verifiedPairs} battleSlugs={battleSlugs} />
      </Suspense>
    </div>
  )
}
