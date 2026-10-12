// The process LENS — "view this process via the vendors I pick" (founder 2026-09-21: "while on
// a specific process, if the user clicks a vendor I want it to select using that vendor through
// the process and adapt the DAG to using that … also if they have certain vendors they use I
// want them to see the process via those vendors"). Client-safe (no node builtins), the same
// split as lib/processCheck.ts vs lib/processCheckData.ts.
//
// The lens is a client-side view over the SAME static HTML — the personalization contract used
// everywhere on this site: the server snapshot renders the default view byte-identically, and
// only readers who click a vendor or carry an "I'm using" stack see anything change. Nothing
// here recomputes a score: every number is the pre-serialized story-derived step score the
// process page already publishes (lib/processCheckData.ts), only re-arranged.
//
// The pure semantics — the lens-state codec, the ?via URL codec, and the per-step
// resolution/summary math — live in lib/processLensCore.ts (open; the shared-processes layer
// reuses them). This file owns the browser half: localStorage persistence under
// `pa-process-lens:<pageKey>` (taskId on /processes/[slug], the chain id on
// /processes/chains/[chain] so one selection flows across all sections), the same-tab change
// event (the exact lib/myStack.ts subscribe pattern), the URL sync, and the hooks.
//
// The adaptation is WHO EXECUTES a step, never WHAT IS POSSIBLE: routes and agent ceilings are
// untouched — picking a vendor doesn't make a human step agent-runnable.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useMyStackMap } from '@/components/useMyStackMap'
import type { StackMap } from './stackShared'
import type { ProcessCheckStep } from './processCheck'
import {
  EMPTY_LENS_RAW,
  LENS_URL_PARAM,
  lensStorageKey,
  parseLensState,
  parseViaParam,
  encodeViaParam,
  resolveStepVendor,
  serializeLensState,
  type LensState,
  type ResolvedStepVendor,
} from './processLensCore'
import { readParamAll, setParams } from './urlState'

// Re-exported so existing component imports keep one entry point for the lens API.
export {
  EMPTY_LENS_RAW,
  LENS_URL_PARAM,
  MAX_LENS_ARENAS,
  PROCESS_LENS_PREFIX,
  encodeViaParam,
  lensGapFor,
  lensProcessSummary,
  lensStorageKey,
  parseLensState,
  parseViaParam,
  resolveStepVendor,
  serializeLensState,
} from './processLensCore'
export type {
  LensGap,
  LensMap,
  LensSource,
  LensState,
  LensSummary,
  ResolvedStepVendor,
} from './processLensCore'

// Same-tab change event — localStorage's 'storage' event only fires in OTHER tabs (the
// lib/myStack.ts precedent).
export const PROCESS_LENS_EVENT = 'pa-process-lens-change'

// Raw snapshot for useSyncExternalStore — the STRING is the snapshot (stable identity between
// writes), '{}' on the server and where localStorage throws.
export function readLensRaw(storageKey: string): string {
  if (typeof window === 'undefined') return EMPTY_LENS_RAW
  try {
    return window.localStorage.getItem(storageKey) ?? EMPTY_LENS_RAW
  } catch {
    return EMPTY_LENS_RAW
  }
}

export function writeLens(storageKey: string, state: LensState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, serializeLensState(state))
  } catch {
    return // storage unavailable — the click is a silent no-op, same as reads
  }
  window.dispatchEvent(new Event(PROCESS_LENS_EVENT))
}

export function subscribeLens(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(PROCESS_LENS_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(PROCESS_LENS_EVENT, callback)
  }
}

