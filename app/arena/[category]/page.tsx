import type { Metadata } from 'next'
import Link from 'next/link'
import ArenaTable from '@/components/ArenaTable'
import GeoMark, { GeoBackdrop } from '@/components/GeoMark'
import IconChip from '@/components/IconChip'
import Legend from '@/components/Legend'
import PersonaStacksSection from '@/components/PersonaStacksSection'
import StacksSection from '@/components/StacksSection'
import StoryMatrix from '@/components/StoryMatrix'
import { arenaIcon } from '@/lib/arenaIcons'
import { loadAll, loadCategory, type CategoryData } from '@/lib/data'
import { arenaClientData } from '@/lib/arenaClientData'
import { adjacentArenas } from '@/lib/alternatives'
import arenaSections from '@/data/arena-sections.json'
import { humanizeTheme } from '@/lib/icons'
import { hotReasonsForCategory } from '@/lib/hotProducts'
import { hasLogo } from '@/lib/logos'
import { loadPricing, pricingCellFor, type PricingCell } from '@/lib/pricing'
import { SITE_URL } from '@/lib/site'

// The two hardware arenas graduated from unlinked /experiments spec tables; those pages stay
// live as each arena's raw vendor-spec annex (app/experiments/*), linked from the header row.
const SPEC_ANNEX: Record<string, string> = {
  processors: '/experiments/processors',
  gpus: '/experiments/gpus',
}

// The leaderboard already sorts primarily by aiEra/Overall score (see lib/scoring.ts), so entry 0
// is the "most agent-friendly" product for both metadata and the FAQ answer below — no
// fabricated ratings, just the same number rendered on the page.
function topEntry(data: CategoryData) {
  const entry = data.rankings.leaderboard[0]
  const product = data.products.find((p) => p.id === entry.productId)!
  return { entry, product }
}

function scoreText(aiEra: number | null): string {
  return aiEra === null ? 'the top agent-tested coverage score' : `a Overall score of ${aiEra.toFixed(0)}/100`
}

// Honest FAQPage JSON-LD — both answers are derived straight from this arena's own computed
// data (leaderboard order + aiEra), never a fabricated star rating or invented claim.
function arenaFaqJsonLd(data: CategoryData) {
  const { entry, product } = topEntry(data)
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Which ${data.category.name} product is most agent-friendly?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${product.name} ranks first in Ultrametric's ${data.category.name} arena, with ${scoreText(entry.aiEra)} — see the full agent-tested leaderboard at ${SITE_URL}/arena/${data.category.id}.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How is this measured?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Every product is judged against a shared taxonomy of user stories using cited evidence (vendor docs, GitHub, community sources, or a hands-on probe) — never opinion. See ${SITE_URL}/methodology for the full scoring writeup.`,
        },
      },
    ],
  }
}

// schema.org ItemList of SoftwareApplication entries — one per product in the arena's
// leaderboard order. Deliberately no aggregateRating: we don't have star ratings, and faking
// one would be dishonest. Our own custom metrics (aiEra, coverage score) are instead exposed
// as additionalProperty PropertyValue entries, which is what schema.org intends for
// non-standard, honestly-labeled metrics.
function arenaJsonLd(data: CategoryData) {
  const productById = new Map(data.products.map((p) => [p.id, p]))
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${data.category.name} Arena`,
    description: data.category.description,
    itemListElement: data.rankings.leaderboard.map((entry, i) => {
      const product = productById.get(entry.productId)!
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'SoftwareApplication',
          name: product.name,
          url: `${SITE_URL}/arena/${data.category.id}/product/${product.id}`,
          applicationCategory: data.category.name,
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'aiEra', value: entry.aiEra },
            { '@type': 'PropertyValue', name: 'score', value: entry.score },
          ],
        },
      }
    }),
  }
}

export function generateStaticParams() {
  return loadAll().map((data) => ({ category: data.category.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const data = loadCategory(category)
  const { entry, product } = topEntry(data)
  const year = new Date().getFullYear()
  return {
    title: `Best ${data.category.name} for AI agents (${year}) — Ultrametric`,
    description: `Which ${data.category.name} product is most agent-friendly? ${product.name} leads with ${scoreText(entry.aiEra)} in Ultrametric's agent-tested ${data.category.name} rankings.`,
  }
}

