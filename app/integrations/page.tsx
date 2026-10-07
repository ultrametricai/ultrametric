import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { IntegrationChip, chipTitle, type IntegrationChipData } from '@/components/IntegrationChips'
import ProductLogoView from '@/components/ProductLogoView'
import { classifyClassicPairs, loadClassicPairs } from '@/lib/classicPairs'
import { loadAll } from '@/lib/data'
import {
  integrationStats,
  loadIntegrationGraph,
  neighborsOf,
  productRefIndex,
  type IntegrationGraph,
  type ProductRef,
} from '@/lib/integrations'
import { hasLogo } from '@/lib/logos'

export const metadata: Metadata = {
  title: 'Integration graph — Ultrametric',
  description:
    'Who verifiably connects to whom: every edge between tracked products is backed by a verbatim quote from collected evidence — no edge without a receipt, and a missing edge only ever means no evidence was found.',
}

function chipFor(
  productId: string,
  sources: Array<{ fromProductId: string; excerpt: string }>,
  refs: Map<string, ProductRef>,
): IntegrationChipData | null {
  const ref = refs.get(productId)
  if (!ref) return null
  return {
    productId,
    name: ref.name,
    arenaId: ref.arenaId,
    arenaName: ref.arenaName,
    title: chipTitle(sources, (pid) => refs.get(pid)?.name ?? pid),
    hasLogo: hasLogo(productId),
  }
}

function neighborChips(graph: IntegrationGraph, productId: string, refs: Map<string, ProductRef>): IntegrationChipData[] {
  return neighborsOf(graph, productId)
    .flatMap((n) => chipFor(n.productId, n.sources, refs) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name))
}

