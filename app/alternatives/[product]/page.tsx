import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AiEraBadge from '@/components/AiEraBadge'
import ProductLogo from '@/components/ProductLogo'
import ScoreBar from '@/components/ScoreBar'
import ShutdownBadge from '@/components/ShutdownBadge'
import { adjacentProducts, findUltrametric, rivalsFor } from '@/lib/alternatives'
import { loadAll } from '@/lib/data'
import { humanizeTheme } from '@/lib/icons'
import { SITE_URL } from '@/lib/site'

// "Alternatives to <X>": X's arena rivals ranked by the same agent-tested leaderboard,
// each with its top story-level wins over X (from the derived battle rounds — see
// lib/alternatives.ts), plus a few adjacent-arena products. One page per unique product id
// (a duplicated id — square — resolves to its first arena, same rule as the badge generator).

export function generateStaticParams() {
  const seen = new Set<string>()
  return loadAll().flatMap((data) =>
    data.products.filter((p) => !seen.has(p.id) && (seen.add(p.id), true)).map((p) => ({ product: p.id })),
  )
}

export const dynamicParams = false

const fmtScore = (n: number | null) => (n === null ? 'untested' : `${n.toFixed(0)}/100`)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ product: string }>
}): Promise<Metadata> {
  const { product: productId } = await params
  const found = findUltrametric(loadAll(), productId)
  if (!found) return { title: 'Alternatives — Ultrametric' }
  const { data, product } = found
  const year = new Date().getFullYear()
  const rivals = rivalsFor(data, productId)
  const topNames = rivals.slice(0, 3).map((r) => r.product.name).join(', ')
  return {
    title: `Alternatives to ${product.name} (${year}) — evidence-scored — Ultrametric`,
    description: `The best ${product.name} alternatives in ${year}, ranked by evidence — ${topNames} and ${Math.max(rivals.length - 3, 0)} more ${data.category.name} products, each judged against the same user stories with cited proof, never opinion.`,
    alternates: { canonical: `${SITE_URL}/alternatives/${productId}` },
  }
}

export default async function AlternativesPage({ params }: { params: Promise<{ product: string }> }) {
  const { product: productId } = await params
  const categories = loadAll()
  const found = findUltrametric(categories, productId)
  if (!found) notFound()
  const { data, product } = found
  const rivals = rivalsFor(data, productId)
  const adjacent = adjacentProducts(categories, data, productId)
  const baseEntry = data.rankings.leaderboard.find((e) => e.productId === productId)
  const baseRank = data.rankings.leaderboard.findIndex((e) => e.productId === productId) + 1

  // Honest ItemList JSON-LD, same discipline as the arena page: leaderboard-derived ordering
  // and our clearly-labeled custom metrics only — never a fabricated star rating.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Alternatives to ${product.name}`,
    description: `Evidence-scored ${data.category.name} alternatives to ${product.name}.`,
    itemListElement: rivals.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: r.product.name,
        url: `${SITE_URL}/arena/${data.category.id}/product/${r.product.id}`,
        applicationCategory: data.category.name,
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'aiEra', value: r.entry.aiEra },
          { '@type': 'PropertyValue', name: 'score', value: r.entry.score },
        ],
      },
    })),
  }

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Alternatives</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Alternatives to {product.name}
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          {rivals.length} {data.category.name} rivals, ranked by the same agent-tested leaderboard —{' '}
          {product.name} itself ranks{' '}
          <Link href={`/arena/${data.category.id}/product/${product.id}`} className="text-emerald-300 hover:underline">
            #{baseRank} with a Overall score of {fmtScore(baseEntry?.aiEra ?? null)}
          </Link>
          . Every &ldquo;beats {product.name} on&rdquo; below comes from a judged head-to-head round with cited
          evidence — see the{' '}
          <Link href="/methodology" className="text-emerald-300 hover:underline">
            methodology
          </Link>
          .
        </p>
      </div>

      <ol className="space-y-3">
        {rivals.map((rival) => (
          <li key={rival.product.id} className="rounded-xl border border-zinc-800 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-8 shrink-0 font-mono text-sm text-zinc-500">#{rival.rank}</span>
              <ProductLogo product={rival.product} size={32} />
              <div className="min-w-0">
                <Link
                  href={`/arena/${data.category.id}/product/${rival.product.id}`}
                  className="font-semibold hover:text-emerald-300"
                >
                  {rival.product.name}
                </Link>
                {/* The rival list is the judged arena field, honestly complete — but a rival
                    whose vendor announced a shutdown is tagged, never silently offered. */}
                <ShutdownBadge shutdown={rival.product.shutdown} source={rival.product.shutdownSource} className="ml-2" />
                {/* The company name clicks through to the same judged product page as the
                    product name above it (founder 2026-10-02: vendor names like
                    "Intercom (Fin…)" lead somewhere). */}
                <p className="text-xs text-zinc-500">
                  <Link
                    href={`/arena/${data.category.id}/product/${rival.product.id}`}
                    className="transition hover:text-emerald-300"
                  >
                    {rival.product.vendor}
                  </Link>
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                  Overall score <AiEraBadge value={rival.entry.aiEra} size="xs" />
                </span>
                <Link
                  href={`/arena/${data.category.id}/battle/${rival.battleSlug}`}
                  className="rounded-full border border-zinc-800 px-3 py-1 text-xs hover:border-emerald-400 hover:text-emerald-300"
                >
                  vs {product.name} →
                </Link>
              </div>
            </div>
            <div className="mt-2 flex max-w-sm items-center gap-2 pl-11">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">coverage</span>
              <ScoreBar score={rival.entry.score} className="flex-1" />
            </div>
            <div className="mt-2 pl-11 text-xs">
              {rival.wins.length > 0 ? (
                <p className="text-zinc-400">
                  <span className="text-emerald-400">Beats {product.name} on:</span>{' '}
                  {rival.wins.map((w, i) => (
                    <span key={w.storyId}>
                      {i > 0 && ' · '}
                      <Link
                        href={`/arena/${data.category.id}/product/${rival.product.id}#story-${w.storyId}`}
                        className="underline decoration-zinc-700 hover:text-emerald-300"
                      >
                        {w.title}
                      </Link>
                    </span>
                  ))}
                </p>
              ) : (
                <p className="italic text-zinc-500">
                  No story-level wins over {product.name} in the judged head-to-head.
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {adjacent.length > 0 && (
        <div>
          <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold">Adjacent rankings</h2>
          <p className="mb-3 text-xs text-zinc-400">
            Top-ranked products from rankings whose story taxonomies overlap {data.category.name}&apos;s — worth a
            look if your real problem sits next door.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {adjacent.map((adj) => (
              <Link
                key={`${adj.categoryId}-${adj.product.id}`}
                href={`/arena/${adj.categoryId}/product/${adj.product.id}`}
                className="rounded-xl border border-zinc-800 p-4 transition hover:border-emerald-400/60"
              >
                <p className="font-semibold">{adj.product.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                  Top-ranked in {adj.categoryName} · Overall score <AiEraBadge value={adj.entry.aiEra} size="xs" />
                </p>
                <p className="mt-2 text-[11px] text-zinc-500">shares: {adj.sharedThemes.map(humanizeTheme).join(', ')}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Full leaderboard:{' '}
        <Link href={`/arena/${data.category.id}`} className="text-emerald-300 hover:underline">
          {data.category.name} ranking →
        </Link>
      </p>
    </div>
  )
}
