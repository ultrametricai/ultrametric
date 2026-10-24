import type { Execution } from './execution'
// Client-safe half of lib/processes.ts — the flattened simulator prop shapes plus display
// helpers, with NO node:fs/path imports so components/ProcessSimulator.tsx (a client component)
// can bundle it. Same split convention as lib/megaTableSort.ts (client) vs lib/megaTable.ts
// (server-side row builder).

export type StepRoute = 'agent' | 'form' | 'person'

// How often a process actually recurs in a running company (open-processes/corpus.json `cadence`,
// validated by lib/processes.ts's ProcessTaskSchema — keep this union and that z.enum in
// lockstep). Lives here so client components can type against it without pulling node:fs.
export type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'event-driven' | 'once'

// Record kind (founder ask 2026-10-01: "Situations — reactive, trigger-driven founder
// processes — e.g. your company has a C&D, or you want to come to Silicon Valley but the visa
// is held up"). A 'situation' is the SAME corpus machinery as a 'process' — a routed DAG with
// ceilings, vendors, reversibility, geo — classified reactive: a trigger event puts the founder
// here, so it has NO slot in the founder timeline and instead carries an honest urgency clock.
// Kept in lockstep with the z.enum in lib/processes.ts's ProcessTaskSchema.
export const PROCESS_KINDS = ['process', 'situation'] as const
export type ProcessKind = (typeof PROCESS_KINDS)[number]

// How fast the FIRST step of a situation must honestly happen once its trigger fires. Curated,
// never derived — 'hours' means contain-it-now (a breach, a frozen payroll account, a DDoS),
// 'days' means this week (a C&D's stated deadline, a lawsuit's answer clock), 'weeks' means a
// real but slower clock (a trademark office action's 3-month window). Required on every
// situation, forbidden on processes (enforced at load time in lib/processes.ts).
export const URGENCY_TIERS = ['hours', 'days', 'weeks'] as const
export type Urgency = (typeof URGENCY_TIERS)[number]

// Display meta for the urgency chip (components/UrgencyChip.tsx) — same {label, definition}
// shape as REVERSIBILITY_META below; every tier renders (urgency is the point of a situation,
// not an exception state).
export const URGENCY_META: Record<Urgency, { label: string; definition: string }> = {
  hours: {
    label: 'act within hours',
    definition:
      'Act within hours — the first step is containment: a breach spreads, a frozen account blocks payroll, an attack is live.',
  },
  days: {
    label: 'act within days',
    definition:
      'Act within days — a real clock is running (a stated response deadline, an answer window, a vesting cutoff), but the first step is assessment, not firefighting.',
  },
  weeks: {
    label: 'act within weeks',
    definition:
      'Act within weeks — the deadline is real but measured in months, not days; start early, because the work (responses, filings, migrations) takes longer than it looks.',
  },
}

// Reversibility tiers (founder 2026-09-30: "map what is irreversible and what is reversible —
// consider 'irreversible with pain' as a 3rd option — for ALL processes and process steps").
// Curated explicitly on every corpus process AND every DAG node (open-processes/corpus.json,
// validated by lib/processes.ts's ProcessTaskSchema — keep this tuple and that z.enum in
// lockstep; totality is corpus-tested). The judgment test is "what does undoing actually take":
//   'reversible'   — freely undoable: drafts, configs, most SaaS setup. A routine external send
//                    whose correction costs nothing (a follow-up email) counts as reversible in
//                    practice.
//   'painful'      — irreversible with pain: undoable at real cost — re-domestication after
//                    incorporating in the wrong state, entity conversion, switching payroll
//                    providers mid-year, migrating banks, breaking a lease, walking back a
//                    public announcement, unwinding an executed contract.
//   'irreversible' — cannot be undone: dissolution filed, an 83(b) election filed (the missed
//                    window never reopens), equity issued and accepted, a wire sent, an
//                    employee terminated.
// A process can be painful while most of its steps are reversible with one irreversible filing
// step — the tiers are curated per level, never derived from each other.
export const REVERSIBILITY_TIERS = ['reversible', 'painful', 'irreversible'] as const
export type Reversibility = (typeof REVERSIBILITY_TIERS)[number]

// Display meta for the tiers (components/ReversibilityBadge.tsx). Reversible deliberately
// renders nothing — the badge marks doors that close, not the default state of work.
export const REVERSIBILITY_META: Record<Reversibility, { label: string; definition: string }> = {
  reversible: {
    label: 'reversible',
    definition: 'Reversible — freely undoable: drafts, configs, most SaaS setup. Undoing costs nothing real.',
  },
  painful: {
    label: 'hard to undo',
    definition:
      'Irreversible with pain — undoable, but at real cost: re-domesticating an entity, switching payroll providers mid-year, migrating banks, breaking a lease, walking back a public announcement.',
  },
  irreversible: {
    label: 'irreversible',
    definition:
      'Irreversible — cannot be undone: a dissolution filed, an 83(b) election filed, equity issued and accepted, a wire sent, an employee terminated.',
  },
}

