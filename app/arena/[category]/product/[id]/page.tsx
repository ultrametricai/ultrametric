import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AgentAccessGlyphs from '@/components/AgentAccessGlyphs'
import { IconGlyph } from '@/components/IconChip'
import { BusinessModelSection } from '@/components/BusinessModel'
import ClaimsSection from '@/components/ClaimsSection'
import CompareRivals from '@/components/CompareRivals'
import FamilySection from '@/components/FamilySection'
import { arenaIcon } from '@/lib/arenaIcons'
import { storyProcessesForArena } from '@/lib/storyProcessGraph'
import GeoMark from '@/components/GeoMark'
import InstallCommands from '@/components/InstallCommands'
import IntegrationChips, { chipTitle } from '@/components/IntegrationChips'
import MomentumChip from '@/components/MomentumChip'
import MomentumTrend from '@/components/MomentumTrend'
import OssPill from '@/components/OssPill'
import ProductLinkChips from '@/components/ProductLinkChips'
import PricingSignals from '@/components/PricingSignals'
import ProductLogo from '@/components/ProductLogo'
import ProductShowcase from '@/components/ProductShowcase'
import ProofsSection from '@/components/ProofsSection'
import ScoreBar from '@/components/ScoreBar'
import ScoreTrend from '@/components/ScoreTrend'
import ScoreViewMenu from '@/components/ScoreViewMenu'
import SloUptimeLine from '@/components/SloUptimeLine'
import StoryMap from '@/components/StoryMap'
import StoryThemeDag from '@/components/StoryThemeDag'
import StoryVerdictsTable from '@/components/StoryVerdictsTable'
import ThemeIcon from '@/components/ThemeIcon'
import StoryViewToggle from '@/components/StoryViewToggle'
import TryItSection from '@/components/TryIt/TryItSection'
import VendorProcesses from '@/components/VendorProcesses'
import ImUsing from '@/components/ImUsing'
import WatchButton from '@/components/WatchButton'
import WhereItWorks from '@/components/WhereItWorks'
import EnterpriseBadge from '@/components/EnterpriseBadge'
import ShutdownBadge from '@/components/ShutdownBadge'
import YcBadge from '@/components/YcBadge'
import { agentBanRecorded } from '@/lib/agentBans'
import { arenaMembershipsOf } from '@/lib/alternatives'
import {
  groupInOrder, loadAll, loadCategory, type CategoryData,
} from '@/lib/data'
import { isGroupUntested } from '@/lib/data-helpers'
import { globalStoryIds } from '@/lib/globalStories'
import { humanizeTheme, themeExplanation } from '@/lib/icons'
import { loadIntegrationGraph, neighborsOf, productRefIndex } from '@/lib/integrations'
import { hasLogo } from '@/lib/logos'
import { loadPopularityHistory, popularitySeries } from '@/lib/popularityHistory'
import { loadPricing } from '@/lib/pricing'
import { loadScoreHistory } from '@/lib/scoreHistory'
import { aiEraBandFor, loadScoreIntervals } from '@/lib/scoreIntervals'
import type { Product, Story } from '@/lib/schemas'
import { REPO, SITE_URL } from '@/lib/site'
import { loadStoryTiers, storyTiersByCell, tierCountsFor } from '@/lib/storyTiers'
import { buildStoryVerdictRows } from '@/lib/storyVerdictsSort'
import { hasTryIt } from '@/lib/tryit'
import { processesForVendor } from '@/lib/vendorProcesses'

// schema.org SoftwareApplication for one product. No aggregateRating (see arena page's
// comment) — our custom metrics go in additionalProperty instead.
function productJsonLd(data: CategoryData, product: Product) {
  const entry = data.rankings.leaderboard.find((e) => e.productId === product.id)!
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: product.name,
    url: `${SITE_URL}/arena/${data.category.id}/product/${product.id}`,
    applicationCategory: data.category.name,
    ...(product.vendor ? { author: { '@type': 'Organization', name: product.vendor } } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'aiEra', value: entry.aiEra },
      { '@type': 'PropertyValue', name: 'score', value: entry.score },
      { '@type': 'PropertyValue', name: 'agentReady', value: entry.agentReady },
      { '@type': 'PropertyValue', name: 'apiQuality', value: entry.apiQuality },
    ],
  }
}

