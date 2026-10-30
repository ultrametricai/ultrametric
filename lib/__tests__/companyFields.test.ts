import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBusinessLogicMap } from '../businessLogicMap'
import {
  FIELD_GEO_COUNTRIES,
  FIELD_GEO_EQUIVALENT_COUNTRIES,
  companyFieldGroups,
  fieldsConsumedByModule,
  fieldsEstablishedBy,
  findFieldPage,
  isFieldGeoInstance,
  loadCompanyFields,
  loadFieldPages,
  type FieldGeoAbsence,
  type FieldGeoInstance,
} from '../companyFields'
import { GEO_NOTE_COUNTRIES, loadArtifacts, loadProcesses } from '../processes'

// Totality gate for the company-fields registry (founder 2026-10-07: typed company data
// fields; 2026-10-08: spec blocks + the identifier widening). The registry's honesty rule is
// that a field exists ONLY because a committed artifact establishes it and committed code or a
// committed corpus process consumes it, so every edge must resolve:
//   1. producedBy → a real open-artifacts/registry.json artifact;
//   2. consumedBy.module → a real business-logic-map module (a real lib/openstartup file);
//   3. consumedBy.function → a REAL exported function of that module (misspellings fail);
//   4. a field WITHOUT consumedBy (the widened identifier path) must have its establishing
//      artifact in the `requires` list of committed corpus processes — requires-and-carries,
//      never speculative;
//   5. enum fields carry their closed value set, non-enum fields never do;
//   6. every spec is total: format + authority + whereItAppears + verified-URL sources;
//      patterns compile; a committed example matches its own pattern;
//   7. the registry stays the honest small cut (bounds guard against decorating).

const fields = loadCompanyFields()
const artifactIds = new Set(loadArtifacts().map((a) => a.id))
const map = loadBusinessLogicMap()
const requiredArtifactIds = new Set(loadProcesses().flatMap((t) => t.requires))

describe('open-artifacts/fields.json totality', () => {
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
      const consumedBy = f.consumedBy ?? []
      const keys = consumedBy.map((c) => `${c.module}.${c.function}`)
      expect(new Set(keys).size, `${f.id} duplicate consumer`).toBe(keys.length)
      for (const c of consumedBy) {
        expect(map[c.module], `${f.id}: unknown module ${c.module}`).toBeDefined()
        expect(
          fs.existsSync(path.resolve(__dirname, '..', '..', map[c.module].file)),
          `${f.id}: ${map[c.module].file} missing`,
        ).toBe(true)
      }
    }
  })

  it('the widened derivation rule holds both arms: a module consumer, or the establishing artifact in committed corpus requires lists', () => {
    for (const f of fields) {
      const hasModuleConsumer = (f.consumedBy ?? []).length > 0
      const requiredAndCarried = requiredArtifactIds.has(f.producedBy)
      expect(
        hasModuleConsumer || requiredAndCarried,
        `${f.id}: no committed module consumes it and no committed process requires ${f.producedBy}`,
      ).toBe(true)
      // The second arm is real, not decorative: a field that drops consumedBy must ride a
      // genuine requires edge, and the field-page rows computed from it must be non-empty.
      if (!hasModuleConsumer) {
        expect(requiredAndCarried, `${f.id}: identifier path without a requires edge`).toBe(true)
        expect(findFieldPage(f.id)!.requiringProcesses.length).toBeGreaterThan(0)
      }
    }
  })

  it('every consumer names a real exported FUNCTION of its module (misspellings fail here)', async () => {
    for (const f of fields) {
      for (const c of f.consumedBy ?? []) {
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
    expect(byId.get('incorporation-date')?.consumedBy?.map((c) => `${c.module}.${c.function}`))
      .toContain('deadlines.complianceCalendar')
    // The DE franchise-tax inputs come from the charter.
    expect(byId.get('authorized-shares')?.producedBy).toBe('certificate-of-incorporation')
    expect(byId.get('authorized-shares')?.consumedBy?.map((c) => `${c.module}.${c.function}`))
      .toContain('deFranchiseTax.authorizedSharesMethodTax')
    // Runway takes cash and burn.
    expect(byId.get('cash-on-hand')?.producedBy).toBe('bank-account')
    expect(byId.get('cash-on-hand')?.consumedBy?.map((c) => `${c.module}.${c.function}`))
      .toContain('runway.simpleRunwayMonths')
    // Cap table establishes the share counts.
    expect(byId.get('fully-diluted-shares')?.producedBy).toBe('cap-table')
  })
})

