import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { planFounderOps, validateFounderOps } from '@/lib/founderOps'

// The founder-ops corpus gates (ingested from the founder-ops-open starter, 2026-09-28): the
// committed rules/processes/sources/coverage records must satisfy every structural and semantic
// invariant, and the conservative planner must refuse everything it cannot exactly match.

const readFixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', name), 'utf8'))

describe('founder-ops corpus validation', () => {
  it('the committed corpus passes every invariant', () => {
    // Pinned to the newest checked_on in sources/registry.json (2026-10-03 — the
    // state-coverage wave's CA/NV/TX sources) so the "checked date is in the future"
    // invariant stays meaningful.
    expect(validateFounderOps(new Date('2026-10-03T00:00:00Z'))).toEqual([])
  })

  it('all fixtures are synthetic with full scenario dimensions', () => {
    for (const file of fs.readdirSync(path.join(process.cwd(), 'fixtures')).filter((f) => f.endsWith('.json'))) {
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
