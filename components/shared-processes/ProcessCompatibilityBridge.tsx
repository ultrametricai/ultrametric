'use client'

import { useEffect, useRef } from 'react'
import { GEO_STORAGE_KEY, getGeoChoice, parseGeoChoice, serializeGeoChoice, setGeoChoice, subscribeGeoSelection, type GeoChoice } from '@/lib/geoPreference'
import { encodeViaParam, lensStorageKey, parseLensState, parseViaParam, readLensRaw, subscribeLens, writeLens, type LensState } from '@/lib/processLens'
import { STACK_KEY, parseStackMap, readStackRaw, subscribeStack } from '@/lib/myStack'
import { setParams } from '@/lib/urlState'
import { regionForGeo, resolveProcessAnchor, type ProcessAnchorContract } from '@/lib/shared-processes/compatibility'
import { parseSavedSelection, restoreLegacySelection, type RestoredSelection, type SelectionContract } from '@/lib/shared-processes/selection-compatibility'
import { openProcessTarget, whenProcessTargetReady } from '@/lib/shared-processes/open-target'
import { useRegionalVariant } from './RegionalVariant'
import { useVendorSelection } from './VendorSelection'

function stored(key: string) { try { return localStorage.getItem(key) } catch { return null } }
function saveGeo(value: string | null) {
  try { if (value === null) localStorage.removeItem(GEO_STORAGE_KEY); else localStorage.setItem(GEO_STORAGE_KEY, value) } catch { /* The URL and history still preserve this view. */ }
}
function patchParams(patch: Record<string, string | null>) {
  const state = window.history.state
  setParams(patch)
  // The shared URL helper clears history.state. Preserve Next's state and the
  // validated per-step history snapshot while updating only our query keys.
  window.history.replaceState({ ...state, ...window.history.state }, '', window.location.href)
}

