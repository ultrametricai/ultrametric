import type { Metadata } from 'next'
import Link from 'next/link'
import ProductLogoView from '@/components/ProductLogoView'
import { loadAll } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { shortDate } from '@/lib/dates'
import {
  CLOSE_RACE_THRESHOLD, loadPredictions, PREDICTION_WINDOW_DAYS, type PredictionQuestion,
} from '@/lib/predictions'
import { REPO } from '@/lib/site'

// The prediction layer, v1: yes/no questions auto-generated from live close races (arena #1 vs
// #2 within CLOSE_RACE_THRESHOLD Overall score points — the same definition the multi-judge
// uncertainty pass uses) and settled mechanically from the public changelog's rank-flip events.
// Nothing here is editorial: the generator (pipeline/scripts/generate-predictions.ts) and the
// settler (pipeline/scripts/settle-predictions.ts) are both deterministic on the committed data.

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Predictions — open and settled overtake questions — Ultrametric',
  description:
    'Yes/no questions auto-generated from live close races — will the #2 overtake the #1 within 30 days? Settled mechanically from the public changelog, never by opinion.',
}

function predictUrl(q: PredictionQuestion): string {
  // Prefills the issue form (.github/ISSUE_TEMPLATE/prediction.yml) — query params matching
  // the form's field ids populate the fields, same mechanism as the per-verdict contest link.
  const params = new URLSearchParams({
    template: 'prediction.yml',
    title: `[prediction] ${q.id}`,
    'question-id': q.id,
  })
  return `https://github.com/${REPO}/issues/new?${params.toString()}`
}

const ARENA_LINK = 'text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300'
const PRODUCT_LINK = 'font-medium text-zinc-100 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300'