export interface SwapOption {
  id: string
  name: string
  agentReady: number | null
  // Resolved server-side (lib/logos.ts needs node:fs) so the simulator's client-side role
  // picker can render real logo chips (ProductLogoView). Optional: older/leaner call sites
  // that never resolve it fall back to the initial-letter chip.
  hasLogo?: boolean
}

export interface VendorRole {
  arenaId: string
  arenaName: string
  // The judged product id of the vendor the DAG canonically records calls against
  // (vendorProductId of the corpus vendor key) — comparable against SwapOption.id.
  canonicalVendor: string
  defaultProductId: string
  defaultProductName: string
  // How many DAG nodes are attributed to this role's vendors.
  stepCount: number
  // The arena's whole leaderboard, ranked by agentReady desc (nulls last) — includes the default.
  alternatives: SwapOption[]
}

// An agentic gap-closer: a live-arena workaround for a non-agent step, resolved server-side by
// lib/gapClosers.ts (this type stays here so the client-side simulator can receive it as a prop).
export interface GapCloser {
  arenaId: string
  arenaName: string
  // The arena's current #1 by agent-readiness — the concrete product to hand the step to.
  topProduct: SwapOption
  blurb: string
  // Honest fine print (e.g. "unofficial path — verify the portal's terms allow automation").
  caution: string | null
}

// What we honestly know about a non-agent step: either today's market can close it (closer), or
// it is judgment/identity work no agent should stand in for (irreducible). Steps with neither
// resolve to null — no workaround yet, and we don't invent one.
export type GapResolution =
  | { kind: 'closer'; closer: GapCloser }
  | { kind: 'irreducible'; reason: string }

// The one-line honest reason a non-agent step blocks the agent — shared by the ceiling verdict,
// the simulator transcript, and the gap-closer split. Founder 2026-09-21: person steps are no
// longer framed negatively as "needs a human" — a human OR a computer-use agent handles them;
// only legally required signature acts (DagNode.legalSignature) are the true human floor.
export function gapWhy(route: 'form' | 'person' | undefined): string {
  if (route === undefined) return 'Execution type not specified'
  return route === 'person' ? 'human or computer use' : 'manual form/portal — no API path'
}

// The honest reason for a legally-required signature act — the one gap no agent closes.
export const LEGAL_SIGNATURE_WHY = 'legally human — a signature/attestation only a human can make'

export interface SimStep {
  taskId: string
  taskTitle: string
  label: string
  route?: StepRoute
  execution?: Execution
  vendor: string | null
  vendorLabel: string | null
  // Set when the vendor is mapped to an arena — the simulator swaps this step's product.
  arenaId: string | null
  // Set when the step IS the vendor decision for a derived market ("Choose a bank" over
  // startup-banking): the simulator's role picker already answers it, so the transcript marks
  // it decided instead of declaring a human gap (founder 2026-09-18: Mercury was selected and
  // the dry run still said "needs a human" for a choice that was already made).
  choiceArenaId: string | null
  calls: string[]
  toolCall: string | null
  approvalRequired: boolean
  // True when the step is a legally required human signature/attestation act (the founder's
  // "true human floor") — the transcript names it instead of the generic gap reason.
  legalSignature: boolean
  riskLevel: 'low' | 'medium' | 'high' | null
  estimatedMinutes?: number
  async: boolean
  // Pre-resolved (server-side) agentic workaround for non-agent steps; null for agent steps and
  // for gaps with no honest workaround.
  gap: GapResolution | null
}

// "Choose/Select/Pick …" step labels are vendor decisions, not work — when the step also
// declares a derived market (optionsArenaId), the simulator's role picker answers it.
export const DECISION_STEP_RE = /^(choose|select|pick)\b/i

// ---------------------------------------------------------------------------
// The simulated dry run (pure — unit-tested; components/ProcessSimulator.tsx renders it)
// ---------------------------------------------------------------------------

export interface SimLine {
  kind: 'agent' | 'gap' | 'workaround' | 'approval' | 'task' | 'call' | 'done' | 'decision'
  text: string
  mono?: boolean
}

export interface SimRunStats {
  totalSteps: number
  agentSteps: number
  // Non-agent decision steps the role picker already resolved — NOT human handoffs.
  decidedSteps: number
  // Genuine human handoffs left after decisions are resolved.
  gaps: number
  approvals: number
  apiCalls: number
}

