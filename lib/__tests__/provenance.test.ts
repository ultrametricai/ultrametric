import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  attachProvenance,
  canonicalJson,
  computeFingerprint,
  provenanceLine,
  verifyProvenance,
} from '@/lib/provenance'
import { RankingsSchema, type Rankings } from '@/lib/schemas'

const DATA_DIR = path.resolve(__dirname, '../../rankings')

const sample: Rankings = {
  generatedAt: '2026-09-01T00:00:00.000Z',
  leaderboard: [
    {
      productId: 'a',
      score: 50,
      agentReady: 40,
      agenticApp: null,
      apiQuality: 60,
      aiEra: 45,
      applicable: 3,
      total: 4,
      themeScores: { openness: 70 },
    },
  ],
  battles: [],
}

describe('provenance watermark', () => {
  it('is deterministic: same input → same fingerprint', () => {
    expect(computeFingerprint('desktop-os', sample)).toBe(computeFingerprint('desktop-os', sample))
    expect(computeFingerprint('desktop-os', sample)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('canonicalJson ignores key order, so a parse/re-serialize round trip still verifies', () => {
    expect(canonicalJson({ b: 1, a: [{ y: 2, x: 3 }] })).toBe(canonicalJson({ a: [{ x: 3, y: 2 }], b: 1 }))
  })

  it('changes when the arena or any score changes', () => {
    const tampered = structuredClone(sample)
    tampered.leaderboard[0].score = 51
    expect(computeFingerprint('desktop-os', tampered)).not.toBe(computeFingerprint('desktop-os', sample))
    expect(computeFingerprint('ai-coding', sample)).not.toBe(computeFingerprint('desktop-os', sample))
  })

  it('attachProvenance is idempotent and excludes the stamp itself from the hash', () => {
    const once = attachProvenance('desktop-os', sample)
    const twice = attachProvenance('desktop-os', once)
    expect(twice).toEqual(once)
    expect(RankingsSchema.safeParse(once).success).toBe(true)
  })

  it('verifyProvenance passes for stamped data and fails for tampered copies', () => {
    const stamped = attachProvenance('desktop-os', sample)
    expect(verifyProvenance(stamped).ok).toBe(true)
    const tampered = structuredClone(stamped) as Rankings
    tampered.leaderboard[0].score = 99
    expect(verifyProvenance(tampered).ok).toBe(false)
    // arena override wins over an altered embedded arena id
    expect(verifyProvenance({ ...stamped, _provenance: { ...stamped._provenance!, arena: 'stolen' } }, 'desktop-os').ok).toBe(true)
  })

  it('the committed rankings.json files carry a valid watermark', () => {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'desktop-os', 'rankings.json'), 'utf8'))
    const check = verifyProvenance(raw)
    expect(check.arena).toBe('desktop-os')
    expect(check.ok).toBe(true)
  })

  it('provenanceLine is XML/HTML-comment safe (no "--")', () => {
    expect(provenanceLine('abc123')).toContain('fingerprint: abc123')
    expect(provenanceLine()).not.toContain('--')
    expect(provenanceLine('abc123')).not.toContain('--')
  })
})
