'use client'

import { useGeoChoice } from '@/components/useGeoSelection'
import { GEO_GLOBAL, GEO_PREF_META, type GeoAnalogNote } from '@/lib/geoPreference'

// The top-of-page geo banner (founder GEO ask 2026-09-28: "make GEO a top-level process driver
// at the top of a particular process page"): under a non-US selection it says, from COMMITTED
// data only, what this process means in that country. Renders under the page header in
// the process header; renders NOTHING in the static HTML and for the US default, so the
// default page stays byte-identical (the client-personalization contract, lib/geoPreference.ts).
//
// Honesty per (geoScope × notes) — the unsupported-never-guessed doctrine:
//   geoScope 'global', no note  → "Global process — the same steps apply in {country}."
//   'global', note found        → same core-steps line PLUS the country's curated local flavor
//                                 (the 2026-09-29 mapping expansion: a global process can be
//                                 jurisdictionally flavored — stamp duty, e-invoicing, GDPR).
//   'us'/'us-state', note found → the wrong-country-flow guard (founder 2026-10-02): the
//                                 committed note LEADS, so the US step flow below is never
//                                 presented as the local answer. kind 'analog' promotes the
//                                 local path — "In {country}, this runs as: {summary}" + the
//                                 verified actionUrl; 'absorbed'/'not-applicable' states the
//                                 note's summary plainly. The flow below wears the 'US flow'
//                                 label (components/UsFlowLabel.tsx). Committed copy only.
//   'us'/'us-state', no note    → "No {country} mapping yet — this workflow is US-specific."
//                                 An analog is never fabricated.
export default function ProcessGeoBanner({
  geoScope,
  notes,
}: {
  geoScope: 'global' | 'us' | 'us-state'
  notes: GeoAnalogNote[]
}) {
  const geo = useGeoChoice()
  if (geo === null) return null

  // 🌐 Global (founder 2026-09-30: "show the GENERAL process without country-specifics"): the
  // country-agnostic lens — the page's country-conditional UI (jurisdiction steps, geo
  // auto-preselects, vendor availability marks) stands down and the banner renders NOTHING.
  // The 'Country mappings exist for …' availability line left with the founder batch
  // 2026-10-05: the geo dropdown itself communicates which countries exist, so the line said
  // nothing the control doesn't. A country pick still renders the committed detail below.
  if (geo === GEO_GLOBAL) return null

  const meta = GEO_PREF_META[geo]

  const note = notes.find((n) => n.country === geo)

  if (geoScope === 'global') {
    return (
      <div className="mt-3 max-w-2xl rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm">
        <p className="text-zinc-300">
          <span aria-hidden className="mr-1.5">{meta.flag}</span>
          <span className="font-medium text-emerald-300">Global process</span> — the same
          {note ? ' core' : ''} steps apply in {meta.prose}.
          {/* The curated local flavor, when this global process has one for the country —
              committed data only (corpus geoNotes), never inferred. */}
          {note && (
            <>
              {' '}Local flavor: <span className="text-zinc-300">{note.summary}</span>
            </>
          )}
        </p>
        {note && (
          <p className="mt-1.5 text-xs">
            <a
              href={note.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
              title={`${meta.label} — the canonical portal for this work (verified live)`}
            >
              {note.actionLabel} ↗
            </a>
            <span className="mx-1.5 text-zinc-700">·</span>
            <a
              href="#outside-the-us"
              className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
              title="The full multi-country detail — every curated per-country note on this process"
            >
              all countries ↓
            </a>
          </p>
        )}
      </div>
    )
  }
  if (!note) {
    return (
      <p className="mt-3 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
        <span aria-hidden className="mr-1.5">{meta.flag}</span>
        <span className="font-medium text-zinc-300">US-centric process.</span> No {meta.label}{' '}
        mapping yet — this workflow is US-specific.
        {notes.length > 0 && (
          <>
            {' '}
            <a
              href="#outside-the-us"
              className="text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
              title="Countries this process IS mapped for — the curated per-country analogs below"
            >
              other countries ↓
            </a>
          </>
        )}
      </p>
    )
  }

  // The wrong-country-flow guard (founder 2026-10-02): the committed note leads the banner —
  // the US step flow below is never presented as the local answer (UsFlowLabel badges it).
  if (note.kind === 'analog') {
    return (
      <div className="mt-3 max-w-2xl rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm">
        <p className="text-zinc-300">
          <span aria-hidden className="mr-1.5">{meta.flag}</span>
          In {meta.prose}, this runs as:{' '}
          <span className="font-medium text-zinc-100">{note.summary}</span>
        </p>
        <p className="mt-1.5 text-xs">
          <a
            href={note.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
            title={`${meta.label} — the canonical portal for this work (verified live)`}
          >
            {note.actionLabel} ↗
          </a>
          {/* The "Outside the US" block below always exists here — this process has notes. */}
          <span className="mx-1.5 text-zinc-700">·</span>
          <a
            href="#outside-the-us"
            className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
            title="The full multi-country detail — every curated per-country analog of this process"
          >
            all countries ↓
          </a>
        </p>
      </div>
    )
  }

  // 'absorbed' / 'not-applicable': the committed summary, stated plainly — there is no local
  // flow to promote and none is invented; the note itself is the whole local answer.
  return (
    <div className="mt-3 max-w-2xl rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm">
      <p className="text-zinc-300">
        <span aria-hidden className="mr-1.5">{meta.flag}</span>
        <span className="font-medium text-zinc-100">{note.summary}</span>
      </p>
      <p className="mt-1.5 text-xs">
        <a
          href="#outside-the-us"
          className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
          title="The full multi-country detail — every curated per-country note on this process"
        >
          all countries ↓
        </a>
      </p>
    </div>
  )
}
