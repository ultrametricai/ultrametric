import ExternalLinkMark from './shared-processes/ExternalLinkMark'
import type { StepCost, StepFailureMode, StepVerify } from '@/lib/processes'

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

// "⚠ if it goes wrong" (founder spike 2026-10-02, form_001 reference depth) — the step's
// curated failure modes, collapsed by default in the house <details> idiom (same summary
// pattern as the "N API calls" block in components/ProcessDag.tsx). Server component, no
// state; renders nothing when the node carries no entries (the overwhelmingly common case),
// so most step blocks stay byte-identical. Curation rules in processes/README.md "Failure
// modes": sourced or structurally certain only, 3–6 quality entries per deep process.
export function StepFailureModes({ failureModes, squareExternalLinks = false }: { failureModes: StepFailureMode[]; squareExternalLinks?: boolean }) {
  return (
    <details className="group mt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">▶</span>
        <span className="text-amber-300/90">⚠ if it goes wrong</span>
        {failureModes.length > 1 && ` — ${failureModes.length} known failure modes`}
      </summary>
      <ul className="mt-1.5 space-y-1.5 border-l border-zinc-800 pl-3 text-[11px] text-zinc-400">
        {failureModes.map((fm) => (
          <li key={fm.what}>
            <span className="text-zinc-200">{fm.what}</span> {fm.then}
            {fm.source && (
              <>
                {' '}
                <a
                  href={fm.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Primary source: ${new URL(fm.source).hostname.replace(/^www\./, '')} (external site)`}
                  className="whitespace-nowrap text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
                >
                  {new URL(fm.source).hostname.replace(/^www\./, '')}{squareExternalLinks ? <ExternalLinkMark href={fm.source} label="" /> : ' ↗'}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

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
