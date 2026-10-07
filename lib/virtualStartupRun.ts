// Virtual Startup v3 (founder-approved 2026-09-28) — the run layer on top of lib/virtualStartup:
//   1. vendor picks change outcomes (agent-surface picks run at corpus "agent speed"; picks with
//      no MCP/CLI surface fall back to founder-hours — a DISCLOSED simulation assumption);
//   2. founder axes (Technical × Experience — orthogonal, composable) shift which person-routed
//      work is DIY vs delegated (each modifier a named, displayed simulation assumption);
//   3. seeded mid-run events, each grounded in a real corpus process and gated by plausibility
//      (corpus risk scores + the run's decisions), with deterministic branching choices;
//   4. the scorecard + a compact shareable ?run= permalink that replays the exact run.
//
// Same honesty contract as lib/virtualStartup.ts, plus one more rule this file owns: JUDGED data
// (access verdicts, rankings, corpus minutes, published pricing) is never blended silently with
// simulation constants — every constant below is exported, named, and rendered in the UI with
// the words "simulation assumption" (VS_ASSUMPTIONS; tests enforce the phrase). Everything here
// is pure and client-safe (no node builtins); deterministic from (combo, preset, founder axes,
// seed): zero runtime LLM, every derived number recomputable from committed data.

import type { StepRoute, VendorRole } from './processSim'
import {
  comboKey,
  DECISIONS,
  DEFAULT_CHOICES,
  gateActive,
  presetById,
  VS_AI_FIRM_IDS,
  type Choices,
  type JourneyPhase,
  type PresetId,
  type VirtualTaskPayload,
  type VsGate,
} from './virtualStartup'

// ---------------------------------------------------------------------------
// Agent-access surfaces (canonical verdicts, serialized server-side)
// ---------------------------------------------------------------------------

// One product's canonical agent-access verdicts for the two agent surfaces the outcome model
// reads (lib/accessGlyphs.ts bestAccessVerdict over the agentic MCP / official-CLI stories) —
// resolved server-side by lib/virtualStartupData.ts buildVsAccess, never re-judged here.
export type VsVerdictKind = 'full' | 'partial' | 'disputed' | 'none' | 'na'

export interface VsAccessSurface {
  mcp: VsVerdictKind
  cli: VsVerdictKind
}

// arenaId → productId → surfaces, for every SwapOption of every role.
export type VsAccessMap = Record<string, Record<string, VsAccessSurface>>

// The judged bar for "an agent can drive this vendor": a full or partial verdict on MCP or CLI.
// Disputed/none/na are honestly NOT an agent surface — the simulation never upgrades a verdict.
export function hasAgentSurface(surface: VsAccessSurface | undefined): boolean {
  if (!surface) return false
  const ok = (v: VsVerdictKind) => v === 'full' || v === 'partial'
  return ok(surface.mcp) || ok(surface.cli)
}

// ---------------------------------------------------------------------------
// Simulation assumptions — named constants, disclosed in the UI, tested for the phrase
// ---------------------------------------------------------------------------

// A step an agent cannot run (the picked vendor has no judged MCP/CLI surface, or a founder
// axis pushes it onto the founder) takes this multiple of the corpus estimate. A simulation
// assumption, NOT judged data — the corpus estimates assume the recorded (agent) path.
export const FOUNDER_HOURS_MULTIPLIER = 3

// A repeat entrepreneur moves faster through paper they have signed before. (Display rename
// 2026-09-29: 'Second-timer' → 'Repeat entrepreneur' everywhere VISIBLE; the internal
// 'second-timer' ids/tokens are permalink codec surface and never change.)
export const SECOND_TIMER_MULTIPLIER = 0.5

export const VS_ASSUMPTIONS: ReadonlyArray<{ id: string; text: string }> = [
  {
    id: 'founder-hours',
    text: `simulation assumption — a step whose picked vendor has no judged MCP/CLI agent surface runs at founder-hours: ×${FOUNDER_HOURS_MULTIPLIER} the corpus estimate`,
  },
  {
    id: 'persona-non-technical',
    text: `simulation assumption — a non-technical founder runs engineering steps (the ship-v1 / launch-website playbooks) at founder-hours (×${FOUNDER_HOURS_MULTIPLIER}) unless an agent runs them`,
  },
  {
    id: 'persona-second-timer',
    text: `simulation assumption — a repeat entrepreneur runs legal/finance steps at ×${SECOND_TIMER_MULTIPLIER} (they have signed this paper before), unless an agent already runs them`,
  },
] as const

// ---------------------------------------------------------------------------
// Founder axes (founder batch 2026-09-29, item 4)
// ---------------------------------------------------------------------------
// The old three mutually-exclusive personas (solo-technical / non-technical / second-timer)
// tangled two independent dimensions — and duplicated founder-count, which is ALREADY the
// 'Cofounders vs Solo founder' decision. The founder layer is now two orthogonal axes:
//   Technical  — technical (baseline) vs non-technical (engineering steps at founder-hours);
//   Experience — first-timer (baseline) vs second-timer (legal/finance steps at ×0.5).
// The two axis modifiers COMPOSE (a non-technical second-timer applies both; a step that
// qualified for both would multiply both) — each still a named, displayed simulation assumption.
// No solo assumption lives here: team size is the Team decision's business alone.

export type VsTechnicalAxis = 'technical' | 'non-technical'
export type VsExperienceAxis = 'first-timer' | 'second-timer'

export interface VsFounderAxes {
  technical: VsTechnicalAxis
  experience: VsExperienceAxis
}

export const DEFAULT_FOUNDER_AXES: VsFounderAxes = { technical: 'technical', experience: 'first-timer' }

export interface VsAxisOption<V extends string = string> {
  value: V
  label: string
  // Compact picker text (the canonical `label` stays the accessible name).
  short: string
  blurb: string
  // The matching data/icp-types.json lens where one exists — a cross-reference, not a data
  // dependency; null where the corpus has no such lens and the option is defined editorially.
  icpId: string | null
  // The option's named modifier, phrased as a visible simulation assumption; null = baseline.
  assumption: string | null
}

