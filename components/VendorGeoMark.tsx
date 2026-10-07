'use client'

import type { ReactNode } from 'react'
import { useGeoSelection } from '@/components/useGeoSelection'
import { GEO_PREF_META, type VendorGeoByCountry } from '@/lib/geoPreference'

// Vendor availability ANNOTATIONS under a non-US selection (founder GEO ask 2026-09-28):
// where jurisdictions/vendor-geo.json has a row for (vendor, selected country), the process
// page's leaderboard rows and per-step chips say so — ✓ available, ◐ partial, and unavailable
// vendors get a muted style plus the row's honest note ("US entities only …"). Vendors with no
// row are untouched (evidence-only, never guessed), judged scores and ranks NEVER move
// (annotation only), and the static HTML / US default renders nothing extra (the
// client-personalization contract — both exports are inert until a selection exists).

const STATUS_META = {
  available: { glyph: '✓', className: 'text-emerald-400/90', label: 'available' },
  partial: { glyph: '◐', className: 'text-amber-300/90', label: 'partially available' },
  unavailable: { glyph: '✕', className: 'text-zinc-500', label: 'not available' },
} as const

/** The committed cell for the active selection — null when no selection or no row (no guess). */
export function useVendorGeoCell(geo: VendorGeoByCountry | undefined) {
  const selection = useGeoSelection()
  if (selection === null || !geo) return null
  const cell = geo[selection]
  return cell ? { selection, cell } : null
}

/** Inline glyph next to a vendor name/chip — the ✓/◐/✕ + the row's note in the tooltip. */
export default function VendorGeoMark({ geo }: { geo?: VendorGeoByCountry }) {
  const hit = useVendorGeoCell(geo)
  if (!hit) return null
  const s = STATUS_META[hit.cell.status]
  return (
    <span
      className={`shrink-0 font-mono text-[10px] ${s.className}`}
      title={`${GEO_PREF_META[hit.selection].label} — ${s.label}: ${hit.cell.note} (vendor's own pages)`}
    >
      {s.glyph}
      {hit.cell.status === 'unavailable' && (
        <span className="ml-1 font-sans text-[9px] uppercase tracking-wide">
          not in {hit.selection}
        </span>
      )}
      <span className="sr-only">
        {' '}{s.label} in {GEO_PREF_META[hit.selection].label}
      </span>
    </span>
  )
}

/**
 * Row shade: a stable wrapper div (always rendered, so SSR and the default client view match
 * exactly and hydration never mismatches) that mutes its row only when the selected country's
 * committed row says the vendor is unavailable there. `className` carries the row styles that
 * key off sibling position (border-b/last:) so they keep working on the wrapper.
 */
export function VendorGeoShade({
  geo,
  className,
  children,
}: {
  geo?: VendorGeoByCountry
  className?: string
  children: ReactNode
}) {
  const hit = useVendorGeoCell(geo)
  const muted = hit?.cell.status === 'unavailable'
  const cls = [className, muted ? 'opacity-50' : null].filter(Boolean).join(' ')
  return <div className={cls || undefined}>{children}</div>
}
