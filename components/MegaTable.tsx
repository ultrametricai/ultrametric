'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useContext, useEffect, useMemo, useState } from 'react'
import { HomeModeContext } from '@/components/HomeModes'
import AiEraBadge from '@/components/AiEraBadge'
import HotChip from '@/components/HotChip'
import MomentumChip from '@/components/MomentumChip'
import TableControls from '@/components/TableControls'
import OssPill from '@/components/OssPill'
import PopularTag, { isNotablyPopular } from '@/components/PopularTag'
import ProductLogoView from '@/components/ProductLogoView'
import ShutdownBadge from '@/components/ShutdownBadge'
import TrendArrow from '@/components/TrendArrow'
import WatchButton from '@/components/WatchButton'
import YcBadge from '@/components/YcBadge'
import { belowCompactStarsFloor } from '@/lib/popularity'
import { useSession } from '@/lib/session'
import { readParams, setParams } from '@/lib/urlState'
import { arenaIcon } from '@/lib/arenaIcons'
import { IconGlyph } from '@/components/IconChip'
import type { MegaTableArenaOption } from '@/lib/megaTable'
import { ordinal } from '@/lib/ordinal'
import {
  DEFAULT_COLUMN,
  DEFAULT_DIRECTION,
  defaultDirectionFor,
  filterMegaRowsByArena,
  filterMegaRowsByQuery,
  megaRowKey,
  parseMegaColumn,
  rankMegaRows,
  sortMegaRows,
  type MegaTableColumn,
  type MegaTableRow,
  type SortDirection,
} from '@/lib/megaTableSort'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The homepage's single global table over every product in every arena — replaces the old
// three-preview-tables-plus-arena-cards-first layout (see app/page.tsx: hero → this → compact
// arena cards → leading battles). Every row here is one product's leaderboard entry from its
// own arena's rankings.json; rows are pre-flattened + stripped server-side (lib/megaTable.ts) so
// this client component never carries evidence/verdicts/stories over the wire.
//
// AGENT-READY is the default sort (desc) — see lib/megaTableSort.ts's DEFAULT_COLUMN doc —
// and `rank` is a fixed identity derived from that same default order, not a re-derived row
// index, so it doesn't reshuffle when a reader sorts by another column.
//
// The three /rankings/* pages (highest Overall score, most agentic, best built-in AI) remain the
// "preset view" links above the table — this table is the single-honest-view superset of what
// those three (plus the old per-arena ArenaTable trio) used to render separately.

