import type { Metadata } from 'next'
import Link from 'next/link'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import GeoMark from '@/components/GeoMark'
import OssPill from '@/components/OssPill'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import RankingsNav from '@/components/RankingsNav'
import VerdictBadge from '@/components/VerdictBadge'
import { loadAll, verdictFor, type CategoryData } from '@/lib/data'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import type { Verdict } from '@/lib/schemas'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The four canonical openness stories every arena carries (they're what the openness theme
// score is computed over — see lib/scoring.ts's themeScores).
const OPEN_STORIES = {
  selfHost: 'openness-self-host',
  fullExport: 'openness-full-export',
  openLicense: 'openness-open-license',
  apiParity: 'openness-api-parity',
} as const

interface OpenRow {
  data: CategoryData
  product: CategoryData['products'][number]
  openness: number | null
  aiEra: number | null
  verdicts: Partial<Record<keyof typeof OPEN_STORIES, Verdict['verdict']>>
}

// Every product ranked by its openness theme score (self-hosting, full data export, open
// license, API parity — agent-tested like everything else). Null openness means no
// applicable openness cells (unscored, never zero) and sorts last. Ties break open-source
// first (the flag is a fact, not a score), then Overall score.
function buildOpenRows(categories: CategoryData[]): OpenRow[] {
  const rows: OpenRow[] = []
  for (const data of categories) {
    const storyIds = new Set(data.stories.map((s) => s.id))
    for (const entry of data.rankings.leaderboard) {
      const product = data.products.find((p) => p.id === entry.productId)
      if (!product) continue
      const verdicts: OpenRow['verdicts'] = {}
      for (const [key, storyId] of Object.entries(OPEN_STORIES) as [keyof typeof OPEN_STORIES, string][]) {
        if (storyIds.has(storyId)) verdicts[key] = verdictFor(data, product.id, storyId).verdict
      }
      rows.push({ data, product, openness: entry.themeScores['openness'] ?? null, aiEra: entry.aiEra, verdicts })
    }
  }
  return rows.sort((a, b) => {
    if (a.openness === null && b.openness === null) return tiebreak(a, b)
    if (a.openness === null) return 1
    if (b.openness === null) return -1
    return b.openness - a.openness || tiebreak(a, b)
  })
}

function tiebreak(a: OpenRow, b: OpenRow): number {
  const aOss = a.product.type === 'oss' ? 0 : 1
  const bOss = b.product.type === 'oss' ? 0 : 1
  if (aOss !== bOss) return aOss - bOss
  if (a.aiEra === null && b.aiEra === null) return a.product.name.localeCompare(b.product.name)
  if (a.aiEra === null) return 1
  if (b.aiEra === null) return -1
  return b.aiEra - a.aiEra || a.product.name.localeCompare(b.product.name)
}

export function generateMetadata(): Metadata {
  const rows = buildOpenRows(loadAll())
  const leader = rows[0]
  return {
    title: `Lowest lock-in — self-hosting, data export, open licenses, API parity — Ultrametric`,
    description: `Who lets you self-host, export everything, and inspect the code? ${leader && leader.openness !== null ? `${leader.product.name} leads with ${leader.openness.toFixed(0)}/100 openness.` : ''} Evidence-graded verdicts on self-hosting, full export, open license, and API parity.`,
  }
}

// Static page — no dynamic segments, all data bundled at build time. Global ranking over the
// openness theme score plus the fact-level verdicts behind it.
export const dynamic = 'force-static'

const VERDICT_COLUMNS: { key: keyof typeof OPEN_STORIES; label: string; title: string; className: string }[] = [
  { key: 'selfHost', label: 'Self-host', title: 'Can you run it on your own infrastructure? (openness-self-host verdict)', className: '' },
  { key: 'fullExport', label: 'Export', title: 'Can you get ALL your data out in an open format? (openness-full-export verdict)', className: 'hidden sm:table-cell' },
  { key: 'openLicense', label: 'License', title: 'Is the code available under an open license? (openness-open-license verdict)', className: 'hidden md:table-cell' },
  { key: 'apiParity', label: 'API parity', title: 'Can the API do everything the UI can? (openness-api-parity verdict)', className: 'hidden md:table-cell' },
]

export default function MostOpenRankingPage() {
  const categories = loadAll()
  const rows = buildOpenRows(categories)
  const jsonLd = rankingJsonLd(
    'Lowest lock-in — self-hosting, export, licenses, API parity',
    'Products ranked by agent-tested openness: self-hosting, full data export, open licensing, and API parity.',
    rows.map((row) => ({
      name: row.product.name,
      path: `/arena/${row.data.category.id}/product/${row.product.id}`,
      applicationCategory: row.data.category.name,
      properties: {
        openness: row.openness,
        openSource: row.product.type === 'oss' ? 'yes' : 'no',
        selfHost: row.verdicts.selfHost ?? null,
        fullExport: row.verdicts.fullExport ?? null,
      },
    })),
  )

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "most-open": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="most-open" title="Lowest lock-in — self-hosting, export, licenses, API parity" size={16} className="text-zinc-500" />
          Global ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Lowest lock-in — self-hosting, export, licenses, API parity
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {rows.length} products from every ranking, ranked by the openness theme score — agent-tested
          verdicts on self-hosting, full data export, open licensing, and API parity, the four questions that decide
          whether you own your setup or rent it. Ties break open-source first, then Overall score. Full definitions on{' '}
          <Link href="/methodology" className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            /methodology
          </Link>
          .
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          A &ldquo;none&rdquo; verdict means no evidence was found either way — click any chip for the rationale and
          citations. Products with no applicable openness product user stories are unscored (never zero) and sort last.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Product</th>
              <th className="px-3 py-2 font-normal" title="Openness theme score (0–100): weighted share of full/partial verdicts across the openness stories">
                <span className="inline-flex items-center gap-1.5">Openness<ColumnsHelpLink /></span>
              </th>
              {VERDICT_COLUMNS.map((col) => (
                <th key={col.key} className={`px-3 py-2 font-normal ${col.className}`} title={col.title}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row, i) => (
              <tr key={`${row.data.category.id}:${row.product.id}`} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${row.data.category.id}/product/${row.product.id}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogo product={row.product} size={16} />
                    <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                    <ShutdownBadge shutdown={row.product.shutdown} />
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Link href={`/arena/${row.data.category.id}`} className="text-xs text-zinc-500 hover:text-emerald-300">
                      {row.data.category.name}
                    </Link>
                    {row.product.type === 'oss' && <OssPill variant="compact" />}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">
                  {row.openness === null ? (
                    <span className="font-sans text-xs italic text-zinc-500" title="No applicable openness product user stories — unscored, not zero.">
                      unscored
                    </span>
                  ) : (
                    <>{row.openness.toFixed(0)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
                {VERDICT_COLUMNS.map((col) => {
                  const verdict = row.verdicts[col.key]
                  return (
                    <td key={col.key} className={`px-3 py-2 ${col.className}`}>
                      {verdict ? (
                        <VerdictBadge
                          verdict={verdict}
                          href={`/arena/${row.data.category.id}/product/${row.product.id}#story-${OPEN_STORIES[col.key]}`}
                        />
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="most-open" />
    </div>
  )
}
