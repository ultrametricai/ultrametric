'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { lensProcessSummary, useLensUrlSync, useProcessLens } from '@/lib/processLens'
import { loginUrl, useSession } from '@/lib/session'
import { SITE_URL } from '@/lib/site'
import type { ProcessCheckStep } from '@/lib/processCheck'

// Process-level lens banner above the DAG (founder 2026-09-21): when any lens click or
// "I'm using" stack pick resolves on this page, say WHO the process is being viewed via and how
// much of it those vendors actually serve — computed client-side from the same pre-serialized
// step rows the step blocks use (lib/processCheckData.ts), with processLeaderboard's exact
// normalization via lib/processLens.ts's lensProcessSummary (sum of resolved step scores over
// ALL rankable steps, unserved = 0). Never recomputed from raw data, never a new number.
//
// Static-HTML contract: the server snapshot (empty lens + '{}' stack) renders NOTHING — the
// shared SEO page is unchanged; the banner hydrates in only for readers with a click or a stack.
export default function ProcessLensBanner({
  steps,
  pageKey,
}: {
  /** Every rankable step of the page — all sections concatenated on chain pages. */
  steps: ProcessCheckStep[]
  /** Lens page key: taskId on /processes/[slug], the chain id on /processes/chains/[chain]. */
  pageKey: string
}) {
  // Shareable lens URLs (?via=<arenaId>:<productId>, lib/processLens.ts): this banner is the
  // one component every lens page mounts exactly once with the canonical pageKey, so it owns
  // the URL ⇄ lens sync — a shared link opens in the sender's exact "via vendor" view, and any
  // pick/clear anywhere on the page (step rows, this banner's clear) updates ?via.
  useLensUrlSync(pageKey)
  const session = useSession()
  const { lens, stack, clearLens } = useProcessLens(pageKey)
  const summary = useMemo(() => lensProcessSummary(steps, lens.picks, stack), [steps, lens, stack])
  const lensPickCount = Object.keys(lens.picks).length
  if (summary.served === 0 && lensPickCount === 0) return null

  // Vendors named in resolution order; a clicked vendor covering zero steps still gets named
  // from the stored click-time names, so the banner never claims a silent no-op.
  const resolvedIds = new Set(summary.vendors.map((v) => v.productId))
  const unservedClicked = Object.values(lens.picks)
    .filter((id) => !resolvedIds.has(id))
    .map((id) => lens.names[id] ?? id)
  const names = [...summary.vendors.map((v) => v.name), ...new Set(unservedClicked)]

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-emerald-400/40 bg-emerald-400/[0.07] px-3.5 py-2 text-[13px]">
      <span className="text-zinc-100">
        Viewing via <span className="font-medium">{names.join(', ')}</span>:{' '}
        <span
          title={`Steps a selected/stack vendor has judged evidence on, of the page's ${summary.rankable} rankable steps — process score sums step scores over all of them (unserved count 0), normalized 0–100`}
        >
          serves <span className="tabular-nums text-emerald-300">{summary.served}</span> of{' '}
          <span className="tabular-nums">{summary.rankable}</span> rankable steps · process score{' '}
          <span className="tabular-nums text-emerald-300">{summary.score.toFixed(0)}</span>
          <span className="text-zinc-500">/100</span>
        </span>
      </span>
      {lensPickCount > 0 && (
        <>
          <button
            type="button"
            onClick={clearLens}
            title="Clear the vendors you clicked on this page (stored in this browser only) — back to the default best-per-step view"
            className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
          >
            clear
          </button>
          {/* Founder 2026-09-25: anonymous readers go STRAIGHT to signup (MineLink precedent),
              deep-linked back to /account/vendors to record the stack after auth. */}
          {session.state === 'authenticated' ? (
            <Link
              href="/account/vendors"
              className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
            >
              save these as your stack →
            </Link>
          ) : (
            <a
              href={loginUrl(`${SITE_URL}/account/vendors`)}
              title="Sign up or log in to record these vendors as your stack"
              className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
            >
              save these as your stack →
            </a>
          )}
        </>
      )}
    </div>
  )
}
