// The pure half of the process LENS — "view this process via the vendors I pick" — split out
// of lib/processLens.ts: the lens-state codec, the ?via URL codec,
// and the per-step resolution/summary math. Free of node builtins, React, and the DOM, so the
// open shared-processes layer (lib/shared-processes/selection-compatibility.ts) can reuse the
// SAME precedence and shutdown rules the canonical page uses. The storage/subscription layer
// and the hooks stay in lib/processLens.ts with the site.
//
// Resolution order per step (the semantics, tested in lib/__tests__/processLens.test.ts):
//   1. the explicit lens pick for one of the step's arenas — but ONLY when that vendor appears
//      in the step's serialized vendor list for that arena and is not shutdown (lib/shutdown.ts
//      founder rule: a shutdown vendor is never OFFERED, so the lens can never resolve to one);
//   2. else the best of the reader's account-stack picks (lib/processCheck.ts yoursForStep —
//      with multiple picks per arena the highest-scoring covered one serves the step, and a
//      shutdown pick DOES resolve: the reader really runs it and needs to be told to migrate);
//   3. else null — the default/best view, exactly what the static page shows.

import { yoursForStep, type CheckVendor, type ProcessCheckStep } from './processCheck'
import type { StackMap } from './stackShared'

// ONE pick per arena — deliberately single even though the account stack (StackMap) now holds
// multiple picks per arena: a lens is an explicit per-page VIEW choice ("show me this process
// via X"), not an inventory of what the reader runs.
export type LensMap = Record<string, string>

export interface LensState {
  picks: LensMap
  /** Display names recorded at click time, keyed by productId — pruned to picked ids on write. */
  names: Record<string, string>
}

export const EMPTY_LENS_RAW = '{}'
export const PROCESS_LENS_PREFIX = 'pa-process-lens:'
export const MAX_LENS_ARENAS = 100

export function lensStorageKey(pageKey: string): string {
  return `${PROCESS_LENS_PREFIX}${pageKey}`
}

// Tolerant parse, entry-wise degradation, never a crash — the account-stack parseStackMap
// contract. Anything that isn't { picks: {string: string}, names: {string: string} } degrades.
export function parseLensState(raw: string | null): LensState {
  const empty: LensState = { picks: {}, names: {} }
  if (!raw) return empty
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty
  const readMap = (value: unknown, cap: number): Record<string, string> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === '' || typeof v !== 'string' || v === '') continue
      out[k] = v
      if (Object.keys(out).length >= cap) break
    }
    return out
  }
  const obj = parsed as { picks?: unknown; names?: unknown }
  return { picks: readMap(obj.picks, MAX_LENS_ARENAS), names: readMap(obj.names, MAX_LENS_ARENAS) }
}

// Canonical serialization (sorted keys) so snapshots are stable regardless of insertion order.
export function serializeLensState(state: LensState): string {
  const sorted = (m: Record<string, string>) =>
    Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify({ picks: sorted(state.picks), names: sorted(state.names) })
}

// ---------------------------------------------------------------------------
// Shareable lens URLs — ?via=<arenaId>:<productId>. Multi-arena lenses join entries with
// commas (?via=banking:mercury,payroll:gusto); a repeated ?via=…&via=… also parses.
// ---------------------------------------------------------------------------

export const LENS_URL_PARAM = 'via'

// Tolerant ?via parse: entries missing either side of the colon are skipped silently (a mangled
// shared URL degrades to the default view, never crashes), capped like parseLensState.
export function parseViaParam(values: string[]): LensMap {
  const picks: LensMap = {}
  for (const value of values) {
    for (const entry of value.split(',')) {
      const sep = entry.indexOf(':')
      if (sep <= 0 || sep === entry.length - 1) continue
      if (Object.keys(picks).length >= MAX_LENS_ARENAS) return picks
      picks[entry.slice(0, sep)] = entry.slice(sep + 1)
    }
  }
  return picks
}

