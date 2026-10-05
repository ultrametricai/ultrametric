import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import OssPill from '@/components/OssPill'
import ProductLogoView from '@/components/ProductLogoView'
import YcBadge from '@/components/YcBadge'
import { loadAll } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import { batchLabel, buildYcRows, sortYcRows, type YcRow } from '@/lib/yc'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Per-batch ranking of every TRACKED product carrying this verified ycBatch stamp, ordered by
// agent readiness (rankings-page pattern: same table markup + JSON-LD as /rankings/most-open,
// same dynamic-route contract as /icp/[type]: params from data, unknown batches 404,
// dynamicParams = false). URL segment is the lowercase batch code: /yc/w23, /yc/x25.

function rowsForBatch(code: string): YcRow[] {
  return sortYcRows(buildYcRows(loadAll()).filter((r) => r.ycBatch === code))
}

export function generateStaticParams() {
  const batches = new Set(buildYcRows(loadAll()).map((r) => r.ycBatch))
  return Array.from(batches).map((code) => ({ batch: code.toLowerCase() }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ batch: string }>
}): Promise<Metadata> {
  const { batch } = await params
  const code = batch.toUpperCase()
  const rows = rowsForBatch(code)
  const leader = rows[0]
  return {
    title: `YC ${code} (${batchLabel(code)}) — ${rows.length} tracked ${rows.length === 1 ? 'product' : 'products'} ranked by agent readiness — Ultrametric`,
    description: `The Y Combinator ${batchLabel(code)} companies we track, ranked on agent readiness and built-in AI, both agent tested.${leader && leader.agentReady !== null ? ` ${leader.productName} leads at ${leader.agentReady.toFixed(0)}/100 agent-ready.` : ''} Not a batch-wide census — coverage grows batch by batch.`,
  }
}

export default async function YcBatchPage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params
  const code = batch.toUpperCase()
  const rows = rowsForBatch(code)
  if (rows.length === 0) notFound()

  const jsonLd = rankingJsonLd(
    `YC ${code} — tracked products ranked by agent readiness`,
    `Y Combinator ${batchLabel(code)} alumni tracked on Ultrametric, ranked by agent readiness, built-in AI, and Overall score, all agent tested.`,
    rows.map((row) => ({
      name: row.productName,
      path: `/arena/${row.arenaId}/product/${row.productId}`,
      applicationCategory: row.arenaName,
      properties: {
        ycBatch: row.ycBatch,
        agentReady: row.agentReady,
        builtInAi: row.agenticApp,
        overallScore: row.aiEra,
      },
    })),
  )

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div>
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <Link href="/yc" className="hover:text-emerald-300">YC batches</Link> · batch ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight">
          YC {code} — {batchLabel(code)}
          <YcBadge ycBatch={code} clickable={false} />
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The {rows.length} {batchLabel(code)} {rows.length === 1 ? 'company' : 'companies'} we track, ranked by
          agent-tested agent readiness — can an agent actually drive this product? — then built-in AI and Overall score.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-zinc-500">
          The table lists the YC {code} companies <span className="text-zinc-300">we track</span>; coverage grows
          batch by batch. Scores come from each product&rsquo;s arena verdicts —
          see{' '}
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
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Product</th>
              <th className="px-3 py-2 font-normal" title="Agent-readiness score (0–100): can an agent drive it? MCP, API, docs an agent can consume — agent tested">
                <span className="inline-flex items-center gap-1.5">Agent-ready<ColumnsHelpLink /></span>
              </th>
              <th className="hidden px-3 py-2 font-normal sm:table-cell" title="Built-in AI score (0–100): does the product itself act agentically for its users?">
                Built-in AI
              </th>
              <th className="hidden px-3 py-2 font-normal md:table-cell" title="Overall score (0–100): the blended AI-era score — agent readiness, API quality, openness, built-in AI, automation depth">
                Overall score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row, i) => (
              <tr key={row.productId} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{ordinal(i + 1)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${row.arenaId}/product/${row.productId}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogoView
                      product={{ id: row.productId, name: row.productName }}
                      size={20}
                      hasLogo={hasLogo(row.productId)}
                    />
                    <span className="min-w-0 truncate font-medium">{row.productName}</span>
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Link href={`/arena/${row.arenaId}`} className="text-xs text-zinc-500 hover:text-emerald-300">
                      {row.arenaName}
                    </Link>
                    {row.type === 'oss' && <OssPill variant="compact" />}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">
                  {row.agentReady === null ? (
                    <span className="font-sans text-xs italic text-zinc-500" title="No applicable agent-access product user stories — unscored, not zero.">
                      unscored
                    </span>
                  ) : (
                    <>{row.agentReady.toFixed(0)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 sm:table-cell">
                  {row.agenticApp === null ? (
                    <span className="font-sans text-xs italic text-zinc-500">unscored</span>
                  ) : (
                    <>{row.agenticApp.toFixed(0)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 md:table-cell">
                  {row.aiEra === null ? (
                    <span className="font-sans text-xs italic text-zinc-500">unscored</span>
                  ) : (
                    <>{row.aiEra.toFixed(0)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        A product tracked in more than one arena appears once, in the arena where its Overall score is highest. Unscored
        means no applicable product user stories — never zero. Batch stamps verified against YC&rsquo;s public directory by website
        domain, never by name.
      </p>
    </div>
  )
}
