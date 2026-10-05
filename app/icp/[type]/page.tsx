import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ProductLogoView from '@/components/ProductLogoView'
import OssPill from '@/components/OssPill'
import ShutdownBadge from '@/components/ShutdownBadge'
import { loadAll } from '@/lib/data'
import ThemeIcon from '@/components/ThemeIcon'
import { humanizeTheme } from '@/lib/icons'
import { hasLogo } from '@/lib/logos'
import { buildIcpRanking, icpTopThemes, loadIcpTypes, MIN_ICP_APPLICABLE } from '@/lib/icp'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Cross-arena ranking through one ICP lens (see lib/icp.ts): every in-scope product across
// every arena, ordered by the lens-weighted score. Fully static — params come from
// data/icp-types.json, unknown ids 404 (dynamicParams = false), same contract as
// app/global/[story]/page.tsx.

export function generateStaticParams() {
  return loadIcpTypes().map((icp) => ({ type: icp.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const { type } = await params
  const icp = loadIcpTypes().find((i) => i.id === type)
  return {
    title: `${icp ? icp.name : type} — best software for this buyer — Ultrametric`,
    description: icp
      ? `Every arena's products re-ranked for a ${icp.name.toLowerCase()}: ${icp.tagline}`
      : undefined,
  }
}



export default async function IcpPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const icp = loadIcpTypes().find((i) => i.id === type)
  if (!icp) notFound()

  const categories = loadAll()
  const rows = buildIcpRanking(categories, icp)
  const themes = icpTopThemes(icp)
  const arenaCount = new Set(rows.map((r) => r.arenaId)).size

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          <Link href="/icp" className="hover:text-emerald-300">Lenses</Link> · ICP lens
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">{icp.name}</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">{icp.tagline}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {rows.length} products across {arenaCount} arenas · same canonical verdicts, re-weighted
          for the personas ({icp.emphasis.personas.join(', ')}) and themes this buyer weighs most
          {icp.emphasis.requireOss ? ' · open-source products only' : ''}
        </p>
      </div>

      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm sm:min-w-[640px]">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th scope="col" className="px-3 py-2 font-normal"># / Product</th>
              <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="The product category (arena) it competes in">Arena</span></th>
              <th scope="col" className="px-3 py-2 font-normal"><span title="The product's theme scores re-weighted for this buyer type — same evidence, this lens's priorities">Lens score</span></th>
              {themes.map((theme) => (
                <th key={theme} scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <ThemeIcon theme={theme} />
                    {humanizeTheme(theme)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row, i) => (
              <tr key={`${row.arenaId}:${row.productId}`} className="transition hover:bg-zinc-900/50">
                <td className="max-w-[240px] px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-9 shrink-0 font-mono tabular-nums text-zinc-400">{ordinal(i + 1)}</span>
                    <Link
                      href={`/arena/${row.arenaId}/product/${row.productId}`}
                      className="flex min-w-0 items-center gap-2 hover:text-emerald-300"
                    >
                      <ProductLogoView
                        product={{ id: row.productId, name: row.productName }}
                        size={24}
                        hasLogo={hasLogo(row.productId)}
                      />
                      <span className="min-w-0 truncate font-medium">{row.productName}</span>
                    </Link>
                    {/* On requireOss lenses every product is open source (the header already
                        says so) — a per-row pill would repeat one fact N times. */}
                    {row.type === 'oss' && !icp.emphasis.requireOss && <OssPill variant="compact" />}
                    <ShutdownBadge shutdown={row.shutdown} />
                  </div>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-400 sm:table-cell">
                  <Link href={`/arena/${row.arenaId}`} className="hover:text-emerald-300">
                    {row.arenaName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex w-fit items-center rounded-full bg-emerald-400 px-2 py-0.5 font-mono text-xs font-bold text-zinc-950 ring-1 ring-emerald-300 tabular-nums"
                    title={`Lens-weighted score over ${row.applicable} applicable emphasized product user stories — canonical verdicts, ${icp.name} weighting.`}
                  >
                    {row.score.toFixed(0)}
                    <span className="font-medium opacity-60">/100</span>
                  </span>
                </td>
                {row.dimensions.map((dim, d) => (
                  <td key={themes[d]} className="hidden px-3 py-2 font-mono tabular-nums text-zinc-300 md:table-cell">
                    {dim === null ? (
                      <span className="font-sans text-xs italic text-zinc-500">n/a</span>
                    ) : (
                      <>{dim.toFixed(0)}<span className="text-zinc-500">/100</span></>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + themes.length} className="px-3 py-6 text-center text-zinc-500">
                  No products are in scope for this lens yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        How this works: a lens multiplies each story&rsquo;s canonical weight by the buyer&rsquo;s
        persona and theme emphasis, then applies the site&rsquo;s standard weighted-percent
        normalization over the emphasized product user stories only. Verdicts are never re-judged, and products
        with no applicable emphasized evidence — or fewer than {MIN_ICP_APPLICABLE} emphasized
        product user stories to judge from — are excluded rather than shown as 0 — see{' '}
        <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
          methodology
        </Link>
        .
      </p>
    </div>
  )
}
