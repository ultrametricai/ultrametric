import { describe, expect, it } from 'vitest'
import type { Story } from '@/lib/schemas'
import {
  AGENTIC_FEATURE_STORIES,
  AGENTIC_STORIES,
  API_QUALITY_STORIES,
  AUTOMATION_STORIES,
  OPENNESS_STORIES,
  PRIVACY_STORIES,
} from '@/pipeline/agentic-stories'
import { PROMPT_VERSION } from '@/pipeline/stages/judge'
import { assembleTaxonomy } from '@/pipeline/stages/normalize'

const s = (over: Partial<Story>): Story => ({
  id: 'story-a',
  persona: 'developer',
  title: 'As a developer, I can do a thing',
  theme: 'dev-experience',
  group: 'dev-tools',
  weight: 2,
  ...over,
})

describe('assembleTaxonomy', () => {
  it('drops LLM stories with theme agenticness or id starting agentic-, and appends the canon', () => {
    const llmStories = [
      s({ id: 'story-a', theme: 'dev-experience' }),
      s({ id: 'story-b', theme: 'agenticness', group: 'agent-access' }),
      s({ id: 'agentic-something-custom', theme: 'dev-experience' }),
    ]
    const result = assembleTaxonomy(llmStories)

    // Non-agentic LLM story survives.
    expect(result.find((r) => r.id === 'story-a')).toBeDefined()
    // LLM agentic dupes are dropped.
    expect(result.find((r) => r.id === 'story-b')).toBeUndefined()
    expect(result.find((r) => r.id === 'agentic-something-custom')).toBeUndefined()

    // Canonical ids all present exactly once (agent-access, agentic-features, api-quality,
    // openness, automation-depth, and privacy-posture groups — 29 canonical stories total).
    const allCanon = [
      ...AGENTIC_STORIES,
      ...AGENTIC_FEATURE_STORIES,
      ...API_QUALITY_STORIES,
      ...OPENNESS_STORIES,
      ...AUTOMATION_STORIES,
      ...PRIVACY_STORIES,
    ]
    expect(allCanon).toHaveLength(29)
    for (const canon of allCanon) {
      expect(result.filter((r) => r.id === canon.id)).toHaveLength(1)
    }
  })

  it('drops LLM stories that duplicate the newer lens canon (openness, automation-depth, privacy-posture)', () => {
    const llmStories = [
      s({ id: 'story-c', theme: 'dev-experience' }),
      s({ id: 'story-d', theme: 'openness', group: 'openness' }),
      s({ id: 'openness-custom', theme: 'dev-experience' }),
      s({ id: 'story-e', theme: 'automation-depth', group: 'automation-depth' }),
      s({ id: 'automation-custom', theme: 'dev-experience' }),
      s({ id: 'story-f', theme: 'privacy-posture', group: 'privacy-posture' }),
      s({ id: 'privacy-custom', theme: 'dev-experience' }),
    ]
    const result = assembleTaxonomy(llmStories)

    expect(result.find((r) => r.id === 'story-c')).toBeDefined()
    for (const dropped of ['story-d', 'openness-custom', 'story-e', 'automation-custom', 'story-f', 'privacy-custom']) {
      expect(result.find((r) => r.id === dropped)).toBeUndefined()
    }
    for (const canon of [...OPENNESS_STORIES, ...AUTOMATION_STORIES, ...PRIVACY_STORIES]) {
      expect(result.filter((r) => r.id === canon.id)).toHaveLength(1)
    }
  })

  it('drops LLM stories that duplicate the api-quality canon (theme agenticness, id prefix api-)', () => {
    const llmStories = [
      s({ id: 'story-g', theme: 'dev-experience' }),
      s({ id: 'story-h', theme: 'agenticness', group: 'api-quality' }),
      s({ id: 'api-custom-thing', theme: 'dev-experience' }),
    ]
    const result = assembleTaxonomy(llmStories)

    expect(result.find((r) => r.id === 'story-g')).toBeDefined()
    for (const dropped of ['story-h', 'api-custom-thing']) {
      expect(result.find((r) => r.id === dropped)).toBeUndefined()
    }
    for (const canon of API_QUALITY_STORIES) {
      expect(result.filter((r) => r.id === canon.id)).toHaveLength(1)
    }
  })

  it('sorts output by theme, then group, then id', () => {
    const llmStories = [
      s({ id: 'z-story', theme: 'zzz-theme', group: 'zzz-group' }),
      s({ id: 'a-story', theme: 'aaa-theme', group: 'aaa-group' }),
    ]
    const result = assembleTaxonomy(llmStories)
    const sorted = [...result].sort(
      (x, y) => x.theme.localeCompare(y.theme) || x.group.localeCompare(y.group) || x.id.localeCompare(y.id),
    )
    expect(result).toEqual(sorted)
  })

  it('throws on a duplicate id', () => {
    const llmStories = [s({ id: 'dup-id' }), s({ id: 'dup-id', title: 'different title' })]
    expect(() => assembleTaxonomy(llmStories)).toThrow(/duplicate/i)
  })

  it('stamps normalized origin (with promptVersion) on LLM-authored stories and canonical origin (no promptVersion) on injected lens stories', () => {
    const recordedAt = '2026-08-27T22:35:38-07:00'
    const llmStories = [s({ id: 'story-a', theme: 'dev-experience' })]
    const result = assembleTaxonomy(llmStories, recordedAt)

    const authored = result.find((r) => r.id === 'story-a')!
    expect(authored.origin).toEqual({ kind: 'normalized', promptVersion: PROMPT_VERSION, recordedAt })

    const canonical = result.find((r) => r.id === 'agentic-public-api')!
    expect(canonical.origin).toEqual({ kind: 'canonical', recordedAt })
  })

  it('defaults recordedAt to roughly now when not given', () => {
    const before = Date.now()
    const result = assembleTaxonomy([s({ id: 'story-a', theme: 'dev-experience' })])
    const after = Date.now()
    const recordedAt = result.find((r) => r.id === 'story-a')!.origin!.recordedAt!
    expect(new Date(recordedAt).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Date(recordedAt).getTime()).toBeLessThanOrEqual(after)
  })
})
