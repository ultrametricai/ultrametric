import { describe, expect, it } from 'vitest'
import { rosterDedupeKey, slugify, vendorOf } from '../scripts/radar-bringup'
import type { Disposition } from '../scripts/radar-triage'

describe('rosterDedupeKey', () => {
  it('keys shared-code-host products by owner/repo, not the bare host', () => {
    expect(rosterDedupeKey('https://github.com/kaankiziltug/logo-design-skill')).toBe('github.com/kaankiziltug/logo-design-skill')
    expect(rosterDedupeKey('https://github.com/obra/superpowers')).toBe('github.com/obra/superpowers')
    // Two different GitHub-hosted products never collide (the 2026-10-14 false "already tracked").
    expect(rosterDedupeKey('https://github.com/kaankiziltug/logo-design-skill'))
      .not.toBe(rosterDedupeKey('https://github.com/anthropics/skills'))
    expect(rosterDedupeKey('https://gitlab.com/Owner/Repo/-/tree/main')).toBe('gitlab.com/owner/repo')
  })

  it('keys everything else by normalized site domain', () => {
    expect(rosterDedupeKey('https://www.skills.sh')).toBe('skills.sh')
    expect(rosterDedupeKey('https://ultrametric.ai/some/path')).toBe('ultrametric.ai')
    // The same product behind www/no-www still collides.
    expect(rosterDedupeKey('https://www.skills.sh/docs')).toBe(rosterDedupeKey('https://skills.sh'))
  })

  it('degrades to the domain for a code-host URL without owner/repo, and to null for junk', () => {
    expect(rosterDedupeKey('https://github.com')).toBe('github.com')
    expect(rosterDedupeKey(undefined)).toBeNull()
    expect(rosterDedupeKey('not a url')).toBeNull()
  })
})

describe('slugify / vendorOf', () => {
  it('derives the product id and vendor the roster append uses', () => {
    expect(slugify('Logo Design Skill!')).toBe('logo-design-skill')
    const d = {
      name: 'logo-design-skill',
      url: 'https://github.com/kaankiziltug/logo-design-skill',
      bringup: {
        site: 'https://github.com/kaankiziltug/logo-design-skill',
        github: 'https://github.com/kaankiziltug/logo-design-skill',
        type: 'oss',
      },
    } as unknown as Disposition
    expect(vendorOf(d)).toBe('kaankiziltug')
  })
})
