import { describe, expect, it } from 'vitest'
import {
  buildIssueBody,
  churnDecision,
  discoverUrlsFromLlmsTxt,
  founderBoostFor,
  medianEvidenceAgeDays,
  nextDueFrom,
  parseArgs,
  priorityScore,
  registrableDomain,
  sortQueue,
  stalenessFromAge,
  statusFor,
  SpikeQueueSchema,
  SPIKE_INTERVAL_DAYS,
  type SpikeEntry,
} from '../scripts/spike-engine'
import type { Verdict } from '../../lib/schemas'

const NOW = new Date('2026-09-15T12:00:00.000Z')

describe('spike-engine ranking', () => {
  it('staleness ramps 0→100 between 30 and 210 days, and missing evidence is maximally stale', () => {
    expect(stalenessFromAge(null)).toBe(100)
    expect(stalenessFromAge(0)).toBe(0)
    expect(stalenessFromAge(30)).toBe(0)
    expect(stalenessFromAge(120)).toBe(50)
    expect(stalenessFromAge(210)).toBe(100)
    expect(stalenessFromAge(9999)).toBe(100)
  })

  it('computes the median evidence age in days', () => {
    const ev = (daysAgo: number) => ({ fetchedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString() })
    expect(medianEvidenceAgeDays([], NOW)).toBeNull()
    expect(medianEvidenceAgeDays([ev(10)], NOW)).toBe(10)
    expect(medianEvidenceAgeDays([ev(10), ev(20)], NOW)).toBe(15)
    expect(medianEvidenceAgeDays([ev(10), ev(20), ev(90)], NOW)).toBe(20)
  })

  it('founder boost prefers the product key over the arena key, defaulting to 1', () => {
    const p = { _comment: '', arenas: { payments: 2 }, products: { 'payments/adyen': 3 } }
    expect(founderBoostFor(p, 'payments', 'adyen')).toBe(3)
    expect(founderBoostFor(p, 'payments', 'stripe')).toBe(2)
    expect(founderBoostFor(p, 'terminals', 'kitty')).toBe(1)
  })

  it('priority = staleness × boosts with a floor of 1 on staleness', () => {
    expect(priorityScore(50, 1, 2)).toBe(100)
    expect(priorityScore(0, 1.25, 3)).toBe(3.8) // floored staleness keeps priorities ordered
    expect(priorityScore(100, 1, 1)).toBe(100)
  })

  it('boosts shorten the re-spike interval and drive due status', () => {
    const spiked = '2026-09-01T00:00:00.000Z'
    const base = nextDueFrom(spiked, 1, 1)
    expect(base).toBe(new Date(Date.parse(spiked) + SPIKE_INTERVAL_DAYS * 86_400_000).toISOString())
    const boosted = nextDueFrom(spiked, 1.25, 3)
    expect(Date.parse(boosted)).toBeLessThan(Date.parse(base))
    expect(statusFor(null, null, NOW)).toBe('due')
    expect(statusFor(spiked, '2026-09-10T00:00:00.000Z', NOW)).toBe('due')
    expect(statusFor(spiked, '2026-10-10T00:00:00.000Z', NOW)).toBe('spiked')
  })

  it('sorts by priority desc with deterministic alpha tiebreaks', () => {
    const entry = (arena: string, productId: string, priority: number, staleness = 0): SpikeEntry => ({
      arena,
      productId,
      name: productId,
      priority,
      components: { staleness, stalenessSource: 'evidence-age', popularityBoost: 1, founderBoost: 1 },
      status: 'due',
      lastSpiked: null,
      nextDue: null,
      lastRun: null,
    })
    const sorted = sortQueue([
      entry('payments', 'b', 10),
      entry('payments', 'a', 10),
      entry('email', 'z', 90),
      entry('payments', 'c', 10, 5),
    ])
    expect(sorted.map((e) => e.productId)).toEqual(['z', 'c', 'a', 'b'])
  })
})

