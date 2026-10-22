import type { Execution } from './execution'
// Jurisdiction-conditional process steps (founder 2026-09-25: "allow more options for the
// processes — ie multi-state situations or California included — so we can see how the
// processes change"). A DAG node may declare `jurisdictions: ['CA'] | ['MULTI']` meaning the
// step only applies when the reader turns that jurisdiction on; absence = applies everywhere
// (the Delaware-only default every judged number is computed from).
//
// This module is the CLIENT-SAFE half (no node:fs — the lib/processSim.ts split convention):
// the allowed-jurisdiction set, the ?juris= URL/localStorage codec, and the honest client-side
// ceiling recompute for components/JurisdictionToggle.tsx. Server-side loading/filtering lives
// in lib/processes.ts: loadProcesses() strips conditional nodes at load time, so every static
// surface (ceilings, rankings, simulator, manifest, DAG) keeps the byte-identical default view
// and no judged number moves — conditional steps only ever render client-side, after the
// reader opts in.

import type { StepRoute } from './processSim'

export const JURISDICTIONS = ['CA', 'MULTI'] as const
export type Jurisdiction = (typeof JURISDICTIONS)[number]

export const JURISDICTION_META: Record<
  Jurisdiction,
  { pill: string; badge: string; noun: string; title: string }
> = {
  CA: {
    pill: '+ California',
    badge: 'CA',
    noun: 'CA',
    title:
      'Add the California steps: foreign qualification, EDD employer registration, the $800 FTB minimum franchise tax, the Statement of Information',
  },
  MULTI: {
    pill: '+ Multi-state',
    badge: 'multi-state',
    noun: 'multi-state',
    title:
      'Add the multi-state steps: per-state registered agents, payroll tax registrations, annual reports, sales-tax nexus',
  },
}

// URL/localStorage contract (lib/urlState.ts conventions): the default — Delaware-only, no
// conditional steps — NEVER appears in the URL; ?juris=ca / ?juris=multi / ?juris=ca,multi is
// the shareable non-default state, mirrored to localStorage under `pa-jurisdiction`.
export const JURIS_PARAM = 'juris'
export const JURIS_STORAGE_KEY = 'pa-jurisdiction'

// Tolerant parse of a ?juris= value (or the stored copy): lowercase tokens, unknown tokens
// dropped, output deduped in canonical JURISDICTIONS order — never a crash, never an invalid
// jurisdiction in state.
export function parseJuris(raw: string | null): Jurisdiction[] {
  if (!raw) return []
  const tokens = new Set(raw.split(',').map((t) => t.trim().toLowerCase()))
  return JURISDICTIONS.filter((j) => tokens.has(j.toLowerCase()))
}

// Canonical serialization — null for the default (the caller passes it straight to setParams,
// which deletes the param, and removes the localStorage copy).
export function serializeJuris(active: Jurisdiction[]): string | null {
  const canonical = JURISDICTIONS.filter((j) => active.includes(j))
  return canonical.length === 0 ? null : canonical.map((j) => j.toLowerCase()).join(',')
}

// One conditional step, pre-serialized server-side (lib/processes.ts jurisdictionStepViews) so
// the client component never touches the corpus loader.
export interface JurisdictionStepView {
  label: string
  route?: StepRoute
  execution?: Execution
  jurisdictions: Jurisdiction[]
  /** Canonical do-it-yourself page (verified live before listing) — null when none exists. */
  actionUrl: string | null
  actionLabel: string | null
  estimatedMinutes?: number
  async: boolean
  /** Internal link when the step's work already lives in its own corpus process. */
  processHref: string | null
  processTitle: string | null
}

export interface JurisdictionCeiling {
  agentSteps: number
  totalSteps: number
  pct: number
  /** How many conditional steps the active jurisdictions added. */
  addedSteps: number
}

// The honest client-side recompute: the displayed ceiling with the active jurisdictions' steps
// counted in. Same arithmetic as lib/processes.ts computeCeiling (agent steps / total steps),
// applied to the base (default) ceiling plus the toggled-on steps — labelled as the
// with-jurisdictions number, never presented as the judged default.
export function ceilingWithJurisdictions(
  base: { agentSteps: number; totalSteps: number },
  steps: JurisdictionStepView[],
  active: Jurisdiction[],
): JurisdictionCeiling {
  const added = steps.filter((s) => s.jurisdictions.some((j) => active.includes(j)))
  const agentSteps = base.agentSteps + added.filter((s) => s.route === 'agent').length
  const totalSteps = base.totalSteps + added.length
  return {
    agentSteps,
    totalSteps,
    pct: totalSteps === 0 ? 0 : Math.round((agentSteps / totalSteps) * 100),
    addedSteps: added.length,
  }
}

// The steps the active jurisdictions turn on, in corpus order.
export function activeJurisdictionSteps(
  steps: JurisdictionStepView[],
  active: Jurisdiction[],
): JurisdictionStepView[] {
  return steps.filter((s) => s.jurisdictions.some((j) => active.includes(j)))
}
