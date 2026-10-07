import type { Metadata } from 'next'
import Link from 'next/link'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import ConfidenceChip from '@/components/ConfidenceChip'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import RankingsNav from '@/components/RankingsNav'
import VerificationMixChip from '@/components/VerificationMixChip'
import { confidenceFor, type ProductConfidence } from '@/lib/confidence'
import { loadAll, type CategoryData } from '@/lib/data'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

interface TestedRow {
  data: CategoryData
  product: CategoryData['products'][number]
  confidence: ProductConfidence
}

// Every product ranked by its tested-evidence share (lib/confidence.ts): the fraction of
// applicable verdict cells whose STRONGEST cited evidence is tested (hands-on probe or
// inspectable source) rather than vendor docs or community commentary. The published scores
// are untouched — this ranks how solid each product's footing is, not how good the product is.
function buildTestedRows(categories: CategoryData[]): TestedRow[] {
  const rows: TestedRow[] = []
  for (const data of categories) {
    for (const product of data.products) {
      rows.push({ data, product, confidence: confidenceFor(data, product.id) })
    }
  }
  return rows.sort(
    (a, b) =>
      b.confidence.testedShare - a.confidence.testedShare ||
      b.confidence.coverage - a.confidence.coverage ||
      b.confidence.applicable - a.confidence.applicable ||
      a.product.name.localeCompare(b.product.name),
  )
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export function generateMetadata(): Metadata {
  const rows = buildTestedRows(loadAll())
  const leader = rows[0]
  return {
    title: `Most tested — all ${rows.length} products ranked by tested-evidence share — Ultrametric`,
    description: `Whose verdicts rest on hands-on probes and inspectable source rather than vendor claims? ${leader ? `${leader.product.name} leads with ${pct(leader.confidence.testedShare)} of applicable cells tested.` : ''} The scores themselves are unchanged — this ranks their footing.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Global ranking over the
// confidence layer (lib/confidence.ts) — the honesty pass made sortable.
export const dynamic = 'force-static'

export default function MostTestedRankingPage() {
  const categories = loadAll()
  const rows = buildTestedRows(categories)
  const jsonLd = rankingJsonLd(
    'Most tested — tested-evidence share ranking',
    'Products ranked by the share of applicable verdict cells backed by tested evidence (hands-on probe or inspectable source) rather than vendor claims alone.',
    rows.map((row) => ({
      name: row.product.name,
      path: `/arena/${row.data.category.id}/product/${row.product.id}`,
      applicationCategory: row.data.category.name,
      properties: {
        testedShare: Math.round(row.confidence.testedShare * 100),
        evidenceCoverage: Math.round(row.confidence.coverage * 100),
        confidenceGrade: row.confidence.grade,
      },
    })),
  )

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "most-tested": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="most-tested" title="Most tested — tested-evidence share ranking" size={16} className="text-zinc-500" />
          Global ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Most tested — ranked by tested-evidence share
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {rows.length} products from every ranking, ranked by tested share: the fraction of applicable verdict
          cells whose strongest cited evidence is tested — a{' '}
          <Link href="/proofs" className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            hands-on probe
          </Link>{' '}
          or inspectable source — rather than vendor docs or community commentary. Ties break on evidence coverage,
          then cell count. The published scores are unchanged; this ranks how solid their footing is (
          <Link href="/methodology#confidence" className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            confidence grades
          </Link>
          ).
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          A low tested share means we haven&rsquo;t probed much yet, not that the product fails — the{' '}
          <Link href="/pipeline" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            testing pipeline
          </Link>{' '}
          page leads with exactly those gaps.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Product</th>
              <th className="px-3 py-2 font-normal" title="Share of applicable verdict product user stories whose strongest cited evidence is tested (hands-on probe or inspectable source)">
                Tested
              </th>
              <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Share of applicable verdict product user stories that cite any evidence at all — the complement is 'we found nothing either way'">
                Evidenced
              </th>
              <th className="hidden px-3 py-2 font-normal md:table-cell" title="Verified verdict product user stories: probed by us or community-corroborated, out of all evidenced product user stories">
                Verified product user stories
              </th>
              <th className="px-3 py-2 font-normal" title="Confidence grade A–D: how much of the published score rests on tested vs claimed evidence">
                <span className="inline-flex items-center gap-1.5">Grade<ColumnsHelpLink /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row, i) => (
              <tr key={`${row.data.category.id}:${row.product.id}`} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{ordinal(i + 1)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${row.data.category.id}/product/${row.product.id}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogo product={row.product} size={16} />
                    <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                    <ShutdownBadge shutdown={row.product.shutdown} />
                  </Link>
                  <Link href={`/arena/${row.data.category.id}`} className="mt-0.5 block text-xs text-zinc-500 hover:text-emerald-300">
                    {row.data.category.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">{pct(row.confidence.testedShare)}</td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">{pct(row.confidence.coverage)}</td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <VerificationMixChip
                    data={row.data}
                    productId={row.product.id}
                    href={`/arena/${row.data.category.id}/product/${row.product.id}#story-verdicts`}
                  />
                </td>
                <td className="px-3 py-2">
                  <ConfidenceChip confidence={row.confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="most-tested" />
    </div>
  )
}