export const VS_TECHNICAL_OPTIONS: VsAxisOption<VsTechnicalAxis>[] = [
  {
    value: 'technical',
    label: 'Technical founder',
    short: 'Technical',
    blurb: 'builds the product themselves — the corpus baseline, no modifier',
    icpId: null,
    assumption: null,
  },
  {
    value: 'non-technical',
    label: 'Non-technical founder',
    short: 'Non-technical',
    blurb: 'delegates or grinds through the engineering work',
    icpId: 'non-technical-operator',
    assumption: VS_ASSUMPTIONS.find((a) => a.id === 'persona-non-technical')!.text,
  },
]

export const VS_EXPERIENCE_OPTIONS: VsAxisOption<VsExperienceAxis>[] = [
  {
    value: 'first-timer',
    label: 'First-time founder',
    short: 'First-timer',
    blurb: 'signing all of this paper for the first time — the corpus baseline, no modifier',
    icpId: null,
    assumption: null,
  },
  {
    // Display-only rename (founder 2026-09-29): 'Repeat entrepreneur' — the internal value,
    // seed token, and codec char stay 'second-timer'/'2' for permalink compat.
    value: 'second-timer',
    label: 'Repeat entrepreneur',
    short: 'Repeat entrepreneur',
    blurb: 'has incorporated, raised, and signed all of this before',
    icpId: null,
    assumption: VS_ASSUMPTIONS.find((a) => a.id === 'persona-second-timer')!.text,
  },
]

// The active axes' named simulation assumptions (0–2 lines), in axis order.
export function founderAssumptions(axes: VsFounderAxes): string[] {
  const out: string[] = []
  const tech = VS_TECHNICAL_OPTIONS.find((o) => o.value === axes.technical)
  const exp = VS_EXPERIENCE_OPTIONS.find((o) => o.value === axes.experience)
  if (tech?.assumption) out.push(tech.assumption)
  if (exp?.assumption) out.push(exp.assumption)
  return out
}

// v1 → v2 migration: the legacy mutually-exclusive persona ids map onto exact axis pairs, so a
// shared v1 ?run= keeps decoding (and, via founderSeedToken below, keeps drawing the same
// event stream it always did).
export const LEGACY_PERSONA_AXES: Record<string, VsFounderAxes> = {
  'solo-technical': { technical: 'technical', experience: 'first-timer' },
  'non-technical': { technical: 'non-technical', experience: 'first-timer' },
  'second-timer': { technical: 'technical', experience: 'second-timer' },
}

// The founder token inside the event seed key — deterministic from the axis pair. The three
// pairs a legacy persona maps to keep their ORIGINAL v1 tokens on purpose: a shared v1 run link
// replays with the exact event stream it was shared with. Only the previously unreachable
// fourth combination gets a new token.
export function founderSeedToken(axes: VsFounderAxes): string {
  if (axes.technical === 'technical') {
    return axes.experience === 'first-timer' ? 'solo-technical' : 'second-timer'
  }
  return axes.experience === 'first-timer' ? 'non-technical' : 'non-technical+second-timer'
}

// The chains whose steps count as "engineering" for the non-technical modifier — the build
// playbooks, by chain id (visible in the journey's phase headers, so the scope is inspectable).
export const ENGINEERING_CHAIN_IDS: readonly string[] = ['ship-v1', 'launch-website']

// The corpus task-id prefixes (plus the founder agreement) that count as "legal/finance" for
// the second-timer modifier — named so the scope is inspectable, not vibes.
export const LEGAL_FINANCE_TASK_PREFIXES: readonly string[] = ['legal_', 'form_', 'fund_', 'fin_', 'tax_']
export const LEGAL_FINANCE_TASK_IDS: readonly string[] = ['startup_002']

export function isLegalFinanceTask(taskId: string): boolean {
  return (
    LEGAL_FINANCE_TASK_IDS.includes(taskId) ||
    LEGAL_FINANCE_TASK_PREFIXES.some((p) => taskId.startsWith(p))
  )
}

// ---------------------------------------------------------------------------
// Outcome math — vendor picks + founder axes drive the simulated time
// ---------------------------------------------------------------------------

// One journey step flattened for the outcome model. `key` is `${taskId}:${stepIndex}` — the
// same identity the timeline rows use, so recomputed minutes slot back onto the day markers.
export interface OutcomeStepInput {
  key: string
  taskId: string
  phaseId: string
  chainId: string
  route: StepRoute
  arenaId: string | null
  estimatedMinutes: number
}

// The journey's launch milestone: the end of the 'launch' phase (the directory launch) when the
// run has one, else the end of the 'website' phase (a quiet launch is the site going live).
// Phases after it — deferred compliance, the YC Demo-Day raise, the enterprise motion — are
// post-launch operations and never count against time-to-launch.
export function launchPhaseIdOf(phases: Array<Pick<JourneyPhase, 'id'>>): string | null {
  if (phases.some((p) => p.id === 'launch')) return 'launch'
  if (phases.some((p) => p.id === 'website')) return 'website'
  return phases.length > 0 ? phases[phases.length - 1].id : null
}

// Flattens the selected journey (phases → task payloads → steps) in timeline order — the single
// place step keys are minted, shared by the outcome model and the timeline's day-marker loop.
export function journeyOutcomeInputs(
  phases: JourneyPhase[],
  tasks: Record<string, VirtualTaskPayload>,
): OutcomeStepInput[] {
  const out: OutcomeStepInput[] = []
  for (const phase of phases) {
    for (const taskId of phase.taskIds) {
      const task = tasks[taskId]
      if (!task) continue
      task.steps.forEach((step, i) => {
        out.push({
          key: `${taskId}:${i}`,
          taskId,
          phaseId: phase.id,
          chainId: phase.chainId,
          route: step.route,
          arenaId: step.arenaId,
          estimatedMinutes: step.estimatedMinutes,
        })
      })
    }
  }
  return out
}