// Canonical param value (sorted arenas, comma-joined) — null when the lens is empty, so the
// caller's setParams({ via: … }) deletes the param and a cleared lens leaves a clean URL.
export function encodeViaParam(picks: LensMap): string | null {
  const entries = Object.entries(picks).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return null
  return entries.map(([arenaId, productId]) => `${arenaId}:${productId}`).join(',')
}

// ---------------------------------------------------------------------------
// Resolution — pure functions over the pre-serialized ProcessCheckStep rows
// ---------------------------------------------------------------------------

export type LensSource = 'lens' | 'stack'

export interface ResolvedStepVendor {
  vendor: CheckVendor & { arenaId: string; arenaName: string }
  source: LensSource
}

// Which vendor executes one step under this lens + stack — the resolution order documented in
// the header. Arenas are tried in serialized order (covering arena first, then extras), the
// same convention as yoursForStep.
export function resolveStepVendor(
  step: ProcessCheckStep,
  lens: LensMap,
  stack: StackMap,
): ResolvedStepVendor | null {
  for (const arena of step.arenas) {
    const pickId = lens[arena.arenaId]
    if (!pickId) continue
    const vendor = arena.vendors.find((v) => v.productId === pickId)
    // A lens pick never resolves to a shutdown vendor — the lens is an OFFER surface
    // (lib/shutdown.ts); the pick falls through to the stack / default instead.
    if (vendor && vendor.shutdown !== true) {
      return { vendor: { ...vendor, arenaId: arena.arenaId, arenaName: arena.arenaName }, source: 'lens' }
    }
  }
  const yours = yoursForStep(step, stack)
  return yours ? { vendor: yours, source: 'stack' } : null
}

export interface LensGap {
  arenaId: string
  arenaName: string
  productId: string
}

// The honest per-step gap: the FIRST of the step's arenas carrying a lens pick that does not
// cover the step (the vendor has no judged evidence on the step's mapped stories, or announced
// a shutdown). Arenas the lens says nothing about are not gaps — the lens never claimed to
// serve them. Callers show the note only when the step didn't resolve via the lens at all.
export function lensGapFor(step: ProcessCheckStep, lens: LensMap): LensGap | null {
  for (const arena of step.arenas) {
    const pickId = lens[arena.arenaId]
    if (!pickId) continue
    const vendor = arena.vendors.find((v) => v.productId === pickId)
    if (!vendor || vendor.shutdown === true) {
      return { arenaId: arena.arenaId, arenaName: arena.arenaName, productId: pickId }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// The process-level summary — lib/processRankings.ts processLeaderboard's math, client-safe
// ---------------------------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10

export interface LensSummary {
  /** The distinct vendors the lens/stack resolves across the steps, first-seen order. */
  vendors: Array<{ productId: string; name: string; source: LensSource }>
  /** Steps a resolved vendor serves (has a judged step score on). */
  served: number
  /** All rankable steps (== steps.length) — the leaderboard's denominator. */
  rankable: number
  /** Sum of resolved step scores over ALL rankable steps (unserved = 0), normalized 0–100 —
   *  the SAME formula as processLeaderboard's processScore (sum / rankable, one decimal). */
  score: number
}

export function lensProcessSummary(
  steps: ProcessCheckStep[],
  lens: LensMap,
  stack: StackMap,
): LensSummary {
  const vendors: LensSummary['vendors'] = []
  const seen = new Set<string>()
  let sum = 0
  let served = 0
  for (const step of steps) {
    const r = resolveStepVendor(step, lens, stack)
    if (!r) continue
    sum += r.vendor.score
    served += 1
    if (!seen.has(r.vendor.productId)) {
      seen.add(r.vendor.productId)
      vendors.push({ productId: r.vendor.productId, name: r.vendor.name, source: r.source })
    }
  }
  return {
    vendors,
    served,
    rankable: steps.length,
    score: steps.length === 0 ? 0 : round1(sum / steps.length),
  }
}
