'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import AuthGatedMarker from '@/components/AuthGatedMarker'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import ContestLink from '@/components/ContestLink'
import { IconGlyph } from '@/components/IconChip'
import RowMenu from '@/components/RowMenu'
import PersonaChip from '@/components/PersonaChip'
import SurfaceChip from '@/components/SurfaceChip'
import ThemeIcon from '@/components/ThemeIcon'
import TierChip from '@/components/TierChip'
import UncertaintyMarker from '@/components/UncertaintyMarker'
import VerdictBadge from '@/components/VerdictBadge'
import VerificationBadge from '@/components/VerificationBadge'
import { humanizeTheme } from '@/lib/icons'
import type { VendorResponse, Verdict } from '@/lib/schemas'
import { isCoveredVerdict, surfacesForEvidence } from '@/lib/storyCoverage'
import {
  type SortDirection,
  type StoryProcessLink,
  type StoryVerdictColumn,
  type StoryVerdictRow,
  COLUMN_LABELS,
  defaultDirectionFor,
  filterStoryVerdictRows,
  isStoryUntested,
  sortStoryVerdictRows,
} from '@/lib/storyVerdictsSort'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Sortable/filterable replacement for the product page's old vertical "Story verdicts" list
// (same data, one dense view instead of a long theme-grouped scroll). Every row keeps the old
// list's id={`story-${storyId}`} anchor — StoryMatrix, AgentAccessGlyphs, the mega table,
// ClaimsSection, and AiModeBadge all deep-link to #story-<id> on this page — and the full
// rationale + evidence detail the list used to show inline lives in a per-row expansion
// (auto-opened when the URL hash targets that row).

// Compact scope marker for the story cell: [G]lobal stories are comparable across all software
// (linking to their /global/[story] cross-arena page when one exists), [C]ategory stories only
// within this arena's domain, [P]roduct stories probe one product's specific claim. Untagged
// stories render no chip. See lib/schemas.ts's StorySchema.scope.
const SCOPE_CHIP: Record<NonNullable<StoryVerdictRow['scope']>, { label: string; title: string }> = {
  global: { label: 'G', title: 'Global story — comparable across all software we rank' },
  category: { label: 'C', title: 'Category story — meaningful within this ranking’s domain' },
  product: { label: 'P', title: 'Product story — probes one product’s specific claim' },
}

function ScopeChip({ scope, globalHref }: { scope: StoryVerdictRow['scope']; globalHref: string | null }) {
  if (!scope) return null
  const { label, title } = SCOPE_CHIP[scope]
  const className =
    'inline-flex shrink-0 items-center rounded border border-zinc-800 px-1 font-mono text-[10px] leading-4 text-zinc-500'
  if (scope === 'global' && globalHref) {
    return (
      <Link
        href={globalHref}
        title={`${title} — see every product’s verdict`}
        className={`${className} transition hover:border-emerald-400/60 hover:text-emerald-300`}
      >
        {label}
      </Link>
    )
  }
  return (
    <span title={title} className={className}>
      {label}
    </span>
  )
}

