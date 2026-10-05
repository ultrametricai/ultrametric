import type { Metadata } from 'next'
import Link from 'next/link'
import CapabilityDag, { capabilityDagStats, type CapabilityAdoption } from '@/components/CapabilityDag'
import GeoMark from '@/components/GeoMark'
import PersonaChip from '@/components/PersonaChip'
import { loadAll, stripPersonaPrefix } from '@/lib/data'
import { parseStoryPersona } from '@/lib/storyText'
import { adoptionNow } from '@/lib/diffusion'
import { collectGlobalStories } from '@/lib/globalStories'
import { canonGraphStoryIds } from '@/lib/storyGraph'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// THE industry-stats page: every global story (capability comparable across ≥2 arenas — see
// lib/globalStories.ts) with its adoption share among all tracked products, sorted most-adopted
// first. Answers "what fraction of the software industry we track has an official MCP server /
// llms.txt / self-hosting / 2FA…" in one table; each row links to the /global/[story] page with
// the full per-product verdict list and the diffusion curve.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Capability adoption across the industry — Ultrametric',
  description:
    'How widely each cross-arena capability — official MCP servers, llms.txt, webhooks, self-hosting, 2FA and more — is adopted among every product we track, with evidence-backed verdicts.',
}

export default function GlobalIndexPage() {
  const categories = loadAll()
  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)
  const stories = collectGlobalStories(categories)
    .map((story) => ({ story, adoption: adoptionNow(story.cells) }))
    .sort(
      (a, b) =>
        b.adoption.pct - a.adoption.pct ||
        b.story.arenaCount - a.story.arenaCount ||
        a.story.id.localeCompare(b.story.id),
    )

  return (
    <div className="space-y-6">
      <div>
        {/* seed "global": same concept mark as the Explore menu's Capability adoption entry. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="global" title="Capability adoption — cross-arena industry stats" size={16} className="text-zinc-500" />
          Global stories
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Capability adoption across the industry
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          {stories.length} capabilities that are meaningful for any software product, compared
          across all {categories.length} arenas and {totalProducts} tracked products. Adoption is
          the share of products whose evidence-backed verdict is full or partial — click through
          for every product&rsquo;s verdict and the month-by-month diffusion curve.
        </p>
      </div>

      <section aria-label="capability dependency graph">
        <h2 className="font-display leading-[1.1] flex items-center gap-2 text-lg font-semibold">
          <GeoMark seed="capability-dag" title="Capability dependency graph — which capabilities enable which" size={18} className="text-zinc-500" variant="dendro" />
          Capability dependency graph
        </h2>
        {/* One line only — hover instructions are self-evident in use; the curation caveat rides
            the tooltip so the honesty stays discoverable without a paragraph. */}
        <p
          className="mb-3 mt-1 max-w-2xl text-xs text-zinc-500"
          title="Edges are hand-curated in data/story-edges.json, never inferred; each node's meter is the same evidence-backed adoption share as the table below. Hover an edge for its justification, a node for its adoption and what it requires/unlocks."
        >
          {(() => { const s = capabilityDagStats(); return `${s.nodes} canon capabilities, ${s.edges} curated dependency edges (${s.crossEdges} cross-cluster, dashed)` })()}
          {' '}— an arrow reads &ldquo;prerequisite of&rdquo;; edges are hand-curated, never inferred.
        </p>
        <CapabilityDag
          adoption={Object.fromEntries(
            stories
              .filter(({ story }) => canonGraphStoryIds.has(story.id))
              .map(({ story, adoption }): [string, CapabilityAdoption] => [story.id, adoption]),
          )}
          titles={Object.fromEntries(
            stories
              .filter(({ story }) => canonGraphStoryIds.has(story.id))
              .map(({ story }) => [story.id, stripPersonaPrefix(story.title)]),
          )}
        />
      </section>

      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th scope="col" className="px-3 py-2 font-normal"><span title="An industry-wide capability judged in every arena (MCP server, llms.txt, agent docs…)">Capability</span></th>
              <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="How many product categories (arenas) this capability was judged across">Arenas</span></th>
              <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="Products with a full or partial verdict / all judged products">Products</span></th>
              <th scope="col" className="px-3 py-2 font-normal"><span title="Share of judged products that have this capability today (full or partial)">Adoption</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {stories.map(({ story, adoption }) => (
              <tr key={story.id} className="transition hover:bg-zinc-900/50">
                <td className="max-w-[420px] px-3 py-2">
                  {/* Action first, persona as a trailing chip (lib/storyText.ts) — the "As a
                      {persona}," frame would otherwise open every row of this table. */}
                  <Link href={`/global/${story.id}`} className="font-medium hover:text-emerald-300">
                    {stripPersonaPrefix(story.title)}
                  </Link>
                  <PersonaChip persona={parseStoryPersona(story.title).persona} className="ml-1.5" />
                </td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">{story.arenaCount}</td>
                <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">
                  {adoption.adopters}/{adoption.total}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* Tiny meter, same visual family as ScoreBar: emerald fill on a zinc track. */}
                    <div aria-hidden className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${adoption.pct}%` }} />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-zinc-300">
                      {Number.isInteger(adoption.pct) ? adoption.pct : adoption.pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Verdicts are judged per arena against public evidence (see{' '}
        <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
          methodology
        </Link>
        ), so &ldquo;adoption&rdquo; here means &ldquo;we found evidence it works&rdquo;, not a
        vendor claim.
      </p>
    </div>
  )
}
