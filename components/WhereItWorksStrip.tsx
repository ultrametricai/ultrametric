'use client'

import { useGeoSelection } from '@/components/useGeoSelection'
import {
  GEO_PREF_META,
  GEO_STATUS_META,
  type VendorGeoStripRow,
} from '@/lib/geoPreference'

// The "Where it works" row on product pages, compacted to flags (founder 2026-10-07: "only the
// countries where it works, flags adjacent, 🌐 Global first when the product is globally
// available — no ticks, no pills, no per-country labels"). Only available/partial countries
// render; a committed 'unavailable' row stays data (the honest negative) but draws nothing. A
// partial country keeps its flag with a muted treatment and a tooltip that says partial. The
// country name and status live in each flag's tooltip and screen-reader text, and each flag
// stays a LINK to the vendor's OWN page its row rests on (crawl-verified, lib/vendorGeo.ts) —
// evidence, not a score. The 🌐 Global lead is derived server-side (components/WhereItWorks.tsx:
// every judged country committed 'available') and leads the row.
//
// Under a non-US selection the selected country's committed note shows inline — negatives
// included ("US entities only …"), even though an unavailable country has no flag. The US
// default renders the flags only, and the static HTML never carries a selection (mount-only
// reads via the shared store — the client-personalization contract).
export default function WhereItWorksStrip({
  rows,
  global = false,
}: {
  rows: VendorGeoStripRow[]
  global?: boolean
}) {
  const geo = useGeoSelection()
  // Only where it works: committed unavailable rows render no flag (they stay data, and the
  // inline note below still tells their story under that country's selection).
  const shown = rows.filter((r) => r.status !== 'unavailable')
  const selectedRow = geo === null ? undefined : rows.find((r) => r.country === geo)
  if (shown.length === 0 && !selectedRow) return null
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-widest text-zinc-500"
          title="Region availability from the vendor's own pages — crawl-verified evidence, not a score; a muted flag is partial availability"
        >
          Where it works
        </span>
        <span className="flex items-center gap-1 text-sm leading-none">
          {global && (
            <span
              title="Globally available — every judged country's committed row says available (the flags carry the per-country sources)"
              className="cursor-default"
            >
              <span aria-hidden>🌐</span>
              <span className="sr-only">Globally available</span>
            </span>
          )}
          {shown.map((r) => {
            const c = GEO_PREF_META[r.country]
            const s = GEO_STATUS_META[r.status]
            return (
              <a
                key={r.country}
                href={r.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${c.label} — ${s.label}: ${r.note} (vendor source, checked ${r.checkedAt})`}
                className={`rounded transition hover:opacity-75${
                  r.status === 'partial' ? ' opacity-50 saturate-50' : ''
                }${geo === r.country ? ' ring-1 ring-emerald-400/50' : ''}`}
              >
                <span aria-hidden>{c.flag}</span>
                <span className="sr-only">{`${c.label} — ${s.label}`}</span>
              </a>
            )
          })}
        </span>
        {/* The embedded GeoSwitcher pill row left with the compaction (founder 2026-10-07) —
            the pills were exactly what the flag row replaces; the sitewide country control in
            the header writes the same ?geo=/pa-geo preference this strip reads. */}
      </div>
      {/* The selected country's committed note, inline — nothing for the US default, and
          nothing (no guess) when the spike has no row for that country. Negatives render here
          in full even though they draw no flag above. */}
      {selectedRow && (
        <p className="mt-1.5 max-w-2xl text-xs text-zinc-400">
          <span aria-hidden className="mr-1">{GEO_PREF_META[selectedRow.country].flag}</span>
          <span className="text-zinc-300">
            {GEO_PREF_META[selectedRow.country].label} — {GEO_STATUS_META[selectedRow.status].label}:
          </span>{' '}
          {selectedRow.note}{' '}
          <a
            href={selectedRow.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
            title={`The vendor's own page this row rests on — checked ${selectedRow.checkedAt}`}
          >
            source ↗
          </a>
        </p>
      )}
    </div>
  )
}