// URL ⇄ lens sync — mounted ONCE per process/chain page (components/ProcessLensBanner.tsx, the
// one component every lens page renders exactly once with the canonical pageKey), never inside
// useProcessLens itself: per-step hooks may someday mount with OTHER pageKeys on the same page,
// and a stray ?via must not be imported into every one of them.
//   Mount:  a ?via lens WINS over localStorage for this pageKey and is saved to it (stored
//           click-time names are kept for ids the URL still picks); no ?via → storage stands
//           and the URL stays clean (a lens from last week is not exported unasked).
//   After:  every pick/clear — from ANY component on the page, via the subscribe event —
//           mirrors the whole lens back into ?via (empty lens deletes the param).
export function useLensUrlSync(pageKey: string | undefined): void {
  const storageKey = pageKey === undefined || pageKey === '' ? null : lensStorageKey(pageKey)

  useEffect(() => {
    if (storageKey === null) return
    const picks = parseViaParam(readParamAll(LENS_URL_PARAM))
    if (Object.keys(picks).length === 0) return // absent or fully invalid — silent fallback
    const current = parseLensState(readLensRaw(storageKey))
    const pickedIds = new Set(Object.values(picks))
    const names: Record<string, string> = {}
    for (const [id, name] of Object.entries(current.names)) if (pickedIds.has(id)) names[id] = name
    const next: LensState = { picks, names }
    if (serializeLensState(next) !== serializeLensState(current)) writeLens(storageKey, next)
  }, [storageKey])

  const getSnapshot = useCallback(
    () => (storageKey === null ? EMPTY_LENS_RAW : readLensRaw(storageKey)),
    [storageKey],
  )
  const raw = useSyncExternalStore(subscribeLens, getSnapshot, () => EMPTY_LENS_RAW)
  const mirroring = useRef(false)
  useEffect(() => {
    if (storageKey === null) return
    // Skip the first run (the state as-loaded): only CHANGES write the URL — see the mount
    // semantics above. The URL-import write above lands as a later `raw` and mirrors ?via to
    // its own (already identical) value, which setParams no-ops.
    if (!mirroring.current) {
      mirroring.current = true
      return
    }
    setParams({ [LENS_URL_PARAM]: encodeViaParam(parseLensState(raw).picks) })
  }, [raw, storageKey])
}

// ---------------------------------------------------------------------------
// The hook — useMyStackMap's useSyncExternalStore pattern, plus the stack itself
// ---------------------------------------------------------------------------

export interface ProcessLens {
  lens: LensState
  stack: StackMap
  /** Set (or, with null, clear) the lens pick for one arena. `name` is recorded for honest
   *  gap notes on steps the vendor doesn't cover. No-op without a pageKey. */
  setPick: (arenaId: string, productId: string | null, name?: string) => void
  clearLens: () => void
  resolveFor: (step: ProcessCheckStep) => ResolvedStepVendor | null
}

const EMPTY_STATE: LensState = { picks: {}, names: {} }

export function useProcessLens(pageKey: string | undefined): ProcessLens {
  const storageKey = pageKey === undefined || pageKey === '' ? null : lensStorageKey(pageKey)
  const getSnapshot = useCallback(
    () => (storageKey === null ? EMPTY_LENS_RAW : readLensRaw(storageKey)),
    [storageKey],
  )
  // Server snapshot is '{}' — the static HTML always renders the default (no-lens) view.
  const raw = useSyncExternalStore(subscribeLens, getSnapshot, () => EMPTY_LENS_RAW)
  const lens = useMemo(() => (raw === EMPTY_LENS_RAW ? EMPTY_STATE : parseLensState(raw)), [raw])
  const stack = useMyStackMap()

  const setPick = useCallback(
    (arenaId: string, productId: string | null, name?: string) => {
      if (storageKey === null) return
      const current = parseLensState(readLensRaw(storageKey))
      const picks = { ...current.picks }
      const names = { ...current.names }
      if (productId === null) delete picks[arenaId]
      else {
        picks[arenaId] = productId
        if (name) names[productId] = name
      }
      const pickedIds = new Set(Object.values(picks))
      for (const id of Object.keys(names)) if (!pickedIds.has(id)) delete names[id]
      writeLens(storageKey, { picks, names })
    },
    [storageKey],
  )

  const clearLens = useCallback(() => {
    if (storageKey === null) return
    writeLens(storageKey, { picks: {}, names: {} })
  }, [storageKey])

  const resolveFor = useCallback(
    (step: ProcessCheckStep) => resolveStepVendor(step, lens.picks, stack),
    [lens, stack],
  )

  return { lens, stack, setPick, clearLens, resolveFor }
}
