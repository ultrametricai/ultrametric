'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import AiEraBadge from '@/components/AiEraBadge'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import IconChip from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import { arenaIcon } from '@/lib/arenaIcons'
import { resolvePicks, type MyStackProduct } from '@/lib/myStack'
import {
  aggregateStack,
  battleVerdict,
  encodeBattleSideParam,
  MAX_BATTLE_SIDE,
  parseBattleSideParam,
  slotComparisons,
  type BattleSideState,
  type StackAggregates,
} from '@/lib/stackBattle'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// /stacks/battle's client half: pick stack A and stack B — curated presets (data/ai-stacks.json,
// resolved to product ids server-side) and/or custom product lists — and compare their
// aggregates side by side (lib/stackBattle.ts). State lives in `?a=…&b=…` (a preset id or a
// comma-separated id list per side), same Suspense-wrapped useSearchParams +
// history.replaceState pattern as /compare. The one place a REAL judged battle exists — both
// sides fielding one product in the same arena — the slot row links to its arena battle page.

const MAX_SUGGESTIONS = 8

export interface BattlePreset {
  id: string
  name: string
  /** Resolved product ids of the preset's scored slots (editorial slots have no product). */
  productIds: string[]
}

function sideProducts(state: BattleSideState, presets: BattlePreset[], products: MyStackProduct[]): MyStackProduct[] {
  if (state.kind === 'preset') {
    const preset = presets.find((p) => p.id === state.presetId)
    return preset ? resolvePicks(preset.productIds, products) : []
  }
  if (state.kind === 'custom') return resolvePicks(state.ids, products)
  return []
}

function sideLabel(state: BattleSideState, presets: BattlePreset[], fallback: string): string {
  if (state.kind === 'preset') return presets.find((p) => p.id === state.presetId)?.name ?? fallback
  return fallback
}

function AggregateRows({ agg }: { agg: StackAggregates }) {
  const mean = (value: number | null, count: number, of: number) =>
    value === null ? (
      <span className="text-zinc-500">n/a</span>
    ) : (
      <span className="font-mono tabular-nums text-zinc-200">
        {value.toFixed(1)}
        <span className="text-zinc-500">/100</span>
        {count < of && <span className="ml-1 text-[10px] text-zinc-500">({count} of {of} scored)</span>}
      </span>
    )
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-xs text-zinc-500" title="Mean of the stack's published Overall scores — an aggregate, not a judged result.">mean Overall score</dt>
        {/* Same emerald pill as every Overall score on the site (AiEraBadge) — the plain mean()
            rendering stays for agent-ready below, which is a different metric. */}
        <dd className="flex items-center gap-1">
          <AiEraBadge value={agg.meanAiEra} size="xs" />
          {agg.meanAiEra !== null && agg.aiEraCount < agg.productCount && (
            <span className="text-[10px] text-zinc-500">({agg.aiEraCount} of {agg.productCount} scored)</span>
          )}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-xs text-zinc-500" title="Mean of the stack's agent-ready scores — how drivable the stack is for an agent overall.">mean agent-ready</dt>
        <dd>{mean(agg.meanAgentReady, agg.agentReadyCount, agg.productCount)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-xs text-zinc-500" title="How many distinct arenas the stack covers.">arena coverage</dt>
        <dd className="font-mono tabular-nums text-zinc-200">
          {agg.arenaCount} arena{agg.arenaCount === 1 ? '' : 's'} / {agg.productCount} product{agg.productCount === 1 ? '' : 's'}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt
          className="text-xs text-zinc-500"
          title="Product pairs inside the stack with a verified integration edge (evidence-backed — see the integration graph). Absence of an edge means no evidence found, never 'doesn't integrate'."
        >
          verified interconnects
        </dt>
        <dd className="font-mono tabular-nums text-zinc-200">
          {agg.verifiedInterconnects} of {agg.possiblePairs} pair{agg.possiblePairs === 1 ? '' : 's'}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-xs text-zinc-500" title="The stack's lowest-scoring product on Overall score.">weakest link</dt>
        <dd className="text-right text-xs text-zinc-300">
          {agg.weakestLink ? (
            <Link
              href={`/arena/${agg.weakestLink.arenaId}/product/${agg.weakestLink.id}`}
              className="inline-flex items-center gap-1.5 hover:text-emerald-300"
            >
              <ProductLogoView
                product={{ id: agg.weakestLink.id, name: agg.weakestLink.name }}
                size={16}
                hasLogo={agg.weakestLink.hasLogo}
              />
              {agg.weakestLink.name}{' '}
              <AiEraBadge value={agg.weakestLink.aiEra} size="xs" />
            </Link>
          ) : (
            <span className="text-zinc-500">n/a</span>
          )}
        </dd>
      </div>
    </dl>
  )
}