/** UI adapter over the existing geo/lens/account stores. No new persistent store. */
export default function ProcessCompatibilityBridge({ recordId, anchors, choices }: {
  recordId: string; anchors: ProcessAnchorContract; choices: SelectionContract
}) {
  const region = useRegionalVariant()
  const vendors = useVendorSelection()
  const restoreRegion = region?.restore
  const restoreVendors = vendors?.restore
  const decision = region?.decision
  const applying = useRef(false)
  const currentGeo = useRef<{ selected: string; country: GeoChoice | null; explicit: boolean }>({ selected: 'default', country: null, explicit: false })

  useEffect(() => {
    const key = lensStorageKey(recordId)
    let frame = 0
    let cancelTarget: (() => void) | undefined
    const cancels: Array<() => void> = []
    function snapshot(selection: RestoredSelection, lens: LensState) {
      window.history.replaceState({ ...window.history.state, paProcessSelection: {
        ...(window.history.state?.paProcessSelection?.recordId === recordId ? window.history.state.paProcessSelection : {}),
        recordId, via: encodeViaParam(parseViaParam(new URLSearchParams(window.location.search).getAll('via'))),
        lens, geo: serializeGeoChoice(currentGeo.current.country), geoExplicit: currentGeo.current.explicit,
        picks: selection.picks, overrides: selection.overrides,
      } }, '', window.location.href)
    }
    function restoreAnchor() {
      cancelTarget?.(); cancelAnimationFrame(frame)
      const geo = currentGeo.current
      const resolution = resolveProcessAnchor(anchors, window.location.hash, geo.selected, geo.explicit)
      if (resolution.status !== 'reachable') return
      if (resolution.region && resolution.region !== geo.selected) {
        const country = parseGeoChoice(decision?.options.find(option => option.id === resolution.region)?.countries[0] ?? null)
        currentGeo.current = { selected: resolution.region, country, explicit: false }
        restoreRegion?.(resolution.region, country)
        applying.current = true; setGeoChoice(country); applying.current = false
      }
      cancelTarget = whenProcessTargetReady(resolution.target, () => {
        frame = requestAnimationFrame(() => openProcessTarget(resolution.target))
      })
    }
    function restorePage() {
      cancels.splice(0).forEach(cancel => cancel())
      applying.current = true
      const query = new URLSearchParams(window.location.search)
      const entry = window.history.state?.paProcessSelection
      const ownEntry = entry?.recordId === recordId ? entry : undefined
      const rawGeo = query.has('geo') ? query.get('geo') : ownEntry ? ownEntry.geo : stored(GEO_STORAGE_KEY)
      const country = parseGeoChoice(rawGeo?.trim().toUpperCase() === 'GB' ? 'UK' : rawGeo)
      const geo = regionForGeo(decision, rawGeo)
      currentGeo.current = { selected: geo.region ?? 'default', country, explicit: regionForGeo(decision, query.get('geo')).explicit || ownEntry?.geoExplicit === true }
      setGeoChoice(country)
      restoreRegion?.(currentGeo.current.selected, country)
      const fromUrl = parseViaParam(query.getAll('via'))
      const legacy = parseLensState(readLensRaw(key))
      const lens = Object.keys(fromUrl).length ? { picks: fromUrl, names: legacy.names }
        : ownEntry?.lens ? parseLensState(JSON.stringify(ownEntry.lens)) : legacy
      if (Object.keys(fromUrl).length || ownEntry?.lens) writeLens(key, lens)
      const saved = ownEntry?.via === encodeViaParam(fromUrl) ? parseSavedSelection(JSON.stringify(ownEntry), choices) : undefined
      const selection = saved ?? restoreLegacySelection(choices, lens.picks, parseStackMap(readStackRaw()))
      restoreVendors?.(selection.picks, selection.overrides)
      restoreAnchor()
      snapshot(selection, lens)
      // Method disclosure state belongs to this browser history entry. It survives
      // refresh/Back without changing public IDs, shared exports or query syntax.
      for (const [scope, open] of Object.entries(ownEntry?.methods ?? {})) {
        if (!Object.hasOwn(anchors.scopes, scope) || typeof open !== 'boolean') continue
        cancels.push(whenProcessTargetReady(scope, () => {
          const element = document.getElementById(scope)
          if (element instanceof HTMLDetailsElement) element.open = open
        }))
      }
      applying.current = false
    }
    function lensChanged(event?: Event) {
      if (applying.current) return
      if (event instanceof StorageEvent) {
        // Cached documents receive queued storage events after pageshow. Restore
        // this entry's explicit URL/history before considering another page's lens.
        if (event.key === null || event.key === key) restorePage()
        return
      }
      const lens = parseLensState(readLensRaw(key))
      const selection = restoreLegacySelection(choices, lens.picks, parseStackMap(readStackRaw()))
      window.history.replaceState({ ...window.history.state, paProcessSelection: { ...window.history.state?.paProcessSelection, explicitPicks: [], explicitOverrides: [] } }, '', window.location.href)
      restoreVendors?.(selection.picks, selection.overrides)
      patchParams({ via: encodeViaParam(lens.picks) })
      snapshot(selection, lens)
    }
    function stackChanged(event?: Event) {
      if (applying.current) return
      if (event instanceof StorageEvent && event.key !== null && event.key !== STACK_KEY) return
      const lens = parseLensState(readLensRaw(key))
      const selection = restoreLegacySelection(choices, lens.picks, parseStackMap(readStackRaw()))
      const entry = window.history.state?.paProcessSelection
      const saved = entry?.recordId === recordId ? parseSavedSelection(JSON.stringify(entry), choices) : undefined
      // Account synchronization refreshes inherited choices without replacing a
      // choice the user explicitly made on this history entry.
      if (saved) {
        for (const scope of Array.isArray(entry.explicitPicks) ? entry.explicitPicks : []) {
          if (Object.hasOwn(saved.picks, scope)) selection.picks[scope] = saved.picks[scope]
          else delete selection.picks[scope]
        }
        for (const scope of Array.isArray(entry.explicitOverrides) ? entry.explicitOverrides : []) {
          if (Object.hasOwn(saved.overrides, scope)) selection.overrides[scope] = saved.overrides[scope]
        }
      }
      restoreVendors?.(selection.picks, selection.overrides)
      snapshot(selection, lens)
    }
    function geoChanged() {
      if (applying.current) return
      const country = getGeoChoice()
      currentGeo.current = { selected: regionForGeo(decision, country ?? 'US').region ?? 'default', country, explicit: true }
      restoreRegion?.(currentGeo.current.selected, country)
      patchParams({ geo: serializeGeoChoice(country) })
      window.history.replaceState({ ...window.history.state, paProcessSelection: { ...window.history.state?.paProcessSelection, recordId, geo: serializeGeoChoice(country), geoExplicit: true } }, '', window.location.href)
    }
    function rememberMethod(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLDetailsElement) || !Object.hasOwn(anchors.scopes, target.id)) return
      const entry = window.history.state?.paProcessSelection
      if (entry?.recordId !== recordId) return
      window.history.replaceState({ ...window.history.state, paProcessSelection: { ...entry, methods: { ...entry.methods, [target.id]: target.open } } }, '', window.location.href)
    }
    function sameHash(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
      if (link?.getAttribute('href') === window.location.hash) restoreAnchor()
    }
    function pageShown(event: PageTransitionEvent) { if (event.persisted) restorePage() }
    restorePage()
    const unsubLens = subscribeLens(lensChanged)
    const unsubStack = subscribeStack(stackChanged)
    const unsubGeo = subscribeGeoSelection(geoChanged)
    window.addEventListener('hashchange', restoreAnchor)
    window.addEventListener('popstate', restorePage)
    window.addEventListener('pageshow', pageShown)
    document.addEventListener('click', sameHash)
    document.addEventListener('toggle', rememberMethod, true)
    return () => {
      cancelTarget?.(); cancels.forEach(cancel => cancel()); cancelAnimationFrame(frame)
      unsubLens(); unsubStack(); unsubGeo()
      window.removeEventListener('hashchange', restoreAnchor)
      window.removeEventListener('popstate', restorePage)
      window.removeEventListener('pageshow', pageShown)
      document.removeEventListener('click', sameHash)
      document.removeEventListener('toggle', rememberMethod, true)
    }
  }, [recordId, anchors, choices, decision, restoreRegion, restoreVendors])

  useEffect(() => {
    if (!region?.revision) return
    const value = serializeGeoChoice(region.country)
    currentGeo.current = { selected: region.selected, country: region.country, explicit: true }
    patchParams({ geo: value }); saveGeo(value)
    applying.current = true; setGeoChoice(region.country); applying.current = false
    window.history.replaceState({ ...window.history.state, paProcessSelection: { ...window.history.state?.paProcessSelection,
      recordId, geo: value, geoExplicit: true,
    } }, '', window.location.href)
  }, [recordId, region?.revision, region?.selected, region?.country])

  useEffect(() => {
    if (!vendors?.revision || !vendors.change) return
    const { scope, candidateId, kind } = vendors.change
    const group = choices.groups.find(group => group.scope === scope)
    const step = choices.steps.find(step => step.scope === scope)
    const allowed = group?.candidates ?? step?.rememberedCandidates ?? step?.candidates ?? []
    const current = parseLensState(readLensRaw(lensStorageKey(recordId)))
    const picks = { ...current.picks }
    if (candidateId && allowed.includes(candidateId) && !candidateId.startsWith('vendor/')) {
      const [arena, product] = candidateId.split('/')
      picks[arena] = product
    } else if (candidateId === null) {
      if (kind === 'toggle' && group) delete picks[group.arenaId]
      if (kind === 'override' && step) for (const arena of (step.legacyStep ?? step.extraStep)?.arenas ?? []) delete picks[arena.arenaId]
    }
    applying.current = true
    writeLens(lensStorageKey(recordId), { ...current, picks })
    applying.current = false
    patchParams({ via: encodeViaParam(picks) })
    // Existing contract validates IDs on restoration. More-specific overrides and
    // unranked reference choices stay on this entry; scored arena picks also share via URL.
    const entry = window.history.state?.paProcessSelection
    const explicitKey = kind === 'toggle' ? 'explicitPicks' : 'explicitOverrides'
    const explicit = new Set<string>(Array.isArray(entry?.[explicitKey]) ? entry[explicitKey] : [])
    if (candidateId === undefined) explicit.delete(scope)
    else explicit.add(scope)
    window.history.replaceState({ ...window.history.state, paProcessSelection: { ...window.history.state?.paProcessSelection,
      recordId, via: encodeViaParam(picks), lens: { ...current, picks },
      picks: vendors.picks, overrides: vendors.overrides,
      [explicitKey]: [...explicit],
    } }, '', window.location.href)
  }, [recordId, choices, vendors?.revision, vendors?.change, vendors?.picks, vendors?.overrides])
  return null
}
