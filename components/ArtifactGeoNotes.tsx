'use client'

import { useGeoChoice } from '@/components/useGeoSelection'
import { GEO_GLOBAL, GEO_PREF_META, type GeoNoteKind, type GeoSelection } from '@/lib/geoPreference'

// The artifact-level "Outside the US" block (founder geo-coverage ask 2026-10-07: the artifact
// registry is US-centric — EIN, 83(b), the DE charter paper — so each US-centric artifact now
// carries committed per-country analogs). Renders processes/artifacts.json `geo` entries: per
// country the analog OBJECT's name (the EIN's UK analog is the UTR), what the committed entry
// says it is, and its official page — every summary derived from the producing process's
// committed geoNotes and every actionUrl reused from a committed corpus geoNote (the
// no-invented-URL rule, corpus-tested).
//
// Same geo-store contract as components/ProcessGeoNotes.tsx — driven by the ONE shared
// ?geo=/pa-geo store (lib/geoPreference.ts), never a control of its own (the /artifacts geo
// dropdown lands from another lane; this render stays keyed on the store): the static HTML and
// the US default render the full per-country block byte-identically (the hook is null until
// the mount effect), a country pick keeps it, and the explicit 🌐 Global choice renders
// NOTHING (the committed entries stay; the switcher is the way back). Artifacts with no
// committed geo entries render nothing at all.
export interface ArtifactGeoNoteProp {
  country: GeoSelection
  kind: GeoNoteKind
  label: string
  summary: string
  actionUrl: string
  actionLabel: string
}

// What the committed kind SAYS the artifact becomes there — the same vocabulary the process
// notes use (lib/geoPreference.ts GEO_NOTE_KINDS), read at the artifact level.
const KIND_META: Record<GeoNoteKind, { label: string; title: string }> = {
  analog: { label: 'analog', title: 'A real per-country analog object exists' },
  absorbed: {
    label: 'absorbed',
    title: 'The need is handled inside another committed object or filing there',
  },
  'not-applicable': {
    label: 'not applicable',
    title: 'The artifact genuinely has no counterpart there',
  },
}

export default function ArtifactGeoNotes({ notes }: { notes: ArtifactGeoNoteProp[] }) {
  const geo = useGeoChoice()
  if (notes.length === 0) return null

  // Global view: nothing from this block (the ProcessGeoNotes contract, founder 2026-10-02) —
  // the entries stay committed; a country pick restores the full per-country detail.
  if (geo === GEO_GLOBAL) return null

  return (
    <section id="outside-the-us" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">Outside the US</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        This artifact is written around US law and agencies. Here is what the same object is
        elsewhere — the committed per-country analogs, derived from the producing
        process&rsquo;s country notes.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {notes.map((n) => {
          const meta = GEO_PREF_META[n.country]
          const kind = KIND_META[n.kind]
          return (
            <li key={n.country} className="rounded-xl border border-zinc-800 px-4 py-3">
              <p className="flex items-baseline gap-2 text-sm font-medium text-zinc-200">
                <span>
                  <span aria-hidden className="mr-1.5">{meta.flag}</span>
                  {meta.label}
                </span>
                <span
                  className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500"
                  title={kind.title}
                >
                  {kind.label}
                </span>
              </p>
              <p className="mt-1 text-sm text-zinc-300">{n.label}</p>
              <p className="mt-1 text-sm text-zinc-400">{n.summary}</p>
              <p className="mt-1.5 text-xs">
                <a
                  href={n.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
                  title={`${meta.label} — the committed official page for this object (reused from the corpus geo notes)`}
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