// The spec layer (founder 2026-10-08: "a page that explains the specification of data fields
// like an EIN"). Every field carries a total spec; patterns are real regexes; committed
// examples are the authority's own documented ones and must satisfy their own pattern.
describe('field specs (founder 2026-10-08)', () => {
  it('every field carries a total spec with https sources', () => {
    for (const f of fields) {
      expect(f.spec.format.length, `${f.id} format`).toBeGreaterThan(0)
      expect(f.spec.authority.length, `${f.id} authority`).toBeGreaterThan(0)
      expect(f.spec.whereItAppears.length, `${f.id} whereItAppears`).toBeGreaterThan(0)
      expect(f.spec.sources.length, `${f.id} sources`).toBeGreaterThan(0)
      for (const s of f.spec.sources) {
        expect(new URL(s.url).protocol, `${f.id}: ${s.url}`).toBe('https:')
      }
    }
  })

  it('every pattern compiles, and a committed example matches its own pattern', () => {
    for (const f of fields) {
      if (f.spec.pattern) expect(() => new RegExp(f.spec.pattern!), f.id).not.toThrow()
      if (f.spec.example) {
        expect(f.spec.pattern, `${f.id}: an example without a pattern`).toBeDefined()
        expect(new RegExp(f.spec.pattern!).test(f.spec.example), `${f.id} example`).toBe(true)
      }
    }
  })

  it('EIN: the founder-named identifier, derived on the widened requires-and-carries path with the IRS-documented format', () => {
    const ein = fields.find((f) => f.id === 'ein')!
    expect(ein.producedBy).toBe('ein')
    expect(ein.consumedBy).toBeUndefined()
    expect(ein.spec.authority).toBe('Internal Revenue Service')
    // The documented arrangements, both from the cited IRS pages: Pub 15's 00-0000000 and the
    // SS-4 instructions' example 12-3456789 — the pattern validates both masks.
    const re = new RegExp(ein.spec.pattern!)
    expect(re.test('00-0000000')).toBe(true)
    expect(ein.spec.example).toBe('12-3456789')
    expect(re.test(ein.spec.example!)).toBe(true)
    // Its consuming processes are the corpus requires edges on the ein artifact.
    const page = findFieldPage('ein')!
    expect(page.requiringProcesses.map((p) => p.id)).toEqual(
      loadProcesses().filter((t) => t.requires.includes('ein')).map((t) => t.id),
    )
    expect(page.requiringProcesses.length).toBeGreaterThanOrEqual(5)
  })

  it('state file number: Delaware Division of Corporations, numeric up to 9 digits, no invented example', () => {
    const f = fields.find((x) => x.id === 'state-file-number')!
    expect(f.producedBy).toBe('certificate-of-incorporation')
    expect(f.consumedBy).toBeUndefined()
    expect(f.spec.pattern).toBe('^[0-9]{1,9}$')
    // Delaware documents no sample number — honest absence, never an invention.
    expect(f.spec.example).toBeUndefined()
    expect(findFieldPage('state-file-number')!.requiringProcesses.length).toBeGreaterThan(0)
  })
})

