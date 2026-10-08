import type { Metadata } from 'next'
import Link from 'next/link'
import PersonaChip from '@/components/PersonaChip'
import PrintButton from '@/components/PrintButton'
import { checklistThemes, priorityForWeight } from '@/lib/checklist'
import { confidenceFor } from '@/lib/confidence'
import ThemeIcon from '@/components/ThemeIcon'
import { loadAll, loadCategory } from '@/lib/data'
import { parseStoryPersona } from '@/lib/storyText'
import { humanizeTheme, themeExplanation } from '@/lib/icons'
import { categoryFreshness } from '@/lib/freshness'
import { isPricingUnavailable, loadPricing, pricingCellFor } from '@/lib/pricing'
import { loadProofIndex } from '@/lib/proofs'
import { SITE_URL } from '@/lib/site'
import { isCloseRace, isUncertain } from '@/lib/uncertainty'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// Procurement-grade arena report: one static, print-optimized page per arena assembling the
// evidence a buying process actually asks for — leaderboard, buyer checklist (lib/checklist.ts),
// pricing signals where the pricing lane covers the arena, the recorded-proof appendix, the
// close-race/uncertainty caveat, and a license + citation footer. "Download PDF" is just
// window.print() (components/PrintButton.tsx): the print CSS in globals.css (scoped to
// .print-report) flattens the dark theme to black-on-white with sane page breaks, so the
// browser's save-as-PDF produces the artifact with no PDF dependency.

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
  const year = new Date().getFullYear()
  return {
    title: `${data.category.name} procurement report (${year}) — Ultrametric`,
    description: `A print-ready ${data.category.name} procurement report: the agent-tested leaderboard for ${data.products.length} products, the ${data.stories.length}-requirement buyer checklist, pricing signals, recorded probes, and honest uncertainty notes.`,
    alternates: { canonical: `${SITE_URL}/arena/${category}/report` },
  }
}

const METHODOLOGY_ONE_LINER =
  'Every product is judged against a shared taxonomy of user stories using cited evidence — hands-on probes > repository code > independent community sources > vendor claims — never opinion.'

function fmtScore(n: number | null): string {
  return n === null ? '—' : n.toFixed(1)
}

