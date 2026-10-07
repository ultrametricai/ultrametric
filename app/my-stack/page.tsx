import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import GeoMark from '@/components/GeoMark'
import MyStackBuilder from '@/components/MyStackBuilder'
import YourStack from '@/components/YourStack'
import adjacencyClusters from '@/data/adjacent-arenas.json'
import { loadArenaSections } from '@/lib/arenaSections'
import { loadAll } from '@/lib/data'
import { loadIntegrationGraph, verifiedPairKeys } from '@/lib/integrations'
import { buildMyStackProducts, curatedStackArenaPatterns } from '@/lib/myStackData'

export const metadata: Metadata = {
  title: 'My Stack — Ultrametric',
  description:
    'Enter the stack you already run and get evidence-cited recommendations: upgrades where a rival scores materially higher, adjacent rankings you have nothing in, possible overlaps, vendor consolidations, and break-outs — every number from the live rankings, with a shareable URL.',
}

// Static shell, same contract as /compare and /stacks/builder: the page prerenders once; the
// reader's stack lives in `?s=id1,id2` (and this browser's localStorage), read client-side by
// MyStackBuilder via a Suspense-wrapped useSearchParams — no server ever sees the stack.
export default function MyStackPage() {
  const categories = loadAll()
  const products = buildMyStackProducts(categories)
  const verifiedPairs = verifiedPairKeys(loadIntegrationGraph(categories.map((d) => d.category.id)))
  // The header's curated arena groupings, reused to organize the signed-in "Your stack" pickers
  // (lean {name, arenaIds} rows — YourStack drops arenas the catalog doesn't rank).
  const sections = loadArenaSections().map((s) => ({ name: s.name, arenaIds: s.arenaIds }))

  return (
    <div className="space-y-8">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="font-display leading-[1.1] mt-1 flex items-center justify-center gap-2.5 text-3xl font-bold tracking-tight">
          <GeoMark seed="my-stack" title="My Stack — recommendations for the stack you already run" size={22} className="text-zinc-500" />
          My Stack
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          Tell us what you already run and we&rsquo;ll hold it against the ranking evidence:
          upgrades where a rival scores materially higher, adjacent rankings you have nothing in,
          possible overlaps, one-family consolidations, and jobs worth splitting out to a
          specialist. Every suggestion cites the published scores it rests on. Starting fresh
          instead? Try the{' '}
          <Link href="/stacks/builder" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            stack builder
          </Link>{' '}
          or the{' '}
          <Link href="/stacks" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            curated AI stacks
          </Link>
          .
        </p>
      </section>

      {/* Signed-in: define the account stack (one pick per arena) + upgraded stack advice;
          signed-out: a "sign up to save your stack" prompt. Client-gated (lib/session.ts) —
          the static HTML carries neither state. */}
      <YourStack products={products} sections={sections} />

      <Suspense fallback={null}>
        <MyStackBuilder
          products={products}
          adjacency={adjacencyClusters as string[][]}
          curatedStackArenas={curatedStackArenaPatterns()}
          verifiedPairs={verifiedPairs}
        />
      </Suspense>
    </div>
  )
}