// The /fields page family rows (lib side; render pins live in app/fields/__tests__).
describe('field pages and index groups', () => {
  it('loadFieldPages: one row per registry field, artifact resolved and linked', () => {
    const pages = loadFieldPages()
    expect(pages.map((p) => p.field.id)).toEqual(fields.map((f) => f.id))
    for (const p of pages) {
      expect(p.artifact.id).toBe(p.field.producedBy)
      expect(p.artifact.href).toBe(`/artifacts/${p.field.producedBy}`)
      for (const c of p.consumers) expect(c.href).toBe(`/open-modules/${c.moduleId}`)
      for (const proc of p.requiringProcesses) expect(proc.href).toMatch(/^\/processes\//)
    }
  })

  it('companyFieldGroups: grouped by committed type only, every field in exactly one group', () => {
    const groups = companyFieldGroups()
    const grouped = groups.flatMap((g) => g.fields.map((f) => f.id))
    expect(grouped.sort()).toEqual(fields.map((f) => f.id).sort())
    const identifiers = groups.find((g) => g.label === 'Identifiers')!
    expect(identifiers.fields.map((f) => f.id)).toContain('ein')
    expect(identifiers.fields.every((f) => f.type === 'string')).toBe(true)
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

// The geo dimension (founder field-standards order, landed with the open-artifacts/ move
// 2026-10-14): every field records where its value is defined — the universal form for
// company-record values, or a US base instance plus one entry per covered country, each a
// government-defined equivalent or a recorded absence. Totality and coherence gates; the
// per-country facts themselves live in the registry with their authority-page citations.
describe('field geo dimension', () => {
  const bound = fields.filter((f) => !('scope' in f.geo))

  it('the country vocabulary is US plus the geo switcher set, and both forms are in use', () => {
    expect([...FIELD_GEO_COUNTRIES].sort()).toEqual(['US', ...GEO_NOTE_COUNTRIES].sort())
    for (const country of FIELD_GEO_EQUIVALENT_COUNTRIES) expect(GEO_NOTE_COUNTRIES).toContain(country)
    expect(FIELD_GEO_EQUIVALENT_COUNTRIES).not.toContain('NL')
    expect(bound.length).toBeGreaterThan(0)
    expect(fields.length - bound.length).toBeGreaterThan(0)
  })

  it('every jurisdiction-bound field: US base, each covered country exactly once', () => {
    for (const f of bound) {
      const geo = f.geo as Extract<typeof f.geo, { base: unknown }>
      expect(geo.base.country, `${f.id} base`).toBe('US')
      const countries = geo.equivalents.map((e) => e.country)
      expect([...countries].sort(), `${f.id} country coverage`).toEqual(
        [...FIELD_GEO_EQUIVALENT_COUNTRIES].sort(),
      )
    }
  })

  it('every geo pattern compiles, examples match their own pattern, sources are https', () => {
    for (const f of bound) {
      const geo = f.geo as Extract<typeof f.geo, { base: unknown }>
      for (const entry of [geo.base, ...geo.equivalents]) {
        if (!isFieldGeoInstance(entry)) {
          for (const s of entry.sources ?? []) {
            expect(new URL(s.url).protocol, `${f.id}/${entry.country}: ${s.url}`).toBe('https:')
          }
          continue
        }
        if (entry.pattern) {
          expect(() => new RegExp(entry.pattern!), `${f.id}/${entry.country}`).not.toThrow()
        }
        if (entry.example) {
          expect(entry.pattern, `${f.id}/${entry.country}: example without pattern`).toBeDefined()
          expect(
            new RegExp(entry.pattern!).test(entry.example),
            `${f.id}/${entry.country} example`,
          ).toBe(true)
        }
        for (const s of entry.sources) {
          expect(new URL(s.url).protocol, `${f.id}/${entry.country}: ${s.url}`).toBe('https:')
        }
      }
    }
  })

  it('pins the founder-named equivalents where verification succeeded', () => {
    const geoOf = (id: string) =>
      fields.find((f) => f.id === id)!.geo as {
        base: FieldGeoInstance
        equivalents: Array<FieldGeoInstance | FieldGeoAbsence>
      }
    const ein = geoOf('ein')
    expect(ein.base.pattern).toBe('^[0-9]{2}-[0-9]{7}$')
    const einByCountry = new Map(ein.equivalents.map((e) => [e.country, e]))
    expect((einByCountry.get('UK') as FieldGeoInstance).label).toContain('UTR')
    expect((einByCountry.get('UK') as FieldGeoInstance).pattern).toBe('^[0-9]{10}$')
    expect((einByCountry.get('DE') as FieldGeoInstance).label).toBe('Steuernummer')
    expect((einByCountry.get('FR') as FieldGeoInstance).pattern).toBe('^[0-9]{9}$')
    expect((einByCountry.get('IN') as FieldGeoInstance).label).toContain('PAN')
    expect((einByCountry.get('PT') as FieldGeoInstance).label).toContain('NIPC')
    expect((einByCountry.get('CA') as FieldGeoInstance).label).toContain('Business number')
    // The verified CBCA absence: federal shares carry no par value.
    const par = geoOf('par-value')
    const parCA = par.equivalents.find((e) => e.country === 'CA')!
    expect(isFieldGeoInstance(parCA)).toBe(false)
    expect((parCA as FieldGeoAbsence).status).toBe('no-equivalent')
    expect((parCA as FieldGeoAbsence).sources?.length).toBeGreaterThan(0)
  })
})
