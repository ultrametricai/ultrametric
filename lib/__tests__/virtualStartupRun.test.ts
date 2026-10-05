// Virtual Startup v3 run layer (lib/virtualStartupRun.ts + lib/virtualStartupData.ts), checked
// against the LIVE corpus where the founder contract demands it: outcome math under the disclosed
// multipliers, event gating by decisions + corpus risk, permalink round-trips, pricing citation
// presence, and the labeling invariants (every simulation constant names itself a "simulation
// assumption" — judged data and simulation constants never blend silently).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadChains, loadProcesses, processSlug, vendorRoles } from '@/lib/processes'
import { stepRanking } from '@/lib/processRankings'
import type { VendorRole } from '@/lib/processSim'
import {
  allChoiceCombos,
  DECISIONS,
  DEFAULT_CHOICES,
  journeyPhases,
  journeyTaskIds,
  orderByLikelyChoice,
  unionTaskIds,
  VS_CHAIN_IDS,
  type Choices,
  type VirtualTaskPayload,
  type VsChain,
} from '@/lib/virtualStartup'
import { buildVsAccess, buildVsAssistants, buildVsPopularity, buildVsPricing, buildVsTaskRisks } from '@/lib/virtualStartupData'
import {
  computeBurn,
  computeStackOutcome,
  corpusLaunchDay,
  decodeRunState,
  DEFAULT_FOUNDER_AXES,
  drawVsEvents,
  effectiveChoices,
  eligibleVsEvents,
  encodeAssertedCombo,
  decodeAssertedCombo,
  encodeCombo,
  decodeCombo,
  encodeRunState,
  eventSeedKey,
  founderAssumptions,
  founderSeedToken,
  FOUNDER_HOURS_MULTIPLIER,
  hasAgentSurface,
  journeyOutcomeInputs,
  launchPhaseIdOf,
  LEGACY_PERSONA_AXES,
  optimalSelections,
  resolveVsEvents,
  sanitizeVsCompanyName,
  SECOND_TIMER_MULTIPLIER,
  taskMinutesById,
  VS_ASSUMPTIONS,
  VS_COMPANY_NAME_MAX,
  VS_EVENTS,
  VS_EXPERIENCE_OPTIONS,
  VS_TECHNICAL_OPTIONS,
  type OutcomeStepInput,
  type VsAccessMap,
  type VsFounderAxes,
  type VsRunState,
} from '@/lib/virtualStartupRun'

// The four axis combinations (founder batch 2026-09-29, item 4) — technical/first is the
// baseline (no modifier), the other three carry composable modifiers.
const TECH_FIRST: VsFounderAxes = { technical: 'technical', experience: 'first-timer' }
const NONTECH_FIRST: VsFounderAxes = { technical: 'non-technical', experience: 'first-timer' }
const TECH_SECOND: VsFounderAxes = { technical: 'technical', experience: 'second-timer' }
const NONTECH_SECOND: VsFounderAxes = { technical: 'non-technical', experience: 'second-timer' }

const DATA_DIR = path.resolve(__dirname, '../../data')

const chains: VsChain[] = loadChains(DATA_DIR).map(({ id, name, taskIds }) => ({ id, name, taskIds }))
const vsChains = VS_CHAIN_IDS.map((id) => chains.find((c) => c.id === id)!)
const corpus = loadProcesses(DATA_DIR)
const corpusById = new Map(corpus.map((t) => [t.id, t]))
const union = unionTaskIds(vsChains)
const unionTasks = union.map((id) => corpusById.get(id)!)
const liveRoles = vendorRoles(unionTasks, DATA_DIR)
const liveAccess = buildVsAccess(liveRoles, DATA_DIR)
const liveRisks = buildVsTaskRisks(DATA_DIR)

// ---------------------------------------------------------------------------
// Fixtures for the outcome math (pure — no corpus needed to test the rules)
// ---------------------------------------------------------------------------

const role = (arenaId: string, def: string, alts: Array<{ id: string; name: string }>): VendorRole => ({
  arenaId,
  arenaName: arenaId,
  canonicalVendor: def,
  defaultProductId: def,
  defaultProductName: def,
  stepCount: 1,
  alternatives: alts.map((a) => ({ ...a, agentReady: null })),
})

const ROLES: VendorRole[] = [
  role('payments', 'stripe', [{ id: 'stripe', name: 'Stripe' }, { id: 'square', name: 'Square' }]),
]

const ACCESS: VsAccessMap = {
  payments: {
    stripe: { mcp: 'none', cli: 'none' },
    square: { mcp: 'full', cli: 'na' },
  },
}

const input = (key: string, over: Partial<OutcomeStepInput> = {}): OutcomeStepInput => ({
  key,
  taskId: key.split(':')[0],
  phaseId: 'revenue',
  chainId: 'get-paid',
  route: 'agent',
  arenaId: null,
  estimatedMinutes: 10,
  ...over,
})

