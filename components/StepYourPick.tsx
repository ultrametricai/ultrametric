'use client'

import MineLink from '@/components/MineLink'
import { useMyStackMap } from '@/components/useMyStackMap'
import { STEP_UPGRADE_DELTA, yoursForStep, type ProcessCheckStep } from '@/lib/processCheck'

// Per-step "your stack trails the best here" nudge on the PUBLIC process page (founder
// 2026-09-21: "if a user selects the vendor they have, the processes change based on the vendor
// they have"). Client-only over the same pre-serialized rows as "Check my process"
// (lib/processCheckData.ts) — the server snapshot of the stack is '{}', so the static SEO HTML
// is byte-identical for readers without a stack. Scores are the same story-derived
// stepVendorScore the page already publishes — resolved, never recomputed.
//
// The "✓ yours: …" chip this line used to carry now lives in the ranking row itself
// (components/StepVendorRow.tsx pins the reader's pick first, tagged "yours"), so this renders
// ONLY the honest upgrade nudge — a stack pick materially behind the step's best.
export default function StepYourPick({ step, mineHref }: { step: ProcessCheckStep; mineHref: string }) {
  const stack = useMyStackMap()
  const yours = yoursForStep(step, stack)
  if (!yours) return null
  const delta = Math.round((step.best.score - yours.score) * 10) / 10
  const behind = yours.productId !== step.best.productId && delta > STEP_UPGRADE_DELTA
  if (!behind) return null
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
      <MineLink
        mineHref={mineHref}
        title={`Your ${yours.arenaName} pick ${yours.name} is judged ${yours.score.toFixed(0)}/100 on the ${step.storyCount} stories mapped to this step; ${step.best.name} scores ${step.best.score.toFixed(0)}/100 — ${delta.toFixed(0)} points ahead`}
        className="text-amber-300/90 underline decoration-amber-400/40 underline-offset-2 transition hover:text-amber-200"
      >
        your {yours.name} trails here — best: {step.best.name} {step.best.score.toFixed(0)} (+{delta.toFixed(0)}) — check my process →
      </MineLink>
    </p>
  )
}
