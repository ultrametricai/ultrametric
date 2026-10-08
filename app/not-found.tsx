import type { Metadata } from 'next'
import Link from 'next/link'
import { spotlightPick } from '@/lib/notFoundSpotlight'

// Without this the 404 tab reads bare "Ultrametric" — every other page carries a descriptive
// title. noindex keeps soft-404 URLs out of search results.
export const metadata: Metadata = {
  title: 'Page not found — Ultrametric',
  robots: { index: false },
}

// 404: minimal, on-brand — no illustration. Same evidence-tier language the rest of the site
// uses ("verdict: none q0") rendered as plain mono text instead of an illustrated scene.
// Below the affordances, one process spotlight (founder 2026-10-08): a worked example from the
// committed corpus, picked deterministically at build time (lib/notFoundSpotlight.ts), so every
// 404 teaches something real.
export default function NotFound() {
  const spotlight = spotlightPick()
  return (
    <div className="flex flex-col items-center gap-8 py-24 text-center">
      <div aria-hidden className="flex items-baseline gap-3 font-mono">
        <span className="text-6xl font-bold text-zinc-100 sm:text-7xl">404</span>
        <span className="text-xl text-emerald-400 sm:text-2xl">· verdict: none q0</span>
      </div>

      <div className="space-y-2">
        <h1 className="font-display leading-[1.1] text-2xl font-bold tracking-tight">No evidence this page exists</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-400">
          We crawled, probed, and judged — this URL scored{' '}
          <span className="font-mono text-zinc-300">none q0</span> across all evidence tiers.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href="/"
          className="rounded-lg border border-emerald-400/60 px-4 py-2 font-medium text-emerald-300 transition hover:bg-emerald-400/10"
        >
          Back to the rankings
        </Link>
        <Link
          href="/rankings/init"
          className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
        >
          Highest Overall score ranking
        </Link>
      </div>

      <section className="w-full max-w-md rounded-lg border border-zinc-800 p-5 text-left">
        <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
          Meanwhile, a process from the corpus
        </p>
        <h2 className="mt-2 text-base font-semibold">
          <Link href={spotlight.href} className="text-zinc-100 transition hover:text-emerald-300">
            {spotlight.title}
          </Link>
        </h2>
        <p className="mt-2 text-sm text-zinc-400">{spotlight.description}</p>
        <p className="mt-3 text-sm text-zinc-300">
          {spotlight.fact.kind === 'artifact' ? (
            <>
              Produces the{' '}
              <Link href={spotlight.fact.href} className="text-emerald-300 transition hover:text-emerald-200">
                {spotlight.fact.artifactLabel}
              </Link>{' '}
              artifact.
            </>
          ) : (
            <>
              Agentic %: <span className="font-mono">{spotlight.fact.pct}%</span> (
              {spotlight.fact.agentSteps} of {spotlight.fact.totalSteps} steps an agent can run
              today).
            </>
          )}
        </p>
        <p className="mt-3 text-sm">
          <Link href={spotlight.href} className="text-emerald-300 transition hover:text-emerald-200">
            Read the process →
          </Link>
        </p>
      </section>
    </div>
  )
}
