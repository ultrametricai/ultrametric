import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcessCatalog } from '../lib/shared-processes/catalog'

// The lore-citation gate, the situation-law-map pattern applied to startup lore: canonical
// process guidance cites lore in the standard greppable form ("lore rule <id>", the analog of
// the law layer's "law rule <id>"). Every citation must resolve to a committed id in
// open-lore/rules.json or open-lore/registry.json, so a renamed or removed lore entry cannot
// leave dangling prose citations. The worked anchor is validate-the-idea (startup_001): each
// validation method family on its routing decision is grounded in at least one lore citation.

const ROOT = path.join(__dirname, '..')
const CITATION = /lore rule ([a-z0-9][a-z0-9-]*)/g

const loreIds = new Set(
  [
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore', 'rules.json'), 'utf8')) as Array<{ id: string }>),
    ...(JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore', 'registry.json'), 'utf8')) as Array<{ id: string }>),
  ].map((entry) => entry.id),
)

const records = loadProcessCatalog(undefined, ROOT).processes.map(({ record }) => record)

function citationsIn(value: unknown): string[] {
  return [...JSON.stringify(value).matchAll(CITATION)].map((m) => m[1])
}

describe('lore-rule citations (canonical catalog ↔ open-lore)', () => {
  it('every "lore rule <id>" citation in the corpus resolves to a rules.json or registry.json id', () => {
    for (const record of records) {
      for (const id of citationsIn(record)) {
        expect(loreIds.has(id), `${record.id} cites unknown lore rule ${id}`).toBe(true)
      }
    }
  })

  it('the convention is in use: the corpus carries citations to both lore files', () => {
    const cited = new Set(records.flatMap((record) => citationsIn(record)))
    expect(cited.size).toBeGreaterThanOrEqual(10)
    for (const id of ['fitzpatrick-mom-test', 'seibel-lean-mvp', 'vohra-pmf-engine', 'seibel-hair-on-fire-problems']) {
      expect(cited.has(id), `expected the corpus to cite ${id}`).toBe(true)
    }
  })

  it('validate-the-idea grounds every validation method family in the lore', () => {
    const record = records.find((r) => r.id === 'startup_001')!
    const decision = record.parts.find((part) => part.kind === 'decision')!
    expect(decision.options.length).toBeGreaterThanOrEqual(5)
    for (const option of decision.options) {
      const cited = citationsIn(option)
      expect(cited.length, `${option.id} carries no lore citation`).toBeGreaterThan(0)
      for (const id of cited) {
        expect(loreIds.has(id), `${option.id} cites unknown lore rule ${id}`).toBe(true)
      }
    }
  })
})