// The launch day the raw corpus estimates give (pre-launch prefix, unmodified) — the event
// engine's day span, deliberately independent of picks/axes so the drawn events stay
// deterministic from (combo, preset, founder axes, seed) alone.
export function corpusLaunchDay(inputs: OutcomeStepInput[]): number {
  const phaseIds: Array<{ id: string }> = []
  for (const s of inputs) {
    if (phaseIds.length === 0 || phaseIds[phaseIds.length - 1].id !== s.phaseId) phaseIds.push({ id: s.phaseId })
  }
  const launchPhase = launchPhaseIdOf(phaseIds)
  let seen = false
  let mins = 0
  for (const s of inputs) {
    if (s.phaseId === launchPhase) seen = true
    else if (seen) break
    mins += s.estimatedMinutes
  }
  return dayOfMinutes(mins)
}

export interface StepOutcome {
  key: string
  // Effective simulated minutes after the stack/axis rules below.
  minutes: number
  // True when the step runs at agent speed: an agent-routed step whose picked vendor has a
  // judged MCP/CLI surface, or an agent-routed step not served by any swappable role (tooling
  // steps with no vendor to swap — unserved steps are unchanged by construction).
  agentRun: boolean
  // Names the applied rule when the minutes differ from the corpus estimate; null otherwise.
  note: string | null
}

export interface StackOutcome {
  steps: StepOutcome[]
  minutesByKey: Record<string, number>
  totalSteps: number
  agentRunSteps: number
  agentRunPct: number
  // Whole-journey simulated minutes (launch + post-launch operations)…
  totalMinutes: number
  // …and the pre-launch slice (phases through launchPhaseIdOf) the launch day derives from.
  launchMinutes: number
  launchDay: number
  // The all-manual baseline (every agent-routed step at founder-hours) and the saving vs it —
  // both derived from the same disclosed multiplier, never presented as judged data.
  allManualMinutes: number
  founderHoursSavedMinutes: number
}

// 1-based simulated day — same convention as lib/virtualStartup.ts dayOf.
function dayOfMinutes(mins: number): number {
  return Math.floor(mins / (60 * 24)) + 1
}

// The whole outcome for one stack: deterministic from (journey, picks, founder axes) over the
// serialized canonical access verdicts. Rules, in order:
//   - agent-routed, served by a role, pick has MCP/CLI full|partial  → corpus minutes as-is;
//   - agent-routed, served, pick lacks an agent surface              → ×FOUNDER_HOURS_MULTIPLIER
//     (founder-hours applies once — the axis modifiers below never re-scale it);
//   - agent-routed, unserved (no swappable role for its arena)       → unchanged;
//   - non-agent steps                                                → unchanged, then the axes:
//   - non-technical: engineering-chain steps not agent-run           → ×FOUNDER_HOURS_MULTIPLIER;
//   - second-timer: legal/finance steps not agent-run                → ×SECOND_TIMER_MULTIPLIER.
// The two AXIS modifiers compose multiplicatively on a step that qualifies for both (a
// non-technical second-timer applies both rules; each names itself in the note).
export function computeStackOutcome(
  inputs: OutcomeStepInput[],
  selections: Record<string, string>,
  roles: VendorRole[],
  access: VsAccessMap,
  founder: VsFounderAxes,
): StackOutcome {
  const roleByArena = new Map(roles.map((r) => [r.arenaId, r]))
  const steps: StepOutcome[] = []
  const minutesByKey: Record<string, number> = {}
  let agentRunSteps = 0
  let totalMinutes = 0
  let launchMinutes = 0
  let allManualMinutes = 0

  // Pre-launch = every phase up to and including the launch milestone (inputs are in journey
  // order, so the pre-launch slice is a prefix).
  const phaseIds: Array<{ id: string }> = []
  for (const s of inputs) {
    if (phaseIds.length === 0 || phaseIds[phaseIds.length - 1].id !== s.phaseId) phaseIds.push({ id: s.phaseId })
  }
  const launchPhase = launchPhaseIdOf(phaseIds)
  let seenLaunchPhase = false
  let preLaunch = true

  for (const s of inputs) {
    if (s.phaseId === launchPhase) seenLaunchPhase = true
    else if (seenLaunchPhase) preLaunch = false
    const role = s.arenaId ? roleByArena.get(s.arenaId) : undefined
    const pick = role ? selections[role.arenaId] ?? role.defaultProductId : null
    const surface = role && pick ? access[role.arenaId]?.[pick] : undefined

    let minutes = s.estimatedMinutes
    let note: string | null = null
    let agentRun = false

    if (s.route === 'agent') {
      if (!role) {
        agentRun = true // unserved: no swappable vendor role — unchanged by construction
      } else if (hasAgentSurface(surface)) {
        agentRun = true
      } else {
        minutes = s.estimatedMinutes * FOUNDER_HOURS_MULTIPLIER
        note = `founder-hours ×${FOUNDER_HOURS_MULTIPLIER} — the picked vendor has no judged MCP/CLI agent surface (simulation assumption)`
      }
    }

    // The founder axes — only on steps not agent-run and not already at vendor-fallback
    // founder-hours (that multiplier applies once). The two axis rules compose.
    if (!agentRun && note === null) {
      let axisMultiplier = 1
      const axisNotes: string[] = []
      if (founder.technical === 'non-technical' && ENGINEERING_CHAIN_IDS.includes(s.chainId)) {
        axisMultiplier *= FOUNDER_HOURS_MULTIPLIER
        axisNotes.push(`founder-hours ×${FOUNDER_HOURS_MULTIPLIER} — non-technical founder on an engineering step (simulation assumption)`)
      }
      if (founder.experience === 'second-timer' && isLegalFinanceTask(s.taskId)) {
        axisMultiplier *= SECOND_TIMER_MULTIPLIER
        axisNotes.push(`×${SECOND_TIMER_MULTIPLIER} — repeat entrepreneur on a legal/finance step (simulation assumption)`)
      }
      if (axisNotes.length > 0) {
        minutes = s.estimatedMinutes * axisMultiplier
        note = axisNotes.join(' · ')
      }
    }

    if (agentRun) agentRunSteps += 1
    totalMinutes += minutes
    if (preLaunch) launchMinutes += minutes
    allManualMinutes += s.route === 'agent' ? s.estimatedMinutes * FOUNDER_HOURS_MULTIPLIER : s.estimatedMinutes
    minutesByKey[s.key] = minutes
    steps.push({ key: s.key, minutes, agentRun, note })
  }

  return {
    steps,
    minutesByKey,
    totalSteps: inputs.length,
    agentRunSteps,
    agentRunPct: inputs.length > 0 ? Math.round((agentRunSteps / inputs.length) * 100) : 0,
    totalMinutes,
    launchMinutes,
    launchDay: dayOfMinutes(launchMinutes),
    allManualMinutes,
    founderHoursSavedMinutes: allManualMinutes - totalMinutes,
  }
}

