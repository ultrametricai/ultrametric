import Link from 'next/link'
import type { ArenaVendors } from '@/lib/arenaLeaders'

// The derived vendor blocks the open-module and artifact pages share (founder 2026-10-05):
// one block per covering arena, each listing the arena's committed leaderboard leaders with
// their Overall scores (lib/arenaLeaders.ts — read from rankings.json, never hand-picked).
// Server-rendered, purely presentational: every number and position here is the arena page's
// own published one.
export default function ArenaVendorList({ arenas }: { arenas: ArenaVendors[] }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {arenas.map((arena) => (
        <div key={arena.arenaId} className="rounded-xl border border-zinc-800 p-4">
          <h3 className="font-display text-sm font-semibold leading-tight">
            <Link
              href={arena.href}
              className="text-zinc-200 transition hover:text-emerald-300"
              title={`The ${arena.arenaName} arena — full judged leaderboard`}
            >
              {arena.arenaName}
            </Link>
          </h3>
          <ol className="mt-2 space-y-1.5 text-sm">
            {arena.leaders.map((leader) => (
              <li key={leader.productId} className="flex items-baseline justify-between gap-2">
                <span>
                  <span className="mr-1.5 font-mono text-[10px] text-zinc-600">#{leader.rank}</span>
                  <Link
                    href={leader.href}
                    className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                  >
                    {leader.name}
                  </Link>
                </span>
                {leader.overall !== null && (
                  <span
                    title="Overall score on this arena's committed leaderboard — computed from judged story verdicts, see the product's score page"
                    className="shrink-0 font-mono text-xs text-zinc-500"
                  >
                    {leader.overall}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
