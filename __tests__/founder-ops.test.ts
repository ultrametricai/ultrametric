import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { planFounderOps, validateFounderOps } from '@/lib/founderOps'
import * as processCatalog from '@/lib/shared-processes/catalog'

// The founder-ops corpus gates (ingested from the founder-ops-open starter, 2026-09-28): the
// committed open-law / open-processes / citations / coverage records must satisfy every structural and semantic
// invariant, and the conservative planner must refuse everything it cannot exactly match.

const FIXTURES_DIR = path.join(process.cwd(), 'open-processes', 'fixtures')
const readFixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'))

describe('founder-ops corpus validation', () => {
  it('the committed corpus passes every invariant', () => {
    // Pinned to the newest checked_on in open-law/citations/registry.json (2026-10-23 — the
    // New Zealand and Australian sources) so the "checked date is in the future" invariant stays
    // meaningful.
    expect(validateFounderOps(new Date('2026-10-23T00:00:00Z'))).toEqual([])
  })

  it('collects malformed workflow JSON and invalid process definitions together', () => {
    const readFile = fs.readFileSync.bind(fs)
    const unreadable = path.join(process.cwd(), 'open-processes/equity/us-de/409a-valuation.json')
    const invalid = path.join(process.cwd(), 'open-processes/generate-a-brand-logo.json')
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((...args: Parameters<typeof fs.readFileSync>) => {
      if (String(args[0]) === unreadable) return '{'
      if (String(args[0]) === invalid) return JSON.stringify({ schemaVersion: 1, kind: 'process', id: 'invalid' })
      return readFile(...args)
    })
    const catalogSpy = vi.spyOn(processCatalog, 'loadProcessCatalog').mockImplementation(() => {
      throw new Error('Fixture canonical definition is invalid')
    })
    try {
      const errors = validateFounderOps(new Date('2026-10-14T00:00:00Z'))
      expect(errors).toContain('open-processes/equity/us-de/409a-valuation.json: unreadable JSON')
      expect(errors).toContain('open-processes/generate-a-brand-logo.json: invalid process definition')
      expect(errors.some(error => error.startsWith('canonical catalog:'))).toBe(true)
      expect(errors.some(error => /law map .*: unknown process /.test(error))).toBe(false)
    } finally {
      spy.mockRestore()
      catalogSpy.mockRestore()
    }
  })

  it('rejects a law map with unknown references, inconsistent maturity, or an unplaced card', () => {
    const mapPath = path.join(process.cwd(), 'open-law/map.json')
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
    // Tamper three ways at once: point a sub-area at a ghost rule and a ghost process,
    // downgrade a card-carrying sub-area to unmapped, and evict a card from the taxonomy.
    const subarea = map.domains[0].subareas[0]
    subarea.rule_ids = ['us-fed.ghost-rule']
    subarea.process_ids = ['ghost_process']
    subarea.maturity = 'unmapped'
    const readFile = fs.readFileSync.bind(fs)
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((...args: Parameters<typeof fs.readFileSync>) => {
      if (String(args[0]) === mapPath) return JSON.stringify(map)
      return readFile(...args)
    })
    try {
      const errors = validateFounderOps(new Date('2026-10-14T00:00:00Z'))
      const sid = `${map.domains[0].id}/${subarea.id}`
      expect(errors).toContain(`law map ${sid}: unknown rule us-fed.ghost-rule`)
      expect(errors).toContain(`law map ${sid}: unknown process ghost_process`)
      expect(errors).toContain(`law map ${sid}: carries cards, so maturity cannot be unmapped`)
      // The evicted cards surface as unplaced rather than vanishing silently.
      expect(errors.some((e) => /absent from the law map/.test(e))).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('the open-law README domain table mirrors map.json (names and maturity grades)', () => {
    const map = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'open-law/map.json'), 'utf8'))
    const lawReadme = fs.readFileSync(path.join(process.cwd(), 'open-law/README.md'), 'utf8')
    const rows = [...lawReadme.matchAll(/^\| ([^|]+) \| [^|]+ \| (mapped|partial|unmapped) \|$/gm)]
    expect(rows.map((r) => [r[1].trim(), r[2]])).toEqual(
      (map.domains as Array<{ name: string; maturity: string }>).map((d) => [d.name, d.maturity]),
    )
  })

  it('all fixtures are synthetic with full scenario dimensions', () => {
    for (const file of fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))) {
      const event = readFixture(file)
      expect(event.synthetic, `${file} must assert synthetic=true`).toBe(true)
      for (const key of ['entity_jurisdiction', 'tax_jurisdiction', 'entity_type', 'event_type']) {
        expect(event, `${file} missing ${key}`).toHaveProperty(key)
      }
    }
  })
})

describe('founder-ops conservative planner', () => {
  const asOf = new Date('2026-09-28T00:00:00Z')

  it('matches the 409A demonstration workflow for the option-grant fixture', () => {
    const plan = planFounderOps(readFixture('option-grant.json'), asOf)
    expect(plan.status).toBe('plan_only')
    expect(plan.may_execute).toBe(false)
    const ids = (plan.matches ?? []).map((m) => m.process_id)
    expect(ids).toContain('equity.us-de.409a-valuation')
    // Every emitted rule carries its caveat and at least one dated primary-source locator.
    for (const match of plan.matches ?? []) {
      for (const rule of (match.rules as Array<{ caveat: string; sources: Array<{ url: string; locator: string; checked_on: string }> }>)) {
        expect(rule.caveat.length).toBeGreaterThan(0)
        expect(rule.sources.length).toBeGreaterThan(0)
        for (const source of rule.sources) {
          expect(source.url).toMatch(/^https:\/\//)
          expect(source.locator.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('matches the 83(b) workflow for the restricted-stock-transfer fixture', () => {
    const plan = planFounderOps(readFixture('restricted-stock-transfer.json'), asOf)
    expect(plan.status).toBe('plan_only')
    const ids = (plan.matches ?? []).map((m) => m.process_id)
    expect(ids).toContain('equity.us-de.83b-election')
    // Externally effectful steps surface their scoped human approval in the plan.
    const election = (plan.matches ?? []).find((m) => m.process_id === 'equity.us-de.83b-election')
    const external = (election?.steps as Array<{ mode: string; approval: { role?: string; scope?: string } | null }>).filter(
      (s) => s.mode === 'external_effect',
    )
    expect(external.length).toBeGreaterThan(0)
    for (const step of external) {
      expect(step.approval?.role).toBeTruthy()
      expect(step.approval?.scope).toBeTruthy()
    }
  })

  it('returns unsupported — never a guessed neighbor — for an uncovered jurisdiction', () => {
    const plan = planFounderOps(readFixture('unsupported-gb.json'), asOf)
    expect(plan.status).toBe('unsupported')
    expect(plan.may_execute).toBe(false)
    expect(plan.matches).toBeUndefined()
  })

  it('returns needs_review when scenario dimensions are missing', () => {
    const plan = planFounderOps({ id: 'incomplete', entity_jurisdiction: 'US-DE' }, asOf)
    expect(plan.status).toBe('needs_review')
    expect(plan.missing).toEqual(['tax_jurisdiction', 'entity_type', 'event_type'])
    expect(plan.may_execute).toBe(false)
  })

  it('marks a matched process stale once its review_due has passed', () => {
    const plan = planFounderOps(readFixture('option-grant.json'), new Date('2027-06-01T00:00:00Z'))
    expect(plan.status).toBe('plan_only')
    for (const match of plan.matches ?? []) {
      expect(match.status).toBe('stale')
    }
  })
})
