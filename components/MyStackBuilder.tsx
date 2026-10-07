'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import AiEraBadge from '@/components/AiEraBadge'
import IconChip from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import { arenaIcon } from '@/lib/arenaIcons'
import {
  encodeMyStackParam,
  MAX_ADD_RECS,
  MAX_MY_STACK,
  MAX_RECOMMENDATIONS,
  MY_STACK_KEY,
  parseMyStackParam,
  parseStoredStack,
  RECOMMENDATION_KIND_LABELS,
  recommend,
  resolvePicks,
  UPGRADE_DELTA,
  type MyStackProduct,
  type RecommendationKind,
} from '@/lib/myStack'

// /my-stack's client half: enter the stack you already run, get typed recommendations
// (lib/myStack.ts) computed entirely in the browser — the selection lives in `?s=id1,id2`
// (same Suspense-wrapped useSearchParams + history.replaceState pattern as /compare) and in
// localStorage (device-local, same honesty contract as the watchlist), so no server ever
// sees it. The catalog + adjacency inputs arrive as server-built props (lib/myStackData.ts).

const MAX_SUGGESTIONS = 8

// Kind-tinted chips — one color per recommendation kind, everywhere.
const KIND_CHIP_CLASSES: Record<RecommendationKind, string> = {
  upgrade: 'border-emerald-400/40 bg-emerald-400/5 text-emerald-300',
  add: 'border-sky-400/40 bg-sky-400/5 text-sky-300',
  overlap: 'border-amber-400/40 bg-amber-400/5 text-amber-300',
  group: 'border-violet-400/40 bg-violet-400/5 text-violet-300',
  breakout: 'border-zinc-600 bg-zinc-800/40 text-zinc-300',
  // Stronger amber than OVERLAP — a vendor-announced shutdown, not a maybe.
  migrate: 'border-amber-400/60 bg-amber-400/10 text-amber-300',
}

const KIND_TOOLTIPS: Record<RecommendationKind, string> = {
  upgrade: 'Upgrade — a same-ranking product scores materially higher than your pick',
  add: 'Add — an adjacent ranking where your stack has nothing yet',
  overlap: 'Overlap — picks of yours cover the same job; running several vendors here is often deliberate',
  group: 'Group — one vendor family could consolidate two of your slots',
  breakout: 'Break out — your pick trails specialists by a wide margin in this ranking',
  migrate: 'Migrate — this pick’s vendor has announced it is shutting down',
}

