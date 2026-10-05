import Link from 'next/link'
import ImUsing from '@/components/ImUsing'
import { productDocEntries } from '@/components/ProductLinkChips'
import WatchButton from '@/components/WatchButton'
import { ACCESS_COLUMNS, accessGlyphFor, bestAccessVerdict } from '@/lib/accessGlyphs'
import type { CategoryData } from '@/lib/data-helpers'
import type { Product } from '@/lib/schemas'

// Mobile quick-access table for the product-page header (founder 2026-10-05, preview): below sm
// the header's affordance cluster — watch (☆), "I'm using this", the Try-it CTA, the MCP/CLI/API
// access glyphs, and the vendor doc links — wrapped badly ("jacked"), so it renders here as one
// compact label | value table instead; ≥sm keeps the existing chips exactly as before (this
// whole table is sm:hidden, the chip cluster is hidden below sm — pure CSS breakpoints, so the
// swap is SSR-stable with no layout shift). One row per affordance, watch first. Content is the
// same data the chips carry: WatchButton/ImUsing are the same client components (their stores
// keep every instance on the page in sync), glyphs come from lib/accessGlyphs.ts (each a linked
// citation into the story's evidence), and doc links from productDocEntries — the Docs menu's
// own source.
export default function ProductHeaderMobileFacts({
  data,
  product,
  tryable,
}: {
  data: CategoryData
  product: Product
  tryable: boolean
}) {
  const docByLabel = new Map(productDocEntries(product).map((e) => [e.label, e.href]))
  const host = new URL(product.urls.site).hostname.replace(/^www\./, '')
  const labelCell = 'w-16 px-3 py-2 text-left align-middle text-[10px] font-normal uppercase tracking-widest text-zinc-500'
  const valueCell = 'px-3 py-2 align-middle'
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800 sm:hidden">
      <table aria-label="Quick access" className="w-full border-collapse text-sm">
        <tbody className="divide-y divide-zinc-800/70">
          <tr>
            <th scope="row" className={labelCell}>Watch</th>
            <td className={valueCell}>
              <WatchButton productId={product.id} productName={product.name} size="sm" />
            </td>
          </tr>
          <tr>
            <th scope="row" className={labelCell}>Using</th>
            <td className={valueCell}>
              <ImUsing arenaId={data.category.id} productId={product.id} productName={product.name} />
            </td>
          </tr>
          <tr>
            <th scope="row" className={labelCell}>Try it</th>
            <td className={valueCell}>
              {tryable ? (
                <a href="#try-it" className="text-sm font-semibold text-emerald-300">
                  Test it in sandbox →
                </a>
              ) : (
                <a
                  href={product.urls.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-emerald-300 underline decoration-emerald-400/40 underline-offset-2"
                >
                  {host} ↗
                </a>
              )}
            </td>
          </tr>
          {ACCESS_COLUMNS.map(({ label, storyIds }) => {
            const glyph = accessGlyphFor(label, bestAccessVerdict(data, product.id, storyIds))
            const docsHref = docByLabel.get(`${label} docs`)
            return (
              <tr key={label}>
                <th scope="row" className={labelCell}>{label}</th>
                <td className={valueCell}>
                  <span className="flex items-center gap-4">
                    <Link
                      href={`/arena/${data.category.id}/product/${product.id}#story-${glyph.storyId}`}
                      title={glyph.title}
                      className={`font-mono ${glyph.className}`}
                    >
                      {glyph.char}
                    </Link>
                    {docsHref && (
                      <a
                        href={docsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-400 transition hover:text-emerald-300"
                      >
                        {label} docs ↗
                      </a>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
