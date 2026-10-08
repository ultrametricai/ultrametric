import type { Metadata } from 'next'
import Link from 'next/link'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import GeoMark from '@/components/GeoMark'
import HotChip from '@/components/HotChip'
import OssPill from '@/components/OssPill'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import RankingsNav from '@/components/RankingsNav'
import popularIds from '@/data/popular-products.json'
import { loadAll, type CategoryData } from '@/lib/data'
import { computeHotFlags } from '@/lib/hotProducts'
import { formatCompact, hasSignal } from '@/lib/popularity'
import {
  dedupeByProduct,
  rankByInstalls,
  rankByStars,
  weeklyInstalls,
  type HotFlag,
  type PopularEntry,
} from '@/lib/popularRanking'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import type { Product } from '@/lib/schemas'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The fairness rule this page is built around: stars, installs, and closed-SaaS adoption are
// DIFFERENT instruments measuring different populations, so they are never blended into one
// ranked list (see lib/popularRanking.ts). Three honestly-labeled segments instead:
// star-tracked repos, registry-installed packages, and the curated no-public-counter strip —
// plus the 🔥 "hot right now" section, where every flag carries its measured reason string.

interface PopularRow extends PopularEntry {
  data: CategoryData
  product: Product
  hot?: HotFlag
}

interface PopularIndex {
  hot: PopularRow[]
  byStars: PopularRow[]
  byInstalls: PopularRow[]
  /** Curated widely-adopted products with NO public counter — unranked by construction. */
  curated: PopularRow[]
}

const HOT_SOURCE_LABELS: Record<HotFlag['source'], string> = {
  tracked: 'tracked star growth',
  young: 'young repo, big star count',
  curated: 'curated (history too short)',
}

const CURATED_POPULAR = new Set<string>(popularIds as string[])

function buildPopularIndex(categories: CategoryData[]): PopularIndex {
  const hotFlags = computeHotFlags(categories)
  const rows: PopularRow[] = []
  const measuredIds = new Set<string>()
  for (const data of categories) {
    for (const product of data.products) {
      const p = data.popularity[product.id]
      if (!hasSignal(p)) continue
      measuredIds.add(product.id)
      rows.push({
        productId: product.id,
        name: product.name,
        arenaId: data.category.id,
        arenaName: data.category.name,
        oss: product.type === 'oss',
        stars: p.stars,
        starsPerYear: p.starsPerYear,
        npmWeekly: p.npmWeekly,
        pypiWeekly: p.pypiWeekly,
        data,
        product,
        hot: hotFlags.get(product.id),
      })
    }
  }
  const deduped = dedupeByProduct(rows)

  // Curated strip: only products that genuinely have NO public counter anywhere — a product
  // with a measured signal already competes in a ranked segment and would be double-billed here.
  const curated: PopularRow[] = []
  const seenCurated = new Set<string>()
  for (const data of categories) {
    for (const product of data.products) {
      if (!CURATED_POPULAR.has(product.id)) continue
      if (measuredIds.has(product.id) || seenCurated.has(product.id)) continue
      seenCurated.add(product.id)
      curated.push({
        productId: product.id,
        name: product.name,
        arenaId: data.category.id,
        arenaName: data.category.name,
        oss: product.type === 'oss',
        data,
        product,
        hot: hotFlags.get(product.id),
      })
    }
  }
  curated.sort((a, b) => a.name.localeCompare(b.name))

  // Hot rows: every flagged product that exists in some arena, measured evidence first
  // (tracked > young > curated), then by stars.
  const sourceOrder: Record<HotFlag['source'], number> = { tracked: 0, young: 1, curated: 2 }
  const hot = [...deduped, ...curated]
    .filter((row): row is PopularRow & { hot: HotFlag } => row.hot !== undefined)
    .sort((a, b) => sourceOrder[a.hot.source] - sourceOrder[b.hot.source] || (b.stars ?? 0) - (a.stars ?? 0) || a.name.localeCompare(b.name))

  return { hot, byStars: rankByStars(deduped), byInstalls: rankByInstalls(deduped), curated }
}

