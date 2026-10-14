import { describe, expect, it, vi } from 'vitest'
import {
  isPricingUnavailable,
  ProductPricingSchema,
} from '@/lib/pricing'
import type { Product } from '@/lib/schemas'
import { setClientForTests } from '@/pipeline/llm'
import {
  amountAppearsInExcerpt,
  buildPricingEntry,
  candidatePricingUrls,
  excerptFound,
  extractPricing,
  factViolation,
  normalizeForMatch,
  type RawFact,
} from '@/pipeline/stages/pricing'

const PAGE = [
  '# Pricing',
  'Pay as you go. Input tokens cost **$0.59 per 1M tokens** on Llama 4 Maverick.',
  'Output: $0.79 per 1M tokens.',
  'Free tier: 1,000 requests per day at no charge.',
  'Team plan starts at $29/month.',
].join('\n\n')

const ALLOWED = ['per 1M tokens', 'per 1M input tokens', 'per 1M output tokens', 'per month (entry plan)']

const fact = (overrides: Partial<RawFact> = {}): RawFact => ({
  unit: 'per 1M tokens',
  amountUsd: 0.59,
  tier: 'usage',
  excerpt: '$0.59 per 1M tokens',
  ...overrides,
})

describe('normalizeForMatch / excerptFound', () => {
  it('matches through markdown escapes and collapsed whitespace', () => {
    expect(excerptFound('Input tokens cost $0.59 per 1M tokens', PAGE)).toBe(true)
    expect(excerptFound('cost  $0.59\nper 1M tokens', PAGE)).toBe(true)
  })
  it('rejects paraphrases that are not on the page', () => {
    expect(excerptFound('costs fifty-nine cents per million tokens', PAGE)).toBe(false)
  })
  it('strips markdown syntax but never digits, $ or %', () => {
    expect(normalizeForMatch('**$0.59** _per_ 1M | 2.9%')).toBe('$0.59 per 1M 2.9%')
  })
})

describe('amountAppearsInExcerpt', () => {
  it('accepts a fact whose figure is inside its excerpt', () => {
    expect(amountAppearsInExcerpt(fact())).toBe(true)
  })
  it('accepts trailing-zero renderings ("$0.30" for amountUsd 0.3)', () => {
    expect(amountAppearsInExcerpt(fact({ amountUsd: 0.3, excerpt: '2.9% + $0.30 per transaction', percent: 2.9 }))).toBe(true)
  })
  it('rejects a fact whose excerpt does not contain the figure', () => {
    expect(amountAppearsInExcerpt(fact({ amountUsd: 1.23, excerpt: 'contact sales for pricing' }))).toBe(false)
  })
  it('exempts zero-dollar free-tier facts (quota text, not a price)', () => {
    expect(amountAppearsInExcerpt(fact({ amountUsd: 0, tier: 'free', excerpt: 'Free tier: 1,000 requests per day' }))).toBe(true)
  })
})

describe('factViolation', () => {
  it('accepts a clean fact', () => {
    expect(factViolation(fact(), ALLOWED, PAGE)).toBeNull()
  })
  it('rejects a unit outside the allowlist', () => {
    expect(factViolation(fact({ unit: 'per widget' }), ALLOWED, PAGE)).toMatch(/not in the allowed list/)
  })
  it('rejects a free fact with a nonzero amount', () => {
    expect(factViolation(fact({ tier: 'free', amountUsd: 5, excerpt: 'Team plan starts at $29/month' }), ALLOWED, PAGE)).toMatch(/amountUsd 0/)
  })
  it('rejects a priceless non-free fact', () => {
    expect(factViolation(fact({ amountUsd: 0, excerpt: 'Pay as you go' }), ALLOWED, PAGE)).toMatch(/must carry a price/)
  })
  it('rejects the entry-plan unit on a usage fact', () => {
    expect(
      factViolation(fact({ unit: 'per month (entry plan)', amountUsd: 29, excerpt: 'Team plan starts at $29/month' }), ALLOWED, PAGE),
    ).toMatch(/requires tier "entry-paid"/)
  })
  it('rejects an excerpt that is not on the page', () => {
    expect(factViolation(fact({ excerpt: '$0.59 for a million shiny tokens' }), ALLOWED, PAGE)).toMatch(/not a verbatim quote/)
  })
})

