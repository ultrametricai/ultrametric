import { describe, expect, it } from 'vitest'
import authyClaims from '../../open-rankings/authenticator-apps/claims/authy.json'
import enteClaims from '../../open-rankings/authenticator-apps/claims/ente-auth.json'
import paperspaceClaims from '../../open-rankings/gpu-clouds/claims/paperspace.json'
import paperspaceEvidence from '../../open-rankings/gpu-clouds/evidence/paperspace.json'
import type { Evidence } from '@/lib/schemas'
import { buildClaims, claimEvidenceForProduct, validateClaimRules } from '@/rankings-engine/stages/claims'

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

describe('Paperspace claim source boundaries', () => {
  it('excludes sibling-product docs from claim extraction while retaining raw evidence', () => {
    const pack = structuredClone(paperspaceEvidence) as Evidence[]
    const before = structuredClone(pack)
    const selected = claimEvidenceForProduct('paperspace', pack)
    for (let n = 17; n <= 28; n++) {
      const id = `paperspace-docs-202611${n}`
      expect(pack.some(item => item.id === id)).toBe(true)
      expect(selected.some(item => item.id === id)).toBe(false)
    }
    expect(pack).toEqual(before)
  })

  it.each([
    'https://docs.digitalocean.com/products/paperspace',
    'https://docs.digitalocean.com/products/paperspace/notebooks/',
    'https://docs.digitalocean.com/reference/paperspace',
    'https://docs.digitalocean.com/reference/paperspace/api-reference/index.html.md',
    'https://docs.digitalocean.com/reference/paperspace/pspace/?version=1#machines',
    'https://docs.paperspace.com/gradient/',
    'https://github.com/Paperspace/gradient-cli',
  ])('retains Paperspace sources at %s', url => {
    const evidence = { ...ev('paperspace-docs', url.includes('github.com') ? 'github' : 'claimed-docs', 'Paperspace capability'), url }
    expect(claimEvidenceForProduct('paperspace', [evidence])).toEqual([evidence])
  })

  it('keeps the boundary specific to Paperspace and excludes non-claim tiers', () => {
    const otherProduct = { ...ev('do-docs', 'claimed-docs', 'DigitalOcean MCP'), url: 'https://docs.digitalocean.com/reference/mcp/' }
    expect(claimEvidenceForProduct('digitalocean', [otherProduct])).toEqual([otherProduct])
    expect(claimEvidenceForProduct('paperspace', [ev('probe', 'probe', 'Observation'), ev('community', 'community', 'Comment')])).toEqual([])
    const sibling = { ...otherProduct, url: 'https://docs.digitalocean.com/products/paperspace-other/' }
    expect(claimEvidenceForProduct('paperspace', [sibling])).toEqual([])
  })

  it('publishes Paperspace promises without attributing DigitalOcean sibling services', () => {
    expect(paperspaceClaims.filter(claim => /\/(?:reference\/mcp|products\/(?:managed-agents|marketplace))(?:\/|$)/.test(new URL(claim.url).pathname))).toEqual([])
    expect(paperspaceClaims.some(claim => claim.url.includes('/products/paperspace/') && claim.storyIds.includes('custom-docker-images'))).toBe(true)
    expect(paperspaceClaims.some(claim => claim.url === 'https://www.paperspace.com/gpu-cloud' && claim.storyIds.includes('prebuilt-ml-templates'))).toBe(true)
    expect(paperspaceClaims.some(claim => claim.url.includes('/reference/paperspace/'))).toBe(true)
  })
})