function SortableTh({
  children,
  col,
  current,
  direction,
  onSort,
  className = '',
}: {
  children: ReactNode
  col: StoryVerdictColumn
  current: StoryVerdictColumn
  direction: SortDirection
  onSort: (col: StoryVerdictColumn) => void
  className?: string
}) {
  const isCurrent = col === current
  const ariaSort: 'ascending' | 'descending' | 'none' = !isCurrent ? 'none' : direction === 'asc' ? 'ascending' : 'descending'
  return (
    <th scope="col" aria-sort={ariaSort} className={`px-3 py-2 font-normal ${className}`}>
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

// How we confirmed the responder actually speaks for the vendor — see docs/VENDOR-RESPONSES.md.
const VERIFICATION_METHOD_LABEL: Record<VendorResponse['verification']['method'], string> = {
  'domain-email': 'verified via company-domain email',
  'github-org': 'verified via vendor GitHub org',
  'dns-txt': 'verified via DNS TXT token',
}

// CVE-style official vendor statement on one verdict, rendered inside the expanded row.
// Deliberately sky-tinted (vs the site's emerald accents) so a vendor's words are never
// mistaken for our judge's — the statement is verbatim, the verification trail is shown, and
// the inline rule makes the non-negotiable explicit: a response never moves a verdict by
// itself. See lib/schemas.ts's VendorResponseSchema and docs/VENDOR-RESPONSES.md.
function VendorResponseBlock({ response }: { response: VendorResponse }) {
  return (
    <div className="mt-3 rounded-lg border border-sky-400/40 bg-sky-400/5 px-3 py-2.5">
      <p className="flex flex-wrap items-center gap-2 text-xs text-sky-300">
        <span className="rounded border border-sky-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Vendor
        </span>
        <span className="font-medium">Official vendor response</span>
        {response.status === 'superseded' && (
          <span
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
            title="A later re-judge has already incorporated this response into the evidence pool."
          >
            superseded
          </span>
        )}
      </p>
      <blockquote className="mt-1.5 text-sm text-sky-100/90">&ldquo;{response.statement}&rdquo;</blockquote>
      <p className="mt-1.5 text-xs text-zinc-400">
        {response.contactRole} · {VERIFICATION_METHOD_LABEL[response.verification.method]}{' '}
        <span className="text-zinc-500">({response.verification.evidence})</span> · {response.respondedAt.slice(0, 10)}
        {response.url && (
          <>
            {' · '}
            <a
              href={response.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the vendor's full public statement"
              className="underline decoration-zinc-700 hover:text-sky-300"
            >
              full statement ↗
            </a>
          </>
        )}
      </p>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        Vendor responses are published verbatim and never change a verdict by themselves — they enter the
        evidence pool for the next re-judge.
      </p>
    </div>
  )
}

// Reconstructs the minimal Verdict shape ContestLink's prefilled-issue body reads from a
// serialized row — same values the server judged, never invented.
function verdictForContest(productId: string, row: StoryVerdictRow): Verdict {
  return {
    productId,
    storyId: row.storyId,
    verdict: row.verdict,
    quality: row.quality,
    confidence: row.confidence,
    rationale: row.rationale,
    evidenceIds: row.evidence.map((e) => e.id),
  }
}

export default function StoryVerdictsTable({
  category,
  productId,
  rows,
  processes,
}: {
  category: string
  productId: string
  rows: StoryVerdictRow[]
  // storyId → related founder processes (lib/storyGraph.ts's storyProcessesForArena) — the
  // story↔process connection layer (founder ask 2026-09-22). OPTIONAL: undefined hides the
  // "Processes" column entirely (pages not yet wired render exactly as before); present, every
  // row gets a cell — up to two icon+title chips linking to /processes/<slug>#steps, a "+N"
  // tooltip for the rest, an em-dash when no process maps onto the story.
  processes?: Record<string, StoryProcessLink[]>
}) {
  const [column, setColumn] = useState<StoryVerdictColumn>('importance')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState('')
  const [scope, setScope] = useState('')
  const [tier, setTier] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // Themes in first-seen story order (the taxonomy's own order), not alphabetical — matches
  // how groupInOrder drives the "By theme" strip above the table.
  const themes = useMemo(() => {
    const seen: string[] = []
    for (const r of rows) if (!seen.includes(r.theme)) seen.push(r.theme)
    return seen
  }, [rows])

  // Only the scopes actually present — a taxonomy that was never scope-tagged renders no
  // dropdown at all rather than a filter that can only ever show everything.
  const scopes = useMemo(() => {
    const order: NonNullable<StoryVerdictRow['scope']>[] = ['global', 'category', 'product']
    return order.filter((s) => rows.some((r) => r.scope === s))
  }, [rows])

  // Only the classified tiers actually present, in the canonical order — an arena that was
  // never through the tier classifier renders no tier dropdown at all (same posture as the
  // scope filter above: never a filter that can only show everything).
  const tiers = useMemo(() => {
    const order = ['free', 'paid', 'enterprise'] as const
    return order.filter((t) => rows.some((r) => r.tier === t))
  }, [rows])

  // User types in first-seen order (matching the "User type" column) — founder ask 2026-09-15:
  // filter the story table by who the story is for. Hidden when only one type exists.
  const [persona, setPersona] = useState('')
  const personas = useMemo(() => {
    const seen: string[] = []
    for (const r of rows) if (r.personaLabel && !seen.includes(r.personaLabel)) seen.push(r.personaLabel)
    return seen
  }, [rows])

  const filtered = useMemo(() => filterStoryVerdictRows(rows, query, theme, scope, tier, persona), [rows, query, theme, scope, tier, persona])
  const sorted = useMemo(() => sortStoryVerdictRows(filtered, column, direction), [filtered, column, direction])

  // 9 base columns; the optional "Processes" column (present only when the page passed the
  // story→process map) makes it 10 — every full-width cell (no-match row, expanded details)
  // spans whichever count is live.
  const colSpan = processes ? 10 : 9

  // Auto-expand the row a #story-<id> deep link targets — on mount for cross-page links
  // (StoryMatrix, mega table, glyph tables) and on hashchange for same-page ones (ClaimsSection,
  // AiModeBadge), which update the hash without a remount.
  useEffect(() => {
    function expandFromHash() {
      const match = window.location.hash.match(/^#story-(.+)$/)
      if (!match) return
      const storyId = decodeURIComponent(match[1])
      if (!rows.some((r) => r.storyId === storyId)) return
      setExpanded((prev) => (prev.has(storyId) ? prev : new Set(prev).add(storyId)))
    }
    expandFromHash()
    window.addEventListener('hashchange', expandFromHash)
    return () => window.removeEventListener('hashchange', expandFromHash)
  }, [rows])

  function handleSort(col: StoryVerdictColumn) {
    if (col === column) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColumn(col)
      setDirection(defaultDirectionFor(col))
    }
  }

  function toggle(storyId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(storyId)) next.delete(storyId)
      else next.add(storyId)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          aria-label="Filter stories by theme"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
        >
          <option value="">All themes</option>
          {/* Option VALUES stay raw ids (filter logic matches row.theme); only the visible
              label is humanized — dashes never reach the UI. */}
          {themes.map((t) => (
            <option key={t} value={t}>
              {humanizeTheme(t)}
            </option>
          ))}
        </select>
        {scopes.length > 0 && (
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label="Filter stories by scope"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
          >
            <option value="">All scopes</option>
            {scopes.map((s) => (
              <option key={s} value={s}>
                {/* Humanized, not the raw value — "Global stories", not "global". */}
                {s === 'global' ? 'Global stories' : s === 'category' ? 'Category stories' : 'Product stories'}
              </option>
            ))}
          </select>
        )}
        {tiers.length > 0 && (
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            aria-label="Filter stories by pricing tier"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
          >
            <option value="">All tiers</option>
            {tiers.map((t) => (
              <option key={t} value={t}>
                {/* Humanized like the scope options — "Free stories", never the bare value. */}
                {t === 'free' ? 'Free stories' : t === 'paid' ? 'Paid stories' : 'Enterprise stories'}
              </option>
            ))}
          </select>
        )}
        {personas.length > 1 && (
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            aria-label="Filter stories by user type"
            className="max-w-[11rem] rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-400/60 focus:outline-none"
          >
            <option value="">All user types</option>
            {personas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter stories…"
          aria-label="Filter stories by title, persona, or theme"
          className="ml-auto w-full min-w-0 max-w-[14rem] rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none sm:w-48"
        />
        {/* Header tooltips are hover-only — the tappable route to the column definitions. */}
        <ColumnsHelpLink />
      </div>

      <p className="text-xs text-zinc-400" aria-live="polite">
        Sorted by <span className="font-semibold text-emerald-300">{COLUMN_LABELS[column]}</span>{' '}
        ({direction === 'desc' ? 'high → low' : 'low → high'})
        {' · '}
        {sorted.length}/{rows.length} stories · click a row&rsquo;s chevron for the rationale and evidence
      </p>

      <div className={TABLE_SHELL}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              {/* No visible header text (founder 2026-10-07): the stories themselves make the
                  column self-evident. sr-only keeps the sort button and column named for AT. */}
              <SortableTh col="title" current={column} direction={direction} onSort={handleSort}>
                <span className="sr-only">Story</span>
              </SortableTh>
              <SortableTh col="persona" current={column} direction={direction} onSort={handleSort}>
                <span title="Whose perspective the story is told from — the kind of user who needs it">User type</span>
              </SortableTh>
              <SortableTh col="theme" current={column} direction={direction} onSort={handleSort}>
                <span title="The capability grouping this story belongs to (agent access, openness, automation…)">Theme</span>
              </SortableTh>
              <SortableTh col="weight" current={column} direction={direction} onSort={handleSort}>
                <span title="How much this story counts in the ranking's scoring — higher weight = more important capability">Weight</span>
              </SortableTh>
              <SortableTh col="verdict" current={column} direction={direction} onSort={handleSort}>
                <span title="Does the product deliver this story? full / partial / none / disputed / n-a — judged from cited evidence">Verdict</span>
              </SortableTh>
              <SortableTh col="quality" current={column} direction={direction} onSort={handleSort}>
                <span title="How well it delivers when it does (0–100) — a partial verdict can still be high quality">Quality</span>
              </SortableTh>
              <SortableTh col="verification" current={column} direction={direction} onSort={handleSort}>
                <span title="How the verdict was proven: tested by us, community-backed, or vendor claim only">Verification</span>
              </SortableTh>
              <SortableTh col="evidence" current={column} direction={direction} onSort={handleSort}>
                <span title="How many cited sources back this verdict — expand the row to read them">Evidence</span>
              </SortableTh>
              {processes && (
                <th scope="col" className="px-3 py-2 font-normal">
                  <span
                    className="whitespace-nowrap"
                    title="Founder processes this story's capability maps onto (via the committed step→story mapping) — chips link to the process page's step list"
                  >
                    Processes
                  </span>
                </th>
              )}
              <th scope="col" aria-label="Row actions" className="w-8 px-1 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {sorted.map((row) => {
              const isOpen = expanded.has(row.storyId)
              const untested = isStoryUntested(row)
              return (
                // React fragments can't carry the anchor, so the id lives on the main <tr>;
                // scroll-mt-4 keeps #story-<id> deep links landing clear of the viewport top.
                <StoryRowPair
                  key={row.storyId}
                  row={row}
                  isOpen={isOpen}
                  untested={untested}
                  category={category}
                  productId={productId}
                  processLinks={processes ? processes[row.storyId] ?? [] : undefined}
                  colSpan={colSpan}
                  onToggle={() => toggle(row.storyId)}
                />
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-6 text-center text-zinc-500">
                  No stories match{theme !== '' ? ` theme “${humanizeTheme(theme)}”` : ''}{query.trim() !== '' ? ` “${query}”` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StoryRowPair({
  row,
  isOpen,
  untested,
  category,
  productId,
  processLinks,
  colSpan,
  onToggle,
}: {
  row: StoryVerdictRow
  isOpen: boolean
  untested: boolean
  category: string
  productId: string
  // undefined = the table has no "Processes" column at all; [] = column present, none related.
  processLinks?: StoryProcessLink[]
  colSpan: number
  onToggle: () => void
}) {
  const detailsId = `story-details-${row.storyId}`
  // Which docs area / API section / community source the cited evidence came from
  // (lib/storyCoverage.ts) — derived on demand from the row's already-serialized evidence
  // links, so no new data crosses the server/client boundary. Empty for none/na verdicts:
  // their citations are absence-evidence, not coverage.
  const surfaces = isOpen && isCoveredVerdict(row.verdict) ? surfacesForEvidence(row.evidence) : []
  return (
    <>
      <tr id={`story-${row.storyId}`} className="scroll-mt-4 align-top transition hover:bg-zinc-800/70">
        <td className="px-3 py-2">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={detailsId}
              aria-label={`Details for story ${row.storyId}`}
              className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-500 transition hover:text-emerald-300"
            >
              <svg
                viewBox="0 0 16 16"
                width={12}
                height={12}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
                className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
              >
                <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="min-w-0">
              {/* Persona moved to its own "User type" column (founder request) — the full
                  authored title stays in row.title for filtering/flag links. */}
              <p className="font-medium">
                <span title={row.origin}>{row.action}</span>{' '}
                <ScopeChip scope={row.scope} globalHref={row.globalHref} />
              </p>
              {row.group !== row.theme && (
                // Group NAME, not an annotation — readable tier (founder 2026-09-30 'Caching' ask).
                <p className="mt-0.5 text-xs text-zinc-400">{humanizeTheme(row.group)}</p>
              )}
            </div>
          </div>
        </td>
        {/* User type cell — was missing entirely (8 headers, 7 cells), which shifted every
            column left by one under the wrong header. PersonaChip was imported for exactly
            this cell. */}
        <td className="whitespace-nowrap px-3 py-2 text-xs">
          <PersonaChip persona={row.personaLabel} />
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <ThemeIcon theme={row.theme} />
            {humanizeTheme(row.theme)}
          </span>
        </td>
        <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">{row.weight}</td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <VerdictBadge verdict={row.verdict} />
            <UncertaintyMarker agreement={row.agreement} />
            {/* Pricing-tier annotation (lib/storyTiers.ts) — renders only when the cited
                evidence stated the gating; unknown/unclassified rows show nothing. */}
            <TierChip tier={row.tier} tierNote={row.tierNote} />
          </span>
        </td>
        <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">
          {untested ? (
            <span
              className="font-sans text-xs italic text-zinc-500"
              title="No evidence found or probed either way — unscored, not zero."
            >
              untested
            </span>
          ) : (
            <>{row.quality}/10</>
          )}
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <VerificationBadge level={row.verification} responsive href="/methodology#evidence-tiers" />
            {row.authGated && <AuthGatedMarker compact />}
          </span>
        </td>
        <td className="px-3 py-2">
          {row.evidence.length === 0 ? (
            <span className="font-sans text-xs tabular-nums italic text-zinc-500" title="No evidence collected for this story yet — the verdict rests on absence, which the pipeline re-checks on refresh">none yet</span>
          ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={detailsId}
            className={`font-sans text-xs tabular-nums underline decoration-zinc-800 hover:text-emerald-300 ${row.evidence.length === 0 ? 'text-zinc-500' : 'text-zinc-300'}`}
          >
            {row.evidence.length} {row.evidence.length === 1 ? 'source' : 'sources'}
          </button>
          )}
        </td>
        {processLinks !== undefined && (
          <td className="px-3 py-2 text-xs">
            {processLinks.length === 0 ? (
              <span className="text-zinc-600" title="No founder process maps onto this story">
                —
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-1">
                {processLinks.slice(0, 2).map((p) => (
                  <Link
                    key={p.slug}
                    href={`/processes/${p.slug}#steps`}
                    title={`${p.title} — a founder process this story's capability maps onto; opens the process page's step list`}
                    className="inline-flex max-w-[11rem] items-center gap-1 whitespace-nowrap rounded border border-zinc-800 px-1.5 py-0.5 text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
                  >
                    <span aria-hidden><IconGlyph icon={p.icon} /></span>
                    <span className="truncate">{p.title}</span>
                  </Link>
                ))}
                {processLinks.length > 2 && (
                  <span
                    className="rounded border border-zinc-800 px-1.5 py-0.5 font-sans text-[10px] tabular-nums text-zinc-500"
                    title={processLinks.slice(2).map((p) => p.title).join(' · ')}
                  >
                    +{processLinks.length - 2}
                  </span>
                )}
              </span>
            )}
          </td>
        )}
        <td className="px-1 py-2 text-right">
          <RowMenu category={category} productId={productId} storyId={row.storyId} verdict={row.verdict} quality={row.quality} />
        </td>
      </tr>
      {isOpen && (
        <tr id={detailsId} className="bg-zinc-900/30">
          <td colSpan={colSpan} className="px-3 py-3 pl-9">
            {/* Judge rationales are written for auditability, not skimming — collapse them by
                default behind a plain-language one-liner so the row leads with evidence. */}
            <details>
              <summary className="cursor-pointer select-none text-sm text-zinc-400 hover:text-emerald-300">
                Why the judge ruled &ldquo;{row.verdict}&rdquo;{row.quality > 0 ? ` at ${row.quality}/10` : ''} — full reasoning
              </summary>
              <p className="mt-1.5 text-sm text-zinc-500">{row.rationale}</p>
            </details>
            {surfaces.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  className="text-zinc-500"
                  title="The docs area / API section / community source each cited evidence item came from — chips link to the actual evidence URL."
                >
                  Covered by
                </span>
                {surfaces.map((s) => (
                  <SurfaceChip key={s.key} surface={s} />
                ))}
              </p>
            )}
            {row.evidence.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {row.evidence.map((e) => (
                  <li key={e.id} className="text-xs text-zinc-400">
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open the cited source (tier ${e.tier} evidence)`}
                      className="underline decoration-zinc-800 hover:text-emerald-300"
                    >
                      [{e.tier}]
                    </a>{' '}
                    <span className="break-all text-zinc-500">{e.url}</span>
                    <span className="mt-0.5 block text-zinc-500">&ldquo;{e.excerpt}&rdquo;</span>
                  </li>
                ))}
              </ul>
            )}
            {row.vendorResponse && <VendorResponseBlock response={row.vendorResponse} />}
            <div className="mt-2 flex items-center justify-end gap-3">
              {row.proofUrl && (
                <a
                  href={row.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the recorded probe proof for this verdict"
                  className="text-xs text-zinc-400 hover:text-emerald-300"
                >
                  proof ↗
                </a>
              )}
              <ContestLink
                category={category}
                productId={productId}
                storyId={row.storyId}
                verdict={verdictForContest(productId, row)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
