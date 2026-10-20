import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// open-rankings/arena-roadmap.json is the arena planning surface: every arena, tiered by
// priority, marked live or planned. The live set and open-rankings/categories.json describe
// the same thing from two sides, and they drifted silently (nine live arenas missing from
// the roadmap, found in the 2026-10-19 coherence audit) because nothing pinned them
// together. These gates make that drift a test failure: a category lands on the roadmap as
// live, and a roadmap entry only claims live when the arena directory is committed.

interface RoadmapEntry {
  id: string
  name: string
  tier: number
  status: string
  g2Equivalent: string | null
  candidateProducts: string[]
  rationale: string
  aiEraAngle: string
}

const ROOT = path.resolve(__dirname, '..')
const roadmap = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-rankings/arena-roadmap.json'), 'utf8'),
) as RoadmapEntry[]
const categories = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-rankings/categories.json'), 'utf8'),
) as Array<{ id: string }>

describe('open-rankings/arena-roadmap.json', () => {
  it('every entry carries the roadmap shape: unique id, tier 1-3, live or planned status', () => {
    const ids = roadmap.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of roadmap) {
      const at = entry.id
      expect(entry.id, at).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(entry.name.length, at).toBeGreaterThan(0)
      expect([1, 2, 3], at).toContain(entry.tier)
      expect(['live', 'planned'], at).toContain(entry.status)
      expect(entry.g2Equivalent === null || typeof entry.g2Equivalent === 'string', at).toBe(true)
      expect(Array.isArray(entry.candidateProducts) && entry.candidateProducts.length > 0, at).toBe(true)
      expect(entry.rationale.length, at).toBeGreaterThan(0)
      expect(entry.aiEraAngle.length, at).toBeGreaterThan(0)
    }
  })

  it('the live set and categories.json agree in both directions', () => {
    const live = roadmap.filter((entry) => entry.status === 'live').map((entry) => entry.id)
    const categoryIds = categories.map((category) => category.id)
    expect([...live].sort()).toEqual([...categoryIds].sort())
  })

  it('every live entry has its committed arena directory, and no planned entry does', () => {
    for (const entry of roadmap) {
      const dir = path.join(ROOT, 'open-rankings', entry.id)
      const committed = fs.existsSync(path.join(dir, 'products.json'))
      expect(committed, `${entry.id}: status ${entry.status} vs committed arena ${committed}`).toBe(
        entry.status === 'live',
      )
    }
  })
})
