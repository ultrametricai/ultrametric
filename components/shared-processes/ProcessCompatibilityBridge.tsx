'use client'

import { useEffect, useRef } from 'react'
import { GEO_STORAGE_KEY, parseGeoChoice, setGeoChoice } from '@/lib/geoPreference'
import { encodeViaParam, lensStorageKey, parseLensState, parseViaParam, readLensRaw, writeLens } from '@/lib/processLens'
import { parseStackMap, readStackRaw } from '@/lib/myStack'
import { setParams } from '@/lib/urlState'
import { regionForGeo, resolveProcessAnchor, type ProcessAnchorContract } from '@/lib/shared-processes/compatibility'
import { parseSavedSelection, restoreLegacySelection, type SelectionContract } from '@/lib/shared-processes/selection-compatibility'
import { openProcessTarget, whenProcessTargetReady } from '@/lib/shared-processes/open-target'
import { useRegionalVariant } from './RegionalVariant'
import { useVendorSelection } from './VendorSelection'

export const sharedSelectionKey = (id: string) => `pa-shared-process-selection:${id}`
function stored(key: string) { try { return localStorage.getItem(key) } catch { return null } }
function save(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* URL state remains usable when storage is unavailable. */ }
}

/** Restores published URL state after hydration; never changes source content or scores. */
export default function ProcessCompatibilityBridge({ recordId, anchors, choices }: {
  recordId: string; anchors: ProcessAnchorContract; choices: SelectionContract
}) {
  const region = useRegionalVariant()
  const vendors = useVendorSelection()
  const currentRegion = useRef(region?.selected ?? 'default')
  const restoreRegion = region?.restore
  const restoreVendors = vendors?.restore
  const decision = region?.decision

  useEffect(() => { currentRegion.current = region?.selected ?? 'default' }, [region?.selected])

  useEffect(() => {
    let frame = 0
    let cancelTarget: (() => void) | undefined
    function restoreAnchor(selected: string, explicitGeo: boolean) {
      cancelTarget?.()
      cancelAnimationFrame(frame)
      const resolution = resolveProcessAnchor(anchors, window.location.hash, selected, explicitGeo)
      if (resolution.status !== 'reachable') return // Conflicting geo/hash stays intact and is not claimed reachable.
      if (resolution.region && resolution.region !== selected) {
        currentRegion.current = resolution.region
        restoreRegion?.(resolution.region)
        const country = decision?.options.find(option => option.id === resolution.region)?.countries[0]
        setGeoChoice(parseGeoChoice(country ?? null))
      }
      cancelTarget = whenProcessTargetReady(resolution.target, () => {
        frame = requestAnimationFrame(() => openProcessTarget(resolution.target))
      })
    }
    function restorePage() {
      const query = new URLSearchParams(window.location.search)
      const rawGeo = query.has('geo') ? query.get('geo') : stored(GEO_STORAGE_KEY)
      const geo = regionForGeo(decision, rawGeo)
      setGeoChoice(parseGeoChoice(rawGeo?.trim().toUpperCase() === 'GB' ? 'UK' : rawGeo))
      const selected = geo.region ?? 'default'
      currentRegion.current = selected
      restoreRegion?.(selected)
      const queryPicks = parseViaParam(query.getAll('via'))
      const hasUrlLens = Object.keys(queryPicks).length > 0
      const legacy = parseLensState(readLensRaw(lensStorageKey(recordId)))
      if (hasUrlLens) writeLens(lensStorageKey(recordId), { picks: queryPicks, names: legacy.names })
      // A Back/Forward entry can restore the more-specific choices made on that
      // very entry. A newly opened explicit via URL still wins over old storage.
      const entry = window.history.state?.paProcessSelection
      const fromHistory = entry?.recordId === recordId && entry.via === encodeViaParam(queryPicks)
        ? parseSavedSelection(JSON.stringify(entry), choices) : undefined
      const saved = fromHistory ?? (hasUrlLens ? undefined : parseSavedSelection(stored(sharedSelectionKey(recordId)), choices))
      const selection = saved ?? restoreLegacySelection(choices, hasUrlLens ? queryPicks : legacy.picks, parseStackMap(readStackRaw()))
      restoreVendors?.(selection.picks, selection.overrides)
      restoreAnchor(selected, regionForGeo(decision, query.get('geo')).explicit)
    }
    function restoreHash() {
      restoreAnchor(currentRegion.current, regionForGeo(decision, new URLSearchParams(window.location.search).get('geo')).explicit)
    }
    function sameHash(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
      if (link?.getAttribute('href') === window.location.hash) restoreHash()
    }
    restorePage()
    window.addEventListener('hashchange', restoreHash)
    window.addEventListener('popstate', restorePage)
    document.addEventListener('click', sameHash)
    return () => {
      cancelTarget?.()
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', restoreHash)
      window.removeEventListener('popstate', restorePage)
      document.removeEventListener('click', sameHash)
    }
  }, [recordId, anchors, choices, decision, restoreRegion, restoreVendors])

  useEffect(() => {
    if (!region?.revision) return
    const country = region.decision?.options.find(option => option.id === region.selected)?.countries[0]
    const value = region.selected === 'default' ? null : country?.toLowerCase()
    if (value === undefined) return
    setParams({ geo: value })
    save(GEO_STORAGE_KEY, value)
    setGeoChoice(parseGeoChoice(value))
  }, [region?.revision, region?.selected, region?.decision])

  useEffect(() => {
    if (!vendors?.revision) return
    save(sharedSelectionKey(recordId), JSON.stringify({ picks: vendors.picks, overrides: vendors.overrides }))
    const current = parseLensState(readLensRaw(lensStorageKey(recordId)))
    const picks = { ...current.picks }
    for (const group of choices.groups) {
      const candidate = vendors.picks[group.scope]
      if (candidate?.startsWith(`${group.arenaId}/`) && group.candidates.includes(candidate)) picks[group.arenaId] = candidate.slice(group.arenaId.length + 1)
      else delete picks[group.arenaId]
    }
    // The legacy share contract expresses one process-level vendor per arena.
    // More-specific shared step overrides remain local; no ambiguous URL encoding is invented.
    if (encodeViaParam(picks) !== encodeViaParam(current.picks)) {
      writeLens(lensStorageKey(recordId), { picks, names: current.names })
      setParams({ via: encodeViaParam(picks) })
    }
    window.history.replaceState({ ...window.history.state, paProcessSelection: {
      recordId, via: encodeViaParam(parseViaParam(new URLSearchParams(window.location.search).getAll('via'))),
      picks: vendors.picks, overrides: vendors.overrides,
    } }, '', window.location.href)
  }, [recordId, choices, vendors?.revision, vendors?.picks, vendors?.overrides])

  return null
}
