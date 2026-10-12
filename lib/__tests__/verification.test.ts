import { describe, expect, it } from 'vitest'
import type { CategoryData } from '@/lib/data'
import type { Category, Evidence, Product, Story, Verdict } from '@/lib/schemas'
import { cellAuthGated, isAuthGatedEvidence, strongestEvidence, verificationLevel, verificationMix } from '@/lib/verification'

const ev = (id: string, tier: Evidence['tier']): Evidence => ({
  id, tier, url: 'https://example.com', excerpt: 'x', fetchedAt: '2026-08-26T00:00:00.000Z',
})

const evidence = new Map<string, Evidence>([
  ['docs-1', ev('docs-1', 'claimed-docs')],
  ['gh-1', ev('gh-1', 'github')],
  ['community-1', ev('community-1', 'community')],
  ['probe-1', ev('probe-1', 'probe')],
])

const v = (verdict: Verdict['verdict'], evidenceIds: string[]): Verdict => ({
  productId: 'p', storyId: 's', verdict, quality: verdict === 'na' ? 0 : 5,
  confidence: 'high', rationale: 'r', evidenceIds,
})

describe('verificationLevel', () => {
  it('is disputed for a disputed verdict regardless of evidence', () => {
    expect(verificationLevel(v('disputed', ['docs-1', 'community-1']), evidence)).toBe('disputed')
  })

  it('is unverified for na verdicts', () => {
    expect(verificationLevel(v('na', []), evidence)).toBe('unverified')
  })

  it('is unverified for none verdicts', () => {
    expect(verificationLevel(v('none', []), evidence)).toBe('unverified')
  })

  it('is unverified when a non-none/na verdict cites zero evidence', () => {
    expect(verificationLevel(v('full', []), evidence)).toBe('unverified')
  })

  it('is tested when any cited evidence is tier probe', () => {
    expect(verificationLevel(v('full', ['docs-1', 'probe-1']), evidence)).toBe('tested')
  })

  it('is corroborated when any cited evidence is tier community (and none is probe)', () => {
    expect(verificationLevel(v('partial', ['docs-1', 'community-1']), evidence)).toBe('corroborated')
  })

  it('is vendor-claim when only claimed-docs/github evidence is cited', () => {
    expect(verificationLevel(v('full', ['docs-1', 'gh-1']), evidence)).toBe('vendor-claim')
  })
})

describe('strongestEvidence', () => {
  it('returns null when the verdict cites no evidence', () => {
    expect(strongestEvidence(v('none', []), evidence)).toBeNull()
  })

  it('returns null when cited ids do not resolve in the evidence map', () => {
    expect(strongestEvidence(v('full', ['ghost']), evidence)).toBeNull()
  })

  it('prefers probe over every other tier', () => {
    expect(strongestEvidence(v('full', ['docs-1', 'gh-1', 'community-1', 'probe-1']), evidence)?.id).toBe('probe-1')
  })

  it('prefers github over community and claimed-docs when no probe is cited', () => {
    expect(strongestEvidence(v('full', ['docs-1', 'community-1', 'gh-1']), evidence)?.id).toBe('gh-1')
  })

  it('prefers community over claimed-docs when neither probe nor github is cited', () => {
    expect(strongestEvidence(v('partial', ['docs-1', 'community-1']), evidence)?.id).toBe('community-1')
  })

  it('falls back to claimed-docs when it is the only tier cited', () => {
    expect(strongestEvidence(v('full', ['docs-1']), evidence)?.id).toBe('docs-1')
  })

  it('picks the first citation within the winning tier', () => {
    const twoDocs = new Map(evidence)
    twoDocs.set('docs-2', { id: 'docs-2', tier: 'claimed-docs', url: 'https://example.com/2', excerpt: 'y', fetchedAt: '2026-08-26T00:00:00.000Z' })
    expect(strongestEvidence(v('full', ['docs-2', 'docs-1']), twoDocs)?.id).toBe('docs-2')
  })
})