export function generateStaticParams() {
  return loadAll().flatMap((data) => data.products.map((p) => ({ category: data.category.id, id: p.id })))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; id: string }>
}): Promise<Metadata> {
  const { category, id } = await params
  const data = loadCategory(category)
  const product = data.products.find((p) => p.id === id)
  // "— Ultrametric" suffix like every other page title on the site.
  return {
    title: `${product ? product.name : id} — ${data.category.name} Ranking — Ultrametric`,
    // Agent-discovery pointers (founder 2026-10-02): the bottom "For agents"/"Data" link cards
    // left the visible page, so the per-product markdown and the evidence/verdict JSON stay
    // discoverable FROM this page as <link rel="alternate"> tags — same URLs /llms.txt and
    // /openapi.json document.
    alternates: {
      types: {
        'text/markdown': `${SITE_URL}/arena/${category}/product/${id}/llms.md`,
        'application/json': [
          { url: `${SITE_URL}/data/${category}/evidence/${id}.json`, title: 'Evidence (JSON)' },
          { url: `${SITE_URL}/data/${category}/verdicts.json`, title: 'Verdicts (JSON)' },
        ],
      },
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; id: string }>
}) {
  const { category, id } = await params
  const data = loadCategory(category)
  const product = data.products.find((p) => p.id === id)
  if (!product) notFound()
  const entry = data.rankings.leaderboard.find((e) => e.productId === id)!
  const naDims = new Set(data.category.naDimensions ?? [])
  const byTheme = groupInOrder<Story>(data.stories, (s) => s.theme)
  // Flattened, serializable (story, verdict) rows for the client-side sortable table — the
  // full CategoryData never crosses the server/client boundary. globalStoryIds(loadAll())
  // lets a global story's [G] chip link to its /global/[story] cross-arena page (loadAll is
  // cached in lib/data.ts, so this costs nothing extra at build time).
  // Pricing-tier annotations (lib/storyTiers.ts) — tolerant-optional: an unclassified arena
  // loads an empty list, rows carry no tier, and the "What's free" line below renders nothing.
  const storyTiers = loadStoryTiers(category)
  const verdictRows = buildStoryVerdictRows(data, id, globalStoryIds(loadAll()), storyTiersByCell(storyTiers))
  const tierCounts = tierCountsFor(storyTiers, id)
  const gatedCount = tierCounts.free + tierCounts.paid + tierCounts.enterprise
  // Verified official vendor responses for this product (see docs/VENDOR-RESPONSES.md) — the
  // header chip links down to the verdicts table, where each response renders inside its
  // story's expanded row.
  const vendorResponseCount = data.vendorResponses.filter((r) => r.productId === id).length
  // "Try it" (components/TryIt/*) exists for products whose sandbox section actually renders:
  // ≥1 replayable recorded proof with a readable transcript, or an allowlisted live MCP
  // endpoint — the exact predicate TryItSection renders on (lib/tryit.ts). Only then does the
  // header's primary CTA become hands-on; products with neither keep the plain site link as
  // primary (no fake try, never a dead CTA).
  const tryable = hasTryIt(category, id)
  // Founder 2026-10-08: where the service has SAID agents may not come — committed evidence
  // records a named AI-agent ban or a robots-walled front door (lib/agentBans.ts, derived from
  // evidence/crawlExclude, never a hand list) — the primary slot renders NOTHING: no CTA, no
  // external link. The vendor-name link above and the Access chips keep carrying the site.
  const banRecorded = !tryable && agentBanRecorded(data, id)
  // Momentum sparklines beside the chip — stars/downloads over time from
  // popularity-history.jsonl (tolerant-optional; series with <2 distinct snapshots render
  // nothing — see components/MomentumTrend.tsx).
  const popularityLines = loadPopularityHistory(category).get(id) ?? []
  const momentumSeries = [
    { label: '★', points: popularitySeries(popularityLines, 'stars') },
    { label: 'npm/wk', points: popularitySeries(popularityLines, 'npmWeekly') },
    { label: 'pypi/wk', points: popularitySeries(popularityLines, 'pypiWeekly') },
  ]
  // Verified integration neighbors from the fleet-wide graph (lib/integrations.ts) — each chip's
  // tooltip quotes the evidence excerpt(s) the edge rests on, verbatim. Renders nothing when the
  // product has no verified edges (absence of evidence, displayed as absence).
  const allCategories = loadAll()
  const refs = productRefIndex(allCategories)
  const nameOf = (pid: string) => refs.get(pid)?.name ?? pid
  const integrationChips = neighborsOf(loadIntegrationGraph(allCategories.map((d) => d.category.id)), id)
    .flatMap((n) => {
      const ref = refs.get(n.productId)
      if (!ref) return []
      return [{
        productId: n.productId,
        name: ref.name,
        arenaId: ref.arenaId,
        arenaName: ref.arenaName,
        title: chipTitle(n.sources, nameOf),
        hasLogo: hasLogo(n.productId),
      }]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  // Every arena this product id competes in (sentry: observability AND error-tracking; brex:
  // startup-banking AND expense-management), each with its live rank there — the header's
  // arenas strip, so a user can jump straight to any leaderboard the vendor is a member of.
  const memberships = arenaMembershipsOf(allCategories, id)
  // Founder 2026-09-21: the processes this product interacts with and serves — the reverse of
  // the process pages' vendor rankings (lib/vendorProcesses.ts one-pass cached index). The
  // header chip counts only judged step-SERVING appearances (function/extra step scores);
  // computer-use-only "could attempt it" appearances stay out of the chip (and out of
  // stepsServed) so a browser agent's ~100 attempt candidacies never read as coverage.
  const processAppearances = processesForVendor(category, id)
  const processesServed = processAppearances.filter((a) => a.stepsServed > 0).length

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(data, product)) }}
      />
      <div>
        {/* Arena identity, instantly (Stripe-employee feedback: "hard to tell what category this
            product was in"). Breadcrumb for orientation, then the eyebrow names the arena — with
            its emoji — as a prominent link to the leaderboard the rank comes from. This is the
            page's own category; FamilySection below covers sibling products, not this. */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
          <Link href="/" className="transition hover:text-emerald-300">Rankings</Link>
          <span aria-hidden className="text-zinc-700">→</span>
          <Link href={`/arena/${category}`} className="transition hover:text-emerald-300">
            {data.category.name}
          </Link>
          <span aria-hidden className="text-zinc-700">→</span>
          <span className="text-zinc-400">{product.name}</span>
        </nav>
        {/* Founder 2026-09-18: no "Rank #X of Y in <arena>" eyebrow — the arenas strip below
            already carries the arena chips with live ranks; saying it twice wasted the top. */}
        <div className="mt-1 flex flex-wrap items-center gap-4">
          <ProductLogo product={product} size={56} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display leading-[1.1] text-3xl font-bold tracking-tight">{product.name}</h1>
              {product.type === 'oss' && <OssPill />}
              <YcBadge ycBatch={product.ycBatch} />
              <EnterpriseBadge enterprise={product.enterprise} />
              <ShutdownBadge shutdown={product.shutdown} source={product.shutdownSource} />
              {/* Founder 2026-10-02: no '✨ Built-in AI assistant' chip up here — the verdict
                  stays data (the Built-in AI pill below and the story row carry it); the index
                  tables keep their AiModeBadge column. */}
            </div>
            {/* The OssPill beside the name is the one open-source signal (founder 2026-09-23:
                no "commercial" tag — nearly everything is, so it said nothing).
                Founder 2026-10-02: the vendor name links OUT to the vendor's real site — the
                committed urls.site from data/<arena>/products.json (schema-required, so every
                product has one; never a guessed domain). The internal family breakdown still
                lives in FamilySection below. */}
            <p className="text-zinc-500">
              <a
                href={product.urls.site}
                target="_blank"
                rel="noopener noreferrer"
                title={`${product.vendor} — ${product.urls.site} (the vendor's own site, from our committed product data)`}
                className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
              >
                {/* Founder 2026-10-02: no ↗ glyph after the company name — the name itself stays
                    the external link (target/rel/tooltip unchanged). */}
                {product.vendor}
              </a>
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <WatchButton productId={id} productName={product.name} />
            <ImUsing arenaId={category} productId={id} productName={product.name} />
            {tryable ? (
              <>
                {/* Founder 2026-09-23: the right-side domain link is gone — the Access chips
                    below carry the site link, and the header stays focused on Try it. */}
                {/* Founder 2026-10-07: the header's main CTA reads "Test in Ultrametric"
                    (supersedes the 2026-10-02 "Test it in sandbox" label; the section heading
                    below keeps that name). Plain anchor to the #try-it section — SSR-static,
                    no JS. */}
                <a
                  href="#try-it"
                  className="shrink-0 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
                >
                  Test in Ultrametric →
                </a>
              </>
            ) : banRecorded ? null : (
              <a
                href={product.urls.site}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-mono text-sm text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
              >
                {new URL(product.urls.site).hostname.replace(/^www\./, '')} ↗
              </a>
            )}
          </div>
        </div>
        {/* PRIMARY metrics row — the "should I care" read: the score dropdown (founder
            2026-10-08: the per-dimension pills fold into a menu anchored on the Overall score —
            the reader switches which score the big number shows; the static HTML always shows
            Overall) and the MCP/CLI/API access glyphs. Everything below this row is
            deliberately quieter (secondary: momentum/vendor responses; then the arenas strip).
            Every view clicks through to THIS product's transparent calculation page (/score,
            per-dimension anchors) — the exact stories, verdicts, evidence, and arithmetic
            behind its number (founder 2026-09-15), with each score's derivation tooltip riding
            along. naDimensions (hardware arenas) keep the honest muted "n/a" view, and the
            founder 2026-10-02 rule holds: an untested api-quality dimension gets NO entry at
            all (untested stays data — the /score page and index tables still say it). */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <ScoreViewMenu
            overall={{
              value: entry.aiEra,
              href: `/arena/${category}/product/${id}/score`,
              interval: aiEraBandFor(loadScoreIntervals(category), id),
              components: { agentReady: entry.agentReady, apiQuality: entry.apiQuality, openness: entry.themeScores['openness'] ?? null, agenticApp: entry.agenticApp, automation: entry.themeScores['automation-depth'] ?? null },
            }}
            views={[
              { kind: 'agent-ready', value: naDims.has('agentReady') ? null : entry.agentReady, untested: !naDims.has('agentReady') && isGroupUntested(data, id, 'agent-access'), href: naDims.has('agentReady') ? undefined : `/arena/${category}/product/${id}/score#agent-ready` },
              { kind: 'agentic-app', value: naDims.has('agenticApp') ? null : entry.agenticApp, untested: !naDims.has('agenticApp') && isGroupUntested(data, id, 'agentic-features'), href: naDims.has('agenticApp') ? undefined : `/arena/${category}/product/${id}/score#built-in-ai` },
              ...(!naDims.has('apiQuality') && isGroupUntested(data, id, 'api-quality')
                ? []
                : [{ kind: 'api-quality' as const, value: naDims.has('apiQuality') ? null : entry.apiQuality, href: naDims.has('apiQuality') ? undefined : `/arena/${category}/product/${id}/score#api-quality` }]),
            ]}
          />
          {/* Founder 2026-09-23: when the api-quality pill above shows an actual score, the API
              glyph is redundant — the score IS the tick. The glyph stays only when the pill has
              no number to show (n/a arena, untested, or no judged score). MCP/CLI always render. */}
          <AgentAccessGlyphs
            data={data}
            productId={id}
            size="md"
            omit={
              !naDims.has('apiQuality') && !isGroupUntested(data, id, 'api-quality') && entry.apiQuality !== null
                ? ['API']
                : undefined
            }
          />
        </div>
        {/* SECONDARY row — adoption signals (registry data, never part of the Overall score), the
            evidence-depth flag (how hard we've looked, founder 2026-09-23), and the
            vendor-response chip. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <MomentumChip popularity={data.popularity[id]} />
          <MomentumTrend series={momentumSeries} />
          {/* Founder 2026-10-02: the '◉ deep-spiked · N ev' verification-depth chip is gone from
              this page (display only — evidence counts and spike dates stay committed data;
              components/SpikeDepthChip.tsx remains for any surface that wants it back). */}
          {/* Vendor doc links — inline here since the old top rail's lone "Access" box read as
              an empty frame (founder 2026-09-23). One "Docs" dropdown since 2026-10-05
              (components/DocsMenu.tsx) instead of the separate API/CLI/MCP docs chips. */}
          <ProductLinkChips product={product} />
          {vendorResponseCount > 0 && (
            <a
              href="#story-verdicts"
              title="Verified official vendor statements, published verbatim — they never change a verdict by themselves"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/5 px-2.5 py-0.5 text-xs text-sky-300 transition hover:border-sky-400/70"
            >
              <span className="rounded border border-sky-400/60 px-1 text-[9px] font-semibold uppercase tracking-wide">
                Vendor
              </span>
              {vendorResponseCount} vendor {vendorResponseCount === 1 ? 'response' : 'responses'}
            </a>
          )}
        </div>
        {/* Founder 2026-09-22: the breadcrumb already names THIS arena — repeating it here under
            the stats wasted the top. The strip now lists only OTHER arenas the product is ranked
            in ("Also ranked in") and disappears entirely for single-arena products; the
            processes chip keeps its slot either way. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {memberships.some((m) => m.arenaId !== category) && (
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Also ranked in</span>
          )}
          {memberships.filter((m) => m.arenaId !== category).map((m) => (
            // No tooltip (founder sweep 2026-10-02): the chip already shows the arena name and
            // #rank/field — the old title restated all of it.
            <Link
              key={m.arenaId}
              href={`/arena/${m.arenaId}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${
                m.arenaId === category
                  ? 'border-emerald-400/50 bg-emerald-400/5 text-emerald-300 hover:border-emerald-400/80'
                  : 'border-zinc-800 text-zinc-300 hover:border-emerald-400/60 hover:text-emerald-300'
              }`}
            >
              {/* The arena's house glyph (lib/arenaIcons.ts — founder 2026-10-08: the last
                  raw data/arena-icons.json emoji render site joins the custom set). */}
              {arenaIcon(m.arenaId) !== '' && (
                <span aria-hidden>
                  <IconGlyph icon={arenaIcon(m.arenaId)} />
                </span>
              )}
              {m.arenaName}
              <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                #{m.rank}/{m.fieldSize}
              </span>
            </Link>
          ))}
          {/* One small chip only (the header is crowded): jumps to the processes section below.
              Rendered only when judged step-serving appearances exist — never for
              computer-use-only vendors. */}
          {/* "serves N processes →" chip removed (founder 2026-09-23) — the full table below
              carries it. */}        </div>
        {/* GEO spike (founder 2026-09-28): per-country availability evidence from the vendor's
            own pages — renders only for spiked products (jurisdictions/vendor-geo.json), never a score. */}
        <WhereItWorks productId={id} />
      </div>

      {/* Top actions rail retired (founder 2026-09-23: after Install and Compare moved out it
          was one near-empty box holding only the Access chips) — those chips now sit inline in
          the header's secondary row above. Try/Flag/Badge/For agents/Data keep the bottom rail. */}

      {/* Showcase (screenshots) above the microterminal — founder rule: show what the product
          looks like before the hands-on replay. */}
      <ProductShowcase product={product} />

      {/* Founder 2026-09-22: the processes-served table moved up here — just below the images,
          above the Products (family) section. What work a product does ranks above who its
          siblings are. */}
      <VendorProcesses arenaId={category} productId={id} productName={product.name} />

      {/* Founder 2026-09-22: the similar-products comparison — this product vs its leaderboard
          neighbors, every score a receipt link, head-to-head records into the /vs pages. */}
      <CompareRivals data={data} productId={id} />

      {/* Multi-product vendors: the family breakdown block (lib/families.ts) — renders for any
          product with a data/product-families.json entry, nothing for everyone else. Founder
          2026-09-15: Products above Try it — the portfolio orients before the hands-on replay. */}
      <FamilySection arenaId={category} productId={id} />

      <TryItSection category={category} productId={id} productName={product.name} stories={data.stories} />

      {/* Founder 2026-09-23: the install commands live right under "Test it in sandbox" — try
          it in the microterminal, then install it for real in one scroll. */}
      {(product.install?.length ?? 0) > 0 && (
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Install</p>
          <div className="mt-1.5">
            <InstallCommands product={product} />
          </div>
        </div>
      )}

      {/* Verified integrations, right after the family/trend block (founder: more useful than
          its old bottom-of-page slot) — each chip's tooltip quotes the evidence excerpt(s) the
          edge rests on. Renders nothing when the product has no verified edges. */}
      <IntegrationChips chips={integrationChips} />

      {product.affiliation && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200/90">
          <span className="mr-2 rounded border border-emerald-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Affiliation
          </span>
          {product.affiliation}
        </div>
      )}

      <div>
        <h2 className="font-display leading-[1.1] mb-3 flex items-center gap-2 text-lg font-semibold">
          <GeoMark seed="themes" title="By theme — the product's score on each story theme" size={18} className="text-zinc-500" />
          By theme
        </h2>
        {/* grid-cols-1 (not the bare implicit column): Tailwind's template is minmax(0, 1fr),
            which lets the truncate/nowrap card rows shrink — the implicit auto column sizes to
            max-content and horizontally scrolled the whole page at 375px. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {byTheme.map(([t]) => {
            const themeScore = entry.themeScores[t] ?? null
            // The old per-theme anchors died with the vertical list — the sortable table below
            // (id="story-verdicts") has its own theme dropdown, so every theme card lands on
            // the same table rather than leaving a dead #theme-<t> link.
            // Founder 2026-10-02: no per-card tooltip — the visible explanation line and the
            // hover "evidence →" affordance say it; the section heading keeps its GeoMark title.
            return (
              <a
                key={t}
                href="#story-verdicts"
                className="group rounded-xl border border-zinc-800 p-4 transition hover:border-emerald-400/60"
              >
                <p className="flex items-center justify-between text-sm text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <ThemeIcon theme={t} />
                    {humanizeTheme(t)}
                  </span>
                  <span className="text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100">
                    evidence →
                  </span>
                </p>
                {/* Visible one-line explanation of what this grouping means (founder rule:
                    don't hide it behind the icon tooltip) — truncated, never wrapping the card. */}
                <p className="mb-2 mt-0.5 truncate text-xs text-zinc-500">{themeExplanation(t)}</p>
                {themeScore === null ? (
                  <p className="text-xs italic text-zinc-400">n/a</p>
                ) : (
                  <ScoreBar score={themeScore} />
                )}
              </a>
            )
          })}
        </div>
      </div>

      <div id="story-verdicts" className="scroll-mt-4">
        <h2 className="font-display leading-[1.1] mb-3 flex items-center gap-2 text-lg font-semibold">
          <GeoMark seed="story-verdicts" title="Story verdicts — every judged story with its evidence" size={18} className="text-zinc-500" />
          Story verdicts
        </h2>
        {/* "What's free" — the pricing-tier dimension in one line: of the stories this product
            delivers (full/partial), how many the cited evidence says work free / need a paid
            plan / are enterprise-gated. `unknown` stays visible so silence never reads as
            free. Renders only when at least one cell was actually classified. */}
        {gatedCount > 0 && (
          <p className="mb-3 text-xs text-zinc-400">
            <Link
              href="/methodology#story-tiers"
              title="Classified from the cited evidence only ('unknown' = gating never stated) — never affects verdicts or scores"
              className="uppercase tracking-widest text-zinc-500 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
            >
              What&rsquo;s free
            </Link>
            {': '}
            <span className="text-emerald-300">{tierCounts.free} free</span>
            {' · '}
            <span className="text-zinc-300">{tierCounts.paid} paid</span>
            {' · '}
            <span className="text-violet-300">{tierCounts.enterprise} enterprise</span>
            {tierCounts.unknown > 0 && (
              <span className="text-zinc-500"> · {tierCounts.unknown} not stated in evidence</span>
            )}
          </p>
        )}
        {/* Two server-rendered views of the same verdict rows, toggled client-side via `hidden`
            (static-export safe — both are in the HTML). Table = the flat, sortable evidence
            surface every #story-<id> deep link targets; Map = the capability DAG (curated canon
            graph + heuristic domain clusters) whose verdict-tinted blocks show where the
            product's capability frontier greys out. */}
        <StoryViewToggle
          map={<StoryMap rows={verdictRows} productName={product.name} />}
          table={<StoryVerdictsTable category={category} productId={id} rows={verdictRows} processes={storyProcessesForArena(category)} />}
        />
      </div>

      {/* Story-DAG prototype (founder 2026-10-02: "i want to see what a story DAG looks like for
          a vendor — test on the mercury page"): the judged stories as a theme → story DAG,
          verdict-tinted, committed data only. GATED to exactly this one page this round — a
          clearly-marked experiment for the founder to judge before any wider rollout. */}
      {category === 'startup-banking' && id === 'mercury' && (
        <StoryThemeDag data={data} productId={id} productName={product.name} />
      )}

      {/* The Opportunities (score-headroom to-do list, lib/opportunities.ts) and Coverage map
          (evidence surface → stories, lib/storyCoverage.ts) sections were removed from this
          page (founder 2026-10-08). The derivations stay: the per-product llms.md
          (lib/markdown.ts) still publishes both, and the table's per-row "Covered by" chips
          still read lib/storyCoverage.ts. */}
      <ProofsSection category={category} productId={id} stories={data.stories} />

      <ClaimsSection data={data} category={category} productId={id} />

      {/* Pricing-covered arenas only (lib/pricing.ts): renders nothing when this product has no
          pricing entry, "pricing unclear" when the vendor's page couldn't be read honestly. */}
      <PricingSignals entry={loadPricing(category)[id]} />

      <BusinessModelSection product={product} />


      {/* Founder 2026-09-15: the score trend lives at the page end — provenance for readers
          who scrolled the evidence, not prime space. Founder 2026-10-02 collapsed the bottom
          utility card grid (Try/Flag/Badge/For agents/Data) to a ⚑ Flag a verdict button;
          founder 2026-10-08 removed that footer affordance (and its ⚿ auth companion chip)
          entirely — contestation routes through the repo (CONTRIBUTING.md's contest-a-verdict
          guide and the .github issue templates). The agent-discovery pointers the old grid
          carried (per-product llms.md, evidence/verdicts JSON) stay published via the
          documented contracts (/llms.txt and /openapi.json) and as invisible
          <link rel="alternate"> tags in generateMetadata above; the /badges embed page stays
          functional, just unlinked from here. */}
      <ScoreTrend entries={loadScoreHistory(category).get(id) ?? []} />

      {/* View-in-repo (founder 2026-10-08, the process pages' footer idiom): this product's
          judged evidence file in the public data tree — every product has one
          (data/<arena>/evidence/<id>.json; products.json sits beside it). */}
      <p className="text-xs text-zinc-600">
        <a
          href={`https://github.com/${REPO}/blob/main/data/${category}/evidence/${id}.json`}
          target="_blank"
          rel="noopener noreferrer"
          title={`This product's judged evidence in the public repo — data/${category}/evidence/${id}.json`}
          className="transition hover:text-emerald-300"
        >
          View the evidence in the repo ↗
        </a>
      </p>

      {/* Ops fine print, dead last (founder: educate first, ops last): 30-day agent-surface
          uptime (renders nothing until slo-check has history — lib/slo.ts). The "Evidence as
          of · story coverage" provenance line stays removed entirely (founder 2026-09-15 —
          the later ruling supersedes the earlier "demote to bottom" re-scope). */}
      <SloUptimeLine arena={category} productId={id} />
    </div>
  )
}
