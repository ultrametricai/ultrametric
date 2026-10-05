// Method variants, CLIENT-SAFE half (founder 2026-09-30: "certain processes have steps that
// are just ONE way to do it when there are multiple methods depending on context — get multiple
// options selectable by context"). The serializable view shapes the server builds
// (lib/stepMethodData.ts, node:fs side — the lib/jurisdictions.ts split convention) plus the
// tiny per-tab selection store the picker and the default-content wrapper share.
//
// The personalization contract applies unchanged: the static HTML always renders the DEFAULT
// method — the node's own committed fields, the ones every judged number is computed from —
// and a variant only swaps the step's displayed route/vendors/calls/time client-side after a
// click (or the geo auto-preselect below). No judged number ever moves; the recalculated
// ceiling a variant shows is explicitly labelled "with this method".

import type { GeoSelection } from './geoPreference'

export type StepRoute = 'agent' | 'form' | 'person'
export type StepMethodContextKind = 'situational' | 'geo' | 'vendor'

// One vendor chip of a method view — the client-safe shape of lib/processes.ts VendorChipInfo
// plus the server-resolved logo flag (hasLogo is node:fs).
export interface StepMethodChipView {
  vendor: string
  label: string
  productId: string | null
  arenaId: string | null
  arenaName: string | null
  agentReady: number | null
  rank: number | null
  signupUrl: string | null
  hasLogo: boolean
}

// One node of a method's mini sub-DAG (2–5 steps, corpus-committed — never nested further).
export interface StepMethodSubStepView {
  id: string
  label: string
  route: StepRoute
  legalSignature: boolean
  async: boolean
  estimatedMinutes: number
  calls: string[]
  actionUrl: string | null
  actionLabel: string | null
  chips: StepMethodChipView[]
}

// One selectable method — the DEFAULT entry is synthesized from the node's own fields
// (context null), variants come from the corpus. `ceiling` is the whole process's ceiling
// recomputed WITH this method substituted for the node (server-side arithmetic, same
// computeCeiling math) — null when the diagram has no task context.
export interface StepMethodView {
  id: string
  label: string
  summary: string | null
  context: { kind: StepMethodContextKind; when: string; countries: GeoSelection[] } | null
  route: StepRoute
  estimatedMinutes: number | null
  calls: string[]
  chips: StepMethodChipView[]
  subSteps: StepMethodSubStepView[]
  actionUrl: string | null
  actionLabel: string | null
  ceiling: { agentSteps: number; totalSteps: number; pct: number } | null
}

export const DEFAULT_METHOD_ID = 'default'

// One selection key per rendered step block. Chain pages render the same task at most once, so
// taskId:nodeId is unique per page; taskless diagrams share the 'solo' namespace.
export function stepMethodNodeKey(taskId: string | undefined, nodeId: string): string {
  return `${taskId ?? 'solo'}:${nodeId}`
}

// ---------------------------------------------------------------------------------------------
// The per-tab selection store — module-level client state, the lib/geoPreference.ts pattern:
// every subscriber sees the same selection, StepMethodGeo (the geo auto-select) is the only writer, and the server
// render never touches it (the server/initial snapshot is always the default method).

type Listener = () => void
const selections = new Map<string, string>()
const listeners = new Set<Listener>()

export function methodSelection(nodeKey: string): string {
  return selections.get(nodeKey) ?? DEFAULT_METHOD_ID
}

export function setMethodSelection(nodeKey: string, methodId: string): void {
  if (methodSelection(nodeKey) === methodId) return
  if (methodId === DEFAULT_METHOD_ID) selections.delete(nodeKey)
  else selections.set(nodeKey, methodId)
  for (const l of listeners) l()
}

export function subscribeMethodSelections(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test helper — clears every selection (module state persists across renders by design). */
export function resetMethodSelections(): void {
  selections.clear()
  for (const l of listeners) l()
}
