import { describe, expect, it } from 'vitest'
import type { Evidence } from '@/lib/schemas'
import { buildClaims, validateClaimRules } from '@/pipeline/stages/claims'

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
