import Link from 'next/link'
import { Fragment } from 'react'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { phaseIcon, phaseTooltip } from '@/lib/processIcons'
import { processesForVendor, type VendorProcessAppearance } from '@/lib/vendorProcesses'

// Server component: "Processes this product serves" — the founder ask (2026-09-21): every
// company/product page lists the founder processes it comes up in, clicking through to the
// process pages. Rows come straight from lib/vendorProcesses.ts's reverse index over the SAME
// derivations the process pages render (processLeaderboard, cross-arena rankings, computer-use
// options, canonical vendors, grounded API calls), so the two surfaces can never disagree.
// Renders nothing for the many products no process ever surfaces.
//
// Depth (founder 2026-10-02): each process row carries its per-step receipts inline — every
// judged served step on its own muted line, deep-linked to the step's block on the process page,
// with its judged score /100 (ServedStepLines below).
//
// Grouping: judged-SERVING appearances (a judged step score or a canonical/API-call role) lead
// the table, capped at 8 visible rows; the rest — including every computer-use-only appearance
// (browser agents surface on ~100 manual steps as "could attempt it today", which is not
// "serves it") — collapse into a native <details> (static-export safe, the CoverageMapSection
// pattern) whose summary always counts them out loud.

const VISIBLE_ROWS = 8

// Founder 2026-10-02: the column is named for what the number IS — how well the product fits
// its best-matching step of this process (its highest judged per-step relevance score here),
// not a process-wide coverage number.
// The COLUMN header keeps the one-clause description; each ROW's tooltip states that number's
// own derivation — the actual best step and its real mapped-story count (founder 2026-10-05:
// never a canned sentence where the concrete counts exist).
const BEST_SCORE_TITLE =
  'Highest judged step score /100 for this process — derived purely from the arena\'s judged verdicts'

function bestScoreTitle(a: VendorProcessAppearance): string {
  // servedSteps are best-first; computer-use-only appearances carry a score but no served
  // steps — their number comes from the mapped computer-use stories instead.
  const top = a.servedSteps[0]
  if (top && top.score === a.bestStepScore) {
    return `${a.bestStepScore}/100 — its best judged step here is “${top.label}” (${top.storyCount} mapped ${top.storyCount === 1 ? 'story' : 'stories'}); the receipts lines below link each judged step`
  }
  return `${a.bestStepScore}/100 — its best judged score here is on this process's mapped computer-use stories`
}

// A computer-use-ONLY appearance: the vendor never serves a step here, it could merely attempt
// a manual one. These never take a visible row — collapsed, counted honestly.
function isComputerUseOnly(a: VendorProcessAppearance): boolean {
  return a.kinds.length === 1 && a.kinds[0] === 'computer-use'
}

// Compact role line, mirroring the process page's own framing of each appearance kind.
// Founder 2026-10-02: the 'canonical vendor' label is gone from this surface (the kind stays
// corpus data and the role tooltip still explains it) — canonical-only rows show a muted dash.
function roleText(a: VendorProcessAppearance): string {
  const parts: string[] = []
  if (a.leaderboardRank !== null) {
    parts.push(`#${a.leaderboardRank} for this process · ${a.stepsServed}/${a.rankableSteps} steps`)
  } else if (a.kinds.includes('cross-arena')) {
    parts.push('cross-arena option')
  }
  if (parts.length === 0 && a.kinds.includes('api-calls')) parts.push('grounded API calls')
  if (parts.length === 0 && a.kinds.includes('computer-use')) parts.push('🖥 computer-use attempt')
  if (parts.length === 0) parts.push('—')
  return parts.join(' · ')
}

function roleTitle(a: VendorProcessAppearance): string {
  const why: Record<string, string> = {
    'step-ranked': 'it has a judged step score on the process\'s own step rankings',
    'cross-arena': 'it surfaces on a step as an evidence-gated cross-arena option',
    'computer-use': 'it could attempt a manual step of this process today (judged computer-use evidence — not coverage)',
    canonical: 'a step names it as the canonical call target',
    'api-calls': 'it has grounded per-step API calls on this process',
  }
  return `How this product comes up here: ${a.kinds.map((k) => why[k]).join('; ')}.`
}

// Per-step tooltip: the same judged number BEST_SCORE_TITLE describes, one step at a time —
// with the step's own real mapped-story count (founder 2026-10-05).
function stepScoreTitle(s: { score: number; storyCount: number }): string {
  return `${s.score}/100 — judged verdicts on the ${s.storyCount} ${s.storyCount === 1 ? 'story' : 'stories'} mapped to this step`
}

