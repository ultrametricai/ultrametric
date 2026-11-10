import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategories } from '../data'

const aliases = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../open-rankings/search-aliases.json'), 'utf8'),
) as { arenas: Record<string, string[]> }

describe('arena search aliases', () => {
  // The consuming site's search-matching suite requires this same range. Check it at
  // the source so a new arena cannot block a later private-site content update.
  it('covers every arena with 3-8 alias phrases and no unknown arena keys', () => {
    const ids = loadCategories().map(category => category.id)
    expect(Object.keys(aliases.arenas).sort()).toEqual([...ids].sort())
    for (const id of ids) {
      const phrases = aliases.arenas[id]
      expect(phrases.length, `${id}: at least 3 aliases`).toBeGreaterThanOrEqual(3)
      expect(phrases.length, `${id}: at most 8 aliases`).toBeLessThanOrEqual(8)
    }
  })

  it('keeps arena aliases distinct, lowercase and free of query chrome', () => {
    for (const [id, phrases] of Object.entries(aliases.arenas)) {
      expect(new Set(phrases).size, `${id}: duplicate aliases`).toBe(phrases.length)
      for (const phrase of phrases) {
        expect(phrase.trim().length, `${id}: blank alias`).toBeGreaterThan(0)
        expect(phrase, `${id}: normalized alias`).toBe(phrase.trim().toLowerCase())
        expect(phrase, `${id}: query chrome`).not.toMatch(/^(?:best|top|great)\s/)
      }
    }
  })

  it('preserves realtime infrastructure discovery by protocol and media API', () => {
    expect(aliases.arenas['realtime-infra']).toEqual(expect.arrayContaining([
      'webrtc', 'sfu', 'video api', 'video sdk', 'realtime video',
      'media over quic', 'moq', 'media relay',
    ]))
  })
})
