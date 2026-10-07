import Link from 'next/link'
import AgenticBadge from '@/components/AgenticBadge'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import AiEraBadge from '@/components/AiEraBadge'
import AiModeBadge from '@/components/AiModeBadge'
import MomentumChip from '@/components/MomentumChip'
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

// Sibling of AgenticIndexTable, answering the other half of "which products are most
// AI-friendly": this one sorts by AGENTIC_APP ("does the product act agentically itself" / how
// Built-in AI the product's own UX is) instead of AGENT-READY ("can your agent drive it").
// Ties break on the automation-depth theme score, then aiEra/Overall score, both desc/nulls-last.
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
    const xr = x.entry.agenticApp
    const yr = y.entry.agenticApp
    if (xr === null && yr === null) return tiebreak(x, y)
    if (xr === null) return 1
    if (yr === null) return -1
    return yr - xr || tiebreak(x, y)
  })
}

function tiebreak(x: IndexRow, y: IndexRow): number {
  const xa = x.entry.themeScores['automation-depth'] ?? null
  const ya = y.entry.themeScores['automation-depth'] ?? null
  if (xa !== ya) {
    if (xa === null) return 1
    if (ya === null) return -1
    return ya - xa
  }
  const xe = x.entry.aiEra
  const ye = y.entry.aiEra
  if (xe === null && ye === null) return 0
  if (xe === null) return 1
  if (ye === null) return -1
  return ye - xe
}

// `limit` truncates to the top N rows (homepage preview mode); omit it for the full ranking
// (the /rankings/ai-native page). Truncation happens after the sort, never before, so a
// preview is always a strict prefix of the full ranking.
export default function AiNativeIndexTable({ categories, limit }: { categories: CategoryData[]; limit?: number }) {
  const allRows = buildIndex(categories)
  const rows = limit === undefined ? allRows : allRows.slice(0, limit)
  return (
    // `relative`: see AgenticIndexTable — keeps absolute sr-only spans inside the scroll clip.
    <div className={`relative ${TABLE_SHELL}`}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className={TABLE_HEADER_ROW}>
            <th className="sticky left-0 z-10 w-14 bg-zinc-950 px-3 py-2 font-normal">#</th>
            <th className="sticky left-14 z-10 w-[170px] bg-zinc-950 px-3 py-2 font-normal">Product</th>
            <th className="px-3 py-2 font-normal"><span title="The product category (ranking) it competes in — click through for that ranking's full leaderboard">Ranking</span></th>
            <th className="hidden px-3 py-2 font-normal md:table-cell"><span title="Built-in AI assistant mode, from the judged builtin-assistant story — its own column so every row keeps one height">AI mode</span></th>
            <th className="px-3 py-2 font-normal"><span title="Built-in AI (0–100): how much AI the product gives its own users — built-in assistants, agentic features, automation">Built-in AI</span></th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell"><span title="Automation depth (0–100): how much of the product's work can run hands-off, end to end">Automation</span></th>
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
          {rows.map((row, i) => {
            const automation = row.entry.themeScores['automation-depth'] ?? null
            return (
              <tr key={`${row.data.category.id}:${row.product.id}`} className="group transition hover:bg-zinc-800/70">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{ordinal(i + 1)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${row.data.category.id}/product/${row.product.id}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogo product={row.product} size={24} />
                    <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                  </Link>
                  <ShutdownBadge shutdown={row.product.shutdown} source={row.product.shutdownSource} className="mt-1" />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/arena/${row.data.category.id}`} className="text-zinc-400 hover:text-emerald-300">
                    {row.data.category.name}
                  </Link>
                </td>
                {/* Founder 2026-09-15: AI-mode pill in its own column — inside the name cell it
                    broke the constant row height. */}
                <td className="hidden px-3 py-2 md:table-cell">
                  <AiModeBadge
                    data={row.data}
                    productId={row.product.id}
                    href={`/arena/${row.data.category.id}/product/${row.product.id}#story-agentic-builtin-assistant`}
                  />
                </td>
                <td className="px-3 py-2">
                  {/* Column header already says BUILT-IN AI — the pill carries just the value. */}
                  <AgenticBadge kind="agentic-app" value={row.entry.agenticApp} size="sm" showLabel={false} href="/methodology#ai-era" />
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">
                  {automation === null ? (
                    '—'
                  ) : (
                    <>
                      {automation.toFixed(0)}
                      <span className="text-zinc-500">/100</span>
                    </>
                  )}
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
                      automation,
                    }}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