// The per-step receipts under each process row (founder 2026-10-02: "go deeper on what each
// vendor can do process-wise" — this re-introduces the per-step view the earlier declutter
// dropped as a cramped "via:" one-liner, redesigned for depth): one judged served step per line,
// the step name deep-linking to its block on the process page (#step-<taskId>-<nodeId>), its
// judged score /100 beside it. Strictly the committed step→story mappings — computer-use-only
// and canonical/api-calls-only appearances have no judged served steps and get no sub-rows.
function ServedStepLines({ a }: { a: VendorProcessAppearance }) {
  if (a.servedSteps.length === 0) return null
  return (
    // !border-t-0 defeats the tbody's divide-y line so the receipts read as part of their row.
    <tr className="!border-t-0">
      <td colSpan={4} className="px-2 pb-2 pt-0">
        <ul className="ml-1 space-y-0.5 border-l border-zinc-800 pl-3">
          {a.servedSteps.map((s) => (
            <li key={s.nodeId} className="text-[11px] leading-relaxed text-zinc-500">
              <Link
                href={`/processes/${a.slug}#step-${a.taskId}-${s.nodeId}`}
                title={`${s.label} — open this step on the process page (${s.storyCount} mapped ${s.storyCount === 1 ? 'story' : 'stories'} behind this score)`}
                className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
              >
                {s.label}
              </Link>
              {' — '}
              <span className="font-mono tabular-nums" title={stepScoreTitle(s)}>
                {s.score}
                <span className="text-zinc-500">/100</span>
              </span>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  )
}

function AppearanceRows({ rows }: { rows: VendorProcessAppearance[] }) {
  return (
    <>
      {rows.map((a) => (
        <Fragment key={a.taskId}>
          <tr className="transition hover:bg-zinc-800/70">
            <td className="max-w-[280px] px-2 py-1.5">
              <Link
                href={`/processes/${a.slug}`}
                title={`${a.title} — see the full process page`}
                className="flex items-center gap-1.5 font-medium hover:text-emerald-300"
              >
                {a.icon && <span aria-hidden><IconGlyph icon={a.icon} /></span>}
                <span className="truncate">{a.title}</span>
              </Link>
            </td>
            <td className="px-2 py-1.5 text-xs text-zinc-400">
              <span title={phaseTooltip(a.phase)}>
                {phaseIcon(a.phase) && <span aria-hidden className="mr-1"><IconGlyph icon={phaseIcon(a.phase)} /></span>}
                {a.phase}
              </span>
            </td>
            <td className="px-2 py-1.5 text-xs text-zinc-300">
              <span title={roleTitle(a)}>{roleText(a)}</span>
            </td>
            <td className="px-2 py-1.5 font-mono text-xs tabular-nums text-zinc-300">
              {a.bestStepScore === null ? (
                <span className="italic text-zinc-500">—</span>
              ) : (
                <span title={bestScoreTitle(a)}>
                  {a.bestStepScore}
                  <span className="text-zinc-500">/100</span>
                </span>
              )}
            </td>
          </tr>
          <ServedStepLines a={a} />
        </Fragment>
      ))}
    </>
  )
}

function AppearanceTable({ rows }: { rows: VendorProcessAppearance[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 md:overflow-x-visible">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-widest text-zinc-400">
            <th scope="col" className="px-2 py-1.5 font-normal"><span title="The founder process this product comes up in — links to its process page">Process</span></th>
            <th scope="col" className="px-2 py-1.5 font-normal"><span title="Company-lifecycle phase the process belongs to">Phase</span></th>
            <th scope="col" className="px-2 py-1.5 font-normal"><span title="How this product comes up: its process-leaderboard rank and step coverage, or a cross-arena / computer-use / canonical role">Role</span></th>
            <th scope="col" className="px-2 py-1.5 font-normal"><span title={BEST_SCORE_TITLE}>Best step fit</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          <AppearanceRows rows={rows} />
        </tbody>
      </table>
    </div>
  )
}

export default function VendorProcesses({
  arenaId,
  productId,
  productName,
}: {
  arenaId: string
  productId: string
  productName: string
}) {
  const appearances = processesForVendor(arenaId, productId)
  if (appearances.length === 0) return null

  const serving = appearances.filter((a) => !isComputerUseOnly(a))
  const cuOnly = appearances.filter(isComputerUseOnly)
  const visible = serving.slice(0, VISIBLE_ROWS)
  const overflow = [...serving.slice(VISIBLE_ROWS), ...cuOnly]

  return (
    <div id="processes" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] mb-1 flex items-center gap-2 text-lg font-semibold">
        <GeoMark
          seed="vendor-processes"
          title="Processes — the founder operating processes this product comes up in, from the same story-derived rankings the process pages show"
          size={18}
          className="text-zinc-500"
        />
        Processes this product serves
      </h2>
      <p className="mb-3 text-sm text-zinc-500">
        Where {productName} comes up across our{' '}
        <Link href="/processes" className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300">
          founder operating processes
        </Link>
        {' '}— same judged, story-derived step rankings the process pages show, in reverse.
      </p>
      {visible.length > 0 && <AppearanceTable rows={visible} />}
      {overflow.length > 0 && (
        <details className={visible.length > 0 ? 'mt-2' : ''}>
          <summary className="cursor-pointer select-none text-xs text-zinc-400 transition hover:text-emerald-300">
            {overflow.length}{visible.length > 0 ? ' more' : ''} {overflow.length === 1 ? 'process' : 'processes'}
            {cuOnly.length > 0 && (
              <span className="text-zinc-500">
                {' '}— {cuOnly.length === overflow.length ? 'all' : cuOnly.length} computer-use-only:
                judged &ldquo;could attempt a manual step today&rdquo; evidence, not step coverage
              </span>
            )}
          </summary>
          <div className="mt-2">
            <AppearanceTable rows={overflow} />
          </div>
        </details>
      )}
    </div>
  )
}
