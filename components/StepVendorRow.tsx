'use client'

import Link from 'next/link'
import ProductLogoView from '@/components/ProductLogoView'
import VendorGeoMark, { useVendorGeoCell } from '@/components/VendorGeoMark'
import type { VendorGeoByCountry } from '@/lib/geoPreference'
import { isPicked } from '@/lib/myStack'
import type { ProcessCheckStep } from '@/lib/processCheck'
import { lensGapFor, useProcessLens, type LensSource } from '@/lib/processLens'

// The per-step ranked vendor chip row, client-rendered so vendors are SELECTABLE (founder
// 2026-09-21: "if the user clicks a vendor I want it to select using that vendor through the
// process and adapt the DAG to using that"). Replaces the server-rendered chip row inside
// components/ProcessDag.tsx's StepRankingRow — the evidence trail ("how these are ranked")
// stays server-rendered below, unchanged. Founder 2026-09-30: no leading label — ALL the
// step's vendors render as one line, highest score left→right (the 'e.g.' canonical reference
// chip is retired with it).
//
// Static-HTML contract: the server snapshot (empty lens, stack snapshot '{}') renders the
// serialized default order with no selection styling — IDENTICAL to what a reader without a
// lens or stack sees after hydration, so there is no personalized flash and the SEO HTML stays
// the one shared default view. Only clicks ("use") and "I'm using" stacks change anything,
// entirely client-side via lib/processLens.ts (lens > stack > default).
//
// Each chip keeps its product-page LINK (the judged evidence) and gains a small "use" button —
// the select affordance. The selected vendor pins FIRST: emerald ring + "✓ via" when it came
// from a click, "yours" when it came from the reader's stack. Shutdown vendors never appear in
// these rows (lib/processRankings.ts rankVendors filters offers) and the lens itself refuses to
// resolve to one (lib/processLens.ts) — so nothing shutdown is ever selectable here.
//
// Routes and ceilings never change: the lens adapts WHO executes a step, not what's possible.

// One ranked vendor, serialized server-side by ProcessDag's StepRankingRow from the same
// stepRanking/crossArenaStepRankings data the page always rendered — order preserved.
export interface StepRowVendor {
  productId: string
  arenaId: string
  arenaName: string
  name: string
  score: number
  hasLogo: boolean
  /** Cross-arena option — the chip carries a small tag naming where its judged evidence lives. */
  cross: boolean
  citesTotal: number
  citesFull: number
  citesPartial: number
}

// A curated market entry we don't rank (no judged verdicts) — stays visible as an honest
// unlinked chip after the ranked list, never selectable (no evidence to adapt anything to).
export interface StepRowUntracked {
  vendor: string
  label: string
  hasLogo: boolean
  signupUrl: string | null
}

const CHIP_BASE =
  'inline-flex min-w-0 items-center gap-1.5 rounded-md border py-0.5 pl-0.5 pr-2 transition'
const CHIP_DEFAULT = `${CHIP_BASE} border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:border-emerald-400/60 hover:text-emerald-300`
const CHIP_SELECTED = `${CHIP_BASE} border-emerald-400/70 bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/40 hover:text-emerald-100`
// Vendor unavailable in the reader's selected country (committed vendor-geo evidence,
// components/VendorGeoMark.tsx) — muted but still linked; the rank and score are untouched.
const CHIP_GEO_MUTED = `${CHIP_BASE} border-zinc-800 bg-zinc-900/40 text-zinc-500 opacity-70 hover:opacity-100 hover:text-zinc-300`

function SelectedTag({ source }: { source: LensSource }) {
  return (
    <span
      className="rounded bg-emerald-400/15 px-1 py-px text-[9px] font-semibold text-emerald-300"
      title={
        source === 'lens'
          ? 'You selected this vendor — the process is shown as run via it (clear it from the banner above or the ✕)'
          : 'From your "I\'m using" stack — the process is shown as run via your own pick'
      }
    >
      {source === 'lens' ? '✓ via' : 'yours'}
    </span>
  )
}

