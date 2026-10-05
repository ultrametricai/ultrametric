import ExternalLinkMark from './shared-processes/ExternalLinkMark'
import type { StepCost, StepVerify } from '@/lib/processes'

// Depth wave part 1 (founder 2026-10-01): the two per-step cited fields, rendered minimally in
// the house zinc/emerald idiom — no layout rework. Server components, no state, render nothing
// when the node doesn't carry the field (the common case), so most step blocks are
// byte-identical to before.

// "✓ verify:" — the step's concrete "how do I know it worked?" check, plain text plus the
// primary-source link of the checking tool where one exists (every URL curl-verified live
// before it shipped; the honesty rules live in processes/README.md "Verification checks").
export function StepVerifyLine({ verify, squareExternalLinks = false }: { verify: StepVerify; squareExternalLinks?: boolean }) {
  return (
    <p className="mt-2 text-[11px] text-zinc-400">
      <span className="text-emerald-300/90">✓ verify:</span> {verify.how}
      {verify.url && (
        <>
          {' '}
          <a
            href={verify.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Check it at ${new URL(verify.url).hostname.replace(/^www\./, '')} (external site)`}
            className="whitespace-nowrap text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
          >
            {new URL(verify.url).hostname.replace(/^www\./, '')}{squareExternalLinks ? <ExternalLinkMark href={verify.url} label="" /> : ' ↗'}
          </a>
        </>
      )}
    </p>
  )
}

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
export function StepCostChip({ cost, squareExternalLinks = false }: { cost: StepCost; squareExternalLinks?: boolean }) {
  const host = new URL(cost.source).hostname.replace(/^www\./, '')
  return (
    <a
      href={cost.source}
      target="_blank"
      rel="noopener noreferrer"
      title={`${COST_KIND_LABELS[cost.kind]} — read from ${host} on ${cost.asOf} (fees change; the as-of date is the contract, not a currentness claim).${cost.note ? ` ${cost.note}` : ''}`}
      className="whitespace-nowrap rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 transition hover:border-emerald-400/60 hover:text-emerald-300"
    >
      {costChipText(cost)}{squareExternalLinks && <ExternalLinkMark href={cost.source} label="" />}
    </a>
  )
}
