import type { ReactNode } from 'react'
import Link from 'next/link'
import ProcessYourVendor from '@/components/ProcessYourVendor'
import ProductLogoView from '@/components/ProductLogoView'
import RankOrdinal from '@/components/RankOrdinal'
import VendorGeoMark, { VendorGeoShade } from '@/components/VendorGeoMark'
import { hasLogo } from '@/lib/logos'
import type { ProcessTask } from '@/lib/processes'
import { processLeaderboard } from '@/lib/processRankings'
import { vendorGeoLookup } from '@/lib/vendorGeo'

// "Who covers this process best" — the process-level, story-derived ranking (founder ask:
// don't assume the user has a vendor; look at what stories the vendors support for the process
// and its steps). Server component, static: everything derives from the committed step→story
// mapping (data/process-step-stories.json) × the judged verdicts, via lib/processRankings.ts.
//
// Two views of the same numbers:
//   - the single-vendor leaderboard: processScore = sum of a vendor's step scores over the
//     process's rankable steps (steps it can't serve count 0), normalized 0–100 — literally
//     coverage × step quality;
//   - the best-vendor-per-step chain: the top-ranked vendor of each rankable step.
// Rows are plain (founder 2026-10-02 — no expander, no per-row step receipts); the full verdict
// citations behind every step score live in the step blocks of the diagram below.

// How many leaderboard rows to show — same legibility cap as the per-step chip roster.
const LEADERBOARD_CAP = 8

export default function ProcessLeaderboard({ task, mineHref, scopeNote }: {
  task: ProcessTask
  mineHref?: string
  scopeNote?: ReactNode
}) {
  const lb = processLeaderboard(task)
  if (lb.entries.length === 0 || lb.rankableSteps === 0) return null
  const entries = lb.entries.slice(0, LEADERBOARD_CAP)
  // Committed (vendor, country) availability for the displayed rows (jurisdictions/
  // vendor-geo.json) — under a non-US geo selection each row annotates client-side
  // (components/VendorGeoMark.tsx): ✓/◐, or a muted row + the honest "US entities only"-style
  // note when the evidence says unavailable. Rows without evidence never change, and the
  // RANKING never moves — annotation only.
  const geoLookup = vendorGeoLookup(entries.map((e) => e.productId))

  return (
    <section>
      <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
        Who covers this process best
      </h2>
      {scopeNote}
      {/* The 'No vendor assumed — …' explainer paragraph is gone (founder 2026-09-30): the
          heading stands alone; the scoring story lives in the row tooltips and /methodology. */}

      {/* The compact DAG dot strip is gone (founder 2026-10-02) — the full diagram below IS the
          process at a glance; one diagram per page. */}

      {/* Client-side "you run X" banner (founder 2026-09-21): hydrates in only for readers whose
          "I'm using" stack matches a covering arena — built from the FULL entry list so the
          reader's pick is found wherever it ranks; the static HTML is unchanged. */}
      {mineHref && (
        <ProcessYourVendor
          entries={lb.entries.map((e, i) => ({
            productId: e.productId,
            name: e.name,
            arenaId: e.arenaId,
            hasLogo: hasLogo(e.productId),
            rank: i + 1,
            processScore: e.processScore,
            stepsServed: e.stepsServed,
          }))}
          rankableSteps={lb.rankableSteps}
          mineHref={mineHref}
        />
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800">
        {entries.map((e, i) => (
          // The shade div (client) owns the sibling-positional row styles so it can mute the
          // whole row on committed "unavailable" evidence — the rank number never changes.
          <VendorGeoShade
            key={`${e.arenaId}-${e.productId}`}
            geo={geoLookup[e.productId]}
            className="border-b border-zinc-800/70 last:border-b-0"
          >
          {/* Plain rows (founder 2026-10-02): the expander and the '2/2 steps · avg 7' receipts
              are gone — vendor, score, and the links carry the row; the per-step citations live
              in the step blocks of the diagram below. */}
          <div className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-zinc-900/60">
            <RankOrdinal rank={i + 1} />
            <span className="flex min-w-0 grow items-center gap-2">
              <ProductLogoView product={{ id: e.productId, name: e.name }} size={18} hasLogo={hasLogo(e.productId)} />
              <Link
                href={`/arena/${e.arenaId}/product/${e.productId}`}
                className="truncate text-sm font-medium text-zinc-100 transition hover:text-emerald-300"
              >
                {e.name}
              </Link>
              <Link
                href={`/arena/${e.arenaId}`}
                className="hidden truncate text-sm text-zinc-500 transition hover:text-emerald-300 sm:inline"
              >
                {e.arenaName}
              </Link>
              {/* ✓/◐/✕ + the vendor's own note under a non-US selection — nothing otherwise. */}
              <VendorGeoMark geo={geoLookup[e.productId]} />
            </span>
            {/* The score clicks through to its evidence (founder 2026-10-05: every visible
                score answers 'why?' in one click) — the product page's judged story verdicts,
                the receipts every step score here derives from — and the tooltip states THIS
                number's derivation with the row's real counts (founder, same day). */}
            <Link
              href={`/arena/${e.arenaId}/product/${e.productId}#story-verdicts`}
              className="w-16 shrink-0 text-right font-mono text-sm tabular-nums text-emerald-400 transition hover:text-emerald-300"
              title={`${e.processScore.toFixed(0)}/100 — ${e.name}'s judged ${e.arenaName} step scores summed over ${lb.rankableSteps} rankable ${lb.rankableSteps === 1 ? 'step' : 'steps'} (${e.stepsServed} served, unserved count 0); click for the verdicts`}
            >
              {e.processScore.toFixed(0)}
              <span className="text-zinc-500">/100</span>
            </Link>
          </div>
          </VendorGeoShade>
        ))}
      </div>

      {/* The 'best per step:' strip removed (founder 2026-10-02) — the per-step vendor rows
          below carry the same answer readably. */}
    </section>
  )
}
