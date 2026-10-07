import Link from 'next/link'
import ClaimsChip from '@/components/ClaimsChip'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import { claimsIntegrity, type ClaimsIntegrity } from '@/lib/claimsIntegrity'
import type { CategoryData } from '@/lib/data'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

interface IndexRow {
  data: CategoryData
  product: CategoryData['products'][number]
  integrity: ClaimsIntegrity
}

// Fourth global index, alongside AgenticIndexTable (agentReady), AiNativeIndexTable
// (agenticApp) and InitIndexTable (Overall score): this one sorts by the claims-integrity score —
// "whose website claims survive independent verification" (see lib/claimsIntegrity.ts for the
// formula). Nulls (no testable claims) sort last per repo convention — "we don't know" is never
// a rank. Ties break on verified count (more independently-verified claims first), then fewer
// contradictions, both desc/asc-nulls-irrelevant since counts are always numbers.
export function buildClaimsIntegrityIndex(categories: CategoryData[]): IndexRow[] {
  const rows: IndexRow[] = []
  for (const data of categories) {
    for (const product of data.products) {
      rows.push({ data, product, integrity: claimsIntegrity(data, product.id) })
    }
  }
  return rows.sort((x, y) => {
    const xs = x.integrity.score
    const ys = y.integrity.score
    if (xs === null && ys === null) return tiebreak(x, y)
    if (xs === null) return 1
    if (ys === null) return -1
    return ys - xs || tiebreak(x, y)
  })
}

function tiebreak(x: IndexRow, y: IndexRow): number {
  return y.integrity.verified - x.integrity.verified || x.integrity.contradicted - y.integrity.contradicted
}

// `limit` truncates to the top N rows (preview mode); omit it for the full ranking (the
// /rankings/claims-integrity page). Truncation happens after the sort, never before, so a
// preview is always a strict prefix of the full ranking.
export default function ClaimsIntegrityIndexTable({ categories, limit }: { categories: CategoryData[]; limit?: number }) {
  const allRows = buildClaimsIntegrityIndex(categories)
  const rows = limit === undefined ? allRows : allRows.slice(0, limit)
  return (
    // `relative`: see AgenticIndexTable — keeps absolute sr-only spans inside the scroll clip.
    <div className={`relative ${TABLE_SHELL}`}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className={TABLE_HEADER_ROW}>
            <th className="sticky left-0 z-10 w-14 bg-zinc-950 px-3 py-2 font-normal">#</th>
            <th className="sticky left-14 z-10 w-[170px] bg-zinc-950 px-3 py-2 font-normal">Product</th>
            {/* Arena yields below md so the integrity score — the ranking's whole point — is
                visible without a sideways scroll on phones. */}
            <th className="hidden px-3 py-2 font-normal md:table-cell"><span title="The product category (ranking) it competes in — click through for that ranking's full leaderboard">Ranking</span></th>
            <th className="px-3 py-2 font-normal"><span title="Claims integrity (0–100): how much of what the vendor publicly claims held up when we tested it">Integrity</span></th>
            <th className="px-3 py-2 font-normal"><span title="Vendor claims our testing confirmed to be true">Verified</span></th>
            <th className="px-3 py-2 font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span title="Vendor claims the evidence contradicted — the marketing said one thing, the product did another">Contradicted</span>
                <ColumnsHelpLink className="sm:hidden" />
              </span>
            </th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell">
              <span className="inline-flex items-center gap-1.5">
                <span title="How many cited sources sit behind these claim checks">Evidence</span>
                <ColumnsHelpLink />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.map((row, i) => (
            <tr key={`${row.data.category.id}:${row.product.id}`} className="group transition hover:bg-zinc-800/70">
              <td className="sticky left-0 z-[5] w-14 bg-zinc-950 px-3 py-2 font-mono tabular-nums text-zinc-400 group-hover:bg-zinc-800/70">
                {ordinal(i + 1)}
              </td>
              <td className="sticky left-14 z-[5] w-[170px] bg-zinc-950 px-3 py-2 group-hover:bg-zinc-800/70">
                <Link
                  href={`/arena/${row.data.category.id}/product/${row.product.id}`}
                  className="flex items-center gap-2 hover:text-emerald-300"
                >
                  <ProductLogo product={row.product} size={24} />
                  <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                </Link>
                <ShutdownBadge shutdown={row.product.shutdown} source={row.product.shutdownSource} className="mt-1" />
              </td>
              <td className="hidden px-3 py-2 md:table-cell">
                <Link href={`/arena/${row.data.category.id}`} className="text-zinc-400 hover:text-emerald-300">
                  {row.data.category.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                {/* The score itself deep-links to the product's claim-by-claim breakdown — same
                    target as the "claims →" cell, so the number is never a dead end. */}
                <ClaimsChip
                  data={row.data}
                  productId={row.product.id}
                  href={`/arena/${row.data.category.id}/product/${row.product.id}#claims`}
                />
              </td>
              <td className="px-3 py-2 font-mono tabular-nums text-emerald-400">{row.integrity.verified}</td>
              <td className={`px-3 py-2 font-mono tabular-nums ${row.integrity.contradicted > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                {row.integrity.contradicted}
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                {row.integrity.total > 0 ? (
                  <Link
                    href={`/arena/${row.data.category.id}/product/${row.product.id}#claims`}
                    className="text-xs text-zinc-500 hover:text-emerald-300"
                  >
                    claims →
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
