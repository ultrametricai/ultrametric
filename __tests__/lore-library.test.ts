import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '@/lib/processes'

// The lore library gate: open-lore/library.json is the curated reading list (essays, guides,
// books, talks) organized into sections, which double as the lore topic set. Invariants:
// total schema on sections and entries (no missing or extra fields), unique kebab-case ids,
// every URL https and unique, every entry's section resolving, loreIds resolving against
// open-lore/registry.json, section arenas resolving against open-rankings/, and processIds
// resolving (read-only) against canonical operational processes. Deterministic; URL liveness is
// editorial (open-lore/README.md) and is verified at authoring time, not here. Registry <->
// library cross-link symmetry is asserted in lore-registry.test.ts.
//
// Unpublished or withdrawn works (schema extension, 2026-10-14): an entry may carry
// availability: "not-public" instead of a url. Such an entry omits `url` (there is no citable
// https home) and may omit `format` (no published form to cite); `note` is required and must
// state that the work is not publicly available, with the evidence found at recording time.
// Every other entry carries `url` and `format` as before.

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
  format?: (typeof FORMATS)[number]
  url?: string
  teaches: string
  loreIds: string[]
  processIds: string[]
  note?: string
  availability?: 'not-public'
}
type Library = { sections: LibrarySection[]; entries: LibraryEntry[] }

const library = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'library.json'), 'utf8'),
) as Library

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'registry.json'), 'utf8'),
) as Array<{ id: string }>
const loreIds = new Set(registry.map((e) => e.id))

const corpus = loadProcesses(path.join(ROOT, 'open-rankings'))
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
    const REQUIRED = ['id', 'section', 'title', 'author', 'teaches', 'loreIds', 'processIds']
    const OPTIONAL = ['year', 'note', 'format', 'url', 'availability']
    for (const e of library.entries) {
      const keys = Object.keys(e)
      const extra = keys.filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k))
      expect(extra, `entry ${e.id} extra keys`).toEqual([])
      for (const k of REQUIRED) {
        expect(keys.includes(k), `entry ${e.id} missing ${k}`).toBe(true)
      }
      for (const k of ['id', 'section', 'title', 'author', 'teaches'] as const) {
        expect(typeof e[k], `entry ${e.id} ${k}`).toBe('string')
        expect(e[k].length, `entry ${e.id} ${k} non-empty`).toBeGreaterThan(0)
      }
      if (e.availability === undefined) {
        // Published works: url and format are required.
        expect(typeof e.url, `entry ${e.id} url`).toBe('string')
        expect(e.url!.length, `entry ${e.id} url non-empty`).toBeGreaterThan(0)
        expect(keys.includes('format'), `entry ${e.id} missing format`).toBe(true)
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
      if (e.format !== undefined) {
        expect(FORMATS.includes(e.format), `entry ${e.id} format ${e.format}`).toBe(true)
      }
      expect(Array.isArray(e.loreIds), `entry ${e.id} loreIds array`).toBe(true)
      expect(Array.isArray(e.processIds), `entry ${e.id} processIds array`).toBe(true)
    }
  })

  it('a not-public entry omits url and carries a note stating the availability', () => {
    for (const e of library.entries) {
      if (e.availability === undefined) continue
      expect(e.availability, `entry ${e.id} availability value`).toBe('not-public')
      expect(e.url, `entry ${e.id} url must be absent when not-public`).toBeUndefined()
      expect(typeof e.note, `entry ${e.id} note required when not-public`).toBe('string')
      expect(
        /not publicly available/i.test(e.note ?? ''),
        `entry ${e.id} note must state the work is not publicly available`,
      ).toBe(true)
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

  it('every URL is https and unique (not-public entries carry none)', () => {
    const seen = new Set<string>()
    for (const e of library.entries) {
      if (e.url === undefined) continue
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

  it('processIds resolve against canonical operational processes without duplicates', () => {
    for (const e of library.entries) {
      expect(new Set(e.processIds).size, `entry ${e.id} duplicate processIds`).toBe(e.processIds.length)
      for (const pid of e.processIds) {
        expect(processIds.has(pid), `entry ${e.id} unknown process id ${pid}`).toBe(true)
      }
    }
  })

  it('the lore README topics table carries a row for every section', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'open-lore', 'README.md'), 'utf8')
    for (const s of library.sections) {
      expect(readme, `lore README missing topic row for ${s.id}`).toContain(`| ${s.title} | ${s.covers}`)
    }
  })

  it('includes video entries, so talks are first-class alongside essays', () => {
    expect(library.entries.some((e) => e.format === 'video')).toBe(true)
  })
})