describe('spike-engine churn policy', () => {
  const row = (verdict: Verdict['verdict'], quality: number, evidenceIds: string[]): Verdict => ({
    productId: 'adyen',
    storyId: 's1',
    verdict,
    quality,
    confidence: 'high',
    rationale: 'x',
    evidenceIds,
  })
  const oldIds = new Set(['adyen-docs-1', 'adyen-docs-2', 'adyen-probe-5'])
  const currentIds = new Set(['adyen-docs-1', 'adyen-docs-2', 'adyen-probe-1', 'adyen-spike-3'])

  it('keeps flips that cite newly-added evidence', () => {
    expect(churnDecision(row('none', 0, []), row('full', 8, ['adyen-spike-3']), oldIds, currentIds)).toBe('keep')
  })

  it('reverts flips citing only pre-existing evidence', () => {
    expect(churnDecision(row('full', 8, ['adyen-docs-1']), row('partial', 5, ['adyen-docs-2']), oldIds, currentIds)).toBe('revert')
  })

  it('treats identical verdict+quality as unchanged and new cells as keep', () => {
    expect(churnDecision(row('full', 8, ['adyen-docs-1']), row('full', 8, ['adyen-docs-2']), oldIds, currentIds)).toBe('unchanged')
    expect(churnDecision(undefined, row('full', 8, ['adyen-docs-1']), oldIds, currentIds)).toBe('keep')
  })

  it('never reverts to an old verdict whose citations no longer resolve (probe-replacement case)', () => {
    // old verdict cites adyen-probe-5, replaced by the probe stage — restoring it would leave
    // a dangling citation that lib/data.ts rejects, so the fresh judgment stands.
    expect(churnDecision(row('full', 8, ['adyen-probe-5']), row('none', 0, ['adyen-docs-2']), oldIds, currentIds)).toBe('keep')
  })
})

describe('spike-engine discovery', () => {
  it('extracts same-domain, not-yet-crawled URLs from llms.txt, agent surfaces first, budget-capped', () => {
    const llms = [
      '# Vendor Docs',
      '- [Cards](https://docs.vendor.com/cards.md)',
      '- [MCP server](https://docs.vendor.com/mcp.md)',
      '- [Blog](https://other-domain.com/post)',
      '- [Existing](https://docs.vendor.com/existing.md)',
      '- [Webhooks](https://vendor.com/docs/webhooks.md)',
    ].join('\n')
    const existing = new Set(['https://docs.vendor.com/existing.md'])
    const urls = discoverUrlsFromLlmsTxt(llms, 'https://docs.vendor.com', existing, 10)
    expect(urls[0]).toBe('https://docs.vendor.com/mcp.md') // agent-token ranked first
    expect(urls).toContain('https://vendor.com/docs/webhooks.md') // same registrable domain
    expect(urls).not.toContain('https://other-domain.com/post')
    expect(urls).not.toContain('https://docs.vendor.com/existing.md')
    expect(discoverUrlsFromLlmsTxt(llms, 'https://docs.vendor.com', existing, 1)).toHaveLength(1)
  })

  it('registrableDomain takes the last two labels', () => {
    expect(registrableDomain('docs.vendor.com')).toBe('vendor.com')
    expect(registrableDomain('vendor.com')).toBe('vendor.com')
  })
})

describe('spike-engine cli + output', () => {
  it('parses flags and rejects malformed invocations', () => {
    expect(parseArgs([])).toMatchObject({ process: false, dryRun: false })
    expect(parseArgs(['--process', '--category', 'payments', '--product', 'adyen', '--budget-urls', '5'])).toMatchObject({
      process: true,
      category: 'payments',
      product: 'adyen',
      budgetUrls: 5,
    })
    expect(() => parseArgs(['--nope'])).toThrow()
    expect(() => parseArgs(['--category', 'payments'])).toThrow() // product required with category
    expect(() => parseArgs(['--budget-urls', 'NaN'])).toThrow()
  })

  it('builds a bounded markdown issue body and validates the queue schema', () => {
    const queue = SpikeQueueSchema.parse({
      _comment: 'test',
      generatedAt: NOW.toISOString(),
      queue: [
        {
          arena: 'payments',
          productId: 'adyen',
          name: 'Adyen',
          priority: 120,
          components: { staleness: 40, stalenessSource: 'report', popularityBoost: 1, founderBoost: 3 },
          status: 'due',
          lastSpiked: null,
          nextDue: null,
          lastRun: null,
        },
      ],
    })
    const body = buildIssueBody(queue)
    expect(body).toContain('| 1 | Adyen | payments | 120 | 40 | never | due |')
  })
})
