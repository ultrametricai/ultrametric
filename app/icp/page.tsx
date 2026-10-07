import type { Metadata } from 'next'
import Link from 'next/link'
import { loadAll } from '@/lib/data'
import { buildIcpRanking, icpTopThemes, loadIcpTypes } from '@/lib/icp'

export const metadata: Metadata = {
  title: 'ICP lenses — one cross-market ranking per buyer type — Ultrametric',
  description:
    'Ten cross-market buyer-type lenses — solo technical founder, Built-in AI startup, privacy-first org, open-source purist and more — each re-weighting the same evidence-judged verdicts into a ranking for that buyer.',
}

// Static index of every ICP lens (see lib/icp.ts + data/icp-types.json). Each card links to the
// lens's cross-arena ranking at /icp/[type]. The same canonical verdicts back every lens — only
// the emphasis (personas + theme/group multipliers) differs, which is the whole point: the site
// says who each ranking is for instead of pretending one ordering fits every buyer.
export const dynamic = 'force-static'

export default function IcpIndexPage() {
  const categories = loadAll()
  const icps = loadIcpTypes()

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Lenses</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          ICP lenses — one ranking per buyer type
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The Overall score is one deliberately-contestable blend — but an open-source purist and an
          Built-in AI startup don&rsquo;t weigh evidence the same way. Each lens below re-weights the
          same evidence-judged verdicts (never re-judging anything) by the personas and themes that
          buyer type actually cares about, across every ranking at once.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {icps.map((icp) => {
          const rows = buildIcpRanking(categories, icp)
          const top = rows[0]
          return (
            <Link
              key={icp.id}
              href={`/icp/${icp.id}`}
              className="group min-w-0 rounded-2xl border border-zinc-800 p-4 transition hover:border-emerald-400/40"
            >
              <h2 className="font-display text-lg font-semibold tracking-tight group-hover:text-emerald-300">
                {icp.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">{icp.tagline}</p>
              <p className="mt-3 text-xs text-zinc-500">
                {rows.length} products in scope
                {icp.emphasis.requireOss ? ' · open source only' : ''}
              </p>
              {top && (
                <p className="mt-1 text-xs text-zinc-500">
                  current #1: <span className="text-zinc-300">{top.productName}</span>{' '}
                  <span className="tabular-nums text-emerald-400">{top.score.toFixed(0)}</span>
                  <span>/100</span>
                </p>
              )}
              <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-zinc-500">
                weighs: {icpTopThemes(icp).join(' · ')}
              </p>
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-zinc-500">
        Lens scores reuse the canonical per-cell verdicts and the exact ranking normalization — a
        lens multiplies story weights, it never invents or overrides a verdict. Products with no
        applicable emphasized evidence are excluded from a lens (out of scope), not scored 0.
      </p>
    </div>
  )
}
