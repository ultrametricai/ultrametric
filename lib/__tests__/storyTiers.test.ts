import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  loadStoryTiers, StoryTierSchema, storyTierKey, storyTiersByCell, tierCountsFor, type StoryTier,
} from '@/lib/storyTiers'

const tier = (overrides: Partial<StoryTier> = {}): StoryTier => ({
  productId: 'p1',
  storyId: 's1',
  tier: 'unknown',
  ...overrides,
})

describe('StoryTierSchema', () => {
  it('accepts a bare unknown and a fully-cited non-unknown', () => {
    expect(StoryTierSchema.parse(tier())).toEqual(tier())
    const paid = tier({ tier: 'paid', tierNote: 'Requires the Pro plan', tierEvidenceId: 'pricing-fact-1' })
    expect(StoryTierSchema.parse(paid)).toEqual(paid)
  })

  it('rejects a non-unknown tier without its gating citation — honesty is schema-enforced', () => {
    expect(() => StoryTierSchema.parse(tier({ tier: 'enterprise' }))).toThrow()
    expect(() => StoryTierSchema.parse(tier({ tier: 'free', tierNote: 'free plan' }))).toThrow() // no evidence id
    expect(() => StoryTierSchema.parse(tier({ tier: 'free', tierEvidenceId: 'e1' }))).toThrow() // no note
  })

  it('rejects an unknown that smuggles a note/evidence id — nothing was found to quote', () => {
    expect(() => StoryTierSchema.parse(tier({ tierNote: 'probably paid' }))).toThrow()
    expect(() => StoryTierSchema.parse(tier({ tierEvidenceId: 'e1' }))).toThrow()
  })
})

describe('loadStoryTiers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-tiers-'))
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('resolves a missing story-tiers.json to an empty list, never an error', () => {
    fs.mkdirSync(path.join(dir, 'no-file-arena'), { recursive: true })
    expect(loadStoryTiers('no-file-arena', dir)).toEqual([])
  })

  it('parses and caches a real file', () => {
    const arenaDir = path.join(dir, 'arena')
    fs.mkdirSync(arenaDir, { recursive: true })
    const entries = [tier({ tier: 'free', tierNote: 'Free tier includes 10k events', tierEvidenceId: 'e1' })]
    fs.writeFileSync(path.join(arenaDir, 'story-tiers.json'), JSON.stringify(entries))
    expect(loadStoryTiers('arena', dir)).toEqual(entries)
    // Cached: a rewrite is not re-read within the process (same contract as loadPricing).
    fs.writeFileSync(path.join(arenaDir, 'story-tiers.json'), '[]')
    expect(loadStoryTiers('arena', dir)).toEqual(entries)
  })
})

describe('storyTiersByCell / tierCountsFor', () => {
  const tiers: StoryTier[] = [
    tier({ productId: 'a', storyId: 's1', tier: 'free', tierNote: 'n', tierEvidenceId: 'e' }),
    tier({ productId: 'a', storyId: 's2', tier: 'paid', tierNote: 'n', tierEvidenceId: 'e' }),
    tier({ productId: 'a', storyId: 's3', tier: 'enterprise', tierNote: 'n', tierEvidenceId: 'e' }),
    tier({ productId: 'a', storyId: 's4' }),
    tier({ productId: 'b', storyId: 's1', tier: 'paid', tierNote: 'n', tierEvidenceId: 'e' }),
  ]

  it('keys by productId:storyId', () => {
    const map = storyTiersByCell(tiers)
    expect(storyTierKey('a', 's2')).toBe('a:s2')
    expect(map.get('a:s2')?.tier).toBe('paid')
    expect(map.get('b:s1')?.tier).toBe('paid')
    expect(map.get('b:s2')).toBeUndefined()
  })

  it('counts one product only, unknown included so silence stays visible', () => {
    expect(tierCountsFor(tiers, 'a')).toEqual({ free: 1, paid: 1, enterprise: 1, unknown: 1 })
    expect(tierCountsFor(tiers, 'b')).toEqual({ free: 0, paid: 1, enterprise: 0, unknown: 0 })
    expect(tierCountsFor(tiers, 'zzz')).toEqual({ free: 0, paid: 0, enterprise: 0, unknown: 0 })
  })
})

// The renderProductMarkdown pricing-tier cases moved to the private site repo with
// lib/markdown.ts (repo split).
