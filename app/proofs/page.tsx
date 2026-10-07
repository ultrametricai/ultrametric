import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import ProofBlock from '@/components/ProofBlock'
import { groupInOrder, loadCategory, stripPersonaPrefix } from '@/lib/data'
import { collectSiteProofs, readProofTranscript, type ProofIndexEntry } from '@/lib/proofs'
import { REPO, withBase } from '@/lib/site'
import { ordinal } from '@/lib/ordinal'

// The proof theater: every replayable probe recording site-wide (see lib/proofs.ts), grouped
// by arena → product, each playable/readable inline. Static by construction — all recordings
// are read from data/*/proofs at build time, same as the per-product ProofsSection.

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Recorded proofs — Ultrametric',
  description:
    'Every replayable probe recording on Ultrametric — real commands run keyless on our machines, captured verbatim (terminal transcripts and browser videos), each tied to the user stories it substantiates.',
}

interface ProductGroup {
  categoryId: string
  categoryName: string
  productId: string
  productName: string
  storyTitles: Record<string, string>
  proofs: ProofIndexEntry[]
}

interface ArenaGroup {
  categoryId: string
  categoryName: string
  products: ProductGroup[]
}

function collectGroups(): ArenaGroup[] {
  return collectSiteProofs().map(({ categoryId, proofs }) => {
    const data = loadCategory(categoryId)
    const storyTitles = Object.fromEntries(data.stories.map((s) => [s.id, stripPersonaPrefix(s.title)]))
    const productName = (pid: string) => data.products.find((p) => p.id === pid)?.name ?? pid
    const products = groupInOrder(proofs, (p) => p.productId).map(([productId, productProofs]) => ({
      categoryId,
      categoryName: data.category.name,
      productId,
      productName: productName(productId),
      storyTitles,
      proofs: productProofs,
    }))
    return { categoryId, categoryName: data.category.name, products }
  })
}

export default function ProofsPage() {
  const arenas = collectGroups()
  const allProducts = arenas.flatMap((a) => a.products)
  const totalProofs = allProducts.reduce((sum, p) => sum + p.proofs.length, 0)
  const passed = allProducts.reduce((sum, p) => sum + p.proofs.filter((e) => e.exitCode === 0).length, 0)
  // "Most-proven" mini-leaderboard: products by recording count, ties broken alphabetically.
  const mostProven = [...allProducts]
    .sort((a, b) => b.proofs.length - a.proofs.length || a.productName.localeCompare(b.productName))
    .slice(0, 5)

  return (
    <div className="space-y-10">
      <div>
        {/* seed "proofs": same concept mark as the Explore menu entry and every product page's
            Probe proofs section. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="proofs" title="Recorded proofs — replayable probe recordings" size={16} className="text-zinc-500" />
          Proof theater
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Recorded proofs</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Every replayable recording from our probe harness, site-wide. Each command ran for real on our machines,
          keyless, with the session captured verbatim (secrets are redacted before publication). See the{' '}
          <a
            href={`https://github.com/${REPO}/blob/main/docs/PROVE-IT.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 underline decoration-emerald-300/40 hover:decoration-emerald-300"
          >
            Prove-It protocol
          </a>{' '}
          to submit one.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">Recorded proofs</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-300">{totalProofs}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {passed} reproduced · {totalProofs - passed} failed
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">Products covered</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-300">{allProducts.length}</p>
          <p className="mt-1 text-xs text-zinc-500">across {arenas.length} rankings</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">Most proven</p>
          <ol className="mt-1 space-y-0.5 text-xs">
            {mostProven.map((p, i) => (
              <li key={p.productId} className="flex items-baseline gap-2">
                <span className="w-7 shrink-0 font-mono text-zinc-500">{ordinal(i + 1)}</span>
                <Link
                  href={`/arena/${p.categoryId}/product/${p.productId}`}
                  className="truncate text-zinc-300 hover:text-emerald-300"
                >
                  {p.productName}
                </Link>
                <span className="ml-auto shrink-0 tabular-nums text-emerald-400">×{p.proofs.length}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {arenas.map((arena) => (
        <section key={arena.categoryId}>
          <h2 className="font-display leading-[1.1] mb-1 text-xl font-semibold">
            <Link href={`/arena/${arena.categoryId}`} className="hover:text-emerald-300">
              {arena.categoryName}
            </Link>
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            {arena.products.reduce((n, p) => n + p.proofs.length, 0)} recordings ·{' '}
            {arena.products.length} products
          </p>
          <div className="space-y-6">
            {arena.products.map((group) => (
              <div key={group.productId}>
                <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  <Link
                    href={`/arena/${group.categoryId}/product/${group.productId}`}
                    className="hover:text-emerald-300"
                  >
                    {group.productName}
                  </Link>
                  <span className="text-xs font-normal text-zinc-500">
                    {group.proofs.length} {group.proofs.length === 1 ? 'recording' : 'recordings'}
                  </span>
                </h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.proofs.map((entry) => (
                    <ProofBlock
                      key={`${entry.productId}-${entry.probeId}`}
                      entry={entry}
                      transcript={readProofTranscript(group.categoryId, entry)}
                      videoSrc={
                        entry.kind === 'video'
                          ? withBase(`/data/${group.categoryId}/proofs/${entry.file}`)
                          : undefined
                      }
                      storyTitles={group.storyTitles}
                      storyHrefBase={withBase(`/arena/${group.categoryId}/product/${group.productId}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
