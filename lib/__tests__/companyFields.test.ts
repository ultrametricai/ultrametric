import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBusinessLogicMap } from '../businessLogicMap'
import { fieldsConsumedByModule, fieldsEstablishedBy, loadCompanyFields } from '../companyFields'
import { loadArtifacts } from '../processes'

// Totality gate for the company-fields registry (founder 2026-10-07: typed company data
// fields). The registry's honesty rule is that a field exists ONLY because committed code
// consumes it and a committed artifact establishes it, so every edge must resolve:
//   1. producedBy → a real processes/artifacts.json artifact;
//   2. consumedBy.module → a real business-logic-map module (a real lib/openstartup file);
//   3. consumedBy.function → a REAL exported function of that module (misspellings fail);
//   4. enum fields carry their closed value set, non-enum fields never do;
//   5. the registry stays the honest small cut (bounds guard against decorating).

const fields = loadCompanyFields()
const artifactIds = new Set(loadArtifacts().map((a) => a.id))
const map = loadBusinessLogicMap()

describe('processes/company-fields.json totality', () => {
  it('is the honest small cut: unique kebab-case ids inside the curated bounds', () => {
    expect(fields.length).toBeGreaterThanOrEqual(10)
    // The bound exists to force this comment (and a fresh signature read) the next time
    // someone is tempted to decorate the registry with speculative fields.
    expect(fields.length).toBeLessThanOrEqual(25)
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length)
  })

  it('every producedBy resolves in the artifact registry', () => {
    for (const f of fields) {
      expect(artifactIds.has(f.producedBy), `${f.id} producedBy ${f.producedBy}`).toBe(true)
    }
  })

  it('every consumer names a known module, no duplicate (module, function) per field', () => {
    for (const f of fields) {
      expect(f.consumedBy.length, `${f.id} must have a consumer`).toBeGreaterThan(0)
      const keys = f.consumedBy.map((c) => `${c.module}.${c.function}`)
      expect(new Set(keys).size, `${f.id} duplicate consumer`).toBe(keys.length)
      for (const c of f.consumedBy) {
        expect(map[c.module], `${f.id}: unknown module ${c.module}`).toBeDefined()
        expect(
          fs.existsSync(path.resolve(__dirname, '..', '..', map[c.module].file)),
          `${f.id}: ${map[c.module].file} missing`,
        ).toBe(true)
      }
    }
  })

  it('every consumer names a real exported FUNCTION of its module (misspellings fail here)', async () => {
    for (const f of fields) {
      for (const c of f.consumedBy) {
        const mod: Record<string, unknown> = await import(`../openstartup/${c.module}.ts`)
        expect(
          typeof mod[c.function],
          `${f.id}: ${c.module}.${c.function} is not an exported function`,
        ).toBe('function')
      }
    }
  })

  it('enum fields carry their closed value set; other types never do', () => {
    for (const f of fields) {
      if (f.type === 'enum') expect(f.values, `${f.id} enum needs values`).toBeDefined()
      else expect(f.values, `${f.id}: values only belongs on enum fields`).toBeUndefined()
    }
  })

  it('pins the founder-named anchor fields with their real wiring', () => {
    const byId = new Map(fields.map((f) => [f.id, f]))
    // Date of incorporation — the founder's own example — starts the compliance clock.
    expect(byId.get('incorporation-date')?.producedBy).toBe('certificate-of-incorporation')
    expect(byId.get('incorporation-date')?.consumedBy.map((c) => `${c.module}.${c.function}`))
      .toContain('deadlines.complianceCalendar')
    // The DE franchise-tax inputs come from the charter.
    expect(byId.get('authorized-shares')?.producedBy).toBe('certificate-of-incorporation')
    expect(byId.get('authorized-shares')?.consumedBy.map((c) => `${c.module}.${c.function}`))
      .toContain('deFranchiseTax.authorizedSharesMethodTax')
    // Runway takes cash and burn.
    expect(byId.get('cash-on-hand')?.producedBy).toBe('bank-account')
    expect(byId.get('cash-on-hand')?.consumedBy.map((c) => `${c.module}.${c.function}`))
      .toContain('runway.simpleRunwayMonths')
    // Cap table establishes the share counts.
    expect(byId.get('fully-diluted-shares')?.producedBy).toBe('cap-table')
  })
})

describe('render rows resolve both directions', () => {
  it('fieldsEstablishedBy: the charter establishes dated + numeric fields, consumers linked to module pages', () => {
    const rows = fieldsEstablishedBy('certificate-of-incorporation')
    expect(rows.map((r) => r.field.id)).toContain('incorporation-date')
    expect(rows.map((r) => r.field.id)).toContain('authorized-shares')
    for (const r of rows) {
      for (const c of r.consumers) {
        expect(c.href).toBe(`/open-modules/${c.moduleId}`)
        expect(c.moduleLabel).toBe(map[c.moduleId].label)
        expect(c.functions.length).toBeGreaterThan(0)
      }
    }
    // An artifact that establishes nothing renders no rows.
    expect(fieldsEstablishedBy('team-chat')).toEqual([])
  })

  it('fieldsConsumedByModule: runway consumes the money/growth fields, each linking its artifact', () => {
    const rows = fieldsConsumedByModule('runway')
    expect(rows.map((r) => r.field.id)).toEqual(
      expect.arrayContaining(['cash-on-hand', 'monthly-revenue', 'monthly-expenses']),
    )
    for (const r of rows) {
      expect(r.artifactHref).toBe(`/artifacts/${r.artifactId}`)
      expect(artifactIds.has(r.artifactId)).toBe(true)
    }
    // A module whose functions take no registered company-level field renders nothing.
    expect(fieldsConsumedByModule('unitEconomics')).toEqual([])
  })
})
