import { describe, expect, it, vi } from 'vitest'
import { IntegrationsFileSchema } from '@/lib/integrations'
import type { Evidence, Product } from '@/lib/schemas'
import { setClientForTests } from '@/pipeline/llm'
import {
  aliasPattern,
  buildIntegrationEdges,
  buildNameMatchers,
  extractIntegrations,
  findCandidateMentions,
  integrationViolation,
  type CandidateMention,
  type RawIntegration,
} from '@/pipeline/stages/integrations'

const FLEET = [
  { id: 'stripe', name: 'Stripe', arena: 'payments' },
  { id: 'stripe-terminal', name: 'Stripe Terminal', arena: 'mobile-payments' },
  { id: 'xero', name: 'Xero', arena: 'accounting' },
  { id: 'linear', name: 'Linear', arena: 'project-management' },
  { id: 'quickbooks', name: 'QuickBooks Online', arena: 'accounting' },
  // Same product tracked in two arenas: the first arena wins as canonical link target.
  { id: 'square', name: 'Square', arena: 'mobile-payments' },
  { id: 'square', name: 'Square', arena: 'payments' },
]

const MATCHERS = buildNameMatchers(FLEET)

const evidence = (id: string, excerpt: string): Evidence => ({
  id,
  tier: 'claimed-docs',
  url: 'https://mercury.example/docs',
  excerpt,
  fetchedAt: '2026-09-06T00:00:00.000Z',
})

describe('aliasPattern', () => {
  it('matches on word boundaries only, case-sensitively', () => {
    expect(aliasPattern('Xero').test('Sync invoices to Xero nightly')).toBe(true)
    expect(aliasPattern('Xero').test('a xerox machine')).toBe(false)
    expect(aliasPattern('Linear').test('linear time complexity')).toBe(false)
    expect(aliasPattern('Exa').test('see example.com for details')).toBe(false)
  })
  it('handles names with dots literally', () => {
    expect(aliasPattern('Cal.com').test('book via Cal.com today')).toBe(true)
    expect(aliasPattern('Cal.com').test('book via Calccom today')).toBe(false)
  })
})

describe('buildNameMatchers', () => {
  it('adds curated aliases and sorts longest-first', () => {
    const aliases = MATCHERS.map((m) => m.alias)
    expect(aliases).toContain('QuickBooks') // curated alias of "QuickBooks Online"
    const idx = (a: string) => aliases.indexOf(a)
    expect(idx('Stripe Terminal')).toBeLessThan(idx('Stripe'))
  })
  it('keeps the first arena as canonical for a multi-arena product', () => {
    const square = MATCHERS.find((m) => m.alias === 'Square')!
    expect(square.arena).toBe('mobile-payments')
    expect(MATCHERS.filter((m) => m.alias === 'Square')).toHaveLength(1)
  })
})

describe('findCandidateMentions', () => {
  it('finds word-boundary mentions of other tracked products', () => {
    const found = findCandidateMentions(
      'mercury',
      [evidence('mercury-docs-1', 'Mercury syncs transactions to Xero and QuickBooks automatically.')],
      MATCHERS,
    )
    expect(found.map((c) => c.targetProductId).sort()).toEqual(['quickbooks', 'xero'])
    expect(found[0].evidenceId).toBe('mercury-docs-1')
    expect(found.find((c) => c.targetProductId === 'quickbooks')?.matchedAlias).toBe('QuickBooks')
  })

  it('suppresses a shorter name nested inside a longer tracked name', () => {
    const found = findCandidateMentions(
      'mercury',
      [evidence('e1', 'Works with Stripe Terminal for in-person payments.')],
      MATCHERS,
    )
    expect(found.map((c) => c.targetProductId)).toEqual(['stripe-terminal'])
  })

  it('still catches the shorter name when it appears on its own', () => {
    const found = findCandidateMentions(
      'mercury',
      [evidence('e1', 'Accept cards with Stripe, or use Stripe Terminal in person.')],
      MATCHERS,
    )
    expect(found.map((c) => c.targetProductId).sort()).toEqual(['stripe', 'stripe-terminal'])
  })

  it('never yields a self-mention and dedupes repeated mentions per evidence item', () => {
    const found = findCandidateMentions(
      'stripe',
      [evidence('e1', 'Stripe connects to Xero. Stripe loves Xero. Xero!')],
      MATCHERS,
    )
    expect(found).toEqual([expect.objectContaining({ targetProductId: 'xero', evidenceId: 'e1' })])
  })

  it('does not match a common word in lowercase (case-sensitive prefilter)', () => {
    const found = findCandidateMentions('mercury', [evidence('e1', 'grows linear with usage')], MATCHERS)
    expect(found).toEqual([])
  })
})

const CANDIDATES: CandidateMention[] = [
  {
    evidenceId: 'mercury-docs-3',
    evidenceExcerpt: 'Mercury syncs every transaction to Xero and QuickBooks automatically.',
    targetProductId: 'xero',
    targetName: 'Xero',
    targetArena: 'accounting',
    matchedAlias: 'Xero',
  },
  {
    evidenceId: 'mercury-community-1',
    evidenceExcerpt: 'I moved from Linear to something simpler for my banking todo list.',
    targetProductId: 'linear',
    targetName: 'Linear',
    targetArena: 'project-management',
    matchedAlias: 'Linear',
  },
]

const raw = (overrides: Partial<RawIntegration> = {}): RawIntegration => ({
  evidenceId: 'mercury-docs-3',
  targetProductId: 'xero',
  excerpt: 'syncs every transaction to Xero',
  ...overrides,
})

