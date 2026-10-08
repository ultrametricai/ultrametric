import Link from 'next/link'
import AiEraBadge from '@/components/AiEraBadge'
import { loadCategory } from '@/lib/data'
import { familyForProduct, loadFamilies } from '@/lib/families'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// "Products" block on a product page — rendered for EVERY product that belongs to a
// family in data/product-families.json (parent or judged sub-product — see lib/families.ts),
// never vendor-special-cased. A mini leaderboard of the company's judged lines (rank, Overall
// score, agent-ready, access). Acquired lines carry a distinct chip so Clerky-vs-Atlas reads
// as history, not a contradiction. Renders nothing for the ~all products with no family entry.
// Not-yet-judged lines stay data (data/product-families.json, and the family page tells their
// story) but draw nothing here — the "Not yet judged (N …)" footer line was removed (founder
// 2026-10-08), so the section now renders only when two or more judged lines exist.
export default function FamilySection({ arenaId, productId }: { arenaId: string; productId: string }) {
  const family = familyForProduct(loadFamilies(), arenaId, productId)
  if (!family) return null

  const judged = family.subProducts.flatMap((sub) => {
    const ref = sub.arenaRef
    if (!ref) return []
    try {
      const data = loadCategory(ref.arenaId)
      const idx = data.rankings.leaderboard.findIndex((e) => e.productId === ref.productId)
      if (idx === -1) return []
      const entry = data.rankings.leaderboard[idx]
      return [{
        key: `${ref.arenaId}/${ref.productId}`,
        name: sub.name,
        blurb: sub.blurb,
        acquired: sub.acquired,
        href: `/arena/${ref.arenaId}/product/${ref.productId}`,
        arenaId: ref.arenaId,
        arenaName: data.category.name,
        arenaHref: `/arena/${ref.arenaId}`,
        rank: idx + 1,
        fieldSize: data.rankings.leaderboard.length,
        overallScore: entry.aiEra,
        agentReady: entry.agentReady,
        isCurrent: ref.arenaId === arenaId && ref.productId === productId,
      }]
    } catch {
      return []
    }
  })
  if (judged.length < 2) return null

  return (
    // Plain section (founder 2026-10-08): the enclosing card chrome is gone — heading plus
    // content, the Verified integrations idiom; the table below keeps its own TABLE_SHELL
    // border like every house table.
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display leading-[1.1] text-lg font-semibold">Products</h2>
        <Link
          href={`/family/${family.id}`}
          className="text-sm text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
        >
          {family.name}, product by product →
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        {family.name} ships more than one product — each judged line competes in its own ranking
        on the same stories as everyone else.
      </p>
      <div className={`mt-3 ${TABLE_SHELL} md:overflow-x-visible`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th scope="col" className="px-2 py-1.5 font-normal"><span title="One of the company's individual products — each is judged separately in its own ranking">Line</span></th>
              <th scope="col" className="px-2 py-1.5 font-normal"><span title="The product category (ranking) this line competes in">Ranking</span></th>
              <th scope="col" className="px-2 py-1.5 font-normal"><span title="Rank in its own ranking">Rank</span></th>
              <th scope="col" className="px-2 py-1.5 font-normal"><span title="Overall score /100 — the blended headline score">Overall score</span></th>
              <th scope="col" className="hidden px-2 py-1.5 font-normal sm:table-cell"><span title="Agent-ready /100 — how easily an outside AI agent can access and operate it">Agent-ready</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {judged.map((s) => (
              <tr key={s.key} className={`transition hover:bg-zinc-800/70 ${s.isCurrent ? 'bg-zinc-900/40' : ''}`}>
                <td className="max-w-[240px] px-2 py-1.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {s.isCurrent ? (
                      <span className="font-medium text-zinc-200">{s.name}</span>
                    ) : (
                      <Link href={s.href} className="font-medium hover:text-emerald-300" title={s.blurb}>
                        {s.name}
                      </Link>
                    )}
                    {s.isCurrent && (
                      <span className="rounded-full border border-zinc-700 px-1.5 py-px text-[9px] uppercase tracking-wide text-zinc-500">this page</span>
                    )}
                    {s.acquired && (
                      <span
                        title={s.acquired}
                        className="rounded-full border border-amber-800 bg-amber-950/60 px-1.5 py-px text-[9px] uppercase tracking-wide text-amber-300"
                      >
                        acquired
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-xs text-zinc-400">
                  <Link href={s.arenaHref} className="hover:text-emerald-300">{s.arenaName}</Link>
                </td>
                <td className="px-2 py-1.5 font-mono text-xs tabular-nums text-zinc-300">
                  {/* Click through to the ranking table the rank comes from (founder feedback). */}
                  <Link
                    href={s.arenaHref}
                    title={`Rank ${s.rank} of ${s.fieldSize} — the full ${s.arenaName} leaderboard`}
                    className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                  >
                    #{s.rank}<span className="text-zinc-500">/{s.fieldSize}</span>
                  </Link>
                </td>
                <td className="px-2 py-1.5">
                  <AiEraBadge value={s.overallScore} size="xs" />
                </td>
                <td className="hidden px-2 py-1.5 font-mono text-xs tabular-nums text-zinc-400 sm:table-cell">
                  {s.agentReady === null ? <span className="italic text-zinc-500">n/a</span> : <>{s.agentReady.toFixed(0)}<span className="text-zinc-500">/100</span></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
