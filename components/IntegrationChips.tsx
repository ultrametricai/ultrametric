import Link from 'next/link'
import ProductLogoView from '@/components/ProductLogoView'

// One chip = one verified integration neighbor: links to the neighbor's product page, and the
// title carries the verbatim evidence excerpt the edge rests on (plus which side's evidence said
// it). Server component, pure over serializable props — callers assemble ChipData from
// lib/integrations.ts's graph + productRefIndex, resolving hasLogo server-side (lib/logos.ts).
export interface IntegrationChipData {
  productId: string
  name: string
  arenaId: string
  arenaName: string
  // Tooltip: the verbatim excerpt(s) + provenance ("from <product>'s evidence").
  title: string
  hasLogo: boolean
}

// Tooltip text for one neighbor relation: every evidence-backed mention behind the edge, quoted
// verbatim with its provenance side.
export function chipTitle(
  sources: Array<{ fromProductId: string; excerpt: string }>,
  nameOf: (id: string) => string,
): string {
  return sources
    .map((s) => `“${s.excerpt}” — from ${nameOf(s.fromProductId)}'s evidence`)
    .join('\n')
}

// One chip on its own — /integrations' adjacency list composes these directly.
export function IntegrationChip({ chip }: { chip: IntegrationChipData }) {
  return (
    <Link
      href={`/arena/${chip.arenaId}/product/${chip.productId}`}
      title={chip.title}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
    >
      <ProductLogoView product={{ id: chip.productId, name: chip.name }} size={16} hasLogo={chip.hasLogo} />
      <span className="font-medium">{chip.name}</span>
      {/* min-w-0 + truncate: the arena tag gives way first on narrow screens, so one long chip
          can never widen the page past the viewport. */}
      <span className="min-w-0 truncate text-[10px] uppercase tracking-wide text-zinc-500">{chip.arenaName}</span>
    </Link>
  )
}

export default function IntegrationChips({ chips }: { chips: IntegrationChipData[] }) {
  // Honest empty state instead of vanishing — "we found none" is information, not absence
  // (same house rule as the tables' "untested, not zero" cells).
  if (chips.length === 0) {
    return (
      <div>
        <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold">Verified integrations</h2>
        <p className="text-xs text-zinc-500">
          No integration evidence found in our corpus for this product yet — that means none was
          found, never that it doesn&rsquo;t integrate.
        </p>
      </div>
    )
  }
  return (
    <div>
      {/* One line — the "missing ≠ doesn't integrate" caveat rides the heading's tooltip. */}
      <h2
        className="font-display leading-[1.1] mb-1 text-lg font-semibold"
        title="A product missing here means no evidence of an integration was found in our corpus — never that it doesn't integrate."
      >
        Verified integrations
      </h2>
      {/* Founder 2026-10-05: table form (house idiom — rounded-2xl border wrapper, text-xs
          sentence-case headers) instead of the pill chips; content unchanged. Columns carry
          exactly what the chips carried: the integration (logo + name, linking to its product
          page), its arena, and the evidence affordance (the verbatim excerpt(s) the edge rests
          on, full text in the tooltip). The arena column yields below sm so the table renders
          sanely on phones. /integrations still composes IntegrationChip directly. */}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-400">
              <th scope="col" className="px-3 py-2 font-normal">Integration</th>
              <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">Ranking</th>
              <th scope="col" className="px-3 py-2 font-normal">
                <span title="The verbatim evidence excerpt(s) this edge rests on, with which side's evidence said it — hover a row's excerpt for the full quote.">Evidence</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {chips.map((chip) => (
              <tr key={chip.productId} className="transition hover:bg-zinc-800/70">
                <td className="px-3 py-2">
                  <Link
                    href={`/arena/${chip.arenaId}/product/${chip.productId}`}
                    className="flex min-w-0 items-center gap-2 font-medium text-zinc-300 hover:text-emerald-300"
                  >
                    <ProductLogoView product={{ id: chip.productId, name: chip.name }} size={18} hasLogo={chip.hasLogo} />
                    <span className="truncate">{chip.name}</span>
                  </Link>
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-zinc-500">{chip.arenaName}</span>
                </td>
                <td className="max-w-[260px] px-3 py-2 sm:max-w-[420px]">
                  <span title={chip.title} className="block truncate text-xs text-zinc-400">
                    {chip.title.split('\n')[0]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
