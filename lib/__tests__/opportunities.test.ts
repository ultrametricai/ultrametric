import { describe, expect, it } from 'vitest'
import {
  AGENTIC_BOOST,
  OPPORTUNITY_CAP,
  opportunitiesFor,
  opportunityImpact,
  opportunityWhy,
  scoreLeverFor,
} from '@/lib/opportunities'
import type { Story, Verdict } from '@/lib/schemas'

const story = (id: string, over: Partial<Story> = {}): Story => ({
  id,
  persona: 'dev',
  title: `As a dev, I want to do ${id}`,
  theme: 'core',
  group: 'core',
  weight: 2,
  ...over,
})

const verdict = (storyId: string, over: Partial<Verdict> = {}): Verdict => ({
  productId: 'p',
  storyId,
  verdict: 'partial',
  quality: 5,
  confidence: 'high',
  rationale: 'Works in part. missing for 10: a documented bulk endpoint.',
  evidenceIds: ['e1'],
  ...over,
})

describe('scoreLeverFor', () => {
  it('maps the three index-feeding agenticness groups to their index', () => {
    expect(scoreLeverFor({ theme: 'agenticness', group: 'agent-access' })).toBe('agent-ready')
    expect(scoreLeverFor({ theme: 'agenticness', group: 'agentic-features' })).toBe('Built-in AI')
    expect(scoreLeverFor({ theme: 'agenticness', group: 'api-quality' })).toBe('API quality')
  })

  it('everything else moves the Agentic score blend', () => {
    expect(scoreLeverFor({ theme: 'openness', group: 'openness' })).toBe('Agentic score')
    // Same group name under a NON-agenticness theme must not claim the index (mirrors
    // lib/scoring.ts's theme+group filter).
    expect(scoreLeverFor({ theme: 'other', group: 'agent-access' })).toBe('Agentic score')
  })
})

describe('opportunityImpact', () => {
  it('is weight × (10 − quality) for plain stories', () => {
    expect(opportunityImpact({ weight: 2, theme: 'core', group: 'core' }, 4)).toBe(12)
  })

  it('boosts index-feeding agenticness stories by AGENTIC_BOOST', () => {
    expect(opportunityImpact({ weight: 2, theme: 'agenticness', group: 'agent-access' }, 4)).toBe(
      2 * 6 * AGENTIC_BOOST,
    )
  })
})

describe('opportunityWhy', () => {
  it('pulls the judge\'s "missing for 10:" clause when present', () => {
    expect(opportunityWhy('Great start. missing for 10: webhook retries, an event log.')).toBe(
      'Missing: webhook retries, an event log.',
    )
  })

  it('accepts the "Missing for a 10:" spelling and adds a terminal period', () => {
    expect(opportunityWhy('Solid. Missing for a 10: An SDK')).toBe('Missing: an SDK.')
  })

  it('falls back to the first sentence when no clause exists', () => {
    expect(opportunityWhy('No evidence of any API. The docs cover UI only.')).toBe('No evidence of any API.')
  })
})

describe('opportunitiesFor', () => {
  it('includes only none/partial verdicts — never full, na, or disputed', () => {
    const stories = ['a', 'b', 'c', 'd', 'e'].map((id) => story(id))
    const verdicts = [
      verdict('a', { verdict: 'full', quality: 9 }),
      verdict('b', { verdict: 'partial', quality: 6 }),
      verdict('c', { verdict: 'none', quality: 0 }),
      verdict('d', { verdict: 'na', quality: 0 }),
      verdict('e', { verdict: 'disputed', quality: 3 }),
    ]
    const report = opportunitiesFor({ stories, verdicts }, 'p')
    expect(report.opportunities.map((o) => o.storyId).sort()).toEqual(['b', 'c'])
    expect(report.total).toBe(2)
    expect(report.truncated).toBe(false)
  })

  it('ignores other products\' verdicts', () => {
    const report = opportunitiesFor(
      { stories: [story('a')], verdicts: [verdict('a', { productId: 'other', verdict: 'none', quality: 0 })] },
      'p',
    )
    expect(report.total).toBe(0)
  })

  it('ranks by impact: none beats partial at equal weight, boosted agentic stories jump ahead', () => {
    const stories = [
      story('plain-none'), // impact 2×10 = 20
      story('plain-partial'), // impact 2×5 = 10
      story('agentic-partial', { theme: 'agenticness', group: 'agent-access', weight: 2 }), // 2×5×1.5 = 15
    ]
    const verdicts = [
      verdict('plain-none', { verdict: 'none', quality: 0 }),
      verdict('plain-partial'),
      verdict('agentic-partial'),
    ]
    const report = opportunitiesFor({ stories, verdicts }, 'p')
    expect(report.opportunities.map((o) => o.storyId)).toEqual(['plain-none', 'agentic-partial', 'plain-partial'])
    expect(report.opportunities[1].scoreLever).toBe('agent-ready')
    expect(report.opportunities[2].scoreLever).toBe('Agentic score')
  })

  it('renders the action-form title, not the persona frame', () => {
    const report = opportunitiesFor(
      { stories: [story('a')], verdicts: [verdict('a', { verdict: 'none', quality: 0 })] },
      'p',
    )
    expect(report.opportunities[0].title).toBe('Do a')
  })

  it(`caps at ${OPPORTUNITY_CAP} and reports truncation`, () => {
    const stories = Array.from({ length: 12 }, (_, i) => story(`s${i}`))
    const verdicts = stories.map((s) => verdict(s.id, { verdict: 'none', quality: 0 }))
    const report = opportunitiesFor({ stories, verdicts }, 'p')
    expect(report.opportunities).toHaveLength(OPPORTUNITY_CAP)
    expect(report.total).toBe(12)
    expect(report.truncated).toBe(true)
  })

  it('is deterministic on ties (storyId order)', () => {
    const stories = [story('zeta'), story('alpha')]
    const verdicts = [verdict('zeta', { verdict: 'none', quality: 0 }), verdict('alpha', { verdict: 'none', quality: 0 })]
    const report = opportunitiesFor({ stories, verdicts }, 'p')
    expect(report.opportunities.map((o) => o.storyId)).toEqual(['alpha', 'zeta'])
  })
})