describe('outcome math — vendor picks change outcomes', () => {
  it('agent step served by a surface-bearing pick runs at agent speed; a surface-less pick falls back to founder-hours', () => {
    const inputs = [input('qs_021:0', { arenaId: 'payments' })]
    const withSurface = computeStackOutcome(inputs, { payments: 'square' }, ROLES, ACCESS, TECH_FIRST)
    expect(withSurface.steps[0]).toMatchObject({ minutes: 10, agentRun: true, note: null })

    const withoutSurface = computeStackOutcome(inputs, { payments: 'stripe' }, ROLES, ACCESS, TECH_FIRST)
    expect(withoutSurface.steps[0].minutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER)
    expect(withoutSurface.steps[0].agentRun).toBe(false)
    // The multiplier is never dressed as judged data.
    expect(withoutSurface.steps[0].note).toContain('simulation assumption')
  })

  it('unserved steps are unchanged: agent steps with no swappable role stay agent-speed, non-agent steps keep corpus minutes', () => {
    const inputs = [
      input('a:0'), // agent, no arena
      input('a:1', { route: 'person' }),
      input('a:2', { route: 'form' }),
    ]
    const o = computeStackOutcome(inputs, {}, ROLES, ACCESS, TECH_FIRST)
    expect(o.steps.map((s) => s.minutes)).toEqual([10, 10, 10])
    expect(o.steps.map((s) => s.agentRun)).toEqual([true, false, false])
    expect(o.agentRunPct).toBe(33)
  })

  it('defaults apply when the reader picked nothing (the role default is the pick)', () => {
    const inputs = [input('qs_021:0', { arenaId: 'payments' })]
    const o = computeStackOutcome(inputs, {}, ROLES, ACCESS, TECH_FIRST)
    // stripe (default) has no surface in this fixture → founder-hours.
    expect(o.steps[0].minutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER)
  })

  it('all-manual baseline and founder-hours saved derive from the same disclosed multiplier', () => {
    const inputs = [input('a:0'), input('a:1', { route: 'person', estimatedMinutes: 20 })]
    const o = computeStackOutcome(inputs, {}, ROLES, ACCESS, TECH_FIRST)
    expect(o.totalMinutes).toBe(30)
    expect(o.allManualMinutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER + 20)
    expect(o.founderHoursSavedMinutes).toBe(o.allManualMinutes - o.totalMinutes)
  })

  it('the launch milestone excludes post-launch phases from the launch clock', () => {
    const inputs = [
      input('a:0', { phaseId: 'website', estimatedMinutes: 1440 }),
      input('a:1', { phaseId: 'launch', estimatedMinutes: 1440 }),
      input('a:2', { phaseId: 'enterprise', estimatedMinutes: 14400 }),
    ]
    const o = computeStackOutcome(inputs, {}, ROLES, ACCESS, TECH_FIRST)
    expect(o.launchMinutes).toBe(2880)
    expect(o.launchDay).toBe(3)
    expect(o.totalMinutes).toBe(2880 + 14400)
    expect(launchPhaseIdOf([{ id: 'website' }, { id: 'launch' }, { id: 'enterprise' }])).toBe('launch')
    expect(launchPhaseIdOf([{ id: 'website' }, { id: 'revenue' }])).toBe('website')
  })

  it('is deterministic: identical inputs replay identical outcomes', () => {
    const inputs = journeyOutcomeInputs(
      journeyPhases(DEFAULT_CHOICES, vsChains),
      Object.fromEntries(union.map((id) => [id, payloadFor(id)])),
    )
    const a = computeStackOutcome(inputs, { payments: 'square' }, liveRoles, liveAccess, TECH_SECOND)
    const b = computeStackOutcome(inputs, { payments: 'square' }, liveRoles, liveAccess, TECH_SECOND)
    expect(a).toEqual(b)
  })
})

describe('personas', () => {
  it('non-technical: engineering-chain steps gain the founder-hours multiplier unless agent-run', () => {
    const eng = input('prod_006:0', { chainId: 'ship-v1', route: 'person' })
    const engAgent = input('prod_006:1', { chainId: 'ship-v1' }) // agent, unserved → agent-run
    const other = input('qs_023:0', { chainId: 'company-launch', route: 'person' })
    const o = computeStackOutcome([eng, engAgent, other], {}, ROLES, ACCESS, NONTECH_FIRST)
    expect(o.steps[0].minutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER)
    expect(o.steps[0].note).toContain('simulation assumption')
    expect(o.steps[1].minutes).toBe(10) // agent-run — the modifier never applies
    expect(o.steps[2].minutes).toBe(10) // not an engineering chain
  })

  it('second-timer: legal/finance steps run faster, agent-run steps untouched', () => {
    const legal = input('legal_002:0', { route: 'person' })
    const founderAgreement = input('startup_002:0', { route: 'person' })
    const nonLegal = input('brand_001:0', { route: 'person' })
    const o = computeStackOutcome([legal, founderAgreement, nonLegal], {}, ROLES, ACCESS, TECH_SECOND)
    expect(o.steps[0].minutes).toBe(10 * SECOND_TIMER_MULTIPLIER)
    expect(o.steps[0].note).toContain('simulation assumption')
    expect(o.steps[1].minutes).toBe(10 * SECOND_TIMER_MULTIPLIER)
    expect(o.steps[2].minutes).toBe(10)
  })

  it('the two axis modifiers COMPOSE: a non-technical second-timer applies both, and a step qualifying for both multiplies both', () => {
    // A run under non-technical + second-timer: engineering steps ×3 AND legal steps ×0.5.
    const eng = input('prod_006:0', { chainId: 'ship-v1', route: 'person' })
    const legal = input('legal_002:0', { route: 'person' })
    const both = input('legal_002:1', { chainId: 'ship-v1', route: 'person' }) // hypothetically both
    const o = computeStackOutcome([eng, legal, both], {}, ROLES, ACCESS, NONTECH_SECOND)
    expect(o.steps[0].minutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER)
    expect(o.steps[1].minutes).toBe(10 * SECOND_TIMER_MULTIPLIER)
    // Both rules on one step: the multipliers stack (×3 × ×0.5), and BOTH name themselves.
    expect(o.steps[2].minutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER * SECOND_TIMER_MULTIPLIER)
    expect(o.steps[2].note).toContain('non-technical founder on an engineering step')
    expect(o.steps[2].note).toContain('repeat entrepreneur on a legal/finance step')
  })

  it('the vendor-fallback founder-hours multiplier applies once — axis modifiers never re-scale it', () => {
    // legal-ish agent step served by a surface-less pick: ×3 from the vendor fallback, and the
    // second-timer axis does not stack on top (identical to the legacy persona behavior, so a
    // migrated v1 run link replays the same clock).
    const legalAgent = input('legal_002:0', { arenaId: 'payments' })
    const o = computeStackOutcome([legalAgent], { payments: 'stripe' }, ROLES, ACCESS, NONTECH_SECOND)
    expect(o.steps[0].minutes).toBe(10 * FOUNDER_HOURS_MULTIPLIER)
    expect(o.steps[0].note).toContain('no judged MCP/CLI agent surface')
  })

  it('every axis modifier is a named, disclosed simulation assumption; icp cross-references are real lenses; no solo axis exists', () => {
    const icpIds = new Set(
      (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'icp-types.json'), 'utf8')) as Array<{ id: string }>).map((t) => t.id),
    )
    expect(VS_TECHNICAL_OPTIONS.map((o) => o.value)).toEqual(['technical', 'non-technical'])
    expect(VS_EXPERIENCE_OPTIONS.map((o) => o.value)).toEqual(['first-timer', 'second-timer'])
    // Display rename (2026-09-29): 'Repeat entrepreneur' everywhere visible; the internal
    // 'second-timer' value/token/codec char never moved (asserted above and in the codec suite).
    const repeat = VS_EXPERIENCE_OPTIONS.find((o) => o.value === 'second-timer')!
    expect(repeat.label).toBe('Repeat entrepreneur')
    expect(repeat.short).toBe('Repeat entrepreneur')
    expect(repeat.assumption).toContain('repeat entrepreneur')
    for (const o of [...VS_TECHNICAL_OPTIONS, ...VS_EXPERIENCE_OPTIONS]) {
      for (const s of [o.label, o.short, o.blurb, o.assumption ?? '']) {
        expect(s.toLowerCase()).not.toContain('second-time')
      }
    }
    for (const o of [...VS_TECHNICAL_OPTIONS, ...VS_EXPERIENCE_OPTIONS]) {
      if (o.assumption !== null) expect(o.assumption).toContain('simulation assumption')
      if (o.icpId !== null) expect(icpIds.has(o.icpId)).toBe(true)
      // Founder-count is the Team decision's business — no axis mentions 'solo'.
      expect(o.label.toLowerCase()).not.toContain('solo')
      expect(o.blurb.toLowerCase()).not.toContain('solo')
    }
    // founderAssumptions composes: baseline none, single axes one, both two (in axis order).
    expect(founderAssumptions(TECH_FIRST)).toEqual([])
    expect(founderAssumptions(NONTECH_FIRST)).toHaveLength(1)
    expect(founderAssumptions(TECH_SECOND)).toHaveLength(1)
    const both = founderAssumptions(NONTECH_SECOND)
    expect(both).toHaveLength(2)
    for (const a of both) expect(a).toContain('simulation assumption')
    for (const a of VS_ASSUMPTIONS) expect(a.text).toContain('simulation assumption')
  })
})

