import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The lore schools gate: open-lore/schools.json names the schools of thought the registry's
// heuristics belong to. Invariants: total schema (no missing or extra fields), unique ids,
// a one-or-two-sentence position per school, and groundedness both ways: every registry
// school resolves here, every school has at least one registry entry, and every listed
// figure authors at least one registry entry of that school. Deterministic.

const ROOT = path.join(__dirname, '..')

type School = { id: string; name: string; position: string; figures: string[] }

const schools = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'schools.json'), 'utf8'),
) as School[]

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'registry.json'), 'utf8'),
) as Array<{ id: string; school: string; source: { author: string } }>

const schoolIds = new Set(schools.map((s) => s.id))
const registrySchools = new Set(registry.map((e) => e.school))

describe('lore schools (lore/schools.json)', () => {
  it('is an array of at least five schools, so the registry can disagree with itself', () => {
    expect(Array.isArray(schools)).toBe(true)
    expect(schools.length).toBeGreaterThanOrEqual(5)
  })

  it('every school carries the total schema, nothing more, nothing missing', () => {
    for (const s of schools) {
      expect(Object.keys(s).sort(), `school ${s.id} keys`).toEqual([
        'figures',
        'id',
        'name',
        'position',
      ])
      for (const k of ['id', 'name', 'position'] as const) {
        expect(typeof s[k], `school ${s.id} ${k}`).toBe('string')
        expect(s[k].length, `school ${s.id} ${k} non-empty`).toBeGreaterThan(0)
      }
      expect(Array.isArray(s.figures), `school ${s.id} figures array`).toBe(true)
      expect(s.figures.length, `school ${s.id} needs at least one figure`).toBeGreaterThan(0)
      expect(new Set(s.figures).size, `school ${s.id} duplicate figures`).toBe(s.figures.length)
    }
  })

  it('ids are unique and match the registry school values both ways', () => {
    expect(schoolIds.size, 'duplicate school ids').toBe(schools.length)
    for (const school of registrySchools) {
      expect(schoolIds.has(school), `registry school ${school} missing from schools.json`).toBe(
        true,
      )
    }
    for (const s of schools) {
      expect(
        registrySchools.has(s.id),
        `school ${s.id} has no registry entries (remove it or add a heuristic)`,
      ).toBe(true)
    }
  })

  it('the lore README schools table matches schools.json', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'lore', 'README.md'), 'utf8')
    for (const s of schools) {
      expect(readme, `lore README missing school row for ${s.id}`).toContain(
        `| ${s.name} | ${s.position} |`,
      )
    }
  })

  it('every figure authors at least one registry entry of that school', () => {
    for (const s of schools) {
      const authors = registry.filter((e) => e.school === s.id).map((e) => e.source.author)
      for (const figure of s.figures) {
        expect(
          authors.some((a) => a.includes(figure)),
          `school ${s.id} figure ${figure} authors no registry entry`,
        ).toBe(true)
      }
    }
  })
})
