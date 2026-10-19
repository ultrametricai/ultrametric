import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '@/lib/processes'

// The lore registry gate: open-lore/registry.json carries schooled heuristics as claims with
// provenance. Invariants: total schema (no missing or extra fields), unique kebab-case ids,
// school resolving against open-lore/schools.json, topic resolving against
// open-lore/library.json sections, every source URL present, tensions resolving to existing
// ids + symmetric + cross-school, libraryIds symmetric with the library's loreIds, and
// processIds resolving (read-only) against canonical operational processes. Deterministic; URL
// liveness is editorial (open-lore/README.md).

const ROOT = path.join(__dirname, '..')

type LoreSource = { author: string; work: string; url: string; note?: string }
type LoreEntry = {
  id: string
  heuristic: string
  school: string
  topic: string
  source: LoreSource
  stance: 'claim'
  tensions: string[]
  libraryIds: string[]
  processIds: string[]
}

const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'registry.json'), 'utf8'),
) as LoreEntry[]

const corpus = loadProcesses(path.join(ROOT, 'open-rankings'))
const processIds = new Set(corpus.map((p) => p.id))

const library = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'library.json'), 'utf8'),
) as { sections: Array<{ id: string }>; entries: Array<{ id: string; loreIds: string[] }> }
const topicIds = new Set(library.sections.map((s) => s.id))
const libraryById = new Map(library.entries.map((e) => [e.id, e]))

const schools = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'open-lore', 'schools.json'), 'utf8'),
) as Array<{ id: string }>
const schoolIds = new Set(schools.map((s) => s.id))

const byId = new Map(registry.map((e) => [e.id, e]))

describe('lore registry (open-lore/registry.json)', () => {
  it('is an array of 25-60 entries', () => {
    expect(Array.isArray(registry)).toBe(true)
    expect(registry.length).toBeGreaterThanOrEqual(25)
    expect(registry.length).toBeLessThanOrEqual(60)
  })

  it('every entry carries the total schema, nothing more, nothing missing', () => {
    const ENTRY_KEYS = ['id', 'heuristic', 'school', 'topic', 'source', 'stance', 'tensions', 'libraryIds', 'processIds']
    const SOURCE_KEYS = ['author', 'work', 'url', 'note']
    for (const e of registry) {
      expect(Object.keys(e).sort(), `entry ${e.id} keys`).toEqual([...ENTRY_KEYS].sort())
      for (const k of ['id', 'heuristic', 'school', 'topic'] as const) {
        expect(typeof e[k], `entry ${e.id} ${k}`).toBe('string')
        expect(e[k].length, `entry ${e.id} ${k} non-empty`).toBeGreaterThan(0)
      }
      const extraSourceKeys = Object.keys(e.source).filter((k) => !SOURCE_KEYS.includes(k))
      expect(extraSourceKeys, `entry ${e.id} source keys`).toEqual([])
      for (const k of ['author', 'work', 'url'] as const) {
        expect(typeof e.source[k], `entry ${e.id} source.${k}`).toBe('string')
        expect(e.source[k].length, `entry ${e.id} source.${k} non-empty`).toBeGreaterThan(0)
      }
      if (e.source.note !== undefined) {
        expect(typeof e.source.note, `entry ${e.id} source.note`).toBe('string')
        expect(e.source.note.length, `entry ${e.id} source.note non-empty`).toBeGreaterThan(0)
      }
      expect(Array.isArray(e.tensions), `entry ${e.id} tensions array`).toBe(true)
      expect(Array.isArray(e.libraryIds), `entry ${e.id} libraryIds array`).toBe(true)
      expect(Array.isArray(e.processIds), `entry ${e.id} processIds array`).toBe(true)
    }
  })

  it('every school resolves against open-lore/schools.json', () => {
    for (const e of registry) {
      expect(schoolIds.has(e.school), `entry ${e.id} unknown school ${e.school}`).toBe(true)
    }
  })

  it('every topic resolves against the library sections (the shared topic set)', () => {
    for (const e of registry) {
      expect(topicIds.has(e.topic), `entry ${e.id} unknown topic ${e.topic}`).toBe(true)
    }
  })

  it('libraryIds resolve against open-lore/library.json and are symmetric with its loreIds', () => {
    for (const e of registry) {
      expect(new Set(e.libraryIds).size, `entry ${e.id} duplicate libraryIds`).toBe(
        e.libraryIds.length,
      )
      for (const lid of e.libraryIds) {
        const work = libraryById.get(lid)
        expect(work, `entry ${e.id} unknown library id ${lid}`).toBeDefined()
        expect(
          work!.loreIds.includes(e.id),
          `cross-link ${e.id} <-> ${lid} must be symmetric (library side missing)`,
        ).toBe(true)
      }
    }
    for (const work of library.entries) {
      for (const hid of work.loreIds) {
        const entry = byId.get(hid)
        expect(entry, `library ${work.id} unknown lore id ${hid}`).toBeDefined()
        expect(
          entry!.libraryIds.includes(work.id),
          `cross-link ${work.id} <-> ${hid} must be symmetric (registry side missing)`,
        ).toBe(true)
      }
    }
  })

  it('ids are kebab-case and unique', () => {
    const seen = new Set<string>()
    for (const e of registry) {
      expect(e.id, `id format: ${e.id}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(seen.has(e.id), `duplicate id ${e.id}`).toBe(false)
      seen.add(e.id)
    }
  })

  it('every entry is a claim, nothing presented as settled truth', () => {
    for (const e of registry) expect(e.stance, `entry ${e.id} stance`).toBe('claim')
  })

  it('every source URL is present and https', () => {
    for (const e of registry) {
      expect(e.source.url, `entry ${e.id} url`).toMatch(/^https:\/\/\S+$/)
    }
  })

  it('tensions resolve to existing ids, exclude self, and are symmetric', () => {
    for (const e of registry) {
      expect(e.tensions.length, `entry ${e.id} needs at least one mapped tension`).toBeGreaterThan(0)
      expect(new Set(e.tensions).size, `entry ${e.id} duplicate tensions`).toBe(e.tensions.length)
      for (const t of e.tensions) {
        expect(t, `entry ${e.id} tension self-reference`).not.toBe(e.id)
        const other = byId.get(t)
        expect(other, `entry ${e.id} tension ${t} resolves`).toBeDefined()
        expect(
          other!.tensions.includes(e.id),
          `tension ${e.id} <-> ${t} must be symmetric`,
        ).toBe(true)
      }
    }
  })

  it('every tension pair crosses schools (the disagreement is between schools)', () => {
    for (const e of registry) {
      for (const t of e.tensions) {
        const other = byId.get(t)!
        expect(
          other.school,
          `tension ${e.id} (${e.school}) <-> ${t} (${other.school}) must cross schools`,
        ).not.toBe(e.school)
      }
    }
  })

  it('processIds resolve against canonical operational processes', () => {
    for (const e of registry) {
      for (const pid of e.processIds) {
        expect(processIds.has(pid), `entry ${e.id} unknown process id ${pid}`).toBe(true)
      }
    }
  })

  it('spans at least five schools, so the registry can disagree with itself', () => {
    const schools = new Set(registry.map((e) => e.school))
    expect(schools.size).toBeGreaterThanOrEqual(5)
  })
})
