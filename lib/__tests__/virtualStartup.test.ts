// Virtual Startup — the decision→journey mapping and the synthetic-data honesty contract
// (lib/virtualStartup.ts), checked against the LIVE corpus: every journey must be composed of
// real processes/corpus.json tasks selected via real journeys/chains.json chains, and every
// synthetic artifact must be born labeled simulated and replay deterministically from the
// decision combo.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import searchAliases from '@/data/search-aliases.json'
import { GEO_PREF_META } from '@/lib/geoPreference'
import { CADENCE_META, loadChains, loadProcesses, processSlug, taskCeiling } from '@/lib/processes'
import type { SimStep } from '@/lib/processSim'
import { buildPageEntries } from '@/lib/search-index'
import {
  allChoiceCombos,
  applyYcCalibration,
  ARTIFACT_TASK_IDS,
  buildEventExamples,
  buildJourneyArtifacts,
  buildYearCandidates,
  comboKey,
  CORPUS_ANNUAL_MONTHS,
  dayOf,
  DECISIONS,
  DEFAULT_ASSERTED,
  DEFAULT_ASSERTED_URL_NEUTRAL,
  DEFAULT_CHOICES,
  HIDDEN_OPTION_VALUES,
  defaultEntityFor,
  ENTITY_META,
  ENTITY_OPTIONS_BY_COUNTRY,
  EVENT_EXAMPLES,
  eventRows,
  HIDDEN_DECISION_IDS,
  likelyChoiceOrder,
  orderByLikelyChoice,
  journeyPhases,
  journeyStats,
  journeyTaskIds,
  presetById,
  resolveYearMonths,
  RUNS_PER_YEAR,
  scenarioById,
  synthCompany,
  unionTaskIds,
  VS_CHAIN_IDS,
  YC_APPLY_TASK_ID,
  VS_PRESETS,
  VS_SCENARIOS,
  WINDOW_INTERVAL_DAYS,
  windowRows,
  YC_BATCH,
  YC_CALIBRATION,
  YC_DEAL,
  YEAR_CHAIN_IDS,
  YEAR_SWEEP_GATES,
  yearRows,
  yearStats,
  type RouteMix,
  type VsChain,
  type YearRow,
  type YearTaskSource,
} from '@/lib/virtualStartup'

const DATA_DIR = path.resolve(__dirname, '../../data')

const chains: VsChain[] = loadChains(DATA_DIR).map(({ id, name, taskIds }) => ({ id, name, taskIds }))
const corpusById = new Map(loadProcesses(DATA_DIR).map((t) => [t.id, t]))
const corpusIds = new Set(corpusById.keys())
const combos = allChoiceCombos()
// Bound each replay test's work without sampling: all combinations run, in source order.
const REPLAY_BATCH_SIZE = 5_120
const replayBatches = Array.from({ length: Math.ceil(combos.length / REPLAY_BATCH_SIZE) }, (_, index) => ({
  batch: index + 1,
  choices: combos.slice(index * REPLAY_BATCH_SIZE, (index + 1) * REPLAY_BATCH_SIZE),
}))

// The same corpus reshape app/startup-sim/page.tsx performs — shared by the rhythm suites.
const routeMixOf = (taskId: string): RouteMix => {
  const mix: RouteMix = { agent: 0, form: 0, person: 0, legalSignature: 0 }
  for (const n of corpusById.get(taskId)!.dag.nodes) {
    mix[n.route] += 1
    if (n.legalSignature) mix.legalSignature += 1
  }
  return mix
}
const sources: YearTaskSource[] = [...corpusById.values()].map((t) => ({
  taskId: t.id,
  title: t.title,
  slug: processSlug(t.title),
  cadence: t.cadence,
  cadenceLabel: CADENCE_META[t.cadence].label,
  totalSteps: t.dag.nodes.length,
  routes: routeMixOf(t.id),
  ceilingPct: taskCeiling(t).pct,
}))
const candidates = buildYearCandidates(chains, sources)