export function generateMetadata(): Metadata {
  const { hot, byStars, byInstalls } = buildPopularIndex(loadAll())
  const topStars = byStars[0]
  return {
    title: 'Most popular — stars, installs, and what’s hot — Ultrametric',
    description: `Popularity measured fairly: ${byStars.length} products by GitHub stars${topStars?.stars !== undefined ? ` (${topStars.name} leads with ${formatCompact(topStars.stars)})` : ''}, ${byInstalls.length} by weekly npm/PyPI installs, plus ${hot.length} exploding in interest right now — each with its measured reason. Never blended into one fake number, never part of the Overall score.`,
  }
}

// Static page — no dynamic segments; every number comes from the committed popularity.json /
// popularity-history.jsonl files (public registries, no API key — see METHODOLOGY.md).
export const dynamic = 'force-static'

function ProductCell({ row }: { row: PopularRow }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <Link
          href={`/arena/${row.arenaId}/product/${row.productId}`}
          className="flex min-w-0 items-center gap-2 hover:text-emerald-300"
        >
          <ProductLogo product={row.product} size={16} />
          <span className="min-w-0 truncate font-medium">{row.name}</span>
        </Link>
        {row.hot && <HotChip reason={row.hot.reason} />}
        <ShutdownBadge shutdown={row.product.shutdown} source={row.product.shutdownSource} />
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <Link href={`/arena/${row.arenaId}`} className="text-xs text-zinc-500 hover:text-emerald-300">
          {row.arenaName}
        </Link>
        {row.oss && <OssPill variant="compact" />}
      </span>
    </>
  )
}

const num = (n: number) => formatCompact(n)

