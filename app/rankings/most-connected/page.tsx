import type { Metadata } from 'next'
import Link from 'next/link'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import RankingsNav from '@/components/RankingsNav'
import { loadAll, type CategoryData } from '@/lib/data'
import { loadIntegrationGraph, productRefIndex } from '@/lib/integrations'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import type { Product } from '@/lib/schemas'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

interface NeighborChip {
  productId: string
  name: string
  arenaId: string
  mentions: number
}

interface ConnectedRow {
  product: Product
  arenaId: string
  arenaName: string
  neighborCount: number
  mentionCount: number
  topNeighbors: NeighborChip[]
}

// One row per product with ≥1 verified integration edge in the fleet-wide graph
// (lib/integrations.ts): degree = distinct verified neighbors, mentions = evidence-backed
// quotes behind them. Products absent from the graph are absent from the table — per the
// integrations honesty contract, a missing edge means "no evidence found in our corpus",
// never "doesn't integrate", so an absent product is unranked, not ranked last with 0.
function buildConnectedRows(categories: CategoryData[]): ConnectedRow[] {
  const graph = loadIntegrationGraph(categories.map((d) => d.category.id))
  const refs = productRefIndex(categories)
  const productById = new Map<string, Product>()
  for (const data of categories) {
    for (const p of data.products) if (!productById.has(p.id)) productById.set(p.id, p)
  }
  const rows: ConnectedRow[] = []
  for (const [productId, neighbors] of graph) {
    const ref = refs.get(productId)
    const product = productById.get(productId)
    if (!ref || !product) continue
    const topNeighbors = [...neighbors]
      .sort((a, b) => b.sources.length - a.sources.length || a.productId.localeCompare(b.productId))
      .slice(0, 3)
      .map((n) => ({
        productId: n.productId,
        name: refs.get(n.productId)?.name ?? n.productId,
        arenaId: n.arena,
        mentions: n.sources.length,
      }))
    rows.push({
      product,
      arenaId: ref.arenaId,
      arenaName: ref.arenaName,
      neighborCount: neighbors.length,
      mentionCount: neighbors.reduce((sum, n) => sum + n.sources.length, 0),
      topNeighbors,
    })
  }
  return rows.sort(
    (a, b) =>
      b.neighborCount - a.neighborCount ||
      b.mentionCount - a.mentionCount ||
      a.product.name.localeCompare(b.product.name),
  )
}

export function generateMetadata(): Metadata {
  const rows = buildConnectedRows(loadAll())
  const leader = rows[0]
  return {
    title: `Most connected — ${rows.length} products ranked by verified integrations — Ultrametric`,
    description: `Which products verifiably connect to the most other tracked products? ${leader ? `${leader.product.name} leads with ${leader.neighborCount} verified connections.` : ''} Every edge carries a verbatim evidence quote — verified mechanically, or dropped.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Fifth global ranking,
// derived from the fleet-wide integration graph (the same data /integrations visualizes).
export const dynamic = 'force-static'

export default function MostConnectedRankingPage() {
  const categories = loadAll()
  const totalProducts = categories.reduce((sum, data) => sum + data.products.length, 0)
  const rows = buildConnectedRows(categories)
  const jsonLd = rankingJsonLd(
    'Most connected — verified integration ranking',
    'Products ranked by how many other tracked products they verifiably connect to, with every edge backed by a verbatim evidence quote.',
    rows.map((row) => ({
      name: row.product.name,
      path: `/arena/${row.arenaId}/product/${row.product.id}`,
      applicationCategory: row.arenaName,
      properties: { verifiedConnections: row.neighborCount, evidenceBackedMentions: row.mentionCount },
    })),
  )

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "most-connected": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="most-connected" title="Most connected — verified integration ranking" size={16} className="text-zinc-500" />
          Global ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Most connected — who verifiably plugs into the most products
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The {rows.length} products (of {totalProducts} tracked) with at least one verified integration edge,
          ranked by how many other tracked products they connect to. Every edge is extracted from evidence we
          already collected and carries a verbatim quote — verified mechanically, or dropped. See the full graph
          with every excerpt on the{' '}
          <Link href="/integrations" className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            integration graph
          </Link>
          .
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          A product missing from this list means no integration evidence was found in our corpus — never that it
          doesn&rsquo;t integrate. Connections count distinct products; mentions count the evidence quotes behind them.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Product</th>
              <th className="px-3 py-2 font-normal" title="Distinct tracked products with ≥1 evidence-backed integration edge to this one">
                <span className="inline-flex items-center gap-1.5">Connections<ColumnsHelpLink /></span>
              </th>
              <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Evidence-backed integration quotes behind those connections (a pair claimed from both sides counts twice)">
                Mentions
              </th>
              <th className="hidden px-3 py-2 font-normal md:table-cell" title="This product's three most-mentioned verified neighbors">
                Top connections
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row, i) => (
              <tr key={row.product.id} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${row.arenaId}/product/${row.product.id}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogo product={row.product} size={16} />
                    <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                    <ShutdownBadge shutdown={row.product.shutdown} />
                  </Link>
                  <Link href={`/arena/${row.arenaId}`} className="mt-0.5 block text-xs text-zinc-500 hover:text-emerald-300">
                    {row.arenaName}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">{row.neighborCount}</td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">{row.mentionCount}</td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <span className="flex flex-wrap gap-1.5">
                    {row.topNeighbors.map((n) => (
                      <Link
                        key={n.productId}
                        href={`/arena/${n.arenaId}/product/${n.productId}`}
                        title={`${row.product.name} ↔ ${n.name}: ${n.mentions} evidence-backed ${n.mentions === 1 ? 'mention' : 'mentions'}`}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
                      >
                        {n.name}
                        <span className="tabular-nums text-zinc-500">{n.mentions}</span>
                      </Link>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="most-connected" />
    </div>
  )
}
