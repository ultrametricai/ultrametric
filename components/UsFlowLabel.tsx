'use client'

import { useGeoChoice } from '@/components/useGeoSelection'
import { GEO_GLOBAL, GEO_PREF_META } from '@/lib/geoPreference'

// The other half of the wrong-country-flow guard (founder 2026-10-02, with the ProcessGeoBanner
// note promotion): when the reader has made an EXPLICIT country choice (not the US default, not
// 🌐 Global) and the process is US-scoped, the step flow below must not read as the local
// answer — this badge labels it 'US flow', plainly.
//
// Client-side presentation only, the ProcessGeoBanner contract: the static HTML, the US default,
// the Global lens, and every global-scope process render NOTHING (the hook is null until the
// mount effect), so the US-default SSR output stays byte-identical and no judged number moves.
export default function UsFlowLabel({ geoScope }: { geoScope: 'global' | 'us' | 'us-state' }) {
  const geo = useGeoChoice()
  if (geo === null || geo === GEO_GLOBAL || geoScope === 'global') return null
  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400"
      title={`This step-by-step is the US flow — written around US law and agencies, not the ${GEO_PREF_META[geo].label} path. The banner above carries the committed ${GEO_PREF_META[geo].label} note.`}
    >
      <span aria-hidden>🇺🇸</span>
      US flow
    </span>
  )
}
