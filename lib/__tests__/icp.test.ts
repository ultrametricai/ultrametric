import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadAll, type CategoryData } from '@/lib/data'
import type { Category, Product, Story, Verdict } from '@/lib/schemas'
import {
  loadIcpTypes,
  buildIcpRanking,
  icpScore,
  icpStoryWeight,
  IcpTypesSchema,
  isEmphasized,
  PERSONA_EMPHASIS_MULTIPLIER,
  type IcpType,
} from '@/lib/icp'

const category: Category = { id: 'cat', name: 'Cat', description: 'd', personas: ['dev', 'founder'] }

const story = (id: string, over: Partial<Story> = {}): Story => ({
  id,
  persona: 'dev',
  title: `t-${id}`,
  theme: 'core',
  group: 'core-basics',
  weight: 1,
  ...over,
})

const verdict = (productId: string, storyId: string, over: Partial<Verdict> = {}): Verdict => ({
  productId,
  storyId,
  verdict: 'full',
  quality: 8,
  confidence: 'high',
  rationale: 'r',
  evidenceIds: ['e1'],
  ...over,
})

const product = (id: string, type: Product['type'] = 'commercial'): Product => ({
  id,
  name: id.toUpperCase(),
  vendor: 'v',
  type,
  urls: { site: `https://${id}.example` },
})

