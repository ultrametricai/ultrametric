import Link from 'next/link'
import AgentAccessGlyphs from '@/components/AgentAccessGlyphs'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import AgenticBadge from '@/components/AgenticBadge'
import AiEraBadge from '@/components/AiEraBadge'
import AiModeBadge from '@/components/AiModeBadge'
import MomentumChip from '@/components/MomentumChip'
import OssPill from '@/components/OssPill'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import type { CategoryData } from '@/lib/data'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

interface IndexRow {
  data: CategoryData
  product: CategoryData['products'][number]
  entry: CategoryData['rankings']['leaderboard'][number]
}

// Flattens every category's leaderboard into one global list, then sorts by the AGENT-READY
// score (desc, nulls last) — the whole point of "The Agentic Index" is a cross-arena view of
// how friendly products are to AI agents, so agentReady (not the per-category aiEra/score) is
// the primary sort key. Ties break on apiQuality, then aiEra, both desc/nulls-last.
function buildIndex(categories: CategoryData[]): IndexRow[] {
  const rows: IndexRow[] = []
  for (const data of categories) {
    const productById = new Map(data.products.map((p) => [p.id, p]))
    for (const entry of data.rankings.leaderboard) {
      const product = productById.get(entry.productId)
      if (!product) continue
      rows.push({ data, product, entry })
    }
  }
  return rows.sort((x, y) => {
    const xr = x.entry.agentReady
    const yr = y.entry.agentReady
    if (xr === null && yr === null) return tiebreak(x, y)
    if (xr === null) return 1
    if (yr === null) return -1
    return yr - xr || tiebreak(x, y)
  })
}

function tiebreak(x: IndexRow, y: IndexRow): number {
  const xq = x.entry.apiQuality
  const yq = y.entry.apiQuality
  if (xq !== yq) {
    if (xq === null) return 1
    if (yq === null) return -1
    return yq - xq
  }
  const xe = x.entry.aiEra
  const ye = y.entry.aiEra
  if (xe === null && ye === null) return 0
  if (xe === null) return 1
  if (ye === null) return -1
  return ye - xe
}

// `limit` truncates to the top N rows (homepage preview mode); omit it for the full ranking
// (the /rankings/agentic page). Truncation happens after the sort, never before, so a preview
// is always a strict prefix of the full ranking.
export default function AgenticIndexTable({ categories, limit }: { categories: CategoryData[]; limit?: number }) {
  const allRows = buildIndex(categories)
  const rows = limit === undefined ? allRows : allRows.slice(0, limit)
  return (
    // `relative`: makes this scroll wrapper the containing block for the absolute-positioned
    // sr-only spans inside the wide table — without it they escape the overflow clip and
    // horizontally scroll the whole page on phones.
    <div className={`relative ${TABLE_SHELL}`}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className={TABLE_HEADER_ROW}>
            <th className="sticky left-0 z-10 w-14 bg-zinc-950 px-3 py-2 font-normal">#</th>
            <th className="sticky left-14 z-10 w-[170px] bg-zinc-950 px-3 py-2 font-normal">Product</th>
            <th className="px-3 py-2 font-normal"><span title="The product category (ranking) it competes in — click through for that ranking's full leaderboard">Ranking</span></th>
            <th className="px-3 py-2 font-normal"><span title="Agent-ready (0–100): how easily an outside AI agent or assistant can connect to and operate this product — APIs, command-line tools, MCP, docs">Agent-ready</span></th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell"><span title="API quality (0–100): how good the product's programming interface is — machine-readable spec, interactive docs, sandbox, versioning discipline">API quality</span></th>
            <th className="px-3 py-2 font-normal"><span title="Which agent doorways exist: MCP server, official command-line tool (CLI), public API — from judged evidence">Access</span></th>
            <th className="hidden px-3 py-2 font-normal md:table-cell"><span title="Built-in AI assistant mode, from the judged builtin-assistant story — its own column so every row keeps one height">AI mode</span></th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell"><span title="Adoption signal from public registries (GitHub stars, weekly installs) — context only, never part of any score">Popularity</span></th>
            <th className="px-3 py-2 font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span title="Overall score (0–100): the site's blended headline score — mostly agent-readiness and API quality, plus openness and built-in AI">Overall score</span>
                <ColumnsHelpLink />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.map((row, i) => (
            <tr key={`${row.data.category.id}:${row.product.id}`} className="group transition hover:bg-zinc-800/70">
              <td className="sticky left-0 z-[5] w-14 bg-zinc-950 px-3 py-2 font-mono tabular-nums text-zinc-400 group-hover:bg-zinc-800/70">{ordinal(i + 1)}</td>
              <td className="sticky left-14 z-[5] w-[170px] bg-zinc-950 px-3 py-2 group-hover:bg-zinc-800/70">
                <Link
                  href={`/arena/${row.data.category.id}/product/${row.product.id}`}
                  className="flex items-center gap-2 hover:text-emerald-300"
                >
                  <ProductLogo product={row.product} size={24} />
                  <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                </Link>
                {/* Founder 2026-09-15: the AI-mode pill moved to its own column — inside the
                    name cell it added a second line and broke the constant row height. */}
                {(row.product.type === 'oss' || row.product.shutdown) && (
                  <div className="mt-1 flex items-center gap-1.5">
                    {row.product.type === 'oss' && <OssPill variant="compact" />}
                    <ShutdownBadge shutdown={row.product.shutdown} source={row.product.shutdownSource} />
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <Link href={`/arena/${row.data.category.id}`} className="text-zinc-400 hover:text-emerald-300">
                  {row.data.category.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                {/* Column header already says AGENT-READY — the pill carries just the value. */}
                <AgenticBadge kind="agent-ready" value={row.entry.agentReady} size="sm" showLabel={false} href="/methodology#ai-era" />
              </td>
              <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">
                {row.entry.apiQuality === null ? (
                  '—'
                ) : (
                  <>
                    {row.entry.apiQuality.toFixed(0)}
                    <span className="text-zinc-500">/100</span>
                  </>
                )}
              </td>
              <td className="px-3 py-2">
                <AgentAccessGlyphs data={row.data} productId={row.product.id} />
              </td>
              <td className="hidden px-3 py-2 md:table-cell">
                <AiModeBadge
                  data={row.data}
                  productId={row.product.id}
                  href={`/arena/${row.data.category.id}/product/${row.product.id}#story-agentic-builtin-assistant`}
                />
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <MomentumChip popularity={row.data.popularity[row.product.id]} compact />
              </td>
              <td className="px-3 py-2">
                <AiEraBadge
                  value={row.entry.aiEra}
                  size="sm"
                  href="/methodology#arena-score"
                  components={{
                    agentReady: row.entry.agentReady,
                    apiQuality: row.entry.apiQuality,
                    openness: row.entry.themeScores['openness'] ?? null,
                    agenticApp: row.entry.agenticApp,
                    automation: row.entry.themeScores['automation-depth'] ?? null,
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
