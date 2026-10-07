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

// My vendors — the vendors half of the user area (founder 2026-09-22: "a user area where they
// can set their vendors — if they set 'I'm using this' it will be recorded and have an area in
// their settings"; 2026-09-23: split out of /account onto its own page behind the shared
// sidebar, app/account/layout.tsx). The same account stack every "I'm using" click on a product
// page writes, and the same store the process pages personalize from. Static shell — all
// personal state is client-gated (lib/session.ts + lib/myStack.ts); the server never sees a
// stack, so the prerendered HTML is identical for anonymous readers.
export const metadata: Metadata = {
  title: 'My vendors — Ultrametric',
  description: 'The vendors you run, per ranking — recorded from “I’m using this” and synced to your account.',
  // Session-gated content: noindex, and deliberately absent from app/sitemap.ts (same posture
  // as /account and /watchlist).
  robots: { index: false, follow: false },
}

export default function AccountVendorsPage() {
  const categories = loadAll()
  const products = buildMyStackProducts(categories)
  const verifiedPairs = verifiedPairKeys(loadIntegrationGraph(categories.map((d) => d.category.id)))
  const sections = loadArenaSections().map((s) => ({ name: s.name, arenaIds: s.arenaIds }))

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display leading-[1.1] mt-1 flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <GeoMark seed="my-vendors" title="Your vendors" size={22} className="text-zinc-500" />
          My vendors
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          The software you actually run — your picks per ranking, several allowed (Mercury AND
          Brex is a real stack). Every{' '}
          <span className="text-emerald-300">&ldquo;I&rsquo;m using this&rdquo;</span> click on a
          product page is recorded here, and everything here personalizes the{' '}
          <Link href="/processes" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            process pages
          </Link>{' '}
          (your vendor drives each step it covers) and your{' '}
          <Link href="/my-stack" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            stack advice
          </Link>
          . Signed in, it syncs to your account; signed out, it stays on this device.
        </p>
        <YourStack products={products} sections={sections} />
        <Suspense fallback={null}>
          <MyStackBuilder
            products={products}
            adjacency={adjacencyClusters as string[][]}
            curatedStackArenas={curatedStackArenaPatterns()}
            verifiedPairs={verifiedPairs}
          />
        </Suspense>
      </section>
    </div>
  )
}
