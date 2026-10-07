'use client'

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import CeilingBar from '@/components/CeilingBar'
import IconChip from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import SimRolePicker from '@/components/SimRolePicker'
import VsDecisionSelect from '@/components/VsDecisionSelect'
import VsGeoSelector from '@/components/VsGeoSelector'
import VsJourneyDag, { type VsDagPause } from '@/components/VsJourneyDag'
import VsStateGraph, { type VsPanelEvent } from '@/components/VsStateGraph'
import { GEO_GLOBAL, GEO_PREF_META, type GeoChoice, type GeoCountry, type GeoSelection, type VendorGeoLookup } from '@/lib/geoPreference'
import { formatMinutes, type SimStep, type VendorRole } from '@/lib/processSim'
import { ULTRAMETRIC_CLI_DISCLOSURE, ultrametricCliFor } from '@/lib/ultrametricCli'
import { readParam, setParams } from '@/lib/urlState'
import {
  applyYcCalibration,
  buildJourneyArtifacts,
  dayOf,
  DECISIONS,
  DEFAULT_ASSERTED,
  DEFAULT_ASSERTED_URL_NEUTRAL,
  DEFAULT_CHOICES,
  DEFAULT_VS_ASSISTANT,
  defaultEntityFor,
  ENTITY_META,
  ENTITY_OPTIONS_BY_COUNTRY,
  eventRows,
  HIDDEN_DECISION_IDS,
  HIDDEN_OPTION_VALUES,
  VS_AI_FIRM_ARENA,
  journeyPhases,
  journeyStats,
  MONTH_LABELS,
  presetById,
  scenarioById,
  synthCompany,
  VS_PRESETS,
  VS_SCENARIOS,
  windowRows,
  YC_BATCH,
  YC_CALIBRATION,
  yearRows,
  yearStats,
  type Choices,
  type DecisionDef,
  type EntityChoice,
  type VsPopularityMap,
  type EventExample,
  type JourneyStats,
  type PresetId,
  type ScenarioId,
  type SynthIdentity,
  type SyntheticArtifact,
  type TopVendorPick,
  type VsProducedArtifact,
  type VsAssistant,
  type VirtualTaskPayload,
  type VsChain,
  type VsPreset,
  type VsScenario,
  type WindowRow,
  type YearCandidate,
  type YearRow,
} from '@/lib/virtualStartup'
// ── v3 run layer (founder-approved 2026-09-28, axes redesign + drive modes 2026-09-29): vendor
// picks drive outcomes, founder AXES (Technical × Experience), seeded corpus-grounded events,
// scorecard + shareable ?run= permalink, auto/semi-auto drive. All logic lives in
// lib/virtualStartupRun.ts (pure, deterministic); the UI pieces are separate components.
import VsAssistantSelect from '@/components/VsAssistantSelect'
import VsCopyCommand from '@/components/VsCopyCommand'
import VsEventCard from '@/components/VsEventCard'
import VsPersonaPicker from '@/components/VsPersonaPicker'
import VsScorecard from '@/components/VsScorecard'
import {
  computeStackOutcome,
  corpusLaunchDay,
  decodeRunState,
  drawVsEvents,
  DEFAULT_FOUNDER_AXES,
  effectiveChoices,
  eligibleVsEvents,
  eventSeedKey,
  journeyOutcomeInputs,
  sanitizeVsCompanyName,
  VS_COMPANY_NAME_MAX,
  optimalSelections,
  resolveVsEvents,
  taskMinutesById,
  computeBurn,
  VS_EXPERIENCE_OPTIONS,
  VS_TECHNICAL_OPTIONS,
  type AssertedChoices,
  type DrawnVsEvent,
  type OutcomeStepInput,
  type StackOutcome,
  type VsAccessMap,
  type VsDriveMode,
  type VsFounderAxes,
  type VsPricingMap,
  type VsRunState,
} from '@/lib/virtualStartupRun'
import { TABLE_HEADER_ROW } from '@/components/tableStyles'

// The Virtual Startup timeline (see lib/virtualStartup.ts for the honesty contract): the reader
// picks the starting decisions, then a synthetic company replays the REAL selected processes in
// time order — each step with its real route, its top JUDGED vendor where a ranking exists, and
// corpus time estimates — while clearly-labeled SIMULATED artifacts show what each step produces.
// When the launch journey completes, a year-one operating-rhythm calendar shows the recurring
// runs ("cron jobs") the company now owns, derived from the corpus cadence axis. Everything is
// precomputed/deterministic; the ~cadenced reveal is presentation only (the same pattern as
// components/ProcessSimulator.tsx on the per-process pages — this page's role pickers live in
// the controller's 'Set vendors' disclosure; the embedded dry-run transcript was dropped 2026-09-29).

const CADENCE_MS = 240

// Terminal-follow slack: how close (px) to the bottom still counts as "at the bottom" — the
// standard terminal behavior, so a stray one-line scroll doesn't silently unpin the follow.
const FOLLOW_SLACK_PX = 24

type Row =
  | { kind: 'phase'; key: string; title: string; chainId: string; chainName: string; note: string | null }
  | { kind: 'task'; key: string; task: VirtualTaskPayload }
  | { kind: 'day'; key: string; day: number }
  // v3: outNote names the outcome-model rule applied to this step's sim minutes (null =
  // corpus estimate as-is); outMinutes is the effective clock advance the day markers use.
  // anchor (2026-10-07, item 2) deep-links the process page's #step-{taskId}-{nodeId} block
  // (null when the payload carries no node ids — old fixtures; honest degrade, no link).
  // produces (item 3) is the registry artifact the corpus step's producesArtifact tag names —
  // the document panel is computed from exactly these on the steps the run actually printed.
  | {
      kind: 'step'
      key: string
      step: SimStep
      top: TopVendorPick | null
      outNote: string | null
      outMinutes: number
      anchor: string | null
      produces: VsProducedArtifact | null
    }
  | { kind: 'artifact'; key: string; artifact: SyntheticArtifact }
  // v3: a seeded mid-run event, printed inside the terminal flow at its drawn day.
  | { kind: 'vsevent'; key: string; eventId: string; day: number }

// ---------------------------------------------------------------------------
// Pure run assembly — shared by the live terminal AND the semi-auto pause schedule (which builds
// per-option variant row lists to find each unasserted decision's first affected row).
// ---------------------------------------------------------------------------

interface RunArgs {
  choices: Choices // the EFFECTIVE combo (asserted over DEFAULT_CHOICES)
  chains: VsChain[]
  tasks: Record<string, VirtualTaskPayload>
  roles: VendorRole[]
  access: VsAccessMap
  founder: VsFounderAxes
  picks: Record<string, string>
  identity: SynthIdentity | null
  preset: PresetId | null
  yc: boolean
  // 'Apply to YC' (item 6, 2026-10-01): composes the real YC-application corpus process as its
  // own phase (lib/virtualStartup.ts YC_APPLY_TASK_ID — the ops_014 office pattern).
  ycApply: boolean
  seed: number
  taskRisks: Record<string, number>
  // Semi-auto: pin the synthetic name/artifact seed to DEFAULT_CHOICES so a mid-run decision
  // assertion never rewrites an already-printed seeded value (lib/virtualStartup.ts ArtifactOpts).
  seedCombo?: Choices
}

interface RunBuild {
  rows: Row[]
  steps: SimStep[]
  stats: JourneyStats
  outcome: StackOutcome
  outcomeInputs: OutcomeStepInput[]
  drawnEvents: DrawnVsEvent[]
}

function buildRunRows(args: RunArgs): RunBuild {
  const { choices, chains, tasks, roles, access, founder, picks, identity, preset, yc, ycApply, seed, taskRisks } = args
  const phases = journeyPhases(choices, chains, { yc, ycApply })
  const outcomeInputs = journeyOutcomeInputs(phases, tasks)
  const outcome = computeStackOutcome(outcomeInputs, picks, roles, access, founder)
  // Seeded, corpus-grounded, plausibility-gated events; deterministic from (combo, preset, yc,
  // ycApply, founder axes, seed) — the day span comes from the raw corpus estimates so vendor
  // picks never reshuffle which events fire (the ycApply token appends only when on, so every
  // pre-existing run's stream replays byte-identically).
  const drawnEvents = drawVsEvents(
    eligibleVsEvents(choices, phases.flatMap((p) => p.taskIds), taskRisks),
    eventSeedKey(choices, preset, yc, founder, seed, ycApply),
    corpusLaunchDay(outcomeInputs),
  )
  const taskIds = phases.flatMap((p) => p.taskIds)
  const artifacts = buildJourneyArtifacts(choices, taskIds, { identity, yc, seedCombo: args.seedCombo })
  const rows: Row[] = []
  const steps: SimStep[] = []
  let cum = 0
  let lastDay = 0
  // Seeded mid-run events print inside the terminal flow at their drawn day (drawnEvents is
  // day-sorted, so this is a simple cursor flush).
  let evIdx = 0
  const flushEvents = (uptoDay: number) => {
    while (evIdx < drawnEvents.length && drawnEvents[evIdx].day <= uptoDay) {
      const ev = drawnEvents[evIdx]
      rows.push({ kind: 'vsevent', key: `vsevent-${ev.def.id}`, eventId: ev.def.id, day: ev.day })
      evIdx += 1
    }
  }
  for (const phase of phases) {
    rows.push({ kind: 'phase', key: `phase-${phase.id}`, title: phase.title, chainId: phase.chainId, chainName: phase.chainName, note: phase.note })
    for (const taskId of phase.taskIds) {
      const task = tasks[taskId]
      if (!task) continue // defensive: the server precomputes the full union, so this never fires
      rows.push({ kind: 'task', key: `task-${taskId}`, task })
      task.steps.forEach((step, i) => {
        const day = dayOf(cum)
        if (day !== lastDay) {
          flushEvents(day - 1)
          lastDay = day
          rows.push({ kind: 'day', key: `day-${day}-${taskId}-${i}`, day })
          flushEvents(day)
        }
        // The clock advances by the outcome model's effective minutes (picks + founder axes,
        // disclosed simulation assumptions) — falling back to the raw corpus estimate.
        const outStep = outcome.steps[steps.length]
        const outMinutes = outcome.minutesByKey[`${taskId}:${i}`] ?? step.estimatedMinutes
        // The step's canonical deep link: the process page's #step-{taskId}-{nodeId} anchor
        // (the pinned anchor contract — every corpus node carries one). Null without node ids.
        const nodeId = task.nodeIds?.[i]
        rows.push({
          kind: 'step',
          key: `step-${taskId}-${i}`,
          step,
          top: task.tops[i] ?? null,
          outNote: outStep?.note ?? null,
          outMinutes,
          anchor: nodeId ? `/processes/${task.slug}#step-${taskId}-${nodeId}` : null,
          produces: task.produces?.[i] ?? null,
        })
        steps.push(step)
        cum += outMinutes
      })
      for (const [j, artifact] of (artifacts[taskId] ?? []).entries()) {
        rows.push({ kind: 'artifact', key: `artifact-${taskId}-${j}`, artifact })
      }
    }
  }
  flushEvents(Number.POSITIVE_INFINITY)
  return { rows, steps, stats: journeyStats(steps), outcome, outcomeInputs, drawnEvents }
}

// Canonical serialization of everything a printed row shows — the semi-auto pause schedule
// compares variant row lists with this, so "first affected row" means the first row a decision's
// assertion could VISIBLY change (structure, step clock, top pick, artifact text, event day).
function rowSignature(row: Row): string {
  switch (row.kind) {
    case 'phase':
      return JSON.stringify([row.kind, row.key, row.title, row.note])
    case 'step':
      return JSON.stringify([row.kind, row.key, row.outMinutes, row.outNote, row.top?.productId ?? null])
    case 'artifact':
      return JSON.stringify([row.kind, row.key, row.artifact.label, row.artifact.value])
    case 'vsevent':
      return JSON.stringify([row.kind, row.key, row.day])
    default:
      return JSON.stringify([row.kind, row.key])
  }
}

// First index where the two variant row lists differ; null when nothing the terminal ever prints
// differs (callers fall back to 0 — ask at Run-press, safe by construction).
function firstDifferingRow(a: Row[], b: Row[]): number | null {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (rowSignature(a[i]) !== rowSignature(b[i])) return i
  }
  if (a.length !== b.length) return n
  return null
}

// The first row index at which ANY pair of variant row lists visibly differs — decisions can now
// carry more than two options (entities, business models, compliance frameworks), and comparing
// every variant against the first catches the earliest pairwise divergence (if two non-base
// variants first differ from each other at row m, at least one of them differs from the base at
// m too). null = no variant ever differs.
function firstAffectedRow(variants: Row[][]): number | null {
  let at: number | null = null
  for (let i = 1; i < variants.length; i++) {
    const d = firstDifferingRow(variants[0], variants[i])
    if (d !== null && (at === null || d < at)) at = d
  }
  return at
}

function routeBadge(step: SimStep): { text: string; cls: string } {
  if (step.route === 'agent') return { text: 'agent', cls: 'border-emerald-400/40 text-emerald-300' }
  if (step.route === 'form') return { text: 'manual form', cls: 'border-amber-400/40 text-amber-300' }
  if (step.legalSignature) return { text: '✍ signature', cls: 'border-violet-400/40 text-violet-300' }
  return { text: 'human / computer use', cls: 'border-sky-400/40 text-sky-300' }
}

