import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DiffusionCurve, { formatMonth } from '@/components/DiffusionCurve'
import PersonaChip from '@/components/PersonaChip'
import ProductLogoView from '@/components/ProductLogoView'
import VerdictBadge from '@/components/VerdictBadge'
import { loadAll, stripPersonaPrefix } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { adoptionNow, diffusionCurve, firstTrackedLookup } from '@/lib/diffusion'
import { collectGlobalStories, findGlobalStory } from '@/lib/globalStories'
import { parseStoryPersona } from '@/lib/storyText'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Cross-arena comparison page for one global story (scope: 'global', present in ≥2 arenas —
// see lib/globalStories.ts): every ranked product's verdict on the same capability, across
// every arena that carries it. This is the "2FA across all software" view — the canonical lens
// stories (official CLI, MCP server, webhooks, self-hosting…) span all arenas; a non-canonical
// id qualifies once two arenas author it independently. Fully static: params come from the
// bundled data, and unknown ids 404 (dynamicParams = false).

export function generateStaticParams() {
  return collectGlobalStories(loadAll()).map((s) => ({ story: s.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ story: string }>
}): Promise<Metadata> {
  const { story } = await params
  const entry = findGlobalStory(loadAll(), story)
  return {
    title: `${entry ? stripPersonaPrefix(entry.title) : story} — across all software — Ultrametric`,
    description: entry
      ? `Every product's evidence-backed verdict on "${stripPersonaPrefix(entry.title)}" across ${entry.arenaCount} arenas.`
      : undefined,
  }
}

export default async function GlobalStoryPage({
  params,
}: {
  params: Promise<{ story: string }>
}) {
  const { story } = await params
  const categories = loadAll()
  const entry = findGlobalStory(categories, story)
  if (!entry) notFound()
  const supported = entry.cells.filter((c) => c.verdict === 'full' || c.verdict === 'partial').length
  // Capability diffusion (lib/diffusion.ts): headline adoption now + the % adoption vs month
  // curve, built on the honest approximation documented there (adoption among products as they
  // enter tracking, not per-cell verdict history).
  const adoption = adoptionNow(entry.cells)
  const curve = diffusionCurve(entry.cells, firstTrackedLookup())
  // Header leads with the action; the "As a {persona}," frame becomes a chip in the eyebrow
  // line (lib/storyText.ts) — same de-framing every story list on the site now applies.
  const parsed = parseStoryPersona(entry.title)
  const shortTitle = parsed.action

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          Global story
          <PersonaChip persona={parsed.persona} className="normal-case tracking-normal" />
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          {shortTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          A global story is meaningful for any software product, so it can be compared across the
          whole site — every product&rsquo;s verdict on{' '}
          <span className="font-mono text-sm text-zinc-300">{entry.id}</span> across all{' '}
          {entry.arenaCount} arenas that carry it, judged from public evidence.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {supported}/{entry.cells.length} products pass (full or partial) · click a verdict for
          the product&rsquo;s rationale and evidence
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-800 p-4">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Adoption among tracked products</p>
        <p
          className="mt-1 text-3xl font-bold tabular-nums text-emerald-400"
          title="Share of tracked products carrying this story that pass it with a full or partial verdict"
        >
          {Number.isInteger(adoption.pct) ? adoption.pct : adoption.pct.toFixed(1)}%
        </p>
        <p className="text-xs text-zinc-500">
          {shortTitle}: {adoption.adopters} of {adoption.total} tracked products pass (full or
          partial), across {entry.arenaCount} arenas.
        </p>
        {curve.length >= 2 ? (
          <DiffusionCurve points={curve} label={`Adoption of ${shortTitle} among tracked products, by month`} />
        ) : (
          curve.length === 1 && (
            <p className="mt-3 text-xs text-zinc-500">
              Tracking since {formatMonth(curve[0].month)} — the diffusion curve appears once a
              second month of tracking accrues.
            </p>
          )
        )}
        {/* The approximation caveat matters but is reference material — collapsed by default. */}
        <details className="mt-3 max-w-2xl text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400 transition hover:text-emerald-300">
            Honest approximation: what this curve can and can&rsquo;t show
          </summary>
          <p className="mt-1.5">
            We don&rsquo;t have per-verdict change history, so the curve shows adoption among
            products <em>as they enter tracking</em> (first score-history entry), with each product
            carrying its current verdict — not the moment each product shipped the capability.
            Exact verdict history accrues from here forward.
          </p>
        </details>
      </section>

      <div className={TABLE_SHELL}>
        {/* Arena is the one column that can go below sm — the verdict is this page's whole
            point, so it must stay on-screen at phone widths instead of behind a sideways
            scroll. min-w only applies once the Arena column is back. */}
        <table className="w-full border-collapse text-sm sm:min-w-[640px]">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th scope="col" className="px-3 py-2 font-normal">Product</th>
              <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="The product category (arena) it competes in">Arena</span></th>
              <th scope="col" className="px-3 py-2 font-normal"><span title="Does the product deliver this capability? full / partial / none — judged from cited evidence">Verdict</span></th>
              <th scope="col" className="px-3 py-2 font-normal"><span title="How well it delivers when it does (0–100)">Quality</span></th>
              <th scope="col" className="px-3 py-2 font-normal"><span title="How many cited sources back the verdict">Evidence</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {entry.cells.map((cell) => {
              const href = `/arena/${cell.categoryId}/product/${cell.productId}#story-${entry.id}`
              return (
                <tr key={`${cell.categoryId}:${cell.productId}`} className="transition hover:bg-zinc-900/50">
                  <td className="px-3 py-2">
                    <Link href={href} className="flex items-center gap-2 font-medium hover:text-emerald-300">
                      <ProductLogoView
                        product={{ id: cell.productId, name: cell.productName }}
                        size={16}
                        hasLogo={hasLogo(cell.productId)}
                      />
                      {cell.productName}
                    </Link>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-400 sm:table-cell">
                    <Link href={`/arena/${cell.categoryId}`} className="hover:text-emerald-300">
                      {cell.categoryName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <VerdictBadge
                      verdict={cell.verdict}
                      href={href}
                      hrefTitle={`open ${cell.productName}'s full story row (rationale + citations)`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">
                    {cell.verdict === 'none' || cell.verdict === 'na' ? (
                      <span className="font-sans text-xs italic text-zinc-500">—</span>
                    ) : (
                      <>{cell.quality}/10</>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={href} className="text-xs tabular-nums text-zinc-300 underline decoration-zinc-800 hover:text-emerald-300">
                      {cell.evidenceCount} {cell.evidenceCount === 1 ? 'source' : 'sources'}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Verdicts are judged per arena against that arena&rsquo;s evidence packs, so the same tier
        can rest on different evidence depth across arenas — follow a row to the product page for
        the full rationale.
      </p>
    </div>
  )
}
