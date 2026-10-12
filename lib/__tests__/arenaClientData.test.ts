import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { arenaClientData } from '@/lib/arenaClientData'
import { loadCategory } from '@/lib/data'

const data = loadCategory('ai-coding')
const slim = arenaClientData(data)

describe('arenaClientData', () => {
  it('strips real bytes: the source data carries rationale prose and battle records', () => {
    // Non-vacuous guard: if these ever go empty at the source, the strip below proves nothing.
    expect(data.verdicts.length).toBeGreaterThan(100)
    expect(data.verdicts.filter((v) => v.rationale.length > 100).length).toBeGreaterThan(100)
    expect(data.rankings.battles.length).toBeGreaterThan(50)
  })

  it('empties verdict rationale and rankings.battles, and nothing else', () => {
    expect(slim.verdicts.every((v) => v.rationale === '')).toBe(true)
    expect(slim.rankings.battles).toEqual([])
    // Everything the arena page's client components do read survives untouched.
    expect(slim.verdicts.map(({ rationale: _, ...v }) => v)).toEqual(
      data.verdicts.map(({ rationale: _, ...v }) => v),
    )
    const { battles: _a, ...slimRankings } = slim.rankings
    const { battles: _b, ...fullRankings } = data.rankings
    expect(slimRankings).toEqual(fullRankings)
    const untouched = ['category', 'products', 'stories', 'evidence', 'stacks', 'popularity', 'claims', 'uncertainty', 'vendorResponses', 'certifications'] as const
    for (const key of untouched) expect(slim[key]).toBe(data[key])
  })

  it('cuts the serialized payload by more than half for a populated arena', () => {
    // The point of the projection: this object is serialized into all four prerender artifacts
    // of every arena page (docs/BUILD-SIZE.md). Measured 1.66 MB → ~0.5 MB on 2026-10-02.
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(data).length / 2)
  })

  // The source pin that the arena page really hands this projection to its client components
  // (and that those components never read the stripped fields) moved to the private site repo
  // with app/arena and components/ (repo split).
})