function makeData(products: Product[], stories: Story[], verdicts: Verdict[]): CategoryData {
  return {
    category,
    products,
    stories,
    evidence: Object.fromEntries(products.map((p) => [p.id, [{ id: 'e1', tier: 'probe' as const, url: 'https://e.example', excerpt: 'x', fetchedAt: '2026-08-26T00:00:00.000Z' }]])),
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

const icp = (over: Partial<IcpType['emphasis']> = {}, id = 'test-icp'): IcpType => ({
  id,
  name: 'Test ICP',
  tagline: 'tag',
  emphasis: { personas: ['founder'], themeWeights: { special: 2 }, ...over },
})

describe('isEmphasized / icpStoryWeight', () => {
  it('emphasizes stories by persona, theme, or group — and nothing else', () => {
    const lens = icp({ groupWeights: { 'special-group': 1.5 } })
    expect(isEmphasized(story('s1', { persona: 'founder' }), lens)).toBe(true)
    expect(isEmphasized(story('s2', { theme: 'special' }), lens)).toBe(true)
    expect(isEmphasized(story('s3', { group: 'special-group' }), lens)).toBe(true)
    expect(isEmphasized(story('s4'), lens)).toBe(false)
    expect(icpStoryWeight(story('s4'), lens)).toBeNull()
  })

  it('multiplies canonical weight by persona, theme, and group emphasis together', () => {
    const lens = icp({ groupWeights: { 'special-group': 1.5 } })
    const s = story('s1', { persona: 'founder', theme: 'special', group: 'special-group', weight: 3 })
    expect(icpStoryWeight(s, lens)).toBeCloseTo(3 * PERSONA_EMPHASIS_MULTIPLIER * 2 * 1.5)
    // Theme-only match: no persona boost, no group boost.
    expect(icpStoryWeight(story('s2', { theme: 'special', weight: 2 }), lens)).toBeCloseTo(4)
  })
})

describe('icpScore', () => {
  it('returns null (not 0) when the product has zero applicable emphasized cells', () => {
    const stories = [story('s1', { theme: 'special' }), story('s2')]
    const data = makeData(
      [product('p')],
      stories,
      [
        // The only emphasized cell is na — no applicable emphasized evidence at all.
        verdict('p', 's1', { verdict: 'na', quality: 0, evidenceIds: [] }),
        verdict('p', 's2'),
      ],
    )
    expect(icpScore(data, 'p', icp())).toBeNull()
  })

  it('returns 0 (not null) when emphasized cells exist but all fail', () => {
    const data = makeData(
      [product('p')],
      [story('s1', { theme: 'special' })],
      [verdict('p', 's1', { verdict: 'none', quality: 0, evidenceIds: [] })],
    )
    expect(icpScore(data, 'p', icp())).toBe(0)
  })

  it('ignores non-emphasized cells entirely', () => {
    const data = makeData(
      [product('p')],
      [story('s1', { theme: 'special' }), story('s2')],
      [
        verdict('p', 's1', { quality: 10 }),
        // A disastrous out-of-scope cell must not drag the lens score down.
        verdict('p', 's2', { verdict: 'none', quality: 0, evidenceIds: [] }),
      ],
    )
    expect(icpScore(data, 'p', icp())).toBe(100)
  })

  it('weight multiplication shifts the blend toward emphasized-heavier stories', () => {
    // Two emphasized stories, equal canonical weight: s1 (persona match, full/10) and
    // s2 (theme match only, none/0). With PERSONA_EMPHASIS_MULTIPLIER=2 the passing story
    // carries 2x the weight: (2*10*1 + 1*0) / (2*10 + 1*10) = 66.7 — not the flat 50.
    const stories = [
      story('s1', { persona: 'founder' }),
      story('s2', { theme: 'special-flat' }),
    ]
    const lens = icp({ personas: ['founder'], themeWeights: { 'special-flat': 1 } })
    const data = makeData(
      [product('p')],
      stories,
      [verdict('p', 's1', { quality: 10 }), verdict('p', 's2', { verdict: 'none', quality: 0, evidenceIds: [] })],
    )
    expect(icpScore(data, 'p', lens)).toBeCloseTo(66.7, 1)
  })

  it('excludes commercial products when the lens requires OSS', () => {
    const data = makeData(
      [product('closed', 'commercial'), product('open', 'oss')],
      [story('s1', { theme: 'special' })],
      [verdict('closed', 's1'), verdict('open', 's1')],
    )
    const lens = icp({ requireOss: true })
    expect(icpScore(data, 'closed', lens)).toBeNull()
    expect(icpScore(data, 'open', lens)).not.toBeNull()
  })
})

describe('buildIcpRanking', () => {
  const stories = [
    story('s1', { theme: 'special' }),
    story('s2', { theme: 'special' }),
    story('s3', { theme: 'special' }),
  ]

  it('ranks in-scope products desc and drops null-score products', () => {
    const data = makeData(
      [product('a'), product('b'), product('c')],
      stories,
      [
        verdict('a', 's1', { quality: 5, verdict: 'partial' }),
        verdict('a', 's2', { quality: 5, verdict: 'partial' }),
        verdict('a', 's3', { quality: 5, verdict: 'partial' }),
        verdict('b', 's1', { quality: 10 }),
        verdict('b', 's2', { quality: 10 }),
        verdict('b', 's3', { quality: 10 }),
        verdict('c', 's1', { verdict: 'na', quality: 0, evidenceIds: [] }),
        verdict('c', 's2', { verdict: 'na', quality: 0, evidenceIds: [] }),
        verdict('c', 's3', { verdict: 'na', quality: 0, evidenceIds: [] }),
      ],
    )
    const rows = buildIcpRanking([data], icp())
    expect(rows.map((r) => r.productId)).toEqual(['b', 'a'])
    expect(rows[0].score).toBe(100)
    expect(rows[0].arenaId).toBe('cat')
  })

  it('drops products below the minimum-applicable floor (single-cell flukes)', () => {
    const data = makeData(
      [product('thin'), product('solid')],
      stories,
      [
        // One perfect emphasized cell, two na — a 100 that rests on almost nothing.
        verdict('thin', 's1', { quality: 10 }),
        verdict('thin', 's2', { verdict: 'na', quality: 0, evidenceIds: [] }),
        verdict('thin', 's3', { verdict: 'na', quality: 0, evidenceIds: [] }),
        verdict('solid', 's1', { quality: 7 }),
        verdict('solid', 's2', { quality: 7 }),
        verdict('solid', 's3', { quality: 7 }),
      ],
    )
    const rows = buildIcpRanking([data], icp())
    expect(rows.map((r) => r.productId)).toEqual(['solid'])
  })
})

describe('IcpTypesSchema', () => {
  it('rejects duplicate ids', () => {
    const one = { id: 'dup', name: 'n', tagline: 't', emphasis: { personas: ['dev'], themeWeights: {} } }
    expect(() => IcpTypesSchema.parse([one, one])).toThrow(/duplicate icp id/)
  })

  it('rejects non-positive multipliers', () => {
    expect(() =>
      IcpTypesSchema.parse([
        { id: 'x', name: 'n', tagline: 't', emphasis: { personas: ['dev'], themeWeights: { core: 0 } } },
      ]),
    ).toThrow()
  })
})

describe('committed rankings/icp-types.json', () => {
  const REAL = path.resolve(__dirname, '../../rankings')

  it('parses and only references personas/themes/groups that exist in live arenas', () => {
    const icps = loadIcpTypes(REAL)
    expect(icps.length).toBeGreaterThanOrEqual(8)

    const personas = new Set<string>()
    const themes = new Set<string>()
    const groups = new Set<string>()
    for (const data of loadAll(REAL)) {
      for (const p of data.category.personas) personas.add(p)
      for (const s of data.stories) {
        personas.add(s.persona)
        themes.add(s.theme)
        groups.add(s.group)
      }
    }

    for (const lens of icps) {
      for (const p of lens.emphasis.personas) expect(personas.has(p), `${lens.id} persona ${p}`).toBe(true)
      for (const t of Object.keys(lens.emphasis.themeWeights)) expect(themes.has(t), `${lens.id} theme ${t}`).toBe(true)
      for (const g of Object.keys(lens.emphasis.groupWeights ?? {})) expect(groups.has(g), `${lens.id} group ${g}`).toBe(true)
    }
  })
})
