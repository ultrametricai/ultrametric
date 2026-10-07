import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AiEraBadge from '@/components/AiEraBadge'
import { loadAll, loadCategory, stripPersonaPrefix } from '@/lib/data'
import {
  buildScoreBreakdown, DIMENSION_MEANINGS, type BreakdownCell, type DimensionBreakdown,
} from '@/lib/scoreBreakdown'
import { VERDICT_FACTORS } from '@/lib/scoring'
import { SITE_URL } from '@/lib/site'

// The per-vendor transparent calculation page — "the receipt". The generic /methodology says
// WHY the scores are built this way; this page shows HOW this one product's numbers were
// actually computed: every story that feeds each Overall-score dimension, its verdict × quality ×
// weight arithmetic with the cited evidence inline, the dimension fractions, and finally the
// weighted blend with this vendor's numbers substituted into the equation. Every number on the
// product page's above-fold pills is reproducible by reading top to bottom — and
// lib/__tests__/scoreBreakdown.test.ts asserts the recomputation matches rankings.json, so the
// page doubles as a standing determinism proof. Pure server component, zero client JS: the
// pills deep-link to #agent-ready / #api-quality / #built-in-ai and the sections light up via
// the CSS :target variant alone.

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
  return {
    title: `${product ? product.name : id} score calculation — ${data.category.name} Arena — Ultrametric`,
    description: `The transparent audit trail behind ${product ? product.name : id}'s Overall score: every judged story, verdict, cited evidence item, and the exact arithmetic from verdicts to the blended score.`,
    alternates: { canonical: `${SITE_URL}/arena/${category}/product/${id}/score` },
  }
}

// Ledger number formatting: scores/points at 1 decimal, blend weights at 2 — always the same
// precision the pipeline rounds to (lib/scoring.ts's round1), so a reader with a calculator
// lands on exactly the printed value.
const fmt1 = (n: number) => n.toFixed(1)
const fmt2 = (n: number) => n.toFixed(2)

// Verdict tier → the factor legend line, straight from the scoring constants so the page can
// never claim factors the code doesn't use.
const FACTOR_LEGEND = (['full', 'partial', 'disputed', 'none'] as const)
  .map((v) => `${v} ×${VERDICT_FACTORS[v].toFixed(1)}`)
  .join(' · ')