export default function MyStackBuilder({
  products,
  adjacency,
  curatedStackArenas,
  verifiedPairs,
}: {
  products: MyStackProduct[]
  adjacency: string[][]
  curatedStackArenas: string[][]
  verifiedPairs: string[]
}) {
  const searchParams = useSearchParams()
  const validIds = useMemo(() => new Set(products.map((p) => p.id)), [products])

  // Initial stack: `?s=` wins (a share link shows the sender's stack); otherwise the stack
  // saved in this browser. Lazy initializer, not a mount effect — useSearchParams already
  // carries the real query on the first client render, and localStorage is only touched here
  // (client-only subtree under the page's <Suspense>, so no server/client mismatch).
  const [ids, setIds] = useState<string[]>(() => {
    const fromUrl = parseMyStackParam(searchParams.get('s'), validIds)
    if (fromUrl.length > 0) return fromUrl
    try {
      return parseStoredStack(window.localStorage.getItem(MY_STACK_KEY)).filter((id) => validIds.has(id))
    } catch {
      return []
    }
  })
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  // Mirror the stack into the URL (shareable) and localStorage (persistent on this device).
  useEffect(() => {
    const qs = ids.length > 0 ? `?s=${encodeMyStackParam(ids)}` : ''
    window.history.replaceState(null, '', `${window.location.pathname}${qs}${window.location.hash}`)
    try {
      window.localStorage.setItem(MY_STACK_KEY, JSON.stringify(ids))
    } catch {
      /* storage unavailable (private mode) — the URL still carries the stack */
    }
  }, [ids])

  const picks = useMemo(() => resolvePicks(ids, products), [ids, products])
  const { recommendations, truncated } = useMemo(
    () => recommend(ids, { products, adjacency, curatedStackArenas, verifiedPairs }),
    [ids, products, adjacency, curatedStackArenas, verifiedPairs],
  )

  // Chips grouped by arena, in first-pick order — each group wears its arena emoji.
  const arenaGroups = useMemo(() => {
    const groups: Array<{ arenaId: string; arenaName: string; picks: MyStackProduct[] }> = []
    for (const p of picks) {
      const g = groups.find((x) => x.arenaId === p.arenaId)
      if (g) g.picks.push(p)
      else groups.push({ arenaId: p.arenaId, arenaName: p.arenaName, picks: [p] })
    }
    return groups
  }, [picks])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return []
    const seen = new Set<string>()
    return products
      .filter((p) => {
        if (ids.includes(p.id) || seen.has(p.id)) return false
        if (!p.name.toLowerCase().includes(q) && !p.arenaName.toLowerCase().includes(q)) return false
        seen.add(p.id) // one suggestion per product id, canonical arena first
        return true
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [products, query, ids])

  function add(id: string) {
    setIds((prev) => (prev.includes(id) || prev.length >= MAX_MY_STACK ? prev : [...prev, id]))
    setQuery('')
  }

  function remove(id: string) {
    setIds((prev) => prev.filter((x) => x !== id))
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the URL bar still has the link */
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ids.length >= MAX_MY_STACK ? `Up to ${MAX_MY_STACK} products` : 'Add a product you use…'}
            disabled={ids.length >= MAX_MY_STACK}
            aria-label="Search products to add to your stack"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none disabled:opacity-60"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl">
              {suggestions.map((p) => (
                <button
                  key={`${p.arenaId}/${p.id}`}
                  type="button"
                  onClick={() => add(p.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-emerald-400/10 hover:text-emerald-300"
                >
                  <ProductLogoView product={{ id: p.id, name: p.name }} size={20} hasLogo={p.hasLogo} />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-zinc-500">{p.arenaName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picks.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
              {arenaGroups.map((group) => (
                <div key={group.arenaId} className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/arena/${group.arenaId}`}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-300"
                  >
                    <IconChip icon={arenaIcon(group.arenaId)} title={`${group.arenaName} arena`} />
                    {group.arenaName}
                  </Link>
                  {group.picks.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1.5 pr-2 text-xs text-zinc-300"
                    >
                      <ProductLogoView product={{ id: p.id, name: p.name }} size={18} hasLogo={p.hasLogo} />
                      <Link href={`/arena/${p.arenaId}/product/${p.id}`} className="hover:text-emerald-300">
                        {p.name}
                      </Link>
                      {p.aiEra !== null && <AiEraBadge value={p.aiEra} size="xs" />}
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        aria-label={`Remove ${p.name} from your stack`}
                        className="text-zinc-500 transition hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyShareLink}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
              >
                {copied ? 'Copied ✓' : 'Copy share link'}
              </button>
              <Link
                href={`/stacks/battle?a=${encodeMyStackParam(ids)}`}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
              >
                Battle my stack vs a curated stack →
              </Link>
            </div>
          </div>
        )}
      </div>

      {picks.length === 0 ? (
        <p className="rounded-2xl border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          Search above and add the products you already run — you&rsquo;ll get evidence-cited
          suggestions: upgrades, adjacent additions, possible overlaps, consolidations, and
          break-outs. Your stack lives in the URL and in this browser only.
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">Recommendations</h2>
          {recommendations.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 px-4 py-6 text-sm text-zinc-500">
              Nothing to flag — no same-ranking product beats a pick by Δ{UPGRADE_DELTA} or more on confident
              evidence, no adjacent gap, no overlap, and no consolidation the data supports.
            </p>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((rec) => (
                <li key={rec.reason} className="rounded-2xl border border-zinc-800 p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      title={KIND_TOOLTIPS[rec.kind]}
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${KIND_CHIP_CLASSES[rec.kind]}`}
                    >
                      {RECOMMENDATION_KIND_LABELS[rec.kind]}
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-zinc-300">{rec.reason}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rec.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-full border border-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
                      >
                        {link.label} →
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {truncated > 0 && (
            <p className="text-xs text-zinc-500">
              {truncated} lower-impact recommendation{truncated === 1 ? '' : 's'} not shown —
              adjacent-ranking additions keep only their strongest {MAX_ADD_RECS}, and the list
              caps at the {MAX_RECOMMENDATIONS} highest-impact overall.
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Every number is the ranking&rsquo;s published score; &ldquo;possible
            overlap&rdquo; means exactly that, never &ldquo;remove it&rdquo;.
          </p>
        </section>
      )}
    </div>
  )
}
