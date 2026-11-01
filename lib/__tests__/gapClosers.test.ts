import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyGapStep, CLOSER_RULES, type GapStep, IRREDUCIBLE_REASON, resolveGapStep, splitGaps,
} from '@/lib/gapClosers'
import { buildSimSteps, loadProcesses } from '@/lib/processes'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

const step = (label: string, route: GapStep['route'] = 'form', async?: boolean): GapStep =>
  ({ label, route, async })

describe('classifyGapStep — keyword routing (pure, no disk)', () => {
  it('never classifies agent steps', () => {
    expect(classifyGapStep(step('File on Delaware portal', 'agent'))).toBeNull()
  })

  it('keeps neutral tax-adviser labels in the professional-review category', () => {
    for (const label of ['The tax adviser prepares the company return', 'The tax adviser files the company return']) {
      expect(classifyGapStep(step(label, 'person'))?.kind).toBe('irreducible')
    }
  })

  it('marks form portal/filing/signup/provisioning steps computer-use candidates (browser-agents) with the assisted caution', () => {
    for (const label of [
      'File on Delaware portal',
      'Submit incorporation filing',
      'Complete IRS SS-4 form online',
      'Publish to website',
      'Configure project in cloud console',
      'Create Workspace user',
      'Create company email',
      'Create Slack workspace',
      'Set up benefits enrollment',
    ]) {
      const cls = classifyGapStep(step(label, 'form'))
      expect(cls?.kind, label).toBe('closer')
      if (cls?.kind !== 'closer') continue
      expect(cls.arenaId).toBe('browser-agents')
      expect(cls.fallbackArenaId).toBe('web-scraping')
      expect(cls.blurb).toMatch(/computer-use candidate/)
      expect(cls.caution).toMatch(/assisted, not autonomous/)
      expect(cls.caution).toMatch(/verify the portal/)
    }
  })

  it('the browser rule is form-only — a person-routed filing is not a portal to drive', () => {
    // person + async → the third-party-wait watcher rule, not the browser rule
    const cls = classifyGapStep(step('File 83(b) election with IRS', 'person', true))
    expect(cls?.kind === 'closer' && cls.arenaId).toBe('workflow-automation')
  })

  it('routes signature/NDA/agreement steps to legal-ops e-sign', () => {
    for (const label of ['Countersign the NDA', 'Sign the SAFE agreement', 'Adopt bylaws & initial resolutions']) {
      const cls = classifyGapStep(step(label, 'form'))
      expect(cls?.kind === 'closer' && cls.arenaId, label).toBe('legal-ops')
    }
  })

  it('"sign up" is account creation, not a signature', () => {
    const cls = classifyGapStep(step('Sign up and provide details', 'person'))
    expect(cls?.kind === 'closer' && cls.arenaId).not.toBe('legal-ops')
  })

  it('routes waits/turnaround/async steps to workflow-automation watchers', () => {
    expect(classifyGapStep(step('Wait for valuation report (2-3 weeks)', 'person', true)))
      .toMatchObject({ kind: 'closer', arenaId: 'workflow-automation' })
    expect(classifyGapStep(step('Receive Certificate of Incorporation', 'person', true)))
      .toMatchObject({ kind: 'closer', arenaId: 'workflow-automation' })
  })

  it('routes phone/call steps to voice-agents', () => {
    expect(classifyGapStep(step('Schedule call', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'voice-agents' })
  })

  it('routes person research/compare/find steps to ai-research-agents', () => {
    expect(classifyGapStep(step('Get quotes from providers', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-research-agents' })
    expect(classifyGapStep(step('Research and compare vendors', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-research-agents' })
  })

  it('routes person drafting/data-entry steps to ai-assistants', () => {
    expect(classifyGapStep(step('Draft the investor update', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-assistants' })
    expect(classifyGapStep(step('Answer valuation questionnaire', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-assistants' })
  })

  it('marks pure judgment/identity steps irreducible — never oversold, even with closer keywords', () => {
    for (const label of [
      'Board approves grant',
      'Complete KYC and verify identity',
      'Notarized signature', // notarize beats the e-sign rule
      'Review and approve 1099s',
      'Attorney sign-off',
      'Initiate wire/ACH (approval)',
    ]) {
      expect(classifyGapStep(step(label, 'person')), label)
        .toEqual({ kind: 'irreducible', reason: IRREDUCIBLE_REASON })
    }
  })

  it('routes cap-table paperwork to equity-management (board still approves)', () => {
    for (const label of ['Issue founder stock', 'Prepare stock option paperwork']) {
      expect(classifyGapStep(step(label, 'form')), label)
        .toMatchObject({ kind: 'closer', arenaId: 'equity-management' })
    }
  })

  it('routes manual code changes (install SDK, add snippet) to ai-coding', () => {
    expect(classifyGapStep(step('Install SDK in codebase', 'form')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-coding' })
  })

  it('routes choose/select steps to ai-research-agents on either non-agent route', () => {
    expect(classifyGapStep(step('Choose formation service', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-research-agents' })
    expect(classifyGapStep(step('Choose bank provider', 'person')))
      .toMatchObject({ kind: 'closer', arenaId: 'ai-research-agents' })
  })

  it('returns null for gaps no rule honestly covers', () => {
    expect(classifyGapStep(step('Collect company property', 'person'))).toBeNull()
  })
})

describe('resolveGapStep — live-arena binding', () => {
  it('resolves against an arena only when it is live, else skips (rule keyed by arena id)', () => {
    const liveIds = new Set(
      (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'categories.json'), 'utf8')) as Array<{ id: string }>).map((c) => c.id),
    )
    const voice = resolveGapStep(step('Schedule call', 'person'), DATA_DIR)
    if (liveIds.has('voice-agents')) expect(voice?.kind).toBe('closer')
    else expect(voice).toBeNull()
    const watcher = resolveGapStep(step('Wait for quotes (3-5 days)', 'person', true), DATA_DIR)
    if (liveIds.has('workflow-automation')) {
      expect(watcher?.kind).toBe('closer')
      if (watcher?.kind === 'closer') expect(watcher.closer.arenaId).toBe('workflow-automation')
    } else expect(watcher).toBeNull()
  })

  it('portal steps resolve to browser-agents when live, else the web-scraping fallback — blurb and caution intact', () => {
    const liveIds = new Set(
      (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'categories.json'), 'utf8')) as Array<{ id: string }>).map((c) => c.id),
    )
    const res = resolveGapStep(step('File on Delaware portal', 'form'), DATA_DIR)
    expect(res?.kind).toBe('closer')
    if (res?.kind !== 'closer') return
    expect(res.closer.arenaId).toBe(liveIds.has('browser-agents') ? 'browser-agents' : 'web-scraping')
    expect(res.closer.blurb).toMatch(/browser agent/)
    expect(res.closer.caution).toMatch(/verify the portal/)
    // topProduct is the arena's live #1 by agent-readiness
    expect(res.closer.topProduct.id).toBeTruthy()
    expect(res.closer.topProduct.agentReady).not.toBeNull()
  })

  it('resolves live arenas to their top product by agentReady', () => {
    const res = resolveGapStep(step('Countersign the NDA', 'form'), DATA_DIR)
    expect(res?.kind).toBe('closer')
    if (res?.kind !== 'closer') return
    expect(res.closer.arenaId).toBe('legal-ops')
    expect(res.closer.arenaName).toBeTruthy()
    const scores = [res.closer.topProduct.agentReady]
    expect(scores[0]).not.toBeNull()
  })

  it('passes irreducible markers through untouched', () => {
    expect(resolveGapStep(step('Board approves grant', 'person'), DATA_DIR))
      .toEqual({ kind: 'irreducible', reason: IRREDUCIBLE_REASON })
  })
})

describe('splitGaps — the sharper ceiling story', () => {
  it('buckets closable vs irreducible vs no-workaround-yet and collects arenas', () => {
    const split = splitGaps([
      step('Draft the API integration', 'agent'), // agent steps never appear in the split
      step('File on Delaware portal', 'form'),
      step('Countersign the NDA', 'form'),
      step('Board approves grant', 'person'),
      step('Collect company property', 'person'),
      step('Schedule call', 'person'), // voice-agents rule — closable now that arena is live
    ], DATA_DIR)
    expect(split.closable.map((g) => g.closer.arenaId)).toEqual(['browser-agents', 'legal-ops', 'voice-agents'])
    expect(split.arenas.length).toBe(3)
    expect(split.human.filter((g) => g.irreducible).map((g) => g.label)).toEqual(['Board approves grant'])
    expect(split.human.filter((g) => !g.irreducible).map((g) => g.label))
      .toEqual(['Collect company property'])
    // every human gap keeps its honest why
    for (const g of split.human) expect(g.why).toMatch(/human or computer use|manual form/)
  })

  it('corpus-wide: every non-agent step lands in exactly one bucket and some are closable', () => {
    const tasks = loadProcesses(DATA_DIR)
    const nodes = tasks.flatMap((t) => t.dag.nodes)
    const gapCount = nodes.filter((n) => n.route !== 'agent').length
    const split = splitGaps(nodes, DATA_DIR)
    expect(split.closable.length + split.human.length).toBe(gapCount)
    expect(split.closable.length).toBeGreaterThan(0)
    expect(split.human.some((g) => g.irreducible)).toBe(true)
  })
})

describe('buildSimSteps carries pre-resolved gap closers (serialized props)', () => {
  it('attaches a closer to a form-portal step and stays plain JSON', () => {
    const tasks = loadProcesses(DATA_DIR)
    const franchise = tasks.find((t) => t.id === 'tax_001')!
    const steps = buildSimSteps([franchise], DATA_DIR)
    const portal = steps.find((s) => s.label === 'File on Delaware portal')!
    expect(portal.gap?.kind).toBe('closer')
    if (portal.gap?.kind === 'closer') {
      expect(portal.gap.closer.caution).toMatch(/assisted, not autonomous/)
    }
    for (const s of steps.filter((x) => x.route === 'agent')) expect(s.gap).toBeNull()
    expect(JSON.parse(JSON.stringify(steps))).toEqual(steps)
  })
})

describe('rule table hygiene', () => {
  it('rule ids are unique and every rule names an arena', () => {
    const ids = CLOSER_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of CLOSER_RULES) expect(r.arenaId).toBeTruthy()
  })
})