describe('verificationMix', () => {
  const category: Category = { id: 'cat', name: 'Cat', description: 'd', personas: ['dev'] }
  const products: Product[] = [{ id: 'p', name: 'P', vendor: 'v', type: 'oss', urls: { site: 'https://p.example' } }]
  const stories: Story[] = [
    { id: 's1', persona: 'dev', title: 't1', theme: 'core', group: 'core-basics', weight: 1 },
    { id: 's2', persona: 'dev', title: 't2', theme: 'core', group: 'core-basics', weight: 1 },
    { id: 's3', persona: 'dev', title: 't3', theme: 'core', group: 'core-basics', weight: 1 },
    { id: 's4', persona: 'dev', title: 't4', theme: 'core', group: 'core-basics', weight: 1 },
    { id: 's5', persona: 'dev', title: 't5', theme: 'core', group: 'core-basics', weight: 1 },
  ]

  function makeData(verdicts: Verdict[]): CategoryData {
    return {
      category,
      products,
      stories,
      evidence: { p: [ev('docs-1', 'claimed-docs'), ev('community-1', 'community'), ev('probe-1', 'probe')] },
      verdicts,
      rankings: { generatedAt: '2026-08-26T00:00:00.000Z', leaderboard: [], battles: [] },
      stacks: [],
      popularity: {},
      claims: {},
      uncertainty: [],
      vendorResponses: [],
      certifications: [],
    }
  }

  it('counts each verified level, excluding unverified (na/none/uncited) cells', () => {
    const data = makeData([
      { productId: 'p', storyId: 's1', verdict: 'full', quality: 8, confidence: 'high', rationale: 'r', evidenceIds: ['docs-1'] },
      { productId: 'p', storyId: 's2', verdict: 'full', quality: 8, confidence: 'high', rationale: 'r', evidenceIds: ['community-1'] },
      { productId: 'p', storyId: 's3', verdict: 'full', quality: 8, confidence: 'high', rationale: 'r', evidenceIds: ['probe-1'] },
      { productId: 'p', storyId: 's4', verdict: 'disputed', quality: 3, confidence: 'medium', rationale: 'r', evidenceIds: ['docs-1'] },
      { productId: 'p', storyId: 's5', verdict: 'none', quality: 0, confidence: 'high', rationale: 'r', evidenceIds: [] },
    ])
    expect(verificationMix(data, 'p')).toEqual({
      'vendor-claim': 1,
      corroborated: 1,
      tested: 1,
      disputed: 1,
    })
  })

  it('returns all zeros when every cell is unverified', () => {
    const data = makeData(
      stories.map((s) => ({
        productId: 'p', storyId: s.id, verdict: 'na', quality: 0, confidence: 'high', rationale: 'r', evidenceIds: [],
      })),
    )
    expect(verificationMix(data, 'p')).toEqual({ 'vendor-claim': 0, corroborated: 0, tested: 0, disputed: 0 })
  })
})

describe('isAuthGatedEvidence + cellAuthGated (the auth-wall honesty marker)', () => {
  const wall = (id: string, excerpt: string, tier: Evidence['tier'] = 'probe'): Evidence => ({
    id, tier, url: 'https://mcp.example.com/mcp', excerpt, fetchedAt: '2026-09-05T00:00:00.000Z',
  })

  it('matches the corpus wordings for probe-recorded auth walls', () => {
    // composio (rankings/mcp-infrastructure/evidence/composio.json)
    expect(isAuthGatedEvidence(wall('a', 'PROBE mcp-endpoint (2026-09-05): POST initialize returned HTTP 401 with an OAuth challenge — live and vaults access behind managed auth'))).toBe(true)
    // mem0 (rankings/ai-memory/evidence/mem0.json)
    expect(isAuthGatedEvidence(wall('b', 'PROBE runtime: keyless JSON-RPC initialize POST returned HTTP 401 with a `WWW-Authenticate: Bearer` OAuth challenge and protected-resource metadata'))).toBe(true)
    // glama (rankings/mcp-infrastructure/evidence/glama.json)
    expect(isAuthGatedEvidence(wall('c', 'PROBE registry-api: HTTP 401 with a JSON auth challenge ({"error":{"code":"unauthorized","message":"This endpoint requires an API key"}})'))).toBe(true)
    // 403 walls count too
    expect(isAuthGatedEvidence(wall('d', 'PROBE runtime: POST returned HTTP 403 Forbidden with an OAuth challenge'))).toBe(true)
  })

  it('never fires on non-probe tiers, plain 404s, or auth-less probes', () => {
    expect(isAuthGatedEvidence(wall('e', 'HTTP 401 with an OAuth challenge', 'claimed-docs'))).toBe(false)
    expect(isAuthGatedEvidence(wall('f', 'PROBE llms.txt: HTTP 404 at https://x.example/llms.txt'))).toBe(false)
    expect(isAuthGatedEvidence(wall('g', 'PROBE llms.txt: HTTP 200 at https://x.example/llms.txt'))).toBe(false)
    // status code without any auth context (e.g. a bare CDN retry mention) stays quiet
    expect(isAuthGatedEvidence(wall('h', 'PROBE runtime: HTTP 403 from CDN edge, retried'))).toBe(false)
  })

  it('cellAuthGated fires only when the verdict CITES an auth-wall probe', () => {
    const authWall = wall('wall-1', 'PROBE runtime: HTTP 401 with an OAuth challenge')
    const map = new Map<string, Evidence>([['wall-1', authWall], ['docs-1', ev('docs-1', 'claimed-docs')]])
    expect(cellAuthGated(v('partial', ['wall-1']), map)).toBe(true)
    expect(cellAuthGated(v('partial', ['docs-1']), map)).toBe(false)
    expect(cellAuthGated(v('none', []), map)).toBe(false)
  })
})