function SortableTh({
  children,
  col,
  current,
  direction,
  onSort,
  sortable = true,
  className = '',
}: {
  children: ReactNode
  col: MegaTableColumn
  current: MegaTableColumn
  direction: SortDirection
  onSort: (col: MegaTableColumn) => void
  sortable?: boolean
  className?: string
}) {
  if (!sortable) {
    return (
      <th scope="col" className={`sticky top-0 z-20 bg-zinc-950 px-3 py-2 font-normal ${className}`}>
        {children}
      </th>
    )
  }
  const isCurrent = col === current
  const ariaSort: 'ascending' | 'descending' | 'none' = !isCurrent ? 'none' : direction === 'asc' ? 'ascending' : 'descending'
  return (
    <th scope="col" aria-sort={ariaSort} className={`sticky top-0 z-20 bg-zinc-950 px-3 py-2 font-normal ${className}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 whitespace-nowrap hover:text-emerald-300 ${isCurrent ? 'text-emerald-300' : ''}`}
      >
        {children}
        {isCurrent && <span aria-hidden>{direction === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

// The "rank by" presets rendered as a segmented control above the table — one-click views of
// the same rows (they just set the sort column), replacing the old links out to /rankings/*.
const RANK_PRESETS: Array<{ col: MegaTableColumn; label: string }> = [
  { col: 'agentReady', label: 'Most agent-ready' },
  { col: 'initScore', label: 'Highest Overall score' },
  { col: 'agenticApp', label: 'Best built-in AI' },
  { col: 'popularity', label: 'Most popular' },
]

export default function MegaTable({ rows, arenas }: { rows: MegaTableRow[]; arenas: MegaTableArenaOption[] }) {
  const [column, setColumn] = useState<MegaTableColumn>(DEFAULT_COLUMN)
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_DIRECTION)
  const [query, setQuery] = useState('')
  const [arenaId, setArenaId] = useState('all')
  const [showAll, setShowAll] = useState(false)
  // Deep-table quick filters (founder 2026-09-23: "more powerful aspects of controlling the
  // table rankings") — each is a URL-shareable toggle; off is the default and elided.
  const [ycOnly, setYcOnly] = useState(false)
  // MCP toggle removed (founder 2026-09-28: "we don't need MCP as a toggle on the main page")
  // — the Access column still shows each product's MCP glyph; old ?mcp=1 links are ignored.
  // Founder 2026-09-16: companies by default — judged family sub-products (stripe-issuing,
  // adyen-for-platforms, …) hide so a company appears once. Founder 2026-09-23: the old
  // include-sub-products checkbox is now the homepage's Products tab — the mode arrives via
  // HomeModeContext (companies/HomeModes.tsx owns the ?view param and legacy ?all=1 links).
  const includeSubProducts = useContext(HomeModeContext) === 'products'
  // Watch column only exists for logged-in readers (see lib/session.ts) — static HTML and the
  // anonymous view render the same 9-column table as before login existed.
  const watchlistOn = useSession().state === 'authenticated'

  // Shareable-view URL state (founder 2026-09-21, lib/urlState.ts): read once on mount — the
  // static HTML always renders the default view, then ?rank/?dir/?arena/?all/?q reproduce the
  // sender's view after hydration. Invalid values fall back to the defaults silently, and a
  // param never appears for a default (writes below elide them the same way).
  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     (external system). The static HTML must render the default view, so these cannot be useState
     initializers (hydration mismatch); the effect runs once and renders at most one extra pass. */
  useEffect(() => {
    const p = readParams()
    const col = parseMegaColumn(p.get('rank')) ?? DEFAULT_COLUMN
    const dir = p.get('dir')
    setColumn(col)
    setDirection(dir === 'asc' || dir === 'desc' ? dir : defaultDirectionFor(col))
    const arena = p.get('arena')
    if (arena !== null && arenas.some((a) => a.id === arena)) setArenaId(arena)
    if (p.get('yc') === '1') setYcOnly(true)
    const q = p.get('q')
    if (q !== null && q !== '') setQuery(q)
    // Mount-only by design: the URL is the INITIAL view; after that the reader's clicks own it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const companyRows = useMemo(
    () => (includeSubProducts ? rows : rows.filter((r) => !r.isFamilySubProduct && !r.isSecondaryArena)),
    [rows, includeSubProducts],
  )
  const byArena = useMemo(() => {
    let rows_ = filterMegaRowsByArena(companyRows, arenaId)
    if (ycOnly) rows_ = rows_.filter((r) => !!r.ycBatch)
    return rows_
  }, [companyRows, arenaId, ycOnly])
  // Rank is scoped to what's shown: global 1..N across all arenas by default, but 1..X within
  // the selected arena when one is chosen — a reader picking an arena wants that arena's
  // standings, not each product's position in the site-wide list.
  const rankOf = useMemo(() => rankMegaRows(arenaId === 'all' ? companyRows : byArena), [companyRows, byArena, arenaId])
  const filtered = useMemo(() => filterMegaRowsByQuery(byArena, query), [byArena, query])
  const sorted = useMemo(() => sortMegaRows(filtered, column, direction), [filtered, column, direction])
  // The homepage table caps at 50 rows — past that it's a wall, and every row is one click from
  // its arena anyway. Filtering/sorting always applies to the full set; the cap is display-only.
  const visible = showAll ? sorted : sorted.slice(0, 50)

  // Mirror the sort into ?rank/?dir — defaults elided so the pristine view has a clean URL
  // (?dir only when the direction isn't the column's own default).
  function writeSortParams(col: MegaTableColumn, dir: SortDirection) {
    setParams({
      rank: col === DEFAULT_COLUMN ? null : col,
      dir: dir === defaultDirectionFor(col) ? null : dir,
    })
  }

  function handleSort(col: MegaTableColumn) {
    const next: SortDirection = col === column ? (direction === 'asc' ? 'desc' : 'asc') : defaultDirectionFor(col)
    setColumn(col)
    setDirection(next)
    writeSortParams(col, next)
  }

  function applyPreset(col: MegaTableColumn) {
    setColumn(col)
    setDirection('desc')
    writeSortParams(col, 'desc')
  }

  return (
    <div className="space-y-3">
      <TableControls
        presets={RANK_PRESETS}
        activeColumn={column}
        presetActive={direction === 'desc'}
        onPreset={applyPreset}
        scope={{
          value: arenaId,
          onChange: (value) => {
            setArenaId(value)
            setParams({ arena: value === 'all' ? null : value })
          },
          ariaLabel: 'Filter by ranking',
          // Each arena wears its house glyph in the desktop listbox (arenaIcon `pi:` token —
          // founder 2026-10-08: the house icon sweep reaches the scope dropdown); the legacy
          // emoji (a.icon, data/arena-icons.json) survives only as the below-sm native
          // <option> decoration, where SVG can't render.
          options: [{ value: 'all', label: 'All rankings' }, ...arenas.map((a) => ({ value: a.id, label: a.name, icon: arenaIcon(a.id), emoji: a.icon }))],
        }}
        query={query}
        onQuery={(value) => {
          setQuery(value)
          setParams({ q: value.trim() === '' ? null : value })
        }}
        after={
          <span className="flex items-center gap-1.5">
            {(
              [
                { key: 'yc', label: 'YC', on: ycOnly, set: setYcOnly, title: 'Only Y Combinator companies' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                title={f.title}
                aria-pressed={f.on}
                onClick={() => {
                  f.set(!f.on)
                  setParams({ [f.key]: f.on ? null : '1' })
                }}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  f.on
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                    : 'border-zinc-800 text-zinc-500 hover:border-emerald-400/40 hover:text-emerald-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </span>
        }
      />

      {/* lg (not md): with every sm/md column visible the table needs ~810px, so a 768–1023px
          viewport still gets the horizontal scroll container instead of page-level overflow.
          The old -mx-5 edge-to-edge mobile bleed is gone (founder 2026-10-05: one table shell
          sitewide — components/tableStyles.ts). */}
      <div className={`${TABLE_SHELL} lg:overflow-x-visible`}>
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <SortableTh col="name" current={column} direction={direction} onSort={handleSort}>
                # / Product
              </SortableTh>
              <SortableTh col="arena" current={column} direction={direction} onSort={handleSort} className="hidden lg:table-cell">
                <span title="The product category (ranking) it competes in — click through for that ranking's full leaderboard">Ranking</span>
              </SortableTh>
              <SortableTh col="oss" current={column} direction={direction} onSort={handleSort} className="hidden w-12 md:table-cell">
                <span title="Open source — the code is publicly available. Click to sort open-source products first.">OSS</span>
              </SortableTh>
              <SortableTh col="initScore" current={column} direction={direction} onSort={handleSort}>
                <span title="Overall score /100 — the blended headline score; click a badge for the methodology">Overall score</span>
              </SortableTh>
              <SortableTh col="agentReady" current={column} direction={direction} onSort={handleSort}>
                <span title="AGENT-READY = outside-in: can YOUR agent drive this product — API, MCP, CLI, headless runs, agent docs">Agent-ready</span>
              </SortableTh>
              <SortableTh col="agenticApp" current={column} direction={direction} onSort={handleSort} className="hidden sm:table-cell">
                <span title="BUILT-IN AI = inside-out: how agentic the product itself is FOR its users — assistants, autonomous features">Built-in AI</span>
              </SortableTh>
              <SortableTh col="apiQuality" current={column} direction={direction} onSort={handleSort} className="hidden lg:table-cell">
                <span title="API quality /100 — machine-readable spec, interactive docs, sandbox, versioning discipline. Untested = no evidence either way.">API</span>
              </SortableTh>
              <SortableTh col="popularity" current={column} direction={direction} onSort={handleSort} className="hidden md:table-cell">
                <span title="GitHub stars — adoption signal from public registries; never part of the Overall score. When the repo is known, clicking a count opens it.">GitHub ★</span>
              </SortableTh>
              <SortableTh col="rank" current={column} direction={direction} onSort={handleSort} sortable={false} className="hidden sm:table-cell">
                <span title="Agent access surfaces — MCP server / CLI / API, from judged evidence: ✓ full, ~ partial, ! disputed, — none found">Access</span>
              </SortableTh>
              {watchlistOn && (
                <SortableTh col="rank" current={column} direction={direction} onSort={handleSort} sortable={false} className="w-8">
                  <span className="sr-only">Watch</span>
                </SortableTh>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {visible.map((row) => {
              const rank = rankOf.get(megaRowKey(row)) ?? sorted.length
              return (
                <tr key={megaRowKey(row)} className="transition hover:bg-zinc-800/70">
                  <td className="min-w-[240px] max-w-[340px] px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 shrink-0 font-mono tabular-nums text-zinc-400">{ordinal(rank)}</span>
                      <Link
                        href={`/arena/${row.arenaId}/product/${row.productId}`}
                        className="flex min-w-0 items-center gap-2 hover:text-emerald-300"
                      >
                        <ProductLogoView product={{ id: row.productId, name: row.name }} size={30} hasLogo={row.hasLogo} />
                        <span className="min-w-0 truncate font-medium">{row.name}</span>
                      </Link>
                      {row.hotReason && <HotChip reason={row.hotReason} />}
                      <YcBadge ycBatch={row.ycBatch} />
                      {/* No Enterprise pill next to the name (founder 2026-10-05) —
                          row.enterprise stays data; the product page carries the badge. */}
                      <ShutdownBadge shutdown={row.shutdown} />
                    </div>
                  </td>
                  <td className="hidden max-w-[180px] px-2 py-2 lg:table-cell">
                    <Link href={`/arena/${row.arenaId}`} className="block truncate whitespace-nowrap text-xs text-zinc-500 hover:text-emerald-300">
                      {/* The arena's house glyph (lib/arenaIcons.ts) — same icon it wears in
                          the Rankings menu, not the legacy emoji from data/arena-icons.json. */}
                      {arenaIcon(row.arenaId) && (
                        <span aria-hidden className="mr-1 inline-flex align-[-0.125em]">
                          <IconGlyph icon={arenaIcon(row.arenaId)} />
                        </span>
                      )}
                      {row.arenaName}
                    </Link>
                  </td>
                  <td className="hidden px-2 py-2 md:table-cell">
                    {row.type === 'oss' ? <OssPill variant="compact" /> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1.5">
                      <AiEraBadge
                        value={row.initScore}
                        size="sm"
                        href="/methodology#arena-score"
                        interval={row.interval}
                        components={{
                          agentReady: row.agentReady,
                          apiQuality: row.apiQuality,
                          openness: null,
                          agenticApp: row.agenticApp,
                          automation: null,
                        }}
                      />
                      <TrendArrow delta={row.trendDelta} />
                      {/* The A–D confidence letter chip left the score cell (founder
                          2026-10-05) — row.confidence stays data (lib/megaTable.ts; the
                          grades still feed /rankings/most-tested and the D-gap rule). */}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums text-zinc-300">
                    {row.naDimensions?.includes('agentReady') ? (
                      <span className="text-zinc-500" title="Not meaningful for this ranking's product class — a physical part has no agent-drivable surface of its own. The Overall score still applies.">n/a</span>
                    ) : row.agentReadyUntested ? (
                      <span className="font-sans text-xs italic text-zinc-500" title="No agent-access evidence found or probed either way — unscored, not zero.">
                        untested
                      </span>
                    ) : row.agentReady === null ? (
                      <span className="text-zinc-500">n/a</span>
                    ) : (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span>{row.agentReady.toFixed(0)}<span className="text-zinc-500">/100</span></span>
                        <TrendArrow delta={row.agentReadyTrendDelta} metric="agent-readiness" />
                      </span>
                    )}
                  </td>
                  <td className="hidden px-2 py-2 font-mono tabular-nums text-zinc-300 sm:table-cell">
                    {row.naDimensions?.includes('agenticApp') ? (
                      <span className="text-zinc-500" title="Not meaningful for this ranking's product class. The Overall score still applies.">n/a</span>
                    ) : row.agenticAppUntested ? (
                      <span className="font-sans text-xs italic text-zinc-500" title="No agentic-features evidence found or probed either way — unscored, not zero.">
                        untested
                      </span>
                    ) : row.agenticApp === null ? <span className="text-zinc-500">n/a</span> : <>{row.agenticApp.toFixed(0)}<span className="text-zinc-500">/100</span></>}
                  </td>
                  <td className="hidden px-2 py-2 font-mono tabular-nums text-zinc-300 lg:table-cell">
                    {row.naDimensions?.includes('apiQuality') ? (
                      <span className="text-zinc-500" title="Not meaningful for this ranking's product class — a physical part has no API of its own. The Overall score still applies.">n/a</span>
                    ) : row.apiUntested ? (
                      <span className="font-sans text-xs italic text-zinc-500" title="No API-quality evidence found or probed either way — unscored, not zero.">
                        untested
                      </span>
                    ) : row.apiQuality === null ? (
                      <span className="text-zinc-500">n/a</span>
                    ) : (
                      <>{row.apiQuality.toFixed(0)}<span className="text-zinc-500">/100</span></>
                    )}
                  </td>
                  <td className="hidden px-2 py-2 md:table-cell">
                    {/* Tiny stars-only records fall through with the null branch (founder
                        2026-10-02, the ByteAsk case — see lib/popularity.ts's
                        belowCompactStarsFloor): the guard here keeps an empty GitHub <a>
                        wrapper from rendering around a suppressed chip. */}
                    {row.popularity === null || belowCompactStarsFloor({ fetchedAt: '', stars: row.popularity }) ? (
                      isNotablyPopular(row.productId) ? <PopularTag /> : null
                    ) : (
                      row.githubUrl ? (
                      <a href={row.githubUrl} target="_blank" rel="noopener noreferrer" title="Open the GitHub repo" className="hover:text-emerald-300">
                        <MomentumChip popularity={{ fetchedAt: '', stars: row.popularity }} compact />
                      </a>
                    ) : (
                      <MomentumChip popularity={{ fetchedAt: '', stars: row.popularity }} compact />
                    )
                    )}
                  </td>
                  <td className="hidden px-2 py-2 sm:table-cell">
                    <div className="flex items-center gap-2.5 font-mono text-xs">
                      {(['MCP', 'CLI', 'API'] as const).map((label) => {
                        const glyph = row.access[label]
                        return (
                          <Link
                            key={label}
                            href={glyph.href}
                            className="flex items-center gap-1 hover:text-emerald-300"
                            title={glyph.title}
                          >
                            <span className="text-zinc-400">{label}</span>
                            <span className={glyph.className}>{glyph.char}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </td>
                  {/* Compare + Evidence end-columns removed (founder 2026-09-29: rows must not
                      wrap; both live one click in on the product page). */}
                  {watchlistOn && (
                    <td className="px-2 py-2 text-center">
                      <WatchButton productId={row.productId} productName={row.name} size="sm" />
                    </td>
                  )}
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={watchlistOn ? 12 : 11} className="px-3 py-6 text-center text-zinc-500">
                  No products match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!showAll && sorted.length > 50 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mx-auto block rounded-full border border-zinc-800 px-4 py-1.5 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
        >
          Show all {sorted.length} products
        </button>
      )}
    </div>
  )
}