export default async function ArenaReportPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const data = loadCategory(category)
  const productById = new Map(data.products.map((p) => [p.id, p]))
  const freshness = categoryFreshness(data)
  const themes = checklistThemes(data.stories)

  // Close-race / uncertainty note: same qualification as the weekly report's close-races section
  // (pipeline/scripts/generate-weekly-report.ts) — the arena has been through the multi-judge
  // uncertainty pass AND the current #1/#2 gap still qualifies.
  const [top1, top2] = data.rankings.leaderboard
  const closeRace =
    data.uncertainty.length > 0 && top1 && top2 && isCloseRace(top1.aiEra, top2.aiEra)
      ? {
          top1Name: productById.get(top1.productId)?.name ?? top1.productId,
          top1AiEra: top1.aiEra!,
          top2Name: productById.get(top2.productId)?.name ?? top2.productId,
          top2AiEra: top2.aiEra!,
          contested: data.uncertainty.length,
          unstable: data.uncertainty.filter((u) => isUncertain(u.agreement)).length,
        }
      : null

  // Pricing signals, leaderboard order — only rendered when the pricing lane covers this arena
  // (see lib/pricing.ts's tolerant-optional contract: empty map = no section, never an error).
  const pricingMap = loadPricing(category)
  interface PricingRow {
    productId: string
    name: string
    unclear: string | null
    cell: { label: string; unit: string } | null
    asOf: string
  }
  const pricingRows = data.rankings.leaderboard.flatMap((entry): PricingRow[] => {
    const pricing = pricingMap[entry.productId]
    if (!pricing) return []
    const name = productById.get(entry.productId)?.name ?? entry.productId
    if (isPricingUnavailable(pricing)) {
      return [{ productId: entry.productId, name, unclear: pricing.reason, cell: null, asOf: pricing.fetchedAt.slice(0, 10) }]
    }
    const cell = pricingCellFor(pricing, category)
    if (!cell || 'unclear' in cell) return []
    return [{ productId: entry.productId, name, unclear: null, cell, asOf: cell.asOf }]
  })

  const proofs = loadProofIndex(category)
  const reportDate = data.rankings.generatedAt.slice(0, 10)

  return (
    <div className="print-report mx-auto max-w-3xl space-y-10">
      {/* Cover block */}
      <section>
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          <Link href={`/arena/${category}`} className="hover:text-emerald-300">
            {data.category.name} Ranking
          </Link>
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          {data.category.name} — procurement report
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ultrametric · rankings as of {reportDate}
          {freshness && <> · evidence as of {freshness}</>} · {data.products.length} products ·{' '}
          {data.stories.length} judged requirements · {data.verdicts.length} judged cells
        </p>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          <span className="font-semibold text-zinc-300">Methodology:</span> {METHODOLOGY_ONE_LINER}{' '}
          Full writeup: {SITE_URL}/methodology
        </p>
        <div className="mt-4">
          <PrintButton />
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="font-display leading-[1.1] mb-3 text-lg font-semibold">Leaderboard</h2>
        <div className={TABLE_SHELL}>
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className="px-3 py-2 font-normal">#</th>
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 text-right font-normal"><span title="Overall score (0–100): the blended headline score — mostly agent-readiness and API quality, plus openness and built-in AI">Overall score</span></th>
                <th className="px-3 py-2 text-right font-normal"><span title="Story coverage (0–100): how much of the ranking's judged story set the product delivers, weighted by importance">Coverage score</span></th>
                <th className="px-3 py-2 text-right font-normal"><span title="Judged (product, story) product user stories that apply to this product — n/a stories excluded">Applicable product user stories</span></th>
                <th className="px-3 py-2 text-right font-normal"><span title="Mean judge confidence across this product's verdicts">Confidence</span></th>
              </tr>
            </thead>
            <tbody>
              {data.rankings.leaderboard.map((entry, i) => {
                const product = productById.get(entry.productId)
                if (!product) return null
                const confidence = confidenceFor(data, entry.productId)
                return (
                  <tr key={entry.productId} className="border-b border-zinc-800/60 last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-xs text-zinc-500">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <Link href={`/arena/${category}/product/${product.id}`} className="text-zinc-200 hover:text-emerald-300">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtScore(entry.aiEra)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{fmtScore(entry.score)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">
                      {entry.applicable}/{entry.total}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{confidence.grade}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Overall score = agent-readiness blend (see methodology). Coverage score = weighted share of judged
          requirements met. Confidence = how much of the score rests on tested vs claimed evidence (A–D).
        </p>
      </section>

      {/* Close race / uncertainty note */}
      <section>
        <h2 className="font-display leading-[1.1] mb-2 text-lg font-semibold">Uncertainty note</h2>
        {closeRace ? (
          <p className="max-w-2xl text-sm text-zinc-400">
            This ranking is currently a <span className="font-semibold text-zinc-300">close race</span>:{' '}
            {closeRace.top1Name} ({closeRace.top1AiEra.toFixed(1)}) vs {closeRace.top2Name} (
            {closeRace.top2AiEra.toFixed(1)}), a gap of{' '}
            {Math.abs(closeRace.top1AiEra - closeRace.top2AiEra).toFixed(1)} Overall score. The ordering was
            re-checked with extra judge samples: {closeRace.contested} decisive cells were triple-judged and{' '}
            {closeRace.unstable} came back unstable. Treat the #1/#2 ordering as contested — shortlist both.
          </p>
        ) : (
          <p className="max-w-2xl text-sm text-zinc-400">
            The current #1/#2 gap in this ranking is not close enough to qualify for the multi-judge
            uncertainty pass{data.uncertainty.length === 0 ? ' (or the pass has not covered it yet)' : ''} —
            no extra caveat applies beyond the per-product confidence grades above.
          </p>
        )}
      </section>

      {/* Buyer checklist */}
      <section className="print-break-before">
        <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold">Buyer checklist (RFP)</h2>
        <p className="mb-4 max-w-2xl text-xs text-zinc-400">
          The ranking&apos;s {data.stories.length} judged user stories as requirements, grouped by theme.
          Priorities mirror the story weights our scoring uses (3 = must-have, 2 = should-have, 1 =
          nice-to-have). Interactive version with per-requirement verdicts for the top products:{' '}
          <Link href={`/arena/${category}/checklist`} className="text-emerald-300 hover:underline">
            /arena/{category}/checklist
          </Link>
        </p>
        <div className="space-y-5">
          {themes.map(([theme, stories]) => (
            <div key={theme}>
              <h3 className="font-display leading-[1.1] flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                <ThemeIcon theme={theme} />
                {humanizeTheme(theme)}
              </h3>
              {/* Visible one-liner explaining this story grouping — not just the icon tooltip. */}
              <p className="mb-1.5 mt-0.5 truncate text-xs text-zinc-400">{themeExplanation(theme)}</p>
              <ul className="space-y-1">
                {stories.map((s) => {
                  // Checklist lines lead with the action; the "As a {persona}," frame becomes
                  // a chip (lib/storyText.ts) instead of repeating on every requirement.
                  const parsed = parseStoryPersona(s.title)
                  return (
                  <li key={s.id} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span aria-hidden className="mt-0.5 inline-block size-3.5 shrink-0 rounded-sm border border-zinc-600" />
                    <span className="min-w-0">
                      <PersonaChip persona={parsed.persona ?? s.persona} className="mr-1.5" />
                      {parsed.action}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                      {priorityForWeight(s.weight)}
                    </span>
                  </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing signals — only where the pricing lane covers this arena */}
      {pricingRows.length > 0 && (
        <section className="print-break-before">
          <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold">Pricing signals</h2>
          <p className="mb-3 max-w-2xl text-xs text-zinc-400">
            Extracted verbatim from each vendor&apos;s own pricing page — never converted, averaged, or
            derived. Products whose page prints no unit price are recorded as unclear.
          </p>
          <div className={TABLE_SHELL}>
            <table className="w-full text-sm">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th className="px-3 py-2 font-normal">Product</th>
                  <th className="px-3 py-2 font-normal"><span title="The lead price from the vendor's public pricing page — a signal, not a quote">Headline price</span></th>
                  <th className="px-3 py-2 font-normal"><span title="What that price buys (per seat/month, per 1k calls…)">Unit</span></th>
                  <th className="px-3 py-2 text-right font-normal"><span title="When we last read the vendor's pricing page">As of</span></th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map((row) => (
                  <tr key={row.productId} className="border-b border-zinc-800/60 last:border-b-0">
                    <td className="px-3 py-1.5 text-zinc-200">{row.name}</td>
                    {row.cell ? (
                      <>
                        <td className="px-3 py-1.5 font-mono">{row.cell.label}</td>
                        <td className="px-3 py-1.5 text-zinc-400">{row.cell.unit}</td>
                      </>
                    ) : (
                      <td colSpan={2} className="px-3 py-1.5 text-xs italic text-zinc-500">
                        pricing unclear — {row.unclear}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-xs text-zinc-500">{row.asOf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Proofs appendix */}
      <section className={pricingRows.length > 0 ? undefined : 'print-break-before'}>
        <h2 className="font-display leading-[1.1] mb-1 text-lg font-semibold">Appendix: recorded probes</h2>
        {proofs.length === 0 ? (
          <p className="max-w-2xl text-sm text-zinc-400">
            No replayable probe recordings exist for this ranking yet. Probe-tier evidence (hands-on checks)
            still backs verdicts where cited — see each product page for the evidence trail.
          </p>
        ) : (
          <>
            <p className="mb-3 max-w-2xl text-xs text-zinc-400">
              Hands-on probe recordings — transcripts/videos a human can replay, the strongest evidence tier.
              Watch them at {SITE_URL}/proofs
            </p>
            <ul className="space-y-1.5 text-sm">
              {proofs.map((proof) => (
                <li key={`${proof.productId}-${proof.probeId}`} className="flex flex-wrap items-baseline gap-x-2 text-zinc-300">
                  <span className="font-medium text-zinc-200">
                    {productById.get(proof.productId)?.name ?? proof.productId}
                  </span>
                  <code className="rounded bg-zinc-900 px-1 py-0.5 text-xs text-zinc-400">{proof.command}</code>
                  <span className="text-xs text-zinc-500">
                    {proof.kind} · recorded {proof.recordedAt.slice(0, 10)} · exit {proof.exitCode}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* License + citation footer */}
      <section className="rounded-xl border border-zinc-800 p-4 text-xs text-zinc-500">
        <p>
          <span className="font-semibold text-zinc-400">Cite as:</span> Ultrametric by Ultrametric Inc,{' '}
          {data.category.name} ranking, leaderboard as of {reportDate} — {SITE_URL}/arena/{category}
        </p>
        <p className="mt-2">
          <span className="font-semibold text-zinc-400">License:</span> © 2026 Ultrametric Inc. Brief
          quotation of individual verdicts, scores, or evidence excerpts is permitted with attribution to
          &quot;Ultrametric by Ultrametric Inc (ultrametric.ai)&quot;, as is use of the data to
          evaluate, contest, or contribute corrections. Bulk copying, redistribution, or use to build
          competing datasets requires prior written permission (see DATA-LICENSE in the repository).
        </p>
        <p className="mt-2">
          <span className="font-semibold text-zinc-400">No liability:</span> rankings, verdicts, and scores are
          research outputs derived from the cited evidence at a point in time, provided &quot;as is&quot;, without
          warranties. Ultrametric Inc accepts no responsibility for procurement, purchasing, or other decisions made
          in reliance on them — verify against the cited evidence before acting ({SITE_URL}/terms).
        </p>
      </section>
    </div>
  )
}
