import type { Metadata } from 'next'
import Link from 'next/link'
import AgentAccessGlyphs from '@/components/AgentAccessGlyphs'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import RankingsNav from '@/components/RankingsNav'
import { loadAll, type CategoryData } from '@/lib/data'
import { isGroupUntested } from '@/lib/data-helpers'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

interface ApiRow {
  data: CategoryData
  product: CategoryData['products'][number]
  apiQuality: number | null
  /** True when every api-quality cell is a zero-evidence none/na — "never probed", NOT "scored 0". */
  apiUntested: boolean
  agentReady: number | null
  aiEra: number | null
}

// Every product ranked by API quality — the group-scoped agenticness index for "how good is
// the API surface once an agent is there" (lib/scoring.ts). The honesty distinction this page
// exists to render: a product whose api-quality cells all lack evidence is UNTESTED (unscored,
// sorts last), which is a different claim from a product that was judged and scored 0.
function buildApiRows(categories: CategoryData[]): ApiRow[] {
  const rows: ApiRow[] = []
  for (const data of categories) {
    for (const entry of data.rankings.leaderboard) {
      const product = data.products.find((p) => p.id === entry.productId)
      if (!product) continue
      rows.push({
        data,
        product,
        apiQuality: entry.apiQuality,
        apiUntested: isGroupUntested(data, product.id, 'api-quality'),
        agentReady: entry.agentReady,
        aiEra: entry.aiEra,
      })
    }
  }
  return rows.sort((a, b) => {
    // Untested/unscored rows sort last, together — neither has a number to rank on.
    const aScored = !a.apiUntested && a.apiQuality !== null
    const bScored = !b.apiUntested && b.apiQuality !== null
    if (aScored !== bScored) return aScored ? -1 : 1
    if (aScored && bScored && a.apiQuality !== b.apiQuality) return b.apiQuality! - a.apiQuality!
    return tiebreak(a, b)
  })
}

function tiebreak(a: ApiRow, b: ApiRow): number {
  const byNullable = (x: number | null, y: number | null) => {
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    return y - x
  }
  return (
    byNullable(a.agentReady, b.agentReady) ||
    byNullable(a.aiEra, b.aiEra) ||
    a.product.name.localeCompare(b.product.name)
  )
}

export function generateMetadata(): Metadata {
  const rows = buildApiRows(loadAll())
  const leader = rows[0]
  return {
    title: `Best API — all ${rows.length} products ranked by API quality — Ultrametric`,
    description: `Whose API is actually good once an agent gets there — machine-readable specs, sandboxes, versioning, interactive docs? ${leader && leader.apiQuality !== null ? `${leader.product.name} leads with ${leader.apiQuality.toFixed(0)}/100.` : ''} Untested APIs are unscored, never shown as 0.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Global ranking over the
// api-quality group index, with the untested-vs-zero distinction rendered honestly.
export const dynamic = 'force-static'

export default function BestApiRankingPage() {
  const categories = loadAll()
  const rows = buildApiRows(categories)
  const untestedCount = rows.filter((r) => r.apiUntested).length
  const jsonLd = rankingJsonLd(
    'Best API — API quality ranking',
    'Products ranked by agent-tested API quality: machine-readable specs, sandboxes, versioning policy, and interactive docs. Untested APIs are unscored, never zero.',
    rows
      .filter((r) => !r.apiUntested)
      .map((row) => ({
        name: row.product.name,
        path: `/arena/${row.data.category.id}/product/${row.product.id}`,
        applicationCategory: row.data.category.name,
        properties: { apiQuality: row.apiQuality, agentReady: row.agentReady },
      })),
  )

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "best-api": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="best-api" title="Best API — API quality ranking" size={16} className="text-zinc-500" />
          Global ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Best API — the strongest surfaces once an agent is in
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {rows.length} products from every ranking, ranked by API QUALITY: machine-readable specs, sandbox
          environments, versioning policy, and interactive docs — how good the API surface is once an agent has
          reached it (reachability itself is the{' '}
          <Link href="/rankings/agentic" className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            agent-ready ranking
          </Link>
          ). Ties break on agent-readiness, then Overall score.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          {untestedCount} products show <span className="italic">untested</span> instead of a number: every
          api-quality product user story is a zero-evidence blank — we found nothing either way and never probed it. That is a
          different claim from a scored 0 (judged, and the evidence came up short), so they sort last, unranked.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Product</th>
              <th className="px-3 py-2 font-normal" title="API quality (0–100): machine-readable spec, sandbox, versioning policy, interactive docs — agent tested. 'untested' = no evidence either way, unscored rather than zero.">
                <span className="inline-flex items-center gap-1.5">API quality<ColumnsHelpLink /></span>
              </th>
              <th className="hidden px-3 py-2 font-normal sm:table-cell" title="AGENT-READY (0–100): can an agent reach the product at all — API/CLI/MCP/webhooks/SDKs/docs">
                Agent-ready
              </th>
              <th className="hidden px-3 py-2 font-normal md:table-cell" title="Agent access verdicts at a glance: MCP server, official CLI, public API">
                Access
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row, i) => (
              <tr key={`${row.data.category.id}:${row.product.id}`} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">
                  {row.apiUntested || row.apiQuality === null ? <span className="text-zinc-600">—</span> : i + 1}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${row.data.category.id}/product/${row.product.id}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogo product={row.product} size={16} />
                    <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                  </Link>
                  <Link href={`/arena/${row.data.category.id}`} className="mt-0.5 block text-xs text-zinc-500 hover:text-emerald-300">
                    {row.data.category.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">
                  {row.apiUntested ? (
                    <span className="font-sans text-xs italic text-zinc-500" title="No API-quality evidence found or probed either way — unscored, not zero.">
                      untested
                    </span>
                  ) : row.apiQuality === null ? (
                    <span className="font-sans text-xs text-zinc-500">n/a</span>
                  ) : (
                    <>{row.apiQuality.toFixed(0)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">
                  {row.agentReady === null ? <span className="font-sans text-xs text-zinc-500">n/a</span> : <>{row.agentReady.toFixed(0)}<span className="text-zinc-500">/100</span></>}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <AgentAccessGlyphs data={row.data} productId={row.product.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="best-api" />
    </div>
  )
}