describe('buildPricingEntry', () => {
  it('stamps sourceUrl/fetchedAt from the fetch and validates against ProductPricingSchema', () => {
    const entry = buildPricingEntry([fact({ percent: undefined, notes: 'Llama 4 Maverick input' })], {
      sourceUrl: 'https://x.example/pricing',
      fetchedAt: '2026-09-06T00:00:00.000Z',
      emptyReason: 'unused',
    })
    expect(ProductPricingSchema.parse(entry)).toEqual(entry)
    expect(entry).toEqual({
      facts: [{
        unit: 'per 1M tokens',
        amountUsd: 0.59,
        tier: 'usage',
        notes: 'Llama 4 Maverick input',
        sourceUrl: 'https://x.example/pricing',
        excerpt: '$0.59 per 1M tokens',
        fetchedAt: '2026-09-06T00:00:00.000Z',
      }],
    })
  })
  it('collapses zero facts to an honest unavailable record', () => {
    const entry = buildPricingEntry([], {
      sourceUrl: 'https://x.example/pricing',
      fetchedAt: '2026-09-06T00:00:00.000Z',
      emptyReason: 'all prices are behind a quote form',
    })
    expect(ProductPricingSchema.parse(entry)).toEqual(entry)
    expect(isPricingUnavailable(entry) && entry.reason).toBe('all prices are behind a quote form')
  })
})

const PRODUCT: Product = {
  id: 'acme',
  name: 'Acme Inference',
  vendor: 'Acme',
  type: 'commercial',
  urls: { site: 'https://acme.example' },
}

const textResponse = (payload: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] })

describe('extractPricing (mocked LLM — tests the validation, not the model)', () => {
  const opts = {
    product: PRODUCT,
    arenaId: 'inference-providers',
    arenaName: 'Inference Providers',
    pageText: PAGE,
    sourceUrl: 'https://acme.example/pricing',
    fetchedAt: '2026-09-06T00:00:00.000Z',
  }

  it('accepts a fully verified response first try', async () => {
    const create = vi.fn().mockResolvedValue(textResponse({
      facts: [
        { unit: 'per 1M tokens', amountUsd: 0.59, tier: 'usage', notes: 'Llama 4 Maverick input', excerpt: 'Input tokens cost $0.59 per 1M tokens' },
        { unit: 'per 1M tokens', amountUsd: 0, tier: 'free', notes: '1,000 requests/day free', excerpt: 'Free tier: 1,000 requests per day at no charge' },
      ],
    }))
    setClientForTests({ messages: { create } } as never)
    const entry = await extractPricing(opts)
    expect(create).toHaveBeenCalledTimes(1)
    expect(ProductPricingSchema.parse(entry)).toEqual(entry)
    if (!('facts' in entry)) throw new Error('expected facts')
    expect(entry.facts).toHaveLength(2)
    expect(entry.facts[0]).toMatchObject({ amountUsd: 0.59, sourceUrl: opts.sourceUrl, fetchedAt: opts.fetchedAt })
  })

  it('re-prompts once on a fabricated excerpt, then drops facts that still fail', async () => {
    const fabricated = { unit: 'per 1M tokens', amountUsd: 0.42, tier: 'usage', excerpt: 'only $0.42 per million, honest' }
    const verified = { unit: 'per 1M tokens', amountUsd: 0.79, tier: 'usage', excerpt: 'Output: $0.79 per 1M tokens' }
    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse({ facts: [fabricated, verified] }))
      .mockResolvedValueOnce(textResponse({ facts: [fabricated, verified] })) // still lying after the corrective re-prompt
    setClientForTests({ messages: { create } } as never)
    const entry = await extractPricing(opts)
    expect(create).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(create.mock.calls[1][0].messages)).toMatch(/not a verbatim quote/)
    if (!('facts' in entry)) throw new Error('expected facts')
    expect(entry.facts).toHaveLength(1)
    expect(entry.facts[0].amountUsd).toBe(0.79)
  })

  it('records an honest unavailable entry when nothing survives verification', async () => {
    const fabricated = { unit: 'per 1M tokens', amountUsd: 0.42, tier: 'usage', excerpt: 'totally made up quote' }
    const create = vi.fn().mockResolvedValue(textResponse({ facts: [fabricated] }))
    setClientForTests({ messages: { create } } as never)
    const entry = await extractPricing(opts)
    expect(isPricingUnavailable(entry)).toBe(true)
    if (!isPricingUnavailable(entry)) throw new Error('expected unavailable')
    expect(entry.reason).toMatch(/could not be verified verbatim/)
  })

  it('turns an empty-facts pageNote into the unavailable reason', async () => {
    const create = vi.fn().mockResolvedValue(textResponse({ facts: [], pageNote: 'pricing is quote-only behind a sales form' }))
    setClientForTests({ messages: { create } } as never)
    const entry = await extractPricing(opts)
    expect(isPricingUnavailable(entry) && entry.reason).toBe('pricing is quote-only behind a sales form')
  })
})

describe('candidatePricingUrls', () => {
  it('prefers the curated businessModel.url, then /pricing, then the site — deduped', () => {
    const p: Product = {
      ...PRODUCT,
      businessModel: { models: ['usage-based'], summary: 'Pay per token, no monthly minimum.', url: 'https://acme.example/rates' },
    }
    expect(candidatePricingUrls(p)).toEqual(['https://acme.example/rates', 'https://acme.example/pricing', 'https://acme.example'])
    expect(candidatePricingUrls(PRODUCT)).toEqual(['https://acme.example/pricing', 'https://acme.example'])
  })
})
