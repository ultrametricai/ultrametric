'use client'

import Link from 'next/link'
import { useMyStackMap } from '@/components/useMyStackMap'
import { runProcessCheck, STEP_UPGRADE_DELTA, type ProcessCheckStep } from '@/lib/processCheck'
import { loginUrl, registrationUrl, useSession } from '@/lib/session'

// The client half of /processes/[slug]/mine ("Check my process", founder ask: sign up →
// configure your vendors → run the process with upgrade recommendations). The PUBLIC process
// page stays the one shared SEO version; this personalized view lives at its own noindex route
// and renders entirely client-side over the page's pre-serialized step rankings
// (lib/processCheckData.ts) + the reader's account stack (lib/myStack.ts) — the WatchlistClient
// pattern: static rows for everyone, the selection never leaves the browser/account store.
//
// Three states, same client-side gating contract as components/WatchlistGate.tsx:
//   signed out            → sign-up/log-in prompt (return_to brings the reader back here);
//   signed in, no stack   → pointer to /my-stack to configure vendors;
//   signed in, stack set  → per-step: YOUR vendor's story-derived step score vs the step's
//                           best, steps trailing by more than STEP_UPGRADE_DELTA flagged with
//                           the upgrade suggestion, plus the coverage summary line.

const receiptHref = (arenaId: string, productId: string) =>
  `/arena/${arenaId}/product/${productId}/score`

function AuthPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-400">
      <p>
        <span aria-hidden className="mr-2 text-zinc-500">▣</span>
        Sign up (or log in) to run this process with your own stack: configure the vendors you
        use once, and every process page can show your step scores against the market&rsquo;s
        best, with upgrade recommendations.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={registrationUrl('/processes')}
          onClick={(e) => {
            e.preventDefault()
            window.location.href = registrationUrl(window.location.href)
          }}
          className="inline-block rounded-lg border border-emerald-400/60 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10"
        >
          Sign up
        </a>
        <a
          href={loginUrl('/processes')}
          onClick={(e) => {
            e.preventDefault()
            window.location.href = loginUrl(window.location.href)
          }}
          className="inline-block rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
        >
          Log in
        </a>
      </div>
    </div>
  )
}