// The agents-first optimal stack: per role, the highest-ranked alternative (they arrive ranked
// by agent-readiness, lib/processes.ts vendorRoles) whose canonical verdicts show an MCP/CLI
// surface — computed from judged data, never curated. Roles with no surface-bearing vendor keep
// their default (there is honestly no agents-first pick to make).
export function optimalSelections(roles: VendorRole[], access: VsAccessMap): Record<string, string> {
  const out: Record<string, string> = {}
  for (const role of roles) {
    const best = role.alternatives.find((o) => hasAgentSurface(access[role.arenaId]?.[o.id]))
    out[role.arenaId] = best?.id ?? role.defaultProductId
  }
  return out
}

// ---------------------------------------------------------------------------
// Seeded PRNG (same fnv-1a/mulberry32 pair as lib/virtualStartup.ts — kept private there,
// re-stated here so this module stays a pure add-on with no edits to the shared file)
// ---------------------------------------------------------------------------

function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Event engine — curated, corpus-grounded, plausibility-gated, seeded
// ---------------------------------------------------------------------------

// What answering an event choice does — every time delta is either REAL corpus minutes
// (redo-tasks / add-chain-time / switch-vendor's redo) or a named wait constant that must carry
// the phrase "simulation assumption" (tests enforce it).
export type VsEventEffect =
  | { kind: 'redo-tasks'; taskIds: string[]; blurb: string }
  | { kind: 'add-chain-time'; chainId: string; blurb: string }
  | { kind: 'wait-days'; days: number; assumption: string }
  | { kind: 'lose-deal'; note: string }
  | { kind: 'switch-vendor'; arenaId: string; redoTaskId: string; blurb: string }

export interface VsEventChoiceDef {
  id: string
  label: string
  effect: VsEventEffect
  // The one-line consequence shown after choosing.
  outcome: string
}

export interface VsEventDef {
  id: string
  title: string
  blurb: string
  // The REAL corpus process this event is grounded in — the card links its process page and the
  // plausibility gate reads its corpus risk score (1–5).
  groundedIn: string
  // Corpus risk floor: the event only fires when the grounded process's risk >= minRisk.
  minRisk: number
  // Decision gates — ALL must be active for the run's combo (lib/virtualStartup gateActive).
  gates: VsGate[]
  choices: VsEventChoiceDef[]
}

// Named wait constants (each surfaced through its choice's `assumption` string).
export const PROCESSOR_REVIEW_WAIT_DAYS = 5
export const TRADEMARK_RESPONSE_WAIT_DAYS = 21
export const COFOUNDER_NEGOTIATION_WAIT_DAYS = 14
export const OUTAGE_ROLLBACK_WAIT_DAYS = 1

const waitAssumption = (days: number, what: string) =>
  `simulation assumption — ${what} is modeled as ${days} sim day${days === 1 ? '' : 's'}; the corpus carries no duration for it`

