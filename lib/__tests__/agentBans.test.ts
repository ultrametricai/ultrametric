import { describe, expect, it } from 'vitest'
import { agentBanRecorded } from '@/lib/agentBans'
import { loadCategory, type CategoryData } from '@/lib/data'
import type { Evidence, Product } from '@/lib/schemas'

// The primary-slot suppression flag (lib/agentBans.ts): derived from committed
// evidence/crawlExclude, never a hand list. Synthetic cases pin the two derivation paths;
// live-data cases pin the founder's 2026-10-08 ruling on the government arena.

const product = (overrides: Partial<Product>): Product => ({
  id: 'p',
  name: 'P',
  vendor: 'V',
  type: 'commercial',
  urls: { site: 'https://example.gov/' },
  ...overrides,
} as Product)

const ev = (excerpt: string, tier: Evidence['tier'] = 'probe'): Evidence => ({
  id: 'e-1', tier, url: 'https://example.gov/robots.txt', excerpt, fetchedAt: '2026-10-07T00:00:00.000Z',
})

const dataWith = (p: Product, evidence: Evidence[]): CategoryData =>
  ({ products: [p], evidence: { [p.id]: evidence } } as unknown as CategoryData)

describe('agentBanRecorded', () => {
  it('flags a robots-walled front door (urls.site in crawlExclude, trailing slash tolerant)', () => {
    const p = product({ crawlExclude: ['https://example.gov'] })
    expect(agentBanRecorded(dataWith(p, []), 'p')).toBe(true)
  })

  it('does not flag a crawlExclude that walls only a secondary URL', () => {
    const p = product({ crawlExclude: ['https://filing.example.gov/'] })
    expect(agentBanRecorded(dataWith(p, []), 'p')).toBe(false)
  })

  it('flags a probe-tier named-agent-ban observation in the recorded wall format', () => {
    const p = product({})
    const walls = [ev('PROBE filing-host robots: HTTP 200 (observed 2026-10-05; named bans — GPTBot present) — banned BY NAME.')]
    expect(agentBanRecorded(dataWith(p, walls), 'p')).toBe(true)
  })

  it('ignores the same phrasing outside probe-tier evidence', () => {
    const p = product({})
    const walls = [ev('named bans — GPTBot present', 'claimed-docs')]
    expect(agentBanRecorded(dataWith(p, walls), 'p')).toBe(false)
  })

  it('does not flag plain auth challenges or ordinary robots observations', () => {
    const p = product({})
    const walls = [ev('PROBE api keyless GET: HTTP 401, a structured auth challenge — an auth model, not a bot wall.')]
    expect(agentBanRecorded(dataWith(p, walls), 'p')).toBe(false)
  })

  it('is false for unknown products', () => {
    expect(agentBanRecorded(dataWith(product({}), []), 'nope')).toBe(false)
  })
})

describe('agentBanRecorded on committed government-services data (founder pins, 2026-10-08)', () => {
  const data = loadCategory('government-services')

  it.each(['texas-sos', 'virginia-scc'])('%s renders no primary-slot affordance', (id) => {
    expect(agentBanRecorded(data, id)).toBe(true)
  })

  it.each(['uspto', 'companies-house', 'hmrc', 'sam-gov'])('%s is not ban-flagged', (id) => {
    expect(agentBanRecorded(data, id)).toBe(false)
  })
})