// The ecosystem view, tables first (founder call: the grand-count stat tiles were arbitrary and
// are gone): most-connected ranking, then the per-arena adjacency list, then classic pairings.
// Fully static — everything resolves from data/*/integrations.json at build time.
export default function IntegrationsPage() {
  const categories = loadAll()
  const refs = productRefIndex(categories)
  const graph = loadIntegrationGraph(categories.map((d) => d.category.id))
  const stats = integrationStats(graph, 10)

  // Group connected products under their home arena (a multi-arena product appears once, in its
  // canonical arena — same convention as productRefIndex).
  const arenaSections = categories.flatMap((data) => {
    const rows = data.products
      .filter((p) => refs.get(p.id)?.arenaId === data.category.id)
      .flatMap((p) => {
        const chips = neighborChips(graph, p.id, refs)
        return chips.length > 0 ? [{ product: p, chips }] : []
      })
    return rows.length > 0 ? [{ category: data.category, rows }] : []
  })

  const topChips = stats.topConnected.flatMap(({ productId, neighborCount }) => {
    const ref = refs.get(productId)
    return ref ? [{ productId, neighborCount, hasLogo: hasLogo(productId), ...ref }] : []
  })

  // Classic pairings: curated expectations classified against the verified graph — a pair only
  // ever renders as "verified" (edge + quote exists) or "no evidence found yet". Pairs whose ids
  // don't resolve to tracked products are dropped defensively (tests forbid them anyway).
  const classic = classifyClassicPairs(
    loadClassicPairs().filter((p) => refs.has(p.a) && refs.has(p.b)),
    graph,
  )

  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-3xl text-center">
        {/* seed "integrations": same concept mark as the Explore menu's Integration graph entry. */}
        <h1 className="font-display leading-[1.1] mt-1 flex items-center justify-center gap-2.5 text-3xl font-bold tracking-tight">
          <GeoMark seed="integrations" title="Integration graph — who verifiably connects to whom" size={26} className="text-zinc-500" />
          Integration graph
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          Who verifiably connects to whom — every edge carries a verbatim quote from collected
          evidence (hover any chip to read it).
        </p>
      </section>

      {topChips.length > 0 && (
        <section>
          <h2 className="font-display leading-[1.1] mb-3 text-lg font-semibold">Most connected</h2>
          <div className="flex flex-wrap gap-2">
            {topChips.map((t) => (
              <Link
                key={t.productId}
                href={`/arena/${t.arenaId}/product/${t.productId}`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
              >
                <ProductLogoView product={{ id: t.productId, name: t.name }} size={16} hasLogo={t.hasLogo} />
                <span className="font-medium">{t.name}</span>
                <span className="text-xs tabular-nums text-emerald-400" title={`${t.neighborCount} verified integration partners`}>
                  {t.neighborCount}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="font-display leading-[1.1] text-lg font-semibold">By ranking</h2>
        {arenaSections.map(({ category, rows }) => (
          <div key={category.id}>
            <h3 className="mb-2 text-sm font-semibold">
              <Link href={`/arena/${category.id}`} className="text-zinc-300 transition hover:text-emerald-300">
                {category.name}
              </Link>
            </h3>
            <div className="divide-y divide-zinc-800/70 rounded-2xl border border-zinc-800">
              {rows.map(({ product, chips }) => (
                <div key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                  <Link
                    href={`/arena/${category.id}/product/${product.id}`}
                    className="flex w-40 shrink-0 items-center gap-2 text-sm font-medium text-zinc-200 transition hover:text-emerald-300"
                  >
                    <ProductLogoView product={{ id: product.id, name: product.name }} size={16} hasLogo={hasLogo(product.id)} />
                    <span className="truncate">{product.name}</span>
                  </Link>
                  {/* basis-64: below ~sm widths the chip cloud wraps onto its own full-width
                      line instead of squeezing beside the w-40 name (375px: no sideways scroll). */}
                  <div className="flex min-w-0 flex-1 basis-64 flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <IntegrationChip key={chip.productId} chip={chip} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {arenaSections.length === 0 && (
          <p className="rounded-2xl border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            No verified integration edges yet — the integrations pipeline stage hasn&rsquo;t run.
          </p>
        )}
      </section>

      <section aria-label="classic pairings">
        <h2 className="font-display leading-[1.1] flex items-center gap-2 text-lg font-semibold">
          <GeoMark seed="classic-pairs" title="Classic pairings — the interconnects everyone expects, checked against our evidence" size={18} className="text-zinc-500" />
          Classic pairings
        </h2>
        <p className="mb-1 mt-1 max-w-2xl text-xs text-zinc-500">
          {classic.statuses.length} pairings the industry simply expects, checked against the
          evidence graph: <span className="text-emerald-300">{classic.verified} verified</span> ·{' '}
          <span className="text-zinc-400">{classic.unverified} no evidence found yet</span>.
        </p>
        {/* The long honesty explainer lives here, collapsed — the headline above stays one line. */}
        <details className="mb-3 max-w-2xl text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400 transition hover:text-emerald-300">
            What does &ldquo;no evidence yet&rdquo; mean?
          </summary>
          <p className="mt-1.5">
            Exactly that: our corpus hasn&rsquo;t surfaced a quote for the pairing — never a claim
            that the integration doesn&rsquo;t exist. A pairing renders as verified only when an
            evidence-backed edge with a verbatim quote exists in the graph; the unverified half is
            our evidence-coverage to-do list.
          </p>
        </details>
        <div className="grid gap-2 sm:grid-cols-2">
          {classic.statuses.map((s) => {
            const a = refs.get(s.a)!
            const b = refs.get(s.b)!
            return (
              <div
                key={s.key}
                title={
                  s.verified
                    ? `${s.expectation}\n\n${chipTitle(s.sources, (pid) => refs.get(pid)?.name ?? pid)}`
                    : `${s.expectation}\n\nNo evidence-backed edge in our corpus yet — not a claim that they don't integrate.`
                }
                // min-w-0: grid items otherwise refuse to shrink below their min-content width,
                // and a long pair name would drag the whole page sideways at 375px.
                className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                  s.verified ? 'border-emerald-400/30 bg-emerald-400/[0.04]' : 'border-zinc-800'
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5 text-sm">
                  <Link
                    href={`/arena/${a.arenaId}/product/${s.a}`}
                    className="flex min-w-0 items-center gap-1.5 font-medium text-zinc-200 transition hover:text-emerald-300"
                  >
                    <ProductLogoView product={{ id: s.a, name: a.name }} size={16} hasLogo={hasLogo(s.a)} />
                    <span className="truncate">{a.name}</span>
                  </Link>
                  <span aria-hidden className="shrink-0 text-zinc-600">↔</span>
                  <Link
                    href={`/arena/${b.arenaId}/product/${s.b}`}
                    className="flex min-w-0 items-center gap-1.5 font-medium text-zinc-200 transition hover:text-emerald-300"
                  >
                    <ProductLogoView product={{ id: s.b, name: b.name }} size={16} hasLogo={hasLogo(s.b)} />
                    <span className="truncate">{b.name}</span>
                  </Link>
                </div>
                {s.verified ? (
                  <span className="shrink-0 rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    ✓ verified
                  </span>
                ) : (
                  <span className="shrink-0 rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    no evidence yet
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Pipeline methodology, collapsed — the page-wide honesty caveat rides inside it. */}
      <details className="max-w-2xl text-xs text-zinc-500">
        <summary className="cursor-pointer text-zinc-400 transition hover:text-emerald-300">
          How edges are found and verified
        </summary>
        <p className="mt-1.5">
          Edges come from each product&rsquo;s collected evidence corpus — its docs, GitHub,
          community posts, and (for the most-connected products) its official
          integrations-directory page, which we crawl as a first-party source: an exact-name
          prefilter finds mentions of other tracked products, an LLM classifies each mention (real
          integration vs comparison vs coincidence), and every kept edge&rsquo;s quote is verified
          verbatim against its evidence item in code — unverifiable ones are dropped. A missing
          edge means no evidence of an integration was found in our corpus — never that two
          products don&rsquo;t integrate.
        </p>
      </details>
    </div>
  )
}
