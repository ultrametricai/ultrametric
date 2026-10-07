import type { Metadata } from 'next'
import Link from 'next/link'
import ArenasDirectory from '@/components/ArenasDirectory'
import { loadArenaSections } from '@/lib/arenaSections'
import { loadCategories } from '@/lib/data'

// The main Rankings page (founder 2026-09-23; label renamed from Arenas, founder 2026-10-07 —
// the /arenas route is stable): a visual navigation over every judged arena, grouped by the
// same curated sections as the header dropdown, with a jump strip up top.
export const metadata: Metadata = {
  title: 'Rankings — Ultrametric',
  description:
    'Every judged ranking — grouped, visual, one card per market with its ranked leader. Pick a ranking for the full evidence-backed leaderboard.',
}

export default function ArenasPage() {
  const sections = loadArenaSections()
  const total = loadCategories().length
  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display leading-[1.1] text-3xl font-bold tracking-tight">Rankings</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          {total} judged markets. Every ranking card shows its current Overall score leader; every score
          traces back to cited evidence.
        </p>
        {/* Jump strip: one chip per section, anchors into the directory below. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {sections.map((s) => (
            <Link
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </section>
      <ArenasDirectory />
    </div>
  )
}