describe('optimal stack — computed, judged-surface-bearing', () => {
  it('picks the first alternative with an MCP/CLI surface per role, keeping the default when none has one', () => {
    const picks = optimalSelections(ROLES, ACCESS)
    expect(picks.payments).toBe('square')
    const noSurface: VsAccessMap = { payments: { stripe: { mcp: 'none', cli: 'disputed' }, square: { mcp: 'na', cli: 'none' } } }
    expect(optimalSelections(ROLES, noSurface).payments).toBe('stripe')
    expect(hasAgentSurface({ mcp: 'disputed', cli: 'none' })).toBe(false)
    expect(hasAgentSurface({ mcp: 'na', cli: 'partial' })).toBe(true)
    expect(hasAgentSurface(undefined)).toBe(false)
  })

  it('the agents-first optimal stack never launches later than the reader stack (live corpus, default combo)', () => {
    const tasks = Object.fromEntries(union.map((id) => [id, payloadFor(id)]))
    const inputs = journeyOutcomeInputs(journeyPhases(DEFAULT_CHOICES, vsChains), tasks)
    const yours = computeStackOutcome(inputs, {}, liveRoles, liveAccess, TECH_FIRST)
    const optimal = computeStackOutcome(inputs, optimalSelections(liveRoles, liveAccess), liveRoles, liveAccess, TECH_FIRST)
    expect(optimal.launchMinutes).toBeLessThanOrEqual(yours.launchMinutes)
    expect(optimal.agentRunSteps).toBeGreaterThanOrEqual(yours.agentRunSteps)
  })
})

// ---------------------------------------------------------------------------
// Event engine
// ---------------------------------------------------------------------------

// The corpus reshape the page performs — enough of VirtualTaskPayload for the run layer.
function payloadFor(taskId: string): VirtualTaskPayload {
  const t = corpusById.get(taskId)!
  return {
    id: t.id,
    title: t.title,
    slug: processSlug(t.title),
    phase: t.phase,
    description: t.description,
    steps: t.dag.nodes.map((n) => ({
      taskId: t.id,
      taskTitle: t.title,
      label: n.label,
      route: n.route,
      vendor: n.vendor ?? null,
      vendorLabel: null,
      arenaId: null,
      choiceArenaId: null,
      calls: [],
      toolCall: null,
      approvalRequired: false,
      legalSignature: n.legalSignature ?? false,
      riskLevel: null,
      estimatedMinutes: n.estimatedMinutes,
      async: n.async ?? false,
      gap: null,
    })),
    tops: t.dag.nodes.map(() => null),
  }
}