function CellLedger({ cell, productHref }: { cell: BreakdownCell; productHref: string }) {
  const { story, verdict } = cell
  const na = verdict.verdict === 'na'
  return (
    <div className="border-t border-zinc-800/70 py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <Link
          href={`${productHref}#story-${story.id}`}
          title="See this story's full row — rationale, evidence, vendor response — on the product page"
          className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
        >
          {stripPersonaPrefix(story.title)}
        </Link>
        <span className="text-xs text-zinc-500">weight {story.weight}</span>
      </p>
      {/* The cell arithmetic, verbatim: points = weight × quality × verdict factor. An n/a cell
          has no arithmetic to show — it leaves BOTH sides of the dimension fraction. */}
      {na ? (
        <p className="mt-1 text-xs tabular-nums text-zinc-500">
          n/a — not applicable to this product: excluded from numerator and denominator
        </p>
      ) : (
        <p className="mt-1 font-mono text-xs tabular-nums text-zinc-400">
          {story.weight} <span className="text-zinc-500">(weight)</span> × {verdict.quality}{' '}
          <span className="text-zinc-500">(quality)</span> × {cell.factor.toFixed(1)}{' '}
          <span className="text-zinc-500">({verdict.verdict})</span> = <span className="text-zinc-200">{fmt1(cell.points)}</span>{' '}
          <span className="text-zinc-500">of {cell.max} max</span>
        </p>
      )}
      {/* The exact evidence the judge cited for this verdict — linked, excerpt verbatim. A
          none/na cell with no citations rests on absence of evidence, said out loud. */}
      {cell.evidence.length === 0 ? (
        <p className="mt-1 text-xs italic text-zinc-500">
          no evidence cited — the verdict rests on absence of evidence, re-checked on refresh
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {cell.evidence.map((e) => (
            <li key={e.id} className="text-xs text-zinc-400">
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open the cited source (tier ${e.tier} evidence)`}
                className="underline decoration-zinc-800 hover:text-emerald-300"
              >
                [{e.tier}]
              </a>{' '}
              <span className="break-all text-zinc-500">{e.url}</span>
              <span className="mt-0.5 block text-zinc-500">&ldquo;{e.excerpt}&rdquo;</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DimensionSection({ dim, productHref }: { dim: DimensionBreakdown; productHref: string }) {
  return (
    <section
      id={dim.anchor}
      // :target highlight — the pill deep links land here, and the section lights up with no JS.
      className="scroll-mt-16 rounded-xl border border-zinc-800 p-5 target:border-emerald-400/60"
    >
      <h2 className="font-display leading-[1.1] flex flex-wrap items-baseline gap-x-3 text-lg font-semibold">
        {dim.label}
        <span className="text-base tabular-nums text-emerald-300">
          {dim.score === null ? 'n/a' : <>{fmt1(dim.score)}<span className="text-zinc-500">/100</span></>}
        </span>
        <span className="text-xs font-normal text-zinc-500">×{fmt2(dim.weight)} of the Overall-score blend</span>
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">{DIMENSION_MEANINGS[dim.key]}</p>
      {dim.cells.length === 0 ? (
        <p className="mt-3 text-sm italic text-zinc-500">
          This arena&rsquo;s story taxonomy has no stories on this axis — unscored, and the blend
          renormalizes its weight away.
        </p>
      ) : (
        <div className="mt-3">
          {dim.cells.map((cell) => (
            <CellLedger key={cell.story.id} cell={cell} productHref={productHref} />
          ))}
        </div>
      )}
      {/* The dimension total — the same fraction lib/scoring.ts's weightedPercent computes. */}
      {dim.cells.length > 0 && (
        <p className="mt-1 border-t border-zinc-700 pt-3 font-mono text-sm tabular-nums text-zinc-300">
          {dim.score === null ? (
            <span className="italic text-zinc-500">
              every product user story n/a — unscored (not zero), excluded from the blend
            </span>
          ) : (
            <>
              {dim.label} = {fmt1(dim.numerator)} ÷ {dim.denominator} × 100 ={' '}
              <span className="font-bold text-emerald-300">{fmt1(dim.score)}</span>
            </>
          )}
        </p>
      )}
    </section>
  )
}

export default async function ScorePage({
  params,
}: {
  params: Promise<{ category: string; id: string }>
}) {
  const { category, id } = await params
  const data = loadCategory(category)
  const product = data.products.find((p) => p.id === id)
  if (!product) notFound()
  const breakdown = buildScoreBreakdown(data, id)
  const { blend } = breakdown
  const live = blend.terms.filter((t) => t.score !== null)
  const excluded = blend.terms.filter((t) => t.score === null)
  const productHref = `/arena/${category}/product/${id}`

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
          <Link href="/" className="transition hover:text-emerald-300">Rankings</Link>
          <span aria-hidden className="text-zinc-700">→</span>
          <Link href={`/arena/${category}`} className="transition hover:text-emerald-300">
            {data.category.name}
          </Link>
          <span aria-hidden className="text-zinc-700">→</span>
          <Link href={productHref} className="transition hover:text-emerald-300">{product.name}</Link>
          <span aria-hidden className="text-zinc-700">→</span>
          <span className="text-zinc-400">Score calculation</span>
        </nav>
        <h1 className="font-display leading-[1.1] mt-2 text-3xl font-bold tracking-tight">
          How {product.name}&rsquo;s scores are calculated
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          The full audit trail, recomputed from the verdict data at build time through the same
          code that produced the leaderboard: verdict × quality × story weight per cell, cells
          sum to dimension scores, dimensions blend into the Overall score. Every number on the{' '}
          <Link href={productHref} className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200">product page</Link>{' '}
          is reproducible from this page alone; for why the formula looks like this, see the{' '}
          <Link href="/methodology#arena-score" className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200">methodology</Link>.
        </p>
        <p className="mt-2 font-mono text-xs tabular-nums text-zinc-500">
          verdict factors: {FACTOR_LEGEND} · n/a excluded from both sides · cell points = weight × quality × factor · cell max = weight × 10
        </p>
      </div>

      {/* The blend — the equation at the top of the receipt, this vendor's numbers substituted.
          The anchor id is legacy, pre-rename — value immutable: published deep links target it. */}
      <section id="pa-score" className="scroll-mt-16 rounded-xl border border-emerald-400/40 p-5 target:border-emerald-400/80">
        <h2 className="font-display leading-[1.1] flex flex-wrap items-center gap-x-3 text-lg font-semibold">
          Overall score
          <AiEraBadge value={blend.aiEra} />
        </h2>
        <div className="mt-3 space-y-1 font-mono text-sm tabular-nums">
          {blend.terms.map((t) => (
            <p key={t.key} className={t.score === null ? 'text-zinc-500' : 'text-zinc-300'}>
              <a href={`#${t.anchor}`} className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300">
                {t.label}
              </a>{' '}
              {t.score === null ? (
                <span className="italic">n/a — excluded, its ×{fmt2(t.weight)} weight renormalized away</span>
              ) : (
                <>
                  {fmt1(t.score)} × {fmt2(t.weight)} = <span className="text-zinc-200">{fmt2(t.score * t.weight)}</span>
                </>
              )}
            </p>
          ))}
          {blend.aiEra === null ? (
            <p className="border-t border-zinc-700 pt-2 italic text-zinc-500">
              every component n/a — no Overall score to compute
            </p>
          ) : (
            <p className="border-t border-zinc-700 pt-2 text-zinc-300">
              ({live.map((t) => fmt2(t.score! * t.weight)).join(' + ')}) ÷ ({live.map((t) => fmt2(t.weight)).join(' + ')})
              {' '}= {fmt2(blend.weightedSum)} ÷ {fmt2(blend.totalWeight)} ={' '}
              <span className="font-bold text-emerald-300">{fmt1(blend.aiEra)}</span>
              {excluded.length > 0 && (
                <span className="text-zinc-500"> — weights renormalized over the scored components</span>
              )}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Scores are stored to 1 decimal; the product page&rsquo;s pills round to whole numbers for
          display. Each dimension below shows the stories, verdicts, and cited evidence behind its number.
        </p>
      </section>

      {breakdown.dimensions.map((dim) => (
        <DimensionSection key={dim.key} dim={dim} productHref={productHref} />
      ))}
    </div>
  )
}