function SidePicker({
  label,
  state,
  setState,
  presets,
  products,
  resolved,
  agg,
}: {
  label: string
  state: BattleSideState
  setState: (s: BattleSideState) => void
  presets: BattlePreset[]
  products: MyStackProduct[]
  resolved: MyStackProduct[]
  agg: StackAggregates
}) {
  const [query, setQuery] = useState('')
  const currentIds = resolved.map((p) => p.id)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return []
    const taken = new Set(resolved.map((p) => p.id))
    return products
      .filter((p) => {
        if (taken.has(p.id)) return false
        if (!p.name.toLowerCase().includes(q) && !p.arenaName.toLowerCase().includes(q)) return false
        taken.add(p.id) // one suggestion per product id, canonical arena first
        return true
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [products, query, resolved])

  // Editing a preset side turns it into a custom list seeded with the preset's products —
  // the URL stays honest about what's actually being compared.
  function add(id: string) {
    if (currentIds.length >= MAX_BATTLE_SIDE) return
    setState({ kind: 'custom', ids: [...currentIds, id] })
    setQuery('')
  }
  function remove(id: string) {
    const ids = currentIds.filter((x) => x !== id)
    setState(ids.length > 0 ? { kind: 'custom', ids } : { kind: 'empty' })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display leading-[1.1] text-lg font-semibold tracking-tight">{label}</h2>
        <select
          value={state.kind === 'preset' ? state.presetId : ''}
          onChange={(e) => {
            const id = e.target.value
            setState(id === '' ? { kind: 'empty' } : { kind: 'preset', presetId: id })
          }}
          aria-label={`Choose a curated stack for ${label}`}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 focus:border-emerald-400/60 focus:outline-none"
        >
          <option value="">custom / none</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={currentIds.length >= MAX_BATTLE_SIDE ? `Up to ${MAX_BATTLE_SIDE} products` : 'Add a product…'}
          disabled={currentIds.length >= MAX_BATTLE_SIDE}
          aria-label={`Search products to add to ${label}`}
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

      {resolved.length === 0 ? (
        <p className="py-2 text-xs text-zinc-500">Pick a curated stack above or add products to build a side.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {resolved.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1.5 pr-2 text-xs text-zinc-300"
              >
                <ProductLogoView product={{ id: p.id, name: p.name }} size={18} hasLogo={p.hasLogo} />
                <Link href={`/arena/${p.arenaId}/product/${p.id}`} className="hover:text-emerald-300">
                  {p.name}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={`Remove ${p.name} from ${label}`}
                  title={`Remove ${p.name} from ${label}`}
                  className="text-zinc-500 transition hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <AggregateRows agg={agg} />
        </>
      )}
    </div>
  )
}

export default function StackBattle({
  products,
  presets,
  verifiedPairs,
  battleSlugs,
}: {
  products: MyStackProduct[]
  presets: BattlePreset[]
  /** 'a|b' sorted-pair keys of every verified integration edge (lib/integrations.ts). */
  verifiedPairs: string[]
  /** Every live battle page as an `{arenaId}/{slug}` key, so slot rows only link to battles that exist. */
  battleSlugs: string[]
}) {
  const searchParams = useSearchParams()
  const validIds = useMemo(() => new Set(products.map((p) => p.id)), [products])
  const presetIds = useMemo(() => new Set(presets.map((p) => p.id)), [presets])

  const [sideA, setSideA] = useState<BattleSideState>(() =>
    parseBattleSideParam(searchParams.get('a'), validIds, presetIds),
  )
  const [sideB, setSideB] = useState<BattleSideState>(() =>
    parseBattleSideParam(searchParams.get('b'), validIds, presetIds),
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    const a = encodeBattleSideParam(sideA)
    const b = encodeBattleSideParam(sideB)
    if (a !== '') params.set('a', a)
    if (b !== '') params.set('b', b)
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [sideA, sideB])

  const aProducts = useMemo(() => sideProducts(sideA, presets, products), [sideA, presets, products])
  const bProducts = useMemo(() => sideProducts(sideB, presets, products), [sideB, presets, products])
  const aLabel = sideLabel(sideA, presets, 'Stack A')
  const bLabel = sideLabel(sideB, presets, 'Stack B')

  const bothReady = aProducts.length > 0 && bProducts.length > 0
  const aAgg = useMemo(() => aggregateStack(aProducts, verifiedPairs), [aProducts, verifiedPairs])
  const bAgg = useMemo(() => aggregateStack(bProducts, verifiedPairs), [bProducts, verifiedPairs])
  const slots = useMemo(() => slotComparisons(aProducts, bProducts, battleSlugs), [aProducts, bProducts, battleSlugs])

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the URL bar still has the link */
    }
  }

  const slotCell = (list: MyStackProduct[], winner: boolean) =>
    list.length === 0 ? (
      <span className="text-xs italic text-zinc-600">—</span>
    ) : (
      <div className="flex flex-col gap-1">
        {list.map((p) => (
          <Link
            key={p.id}
            href={`/arena/${p.arenaId}/product/${p.id}`}
            className={`flex items-center gap-1.5 text-xs hover:text-emerald-300 ${winner ? 'text-emerald-300' : 'text-zinc-300'}`}
          >
            <ProductLogoView product={{ id: p.id, name: p.name }} size={18} hasLogo={p.hasLogo} />
            <span className="font-medium">{p.name}</span>
            {p.aiEra !== null && <AiEraBadge value={p.aiEra} size="xs" />}
          </Link>
        ))}
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SidePicker label={aLabel} state={sideA} setState={setSideA} presets={presets} products={products} resolved={aProducts} agg={aAgg} />
        <SidePicker label={bLabel} state={sideB} setState={setSideB} presets={presets} products={products} resolved={bProducts} agg={bAgg} />
      </div>

      {!bothReady ? (
        <p className="rounded-2xl border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          Fill both sides — a curated stack, your own product list, or one of each — and the
          aggregates go head to head. The matchup lives in the URL, so it&rsquo;s a shareable link.
        </p>
      ) : (
        <>
          <section className="space-y-2 rounded-2xl border border-zinc-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display leading-[1.1] text-lg font-semibold tracking-tight">Verdict</h2>
              <button
                type="button"
                onClick={copyShareLink}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
              >
                {copied ? 'Copied ✓' : 'Copy share link'}
              </button>
            </div>
            <p className="text-sm text-zinc-300">{battleVerdict(aLabel, bLabel, aAgg, bAgg)}</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display leading-[1.1] text-lg font-semibold tracking-tight">Slot by slot</h2>
            <div className={TABLE_SHELL}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className={TABLE_HEADER_ROW}>
                    <th scope="col" className="px-3 py-2 font-normal"><span title="The product category (arena) this slot fills — each side's pick for it is compared on the same judged scores">Arena</span></th>
                    <th scope="col" className="px-3 py-2 font-normal"><span title={`Stack A's pick for each arena slot`}>{aLabel}</span></th>
                    <th scope="col" className="px-3 py-2 font-normal">
                      <span className="inline-flex items-center gap-1.5">
                        <span title={`Stack B's pick for each arena slot`}>{bLabel}</span>
                        <ColumnsHelpLink />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {slots.map((slot) => (
                    <tr key={slot.arenaId} className="transition hover:bg-zinc-800/70">
                      <td className="px-3 py-2.5 align-top">
                        <Link
                          href={`/arena/${slot.arenaId}`}
                          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-300"
                        >
                          <IconChip icon={arenaIcon(slot.arenaId)} title={`${slot.arenaName} arena`} />
                          {slot.arenaName}
                        </Link>
                        {slot.battleHref && (
                          <div className="mt-1">
                            <Link
                              href={slot.battleHref}
                              className="text-[10px] uppercase tracking-wide text-emerald-400/80 underline decoration-emerald-400/30 hover:text-emerald-300"
                              title="These two share an arena — see their judged story-by-story battle"
                            >
                              judged battle →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">{slotCell(slot.a, slot.winner === 'a')}</td>
                      <td className="px-3 py-2.5 align-top">{slotCell(slot.b, slot.winner === 'b')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* One line visible; the cross-arena + no-evidence caveats stay one click away. */}
            <p className="text-xs text-zinc-500">
              A slot&rsquo;s green side has the higher published Overall score in that arena.
            </p>
            <details className="mt-1 text-xs text-zinc-500">
              <summary className="cursor-pointer text-zinc-400 transition hover:text-emerald-300">
                How to read the aggregates
              </summary>
              <p className="mt-1.5">
                An empty cell means that stack has nothing in the slot. Scores are computed within
                each product&rsquo;s own arena, so cross-arena aggregates are directional — this
                page compares evidence aggregates, it does not judge one stack against the other.
                And &ldquo;0 verified interconnects&rdquo; means no evidence found in our corpus,
                never &ldquo;doesn&rsquo;t integrate&rdquo;.
              </p>
            </details>
          </section>
        </>
      )}
    </div>
  )
}