describe('event engine — grounded, gated, seeded, deterministic', () => {
  it('every curated event is grounded in a real corpus process some decision combo reaches, and its risk floor is satisfied by the corpus', () => {
    const unionSet = new Set(union)
    for (const e of VS_EVENTS) {
      expect(unionSet.has(e.groundedIn), `event ${e.id} grounded in unreachable task ${e.groundedIn}`).toBe(true)
      const risk = liveRisks[e.groundedIn]
      expect(risk, `event ${e.id}: no corpus risk for ${e.groundedIn}`).toBeGreaterThanOrEqual(e.minRisk)
    }
    // …and each event actually fires for at least one combo (the gate is satisfiable).
    for (const e of VS_EVENTS) {
      const fires = allChoiceCombos().some((combo) =>
        eligibleVsEvents(combo, journeyTaskIds(combo, vsChains), liveRisks).some((x) => x.id === e.id),
      )
      expect(fires, `event ${e.id} never fires for any combo`).toBe(true)
    }
  })

  it('gates by the run decisions: SOC 2 demand needs enterprise ON and compliance LATER; cofounder departure needs cofounders', () => {
    const base: Choices = { ...DEFAULT_CHOICES, enterprise: 'yes', compliance: 'later', team: 'cofounders' }
    const on = eligibleVsEvents(base, journeyTaskIds(base, vsChains), liveRisks).map((e) => e.id)
    expect(on).toContain('soc2-demand')
    expect(on).toContain('cofounder-departure')

    const complianceNow: Choices = { ...base, compliance: 'now' }
    expect(eligibleVsEvents(complianceNow, journeyTaskIds(complianceNow, vsChains), liveRisks).map((e) => e.id)).not.toContain('soc2-demand')

    const solo: Choices = { ...base, team: 'solo' }
    expect(eligibleVsEvents(solo, journeyTaskIds(solo, vsChains), liveRisks).map((e) => e.id)).not.toContain('cofounder-departure')
  })

  it('gates by the corpus risk floor', () => {
    const journey = journeyTaskIds(DEFAULT_CHOICES, vsChains)
    const lowRisks = Object.fromEntries(Object.keys(liveRisks).map((k) => [k, 1]))
    expect(eligibleVsEvents(DEFAULT_CHOICES, journey, lowRisks).filter((e) => e.minRisk > 1)).toHaveLength(0)
  })

  it('draws 2–4 events deterministically from (combo, preset, yc, founder axes, seed); the axis pair and seed key the stream', () => {
    const journey = journeyTaskIds(DEFAULT_CHOICES, vsChains)
    const eligible = eligibleVsEvents(DEFAULT_CHOICES, journey, liveRisks)
    expect(eligible.length).toBeGreaterThanOrEqual(2)
    const key = eventSeedKey(DEFAULT_CHOICES, null, false, TECH_FIRST, 0)
    const a = drawVsEvents(eligible, key, 30)
    const b = drawVsEvents(eligible, key, 30)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(Math.min(2, eligible.length))
    expect(a.length).toBeLessThanOrEqual(4)
    for (const d of a) expect(d.day).toBeGreaterThanOrEqual(2)
    expect([...a].sort((x, y) => x.day - y.day).map((d) => d.def.id)).toEqual(a.map((d) => d.def.id))
    // The axis pair and the seed change the seed key deterministically.
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, TECH_SECOND, 0)).not.toBe(key)
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, NONTECH_FIRST, 0)).not.toBe(key)
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, NONTECH_SECOND, 0)).not.toBe(key)
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, TECH_FIRST, 1)).not.toBe(key)
    expect(drawVsEvents([], key, 30)).toEqual([])
  })

  it("the Apply-to-YC token is append-only in the seed key (item 6, 2026-10-01): off = byte-identical to the legacy key, on = '|q:1' appended", () => {
    const key = eventSeedKey(DEFAULT_CHOICES, null, false, TECH_FIRST, 0)
    // Legacy-stable: the default (off) emits EXACTLY the pre-item-6 key, so every pre-existing
    // run's event stream replays byte-identically.
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, TECH_FIRST, 0, false)).toBe(key)
    expect(key).not.toContain('|q:')
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, TECH_FIRST, 0, true)).toBe(`${key}|q:1`)
  })

  it('the founder seed token is legacy-stable: the three v1 persona ids map to their original tokens, so shared v1 links draw the same events', () => {
    expect(founderSeedToken(TECH_FIRST)).toBe('solo-technical')
    expect(founderSeedToken(NONTECH_FIRST)).toBe('non-technical')
    expect(founderSeedToken(TECH_SECOND)).toBe('second-timer')
    // The previously unreachable fourth combination gets its own (new) deterministic token.
    expect(founderSeedToken(NONTECH_SECOND)).toBe('non-technical+second-timer')
    // …and the legacy map covers exactly the three v1 ids, onto those exact pairs.
    expect(LEGACY_PERSONA_AXES['solo-technical']).toEqual(TECH_FIRST)
    expect(LEGACY_PERSONA_AXES['non-technical']).toEqual(NONTECH_FIRST)
    expect(LEGACY_PERSONA_AXES['second-timer']).toEqual(TECH_SECOND)
    expect(Object.keys(LEGACY_PERSONA_AXES)).toHaveLength(3)
  })

  it('resolves choices deterministically: real corpus minutes, named wait constants, lost deals, and arena re-picks', () => {
    const tasks = Object.fromEntries(union.map((id) => [id, payloadFor(id)]))
    const minutes = taskMinutesById(tasks)
    const soc2 = VS_EVENTS.find((e) => e.id === 'soc2-demand')!
    const processor = VS_EVENTS.find((e) => e.id === 'processor-review')!
    const drawn = [
      { def: soc2, day: 4 },
      { def: processor, day: 9 },
    ]
    const paymentsRole = liveRoles.find((r) => r.arenaId === 'payments')!
    const ctx = { roles: liveRoles, selections: {}, taskMinutes: minutes, chains: vsChains }

    // Undecided events add no time.
    const pending = resolveVsEvents(drawn, {}, ctx)
    expect(pending.deltaMinutes).toBe(0)
    expect(pending.decided).toBe(0)

    // SOC 2 accepted: the set-up-compliance chain's REAL corpus minutes land pre-launch.
    const complianceChain = vsChains.find((c) => c.id === 'set-up-compliance')!
    const chainMinutes = complianceChain.taskIds.reduce((acc, id) => acc + (minutes[id] ?? 0), 0)
    const accepted = resolveVsEvents(drawn, { 'soc2-demand': 'start-now' }, ctx)
    expect(accepted.deltaMinutes).toBe(chainMinutes)
    expect(accepted.dealsLost).toBe(0)

    // SOC 2 declined: no time, one simulated deal lost.
    const declined = resolveVsEvents(drawn, { 'soc2-demand': 'decline' }, ctx)
    expect(declined.deltaMinutes).toBe(0)
    expect(declined.dealsLost).toBe(1)

    // Processor wait: the named constant, in minutes.
    const waitChoice = processor.choices.find((c) => c.id === 'wait')!
    expect(waitChoice.effect.kind).toBe('wait-days')
    const waited = resolveVsEvents(drawn, { 'processor-review': 'wait' }, ctx)
    expect(waited.deltaMinutes).toBe((waitChoice.effect as { days: number }).days * 24 * 60)

    // Processor switch: re-pick from the REAL arena ranking (≠ current), plus the real re-setup time.
    const switched = resolveVsEvents(drawn, { 'processor-review': 'switch' }, ctx)
    expect(switched.pickOverrides.payments).toBeDefined()
    expect(switched.pickOverrides.payments).not.toBe(paymentsRole.defaultProductId)
    expect(paymentsRole.alternatives.some((o) => o.id === switched.pickOverrides.payments)).toBe(true)
    expect(switched.deltaMinutes).toBe(minutes.qs_021)
  })

  it('every wait branch names itself a simulation assumption; every real-time branch resolves to corpus minutes', () => {
    for (const e of VS_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      for (const c of e.choices) {
        if (c.effect.kind === 'wait-days') {
          expect(c.effect.assumption).toContain('simulation assumption')
          expect(c.effect.days).toBeGreaterThan(0)
        }
        if (c.effect.kind === 'redo-tasks') {
          for (const id of c.effect.taskIds) expect(corpusById.has(id), `event ${e.id} redoes unknown task ${id}`).toBe(true)
        }
        if (c.effect.kind === 'add-chain-time') {
          expect(chains.some((ch) => ch.id === (c.effect as { chainId: string }).chainId)).toBe(true)
        }
        if (c.effect.kind === 'switch-vendor') {
          expect(corpusById.has(c.effect.redoTaskId)).toBe(true)
        }
      }
    }
  })

  it('corpusLaunchDay is deterministic from the combo and covers the pre-launch prefix', () => {
    const tasks = Object.fromEntries(union.map((id) => [id, payloadFor(id)]))
    const inputs = journeyOutcomeInputs(journeyPhases(DEFAULT_CHOICES, vsChains), tasks)
    const d = corpusLaunchDay(inputs)
    expect(d).toBeGreaterThanOrEqual(1)
    expect(d).toBe(corpusLaunchDay(inputs))
  })
})