function VendorChipButton({
  vendor,
  rank,
  selected,
  alsoYours,
  geo,
  onSelect,
  onClear,
}: {
  vendor: StepRowVendor
  rank: number | null
  selected: LensSource | null
  /** An UNPINNED chip that is still one of the reader's stack picks (multi-vendor stacks) —
   *  wears a subtle "yours" tag so every vendor they run stays recognizable. */
  alsoYours: boolean
  /** Committed per-country availability (jurisdictions/vendor-geo.json) — absent for the many
   *  vendors the geo spike hasn't judged; the chip then never changes (no guess). */
  geo?: VendorGeoByCountry
  onSelect: () => void
  onClear: () => void
}) {
  // Muted only on committed "unavailable" evidence under a non-US selection; a lens/stack
  // selection keeps its emerald styling (the reader's explicit pick outranks the shade) while
  // the ✕ mark still names the availability problem.
  const geoHit = useVendorGeoCell(geo)
  const geoMuted = !selected && geoHit?.cell.status === 'unavailable'
  // The visible 'use'/'✕' side buttons are gone (founder 2026-10-05): the chip BODY is the
  // pick affordance now — a real toggle <button> (aria-pressed for an explicit lens pick,
  // the action named in its title/accessible name), clicking a lens-selected chip clears it.
  // The judged evidence stays one click away through the score link (the product page's
  // verdicts table) — founder 2026-10-05, item 7.
  const lensSelected = selected === 'lens'
  return (
    <span className={`${selected ? CHIP_SELECTED : geoMuted ? CHIP_GEO_MUTED : CHIP_DEFAULT} min-w-0`}>
      {/* No vendor-chip tooltip (founder 2026-10-05) — the aria-label keeps the action named
          for assistive tech; the score link beside it keeps its derivation tooltip. */}
      <button
        type="button"
        aria-pressed={lensSelected}
        onClick={lensSelected ? onClear : onSelect}
        aria-label={
          lensSelected
            ? `Stop viewing this process via ${vendor.name}`
            : `See this process via ${vendor.name}`
        }
        className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 transition hover:text-emerald-300"
      >
        <ProductLogoView product={{ id: vendor.productId, name: vendor.name }} size={28} hasLogo={vendor.hasLogo} />
        {selected && <SelectedTag source={selected} />}
        {!selected && alsoYours && (
          <span
            className="rounded bg-zinc-800 px-1 py-px text-[9px] font-semibold text-zinc-400"
            title={'Also one of your "I\'m using" picks — your best-scoring pick is pinned first'}
          >
            yours
          </span>
        )}
        <span className="truncate">{vendor.name}</span>
        {vendor.cross && (
          <span className="rounded bg-zinc-800 px-1 py-px text-[9px] uppercase tracking-wide text-zinc-500">
            {vendor.arenaName}
          </span>
        )}
      </button>
      <Link
        href={`/arena/${vendor.arenaId}/product/${vendor.productId}#story-verdicts`}
        title={scoreTitle(vendor, rank)}
        className="font-mono text-[10px] tabular-nums text-emerald-400/80 transition hover:text-emerald-300"
      >{vendor.score.toFixed(0)}<span className="text-zinc-500">/100</span></Link>
      <VendorGeoMark geo={geo} />
    </span>
  )
}

// The score tooltip says the concrete derivation for THIS number (founder 2026-10-05: never a
// canned sentence): the arena whose judged verdicts produced it, the step rank, and the real
// mapped-story counts — the click-through carries the deep dive.
export function scoreTitle(
  vendor: Pick<StepRowVendor, 'score' | 'arenaName' | 'citesTotal' | 'citesFull' | 'citesPartial'>,
  rank: number | null,
): string {
  const cites = vendor.citesTotal > 0
    ? `${vendor.citesTotal} judged ${vendor.arenaName} ${vendor.citesTotal === 1 ? 'story' : 'stories'} mapped to this step (${vendor.citesFull} full, ${vendor.citesPartial} partial)`
    : `the judged ${vendor.arenaName} stories mapped to this step`
  return `${vendor.score.toFixed(0)}/100${rank !== null ? ` · #${rank} for this step` : ''} — from ${cites}; click for the verdicts`
}

