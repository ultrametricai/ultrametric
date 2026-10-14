import { describe, expect, it } from 'vitest'
import type { Story } from '@/lib/schemas'
import { AGENTIC_STORIES } from '@/pipeline/agentic-stories'
import { CANONICAL_IDS, stampOrigin } from '@/pipeline/scripts/migrate-story-origin'
import { PROMPT_VERSION } from '@/pipeline/stages/judge'

const RECORDED_AT = '2026-08-27T22:35:38-07:00'

describe('migrate-story-origin', () => {
  it('has exactly the 29 canonical ids', () => {
    expect(CANONICAL_IDS.size).toBe(29)
    expect(CANONICAL_IDS.has('agentic-public-api')).toBe(true)
    expect(CANONICAL_IDS.has('openness-self-host')).toBe(true)
    expect(CANONICAL_IDS.has('privacy-no-training')).toBe(true)
  })

  it('stamps canonical origin (no promptVersion) for a canonical id', () => {
    const story: Story = AGENTIC_STORIES[0]
    const stamped = stampOrigin(story, RECORDED_AT)
    expect(stamped.origin).toEqual({ kind: 'canonical', recordedAt: RECORDED_AT })
  })

  it('stamps normalized origin (with the current judge PROMPT_VERSION) for a non-canonical id', () => {
    const story: Story = {
      id: 'window-tiling', persona: 'power-user', title: 'As a power-user, I can tile windows',
      theme: 'window-management', group: 'tiling', weight: 2,
    }
    const stamped = stampOrigin(story, RECORDED_AT)
    expect(stamped.origin).toEqual({ kind: 'normalized', promptVersion: PROMPT_VERSION, recordedAt: RECORDED_AT })
  })

  it('does not mutate other story fields', () => {
    const story: Story = {
      id: 'window-tiling', persona: 'power-user', title: 'As a power-user, I can tile windows',
      theme: 'window-management', group: 'tiling', weight: 2,
    }
    const stamped = stampOrigin(story, RECORDED_AT)
    expect(stamped.id).toBe(story.id)
    expect(stamped.title).toBe(story.title)
    expect(stamped.weight).toBe(story.weight)
  })
})