export default function ProcessCheck({
  steps,
  totalSteps,
}: {
  steps: ProcessCheckStep[]
  totalSteps: number
}) {
  const session = useSession()
  const stack = useMyStackMap()

  if (session.state === 'loading') return null
  if (session.state === 'anonymous') return <AuthPrompt />

  if (Object.keys(stack).length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-400">
        <p>
          You haven&rsquo;t set up your stack yet — pick the vendors you actually use (several
          per ranking is fine) and this page will score them per step against the market&rsquo;s
          best.
        </p>
        <Link
          href="/my-stack"
          className="mt-3 inline-block rounded-lg border border-emerald-400/60 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10"
        >
          Configure your stack →
        </Link>
      </div>
    )
  }

  const check = runProcessCheck(steps, stack)

  return (
    <div className="space-y-4">
      {/* The headline: coverage × quality of THEIR stack on this process's rankable steps. */}
      <p className="text-sm text-zinc-300">
        Your stack covers{' '}
        <span className="tabular-nums text-emerald-400">{check.coveredSteps}</span> of{' '}
        <span className="tabular-nums">{check.rankableSteps}</span> rankable steps
        <span className="text-zinc-500"> (of {totalSteps} total)</span>
        {check.avgYours !== null && (
          <>
            {' '}at avg{' '}
            <span className="tabular-nums text-emerald-400">{check.avgYours.toFixed(0)}</span>
            <span className="text-zinc-500">/100</span> vs best{' '}
            <span className="tabular-nums text-emerald-400">{(check.avgBest ?? 0).toFixed(0)}</span>
            <span className="text-zinc-500">/100</span>
            <span className="text-zinc-500"> on those steps</span>
          </>
        )}
        .
        {check.flaggedSteps > 0 && (
          <span className="ml-1 text-amber-300">
            {check.flaggedSteps} step{check.flaggedSteps === 1 ? '' : 's'} flagged (Δ&gt;{STEP_UPGRADE_DELTA}, or a pick that is shutting down).
          </span>
        )}
      </p>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        {check.steps.map((s) => (
          <div
            key={s.nodeId}
            className={`border-b border-zinc-800/70 px-4 py-2.5 last:border-b-0 ${s.flagged ? 'bg-amber-400/5' : ''}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="min-w-0 grow truncate text-sm text-zinc-200">{s.label}</span>
              {s.yours === null ? (
                <span className="shrink-0 text-xs text-zinc-500" title="None of your picks has a judged verdict on this step's mapped stories">
                  no pick with judged evidence
                </span>
              ) : (
                <span className="shrink-0 text-xs text-zinc-400">
                  yours:{' '}
                  <Link
                    href={`/arena/${s.yours.arenaId}/product/${s.yours.productId}`}
                    className="text-zinc-200 hover:text-emerald-300"
                  >
                    {s.yours.name}
                  </Link>{' '}
                  <span
                    className="font-mono tabular-nums text-emerald-400/90"
                    title={`Story-derived step score from judged verdicts on the ${s.storyCount} stories mapped to this step`}
                  >
                    {s.yours.score.toFixed(0)}
                  </span>
                  <span className="text-zinc-500">/100</span>
                  <span className="mx-1.5 text-zinc-700">·</span>
                  best:{' '}
                  <Link
                    href={`/arena/${s.best.arenaId}/product/${s.best.productId}`}
                    className="text-zinc-300 hover:text-emerald-300"
                  >
                    {s.best.name}
                  </Link>{' '}
                  <span className="font-mono tabular-nums text-zinc-300">{s.best.score.toFixed(0)}</span>
                  <span className="text-zinc-500">/100</span>
                </span>
              )}
            </div>
            {/* A shutdown pick is always flagged (lib/processCheck.ts) — the reason is the
                vendor's own announcement, not the delta, so say so instead of a Δ line. */}
            {s.flagged && s.yours !== null && s.yours.shutdown && (
              <p className="mt-1 text-xs text-amber-300/90">
                {s.yours.name} is shutting down — migrate; the step&rsquo;s best is{' '}
                <Link href={`/arena/${s.best.arenaId}/product/${s.best.productId}`} className="underline decoration-amber-400/40 hover:text-amber-200">
                  {s.best.name}
                </Link>{' '}
                (
                <Link href={receiptHref(s.best.arenaId, s.best.productId)} className="underline decoration-amber-400/40 hover:text-amber-200">
                  score receipt
                </Link>
                ).
              </p>
            )}
            {s.flagged && s.yours !== null && !s.yours.shutdown && (
              <p className="mt-1 text-xs text-amber-300/90">
                Δ{(s.delta as number).toFixed(0)} behind on this step&rsquo;s judged stories — consider{' '}
                <Link href={`/arena/${s.best.arenaId}/product/${s.best.productId}`} className="underline decoration-amber-400/40 hover:text-amber-200">
                  {s.best.name}
                </Link>{' '}
                (
                <Link href={receiptHref(s.best.arenaId, s.best.productId)} className="underline decoration-amber-400/40 hover:text-amber-200">
                  score receipt
                </Link>
                {' '}·{' '}
                <Link href={receiptHref(s.yours.arenaId, s.yours.productId)} className="underline decoration-amber-400/40 hover:text-amber-200">
                  yours
                </Link>
                ).
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Step scores are the same story-derived numbers the public process page publishes: judged
        verdicts over the stories mapped to each step, weighted, 0–100. The per-verdict citations
        live in each step block of the public page&rsquo;s diagram; the &ldquo;score receipt&rdquo;
        links open each product&rsquo;s evidence breakdown. Edit your picks any time on{' '}
        <Link href="/my-stack" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
          My Stack
        </Link>
        .
      </p>
    </div>
  )
}
