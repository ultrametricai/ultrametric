import { describe, expect, it } from 'vitest'
import {
  ClaimSchema, ClaimsArraySchema, EvidenceSchema, PopularityMapSchema, PopularitySchema,
  ProductSchema, RankingsSchema, StoryOriginSchema, StorySchema, UncertaintyEntrySchema, VerdictSchema,
  YcCompanySchema, YcMapSchema,
} from '@/lib/schemas'

describe('schemas', () => {
  it('accepts a valid verdict', () => {
    const v = {
      productId: 'omarchy', storyId: 'keyboard-tiling', verdict: 'full',
      quality: 9, confidence: 'high', rationale: 'Tiling is the default paradigm.',
      evidenceIds: ['omarchy-docs-1'],
    }
    expect(VerdictSchema.parse(v)).toEqual(v)
  })

  it('rejects a non-none verdict with zero evidence', () => {
    const r = VerdictSchema.safeParse({
      productId: 'p', storyId: 's', verdict: 'full', quality: 9,
      confidence: 'high', rationale: 'x', evidenceIds: [],
    })
    expect(r.success).toBe(false)
  })

  it('allows a none verdict with zero evidence', () => {
    const r = VerdictSchema.safeParse({
      productId: 'p', storyId: 's', verdict: 'none', quality: 0,
      confidence: 'medium', rationale: 'No sign of this capability.', evidenceIds: [],
    })
    expect(r.success).toBe(true)
  })

  it('rejects out-of-range quality and weight', () => {
    expect(StorySchema.safeParse({ id: 's', persona: 'developer', title: 't', theme: 'x', group: 'core', weight: 4 }).success).toBe(false)
    expect(VerdictSchema.safeParse({
      productId: 'p', storyId: 's', verdict: 'full', quality: 11,
      confidence: 'high', rationale: 'x', evidenceIds: ['e'],
    }).success).toBe(false)
  })

  it('rejects an unknown evidence tier', () => {
    expect(EvidenceSchema.safeParse({
      id: 'e', tier: 'blog', url: 'https://x.com', excerpt: 'q', fetchedAt: '2026-08-26T00:00:00Z',
    }).success).toBe(false)
  })

  it('evidence preserve marker: accepts true, keeps it through parse, rejects false', () => {
    const row = {
      id: 'e', tier: 'probe', url: 'https://x.com', excerpt: 'recorded counter-check',
      fetchedAt: '2026-10-14T00:00:00Z', preserve: true,
    }
    expect(EvidenceSchema.parse(row)).toEqual(row)
    expect(EvidenceSchema.safeParse({ ...row, preserve: false }).success).toBe(false)
  })

  it('requires a valid site url on products', () => {
    expect(ProductSchema.safeParse({
      id: 'p', name: 'P', vendor: 'V', type: 'oss', urls: { site: 'not-a-url' },
    }).success).toBe(false)
  })

  it('requires a group on stories', () => {
    expect(StorySchema.safeParse({ id: 's', persona: 'developer', title: 't', theme: 'security', weight: 2 }).success).toBe(false)
    expect(StorySchema.safeParse({ id: 's', persona: 'ai-native', title: 't', theme: 'security', group: 'two-factor-auth', weight: 2 }).success).toBe(true)
  })

  it('accepts na verdicts with zero evidence and quality 0 only', () => {
    const base = { productId: 'p', storyId: 's', confidence: 'medium', rationale: 'axis does not apply', evidenceIds: [] }
    expect(VerdictSchema.safeParse({ ...base, verdict: 'na', quality: 0 }).success).toBe(true)
    expect(VerdictSchema.safeParse({ ...base, verdict: 'na', quality: 3 }).success).toBe(false)
  })

  it('accepts nullable theme scores, agentReady/agenticApp and applicability on rankings', () => {
    const r = {
      generatedAt: '2026-08-27T00:00:00Z',
      leaderboard: [{
        productId: 'p', score: 50, agentReady: null, agenticApp: 75, apiQuality: null, aiEra: 60,
        applicable: 10, total: 12, themeScores: { security: null, agenticness: 75 },
      }],
      battles: [{ a: 'p', b: 'q', winner: 'draw', record: { aWins: 0, bWins: 0, draws: 1 }, rounds: [{ storyId: 's', winner: 'na', margin: 0 }] }],
    }
    expect(RankingsSchema.safeParse(r).success).toBe(true)
  })

  it('accepts an optional urls.news launch surface on products', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'commercial' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse(base).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, urls: { ...base.urls, news: 'https://p.example/newsroom' } }).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, urls: { ...base.urls, news: 'not-a-url' } }).success).toBe(false)
  })

  it('accepts an optional links object on products', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'oss' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse(base).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, links: { app: 'https://app.p.example', api: 'https://docs.p.example' } }).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, links: { app: 'not-a-url' } }).success).toBe(false)
  })

  it('accepts an optional businessModel object on products', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'commercial' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse(base).success).toBe(true)
    expect(ProductSchema.safeParse({
      ...base,
      businessModel: { models: ['freemium', 'subscription-per-seat'], summary: 'Free tier plus paid per-seat plans.', url: 'https://p.example/pricing' },
    }).success).toBe(true)
  })

  it('rejects a businessModel with an empty models array', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'commercial' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse({
      ...base,
      businessModel: { models: [], summary: 'Free tier plus paid per-seat plans.', url: 'https://p.example/pricing' },
    }).success).toBe(false)
  })

  it('accepts a story without origin (backward compatible)', () => {
    expect(StorySchema.safeParse({ id: 's', persona: 'ai-native', title: 't', theme: 'x', group: 'core', weight: 2 }).success).toBe(true)
  })

  it('accepts a canonical story origin without promptVersion', () => {
    const r = StorySchema.safeParse({
      id: 'agentic-public-api', persona: 'ai-native', title: 't', theme: 'agenticness', group: 'agent-access', weight: 3,
      origin: { kind: 'canonical', recordedAt: '2026-08-27T22:35:38-07:00' },
    })
    expect(r.success).toBe(true)
  })

  it('accepts a normalized story origin with promptVersion', () => {
    const r = StorySchema.safeParse({
      id: 's', persona: 'developer', title: 't', theme: 'x', group: 'core', weight: 2,
      origin: { kind: 'normalized', promptVersion: 'v2', recordedAt: '2026-08-27T22:35:38-07:00' },
    })
    expect(r.success).toBe(true)
  })

  it('accepts a mined story origin with promptVersion', () => {
    const r = StorySchema.safeParse({
      id: 'documented-rate-limits', persona: 'developer', title: 't', theme: 'agenticness', group: 'api-quality', weight: 3,
      origin: { kind: 'mined', promptVersion: 'v2-depth', recordedAt: '2026-09-02T23:54:25.620Z' },
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown origin kind', () => {
    expect(StoryOriginSchema.safeParse({ kind: 'invented' }).success).toBe(false)
  })

  it('rejects a businessModel with a too-short summary or bad url', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'commercial' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse({
      ...base,
      businessModel: { models: ['freemium'], summary: 'short', url: 'https://p.example/pricing' },
    }).success).toBe(false)
    expect(ProductSchema.safeParse({
      ...base,
      businessModel: { models: ['freemium'], summary: 'Free tier plus paid per-seat plans.', url: 'not-a-url' },
    }).success).toBe(false)
  })

  it('accepts an optional install array on products', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'oss' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse(base).success).toBe(true)
    expect(ProductSchema.safeParse({
      ...base,
      install: [{ label: 'npm', command: 'npm i p', url: 'https://p.example/docs' }],
    }).success).toBe(true)
    expect(ProductSchema.safeParse({
      ...base,
      install: [{ label: 'npm', command: 'npm i p' }],
    }).success).toBe(true)
  })

  it('rejects an install entry with a too-short command, bad url, or empty label', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'oss' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse({ ...base, install: [{ label: 'npm', command: 'x' }] }).success).toBe(false)
    expect(ProductSchema.safeParse({ ...base, install: [{ label: '', command: 'npm i p' }] }).success).toBe(false)
    expect(ProductSchema.safeParse({
      ...base,
      install: [{ label: 'npm', command: 'npm i p', url: 'not-a-url' }],
    }).success).toBe(false)
  })

  it('caps the install array at 4 entries', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'oss' as const, urls: { site: 'https://p.example' } }
    const entry = { label: 'npm', command: 'npm i p' }
    expect(ProductSchema.safeParse({ ...base, install: [entry, entry, entry, entry] }).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, install: [entry, entry, entry, entry, entry] }).success).toBe(false)
  })

  it('accepts a popularity record with only some fields present', () => {
    const r = PopularitySchema.safeParse({ stars: 230_000, starsPerYear: 11_500, fetchedAt: '2026-08-27T00:00:00Z' })
    expect(r.success).toBe(true)
  })

  it('accepts a popularity record with just fetchedAt (fetch attempted, nothing found)', () => {
    expect(PopularitySchema.safeParse({ fetchedAt: '2026-08-27T00:00:00Z' }).success).toBe(true)
  })

  it('requires fetchedAt on a popularity record', () => {
    expect(PopularitySchema.safeParse({ stars: 100 }).success).toBe(false)
  })

  it('rejects negative counts on a popularity record', () => {
    expect(PopularitySchema.safeParse({ stars: -1, fetchedAt: '2026-08-27T00:00:00Z' }).success).toBe(false)
  })

  it('parses a productId -> Popularity map', () => {
    const r = PopularityMapSchema.safeParse({
      react: { stars: 230_000, fetchedAt: '2026-08-27T00:00:00Z' },
      vllm: { pypiWeekly: 500_000, fetchedAt: '2026-08-27T00:00:00Z' },
    })
    expect(r.success).toBe(true)
  })

  it('accepts a claim with an empty storyIds array (taxonomy gap)', () => {
    const c = {
      id: 'p-claim-1', text: 'Ships an official CLI', quote: 'Ships a CLI for automation',
      url: 'https://p.example/docs', sourceTier: 'claimed-docs' as const, storyIds: [],
      extractedAt: '2026-08-27T00:00:00Z',
    }
    expect(ClaimSchema.safeParse(c).success).toBe(true)
  })

  it('rejects a claim with text or quote over the length cap, or a non-claim sourceTier', () => {
    const base = {
      id: 'p-claim-1', text: 'x'.repeat(160), quote: 'y'.repeat(240),
      url: 'https://p.example/docs', sourceTier: 'claimed-docs' as const, storyIds: [],
      extractedAt: '2026-08-27T00:00:00Z',
    }
    expect(ClaimSchema.safeParse(base).success).toBe(true)
    expect(ClaimSchema.safeParse({ ...base, text: 'x'.repeat(161) }).success).toBe(false)
    expect(ClaimSchema.safeParse({ ...base, quote: 'y'.repeat(241) }).success).toBe(false)
    expect(ClaimSchema.safeParse({ ...base, sourceTier: 'community' }).success).toBe(false)
  })

  it('accepts a valid ycBatch on products and rejects a malformed one', () => {
    const base = { id: 'p', name: 'P', vendor: 'V', type: 'commercial' as const, urls: { site: 'https://p.example' } }
    expect(ProductSchema.safeParse({ ...base, ycBatch: 'S22' }).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, ycBatch: 'W17' }).success).toBe(true)
    // Four-batch era: Spring is X, Fall is F.
    expect(ProductSchema.safeParse({ ...base, ycBatch: 'X25' }).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, ycBatch: 'F25' }).success).toBe(true)
    expect(ProductSchema.safeParse({ ...base, ycBatch: 'Summer 2022' }).success).toBe(false)
    expect(ProductSchema.safeParse({ ...base, ycBatch: 's22' }).success).toBe(false)
    expect(ProductSchema.safeParse({ ...base, ycBatch: 'A25' }).success).toBe(false)
  })

  it('caps a product claims array at 60 entries', () => {
    const claim = (n: number) => ({
      id: `p-claim-${n}`, text: `claim ${n}`, quote: `quote ${n}`,
      url: 'https://p.example/docs', sourceTier: 'github' as const, storyIds: [],
      extractedAt: '2026-08-27T00:00:00Z',
    })
    expect(ClaimsArraySchema.safeParse([]).success).toBe(true)
    expect(ClaimsArraySchema.safeParse(Array.from({ length: 60 }, (_, i) => claim(i))).success).toBe(true)
    expect(ClaimsArraySchema.safeParse(Array.from({ length: 61 }, (_, i) => claim(i))).success).toBe(false)
  })
})

