import { describe, expect, it } from 'vitest'
import {
  checklistMarkdown, checklistThemes, checklistWhy, priorityForWeight, storyPassStats,
} from '@/lib/checklist'
import type { CategoryData } from '@/lib/data-helpers'
import type { Story, Verdict } from '@/lib/schemas'

function story(id: string, theme: string, weight: number, capability = id.replace(/-/g, ' ')): Story {
  return { id, persona: 'a developer', title: `As a developer, I can ${capability}`, theme, group: theme, weight }
}

function verdict(productId: string, storyId: string, tier: Verdict['verdict']): Verdict {
  return { productId, storyId, verdict: tier, quality: tier === 'full' ? 8 : 0, confidence: 'high', rationale: 'r', evidenceIds: tier === 'full' ? ['e1'] : [] }
}

const stories = [
  story('take-payment', 'checkout', 3),
  story('refund', 'checkout', 1),
  story('instant-payout', 'payouts', 2),
]

const data: CategoryData = {
  category: { id: 'pay', name: 'Payments', description: '', personas: ['a developer'] },
  products: [
    { id: 'x', name: 'X', vendor: 'v', type: 'oss', urls: { site: 'https://example.com/x' } },
  ],
  stories,
  evidence: {},
  verdicts: [
    verdict('x', 'take-payment', 'full'),
    verdict('x', 'refund', 'na'),
    verdict('x', 'instant-payout', 'none'),
  ],
  rankings: { generatedAt: '2026-01-01T00:00:00.000Z', leaderboard: [], battles: [] },
  stacks: [],
  popularity: {},
  claims: {},
  uncertainty: [],
  vendorResponses: [],
  certifications: [],
}

describe('priorityForWeight', () => {
  it('maps the 3/2/1 story weights to buyer priorities', () => {
    expect(priorityForWeight(3)).toBe('must-have')
    expect(priorityForWeight(2)).toBe('should-have')
    expect(priorityForWeight(1)).toBe('nice-to-have')
  })
})

describe('checklistThemes', () => {
  it('groups by theme in first-seen order, heaviest first within a theme', () => {
    const themes = checklistThemes(stories)
    expect(themes.map(([t]) => t)).toEqual(['checkout', 'payouts'])
    expect(themes[0][1].map((s) => s.id)).toEqual(['take-payment', 'refund'])
  })
})

describe('storyPassStats', () => {
  it('counts full verdicts over applicable products, excluding n/a from the denominator', () => {
    expect(storyPassStats(data, 'take-payment')).toEqual({ full: 1, applicable: 1 })
    expect(storyPassStats(data, 'instant-payout')).toEqual({ full: 0, applicable: 1 })
    expect(storyPassStats(data, 'refund')).toEqual({ full: 0, applicable: 0 })
  })
})

describe('checklistWhy', () => {
  it('names the scoring weight for each priority tier', () => {
    expect(checklistWhy(3, { full: 1, applicable: 2 })).toContain('weighs 3× in ranking scoring')
    expect(checklistWhy(2, { full: 1, applicable: 2 })).toContain('weighs 2× in ranking scoring')
    expect(checklistWhy(1, { full: 1, applicable: 2 })).toContain('weighs 1× in ranking scoring')
  })

  it('reports the field honestly — none, some, all, or nothing applicable', () => {
    expect(checklistWhy(3, { full: 0, applicable: 4 })).toContain('no product fully delivers this yet')
    expect(checklistWhy(3, { full: 2, applicable: 4 })).toContain('2 of 4 products fully deliver this today')
    expect(checklistWhy(3, { full: 4, applicable: 4 })).toContain('all 4 products fully deliver this today')
    expect(checklistWhy(3, { full: 0, applicable: 0 })).toBe('Core requirement — weighs 3× in ranking scoring')
  })
})

describe('checklistMarkdown', () => {
  const md = checklistMarkdown(data)

  it('produces a titled, theme-grouped GFM task list with priority tags', () => {
    expect(md).toContain('# Payments — buyer checklist (RFP)')
    expect(md).toContain('## Checkout')
    expect(md).toContain('## Payouts')
    expect(md).toContain('- [ ] **[must-have]** Take payment')
    expect(md).toContain('- [ ] **[nice-to-have]** Refund')
    expect(md).toContain('- [ ] **[should-have]** Instant payout')
  })

  it('orders each theme heaviest-first and strips persona prefixes', () => {
    expect(md.indexOf('Take payment')).toBeLessThan(md.indexOf('Refund'))
    expect(md).not.toContain('As a developer')
  })

  it('ends with a provenance line back to the arena', () => {
    expect(md).toMatch(/Source: .*\/arena\/pay/)
    expect(md).toMatch(/methodology: .*\/methodology/)
  })
})
