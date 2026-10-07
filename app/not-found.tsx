import type { Metadata } from 'next'
import Link from 'next/link'

// Without this the 404 tab reads bare "Ultrametric" — every other page carries a descriptive
// title. noindex keeps soft-404 URLs out of search results.
export const metadata: Metadata = {
  title: 'Page not found — Ultrametric',
  robots: { index: false },
}

// 404: minimal, on-brand — no illustration. Same evidence-tier language the rest of the site
// uses ("verdict: none q0") rendered as plain mono text instead of an illustrated scene.
export default function NotFound() {
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
    </div>
  )
}