describe('integrationViolation', () => {
  it('accepts a clean item', () => {
    expect(integrationViolation(raw(), CANDIDATES)).toBeNull()
  })
  it('rejects a pair that was never a candidate (invented edge)', () => {
    expect(integrationViolation(raw({ targetProductId: 'stripe' }), CANDIDATES)).toMatch(/not one of the submitted candidates/)
    expect(integrationViolation(raw({ evidenceId: 'nope' }), CANDIDATES)).toMatch(/not one of the submitted candidates/)
  })
  it('rejects an excerpt that is not verbatim from that evidence item', () => {
    expect(integrationViolation(raw({ excerpt: 'Mercury has a great Xero integration' }), CANDIDATES)).toMatch(/not a verbatim quote/)
  })
  it('rejects an excerpt that omits the matched name', () => {
    expect(integrationViolation(raw({ excerpt: 'syncs every transaction' }), CANDIDATES)).toMatch(/does not contain the matched name/)
  })
})

describe('buildIntegrationEdges', () => {
  it('stamps arena/sourceEvidenceId from the candidate and keeps the first verified per target', () => {
    const edges = buildIntegrationEdges([raw(), raw({ excerpt: 'to Xero and QuickBooks' })], CANDIDATES)
    expect(edges).toEqual([
      {
        productId: 'xero',
        arena: 'accounting',
        sourceEvidenceId: 'mercury-docs-3',
        excerpt: 'syncs every transaction to Xero',
      },
    ])
  })
})

const PRODUCT: Product = {
  id: 'mercury',
  name: 'Mercury',
  vendor: 'Mercury',
  type: 'commercial',
  urls: { site: 'https://mercury.example' },
}

const textResponse = (payload: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] })

describe('extractIntegrations (mocked LLM — tests the verification, not the model)', () => {
  const opts = { product: PRODUCT, arenaName: 'Startup Banking', candidates: CANDIDATES }

  it('keeps verified integrations and classifies out comparisons by omission', async () => {
    const create = vi.fn().mockResolvedValue(textResponse({ integrations: [raw()] }))
    setClientForTests({ messages: { create } } as never)
    const { edges, droppedFabrications } = await extractIntegrations(opts)
    expect(create).toHaveBeenCalledTimes(1)
    expect(droppedFabrications).toBe(0)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ productId: 'xero', sourceEvidenceId: 'mercury-docs-3' })
    // The final entry validates against the on-disk schema.
    expect(IntegrationsFileSchema.parse([{ productId: 'mercury', integratesWith: edges }])).toBeTruthy()
  })

  it('re-prompts once on a fabricated excerpt, then drops items that still fail', async () => {
    const fabricated = raw({ excerpt: 'Mercury deeply integrates with Xero via OAuth' })
    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse({ integrations: [fabricated, raw()] }))
      .mockResolvedValueOnce(textResponse({ integrations: [fabricated, raw()] })) // still lying
    setClientForTests({ messages: { create } } as never)
    const { edges, droppedFabrications } = await extractIntegrations(opts)
    expect(create).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(create.mock.calls[1][0].messages)).toMatch(/not a verbatim quote/)
    expect(droppedFabrications).toBe(1)
    expect(edges).toEqual([expect.objectContaining({ productId: 'xero' })])
  })

  it('drops an invented edge to a product no candidate mentioned', async () => {
    const invented = raw({ evidenceId: 'mercury-docs-3', targetProductId: 'stripe', excerpt: 'syncs every transaction to Xero' })
    const create = vi.fn().mockResolvedValue(textResponse({ integrations: [invented] }))
    setClientForTests({ messages: { create } } as never)
    const { edges, droppedFabrications } = await extractIntegrations(opts)
    expect(edges).toEqual([])
    expect(droppedFabrications).toBe(1)
  })

  it('dedupes the same target across chunks (>40 candidates → several calls, one edge)', async () => {
    // 41 candidates for the same target: chunk 1 gets 40, chunk 2 gets 1 — both classified as
    // integrations, but only the first chunk's edge survives.
    const many: CandidateMention[] = Array.from({ length: 41 }, (_, i) => ({
      evidenceId: `mercury-docs-${i}`,
      evidenceExcerpt: `Feature ${i}: Mercury syncs to Xero nightly.`,
      targetProductId: 'xero',
      targetName: 'Xero',
      targetArena: 'accounting',
      matchedAlias: 'Xero',
    }))
    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse({ integrations: [{ evidenceId: 'mercury-docs-2', targetProductId: 'xero', excerpt: 'Mercury syncs to Xero nightly' }] }))
      .mockResolvedValueOnce(textResponse({ integrations: [{ evidenceId: 'mercury-docs-40', targetProductId: 'xero', excerpt: 'Mercury syncs to Xero nightly' }] }))
    setClientForTests({ messages: { create } } as never)
    const { edges } = await extractIntegrations({ product: PRODUCT, arenaName: 'Startup Banking', candidates: many })
    expect(create).toHaveBeenCalledTimes(2)
    expect(edges).toEqual([expect.objectContaining({ productId: 'xero', sourceEvidenceId: 'mercury-docs-2' })])
  })

  it('returns no edges when the model honestly finds none', async () => {
    const create = vi.fn().mockResolvedValue(textResponse({ integrations: [] }))
    setClientForTests({ messages: { create } } as never)
    const { edges, droppedFabrications } = await extractIntegrations(opts)
    expect(edges).toEqual([])
    expect(droppedFabrications).toBe(0)
  })
})
