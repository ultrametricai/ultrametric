'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import ProductLogoView from '@/components/ProductLogoView'
import ShutdownBadge from '@/components/ShutdownBadge'
import { useMyStackMap } from '@/components/useMyStackMap'
import {
  MAX_PICKS_PER_ARENA,
  MY_STACK_KEY,
  parseStoredStack,
  stackAdvice,
  stackMapFromList,
  stackPicks,
  togglePick,
  writeStack,
  type MyStackProduct,
} from '@/lib/myStack'
import { loginUrl, registrationUrl, useSession } from '@/lib/session'

// The signed-in half of /my-stack and /account/vendors (founder asks: "in signed-in mode, allow the
// user to define their stack and get upgraded stack advice"; 2026-09-22: "allow multiple
// vendors for functions" + "I want logos here"): the reader's vendors per arena — SEVERAL
// allowed, first = primary — rendered as logo chips, grouped by the header's arena sections,
// saved to the account via lib/myStack.ts's account-stack store (the exact watchlist
// localStorage+sync pattern). Anonymous readers get a sign-up prompt instead — the free-form
// tool below (MyStackBuilder) stays open to everyone.
//
// Advice: every number is the arena leaderboard's published Overall / agent-ready score
// (lib/myStack.ts stackAdvice), and every cited score links to the product's /score receipt
// page where the evidence breakdown lives.

export interface StackSection {
  name: string
  arenaIds: string[]
}

const scoreText = (n: number | null) => (n === null ? 'n/a' : `${n.toFixed(0)}/100`)

function receiptHref(p: MyStackProduct): string {
  return `/arena/${p.arenaId}/product/${p.id}/score`
}

