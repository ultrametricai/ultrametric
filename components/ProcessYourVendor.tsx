'use client'

import Link from 'next/link'
import MineLink from '@/components/MineLink'
import ProductLogoView from '@/components/ProductLogoView'
import { useMyStackMap } from '@/components/useMyStackMap'
import { isPicked } from '@/lib/myStack'
import { ordinal } from '@/lib/ordinal'

// Lean serialized leaderboard row for the client-side "you run X" banner — built server-side by
// components/ProcessLeaderboard.tsx from the FULL (uncapped) processLeaderboard entries, so the
// reader's pick is findable wherever it ranks.
export interface YourVendorEntry {
  productId: string
  name: string
  arenaId: string
  hasLogo: boolean
  rank: number
  processScore: number
  stepsServed: number
}

// "You run <vendor>" banner above the process leaderboard (founder 2026-09-21). Same static-HTML
// contract as StepYourPick: server snapshot of the stack is '{}' so this renders nothing in the
// static page; it hydrates in only for readers with an "I'm using" pick that appears in one of
// the process's covering arenas. Numbers are the leaderboard's own — re-arranged, not recomputed.
export default function ProcessYourVendor({
  entries,
  rankableSteps,
  mineHref,
}: {
  entries: YourVendorEntry[]
  rankableSteps: number
  mineHref: string
}) {
  const stack = useMyStackMap()
  // Entries are in leaderboard order, so the reader's picks fall out best-ranked first: the
  // banner leads with the best, and honestly notes how many MORE of their vendors serve this
  // process (multi-vendor stacks are deliberate — see lib/myStack.ts StackMap v2).
  const mine = entries.filter((e) => isPicked(stack, e.arenaId, e.productId))
  const yours = mine[0]
  if (!yours) return null
  const moreMine = mine.length - 1
  const leader = entries[0]
  const isLeader = yours.rank === 1
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-emerald-400/40 bg-emerald-400/[0.07] px-3.5 py-2 text-[13px]">
      <span className="flex min-w-0 items-center gap-1.5 text-zinc-100">
        <ProductLogoView product={{ id: yours.productId, name: yours.name }} size={18} hasLogo={yours.hasLogo} />
        <span>
          {/* Both vendor names click through to their judged product pages (founder
              2026-10-02: vendor names lead somewhere). */}
          You run{' '}
          <Link
            href={`/arena/${yours.arenaId}/product/${yours.productId}`}
            title={`${yours.name} on Ultrametric — the judged product page`}
            className="font-medium transition hover:text-emerald-300"
          >
            {yours.name}
          </Link>{' '}
          —{' '}
          <span className="text-emerald-300">{ordinal(yours.rank)}</span> for this process, {yours.stepsServed} of{' '}
          {rankableSteps} steps, score{' '}
          {/* The score clicks through to the judged verdicts behind it (founder 2026-10-05). */}
          <Link
            href={`/arena/${yours.arenaId}/product/${yours.productId}#story-verdicts`}
            title={`${yours.processScore.toFixed(0)}/100 — open the judged story verdicts this score derives from`}
            className="transition hover:text-emerald-200"
          >
            <span className="tabular-nums text-emerald-300">{yours.processScore.toFixed(0)}</span>
            <span className="text-zinc-500">/100</span>
          </Link>
        </span>
      </span>
      {!isLeader && leader && (
        <span className="text-zinc-400">
          (1st is{' '}
          <Link
            href={`/arena/${leader.arenaId}/product/${leader.productId}`}
            title={`${leader.name} on Ultrametric — the judged product page`}
            className="transition hover:text-emerald-300"
          >
            {leader.name}
          </Link>{' '}
          at{' '}
          <Link
            href={`/arena/${leader.arenaId}/product/${leader.productId}#story-verdicts`}
            title={`${leader.processScore.toFixed(0)}/100 — open the judged story verdicts this score derives from`}
            className="transition hover:text-emerald-300"
          >
            <span className="tabular-nums">{leader.processScore.toFixed(0)}</span>
            <span className="text-zinc-500">/100</span>
          </Link>)
        </span>
      )}
      {moreMine > 0 && (
        <span
          className="text-zinc-400"
          title={mine
            .slice(1)
            .map((m) => `${m.name} — ${ordinal(m.rank)}, ${m.stepsServed} step${m.stepsServed === 1 ? '' : 's'}`)
            .join('; ')}
        >
          +{moreMine} more of your vendors serve{moreMine === 1 ? 's' : ''} this process
        </span>
      )}
      <MineLink
        mineHref={mineHref}
        className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
      >
        run it with your whole stack →
      </MineLink>
    </div>
  )
}
