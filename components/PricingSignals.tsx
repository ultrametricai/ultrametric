import {
  formatFactAmount,
  isPricingUnavailable,
  type PricingFact,
  type ProductPricing,
} from '@/lib/pricing'

// Compact "Pricing signals" block for product pages in pricing-covered arenas (see
// lib/pricing.ts's PRICING_ARENAS). Every figure is rendered exactly as extracted from the
// vendor's pricing page — amount + unit + tier + source link, with the verbatim excerpt in the
// title tooltip and the fetch date — and a product whose page couldn't be read honestly says
// "pricing unclear" instead of guessing. Call sites render nothing when the product has no
// pricing entry at all (arena covered but stage not run for it), per the lib/pricing.ts
// absence-is-absence contract.

const TIER_LABEL: Record<PricingFact['tier'], string> = {
  'free': 'free tier',
  'usage': 'pay-as-you-go',
  'entry-paid': 'entry plan',
}

export default function PricingSignals({ entry }: { entry?: ProductPricing }) {
  if (!entry) return null

  if (isPricingUnavailable(entry)) {
    return (
      <div>
        <h2 className="font-display leading-[1.1] mb-3 text-lg font-semibold">Pricing signals</h2>
        <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
          <span className="mr-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            pricing unclear
          </span>
          {entry.reason}
          {entry.sourceUrl && (
            <>
              {' '}
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the vendor pricing page we checked"
                className="text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-300"
              >
                page checked ↗
              </a>
            </>
          )}
          <p className="mt-2 text-xs text-zinc-500">Checked {entry.fetchedAt.slice(0, 10)}. We never estimate a price we didn&rsquo;t extract.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-display leading-[1.1] mb-3 text-lg font-semibold">Pricing signals</h2>
      <div className="rounded-xl border border-zinc-800 p-4">
        <ul className="space-y-2">
          {entry.facts.map((fact, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span
                className="font-mono font-semibold tabular-nums text-emerald-300"
                title={`Verbatim from the pricing page: “${fact.excerpt}”`}
              >
                {formatFactAmount(fact)}
              </span>
              <span className="text-zinc-400">{fact.unit}</span>
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-800">
                {TIER_LABEL[fact.tier]}
              </span>
              {fact.notes && <span className="text-xs text-zinc-400">{fact.notes}</span>}
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Verbatim from the pricing page: “${fact.excerpt}”`}
                className="text-xs text-zinc-500 underline decoration-zinc-800 underline-offset-2 hover:text-emerald-300"
              >
                source ↗
              </a>
              <span className="text-[10px] text-zinc-500">as of {fact.fetchedAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
        {/* One line — the never-derived guarantee rides the tooltip. */}
        <p
          className="mt-3 text-xs text-zinc-500"
          title="We never convert, average, or derive a price the page didn't print."
        >
          Extracted verbatim from the vendor&rsquo;s own pricing page — hover a figure for the
          exact quote.
        </p>
      </div>
    </div>
  )
}
