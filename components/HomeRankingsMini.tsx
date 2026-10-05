import Link from 'next/link'
import AiEraBadge from '@/components/AiEraBadge'
import { IconGlyph } from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import { arenaIcon } from '@/lib/arenaIcons'
import type { MegaTableRow } from '@/lib/megaTableSort'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Homepage "Rankings" section (founder 2026-09-30): a compact, static mini table of the TOP 15
// rows of the /overall rankings — the same default companies view MegaTable opens with (rows
// come pre-sorted server-side by lib/megaTableSort's default order, family sub-products and
// secondary-arena duplicates already excluded by app/home/page.tsx), so rank here IS the rank a
// reader sees on /overall. Server component, zero client JS: no sorting, no filters — the full
// interactive table is one click away via the "See all rankings" link.
export const HOME_RANKINGS_COUNT = 15

export default function HomeRankingsMini({ rows }: { rows: MegaTableRow[] }) {
  return (
    <section aria-labelledby="home-rankings-heading" className="border-t border-zinc-800/60 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 md:px-12">
        <h2 id="home-rankings-heading" className="font-display text-balance text-3xl font-medium tracking-tight sm:text-4xl">
          Open vendor rankings
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          We tested the vendors so you don&rsquo;t have to. The top {HOME_RANKINGS_COUNT} across all arenas:
        </p>
        <div className={`mt-8 ${TABLE_SHELL}`}>
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th scope="col" className="px-3 py-2 font-normal"># / Product</th>
                <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">Arena</th>
                <th scope="col" className="px-3 py-2 font-normal">Overall score</th>
                <th scope="col" className="px-3 py-2 font-normal">Agent-ready</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((row, i) => (
                <tr key={`${row.arenaId}:${row.productId}`} className="transition hover:bg-zinc-800/70">
                  <td className="min-w-[200px] px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 shrink-0 tabular-nums text-zinc-400">{ordinal(i + 1)}</span>
                      <Link
                        href={`/arena/${row.arenaId}/product/${row.productId}`}
                        className="flex min-w-0 items-center gap-2 hover:text-emerald-300"
                      >
                        <ProductLogoView product={{ id: row.productId, name: row.name }} size={28} hasLogo={row.hasLogo} />
                        <span className="min-w-0 truncate font-medium">{row.name}</span>
                      </Link>
                    </div>
                  </td>
                  <td className="hidden max-w-[180px] px-2 py-2 md:table-cell">
                    <Link href={`/arena/${row.arenaId}`} className="block truncate whitespace-nowrap text-xs text-zinc-500 hover:text-emerald-300">
                      {/* The arena's house glyph (lib/arenaIcons.ts) — same icon it wears in
                          the Arenas menu and on its page header. */}
                      {arenaIcon(row.arenaId) && (
                        <span aria-hidden className="mr-1 inline-flex align-[-0.125em]">
                          <IconGlyph icon={arenaIcon(row.arenaId)} />
                        </span>
                      )}
                      {row.arenaName}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <AiEraBadge value={row.initScore} size="sm" interval={row.interval} />
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums text-zinc-300">
                    {row.agentReady === null ? (
                      <span className="text-zinc-500">n/a</span>
                    ) : (
                      <span className="whitespace-nowrap">
                        {row.agentReady.toFixed(0)}
                        <span className="text-zinc-500">/100</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/overall" className="text-emerald-400 underline decoration-emerald-400/40 transition hover:text-emerald-300">
            See all rankings →
          </Link>
        </p>
      </div>
    </section>
  )
}
