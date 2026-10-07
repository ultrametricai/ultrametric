import GeoDropdown from '@/components/GeoDropdown'
import { GEO_GLOBAL } from '@/lib/geoPreference'

// THE sitewide country control (founder 2026-10-07: "move this into the top bar so the user can
// set their country or default to global, then we don't need it per page"). One mount per
// breakpoint in app/layout.tsx's header — desktop next to the ⌘K/account cluster, the MobileNav
// panel below sm — replacing the per-page GeoDropdown mounts on /processes, the process detail
// pages, and /artifacts. Every page keeps its adaptive behavior (country filtering, banners,
// geo notes, artifact gating) through the same shared store this writes (?geo= / pa-geo /
// lib/geoPreference.ts — the committed codec, untouched).
//
// Display default: 🌐 Global when nothing is chosen — framing only (server-rendered, so the
// US-default static HTML stays byte-identical; the store stays null). The semantics are the
// committed contracts: no selection/Global = full corpus + US-baseline flows; an explicit
// country = the filtered/adapted views.
export default function HeaderGeoControl({ align = 'right' }: { align?: 'left' | 'right' } = {}) {
  return <GeoDropdown variant="nav" align={align} defaultChoice={GEO_GLOBAL} />
}
