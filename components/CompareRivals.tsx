import Link from 'next/link'
import AgentAccessGlyphs from '@/components/AgentAccessGlyphs'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import ShutdownBadge from '@/components/ShutdownBadge'
import { compareRivalsFor, vsSlugFor, type CompareRivalRow } from '@/lib/compareRivals'
import type { CategoryData } from '@/lib/data-helpers'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Server component: "Alternatives comparison" (renamed from "How it compares", founder
// 2026-10-02; the explainer sentence under the heading and the table's VS column went with it) —
// the founder ask (2026-09-22): a product page shows a comparison table of its similar products.
// "Similar" here is leaderboard adjacency in the product's OWN arena (lib/compareRivals.ts:
// 2 above + 2 below, edge-filled), a deliberately FOCUSED slice of the arena leaderboard — same
// judged numbers, same n/a rules, none of ArenaTable's sorting/filtering/preset machinery.
// Shutdown rivals keep their row with the Closing tag (list semantics, lib/shutdown.ts). The
// judged battle-page head-to-heads live in the prominent "Compare head-to-head" strip below the table
// (founder 2026-10-02: the battle affordance gets real visual weight — full chip buttons, house
// idiom, each carrying its judged record where one exists). Renders nothing for arenas with
// fewer than 2 products.

// Per-dimension receipt anchors on the product's /score page — the same anchors the header's
// AgenticBadge trio links to (app/arena/[category]/product/[id]/page.tsx).
const DIMS: Array<{
  key: 'agentReady' | 'agenticApp' | 'apiQuality'
  label: string
  anchor: string
  headerTitle: string
  hideBelow?: string
}> = [
  {
    key: 'agentReady',
    label: 'Agent-ready',
    anchor: 'agent-ready',
    headerTitle:
      'Outside-in: can YOUR agent drive this product — click a score for its judged receipt',
  },
  {
    key: 'agenticApp',
    label: 'Built-in AI',
    anchor: 'built-in-ai',
    headerTitle:
      'Inside-out: how agentic the product itself is for its users — click a score for its judged receipt',
    hideBelow: 'sm',
  },
  {
    key: 'apiQuality',
    label: 'API',
    anchor: 'api-quality',
    headerTitle:
      'API quality /100 — machine-readable spec, docs, sandbox, versioning; click a score for its judged receipt',
    hideBelow: 'md',
  },
]

// One clause (founder tooltip sweep 2026-10-02), same text as ArenaTable's naCell.
const NA_CELL_TITLE =
  'Not meaningful for this product class — no agent-drivable surface of its own; the Overall score still applies.'

function ScoreCell({
  row,
  arenaId,
  dim,
  na,
}: {
  row: CompareRivalRow
  arenaId: string
  dim: (typeof DIMS)[number]
  na: boolean
}) {
  if (na) {
    return (
      <span className="text-zinc-500" title={NA_CELL_TITLE}>
        n/a
      </span>
    )
  }
  const value = row[dim.key]
  if (value === null) return <span className="text-zinc-500">n/a</span>
  return (
    <Link
      href={`/arena/${arenaId}/product/${row.productId}/score#${dim.anchor}`}
      title={`${row.name}'s ${dim.label} score — click for the judged receipt`}
      className="hover:text-emerald-300"
    >
      {value.toFixed(0)}
      <span className="text-zinc-500">/100</span>
    </Link>
  )
}

export default function CompareRivals({ data, productId }: { data: CategoryData; productId: string }) {
  const rows = compareRivalsFor(data, productId)
  if (rows.length < 2) return null
  const selfName = rows[0].name
  const naDims = new Set(data.category.naDimensions ?? [])
  const hide: Record<string, string> = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell' }

  return (
    <div id="compare-rivals" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] mb-3 flex items-center gap-2 text-lg font-semibold">
        <GeoMark
          seed="compare-rivals"
          title="Alternatives comparison — the nearest rivals in this product's ranking, same judged scores"
          size={18}
          className="text-zinc-500"
        />
        Alternatives comparison
      </h2>
      {/* Founder 2026-10-02: no explainer sentence under the heading — the GeoMark title and the
          column tooltips carry the framing. */}
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th scope="col" className="px-2 py-1.5 font-normal">
                <span title="This product (highlighted) plus its nearest rivals — # = rank in the full ranking">Product</span>
              </th>
              <th scope="col" className="px-2 py-1.5 font-normal">
                <span title="Overall score /100 — blended headline score; click a score for its full receipt">Overall score</span>
              </th>
              {DIMS.map((dim) => (
                <th key={dim.key} scope="col" className={`px-2 py-1.5 font-normal ${dim.hideBelow ? hide[dim.hideBelow] : ''}`}>
                  <span title={dim.headerTitle}>{dim.label}</span>
                </th>
              ))}
              <th scope="col" className="hidden px-2 py-1.5 font-normal sm:table-cell">
                <span title="Agent access surfaces — MCP server / CLI / API, from judged evidence: ✓ full, ~ partial, ! disputed, — none found. Each glyph links to its story's evidence.">Access</span>
              </th>
              {/* The VS column is gone (founder 2026-10-02) — the judged head-to-heads live in
                  the Compare head-to-head strip below, records included. */}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((row) => (
              <tr
                key={row.productId}
                className={row.isSelf ? 'bg-emerald-500/5' : 'transition hover:bg-zinc-800/70'}
              >
                <td className="min-w-[200px] max-w-[300px] px-2 py-2">
                  <div className="flex items-center gap-2">
                    {/* No tooltip on the rank cell (founder sweep 2026-10-02) — it restated the
                        visible #N; the Product column header explains what # means. */}
                    <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-zinc-500">
                      #{row.rank}
                    </span>
                    {row.isSelf ? (
                      <span
                        className="flex min-w-0 items-center gap-2 font-medium text-emerald-300"
                        title={`${row.name} — the product this page is about`}
                      >
                        <ProductLogo product={data.products.find((p) => p.id === row.productId)!} size={24} />
                        <span className="truncate">{row.name}</span>
                      </span>
                    ) : (
                      <Link
                        href={`/arena/${data.category.id}/product/${row.productId}`}
                        title={`${row.name} — see its full product page`}
                        className="flex min-w-0 items-center gap-2 font-medium hover:text-emerald-300"
                      >
                        <ProductLogo product={data.products.find((p) => p.id === row.productId)!} size={24} />
                        <span className="truncate">{row.name}</span>
                      </Link>
                    )}
                    <ShutdownBadge shutdown={row.shutdown} source={row.shutdownSource} />
                  </div>
                </td>
                <td className="px-2 py-2 font-mono tabular-nums text-zinc-300">
                  {row.aiEra === null ? (
                    <span className="text-zinc-500">n/a</span>
                  ) : (
                    <Link
                      href={`/arena/${data.category.id}/product/${row.productId}/score`}
                      title={`${row.name}'s Overall score — click for the full receipt`}
                      className="hover:text-emerald-300"
                    >
                      {row.aiEra.toFixed(0)}
                      <span className="text-zinc-500">/100</span>
                    </Link>
                  )}
                </td>
                {DIMS.map((dim) => (
                  <td
                    key={dim.key}
                    className={`px-2 py-2 font-mono tabular-nums text-zinc-300 ${dim.hideBelow ? hide[dim.hideBelow] : ''}`}
                  >
                    <ScoreCell row={row} arenaId={data.category.id} dim={dim} na={naDims.has(dim.key)} />
                  </td>
                ))}
                <td className="hidden px-2 py-2 sm:table-cell">
                  <AgentAccessGlyphs data={data} productId={row.productId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Founder 2026-09-23: the head-to-head links live under this table (moved from the top
          actions rail) — every same-arena rival's /vs page plus the alternatives directory.
          Founder 2026-10-02: this is now THE battle affordance (the table's VS column is gone)
          and gets real visual weight — a proper sub-heading and full chip buttons in the house
          idiom (rounded-full bordered pills, emerald on hover), each carrying the judged
          head-to-head record where the rival rows above computed one. */}
      <div className="mt-4">
        <h3 className="font-display text-base font-semibold">Compare head-to-head</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.products
            .filter((p) => p.id !== productId)
            .map((rival) => {
              const rivalRow = rows.find((r) => r.productId === rival.id && !r.isSelf)
              return (
                <Link
                  key={rival.id}
                  href={`/arena/${data.category.id}/battle/${vsSlugFor(data, productId, rival.id)}`}
                  title={
                    rivalRow?.record
                      ? `${selfName} ${rivalRow.record.wins} – ${rivalRow.record.losses} ${rival.name}${rivalRow.record.draws > 0 ? ` (${rivalRow.record.draws} drawn)` : ''} — judged story by story; click for every round`
                      : `${selfName} vs ${rival.name} — the judged head-to-head, story by story`
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
                >
                  <ProductLogo product={rival} size={20} />
                  vs {rival.name}
                  {rivalRow?.record && (
                    <span className="font-mono text-xs tabular-nums text-zinc-500">
                      {rivalRow.record.wins}–{rivalRow.record.losses}
                    </span>
                  )}
                </Link>
              )
            })}
        </div>
        {/* Founder 2026-10-05: the "Alternatives to <X> →" link is gone from product pages —
            "full arena →" below is the one outbound link here. The /alternatives/[product]
            route stays alive for old links, same posture as other removals. */}
      </div>
      <div className="mt-2 text-xs">
        <Link
          href={`/arena/${data.category.id}`}
          title={`The full ${data.category.name} ranking — every product, sortable`}
          className="text-zinc-400 hover:text-emerald-300"
        >
          full ranking →
        </Link>
      </div>
    </div>
  )
}
