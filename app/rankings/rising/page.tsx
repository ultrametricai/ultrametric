import type { Metadata } from 'next'
import Link from 'next/link'
import AiEraBadge from '@/components/AiEraBadge'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import RankingsNav from '@/components/RankingsNav'
import Sparkline from '@/components/Sparkline'
import { loadAll, type CategoryData } from '@/lib/data'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import { loadScoreHistory } from '@/lib/scoreHistory'
import { seriesFor, trendDelta, TREND_WINDOW_DAYS } from '@/lib/scoreTrend'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

interface TrendRow {
  data: CategoryData
  product: CategoryData['products'][number]
  /** Current Overall score from the leaderboard (null = unscored). */
  aiEra: number | null
  /** 30-day Overall score delta (lib/scoreTrend.ts's trendDelta) — non-null by construction here. */
  delta: number
  /** Full plottable Overall score series for the sparkline. */
  values: number[]
}

interface TrendIndex {
  risers: TrendRow[]
  fallers: TrendRow[]
  /** Products with a computable trend that simply didn't move. */
  flat: number
  /** Products with no trend yet (<2 recorded points) — honestly absent, not "flat". */
  noTrend: number
}

// Splits every product into risers/fallers by the 30-day Overall score delta derived from the
// committed score-history files (the same data /changelog is built from). Products without ≥2
// recorded points have no trend yet and are EXCLUDED, never shown as 0 — "no data" and "flat"
// are different claims.
function buildTrendIndex(categories: CategoryData[]): TrendIndex {
  const rows: TrendRow[] = []
  let noTrend = 0
  for (const data of categories) {
    const history = loadScoreHistory(data.category.id)
    const entryById = new Map(data.rankings.leaderboard.map((e) => [e.productId, e]))
    for (const product of data.products) {
      const entries = history.get(product.id)
      const series = entries ? seriesFor(entries, 'aiEra') : []
      const delta = trendDelta(series)
      if (delta === null) {
        noTrend += 1
        continue
      }
      rows.push({
        data,
        product,
        aiEra: entryById.get(product.id)?.aiEra ?? null,
        delta,
        values: series.map((p) => p.value),
      })
    }
  }
  const risers = rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta || a.product.name.localeCompare(b.product.name))
  const fallers = rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta || a.product.name.localeCompare(b.product.name))
  return { risers, fallers, flat: rows.length - risers.length - fallers.length, noTrend }
}

const fmtDelta = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`

export function generateMetadata(): Metadata {
  const { risers, fallers } = buildTrendIndex(loadAll())
  const top = risers[0]
  return {
    title: `Rising & falling — biggest ${TREND_WINDOW_DAYS}-day Overall score moves — Ultrametric`,
    description: `${risers.length} products rose and ${fallers.length} fell over the last ${TREND_WINDOW_DAYS} days of re-derived scores.${top ? ` ${top.product.name} gained the most (${fmtDelta(top.delta)}).` : ''} Derived from the committed score history — falls shown too, honest both ways.`,
  }
}

// Static page — no dynamic segments; the trend window is computed at build time from the
// committed score-history.jsonl files (same source as /changelog).
export const dynamic = 'force-static'

function TrendTable({ rows, direction }: { rows: TrendRow[]; direction: 'up' | 'down' }) {
  return (
    <div className={TABLE_SHELL}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={TABLE_HEADER_ROW}>
            <th className="w-10 px-3 py-2 font-normal">#</th>
            <th className="px-3 py-2 font-normal">Product</th>
            <th className="px-3 py-2 font-normal" title={`Overall score change over the last ${TREND_WINDOW_DAYS} days: latest recorded value minus the value in effect ${TREND_WINDOW_DAYS} days ago`}>
              <span className="inline-flex items-center gap-1.5">{TREND_WINDOW_DAYS}d Δ<ColumnsHelpLink /></span>
            </th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Every recorded Overall score point for this product — the full tracked window, not just 30 days">
              Trend
            </th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Current Overall score (0–100), the blended agent-ready / API quality / openness / agentic app / automation score">
              Overall score now
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
              <td className={`px-3 py-2 font-mono tabular-nums ${direction === 'up' ? 'text-emerald-300' : 'text-red-400'}`}>
                {fmtDelta(row.delta)}
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <Sparkline values={row.values} label={`${row.product.name} Overall score, every recorded point`} />
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                {/* Same emerald pill every leaderboard uses for the Overall score (AiEraBadge). */}
                <AiEraBadge value={row.aiEra} size="sm" href="/methodology#arena-score" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RisingRankingPage() {
  const categories = loadAll()
  const { risers, fallers, flat, noTrend } = buildTrendIndex(categories)
  const jsonLd = rankingJsonLd(
    `Rising — biggest ${TREND_WINDOW_DAYS}-day Overall score gains`,
    `Products ranked by Overall score gain over the last ${TREND_WINDOW_DAYS} days, derived from the committed score history.`,
    risers.map((row) => ({
      name: row.product.name,
      path: `/arena/${row.data.category.id}/product/${row.product.id}`,
      applicationCategory: row.data.category.name,
      properties: { overallScoreDelta30d: row.delta, overallScore: row.aiEra },
    })),
  )

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "rising": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="rising" title="Rising & falling — biggest 30-day Overall score moves" size={16} className="text-zinc-500" />
          Global ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Rising &amp; falling — the biggest {TREND_WINDOW_DAYS}-day score moves
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Every product whose Overall score moved over the last {TREND_WINDOW_DAYS} days, biggest gain first — and the
          falls right below, because a rankings site that only reports rises is marketing. Scores only move when
          evidence and verdicts are re-derived, so every move here traces to a re-judged cell (the{' '}
          <Link href="/changelog" className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            changelog
          </Link>{' '}
          has the event-by-event view of the same history).
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {flat} tracked products held perfectly flat over the window and aren&rsquo;t listed. {noTrend} have fewer
          than two recorded score points — no trend yet, which is not the same claim as &ldquo;flat&rdquo;, so they&rsquo;re
          excluded rather than shown as 0. Sparklines plot every recorded point, not just the window.
        </p>
      </div>

      {/* ids so /rankings/rising#rising and #falling are deep-linkable from other pages. */}
      <section id="rising" aria-label="rising products">
        <h2 className="font-display leading-[1.1] mb-2 text-lg font-semibold text-emerald-300">
          ▲ Rising <span className="ml-1 text-xs font-normal text-zinc-500">{risers.length} products</span>
        </h2>
        <TrendTable rows={risers} direction="up" />
      </section>

      <section id="falling" aria-label="falling products">
        <h2 className="font-display leading-[1.1] mb-2 text-lg font-semibold text-red-400">
          ▼ Falling <span className="ml-1 text-xs font-normal text-zinc-500">{fallers.length} products</span>
        </h2>
        <TrendTable rows={fallers} direction="down" />
      </section>

      <RankingsNav current="rising" />
    </div>
  )
}