describe('UncertaintyEntrySchema', () => {
  it('accepts a valid entry', () => {
    const u = {
      productId: 'claude-code', storyId: 'agentic-mcp-server',
      judgments: ['na', 'na', 'na'] as const, agreement: '3/3' as const,
    }
    expect(UncertaintyEntrySchema.safeParse(u).success).toBe(true)
  })

  it('rejects a judgments array that is not exactly length 3', () => {
    expect(UncertaintyEntrySchema.safeParse({
      productId: 'p', storyId: 's', judgments: ['full', 'full'], agreement: '3/3',
    }).success).toBe(false)
  })

  it('rejects an agreement value outside the n/3 enum', () => {
    expect(UncertaintyEntrySchema.safeParse({
      productId: 'p', storyId: 's', judgments: ['full', 'full', 'full'], agreement: '4/3',
    }).success).toBe(false)
  })

  it('rejects a judgment tier the judge could never produce', () => {
    expect(UncertaintyEntrySchema.safeParse({
      productId: 'p', storyId: 's', judgments: ['full', 'full', 'maybe'], agreement: '2/3',
    }).success).toBe(false)
  })
})

describe('YcCompanySchema / YcMapSchema', () => {
  const base = {
    name: 'Acme', slug: 'acme', batch: 'Summer 2023', website: 'https://acme.example',
    oneLiner: 'Widgets for agents', tags: ['B2B', 'AI'],
  }

  it('accepts a company mapped to an existing arena', () => {
    expect(YcCompanySchema.safeParse({ ...base, mappedArena: 'startup-banking', proposedArena: null }).success).toBe(true)
  })

  it('accepts a company mapped to a proposed new arena', () => {
    expect(YcCompanySchema.safeParse({ ...base, mappedArena: null, proposedArena: 'ai-legal-assistants' }).success).toBe(true)
  })

  it('accepts a company mapped to neither (not a rankable software product)', () => {
    expect(YcCompanySchema.safeParse({ ...base, mappedArena: null, proposedArena: null }).success).toBe(true)
  })

  it('rejects a company with both mappedArena and proposedArena set', () => {
    expect(YcCompanySchema.safeParse({ ...base, mappedArena: 'startup-banking', proposedArena: 'ai-legal-assistants' }).success).toBe(false)
  })

  it('rejects a non-kebab-case proposedArena', () => {
    expect(YcCompanySchema.safeParse({ ...base, mappedArena: null, proposedArena: 'AI Legal Assistants' }).success).toBe(false)
  })

  it('validates an array of companies as YcMapSchema', () => {
    const r = YcMapSchema.safeParse([
      { ...base, mappedArena: null, proposedArena: null },
      { ...base, slug: 'acme-2', mappedArena: 'web-scraping', proposedArena: null },
    ])
    expect(r.success).toBe(true)
  })
})
