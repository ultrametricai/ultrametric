// Arena-section curation invariants against the REAL data files: every arena in
// data/categories.json is assigned to exactly one section in data/arena-sections.json (an
// unassigned arena would silently vanish from the header's Rankings dropdown; a duplicate would
// render twice), no section references an unknown arena, and the section count stays in the
// curated ~8–10 band the menu was designed for. Plus the pure menu filter the dropdown search
// uses (components/ArenaMenu.tsx's filterMenuSections).
import { describe, expect, it } from 'vitest'
import { filterMenuSections, type ArenaMenuSection } from '../../components/ArenaMenu'
import { loadArenaSections } from '../arenaSections'
import { loadCategories } from '../data'

const SECTIONS = loadArenaSections() // the real curated file
const CATEGORY_IDS = loadCategories().map((c) => c.id)

describe('data/arena-sections.json', () => {
  it('assigns every arena in data/categories.json exactly once (total coverage, no dupes)', () => {
    const assigned = SECTIONS.flatMap((s) => s.arenaIds)
    expect(new Set(assigned).size, 'no arena appears in two sections').toBe(assigned.length)
    expect([...assigned].sort()).toEqual([...CATEGORY_IDS].sort())
  })

  it('references only tracked arenas', () => {
    const known = new Set(CATEGORY_IDS)
    for (const s of SECTIONS) {
      for (const id of s.arenaIds) expect(known.has(id), `${s.id} → ${id}`).toBe(true)
    }
  })

  it('stays a curated handful of sections with unique ids/names', () => {
    expect(SECTIONS.length).toBeGreaterThanOrEqual(7)
    expect(SECTIONS.length).toBeLessThanOrEqual(11)
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length)
    expect(new Set(SECTIONS.map((s) => s.name)).size).toBe(SECTIONS.length)
  })
})

describe('filterMenuSections', () => {
  const sections: ArenaMenuSection[] = [
    { name: 'AI & Agents', items: [{ id: 'ai-coding', name: 'AI Coding Agents', label: 'AI' }] },
    {
      name: 'Fintech & Back Office',
      items: [
        { id: 'payments', name: 'Online Payments', label: 'Payments' },
        { id: 'payroll', name: 'Payroll & HR Ops', label: 'Payroll' },
      ],
    },
  ]

  it('returns everything untouched for an empty query', () => {
    expect(filterMenuSections(sections, '')).toEqual(sections)
    expect(filterMenuSections(sections, '   ')).toEqual(sections)
  })

  it('filters items case-insensitively and drops empty sections', () => {
    const hit = filterMenuSections(sections, 'PAYRO')
    expect(hit).toHaveLength(1)
    expect(hit[0].name).toBe('Fintech & Back Office')
    expect(hit[0].items.map((i) => i.id)).toEqual(['payroll'])
  })

  it('matches on id and short label too', () => {
    expect(filterMenuSections(sections, 'ai-coding')[0].items[0].id).toBe('ai-coding')
    expect(filterMenuSections(sections, 'nope-nothing')).toEqual([])
  })
})
