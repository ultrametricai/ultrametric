import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The lore library gate: open-lore/library.json is the curated reading list (essays, guides,
// books, talks) organized into sections, which double as the lore topic set. Invariants:
// total schema on sections and entries (no missing or extra fields), unique kebab-case ids,
// every URL https and unique, every entry's section resolving, loreIds resolving against
// open-lore/registry.json, section arenas resolving against open-rankings/, and processIds
// resolving (read-only) against open-processes/corpus.json. Deterministic; URL liveness is
// editorial (open-lore/README.md) and is verified at authoring time, not here. Registry <->
// library cross-link symmetry is asserted in lore-registry.test.ts.

const ROOT = path.join(__dirname, '..')

const FORMATS = ['essay', 'guide', 'book', 'video'] as const

type LibrarySection = {
  id: string
  title: string
  covers: string
  arenas?: string[]
  processIds?: string[]
}
type LibraryEntry = {
  id: string
  section: string
  title: string
  author: string
  year?: number
  format: (typeof FORMATS)[number]
  url: string
  teaches: string
  loreIds: string[]
  processIds: string[]
  note?: string
}
type Library = { sections: LibrarySection[]; entries: LibraryEntry[] }

const library = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'library.json'), 'utf8'),
) as Library

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'registry.json'), 'utf8'),
) as Array<{ id: string }>
const loreIds = new Set(registry.map((e) => e.id))