export default function PredictionsPage() {
  const predictions = loadPredictions()
  const arenas = new Map(loadAll().map((d) => [d.category.id, d]))

  const open = predictions
    .filter((q) => q.status === 'open')
    .sort((a, b) => new Date(a.settlesBy).getTime() - new Date(b.settlesBy).getTime() || a.id.localeCompare(b.id))
  const settled = predictions
    .filter((q) => q.status === 'settled')
    .sort((a, b) => new Date(b.settlesBy).getTime() - new Date(a.settlesBy).getTime() || a.id.localeCompare(b.id))

  // Current standing of the two products (scores move after a question opens — that's the
  // point). A product missing from today's leaderboard renders without a score, never an error.
  const currentScore = (arena: string, productId: string): number | null => {
    const entry = arenas.get(arena)?.rankings.leaderboard.find((e) => e.productId === productId)
    return entry?.aiEra ?? null
  }
  const productName = (arena: string, productId: string): string =>
    arenas.get(arena)?.products.find((p) => p.id === productId)?.name ?? productId

  const productCell = (q: PredictionQuestion, productId: string, role: 'challenger' | 'leader') => {
    const score = currentScore(q.arena, productId)
    return (
      <span>
        <Link href={`/arena/${q.arena}/product/${productId}`} className={`inline-flex items-center gap-1.5 ${PRODUCT_LINK}`}>
          <ProductLogoView
            product={{ id: productId, name: productName(q.arena, productId) }}
            size={16}
            hasLogo={hasLogo(productId)}
          />
          {productName(q.arena, productId)}
        </Link>{' '}
        <span className="text-xs tabular-nums text-zinc-500">
          ({role === 'challenger' ? '#2 at open' : '#1 at open'}
          {score !== null ? `, now ${score.toFixed(1)}` : ''})
        </span>
      </span>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Predictions</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Predictions — open and settled overtake questions</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Whenever a ranking&rsquo;s #1 and #2 are within {CLOSE_RACE_THRESHOLD.toFixed(1)} Overall score points — the same
          &ldquo;close race&rdquo; bar that triggers the multi-judge uncertainty pass — a yes/no question opens
          automatically: will the challenger overtake the leader within {PREDICTION_WINDOW_DAYS} days? Settlement is
          mechanical: <span className="text-zinc-300">yes</span> cites the exact rank-flip event on the{' '}
          <Link href="/changelog" className={ARENA_LINK}>changelog</Link>, <span className="text-zinc-300">no</span> is
          simply the deadline passing without one. No question is ever written or settled by hand.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Honest v1 scoping: predicting opens a prefilled GitHub issue, and your prediction is the submitted issue —
          recorded in public, timestamped by GitHub, before the outcome is known. There is no scoring or accuracy
          leaderboard yet; that comes once there&rsquo;s a real volume of settled predictions to score.
        </p>
      </div>

      <section>
        <h2 className="font-display leading-[1.1] text-lg font-semibold">
          Open questions <span className="ml-1 text-xs font-normal text-zinc-500">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm italic text-zinc-500">No open questions — no ranking is a close race right now.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {open.map((q) => (
              <li key={q.id} className="rounded-xl border border-zinc-800 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/arena/${q.arena}`} className={ARENA_LINK}>
                    {arenas.get(q.arena)?.category.name ?? q.arena}
                  </Link>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{q.id}</span>
                </div>
                <p className="mt-1.5 text-zinc-100">{q.question}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-400">
                  {productCell(q, q.productA, 'challenger')}
                  <span className="text-zinc-500">vs</span>
                  {productCell(q, q.productB, 'leader')}
                  {(() => {
                    const a = currentScore(q.arena, q.productA)
                    const b = currentScore(q.arena, q.productB)
                    return a !== null && b !== null ? (
                      <span className="text-xs tabular-nums text-zinc-500" title="Absolute difference between the two products' current Overall scores — the margin the challenger has to close">current gap {Math.abs(b - a).toFixed(1)}</span>
                    ) : null
                  })()}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-500">
                    settles by <span className="text-zinc-400">{shortDate(q.settlesBy.slice(0, 10))}</span>
                  </span>
                  <a
                    href={predictUrl(q)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-800 px-2.5 py-1 text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
                  >
                    Predict →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display leading-[1.1] text-lg font-semibold">
          Settled questions <span className="ml-1 text-xs font-normal text-zinc-500">{settled.length}</span>
        </h2>
        {settled.length === 0 ? (
          <p className="mt-2 text-sm italic text-zinc-500">
            Nothing settled yet — the first deadlines are {PREDICTION_WINDOW_DAYS} days out from the first questions.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {settled.map((q) => {
              // settledBy for 'yes' outcomes: "overtake:{arena}:{a}>{b}@{iso}" (see
              // lib/predictions.ts's settlementRef) — the date after '@' is the flip moment.
              const flipDay = q.settledBy?.split('@')[1]?.slice(0, 10)
              return (
                <li key={q.id} className="rounded-xl border border-zinc-800 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/arena/${q.arena}`} className={ARENA_LINK}>
                      {arenas.get(q.arena)?.category.name ?? q.arena}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{q.id}</span>
                  </div>
                  <p className="mt-1.5 text-zinc-100">{q.question}</p>
                  <p className="mt-2 text-sm">
                    {q.outcome === 'yes' ? (
                      <span>
                        <span className="font-semibold text-emerald-400">settled YES</span>
                        <span className="text-zinc-400">
                          {' '}— {productName(q.arena, q.productA)} overtook {productName(q.arena, q.productB)}
                          {flipDay ? ` on ${shortDate(flipDay)}` : ''}, see the{' '}
                          <Link href="/changelog" className={ARENA_LINK}>changelog</Link>
                        </span>
                      </span>
                    ) : (
                      <span>
                        <span className="font-semibold text-zinc-300">settled NO</span>
                        <span className="text-zinc-400">
                          {' '}— the deadline ({shortDate(q.settlesBy.slice(0, 10))}) passed without the flip
                        </span>
                      </span>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
        <h2 className="font-display text-base font-semibold text-zinc-200">How this works</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            Questions are auto-generated from judges-split close races: when a ranking&rsquo;s top two are within{' '}
            {CLOSE_RACE_THRESHOLD.toFixed(1)} Overall score points, the ranking is genuinely uncertain (it&rsquo;s the
            same threshold that triggers extra judge samples in the{' '}
            <Link href="/methodology" className={ARENA_LINK}>methodology</Link>&rsquo;s uncertainty pass), so the
            question is worth asking. One open question per ranking pair; a new one can open after the old one settles.
          </li>
          <li>
            Settlement is mechanical, from the public <Link href="/changelog" className={ARENA_LINK}>changelog</Link>:
            the changelog&rsquo;s rank-flip events are re-derived from the committed score history, and a question
            settles <span className="text-zinc-300">yes</span> only by citing one of those events — dated before the
            deadline — verbatim in <code className="font-mono text-xs">data/predictions.json</code>.
          </li>
          <li>
            Your prediction is a GitHub issue (the &ldquo;Predict&rdquo; link prefills the form with the question id).
            v1 records predictions as submitted issues, nothing more — an accuracy leaderboard comes later, once
            enough questions have settled to score anyone honestly.
          </li>
        </ul>
      </section>
    </div>
  )
}