export const VS_EVENTS: VsEventDef[] = [
  {
    id: 'soc2-demand',
    title: 'An enterprise prospect demands SOC 2',
    blurb:
      'The enterprise deal you are chasing stalls in security review: the buyer wants SOC 2 evidence before pilots, and compliance was deferred to after launch.',
    groundedIn: 'comp_001',
    minRisk: 3,
    gates: [
      { choice: 'enterprise', value: 'yes', why: 'only a run chasing the enterprise deal meets this buyer' },
      { choice: 'compliance', value: 'later', why: 'compliance-early runs already have the posture standing' },
    ],
    choices: [
      {
        id: 'start-now',
        label: 'Start set-up-compliance now',
        effect: {
          kind: 'add-chain-time',
          chainId: 'set-up-compliance',
          blurb: 'the deferred set-up-compliance playbook moves before launch — its real corpus steps and time land on the clock now',
        },
        outcome: 'the compliance playbook runs before launch — launch slips by its real corpus time, the deal survives',
      },
      {
        id: 'decline',
        label: 'Decline — ship first',
        effect: { kind: 'lose-deal', note: 'the virtual enterprise deal is lost — no SOC 2, no pilot' },
        outcome: 'launch date holds, but the virtual enterprise deal is gone (scorecard hit)',
      },
    ],
  },
  {
    id: 'processor-review',
    title: 'Payment processor account review',
    blurb:
      'Your payment processor flags the new account for review — payouts pause while it verifies the business.',
    groundedIn: 'qs_021',
    minRisk: 2,
    gates: [],
    choices: [
      {
        id: 'switch',
        label: 'Switch processor',
        effect: {
          kind: 'switch-vendor',
          arenaId: 'payments',
          redoTaskId: 'qs_021',
          blurb: 'the payments pick moves to the next vendor in the real published ranking; the connect-a-payment-processor steps re-run (real corpus time)',
        },
        outcome: 'the stack re-picks payments from the real published ranking and redoes the setup steps',
      },
      {
        id: 'wait',
        label: 'Wait out the review',
        effect: {
          kind: 'wait-days',
          days: PROCESSOR_REVIEW_WAIT_DAYS,
          assumption: waitAssumption(PROCESSOR_REVIEW_WAIT_DAYS, 'a processor account review'),
        },
        outcome: `payouts resume after ${PROCESSOR_REVIEW_WAIT_DAYS} sim days`,
      },
    ],
  },
  {
    id: 'cofounder-departure',
    title: 'A cofounder departs',
    blurb:
      'One cofounder leaves mid-run. The founder agreement you signed — 4-year vest, 1-year cliff — is exactly the artifact that decides what happens to their equity.',
    groundedIn: 'startup_002',
    minRisk: 4,
    gates: [{ choice: 'team', value: 'cofounders', why: 'a solo run has no cofounder to lose' }],
    choices: [
      {
        id: 'execute-vesting',
        label: 'Execute the vesting terms',
        effect: {
          kind: 'redo-tasks',
          taskIds: ['qs_051'],
          blurb: 'the agreement’s cliff/vesting terms apply as written; the cap table re-papers (real corpus time for the cap-table process)',
        },
        outcome: 'unvested shares return per the signed agreement; the cap table is re-papered',
      },
      {
        id: 'negotiate',
        label: 'Negotiate a buyback',
        effect: {
          kind: 'wait-days',
          days: COFOUNDER_NEGOTIATION_WAIT_DAYS,
          assumption: waitAssumption(COFOUNDER_NEGOTIATION_WAIT_DAYS, 'a negotiated equity buyback'),
        },
        outcome: `terms settle after ${COFOUNDER_NEGOTIATION_WAIT_DAYS} sim days of negotiation`,
      },
    ],
  },
  {
    id: 'trademark-conflict',
    title: 'A trademark conflict letter arrives',
    blurb:
      'Counsel for an older mark writes about the name you filed. The trademark filing from the naming playbook is the process on the line.',
    groundedIn: 'legal_002',
    minRisk: 3,
    gates: [],
    choices: [
      {
        id: 'rebrand',
        label: 'Rebrand',
        effect: {
          kind: 'redo-tasks',
          taskIds: ['brand_001', 'domain_002', 'brand_002'],
          blurb: 'the naming playbook’s name/domain/logo steps re-run for the new name (real corpus time)',
        },
        outcome: 'a new name — the naming steps re-run on the clock',
      },
      {
        id: 'respond',
        label: 'Respond via counsel',
        effect: {
          kind: 'wait-days',
          days: TRADEMARK_RESPONSE_WAIT_DAYS,
          assumption: waitAssumption(TRADEMARK_RESPONSE_WAIT_DAYS, 'a counsel response and coexistence negotiation'),
        },
        outcome: `the mark survives after ${TRADEMARK_RESPONSE_WAIT_DAYS} sim days of back-and-forth`,
      },
    ],
  },
  {
    id: 'launch-day-outage',
    title: 'Launch-day traffic takes the site down',
    blurb:
      'The directory launch lands more traffic than the stack has ever seen — errors spike and the error tracker you stood up is where the fire shows first.',
    groundedIn: 'prod_004',
    minRisk: 2,
    gates: [{ choice: 'ph', value: 'yes', why: 'only a directory launch brings the launch-day spike' }],
    choices: [
      {
        id: 'hotfix',
        label: 'Hotfix under load',
        effect: {
          kind: 'redo-tasks',
          taskIds: ['prod_004'],
          blurb: 'triage runs through the error-tracking process again under load (real corpus time)',
        },
        outcome: 'the fix ships hot; the error-tracking loop re-runs on the clock',
      },
      {
        id: 'rollback',
        label: 'Roll back and relaunch tomorrow',
        effect: {
          kind: 'wait-days',
          days: OUTAGE_ROLLBACK_WAIT_DAYS,
          assumption: waitAssumption(OUTAGE_ROLLBACK_WAIT_DAYS, 'a rollback and next-day relaunch'),
        },
        outcome: `stable again after ${OUTAGE_ROLLBACK_WAIT_DAYS} sim day`,
      },
    ],
  },
]

// Plausibility gate: the run's decisions (all decision gates active), the journey actually
// containing the grounded process, and the corpus risk floor. `risks` is the committed
// processes/corpus.json risk axis, serialized server-side (lib/virtualStartupData.ts).
export function eligibleVsEvents(
  choices: Choices,
  journeyTaskIds: string[],
  risks: Record<string, number>,
): VsEventDef[] {
  const inJourney = new Set(journeyTaskIds)
  return VS_EVENTS.filter(
    (e) =>
      inJourney.has(e.groundedIn) &&
      (risks[e.groundedIn] ?? 0) >= e.minRisk &&
      e.gates.every((g) => gateActive(g, choices)),
  )
}

// The event stream's seed — (combo, preset, founder axes, seed) exactly as the founder spec
// names, plus the YC calibration flag (it changes the journey the events land on). The founder
// token is deterministic from the axis pair (legacy-stable — see founderSeedToken). The
// Apply-to-YC flag (item 6, 2026-10-01) appends its token ONLY when on — the comboKey
// convention — so every pre-existing run's event stream replays byte-identically.
export function eventSeedKey(
  choices: Choices,
  preset: PresetId | null,
  yc: boolean,
  founder: VsFounderAxes,
  seed: number,
  ycApply = false,
): string {
  const base = `vs:events:${comboKey(choices)}|p:${preset ?? '-'}|yc:${yc ? '1' : '0'}|f:${founderSeedToken(founder)}|s:${seed}`
  return ycApply ? `${base}|q:1` : base
}

export interface DrawnVsEvent {
  def: VsEventDef
  // Seeded simulated day the event lands on (2 … journeyDays), for the mid-run placement.
  day: number
}

