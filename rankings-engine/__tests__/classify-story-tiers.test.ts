// Pure-part tests for the pricing-tier classifier (pipeline/scripts/classify-story-tiers.ts):
// hashing, pricing-context assembly, prompt shape, rule validation, and unknown normalization.
// No LLM/network — same posture as judge.test.ts's validateVerdictRules coverage.
import { describe, expect, it } from 'vitest'
import type { Evidence, Story, Verdict } from '../../lib/schemas'
import {
  normalizeTierEntry,
  pricingContextFor,
  RawTierArraySchema,
  TIER_PROMPT_VERSION,
  tierCellHash,
  tierPrompt,
  validateTierEntries,
  type RawTierEntry,
} from '../scripts/classify-story-tiers'

const story: Story = {
  id: 'sso-story',
  persona: 'ops',
  title: 'As an ops lead, I can enforce SSO for my team',
  theme: 'security',
  group: 'security',
  weight: 2,
}

const verdict: Verdict = {
  productId: 'acme',
  storyId: 'sso-story',
  verdict: 'full',
  quality: 9,
  confidence: 'high',
  rationale: 'Documented SAML SSO. missing for 10: independent corroboration.',
  evidenceIds: ['acme-docs-1'],
}

const cited: Evidence[] = [
  {
    id: 'acme-docs-1',
    tier: 'claimed-docs',
    url: 'https://docs.acme.dev/sso.md',
    excerpt: 'SAML SSO is available on the Enterprise plan.',
    fetchedAt: '2026-09-01T00:00:00.000Z',
  },
]

describe('pricingContextFor', () => {
  it('labels pricing.json facts as citable pricing-fact-N items', () => {
    const items = pricingContextFor(
      {
        facts: [{
          unit: 'per month (entry plan)', amountUsd: 20, tier: 'entry-paid', notes: 'Pro plan',
          sourceUrl: 'https://acme.dev/pricing', excerpt: '$20 per user/month', fetchedAt: '2026-09-01T00:00:00.000Z',
        }],
      },
      [],
    )
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('pricing-fact-1')
    expect(items[0].excerpt).toContain('$20 per user/month')
    expect(items[0].excerpt).toContain('Pro plan')
  })

  it('records an honest pricing-unavailable item and picks up pricing-page evidence by URL', () => {
    const pricingEvidence: Evidence = {
      id: 'acme-docs-9', tier: 'claimed-docs', url: 'https://acme.dev/pricing',
      excerpt: 'Free plan includes 3 seats.', fetchedAt: '2026-09-01T00:00:00.000Z',
    }
    const items = pricingContextFor(
      { unavailable: true, reason: 'JS shell page', fetchedAt: '2026-09-01T00:00:00.000Z' },
      [pricingEvidence, cited[0]],
    )
    expect(items.map((i) => i.id)).toEqual(['pricing-unavailable', 'acme-docs-9'])
  })

  it('is empty when there is no pricing evidence at all — never invented context', () => {
    expect(pricingContextFor(undefined, cited)).toEqual([])
  })
})

describe('tierCellHash', () => {
  const pricing = pricingContextFor(undefined, [])

  it('is stable for identical inputs', () => {
    expect(tierCellHash(verdict, cited, pricing, TIER_PROMPT_VERSION))
      .toBe(tierCellHash(verdict, cited, pricing, TIER_PROMPT_VERSION))
  })

  it('changes when the verdict, cited excerpts, pricing context, or prompt version change', () => {
    const base = tierCellHash(verdict, cited, pricing, TIER_PROMPT_VERSION)
    expect(tierCellHash({ ...verdict, verdict: 'partial' }, cited, pricing, TIER_PROMPT_VERSION)).not.toBe(base)
    expect(tierCellHash(verdict, [{ ...cited[0], excerpt: 'changed' }], pricing, TIER_PROMPT_VERSION)).not.toBe(base)
    expect(tierCellHash(verdict, cited, [{ id: 'pricing-fact-1', excerpt: '$5' }], TIER_PROMPT_VERSION)).not.toBe(base)
    expect(tierCellHash(verdict, cited, pricing, 'v999')).not.toBe(base)
  })
})

