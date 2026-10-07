import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import ProductLogoView from '@/components/ProductLogoView'
import YcBadge from '@/components/YcBadge'
import { loadAll } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { buildYcRows, ycBatchSummaries } from '@/lib/yc'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Index of YC batches with tracked products: per-batch counts plus each batch's most agent-ready
// product, newest batch first. Honest framing up front: this is the YC companies WE track, judged
// on evidence — not a YC-wide census (yet). Coverage grows batch by batch via the ranked queue in
// data/yc-queue.json (pipeline/scripts/yc-coverage-queue.ts).

export function generateMetadata(): Metadata {
  const rows = buildYcRows(loadAll())
  const batches = ycBatchSummaries(rows)
  return {
    title: `YC companies — agentic winners per batch (${rows.length} products, ${batches.length} batches) — Ultrametric`,
    description: `Y Combinator alumni we track, ranked by agent readiness and built-in AI, both agent tested — ${rows.length} products from ${batches.length} batches, ${batches[0] ? `${batches[0].label} back to ${batches[batches.length - 1].label}` : ''}. Not a YC-wide census: coverage grows batch by batch.`,
  }
}

export const dynamic = 'force-static'

export default function YcIndexPage() {
  const rows = buildYcRows(loadAll())
  const batches = ycBatchSummaries(rows)

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="yc" title="YC batches" size={16} className="text-zinc-500" />
          YC batches
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          YC companies — agentic winners per batch
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Every YC alum among the products we track — {rows.length} products across {batches.length} batches —
          verified against YC&rsquo;s public directory by website domain, never by name, and ranked by the same
          agent-tested scores as everything else: agent readiness, built-in AI, Overall score.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-zinc-500">
          The table lists the YC companies <span className="text-zinc-300">we track</span>; coverage grows batch by
          batch from a ranked queue of active YC companies whose products an agent could plausibly control. See{' '}
          <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            methodology
          </Link>
          .
        </p>
      </div>

      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="px-3 py-2 font-normal">Batch</th>
              <th className="px-3 py-2 font-normal" title="How many products from this batch we track">Tracked</th>
              <th className="px-3 py-2 font-normal" title="The batch's most agent-ready product — highest agent-readiness score, agent tested">
                Most agent-ready
              </th>
              <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Agent-readiness score of the batch leader">Agent-ready</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {batches.map((batch) => (
              <tr key={batch.code} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2">
                  <Link href={`/yc/${batch.code.toLowerCase()}`} className="inline-flex items-center gap-2 hover:text-emerald-300">
                    <YcBadge ycBatch={batch.code} clickable={false} />
                    <span className="text-xs text-zinc-400">{batch.label}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">{batch.count}</td>
                <td className="px-3 py-2">
                  {batch.leader && (
                    <Link
                      href={`/arena/${batch.leader.arenaId}/product/${batch.leader.productId}`}
                      className="flex items-center gap-2 hover:text-emerald-300"
                    >
                      <ProductLogoView
                        product={{ id: batch.leader.productId, name: batch.leader.productName }}
                        size={20}
                        hasLogo={hasLogo(batch.leader.productId)}
                      />
                      <span className="min-w-0 truncate font-medium">{batch.leader.productName}</span>
                      <span className="text-xs text-zinc-500">{batch.leader.arenaName}</span>
                    </Link>
                  )}
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-emerald-300 sm:table-cell">
                  {batch.leader?.agentReady === null || !batch.leader ? (
                    <span className="font-sans text-xs italic text-zinc-500">unscored</span>
                  ) : (
                    <>
                      {batch.leader.agentReady.toFixed(0)}
                      <span className="text-zinc-500">/100</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Batch codes are YC&rsquo;s own: W winter, X spring, S summer, F fall. A product tracked in more than one
        ranking counts once, in the ranking where its Overall score is highest.
      </p>
    </div>
  )
}
