'use client'

import { useGeoChoice } from '@/components/useGeoSelection'
import { GEO_GLOBAL, GEO_PREF_META, type GeoAnalogNote } from '@/lib/geoPreference'

// "Outside the US" (founder GEO ask 2026-09-28: "USA-centric processes vs global processes …
// do spikes into India, UK, European countries"): the curated per-country analogs of a
// US-scoped process — what a founder in India / the UK / Germany / France does instead, each
// with its verified-live canonical portal (lib/processes.ts GeoNoteSchema). Since the mapping
// expansion (founder ask 2026-09-29) flavored GLOBAL processes carry notes too, so the intro
// stays honest per scope: US-scoped = "the real analogs", global = "the local flavor".
// Documentation, not modeling: these notes never touch ceilings, rankings or the simulator,
// and the block renders only for the processes that actually carry notes.
//
// Client component since the 🌐 Global lens (founder 2026-09-30): under the explicit Global
// choice the block renders NOTHING at all (founder 2026-10-02 — supersedes the earlier
// availability-only collapse: the ProcessGeoBanner up top already names the mapped countries,
// and the switcher is the way back to per-country detail). The static HTML and the US default
// render the full block byte-identically (the hook is null until the mount effect), a manual
// country restores it unchanged. Props are the client-safe GeoAnalogNote shape — structurally
// the corpus GeoNote, so the server page passes task.geoNotes straight through.
export default function ProcessGeoNotes({
  notes,
  geoScope = 'us',
}: {
  notes: GeoAnalogNote[]
  geoScope?: 'global' | 'us' | 'us-state'
}) {
  const geo = useGeoChoice()
  if (notes.length === 0) return null

  // Global view: nothing from this block (founder 2026-10-02) — no heading, no availability
  // line. The notes stay committed; a country pick restores the full per-country detail below.
  if (geo === GEO_GLOBAL) return null

  return (
    // Anchor target for the top geo banner's "all countries ↓" link (ProcessGeoBanner) — the
    // banner promotes ONE country's analog; the full multi-country detail stays down here.
    <section id="outside-the-us" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">Outside the US</h2>
      <p className="mt-1 text-sm text-zinc-400">
        {geoScope === 'global'
          ? 'The core steps are the same everywhere, but this process has real local flavor. Here is the honest per-country detail — documented (not yet modeled as full processes).'
          : 'This flow is written around US law and agencies. Here is what the same work looks like elsewhere — the real per-country analogs, documented (not yet modeled as full processes).'}
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {notes.map((n) => {
          const meta = GEO_PREF_META[n.country]
          return (
            <li key={n.country} className="rounded-xl border border-zinc-800 px-4 py-3">
              <p className="text-sm font-medium text-zinc-200">
                <span aria-hidden className="mr-1.5">{meta.flag}</span>
                {meta.label}
              </p>
              <p className="mt-1 text-sm text-zinc-400">{n.summary}</p>
              <p className="mt-1.5 text-xs">
                <a
                  href={n.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
                  title={`${meta.label} — the canonical portal for this work (verified live)`}
                >
                  {n.actionLabel} ↗
                </a>
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