export default async function ArenaPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const data = loadCategory(category)
  // Computed server-side and passed down as a plain prop: ArenaTable/StoryMatrix are client
  // components, so they can't call lib/logos.ts's fs-based hasLogo() themselves (see
  // components/ProductLogoView.tsx for why).
  const adjacent = adjacentArenas(loadAll(), data)
  // The breadcrumb's middle segment — the section this arena lives under in the Arenas index.
  const section = (arenaSections as { sections: { id: string; name: string; arenaIds: string[] }[] }).sections.find((x) => x.arenaIds.includes(data.category.id)) ?? null
  const logoMap = Object.fromEntries(data.products.map((p) => [p.id, hasLogo(p.id)]))
  // Pricing transparency index (lib/pricing.ts): serializable headline cells for the covered
  // arenas' "$ / unit" leaderboard column, computed server-side (fs) for the client-side table.
  // Empty map (arena not covered / stage not run) → undefined → the column doesn't render.
  const pricingMap = loadPricing(category)
  const pricingCells = Object.fromEntries(
    data.products.flatMap((p) => {
      const entry = pricingMap[p.id]
      const cell = entry ? pricingCellFor(entry, category) : null
      return cell ? [[p.id, cell] as [string, PricingCell]] : []
    }),
  )
  const pricing = Object.keys(pricingCells).length > 0 ? pricingCells : undefined
  // 🔥 flags (lib/hotProducts.ts) need the whole fleet's popularity history (the hot threshold
  // is fleet-relative), so they're computed here server-side and passed down as plain strings.
  const hotReasons = hotReasonsForCategory(loadAll(), data)
  // What the client components below receive: CategoryData minus verdict rationale and battle
  // records, neither of which this page renders — see lib/arenaClientData.ts for the full
  // accounting. The server-side JSON-LD above keeps reading the untouched `data`.
  const clientData = arenaClientData(data)
  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(arenaJsonLd(data)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(arenaFaqJsonLd(data)) }}
      />
      {/* relative isolate: contains the GeoBackdrop (a faint phyllotaxis field seeded by the
          arena id, so every arena header is subtly its own) behind the header text. */}
      <div className="relative isolate">
        <GeoBackdrop seed={data.category.id} />
        {/* The eyebrow breadcrumb, matching the process pages' idiom exactly (founder
            2026-10-02: "the breadcrumb on the arena pages doesn't match the processes page"):
            'Arenas / {section}' — same sizes, same slash, both halves linked. */}
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">
          <Link href="/arenas" className="hover:text-emerald-300">Arenas</Link>
          {section && (
            <>
              <span className="mx-1 text-zinc-600">/</span>
              <Link href={`/arenas/${section.id}`} className="hover:text-emerald-300">{section.name}</Link>
            </>
          )}
        </p>
        <h1 className="font-display leading-[1.1] mt-1 flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          {/* The same house glyph this arena wears in the header's Arenas menu
              (lib/arenaIcons.ts) — IconChip renders the `pi:` token as the custom duotone SVG. */}
          <IconChip
            icon={arenaIcon(data.category.id)}
            title={`${data.category.name} arena`}
          />
          {data.category.name}
        </h1>
        <p className="mt-2 text-zinc-400">{data.category.description}</p>
        {/* The header's story/verdict-count + freshness stats line was removed (founder
            2026-09-30) — the "What we tested" table below (internally: the story matrix)
            speaks for itself and every verdict still links to its dated evidence. */}
        <p className="mt-2 flex flex-wrap gap-x-4 text-xs">
          {/* Buyer checklist + Procurement report links removed (founder 2026-09-25: "remove
              access for now") — the /checklist and /report routes stay alive for old links,
              same posture as /everything. */}
          {SPEC_ANNEX[data.category.id] && (
            <Link
              href={SPEC_ANNEX[data.category.id]}
              className="text-zinc-400 underline decoration-zinc-800 hover:text-emerald-300"
              title="The raw vendor-spec comparison table this arena graduated from"
            >
              Raw spec table →
            </Link>
          )}
        </p>
      </div>
      {/* No "Leaderboard" heading (founder 2026-09-30: self-evident — the ranked table opens
          the page); the table itself carries an aria-label so it keeps an accessible name. */}
      <ArenaTable data={clientData} logoMap={logoMap} pricing={pricing} hotReasons={Object.keys(hotReasons).length > 0 ? hotReasons : undefined} />
      <PersonaStacksSection data={clientData} />
      <StacksSection data={clientData} />
      <div id="story-matrix" className="scroll-mt-4">
        <h2 className="font-display leading-[1.1] mb-4 flex items-center gap-2 text-lg font-semibold">
          <GeoMark seed="story-matrix" title="What we tested — every product × every judged story" size={18} className="text-zinc-500" />
          What we tested
        </h2>
        <StoryMatrix data={clientData} logoMap={logoMap} />
      </div>
      {/* Legend AFTER the last table it explains ("What we tested") — founder principle: optimize
          for first use, bulk value (the leaderboard) seen straight away, vocabulary below.
          Chip tooltips + StoryMatrix's #legend link cover mid-scroll lookups. */}
      <Legend />
      {adjacent.length > 0 && (
        <div>
          <h2 className="font-display leading-[1.1] mb-1 flex items-center gap-2 text-lg font-semibold">
            <GeoMark seed="arenas" title="Adjacent arenas — categories often shopped together" size={18} className="text-zinc-500" />
            Adjacent arenas
          </h2>
          <p className="mb-4 text-sm text-zinc-500">Shopping this category often means shopping these too.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {adjacent.map((a) => (
              <Link
                key={a.categoryId}
                href={`/arena/${a.categoryId}`}
                className="group min-w-0 rounded-xl border border-zinc-800 p-4 transition hover:border-emerald-400/60"
              >
                <p className="flex items-center gap-1.5 font-medium group-hover:text-emerald-300">
                  <IconChip
                    icon={arenaIcon(a.categoryId)}
                    title={`${a.categoryName} arena`}
                  />
                  {a.categoryName}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {a.productCount} products{a.leaderName ? ` · leader: ${a.leaderName}` : ''}
                </p>
                {a.sharedThemes.length > 0 && (<p className="mt-1 truncate text-[11px] text-zinc-500">shares: {a.sharedThemes.map(humanizeTheme).join(', ')}</p>)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
