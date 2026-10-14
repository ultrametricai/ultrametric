import { describe, expect, it } from 'vitest'
import type { Evidence } from '@/lib/schemas'
import { buildEvidence } from '@/pipeline/stages/extract'

describe('buildEvidence', () => {
  const urls = { site: 'https://omarchy.org/', github: 'https://github.com/basecamp/omarchy' }
  const extraction = {
    stories: [
      { persona: 'developer', title: 'tile windows by keyboard', quote: 'Hyprland tiling out of the box', sourceKey: 'site' as const },
      { persona: 'switcher', title: 'install in one command', quote: 'One command converts fresh Arch', sourceKey: 'github' as const },
      { persona: 'power-user', title: 'themes everywhere', quote: 'Hyprland tiling out of the box', sourceKey: 'site' as const },
    ],
  }

  it('assigns tier-based ids, maps urls, dedupes identical quotes', () => {
    const { candidates, evidence } = buildEvidence('omarchy', extraction, urls, '2026-08-26T00:00:00Z')
    expect(evidence).toHaveLength(2) // duplicate quote deduped
    expect(evidence[0]).toMatchObject({ id: 'omarchy-docs-1', tier: 'claimed-docs', url: urls.site })
    expect(evidence[1]).toMatchObject({ id: 'omarchy-gh-1', tier: 'github', url: urls.github })
    expect(candidates).toHaveLength(3)
    expect(candidates[2].evidenceId).toBe('omarchy-docs-1') // deduped story points at existing evidence
  })

  it('maps an extra-N sourceKey to the matching urls.extra entry', () => {
    const urlsWithExtra = { ...urls, extra: ['https://omarchy.org/features'] }
    const extractionWithExtra = {
      stories: [
        { persona: 'developer', title: 'feature x', quote: 'quote from the features page', sourceKey: 'extra-0' as const },
      ],
    }
    const { evidence } = buildEvidence('omarchy', extractionWithExtra, urlsWithExtra, '2026-08-26T00:00:00Z')
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({ tier: 'claimed-docs', url: 'https://omarchy.org/features' })
  })

  it('falls back to the site url when the referenced extra index is missing', () => {
    const extractionWithExtra = {
      stories: [
        { persona: 'developer', title: 'feature y', quote: 'quote pointing at an out-of-range extra', sourceKey: 'extra-3' as const },
      ],
    }
    const { evidence } = buildEvidence('omarchy', extractionWithExtra, urls, '2026-08-26T00:00:00Z')
    expect(evidence[0]).toMatchObject({ url: urls.site })
  })

  describe('monotonic merge with existing claimed-docs/github evidence', () => {
    const existing: Evidence[] = [
      {
        id: 'omarchy-docs-1',
        tier: 'claimed-docs',
        url: urls.site,
        excerpt: 'Hyprland tiling out of the box',
        fetchedAt: '2026-08-01T00:00:00Z',
      },
      {
        id: 'omarchy-gh-1',
        tier: 'github',
        url: urls.github,
        excerpt: 'One command converts fresh Arch',
        fetchedAt: '2026-08-01T00:00:00Z',
      },
    ]

    it('retains an existing item under its old id when re-extraction re-surfaces the same claim (overlap case)', () => {
      // Re-extraction rephrases whitespace/case on the same underlying claim, plus one
      // genuinely new claim — a realistic re-run over an expanded corpus.
      const rerun = {
        stories: [
          { persona: 'developer', title: 'tile windows by keyboard', quote: '  HYPRLAND   tiling out of the box  ', sourceKey: 'site' as const },
          { persona: 'developer', title: 'new capability', quote: 'Built-in screen recorder', sourceKey: 'site' as const },
        ],
      }
      const { candidates, evidence } = buildEvidence('omarchy', rerun, urls, '2026-08-27T00:00:00Z', existing)

      // Old items are retained verbatim (including the untouched gh item this run never mentioned).
      expect(evidence).toContainEqual(existing[0])
      expect(evidence).toContainEqual(existing[1])
      // The re-surfaced claim reuses the existing id, not a freshly minted one.
      expect(candidates[0].evidenceId).toBe('omarchy-docs-1')
      // The genuinely new claim gets a fresh id continuing after the existing max index (docs-1 -> docs-2).
      expect(candidates[1].evidenceId).toBe('omarchy-docs-2')
      expect(evidence).toHaveLength(3)
    })

    it('never collides a freshly minted id with an existing one (id stability case)', () => {
      const rerun = {
        stories: [
          { persona: 'developer', title: 'another new capability', quote: 'Ships a built-in compositor switcher', sourceKey: 'site' as const },
          { persona: 'switcher', title: 'yet another', quote: 'One command reinstalls the whole rice', sourceKey: 'github' as const },
        ],
      }
      const { evidence } = buildEvidence('omarchy', rerun, urls, '2026-08-27T00:00:00Z', existing)
      const ids = evidence.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length) // no duplicate ids
      expect(ids).toContain('omarchy-docs-1') // retained
      expect(ids).toContain('omarchy-docs-2') // new, continues after existing docs-1
      expect(ids).toContain('omarchy-gh-1') // retained
      expect(ids).toContain('omarchy-gh-2') // new, continues after existing gh-1
    })
  })
})