const corpus = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-processes', 'corpus.json'), 'utf8'),
) as Array<{ id: string }>
const processIds = new Set(corpus.map((p) => p.id))

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe('lore library (open-lore/library.json)', () => {
  it('carries exactly sections and entries at the top level', () => {
    expect(Object.keys(library).sort()).toEqual(['entries', 'sections'])
    expect(Array.isArray(library.sections)).toBe(true)
    expect(Array.isArray(library.entries)).toBe(true)
  })

  it('every section carries the total schema with a unique kebab-case id', () => {
    const seen = new Set<string>()
    const REQUIRED = ['id', 'title', 'covers']
    const OPTIONAL = ['arenas', 'processIds']
    for (const s of library.sections) {
      const keys = Object.keys(s)
      const extra = keys.filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k))
      expect(extra, `section ${s.id} extra keys`).toEqual([])
      for (const k of ['id', 'title', 'covers'] as const) {
        expect(keys.includes(k), `section ${s.id} missing ${k}`).toBe(true)
        expect(typeof s[k], `section ${s.id} ${k}`).toBe('string')
        expect(s[k].length, `section ${s.id} ${k} non-empty`).toBeGreaterThan(0)
      }
      expect(s.id, `section id format: ${s.id}`).toMatch(KEBAB)
      expect(seen.has(s.id), `duplicate section id ${s.id}`).toBe(false)
      seen.add(s.id)
    }
  })

  it('section arenas resolve against open-rankings/ and section processIds against the corpus', () => {
    for (const s of library.sections) {
      if (s.arenas !== undefined) {
        expect(Array.isArray(s.arenas), `section ${s.id} arenas array`).toBe(true)
        expect(s.arenas.length, `section ${s.id} arenas non-empty when present`).toBeGreaterThan(0)
        expect(new Set(s.arenas).size, `section ${s.id} duplicate arenas`).toBe(s.arenas.length)
        for (const a of s.arenas) {
          expect(a, `section ${s.id} arena id format: ${a}`).toMatch(KEBAB)
          const rankingsFile = path.join(ROOT, 'open-rankings', a, 'rankings.json')
          expect(fs.existsSync(rankingsFile), `section ${s.id} unknown arena ${a}`).toBe(true)
        }
      }
      if (s.processIds !== undefined) {
        expect(Array.isArray(s.processIds), `section ${s.id} processIds array`).toBe(true)
        expect(new Set(s.processIds).size, `section ${s.id} duplicate processIds`).toBe(
          s.processIds.length,
        )
        for (const pid of s.processIds) {
          expect(processIds.has(pid), `section ${s.id} unknown process id ${pid}`).toBe(true)
        }
      }
    }
  })

  it('every entry carries the total schema, nothing more, nothing missing', () => {
    const REQUIRED = ['id', 'section', 'title', 'author', 'format', 'url', 'teaches', 'loreIds', 'processIds']
    const OPTIONAL = ['year', 'note']
    for (const e of library.entries) {
      const keys = Object.keys(e)
      const extra = keys.filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k))
      expect(extra, `entry ${e.id} extra keys`).toEqual([])
      for (const k of REQUIRED) {
        expect(keys.includes(k), `entry ${e.id} missing ${k}`).toBe(true)
      }
      for (const k of ['id', 'section', 'title', 'author', 'url', 'teaches'] as const) {
        expect(typeof e[k], `entry ${e.id} ${k}`).toBe('string')
        expect(e[k].length, `entry ${e.id} ${k} non-empty`).toBeGreaterThan(0)
      }
      if (e.year !== undefined) {
        expect(Number.isInteger(e.year), `entry ${e.id} year integer`).toBe(true)
        expect(e.year, `entry ${e.id} year range`).toBeGreaterThanOrEqual(1950)
        expect(e.year, `entry ${e.id} year range`).toBeLessThanOrEqual(2100)
      }
      if (e.note !== undefined) {
        expect(typeof e.note, `entry ${e.id} note`).toBe('string')
        expect(e.note.length, `entry ${e.id} note non-empty`).toBeGreaterThan(0)
      }
      expect(FORMATS.includes(e.format), `entry ${e.id} format ${e.format}`).toBe(true)
      expect(Array.isArray(e.loreIds), `entry ${e.id} loreIds array`).toBe(true)
      expect(Array.isArray(e.processIds), `entry ${e.id} processIds array`).toBe(true)
    }
  })

  it('entry ids are kebab-case and unique', () => {
    const seen = new Set<string>()
    for (const e of library.entries) {
      expect(e.id, `id format: ${e.id}`).toMatch(KEBAB)
      expect(seen.has(e.id), `duplicate id ${e.id}`).toBe(false)
      seen.add(e.id)
    }
  })

  it('every URL is https and unique', () => {
    const seen = new Set<string>()
    for (const e of library.entries) {
      expect(e.url, `entry ${e.id} url`).toMatch(/^https:\/\/\S+$/)
      expect(seen.has(e.url), `duplicate url ${e.url}`).toBe(false)
      seen.add(e.url)
    }
  })

  it('every entry belongs to a declared section, and every section holds 6-16 entries', () => {
    const sections = new Set(library.sections.map((s) => s.id))
    const counts = new Map<string, number>()
    for (const e of library.entries) {
      expect(sections.has(e.section), `entry ${e.id} unknown section ${e.section}`).toBe(true)
      counts.set(e.section, (counts.get(e.section) ?? 0) + 1)
    }
    for (const s of library.sections) {
      const n = counts.get(s.id) ?? 0
      expect(n, `section ${s.id} entry count ${n}`).toBeGreaterThanOrEqual(6)
      expect(n, `section ${s.id} entry count ${n}`).toBeLessThanOrEqual(16)
    }
  })

  it('loreIds resolve against open-lore/registry.json without duplicates', () => {
    for (const e of library.entries) {
      expect(new Set(e.loreIds).size, `entry ${e.id} duplicate loreIds`).toBe(e.loreIds.length)
      for (const id of e.loreIds) {
        expect(loreIds.has(id), `entry ${e.id} unknown lore id ${id}`).toBe(true)
      }
    }
  })

  it('processIds resolve against open-processes/corpus.json without duplicates', () => {
    for (const e of library.entries) {
      expect(new Set(e.processIds).size, `entry ${e.id} duplicate processIds`).toBe(e.processIds.length)
      for (const pid of e.processIds) {
        expect(processIds.has(pid), `entry ${e.id} unknown process id ${pid}`).toBe(true)
      }
    }
  })

  it('includes video entries, so talks are first-class alongside essays', () => {
    expect(library.entries.some((e) => e.format === 'video')).toBe(true)
  })
})