// ---------------------------------------------------------------------------
// Permalink codec
// ---------------------------------------------------------------------------

describe('permalink — the whole run state round-trips through ?run= (v2), and v1 links still decode', () => {
  const state: VsRunState = {
    // Asserted decisions only — the two the reader touched; everything else stays 'Not set'.
    choices: { entity: 'llc', team: 'solo' },
    preset: 'hardware',
    yc: true,
    founder: TECH_SECOND,
    mode: 'semi',
    companyName: 'Perchline Labs',
    picks: { payments: 'square', accounting: 'xero' },
    eventChoices: { 'soc2-demand': 'decline', 'processor-review': 'wait' },
    assistant: 'claude',
    ycApply: true,
    seed: 7,
  }

  const tamper = (o: Record<string, unknown>) => {
    const json = JSON.stringify(o)
    const bytes = new TextEncoder().encode(json)
    const b64 = Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return decodeRunState(b64)
  }

  it('round-trips every field (asserted-only decisions, founder axes, drive mode, typed name), and the param is URL-safe', () => {
    const encoded = encodeRunState(state)
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(decodeRunState(encoded)).toEqual(state)
  })

  it('round-trips the default state compactly (defaults omitted, nothing asserted)', () => {
    const def: VsRunState = {
      choices: {},
      preset: null,
      yc: false,
      founder: DEFAULT_FOUNDER_AXES,
      mode: 'auto',
      companyName: null,
      picks: {},
      eventChoices: {},
      assistant: null,
      ycApply: false,
      seed: 0,
    }
    const encoded = encodeRunState(def)
    expect(decodeRunState(encoded)).toEqual(def)
    expect(encoded.length).toBeLessThan(encodeRunState(state).length)
  })

  it('URL elision: unasserted decisions encode as dots and decode back absent; explicitly asserting the DEFAULT value serializes it', () => {
    expect(encodeAssertedCombo({})).toBe('.'.repeat(DECISIONS.length))
    expect(decodeAssertedCombo('.'.repeat(DECISIONS.length))).toEqual({})
    // Explicitly picking the default's value asserts it — a digit, not a dot.
    const assertedDefault = { entity: DEFAULT_CHOICES.entity }
    const enc = encodeAssertedCombo(assertedDefault)
    expect(enc[0]).not.toBe('.')
    expect(decodeAssertedCombo(enc)).toEqual(assertedDefault)
    // 'Not set' composes exactly the default branch.
    expect(effectiveChoices({})).toEqual(DEFAULT_CHOICES)
    expect(effectiveChoices({ entity: 'llc' })).toEqual({ ...DEFAULT_CHOICES, entity: 'llc' })
  })

  it('combo digits round-trip for every decision combo (fully asserted and legacy full-combo alike)', () => {
    for (const combo of allChoiceCombos()) {
      expect(decodeCombo(encodeCombo(combo))).toEqual(combo)
      expect(decodeAssertedCombo(encodeAssertedCombo(combo))).toEqual(combo)
    }
  })

  it('launch-option codec compat (2026-09-29, item 7): old ph digits 0/1 still decode to Product Hunt / stealth; the new venues append as 2/3', () => {
    const phIndex = DECISIONS.findIndex((d) => d.id === 'ph')
    const withPhDigit = (digit: string) => {
      const base = encodeCombo(DEFAULT_CHOICES).split('')
      base[phIndex] = digit
      return base.join('')
    }
    // Exactly the pre-extension mapping: a shared old link's digit means what it always meant.
    expect(decodeCombo(withPhDigit('0'))!.ph).toBe('yes')
    expect(decodeCombo(withPhDigit('1'))!.ph).toBe('no')
    // The appended venues take the next digits — and unknown digits still reject defensively.
    expect(decodeCombo(withPhDigit('2'))!.ph).toBe('show-hn')
    expect(decodeCombo(withPhDigit('3'))!.ph).toBe('waitlist')
    // 'X launch' appended 2026-10-01 (item 5) — the new default-ASSERTED venue takes digit 4.
    expect(decodeCombo(withPhDigit('4'))!.ph).toBe('x')
    expect(decodeCombo(withPhDigit('5'))).toBeNull()
    expect(decodeAssertedCombo(withPhDigit('3'))!.ph).toBe('waitlist')
    expect(decodeAssertedCombo(withPhDigit('4'))!.ph).toBe('x')
  })

  it('round-5 codec compat: entity/product/compliance digits 0/1 still mean what they always meant; the new options append as the next digits', () => {
    const digitAt = (id: string, digit: string) => {
      const i = DECISIONS.findIndex((d) => d.id === id)
      const base = encodeCombo(DEFAULT_CHOICES).split('')
      base[i] = digit
      return base.join('')
    }
    // Entity: c-corp/llc keep 0/1; the country entities append as 2–9 (PT/CA took 8/9 in the
    // 2026-10-03 new-countries wave — old digits still mean what they always meant).
    expect(decodeCombo(digitAt('entity', '0'))!.entity).toBe('c-corp')
    expect(decodeCombo(digitAt('entity', '1'))!.entity).toBe('llc')
    expect(decodeCombo(digitAt('entity', '2'))!.entity).toBe('ltd')
    expect(decodeCombo(digitAt('entity', '7'))!.entity).toBe('pvt-ltd')
    expect(decodeCombo(digitAt('entity', '8'))!.entity).toBe('lda')
    expect(decodeCombo(digitAt('entity', '9'))!.entity).toBe('ca-corp')
    // Business model: subscriptions/invoices keep 0/1; marketplace/usage/ecommerce append.
    expect(decodeCombo(digitAt('product', '0'))!.product).toBe('subscriptions')
    expect(decodeCombo(digitAt('product', '1'))!.product).toBe('invoices')
    expect(decodeCombo(digitAt('product', '2'))!.product).toBe('marketplace')
    expect(decodeCombo(digitAt('product', '3'))!.product).toBe('usage')
    expect(decodeCombo(digitAt('product', '4'))!.product).toBe('ecommerce')
    expect(decodeCombo(digitAt('product', '5'))).toBeNull()
    // Compliance: now/later keep 0/1 (old placement links replay); none/hipaa/iso append; the
    // 2026-09-30 'Basic minimums' takes the next digit (the display-hidden 'none' keeps slot 2).
    expect(decodeCombo(digitAt('compliance', '0'))!.compliance).toBe('now')
    expect(decodeCombo(digitAt('compliance', '1'))!.compliance).toBe('later')
    expect(decodeCombo(digitAt('compliance', '2'))!.compliance).toBe('none')
    expect(decodeCombo(digitAt('compliance', '3'))!.compliance).toBe('hipaa')
    expect(decodeCombo(digitAt('compliance', '4'))!.compliance).toBe('iso')
    expect(decodeCombo(digitAt('compliance', '5'))!.compliance).toBe('basics')
    expect(decodeCombo(digitAt('compliance', '6'))).toBeNull()
    // The hidden 'Start with' decision keeps its digit slot (item 4): old links asserting
    // build-first still decode and replay.
    expect(decodeCombo(digitAt('ordering', '1'))!.ordering).toBe('build-first')
    expect(decodeAssertedCombo(digitAt('ordering', '1'))!.ordering).toBe('build-first')
    // …and the asserted codec accepts every appended digit too.
    expect(decodeAssertedCombo(digitAt('entity', '3'))!.entity).toBe('gmbh')
  })

  it("2026-09-30 codec compat: old enterprise digits 0/1 decode to the default ICP ('no' → Developers) and Enterprises ('yes'); SMBs/Consumers append; the remote slot appends last", () => {
    const digitAt = (id: string, digit: string) => {
      const i = DECISIONS.findIndex((d) => d.id === id)
      const base = encodeCombo(DEFAULT_CHOICES).split('')
      base[i] = digit
      return base.join('')
    }
    // The ICP selector kept the old tokens: digit 0 = 'no' (Developers — the default path, what
    // 'Not yet' composed), digit 1 = 'yes' (Enterprises — the old enterprise-deal behaviors).
    expect(decodeCombo(digitAt('enterprise', '0'))!.enterprise).toBe('no')
    expect(decodeCombo(digitAt('enterprise', '1'))!.enterprise).toBe('yes')
    expect(decodeCombo(digitAt('enterprise', '2'))!.enterprise).toBe('smb')
    expect(decodeCombo(digitAt('enterprise', '3'))!.enterprise).toBe('consumer')
    expect(decodeCombo(digitAt('enterprise', '4'))).toBeNull()
    // The workplace decision is the LAST slot; 0 = remote-first (default), 1 = office.
    expect(DECISIONS[DECISIONS.length - 1].id).toBe('remote')
    expect(decodeCombo(digitAt('remote', '0'))!.remote).toBe('remote')
    expect(decodeCombo(digitAt('remote', '1'))!.remote).toBe('office')
    expect(decodeCombo(digitAt('remote', '2'))).toBeNull()
    expect(decodeAssertedCombo(digitAt('remote', '1'))!.remote).toBe('office')
  })

  it('appended-decision padding: 9-char digit strings (pre-remote links) still decode — missing trailing slots compose the default/unasserted; garbage lengths still reject', () => {
    // A v1-era 9-digit full combo (everything asserted, no remote slot yet).
    const nine = encodeCombo(DEFAULT_CHOICES).slice(0, 9)
    expect(nine).toHaveLength(9)
    expect(decodeCombo(nine)).toEqual(DEFAULT_CHOICES) // remote pads to its default
    // A v2-era 9-char dotted string: the slot the link PREDATES decodes asserted at its default
    // (a shared semi link replays without being asked a question that didn't exist), while the
    // explicit '.' slots stay unasserted.
    expect(decodeAssertedCombo('.'.repeat(9))).toEqual({ remote: 'remote' })
    const withEntity = `1${'.'.repeat(8)}`
    expect(decodeAssertedCombo(withEntity)).toEqual({ entity: 'llc', remote: 'remote' })
    // Shorter than any released codec, or longer than today's roster: reject.
    expect(decodeCombo('00000000')).toBeNull()
    expect(decodeAssertedCombo('........')).toBeNull()
    expect(decodeCombo(`${encodeCombo(DEFAULT_CHOICES)}0`)).toBeNull()
    // …and a whole 9-slot v2 ?run= payload decodes end to end (the shipped-link shape).
    const legacyRun = tamper({ v: 2, c: `1${'.'.repeat(8)}`, k: { payments: 'square' } })
    expect(legacyRun).not.toBeNull()
    expect(legacyRun!.choices).toEqual({ entity: 'llc', remote: 'remote' })
    expect(legacyRun!.assistant).toBeNull() // pre-item-7 links carry no 'a' token
  })

  it("the assistant token 'a' (item 7): round-trips, defaults null, rejects junk — only judged VS_AI_FIRM_IDS decode", () => {
    expect(decodeRunState(encodeRunState(state))!.assistant).toBe('claude')
    expect(decodeRunState(encodeRunState({ ...state, assistant: null }))!.assistant).toBeNull()
    for (const id of ['chatgpt', 'claude', 'gemini', 'grok', 'muse', 'dots', 'grok-bot', 'kimi', 'perplexity-computer']) {
      expect(decodeRunState(encodeRunState({ ...state, assistant: id }))!.assistant).toBe(id)
    }
    // Not a judged roster id → the whole payload rejects (defensive-decode convention).
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), a: 'clippy' })).toBeNull()
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), a: 7 })).toBeNull()
  })

  it("the Apply-to-YC token 'q' (item 6, 2026-10-01): round-trips, defaults false on legacy links, rejects junk", () => {
    expect(decodeRunState(encodeRunState(state))!.ycApply).toBe(true)
    expect(decodeRunState(encodeRunState({ ...state, ycApply: false }))!.ycApply).toBe(false)
    // Legacy payload without 'q' → false (the phase never composes for old links).
    expect(tamper({ v: 2, c: encodeAssertedCombo({}) })!.ycApply).toBe(false)
    // Anything but the literal 1 rejects (defensive-decode convention).
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), q: 2 })).toBeNull()
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), q: 'yes' })).toBeNull()
  })

  it('accepts v1 payloads: full combo asserted, legacy persona ids mapped onto the axis pairs, mode auto — shared links keep replaying', () => {
    const v1 = (persona?: string) =>
      tamper({
        v: 1,
        c: encodeCombo({ ...DEFAULT_CHOICES, entity: 'llc' }),
        ...(persona ? { f: persona } : {}),
        k: { payments: 'square' },
        s: 3,
      })
    const migrated = v1('second-timer')!
    expect(migrated.choices).toEqual({ ...DEFAULT_CHOICES, entity: 'llc' }) // v1 asserted everything
    expect(migrated.founder).toEqual(TECH_SECOND)
    expect(migrated.mode).toBe('auto')
    expect(migrated.companyName).toBeNull()
    expect(migrated.picks).toEqual({ payments: 'square' })
    expect(migrated.seed).toBe(3)
    expect(v1('non-technical')!.founder).toEqual(NONTECH_FIRST)
    expect(v1('solo-technical')!.founder).toEqual(TECH_FIRST)
    expect(v1()!.founder).toEqual(DEFAULT_FOUNDER_AXES)
    // …and the migrated axes reproduce the v1 event stream (legacy-stable seed token).
    expect(eventSeedKey(DEFAULT_CHOICES, null, false, migrated.founder, 3)).toContain('|f:second-timer|')
  })

  it('rejects garbage defensively (null, never a crash or a half-applied state)', () => {
    expect(decodeRunState(null)).toBeNull()
    expect(decodeRunState('')).toBeNull()
    expect(decodeRunState('%%%not-base64url%%%')).toBeNull()
    expect(decodeRunState('aGVsbG8')).toBeNull() // valid base64url, not our JSON
    // Wrong version / unknown founder token / unknown preset / malformed picks / bad mode / name.
    expect(tamper({ v: 99, c: encodeAssertedCombo(DEFAULT_CHOICES) })).toBeNull()
    expect(tamper({ v: 2, c: 'zzzzzzzzz' })).toBeNull()
    expect(tamper({ v: 1, c: 'zzzzzzzzz' })).toBeNull()
    expect(tamper({ v: 1, c: encodeCombo(DEFAULT_CHOICES), f: 'ceo' })).toBeNull() // unknown legacy persona
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), f: 'x9' })).toBeNull() // unknown axis token
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), f: 'second-timer' })).toBeNull() // v1 id in a v2 payload
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), m: 'warp' })).toBeNull()
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), n: 7 })).toBeNull()
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), p: 'unicorn' })).toBeNull()
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), k: { a: 1 } })).toBeNull()
    expect(tamper({ v: 2, c: encodeAssertedCombo({}), s: 'NaN' })).toBeNull()
  })

  it('the typed company name is sanitized on both encode and decode — no markup, no control chars, capped length', () => {
    expect(sanitizeVsCompanyName('  Perch<script>alert(1)</script>\u0007 Labs  ')).toBe('Perchscriptalert(1)/script Labs')
    expect(sanitizeVsCompanyName('a'.repeat(200))).toHaveLength(VS_COMPANY_NAME_MAX)
    expect(sanitizeVsCompanyName('   ')).toBe('')
    expect(sanitizeVsCompanyName('Tab\tand\nnewline')).toBe('Tab and newline')
    const dirty = encodeRunState({ ...state, companyName: ' <b>Evil</b>\u0000Co ' })
    expect(decodeRunState(dirty)!.companyName).toBe('bEvil/bCo')
  })
})

