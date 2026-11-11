import shortwaveClaims from '../../open-rankings/email/claims/shortwave.json'
import shortwaveEvidence from '../../open-rankings/email/evidence/shortwave.json'
import superhumanClaims from '../../open-rankings/email/claims/superhuman.json'
import fastmailClaims from '../../open-rankings/email/claims/fastmail.json'
import missiveClaims from '../../open-rankings/email/claims/missive.json'
import missiveEvidence from '../../open-rankings/email/evidence/missive.json'
import { ClaimsArraySchema } from '../../lib/schemas'
import { describe, expect, it } from 'vitest'
import authyClaims from '../../open-rankings/authenticator-apps/claims/authy.json'
import enteClaims from '../../open-rankings/authenticator-apps/claims/ente-auth.json'
import type { Evidence } from '@/lib/schemas'
import { loadCategory } from '@/lib/data'
import { claimStatus } from '@/lib/claims'
import { claimsIntegrity } from '@/lib/claimsIntegrity'
import { buildClaims, validateClaimRules } from '@/rankings-engine/stages/claims'

const ev = (id: string, tier: Evidence['tier'], excerpt: string): Evidence => ({
  id, tier, url: `https://x.example/${id}`, excerpt, fetchedAt: '2026-08-26T00:00:00Z',
})

describe('validateClaimRules', () => {
  const byId = new Map([
    ['p-docs-1', ev('p-docs-1', 'claimed-docs', 'Ships a CLI')],
    ['p-gh-1', ev('p-gh-1', 'github', 'Has a plugin API')],
  ])
  const storyIds = new Set(['agentic-official-cli', 'agentic-public-api'])

  it('accepts clean claims', () => {
    const raw = { claims: [{ text: 'Ships an official CLI', evidenceId: 'p-docs-1', storyIds: ['agentic-official-cli'] }] }
    expect(validateClaimRules(raw, byId, storyIds)).toBeNull()
  })

  it('accepts a claim with no story mapping (taxonomy gap)', () => {
    const raw = { claims: [{ text: 'Has a plugin API', evidenceId: 'p-gh-1', storyIds: [] }] }
    expect(validateClaimRules(raw, byId, storyIds)).toBeNull()
  })

  it('rejects an unknown evidence id', () => {
    const raw = { claims: [{ text: 'x', evidenceId: 'nope', storyIds: [] }] }
    expect(validateClaimRules(raw, byId, storyIds)).toMatch(/unknown evidence id/)
  })

  it('rejects an unknown story id', () => {
    const raw = { claims: [{ text: 'x', evidenceId: 'p-docs-1', storyIds: ['not-a-real-story'] }] }
    expect(validateClaimRules(raw, byId, storyIds)).toMatch(/unknown story id/)
  })
})

describe('buildClaims', () => {
  const byId = new Map([
    ['p-docs-1', ev('p-docs-1', 'claimed-docs', 'Ships a CLI for automation')],
    ['p-gh-1', ev('p-gh-1', 'github', 'Has a plugin API')],
  ])

  it('assigns sequential per-product ids and copies quote/url/tier verbatim from the cited evidence', () => {
    const raw = {
      claims: [
        { text: 'Ships an official CLI', evidenceId: 'p-docs-1', storyIds: ['agentic-official-cli'] },
        { text: 'Extensible via plugins', evidenceId: 'p-gh-1', storyIds: [] },
      ],
    }
    const claims = buildClaims('p', raw, byId, '2026-08-26T12:00:00.000Z')
    expect(claims).toHaveLength(2)
    expect(claims[0]).toEqual({
      id: 'p-claim-1',
      text: 'Ships an official CLI',
      quote: 'Ships a CLI for automation',
      url: 'https://x.example/p-docs-1',
      sourceTier: 'claimed-docs',
      storyIds: ['agentic-official-cli'],
      extractedAt: '2026-08-26T12:00:00.000Z',
    })
    expect(claims[1]).toMatchObject({ id: 'p-claim-2', sourceTier: 'github', storyIds: [] })
  })

  it('truncates a quote that exceeds 240 chars (defensive — evidence excerpts are already capped at 200)', () => {
    const longExcerpt = 'x'.repeat(300)
    const byIdLong = new Map([['p-docs-1', ev('p-docs-1', 'claimed-docs', longExcerpt)]])
    const raw = { claims: [{ text: 't', evidenceId: 'p-docs-1', storyIds: [] }] }
    const claims = buildClaims('p', raw, byIdLong, '2026-08-26T12:00:00.000Z')
    expect(claims[0].quote).toHaveLength(240)
  })
})

describe('authenticator product boundaries', () => {
  it('Authy claims exclude the separate Twilio Verify product', () => {
    expect(authyClaims.filter(claim => new URL(claim.url).pathname.startsWith('/docs/verify'))).toEqual([])
  })

  it('Ente export claims do not use the Authy import extractor as export evidence', () => {
    expect(enteClaims.filter(claim => new URL(claim.url).pathname.replace(/\/$/, '') === '/help/auth/migration/authy'
      && claim.storyIds.some(id => id === 'open-format-export' || id === 'openness-full-export'))).toEqual([])
  })
})

