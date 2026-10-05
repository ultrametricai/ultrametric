import { describe, expect, it } from 'vitest'
import {
  renderSituationsTable, situationRecords, TABLE_END, TABLE_START, validateSituationsDoc,
  validateSituations,
} from '@/lib/situationsDoc'

// processes/SITUATIONS.md ↔ corpus drift gate (founder 2026-10-02: the situations concept gets
// its own repo surface, generated-or-synced so the list can't go stale — the README-sync
// pattern open-documents/ uses). The table block is machine-owned (scripts/generate-situations-md.ts);
// this gate fails on any divergence between the committed block and the live corpus.

describe('processes/SITUATIONS.md', () => {
  it('the committed doc passes the drift gate (table block matches the live corpus exactly)', () => {
    expect(validateSituations()).toEqual([])
  })

  it('lists all 12 situations with their triggers, urgency-then-title order', () => {
    const records = situationRecords()
    expect(records).toHaveLength(22)
    for (const r of records) {
      expect(r.trigger.length, `${r.id} trigger`).toBeGreaterThan(20)
      expect(['hours', 'days', 'weeks']).toContain(r.urgency)
    }
    // The order is the /situations index order: urgency tier first (hours → days → weeks),
    // title inside a tier.
    const tiers = records.map((r) => ['hours', 'days', 'weeks'].indexOf(r.urgency))
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
    for (let i = 1; i < records.length; i++) {
      if (tiers[i] === tiers[i - 1]) {
        expect(records[i - 1].title.localeCompare(records[i].title)).toBeLessThan(0)
      }
    }
  })
})

describe('situations doc validators (failure modes)', () => {
  const records = situationRecords()
  const table = renderSituationsTable(records)

  it('fails when the markers are missing', () => {
    expect(validateSituationsDoc('no markers here', records).join(';')).toContain('missing the generated table markers')
  })

  it('fails when the committed block drifted from the corpus (stale title, missing row, extra row)', () => {
    const stale = table.replace(records[0].title, 'Renamed situation')
    expect(validateSituationsDoc(stale, records).join(';')).toContain('drifted from processes/corpus.json')
    const missingRow = table.replace(`| \`${records[0].id}\` `, '| `deleted` ')
    expect(validateSituationsDoc(missingRow, records).join(';')).toContain('drifted')
  })

  it('fails when prose cites a situation id the corpus does not have', () => {
    const doc = `${table}\n\nSee \`sit_999\` for details.`
    expect(validateSituationsDoc(doc, records).join(';')).toContain('unknown situation id sit_999')
  })

  it('the exact generated block (markers included) passes clean', () => {
    expect(validateSituationsDoc(table, records)).toEqual([])
    expect(table.startsWith(TABLE_START)).toBe(true)
    expect(table.endsWith(TABLE_END)).toBe(true)
  })
})