// Draw 2–4 events per run (never more than are plausibly eligible), deterministically from the
// seed key: seeded count, seeded sample without replacement, seeded days, sorted by day then
// by table order for stability.
export function drawVsEvents(eligible: VsEventDef[], seedKey: string, journeyDays: number): DrawnVsEvent[] {
  if (eligible.length === 0) return []
  const rng = mulberry32(hashSeed(seedKey))
  const want = 2 + Math.floor(rng() * 3) // 2..4
  const n = Math.min(want, eligible.length)
  const pool = [...eligible]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const span = Math.max(1, journeyDays - 1)
  const drawn = pool.slice(0, n).map((def) => ({ def, day: 2 + Math.floor(rng() * span) }))
  const order = new Map(VS_EVENTS.map((e, i) => [e.id, i]))
  return drawn.sort((a, b) => a.day - b.day || (order.get(a.def.id) ?? 0) - (order.get(b.def.id) ?? 0))
}

// Real corpus minutes of one task, from the serialized journey payloads — Σ step estimates,
// the same numbers the timeline renders.
export function taskMinutesById(tasks: Record<string, VirtualTaskPayload>): Record<string, number> {
  return Object.fromEntries(
    Object.values(tasks).map((t) => [t.id, t.steps.reduce((acc, s) => acc + s.estimatedMinutes, 0)]),
  )
}

export interface ResolvedVsEvent {
  def: VsEventDef
  day: number
  // The choice taken, or null while the reader hasn't decided (pending events add no time).
  choice: VsEventChoiceDef | null
  deltaMinutes: number
}

export interface VsEventResolution {
  events: ResolvedVsEvent[]
  deltaMinutes: number
  dealsLost: number
  decided: number
  // Pick overrides from switch-vendor choices (arenaId → productId) — applied on top of the
  // reader's selections for the post-event scorecard.
  pickOverrides: Record<string, string>
}

// Deterministic branching: each answered choice resolves to a time delta (real corpus minutes,
// or a named wait constant), a lost deal, and/or a vendor re-pick from the REAL arena ranking
// (the next alternative after the current pick — lib/processes.ts vendorRoles order).
export function resolveVsEvents(
  drawn: DrawnVsEvent[],
  eventChoices: Record<string, string>,
  ctx: {
    roles: VendorRole[]
    selections: Record<string, string>
    taskMinutes: Record<string, number>
    chains: Array<{ id: string; taskIds: string[] }>
  },
): VsEventResolution {
  const events: ResolvedVsEvent[] = []
  const pickOverrides: Record<string, string> = {}
  let deltaMinutes = 0
  let dealsLost = 0
  let decided = 0

  for (const { def, day } of drawn) {
    const choice = def.choices.find((c) => c.id === eventChoices[def.id]) ?? null
    let delta = 0
    if (choice) {
      decided += 1
      const e = choice.effect
      if (e.kind === 'redo-tasks') {
        delta = e.taskIds.reduce((acc, id) => acc + (ctx.taskMinutes[id] ?? 0), 0)
      } else if (e.kind === 'add-chain-time') {
        const chain = ctx.chains.find((c) => c.id === e.chainId)
        delta = (chain?.taskIds ?? []).reduce((acc, id) => acc + (ctx.taskMinutes[id] ?? 0), 0)
      } else if (e.kind === 'wait-days') {
        delta = e.days * 24 * 60
      } else if (e.kind === 'lose-deal') {
        dealsLost += 1
      } else {
        // switch-vendor: the next alternative in the REAL arena ranking after the current pick,
        // plus the real corpus time of redoing the setup task with the new vendor.
        const role = ctx.roles.find((r) => r.arenaId === e.arenaId)
        if (role) {
          const current = pickOverrides[e.arenaId] ?? ctx.selections[e.arenaId] ?? role.defaultProductId
          const next = role.alternatives.find((o) => o.id !== current)
          if (next) pickOverrides[e.arenaId] = next.id
        }
        delta = ctx.taskMinutes[e.redoTaskId] ?? 0
      }
    }
    deltaMinutes += delta
    events.push({ def, day, choice, deltaMinutes: delta })
  }

  return { events, deltaMinutes, dealsLost, decided, pickOverrides }
}

// ---------------------------------------------------------------------------
// Simulated burn — real published pricing for the picked vendors, cited or honestly absent
// ---------------------------------------------------------------------------

// One picked vendor's headline pricing, serialized server-side from lib/pricing.ts data
// (verbatim-extracted facts with source URLs — see that module's honesty rules). `monthly` marks
// the only facts arithmetic may touch: entry-plan sticker prices already stated per month.
// Absent products (arena not price-covered, or no extraction yet) simply have no entry — the
// scorecard renders "no published pricing", never a guess.
export type VsPricingInfo =
  | {
      kind: 'fact'
      label: string
      unit: string
      tier: 'free' | 'usage' | 'entry-paid'
      amountUsd: number
      percent?: number
      monthly: boolean
      sourceUrl: string
      asOf: string
    }
  | { kind: 'unclear'; reason: string }

// arenaId → productId → headline pricing info.
export type VsPricingMap = Record<string, Record<string, VsPricingInfo>>

export interface VsBurnLine {
  arenaId: string
  arenaName: string
  productId: string
  productName: string
  info: VsPricingInfo | null
}

export interface VsBurnSummary {
  lines: VsBurnLine[]
  // Σ of the monthly-summable facts (entry plans; free tiers count $0) — null when nothing is
  // summable, so the UI can say so instead of printing a fake $0 total.
  monthlyUsd: number | null
  monthlyVendors: number
  usageVendors: number
  noPricingVendors: number
}

// The picked stack's burn lines, one per journey role, resolved against the reader's effective
// picks. Selection only — the single sum is over facts already stated per month; usage-priced
// facts are listed with their cites but never blended into a monthly figure.
export function computeBurn(
  roles: VendorRole[],
  selections: Record<string, string>,
  pricing: VsPricingMap,
): VsBurnSummary {
  const lines: VsBurnLine[] = []
  let monthlyUsd: number | null = null
  let monthlyVendors = 0
  let usageVendors = 0
  let noPricingVendors = 0
  for (const role of roles) {
    const pick = selections[role.arenaId] ?? role.defaultProductId
    const name = role.alternatives.find((o) => o.id === pick)?.name ?? pick
    const info = pricing[role.arenaId]?.[pick] ?? null
    if (info?.kind === 'fact' && (info.monthly || info.tier === 'free')) {
      monthlyUsd = (monthlyUsd ?? 0) + (info.monthly ? info.amountUsd : 0)
      monthlyVendors += 1
    } else if (info?.kind === 'fact') {
      usageVendors += 1
    } else {
      noPricingVendors += 1
    }
    lines.push({ arenaId: role.arenaId, arenaName: role.arenaName, productId: pick, productName: name, info })
  }
  return { lines, monthlyUsd, monthlyVendors, usageVendors, noPricingVendors }
}

