import ExternalLinkMark from './shared-processes/ExternalLinkMark'
import type { StepCost } from '@/lib/processes'

// Depth wave part 1 (founder 2026-10-01): the per-step cited cost field, rendered minimally in
// the house zinc/emerald idiom — no layout rework. Server components, no state, render nothing
// when the node doesn't carry the field (the common case), so most step blocks are
// byte-identical to before.

// The '✓ verify:' line (StepVerifyLine) lived here 2026-10-01 → 2026-10-07 (founder removal;
// display only — verify stays corpus data under the processes/README.md "Verification checks"
// rules; no judged number ever read it).

// The '⚠ if it goes wrong' failure-modes block lived here 2026-10-02 → 2026-10-05 (founder
// removal; display only — failureModes stays corpus data under the processes/README.md
// curation rules; no judged number ever read it).

const COST_KIND_LABELS: Record<StepCost['kind'], string> = {
  'government-fee': 'government fee',
  'typical-vendor-price': 'vendor price',
  free: 'free',
}

// The visible chip text: '$109 government fee · as of 2026-10-01', 'free', or — for a real cost
// with no published number (usd null, the honest spelling of "attorney fees vary") — 'cost
// varies'. Exported for the chip itself and its unit test.
export function costChipText(cost: StepCost): string {
  if (cost.usd === null) return `cost varies · as of ${cost.asOf}`
  if (cost.kind === 'free') return `free · as of ${cost.asOf}`
  return `$${cost.usd.toLocaleString('en-US')} ${COST_KIND_LABELS[cost.kind]} · as of ${cost.asOf}`
}

// Muted suffix chip carrying the step's sourced cost. The chip links to the cited primary
// source (fee schedule / pricing page) and the tooltip carries the honesty contract: the asOf
// date is when the number was read — fees change, currentness is never claimed.
export function StepCostChip({ cost, squareExternalLinks = false, readable = false }: { cost: StepCost; squareExternalLinks?: boolean; readable?: boolean }) {
  const host = new URL(cost.source).hostname.replace(/^www\./, '')
  return (
    <a
      href={cost.source}
      target="_blank"
      rel="noopener noreferrer"
      title={`${COST_KIND_LABELS[cost.kind]} — read from ${host} on ${cost.asOf} (fees change; the as-of date is the contract, not a currentness claim).${cost.note ? ` ${cost.note}` : ''}`}
      className={`${readable ? "inline-block max-w-full whitespace-normal break-words text-sm" : "whitespace-nowrap text-[10px]"} rounded border border-zinc-800 px-1.5 py-0.5 text-zinc-500 transition hover:border-emerald-400/60 hover:text-emerald-300`}
    >
      {costChipText(cost)}{squareExternalLinks && <ExternalLinkMark href={cost.source} label="" />}
    </a>
  )
}