// One rhythm row of the year-one calendar: the process, its cadence, the 12-month strip, and
// its route mix / agent ceiling. Seeded (non-corpus) calendar slots keep the fuchsia styling +
// the structural data-synthetic attribute (no visible label — founder 2026-09-29).
function YearRhythmRow({ row }: { row: YearRow }) {
  const active = new Set(row.months)
  const seeded = row.monthSource === 'seeded'
  return (
    <tr data-testid="vs-year-row" data-month-source={row.monthSource} className="align-top">
      <td className="max-w-[260px] py-2 pr-3">
        <Link href={`/processes/${row.slug}`} className="text-[13px] font-medium text-zinc-300 hover:text-emerald-300">
          {row.title}
        </Link>
        {row.monthNote && (
          <p
            data-synthetic={seeded ? 'true' : undefined}
            className={`mt-0.5 flex flex-wrap items-center gap-1 text-[10px] ${seeded ? 'text-fuchsia-300/80' : 'text-zinc-400'}`}
          >
            {row.monthNote}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-400">{row.cadenceLabel}</td>
      <td className="py-2 pr-3">
        <span className="flex gap-1">
          {MONTH_LABELS.map((label, i) => {
            const on = active.has(i + 1)
            return (
              <span
                key={label}
                title={`${label}${on ? ` — ${row.title} runs` : ''}`}
                className={`h-2 w-2 rounded-full ${
                  on ? (row.monthSource === 'seeded' ? 'bg-fuchsia-400/80' : 'bg-emerald-400/80') : 'bg-zinc-800'
                }`}
              />
            )
          })}
        </span>
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs tabular-nums text-zinc-400">
        ×{row.runsPerYear}
      </td>
      <td
        className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-400"
        title={row.routes.legalSignature > 0 ? `${row.routes.legalSignature} legally-human signature step(s)` : undefined}
      >
        <span className="text-emerald-300/90">{row.routes.agent} agent</span>
        {row.routes.form > 0 && <> · <span className="text-amber-300/90">{row.routes.form} form</span></>}
        {row.routes.person > 0 && <> · <span className="text-sky-300/90">{row.routes.person} human</span></>}
      </td>
      <td className="py-2">
        <CeilingBar pct={row.ceilingPct} />
      </td>
    </tr>
  )
}

type WindowTab = 'd30' | 'd90' | 'year'

// One row of the first-30/first-90-days view: the process, its cadence-math first-run day, and
// how many runs fit the window. Day intervals are conventions (month ≈ 30d), never corpus dates.
function WindowRhythmRow({ row }: { row: WindowRow }) {
  return (
    <tr data-testid="vs-window-row" className="align-top">
      <td className="max-w-[260px] py-2 pr-3">
        <Link href={`/processes/${row.slug}`} className="text-[13px] font-medium text-zinc-300 hover:text-emerald-300">
          {row.title}
        </Link>
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-400">{row.cadenceLabel}</td>
      <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs tabular-nums text-zinc-400">
        day {row.firstRunDay}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs tabular-nums text-zinc-400">
        ×{row.runsInWindow}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-400">
        <span className="text-emerald-300/90">{row.routes.agent} agent</span>
        {row.routes.form > 0 && <> · <span className="text-amber-300/90">{row.routes.form} form</span></>}
        {row.routes.person > 0 && <> · <span className="text-sky-300/90">{row.routes.person} human</span></>}
      </td>
      <td className="py-2">
        <CeilingBar pct={row.ceilingPct} />
      </td>
    </tr>
  )
}

const RHYTHM_TABS: { id: WindowTab; label: string }[] = [
  { id: 'd30', label: 'First 30 days' },
  { id: 'd90', label: 'First 90 days' },
  { id: 'year', label: 'Year one' },
]

// Compact-band display copy (founder ask 2026-09-28: the setup controls compress into one tight
// band so the terminal sits above the fold). Short labels are DISPLAY ONLY — every option button
// keeps its canonical full label as the accessible name (aria-label) and full label + corpus
// mapping in the tooltip, so nothing about the decision semantics or the a11y/test contract moves.
// Control icons (founder batch 2026-09-29, item 1): small leading icons so the setup band's
// labeled rows and the nine decision groups read at a glance. House style — since 2026-10-01
// ("apply the custom icons to the rest of the site, ie the startup sim") these are house icon
// TOKENS (`pi:<glyph>:<hue>`, the same scheme as lib/processIcons.ts / lib/arenaIcons.ts)
// rendered by components/IconChip.tsx as the hand-authored duotone SVGs, reusing the designed
// vocabulary where the concept already has a glyph (incorporation = the scroll, fundraising =
// the bank, compliance = the scales). The old emoji picks ride in the comments as the semantic
// guides. Icons are decoration on top of the existing labels: every control keeps its
// canonical accessible name (the decision groups' aria-label, the options' full-label
// aria-labels) — tests assert nothing moved.
// The geo row's adjacent 🌍 IconChip is GONE (founder round 5, item 5) — the selector's own
// flags suffice; the Founder row icon still names the whole who/where cluster. The 'Decisions'
// row label is GONE too (founder batch 2026-09-30, item 6: it's obviously the setup) — the
// decisions grid cell keeps an empty label slot for column alignment only.
export const ROW_ICONS: Record<'scenario' | 'founder' | 'using', { icon: string; title: string }> = {
  // 'Example' → 'Scenario' (round 3, item 1); the funding-scenario pills moved INTO the single
  // Funding selector (addendum 2026-09-30) — the row holds the company presets + YC mode.
  scenario: { icon: 'pi:building:sky', title: 'Scenario — one-tap setups: example companies and YC batch mode' }, // 🏢
  founder: { icon: 'pi:person:orange', title: 'Founder — the who/where cluster: the two founder axes plus the country view' }, // 👤
  // 'Which AI firm are you using' (2026-09-30, item 7) — its own row.
  using: { icon: 'pi:robot:violet', title: "I'm using — pin your AI assistant on the AI-conversation steps; the judged pick stays visible and no judged number moves" }, // 🤖
}

// The decisions rendered as controls — 'Start with' (ordering) left the panel (founder round 5,
// item 4): composition keeps the default, presets/YC assert it internally, the codec digit slot
// stays, and semi-auto never asks it.
const VISIBLE_DECISIONS = DECISIONS.filter((d) => !HIDDEN_DECISION_IDS.includes(d.id))

// The combo a fresh semi-auto run starts from (the default-asserted state over the defaults) —
// the stable seed pin for semi-auto's synthetic names/artifacts (module constant so the memos
// keep referential identity across renders).
const SEMI_SEED_COMBO = effectiveChoices(DEFAULT_ASSERTED)

// ONE funding selector (founder addendum 2026-09-30): the funding decision's two options and the
// funding SCENARIOS (VC backed / Bootstrapped — formerly Scenario-row pills) fold into a single
// dropdown. DISPLAY consolidation only — the asserting semantics and the codec are untouched:
// a plain option asserts just the funding decision (its digit slot unchanged), a scenario option
// runs the exact applyScenario path (partial combo assert + the shared ?preset= namespace), and
// the values below are pseudo-options that never reach the combo codec.
const FUNDING_DECISION = DECISIONS.find((d) => d.id === 'funding')!
const FUNDING_SCENARIO_PREFIX = 'scenario:'
const FUNDING_COMBINED: DecisionDef = {
  ...FUNDING_DECISION,
  options: [
    ...FUNDING_DECISION.options,
    ...VS_SCENARIOS.map((s) => ({
      value: `${FUNDING_SCENARIO_PREFIX}${s.id}`,
      label: s.label,
      // The scenario tooltip already documents the exact key → DECISIONS-option mapping.
      detail: s.tooltip,
    })),
  ],
}
const FUNDING_SHORT: Record<string, string> = {
  seed: 'Seed',
  bootstrap: 'Bootstrap',
  [`${FUNDING_SCENARIO_PREFIX}vc-backed`]: 'VC backed',
  [`${FUNDING_SCENARIO_PREFIX}bootstrapped`]: 'Bootstrapped',
}

export const DECISION_ICONS: Record<keyof Choices, string> = {
  entity: 'pi:scroll:amber', // 📜 the incorporation paperwork
  team: 'pi:people:orange', // 👥 cofounders vs solo
  funding: 'pi:bank:emerald', // 🏦 same bank as the fundraising concepts
  product: 'pi:receipt:emerald', // 🧾 the business model's paper trail
  ordering: 'pi:convert:violet', // 🔀 name-first vs build-first
  hire: 'pi:handshake:orange', // 🧑‍💼 same handshake as hr_001 first hire
  compliance: 'pi:scales:amber', // ⚖️ same scales as the legal phase
  enterprise: 'pi:target:sky', // 🎯 same target as scale_012 OKRs
  ph: 'pi:rocket:fuchsia', // 🚀 same rocket as growth_010 launch
  remote: 'pi:house:orange', // 🏠 working from home
}

// Visible display titles only — every dropdown keeps its canonical DECISIONS title as the group
// accessible name, and every option its canonical full label. Renames for clarity (founder
// addendum 2026-09-29): 'Order' → 'Start with' (name-first vs build-first read wrong), 'Model' →
// 'Business model' (could read as an AI model).
const DECISION_SHORT: Record<keyof Choices, { title: string; options: Record<string, string> }> = {
  // Country-aware entities (founder round 5, item 1) — the roster shown follows the geo pick.
  entity: {
    title: 'Entity',
    options: { 'c-corp': 'C-Corp', llc: 'LLC', ltd: 'Ltd', gmbh: 'GmbH', ug: 'UG', sas: 'SAS', sarl: 'SARL', 'pvt-ltd': 'Pvt Ltd' },
  },
  team: { title: 'Team', options: { cofounders: 'Cofounders', solo: 'Solo' } },
  funding: { title: 'Funding', options: { seed: 'Seed', bootstrap: 'Bootstrap' } },
  // More business models (founder round 5, item 2).
  product: {
    title: 'Business model',
    options: { subscriptions: 'SaaS', invoices: 'Invoices', marketplace: 'Marketplace', usage: 'Usage', ecommerce: 'E-com' },
  },
  // 'Start with' left the control panel (round 5, item 4) — the entry stays for the typed map
  // (the decision itself still exists for composition and the codec).
  ordering: { title: 'Start with', options: { 'name-first': 'Name', 'build-first': 'Build' } },
  hire: { title: 'Hire', options: { yes: 'Yes', no: 'No' } },
  // Compliance gets specific (round 5, item 3): SOC 2 early/deferred keep their codec slots.
  // 'Basics' (item 8, 2026-09-30) is the new default-asserted posture; 'None' keeps its slot for
  // old links but leaves the display roster (HIDDEN_OPTION_VALUES).
  compliance: {
    title: 'Compliance',
    options: { now: 'SOC 2', later: 'SOC 2 later', none: 'None', hipaa: 'HIPAA', iso: 'ISO 27001', basics: 'Basics' },
  },
  // The ICP selector (item 4, 2026-09-30): the internal 'enterprise' key + 'no'/'yes' tokens are
  // codec/seed surface and never move; the display is who you sell to.
  enterprise: { title: 'ICP', options: { no: 'Developers', yes: 'Enterprises', smb: 'SMBs', consumer: 'Consumers' } },
  // Launch options (founder round 4, item 7): venue-flavored public launches + Stealth mode.
  // 'x' (2026-10-01, item 5): the X-launch venue — the new default-asserted pick.
  ph: { title: 'Launch', options: { yes: 'PH', no: 'Stealth', 'show-hn': 'HN', waitlist: 'Waitlist', x: 'X' } },
  // Remote vs In-office (item 5, 2026-09-30).
  remote: { title: 'Workplace', options: { remote: 'Remote', office: 'Office' } },
}

export default function VirtualStartup({
  chains,
  tasks,
  roles,
  yearCandidates,
  eventExamples,
  access,
  pricing,
  taskRisks,
  vendorGeo = {},
  popularity = {},
  assistants = [],
}: {
  chains: VsChain[]
  // Precomputed payload for every task any decision combo can reach, keyed by corpus task id.
  tasks: Record<string, VirtualTaskPayload>
  // Union vendor roles (lib/processes.ts vendorRoles over the union tasks) — filtered per
  // journey below before handing to the reused ProcessSimulator.
  roles: VendorRole[]
  // Every possible year-view rhythm row (lib/virtualStartup.ts buildYearCandidates, built
  // server-side from the corpus cadence data) — gated per journey/sweep-gate client-side.
  yearCandidates: YearCandidate[]
  // Event-driven examples (lib/virtualStartup.ts buildEventExamples) — gated per combo below.
  eventExamples: EventExample[]
  // v3 payloads (lib/virtualStartupData.ts): canonical MCP/CLI verdicts per swap option, the
  // picked vendors' published-pricing headlines, and the corpus risk axis for the event gates.
  access: VsAccessMap
  pricing: VsPricingMap
  taskRisks: Record<string, number>
  // In-sim GEO (founder batch 2026-09-29, item 2): committed (product, country) availability
  // cells (lib/vendorGeo.ts vendorGeoLookup — non-US cells only, evidence or absent). Optional
  // additive prop: {} = no vendor geo warnings ever render (honest degrade).
  vendorGeo?: VendorGeoLookup
  // 'Likely choice' ordering payload (founder round 5, item 7) — per role arena, the committed
  // adoption/popularity presentation order + per-product signal labels (lib/virtualStartupData.ts
  // buildVsPopularity). Optional additive prop: {} = judged/ladder ordering everywhere.
  popularity?: VsPopularityMap
  // 'Which AI firm are you using' roster (item 7, 2026-09-30) — the judged ai-assistants
  // products behind the "I'm using" selector (lib/virtualStartupData.ts buildVsAssistants).
  // Optional additive prop: [] = the selector row never renders (honest degrade).
  assistants?: VsAssistant[]
}) {
  // ── The ASSERTED decisions only (dropdowns; 'Not set' = absent key). The journey always
  // composes over the EFFECTIVE combo below — an unasserted decision runs the default branch
  // and stays out of the ?run= state. Presets/YC assert their combos explicitly. DEFAULT-
  // ASSERTED decisions (founder round 4, item 5: entity starts asserted at 'Delaware C-Corp')
  // begin asserted — the dropdown shows the value, semi-auto never asks them, and clearing back
  // to 'Not set' stays one click away.
  const [asserted, setAsserted] = useState<AssertedChoices>({ ...DEFAULT_ASSERTED })
  const [preset, setPreset] = useState<PresetId | null>(null)
  // Funding scenario pill (round 3, item 1): shares the ?preset= param namespace with the
  // company presets (the codec extends compatibly), asserts only its partial combo, no identity.
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [yc, setYc] = useState(false)
  // 'Apply to YC' (item 6, 2026-10-01): the setup-band checkbox — a composition change (the
  // real fund_007 application process joins as its own phase), so toggling clears the run like
  // any decision change. Rides the ?run= permalink as the appended 'q' token; legacy links
  // decode without it and replay phase-free, their era. Independent of YC batch mode (yc).
  const [ycApply, setYcApply] = useState(false)
  // The 'Set vendors' disclosure (founder batch 2026-10-02, item 2): the Setup/Vendors TABS are
  // gone — the band flows top-to-bottom and the vendor-swap pickers live behind a collapsible
  // disclosure row (house <details> idiom), default COLLAPSED. Ephemeral chrome, deliberately
  // NOT persisted in the URL — the picks themselves ride the ?run= permalink.
  const [vendorsOpen, setVendorsOpen] = useState(false)
  // Vendors-tab ordering toggle (founder round 5, item 7): 'Likely choice' (the committed
  // adoption/popularity presentation order) leads; 'Judged' is the arena's agent-readiness
  // ladder. Both orderings are committed data — the toggle only changes presentation.
  const [vendorOrdering, setVendorOrdering] = useState<'likely' | 'judged'>('likely')
  // ── v3 state: founder AXES (Technical × Experience — orthogonal, composable), the reader's
  // vendor picks (shared with ProcessSimulator below, controlled), decided event branches, the
  // drive mode, the typed company name (semi-auto naming card; null = autopilot), and the run
  // seed — together with the asserted combo/preset/yc this is the WHOLE run state the ?run=
  // permalink encodes.
  const [founder, setFounder] = useState<VsFounderAxes>(DEFAULT_FOUNDER_AXES)
  const [mode, setMode] = useState<VsDriveMode>('auto')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  // Founder addendum #2 (2026-09-29, "stop the sim and change a vendor"): a MID-RUN vendor pick
  // must recompose ONLY the unrevealed tail. Unlike semi-auto decisions there is no
  // pause-before-first-affected-row guarantee — a pick can change already-printed step notes and
  // day markers — so the pick handler PINS the printed prefix (the revealed slice of the display
  // rows at pick time) and the composition below splices the fresh tail onto it. null = no pin
  // (every non-pick recomposition path clears the run first, so the pin only ever exists mid-run).
  const [pinnedPrefix, setPinnedPrefix] = useState<Row[] | null>(null)
  const [eventChoices, setEventChoices] = useState<Record<string, string>>({})
  const [runSeed, setRunSeed] = useState(0)
  // ── The assistant pin (item 7, 2026-09-30): a judged ai-assistants product id, or null for no
  // pin. DISPLAY annotation only (the geo precedent) — changing it never recomposes or resets
  // the run; it renames the displayed pick on the AI-conversation steps, shows in the state
  // panel, and rides the ?run= permalink ('a' token). FRESH visits start pinned to ChatGPT
  // (founder 2026-10-01, item 5 — simply pre-selected, no 'judged pick' labeling); a decoded
  // ?run= link overrides below, so old links without the 'a' token replay unpinned, their era.
  const [assistant, setAssistant] = useState<string | null>(DEFAULT_VS_ASSISTANT)
  const [win, setWin] = useState<WindowTab>('d30')
  // ── Semi-auto drive state: what the paused run is waiting on (a decision card or the naming
  // card), plus whether it already handled naming. (The title-bar manual pause is GONE — founder
  // batch 2026-09-30, item 2: the primary ⏹ Stop suffices; semi-auto decision pauses stay.)
  const [waitingOn, setWaitingOn] = useState<keyof Choices | 'name' | null>(null)
  const [named, setNamed] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  // ── In-sim GEO selection (founder batch 2026-09-29): null = the 🇺🇸 US default (never stored,
  // never in the URL), 'GLOBAL' = explicit geo-neutral (no marks), else a country. ANNOTATION
  // ONLY, derived from committed data — it never changes rows, scores, ranks, or the clock, so
  // switching mid-run simply annotates the already-revealed lines. VsGeoSelector owns the
  // ?geo=/pa-geo sync (mount-read + writes), the same contract as components/GeoSwitcher.tsx.
  const [geo, setGeo] = useState<GeoChoice | null>(null)
  // The entity roster's country (founder round 5, item 1): the geo selection, with both the US
  // default (null) and the geo-neutral 🌐 Global resolving to the US roster (the corpus default).
  const entityCountry: GeoCountry = geo === null || geo === GEO_GLOBAL ? 'US' : geo
  // The option values a decision's UI actually offers (dropdown roster, semi-auto ask, pause
  // schedule alike): the geo-filtered entity roster, minus display-hidden values (compliance
  // 'None' — HIDDEN_OPTION_VALUES). The full DECISIONS roster stays the codec source of truth,
  // so an old link's asserted hidden value still resolves and replays.
  const offeredValues = useCallback(
    (d: DecisionDef): readonly string[] => {
      const base = d.id === 'entity' ? ENTITY_OPTIONS_BY_COUNTRY[entityCountry] : d.options.map((o) => o.value)
      const hidden = HIDDEN_OPTION_VALUES[d.id]
      return hidden ? base.filter((v) => !hidden.includes(v)) : base
    },
    [entityCountry],
  )
  const [revealed, setRevealed] = useState(0)
  const [running, setRunning] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mirrors read by the reveal ticker (it must check the semi-auto pause schedule SYNCHRONOUSLY
  // before each printed row — an effect would let a fake-timer test tick past the pause point).
  const revealedRef = useRef(0)
  const rowsLenRef = useRef(0)
  const pauseAtRef = useRef<Array<{ id: keyof Choices | 'name'; at: number }>>([])
  // The terminal viewport (founder ask 2026-09-28): the run prints INSIDE this fixed-height
  // scroll box, so the page never grows mid-run. followRef is the terminal-follow flag — pinned
  // to the newest line unless the reader scrolled up inside the terminal; scrolling back to
  // (near) the bottom re-engages it. pendingTopRef is the one-shot "show the whole timeline"
  // override: fill instantly, then read from the top.
  const termRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  const pendingTopRef = useRef(false)

  // The reveal ticker NEVER outlives the page: cleared on unmount (this cleanup — regression-
  // pinned by components/__tests__/navPerfPins.test.tsx) and paused while the tab is hidden
  // (below). Both are part of the mobile-nav hang fix (2026-10-01): a ticking 240ms re-render of
  // the whole sim must not keep burning the main thread when the reader isn't looking at it.
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  // Pause the ticker while the document is hidden, resume on return. Only an ACTIVE ticker is
  // paused/resumed (hiddenPausedRef): a manual ⏹ Stop or a semi-auto decision pause stays
  // stopped — visibility must never restart a run the reader (or the run itself) halted.
  const hiddenPausedRef = useRef(false)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (timer.current) {
          stop()
          hiddenPausedRef.current = true
        }
      } else if (hiddenPausedRef.current) {
        hiddenPausedRef.current = false
        startTicker()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // stop/startTicker close only over refs and setState — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After every reveal commit: pin the terminal to its newest line while following, or honor the
  // one-shot scroll-to-top after an instant fill. Reading scrollHeight post-commit is the whole
  // point — this cannot run inside the click/tick handlers, the new rows aren't in the DOM yet.
  useEffect(() => {
    const el = termRef.current
    if (!el) return
    if (pendingTopRef.current) {
      pendingTopRef.current = false
      el.scrollTop = 0
      return
    }
    // An emptied terminal (restart / decision change) rests at its top, never "the bottom".
    if (revealed === 0) {
      el.scrollTop = 0
      return
    }
    if (followRef.current) el.scrollTop = el.scrollHeight
  }, [revealed])

  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     (external system). The static HTML must render the default view, so this cannot be a
     useState initializer (hydration mismatch); it runs once and renders at most one extra pass. */
  useEffect(() => {
    // ?preset= holds either a company preset id or a funding scenario id (one shared namespace —
    // the codec extends compatibly; junk values resolve to null in both and are ignored).
    const p = presetById(readParam('preset'))
    const sc = scenarioById(readParam('preset'))
    const ycOn = readParam('yc') === '1'
    if (!p && !sc && !ycOn) return
    if (p) setPreset(p.id)
    if (sc) setScenario(sc.id)
    if (ycOn) setYc(true)
    // Presets/YC ASSERT their combos explicitly (dropdowns leave 'Not set' otherwise); a
    // scenario asserts only its partial combo on top of the current (default-asserted) state
    // (the YC calibration wins where they disagree).
    if (p) setAsserted(ycOn ? applyYcCalibration(p.choices) : { ...p.choices })
    else if (sc) setAsserted((a) => (ycOn ? { ...a, ...sc.asserts, ...YC_CALIBRATION } : { ...a, ...sc.asserts }))
    else setAsserted((a) => ({ ...a, ...YC_CALIBRATION }))
    // Mount-only: the URL is the INITIAL view.
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── v3: one-time ?run= restore — a run link carries the WHOLE state (asserted decisions,
  // preset, yc, founder axes, drive mode, typed company name, picks, event choices, seed) and
  // replays the exact run, so it wins over ?preset/?yc (this effect runs after the one above;
  // a malformed param decodes to null and changes nothing).
  /* eslint-disable react-hooks/set-state-in-effect -- same one-time post-hydration URL sync
     contract as the preset/yc effect above. */
  useEffect(() => {
    const run = decodeRunState(readParam('run'))
    if (!run) return
    // ERA HANDLING (lib/virtualStartup.ts DEFAULT_ASSERTED_URL_NEUTRAL): only the composition-
    // NEUTRAL default-asserted decisions underlay the link's choices — a ?run= may elide a slot
    // (old links encode it as '.') and still replay with the neutral defaults asserted (entity,
    // team, funding, compliance — identical composition either way; semi-auto never asks them).
    // The 2026-10-01 demo defaults that CHANGE composition (ph 'x' → X-venue launch, remote
    // 'office' → the ops_014 lease phase) are excluded from this underlay by construction, so a
    // decoded legacy link keeps composing exactly its own era's journey; only FRESH visits get
    // the new defaults. The same rule covers the assistant pin: run.assistant (null on old
    // links) simply overwrites the fresh-visit ChatGPT default below.
    setAsserted({ ...DEFAULT_ASSERTED_URL_NEUTRAL, ...run.choices })
    setPreset(run.preset)
    // A run link carries the asserted decisions themselves, never a scenario pill — the pill is
    // one-tap input chrome, so any scenario a stray ?preset= set deselects here.
    setScenario(null)
    setYc(run.yc)
    setFounder(run.founder)
    setMode(run.mode)
    setCompanyName(run.companyName)
    if (run.companyName) setNamed(true)
    setPicks(run.picks)
    setEventChoices(run.eventChoices)
    setAssistant(run.assistant)
    setYcApply(run.ycApply)
    setRunSeed(run.seed)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // The EFFECTIVE combo: unasserted decisions compose exactly the default branch.
  const choices = useMemo(() => effectiveChoices(asserted), [asserted])
  const identity = useMemo(() => {
    const presetIdentity = presetById(preset)?.company ?? null
    // The typed company name (semi-auto naming card) overrides — descriptor stays the preset's.
    if (companyName) return { name: companyName, descriptor: presetIdentity?.descriptor ?? '' }
    return presetIdentity
  }, [preset, companyName])
  // Semi-auto pins the synthetic name/artifact seed to the RUN-START combo (the default-asserted
  // state — the combo a fresh semi run actually starts from, item 8 moved compliance there) so
  // mid-run decision assertions never rewrite an already-printed seeded value, and a semi run
  // answered with the defaults stays byte-identical to the auto default run.
  const seedCombo = mode === 'semi' ? SEMI_SEED_COMBO : undefined
  const co = useMemo(() => synthCompany(choices, identity, seedCombo), [choices, identity, seedCombo])

  // ── The whole run, assembled by the shared pure builder (rows, steps, outcome model, drawn
  // events) — the semi-auto pause schedule below reuses the same builder for per-option variants.
  const runArgs = useMemo<Omit<RunArgs, 'choices'>>(
    () => ({ chains, tasks, roles, access, founder, picks, identity, preset, yc, ycApply, seed: runSeed, taskRisks, seedCombo }),
    [chains, tasks, roles, access, founder, picks, identity, preset, yc, ycApply, runSeed, taskRisks, seedCombo],
  )
  const run = useMemo(() => buildRunRows({ ...runArgs, choices }), [runArgs, choices])
  const { rows: composedRows, steps, stats, outcomeInputs, drawnEvents } = run
  // The DISPLAY rows every surface below prints from: the fresh composition, or — after a
  // mid-run vendor swap (founder addendum #2) — the pinned printed prefix with the fresh
  // composition's tail spliced on from the same index (printed rows stay byte-stable; unrevealed
  // steps pick up the new vendor's routing/outcome notes, day markers ahead re-derive). The
  // outcome model (steps/stats/scorecard/burn) deliberately stays on the FRESH run — the clock
  // and burn follow the pick, only the transcript's printed prefix is history.
  const rows = useMemo<Row[]>(() => {
    if (!pinnedPrefix || pinnedPrefix.length === 0) return composedRows
    // A slower swap can shift a day marker the prefix already printed back into the fresh tail
    // (same row key) — a row whose key the prefix holds has by definition already printed, so
    // it drops from the tail rather than printing twice.
    const printed = new Set(pinnedPrefix.map((r) => r.key))
    return [...pinnedPrefix, ...composedRows.slice(pinnedPrefix.length).filter((r) => !printed.has(r.key))]
  }, [composedRows, pinnedPrefix])

  const optimalPicks = useMemo(() => optimalSelections(roles, access), [roles, access])
  const taskMinutes = useMemo(() => taskMinutesById(tasks), [tasks])
  const eventResolution = useMemo(
    () => resolveVsEvents(drawnEvents, eventChoices, { roles, selections: picks, taskMinutes, chains }),
    [drawnEvents, eventChoices, roles, picks, taskMinutes, chains],
  )
  // Post-event stack (a switch-vendor branch re-picks from the real arena ranking) — the
  // scorecard and burn read this; the timeline keeps the reader's own picks.
  const effectivePicks = useMemo(
    () => ({ ...picks, ...eventResolution.pickOverrides }),
    [picks, eventResolution],
  )
  const finalOutcome = useMemo(
    () => computeStackOutcome(outcomeInputs, effectivePicks, roles, access, founder),
    [outcomeInputs, effectivePicks, roles, access, founder],
  )
  const optimalOutcome = useMemo(
    () => computeStackOutcome(outcomeInputs, optimalPicks, roles, access, founder),
    [outcomeInputs, optimalPicks, roles, access, founder],
  )

  // ── Semi-auto pause schedule: for every still-unasserted decision, the first row index at
  // which its two options' fully recomposed runs differ (structure, clock, artifact text, event
  // placement — rowSignature). The ticker pauses BEFORE printing that row, so an assertion only
  // ever recomposes the unrevealed tail. Decisions whose pause row is already behind the cursor
  // have honestly passed — they stay on their default and are never re-asked. The naming card
  // gets the same treatment: its pause row is the first row that CHANGES when the company name
  // does (compared via two sentinel identities), i.e. where the name comes into existence.
  const pauseSchedule = useMemo(() => {
    if (mode !== 'semi') return []
    // A decision that only APPENDS rows (e.g. the enterprise motion's final phase) first
    // differs one past the current composition's end — cap at the last printable row so the
    // run still pauses (one row early is always invariant-safe: that row is common to both
    // variants). 0 = asked at Run-press, before anything prints.
    const cap = Math.max(0, rows.length - 1)
    const out: Array<{ id: keyof Choices | 'name'; at: number }> = []
    for (const d of VISIBLE_DECISIONS) {
      if (asserted[d.id] !== undefined) continue
      // The ask offers exactly what the card will offer (the geo-filtered entity roster;
      // display-hidden values excluded) — the pause point derives from those options.
      const values = offeredValues(d)
      const variants = values.map(
        (v) => buildRunRows({ ...runArgs, choices: effectiveChoices({ ...asserted, [d.id]: v }) }).rows,
      )
      out.push({ id: d.id, at: Math.min(firstAffectedRow(variants) ?? 0, cap) })
    }
    if (!named && companyName === null) {
      const withName = (name: string) =>
        buildRunRows({ ...runArgs, identity: { name, descriptor: identity?.descriptor ?? '' }, choices }).rows
      out.push({ id: 'name', at: Math.min(firstDifferingRow(withName('Aaaa'), withName('Bbbb')) ?? 0, cap) })
    }
    return out
  }, [mode, asserted, named, companyName, runArgs, choices, identity, rows.length, offeredValues])

  // Only the roles whose arena the selected journey actually touches — the 'Set vendors' disclosure (and the
  // outcome model, which resolves picks via step.arenaId / step.choiceArenaId) loses nothing.
  const journeyRoles = useMemo(() => {
    const arenas = new Set<string>()
    for (const s of steps) {
      if (s.arenaId) arenas.add(s.arenaId)
      if (s.choiceArenaId) arenas.add(s.choiceArenaId)
    }
    return roles.filter((r) => arenas.has(r.arenaId))
  }, [roles, steps])
  // The journey roles the reader has re-picked away from the default judged-top vendor — the
  // vendors disclosure's quiet count badge, the scorecard's user-picked labels, and the post-run
  // "run again with your vendors" affordance (founder addendum #3) all read this.
  const userPickedArenas = useMemo(
    () =>
      new Set(
        journeyRoles
          .filter((r) => picks[r.arenaId] !== undefined && picks[r.arenaId] !== r.defaultProductId)
          .map((r) => r.arenaId),
      ),
    [journeyRoles, picks],
  )
  const vendorOverrides = userPickedArenas.size

  // Year one — deterministic from the same decision combo (seeded months for annuals the
  // corpus doesn't date; those keep the fuchsia styling + data-synthetic).
  const year = useMemo(() => {
    const journeyTasks = journeyPhases(choices, chains, { yc, ycApply }).flatMap((p) => p.taskIds)
    const rhythm = yearRows(choices, journeyTasks, yearCandidates)
    return { rhythm, stats: yearStats(rhythm) }
  }, [choices, chains, yc, ycApply, yearCandidates])

  // First 30 / first 90 days — the same rhythm rows sliced by cadence-math day intervals; the
  // launch journey's own day span comes from the corpus estimates (dayOf(stats.totalMinutes)).
  const windows = useMemo(
    () => ({ d30: windowRows(year.rhythm, 30), d90: windowRows(year.rhythm, 90) }),
    [year],
  )
  // Event-driven examples — real corpus processes that run when triggered, not on a calendar.
  const events = useMemo(() => eventRows(choices, eventExamples), [choices, eventExamples])

  const done = revealed >= rows.length

  // ── v3 render lookups: the resolved event per id (choice + time delta), the journey's burn
  // lines (journey roles only — the vendors this run actually picks), and the permalink state.
  const resolvedEventById = useMemo(
    () => new Map(eventResolution.events.map((e) => [e.def.id, e])),
    [eventResolution],
  )
  const burn = useMemo(() => computeBurn(journeyRoles, effectivePicks, pricing), [journeyRoles, effectivePicks, pricing])
  const runState: VsRunState = useMemo(
    () => ({ choices: asserted, preset, yc, founder, mode, companyName, picks, eventChoices, assistant, ycApply, seed: runSeed }),
    [asserted, preset, yc, founder, mode, companyName, picks, eventChoices, assistant, ycApply, runSeed],
  )
  // The pinned assistant's judged roster entry (null = the judged pick displays alone).
  const assistantPick = useMemo(() => assistants.find((a) => a.id === assistant) ?? null, [assistants, assistant])
  function chooseEventBranch(eventId: string, choiceId: string) {
    setEventChoices((prev) => ({ ...prev, [eventId]: choiceId }))
  }

  // ── In-sim GEO (2026-09-29): the selected non-US country, or null for both the US default and
  // the explicit 🌐 Global choice — Global is geo-neutral by definition, so no marks render.
  const geoCountry: GeoSelection | null = geo !== null && geo !== GEO_GLOBAL ? geo : null
  // Whether a task's process is US-scoped (corpus geoScope 'us'/'us-state') — the only tasks the
  // country marks and analog lines ever attach to.
  const usScoped = (taskId: string) => {
    const scope = tasks[taskId]?.geoScope
    return scope === 'us' || scope === 'us-state'
  }

  // ── State-graph panel data (founder batch 2026-09-29, item 3) — DERIVED from the exact same
  // revealed-row state the terminal prints from (no separate timers): the panel fills with the
  // run, resets with clearRun, and replays deterministically with the rows.
  const panel = useMemo(() => {
    const artifacts: SyntheticArtifact[] = []
    const vendors: TopVendorPick[] = []
    const seenVendors = new Set<string>()
    const events: VsPanelEvent[] = []
    // Company documents (founder 2026-10-07, item 3): the registry artifacts
    // (processes/artifacts.json) of exactly the producesArtifact-tagged steps the run has
    // printed — committed corpus tags only, deduped in first-production order (the registry's
    // one-canonical-producer rule makes a duplicate an alsoProducedBy exception, printed once).
    const documents: VsProducedArtifact[] = []
    const seenDocuments = new Set<string>()
    // Ultrametric CLI/MCP lines (founder ask 2026-09-30): the revealed processes our own shipped
    // CLI can drive (curated lib/ultrametricCli.ts). Collected SEPARATELY from the judged
    // vendors list — first-party, disclosed, never mixed into or reordering the judged picks.
    const umCli: Array<{ taskId: string; title: string; command: string }> = []
    for (const row of rows.slice(0, revealed)) {
      if (row.kind === 'artifact') {
        artifacts.push(row.artifact)
      } else if (row.kind === 'task') {
        const um = ultrametricCliFor(row.task.id)
        if (um) umCli.push({ taskId: row.task.id, title: row.task.title, command: um.command })
      } else if (row.kind === 'step') {
        if (row.top && !seenVendors.has(row.top.productId)) {
          seenVendors.add(row.top.productId)
          vendors.push(row.top)
        }
        if (row.produces && !seenDocuments.has(row.produces.id)) {
          seenDocuments.add(row.produces.id)
          documents.push(row.produces)
        }
      } else if (row.kind === 'vsevent') {
        const resolved = resolvedEventById.get(row.eventId)
        if (resolved) {
          events.push({
            id: resolved.def.id,
            title: resolved.def.title,
            day: resolved.day,
            choiceLabel: resolved.choice?.label ?? null,
            outcome: resolved.choice?.outcome ?? null,
          })
        }
      }
    }
    return { artifacts, vendors, events, umCli, documents }
  }, [rows, revealed, resolvedEventById])
  // The Decisions tab: BOTH founder axes first (item 5), then the nine decisions with their
  // pending-vs-asserted state (semi-auto shows what the run still owes you).
  const panelDecisions = useMemo(() => {
    const techLabel = VS_TECHNICAL_OPTIONS.find((o) => o.value === founder.technical)?.label ?? founder.technical
    const expLabel = VS_EXPERIENCE_OPTIONS.find((o) => o.value === founder.experience)?.label ?? founder.experience
    const axes = [
      { id: 'founder-technical', title: 'Founder', icon: 'pi:person:orange', label: techLabel, state: 'asserted' as const }, // 👤
      { id: 'founder-experience', title: 'Experience', icon: 'pi:grad-cap:orange', label: expLabel, state: 'asserted' as const }, // 🎓
    ]
    // The assistant pin (item 7): the panel reflects the "I'm using" selection when one is set.
    const using = assistantPick
      ? [{ id: 'assistant', title: "I'm using", icon: 'pi:robot:violet', label: `${assistantPick.name} · your assistant`, state: 'asserted' as const }] // 🤖
      : []
    // 'Start with' left the UI entirely (round 5, item 4) — the state panel lists only the
    // decisions the panel offers.
    const decisions = VISIBLE_DECISIONS.map((d) => {
      const label = d.options.find((o) => o.value === choices[d.id])?.label ?? String(choices[d.id])
      const state = asserted[d.id] !== undefined ? ('asserted' as const) : waitingOn === d.id ? ('pending' as const) : ('default' as const)
      return {
        id: d.id,
        title: d.title,
        icon: DECISION_ICONS[d.id],
        label: state === 'asserted' ? label : state === 'pending' ? 'deciding…' : `${label} · not set`,
        state,
      }
    })
    return [...axes, ...using, ...decisions]
  }, [choices, asserted, founder, waitingOn, assistantPick])

  // ── Journey DAG strip inputs (founder ask 2026-09-29: "the DAG visualization UI unit … on top
  // of the terminal output") — the strip derives everything from the SAME rows/revealed state the
  // terminal prints from (no timers of its own). The semi-auto pause schedule and the drawn
  // events reach it as markers; a recomposition re-derives the strip, and because the pause lands
  // before the first affected row, already-lit nodes never change.
  const dagPauses = useMemo<VsDagPause[]>(
    () =>
      mode !== 'semi'
        ? []
        : pauseSchedule.map((p) => ({
            id: p.id,
            at: p.at,
            label: p.id === 'name' ? 'Name the company' : DECISIONS.find((d) => d.id === p.id)?.title ?? p.id,
          })),
    [mode, pauseSchedule],
  )
  const dagEventTitles = useMemo(() => {
    const out: Record<string, string> = {}
    for (const e of eventResolution.events) out[e.def.id] = e.def.title
    return out
  }, [eventResolution])
  // DAG node click → scroll the terminal to that process's first printed row (the primary action;
  // the node's small ↗ links the /processes page). Unrevealed rows aren't in the DOM yet — the
  // click is honestly a no-op until the process prints. Jumping unpins the terminal follow.
  function scrollTermToTask(taskId: string) {
    const term = termRef.current
    if (!term) return
    const el = term.querySelector<HTMLElement>(`[data-vs-row="task-${taskId}"]`)
    if (!el) return
    followRef.current = false
    term.scrollTop = Math.max(0, el.getBoundingClientRect().top - term.getBoundingClientRect().top + term.scrollTop - 8)
  }

  // The title-bar run identity — pre-naming it's a neutral prompt: the company name comes into
  // existence AT the run's naming step (founder addendum 2026-09-29), so until the revealed rows
  // contain a name-bearing artifact the prompt reads `new-startup`.
  const nameRowIndex = useMemo(
    () => rows.findIndex((r) => r.kind === 'artifact' && r.artifact.label === 'Company name'),
    [rows],
  )
  const nameExists = nameRowIndex !== -1 && revealed > nameRowIndex
  // Slugged from the bare name (co.name carries no entity suffix), so every entity — Inc./LLC
  // and the round-5 country entities alike — yields the same clean prompt identity.
  const termName = nameExists
    ? co.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'new-startup'

  // ── The reveal ticker (shared by Run, manual resume, and semi-auto resume). It checks the
  // pause schedule SYNCHRONOUSLY before printing each row: in semi-auto, when the NEXT row is
  // some unasserted decision's (or the naming card's) first affected row, the run stops and the
  // terminal presents the card — so an assertion only ever recomposes the unrevealed tail. The
  // ticker reads mirrors (refs) synced post-commit: rows/schedule only ever change from event
  // handlers, whose renders flush before the next 240ms tick.
  useEffect(() => {
    rowsLenRef.current = rows.length
    pauseAtRef.current = pauseSchedule
  }, [rows, pauseSchedule])

  function pauseDue(at: number): keyof Choices | 'name' | null {
    for (const p of pauseAtRef.current) {
      if (p.at === at) return p.id
    }
    return null
  }

  function stop() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setRunning(false)
  }

  function startTicker() {
    if (timer.current) clearInterval(timer.current)
    setRunning(true)
    timer.current = setInterval(() => {
      const at = revealedRef.current
      const waitFor = pauseDue(at)
      if (waitFor !== null) {
        stop()
        setWaitingOn(waitFor)
        return
      }
      const next = at + 1
      revealedRef.current = next
      // TRANSITION priority (mobile-nav hang fix, 2026-10-01): each reveal re-renders the whole
      // sim (terminal rows + DAG + state panel) and the post-commit terminal pin forces layout —
      // near the 240ms budget on a phone. As default-priority updates these ticks preempted and
      // restarted the router's navigation transition every 240ms, so tapping the header logo
      // mid-run starved the navigation ("it just hangs" until the run ended). As a transition
      // the tick yields to navigation; the pause schedule stays SYNCHRONOUS via the refs above,
      // so semi-auto semantics and the fake-timer tests are unchanged.
      startTransition(() => setRevealed(next))
      if (next >= rowsLenRef.current) stop()
    }, CADENCE_MS)
  }

  // Empty the terminal and re-arm the follow — every decision/preset/mode change and every
  // restart goes through here so the viewport starts clean at its top.
  function clearRun() {
    stop()
    setRevealed(0)
    revealedRef.current = 0
    setPinnedPrefix(null) // a fresh transcript has no pinned prefix (addendum #2)
    setWaitingOn(null)
    setNameDraft('')
    followRef.current = true
    pendingTopRef.current = false
    if (termRef.current) termRef.current.scrollTop = 0
  }

  // v3: a decision/preset/mode change is a NEW run — decided event branches reset (the drawn
  // event set changes with the combo); vendor picks deliberately survive (they are the reader's
  // stack, not run state), and a plain restart keeps both so a shared ?run= replays intact.
  function clearRunState() {
    setEventChoices({})
  }

  // Terminal-follow: any scroll (the reader's or our own pin) re-derives the flag from where
  // the viewport actually is — up = paused, back within FOLLOW_SLACK_PX of the bottom = following.
  function onTermScroll() {
    const el = termRef.current
    if (!el) return
    followRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - FOLLOW_SLACK_PX
  }

  function pickChoice(id: keyof Choices, value: string | null) {
    clearRun()
    clearRunState()
    // Manual toggle: the preset/scenario no longer describes the combo — ?preset clears, the
    // combo stays.
    setPreset(null)
    setScenario(null)
    // A manual value contradicting the YC calibration turns YC mode off; other toggles keep it.
    // Clearing back to 'Not set' composes the default — contradiction is judged on that value.
    const calibrated = (YC_CALIBRATION as Partial<Record<keyof Choices, string>>)[id]
    const nextEffective = value ?? DEFAULT_CHOICES[id]
    const nextYc = yc && (calibrated === undefined || calibrated === nextEffective)
    setYc(nextYc)
    setAsserted((a) => {
      const next: Record<string, string> = { ...(a as Record<string, string>) }
      if (value === null) delete next[id]
      else next[id] = value
      return next as AssertedChoices
    })
    setParams({ preset: null, yc: nextYc ? '1' : null })
  }

  // Geo switch with the entity-geo reset rule (founder round 5, item 1): the Entity dropdown's
  // roster follows the country, and an asserted entity the new country doesn't offer resets to
  // that country's default-asserted first option — a composition change, so the run clears like
  // any decision change (plain geo switches stay annotation-only and never touch the run).
  function onGeoChange(next: GeoChoice | null) {
    const country: GeoCountry = next === null || next === GEO_GLOBAL ? 'US' : next
    const current = asserted.entity
    if (current !== undefined && !ENTITY_OPTIONS_BY_COUNTRY[country].includes(current)) {
      clearRun()
      clearRunState()
      // The reset entity no longer matches a preset/scenario's asserted combo — deselect, keep
      // the rest of the setup (the pickChoice rule).
      setPreset(null)
      setScenario(null)
      setAsserted((a) => ({ ...a, entity: defaultEntityFor(country) }))
      setParams({ preset: null })
    }
    setGeo(next)
  }

  function applyPreset(p: VsPreset) {
    clearRun()
    clearRunState()
    setPreset(p.id)
    // A preset ASSERTS its whole combo (so any scenario pill deselects); YC mode applies ON
    // TOP — the calibration wins where they disagree.
    setScenario(null)
    setAsserted(yc ? applyYcCalibration(p.choices) : { ...p.choices })
    setParams({ preset: p.id })
  }

  // Whether a scenario's partial combo contradicts the YC calibration (bootstrapped does — YC
  // forces the raise): the same contradiction rule pickChoice applies to manual toggles.
  function scenarioConflictsYc(s: VsScenario): boolean {
    return Object.entries(YC_CALIBRATION).some(([k, v]) => {
      const want = s.asserts[k as keyof Choices]
      return want !== undefined && want !== v
    })
  }

  // The combined Funding selector's pick handler (addendum 2026-09-30): plain values go through
  // pickChoice (asserts only the funding decision; deselects any scenario, the standing rule),
  // scenario pseudo-values go through the exact applyScenario path the pills used.
  function pickFunding(value: string | null) {
    if (value !== null && value.startsWith(FUNDING_SCENARIO_PREFIX)) {
      const s = scenarioById(value.slice(FUNDING_SCENARIO_PREFIX.length))
      if (s) applyScenario(s)
      return
    }
    pickChoice('funding', value)
  }

  function applyScenario(s: VsScenario) {
    clearRun()
    clearRunState()
    setScenario(s.id)
    // A scenario replaces the company preset pill (same ?preset= slot) but asserts only its own
    // keys — the rest of the current setup (including a preset's already-asserted combo) stays.
    setPreset(null)
    const nextYc = yc && !scenarioConflictsYc(s)
    setYc(nextYc)
    setAsserted((a) => ({ ...a, ...s.asserts, ...(nextYc ? YC_CALIBRATION : {}) }) as AssertedChoices)
    setParams({ preset: s.id, yc: nextYc ? '1' : null })
  }

  function toggleYc() {
    clearRun()
    clearRunState()
    const next = !yc
    setYc(next)
    const sc = scenarioById(scenario)
    // Turning YC on over a contradicting scenario (Bootstrapped — YC forces the raise) deselects
    // the scenario pill: the calibration wins, and the pill would no longer describe the combo.
    const dropScenario = next && sc !== null && scenarioConflictsYc(sc)
    if (dropScenario) setScenario(null)
    // YC mode ASSERTS its calibration keys on top of whatever is asserted.
    if (next) setAsserted((a) => ({ ...a, ...YC_CALIBRATION }))
    else {
      // Leaving YC mode with a preset active restores that preset's own (fully asserted) combo;
      // with a scenario active it re-asserts the scenario's partial combo on top.
      const p = presetById(preset)
      if (p) setAsserted({ ...p.choices })
      else if (sc) setAsserted((a) => ({ ...a, ...sc.asserts }) as AssertedChoices)
    }
    setParams(dropScenario ? { yc: '1', preset: null } : { yc: next ? '1' : null })
  }

  function setDriveMode(next: VsDriveMode) {
    if (next === mode) return
    clearRun()
    clearRunState()
    setMode(next)
  }

  // 'Apply to YC' (item 6, 2026-10-01): a composition change — the real fund_007 application
  // process joins/leaves the journey — so the toggle clears the run like a decision change.
  function toggleYcApply() {
    clearRun()
    clearRunState()
    setYcApply((v) => !v)
  }

  function start() {
    // A RESTART in semi-auto clears assertions (and the typed name) back to 'Not set' — a fresh
    // interactive run (DEFAULT-ASSERTED decisions reset to their asserted defaults, never to
    // 'Not set'). The FIRST press keeps whatever the URL/permalink asserted, so replaying a
    // semi-auto link with everything asserted plays straight through.
    const isRestart = revealed > 0
    clearRun()
    if (mode === 'semi' && isRestart) {
      setAsserted({ ...DEFAULT_ASSERTED })
      setCompanyName(null)
      setNamed(false)
      clearRunState()
    }
    startTicker()
  }

  // ── Semi-auto in-run assertions: a decision card pick asserts the decision (the dropdown
  // syncs, the ?run= state serializes it) and the run resumes; the journey recomposes from the
  // paused row on (printed rows never change — the pause landed before the first affected row).
  function decideInRun(id: keyof Choices, value: string) {
    setAsserted((a) => ({ ...a, [id]: value }) as AssertedChoices)
    setWaitingOn(null)
    startTicker()
  }

  // The decision the semi-auto run is currently waiting on (null in auto / while running /
  // when it's the naming card).
  const waitingDecision =
    waitingOn !== null && waitingOn !== 'name' ? DECISIONS.find((x) => x.id === waitingOn) ?? null : null

  // ── Vendor picks (founder addenda #2/#3, 2026-09-29): the 'Set vendors' pickers stay usable at ALL
  // times — before a run, mid-run (stopped, paused, or even running), and after completion.
  // MID-RUN (0 < revealed < rows.length) a pick applies IMMEDIATELY at the semi-auto invariant:
  // the already-printed transcript is pinned byte-stable and only the unrevealed tail recomposes
  // with the new vendor (no pause inserted, no reset — our call over pause-then-apply: the
  // reveal simply keeps printing, or resumes, from the new composition). Outside a run (pre-run
  // or completed) no pin is needed — the next run composes fresh from the picks, which PERSIST
  // across '▶ Run it again' (they are the reader's stack, not run state).
  function pickVendor(arenaId: string, productId: string) {
    if (revealedRef.current > 0 && revealedRef.current < rows.length) {
      setPinnedPrefix(rows.slice(0, revealedRef.current))
    }
    setPicks((s) => ({ ...s, [arenaId]: productId }))
  }

  // The naming card: a typed name (sanitized) or the autopilot's seeded name (empty/skip).
  function nameInRun(raw: string | null) {
    const clean = raw === null ? '' : sanitizeVsCompanyName(raw)
    setCompanyName(clean === '' ? null : clean)
    setNamed(true)
    setNameDraft('')
    setWaitingOn(null)
    startTicker()
  }

  return (
    <div className="space-y-8">
      {/* ── The compact setup band (founder ask 2026-09-28: "make the examples, decisions and
          'who is the founder' much more compact, so we can see the terminal above the fold").
          Same state, same URL params, same determinism as the verbose cards it replaces — the
          explanations live in tooltips (components/InstantTooltip.tsx upgrades every title=);
          the "full setup guide" expand is gone (founder round 4, item 1). The hardware/biotech
          honesty disclosures stay reachable BEFORE any run via the amber ⓘ on the pill (tooltip
          + screen-reader text; tests assert it). The band and the
          terminal share a tight space-y-3 group so the terminal's top edge lands above the fold
          (~420px on a 1440×900 desktop, within ~50vh of the component top on mobile); the old
          mobile-sticky run bar is gone because the run now prints inside the fixed terminal at
          the very top of the page — Run/Restart is one flick away, never a long timeline away. */}
      <div className="space-y-3">
      <section data-testid="vs-setup" aria-label="Set up the open startup simulator" className="rounded-2xl border border-zinc-800 p-3">
        {/* The Setup/Vendors tab pills are GONE (founder batch 2026-10-02, item 2): the band
            simply flows top-to-bottom — Scenario → Founder → "I'm using" → Choices (the
            decisions grid) → the collapsible 'Set vendors' disclosure below. The footer (drive
            mode + Run CTA) sits under everything. */}
        {/* The control panel as a labeled form grid (founder 2026-09-28: the crammed single-row
            band was "poorly designed layout wise") — one aligned label column (Scenario / Founder
            / Decisions), one content column, and a footer bar holding the company info + the Run
            CTA. Mobile fix (founder 2026-10-01, item 3b): the rows WRAP at every width now —
            the old mobile pattern (overflow-x-auto scroll strips) overflowed off the right edge
            instead of scrolling because the decisions row lacked min-w-0 (a grid item's automatic
            minimum width tracks its content), so the whole band pushed past the viewport. Wrap +
            min-w-0 stacks the controls honestly at small widths; no horizontal scrolling. */}
        <div data-testid="vs-setup-rows" className="grid grid-cols-1 gap-y-2 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-center sm:gap-x-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 sm:text-right">
            <IconChip icon={ROW_ICONS.scenario.icon} title={ROW_ICONS.scenario.title} className="mr-1" />
            Scenario
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {/* One-tap example startups (founder batch 2026-09-30, item 11): the pills name the
                FUNCTIONAL TYPE of startup ('Typical software' / 'Frontier hardware' / 'Biotech')
                — the fictional company names left the labels, and the amber ⓘ is gone; the
                hardware/biotech same-corpus honesty disclosure folds into the pill tooltip and
                its screen-reader text instead (still reachable before any run; tests assert it). */}
            {VS_PRESETS.map((p) => {
              const active = preset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`vs-preset-${p.id}`}
                  aria-pressed={active}
                  onClick={() => applyPreset(p)}
                  title={`${p.label} — ${p.product}. One tap prefills every decision; change any decision afterwards and the setup stays, but the example deselects.${p.disclosure ? ` ${p.disclosure}` : ''}`}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition ${
                    active ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span className="font-medium text-zinc-200">{p.label}</span>
                  {p.disclosure && (
                    <span data-testid="vs-preset-disclosure" className="sr-only">
                      {p.disclosure}
                    </span>
                  )}
                </button>
              )
            })}
            {/* The funding scenario PILLS are gone (founder addendum 2026-09-30): VC backed /
                Bootstrapped now live as options of the single Funding selector on the Decisions
                row — same applyScenario semantics, same ?preset= namespace. */}
            <span aria-hidden className="text-zinc-700">|</span>
            {/* YC batch mode — a calibration applied on top of any setup, never a new process.
                The explainer paragraph is GONE (founder batch 2026-10-02, item 3); the
                load-bearing non-affiliation honesty survives as the pill tooltip plus the muted
                suffix that renders while either YC surface is on (below). The pill leads with
                the house YC mark (components/YcBadge.tsx: the YC orange square) — aria-hidden
                decoration, the accessible name stays 'YC batch mode'. */}
            <button
              type="button"
              data-testid="vs-yc-toggle"
              aria-label="YC batch mode"
              aria-pressed={yc}
              onClick={toggleYc}
              title="Calibrates any setup to the publicly known YC batch shape — Demo-Day raise, launch-early pressure. Synthetic; not affiliated with or endorsed by Y Combinator."
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition ${
                yc
                  ? 'border-orange-400/60 bg-orange-400/10 text-orange-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              <span
                aria-hidden
                data-testid="vs-yc-mark"
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[#f26522] text-[9px] font-semibold text-white"
              >
                Y
              </span>
              YC batch mode
            </button>
            {/* 'Apply to YC' checkbox (founder batch 2026-10-01, item 6): composes the REAL
                "Apply to Y Combinator" corpus process (fund_007 — steps from YC's own published
                application guidance) as its own phase, the office/lease pattern. Distinct from
                YC batch mode (the calibration pill left of it); the two compose. A toggle is a
                composition change, so it clears the run; the state rides the ?run= permalink as
                the appended 'q' token — legacy links replay without the phase. */}
            <label
              data-testid="vs-yc-apply"
              title="Adds the real 'Apply to Y Combinator' corpus process (fund_007 — account, written application, one-minute founder video, submission; from YC's published application guidance) to the journey as its own phase. Synthetic run; not affiliated with or endorsed by Y Combinator."
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition ${
                ycApply
                  ? 'border-orange-400/60 bg-orange-400/10 text-orange-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              <input
                type="checkbox"
                data-testid="vs-yc-apply-input"
                checked={ycApply}
                onChange={toggleYcApply}
                className="h-3 w-3 accent-orange-400"
                aria-label="Apply to YC"
              />
              Apply to YC
            </label>
            {/* The surviving MINIMAL non-affiliation note (founder batch 2026-10-02, item 3):
                the deleted explainer's synthetic/affiliation honesty was load-bearing, so this
                short muted suffix renders whenever either YC surface is active; the full
                YC_BATCH.disclosure sentence rides its tooltip. */}
            {(yc || ycApply) && (
              <span
                data-testid="vs-yc-nonaffiliation"
                title={YC_BATCH.disclosure}
                className="text-[10px] text-zinc-500"
              >
                synthetic · not affiliated with YC
              </span>
            )}
          </div>
          {/* The who/where cluster (founder batch 2026-09-29, item 4): the two founder AXES
              (Technical × Experience — a change is a new run, the event stream is seeded by the
              axis pair) with the in-sim Geo row adjacent: 🌐 Global · 🇺🇸 USA (default) · 🇬🇧 UK ·
              🇮🇳 IN · 🇩🇪 DE · 🇫🇷 FR — the same ?geo=/pa-geo contract the process and product
              pages read (components/VsGeoSelector.tsx), annotation only: a selection never
              changes rows, scores, ranks, or the clock. */}
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 sm:text-right">
            <IconChip icon={ROW_ICONS.founder.icon} title={ROW_ICONS.founder.title} className="mr-1" />
            Founder
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <VsPersonaPicker
              axes={founder}
              onSelect={(next) => {
                clearRun()
                clearRunState()
                setFounder(next)
              }}
            />
            <span aria-hidden className="text-zinc-700">
              |
            </span>
            {/* The adjacent 🌍 IconChip is gone (founder round 5, item 5) — the selector's own
                flags carry the affordance. */}
            <VsGeoSelector value={geo} onChange={onGeoChange} />
          </div>
          {/* 'Which AI firm are you using' (founder batch 2026-09-30, item 7) — its own row.
              The pick pins the displayed assistant on the AI-conversation steps (the judged top
              stays visible as recommended · judged; no judged number moves), names it in the
              state panel, and rides the ?run= permalink. Annotation only — changing it never
              resets the run. */}
          {assistants.length > 0 && (
            <>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 sm:text-right">
                <IconChip icon={ROW_ICONS.using.icon} title={ROW_ICONS.using.title} className="mr-1" />
                I&apos;m using
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <VsAssistantSelect assistants={assistants} value={assistant} onChange={setAssistant} />
              </div>
            </>
          )}
          {/* The starting decisions as compact dropdowns (founder addendum 2026-09-29) — the
              house listbox pattern, each with a 'Not set' initial state that composes the
              default branch and stays out of the URL. Canonical accessible names throughout.
              The row label is 'Choices' (founder batch 2026-10-02, item 2 — with the tabs gone
              and the 'Set vendors' disclosure directly below, the grid needs a visual anchor;
              the retired 'Decisions' label does not return). Text-only, no icon: each decision
              dropdown already carries its own icon chip. Each choice still only swaps,
              reorders, adds, or skips corpus processes. */}
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 sm:text-right">Choices</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          {/* 'Start with' is gone from the panel (round 5, item 4 — VISIBLE_DECISIONS); the
              Entity roster follows the geo pick (round 5, item 1 — country-filtered options,
              full codec roster intact underneath); Funding is the SINGLE combined selector
              (addendum 2026-09-30): plain options assert the decision, scenario options run the
              one-tap applyScenario path. */}
          {VISIBLE_DECISIONS.map((d) =>
            d.id === 'funding' ? (
              <VsDecisionSelect
                key={d.id}
                decision={FUNDING_COMBINED}
                shortTitle={DECISION_SHORT.funding.title}
                shortOptions={FUNDING_SHORT}
                icon={DECISION_ICONS.funding}
                value={scenario !== null ? `${FUNDING_SCENARIO_PREFIX}${scenario}` : asserted.funding}
                onSelect={pickFunding}
              />
            ) : (
              <VsDecisionSelect
                key={d.id}
                decision={d}
                shortTitle={DECISION_SHORT[d.id].title}
                shortOptions={DECISION_SHORT[d.id].options}
                icon={DECISION_ICONS[d.id]}
                value={asserted[d.id]}
                // The geo-filtered entity roster and the display-hidden values (compliance
                // 'None') both flow through offeredValues; asserted off-roster values (old
                // links') still resolve against the full DECISIONS options.
                visibleValues={offeredValues(d)}
                onSelect={(value) => pickChoice(d.id, value)}
              />
            ),
          )}
          </div>
          {/* The decisions info line is GONE (founder batch 2026-10-02, item 1): the
              swaps/reorders/adds/skips receipts live on in the terminal's phase notes and the
              semi-auto decision cards — no standing prose under the grid. */}
        </div>

        {/* The 'Set vendors' disclosure (founder batch 2026-10-02, item 2 — renamed from the
            'Vendors' tab): the SimRolePicker grid over the journey's swappable market roles,
            unchanged — the reader FIXES a vendor per role and the pick drives the outcome model
            above (recommended steps keep the judged ranking; the clock, scorecard, and burn
            follow the pick). House <details> idiom (the StepVerifyCost/ProcessDag summary
            pattern), default COLLAPSED and visually muted ('unset') until opened; React controls
            the open state so the override count and tests stay deterministic. The embedded
            dry-run transcript stays gone from this page — the terminal above IS the transcript. */}
        <details
          data-testid="vs-set-vendors"
          open={vendorsOpen}
          className="group mt-2.5 border-t border-zinc-800/70 pt-2"
        >
          <summary
            data-testid="vs-set-vendors-summary"
            onClick={(e) => {
              e.preventDefault() // React owns the open state — no native double-toggle
              setVendorsOpen((v) => !v)
            }}
            title="Fix a vendor per market role — optional; collapsed, the run uses the judged defaults plus any picks you already made"
            className="flex cursor-pointer list-none flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 group-open:text-zinc-300 [&::-webkit-details-marker]:hidden"
          >
            <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">▶</span>
            Set vendors
            {vendorOverrides > 0 && (
              <span className="text-[10px] text-zinc-400">· {vendorOverrides}</span>
            )}
          </summary>
          <div className="mt-2">
          <p className="text-[11px] leading-snug text-zinc-400">
            Fix a vendor per market role, before, during, or after the run — the picks drive the
            run&apos;s clock, scorecard, and burn (recommended lines keep the judged ranking).
            Swapping mid-run (stopped, paused, or live) never rewrites what already printed —
            only the rest of the run picks up the new vendor — and your picks persist across
            restarts, so you can pick your favorites and rerun. Roles follow the selected
            journey; each process page keeps its full dry-run transcript.
          </p>
          {/* Ordering toggle (founder round 5, item 7): 'Likely choice' — the committed
              adoption/popularity signal — leads the pickers; 'Judged' is the arena's
              agent-readiness ladder. Both orderings are committed data; the judged default
              keeps its '(recommended · judged)' label either way. */}
          {journeyRoles.length > 0 && (
            <div role="group" aria-label="Vendor ordering" className="mt-2 flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">Order:</span>
              <button
                type="button"
                data-testid="vs-vendor-order-likely"
                aria-pressed={vendorOrdering === 'likely'}
                onClick={() => setVendorOrdering('likely')}
                title="Likely choice — the committed adoption/popularity signal (curated clearly-popular set, GitHub stars, weekly installs) orders each picker's list; judged scores never move"
                className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                  vendorOrdering === 'likely'
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                Likely choice
              </button>
              <button
                type="button"
                data-testid="vs-vendor-order-judged"
                aria-pressed={vendorOrdering === 'judged'}
                onClick={() => setVendorOrdering('judged')}
                title="Judged — the ranking's agent-readiness ladder, exactly as the rankings pages order it"
                className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                  vendorOrdering === 'judged'
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                Judged
              </button>
            </div>
          )}
          {journeyRoles.length > 0 ? (
            <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {journeyRoles.map((role) => (
                <SimRolePicker
                  key={role.arenaId}
                  role={role}
                  selectedId={picks[role.arenaId] ?? role.defaultProductId}
                  onSelect={(id) => pickVendor(role.arenaId, id)}
                  displayOrder={vendorOrdering === 'likely' ? popularity[role.arenaId]?.order : undefined}
                  signals={popularity[role.arenaId]?.signals}
                  recommendedId={role.defaultProductId}
                />
              ))}
            </div>
          ) : (
            <p data-testid="vs-vendors-empty" className="mt-2 text-[11px] text-zinc-400">
              no swappable market roles in this journey
            </p>
          )}
          </div>
        </details>

        {/* Footer bar: the drive-mode control + the Run CTA (founder 2026-09-25: CTA before any
            timeline content; addendum 2026-09-29: the company name is NOT shown upfront — it
            comes into existence at the run's naming step, so no pre-run company line). */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-zinc-800/70 pt-2.5 text-xs">
          {/* Drive mode (founder addendum 2026-09-29): Auto plays the whole journey from the
              asserted setup; Semi-auto pauses at each unasserted decision's first affected row
              and asks inline in the terminal. */}
          <div role="group" aria-label="Drive mode" className="ml-auto flex items-center gap-1">
            <button
              type="button"
              data-testid="vs-mode-auto"
              aria-pressed={mode === 'auto'}
              onClick={() => setDriveMode('auto')}
              title="Auto — assert the decisions upfront (or leave defaults) and the whole journey plays through"
              className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs transition ${
                mode === 'auto'
                  ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              data-testid="vs-mode-semi"
              aria-pressed={mode === 'semi'}
              onClick={() => setDriveMode('semi')}
              title="Semi-auto — you make each 'Not set' decision as the run reaches it: the run pauses and asks in the card above the terminal; decisions whose branch point already passed stay on their default"
              className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs transition ${
                mode === 'semi'
                  ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              Semi-auto
            </button>
          </div>
          {/* Founder 2026-09-29: mode pills sit right beside the button (no 'Drive' word), and
              a running sim can be STOPPED — the primary button flips to Stop while running. */}
          <button
            type="button"
            onClick={() => (running ? stop() : start())}
            className={`rounded-full px-6 py-2 font-display text-base font-semibold tracking-tight transition ${
              running
                ? 'border border-red-400/60 bg-red-400/10 text-red-300 hover:bg-red-400/20'
                : 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400'
            }`}
          >
            {running ? '⏹ Stop' : done ? '▶ Run it again' : '▶ Run this startup'}
          </button>
        </div>
        {/* The YC calibration explainer paragraph is GONE (founder batch 2026-10-02, item 3):
            the batch-calendar/Demo-Day receipts live on in the relocated raise phase's note; the
            non-affiliation honesty survives as the muted suffix beside the YC pills above. */}
        {/* No amber assumption lines in the band (founder round 3, item 2): the axis pills'
            tooltips carry the named simulation assumptions; the outcome surfaces (sim badges,
            scorecard) still disclose them per-line where they apply. */}

        {/* The 'full setup guide' expander is GONE (founder round 4, item 1): the tooltips ARE
            the explanation surface — every honesty line it carried lives on a control's title=:
            the hardware/biotech corpus disclosures on the preset pills' amber ⓘ, the axis
            simulation assumptions on the persona pills, and every decision's corpus mapping on
            its dropdown options. */}
      </section>

      {/* The journey DAG (founder ask 2026-09-29; round 5 "use vertical space more"): a WRAPPING
          flow of the run — one fixed-size node per process, chain-tinted label chips marking the
          phases — sitting ON TOP of the terminal output as its own full-width band (the
          VsStateGraph tabs keep their place below/beside the terminal untouched). It grows
          vertically with the reveal (capped, then scrolls itself) and lights up node by node off
          the same rows/revealed state as everything else. */}
      <VsJourneyDag
        rows={rows}
        revealed={revealed}
        running={running}
        waitingOn={waitingOn}
        pauses={dagPauses}
        eventTitles={dagEventTitles}
        onNodeClick={scrollTermToTask}
      />

      {/* ── The semi-auto pause slot (founder addendum #1, 2026-09-29): when the run is waiting
          on the reader, the decision/naming card renders HERE — a fixed slot between the DAG
          band and the terminal, always in view — instead of down at the bottom of the scrolled
          terminal output (which keeps only a compact '⏸ waiting on you' marker). Same component
          visuals, same testids, same resume/permalink semantics; the pause still landed BEFORE
          the first row the answer could change, so printed lines never move. */}
      {waitingDecision && (
        <div
          data-testid="vs-run-decision"
          className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-[13px]"
        >
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">? decision</span>
            <span className="font-medium text-zinc-200">{waitingDecision.title}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Decision: ${waitingDecision.title}`}>
            {waitingDecision.options
              .filter((o) => offeredValues(waitingDecision).includes(o.value))
              .map((o) => (
              <button
                key={o.value}
                type="button"
                data-testid={`vs-run-decision-${waitingDecision.id}-${o.value}`}
                aria-label={o.label}
                title={`${o.label} — ${o.detail}`}
                onClick={() => decideInRun(waitingDecision.id, o.value)}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {waitingOn === 'name' && (
        <div
          data-testid="vs-run-naming"
          className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-[13px]"
        >
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">? decision</span>
            <span className="font-medium text-zinc-200">Name the company</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              data-testid="vs-run-naming-input"
              aria-label="Company name"
              value={nameDraft}
              maxLength={VS_COMPANY_NAME_MAX}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') nameInRun(nameDraft)
              }}
              placeholder="type a name…"
              className="w-44 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none"
            />
            <button
              type="button"
              data-testid="vs-run-naming-use"
              onClick={() => nameInRun(nameDraft)}
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
            >
              Use this name
            </button>
            <button
              type="button"
              data-testid="vs-run-naming-skip"
              onClick={() => nameInRun(null)}
              title="Let the autopilot name it — the seeded synthetic name prints as the naming step's artifact"
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              Autopilot name
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            the typed name flows into every downstream artifact and the terminal title
            (sanitized), and rides in the run link — empty means the autopilot names it
          </p>
        </div>
      )}

      {/* The state graph + the terminal (founder batch 2026-09-29, item 3): the compact tabbed
          panel of objects-coming-into-existence sits ABOVE the terminal on mobile (capped
          scroll box, terminal stays dominant) and BESIDE it — a narrow left column — from lg
          up. Both render off the same revealed-row state; nothing here has its own timer. */}
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:items-start lg:gap-3 lg:space-y-0">
      <VsStateGraph
        started={revealed > 0}
        artifacts={panel.artifacts}
        vendors={panel.vendors}
        decisions={panelDecisions}
        events={panel.events}
        umCli={panel.umCli}
        documents={panel.documents}
      />

      {/* The terminal — the page's visual centerpiece (founder ask 2026-09-28: "have the
          terminal at the top so it prints the timeline in that terminal up top"). The run
          prints INSIDE this fixed-height viewport with terminal-follow autoscroll, so the page
          itself never grows mid-run; the chrome matches the site's terminal precedent
          (components/TryIt/Microterminal.tsx: dark window, dots, title bar, mono body). */}
      <section
        data-testid="vs-terminal"
        aria-label="Virtual run terminal"
        className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </span>
          <code className="min-w-0 truncate font-mono text-xs text-zinc-300">
            <span className="mr-1.5 select-none text-emerald-400">$</span>
            {termName}
          </code>
          {/* Founder 2026-09-29 terminal declutter: no 'virtual run' suffix, no title-bar chip,
              no 'idle', no completion label — the status only speaks while the run needs it
              ('running…'; semi-auto waits show nothing, the pinned card IS the signal). The
              title-bar pause button and its 'paused' status are GONE (founder batch 2026-09-30,
              item 2: the primary ⏹ Stop suffices; semi-auto's decision pauses stay). */}
          <span data-testid="vs-terminal-status" className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            {running ? 'running…' : ''}
          </span>
        </div>

        <div
          ref={termRef}
          onScroll={onTermScroll}
          data-testid="vs-terminal-body"
          className="h-[50vh] overflow-y-auto overscroll-contain px-3 py-2.5 font-mono text-xs leading-relaxed sm:h-[60vh]"
        >
          {revealed === 0 && (
            <p className="text-zinc-500">
              <span aria-hidden className="select-none text-emerald-400">$</span>
            </p>
          )}
          <ol className="space-y-1.5">
            {rows.slice(0, revealed).map((row) => {
              if (row.kind === 'phase') {
                return (
                  <li key={row.key} className="pt-4 first:pt-0">
                    <p className="border-b border-zinc-800 pb-1 text-sm font-semibold tracking-tight text-zinc-200">
                      {row.title}
                      {/* A chainless phase (the office lease — a single corpus process, not a
                          curated chain) honestly renders no playbook link. */}
                      {row.chainId !== '' && (
                        <Link
                          href={`/processes/chains/${row.chainId}`}
                          className="ml-2 text-[11px] font-normal text-zinc-400 hover:text-emerald-300"
                        >
                          from the {row.chainName} playbook →
                        </Link>
                      )}
                    </p>
                    {row.note && <p className="mt-0.5 text-[11px] text-zinc-400">{row.note}</p>}
                  </li>
                )
              }
              if (row.kind === 'task') {
                // In-sim GEO (2026-09-29): under a non-US selection, a US-scoped process prints
                // its committed country analog (processes/corpus.json geoNotes — summary +
                // verified actionUrl, the ProcessGeoBanner data) or the honest "no mapping yet".
                // A flavored GLOBAL process (mapping expansion 2026-09-29) prints its note only
                // when one exists for the country — no "US-specific" line for global work.
                // Annotation only, and never for 🌐 Global / the US default (geoCountry null).
                const geoCountryNote =
                  geoCountry !== null ? (row.task.geoNotes ?? []).find((n) => n.country === geoCountry) ?? null : null
                // Country-aware entity framing (founder round 5, item 1): a non-US entity prints
                // the incorporation process's COMMITTED country analog on its row (the corpus
                // composition stays the US-shaped C-Corp path — this line is the honest frame).
                const entityMeta = ENTITY_META[choices.entity]
                const entityAnalog =
                  row.task.id === 'form_001' && entityMeta.country !== 'US'
                    ? {
                        meta: GEO_PREF_META[entityMeta.country],
                        note: (row.task.geoNotes ?? []).find((n) => n.country === entityMeta.country) ?? null,
                      }
                    : null
                const geoNote =
                  geoCountry !== null &&
                  (usScoped(row.task.id) || geoCountryNote !== null) &&
                  // The entity analog already frames this row for the same country — one line, not two.
                  !(entityAnalog !== null && geoCountry === entityMeta.country)
                    ? { meta: GEO_PREF_META[geoCountry], note: geoCountryNote }
                    : null
                return (
                  // data-vs-row: the journey DAG strip's click-to-scroll target (scrollTermToTask).
                  <li key={row.key} data-vs-row={row.key} className="pt-2">
                    <Link
                      href={`/processes/${row.task.slug}`}
                      className="text-[13px] font-medium text-zinc-300 hover:text-emerald-300"
                    >
                      {row.task.title}
                    </Link>
                    {geoNote &&
                      (geoNote.note ? (
                        <p data-testid="vs-geo-analog" className="mt-0.5 pl-2 text-[11px] leading-snug text-zinc-400">
                          <span aria-hidden className="mr-1">{geoNote.meta.flag}</span>
                          in {geoNote.meta.prose} this is: <span className="text-zinc-400">{geoNote.note.summary}</span>{' '}
                          <a
                            href={geoNote.note.actionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400/90 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
                            title={`${geoNote.meta.label} — the canonical portal for this work (verified live)`}
                          >
                            {geoNote.note.actionLabel} ↗
                          </a>
                        </p>
                      ) : (
                        <p data-testid="vs-geo-analog-missing" className="mt-0.5 pl-2 text-[11px] leading-snug text-zinc-400">
                          <span aria-hidden className="mr-1">🇺🇸</span>
                          no {geoNote.meta.label} mapping yet — this process is US-specific
                        </p>
                      ))}
                    {/* The non-US entity's country frame (round 5, item 1): committed analog or
                        the honest absence — the corpus steps below stay the US C-Corp path. */}
                    {entityAnalog &&
                      (entityAnalog.note ? (
                        <p data-testid="vs-entity-analog" className="mt-0.5 pl-2 text-[11px] leading-snug text-zinc-400">
                          <span aria-hidden className="mr-1">{entityAnalog.meta.flag}</span>
                          {entityMeta.label} — in {entityAnalog.meta.prose} this is:{' '}
                          <span className="text-zinc-400">{entityAnalog.note.summary}</span>{' '}
                          <a
                            href={entityAnalog.note.actionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400/90 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
                            title={`${entityAnalog.meta.label} — the canonical portal for this work (verified live)`}
                          >
                            {entityAnalog.note.actionLabel} ↗
                          </a>{' '}
                          <span className="text-zinc-500">· the steps below are the US-shaped corpus playbook</span>
                        </p>
                      ) : (
                        <p data-testid="vs-entity-analog-missing" className="mt-0.5 pl-2 text-[11px] leading-snug text-zinc-400">
                          <span aria-hidden className="mr-1">🇺🇸</span>
                          {entityMeta.label} — no {entityAnalog.meta.label} analog committed yet; the steps below are the US-shaped corpus playbook
                        </p>
                      ))}
                    {/* Ultrametric CLI/MCP affordance (founder ask 2026-09-30) — OWNER PRODUCT,
                        honesty-first: renders ONLY for the curated lib/ultrametricCli.ts map
                        (live production catalog, verified 2026-09-30), sits on the process row
                        (the CLI drives whole processes, not individual steps), never touches the
                        judged step pills, and carries the visible first-party disclosure. "Drive"
                        = the CLI/MCP serves the guide and saves records; the agent does the work. */}
                    {(() => {
                      const um = ultrametricCliFor(row.task.id)
                      return (
                        um && (
                          <p
                            data-testid="vs-um-cli"
                            title={ULTRAMETRIC_CLI_DISCLOSURE}
                            className="mt-0.5 pl-2 text-[11px] leading-snug text-zinc-400"
                          >
                            <span aria-hidden className="mr-1 text-emerald-400/80">▸</span>
                            drive this process from your agent via the{' '}
                            <Link
                              href="/get-started"
                              className="text-emerald-400/90 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
                            >
                              Ultrametric CLI/MCP
                            </Link>{' '}
                            — our own product: <code className="text-zinc-400">{um.command}</code>{' '}
                            {/* Copyable shipped command (founder batch 2026-10-02, item 5) —
                                display-only convenience on the already-disclosed first-party line. */}
                            <VsCopyCommand command={um.command} />
                            <span className="text-zinc-500"> · MCP {um.mcpTool} — guide + saved records; your agent does the work</span>
                          </p>
                        )
                      )
                    })()}
                  </li>
                )
              }
              if (row.kind === 'day') {
                return (
                  <li key={row.key} aria-hidden className="pl-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    — day {row.day} —
                  </li>
                )
              }
              if (row.kind === 'step') {
                const badge = routeBadge(row.step)
                // In-sim GEO (2026-09-29): under a non-US selection, steps of US-scoped
                // processes carry the quiet 🇺🇸 mark (the components/GeoStepMark.tsx language),
                // and a top judged pick whose committed jurisdictions/vendor-geo.json cell says
                // 'unavailable' there prints its honest warning — recorded note verbatim, source
                // linked, scores and ranks untouched.
                const stepUsScoped = geoCountry !== null && usScoped(row.step.taskId)
                const geoCell =
                  geoCountry !== null && row.top ? vendorGeo[row.top.productId]?.[geoCountry] ?? null : null
                const geoWarn = geoCell?.status === 'unavailable' ? geoCell : null
                // The assistant pin (item 7, 2026-09-30): only on AI-conversation steps — the
                // steps whose judged top was ranked in the ai-assistants arena. Display only:
                // the pinned chip is clearly labeled 'your assistant' while the judged top keeps
                // its chip, score, and '(recommended · judged)' label untouched.
                const aiPinned = assistantPick && row.top?.arenaId === VS_AI_FIRM_ARENA ? assistantPick : null
                return (
                  <li key={row.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-4 text-sm text-zinc-400">
                    <span className={`rounded border px-1.5 py-px text-[10px] ${badge.cls}`}>{badge.text}</span>
                    {/* The step label deep-links its canonical block on the process page —
                        /processes/{slug}#step-{taskId}-{nodeId}, the pinned anchor contract
                        (founder 2026-10-07, item 2). Honest degrade: no node id, no link. */}
                    {row.anchor ? (
                      <Link
                        data-testid="vs-step-link"
                        href={row.anchor}
                        title={`${row.step.label} — open this step on the ${row.step.taskTitle} process page`}
                        className="text-zinc-300 hover:text-emerald-300"
                      >
                        {row.step.label}
                      </Link>
                    ) : (
                      <span className="text-zinc-300">{row.step.label}</span>
                    )}
                    {stepUsScoped && geoCountry !== null && (
                      <span
                        aria-hidden
                        data-testid="vs-geo-step-mark"
                        className="text-[10px] opacity-60"
                        title={`US-specific step — this flow is written around US law/agencies; you are viewing the run from ${GEO_PREF_META[geoCountry].prose}`}
                      >
                        🇺🇸
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-zinc-500">
                      {formatMinutes(row.step.estimatedMinutes)}
                      {row.step.async ? ' ⏳' : ''}
                    </span>
                    {/* v3: the outcome model changed this step's simulated clock — say so, with
                        the named rule (always a disclosed simulation assumption) in the title. */}
                    {row.outNote && (
                      <span
                        data-testid="vs-step-outnote"
                        title={row.outNote}
                        className="rounded border border-amber-400/40 px-1 py-px font-mono text-[10px] text-amber-300/90"
                      >
                        sim {formatMinutes(row.outMinutes)}
                      </span>
                    )}
                    {row.step.approvalRequired && (
                      <span className="text-[11px] text-amber-300/90" title="A human signs off before this runs">⏸ approval</span>
                    )}
                    {row.top && (
                      <>
                        {/* 'I'm using' pin (item 7): the chosen assistant leads as the displayed
                            pick on this AI-conversation step — name + link only, never a score
                            we didn't judge for it here. */}
                        {aiPinned && aiPinned.id !== row.top.productId && (
                          <>
                            <Link
                              data-testid="vs-step-assistant"
                              href={`/arena/${VS_AI_FIRM_ARENA}/product/${aiPinned.id}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 px-2 py-0.5 text-[11px] leading-none text-emerald-300 hover:border-emerald-400 hover:text-emerald-200"
                            >
                              <ProductLogoView
                                product={{ id: aiPinned.id, name: aiPinned.name }}
                                size={14}
                                hasLogo={aiPinned.hasLogo}
                              />
                              {aiPinned.name}
                            </Link>
                            <span data-testid="vs-step-assistant-label" className="text-[10px] text-emerald-300/80">
                              (your assistant)
                            </span>
                          </>
                        )}
                        {/* The recommended (top judged) pick, logo inline (founder batch
                            2026-09-29, item 1: ProductLogoView ~14px, hasLogo serialized per
                            pick — mono aesthetic kept, fixed size so nothing jumps). */}
                        <Link
                          href={`/arena/${row.top.arenaId}/product/${row.top.productId}`}
                          title={`Top judged vendor for this step — ${row.top.arenaName}, scored over the step's mapped stories`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] leading-none text-zinc-300 hover:border-emerald-400/60 hover:text-emerald-300"
                        >
                          <ProductLogoView
                            product={{ id: row.top.productId, name: row.top.name }}
                            size={14}
                            hasLogo={row.top.hasLogo === true}
                          />
                          {row.top.name} · {row.top.score.toFixed(0)}<span className="text-zinc-500">/100</span>
                        </Link>
                        <span className="text-[10px] text-zinc-400">(recommended · judged)</span>
                        {/* The judged top IS the chosen assistant — one chip, both labels. */}
                        {aiPinned && aiPinned.id === row.top.productId && (
                          <span data-testid="vs-step-assistant-label" className="text-[10px] text-emerald-300/80">
                            · your assistant
                          </span>
                        )}
                        {/* The step ranking's runners-up + the arena behind the choice — the
                            fragment now LEADS with the likely-choice (adoption/popularity)
                            ordering (founder round 5, item 7); every score stays judged. */}
                        <span
                          data-testid="vs-step-runnersup"
                          title="Runners-up ordered by the committed adoption/popularity signal (likely choice); the scores are the judged step ranking's — nothing re-ranked"
                          className="text-[10px] text-zinc-500"
                        >
                          {(row.top.runnersUp ?? []).length > 0 && (
                            <>
                              {'likely '}
                              {(row.top.runnersUp ?? []).map((r, i) => (
                                <span key={r.productId}>
                                  {i > 0 && ', '}
                                  <Link
                                    href={`/arena/${row.top!.arenaId}/product/${r.productId}`}
                                    className="hover:text-emerald-300"
                                  >
                                    {r.name} · {r.score.toFixed(0)}/100
                                  </Link>
                                </span>
                              ))}
                              {' — '}
                            </>
                          )}
                          <Link
                            href={`/arena/${row.top.arenaId}`}
                            title={`${row.top.arenaName} — the judged ranking behind this pick`}
                            className="hover:text-emerald-300"
                          >
                            ranking →
                          </Link>
                        </span>
                      </>
                    )}
                    {geoWarn && row.top && geoCountry !== null && (
                      <span data-testid="vs-geo-vendor-warning" className="w-full pl-1 text-[11px] leading-snug text-amber-300/90">
                        <span aria-hidden className="mr-1">⚠</span>
                        {row.top.name} — unavailable in {GEO_PREF_META[geoCountry].prose}: {geoWarn.note}{' '}
                        <a
                          href={geoWarn.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-300/70 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-200"
                          title="The vendor's own page this availability row rests on (verified live)"
                        >
                          source ↗
                        </a>
                      </span>
                    )}
                  </li>
                )
              }
              if (row.kind === 'vsevent') {
                // v3: a seeded mid-run event interrupts the terminal flow — data-synthetic,
                // grounded in a real corpus process, with deterministic branching choices.
                const resolved = resolvedEventById.get(row.eventId)
                if (!resolved) return null
                const grounded = tasks[resolved.def.groundedIn]
                return (
                  <li key={row.key}>
                    <VsEventCard
                      event={resolved}
                      groundedTitle={grounded?.title ?? resolved.def.groundedIn}
                      groundedSlug={grounded?.slug ?? ''}
                      risk={taskRisks[resolved.def.groundedIn] ?? 0}
                      onChoose={chooseEventBranch}
                    />
                  </li>
                )
              }
              return (
                // A generated artifact — the fuchsia styling IS the visual marker and the
                // structural data-synthetic attribute IS the honesty invariant (founder
                // 2026-09-29: no visible 'simulated' label; tests assert the attribute per node).
                <li
                  key={row.key}
                  data-testid="vs-artifact"
                  data-synthetic="true"
                  className="ml-8 flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/5 px-2.5 py-1 text-[13px]"
                >
                  <span className="text-fuchsia-300/90">{row.artifact.label}:</span>
                  <span className="font-mono text-xs text-zinc-200">{row.artifact.value}</span>
                </li>
              )
            })}
          </ol>
          {/* ── Semi-auto pause marker (founder addendum #1, 2026-09-29: "surface the decision
              at the TOP"): the full card renders in the fixed slot ABOVE the terminal (between
              the DAG band and this viewport) so the reader never scrolls to decide; the inline
              position in the flow keeps only this compact one-liner. */}
          {waitingOn !== null && (
            <p data-testid="vs-run-wait-marker" className="my-1 font-mono text-[11px] text-amber-300/90">
              ⏸ waiting on you — decide above
            </p>
          )}
          {running && <span aria-hidden className="animate-pulse text-emerald-400">▋</span>}
          {/* The completion summary prints as the terminal's final output — the page below the
              terminal only ever grows AFTER the run completes (the rhythm section under it). */}
          {revealed > 0 && done && (
            <div className="mt-4 border-t border-zinc-800 pt-3 text-[13px] text-zinc-300">
              <p>
                ✓ journey complete — {stats.totalSteps} steps: {stats.agentSteps} agent-runnable,{' '}
                {stats.formSteps} manual form{stats.formSteps === 1 ? '' : 's'}, {stats.personSteps} human
                {stats.legalSignatures > 0 && <> (incl. {stats.legalSignatures} legal signature{stats.legalSignatures === 1 ? '' : 's'})</>},{' '}
                {stats.approvals} approval gate{stats.approvals === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Corpus time estimate: {formatMinutes(stats.totalMinutes)} (~{dayOf(stats.totalMinutes)} sim days,
                incl. {stats.asyncSteps} async wait{stats.asyncSteps === 1 ? '' : 's'}) — from each step&apos;s recorded
                estimate, not invented.
              </p>
            </div>
          )}
          {/* ── v3: the run scorecard prints as the terminal's final output block (time-to-launch,
              agent-run share, cited published-pricing burn, events survived, copy-run-link). */}
          {revealed > 0 && done && (
            <VsScorecard
              outcome={finalOutcome}
              optimal={optimalOutcome}
              resolution={eventResolution}
              burn={burn}
              founder={founder}
              runState={runState}
              userPickedArenas={userPickedArenas}
            />
          )}
          {/* Pick-your-vendors-and-rerun loop (founder addendum #3, 2026-09-29): when any pick
              differs from the default judged-top, say so and make the loop one click — the
              button IS a plain restart (picks persist across '▶ Run it again' by design). */}
          {revealed > 0 && done && vendorOverrides > 0 && (
            <p data-testid="vs-rerun-vendors" className="mt-2 text-[11px] text-zinc-400">
              {vendorOverrides} vendor role{vendorOverrides === 1 ? '' : 's'} on your own picks —
              they persist across restarts.{' '}
              <button
                type="button"
                data-testid="vs-rerun-vendors-btn"
                onClick={start}
                className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
              >
                ▶ run again with your vendors
              </button>
            </p>
          )}
        </div>

      </section>
      </div>
      </div>

      {/* The operating rhythm the company now runs, once the launch journey lands — first 30
          days, first 90 days, and year one. */}
      {done && (
        <section className="rounded-2xl border border-zinc-800 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">The operating rhythm</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Rhythm window">
            {RHYTHM_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={win === t.id}
                onClick={() => setWin(t.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  win === t.id
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {win === 'year' ? (
            <>
              <p className="mt-3 text-sm text-zinc-400">
                Derived from each process&apos;s corpus cadence — the same axis as the{' '}
                <Link href="/processes/operating-rhythm" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
                  operating rhythm
                </Link>
                . Monthly and quarterly slots are cadence math; the tax dates are the corpus&apos;s own; fuchsia
                slots are seeded demo scheduling, not corpus dates.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className={TABLE_HEADER_ROW}>
                      <th scope="col" className="py-2 pr-3 font-normal">Process</th>
                      <th scope="col" className="py-2 pr-3 font-normal">Cadence</th>
                      <th scope="col" className="py-2 pr-3 font-normal">
                        <span className="flex gap-1" aria-label="January through December">
                          {MONTH_LABELS.map((m) => (
                            <span key={m} title={m} className="w-2 text-center">{m[0]}</span>
                          ))}
                        </span>
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-normal"><span title="Runs per year">Runs/yr</span></th>
                      <th scope="col" className="py-2 pr-3 font-normal">Route mix</th>
                      <th scope="col" className="py-2 font-normal">Agentic %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {yc && (
                      <tr data-testid="vs-yc-oh-row" data-synthetic="true" className="align-top">
                        <td className="max-w-[260px] py-2 pr-3">
                          <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-fuchsia-300/90">
                            {YC_BATCH.officeHours.title}
                          </span>
                          <p className="mt-0.5 text-[10px] text-zinc-400">
                            synthetic YC-mode row — not a corpus process; excluded from the totals below
                          </p>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-400">{YC_BATCH.officeHours.cadenceLabel}</td>
                        <td className="py-2 pr-3">
                          <span className="flex gap-1">
                            {MONTH_LABELS.map((label, i) => (
                              <span
                                key={label}
                                title={`${label}${YC_BATCH.officeHours.months.includes(i + 1) ? ' — batch month' : ''}`}
                                className={`h-2 w-2 rounded-full ${
                                  YC_BATCH.officeHours.months.includes(i + 1) ? 'bg-fuchsia-400/80' : 'bg-zinc-800'
                                }`}
                              />
                            ))}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs tabular-nums text-zinc-400">
                          ×{YC_BATCH.officeHours.runsPerBatch}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-500">—</td>
                        <td className="py-2 text-xs text-zinc-500">—</td>
                      </tr>
                    )}
                    {(() => {
                      const nodes: ReactNode[] = []
                      let lastCadence: string | null = null
                      for (const row of year.rhythm) {
                        if (row.cadenceLabel !== lastCadence) {
                          lastCadence = row.cadenceLabel
                          nodes.push(
                            <tr key={`group-${row.cadenceLabel}`} data-testid="vs-cadence-group" className="bg-zinc-900/40">
                              <th colSpan={6} scope="colgroup" className="py-1.5 pr-3 text-left text-xs font-normal tracking-wide text-zinc-400">
                                {row.cadenceLabel}
                              </th>
                            </tr>,
                          )
                        }
                        nodes.push(<YearRhythmRow key={row.taskId} row={row} />)
                      }
                      return nodes
                    })()}
                  </tbody>
                </table>
              </div>
              <p data-testid="vs-year-summary" className="mt-4 border-t border-zinc-800 pt-3 text-sm text-zinc-300">
                Your virtual company&apos;s year: <span className="font-mono tabular-nums">{year.stats.totalRuns}</span> recurring
                runs · <span className="font-mono tabular-nums">{year.stats.stepRuns}</span> step-executions,{' '}
                <span className="font-mono tabular-nums text-emerald-300">{year.stats.agentStepRuns}</span> of them
                agent-runnable ({year.stats.stepRuns > 0 ? Math.round((year.stats.agentStepRuns / year.stats.stepRuns) * 100) : 0}%).
              </p>
            </>
          ) : (
            (() => {
              const windowDays = win === 'd30' ? 30 : 90
              const wrows = win === 'd30' ? windows.d30 : windows.d90
              const journeyEndDay = dayOf(stats.totalMinutes)
              return (
                <>
                  <p className="mt-3 text-sm text-zinc-400">
                    The launch journey itself spans day 1–{journeyEndDay} (corpus step estimates
                    {journeyEndDay > windowDays ? ' — it overruns this window' : ''}). Recurring first
                    runs below are cadence math (a month ≈ day 30, a quarter ≈ day 90) — no invented dates.
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className={TABLE_HEADER_ROW}>
                          <th scope="col" className="py-2 pr-3 font-normal">Process</th>
                          <th scope="col" className="py-2 pr-3 font-normal">Cadence</th>
                          <th scope="col" className="py-2 pr-3 text-right font-normal">First run</th>
                          <th scope="col" className="py-2 pr-3 text-right font-normal">Runs in window</th>
                          <th scope="col" className="py-2 pr-3 font-normal">Route mix</th>
                          <th scope="col" className="py-2 font-normal">Agentic %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {yc && (
                          <tr data-testid="vs-yc-oh-window-row" data-synthetic="true" className="align-top">
                            <td className="max-w-[260px] py-2 pr-3">
                              <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-fuchsia-300/90">
                                {YC_BATCH.officeHours.title}
                              </span>
                              <p className="mt-0.5 text-[10px] text-zinc-400">synthetic YC-mode row — not a corpus process</p>
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-400">{YC_BATCH.officeHours.cadenceLabel}</td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs tabular-nums text-zinc-400">
                              day {YC_BATCH.officeHours.intervalDays}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs tabular-nums text-zinc-400">
                              ×{Math.min(Math.floor(windowDays / YC_BATCH.officeHours.intervalDays), YC_BATCH.officeHours.runsPerBatch)}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-xs text-zinc-500">—</td>
                            <td className="py-2 text-xs text-zinc-500">—</td>
                          </tr>
                        )}
                        {wrows.map((row) => (
                          <WindowRhythmRow key={row.taskId} row={row} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            })()
          )}

          {/* Event-driven examples — real corpus processes that run when triggered. A trigger is
              not a cron job: no months, no runs/yr, and they never enter the totals. */}
          {events.length > 0 && (
            <div className="mt-5 border-t border-zinc-800 pt-3">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400">
                Event-driven — runs when triggered, not on a calendar
              </h3>
              <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {events.map((e) => (
                  <li key={e.taskId} data-testid="vs-event-row" className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <Link href={`/processes/${e.slug}`} className="font-medium text-zinc-300 hover:text-emerald-300">
                      {e.title}
                    </Link>
                    <span className="text-[11px] text-zinc-400">when {e.trigger}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* The embedded ProcessSimulator section is gone (founder round 3, item 3): the vendor
          role pickers moved into the controller's 'Set vendors' disclosure above, and the dry-run transcript
          was dropped from this page entirely — the terminal IS this page's transcript, and every
          per-process page keeps its own ProcessSimulator. */}
    </div>
  )
}