describe('feature-flag background automation claims', () => {
  const data = loadCategory('feature-flags')
  const storyId = 'agentic-autonomous-automation'

  it.each([
    { product: 'flagsmith', quote: 'Define stages that your flags progress through automatically, with triggers and actions that control rollouts to selected environments and audiences.' },
    { product: 'unleash', quote: 'you can define a reusable, structured rollout process that progresses automatically while monitoring application health' },
  ])('keeps $product automatic rollout progression claimed on the cited background automation story', ({ product, quote }) => {
    const claim = data.claims[product]!.find(item => item.quote === quote)!
    const verdict = data.verdicts.find(item => item.productId === product && item.storyId === storyId)!
    const evidence = data.evidence[product]!.find(item => item.excerpt === quote && item.url === claim.url)!
    expect(claim.sourceTier).toBe('claimed-docs')
    expect(verdict.evidenceIds).toContain(evidence.id)
    expect(verdict.support?.citations).toContainEqual({ evidenceId: evidence.id, quote })
    expect(claim.storyIds).toContain(storyId)
    expect(claimStatus(data, product, storyId)).toBe('claimed-unverified')
  })
})

describe('Drata service-status claim boundaries', () => {
  const data = loadCategory('compliance-automation')
  const notifications = data.claims.drata.filter(claim =>
    new URL(claim.url).hostname === 'status.drata.com'
    && /(?:email|text message) notifications/i.test(claim.quote))

  it('retains email and SMS incident notices as unmapped claims', () => {
    expect(notifications).toHaveLength(2)
    for (const claim of notifications) {
      expect(claim.storyIds).toEqual([])
      expect(data.evidence.drata.some(item => item.url === claim.url && item.excerpt === claim.quote)).toBe(true)
    }
  })

  it('does not count service incidents as contradicted customer-control promises', () => {
    const notificationOnly = { ...data, claims: { drata: notifications } }
    expect(claimsIntegrity(notificationOnly, 'drata')).toEqual({
      score: null, verified: 0, unverified: 0, contradicted: 0, untestable: 2, total: 2,
    })
  })
})

describe('feature-flag retained documented claims', () => {
  const data = loadCategory('feature-flags')

  it.each([
    { product: 'unleash', claimId: 'unleash-claim-41', storyId: 'agentic-headless' },
    { product: 'launchdarkly', claimId: 'launchdarkly-claim-restored-headless-pipeline', storyId: 'agentic-headless' },
    { product: 'launchdarkly', claimId: 'launchdarkly-claim-restored-flag-creation', storyId: 'create-toggle-flag-fast' },
    { product: 'growthbook', claimId: 'growthbook-claim-restored-experiment-results', storyId: 'agent-experiment-analysis' },
  ])('preserves $product documented $storyId claim with its existing evidence', ({ product, claimId, storyId }) => {
    expect(ClaimsArraySchema.safeParse(data.claims[product]).success).toBe(true)
    const claim = data.claims[product]!.find(item => item.id === claimId)!
    expect(claim).toBeDefined()
    expect(claim.storyIds).toContain(storyId)
    expect(data.evidence[product]!.some(item => item.url === claim.url && item.excerpt === claim.quote)).toBe(true)
    expect(claimStatus(data, product, storyId)).not.toBe('delivered-unclaimed')
    const ids = data.claims[product]!.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('email claim quotation support', () => {
  it('Fastmail does not infer implementation licenses from a list of software types', () => {
    const claim = fastmailClaims.find(row => row.id === 'fastmail-claim-13')!
    expect(claim.quote).toBe('Webmail Rust library iOS app Server Typescript library Terminal client')
    expect(claim.text).not.toMatch(/open.source/i)
    expect(claim.text).toMatch(/^Lists JMAP implementations/)
  })

  it('Missive includes the preserved source sentence supporting Spanish regional coverage', () => {
    const claim = missiveClaims.find(row => row.id === 'missive-claim-52')!
    expect(claim.text).toContain('Spain and Latin America')
    expect(claim.quote).toContain('One translation covers Spain and Latin America.')
    expect(missiveEvidence.some(row => row.url === claim.url && row.excerpt === claim.quote)).toBe(true)
  })
})


describe('email claim product and quote boundaries', () => {
  it('Shortwave cites separate evidence for web browsing and the paid-plan default', () => {
    const browsing = shortwaveClaims.find(claim => claim.id === 'shortwave-claim-3')!
    expect(browsing.text).toBe('The AI can browse the web for current information related to your emails')
    expect(browsing.url).toBe('https://www.shortwave.com/pricing/')
    const paidDefault = shortwaveClaims.find(claim => claim.id === 'shortwave-claim-34')!
    expect(paidDefault.text).toBe('AI web browsing is enabled by default for paid plans')
    expect(paidDefault.quote).toBe('AI web browsing enabled by default: Now automatically on for paid plans')
    expect(paidDefault.url).toBe('https://www.shortwave.com/changelog/')
    for (const claim of [browsing, paidDefault]) {
      expect(shortwaveEvidence.some(row => row.url === claim.url && row.excerpt === claim.quote)).toBe(true)
    }
  })

  it('Superhuman Mail excludes the changelog entries labeled Docs or Go', () => {
    // The shared changelog labels personalization/mobile as Mail, agent building/governance
    // as Go, and spreadsheet import, AI columns, and cursor editing as Docs.
    const changelogClaims = superhumanClaims.filter(claim => claim.url === 'https://superhuman.com/products/whats-new')
    expect(changelogClaims.map(claim => claim.id)).toEqual(['superhuman-claim-11', 'superhuman-claim-39'])
    expect(superhumanClaims.some(claim => /Superhuman Docs|AI Columns|highlighted text in a doc/i.test(claim.text))).toBe(false)
  })
})
