import type { Metadata } from 'next'
import WatchlistClient from '@/components/WatchlistClient'
import WatchlistGate from '@/components/WatchlistGate'
import { loadAll } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { loadScoreHistory } from '@/lib/scoreHistory'
import type { WatchlistProduct } from '@/lib/watchlist'

// Static shell + client list: the page pre-serializes ONE lean row per product in every arena
// (id/name/arena/scores/history — see lib/watchlist.ts's WatchlistProduct doc), and
// components/WatchlistClient.tsx filters it against the starred ids in this browser's
// localStorage (kept in step with the account store via lib/watchlist.ts's /api/watchlist
// sync). No per-user build output — the whole list ships to everyone, the star selection stays
// client-side. WatchlistGate (WorkOS session, lib/session.ts) decides client-side who sees
// the list: logged-in readers get it, anonymous readers get a log-in prompt — the page itself
// stays open (no notFound) but is left out of app/sitemap.ts, since the content is session-gated.

export const metadata: Metadata = {
  title: 'Watchlist — Ultrametric',
  description: 'Products you starred across every ranking, with current scores and 30-day trends. Saved to your account.',
  // Session-gated content, same posture as /account and /processes/*/mine.
  robots: { index: false, follow: false },
}

function buildWatchlistProducts(): WatchlistProduct[] {
  const rows: WatchlistProduct[] = []
  for (const data of loadAll()) {
    const history = loadScoreHistory(data.category.id)
    const productById = new Map(data.products.map((p) => [p.id, p]))
    for (const entry of data.rankings.leaderboard) {
      const product = productById.get(entry.productId)
      if (!product) continue
      rows.push({
        id: product.id,
        name: product.name,
        hasLogo: hasLogo(product.id),
        arenaId: data.category.id,
        arenaName: data.category.name,
        aiEra: entry.aiEra,
        agentReady: entry.agentReady,
        shutdown: product.shutdown,
        history: (history.get(product.id) ?? []).map(({ date, aiEra, agentReady }) => ({ date, aiEra, agentReady })),
      })
    }
  }
  return rows
}

export default function WatchlistPage() {
  const products = buildWatchlistProducts()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Founder 2026-10-05: no explainer line under the title — the list says what it is. The
          metadata description above keeps the one-line summary for crawlers. */}
      <h1 className="font-display leading-[1.1] text-3xl font-bold tracking-tight">Watchlist</h1>

      <WatchlistGate>
        <WatchlistClient products={products} />
      </WatchlistGate>
    </div>
  )
}