function UntrackedChip({ info }: { info: StepRowUntracked }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-0.5">
      {/* Unranked chip, no tooltip (founder 2026-10-05) — unlinked and scoreless already says
          "not yet judged"; the visible label is the whole content. */}
      <span
        className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 py-0.5 pl-0.5 pr-2 text-zinc-400"
      >
        <ProductLogoView product={{ id: info.vendor, name: info.label }} size={28} hasLogo={info.hasLogo} />
        <span className="truncate">{info.label}</span>
      </span>
      {info.signupUrl && (
        <a
          href={info.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${info.label}'s own start page — ${new URL(info.signupUrl).hostname.replace(/^www\./, '')} (external)`}
          className="shrink-0 rounded px-0.5 text-[10px] text-zinc-500 transition hover:text-emerald-300"
        >
          ↗
        </a>
      )}
    </span>
  )
}

export default function StepVendorRow({
  vendors,
  untracked,
  arenaLink,
  storyCount,
  lensKey,
  checkStep,
  vendorGeo,
}: {
  /** The ranked chips in serialized default order (primary market merged with cross-arena). */
  vendors: StepRowVendor[]
  untracked: StepRowUntracked[]
  /** The primary covering arena for the "full arena →" link — null for extras-only steps. */
  arenaLink: string | null
  storyCount: number
  /** Lens page key: taskId on /processes/[slug], chain id on /processes/chains/[chain]. */
  lensKey?: string
  /** The step's UNCAPPED serialized row (lib/processCheckData.ts) — lets a lens/stack pick
   *  resolve and pin even when it ranks below the display cap. Absent for extras-only steps,
   *  where resolution falls back to the displayed chips. */
  checkStep?: ProcessCheckStep
  /** Committed per-country availability by productId (lib/vendorGeo.ts vendorGeoLookup) —
   *  chips annotate under a non-US geo selection; vendors without rows never change. */
  vendorGeo?: Record<string, VendorGeoByCountry>
}) {
  const { lens, stack, setPick, resolveFor } = useProcessLens(lensKey)
  const hasExtras = vendors.some((v) => v.cross)

  // Resolve who executes this step: lens > stack > null (lib/processLens.ts). Extras-only
  // steps have no checkStep — match against the displayed chips with the same precedence,
  // taking the BEST-SCORING of the reader's picks (multi-vendor stacks, lib/myStack.ts v2).
  const resolved = checkStep
    ? resolveFor(checkStep)
    : (() => {
        const viaLens = vendors.find((v) => lens.picks[v.arenaId] === v.productId)
        if (viaLens) return { vendor: { ...viaLens, hasLogo: viaLens.hasLogo }, source: 'lens' as const }
        const viaStack = vendors
          .filter((v) => isPicked(stack, v.arenaId, v.productId))
          .sort((a, b) => b.score - a.score)[0]
        return viaStack ? { vendor: { ...viaStack, hasLogo: viaStack.hasLogo }, source: 'stack' as const } : null
      })()

  // Pin the resolved vendor FIRST. When it ranks below the display cap it isn't among the
  // serialized chips — synthesize one from the checkStep row (name/score/hasLogo are there; the
  // cites tooltip needs the expandable, which still names every vendor).
  const pinnedIndex = resolved
    ? vendors.findIndex((v) => v.productId === resolved.vendor.productId && v.arenaId === resolved.vendor.arenaId)
    : -1
  const pinned: StepRowVendor | null = resolved
    ? pinnedIndex >= 0
      ? vendors[pinnedIndex]
      : {
          productId: resolved.vendor.productId,
          arenaId: resolved.vendor.arenaId,
          arenaName: resolved.vendor.arenaName,
          name: resolved.vendor.name,
          score: resolved.vendor.score,
          hasLogo: resolved.vendor.hasLogo === true,
          cross: checkStep
            ? checkStep.arenas.find((a) => a.arenaId === resolved.vendor.arenaId)?.kind === 'extra'
            : false,
          citesTotal: 0,
          citesFull: 0,
          citesPartial: 0,
        }
    : null
  const rest = pinnedIndex >= 0 ? vendors.filter((_, i) => i !== pinnedIndex) : vendors
  const ordered: Array<{ vendor: StepRowVendor; rank: number | null; selected: LensSource | null; alsoYours: boolean }> = [
    ...(pinned ? [{ vendor: pinned, rank: pinnedIndex >= 0 ? pinnedIndex + 1 : null, selected: resolved!.source, alsoYours: false }] : []),
    // Unpinned chips the reader ALSO runs keep a subtle "yours" tag — the best-scoring pick
    // pins first, the rest of a multi-vendor stack stays visible as theirs.
    ...rest.map((v) => ({
      vendor: v,
      rank: vendors.indexOf(v) + 1,
      selected: null,
      alsoYours: isPicked(stack, v.arenaId, v.productId),
    })),
  ]

  // The honest coverage gap: a clicked vendor with NO judged evidence on this step's mapped
  // stories — named, with the step's best beside it, never silently swapped in.
  const gap = checkStep && resolved?.source !== 'lens' ? lensGapFor(checkStep, lens.picks) : null
  const gapName = gap ? lens.names[gap.productId] ?? gap.productId : null

  return (
    // No 'ranked for this step:' label (founder 2026-09-30): the step's vendors are ONE line,
    // highest score left→right — each chip's SCORE link keeps the concrete-derivation tooltip
    // (the vendor-name tooltips are gone, founder 2026-10-05). The row's flex-wrap only breaks
    // the line where the viewport forces it.
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]"
      title={`Vendors ranked for THIS step, highest score first — scored from their judged verdicts on the ${storyCount} stories mapped to it${
        hasExtras ? '; vendors from another arena carry a tag naming where their evidence lives' : ''
      } — not the arena's overall Overall score. Click a chip's "use" to see the whole process via that vendor.`}
    >
      {ordered.map((e) => (
        <VendorChipButton
          key={`${e.vendor.arenaId}:${e.vendor.productId}`}
          vendor={e.vendor}
          rank={e.rank}
          selected={e.selected}
          alsoYours={e.alsoYours}
          geo={vendorGeo?.[e.vendor.productId]}
          onSelect={() => setPick(e.vendor.arenaId, e.vendor.productId, e.vendor.name)}
          onClear={() => setPick(e.vendor.arenaId, null)}
        />
      ))}
      {untracked.map((o) => (
        <UntrackedChip key={o.vendor} info={o} />
      ))}
      {gap && checkStep && (
        <span
          className="text-amber-300/90"
          title={`Your selected vendor has no judged evidence on the ${checkStep.storyCount} stories mapped to this step — the step's best-scored vendor is shown instead of guessing`}
        >
          not covered by {gapName} — best here: {checkStep.best.name}{' '}
          <Link
            href={`/arena/${checkStep.best.arenaId}/product/${checkStep.best.productId}#story-verdicts`}
            title={`${checkStep.best.score.toFixed(0)}/100 — ${checkStep.best.name}'s judged verdicts on the ${checkStep.storyCount} ${checkStep.storyCount === 1 ? 'story' : 'stories'} mapped to this step; click for the verdicts`}
            className="underline decoration-amber-300/40 underline-offset-2 transition hover:text-amber-200"
          >{checkStep.best.score.toFixed(0)}/100</Link>
        </span>
      )}
      {arenaLink && (
        <Link
          href={`/arena/${arenaLink}`}
          title="See the whole judged market for this step's function"
          className="whitespace-nowrap text-[10px] text-zinc-500 transition hover:text-emerald-300"
        >
          full arena →
        </Link>
      )}
    </div>
  )
}