export interface SimRun {
  lines: SimLine[]
  stats: SimRunStats
}

// Build the whole dry-run transcript up front (the component reveals it line by line).
// Honesty rules:
//   - recorded call names belong to the canonical vendor; swapped steps are annotated as
//     "equivalent operation on <product>" rather than pretending we recorded that API;
//   - a "Choose …" step whose market the user already picked from renders as a decision line,
//     not a GAP — the choice is done, no human step remains (the Mercury bank case);
//   - every remaining non-agent step stays an explicit GAP handoff with its honest why.
export function buildSimRun(
  steps: SimStep[],
  selections: Record<string, string>,
  roles: VendorRole[],
  multiTask = false,
): SimRun {
  const roleByArena = new Map(roles.map((r) => [r.arenaId, r]))
  const lines: SimLine[] = []
  const stats: SimRunStats = { totalSteps: steps.length, agentSteps: 0, decidedSteps: 0, gaps: 0, approvals: 0, apiCalls: 0 }
  let lastTask = ''
  for (const step of steps) {
    if (multiTask && step.taskId !== lastTask) {
      lines.push({ kind: 'task', text: `── ${step.taskTitle} ──` })
      lastTask = step.taskId
    }
    const role = step.arenaId ? roleByArena.get(step.arenaId) : undefined
    const picked = role ? selections[role.arenaId] ?? role.defaultProductId : null
    const pickedName = role ? role.alternatives.find((o) => o.id === picked)?.name ?? picked : null
    const swapped = Boolean(role && picked !== role.canonicalVendor)
    const actor = pickedName ?? step.vendorLabel

    if (step.route === 'agent') {
      stats.agentSteps += 1
      const suffix = step.async ? ' ⏳' : ''
      const calls = step.calls.length > 0 ? step.calls : step.toolCall ? [step.toolCall] : []
      if (calls.length === 0) {
        lines.push({ kind: 'agent', text: `→ [agent] ${actor ? `${actor}: ` : ''}${step.label}${suffix}` })
      } else {
        lines.push({ kind: 'agent', text: `→ [agent] ${actor ? `${actor} — ` : ''}${step.label}${suffix}` })
        stats.apiCalls += calls.length
        for (const call of calls) {
          lines.push({
            kind: 'call',
            mono: true,
            text: swapped ? `${call}  (equivalent operation on ${pickedName})` : call,
          })
        }
      }
      if (step.approvalRequired) {
        stats.approvals += 1
        lines.push({
          kind: 'approval',
          text: `⏸ approval required${step.riskLevel ? ` — ${step.riskLevel} risk` : ''} — a human signs off before this runs`,
        })
      }
      continue
    }

    // Non-agent step that is really the vendor decision for a market the user just picked from:
    // it's already been done — say so instead of declaring a human process.
    const choiceRole = step.choiceArenaId ? roleByArena.get(step.choiceArenaId) : undefined
    if (choiceRole) {
      const chosen = selections[choiceRole.arenaId] ?? choiceRole.defaultProductId
      const chosenName = choiceRole.alternatives.find((o) => o.id === chosen)?.name ?? chosen
      stats.decidedSteps += 1
      lines.push({ kind: 'decision', text: `✓ ${step.label} — already decided: ${chosenName} (picked in the market options)` })
      continue
    }

    stats.gaps += 1
    const why = step.legalSignature ? LEGAL_SIGNATURE_WHY : gapWhy(step.route)
    lines.push({
      kind: 'gap',
      text: step.legalSignature
        ? `✍ SIGNATURE: ${step.label} — ${why}${step.async ? ' ⏳' : ''}`
        : `⚠ GAP: ${step.label} — ${why} — agent hands off${step.async ? ' ⏳' : ''}`,
    })
    // Pre-resolved server-side (lib/gapClosers.ts) — the client never runs the rule engine.
    // No workaround is ever offered for a legally-required signature act: the e-sign medium
    // may be electronic, but the signing human is not replaceable.
    if (!step.legalSignature && step.gap?.kind === 'closer') {
      const { blurb, topProduct, caution } = step.gap.closer
      lines.push({
        kind: 'workaround',
        text: `  ⚡ workaround: ${blurb} (top: ${topProduct.name})${caution ? ` — ${caution}` : ''}`,
      })
    }
  }
  return { lines, stats }
}

// Human-scale minutes: "12 min", "1.5 h", "2 d". Waiting-on-the-government steps run to days —
// keep them readable instead of "2880 minutes".
export function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)} min`
  if (mins < 60 * 24) {
    const h = mins / 60
    return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
  }
  const d = mins / (60 * 24)
  return `${Number.isInteger(d) ? d : d.toFixed(1)} d`
}