// ---------------------------------------------------------------------------
// Shareable permalink — the whole run state in one compact URL-safe param
// ---------------------------------------------------------------------------

// The reader's ASSERTED decisions only (dropdown 'Not set' = absent key). The journey always
// composes over the effective combo `{ ...DEFAULT_CHOICES, ...asserted }` — an unasserted
// decision runs exactly the default branch, and the URL state omits it.
export type AssertedChoices = Partial<Choices>

// The effective combo an asserted state composes — the single place 'Not set = default' lives.
export function effectiveChoices(asserted: AssertedChoices): Choices {
  return { ...DEFAULT_CHOICES, ...asserted }
}

// How the run plays: 'auto' = decisions asserted upfront, the journey plays through; 'semi' =
// the run pauses at each unasserted decision's first affected row and asks the reader inline.
export type VsDriveMode = 'auto' | 'semi'

// The reader-typed company name (semi-auto naming card). Sanitized before it touches state or
// the URL: control characters and angle brackets stripped, whitespace collapsed, length-capped —
// never HTML, never multiline.
export const VS_COMPANY_NAME_MAX = 40

export function sanitizeVsCompanyName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, VS_COMPANY_NAME_MAX)
    .trim()
}

export interface VsRunState {
  // Asserted decisions only — unasserted ones compose as DEFAULT_CHOICES and stay out of the URL.
  choices: AssertedChoices
  preset: PresetId | null
  yc: boolean
  founder: VsFounderAxes
  mode: VsDriveMode
  // The reader-typed company name (semi-auto naming card), or null for the autopilot name.
  companyName: string | null
  // Explicit per-arena vendor picks (arenaId → productId); defaults are omitted by callers.
  picks: Record<string, string>
  // Event decisions (eventId → choiceId).
  eventChoices: Record<string, string>
  // 'Which AI firm are you using' (2026-09-30, item 7): a judged ai-assistants product id from
  // VS_AI_FIRM_IDS, or null for the judged pick. A DISPLAY PIN only — never the outcome clock.
  // Appended codec token 'a'; old links simply lack it and decode to null.
  assistant: string | null
  // 'Apply to YC' (2026-10-01, item 6): the setup-band checkbox that composes the real
  // YC-application corpus process (lib/virtualStartup.ts YC_APPLY_TASK_ID) as its own phase.
  // Appended codec token 'q'; legacy links lack it and replay WITHOUT the phase — their era.
  ycApply: boolean
  seed: number
}

// Appended-decision compat (2026-09-30, the 'remote' decision): DECISIONS only ever APPENDS, so
// a digit string shorter than today's roster is an OLDER link, not garbage — its missing trailing
// slots decode as unasserted/default and the journey composes exactly what the link always
// composed. Anything shorter than the roster at codec-ship time (9 decisions, 2026-09-28) was
// never emitted by any released codec and still rejects.
const MIN_COMBO_LEN = 9

// Combo ⇄ digit string, one option index per DECISIONS entry (order-stable, one char each).
export function encodeCombo(choices: Choices): string {
  return DECISIONS.map((d) => {
    const i = d.options.findIndex((o) => o.value === choices[d.id])
    return String(Math.max(0, i))
  }).join('')
}

export function decodeCombo(raw: string): Choices | null {
  if (raw.length < MIN_COMBO_LEN || raw.length > DECISIONS.length) return null
  const out: Partial<Record<keyof Choices, string>> = {}
  for (const [i, d] of DECISIONS.entries()) {
    if (i >= raw.length) {
      // An appended decision an older link predates — the default, exactly what it composed.
      out[d.id] = DEFAULT_CHOICES[d.id]
      continue
    }
    const idx = raw.charCodeAt(i) - 48
    const opt = d.options[idx]
    if (!opt) return null
    out[d.id] = opt.value
  }
  return out as Choices
}

// Asserted combo ⇄ digit-or-dot string: '.' = unasserted (composes as the default), a digit =
// the asserted option index — so the URL literally omits unasserted decisions (v2 codec).
export function encodeAssertedCombo(asserted: AssertedChoices): string {
  return DECISIONS.map((d) => {
    const v = asserted[d.id]
    if (v === undefined) return '.'
    const i = d.options.findIndex((o) => o.value === v)
    return String(Math.max(0, i))
  }).join('')
}

export function decodeAssertedCombo(raw: string): AssertedChoices | null {
  if (raw.length < MIN_COMBO_LEN || raw.length > DECISIONS.length) return null
  const out: Partial<Record<keyof Choices, string>> = {}
  for (const [i, d] of DECISIONS.entries()) {
    // An explicit '.' is the sharer's 'Not set' and stays unasserted; a slot PAST the string's
    // end is a decision the link PREDATES — it decodes asserted at its default, so a shared
    // semi-auto link replays start-to-finish without being asked questions that didn't exist
    // when it was shared (the composition is the default branch either way).
    if (i >= raw.length) {
      out[d.id] = DEFAULT_CHOICES[d.id]
      continue
    }
    if (raw[i] === '.') continue
    const opt = d.options[raw.charCodeAt(i) - 48]
    if (!opt) return null
    out[d.id] = opt.value
  }
  return out as AssertedChoices
}

// Founder axes ⇄ two-char token ('t'|'n' + '1'|'2'); 't1' is the default and omitted.
function encodeFounderAxes(axes: VsFounderAxes): string {
  return (axes.technical === 'technical' ? 't' : 'n') + (axes.experience === 'first-timer' ? '1' : '2')
}

