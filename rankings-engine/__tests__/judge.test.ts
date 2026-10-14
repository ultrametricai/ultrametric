import { describe, expect, it } from 'vitest'
import type { Evidence, Story, Verdict } from '@/lib/schemas'
import { cellHash, validateVerdictRules } from '@/pipeline/stages/judge'

const story: Story = { id: 's1', persona: 'developer', title: 't', theme: 'core', group: 'core', weight: 2 }
const ev = (id: string, tier: Evidence['tier']): Evidence => ({
  id, tier, url: 'https://x.example/e', excerpt: 'q', fetchedAt: '2026-08-26T00:00:00Z',
})
const verdict = (over: Partial<Verdict>): Verdict => ({
  productId: 'p', storyId: 's1', verdict: 'full', quality: 8, confidence: 'high',
  rationale: 'r. Missing for 10: independent corroboration.', evidenceIds: ['e1'], ...over,
})

describe('cellHash', () => {
  it('is stable and sensitive to evidence and prompt version', () => {
    const evidence = [ev('e1', 'claimed-docs')]
    const h1 = cellHash(story, evidence, 'v1')
    expect(h1).toBe(cellHash(story, [...evidence], 'v1'))
    expect(h1).not.toBe(cellHash(story, evidence, 'v2'))
    expect(h1).not.toBe(cellHash(story, [ev('e1', 'claimed-docs'), ev('e2', 'community')], 'v1'))
  })

  it('changes when an evidence item keeps its id but gets a new excerpt (same-id regeneration)', () => {
    // This is the exact staleness scenario the judge assembly guard must catch:
    // extract/collect-community regenerates evidence for a product, reusing ids
    // but changing excerpt text — the cached verdict hash must no longer match.
    const before = [{ ...ev('e1', 'claimed-docs'), excerpt: 'old excerpt' }]
    const after = [{ ...ev('e1', 'claimed-docs'), excerpt: 'new excerpt' }]
    expect(cellHash(story, before, 'v1')).not.toBe(cellHash(story, after, 'v1'))
  })
})

describe('validateVerdictRules', () => {
  const evidence = [ev('e1', 'claimed-docs'), ev('e2', 'community')]

  it('accepts a clean verdict', () => {
    expect(validateVerdictRules(verdict({}), evidence)).toBeNull()
  })
  it('rejects citations of unknown evidence', () => {
    expect(validateVerdictRules(verdict({ evidenceIds: ['nope'] }), evidence)).toMatch(/unknown evidence/)
  })
  it('requires two tiers for disputed', () => {
    expect(validateVerdictRules(verdict({ verdict: 'disputed', evidenceIds: ['e1'] }), evidence)).toMatch(/two distinct tiers/)
    expect(validateVerdictRules(verdict({ verdict: 'disputed', evidenceIds: ['e1', 'e2'] }), evidence)).toBeNull()
  })
  it('forces quality 0 for none', () => {
    expect(validateVerdictRules(verdict({ verdict: 'none', quality: 3, evidenceIds: [] }), evidence)).toMatch(/quality 0/)
    expect(validateVerdictRules(verdict({ verdict: 'none', quality: 0, evidenceIds: [] }), evidence)).toBeNull()
  })
  it('requires a "missing for 10" clause when a full/partial quality is below 10', () => {
    expect(validateVerdictRules(verdict({ quality: 8, rationale: 'fully supports the story' }), evidence)).toMatch(/missing for 10/)
    expect(validateVerdictRules(verdict({ verdict: 'partial', quality: 5, rationale: 'delivers with caveats' }), evidence)).toMatch(/missing for 10/)
    // case-insensitive match on the required phrase
    expect(validateVerdictRules(verdict({ quality: 8, rationale: 'solid docs. missing for 10: probe evidence.' }), evidence)).toBeNull()
  })
  it('does not require the clause at quality 10 or for none/na', () => {
    expect(validateVerdictRules(verdict({ quality: 10, rationale: 'flawless, corroborated' }), evidence)).toBeNull()
    expect(validateVerdictRules(verdict({ verdict: 'na', quality: 0, rationale: 'wrong axis', evidenceIds: [] }), evidence)).toBeNull()
  })
})
