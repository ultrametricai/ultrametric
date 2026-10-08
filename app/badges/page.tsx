import type { Metadata } from 'next'
import Link from 'next/link'
import CopyButton from '@/components/CopyButton'
import CopyPreview from '@/components/CopyPreview'
import { loadAll } from '@/lib/data'
import { SITE_URL, withBase } from '@/lib/site'

// Gallery + embed snippets for the static score badges rendered by scripts/generate-badges.mjs
// into public/badges/ (committed, regenerated after every re-judge — see README). One badge
// file per product id: a product ranked in two arenas (e.g. square) keeps its first arena's
// badge, mirroring the generator's first-category-wins rule.

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Score badges — Ultrametric',
  description:
    'Embeddable agent-ready and Overall score badges for every product Ultrametric ranks — hotlink the SVG and your badge always shows the live current score.',
}

const BADGE_KINDS = [
  { suffix: 'agent-ready', alt: 'Ultrametric agent-ready score' },
  { suffix: 'score', alt: 'Ultrametric Overall score' },
] as const

function snippets(productId: string, categoryId: string, suffix: string, alt: string) {
  const badgeUrl = `${SITE_URL}/badges/${productId}-${suffix}.svg`
  const productUrl = `${SITE_URL}/arena/${categoryId}/product/${productId}`
  return {
    markdown: `[![${alt}](${badgeUrl})](${productUrl})`,
    html: `<a href="${productUrl}"><img src="${badgeUrl}" alt="${alt}" /></a>`,
  }
}

export default function BadgesPage() {
  const categories = loadAll()
  // Same dedupe rule as the generator: first category (categories.json order) owns the id.
  const seen = new Set<string>()
  const arenas = categories.map((data) => ({
    categoryId: data.category.id,
    categoryName: data.category.name,
    products: data.products.filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    }),
  })).filter((a) => a.products.length > 0)
  const total = arenas.reduce((n, a) => n + a.products.length, 0)

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Badges</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Score badges</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Two embeddable SVG badges for each of the {total} products we rank: the agent-ready component and the
          blended Overall score. Drop one in a README or docs page and link it back to the product&apos;s evidence.
        </p>
        <div className="mt-4 max-w-2xl rounded-xl border border-emerald-400/40 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200/90">
          <span className="mr-2 rounded border border-emerald-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Hotlink, don&apos;t copy
          </span>
          Badges always show the live current score — they&apos;re regenerated from the rankings after every
          re-judge and update on redeploy. A copied file goes stale; the hotlinked URL never does.
        </div>
      </div>

      {arenas.map((arena) => (
        <section key={arena.categoryId}>
          <h2 className="font-display leading-[1.1] mb-4 text-xl font-semibold">
            <Link href={`/arena/${arena.categoryId}`} className="hover:text-emerald-300">
              {arena.categoryName}
            </Link>
          </h2>
          <div className="space-y-3">
            {arena.products.map((product) => (
              <div key={product.id} id={product.id} className="scroll-mt-4 rounded-xl border border-zinc-800 p-4">
                <Link
                  href={`/arena/${arena.categoryId}/product/${product.id}`}
                  className="text-sm font-semibold hover:text-emerald-300"
                >
                  {product.name}
                </Link>
                <div className="mt-3 space-y-2">
                  {BADGE_KINDS.map(({ suffix, alt }) => {
                    const s = snippets(product.id, arena.categoryId, suffix, alt)
                    return (
                      <div key={suffix}>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Committed static asset, plain <img>: basePath applied by hand (lib/site.ts). */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={withBase(`/badges/${product.id}-${suffix}.svg`)}
                            alt={alt}
                            className="h-5"
                          />
                          <span className="ml-auto flex gap-2">
                            <CopyButton text={s.markdown} label="Copy markdown" />
                            <CopyButton text={s.html} label="Copy HTML" />
                          </span>
                        </div>
                        {/* The exact embed code the buttons copy — collapsed so the gallery
                            stays scannable, but never invisible. */}
                        <div className="mt-1.5">
                          <CopyPreview summary="Show the embed code" text={`${s.markdown}\n\n${s.html}`} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
