import type { Metadata } from 'next'
import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import ProductLogoView from '@/components/ProductLogoView'
import { loadAll, stripPersonaPrefix } from '@/lib/data'
import { shortDate } from '@/lib/dates'
import { hasLogo } from '@/lib/logos'
import { pricingCoverage } from '@/lib/pricing'
import {
  currentlyDownSurfaces,
  hasMatureSloHistory,
  loadSloSummaries,
  SLO_SURFACE_LABELS,
} from '@/lib/slo'
import {
  arenaPipelineStats,
  mostWantedUntested,
  nextUpArenas,
  sitePipelineTotals,
} from '@/lib/testingPipeline'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

export const metadata: Metadata = {
  title: 'Testing pipeline — what we have NOT tested — Ultrametric',
  description:
    'The transparency board: every arena’s untested product user stories, the share of verdicts backed by hands-on probes, the most-wanted untested product/story pairs, and which arenas are next.',
}

// The answer to "what have you NOT tested" — a static transparency board that leads with the
// gaps (see lib/testingPipeline.ts). Review sites bury this; we headline it: an untested cell
// is a zero-evidence none/na, i.e. "we found nothing either way and never probed it", and it
// already can't contribute to any score.
export const dynamic = 'force-static'

export default function PipelinePage() {
  const categories = loadAll()
  const stats = categories.map(arenaPipelineStats).sort((a, b) => b.untestedPct - a.untestedPct)
  const totals = sitePipelineTotals(stats)
  const mostWanted = mostWantedUntested(categories)
  const nextUp = nextUpArenas(new Set(categories.map((c) => c.category.id)))
  // Pricing transparency index coverage (lib/pricing.ts): how many products in the covered
  // arenas have verbatim-extracted unit pricing vs an honest "pricing unclear" record.
  const pricing = pricingCoverage(
    categories.map((c) => ({ arenaId: c.category.id, productIds: c.products.map((p) => p.id) })),
  )
  // Agent-surface SLO monitoring (lib/slo.ts, grown every 6h by pipeline/scripts/slo-check.ts):
  // the shame list of documented surfaces currently DOWN, plus coverage stats.
  const now = new Date()
  const slo = loadSloSummaries(undefined, now)
  const sloDown = currentlyDownSurfaces(slo)
  const sloProducts = new Set(slo.map((s) => `${s.arena}/${s.productId}`)).size
  const sloBySurface = slo.reduce<Record<string, number>>((acc, s) => {
    acc[s.surface] = (acc[s.surface] ?? 0) + 1
    return acc
  }, {})
  const sloSince = slo.length > 0 ? slo.reduce((min, s) => (new Date(s.firstDate) < new Date(min) ? s.firstDate : min), slo[0].firstDate) : null
  const sloMature = slo.length > 0 && slo.every((s) => hasMatureSloHistory(s, now))
  const productNames = new Map(
    categories.flatMap((c) => c.products.map((p) => [`${c.category.id}/${p.id}`, { productName: p.name, arenaName: c.category.name }] as const)),
  )

  return (
    <div className="space-y-10">
      <div>
        {/* seed "pipeline": same concept mark as the Explore menu's Testing pipeline entry. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="pipeline" title="Testing pipeline — coverage and gaps" size={16} className="text-zinc-500" />
          Testing pipeline
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          What we have <span className="text-emerald-400">not</span> tested
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Every ranking on this site is built from per-product-user-story verdicts — and{' '}
          <span className="text-zinc-200 font-medium">
            {totals.untestedCells.toLocaleString()} of {totals.totalCells.toLocaleString()} product user stories
            ({totals.untestedPct}%)
          </span>{' '}
          are still untested: a zero-evidence none/na where we found nothing pro or con and never
          probed it. Those product user stories can&rsquo;t score — they read as unknown, never as 0 — and this
          page is the standing list of them. {totals.probedPct}% of all product user stories are backed by a
          hands-on probe.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          The flip side of this page — which products&rsquo; verdicts rest on the MOST tested evidence — is its own
          global ranking:{' '}
          <Link href="/rankings/most-tested" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            most tested →
          </Link>
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { id: 'cells-judged', label: 'product user stories judged', value: totals.totalCells.toLocaleString(), sub: `${totals.arenas} arenas` },
          { id: 'untested', label: 'still untested', value: `${totals.untestedPct}%`, sub: `${totals.untestedCells.toLocaleString()} zero-evidence product user stories` },
          { id: 'probed', label: 'probed hands-on', value: `${totals.probedPct}%`, sub: `${totals.probedCells.toLocaleString()} product user stories cite a probe` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-800 p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
              <GeoMark seed={stat.id} title={stat.label} size={14} className="text-zinc-600" />
              {stat.label}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-400">{stat.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{stat.sub}</p>
          </div>
        ))}
      </section>

      {pricing.coveredArenas > 0 && (
        <p className="max-w-2xl text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">Pricing coverage:</span>{' '}
          {pricing.extracted} of {pricing.coveredProducts} products in the {pricing.coveredArenas}{' '}
          pricing-covered arenas have unit pricing extracted verbatim from the vendor&rsquo;s own
          pricing page ({pricing.unclear} record an honest &ldquo;pricing unclear&rdquo; — JS-shell
          or quote-only pages we refuse to guess at). Every figure carries its source URL, exact
          quote, and fetch date; we never compute a price we didn&rsquo;t extract.
        </p>
      )}

      <section>
        <h2 className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
          <GeoMark seed="most-wanted" title="Most-wanted untested product user stories — the highest-impact gaps" size={18} className="text-zinc-500" />
          Most-wanted untested product user stories
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          The ten untested (product, story) pairs whose testing would move the most-read scores
          the most — heaviest stories on the most-watched products (capped at two per product so
          one giant can&rsquo;t fill the board). Have first-hand evidence for one? <Link href="/submit" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">Send it in</Link>.
        </p>
        <div className={`mt-4 ${TABLE_SHELL}`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th scope="col" className="px-3 py-2 font-normal">Product</th>
                <th scope="col" className="px-3 py-2 font-normal"><span title="A judged story whose verdict has no hands-on tested evidence yet — the next probe to run">Untested story</span></th>
                <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="The product category (arena) it competes in">Arena</span></th>
                <th scope="col" className="px-3 py-2 font-normal"><span title="How much the story counts in the arena's scoring — heavier stories are probed first">Weight</span></th>
                <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell"><span title="GitHub stars — adoption context for prioritizing probes, never part of any score">GitHub ★</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {mostWanted.map((cell) => (
                <tr key={`${cell.arenaId}:${cell.productId}:${cell.storyId}`} className="transition hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={`/arena/${cell.arenaId}/product/${cell.productId}#story-${cell.storyId}`}
                      className="inline-flex items-center gap-1.5 font-medium hover:text-emerald-300"
                    >
                      <ProductLogoView product={{ id: cell.productId, name: cell.productName }} size={16} hasLogo={hasLogo(cell.productId)} />
                      {cell.productName}
                    </Link>
                  </td>
                  <td className="max-w-[380px] px-3 py-2 text-zinc-300">
                    {stripPersonaPrefix(cell.storyTitle)}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-400 sm:table-cell">
                    <Link href={`/arena/${cell.arenaId}`} className="hover:text-emerald-300">
                      {cell.arenaName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">×{cell.weight}</td>
                  <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 md:table-cell">
                    {cell.stars === null ? <span className="font-sans text-xs italic text-zinc-500">no signal</span> : cell.stars.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
          <GeoMark seed="coverage" title="Coverage per arena — untested and probed shares" size={18} className="text-zinc-500" />
          Coverage per arena
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Sorted worst-first: the arenas with the largest untested share are where the rankings
          deserve the most skepticism — and the most contributed evidence.
        </p>
        <div className={`mt-4 ${TABLE_SHELL}`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th scope="col" className="px-3 py-2 font-normal">Arena</th>
                <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="Judged products in this arena">Products</span></th>
                <th scope="col" className="px-3 py-2 font-normal"><span title="Judged (product, story) verdict product user stories in this arena">Product user stories</span></th>
                <th scope="col" className="px-3 py-2 font-normal"><span title="Product user stories with no hands-on tested evidence yet">Untested</span></th>
                <th scope="col" className="px-3 py-2 font-normal"><span title="Share of product user stories backed by our own hands-on probes">Probed</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {stats.map((a) => (
                <tr key={a.arenaId} className="transition hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/arena/${a.arenaId}`} className="font-medium hover:text-emerald-300">
                      {a.arenaName}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2 font-mono tabular-nums text-zinc-400 sm:table-cell">{a.products}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{a.totalCells.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                    {a.untestedCells.toLocaleString()} <span className="text-zinc-500">({a.untestedPct}%)</span>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">{a.probedPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {slo.length > 0 && (
        <section id="slo" className="scroll-mt-16">
          <h2 className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
            <GeoMark seed="slo" title="Agent surface health — 6-hourly keyless uptime checks" size={18} className="text-zinc-500" />
            Agent surface health
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Every 6 hours we keylessly ping each product&rsquo;s documented agent surfaces — its{' '}
            <span className="font-mono text-xs">llms.txt</span>, remote MCP endpoint, and{' '}
            <span className="font-mono text-xs">openapi.json</span> where we previously found one.
            An auth-gated MCP endpoint answering 401 counts as up; only timeouts, 404/410 and 5xx
            count as down. Currently monitoring{' '}
            <span className="font-medium text-zinc-200">
              {slo.length} surfaces across {sloProducts} products
            </span>{' '}
            ({Object.entries(sloBySurface)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([s, n]) => `${n} ${SLO_SURFACE_LABELS[s as keyof typeof SLO_SURFACE_LABELS]}`)
              .join(' · ')}
            ){sloSince ? `, tracking since ${shortDate(sloSince)}` : ''}
            {!sloMature && ' — uptime percentages appear on product pages after a week of history'}.
          </p>
          {sloDown.length === 0 ? (
            <p className="mt-4 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300">
              <span className="text-emerald-400">all up</span> — every monitored agent
              surface answered its last check.
            </p>
          ) : (
            <div className={`mt-4 ${TABLE_SHELL}`}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className={TABLE_HEADER_ROW}>
                    <th scope="col" className="px-3 py-2 font-normal">Product</th>
                    <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell"><span title="The product category (arena) it competes in">Arena</span></th>
                    <th scope="col" className="px-3 py-2 font-normal"><span title="The monitored agent surface: llms.txt, MCP endpoint, or openapi.json">Surface</span></th>
                    <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">URL</th>
                    <th scope="col" className="px-3 py-2 font-normal"><span title="When our uptime monitor first saw this surface failing">Down since</span></th>
                    <th scope="col" className="px-3 py-2 font-normal"><span title="The HTTP status (or error) the monitor last received">Last status</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {sloDown.map((s) => {
                    const names = productNames.get(`${s.arena}/${s.productId}`)
                    return (
                      <tr key={`${s.arena}:${s.productId}:${s.surface}`} className="transition hover:bg-zinc-900/50">
                        <td className="whitespace-nowrap px-3 py-2">
                          <Link
                            href={`/arena/${s.arena}/product/${s.productId}`}
                            className="inline-flex items-center gap-1.5 font-medium hover:text-emerald-300"
                          >
                            <ProductLogoView
                              product={{ id: s.productId, name: names?.productName ?? s.productId }}
                              size={16}
                              hasLogo={hasLogo(s.productId)}
                            />
                            {names?.productName ?? s.productId}
                          </Link>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-zinc-400 sm:table-cell">
                          <Link href={`/arena/${s.arena}`} className="hover:text-emerald-300">
                            {names?.arenaName ?? s.arena}
                          </Link>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-red-400">{SLO_SURFACE_LABELS[s.surface]}</td>
                        <td className="hidden max-w-[280px] truncate px-3 py-2 font-mono text-xs text-zinc-400 md:table-cell">{s.url}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-300">{s.downSince ? shortDate(s.downSince) : '—'}</td>
                        <td className="px-3 py-2 font-mono tabular-nums text-xs text-zinc-300">{s.lastStatus === 0 ? 'timeout' : s.lastStatus}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {nextUp.length > 0 && (
        <section>
          <h2 className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
            <GeoMark seed="next-up" title="Next up — tier-1 arenas awaiting the pipeline" size={18} className="text-zinc-500" />
            Next up
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Tier-1 arenas on the roadmap that haven&rsquo;t been through the evidence pipeline
            yet — the categories we think matter most in an agent-first world, in no particular
            order.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nextUp.map((entry) => (
              <div key={entry.id} className="min-w-0 rounded-2xl border border-zinc-800 p-4">
                <h3 className="font-medium">{entry.name}</h3>
                {entry.aiEraAngle && <p className="mt-1 text-xs text-zinc-400">{entry.aiEraAngle}</p>}
                {entry.candidateProducts && entry.candidateProducts.length > 0 && (
                  <p className="mt-2 truncate text-[10px] uppercase tracking-wide text-zinc-500">
                    {entry.candidateProducts.slice(0, 5).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-zinc-500">
        Untested is a per-cell status: a none/na verdict that cites zero evidence (the same
        definition the tables use to render &ldquo;untested&rdquo; instead of 0 — see{' '}
        <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
          methodology
        </Link>
        ). &ldquo;Probed&rdquo; is stricter than &ldquo;evidenced&rdquo;: only verdicts citing a
        hands-on probe count.
      </p>
    </div>
  )
}