export default function YourStack({
  products,
  sections,
}: {
  products: MyStackProduct[]
  sections: StackSection[]
}) {
  const session = useSession()
  const stack = useMyStackMap()
  const [query, setQuery] = useState('')

  // Arena catalog: rows grouped per arena in leaderboard order, arenas keyed for the pickers.
  const byArena = useMemo(() => {
    const map = new Map<string, { arenaName: string; rows: MyStackProduct[] }>()
    for (const p of products) {
      const entry = map.get(p.arenaId) ?? { arenaName: p.arenaName, rows: [] }
      entry.rows.push(p)
      map.set(p.arenaId, entry)
    }
    for (const entry of map.values()) entry.rows.sort((a, b) => a.rank - b.rank)
    return map
  }, [products])

  // One-time seed from the free-form tool's device-local list ("prefilled from any existing
  // device-local state"): only when the account stack is still empty; every pick joins its
  // arena's list in order (first = primary).
  const seeded = useRef(false)
  useEffect(() => {
    if (session.state !== 'authenticated' || seeded.current) return
    seeded.current = true
    if (Object.keys(stack).length > 0) return
    let legacy: string[] = []
    try {
      legacy = parseStoredStack(window.localStorage.getItem(MY_STACK_KEY))
    } catch {
      return
    }
    const seed = stackMapFromList(legacy, products)
    if (Object.keys(seed).length > 0) writeStack(seed)
  }, [session.state, stack, products])

  if (session.state === 'loading') return null

  if (session.state === 'anonymous') {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">
        <p>
          <span aria-hidden className="mr-2 text-zinc-500">▣</span>
          Sign up to save your stack to your account: pick your product per ranking, get upgraded
          stack advice against every ranking, and run any process page with your own
          vendors.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={registrationUrl('/my-stack')}
            onClick={(e) => {
              e.preventDefault()
              window.location.href = registrationUrl(window.location.href)
            }}
            className="inline-block rounded-lg border border-emerald-400/60 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10"
          >
            Sign up to save your stack
          </a>
          <a
            href={loginUrl('/my-stack')}
            onClick={(e) => {
              e.preventDefault()
              window.location.href = loginUrl(window.location.href)
            }}
            className="inline-block rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
          >
            Log in
          </a>
        </div>
      </section>
    )
  }

  const q = query.trim().toLowerCase()
  const arenaMatches = (arenaId: string): boolean => {
    if (q === '') return true
    const entry = byArena.get(arenaId)
    if (!entry) return false
    return (
      entry.arenaName.toLowerCase().includes(q) ||
      entry.rows.some((r) => r.name.toLowerCase().includes(q))
    )
  }

  // Toggle membership (lib/myStack.ts togglePick): adding never removes the arena's other
  // picks — the reader really runs several vendors per function.
  function toggle(arenaId: string, productId: string) {
    if (productId === '') return
    writeStack(togglePick(stack, arenaId, productId))
  }

  const advice = stackAdvice(stack, products)
  const pickCount = advice.picks.length

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">Your stack</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Your vendors per ranking — several allowed, the first is your primary — saved to your
          account; process pages can then run with your own
          vendors. {pickCount === 0 ? 'Nothing picked yet.' : `${pickCount} ranking${pickCount === 1 ? '' : 's'} picked.`}
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter rankings or products…"
        aria-label="Filter rankings or products"
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none"
      />

      <div className="space-y-2">
        {sections.map((section) => {
          const arenas = section.arenaIds.filter((id) => byArena.has(id) && arenaMatches(id))
          if (arenas.length === 0) return null
          const sectionPicks = section.arenaIds.filter((id) => stackPicks(stack, id).length > 0 && byArena.has(id)).length
          return (
            <details
              key={section.name}
              open={q !== '' || sectionPicks > 0}
              className="group rounded-2xl border border-zinc-800"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/60 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="text-[9px] text-zinc-600 transition-transform group-open:rotate-90">▶</span>
                {section.name}
                {sectionPicks > 0 && (
                  <span className="rounded-full border border-emerald-400/40 px-1.5 py-px text-[10px] text-emerald-300">
                    {sectionPicks} picked
                  </span>
                )}
              </summary>
              <div className="grid gap-x-6 gap-y-2 border-t border-zinc-800/60 px-4 py-3 sm:grid-cols-2">
                {arenas.map((arenaId) => {
                  const entry = byArena.get(arenaId)!
                  const picks = stackPicks(stack, arenaId)
                  const picked = picks.flatMap((id) => {
                    const r = entry.rows.find((row) => row.id === id)
                    return r ? [r] : []
                  })
                  const addable = entry.rows.filter((r) => !picks.includes(r.id))
                  const full = picks.length >= MAX_PICKS_PER_ARENA
                  return (
                    <div key={arenaId} className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/arena/${arenaId}`} className="min-w-0 truncate text-zinc-400 hover:text-emerald-300">
                          {entry.arenaName}
                        </Link>
                        {/* value is always '' — the select is an ADD affordance; picks render
                            as removable logo chips below, several per arena. */}
                        <select
                          value=""
                          onChange={(e) => toggle(arenaId, e.target.value)}
                          disabled={full || addable.length === 0}
                          aria-label={`Add a ${entry.arenaName} pick`}
                          className="w-44 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-400/60 focus:outline-none disabled:opacity-50"
                        >
                          <option value="">{full ? `max ${MAX_PICKS_PER_ARENA} picks` : picks.length > 0 ? '+ add another' : '+ add vendor'}</option>
                          {!full &&
                            addable.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                                {r.aiEra !== null ? ` (${r.aiEra.toFixed(0)})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                      {picked.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {picked.map((r, i) => (
                            <span
                              key={r.id}
                              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 py-0.5 pl-1 pr-1.5 text-xs text-zinc-300"
                              title={i === 0 && picked.length > 1 ? `${r.name} — your primary ${entry.arenaName} pick` : undefined}
                            >
                              <ProductLogoView product={{ id: r.id, name: r.name }} size={20} hasLogo={r.hasLogo} />
                              <Link href={`/arena/${arenaId}/product/${r.id}`} className="hover:text-emerald-300">
                                {r.name}
                              </Link>
                              <ShutdownBadge shutdown={r.shutdown} />
                              <button
                                type="button"
                                onClick={() => toggle(arenaId, r.id)}
                                aria-label={`Remove ${r.name} from your ${entry.arenaName} picks`}
                                className="text-zinc-500 transition hover:text-red-400"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>

      {pickCount > 0 && (
        <div className="space-y-3">
          <h3 className="font-display leading-[1.1] text-lg font-semibold tracking-tight">Upgraded stack advice</h3>
          {advice.stackScore !== null && (
            <p className="text-sm text-zinc-300">
              Stack score{' '}
              <span className="tabular-nums text-emerald-400">{advice.stackScore.toFixed(0)}</span>
              <span className="text-zinc-500">/100</span> vs best possible{' '}
              <span className="tabular-nums text-emerald-400">{(advice.bestPossible ?? 0).toFixed(0)}</span>
              <span className="text-zinc-500">/100</span>
              <span className="ml-1 text-xs text-zinc-500">
                — mean published Overall score of your scored picks vs those same rankings&rsquo; leaders.
              </span>
            </p>
          )}
          <ul className="space-y-2">
            {advice.picks.map((p) => (
              <li key={p.arenaId} className="rounded-2xl border border-zinc-800 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <ProductLogoView product={{ id: p.pick.id, name: p.pick.name }} size={18} hasLogo={p.pick.hasLogo} />
                  <Link href={`/arena/${p.arenaId}/product/${p.pick.id}`} className="font-medium text-zinc-100 hover:text-emerald-300">
                    {p.pick.name}
                  </Link>
                  <ShutdownBadge shutdown={p.pick.shutdown} />
                  <Link href={`/arena/${p.arenaId}`} className="text-xs text-zinc-500 hover:text-emerald-300">
                    {p.arenaName}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    #{p.pick.rank} of {p.pick.fieldSize}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-zinc-300" title="Overall score — the ranking's published headline score">
                    Overall {scoreText(p.pick.aiEra)}
                  </span>
                  <Link href={receiptHref(p.pick)} className="text-[11px] text-zinc-500 underline decoration-zinc-700 hover:text-emerald-300">
                    score receipt
                  </Link>
                </div>
                {/* 2+ picks in one arena is deliberate multi-vendor — reported neutrally,
                    never as an error. The header row carries the BEST pick; the others are
                    named here with their logos. */}
                {p.coPicks.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                    <span>you run {p.coPicks.length + 1} vendors here — also:</span>
                    {p.coPicks.map((cp) => (
                      <span key={cp.id} className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 py-0.5 pl-1 pr-1.5">
                        <ProductLogoView product={{ id: cp.id, name: cp.name }} size={16} hasLogo={cp.hasLogo} />
                        <Link href={`/arena/${cp.arenaId}/product/${cp.id}`} className="text-zinc-300 hover:text-emerald-300">
                          {cp.name}
                        </Link>
                        {cp.aiEra !== null && (
                          <span className="font-mono tabular-nums text-zinc-500">{cp.aiEra.toFixed(0)}/100</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {/* Rule 0, ahead of any score-gap line: the vendor's own shutdown announcement
                    outranks every delta — for EVERY shutdown pick in the arena, not just the
                    best one. The migration target is the arena's best remaining (non-shutdown)
                    product — the same leader stackAdvice already resolved. */}
                {p.shutdownPicks.map((sp) => (
                  <p key={sp.id} className="mt-1.5 text-xs text-amber-300/90" title={sp.shutdown}>
                    {sp.name} is shutting down — migrate: the vendor has announced this product is closing
                    {p.leader.id !== sp.id ? (
                      <>
                        ; the {p.arenaName} leader among remaining products is{' '}
                        <Link href={`/arena/${p.leader.arenaId}/product/${p.leader.id}`} className="underline decoration-amber-400/40 hover:text-amber-200">
                          {p.leader.name}
                        </Link>
                      </>
                    ) : null}
                    .
                  </p>
                ))}
                {p.pick.id === p.leader.id ? (
                  <p className="mt-1.5 text-xs text-emerald-300/90">Leads its ranking — nothing above it to upgrade to.</p>
                ) : (
                  <p className="mt-1.5 text-xs text-zinc-400">
                    {p.overallDelta !== null && p.overallDelta > 0 ? (
                      <>
                        Δ<span className="tabular-nums">{p.overallDelta.toFixed(0)}</span> overall behind the
                        leader {p.leader.name}
                        {p.agentReadyDelta !== null && (
                          <>
                            {' '}(agent-ready Δ<span className="tabular-nums">{p.agentReadyDelta.toFixed(0)}</span>)
                          </>
                        )}
                        .
                      </>
                    ) : (
                      <>Level with the ranking leader on the published scores.</>
                    )}
                  </p>
                )}
                {p.upgrades.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">upgrade candidates:</span>
                    {p.upgrades.map((u) => (
                      <span key={u.product.id} className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/5 px-2 py-0.5 text-xs text-emerald-300">
                        <Link href={`/arena/${u.product.arenaId}/product/${u.product.id}`} className="hover:text-emerald-200">
                          {u.product.name}
                        </Link>
                        {u.overallDelta !== null && (
                          <span className="tabular-nums" title={`Overall ${scoreText(u.product.aiEra)} vs your ${scoreText(p.pick.aiEra)}${u.agentReadyDelta !== null ? `; agent-ready Δ${u.agentReadyDelta.toFixed(0)}` : ''}`}>
                            +{u.overallDelta.toFixed(0)} overall
                          </span>
                        )}
                        <Link href={receiptHref(u.product)} className="text-[10px] text-emerald-400/70 underline decoration-emerald-400/30 hover:text-emerald-200">
                          receipt
                        </Link>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Every number is the ranking&rsquo;s published score; each &ldquo;receipt&rdquo;
            link opens the score page where the judged evidence behind it lives.
          </p>
        </div>
      )}
    </section>
  )
}
