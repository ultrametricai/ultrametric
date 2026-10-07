'use client'

import { useEffect, useState } from 'react'
import {
  GEO_PARAM,
  GEO_STORAGE_KEY,
  getGeoChoice,
  getGeoSelection,
  serializeGeoChoice,
  setGeoChoice,
  subscribeGeoSelection,
  type GeoChoice,
  type GeoSelection,
} from '@/lib/geoPreference'
import { setParams } from '@/lib/urlState'

// The ONE switcher write path (GeoDropdown's apply, shared since the "Outside the US" rows
// became internal navigation — founder 2026-10-07): store fan-out, the ?geo= param, and the
// stored preference move together, so every writer produces exactly the state the dropdown
// would. lib/geoPreference.ts stays state fan-out only.
export function applyGeoChoice(next: GeoChoice | null): void {
  setGeoChoice(next)
  const serialized = serializeGeoChoice(next)
  setParams({ [GEO_PARAM]: serialized })
  if (serialized === null) window.localStorage.removeItem(GEO_STORAGE_KEY)
  else window.localStorage.setItem(GEO_STORAGE_KEY, serialized)
}

// The consumer half of the geo preference (lib/geoPreference.ts): every geo-aware component —
// the process banner, step markers, vendor annotations, the product strip, the index glyphs —
// calls this and re-renders when the header country control changes the selection.
//
// Static-HTML/hydration contract (the components/JurisdictionToggle.tsx precedent): the server
// snapshot (and the first client render) is always the US default — `null` — so the static HTML
// stays byte-identical and hydrates with zero mismatches; the store value only lands in the
// mount effect. The header control (components/HeaderGeoControl.tsx) owns reading
// ?geo=/localStorage into the store; this hook only mirrors the store.
export function useGeoSelection(): GeoSelection | null {
  const [geo, setGeo] = useState<GeoSelection | null>(null)
  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the
     shared store (an external system). The static HTML must render the US default, so this
     cannot be a useState initializer (hydration mismatch); it runs once and renders at most one
     extra pass. */
  useEffect(() => {
    setGeo(getGeoSelection())
    return subscribeGeoSelection(() => setGeo(getGeoSelection()))
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  return geo
}

// The choice-level hook for the few GLOBAL-aware consumers (founder 2026-09-30: the process
// page's generic view — ProcessGeoBanner, ProcessGeoNotes, JurisdictionToggle). Same
// static-HTML/hydration contract: null (the US default) until the mount effect syncs.
export function useGeoChoice(): GeoChoice | null {
  const [geo, setGeo] = useState<GeoChoice | null>(null)
  /* eslint-disable react-hooks/set-state-in-effect -- the same one-time post-hydration sync as
     useGeoSelection above (an external store; a useState initializer would mismatch). */
  useEffect(() => {
    setGeo(getGeoChoice())
    return subscribeGeoSelection(() => setGeo(getGeoChoice()))
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  return geo
}
