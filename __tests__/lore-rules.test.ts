import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '@/lib/processes'

// The lore rules gate: open-lore/rules.json carries uncontested, sourced mechanics
// extracted from the reading canon. The registry (lore-registry.test.ts) holds contested
// claims and requires a cross-school tension per entry; rules.json is where a rule with
// no published opposing view lands (founder ruling, 2026-10-16). Invariants: total
// schema, unique kebab-case ids disjoint from registry ids, topic resolving against the
// library sections, a source URL on every rule, and libraryIds/processIds resolving.

const ROOT = path.join(__dirname, '..')

type LoreSource = { author: string; work: string; url: string; note?: string }
type LoreRule = {
  id: string
  rule: string
  topic: string
  source: LoreSource
  libraryIds: string[]
  processIds: string[]
}

const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore', 'rules.json'), 'utf8')) as LoreRule[]
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore', 'registry.json'), 'utf8')) as Array<{ id: string }>
const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore', 'library.json'), 'utf8')) as {
  sections: Array<{ id: string }>
  entries: Array<{ id: string }>
}
const corpus = loadProcesses(path.join(ROOT, 'open-rankings'))

const topicIds = new Set(library.sections.map((s) => s.id))
const libraryIds = new Set(library.entries.map((e) => e.id))
const processIds = new Set(corpus.map((p) => p.id))
const registryIds = new Set(registry.map((e) => e.id))

describe('lore rules (open-lore/rules.json)', () => {
  it('is a non-empty array within bounds', () => {
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toBeGreaterThanOrEqual(1)
    expect(rules.length).toBeLessThanOrEqual(200)
  })

  it('every rule carries the total schema, nothing more, nothing missing', () => {
    const RULE_KEYS = ['id', 'rule', 'topic', 'source', 'libraryIds', 'processIds']
    const SOURCE_KEYS = ['author', 'work', 'url', 'note']
    for (const r of rules) {
      expect(Object.keys(r).sort(), `rule ${r.id} keys`).toEqual([...RULE_KEYS].sort())
      for (const k of Object.keys(r.source)) expect(SOURCE_KEYS, `rule ${r.id} source key ${k}`).toContain(k)
      for (const k of ['author', 'work', 'url']) {
        expect(typeof (r.source as Record<string, unknown>)[k], `rule ${r.id} source.${k}`).toBe('string')
      }
      expect(r.source.url, `rule ${r.id} source url`).toMatch(/^https?:\/\//)
      expect(r.rule.length, `rule ${r.id} text`).toBeGreaterThan(20)
    }
  })

  it('ids are unique kebab-case and disjoint from registry heuristic ids', () => {
    const ids = rules.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id, `rule id ${id} kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(registryIds.has(id), `rule id ${id} collides with a registry heuristic`).toBe(false)
    }
  })

  it('topics, libraryIds, and processIds resolve', () => {
    for (const r of rules) {
      expect(topicIds.has(r.topic), `rule ${r.id} topic ${r.topic}`).toBe(true)
      for (const l of r.libraryIds) expect(libraryIds.has(l), `rule ${r.id} library ${l}`).toBe(true)
      for (const p of r.processIds) expect(processIds.has(p), `rule ${r.id} process ${p}`).toBe(true)
    }
  })
})