// ---------------------------------------------------------------------------
// Serialized payloads (lib/virtualStartupData.ts) + burn honesty
// ---------------------------------------------------------------------------

describe('server payloads — canonical verdicts, cited pricing, corpus risks', () => {
  it('buildVsAccess covers every alternative of every role with valid verdict kinds', () => {
    const kinds = new Set(['full', 'partial', 'disputed', 'none', 'na'])
    for (const r of liveRoles) {
      const byProduct = liveAccess[r.arenaId]
      expect(byProduct, `no access map for arena ${r.arenaId}`).toBeDefined()
      for (const o of r.alternatives) {
        const s = byProduct[o.id]
        expect(s, `no surface for ${r.arenaId}/${o.id}`).toBeDefined()
        expect(kinds.has(s.mcp)).toBe(true)
        expect(kinds.has(s.cli)).toBe(true)
      }
    }
  })

  it('pricing citation presence: every serialized fact carries its source URL and as-of date (verbatim-extraction contract)', () => {
    const pricing = buildVsPricing(liveRoles, DATA_DIR)
    // The journey's payments arena is price-covered — the scorecard has at least one real cite.
    expect(Object.keys(pricing).length).toBeGreaterThan(0)
    let facts = 0
    for (const byProduct of Object.values(pricing)) {
      for (const info of Object.values(byProduct)) {
        if (info.kind === 'fact') {
          facts += 1
          expect(info.sourceUrl).toMatch(/^https?:\/\//)
          expect(info.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(info.label.length).toBeGreaterThan(0)
          // Only per-month entry-plan sticker prices are ever summable.
          if (info.monthly) expect(info.tier).toBe('entry-paid')
        } else {
          expect(info.reason.length).toBeGreaterThan(0)
        }
      }
    }
    expect(facts).toBeGreaterThan(0)
  })

  it('stepRanking carries runners-up behind the recommended pick — likely-choice ORDERED, judged-scored (round 5, item 7)', () => {
    // The page serializes tops as ranking.vendors[0] (recommended · judged) + the REST of the
    // judged list reordered by the arena's likely-choice order and capped at 2. Pin against the
    // live corpus: membership and scores stay the judged ranking's; only presentation order moves.
    const popularity = buildVsPopularity(liveRoles, DATA_DIR)
    let covered = 0
    for (const t of unionTasks) {
      for (const node of t.dag.nodes) {
        const ranking = stepRanking(t.id, node, DATA_DIR)
        if (!ranking || ranking.vendors.length < 2) continue
        covered += 1
        const runners = orderByLikelyChoice(ranking.vendors.slice(1), popularity[ranking.arenaId]?.order).slice(0, 2)
        expect(runners.length).toBeGreaterThanOrEqual(1)
        expect(runners.length).toBeLessThanOrEqual(2)
        const judgedRest = new Map(ranking.vendors.slice(1).map((v) => [v.productId, v.score]))
        for (const v of runners) {
          expect(v.productId.length).toBeGreaterThan(0)
          expect(v.name.length).toBeGreaterThan(0)
          expect(Number.isFinite(v.score)).toBe(true)
          // NO rank fabrication: every runner-up is a judged vendor carrying its judged score.
          expect(judgedRest.get(v.productId)).toBe(v.score)
        }
        // The judged TOP is never displaced — runners-up come from behind it only.
        expect(runners.some((v) => v.productId === ranking.vendors[0].productId)).toBe(false)
      }
    }
    expect(covered).toBeGreaterThan(0)
  })

  it("buildVsPopularity: committed signals only, labels as receipts — and the founder's code-hosting complaint: GitHub leads the likely order", () => {
    const popularity = buildVsPopularity(liveRoles, DATA_DIR)
    for (const r of liveRoles) {
      const info = popularity[r.arenaId]
      expect(info, `no popularity payload for ${r.arenaId}`).toBeDefined()
      // The order is a permutation of the role's alternatives — membership never changes.
      expect([...info.order].sort()).toEqual(r.alternatives.map((o) => o.id).sort())
      // Signal labels exist only where a committed signal exists (absence is absence).
      for (const id of Object.keys(info.signals)) {
        expect(info.order).toContain(id)
        expect(info.signals[id].length).toBeGreaterThan(0)
      }
    }
    // The code-hosting audit (round 5, item 7): the judged story rankings put Bitbucket on top of
    // several prod_006/prod_002 steps (branch-permission/merge-check stories) — the likely-choice
    // ordering leads with GitHub (curated clearly-popular; Bitbucket carries no committed signal).
    const codeHosting = popularity['code-hosting']
    if (codeHosting) {
      expect(codeHosting.order[0]).toBe('github')
      expect(codeHosting.order.indexOf('github')).toBeLessThan(codeHosting.order.indexOf('bitbucket'))
      expect(codeHosting.signals.github).toContain('clearly popular')
      expect(codeHosting.signals.bitbucket).toBeUndefined()
    }
  })

  it('buildVsAssistants: the founder roster resolved against the JUDGED ai-assistants products, roster order, real names (item 7)', () => {
    const assistants = buildVsAssistants(DATA_DIR)
    expect(assistants.map((a) => a.id)).toEqual([
      'chatgpt', 'claude', 'gemini', 'grok', 'muse',
      // Appended with the 2026-10-01 roster expansion — codec 'a' tokens are append-only.
      'dots', 'grok-bot', 'kimi', 'perplexity-computer',
    ])
    const products = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'ai-assistants', 'products.json'), 'utf8'),
    ) as Array<{ id: string; name: string }>
    const byId = new Map(products.map((p) => [p.id, p.name]))
    for (const a of assistants) {
      // Every option is a real judged product wearing its judged display name.
      expect(byId.get(a.id), `${a.id} not judged in ai-assistants`).toBe(a.name)
      expect(typeof a.hasLogo).toBe('boolean')
    }
    // The 2026-10-01 additions resolve to their real judged display names.
    expect(byId.get('grok-bot')).toBe('Grok Bot')
    expect(byId.get('perplexity-computer')).toBe('Perplexity Computer')
    // …and the journey actually contains AI-conversation steps for the pin to land on: at least
    // one union step's judged ranking lives in the ai-assistants arena.
    const tasks = union.map((id) => corpusById.get(id)!)
    const aiSteps = tasks.flatMap((t) => t.dag.nodes.filter((n) => stepRanking(t.id, n, DATA_DIR)?.arenaId === 'ai-assistants'))
    expect(aiSteps.length).toBeGreaterThan(0)
  })

  it('buildVsTaskRisks mirrors the committed corpus risk axis', () => {
    expect(Object.keys(liveRisks)).toHaveLength(corpus.length)
    expect(liveRisks.startup_002).toBe(corpusById.get('startup_002')!.risk)
    for (const v of Object.values(liveRisks)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(5)
    }
  })

  it('computeBurn sums ONLY monthly entry plans; usage prices are listed, not blended; gaps stay gaps', () => {
    const burn = computeBurn(
      ROLES,
      {},
      {
        payments: {
          stripe: { kind: 'fact', label: '2.9% + $0.3', unit: 'per transaction', tier: 'usage', amountUsd: 0.3, percent: 2.9, monthly: false, sourceUrl: 'https://stripe.example/pricing', asOf: '2026-09-01' },
        },
      },
    )
    expect(burn.monthlyUsd).toBeNull() // a usage rate never becomes a monthly figure
    expect(burn.usageVendors).toBe(1)
    expect(burn.lines).toHaveLength(1)

    const monthly = computeBurn(
      [role('accounting', 'quickbooks', [{ id: 'quickbooks', name: 'QuickBooks' }]), ...ROLES],
      {},
      {
        accounting: {
          quickbooks: { kind: 'fact', label: '$35', unit: 'per month (entry plan)', tier: 'entry-paid', amountUsd: 35, monthly: true, sourceUrl: 'https://intuit.example/pricing', asOf: '2026-09-01' },
        },
      },
    )
    expect(monthly.monthlyUsd).toBe(35)
    expect(monthly.monthlyVendors).toBe(1)
    expect(monthly.noPricingVendors).toBe(1) // the payments pick has no entry here — a gap, not a guess
  })
})
