import type { Metadata } from 'next'
import Link from 'next/link'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import RankingsNav from '@/components/RankingsNav'
import { loadCategory, type CategoryData } from '@/lib/data'
import { rankingJsonLd } from '@/lib/rankingJsonLd'
import { ordinal } from '@/lib/ordinal'
import {
  VENDOR_GEO_COUNTRY_META,
  VENDOR_GEO_STATUS_META,
  vendorGeoFor,
  type VendorGeoEntry,
  type VendorGeoStatus,
} from '@/lib/vendorGeo'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// A focused VIEW of the judged startup-law-firms arena (founder ask 2026-10-02: "we need a
// ranking table for law firms"). Everything on this page is read from committed data at build
// time — the leaderboard order, every score, the country marks — nothing is recomputed or
// re-ranked here. Rank N is literally position N of the arena's committed leaderboard
// (lib/scoring.ts sorts it by Overall score, coverage-score tiebreak, before it is persisted).
const ARENA_ID = 'startup-law-firms'

// The theme columns that carry the signal for law firms: every firm has a committed, non-null
// score on each of these four, and the spread is real (the arena's agentic/openness/privacy-
// posture axes, by contrast, are near-zero or all-zero across the field — honest, but not a
// column to lead with; agent-readiness stays visible further right).
const FIRM_DIMENSIONS = [
  {
    key: 'venture-financing',
    label: 'Venture financing',
    title: 'VENTURE FINANCING (0–100): priced rounds, SAFEs, term-sheet and cap-table counsel — agent-tested theme score.',
    hide: '',
  },
  {
    key: 'formation-incorporation',
    label: 'Formation',
    title: 'FORMATION & INCORPORATION (0–100): entity formation, standard startup paperwork, post-incorporation hygiene — agent-tested theme score.',
    hide: 'hidden sm:table-cell',
  },
  {
    key: 'ip-protection',
    label: 'IP protection',
    title: 'IP PROTECTION (0–100): patents, trademarks, IP assignment and litigation muscle — agent-tested theme score.',
    hide: 'hidden sm:table-cell',
  },
  {
    key: 'startup-program',
    label: 'Startup program',
    title: 'STARTUP PROGRAM (0–100): dedicated emerging-companies programs, deferred-fee packages, founder resources — agent-tested theme score.',
    hide: 'hidden md:table-cell',
  },
] as const

interface FirmRow {
  /** 1-based position in the committed leaderboard — THE rank, never recomputed. */
  rank: number
  product: CategoryData['products'][number]
  entry: CategoryData['rankings']['leaderboard'][number]
  /** Committed vendor-geo rows for this firm, canonical US→UK→IN→DE→FR order. */
  geo: VendorGeoEntry[]
}

// Committed leaderboard order, verbatim — the whole point of the page.
function buildFirmRows(data: CategoryData): FirmRow[] {
  return data.rankings.leaderboard.map((entry, i) => {
    const product = data.products.find((p) => p.id === entry.productId)
    if (!product) throw new Error(`leaderboard references unknown product ${entry.productId}`)
    return { rank: i + 1, product, entry, geo: vendorGeoFor(product.id) }
  })
}

// The IP lens: the same judged firms reordered by the committed ip-protection theme score —
// the axis the IP-focused founder lens (data/icp-types.json) weighs most. Committed numbers
// only, ties broken by committed leaderboard position, so the ordering is still a pure view.
function ipOrdering(rows: FirmRow[]): FirmRow[] {
  const ip = (r: FirmRow) => r.entry.themeScores['ip-protection'] ?? null
  return [...rows].sort((a, b) => {
    const x = ip(a)
    const y = ip(b)
    if (x === null && y === null) return a.rank - b.rank
    if (x === null) return 1
    if (y === null) return -1
    return y - x || a.rank - b.rank
  })
}

const score = (n: number | null) =>
  n === null ? null : n.toFixed(0)

const GEO_STATUS_COLOR: Record<VendorGeoStatus, string> = {
  available: 'text-emerald-300',
  partial: 'text-amber-300',
  unavailable: 'text-zinc-600',
}

// Compact per-country availability strip: one mark per committed vendor-geo row (the firm's
// OWN locations/practice pages, crawl-verified — lib/vendorGeo.ts), honest negatives included.
// No rows = no marks, never a guess.
function GeoStrip({ geo }: { geo: VendorGeoEntry[] }) {
  if (geo.length === 0) return <span className="text-zinc-600">—</span>
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-xs">
      {geo.map((row) => {
        const status = VENDOR_GEO_STATUS_META[row.status]
        return (
          <span
            key={row.country}
            title={`${VENDOR_GEO_COUNTRY_META[row.country].label}: ${status.label} — ${row.note}`}
            className="text-zinc-400"
          >
            {row.country}
            <span aria-hidden className={`ml-0.5 ${GEO_STATUS_COLOR[row.status]}`}>
              {status.glyph}
            </span>
            <span className="sr-only"> {status.label}</span>
          </span>
        )
      })}
    </span>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Startup law firms — ranked — Ultrametric',
    description:
      'The judged startup-law-firms leaderboard: Overall score, venture financing, formation, IP protection, startup program, and agent-readiness per firm, with per-country availability marks for the US, UK, India, Germany, and France from each firm’s own pages, plus the IP-lens ordering.',
  }
}

// Static page — no dynamic segments, all data bundled at build time. A view of one arena's
// committed leaderboard, not a new ranking.
export const dynamic = 'force-static'

