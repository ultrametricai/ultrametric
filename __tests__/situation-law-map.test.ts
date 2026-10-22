import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcessCatalog } from '../lib/shared-processes/catalog'

// The law-map / situation symmetry gate. open-law/map.json routes sub-areas at situations
// via process_ids; a situation listed there leans on that sub-area's law, so its canonical
// summary cites one of the sub-area's committed rules in the standard form
// ("law rule <id>", the sit_008/sit_010 pattern; "law rule" rather than bare "rule" so the
// grep stays disjoint from the lore layer's "lore rule <id>"). Exceptions are documented
// below with the reason no committed rule governs the record; an exception entry must stay
// accurate
// (the pair still mapped, the citation still absent) or it fails and gets removed.

const ROOT = path.join(__dirname, '..')

type SubArea = { id: string; rule_ids: string[]; process_ids?: string[] }
type LawMap = { domains: Array<{ id: string; subareas: SubArea[] }> }

const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-law', 'map.json'), 'utf8')) as LawMap
const byId = new Map(loadProcessCatalog(undefined, ROOT).processes.map(({ record }) => [record.id, record]))

// subareaId -> situation ids whose records a committed card does not govern, with the reason.
const EXCEPTIONS: Array<{ subarea: string; situation: string; reason: string }> = [
  {
    subarea: 'disputes',
    situation: 'sit_001',
    reason:
      'A cease-and-desist is a pre-suit demand letter; us-fed.frcp-answer-deadline governs the answer to a served complaint (sit_008 cites it), and the record states there is no statutory response deadline, the letter sets its own.',
  },
]

const mapped = map.domains.flatMap((domain) =>
  domain.subareas.flatMap((subarea) =>
    (subarea.process_ids ?? [])
      .filter((id) => id.startsWith('sit_'))
      .map((situation) => ({ domain: domain.id, subarea, situation })),
  ),
)

describe('law map / situation symmetry (open-law/map.json ↔ canonical process catalog)', () => {
  it('the map points at situation ids the canonical catalog has', () => {
    for (const { subarea, situation } of mapped) {
      expect(byId.has(situation), `${subarea.id} lists unknown situation ${situation}`).toBe(true)
    }
  })

  it('every mapped situation cites a law rule from its sub-area, or carries a documented exception', () => {
    expect(mapped.length).toBeGreaterThan(0)
    for (const { subarea, situation } of mapped) {
      const summary = byId.get(situation)?.summary ?? ''
      const cited = subarea.rule_ids.some((ruleId) => summary.includes(`law rule ${ruleId}`))
      const excepted = EXCEPTIONS.some((e) => e.subarea === subarea.id && e.situation === situation)
      expect(
        cited || excepted,
        `${subarea.id} lists ${situation}, which cites none of [${subarea.rule_ids.join(', ')}] and has no documented exception`,
      ).toBe(true)
    }
  })

  it('the exceptions list stays live: each pair is still mapped, still uncited, and carries a reason', () => {
    for (const e of EXCEPTIONS) {
      expect(e.reason.length, `${e.subarea}/${e.situation} needs a reason`).toBeGreaterThan(20)
      const entry = mapped.find((m) => m.subarea.id === e.subarea && m.situation === e.situation)
      expect(entry, `${e.subarea}/${e.situation} is no longer in the map; remove the exception`).toBeTruthy()
      const summary = byId.get(e.situation)?.summary ?? ''
      const cited = entry!.subarea.rule_ids.some((ruleId) => summary.includes(`law rule ${ruleId}`))
      expect(cited, `${e.situation} now cites a ${e.subarea} rule; remove the exception`).toBe(false)
    }
  })
})