export default function PopularRankingPage() {
  const { hot, byStars, byInstalls, curated } = buildPopularIndex(loadAll())
  // JSON-LD covers the star segment only — the one list on this page that is a single-metric
  // global ranking. Installs and the curated strip are separate instruments (see the fairness
  // note above) and are not folded into the ItemList.
  const jsonLd = rankingJsonLd(
    'Most popular — GitHub-tracked products by stars',
    'Products with a tracked public repo, ranked by GitHub stars (velocity shown as stars/year). Sourced from public registries; never part of the Overall score.',
    byStars.map((row) => ({
      name: row.name,
      path: `/arena/${row.arenaId}/product/${row.productId}`,
      applicationCategory: row.arenaName,
      properties: {
        githubStars: row.stars ?? null,
        starsPerYear: row.starsPerYear !== undefined ? Math.round(row.starsPerYear) : null,
        hot: row.hot ? row.hot.reason : null,
      },
    })),
  )

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "popular": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="popular" title="Most popular — measured segments" size={16} className="text-zinc-500" />
          Global ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Most popular — stars, installs, and what&rsquo;s hot
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          You can&rsquo;t rank GitHub stars against a closed SaaS product&rsquo;s adoption — they&rsquo;re different
          instruments measuring different populations. So popularity here is three clearly-labeled segments that are
          never blended into one number: {byStars.length} products with a tracked public repo ranked by stars,{' '}
          {byInstalls.length} ranked by weekly npm/PyPI installs, and {curated.length} clearly-popular products with no
          public counter at all — plus what&rsquo;s exploding in interest right now, each flag with its measured reason.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Popularity is never part of the Overall score (
          <Link href="/methodology" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            methodology
          </Link>
          ) — it measures adoption, not agent-readiness. All numbers come from public registries (GitHub, npm, PyPI),
          no key required; a product missing from a segment was not measured there, which is not the same claim as zero.
        </p>
      </div>

      <section aria-label="hot right now" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="font-display leading-[1.1] text-lg font-semibold text-amber-300">
          🔥 Hot right now <span className="ml-1 text-xs font-normal text-zinc-500">{hot.length} products</span>
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Detected mechanically: top-decile star growth over the tracked window (with an absolute floor), or a very
          young repo whose star count alone is the explosion. A curated override exists for surges the data can&rsquo;t
          see yet (data/hot-products.json) — mechanical flags always win, and every flag carries its receipt.
        </p>
        {hot.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nothing clears the bar right now — the bar doesn&rsquo;t bend.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {hot.map((row) => (
              <li key={row.productId} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <span className="min-w-0">
                  <ProductCell row={row} />
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs text-amber-300">{row.hot!.reason}</span>
                  <span className="block text-[10px] text-zinc-500">{HOT_SOURCE_LABELS[row.hot!.source]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="github-tracked products by stars">
        <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold text-emerald-300">
          ★ By GitHub stars <span className="ml-1 text-xs font-normal text-zinc-500">{byStars.length} products</span>
        </h2>
        <p className="mb-2 text-xs text-zinc-400">
          Every product with a tracked public repo — open source and open-repo commercial products alike; the counter
          measures the repo. Velocity (stars/yr = stars ÷ repo age) shown alongside, never blended into the rank.
        </p>
        <div className={TABLE_SHELL}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className="w-10 px-3 py-2 font-normal">#</th>
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 font-normal" title="GitHub stars — absolute count from api.github.com at the last pipeline fetch">
                  <span className="inline-flex items-center gap-1.5">Stars<ColumnsHelpLink /></span>
                </th>
                <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Stars per year since the repo was created (stars ÷ repo age) — velocity, shown for context, never part of the rank">
                  ★/yr
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {byStars.map((row, i) => (
                <tr key={row.productId} className="transition hover:bg-zinc-900/50">
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <ProductCell row={row} />
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                    {row.product.urls.github ? (
                      <a href={row.product.urls.github} target="_blank" rel="noopener noreferrer" title="Open the GitHub repo" className="hover:text-emerald-300">
                        ★ {num(row.stars!)}
                      </a>
                    ) : (
                      <>★ {num(row.stars!)}</>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 font-mono tabular-nums text-emerald-400 sm:table-cell">
                    {row.starsPerYear === undefined ? <span className="text-zinc-600">—</span> : <>▲ {num(row.starsPerYear)}/yr</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="packages by weekly installs">
        <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold text-emerald-300">
          ⇩ By weekly installs <span className="ml-1 text-xs font-normal text-zinc-500">{byInstalls.length} products</span>
        </h2>
        <p className="mb-2 text-xs text-zinc-400">
          Products with a measured npm and/or PyPI package, ranked by combined weekly downloads — the two registries
          share a unit, so the sum is honest. A blank registry column means not published there, not zero.
        </p>
        <div className={TABLE_SHELL}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className="w-10 px-3 py-2 font-normal">#</th>
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 font-normal" title="npm weekly downloads + PyPI weekly downloads (api.npmjs.org / pypistats.org)">
                  <span className="inline-flex items-center gap-1.5">Installs/wk<ColumnsHelpLink /></span>
                </th>
                <th className="hidden px-3 py-2 font-normal sm:table-cell" title="npm weekly downloads (api.npmjs.org)">
                  npm
                </th>
                <th className="hidden px-3 py-2 font-normal sm:table-cell" title="PyPI weekly downloads (pypistats.org)">
                  PyPI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {byInstalls.map((row, i) => (
                <tr key={row.productId} className="transition hover:bg-zinc-900/50">
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <ProductCell row={row} />
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">{num(weeklyInstalls(row)!)}</td>
                  <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">
                    {row.npmWeekly === undefined ? <span className="text-zinc-600">—</span> : num(row.npmWeekly)}
                  </td>
                  <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">
                    {row.pypiWeekly === undefined ? <span className="text-zinc-600">—</span> : num(row.pypiWeekly)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="clearly popular, no public counter">
        <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold text-zinc-200">
          Clearly popular — no public counter{' '}
          <span className="ml-1 text-xs font-normal text-zinc-500">{curated.length} products</span>
        </h2>
        <p className="mb-2 text-xs text-zinc-400">
          Household names (Mercury, Linear, Notion&hellip;) publish no stars or download counts, so there is nothing
          fair to rank them by — pretending otherwise would be a fake number. Curated and deliberately UNRANKED
          (alphabetical): widely adopted, no public counter to show.
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {curated.map((row) => (
            <li key={row.productId} className="rounded-lg border border-zinc-800 px-3 py-2">
              <ProductCell row={row} />
            </li>
          ))}
        </ul>
      </section>

      <RankingsNav current="popular" />
    </div>
  )
}