export default function LawFirmsRankingPage() {
  const data = loadCategory(ARENA_ID)
  const rows = buildFirmRows(data)
  const ipRows = ipOrdering(rows)
  const jsonLd = rankingJsonLd(
    'Startup law firms — ranked',
    'The judged startup-law-firms leaderboard: Overall score, practice-dimension theme scores, agent-readiness, and per-country availability from each firm’s own pages.',
    rows.map((row) => ({
      name: row.product.name,
      path: `/arena/${ARENA_ID}/product/${row.product.id}`,
      applicationCategory: data.category.name,
      properties: {
        overall: row.entry.aiEra,
        agentReady: row.entry.agentReady,
        ventureFinancing: row.entry.themeScores['venture-financing'] ?? null,
        ipProtection: row.entry.themeScores['ip-protection'] ?? null,
      },
    })),
  )

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div>
        {/* seed "law-firms": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="law-firms" title="Startup law firms — ranked" size={16} className="text-zinc-500" />
          Ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Startup law firms — ranked
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The{' '}
          <Link href={`/arena/${ARENA_ID}`} className="text-zinc-300 underline decoration-zinc-700 hover:text-emerald-300">
            {data.category.name}
          </Link>{' '}
          ranking&apos;s judged leaderboard, in its committed order: Overall score first, coverage score as the
          tiebreak. The practice dimensions carry the signal for firms — venture financing, formation, IP
          protection, startup programs. Agent-readiness is near-zero across the field; it stays on the table
          because that is what the evidence shows, not because it separates firms.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Where each firm works: per-country marks from the firm&apos;s own locations and practice pages
          (<span className="text-emerald-300">✓</span> available · <span className="text-amber-300">◐</span> partial ·{' '}
          <span className="text-zinc-400">✕</span> not available), honest negatives included — a US firm with no
          English-law practice really is marked unavailable in the UK.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Firm</th>
              <th
                className="px-3 py-2 font-normal"
                title="Overall score (0–100): the committed blend the leaderboard is ordered by — formula on /methodology"
              >
                <span className="inline-flex items-center gap-1.5">Overall<ColumnsHelpLink /></span>
              </th>
              {FIRM_DIMENSIONS.map((dim) => (
                <th key={dim.key} className={`px-3 py-2 font-normal ${dim.hide}`} title={dim.title}>
                  {dim.label}
                </th>
              ))}
              <th
                className="hidden px-3 py-2 font-normal lg:table-cell"
                title="AGENT-READY (0–100): can an agent reach the firm at all — API/CLI/MCP/webhooks/docs"
              >
                Agent-ready
              </th>
              <th
                className="px-3 py-2 font-normal"
                title="Per-country availability from the firm's own pages (jurisdictions/vendor-geo.json): ✓ available, ◐ partial, ✕ not available."
              >
                Where
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row) => (
              <tr key={row.product.id} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{ordinal(row.rank)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${ARENA_ID}/product/${row.product.id}`}
                    className="flex items-center gap-2 hover:text-emerald-300"
                  >
                    <ProductLogo product={row.product} size={16} />
                    <span className="min-w-0 truncate font-medium">{row.product.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-emerald-300">
                  {row.entry.aiEra === null ? (
                    <span className="font-sans text-xs text-zinc-500">n/a</span>
                  ) : (
                    <>{score(row.entry.aiEra)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
                {FIRM_DIMENSIONS.map((dim) => {
                  const value = row.entry.themeScores[dim.key] ?? null
                  return (
                    <td key={dim.key} className={`px-3 py-2 font-mono tabular-nums text-zinc-300 ${dim.hide}`}>
                      {value === null ? (
                        <span className="font-sans text-xs text-zinc-500">n/a</span>
                      ) : (
                        <>{score(value)}<span className="text-zinc-500">/100</span></>
                      )}
                    </td>
                  )
                })}
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 lg:table-cell">
                  {row.entry.agentReady === null ? (
                    <span className="font-sans text-xs text-zinc-500">n/a</span>
                  ) : (
                    <>{score(row.entry.agentReady)}<span className="text-zinc-500">/100</span></>
                  )}
                </td>
                <td className="px-3 py-2">
                  <GeoStrip geo={row.geo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-label="IP lens ordering" className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">The IP lens</h2>
        <p className="mt-1 max-w-2xl text-xs text-zinc-500">
          The same firms reordered by their committed IP PROTECTION theme score — the axis the{' '}
          <Link href="/icp/ip-focused" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            IP-focused founder lens
          </Link>{' '}
          weighs most. Ties keep the committed leaderboard order. Nothing is re-judged — this is the committed
          number from the table above, re-sorted.
        </p>
        <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {ipRows.map((row, i) => {
            const ip = row.entry.themeScores['ip-protection'] ?? null
            return (
              <li key={row.product.id} className="flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-zinc-500">{ordinal(i + 1)}</span>
                <Link
                  href={`/arena/${ARENA_ID}/product/${row.product.id}`}
                  className="text-zinc-300 transition hover:text-emerald-300"
                >
                  {row.product.name}
                </Link>
                <span className="font-mono text-xs tabular-nums text-zinc-500">
                  {ip === null ? 'n/a' : score(ip)}
                </span>
              </li>
            )
          })}
        </ol>
      </section>
      <RankingsNav current="law-firms" />
    </div>
  )
}