describe('decision → journey mapping (against the live corpus)', () => {
  it('every journey chain exists in journeys/chains.json', () => {
    const chainIds = new Set(chains.map((c) => c.id))
    for (const id of VS_CHAIN_IDS) expect(chainIds.has(id), `chain ${id} missing`).toBe(true)
  })

  it('covers every decision combo, derived straight from DECISIONS (10 entities × 5 models × 6 compliance options × 4 ICPs × 5 launches × 2 workplaces × the rest)', () => {
    const expected = DECISIONS.reduce((acc, d) => acc * d.options.length, 1)
    expect(expected).toBe(192000) // 10 × 2 × 2 × 5 × 2 × 2 × 6 × 4 × 5 × 2 (PT/CA entities appended 2026-10-03)
    expect(combos.length).toBe(expected)
    expect(new Set(combos.map(comboKey)).size).toBe(expected)
    expect(DECISIONS.length).toBe(10)
  })

  it('comboKey is legacy-stable (2026-09-30): the appended remote slot shows only when non-default, so every pre-existing combo keeps its exact seed key', () => {
    const legacy = { ...DEFAULT_CHOICES }
    expect(comboKey(legacy)).toBe(
      `${legacy.entity}|${legacy.funding}|${legacy.product}|${legacy.team}|${legacy.ordering}|${legacy.hire}|${legacy.compliance}|${legacy.enterprise}|${legacy.ph}`,
    )
    expect(comboKey(legacy)).not.toContain('remote')
    expect(comboKey({ ...legacy, remote: 'office' })).toBe(`${comboKey(legacy)}|office`)
    // …and with it, the seeded synthetic identity of every shared link replays unchanged.
    expect(synthCompany(legacy)).toEqual(synthCompany({ ...legacy }))
  })

  it('every combo yields only real corpus tasks, each at most once', () => {
    const violations: string[] = []
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      if (ids.length === 0) violations.push(`empty journey for ${comboKey(combo)}`)
      if (new Set(ids).size !== ids.length) violations.push(`duplicate tasks for ${comboKey(combo)}`)
      for (const id of ids) {
        if (!corpusIds.has(id)) violations.push(`unknown task ${id} for ${comboKey(combo)}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('entity: only LLC swaps in form_011; every other entity — non-US ones included — runs form_001, never both', () => {
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      expect(ids.includes('form_001')).toBe(combo.entity !== 'llc')
      expect(ids.includes('form_011')).toBe(combo.entity === 'llc')
    }
  })

  it('country-aware entities (round 5, item 1): a non-US entity NEVER creates a corpus branch — task-identical to the C-Corp path; the country frame rides the phase note; codec order pins c-corp/llc at 0/1', () => {
    const entity = DECISIONS.find((d) => d.id === 'entity')!
    // Codec compat: the original values keep indices 0/1; non-US values are appended.
    expect(entity.options.map((o) => o.value)).toEqual(['c-corp', 'llc', 'ltd', 'gmbh', 'ug', 'sas', 'sarl', 'pvt-ltd', 'lda', 'ca-corp'])
    // The dropdown roster follows the geo pick; each country's FIRST option is its default-asserted value.
    expect(ENTITY_OPTIONS_BY_COUNTRY).toEqual({
      US: ['c-corp', 'llc'], UK: ['ltd'], DE: ['gmbh', 'ug'], FR: ['sas', 'sarl'], IN: ['pvt-ltd'], PT: ['lda'], CA: ['ca-corp'],
    })
    expect(defaultEntityFor('US')).toBe('c-corp')
    expect(defaultEntityFor('UK')).toBe('ltd')
    expect(defaultEntityFor('DE')).toBe('gmbh')
    expect(defaultEntityFor('FR')).toBe('sas')
    expect(defaultEntityFor('IN')).toBe('pvt-ltd')
    expect(defaultEntityFor('PT')).toBe('lda')
    expect(defaultEntityFor('CA')).toBe('ca-corp')
    // Every DECISIONS entity value exists in exactly one country roster, and vice versa.
    const rosterValues = Object.values(ENTITY_OPTIONS_BY_COUNTRY).flat()
    expect([...rosterValues].sort()).toEqual(entity.options.map((o) => o.value).sort())
    // HONESTY: composition is byte-identical to the C-Corp path for every non-US entity.
    const ccorpIds = journeyTaskIds({ ...DEFAULT_CHOICES, entity: 'c-corp' }, chains)
    for (const value of ['ltd', 'gmbh', 'ug', 'sas', 'sarl', 'pvt-ltd', 'lda', 'ca-corp'] as const) {
      const combo = { ...DEFAULT_CHOICES, entity: value }
      expect(journeyTaskIds(combo, chains)).toEqual(ccorpIds)
      const note = journeyPhases(combo, chains).find((p) => p.id === 'form')!.note!
      expect(note).toContain(ENTITY_META[value].label)
      expect(note).toContain('same corpus incorporation composition')
      expect(note).toContain('no steps invented')
      expect(note).toContain(GEO_PREF_META[ENTITY_META[value].country].prose)
      // The entity label follows the pick (company display suffix) and flavors the filing artifact.
      const co = synthCompany(combo)
      expect(co.display).toBe(`${co.name}${ENTITY_META[value].suffix}`)
      const arts = buildJourneyArtifacts(combo, journeyTaskIds(combo, chains))
      expect(arts.form_001?.[0].label).toBe(ENTITY_META[value].filing.label)
      expect(arts.form_001?.[0].value).toContain(ENTITY_META[value].filing.register)
      expect(arts.form_001?.[0].simulated).toBe(true)
      // Impossible-real: the placeholder register numbers are all zeros (space-grouped for FR).
      expect(arts.form_001?.[0].value).toMatch(/0{3,}/)
      expect(arts.form_001?.[0].value).not.toMatch(/[1-9]/)
    }
    // The committed geoNotes analogs the entity frame leans on actually exist on form_001.
    const form001 = corpusById.get('form_001')!
    const noteCountries = new Set((form001.geoNotes ?? []).map((n) => n.country))
    for (const c of ['UK', 'DE', 'FR', 'IN'] as const) expect(noteCountries.has(c), `form_001 geoNotes missing ${c}`).toBe(true)
  })

  it('team: the founder equity split (startup_002) rides only with cofounders', () => {
    for (const combo of combos) {
      expect(journeyTaskIds(combo, chains).includes('startup_002')).toBe(combo.team === 'cofounders')
    }
  })

  it('funding: the raise phase is exactly the raise-a-seed-round chain, only on seed', () => {
    const raiseChain = chains.find((c) => c.id === 'raise-a-seed-round')!
    for (const combo of combos) {
      const phases = journeyPhases(combo, chains)
      const raise = phases.find((p) => p.chainId === 'raise-a-seed-round')
      if (combo.funding === 'seed') {
        expect(raise?.taskIds).toEqual(raiseChain.taskIds)
      } else {
        expect(raise).toBeUndefined()
        const ids = journeyTaskIds(combo, chains)
        for (const tid of raiseChain.taskIds) expect(ids.includes(tid)).toBe(false)
      }
    }
  })

  it('business model forks the get-paid chain: growth_001 for subscriptions AND usage, sales_002 for invoices, spine-only for marketplace/e-commerce', () => {
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      expect(ids.includes('growth_001')).toBe(combo.product === 'subscriptions' || combo.product === 'usage')
      expect(ids.includes('sales_002')).toBe(combo.product === 'invoices')
      // The shared spine of the chain stays regardless of the fork.
      expect(ids.includes('qs_021')).toBe(true)
      expect(ids.includes('fin_002')).toBe(true)
    }
  })

  it('new business models (round 5, item 2): usage is venue-noted billing on the SAME growth_001 steps; marketplace/e-commerce run the spine with the model named — nothing fabricated; codec order pins subscriptions/invoices at 0/1', () => {
    const product = DECISIONS.find((d) => d.id === 'product')!
    expect(product.options.map((o) => o.value)).toEqual(['subscriptions', 'invoices', 'marketplace', 'usage', 'ecommerce'])
    // Usage-based: task-identical to SaaS subscriptions — usage is a billing mode, named only.
    const saasIds = journeyTaskIds({ ...DEFAULT_CHOICES, product: 'subscriptions' }, chains)
    const usage = { ...DEFAULT_CHOICES, product: 'usage' as const }
    expect(journeyTaskIds(usage, chains)).toEqual(saasIds)
    const usageNote = journeyPhases(usage, chains).find((p) => p.id === 'revenue')!.note!
    expect(usageNote).toContain('usage-based')
    expect(usageNote).toContain('identical corpus steps')
    const usageArts = buildJourneyArtifacts(usage, journeyTaskIds(usage, chains))
    expect(usageArts.growth_001?.[0].value).toContain('metered usage')
    expect(usageArts.growth_001?.[0].simulated).toBe(true)
    // Marketplace / e-commerce: the get-paid spine only — no billing fork, no invented steps.
    for (const value of ['marketplace', 'ecommerce'] as const) {
      const combo = { ...DEFAULT_CHOICES, product: value }
      const ids = journeyTaskIds(combo, chains)
      expect(ids.includes('qs_021')).toBe(true)
      expect(ids.includes('fin_002')).toBe(true)
      expect(ids.includes('growth_001')).toBe(false)
      expect(ids.includes('sales_002')).toBe(false)
      const note = journeyPhases(combo, chains).find((p) => p.id === 'revenue')!.note!
      expect(note).toContain(value === 'marketplace' ? 'take-rate' : 'e-commerce')
      // The honest absence is SAID, not papered over.
      expect(note).toMatch(/no take-rate billing steps|no storefront step/)
      const arts = buildJourneyArtifacts(combo, ids)
      expect(arts.qs_021?.[0].value).toContain(value === 'marketplace' ? 'take-rate routing' : 'checkout live')
    }
    // The option details are honest about arena support: the marketplace/e-commerce corpus has
    // no mapped steps for those arenas, and the details never claim any.
    const detailOf = (v: string) => product.options.find((o) => o.value === v)!.detail
    expect(detailOf('marketplace')).toContain('nothing is invented')
    expect(detailOf('ecommerce')).toContain('no storefront step')
    expect(detailOf('usage')).toContain('identical corpus steps')
  })

  it('ordering: name-first leads with name-the-company, build-first leads with ship-v1', () => {
    for (const combo of combos) {
      const phases = journeyPhases(combo, chains)
      expect(phases[0].chainId).toBe(combo.ordering === 'build-first' ? 'ship-v1' : 'name-the-company')
    }
  })

  it('the journey tail follows the toggles: enterprise closes, else deferred compliance, else launch day', () => {
    for (const combo of combos) {
      const phases = journeyPhases(combo, chains)
      const last = phases[phases.length - 1].chainId
      if (combo.enterprise === 'yes') expect(last).toBe('land-the-enterprise-deal')
      else if (combo.compliance === 'later') expect(last).toBe('set-up-compliance')
      else if (combo.ph !== 'no') expect(last).toBe('launch-on-product-hunt')
    }
  })

  it('hire: the first-hire chain rides only on yes, placed after revenue turns on', () => {
    const hireChain = chains.find((c) => c.id === 'first-hire')!
    for (const combo of combos) {
      const phases = journeyPhases(combo, chains)
      const hire = phases.find((p) => p.chainId === 'first-hire')
      if (combo.hire === 'yes') {
        expect(hire?.taskIds).toEqual(hireChain.taskIds)
        expect(phases.findIndex((p) => p.chainId === 'first-hire')).toBeGreaterThan(
          phases.findIndex((p) => p.chainId === 'get-paid'),
        )
      } else {
        expect(hire).toBeUndefined()
        const ids = journeyTaskIds(combo, chains)
        for (const tid of hireChain.taskIds) expect(ids.includes(tid)).toBe(false)
      }
    }
  })

  it('compliance: SOC 2/HIPAA/ISO run the set-up-compliance chain (early, or deferred on later); None AND Basic minimums genuinely skip it', () => {
    for (const combo of combos) {
      const phases = journeyPhases(combo, chains)
      const idx = (chainId: string) => phases.findIndex((p) => p.chainId === chainId)
      const c = idx('set-up-compliance')
      if (combo.compliance === 'none' || combo.compliance === 'basics') {
        expect(c).toBe(-1)
        continue
      }
      expect(c).toBeGreaterThanOrEqual(0)
      if (combo.compliance === 'later') expect(c).toBeGreaterThan(idx('get-paid'))
      else expect(c).toBeLessThan(idx('launch-website')) // now / hipaa / iso — early placement
    }
  })

  it("compliance 'Basic minimums' (item 8, 2026-09-30): appended codec slot, byte-identical composition to None — honestly named, never a fake playbook; round 7 moves the default-asserted posture to SOC 2", () => {
    const compliance = DECISIONS.find((d) => d.id === 'compliance')!
    expect(compliance.options.map((o) => o.value)).toEqual(['now', 'later', 'none', 'hipaa', 'iso', 'basics'])
    expect(compliance.options.find((o) => o.value === 'basics')!.label).toBe('Basic minimums')
    // The same composition None mapped to — no dedicated compliance playbook runs.
    const none = journeyTaskIds({ ...DEFAULT_CHOICES, compliance: 'none' }, chains)
    expect(journeyTaskIds({ ...DEFAULT_CHOICES, compliance: 'basics' }, chains)).toEqual(none)
    // Round 7 (2026-10-01, item 5): the default-asserted posture is SOC 2 early — equal to the
    // composed default, so compliance is composition-NEUTRAL again and joins the URL underlay.
    expect(DEFAULT_ASSERTED.compliance).toBe('now')
    expect(DEFAULT_CHOICES.compliance).toBe('now') // 'Not set' still composes SOC 2 early — old links replay
    // 'None' leaves the display roster (redundant with the honest name); the codec slot stays.
    expect(HIDDEN_OPTION_VALUES.compliance).toEqual(['none'])
    // The honest detail: basics claims hygiene, never a playbook that didn't run.
    expect(compliance.options.find((o) => o.value === 'basics')!.detail).toContain('does not run')
  })

  it('compliance gets specific (round 5, item 3): HIPAA/ISO name the framework on the SAME chain steps — no fabricated corpus steps; codec order pins now/later at 0/1', () => {
    const compliance = DECISIONS.find((d) => d.id === 'compliance')!
    expect(compliance.options.map((o) => o.value)).toEqual(['now', 'later', 'none', 'hipaa', 'iso', 'basics'])
    expect(compliance.options.map((o) => o.label)).toEqual(['SOC 2 (early)', 'SOC 2 (deferred)', 'None', 'HIPAA', 'ISO 27001', 'Basic minimums'])
    const socIds = journeyTaskIds({ ...DEFAULT_CHOICES, compliance: 'now' }, chains)
    for (const value of ['hipaa', 'iso'] as const) {
      const combo = { ...DEFAULT_CHOICES, compliance: value }
      // Task-identical to the SOC 2 early path — the framework is a name, never new steps.
      expect(journeyTaskIds(combo, chains)).toEqual(socIds)
      const note = journeyPhases(combo, chains).find((p) => p.id === 'compliance')!.note!
      expect(note).toContain(value === 'hipaa' ? 'HIPAA' : 'ISO 27001')
      expect(note).toContain('never fabricated')
      // The comp_001 artifact names the framework honestly and stays SIMULATED.
      const arts = buildJourneyArtifacts(combo, journeyTaskIds(combo, chains))
      expect(arts.comp_001?.[0].label).toBe(value === 'hipaa' ? 'HIPAA readiness' : 'ISO 27001 readiness')
      expect(arts.comp_001?.[0].value).toContain('no dedicated')
      expect(arts.comp_001?.[0].simulated).toBe(true)
    }
    // 'None' skips the chain entirely — its tasks appear only via the enterprise motion (comp_002…).
    const none = { ...DEFAULT_CHOICES, compliance: 'none' as const, enterprise: 'no' as const }
    const noneIds = journeyTaskIds(none, chains)
    const complianceChain = chains.find((c) => c.id === 'set-up-compliance')!
    for (const tid of complianceChain.taskIds) expect(noneIds.includes(tid)).toBe(false)
  })

  it('enterprise/ICP: the land-the-enterprise-deal chain appears only on the Enterprises ICP (the old yes token), as the final phase', () => {
    const entChain = chains.find((c) => c.id === 'land-the-enterprise-deal')!
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      for (const tid of entChain.taskIds) {
        expect(ids.includes(tid), `${tid} for ${comboKey(combo)}`).toBe(combo.enterprise === 'yes')
      }
    }
  })

  it("the ICP selector (item 4, 2026-09-30): 'no'/'yes' keep tokens AND indices 0/1 (old digits → default ICP / Enterprises); SMBs/Consumers append, venue-noted, composition-identical to the default", () => {
    const icp = DECISIONS.find((d) => d.id === 'enterprise')!
    expect(icp.title).toBe('ICP')
    // Codec + seed stability: the value tokens never moved, only the labels tell the ICP story.
    expect(icp.options.map((o) => o.value)).toEqual(['no', 'yes', 'smb', 'consumer'])
    expect(icp.options.map((o) => o.label)).toEqual(['Developers', 'Enterprises', 'SMBs', 'Consumers'])
    // The old enterprise-'yes' behaviors attach to the Enterprises ICP (asserted above); the
    // appended ICPs compose EXACTLY the default path — audience named, nothing invented.
    const defaultIds = journeyTaskIds({ ...DEFAULT_CHOICES, enterprise: 'no' }, chains)
    for (const value of ['smb', 'consumer'] as const) {
      const combo = { ...DEFAULT_CHOICES, enterprise: value }
      expect(journeyTaskIds(combo, chains)).toEqual(defaultIds)
      const note = journeyPhases(combo, chains).find((p) => p.id === 'revenue')!.note!
      expect(note).toContain(value === 'smb' ? 'ICP: SMBs' : 'ICP: consumers')
      expect(note).toContain('identical composition')
    }
    // The default ICP ('no' token) keeps the untouched default revenue note — old links replay
    // their display too, and the enterprise phase honestly never runs.
    const devNote = journeyPhases({ ...DEFAULT_CHOICES, enterprise: 'no' }, chains).find((p) => p.id === 'revenue')!.note!
    expect(devNote).not.toContain('ICP:')
  })

  it("the 'Workplace' decision (item 5, 2026-09-30): remote-first composes nothing extra; office adds the real lease-an-office process (ops_014) as a chainless phase", () => {
    const remote = DECISIONS.find((d) => d.id === 'remote')!
    // Appended LAST so every older digit slot keeps its position; remote-first is index 0 (the default).
    expect(DECISIONS[DECISIONS.length - 1].id).toBe('remote')
    expect(remote.options.map((o) => o.value)).toEqual(['remote', 'office'])
    expect(DEFAULT_CHOICES.remote).toBe('remote')
    // remote-first: byte-identical to the journey before the decision existed.
    const base = journeyTaskIds(DEFAULT_CHOICES, chains)
    expect(base.includes('ops_014')).toBe(false)
    // office: ops_014 joins as its own phase — a real corpus process, honestly presented as
    // NOT a curated chain (no chainId → the UI renders no playbook link).
    const office = { ...DEFAULT_CHOICES, remote: 'office' as const }
    const ids = journeyTaskIds(office, chains)
    expect(ids).toEqual([...base.slice(0, ids.indexOf('ops_014')), 'ops_014', ...base.slice(ids.indexOf('ops_014'))])
    const phase = journeyPhases(office, chains).find((p) => p.id === 'office')!
    expect(phase.taskIds).toEqual(['ops_014'])
    expect(phase.chainId).toBe('')
    expect(phase.note).toContain('not a curated chain')
    expect(corpusIds.has('ops_014')).toBe(true)
    expect(corpusById.get('ops_014')!.title).toBe('Lease an office')
    // The office artifact exists, is simulated, and is impossible-real ($0.00 placeholder).
    const arts = buildJourneyArtifacts(office, ids)
    expect(arts.ops_014?.[0].label).toBe('Office lease')
    expect(arts.ops_014?.[0].simulated).toBe(true)
    expect(arts.ops_014?.[0].value).toContain('$0.00')
  })

  it('launch: every PUBLIC launch option runs the launch chain; Stealth mode skips it', () => {
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      // growth_010 (the launch submission) lives only in that chain among the journey chains.
      expect(ids.includes('growth_010')).toBe(combo.ph !== 'no')
      expect(journeyPhases(combo, chains).some((p) => p.chainId === 'launch-on-product-hunt')).toBe(combo.ph !== 'no')
    }
  })

  it('launch options (2026-09-29, item 7): venue options are venue-FLAVORED only — identical corpus task ids to the Product Hunt path; the venue is named in the phase note; option order pins the codec', () => {
    const ph = DECISIONS.find((d) => d.id === 'ph')!
    // Codec compat: 'yes'/'no' keep indices 0/1 (old digits map to the same options); new
    // venues are appended.
    expect(ph.options.map((o) => o.value)).toEqual(['yes', 'no', 'show-hn', 'waitlist', 'x'])
    expect(ph.options.map((o) => o.label)).toEqual(['Product Hunt', 'Stealth mode', 'Show HN', 'Waitlist launch', 'X launch'])
    const venueMark: Record<string, string> = { 'show-hn': 'Show HN', waitlist: 'waitlist', x: 'X' }
    for (const base of [DEFAULT_CHOICES, { ...DEFAULT_CHOICES, enterprise: 'yes' as const }]) {
      const phIds = journeyTaskIds({ ...base, ph: 'yes' }, chains)
      for (const venue of ['show-hn', 'waitlist', 'x'] as const) {
        const combo = { ...base, ph: venue }
        // HONESTY: the same corpus playbook, task for task — nothing invented for the venue
        // ('x' included, 2026-10-01 item 5: launching on X composes ZERO new corpus steps).
        expect(journeyTaskIds(combo, chains)).toEqual(phIds)
        const note = journeyPhases(combo, chains).find((p) => p.chainId === 'launch-on-product-hunt')!.note!
        expect(note).toContain('the same launch playbook')
        expect(note).toContain(venueMark[venue])
        // The launch-day artifact names the venue, stays simulated and deterministic.
        const arts = buildJourneyArtifacts(combo, journeyTaskIds(combo, chains))
        expect(arts.growth_010?.[0].value).toContain(venueMark[venue])
        expect(arts.growth_010?.[0].simulated).toBe(true)
      }
      // Stealth genuinely skips the chain — and the run still ends (operations continue).
      const stealth = journeyPhases({ ...base, ph: 'no' }, chains)
      expect(stealth.some((p) => p.chainId === 'launch-on-product-hunt')).toBe(false)
      expect(stealth.length).toBeGreaterThan(0)
    }
  })

  it('DEFAULT-ASSERTED decisions (round 7, 2026-10-01): the demo composition starts asserted; only composition-neutral entries underlay decoded run links (era handling)', () => {
    expect(DEFAULT_ASSERTED).toEqual({
      entity: 'c-corp', team: 'cofounders', funding: 'seed', compliance: 'now', ph: 'x', remote: 'office',
    })
    for (const [id, value] of Object.entries(DEFAULT_ASSERTED)) {
      const d = DECISIONS.find((x) => x.id === id)
      expect(d, `DEFAULT_ASSERTED names unknown decision "${id}"`).toBeTruthy()
      expect(d!.options.map((o) => o.value)).toContain(value)
    }
    // ERA RULE: the URL-neutral subset (values equal to the composed default) underlies decoded
    // links — entity/team/funding/compliance compose identically either way. The NON-neutral
    // demo defaults (ph 'x', remote 'office') must NOT underlay: an old link's elided launch
    // keeps its PH venue and its elided workplace stays remote-first (no ops_014 lease phase) —
    // decoded legacy links replay their own era; only FRESH visits get the new defaults.
    expect(DEFAULT_ASSERTED_URL_NEUTRAL).toEqual({
      entity: 'c-corp', team: 'cofounders', funding: 'seed', compliance: 'now',
    })
    // The frozen composition era itself: DEFAULT_CHOICES never moved.
    expect(DEFAULT_CHOICES.ph).toBe('yes')
    expect(DEFAULT_CHOICES.remote).toBe('remote')
  })

  it('tasks shared across chains (domain_002, prod_005) run once — first occurrence wins', () => {
    const ids = journeyTaskIds(DEFAULT_CHOICES, chains)
    expect(ids.filter((id) => id === 'domain_002').length).toBe(1)
    expect(ids.filter((id) => id === 'prod_005').length).toBe(1)
  })

  it('unionTaskIds is a duplicate-free superset of every combo journey', () => {
    const union = unionTaskIds(chains)
    const unionIds = new Set(union)
    expect(unionIds.size).toBe(union.length)
    const violations: string[] = []
    for (const combo of combos) {
      for (const id of journeyTaskIds(combo, chains)) {
        if (!unionIds.has(id)) violations.push(`union missing ${id} for ${comboKey(combo)}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('throws on an unknown chain rather than inventing one', () => {
    expect(() => journeyPhases(DEFAULT_CHOICES, chains.filter((c) => c.id !== 'ship-v1'))).toThrow(/ship-v1/)
  })

  it('every decision option names its corpus mapping in the visible detail copy', () => {
    for (const d of DECISIONS) {
      expect(d.options.length).toBeGreaterThanOrEqual(2)
      for (const o of d.options) expect(o.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('synthetic artifacts — labeled, deterministic, impossible-real', () => {
  it('every artifact generator key is a real corpus task reachable by some combo', () => {
    const union = new Set(unionTaskIds(chains))
    for (const id of ARTIFACT_TASK_IDS) {
      expect(corpusIds.has(id), `generator for unknown task ${id}`).toBe(true)
      expect(union.has(id), `generator for unreachable task ${id}`).toBe(true)
    }
  })

  it('EVERY generated artifact carries the literal simulated flag and non-empty copy', () => {
    // The sweep currently covers 153,600 combos × ~15 artifacts — plain checks accumulate violations and a
    // single expect reports them, so the full honesty sweep stays exhaustive AND fast (millions
    // of expect() calls were the old bottleneck, not the generators).
    const violations: string[] = []
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      const idSet = new Set(ids)
      const byTask = buildJourneyArtifacts(combo, ids)
      let count = 0
      for (const arts of Object.values(byTask)) {
        for (const a of arts) {
          count += 1
          if (a.simulated !== true) violations.push(`${comboKey(combo)}: ${a.taskId} unlabeled`)
          if (!idSet.has(a.taskId)) violations.push(`${comboKey(combo)}: ${a.taskId} outside the journey`)
          if (a.label.length === 0 || a.value.length === 0) violations.push(`${comboKey(combo)}: ${a.taskId} empty copy`)
        }
      }
      if (count === 0) violations.push(`${comboKey(combo)}: no artifacts at all`)
    }
    expect(violations).toEqual([])
  }, 120_000)

  it('replay batches cover the full decision product exactly once, without omissions or duplicates', () => {
    const flattened = replayBatches.flatMap(batch => batch.choices)
    expect(combos.length).toBe(DECISIONS.reduce((count, decision) => count * decision.options.length, 1))
    expect(flattened.length).toBe(combos.length)
    expect(flattened.every((combo, index) => combo === combos[index])).toBe(true)
    expect(new Set(flattened.map(comboKey)).size).toBe(combos.length)
    expect(replayBatches.every(batch => batch.choices.length > 0 && batch.choices.length <= REPLAY_BATCH_SIZE)).toBe(true)
  })

  it.each(replayBatches)('replays identically for the same decision combo — batch $batch (seeded, no runtime randomness)', ({ choices }) => {
    for (const combo of choices) {
      const ids = journeyTaskIds(combo, chains)
      expect(buildJourneyArtifacts(combo, ids)).toEqual(buildJourneyArtifacts(combo, ids))
      expect(synthCompany(combo)).toEqual(synthCompany(combo))
    }
  })

  it('identifiers are constructed impossible-real: 00- EIN, .example domains, entity-true name', () => {
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      const byTask = buildJourneyArtifacts(combo, ids)
      expect(byTask.form_002?.[0].value).toBe('00-0000000')
      expect(byTask.domain_002?.[0].value).toContain('.example')
      const co = synthCompany(combo)
      // The display suffix follows the entity decision — Inc./LLC and the round-5 country
      // entities (Ltd / GmbH / UG / SAS / SARL / Pvt Ltd) alike.
      expect(co.display.endsWith(ENTITY_META[combo.entity].suffix)).toBe(true)
      expect(byTask.brand_001?.[0].value).toBe(co.display)
    }
  })
})

describe('journey stats & elapsed time (corpus estimates only)', () => {
  const step = (over: Partial<SimStep>): SimStep => ({
    taskId: 't',
    taskTitle: 'T',
    label: 'step',
    route: 'agent',
    vendor: null,
    vendorLabel: null,
    arenaId: null,
    choiceArenaId: null,
    calls: [],
    toolCall: null,
    approvalRequired: false,
    legalSignature: false,
    riskLevel: null,
    estimatedMinutes: 10,
    async: false,
    gap: null,
    ...over,
  })

  it('journeyStats counts routes, gates, and sums the corpus minutes', () => {
    const stats = journeyStats([
      step({}),
      step({ route: 'form', approvalRequired: true, estimatedMinutes: 30 }),
      step({ route: 'person', legalSignature: true, estimatedMinutes: 5 }),
      step({ route: 'person', async: true, estimatedMinutes: 2880 }),
    ])
    expect(stats).toEqual({
      totalSteps: 4,
      agentSteps: 1,
      formSteps: 1,
      personSteps: 2,
      legalSignatures: 1,
      approvals: 1,
      asyncSteps: 1,
      totalMinutes: 2925,
    })
  })

  it('dayOf is 1-based over 24h buckets', () => {
    expect(dayOf(0)).toBe(1)
    expect(dayOf(1439)).toBe(1)
    expect(dayOf(1440)).toBe(2)
  })
})

describe('year one — the operating rhythm, derived from live corpus cadence', () => {
  it('always includes every month-end-close and tax-season task, with corpus-true runs/yr', () => {
    for (const cid of YEAR_CHAIN_IDS) {
      const chain = chains.find((c) => c.id === cid)
      expect(chain, `chain ${cid} missing`).toBeDefined()
      for (const tid of chain!.taskIds) {
        const cand = candidates.find((c) => c.taskId === tid)
        expect(cand, `candidate ${tid} missing`).toBeDefined()
        expect(cand!.always).toBe(true)
        expect(cand!.runsPerYear).toBe(RUNS_PER_YEAR[corpusById.get(tid)!.cadence])
      }
    }
  })

  it('every candidate is calendar-recurring with a corpus-true route mix and ceiling', () => {
    expect(candidates.length).toBeGreaterThan(0)
    for (const c of candidates) {
      const t = corpusById.get(c.taskId)!
      expect(RUNS_PER_YEAR[c.cadence], `${c.taskId} is not calendar-recurring`).not.toBeNull()
      expect(c.cadence).toBe(t.cadence)
      expect(c.totalSteps).toBe(t.dag.nodes.length)
      expect(c.routes.agent + c.routes.form + c.routes.person).toBe(t.dag.nodes.length)
      expect(c.ceilingPct).toBe(taskCeiling(t).pct)
    }
  })

  it('rows gate on the journey: payroll with the hire, invoicing on the invoices fork, Type II/pen test with the enterprise motion', () => {
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      const rows = yearRows(combo, ids, candidates)
      const rowIds = new Set(rows.map((r) => r.taskId))
      expect(rowIds.size).toBe(rows.length)
      // The always-on operating spine.
      expect(rowIds.has('fin_002')).toBe(true)
      expect(rowIds.has('fin_003')).toBe(true)
      expect(rowIds.has('tax_001')).toBe(true)
      // The decision-gated recurring work.
      expect(rowIds.has('hr_002')).toBe(combo.hire === 'yes')
      expect(rowIds.has('sales_002')).toBe(combo.product === 'invoices')
      expect(rowIds.has('comp_002')).toBe(combo.enterprise === 'yes')
      expect(rowIds.has('comp_013')).toBe(combo.enterprise === 'yes')
    }
  })

  it('calendar slots: monthlies fill all 12 months, quarterlies land on quarter ends — pure cadence math', () => {
    const monthly = resolveYearMonths({ taskId: 'fin_002', cadence: 'monthly' }, DEFAULT_CHOICES)
    expect(monthly).toEqual({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], monthSource: 'cadence', monthNote: null })
    const quarterly = resolveYearMonths({ taskId: 'x', cadence: 'quarterly' }, DEFAULT_CHOICES)
    expect(quarterly.months).toEqual([3, 6, 9, 12])
    expect(quarterly.monthSource).toBe('cadence')
  })

  it('annuals: corpus-dated months only where the corpus carries them; the rest are seeded and labeled', () => {
    expect(resolveYearMonths({ taskId: 'tax_003', cadence: 'annual' }, DEFAULT_CHOICES)).toEqual({
      months: [1],
      monthSource: 'corpus',
      monthNote: CORPUS_ANNUAL_MONTHS.tax_003.note,
    })
    expect(resolveYearMonths({ taskId: 'tax_001', cadence: 'annual' }, DEFAULT_CHOICES).months).toEqual([3])
    // An annual the corpus does NOT date (the 1120): seeded month inside the year, deterministic,
    // and carrying the note the UI styles as seeded (fuchsia + data-synthetic, no visible label).
    const seeded = resolveYearMonths({ taskId: 'tax_002', cadence: 'annual' }, DEFAULT_CHOICES)
    expect(seeded.monthSource).toBe('seeded')
    expect(seeded.months.length).toBe(1)
    expect(seeded.months[0]).toBeGreaterThanOrEqual(1)
    expect(seeded.months[0]).toBeLessThanOrEqual(12)
    expect(seeded.monthNote).toContain('seeded')
    expect(resolveYearMonths({ taskId: 'tax_002', cadence: 'annual' }, DEFAULT_CHOICES)).toEqual(seeded)
  })

  it('the corpus really carries the dated months (tax-season chain tagline)', () => {
    const taxSeason = loadChains(DATA_DIR).find((c) => c.id === 'tax-season')!
    expect(taxSeason.tagline).toContain('January')
    expect(taxSeason.tagline).toContain('March 1')
    for (const tid of Object.keys(CORPUS_ANNUAL_MONTHS)) {
      expect(taxSeason.taskIds).toContain(tid)
    }
  })

  it('yearStats totals runs and step-executions honestly', () => {
    const row = (over: Partial<YearRow>): YearRow => ({
      taskId: 't', title: 'T', slug: 't', cadence: 'monthly', cadenceLabel: 'Monthly',
      totalSteps: 4, routes: { agent: 3, form: 1, person: 0, legalSignature: 0 }, ceilingPct: 75,
      runsPerYear: 12, always: true, gate: null, months: [1], monthSource: 'cadence', monthNote: null,
      ...over,
    })
    const stats = yearStats([
      row({}),
      row({ taskId: 'a', cadence: 'annual', cadenceLabel: 'Annual', runsPerYear: 1, totalSteps: 3, routes: { agent: 1, form: 1, person: 1, legalSignature: 0 } }),
    ])
    expect(stats).toEqual({ rows: 2, totalRuns: 13, stepRuns: 51, agentStepRuns: 37 })
  })
})

describe('preset example companies (founder ask 2026-09-25)', () => {
  it('exactly three presets carrying the briefed decision combos', () => {
    expect(VS_PRESETS.map((p) => p.id)).toEqual(['software', 'hardware', 'biotech'])
    const c = Object.fromEntries(VS_PRESETS.map((p) => [p.id, p.choices]))
    expect(c.software).toEqual({
      entity: 'c-corp', team: 'cofounders', funding: 'seed', product: 'subscriptions',
      ordering: 'name-first', hire: 'yes', compliance: 'later', enterprise: 'yes', ph: 'yes',
      remote: 'remote',
    })
    expect(c.hardware).toEqual({
      entity: 'c-corp', team: 'cofounders', funding: 'seed', product: 'invoices',
      ordering: 'build-first', hire: 'yes', compliance: 'later', enterprise: 'yes', ph: 'no',
      remote: 'remote',
    })
    // Combo update (round 5, item 3): biotech asserts the HIPAA framing — the same
    // set-up-compliance chain, framework named, run early.
    expect(c.biotech).toEqual({
      entity: 'c-corp', team: 'cofounders', funding: 'seed', product: 'invoices',
      ordering: 'name-first', hire: 'yes', compliance: 'hipaa', enterprise: 'yes', ph: 'no',
      remote: 'remote',
    })
  })

  it('functional-type labels (item 11, 2026-09-30): the pills name the kind of startup, never the fictional company; ids/tokens stay stable', () => {
    expect(VS_PRESETS.map((p) => p.label)).toEqual(['Typical software', 'Frontier hardware', 'Biotech'])
    for (const p of VS_PRESETS) {
      // The fake startup name left the label (the identity still themes the run's artifacts).
      expect(p.label).not.toContain(p.company.name)
    }
  })

  it('every preset journey is composed of real corpus tasks only', () => {
    for (const p of VS_PRESETS) {
      const ids = journeyTaskIds(p.choices, chains)
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) expect(corpusIds.has(id), `unknown ${id} in ${p.id}`).toBe(true)
    }
  })

  it('HONESTY LINE: hardware and biotech disclose the same-corpus limit; software needs none', () => {
    const by = Object.fromEntries(VS_PRESETS.map((p) => [p.id, p]))
    expect(by.software.disclosure).toBeNull()
    for (const id of ['hardware', 'biotech'] as const) {
      expect(by[id].disclosure).toContain('same real software-company process corpus')
      expect(by[id].disclosure).toContain('aren’t modeled yet')
      expect(by[id].disclosure).toContain('regulatory')
    }
    expect(by.hardware.disclosure).toContain('manufacturing')
    expect(by.biotech.disclosure).toContain('trials')
  })

  it('identity overrides the seeded name deterministically and flavors the existing artifacts', () => {
    for (const p of VS_PRESETS) {
      const co = synthCompany(p.choices, p.company)
      expect(co).toEqual(synthCompany(p.choices, p.company))
      expect(co.name).toBe(p.company.name)
      expect(co.display).toBe(`${p.company.name}, Inc.`) // all three presets are C-corps
      expect(co.descriptor).toBe(p.company.descriptor)
      const ids = journeyTaskIds(p.choices, chains)
      const byTask = buildJourneyArtifacts(p.choices, ids, { identity: p.company })
      expect(byTask).toEqual(buildJourneyArtifacts(p.choices, ids, { identity: p.company }))
      expect(byTask.brand_001?.[0].value).toBe(co.display)
      expect(byTask.domain_002?.[0].value).toContain(`${co.slug}.example`)
      expect(byTask.form_002?.[0].value).toBe('00-0000000') // impossible-real stays impossible-real
      for (const art of Object.values(byTask).flat()) expect(art.simulated).toBe(true)
    }
  })

  it('presetById resolves ids and rejects junk', () => {
    expect(presetById('hardware')?.company.name).toBe('Holofield')
    expect(presetById('software')?.company.name).toBe('Agentloop')
    expect(presetById('biotech')?.company.name).toBe('Demovax')
    expect(presetById('nope')).toBeNull()
    expect(presetById(null)).toBeNull()
  })
})

describe('funding scenarios (founder round 3, 2026-09-29: VC backed vs Bootstrapped)', () => {
  it('two scenarios spanning both sides of the funding decision; every asserted value is an existing DECISIONS option', () => {
    expect(VS_SCENARIOS.map((s) => s.id)).toEqual(['vc-backed', 'bootstrapped'])
    expect(VS_SCENARIOS.map((s) => s.asserts.funding).sort()).toEqual(['bootstrap', 'seed'])
    for (const s of VS_SCENARIOS) {
      // A scenario is about the funding decision first — that key is always asserted.
      expect(s.asserts.funding).toBeDefined()
      for (const [k, v] of Object.entries(s.asserts)) {
        const d = DECISIONS.find((x) => x.id === k)
        expect(d, `scenario ${s.id} asserts an unknown decision "${k}"`).toBeTruthy()
        expect(d!.options.map((o) => o.value)).toContain(v)
      }
      // A PARTIAL combo by design (unlike a company preset): some decisions stay unasserted.
      expect(Object.keys(s.asserts).length).toBeLessThan(DECISIONS.length)
    }
  })

  it('the pill tooltip documents the mapping — it names every asserted option by its full DECISIONS label', () => {
    for (const s of VS_SCENARIOS) {
      for (const [k, v] of Object.entries(s.asserts)) {
        const label = DECISIONS.find((x) => x.id === k)!.options.find((o) => o.value === v)!.label
        expect(s.tooltip, `scenario ${s.id} tooltip must document "${label}"`).toContain(label)
      }
      // …and says the rest of the setup is untouched (partial-assert honesty).
      expect(s.tooltip).toContain('Every other decision keeps its current setting')
    }
  })

  it('scenarioById resolves ids, rejects junk, and the ?preset= namespace never collides with company presets', () => {
    expect(scenarioById('vc-backed')?.label).toBe('VC backed')
    expect(scenarioById('bootstrapped')?.label).toBe('Bootstrapped')
    expect(scenarioById('nope')).toBeNull()
    expect(scenarioById(null)).toBeNull()
    for (const p of VS_PRESETS) expect(scenarioById(p.id)).toBeNull()
    for (const s of VS_SCENARIOS) expect(presetById(s.id)).toBeNull()
  })
})

describe('YC batch mode — calibration, published deal, honesty', () => {
  it('applyYcCalibration forces seed + PH launch + build-first and touches nothing else', () => {
    expect(Object.keys(YC_CALIBRATION).sort()).toEqual(['funding', 'ordering', 'ph'])
    for (const combo of combos) {
      const c = applyYcCalibration(combo)
      expect(c.funding).toBe('seed')
      expect(c.ph).toBe('yes')
      expect(c.ordering).toBe('build-first')
      expect({ ...c, funding: combo.funding, ph: combo.ph, ordering: combo.ordering }).toEqual(combo)
    }
  })

  it('yc journeys ONLY rearrange — the same real tasks as the plain calibrated combo', () => {
    for (const combo of combos) {
      const c = applyYcCalibration(combo)
      const plain = journeyTaskIds(c, chains)
      const ycIds = journeyPhases(c, chains, { yc: true }).flatMap((p) => p.taskIds)
      expect([...ycIds].sort()).toEqual([...plain].sort())
    }
  })

  it('the raise compresses to Demo-Day timing: after launch day, before the enterprise close', () => {
    const c = applyYcCalibration({ ...DEFAULT_CHOICES, enterprise: 'yes' })
    const phases = journeyPhases(c, chains, { yc: true })
    const idx = (id: string) => phases.findIndex((p) => p.chainId === id)
    expect(idx('raise-a-seed-round')).toBeGreaterThan(idx('launch-on-product-hunt'))
    expect(idx('raise-a-seed-round')).toBeLessThan(idx('land-the-enterprise-deal'))
    expect(phases[phases.length - 1].chainId).toBe('land-the-enterprise-deal')
    expect(phases.find((p) => p.chainId === 'raise-a-seed-round')!.note).toContain('Demo-Day')
    // Without yc the raise stays in its classic early slot.
    const plain = journeyPhases(c, chains)
    expect(plain.findIndex((p) => p.chainId === 'raise-a-seed-round')).toBeLessThan(
      plain.findIndex((p) => p.chainId === 'launch-on-product-hunt'),
    )
  })

  it('the standard published YC deal replaces ONLY the fund_001 SAFE numbers — still SIMULATED', () => {
    const c = applyYcCalibration(DEFAULT_CHOICES)
    const ids = journeyTaskIds(c, chains)
    const plain = buildJourneyArtifacts(c, ids)
    const ycArts = buildJourneyArtifacts(c, ids, { yc: true })
    expect(ycArts.fund_001?.[0].value).toBe(YC_DEAL.value)
    expect(ycArts.fund_001?.[0].value).toContain('$125,000 for 7%')
    expect(ycArts.fund_001?.[0].value).toContain('$375,000')
    expect(ycArts.fund_001?.[0].value.toLowerCase()).toContain('mfn')
    expect(ycArts.fund_001?.[0].simulated).toBe(true)
    for (const [tid, arts] of Object.entries(ycArts)) {
      if (tid === 'fund_001') continue
      expect(arts, `yc mode altered ${tid}`).toEqual(plain[tid])
    }
  })

  it('the batch shape is disclosed synthetic/non-affiliated; office hours is synthetic, never a corpus process', () => {
    expect(YC_BATCH.disclosure).toContain('not affiliated with or endorsed by Y Combinator')
    expect(YC_BATCH.disclosure.toLowerCase()).toContain('synthetic')
    expect(YC_BATCH.officeHours.runsPerBatch).toBe(YC_BATCH.weeks)
    const titles = new Set([...corpusById.values()].map((t) => t.title))
    expect(titles.has(YC_BATCH.officeHours.title)).toBe(false)
  })
})

describe('cadence sweep + event-driven examples (richer rhythm, 2026-09-25)', () => {
  it('every sweep key is a real calendar-recurring corpus task, disjoint from the journey union', () => {
    const union = new Set(unionTaskIds(chains))
    for (const [id, gate] of Object.entries(YEAR_SWEEP_GATES)) {
      const t = corpusById.get(id)
      expect(t, `unknown sweep task ${id}`).toBeDefined()
      expect(RUNS_PER_YEAR[t!.cadence], `${id} is not calendar-recurring`).not.toBeNull()
      expect(union.has(id), `${id} is journey-carried — journey gating owns it`).toBe(false)
      expect(gate.why.length).toBeGreaterThan(0)
    }
  })

  it('sweeps EVERY calendar-recurring corpus process except the VC-fund back office', () => {
    const covered = new Set(candidates.map((c) => c.taskId))
    for (const t of corpusById.values()) {
      if (RUNS_PER_YEAR[t.cadence] === null) continue
      if (t.id === 'vc_003') {
        // launch-a-vc-fund playbook — not something a startup's journey activates.
        expect(covered.has(t.id)).toBe(false)
        continue
      }
      expect(covered.has(t.id), `calendar-recurring ${t.id} (${t.title}) missing from the year sweep`).toBe(true)
    }
  })

  // 90s: exhaustive 122,880-combo sweep — flaked at 30s under multi-lane load (2026-10-02).
  it('sweep rows gate on the decisions that plausibly activate them', { timeout: 90000 }, () => {
    for (const combo of combos) {
      const rows = new Set(yearRows(combo, journeyTaskIds(combo, chains), candidates).map((r) => r.taskId))
      for (const id of ['opp_008', 'opp_009', 'sw_001', 'sw_002', 'growth_011', 'growth_012', 'opp_012', 'fin_010', 'ins_001', 'qs_045', 'qs_047']) {
        expect(rows.has(id), `${id} should be always-on`).toBe(true)
      }
      expect(rows.has('scale_001')).toBe(combo.hire === 'yes')
      expect(rows.has('scale_012')).toBe(combo.hire === 'yes')
      expect(rows.has('comp_011')).toBe(combo.funding === 'seed')
      expect(rows.has('scale_005')).toBe(combo.funding === 'seed')
      expect(rows.has('fund_003')).toBe(combo.funding === 'seed')
      expect(rows.has('qs_053')).toBe(combo.funding === 'seed')
      expect(rows.has('growth_015')).toBe(combo.product === 'subscriptions')
      expect(rows.has('vc_003')).toBe(false)
    }
  })

  it('sweep completeness: every cadence-bearing journey task appears in year one', () => {
    for (const combo of combos) {
      const ids = journeyTaskIds(combo, chains)
      const rows = new Set(yearRows(combo, ids, candidates).map((r) => r.taskId))
      for (const id of ids) {
        if (RUNS_PER_YEAR[corpusById.get(id)!.cadence] === null) continue
        expect(rows.has(id), `journey task ${id} missing from year one`).toBe(true)
      }
    }
  })

  it('event examples: real event-driven corpus tasks with named triggers, gated per combo', () => {
    const examples = buildEventExamples(sources)
    expect(examples.length).toBe(Object.keys(EVENT_EXAMPLES).length)
    for (const e of examples) {
      expect(corpusById.get(e.taskId)!.cadence).toBe('event-driven')
      expect(e.trigger.length).toBeGreaterThan(0)
      expect(e.gate.why.length).toBeGreaterThan(0)
    }
    for (const combo of combos) {
      const on = new Set(eventRows(combo, examples).map((e) => e.taskId))
      expect(on.has('opp_001')).toBe(true)
      expect(on.has('opp_004')).toBe(true)
      expect(on.has('growth_002')).toBe(combo.product === 'subscriptions')
      expect(on.has('hr_005')).toBe(combo.hire === 'yes')
      expect(on.has('opp_007')).toBe(combo.hire === 'yes')
      expect(on.has('legal_001')).toBe(combo.enterprise === 'yes')
      expect(on.has('comp_014')).toBe(combo.enterprise === 'yes')
      expect(on.has('qs_052')).toBe(combo.funding === 'seed')
    }
  })

  it('event examples throw on an unknown task rather than inventing a row', () => {
    expect(() => buildEventExamples(sources.filter((s) => s.taskId !== 'opp_001'))).toThrow(/opp_001/)
  })
})

describe('first 30 / first 90 days — cadence-math slicing', () => {
  const rows = yearRows(DEFAULT_CHOICES, journeyTaskIds(DEFAULT_CHOICES, chains), candidates)

  it('day intervals are the standard conventions; annual and event-driven work carries no day', () => {
    expect(WINDOW_INTERVAL_DAYS).toEqual({
      daily: 1, weekly: 7, monthly: 30, quarterly: 90, annual: null, 'event-driven': null, once: null,
    })
  })

  it('30-day window: dailies from day 1, weeklies ×4, first month-end close and first payroll land at day 30', () => {
    const w = windowRows(rows, 30)
    const by = new Map(w.map((r) => [r.taskId, r]))
    expect(by.get('sw_001')).toMatchObject({ firstRunDay: 1, runsInWindow: 30 })
    expect(by.get('sw_002')).toMatchObject({ firstRunDay: 7, runsInWindow: 4 })
    expect(by.get('fin_002')).toMatchObject({ firstRunDay: 30, runsInWindow: 1 })
    expect(by.get('hr_002')).toMatchObject({ firstRunDay: 30, runsInWindow: 1 }) // DEFAULT hire = yes
    for (const r of w) expect(['daily', 'weekly', 'monthly'].includes(r.cadence), r.taskId).toBe(true)
  })

  it('90-day window: monthlies ×3, quarterlies land once at day 90, annuals still excluded', () => {
    const w = windowRows(rows, 90)
    const by = new Map(w.map((r) => [r.taskId, r]))
    expect(by.get('fin_002')).toMatchObject({ firstRunDay: 30, runsInWindow: 3 })
    const quarterly = w.filter((r) => r.cadence === 'quarterly')
    expect(quarterly.length).toBeGreaterThan(0) // DEFAULT funding = seed → board cadence
    for (const q of quarterly) expect(q).toMatchObject({ firstRunDay: 90, runsInWindow: 1 })
    expect(w.some((r) => r.cadence === 'annual')).toBe(false)
    expect(w[0].firstRunDay).toBe(1) // sorted: the day-1 loops lead
  })

  it('windows replay deterministically from the same rows', () => {
    expect(windowRows(rows, 30)).toEqual(windowRows(rows, 30))
    expect(windowRows(rows, 90)).toEqual(windowRows(rows, 90))
  })
})

describe("'Start with' leaves the control panel (round 5, item 4)", () => {
  it('ordering is the hidden decision: the DECISIONS entry (and codec slot) stays, composition keeps the default, presets/YC keep asserting it', () => {
    expect(HIDDEN_DECISION_IDS).toEqual(['ordering'])
    // The codec slot survives: the decision is still a DECISIONS entry with both options.
    const ordering = DECISIONS.find((d) => d.id === 'ordering')!
    expect(ordering.options.map((o) => o.value)).toEqual(['name-first', 'build-first'])
    // Composition keeps the default when unasserted…
    expect(DEFAULT_CHOICES.ordering).toBe('name-first')
    // …and presets/YC still assert it internally.
    expect(YC_CALIBRATION.ordering).toBe('build-first')
    for (const p of VS_PRESETS) expect(['name-first', 'build-first']).toContain(p.choices.ordering)
  })
})

describe("'Likely choice' ordering (round 5, item 7) — committed signals, presentation only", () => {
  const p = (id: string, name: string, over: Partial<Parameters<typeof likelyChoiceOrder>[0][number]> = {}) => ({
    id, name, curated: false, ...over,
  })

  it('tiers: curated clearly-popular first (measured counters, then A–Z inside the unranked set), then stars, then installs, then the judged input order', () => {
    const order = likelyChoiceOrder([
      p('bitbucket', 'Bitbucket'), // no signal — judged order kept at the tail
      p('gitea', 'Gitea', { stars: 58195 }),
      p('gitlab', 'GitLab', { curated: true }),
      p('github', 'GitHub', { curated: true }),
      p('some-sdk', 'Some SDK', { installs: 120000 }),
      p('zzz-tool', 'ZZZ Tool'), // second signal-less product — stays after bitbucket (input order)
    ])
    expect(order).toEqual(['github', 'gitlab', 'gitea', 'some-sdk', 'bitbucket', 'zzz-tool'])
    // Within the curated (unranked) tier, a measured counter outranks the alphabetical fallback.
    expect(
      likelyChoiceOrder([p('a-tool', 'A Tool', { curated: true }), p('z-tool', 'Z Tool', { curated: true, stars: 10 })]),
    ).toEqual(['z-tool', 'a-tool'])
  })

  it('orderByLikelyChoice reorders presentation only: same members, same judged scores, unknown ids keep judged order at the tail; no order = judged order', () => {
    const vendors = [
      { productId: 'bitbucket', score: 80 },
      { productId: 'gitea', score: 30 },
      { productId: 'github', score: 24 },
      { productId: 'gitlab', score: 18 },
    ]
    const ordered = orderByLikelyChoice(vendors, ['github', 'gitlab', 'gitea'])
    expect(ordered.map((v) => v.productId)).toEqual(['github', 'gitlab', 'gitea', 'bitbucket'])
    // NO rank fabrication: the judged scores ride along untouched.
    expect(ordered.find((v) => v.productId === 'github')!.score).toBe(24)
    expect([...ordered].sort((a, b) => b.score - a.score)[0].productId).toBe('bitbucket')
    expect(orderByLikelyChoice(vendors, undefined)).toEqual(vendors)
    expect(orderByLikelyChoice(vendors, [])).toEqual(vendors)
  })
})

describe('repo CTA removed from the simulator page (founder 2026-10-01)', () => {
  it('the page carries no repo CTA — the header nav repo link covers it', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/startup-sim/page.tsx'), 'utf8')
    expect(src).not.toContain('vs-repo-cta')
    expect(src).not.toContain('Take part in the open startup repo')
    expect(src.indexOf('The open startup simulator</h1>')).toBeGreaterThan(-1)
  })
})

describe('discoverability wiring', () => {
  it('/startup-sim is a ⌘K page entry with committed aliases', () => {
    const entry = buildPageEntries(searchAliases.pages as Record<string, string[]>).find(
      (e) => e.href === '/startup-sim',
    )
    expect(entry?.label).toBe('Open Startup Sim') // renamed from 'The Open Startup' (founder 2026-10-02)
    expect(entry?.keywords).toContain('virtual startup')
  })
})

describe("the 'Apply to YC' composition (founder 2026-10-01, item 6) — against the live corpus", () => {
  it('fund_007 is a real, committed corpus process with https-cited YC sources and honest routes', () => {
    const task = corpusById.get(YC_APPLY_TASK_ID)
    expect(task, 'the Apply-to-YC process must exist in processes/corpus.json').toBeTruthy()
    expect(task!.title).toBe('Apply to Y Combinator')
    // Every cited step URL is https and on YC's own domains — the application guidance itself.
    const urls = task!.dag.nodes.flatMap((n) => (n.actionUrl ? [n.actionUrl] : []))
    expect(urls.length).toBeGreaterThanOrEqual(3)
    for (const u of urls) expect(u).toMatch(/^https:\/\/(www\.|apply\.)?ycombinator\.com\//)
    // Honest routes: the written answers and the founder video are person steps; the decision
    // wait is async; nothing pretends an agent can apply for you.
    const byLabel = (frag: string) => task!.dag.nodes.find((n) => n.label.includes(frag))!
    expect(byLabel('written application').route).toBe('person')
    expect(byLabel('founder video').route).toBe('person')
    expect(byLabel('Wait for the decision').async).toBe(true)
    expect(task!.supportLevel).toBe('manual_guide')
  })

  it('journeyPhases composes the application as its own CHAINLESS phase right after formation — the ops_014 office pattern — and only when asked', () => {
    const off = journeyPhases(DEFAULT_CHOICES, chains)
    expect(off.some((p) => p.id === 'yc-apply')).toBe(false)
    const on = journeyPhases(DEFAULT_CHOICES, chains, { ycApply: true })
    const phase = on.find((p) => p.id === 'yc-apply')!
    expect(phase.taskIds).toEqual([YC_APPLY_TASK_ID])
    expect(phase.chainId).toBe('') // a single committed process, never a fake chain
    expect(phase.note).toContain('not a curated chain')
    expect(phase.note).toContain('not affiliated with or endorsed by Y Combinator')
    const idx = (id: string) => on.findIndex((p) => p.id === id)
    expect(idx('yc-apply')).toBe(idx('form') + 1)
    // Everything else composes identically — the phase is purely additive.
    expect(on.filter((p) => p.id !== 'yc-apply')).toEqual(off)
    // It composes with YC batch mode independently (the calibration reshapes, the checkbox adds).
    expect(journeyPhases(applyYcCalibration(DEFAULT_CHOICES), chains, { yc: true, ycApply: true }).some((p) => p.id === 'yc-apply')).toBe(true)
  })

  it('the union precomputes its payload and its artifact prints simulated, never claiming acceptance', () => {
    expect(unionTaskIds(chains)).toContain(YC_APPLY_TASK_ID)
    const taskIds = journeyPhases(DEFAULT_CHOICES, chains, { ycApply: true }).flatMap((p) => p.taskIds)
    const arts = buildJourneyArtifacts(DEFAULT_CHOICES, taskIds)
    const art = arts[YC_APPLY_TASK_ID]?.[0]
    expect(art?.simulated).toBe(true)
    expect(art?.label).toBe('YC application')
    expect(art?.value).toContain('submitted')
    expect(art?.value).not.toMatch(/accepted/i)
    // Constant draft (the ops_014 convention): no other artifact's seeded stream shifts — the
    // shared artifacts are byte-identical with and without the application phase.
    const base = buildJourneyArtifacts(DEFAULT_CHOICES, journeyTaskIds(DEFAULT_CHOICES, chains))
    for (const [id, a] of Object.entries(base)) {
      expect(arts[id], `artifact set for ${id}`).toEqual(a)
    }
  })
})