describe('tierPrompt', () => {
  it('includes the pricing block, each story with verdict + cited excerpts, and any extra correction', () => {
    const prompt = tierPrompt('Acme', [{ story, verdict, cited }], [{ id: 'pricing-fact-1', excerpt: '$20/mo (entry-paid)', url: 'https://acme.dev/pricing' }], '\nfix it')
    expect(prompt).toContain('Product: Acme')
    expect(prompt).toContain('[pricing-fact-1] $20/mo (entry-paid) — https://acme.dev/pricing')
    expect(prompt).toContain('Story sso-story:')
    expect(prompt).toContain('Verdict: full q9/10')
    expect(prompt).toContain('[acme-docs-1] (claimed-docs) SAML SSO is available on the Enterprise plan.')
    expect(prompt).toContain('fix it')
  })

  it('states the absence of pricing evidence honestly', () => {
    expect(tierPrompt('Acme', [{ story, verdict, cited }], [])).toContain('(no pricing evidence collected for this product)')
  })
})

describe('validateTierEntries', () => {
  const allowed = (storyId: string): ReadonlySet<string> =>
    storyId === 'sso-story' ? new Set(['acme-docs-1', 'pricing-fact-1']) : new Set()
  const good: RawTierEntry = {
    storyId: 'sso-story', tier: 'enterprise',
    tierNote: 'SSO on Enterprise plan only', tierEvidenceId: 'acme-docs-1',
  }

  it('passes a complete, correctly-cited batch', () => {
    expect(validateTierEntries([good], ['sso-story'], allowed)).toBeNull()
    expect(validateTierEntries([{ storyId: 'sso-story', tier: 'unknown' }], ['sso-story'], allowed)).toBeNull()
  })

  it('rejects missing, duplicate, and unexpected stories', () => {
    expect(validateTierEntries([], ['sso-story'], allowed)).toMatch(/missing entry/)
    expect(validateTierEntries([good, good], ['sso-story'], allowed)).toMatch(/duplicate/)
    expect(validateTierEntries([{ storyId: 'other', tier: 'unknown' }], ['sso-story'], allowed)).toMatch(/unexpected story/)
  })

  it('rejects a non-unknown tier without note/citation, or citing an id outside the allowed set', () => {
    expect(validateTierEntries([{ ...good, tierNote: undefined }], ['sso-story'], allowed)).toMatch(/tierNote/)
    expect(validateTierEntries([{ ...good, tierEvidenceId: undefined }], ['sso-story'], allowed)).toMatch(/tierEvidenceId/)
    expect(validateTierEntries([{ ...good, tierEvidenceId: 'made-up-id' }], ['sso-story'], allowed)).toMatch(/not among/)
  })
})

describe('normalizeTierEntry', () => {
  it('stamps the productId and passes non-unknown citations through', () => {
    expect(normalizeTierEntry('acme', { storyId: 'sso-story', tier: 'enterprise', tierNote: 'n', tierEvidenceId: 'acme-docs-1' }))
      .toEqual({ productId: 'acme', storyId: 'sso-story', tier: 'enterprise', tierNote: 'n', tierEvidenceId: 'acme-docs-1' })
  })

  it('strips a volunteered note/citation from unknown — the file contract is a bare unknown', () => {
    expect(normalizeTierEntry('acme', { storyId: 'sso-story', tier: 'unknown', tierNote: 'no gating stated', tierEvidenceId: 'acme-docs-1' }))
      .toEqual({ productId: 'acme', storyId: 'sso-story', tier: 'unknown' })
  })
})

describe('RawTierArraySchema', () => {
  it('rejects a tierNote over the 240-char cap and unknown tier kinds', () => {
    expect(RawTierArraySchema.safeParse([{ storyId: 's', tier: 'paid', tierNote: 'x'.repeat(241), tierEvidenceId: 'e' }]).success).toBe(false)
    expect(RawTierArraySchema.safeParse([{ storyId: 's', tier: 'platinum' }]).success).toBe(false)
    expect(RawTierArraySchema.safeParse([{ storyId: 's', tier: 'unknown' }]).success).toBe(true)
  })
})