function decodeFounderAxes(raw: string): VsFounderAxes | null {
  if (raw.length !== 2) return null
  const technical = raw[0] === 't' ? 'technical' : raw[0] === 'n' ? 'non-technical' : null
  const experience = raw[1] === '1' ? 'first-timer' : raw[1] === '2' ? 'second-timer' : null
  if (technical === null || experience === null) return null
  return { technical, experience }
}

// Minimal base64url (RFC 4648 §5, unpadded) over UTF-8 — pure so the codec round-trips
// identically in the browser and in node tests, with no Buffer/btoa dependency.
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : null
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : null
    out += B64URL[b0 >> 2]
    out += B64URL[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    if (b1 !== null) out += B64URL[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    if (b2 !== null) out += B64URL[b2 & 63]
  }
  return out
}

function fromBase64Url(s: string): string | null {
  if (s.length % 4 === 1) return null
  const idx = new Map([...B64URL].map((c, i) => [c, i]))
  const bytes: number[] = []
  for (let i = 0; i < s.length; i += 4) {
    const chunk = [...s.slice(i, i + 4)].map((c) => idx.get(c))
    if (chunk.some((v) => v === undefined)) return null
    const [c0, c1, c2, c3] = chunk as number[]
    bytes.push((c0 << 2) | (c1 >> 4))
    if (chunk.length > 2) bytes.push(((c1 & 15) << 4) | (c2 >> 2))
    if (chunk.length > 3) bytes.push(((c2 & 3) << 6) | c3)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

// v2 (founder batch 2026-09-29): founder AXES replace the persona id, the combo digits gain the
// '.' unasserted marker, and the drive mode rides along. v1 payloads still decode — see below.
const RUN_STATE_VERSION = 2

// Compact-key JSON → base64url. Empty maps and defaults are dropped for a shorter link.
export function encodeRunState(state: VsRunState): string {
  const compact: Record<string, unknown> = { v: RUN_STATE_VERSION, c: encodeAssertedCombo(state.choices) }
  if (state.preset) compact.p = state.preset
  if (state.yc) compact.y = 1
  const axes = encodeFounderAxes(state.founder)
  if (axes !== 't1') compact.f = axes
  if (state.mode === 'semi') compact.m = 's'
  if (state.companyName) compact.n = sanitizeVsCompanyName(state.companyName)
  if (Object.keys(state.picks).length > 0) compact.k = state.picks
  if (Object.keys(state.eventChoices).length > 0) compact.e = state.eventChoices
  // Appended token (2026-09-30, item 7) — older decoders never saw 'a'; ours defaults it null.
  if (state.assistant) compact.a = state.assistant
  // Appended token (2026-10-01, item 6) — 'q' rides only when the Apply-to-YC phase composes.
  if (state.ycApply) compact.q = 1
  if (state.seed !== 0) compact.s = state.seed
  return toBase64Url(JSON.stringify(compact))
}

const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) &&
  Object.values(v).every((x) => typeof x === 'string')

// Defensive decode: anything malformed (bad base64, unknown version, unknown combo/founder/
// preset, non-string picks) resolves to null and the UI falls back to the default view.
// v1 payloads (full combo digits, legacy persona ids, no drive mode) are accepted and migrated:
// every v1 decision is asserted (that's what the old links carried), the persona id maps onto
// its axis pair (LEGACY_PERSONA_AXES), and the mode is 'auto' — shared links keep replaying.
export function decodeRunState(raw: string | null): VsRunState | null {
  if (!raw) return null
  const json = fromBase64Url(raw)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const o = parsed as Record<string, unknown>
  if ((o.v !== 1 && o.v !== RUN_STATE_VERSION) || typeof o.c !== 'string') return null
  const legacy = o.v === 1
  const choices: AssertedChoices | null = legacy ? decodeCombo(o.c) : decodeAssertedCombo(o.c)
  if (!choices) return null
  const preset = typeof o.p === 'string' ? presetById(o.p)?.id ?? null : null
  if (typeof o.p === 'string' && preset === null) return null
  let founder: VsFounderAxes | null = DEFAULT_FOUNDER_AXES
  if (typeof o.f === 'string') founder = legacy ? LEGACY_PERSONA_AXES[o.f] ?? null : decodeFounderAxes(o.f)
  else if (o.f !== undefined) founder = null
  if (founder === null) return null
  const mode: VsDriveMode | null = legacy || o.m === undefined ? 'auto' : o.m === 's' ? 'semi' : null
  if (mode === null) return null
  // The typed company name re-sanitizes on decode — a tampered param can't smuggle markup in.
  if (o.n !== undefined && typeof o.n !== 'string') return null
  const companyName = typeof o.n === 'string' ? sanitizeVsCompanyName(o.n) || null : null
  const picks = o.k === undefined ? {} : isStringRecord(o.k) ? o.k : null
  const eventChoices = o.e === undefined ? {} : isStringRecord(o.e) ? o.e : null
  if (picks === null || eventChoices === null) return null
  // The assistant pin (appended 'a' token): absent = null (every old link); anything that is not
  // a current judged roster id rejects — the defensive-decode convention (preset precedent).
  if (o.a !== undefined && (typeof o.a !== 'string' || !(VS_AI_FIRM_IDS as readonly string[]).includes(o.a))) return null
  const assistant = typeof o.a === 'string' ? o.a : null
  // The Apply-to-YC token (appended 'q', 2026-10-01): absent = false (every legacy link — the
  // phase never composes for them); anything but the literal 1 rejects defensively.
  if (o.q !== undefined && o.q !== 1) return null
  const ycApply = o.q === 1
  const seed = o.s === undefined ? 0 : typeof o.s === 'number' && Number.isFinite(o.s) ? o.s : null
  if (seed === null) return null
  return { choices, preset, yc: o.y === 1, founder, mode, companyName, picks, eventChoices, assistant, ycApply, seed }
}
