import type { Metadata } from 'next'
import { AboutFractal } from '@/components/fx/lazy'

export const metadata: Metadata = {
  title: 'About — Ultrametric',
  description:
    'Ultrametric, Inc. builds the open startup repo: agent-runnable founder processes, agent-tested tool rankings, and the open startup simulator — everything evidence-driven, affiliations disclosed.',
}

// Static page, deliberately minimal (founder 2026-09-30: "just make it simple — 1 paragraph
// that is short, and Jude and Tyler on the bottom as circle images of our profiles").
export const dynamic = 'force-static'

// Committed copies of the founders' GitHub avatars (public/people/) — no hotlinking.
const FOUNDERS = [
  { name: 'Jude Gomila', src: '/people/jude.png', github: 'https://github.com/judegomila' },
  { name: 'Tyler Lastovich', src: '/people/tyler.jpg', github: 'https://github.com/tylerlastovich' },
]

export default function AboutPage() {
  return (
    // relative isolate: contains the page's own fractal backdrop (founder 2026-10-02 — the
    // Burning Ship, unique to /about; the homepage keeps Newton, /company keeps Julia). The
    // canvas is decorative, lazy, client-only; the page reads identically without it.
    <div className="relative isolate mx-auto max-w-2xl space-y-10">
      <div className="pointer-events-none absolute inset-x-[-20vw] -top-10 bottom-0 -z-10 overflow-hidden" aria-hidden>
        <AboutFractal />
        <div className="absolute inset-0 bg-zinc-950/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>
      <div>
        {/* The 'About Ultrametric' heading was removed (founder 2026-10-02) — the eyebrow
            carries the h1 semantics so the page keeps an accessible name without the big title. */}
        <h1 className="text-sm uppercase tracking-widest text-emerald-400">About</h1>
        <p className="mt-4 text-zinc-400">
          We started Ultrametric to automate the boring processes in startups so that you can
          focus on your mission. We are developing tools for founders to navigate the AI phase
          transition and beyond. If you are interested in helping us and are skilled, contact us.
        </p>
      </div>

      <div className="flex items-center justify-center gap-16">
        {FOUNDERS.map((f) => (
          <a
            key={f.name}
            href={f.github}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- committed static asset */}
            <img
              src={f.src}
              alt={f.name}
              width={96}
              height={96}
              className="size-24 rounded-full border border-zinc-800 object-cover transition group-hover:border-emerald-400/60"
            />
            <span className="text-sm text-zinc-400 transition group-hover:text-emerald-300">{f.name}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
