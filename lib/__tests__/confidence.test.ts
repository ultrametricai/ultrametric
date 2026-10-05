import { describe, expect, it } from 'vitest'
import type { CategoryData } from '@/lib/data'
import type { Category, Evidence, Product, Story, Verdict } from '@/lib/schemas'
import {
  computeConfidence,
  confidenceFor,
  confidenceGrade,
  confidenceTitle,
} from '@/lib/confidence'

const ev = (id: string, tier: Evidence['tier']): Evidence => ({
  id, tier, url: 'https://example.com', excerpt: 'x', fetchedAt: '2026-08-26T00:00:00.000Z',
})

const evidence = new Map<string, Evidence>([
  ['docs-1', ev('docs-1', 'claimed-docs')],
  ['gh-1', ev('gh-1', 'github')],
  ['community-1', ev('community-1', 'community')],
  ['probe-1', ev('probe-1', 'probe')],
])

const story = (id: string): Story => ({
  id, persona: 'dev', title: `t-${id}`, theme: 'core', group: 'core-basics', weight: 1,
})

const cell = (id: string, verdict: Verdict['verdict'], evidenceIds: string[]) => ({
  story: story(id),
  verdict: {
    productId: 'p', storyId: id, verdict, quality: verdict === 'na' || verdict === 'none' ? 0 : 5,
    confidence: 'high' as const, rationale: 'r', evidenceIds,
  },
})

describe('confidenceGrade', () => {
  it('grades exactly on the documented thresholds', () => {
    expect(confidenceGrade(0.85, 0.4)).toBe('A')
    expect(confidenceGrade(0.9, 0.39)).toBe('B') // tested share just under A
    expect(confidenceGrade(0.7, 0.25)).toBe('B')
    expect(confidenceGrade(0.84, 0.24)).toBe('C') // just under B on both
    expect(confidenceGrade(0.55, 0)).toBe('C')
    expect(confidenceGrade(0.54, 0.9)).toBe('D') // high tested share can't rescue thin coverage
  })
})

describe('computeConfidence', () => {
  it('computes coverage and testedShare over applicable (non-na) cells only', () => {
    const c = computeConfidence(
      [
        cell('s1', 'full', ['probe-1']), // evidenced, tested (probe)
        cell('s2', 'full', ['gh-1', 'docs-1']), // evidenced, tested (github strongest)
        cell('s3', 'partial', ['community-1', 'docs-1']), // evidenced, NOT tested
        cell('s4', 'none', []), // applicable, unevidenced
        cell('s5', 'na', []), // excluded entirely
      ],
      evidence,
    )
    expect(c.applicable).toBe(4)
    expect(c.coverage).toBeCloseTo(3 / 4)
    expect(c.testedShare).toBeCloseTo(2 / 4)
    expect(c.grade).toBe('B')
  })

  it('a zero-evidence none counts against coverage; an evidenced none counts for it', () => {
    const bare = computeConfidence([cell('s1', 'none', []), cell('s2', 'full', ['probe-1'])], evidence)
    expect(bare.coverage).toBeCloseTo(0.5)
    // A none verdict that cites disconfirming evidence is a *finding*, not a gap.
    const evidencedNone = computeConfidence([cell('s1', 'none', ['probe-1']), cell('s2', 'full', ['probe-1'])], evidence)
    expect(evidencedNone.coverage).toBe(1)
  })

  it('degrades to grade D with zero applicable cells (all na)', () => {
    const c = computeConfidence([cell('s1', 'na', []), cell('s2', 'na', [])], evidence)
    expect(c).toEqual({ coverage: 0, testedShare: 0, applicable: 0, grade: 'D' })
  })
})

describe('confidenceFor', () => {
  const category: Category = { id: 'cat', name: 'Cat', description: 'd', personas: ['dev'] }
  const products: Product[] = [{ id: 'p', name: 'P', vendor: 'v', type: 'oss', urls: { site: 'https://p.example' } }]
  const stories = [story('s1'), story('s2')]

  it('reads a product straight from CategoryData', () => {
    const data: CategoryData = {
      category,
      products,
      stories,
      evidence: { p: [ev('probe-1', 'probe')] },
      verdicts: [
        cell('s1', 'full', ['probe-1']).verdict,
        cell('s2', 'none', []).verdict,
      ],
      rankings: { generatedAt: '2026-08-26T00:00:00.000Z', leaderboard: [], battles: [] },
      stacks: [],
      popularity: {},
      claims: {},
      uncertainty: [],
  vendorResponses: [],
  certifications: [],
    }
    const c = confidenceFor(data, 'p')
    expect(c.applicable).toBe(2)
    expect(c.coverage).toBe(0.5)
    expect(c.testedShare).toBe(0.5)
    expect(c.grade).toBe('D')
    // One-sentence tooltip (founder sweep 2026-10-02): grade + evidence-footing facts +
    // the "score unchanged" honesty line.
    expect(confidenceTitle(c)).toContain('Confidence D')
    expect(confidenceTitle(c)).toContain('50%')
    expect(confidenceTitle(c)).toContain('score is unchanged')
  })
})
